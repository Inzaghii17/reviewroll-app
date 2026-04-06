from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from sqlalchemy import text

from ..extensions import get_db_session

requests_bp = Blueprint('requests', __name__)


@requests_bp.post('')
@jwt_required()
def submit_request():
    user_id = int(get_jwt_identity())
    payload = request.get_json(silent=True) or {}

    title = (payload.get('title') or '').strip()
    year = payload.get('year')

    if not title or not year:
        return jsonify({'error': 'Movie title and release year are required'}), 400

    try:
        release_year = int(year)
    except (TypeError, ValueError):
        return jsonify({'error': 'Invalid release year'}), 400

    if release_year < 1900 or release_year > 2100:
        return jsonify({'error': 'Invalid release year'}), 400

    session = get_db_session()
    try:
        result = session.execute(
            text(
                'INSERT INTO Movie_Request (Requested_title, Release_year, User_ID) VALUES (:title, :year, :user_id)'
            ),
            {'title': title, 'year': release_year, 'user_id': user_id},
        )
        session.commit()
        return jsonify({'message': 'Movie request submitted successfully!', 'requestId': result.lastrowid}), 201
    except Exception as err:
        session.rollback()
        # Keep compatibility with trigger duplicate rejection semantics.
        message = str(err)
        if 'Duplicate request rejected' in message or 'already exists' in message:
            return jsonify({'error': message}), 409
        return jsonify({'error': 'Server error'}), 500
    finally:
        session.close()


@requests_bp.get('/my')
@jwt_required()
def get_my_requests():
    user_id = int(get_jwt_identity())
    session = get_db_session()
    try:
        rows = session.execute(
            text('SELECT * FROM Movie_Request WHERE User_ID = :user_id ORDER BY Requested_at DESC'),
            {'user_id': user_id},
        ).mappings().all()
        return jsonify([dict(row) for row in rows])
    except Exception:
        return jsonify({'error': 'Server error'}), 500
    finally:
        session.close()
