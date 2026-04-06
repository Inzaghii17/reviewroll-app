const express = require('express');
const router = express.Router();
const path = require('path');
const multer = require('multer');
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');

// ─── Multer config ───────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: path.join(__dirname, '..', '..', 'public', 'uploads'),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e6);
    const ext = path.extname(file.originalname);
    cb(null, `movie-${unique}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  }
});

// ─── Admin guard middleware ──────────────────────────────────────
function adminOnly(req, res, next) {
  if (!req.user || req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

async function fetchTmdbMovieByTitle(title) {
  const TMDB_API_KEY = process.env.TMDB_API_KEY;
  if (!TMDB_API_KEY) {
    throw new Error('TMDB API Key missing in environment variables. Please add TMDB_API_KEY to your .env file.');
  }

  const searchRes = await fetch(`https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(title)}&api_key=${TMDB_API_KEY}`);
  const searchData = await searchRes.json();
  if (!searchData.results || searchData.results.length === 0) {
    throw new Error(`No movie found on TMDB for "${title}".`);
  }

  const tmdbId = searchData.results[0].id;
  const detailsRes = await fetch(`https://api.themoviedb.org/3/movie/${tmdbId}?append_to_response=videos&api_key=${TMDB_API_KEY}`);
  const movieData = await detailsRes.json();

  let trailerUrl = null;
  if (movieData.videos && movieData.videos.results) {
    const trailer = movieData.videos.results.find(v => v.type === 'Trailer' && v.site === 'YouTube');
    if (trailer) trailerUrl = `https://www.youtube.com/embed/${trailer.key}`;
  }

  return {
    title: movieData.title,
    year: movieData.release_date ? parseInt(movieData.release_date.split('-')[0], 10) : null,
    duration: movieData.runtime || null,
    description: movieData.overview || '',
    imageUrl: movieData.poster_path ? `https://image.tmdb.org/t/p/w500${movieData.poster_path}` : null,
    language: movieData.original_language || 'Unknown',
    budget: movieData.budget || 0,
    revenue: movieData.revenue || 0,
    release_date: movieData.release_date || null,
    trailerUrl,
    trivia: movieData.tagline || null
  };
}

