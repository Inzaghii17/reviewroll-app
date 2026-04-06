const express = require('express');
const router = express.Router();
const pool = require('../db');
const { optionalAuth } = require('../middleware/auth');

// Get all movies with average rating and genres
router.get('/', async (req, res) => {
  try {
    const [movies] = await pool.query(`
      SELECT m.*,
        COALESCE(m.Avg_rating, ROUND(AVG(r.Rating_value), 1)) AS avg_rating,
        COUNT(DISTINCT r.Rating_ID) AS rating_count,
        GROUP_CONCAT(DISTINCT g.Genre_name ORDER BY g.Genre_name SEPARATOR ', ') AS genres
      FROM Movie m
      LEFT JOIN Rating r ON m.Movie_ID = r.Movie_ID
      LEFT JOIN Movie_Genre mg ON m.Movie_ID = mg.Movie_ID
      LEFT JOIN Genre g ON mg.Genre_ID = g.Genre_ID
      GROUP BY m.Movie_ID
      ORDER BY m.Movie_ID
    `);
    res.json(movies);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get single movie with full details
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const id = req.params.id;
    const [movies] = await pool.query(`
      SELECT m.*,
        ROUND(AVG(r.Rating_value), 1) AS avg_rating,
        COUNT(DISTINCT r.Rating_ID) AS rating_count,
        GROUP_CONCAT(DISTINCT g.Genre_name ORDER BY g.Genre_name SEPARATOR ', ') AS genres
      FROM Movie m
      LEFT JOIN Rating r ON m.Movie_ID = r.Movie_ID
      LEFT JOIN Movie_Genre mg ON m.Movie_ID = mg.Movie_ID
      LEFT JOIN Genre g ON mg.Genre_ID = g.Genre_ID
      WHERE m.Movie_ID = ?
      GROUP BY m.Movie_ID
    `, [id]);

    if (movies.length === 0) return res.status(404).json({ error: 'Movie not found' });

    const movie = movies[0];

    // Get reviews
    const [reviews] = await pool.query(`
      SELECT rv.*, u.Name AS user_name
      FROM Review rv
      JOIN User u ON rv.User_ID = u.User_ID
      WHERE rv.Movie_ID = ?
      ORDER BY rv.Created_at DESC
    `, [id]);

    // Get user's rating if authenticated
    let userRating = null;
    if (req.user) {
      const [ratings] = await pool.query(
        'SELECT Rating_value FROM Rating WHERE User_ID = ? AND Movie_ID = ?',
        [req.user.id, id]
      );
      if (ratings.length > 0) userRating = ratings[0].Rating_value;
    }

    // Get discussion threads for this movie
    const [threads] = await pool.query(`
      SELECT dt.*, COUNT(dp.Post_ID) AS post_count
      FROM Discussion_Thread dt
      LEFT JOIN Discussion_Post dp ON dt.Thread_ID = dp.Thread_ID
      WHERE dt.Movie_ID = ?
      GROUP BY dt.Thread_ID
    `, [id]);

    // Get cast
    const [cast] = await pool.query(`
      SELECT p.Person_ID, p.Name, p.Profile_Image_URL, mc.Character_name, mc.Cast_order
      FROM Movie_Cast mc
      JOIN Person p ON mc.Person_ID = p.Person_ID
      WHERE mc.Movie_ID = ?
      ORDER BY mc.Cast_order ASC
    `, [id]);

    // Get crew
    const [crew] = await pool.query(`
      SELECT p.Person_ID, p.Name, p.Profile_Image_URL, mcw.Job, mcw.Department
      FROM Movie_Crew mcw
      JOIN Person p ON mcw.Person_ID = p.Person_ID
      WHERE mcw.Movie_ID = ?
    `, [id]);

    res.json({ ...movie, reviews, userRating, threads, cast, crew });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Search movies
router.get('/search/:query', async (req, res) => {
  try {
    const q = `%${req.params.query}%`;
    const [movies] = await pool.query(`
      SELECT m.*,
        ROUND(AVG(r.Rating_value), 1) AS avg_rating,
        GROUP_CONCAT(DISTINCT g.Genre_name SEPARATOR ', ') AS genres
      FROM Movie m
      LEFT JOIN Rating r ON m.Movie_ID = r.Movie_ID
      LEFT JOIN Movie_Genre mg ON m.Movie_ID = mg.Movie_ID
      LEFT JOIN Genre g ON mg.Genre_ID = g.Genre_ID
      WHERE m.Title LIKE ?
      GROUP BY m.Movie_ID
    `, [q]);
    res.json(movies);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get the discussion thread ID for a specific movie
router.get('/:id/thread', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT Thread_ID FROM Discussion_Thread WHERE Movie_ID = ? LIMIT 1',
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'No thread for this movie' });
    res.json({ threadId: rows[0].Thread_ID });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
