const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken, optionalAuth } = require('../middleware/auth');

// ─────────────────────────────────────────────
// GET /api/forum — Trending threads (by post count + recent activity)
// ─────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const [threads] = await pool.query(`
      SELECT dt.*,
        m.Title AS movie_title,
        m.Image_URL AS movie_image,
        g.Genre_name,
        COUNT(DISTINCT dp.Post_ID) AS post_count,
        COUNT(DISTINCT dp.User_ID) AS active_users,
        MAX(dp.Created_at) AS last_activity
      FROM Discussion_Thread dt
      LEFT JOIN Movie m ON dt.Movie_ID = m.Movie_ID
      LEFT JOIN Genre g ON dt.Genre_ID = g.Genre_ID
      LEFT JOIN Discussion_Post dp ON dt.Thread_ID = dp.Thread_ID AND dp.Is_deleted = FALSE
      WHERE dt.Status = 'OPEN'
      GROUP BY dt.Thread_ID
      ORDER BY post_count DESC, last_activity DESC
    `);
    res.json(threads);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─────────────────────────────────────────────
// GET /api/forum/search?q= — search threads by movie title or genre name
// ─────────────────────────────────────────────
router.get('/search', async (req, res) => {
  try {
    const q = `%${req.query.q || ''}%`;
    const [threads] = await pool.query(`
      SELECT dt.*,
        m.Title AS movie_title,
        m.Image_URL AS movie_image,
        g.Genre_name,
        COUNT(DISTINCT dp.Post_ID) AS post_count,
        MAX(dp.Created_at) AS last_activity
      FROM Discussion_Thread dt
      LEFT JOIN Movie m ON dt.Movie_ID = m.Movie_ID
      LEFT JOIN Genre g ON dt.Genre_ID = g.Genre_ID
      LEFT JOIN Discussion_Post dp ON dt.Thread_ID = dp.Thread_ID AND dp.Is_deleted = FALSE
      WHERE m.Title LIKE ? OR g.Genre_name LIKE ?
      GROUP BY dt.Thread_ID
      ORDER BY post_count DESC
    `, [q, q]);
    res.json(threads);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─────────────────────────────────────────────
// GET /api/forum/:id — get thread with hierarchical posts
// ─────────────────────────────────────────────
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const [thread] = await pool.query(`
      SELECT dt.*, m.Title AS movie_title, m.Image_URL AS movie_image, g.Genre_name
      FROM Discussion_Thread dt
      LEFT JOIN Movie m ON dt.Movie_ID = m.Movie_ID
      LEFT JOIN Genre g ON dt.Genre_ID = g.Genre_ID
      WHERE dt.Thread_ID = ?
    `, [req.params.id]);
    if (thread.length === 0) return res.status(404).json({ error: 'Thread not found' });

    const [posts] = await pool.query(`
      SELECT dp.*, u.Name AS user_name
      FROM Discussion_Post dp
      JOIN User u ON dp.User_ID = u.User_ID
      WHERE dp.Thread_ID = ? AND dp.Is_deleted = FALSE
      ORDER BY dp.Created_at ASC
    `, [req.params.id]);

    // Build nested tree
    const postMap = {};
    const rootPosts = [];
    posts.forEach(p => { p.replies = []; postMap[p.Post_ID] = p; });
    posts.forEach(p => {
      if (p.Parent_post_ID && postMap[p.Parent_post_ID]) {
        postMap[p.Parent_post_ID].replies.push(p);
      } else {
        rootPosts.push(p);
      }
    });

    res.json({ ...thread[0], posts: rootPosts });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─────────────────────────────────────────────
// POST /api/forum/:id/posts — add a post or reply to a thread
// ─────────────────────────────────────────────
router.post('/:id/posts', authenticateToken, async (req, res) => {
  try {
    const { content, parentPostId } = req.body;
    if (!content || !content.trim()) return res.status(400).json({ error: 'Content required' });

    const [result] = await pool.query(
      'INSERT INTO Discussion_Post (Content, User_ID, Thread_ID, Parent_post_ID) VALUES (?, ?, ?, ?)',
      [content.trim(), req.user.id, req.params.id, parentPostId || null]
    );

    const [post] = await pool.query(`
      SELECT dp.*, u.Name AS user_name
      FROM Discussion_Post dp JOIN User u ON dp.User_ID = u.User_ID
      WHERE dp.Post_ID = ?
    `, [result.insertId]);

    const newPost = post[0];
    newPost.replies = [];
    res.status(201).json(newPost);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─────────────────────────────────────────────
// DELETE /api/forum/posts/:postId — delete a post (own posts, or admin any)
// ─────────────────────────────────────────────
router.delete('/posts/:postId', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM Discussion_Post WHERE Post_ID = ?', [req.params.postId]);
    if (rows.length === 0) return res.status(404).json({ error: 'Post not found' });

    const post = rows[0];
    if (post.User_ID !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Not authorized to delete this post' });
    }

    await pool.query('UPDATE Discussion_Post SET Is_deleted = TRUE WHERE Post_ID = ?', [req.params.postId]);
    res.json({ message: 'Post deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
