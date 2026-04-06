from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt, get_jwt_identity, jwt_required
from sqlalchemy import text

from ..extensions import get_db_session

reviews_bp = Blueprint('reviews', __name__)


@reviews_bp.post('/<int:movie_id>')
@jwt_required()
def add_review(movie_id):
    payload = request.get_json(silent=True) or {}
    text_value = (payload.get('text') or '').strip()

    if not text_value:
        return jsonify({'error': 'Review text is required'}), 400

    user_id = int(get_jwt_identity())

    session = get_db_session()
    try:
        result = session.execute(
            text('INSERT INTO Review (Review_text, User_ID, Movie_ID) VALUES (:text, :user_id, :movie_id)'),
            {'text': text_value, 'user_id': user_id, 'movie_id': movie_id},
        )

        review = session.execute(
            text(
                """
                SELECT rv.*, u.Name AS user_name
                FROM Review rv
                JOIN User u ON rv.User_ID = u.User_ID
                WHERE rv.Review_ID = :review_id
                """
            ),
            {'review_id': result.lastrowid},
        ).mappings().first()

        session.commit()
        return jsonify(dict(review)), 201
    except Exception:
        session.rollback()
        return jsonify({'error': 'Server error'}), 500
    finally:
        session.close()


@reviews_bp.get('/<int:movie_id>')
def get_reviews(movie_id):
    session = get_db_session()
    try:
        rows = session.execute(
            text(
                """
                SELECT rv.*, u.Name AS user_name
                FROM Review rv
                JOIN User u ON rv.User_ID = u.User_ID
                WHERE rv.Movie_ID = :movie_id
                ORDER BY rv.Created_at DESC
                """
            ),
            {'movie_id': movie_id},
        ).mappings().all()
        return jsonify([dict(row) for row in rows])
    except Exception:
        return jsonify({'error': 'Server error'}), 500
    finally:
        session.close()


@reviews_bp.delete('/<int:review_id>')
@jwt_required()
def delete_review(review_id):
    user_id = int(get_jwt_identity())
    role = get_jwt().get('role')

    session = get_db_session()
    try:
        review = session.execute(
            text('SELECT * FROM Review WHERE Review_ID = :review_id'),
            {'review_id': review_id},
        ).mappings().first()

        if not review:
            return jsonify({'error': 'Review not found'}), 404

        if review['User_ID'] != user_id and role != 'ADMIN':
            return jsonify({'error': 'Not authorized'}), 403

        session.execute(
            text('DELETE FROM Review WHERE Review_ID = :review_id'),
            {'review_id': review_id},
        )
        session.commit()
        return jsonify({'message': 'Review deleted'})
    except Exception:
        session.rollback()
        return jsonify({'error': 'Server error'}), 500
    finally:
        session.close()
