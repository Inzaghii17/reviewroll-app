import bcrypt
from flask import Blueprint, jsonify, request
from flask_jwt_extended import create_access_token, get_jwt, get_jwt_identity, jwt_required
from sqlalchemy import text

from ..extensions import get_db_session

auth_bp = Blueprint('auth', __name__)


def serialize_user(row):
    return {
        'id': row['User_ID'],
        'name': row['Name'],
        'email': row['Email'],
        'role': row['Role'],
    }


@auth_bp.post('/register')
def register():
    payload = request.get_json(silent=True) or {}
    name = (payload.get('name') or '').strip()
    email = (payload.get('email') or '').strip()
    password = payload.get('password') or ''

    if not name or not email or not password:
        return jsonify({'error': 'Name, email, and password are required'}), 400

    session = get_db_session()
    try:
        existing = session.execute(
            text('SELECT User_ID FROM User WHERE Email = :email'),
            {'email': email},
        ).mappings().first()

        if existing:
            return jsonify({'error': 'Email already registered'}), 409

        password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

        result = session.execute(
            text('INSERT INTO User (Name, Email, Password_hash) VALUES (:name, :email, :password_hash)'),
            {
                'name': name,
                'email': email,
                'password_hash': password_hash,
            },
        )
        session.commit()

        user_row = {
            'User_ID': result.lastrowid,
            'Name': name,
            'Email': email,
            'Role': 'USER',
        }
        token = create_access_token(
            identity=str(user_row['User_ID']),
            additional_claims={
                'email': user_row['Email'],
                'role': user_row['Role'],
            },
        )

        return jsonify({'user': serialize_user(user_row), 'token': token}), 201
    except Exception:
        session.rollback()
        return jsonify({'error': 'Server error'}), 500
    finally:
        session.close()


@auth_bp.post('/login')
def login():
    payload = request.get_json(silent=True) or {}
    email = (payload.get('email') or '').strip()
    password = payload.get('password') or ''

    if not email or not password:
        return jsonify({'error': 'Email and password are required'}), 400

    session = get_db_session()
    try:
        user = session.execute(
            text('SELECT User_ID, Name, Email, Password_hash, Role FROM User WHERE Email = :email'),
            {'email': email},
        ).mappings().first()

        if not user:
            return jsonify({'error': 'Invalid credentials'}), 401

        valid = bcrypt.checkpw(password.encode('utf-8'), user['Password_hash'].encode('utf-8'))
        if not valid:
            return jsonify({'error': 'Invalid credentials'}), 401

        token = create_access_token(
            identity=str(user['User_ID']),
            additional_claims={
                'email': user['Email'],
                'role': user['Role'],
            },
        )

        return jsonify({'user': serialize_user(user), 'token': token})
    except Exception:
        return jsonify({'error': 'Server error'}), 500
    finally:
        session.close()


@auth_bp.get('/me')
@jwt_required()
def me():
    identity = get_jwt_identity()
    if not identity:
        return jsonify({'error': 'Access token required'}), 401

    session = get_db_session()
    try:
        user = session.execute(
            text('SELECT User_ID, Name, Email, Role FROM User WHERE User_ID = :user_id'),
            {'user_id': int(identity)},
        ).mappings().first()

        if not user:
            return jsonify({'error': 'User not found'}), 404

        jwt_data = get_jwt()
        return jsonify(
            {
                'id': user['User_ID'],
                'name': user['Name'],
                'email': user['Email'],
                'role': jwt_data.get('role', user['Role']),
            }
        )
    except Exception:
        return jsonify({'error': 'Server error'}), 500
    finally:
        session.close()
