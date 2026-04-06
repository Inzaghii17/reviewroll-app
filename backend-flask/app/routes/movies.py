from flask import Blueprint, jsonify
from flask_jwt_extended import get_jwt_identity, verify_jwt_in_request
from sqlalchemy import text

from ..extensions import get_db_session

movies_bp = Blueprint('movies', __name__)


def _optional_user_id():
    try:
        verify_jwt_in_request(optional=True)
        identity = get_jwt_identity()
        return int(identity) if identity else None
    except Exception:
        # Match existing optional auth behavior: ignore bad token and continue unauthenticated.
        return None


@movies_bp.get('')
def get_movies():
    session = get_db_session()
    try:
        rows = session.execute(
            text(
                """
                SELECT m.*,
                    COALESCE(m.Avg_rating, ROUND(AVG(r.Rating_value), 1)) AS avg_rating,
                    COUNT(DISTINCT r.Rating_ID) AS rating_count,
                    GROUP_CONCAT(DISTINCT g.Genre_name ORDER BY g.Genre_name SEPARATOR ', ') AS genres
                FROM Movie m
                LEFT JOIN Rating r ON m.Movie_ID = r.Movie_ID
                LEFT JOIN Movie_Genre mg ON m.Movie_ID = mg.Movie_ID
                LEFT JOIN Genre g ON mg.Genre_ID = g.Genre_ID
                GROUP BY m.Movie_ID
                ORDER BY m.Movie_ID
                """
            )
        ).mappings().all()

        movies = [dict(row) for row in rows]
        return jsonify(movies)
    except Exception:
        return jsonify({'error': 'Server error'}), 500
    finally:
        session.close()


@movies_bp.get('/<int:movie_id>')
def get_movie(movie_id):
    session = get_db_session()
    user_id = _optional_user_id()
    try:
        movie = session.execute(
            text(
                """
                SELECT m.*,
                    ROUND(AVG(r.Rating_value), 1) AS avg_rating,
                    COUNT(DISTINCT r.Rating_ID) AS rating_count,
                    GROUP_CONCAT(DISTINCT g.Genre_name ORDER BY g.Genre_name SEPARATOR ', ') AS genres
                FROM Movie m
                LEFT JOIN Rating r ON m.Movie_ID = r.Movie_ID
                LEFT JOIN Movie_Genre mg ON m.Movie_ID = mg.Movie_ID
                LEFT JOIN Genre g ON mg.Genre_ID = g.Genre_ID
                WHERE m.Movie_ID = :movie_id
                GROUP BY m.Movie_ID
                """
            ),
            {'movie_id': movie_id},
        ).mappings().first()

        if not movie:
            return jsonify({'error': 'Movie not found'}), 404

        reviews = session.execute(
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

        user_rating = None
        if user_id:
            rating = session.execute(
                text(
                    """
                    SELECT Rating_value
                    FROM Rating
                    WHERE User_ID = :user_id AND Movie_ID = :movie_id
                    """
                ),
                {'user_id': user_id, 'movie_id': movie_id},
            ).mappings().first()
            if rating:
                user_rating = rating['Rating_value']

        threads = session.execute(
            text(
                """
                SELECT dt.*, COUNT(dp.Post_ID) AS post_count
                FROM Discussion_Thread dt
                LEFT JOIN Discussion_Post dp ON dt.Thread_ID = dp.Thread_ID
                WHERE dt.Movie_ID = :movie_id
                GROUP BY dt.Thread_ID
                """
            ),
            {'movie_id': movie_id},
        ).mappings().all()

        cast = session.execute(
            text(
                """
                SELECT p.Person_ID, p.Name, p.Profile_Image_URL, mc.Character_name, mc.Cast_order
                FROM Movie_Cast mc
                JOIN Person p ON mc.Person_ID = p.Person_ID
                WHERE mc.Movie_ID = :movie_id
                ORDER BY mc.Cast_order ASC
                """
            ),
            {'movie_id': movie_id},
        ).mappings().all()

        crew = session.execute(
            text(
                """
                SELECT p.Person_ID, p.Name, p.Profile_Image_URL, mcw.Job, mcw.Department
                FROM Movie_Crew mcw
                JOIN Person p ON mcw.Person_ID = p.Person_ID
                WHERE mcw.Movie_ID = :movie_id
                """
            ),
            {'movie_id': movie_id},
        ).mappings().all()

        response = dict(movie)
        response['reviews'] = [dict(row) for row in reviews]
        response['userRating'] = user_rating
        response['threads'] = [dict(row) for row in threads]
        response['cast'] = [dict(row) for row in cast]
        response['crew'] = [dict(row) for row in crew]
        return jsonify(response)
    except Exception:
        return jsonify({'error': 'Server error'}), 500
    finally:
        session.close()
