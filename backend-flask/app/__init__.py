from flask import Flask
from flask_cors import CORS
from .config import Config
from .extensions import init_db, jwt, remove_db_session
from .routes.health import health_bp
from .routes.auth import auth_bp
from .routes.movies import movies_bp
from .routes.forum import forum_bp
from .routes.watchlists import watchlists_bp
from .routes.admin import admin_bp
from .routes.requests import requests_bp
from .routes.ratings import ratings_bp
from .routes.reviews import reviews_bp
from .routes.streaming import streaming_bp


def create_app() -> Flask:
    app = Flask(__name__)
    app.config.from_object(Config)

    CORS(app)
    init_db(app)
    jwt.init_app(app)
    app.teardown_appcontext(remove_db_session)

    @jwt.invalid_token_loader
    def invalid_token_callback(_reason):
        return {'error': 'Invalid or expired token'}, 403

    @jwt.expired_token_loader
    def expired_token_callback(_jwt_header, _jwt_payload):
        return {'error': 'Invalid or expired token'}, 403

    @jwt.unauthorized_loader
    def missing_token_callback(_reason):
        return {'error': 'Access token required'}, 401

    app.register_blueprint(health_bp, url_prefix='/api')
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(movies_bp, url_prefix='/api/movies')
    app.register_blueprint(forum_bp, url_prefix='/api/forum')
    app.register_blueprint(watchlists_bp, url_prefix='/api/watchlists')
    app.register_blueprint(admin_bp, url_prefix='/api/admin')
    app.register_blueprint(requests_bp, url_prefix='/api/requests')
    app.register_blueprint(ratings_bp, url_prefix='/api/ratings')
    app.register_blueprint(reviews_bp, url_prefix='/api/reviews')
    app.register_blueprint(streaming_bp, url_prefix='/api/streaming')

    return app
