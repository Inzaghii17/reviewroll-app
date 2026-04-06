import os

import requests
from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt, get_jwt_identity, jwt_required
from sqlalchemy import text

from ..extensions import get_db_session

admin_bp = Blueprint('admin', __name__)


def _ensure_admin():
    claims = get_jwt()
    return claims.get('role') == 'ADMIN'


def _fetch_tmdb_by_title(title):
    api_key = os.getenv('TMDB_API_KEY')
    if not api_key:
        raise ValueError('TMDB API Key missing in environment variables. Please add TMDB_API_KEY to your .env file.')

    search_res = requests.get(
        'https://api.themoviedb.org/3/search/movie',
        params={'query': title, 'api_key': api_key},
        timeout=12,
    )
    search_data = search_res.json()
    if not search_data.get('results'):
        raise ValueError(f'No movie found on TMDB for "{title}".')

    tmdb_id = search_data['results'][0]['id']
    details_res = requests.get(
        f'https://api.themoviedb.org/3/movie/{tmdb_id}',
        params={'append_to_response': 'videos', 'api_key': api_key},
        timeout=12,
    )
    movie_data = details_res.json()

    trailer_url = None
    videos = movie_data.get('videos', {}).get('results', [])
    for video in videos:
        if video.get('type') == 'Trailer' and video.get('site') == 'YouTube':
            trailer_url = f"https://www.youtube.com/embed/{video.get('key')}"
            break

    return {
        'title': movie_data.get('title'),
        'year': int(movie_data['release_date'].split('-')[0]) if movie_data.get('release_date') else None,
        'duration': movie_data.get('runtime') or None,
        'description': movie_data.get('overview') or '',
        'imageUrl': f"https://image.tmdb.org/t/p/w500{movie_data['poster_path']}" if movie_data.get('poster_path') else None,
        'language': movie_data.get('original_language') or 'Unknown',
        'budget': movie_data.get('budget') or 0,
        'revenue': movie_data.get('revenue') or 0,
        'release_date': movie_data.get('release_date') or None,
        'trailerUrl': trailer_url,
        'trivia': movie_data.get('tagline') or None,
    }


@admin_bp.get('/requests')
@jwt_required()
def get_admin_requests():
    if not _ensure_admin():
        return jsonify({'error': 'Admin access required'}), 403

    session = get_db_session()
    try:
        rows = session.execute(
            text(
                """
                SELECT mr.*, u.Name AS user_name, u.Email AS user_email
                FROM Movie_Request mr
                JOIN User u ON mr.User_ID = u.User_ID
                ORDER BY mr.Requested_at DESC
                """
            )
        ).mappings().all()
        return jsonify([dict(row) for row in rows])
    except Exception:
        return jsonify({'error': 'Server error'}), 500
    finally:
        session.close()


