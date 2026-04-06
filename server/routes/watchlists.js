const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');

// Get user's watchlists
router.get('/', authenticateToken, async (req, res) => {
  try {
    const [watchlists] = await pool.query(`
      SELECT w.*, COUNT(wi.Movie_ID) AS item_count
      FROM Watchlist w
      LEFT JOIN Watchlist_Item wi ON w.Watchlist_ID = wi.Watchlist_ID
      WHERE w.User_ID = ?
      GROUP BY w.Watchlist_ID
      ORDER BY w.Created_at DESC
    `, [req.user.id]);
    res.json(watchlists);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get watchlist with movies
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const [watchlist] = await pool.query(
      'SELECT * FROM Watchlist WHERE Watchlist_ID = ? AND User_ID = ?',
      [req.params.id, req.user.id]
    );
    if (watchlist.length === 0) return res.status(404).json({ error: 'Watchlist not found' });

    const [movies] = await pool.query(`
      SELECT m.*, ROUND(AVG(r.Rating_value), 1) AS avg_rating,
        GROUP_CONCAT(DISTINCT g.Genre_name SEPARATOR ', ') AS genres
      FROM Watchlist_Item wi
      JOIN Movie m ON wi.Movie_ID = m.Movie_ID
      LEFT JOIN Rating r ON m.Movie_ID = r.Movie_ID
      LEFT JOIN Movie_Genre mg ON m.Movie_ID = mg.Movie_ID
      LEFT JOIN Genre g ON mg.Genre_ID = g.Genre_ID
      WHERE wi.Watchlist_ID = ?
      GROUP BY m.Movie_ID
    `, [req.params.id]);

    res.json({ ...watchlist[0], movies });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create watchlist
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Watchlist name required' });
    const [result] = await pool.query(
      'INSERT INTO Watchlist (Watchlist_name, User_ID) VALUES (?, ?)',
      [name, req.user.id]
    );
    res.status(201).json({ Watchlist_ID: result.insertId, Watchlist_name: name });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Add movie to watchlist
router.post('/:id/movies', authenticateToken, async (req, res) => {
  try {
    const { movieId } = req.body;
    if (!movieId) return res.status(400).json({ error: 'Movie ID required' });

    const [watchlist] = await pool.query(
      'SELECT * FROM Watchlist WHERE Watchlist_ID = ? AND User_ID = ?',
      [req.params.id, req.user.id]
    );
    if (watchlist.length === 0) return res.status(404).json({ error: 'Watchlist not found' });

    // Use INSERT IGNORE to prevent race conditions - silently ignore if already exists
    const [result] = await pool.query(
      'INSERT IGNORE INTO Watchlist_Item (Watchlist_ID, Movie_ID) VALUES (?, ?)',
      [req.params.id, movieId]
    );
    
    // Check if movie was actually inserted or already existed
    if (result.affectedRows === 0) {
      return res.status(409).json({ error: 'This movie is already added to this watchlist.' });
    }

    res.json({ message: 'Movie added to watchlist' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Remove movie from watchlist
router.delete('/:id/movies/:movieId', authenticateToken, async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM Watchlist_Item WHERE Watchlist_ID = ? AND Movie_ID = ?',
      [req.params.id, req.params.movieId]
    );
    res.json({ message: 'Movie removed' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
