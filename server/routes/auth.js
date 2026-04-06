const express = require('express');
const router = express.Router();
const pool = require('../db');
const bcrypt = require('bcryptjs');
const { generateToken, authenticateToken } = require('../middleware/auth');

// Register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }
    const [existing] = await pool.query('SELECT User_ID FROM User WHERE Email = ?', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }
    const hash = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      'INSERT INTO User (Name, Email, Password_hash) VALUES (?, ?, ?)',
      [name, email, hash]
    );
    const user = { User_ID: result.insertId, Name: name, Email: email, Role: 'USER' };
    const token = generateToken(user);
    res.status(201).json({ user: { id: user.User_ID, name, email, role: 'USER' }, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    const [rows] = await pool.query('SELECT * FROM User WHERE Email = ?', [email]);
    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const user = rows[0];
    const valid = await bcrypt.compare(password, user.Password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = generateToken(user);
    res.json({ user: { id: user.User_ID, name: user.Name, email: user.Email, role: user.Role }, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get current user profile
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT User_ID, Name, Email, Role FROM User WHERE User_ID = ?',
      [req.user.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const u = rows[0];
    res.json({ id: u.User_ID, name: u.Name, email: u.Email, role: u.Role });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