// ─────────────────────────────────────────────────────────────────
// POST /api/admin/add-movie
// Admin directly adds a movie with genres (auto-thread via trigger)
// Accepts multipart/form-data with optional image upload
// ─────────────────────────────────────────────────────────────────
router.post('/add-movie', authenticateToken, adminOnly, upload.single('image'), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { title, year, duration, description, imageUrl, language, genres, budget, revenue, release_date, trailerUrl, trivia } = req.body;
    if (!title || !year || !duration) {
      return res.status(400).json({ error: 'Title, year, and duration are required' });
    }

    let finalImageUrl = null;
    if (req.file) {
      finalImageUrl = `/uploads/${req.file.filename}`;
    } else if (imageUrl && imageUrl.trim()) {
      finalImageUrl = imageUrl.trim();
    }

    await conn.beginTransaction();

    // Insert movie — Trigger 4 auto-creates its Discussion_Thread
    const [result] = await conn.query(
      `INSERT INTO Movie (Title, Release_year, Language, Duration, Description, Image_URL, Budget, Revenue, Release_date, Trailer_URL, Trivia)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        title.trim(),
        parseInt(year),
        (language || 'Unknown').trim(),
        parseInt(duration),
        (description || '').trim(),
        finalImageUrl,
        budget ? parseInt(budget) : 0,
        revenue ? parseInt(revenue) : 0,
        release_date || null,
        trailerUrl || null,
        trivia || null
      ]
    );
    const movieId = result.insertId;

    // Parse and link genres
    const genreNames = genres
      ? (Array.isArray(genres) ? genres : genres.split(','))
          .map(g => g.trim())
          .filter(Boolean)
      : [];

    for (const genreName of genreNames) {
      // Insert genre if it doesn't exist (trigger creates a thread for brand-new genres)
      await conn.query(
        'INSERT IGNORE INTO Genre (Genre_name) VALUES (?)',
        [genreName]
      );
      const [[genre]] = await conn.query(
        'SELECT Genre_ID FROM Genre WHERE Genre_name = ?',
        [genreName]
      );
      if (genre) {
        await conn.query(
          'INSERT IGNORE INTO Movie_Genre (Movie_ID, Genre_ID) VALUES (?, ?)',
          [movieId, genre.Genre_ID]
        );
      }
    }

    await conn.commit();
    res.status(201).json({ message: `"${title}" added successfully.`, movieId });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: 'Failed to add movie', details: err.message });
  } finally {
    conn.release();
  }
});

// ─────────────────────────────────────────────────────────────────
// GET /api/admin/requests — list all pending movie requests
// ─────────────────────────────────────────────────────────────────
router.get('/requests', authenticateToken, adminOnly, async (req, res) => {
  try {
    const [requests] = await pool.query(`
      SELECT mr.*, u.Name AS user_name, u.Email AS user_email
      FROM Movie_Request mr
      JOIN User u ON mr.User_ID = u.User_ID
      ORDER BY mr.Requested_at DESC
    `);
    res.json(requests);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─────────────────────────────────────────────────────────────────
// POST /api/admin/requests/:id/approve
// Admin approves a movie request (with full details + image upload)
// ─────────────────────────────────────────────────────────────────
router.post('/requests/:id/approve', authenticateToken, adminOnly, upload.single('image'), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { title, year, duration, description, imageUrl, language, budget, revenue, release_date, trailerUrl, trivia, autoFetch } = req.body;

    const [reqRows] = await conn.query('SELECT * FROM Movie_Request WHERE Request_ID = ?', [req.params.id]);
    if (reqRows.length === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }

    let tmdbData = null;
    if (String(autoFetch) === 'true') {
      const lookupTitle = (title && title.trim()) || reqRows[0].Requested_title;
      tmdbData = await fetchTmdbMovieByTitle(lookupTitle);
    }

    const finalTitle = (title && title.trim()) || tmdbData?.title || reqRows[0].Requested_title;
    const finalYear = parseInt(year || tmdbData?.year || reqRows[0].Release_year, 10);
    const finalDuration = parseInt(duration || tmdbData?.duration || 120, 10);
    const finalDescription = (description || tmdbData?.description || '').trim();
    const finalLanguage = (language || tmdbData?.language || 'Unknown').trim();
    const finalBudget = budget ? parseInt(budget, 10) : (tmdbData?.budget || 0);
    const finalRevenue = revenue ? parseInt(revenue, 10) : (tmdbData?.revenue || 0);
    const finalReleaseDate = release_date || tmdbData?.release_date || null;
    const finalTrailerUrl = trailerUrl || tmdbData?.trailerUrl || null;
    const finalTrivia = trivia || tmdbData?.trivia || null;

    if (!finalTitle || !finalYear || !finalDuration) {
      return res.status(400).json({ error: 'Title, year, and duration are required' });
    }

    let finalImageUrl = null;
    if (req.file) finalImageUrl = `/uploads/${req.file.filename}`;
    else if (imageUrl && imageUrl.trim()) finalImageUrl = imageUrl.trim();
    else if (tmdbData?.imageUrl) finalImageUrl = tmdbData.imageUrl;

    await conn.beginTransaction();

    const [[existing]] = await conn.query(
      'SELECT Movie_ID FROM Movie WHERE LOWER(Title) = LOWER(?) AND Release_year = ?',
      [finalTitle, finalYear]
    );
    if (existing) {
      await conn.rollback();
      return res.status(409).json({ error: `Movie "${finalTitle}" (${finalYear}) already exists in the catalog.` });
    }

    const [result] = await conn.query(
      `INSERT INTO Movie (Title, Release_year, Language, Duration, Description, Image_URL, Budget, Revenue, Release_date, Trailer_URL, Trivia)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [finalTitle, finalYear, finalLanguage, finalDuration, finalDescription, finalImageUrl, finalBudget, finalRevenue, finalReleaseDate, finalTrailerUrl, finalTrivia]
    );
    const movieId = result.insertId;

    await conn.query('DELETE FROM Movie_Request WHERE Request_ID = ?', [req.params.id]);
    await conn.commit();

    res.json({
      message: `"${finalTitle}" approved and added to catalog.`,
      movieId,
      imageUrl: finalImageUrl,
      source: tmdbData ? 'tmdb+manual' : 'manual'
    });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: err.message || 'Server error during approval' });
  } finally {
    conn.release();
  }
});

