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
    await conn.beginTransaction();

    const [[existing]] = await conn.query(
      'SELECT Movie_ID FROM Movie WHERE LOWER(Title) = LOWER(?) AND Release_year = ?',
      [dbTitle, dbYear]
    );
    if (existing) {
      await conn.rollback();
      const err = new Error(`Movie "${dbTitle}" (${dbYear}) already exists in the database.`);
      err.status = 400;
      throw err;
    }

    const [result] = await conn.query(
      `INSERT INTO Movie (Title, Release_year, Language, Duration, Description, Image_URL, Budget, Revenue, Release_date, Trailer_URL, Trivia)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [dbTitle, dbYear, dbLanguage, dbDuration, dbDescription, dbImageUrl, dbBudget, dbRevenue, dbReleaseDate, dbTrailerUrl, dbTrivia]
    );
    const movieId = result.insertId;

    if (movieData.genres) {
      for (const g of movieData.genres) {
        await conn.query('INSERT IGNORE INTO Genre (Genre_name) VALUES (?)', [g.name]);
        const [[genreRow]] = await conn.query('SELECT Genre_ID FROM Genre WHERE Genre_name = ?', [g.name]);
        if (genreRow) await conn.query('INSERT IGNORE INTO Movie_Genre (Movie_ID, Genre_ID) VALUES (?, ?)', [movieId, genreRow.Genre_ID]);
      }
    }

    if (movieData.credits && movieData.credits.cast) {
      const topCast = movieData.credits.cast.slice(0, 12);
      for (let i = 0; i < topCast.length; i++) {
        const c = topCast[i];
        const profImg = c.profile_path ? `https://image.tmdb.org/t/p/w200${c.profile_path}` : null;
        await conn.query('INSERT IGNORE INTO Person (Name, Profile_Image_URL) VALUES (?, ?)', [c.name, profImg]);
        await conn.query('UPDATE Person SET Profile_Image_URL = ? WHERE Name = ? AND Profile_Image_URL IS NULL', [profImg, c.name]);
        const [[personRow]] = await conn.query('SELECT Person_ID FROM Person WHERE Name = ? LIMIT 1', [c.name]);
        if (personRow) await conn.query('INSERT IGNORE INTO Movie_Cast (Movie_ID, Person_ID, Character_name, Cast_order) VALUES (?, ?, ?, ?)', [movieId, personRow.Person_ID, c.character, i]);
      }
    }

    if (movieData.credits && movieData.credits.crew) {
      const keyCrew = movieData.credits.crew.filter(c => c.job === 'Director' || c.job === 'Writer' || c.job === 'Screenplay');
      for (const d of keyCrew) {
        const profImg = d.profile_path ? `https://image.tmdb.org/t/p/w200${d.profile_path}` : null;
        await conn.query('INSERT IGNORE INTO Person (Name, Profile_Image_URL) VALUES (?, ?)', [d.name, profImg]);
        const [[personRow]] = await conn.query('SELECT Person_ID FROM Person WHERE Name = ? LIMIT 1', [d.name]);
        if (personRow) await conn.query('INSERT IGNORE INTO Movie_Crew (Movie_ID, Person_ID, Job, Department) VALUES (?, ?, ?, ?)', [movieId, personRow.Person_ID, d.job, d.department]);
      }
    }

    await conn.commit();
    return { movieId, dbTitle };
  } catch (dbErr) {
    await conn.rollback();
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
