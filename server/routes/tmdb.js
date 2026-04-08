const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');

function adminOnly(req, res, next) {
  if (!req.user || req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Admin access required' });
  next();
}

// Use Node's https module directly — bypasses undici's connection pool entirely.
// undici reuses sockets which causes "fetch failed" on stale connections.
// https.get always opens a fresh TCP connection, completely eliminating that class of error.
const https = require('https');

function httpsGet(url, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: timeoutMs }, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        try {
          const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          resolve({ status: res.statusCode, ok: res.statusCode >= 200 && res.statusCode < 500, data: body });
        } catch {
          reject(new Error('Failed to parse TMDB response as JSON'));
        }
      });
      res.on('error', reject);
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('TMDB request timed out. Please try again.'));
    });
  });
}

// Retry up to `retries` times on any error or TMDB 5xx response.
// Uses exponential-ish back-off: 600ms, 1200ms, 1800ms …
async function tmdbFetch(url, retries = 3) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await httpsGet(url);
      if (res.status >= 500 && attempt < retries) {
        await new Promise(r => setTimeout(r, 600 * (attempt + 1)));
        continue;
      }
      return res;
    } catch (err) {
      lastErr = err;
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 600 * (attempt + 1)));
        continue;
      }
    }
  }
  throw lastErr;
}

// ─── Shared: insert a movie (from TMDB movieData object) into the database ────
async function insertMovieFromTmdb(movieData) {
  const dbTitle       = movieData.title;
  const dbYear        = movieData.release_date ? parseInt(movieData.release_date.split('-')[0]) : 0;
  const dbReleaseDate = movieData.release_date || null;
  const dbLanguage    = movieData.original_language || 'Unknown';
  const dbDuration    = movieData.runtime || 0;
  const dbDescription = movieData.overview || '';
  const dbImageUrl    = movieData.poster_path ? `https://image.tmdb.org/t/p/w500${movieData.poster_path}` : null;
  const dbBudget      = movieData.budget || 0;
  const dbRevenue     = movieData.revenue || 0;
  const dbTrivia      = movieData.tagline || null;

  let dbTrailerUrl = null;
  if (movieData.videos && movieData.videos.results) {
    const trailer = movieData.videos.results.find(v => v.type === 'Trailer' && v.site === 'YouTube');
    if (trailer) dbTrailerUrl = `https://www.youtube.com/embed/${trailer.key}`;
  }

  const conn = await pool.getConnection();
  try {
    // Stringify JSON arrays for the SP
    const genresJSON = movieData.genres && movieData.genres.length > 0
      ? JSON.stringify(movieData.genres.map(g => g.name))
      : null;

    const castJSON = movieData.credits && movieData.credits.cast
      ? JSON.stringify(movieData.credits.cast.slice(0, 12).map(c => ({
          name: c.name,
          profile_path: c.profile_path ? `https://image.tmdb.org/t/p/w200${c.profile_path}` : null,
          character: c.character
        })))
      : null;

    let crewJSON = null;
    if (movieData.credits && movieData.credits.crew) {
      const keyCrew = movieData.credits.crew.filter(c => c.job === 'Director' || c.job === 'Writer' || c.job === 'Screenplay');
      if (keyCrew.length > 0) {
        crewJSON = JSON.stringify(keyCrew.map(c => ({
          name: c.name,
          profile_path: c.profile_path ? `https://image.tmdb.org/t/p/w200${c.profile_path}` : null,
          job: c.job,
          department: c.department
        })));
      }
    }

    await conn.query(
      `CALL sp_add_tmdb_movie(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, @out_movie_id, @out_error_code)`,
      [
        dbTitle,
        dbYear,
        dbLanguage,
        dbDuration,
        dbDescription,
        dbImageUrl,
        dbBudget,
        dbRevenue,
        dbReleaseDate,
        dbTrailerUrl,
        dbTrivia,
        genresJSON,
        castJSON,
        crewJSON
      ]
    );

    const [[{ movieId, errorCode }]] = await conn.query('SELECT @out_movie_id AS movieId, @out_error_code AS errorCode');

    if (errorCode === 409) {
      const err = new Error(`Movie "${dbTitle}" (${dbYear}) already exists in the database.`);
      err.status = 400;
      throw err;
    } else if (errorCode !== 0) {
      throw new Error(`Stored procedure failed with code ${errorCode}`);
    }

    return { movieId, dbTitle };
  } catch (dbErr) {
    throw dbErr;
  } finally {
    conn.release();
  }
}