// ─────────────────────────────────────────────────────────────────
// DELETE /api/admin/requests/:id — reject (delete) a request
// ─────────────────────────────────────────────────────────────────
router.delete('/requests/:id', authenticateToken, adminOnly, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM Movie_Request WHERE Request_ID = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Request not found' });
    await pool.query('DELETE FROM Movie_Request WHERE Request_ID = ?', [req.params.id]);
    res.json({ message: `Request for "${rows[0].Requested_title}" rejected.` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─────────────────────────────────────────────────────────────────
// GET /api/admin/stats — platform-wide statistics
// ─────────────────────────────────────────────────────────────────
router.get('/stats', authenticateToken, adminOnly, async (req, res) => {
  try {
    const [[totals]] = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM User)                                            AS total_users,
        (SELECT COUNT(*) FROM Movie)                                           AS total_movies,
        (SELECT COUNT(*) FROM Rating)                                          AS total_ratings,
        (SELECT COUNT(*) FROM Review)                                          AS total_reviews,
        (SELECT COUNT(*) FROM Movie_Request)                                   AS pending_requests,
        (SELECT COUNT(*) FROM Discussion_Post WHERE Is_deleted = FALSE)        AS total_posts
    `);
    res.json(totals);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─────────────────────────────────────────────────────────────────
// GET /api/admin/users — list all users
// ─────────────────────────────────────────────────────────────────
router.get('/users', authenticateToken, adminOnly, async (req, res) => {
  try {
    const [users] = await pool.query(
      'SELECT User_ID, Name, Email, Role FROM User ORDER BY User_ID'
    );
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─────────────────────────────────────────────────────────────────
// PUT /api/admin/promote/:userId — promote a user to ADMIN
// ─────────────────────────────────────────────────────────────────
router.put('/promote/:userId', authenticateToken, adminOnly, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM User WHERE User_ID = ?', [req.params.userId]);
    if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
    if (rows[0].Role === 'ADMIN') return res.status(400).json({ error: 'User is already an admin' });
    await pool.query('UPDATE User SET Role = ? WHERE User_ID = ?', ['ADMIN', req.params.userId]);
    res.json({ message: `${rows[0].Name} promoted to ADMIN.` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Keep PATCH alias for backwards compat with older frontend calls
router.patch('/users/:id/promote', authenticateToken, adminOnly, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM User WHERE User_ID = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
    if (rows[0].Role === 'ADMIN') return res.status(400).json({ error: 'User is already an admin' });
    await pool.query('UPDATE User SET Role = ? WHERE User_ID = ?', ['ADMIN', req.params.id]);
    res.json({ message: `${rows[0].Name} promoted to ADMIN.` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─────────────────────────────────────────────────────────────────
// DELETE /api/admin/thread/:threadId — admin clears all posts in a thread
// ─────────────────────────────────────────────────────────────────
router.delete('/thread/:threadId', authenticateToken, adminOnly, async (req, res) => {
  try {
    await pool.query(
      'UPDATE Discussion_Post SET Is_deleted = TRUE WHERE Thread_ID = ?',
      [req.params.threadId]
    );
    res.json({ message: 'Thread cleared successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─────────────────────────────────────────────────────────────────
// GET /api/admin/users/search?q= — case-insensitive search by name or email
// ─────────────────────────────────────────────────────────────────
router.get('/users/search', authenticateToken, adminOnly, async (req, res) => {
  try {
    const q = `%${req.query.q || ''}%`;
    const [users] = await pool.query(
      'SELECT User_ID, Name, Email, Role FROM User WHERE Name LIKE ? OR Email LIKE ? ORDER BY User_ID',
      [q, q]
    );
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─────────────────────────────────────────────────────────────────
// DELETE /api/admin/user/:userId — delete a user (admin cannot delete self)
// ─────────────────────────────────────────────────────────────────
router.delete('/user/:userId', authenticateToken, adminOnly, async (req, res) => {
  try {
    const targetId = parseInt(req.params.userId);
    if (targetId === req.user.id) {
      return res.status(400).json({ error: 'You cannot delete your own account' });
    }
    const [rows] = await pool.query('SELECT * FROM User WHERE User_ID = ?', [targetId]);
    if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
    await pool.query('DELETE FROM User WHERE User_ID = ?', [targetId]);
    res.json({ message: `User "${rows[0].Name}" deleted successfully.` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
