const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');

function adminOnly(req, res, next) {
  if (!req.user || req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Admin access required' });
  next();
}

// Public endpoint: resolve legal watch providers for a movie using TMDB
router.get('/watch-providers/:movieId', async (req, res) => {
  try {
    const TMDB_API_KEY = process.env.TMDB_API_KEY;
    if (!TMDB_API_KEY) {
      return res.status(500).json({ error: 'TMDB API Key missing in environment variables.' });
    }

    const region = String(req.query.region || 'US').toUpperCase();

    const [[movieRow]] = await pool.query(
      'SELECT Title, Release_year FROM Movie WHERE Movie_ID = ?',
      [req.params.movieId]
    );
    if (!movieRow) return res.status(404).json({ error: 'Movie not found' });

    const searchRes = await fetch(
      `https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(movieRow.Title)}&year=${encodeURIComponent(movieRow.Release_year)}&api_key=${TMDB_API_KEY}`
    );
    const searchData = await searchRes.json();
    if (!searchData.results || searchData.results.length === 0) {
      return res.status(404).json({ error: 'No TMDB match found for watch providers.' });
    }

    const tmdbId = searchData.results[0].id;
    const providersRes = await fetch(
      `https://api.themoviedb.org/3/movie/${tmdbId}/watch/providers?api_key=${TMDB_API_KEY}`
    );
    const providersData = await providersRes.json();

    const regionData = providersData?.results?.[region] || null;
    if (!regionData) {
      return res.status(404).json({ error: `No watch provider data for region ${region}.`, tmdbId });
    }

    const normalize = (arr = []) => arr.map(p => ({
      provider_id: p.provider_id,
      provider_name: p.provider_name,
      logo_path: p.logo_path ? `https://image.tmdb.org/t/p/w92${p.logo_path}` : null
    }));

    const result = {
      tmdbId,
      region,
      link: regionData.link || null,
      flatrate: normalize(regionData.flatrate),
      rent: normalize(regionData.rent),
      buy: normalize(regionData.buy),
      free: normalize(regionData.free)
    };

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error while fetching watch providers' });
  }
});

router.post('/auto-fetch', authenticateToken, adminOnly, async (req, res) => {
  try {
    const { title } = req.body;
    if (!title) return res.status(400).json({ error: 'Title required' });

    const TMDB_API_KEY = process.env.TMDB_API_KEY;
    if (!TMDB_API_KEY) return res.status(500).json({ error: 'TMDB API Key missing in environment variables. Please add TMDB_API_KEY=YOUR_KEY to your .env file.' });

    // Search for movie
    const searchRes = await fetch(`https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(title)}&api_key=${TMDB_API_KEY}`);
    const searchData = await searchRes.json();
    if (!searchData.results || searchData.results.length === 0) {
      return res.status(404).json({ error: 'No movie found on TMDB with that title.' });
    }

    const tmdbId = searchData.results[0].id;

    // Fetch full details
    const detailsRes = await fetch(`https://api.themoviedb.org/3/movie/${tmdbId}?append_to_response=credits,videos&api_key=${TMDB_API_KEY}`);
    const movieData = await detailsRes.json();

    // Map TMDB data to our DB structure
    const dbTitle = movieData.title;
    const dbYear = movieData.release_date ? parseInt(movieData.release_date.split('-')[0]) : 0;
    const dbReleaseDate = movieData.release_date || null;
    const dbLanguage = movieData.original_language || 'Unknown';
    const dbDuration = movieData.runtime || 0;
    const dbDescription = movieData.overview || '';
    const dbImageUrl = movieData.poster_path ? `https://image.tmdb.org/t/p/w500${movieData.poster_path}` : null;
    const dbBudget = movieData.budget || 0;
    const dbRevenue = movieData.revenue || 0;
    const dbTrivia = movieData.tagline || null;
    
    // Find Trailer
    let dbTrailerUrl = null;
    if (movieData.videos && movieData.videos.results) {
      const trailer = movieData.videos.results.find(v => v.type === 'Trailer' && v.site === 'YouTube');
      if (trailer) dbTrailerUrl = `https://www.youtube.com/embed/${trailer.key}`;
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // Check if movie already exists
      const [[existing]] = await conn.query('SELECT Movie_ID FROM Movie WHERE LOWER(Title) = LOWER(?) AND Release_year = ?', [dbTitle, dbYear]);
      if (existing) {
        await conn.rollback();
        return res.status(400).json({ error: `Movie "${dbTitle}" (${dbYear}) already exists in the database.` });
      }

      // Insert Movie
      const [result] = await conn.query(
        `INSERT INTO Movie (Title, Release_year, Language, Duration, Description, Image_URL, Budget, Revenue, Release_date, Trailer_URL, Trivia)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [dbTitle, dbYear, dbLanguage, dbDuration, dbDescription, dbImageUrl, dbBudget, dbRevenue, dbReleaseDate, dbTrailerUrl, dbTrivia]
      );
      const movieId = result.insertId;

      // Extract Genres
      if (movieData.genres) {
        for (const g of movieData.genres) {
          await conn.query('INSERT IGNORE INTO Genre (Genre_name) VALUES (?)', [g.name]);
          const [[genreRow]] = await conn.query('SELECT Genre_ID FROM Genre WHERE Genre_name = ?', [g.name]);
          if (genreRow) {
            await conn.query('INSERT IGNORE INTO Movie_Genre (Movie_ID, Genre_ID) VALUES (?, ?)', [movieId, genreRow.Genre_ID]);
          }
        }
      }

      // Extract Cast (Top 12)
      if (movieData.credits && movieData.credits.cast) {
        const topCast = movieData.credits.cast.slice(0, 12);
        for (let i = 0; i < topCast.length; i++) {
          const c = topCast[i];
          const profImg = c.profile_path ? `https://image.tmdb.org/t/p/w200${c.profile_path}` : null;
          await conn.query('INSERT IGNORE INTO Person (Name, Profile_Image_URL) VALUES (?, ?)', [c.name, profImg]);
          // Profile update (if existed but didn't have image previously)
          await conn.query('UPDATE Person SET Profile_Image_URL = ? WHERE Name = ? AND Profile_Image_URL IS NULL', [profImg, c.name]);
          
          const [[personRow]] = await conn.query('SELECT Person_ID FROM Person WHERE Name = ? LIMIT 1', [c.name]);
          if (personRow) {
            await conn.query('INSERT IGNORE INTO Movie_Cast (Movie_ID, Person_ID, Character_name, Cast_order) VALUES (?, ?, ?, ?)', [movieId, personRow.Person_ID, c.character, i]);
          }
        }
      }

      // Extract Crew (Director & Writers)
      if (movieData.credits && movieData.credits.crew) {
        const keyCrew = movieData.credits.crew.filter(c => c.job === 'Director' || c.job === 'Writer' || c.job === 'Screenplay');
        for (const d of keyCrew) {
          const profImg = d.profile_path ? `https://image.tmdb.org/t/p/w200${d.profile_path}` : null;
          await conn.query('INSERT IGNORE INTO Person (Name, Profile_Image_URL) VALUES (?, ?)', [d.name, profImg]);
          const [[personRow]] = await conn.query('SELECT Person_ID FROM Person WHERE Name = ? LIMIT 1', [d.name]);
          if (personRow) {
            await conn.query('INSERT IGNORE INTO Movie_Crew (Movie_ID, Person_ID, Job, Department) VALUES (?, ?, ?, ?)', [movieId, personRow.Person_ID, d.job, d.department]);
          }
        }
      }

      await conn.commit();
      res.json({ message: `Successfully auto-fetched and added "${dbTitle}"!`, movieId, movie: movieData });
    } catch (dbErr) {
      await conn.rollback();
      throw dbErr;
    } finally {
      conn.release();
    }

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error during TMDB fetch' });
  }
});

module.exports = router;
