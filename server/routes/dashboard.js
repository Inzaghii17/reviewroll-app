const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');

// Get user dashboard stats
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Rating distribution
    const [ratingDist] = await pool.query(`
      SELECT Rating_value, COUNT(*) AS count
      FROM Rating WHERE User_ID = ?
      GROUP BY Rating_value ORDER BY Rating_value
    `, [userId]);

    // Genre preferences (based on ratings)
    const [genrePrefs] = await pool.query(`
      SELECT g.Genre_name, COUNT(*) AS count, ROUND(AVG(r.Rating_value), 1) AS avg_rating
      FROM Rating r
      JOIN Movie_Genre mg ON r.Movie_ID = mg.Movie_ID
      JOIN Genre g ON mg.Genre_ID = g.Genre_ID
      WHERE r.User_ID = ?
      GROUP BY g.Genre_ID
      ORDER BY count DESC
    `, [userId]);

    // Total stats
    const [totals] = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM Rating WHERE User_ID = ?) AS total_ratings,
        (SELECT COUNT(*) FROM Review WHERE User_ID = ?) AS total_reviews,
        (SELECT COUNT(*) FROM Watchlist WHERE User_ID = ?) AS total_watchlists,
        (SELECT COUNT(*) FROM Discussion_Post WHERE User_ID = ?) AS total_posts
    `, [userId, userId, userId, userId]);

    // Recent activity
    const [recentRatings] = await pool.query(`
      SELECT r.*, m.Title FROM Rating r
      JOIN Movie m ON r.Movie_ID = m.Movie_ID
      WHERE r.User_ID = ? ORDER BY r.Rated_at DESC LIMIT 5
    `, [userId]);

    res.json({
      ratingDistribution: ratingDist,
      genrePreferences: genrePrefs,
      totals: totals[0],
      recentRatings
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
