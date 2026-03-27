const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');

// Add a review
router.post('/:movieId', authenticateToken, async (req, res) => {
  try {
    const { movieId } = req.params;
    const { text } = req.body;
    if (!text || text.trim().length === 0) {
      return res.status(400).json({ error: 'Review text is required' });
    }
    const [result] = await pool.query(
      'INSERT INTO Review (Review_text, User_ID, Movie_ID) VALUES (?, ?, ?)',
      [text.trim(), req.user.id, movieId]
    );
    const [review] = await pool.query(`
      SELECT rv.*, u.Name AS user_name
      FROM Review rv JOIN User u ON rv.User_ID = u.User_ID
      WHERE rv.Review_ID = ?
    `, [result.insertId]);
    res.status(201).json(review[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get reviews for a movie
router.get('/:movieId', async (req, res) => {
  try {
    const [reviews] = await pool.query(`
      SELECT rv.*, u.Name AS user_name
      FROM Review rv JOIN User u ON rv.User_ID = u.User_ID
      WHERE rv.Movie_ID = ?
      ORDER BY rv.Created_at DESC
    `, [req.params.movieId]);
    res.json(reviews);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete a review
router.delete('/:reviewId', authenticateToken, async (req, res) => {
  try {
    const [review] = await pool.query('SELECT * FROM Review WHERE Review_ID = ?', [req.params.reviewId]);
    if (review.length === 0) return res.status(404).json({ error: 'Review not found' });
    if (review[0].User_ID !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Not authorized' });
    }
    await pool.query('DELETE FROM Review WHERE Review_ID = ?', [req.params.reviewId]);
    res.json({ message: 'Review deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
