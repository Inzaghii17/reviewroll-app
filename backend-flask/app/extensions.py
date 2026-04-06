from sqlalchemy import create_engine
from sqlalchemy.orm import scoped_session, sessionmaker
from flask_jwt_extended import JWTManager

engine = None
SessionLocal = None
jwt = JWTManager()


def init_db(app):
    global engine
    global SessionLocal

    engine = create_engine(app.config['SQLALCHEMY_DATABASE_URI'], pool_pre_ping=True)
    SessionLocal = scoped_session(sessionmaker(autocommit=False, autoflush=False, bind=engine))


def get_db_session():
    if SessionLocal is None:
        raise RuntimeError('Database not initialized. Call init_db first.')
    return SessionLocal()


def remove_db_session(_exc=None):
    if SessionLocal is not None:
        SessionLocal.remove()
