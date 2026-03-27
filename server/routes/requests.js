const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');

// POST /api/requests — submit a movie request
// DB Trigger 2 automatically rejects if title+year already exists in Movie table
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { title, year } = req.body;
    if (!title || !year) {
      return res.status(400).json({ error: 'Movie title and release year are required' });
    }
    const releaseYear = parseInt(year, 10);
    if (isNaN(releaseYear) || releaseYear < 1900 || releaseYear > 2100) {
      return res.status(400).json({ error: 'Invalid release year' });
    }

    const [result] = await pool.query(
      'INSERT INTO Movie_Request (Requested_title, Release_year, User_ID) VALUES (?, ?, ?)',
      [title.trim(), releaseYear, req.user.id]
    );

    res.status(201).json({
      message: 'Movie request submitted successfully!',
      requestId: result.insertId
    });
  } catch (err) {
    // MySQL trigger SIGNAL comes through as sqlState 45000
    if (err.sqlState === '45000') {
      return res.status(409).json({ error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/requests/my — get current user's own requests
router.get('/my', authenticateToken, async (req, res) => {
  try {
    const [requests] = await pool.query(
      'SELECT * FROM Movie_Request WHERE User_ID = ? ORDER BY Requested_at DESC',
      [req.user.id]
    );
    res.json(requests);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
