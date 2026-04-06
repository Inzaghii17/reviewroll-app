import os
from datetime import timedelta
from dotenv import load_dotenv

load_dotenv()


class Config:
    DEBUG = os.getenv('FLASK_DEBUG', '1') == '1'
    PORT = int(os.getenv('PORT', '5000'))

    DB_HOST = os.getenv('DB_HOST', 'localhost')
    DB_PORT = int(os.getenv('DB_PORT', '3306'))
    DB_NAME = os.getenv('DB_NAME', 'reviewroll')
    DB_USER = os.getenv('DB_USER', 'root')
    DB_PASSWORD = os.getenv('DB_PASSWORD', '')

    JWT_SECRET_KEY = os.getenv('JWT_SECRET', 'replace_me')
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(days=7)

    SQLALCHEMY_DATABASE_URI = (
        f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
