from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from sqlalchemy import text

from ..extensions import get_db_session

watchlists_bp = Blueprint('watchlists', __name__)


@watchlists_bp.get('')
@jwt_required()
def get_watchlists():
    user_id = int(get_jwt_identity())
    session = get_db_session()
    try:
        rows = session.execute(
            text(
                """
                SELECT w.*, COUNT(wi.Movie_ID) AS item_count
                FROM Watchlist w
                LEFT JOIN Watchlist_Item wi ON w.Watchlist_ID = wi.Watchlist_ID
                WHERE w.User_ID = :user_id
                GROUP BY w.Watchlist_ID
                ORDER BY w.Created_at DESC
                """
            ),
            {'user_id': user_id},
        ).mappings().all()
        return jsonify([dict(row) for row in rows])
    except Exception:
        return jsonify({'error': 'Server error'}), 500
    finally:
        session.close()


@watchlists_bp.get('/<int:watchlist_id>')
@jwt_required()
def get_watchlist(watchlist_id):
    user_id = int(get_jwt_identity())
    session = get_db_session()
    try:
        watchlist = session.execute(
            text('SELECT * FROM Watchlist WHERE Watchlist_ID = :watchlist_id AND User_ID = :user_id'),
            {'watchlist_id': watchlist_id, 'user_id': user_id},
        ).mappings().first()

        if not watchlist:
            return jsonify({'error': 'Watchlist not found'}), 404

        movies = session.execute(
            text(
                """
                SELECT m.*, ROUND(AVG(r.Rating_value), 1) AS avg_rating,
                    GROUP_CONCAT(DISTINCT g.Genre_name SEPARATOR ', ') AS genres
                FROM Watchlist_Item wi
                JOIN Movie m ON wi.Movie_ID = m.Movie_ID
                LEFT JOIN Rating r ON m.Movie_ID = r.Movie_ID
                LEFT JOIN Movie_Genre mg ON m.Movie_ID = mg.Movie_ID
                LEFT JOIN Genre g ON mg.Genre_ID = g.Genre_ID
                WHERE wi.Watchlist_ID = :watchlist_id
                GROUP BY m.Movie_ID
                """
            ),
            {'watchlist_id': watchlist_id},
        ).mappings().all()

        response = dict(watchlist)
        response['movies'] = [dict(row) for row in movies]
        return jsonify(response)
    except Exception:
        return jsonify({'error': 'Server error'}), 500
    finally:
        session.close()


@watchlists_bp.post('')
@jwt_required()
def create_watchlist():
    user_id = int(get_jwt_identity())
    payload = request.get_json(silent=True) or {}
    name = (payload.get('name') or '').strip()

    if not name:
        return jsonify({'error': 'Watchlist name required'}), 400

    session = get_db_session()
    try:
        result = session.execute(
            text('INSERT INTO Watchlist (Watchlist_name, User_ID) VALUES (:name, :user_id)'),
            {'name': name, 'user_id': user_id},
        )
        session.commit()
        return jsonify({'Watchlist_ID': result.lastrowid, 'Watchlist_name': name}), 201
    except Exception:
        session.rollback()
        return jsonify({'error': 'Server error'}), 500
    finally:
        session.close()


@watchlists_bp.post('/<int:watchlist_id>/movies')
@jwt_required()
def add_movie_to_watchlist(watchlist_id):
    user_id = int(get_jwt_identity())
    payload = request.get_json(silent=True) or {}
    movie_id = payload.get('movieId')

    if not movie_id:
        return jsonify({'error': 'Movie ID required'}), 400

    session = get_db_session()
    try:
        # ── Conflicting Transaction: Concurrent Watchlist Add ─────────────────
        # A user double-clicking "Add to Watchlist", or two open browser tabs,
        # could fire two POST requests simultaneously. Without locking, both
        # sessions read no existing Watchlist_Item row, then both attempt
        # INSERT — crashing on the composite PRIMARY KEY (Watchlist_ID, Movie_ID).
        # SELECT ... FOR UPDATE on the parent Watchlist row acts as a mutex:
        # Session B blocks here until Session A commits. When B resumes, it
        # re-checks Watchlist_Item, finds the row now exists, and cleanly
        # returns 409 instead of a database error.
        session.execute(text('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ'))
        session.execute(text('START TRANSACTION'))

        watchlist = session.execute(
            text(
                'SELECT * FROM Watchlist'
                ' WHERE Watchlist_ID = :watchlist_id AND User_ID = :user_id FOR UPDATE'
            ),
            {'watchlist_id': watchlist_id, 'user_id': user_id},
        ).mappings().first()

        if not watchlist:
            session.rollback()
            return jsonify({'error': 'Watchlist not found'}), 404

        # Re-check inside the lock — this is the critical read that prevents
        # the duplicate insert under concurrent access.
        existing = session.execute(
            text(
                'SELECT 1 FROM Watchlist_Item'
                ' WHERE Watchlist_ID = :watchlist_id AND Movie_ID = :movie_id LIMIT 1'
            ),
            {'watchlist_id': watchlist_id, 'movie_id': movie_id},
        ).mappings().first()

        if existing:
            session.rollback()
            return jsonify({'error': 'This movie is already added to this watchlist.'}), 409

        session.execute(
            text('INSERT INTO Watchlist_Item (Watchlist_ID, Movie_ID) VALUES (:watchlist_id, :movie_id)'),
            {'watchlist_id': watchlist_id, 'movie_id': movie_id},
        )
        session.commit()
        return jsonify({'message': 'Movie added to watchlist'})
    except Exception:
        session.rollback()
        return jsonify({'error': 'Server error'}), 500
    finally:
        session.close()



@watchlists_bp.delete('/<int:watchlist_id>/movies/<int:movie_id>')
@jwt_required()
def remove_movie_from_watchlist(watchlist_id, movie_id):
    user_id = int(get_jwt_identity())
    session = get_db_session()
    try:
        watchlist = session.execute(
            text('SELECT * FROM Watchlist WHERE Watchlist_ID = :watchlist_id AND User_ID = :user_id'),
            {'watchlist_id': watchlist_id, 'user_id': user_id},
        ).mappings().first()

        if not watchlist:
            return jsonify({'error': 'Watchlist not found'}), 404

        session.execute(
            text('DELETE FROM Watchlist_Item WHERE Watchlist_ID = :watchlist_id AND Movie_ID = :movie_id'),
            {'watchlist_id': watchlist_id, 'movie_id': movie_id},
        )
        session.commit()
        return jsonify({'message': 'Movie removed'})
    except Exception:
        session.rollback()
        return jsonify({'error': 'Server error'}), 500
    finally:
        session.close()
