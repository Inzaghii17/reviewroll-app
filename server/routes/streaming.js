/**
 * Streaming Routes — Free embedded movie streaming
 * Uses community embed providers (vidsrc.to, vidsrc.me)
 * Provides multiple embed sources with fallback support
 */

const express = require('express');
const router = express.Router();
const pool = require('../db');
const TMDB_API_KEY = process.env.TMDB_API_KEY;

/**
 * Embed providers configuration
 * These are community embed providers - use with appropriate disclaimers
 */
const EMBED_PROVIDERS = {
  vidsrc: {
    name: 'VidSrc',
    tmdb: (id) => `https://vidsrc.to/embed/movie/${id}`,
    imdb: (id) => `https://vidsrc.to/embed/title/${id}`
  },
  vidsrcme: {
    name: 'VidSrc.me',
    tmdb: (id) => `https://vidsrc.me/embed/movie/${id}`,
    imdb: (id) => `https://vidsrc.me/embed/title/${id}`
  },
  superembed: {
    name: 'SuperEmbed',
    tmdb: (id) => `https://www.superembed.stream/embed/movie/${id}`,
    imdb: (id) => `https://www.superembed.stream/embed/movie/${id}`
  },
  multiembed: {
    name: 'MultiEmbed',
    tmdb: (id) => `https://multiembed.mov/directstream.php?video_id=${id}&norefer=true`,
    imdb: null
  }
};

const DEFAULT_PROVIDERS_ORDER = ['vidsrc', 'vidsrcme', 'superembed', 'multiembed'];

/**
 * GET /api/streaming/embed/:movieId
 * Get embed player for a movie from multiple sources with fallback
 * 
 * Query parameters:
 * - provider: specify primary provider (optional)
 * - includeAll: return all provider URLs (default: false)
 * 
 * Response:
 * {
 *   movieId: number,
 *   tmdbId: number|null,
 *   imdbId: string|null,
 *   title: string,
 *   primary: { provider: string, url: string },
 *   all: Array<{ provider: string, url: string }>
 * }
 */
router.get('/embed/:movieId', async (req, res) => {
  try {
    const { movieId } = req.params;
    const { provider = null, includeAll = 'false' } = req.query;

    // Get movie from database
    const [[movie]] = await pool.query(
      `SELECT Movie_ID, TMDB_ID, Title FROM Movie WHERE Movie_ID = ?`,
      [movieId]
    );

    if (!movie) {
      return res.status(404).json({ error: 'Movie not found' });
    }

    // Try to get TMDB ID if not in database
    let tmdbId = movie.TMDB_ID;
    if (!tmdbId && TMDB_API_KEY) {
      try {
        tmdbId = await getTmdbIdFromTitle(movie.Title);
        // Update database (async, non-blocking)
        pool.query('UPDATE Movie SET TMDB_ID = ? WHERE Movie_ID = ?', [tmdbId, movieId]).catch(e => {
          console.error('Failed to update TMDB_ID:', e);
        });
      } catch (err) {
        console.warn('Could not fetch TMDB ID:', err.message);
      }
    }

    if (!tmdbId) {
      return res.status(400).json({
        error: 'TMDB ID not found for this movie',
        hint: 'Contact admin to manually add TMDB ID or ensure TMDB_API_KEY is configured'
      });
    }

    // Generate embed URLs
    const providers = includeAll === 'true' ? DEFAULT_PROVIDERS_ORDER : [provider || DEFAULT_PROVIDERS_ORDER[0]];
    const embedUrls = [];

    for (const providerKey of providers) {
      const prov = EMBED_PROVIDERS[providerKey];
      if (!prov) continue;

      const url = prov.tmdb(tmdbId);
      if (url) {
        embedUrls.push({
          provider: prov.name,
          key: providerKey,
          url: url
        });
      }
    }

    if (embedUrls.length === 0) {
      return res.status(500).json({
        error: 'No embed providers available',
        tmdbId: tmdbId,
        hint: 'Streaming service temporarily unavailable'
      });
    }

    res.json({
      movieId: movie.Movie_ID,
      tmdbId: tmdbId,
      title: movie.Title,
      primary: embedUrls[0],
      all: includeAll === 'true' ? embedUrls : [embedUrls[0]]
    });
  } catch (err) {
    console.error('Streaming embed error:', err);
    res.status(500).json({ error: 'Failed to get streaming embed' });
  }
});

