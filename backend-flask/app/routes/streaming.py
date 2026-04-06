"""
Streaming Routes - Flask Implementation
Free embedded movie streaming with community embed providers
"""

from flask import Blueprint, jsonify, request, current_app
from sqlalchemy import text
import requests

from ..extensions import get_db_session

streaming_bp = Blueprint('streaming', __name__)

# Embed providers configuration
EMBED_PROVIDERS = {
    'vidsrc': {
        'name': 'VidSrc',
        'tmdb': lambda id: f'https://vidsrc.to/embed/movie/{id}',
        'imdb': lambda id: f'https://vidsrc.to/embed/title/{id}'
    },
    'vidsrcme': {
        'name': 'VidSrc.me',
        'tmdb': lambda id: f'https://vidsrc.me/embed/movie/{id}',
        'imdb': lambda id: f'https://vidsrc.me/embed/title/{id}'
    },
    'superembed': {
        'name': 'SuperEmbed',
        'tmdb': lambda id: f'https://www.superembed.stream/embed/movie/{id}',
        'imdb': lambda id: f'https://www.superembed.stream/embed/movie/{id}'
    },
    'multiembed': {
        'name': 'MultiEmbed',
        'tmdb': lambda id: f'https://multiembed.mov/directstream.php?video_id={id}&norefer=true',
        'imdb': None
    }
}

DEFAULT_PROVIDERS_ORDER = ['vidsrc', 'vidsrcme', 'superembed', 'multiembed']


def get_tmdb_id_from_title(title):
    """Get TMDB ID from movie title"""
    tmdb_key = current_app.config.get('TMDB_API_KEY')
    if not tmdb_key:
        return None
    
    try:
        url = f'https://api.themoviedb.org/3/search/movie'
        params = {
            'query': title,
            'api_key': tmdb_key
        }
        resp = requests.get(url, params=params, timeout=5)
        resp.raise_for_status()
        data = resp.json()
        
        if data.get('results') and len(data['results']) > 0:
            return data['results'][0]['id']
    except Exception as e:
        current_app.logger.warning(f'TMDB search failed for {title}: {str(e)}')
    
    return None


def get_legal_watch_providers(tmdb_id, region='US'):
    """Get legal watch providers from TMDB"""
    tmdb_key = current_app.config.get('TMDB_API_KEY')
    if not tmdb_key:
        return None
    
    try:
        url = f'https://api.themoviedb.org/3/movie/{tmdb_id}/watch/providers'
        params = {'api_key': tmdb_key}
        resp = requests.get(url, params=params, timeout=5)
        resp.raise_for_status()
        data = resp.json()
        
        region_data = data.get('results', {}).get(region)
        if not region_data:
            return None
        
        def normalize(arr=None):
            if not arr:
                return []
            return [
                {
                    'provider_id': p.get('provider_id'),
                    'provider_name': p.get('provider_name'),
                    'logo_path': f"https://image.tmdb.org/t/p/w92{p.get('logo_path')}" 
                                 if p.get('logo_path') else None
                }
                for p in arr
            ]
        
        return {
            'region': region,
            'link': region_data.get('link'),
            'flatrate': normalize(region_data.get('flatrate')),
            'rent': normalize(region_data.get('rent')),
            'buy': normalize(region_data.get('buy')),
            'free': normalize(region_data.get('free'))
        }
    except Exception as e:
        current_app.logger.warning(f'Failed to fetch legal providers for {tmdb_id}: {str(e)}')
    
    return None