// ─── Public: watch providers ──────────────────────────────────────────────────
router.get('/watch-providers/:movieId', async (req, res) => {
  try {
    const TMDB_API_KEY = process.env.TMDB_API_KEY;
    if (!TMDB_API_KEY) return res.status(500).json({ error: 'TMDB API Key missing in environment variables.' });

    const region = String(req.query.region || 'US').toUpperCase();
    const [[movieRow]] = await pool.query('SELECT Title, Release_year FROM Movie WHERE Movie_ID = ?', [req.params.movieId]);
    if (!movieRow) return res.status(404).json({ error: 'Movie not found' });

    const searchRes = await tmdbFetch(
      `https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(movieRow.Title)}&year=${encodeURIComponent(movieRow.Release_year)}&api_key=${TMDB_API_KEY}`
    );
    const searchData = searchRes.data;
    if (!searchData.results || searchData.results.length === 0) return res.status(404).json({ error: 'No TMDB match found for watch providers.' });

    const tmdbId = searchData.results[0].id;
    const providersRes = await tmdbFetch(`https://api.themoviedb.org/3/movie/${tmdbId}/watch/providers?api_key=${TMDB_API_KEY}`);
    const providersData = providersRes.data;

    const regionData = providersData?.results?.[region] || null;
    if (!regionData) return res.status(404).json({ error: `No watch provider data for region ${region}.`, tmdbId });

    const normalize = (arr = []) => arr.map(p => ({
      provider_id: p.provider_id,
      provider_name: p.provider_name,
      logo_path: p.logo_path ? `https://image.tmdb.org/t/p/w92${p.logo_path}` : null
    }));

    res.json({ tmdbId, region, link: regionData.link || null, flatrate: normalize(regionData.flatrate), rent: normalize(regionData.rent), buy: normalize(regionData.buy), free: normalize(regionData.free) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error while fetching watch providers' });
  }
});

// ─── Admin: search TMDB — returns all results so admin can pick ───────────────
router.get('/search', authenticateToken, adminOnly, async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) return res.status(400).json({ error: 'Query (q) is required.' });

    const TMDB_API_KEY = process.env.TMDB_API_KEY;
    if (!TMDB_API_KEY) return res.status(500).json({ error: 'TMDB API Key missing. Add TMDB_API_KEY to your .env file.' });

    const searchRes = await tmdbFetch(
      `https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(q)}&include_adult=false&api_key=${TMDB_API_KEY}`
    );
    const searchData = searchRes.data;

    if (!searchData.results || searchData.results.length === 0) {
      return res.json({ results: [] });
    }

    const results = searchData.results.slice(0, 20).map(m => ({
      tmdbId:   m.id,
      title:    m.title,
      year:     m.release_date ? m.release_date.split('-')[0] : 'N/A',
      overview: m.overview || '',
      poster:   m.poster_path ? `https://image.tmdb.org/t/p/w185${m.poster_path}` : null,
      rating:   m.vote_average ? m.vote_average.toFixed(1) : null,
      language: m.original_language || '',
    }));

    res.json({ results });
  } catch (err) {
    console.error('[TMDB search error]', err);
    res.status(500).json({ error: err.message || 'Server error during TMDB search.' });
  }
});

// ─── Admin: fetch full details for the chosen TMDB ID and add to DB ───────────
router.post('/fetch-by-id', authenticateToken, adminOnly, async (req, res) => {
  try {
    const { tmdbId } = req.body;
    if (!tmdbId) return res.status(400).json({ error: 'tmdbId is required.' });

    const TMDB_API_KEY = process.env.TMDB_API_KEY;
    if (!TMDB_API_KEY) return res.status(500).json({ error: 'TMDB API Key missing. Add TMDB_API_KEY to your .env file.' });

    const detailsRes = await tmdbFetch(
      `https://api.themoviedb.org/3/movie/${tmdbId}?append_to_response=credits,videos&api_key=${TMDB_API_KEY}`
    );
    const movieData = detailsRes.data;

    if (!movieData || !movieData.title) {
      return res.status(404).json({ error: 'Movie not found on TMDB.' });
    }

    const { movieId, dbTitle } = await insertMovieFromTmdb(movieData);
    res.json({ message: `Successfully added "${dbTitle}"!`, movieId });
  } catch (err) {
    console.error('[TMDB fetch-by-id error]', err);
    res.status(err.status || 500).json({ error: err.message || 'Server error during TMDB fetch.' });
  }
});

// ─── Admin: auto-fetch by title (used by the request-approval modal) ─────────
router.post('/auto-fetch', authenticateToken, adminOnly, async (req, res) => {
  try {
    const { title } = req.body;
    if (!title) return res.status(400).json({ error: 'Title required' });

    const TMDB_API_KEY = process.env.TMDB_API_KEY;
    if (!TMDB_API_KEY) return res.status(500).json({ error: 'TMDB API Key missing.' });

    const searchRes = await tmdbFetch(`https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(title)}&api_key=${TMDB_API_KEY}`);
    const searchData = searchRes.data;
    if (!searchData.results || searchData.results.length === 0) return res.status(404).json({ error: 'No movie found on TMDB with that title.' });

    const tmdbId = searchData.results[0].id;
    const detailsRes = await tmdbFetch(`https://api.themoviedb.org/3/movie/${tmdbId}?append_to_response=credits,videos&api_key=${TMDB_API_KEY}`);
    const movieData = detailsRes.data;

    const { movieId, dbTitle } = await insertMovieFromTmdb(movieData);
    res.json({ message: `Successfully auto-fetched and added "${dbTitle}"!`, movieId, movie: movieData });
  } catch (err) {
    console.error('[TMDB auto-fetch error]', err);
    res.status(err.status || 500).json({ error: err.message || 'Server error during TMDB fetch. Please try again.' });
  }
});

module.exports = router;