/**
 * GET /api/streaming/info/:movieId
 * Get streaming information for a movie (legal providers first, embed fallback)
 */
router.get('/info/:movieId', async (req, res) => {
  try {
    const { movieId } = req.params;
    const region = String(req.query.region || 'US').toUpperCase();

    // Get movie
    const [[movie]] = await pool.query(
      `SELECT Movie_ID, TMDB_ID, Title, Release_year FROM Movie WHERE Movie_ID = ?`,
      [movieId]
    );

    if (!movie) {
      return res.status(404).json({ error: 'Movie not found' });
    }

    let tmdbId = movie.TMDB_ID;

    // Try legal providers first (if TMDB API available)
    let legalProviders = null;
    if (TMDB_API_KEY && tmdbId) {
      try {
        legalProviders = await getLegalWatchProviders(tmdbId, region);
      } catch (err) {
        console.warn('Could not fetch legal providers:', err.message);
      }
    }

    // Prepare response
    const info = {
      movieId: movie.Movie_ID,
      title: movie.Title,
      hasLegalProviders: !!legalProviders,
      legalProviders: legalProviders || null,
      freeEmbedAvailable: !!tmdbId,
      streamingOptions: []
    };

    if (legalProviders) {
      if (legalProviders.flatrate && legalProviders.flatrate.length > 0) {
        info.streamingOptions.push({
          type: 'subscription',
          label: 'Streaming On',
          providers: legalProviders.flatrate
        });
      }
      if (legalProviders.buy && legalProviders.buy.length > 0) {
        info.streamingOptions.push({
          type: 'purchase',
          label: 'Buy On',
          providers: legalProviders.buy
        });
      }
      if (legalProviders.rent && legalProviders.rent.length > 0) {
        info.streamingOptions.push({
          type: 'rent',
          label: 'Rent On',
          providers: legalProviders.rent
        });
      }
      if (legalProviders.free && legalProviders.free.length > 0) {
        info.streamingOptions.push({
          type: 'free',
          label: 'Free On',
          providers: legalProviders.free
        });
      }
    }

    res.json(info);
  } catch (err) {
    console.error('Streaming info error:', err);
    res.status(500).json({ error: 'Failed to get streaming info' });
  }
});

/**
 * Helper: Get TMDB ID from movie title
 */
async function getTmdbIdFromTitle(title) {
  if (!TMDB_API_KEY) throw new Error('TMDB API Key not configured');

  try {
    const res = await fetch(
      `https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(title)}&api_key=${TMDB_API_KEY}`
    );
    const data = await res.json();

    if (!data.results || data.results.length === 0) {
      throw new Error(`No TMDB match found for: ${title}`);
    }

    return data.results[0].id;
  } catch (err) {
    console.error('TMDB search failed:', err.message);
    throw err;
  }
}

/**
 * Helper: Get legal watch providers from TMDB
 */
async function getLegalWatchProviders(tmdbId, region = 'US') {
  if (!TMDB_API_KEY) return null;

  try {
    const res = await fetch(
      `https://api.themoviedb.org/3/movie/${tmdbId}/watch/providers?api_key=${TMDB_API_KEY}`
    );
    const data = await res.json();

    const regionData = data?.results?.[region];
    if (!regionData) return null;

    const normalize = (arr = []) =>
      arr.map(p => ({
        provider_id: p.provider_id,
        provider_name: p.provider_name,
        logo_path: p.logo_path ? `https://image.tmdb.org/t/p/w92${p.logo_path}` : null
      }));

    return {
      region,
      link: regionData.link || null,
      flatrate: normalize(regionData.flatrate),
      rent: normalize(regionData.rent),
      buy: normalize(regionData.buy),
      free: normalize(regionData.free)
    };
  } catch (err) {
    console.error('Failed to fetch legal providers:', err.message);
    return null;
  }
}

module.exports = router;
