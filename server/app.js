const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

const corsOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

// Middleware
app.use(cors(corsOrigins.length ? { origin: corsOrigins } : undefined));
app.use(express.json());

// Serve static frontend files
app.use(express.static(path.join(__dirname, '..', 'public')));
// Uploaded movie images available at /uploads/*
app.use('/uploads', express.static(path.join(__dirname, '..', 'public', 'uploads')));
// Serve desktop app downloads
app.use('/dist', express.static(path.join(__dirname, '..', 'dist')));

app.get('/download/desktop', (req, res) => {
  const configuredUrl = process.env.DESKTOP_DOWNLOAD_URL;
  if (configuredUrl) {
    return res.redirect(configuredUrl);
  }

  const bundledPath = path.join(__dirname, '..', 'public', 'downloads', 'ReviewRoll-latest-win.zip');
  return res.sendFile(bundledPath, (err) => {
    if (err) {
      res.status(404).json({
        error: 'Desktop build not available yet',
        message: 'Set DESKTOP_DOWNLOAD_URL or publish a local zip to public/downloads/ReviewRoll-latest-win.zip'
      });
    }
  });
});

// API Routes
app.use('/api/auth',       require('./routes/auth'));
app.use('/api/movies',     require('./routes/movies'));
app.use('/api/ratings',    require('./routes/ratings'));
app.use('/api/reviews',    require('./routes/reviews'));
app.use('/api/watchlists', require('./routes/watchlists'));
app.use('/api/forum',      require('./routes/forum'));
app.use('/api/dashboard',  require('./routes/dashboard'));
app.use('/api/requests',   require('./routes/requests'));
app.use('/api/admin',      require('./routes/admin'));
app.use('/api/tmdb',       require('./routes/tmdb'));
app.use('/api/people',     require('./routes/people'));
app.use('/api/streaming',  require('./routes/streaming'));

// SPA fallback — serve index.html for all non-API GET routes
app.get('{*splat}', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

module.exports = app;