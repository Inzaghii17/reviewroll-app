from flask import Blueprint, jsonify, request
from sqlalchemy import text

from ..extensions import get_db_session

forum_bp = Blueprint('forum', __name__)


def build_post_tree(posts):
    post_map = {}
    roots = []

    for post in posts:
        row = dict(post)
        row['replies'] = []
        post_map[row['Post_ID']] = row

    for post in post_map.values():
        parent_id = post.get('Parent_post_ID')
        if parent_id and parent_id in post_map:
            post_map[parent_id]['replies'].append(post)
        else:
            roots.append(post)

    return roots


@forum_bp.get('')
def get_threads():
    session = get_db_session()
    try:
        rows = session.execute(
            text(
                """
                SELECT dt.*,
                    m.Title AS movie_title,
                    m.Image_URL AS movie_image,
                    g.Genre_name,
                    COUNT(DISTINCT dp.Post_ID) AS post_count,
                    COUNT(DISTINCT dp.User_ID) AS active_users,
                    COALESCE(MAX(dp.Created_at), dt.Created_at) AS last_activity
                FROM Discussion_Thread dt
                LEFT JOIN Movie m ON dt.Movie_ID = m.Movie_ID
                LEFT JOIN Genre g ON dt.Genre_ID = g.Genre_ID
                LEFT JOIN Discussion_Post dp ON dt.Thread_ID = dp.Thread_ID AND dp.Is_deleted = FALSE
                WHERE dt.Status = 'OPEN'
                GROUP BY dt.Thread_ID
                ORDER BY post_count DESC, last_activity DESC
                """
            )
        ).mappings().all()

        return jsonify([dict(row) for row in rows])
    except Exception:
        return jsonify({'error': 'Server error'}), 500
    finally:
        session.close()


@forum_bp.get('/search')
def search_threads():
    q = request.args.get('q', '')
    pattern = f"%{q}%"

    session = get_db_session()
    try:
        rows = session.execute(
            text(
                """
                SELECT dt.*,
                    m.Title AS movie_title,
                    m.Image_URL AS movie_image,
                    g.Genre_name,
                    COUNT(DISTINCT dp.Post_ID) AS post_count,
                    COUNT(DISTINCT dp.User_ID) AS active_users,
                    COALESCE(MAX(dp.Created_at), dt.Created_at) AS last_activity
                FROM Discussion_Thread dt
                LEFT JOIN Movie m ON dt.Movie_ID = m.Movie_ID
                LEFT JOIN Genre g ON dt.Genre_ID = g.Genre_ID
                LEFT JOIN Discussion_Post dp ON dt.Thread_ID = dp.Thread_ID AND dp.Is_deleted = FALSE
                WHERE m.Title LIKE :pattern OR g.Genre_name LIKE :pattern
                GROUP BY dt.Thread_ID
                ORDER BY post_count DESC
                """
            ),
            {'pattern': pattern},
        ).mappings().all()

        return jsonify([dict(row) for row in rows])
    except Exception:
        return jsonify({'error': 'Server error'}), 500
    finally:
        session.close()


@forum_bp.get('/<int:thread_id>')
def get_thread(thread_id):
    session = get_db_session()
    try:
        thread = session.execute(
            text(
                """
                SELECT dt.*, m.Title AS movie_title, m.Image_URL AS movie_image, g.Genre_name
                FROM Discussion_Thread dt
                LEFT JOIN Movie m ON dt.Movie_ID = m.Movie_ID
                LEFT JOIN Genre g ON dt.Genre_ID = g.Genre_ID
                WHERE dt.Thread_ID = :thread_id
                """
            ),
            {'thread_id': thread_id},
        ).mappings().first()

        if not thread:
            return jsonify({'error': 'Thread not found'}), 404

        posts = session.execute(
            text(
                """
                SELECT dp.*, u.Name AS user_name
                FROM Discussion_Post dp
                JOIN User u ON dp.User_ID = u.User_ID
                WHERE dp.Thread_ID = :thread_id AND dp.Is_deleted = FALSE
                ORDER BY dp.Created_at ASC
                """
            ),
            {'thread_id': thread_id},
        ).mappings().all()

        response = dict(thread)
        response['posts'] = build_post_tree(posts)
        return jsonify(response)
    except Exception:
        return jsonify({'error': 'Server error'}), 500
    finally:
        session.close()
