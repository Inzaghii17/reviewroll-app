const express = require('express');
const router = express.Router();
const pool = require('../db');

router.get('/:id', async (req, res) => {
  try {
    const personId = req.params.id;
    
    // Get person details
    const [personRows] = await pool.query('SELECT * FROM Person WHERE Person_ID = ?', [personId]);
    if (personRows.length === 0) return res.status(404).json({ error: 'Person not found' });
    const person = personRows[0];
    
    // Get cast roles
    const [castRoles] = await pool.query(`
      SELECT m.Movie_ID, m.Title, m.Image_URL, m.Release_year, mc.Character_name as role
      FROM Movie_Cast mc
      JOIN Movie m ON mc.Movie_ID = m.Movie_ID
      WHERE mc.Person_ID = ?
      ORDER BY m.Release_year DESC
    `, [personId]);

    // Get crew roles
    const [crewRoles] = await pool.query(`
      SELECT m.Movie_ID, m.Title, m.Image_URL, m.Release_year, mcw.Job as role
      FROM Movie_Crew mcw
      JOIN Movie m ON mcw.Movie_ID = m.Movie_ID
      WHERE mcw.Person_ID = ?
      ORDER BY m.Release_year DESC
    `, [personId]);
    
    res.json({ ...person, castFavorites: castRoles, crewFavorites: crewRoles });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