@streaming_bp.route('/embed/<int:movie_id>', methods=['GET'])
def get_embed(movie_id):
    """
    Get embed player for a movie from multiple sources with fallback
    
    Query parameters:
    - provider: specify primary provider (optional)
    - includeAll: return all provider URLs (default: false)
    
    Response:
    {
        movieId: number,
        tmdbId: number|null,
        title: string,
        primary: { provider: string, url: string },
        all: Array<{ provider: string, url: string }>
    }
    """
    session = get_db_session()
    try:
        # Get movie from database
        result = session.execute(
            text('SELECT Movie_ID, TMDB_ID, Title FROM Movie WHERE Movie_ID = ?'),
            {'movie_id': movie_id}
        ).mappings().first()
        
        if not result:
            return jsonify({'error': 'Movie not found'}), 404
        
        movie = dict(result)
        tmdb_id = movie['TMDB_ID']
        
        # Try to get TMDB ID if not in database
        if not tmdb_id:
            tmdb_id = get_tmdb_id_from_title(movie['Title'])
            if tmdb_id:
                # Update database (async, non-blocking)
                try:
                    session.execute(
                        text('UPDATE Movie SET TMDB_ID = ? WHERE Movie_ID = ?'),
                        {'tmdb_id': tmdb_id, 'movie_id': movie_id}
                    )
                    session.commit()
                except Exception as e:
                    current_app.logger.error(f'Failed to update TMDB_ID: {str(e)}')
                    session.rollback()
        
        if not tmdb_id:
            return jsonify({
                'error': 'TMDB ID not found for this movie',
                'hint': 'Contact admin to manually add TMDB ID'
            }), 400
        
        # Generate embed URLs
        provider_param = request.args.get('provider')
        include_all = request.args.get('includeAll', 'false').lower() == 'true'
        
        providers = DEFAULT_PROVIDERS_ORDER if include_all else [provider_param or DEFAULT_PROVIDERS_ORDER[0]]
        embed_urls = []
        
        for provider_key in providers:
            if provider_key not in EMBED_PROVIDERS:
                continue
            
            prov = EMBED_PROVIDERS[provider_key]
            url = prov['tmdb'](tmdb_id)
            
            if url:
                embed_urls.append({
                    'provider': prov['name'],
                    'key': provider_key,
                    'url': url
                })
        
        if not embed_urls:
            return jsonify({
                'error': 'No embed providers available',
                'tmdbId': tmdb_id
            }), 500
        
        return jsonify({
            'movieId': movie['Movie_ID'],
            'tmdbId': tmdb_id,
            'title': movie['Title'],
            'primary': embed_urls[0],
            'all': embed_urls if include_all else [embed_urls[0]]
        })
    
    except Exception as e:
        current_app.logger.error(f'Streaming embed error: {str(e)}')
        return jsonify({'error': 'Failed to get streaming embed'}), 500
    finally:
        session.close()


@streaming_bp.route('/info/<int:movie_id>', methods=['GET'])
def get_streaming_info(movie_id):
    """
    Get streaming information for a movie (legal providers + embed fallback)
    """
    session = get_db_session()
    try:
        # Get movie from database
        result = session.execute(
            text('SELECT Movie_ID, TMDB_ID, Title FROM Movie WHERE Movie_ID = ?'),
            {'movie_id': movie_id}
        ).mappings().first()
        
        if not result:
            return jsonify({'error': 'Movie not found'}), 404
        
        movie = dict(result)
        region = request.args.get('region', 'US').upper()
        
        tmdb_id = movie['TMDB_ID']
        if not tmdb_id:
            tmdb_id = get_tmdb_id_from_title(movie['Title'])
        
        # Try legal providers first
        legal_providers = None
        if tmdb_id:
            legal_providers = get_legal_watch_providers(tmdb_id, region)
        
        info = {
            'movieId': movie['Movie_ID'],
            'title': movie['Title'],
            'hasLegalProviders': bool(legal_providers),
            'legalProviders': legal_providers,
            'freeEmbedAvailable': bool(tmdb_id),
            'streamingOptions': []
        }
        
        if legal_providers:
            if legal_providers.get('flatrate'):
                info['streamingOptions'].append({
                    'type': 'subscription',
                    'label': 'Streaming On',
                    'providers': legal_providers['flatrate']
                })
            if legal_providers.get('buy'):
                info['streamingOptions'].append({
                    'type': 'purchase',
                    'label': 'Buy On',
                    'providers': legal_providers['buy']
                })
            if legal_providers.get('rent'):
                info['streamingOptions'].append({
                    'type': 'rent',
                    'label': 'Rent On',
                    'providers': legal_providers['rent']
                })
            if legal_providers.get('free'):
                info['streamingOptions'].append({
                    'type': 'free',
                    'label': 'Free On',
                    'providers': legal_providers['free']
                })
        
        return jsonify(info)
    
    except Exception as e:
        current_app.logger.error(f'Streaming info error: {str(e)}')
        return jsonify({'error': 'Failed to get streaming info'}), 500
    finally:
        session.close()


@streaming_bp.route('/health', methods=['GET'])
def health():
    """Health check for streaming service"""
    return jsonify({
        'status': 'healthy',
        'service': 'streaming',
        'providers': list(EMBED_PROVIDERS.keys())
    })
