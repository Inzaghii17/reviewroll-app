from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt, get_jwt_identity, jwt_required
from sqlalchemy import text

from ..extensions import get_db_session

ratings_bp = Blueprint('ratings', __name__)


@ratings_bp.post('/<int:movie_id>')
@jwt_required()
def rate_movie(movie_id):
    payload = request.get_json(silent=True) or {}
    rating = payload.get('rating')

    if not rating:
        return jsonify({'error': 'Rating must be between 1 and 10'}), 400

    try:
        rating_val = int(rating)
    except (TypeError, ValueError):
        return jsonify({'error': 'Rating must be between 1 and 10'}), 400

    if rating_val < 1 or rating_val > 10:
        return jsonify({'error': 'Rating must be between 1 and 10'}), 400

    user_id = int(get_jwt_identity())

    session = get_db_session()
    try:
        # ── Conflicting Transaction: Concurrent Rating Submission ─────────────
        # Without locking, two simultaneous requests (e.g. double-click or two
        # browser tabs) both read no existing rating, then both try to INSERT,
        # causing a UNIQUE KEY (User_ID, Movie_ID) violation.
        # SELECT ... FOR UPDATE acquires a write lock on the row if it exists,
        # or a gap lock if it does not. The second concurrent session BLOCKS
        # here until the first commits, then re-reads the correct state and
        # takes the UPDATE path instead of INSERT — zero constraint errors.
        session.execute(text('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ'))
        session.execute(text('START TRANSACTION'))

        existing = session.execute(
            text(
                'SELECT Rating_ID FROM Rating'
                ' WHERE User_ID = :user_id AND Movie_ID = :movie_id FOR UPDATE'
            ),
            {'user_id': user_id, 'movie_id': movie_id},
        ).mappings().first()

        if existing:
            session.execute(
                text('UPDATE Rating SET Rating_value = :rating WHERE Rating_ID = :rating_id'),
                {'rating': rating_val, 'rating_id': existing['Rating_ID']},
            )
        else:
            session.execute(
                text('INSERT INTO Rating (Rating_value, User_ID, Movie_ID) VALUES (:rating, :user_id, :movie_id)'),
                {'rating': rating_val, 'user_id': user_id, 'movie_id': movie_id},
            )

        avg = session.execute(
            text('SELECT ROUND(AVG(Rating_value), 1) AS avg_rating, COUNT(*) AS count FROM Rating WHERE Movie_ID = :movie_id'),
            {'movie_id': movie_id},
        ).mappings().first()

        session.commit()
        return jsonify({'message': 'Rating saved', 'avg_rating': avg['avg_rating'], 'count': avg['count']})
    except Exception:
        session.rollback()
        return jsonify({'error': 'Server error'}), 500
    finally:
        session.close()



@ratings_bp.get('/<int:movie_id>')
def get_movie_ratings(movie_id):
    session = get_db_session()
    try:
        ratings = session.execute(
            text(
                """
                SELECT r.*, u.Name AS user_name
                FROM Rating r
                JOIN User u ON r.User_ID = u.User_ID
                WHERE r.Movie_ID = :movie_id
                ORDER BY r.Created_at DESC
                """
            ),
            {'movie_id': movie_id},
        ).mappings().all()

        avg = session.execute(
            text('SELECT ROUND(AVG(Rating_value), 1) AS avg_rating, COUNT(*) AS count FROM Rating WHERE Movie_ID = :movie_id'),
            {'movie_id': movie_id},
        ).mappings().first()

        return jsonify({'ratings': [dict(row) for row in ratings], 'avg_rating': avg['avg_rating'], 'count': avg['count']})
    except Exception:
        return jsonify({'error': 'Server error'}), 500
    finally:
        session.close()
