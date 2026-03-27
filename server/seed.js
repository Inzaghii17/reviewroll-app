// Admin seeding — ensures exactly one admin exists on server start
const bcrypt = require('bcryptjs');
const pool = require('./db');

async function seedAdmin() {
  try {
    const email = 'admin@reviewroll.com';
    const password = 'admin123';
    const name = 'Admin';

    // Check if admin already exists
    const [rows] = await pool.query(
      'SELECT User_ID FROM User WHERE Email = ? AND Role = ?',
      [email, 'ADMIN']
    );

    if (rows.length === 0) {
      const hash = await bcrypt.hash(password, 12);
      await pool.query(
        'INSERT INTO User (Name, Email, Password_hash, Role) VALUES (?, ?, ?, ?)',
        [name, email, hash, 'ADMIN']
      );
      console.log('  ✅ Admin user seeded → email: admin@reviewroll.com  password: admin123');
    } else {
      console.log('  ✅ Admin user already exists.');
    }
  } catch (err) {
    // Don't crash server if seeding fails (e.g. DB not ready yet)
    console.error('  ⚠  Admin seeding failed:', err.message);
  }
}

module.exports = seedAdmin;
