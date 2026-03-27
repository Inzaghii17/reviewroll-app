const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');

// Rate a movie
router.post('/:movieId', authenticateToken, async (req, res) => {
  try {
    const { movieId } = req.params;
    const { rating } = req.body;
    if (!rating || rating < 1 || rating > 10) {
      return res.status(400).json({ error: 'Rating must be between 1 and 10' });
    }
    // Upsert rating
    const [existing] = await pool.query(
      'SELECT Rating_ID FROM Rating WHERE User_ID = ? AND Movie_ID = ?',
      [req.user.id, movieId]
    );
    if (existing.length > 0) {
      await pool.query(
        'UPDATE Rating SET Rating_value = ?, Rated_at = NOW() WHERE Rating_ID = ?',
        [rating, existing[0].Rating_ID]
      );
    } else {
      await pool.query(
        'INSERT INTO Rating (Rating_value, User_ID, Movie_ID) VALUES (?, ?, ?)',
        [rating, req.user.id, movieId]
      );
    }
    // Return updated average
    const [avg] = await pool.query(
      'SELECT ROUND(AVG(Rating_value), 1) AS avg_rating, COUNT(*) AS count FROM Rating WHERE Movie_ID = ?',
      [movieId]
    );
    res.json({ message: 'Rating saved', avg_rating: avg[0].avg_rating, count: avg[0].count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get ratings for a movie
router.get('/:movieId', async (req, res) => {
  try {
    const [ratings] = await pool.query(`
      SELECT r.*, u.Name AS user_name
      FROM Rating r JOIN User u ON r.User_ID = u.User_ID
      WHERE r.Movie_ID = ?
      ORDER BY r.Rated_at DESC
    `, [req.params.movieId]);
    const [avg] = await pool.query(
      'SELECT ROUND(AVG(Rating_value), 1) AS avg_rating, COUNT(*) AS count FROM Rating WHERE Movie_ID = ?',
      [req.params.movieId]
    );
    res.json({ ratings, avg_rating: avg[0].avg_rating, count: avg[0].count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