@admin_bp.post('/requests/<int:request_id>/approve')
@jwt_required()
def approve_request(request_id):
    if not _ensure_admin():
        return jsonify({'error': 'Admin access required'}), 403

    payload = request.get_json(silent=True) or {}

    session = get_db_session()
    try:
        req_row = session.execute(
            text('SELECT * FROM Movie_Request WHERE Request_ID = :request_id'),
            {'request_id': request_id},
        ).mappings().first()

        if not req_row:
            return jsonify({'error': 'Request not found'}), 404

        tmdb_data = None
        auto_fetch = str(payload.get('autoFetch', 'false')).lower() == 'true'
        if auto_fetch:
            lookup_title = (payload.get('title') or '').strip() or req_row['Requested_title']
            tmdb_data = _fetch_tmdb_by_title(lookup_title)

        final_title = (payload.get('title') or '').strip() or (tmdb_data or {}).get('title') or req_row['Requested_title']
        final_year = int(payload.get('year') or (tmdb_data or {}).get('year') or req_row['Release_year'])
        final_duration = int(payload.get('duration') or (tmdb_data or {}).get('duration') or 120)
        final_description = (payload.get('description') or (tmdb_data or {}).get('description') or '').strip()
        final_image_url = (payload.get('imageUrl') or '').strip() or (tmdb_data or {}).get('imageUrl')
        final_language = (payload.get('language') or (tmdb_data or {}).get('language') or 'Unknown').strip()
        final_budget = int(payload.get('budget') or (tmdb_data or {}).get('budget') or 0)
        final_revenue = int(payload.get('revenue') or (tmdb_data or {}).get('revenue') or 0)
        final_release_date = payload.get('release_date') or (tmdb_data or {}).get('release_date')
        final_trailer_url = payload.get('trailerUrl') or (tmdb_data or {}).get('trailerUrl')
        final_trivia = payload.get('trivia') or (tmdb_data or {}).get('trivia')

        if not final_title or not final_year or not final_duration:
            return jsonify({'error': 'Title, year, and duration are required'}), 400

        existing = session.execute(
            text('SELECT Movie_ID FROM Movie WHERE LOWER(Title) = LOWER(:title) AND Release_year = :year'),
            {'title': final_title, 'year': final_year},
        ).mappings().first()

        if existing:
            return jsonify({'error': f'Movie "{final_title}" ({final_year}) already exists in the catalog.'}), 409

        insert_result = session.execute(
            text(
                """
                INSERT INTO Movie (Title, Release_year, Language, Duration, Description, Image_URL, Budget, Revenue, Release_date, Trailer_URL, Trivia)
                VALUES (:title, :year, :language, :duration, :description, :image_url, :budget, :revenue, :release_date, :trailer_url, :trivia)
                """
            ),
            {
                'title': final_title,
                'year': final_year,
                'language': final_language,
                'duration': final_duration,
                'description': final_description,
                'image_url': final_image_url,
                'budget': final_budget,
                'revenue': final_revenue,
                'release_date': final_release_date,
                'trailer_url': final_trailer_url,
                'trivia': final_trivia,
            },
        )

        session.execute(
            text('DELETE FROM Movie_Request WHERE Request_ID = :request_id'),
            {'request_id': request_id},
        )
        session.commit()

        return jsonify(
            {
                'message': f'"{final_title}" approved and added to catalog.',
                'movieId': insert_result.lastrowid,
                'imageUrl': final_image_url,
                'source': 'tmdb+manual' if tmdb_data else 'manual',
            }
        )
    except ValueError as err:
        session.rollback()
        return jsonify({'error': str(err)}), 400
    except Exception:
        session.rollback()
        return jsonify({'error': 'Server error during approval'}), 500
    finally:
        session.close()


@admin_bp.delete('/requests/<int:request_id>')
@jwt_required()
def reject_request(request_id):
    if not _ensure_admin():
        return jsonify({'error': 'Admin access required'}), 403

    session = get_db_session()
    try:
        req_row = session.execute(
            text('SELECT * FROM Movie_Request WHERE Request_ID = :request_id'),
            {'request_id': request_id},
        ).mappings().first()

        if not req_row:
            return jsonify({'error': 'Request not found'}), 404

        session.execute(
            text('DELETE FROM Movie_Request WHERE Request_ID = :request_id'),
            {'request_id': request_id},
        )
        session.commit()
        return jsonify({'message': f'Request for "{req_row["Requested_title"]}" rejected.'})
    except Exception:
        session.rollback()
        return jsonify({'error': 'Server error'}), 500
    finally:
        session.close()


@admin_bp.get('/stats')
@jwt_required()
def get_admin_stats():
    if not _ensure_admin():
        return jsonify({'error': 'Admin access required'}), 403

    session = get_db_session()
    try:
        totals = session.execute(
            text(
                """
                SELECT
                    (SELECT COUNT(*) FROM User) AS total_users,
                    (SELECT COUNT(*) FROM Movie) AS total_movies,
                    (SELECT COUNT(*) FROM Rating) AS total_ratings,
                    (SELECT COUNT(*) FROM Review) AS total_reviews,
                    (SELECT COUNT(*) FROM Movie_Request) AS pending_requests,
                    (SELECT COUNT(*) FROM Discussion_Post WHERE Is_deleted = FALSE) AS total_posts
                """
            )
        ).mappings().first()
        return jsonify(dict(totals))
    except Exception:
        return jsonify({'error': 'Server error'}), 500
    finally:
        session.close()
