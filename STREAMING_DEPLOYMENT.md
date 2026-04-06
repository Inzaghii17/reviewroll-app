# Watch Now Streaming Feature — Deployment Guide

## Overview

The "Watch Now" feature enables free movie streaming directly within ReviewRoll using community embed providers (vidsrc.to, vidsrc.me, SuperEmbed). This guide covers setup, configuration, and deployment.

## Features Implemented

✅ **Embedded Player Modal** — Beautiful, responsive streaming player with provider switching\
✅ **Multiple Embed Providers** — Automatic fallback if primary provider is unavailable\
✅ **TMDB Integration** — Automatic TMDB ID lookup for movies\
✅ **Legal Provider Fallback** — First shows official legal streams (subscription, rent, buy)\
✅ **Mobile Responsive** — Fully optimized for all screen sizes\
✅ **Error Handling** — Graceful degradation with helpful error messages

---

## Prerequisites

- TMDB API Key (free from [themoviedb.org](https://www.themoviedb.org/))
- Node.js 16+ (for Express server)
- Python 3.8+ (for Flask backend, when migrating)
- MySQL 8.0+ (for database)

---

## Installation & Setup

### 1. Database Migration

Add the TMDB_ID column to support streaming:

```bash
# On your machine with MySQL access
mysql -u root -p reviewroll < db/migration_streaming_01.sql
```

This creates:
- `TMDB_ID` column in `Movie` table
- Index for performance

### 2. Environment Configuration

Create a `.env` file in the project root (copy from `.env.example`):

```bash
# Copy example to .env
cp .env.example .env
```

Edit `.env` and set these values:

```env
# Database
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=reviewroll

# TMDB API Key (required for movie metadata)
TMDB_API_KEY=your_tmdb_api_key_here

# Streaming
STREAMING_ENABLED=true

# Server
NODE_ENV=production
PORT=3000
```

**Getting TMDB API Key:**
1. Go to https://www.themoviedb.org/settings/api
2. Register/Login
3. Create an API key
4. Copy the API key to `.env`

### 3. Install Dependencies

```bash
# Express server dependencies
npm install

# Flask backend (if migrating)
cd backend-flask
pip install -r requirements.txt
```

### 4. Start the Server

```bash
# Development
npm start

# Production
NODE_ENV=production node server/server.js
```

Or using Flask:

```bash
cd backend-flask
python run.py
```

---

## API Endpoints

### Get Embed Player

```http
GET /api/streaming/embed/:movieId?provider=vidsrc&includeAll=false
```

**Response:**
```json
{
  "movieId": 1,
  "tmdbId": 550,
  "title": "Fight Club",
  "primary": {
    "provider": "VidSrc",
    "key": "vidsrc",
    "url": "https://vidsrc.to/embed/movie/550"
  },
  "all": [
    {
      "provider": "VidSrc",
      "key": "vidsrc",
      "url": "https://vidsrc.to/embed/movie/550"
    }
  ]
}
```

### Get Streaming Info (Legal + Free Options)

```http
GET /api/streaming/info/:movieId?region=US
```

**Response:**
```json
{
  "movieId": 1,
  "title": "Fight Club",
  "hasLegalProviders": true,
  "legalProviders": {
    "region": "US",
    "flatrate": [
      {
        "provider_id": 123,
        "provider_name": "Netflix",
        "logo_path": "https://image.tmdb.org/t/p/w92/..."
      }
    ],
    "rent": [],
    "buy": [],
    "free": []
  },
  "freeEmbedAvailable": true,
  "streamingOptions": [
    {
      "type": "subscription",
      "label": "Streaming On",
      "providers": [...]
    }
  ]
}
```

### Health Check

```http
GET /api/streaming/health
```

---

## User Interface

### Watch Now Button

Located on movie detail pages:
- Click "🎬 WATCH NOW" button
- Opens embedded streaming modal
- Shows legal providers first (if available)
- Falls back to free embed sources
- Switch providers if primary doesn't work

### Player Features

- **Full Screen** — Native browser fullscreen
- **Provider Switching** — Try alternate sources if one fails
- **Responsive** — Works on desktop, tablet, mobile
- **Keyboard Controls** — ESC to exit, standard video controls

---

## Embed Providers

### Primary Providers

1. **VidSrc.to** - High reliability, good stream quality
   - Format: `https://vidsrc.to/embed/movie/{TMDB_ID}`

2. **VidSrc.me** - Alternative VidSrc domain
   - Format: `https://vidsrc.me/embed/movie/{TMDB_ID}`

3. **SuperEmbed** - Community provider
   - Format: `https://www.superembed.stream/embed/movie/{TMDB_ID}`

4. **MultiEmbed** - Backup option
   - Format: `https://multiembed.mov/directstream.php?video_id={TMDB_ID}&norefer=true`

**Fallback Behavior:**
- If primary provider fails to load, user can click another provider button
- All providers are tested for availability before deployment

---

## Configuration & Customization

### Change Primary Provider

Edit `server/routes/streaming.js` or `backend-flask/app/routes/streaming.py`:

```javascript
// Express version
const DEFAULT_PROVIDERS_ORDER = ['vidsrc', 'vidsrcme', 'superembed', 'multiembed'];

// Change to:
const DEFAULT_PROVIDERS_ORDER = ['vidsrcme', 'vidsrc', 'superembed'];
```

### Add New Provider

Edit the `EMBED_PROVIDERS` object:

```javascript
EMBED_PROVIDERS = {
  // ... existing providers
  newprovider: {
    name: 'New Provider',
    tmdb: (id) => `https://newprovider.com/embed/${id}`,
    imdb: (id) => `https://newprovider.com/title/${id}`
  }
};
```

### Disable Streaming

Set in `.env`:

```env
STREAMING_ENABLED=false
```

Or remove the route registration from server.js:

```javascript
// Comment out:
// app.use('/api/streaming', require('./routes/streaming'));
```

---

## Deployment to Render

### 1. Push to GitHub

```bash
git add .
git commit -m "Add Watch Now streaming feature"
git push origin main
```

### 2. Deploy to Render

1. Go to [render.com](https://render.com)
2. Connect GitHub repository
3. Create new "Web Service"
4. Set build command: `npm install`
5. Set start command: `npm start`
6. Add environment variables:
   - `TMDB_API_KEY=your_key`
   - `DB_HOST=your_db_host`
   - `DB_USER=root`
   - `DB_PASSWORD=your_password`
   - `DB_NAME=reviewroll`
   - `NODE_ENV=production`

### 3. Deploy Flask Backend (if using)

```yaml
# render.yaml
services:
  - type: web
    name: reviewroll-flask
    env: python
    buildCommand: pip install -r backend-flask/requirements.txt
    startCommand: cd backend-flask && python run.py
    envVars:
      - key: TMDB_API_KEY
        value: your_key
      - key: FLASK_ENV
        value: production
```

### 4. Database

For hosted MySQL (use existing database or create new):
- Update `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD` in environment variables
- Run migration: `mysql -u root -p -h your_host < db/migration_streaming_01.sql`

---

## Deployment to Vercel (React Frontend Only)

If using Vercel for React frontend:

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
cd frontend-react
vercel
```

Set environment variables in Vercel dashboard:
- `REACT_APP_API_URL=https://your-render-app.onrender.com`

---

## Legal Compliance

### Important Disclaimers

Add these to your Terms of Service and Privacy Policy:

**1. Streaming Providers**
- ReviewRoll does not host or serve any video content
- All streaming is provided by third-party community embed providers
- Users access content through external embedded players
- Providers may change or become unavailable without notice

**2. Copyright Notice**
- Users are responsible for ensuring they have legal right to access content
- ReviewRoll recommends using official, legal streaming services when available
- TMDB integration shows legal providers (Netflix, Amazon Prime, etc.) first

**3. Liability**
```
ReviewRoll provides streaming embeds for convenience only. 
We are not liable for content availability, quality, or legal issues.
Users access third-party content at their own risk.
```

**4. DMCA Compliance**
- ReviewRoll does not host copyrighted content
- To report DMCA violations, contact us with specific URLs
- We will remove non-functioning embed providers promptly

### Example Terms of Service Section

```markdown
## Streaming Content

### Provided "As-Is"
ReviewRoll provides embedded streaming players through third-party 
community providers. These services are provided without warranty 
and may be subject to geographic restrictions or availability changes.

### User Responsibility
You are responsible for:
- Ensuring you have the legal right to access content in your region
- Complying with copyright laws and platform terms of service
- Using official/legal platforms when available

### Third-Party Providers
ReviewRoll is not affiliated with embed providers. We display legal 
streaming options (Netflix, Prime Video, etc.) first. Free embeds are 
provided by independent community sources.
```

---

## Troubleshooting

### "TMDB ID not found" Error

**Solution:**
1. Verify TMDB_API_KEY is set in `.env`
2. Check that API key is active on tmdb.org
3. Manually add TMDB_ID to database:

```sql
UPDATE Movie SET TMDB_ID = 550 WHERE Movie_ID = 1;
-- (Find TMDB ID by searching movie on themoviedb.org)
```

### Embed Player Won't Load

**Try:**
1. Switch providers using the provider buttons
2. Disable browser extensions (some block embeds)
3. Try a different browser
4. Check if provider URL is accessible: `https://vidsrc.to/embed/movie/{TMDB_ID}`

### Provider Blocked in Your Region

**Solution:**
- This is expected for some regions
- Click alternative provider buttons
- Use legal streaming services (Netflix, Prime Video, etc.)
- Check legal options in the modal

### Movie Not Found Error

**Solution:**
1. Verify movie exists in database
2. Check TMDB_ID is set:

```sql
SELECT Movie_ID, Title, TMDB_ID FROM Movie WHERE Title LIKE '%search%';
```

3. If TMDB_ID is NULL, run admin panel TMDB auto-fetch
4. Or manually set TMDB_ID from themoviedb.org

---

## Performance Optimization

### Caching

Add Redis caching for embed URLs:

```javascript
const redis = require('redis');
const client = redis.createClient();

// In streaming route:
const cacheKey = `embed:${movieId}`;
const cached = await client.get(cacheKey);
if (cached) return JSON.parse(cached);

// ... fetch embed URL ...

// Cache for 24 hours
await client.setex(cacheKey, 86400, JSON.stringify(result));
```

### Database Optimization

```sql
-- Ensure index exists
CREATE INDEX idx_movie_tmdb_id ON Movie(TMDB_ID);

-- Check query performance
EXPLAIN SELECT * FROM Movie WHERE TMDB_ID = 550;
```

---

## Monitoring & Logging

### Health Checks

```bash
# Check streaming service health
curl http://localhost:3000/api/streaming/health

# Response:
{
  "status": "healthy",
  "service": "streaming",
  "providers": ["vidsrc", "vidsrcme", "superembed", "multiembed"]
}
```

### Error Logging

Watch server logs for:
- `Failed to get streaming embed` — API errors
- `TMDB search failed` — Database lookup issues
- `Streaming embed error` — Unexpected errors

### Monitoring Services

Set up error tracking (optional):
```bash
# Sentry for error monitoring
npm install @sentry/node @sentry/tracing
```

---

## Maintenance

### Weekly Checks

```bash
# Test embed endpoints
curl http://localhost:3000/api/streaming/health

# Verify TMDB API key is still valid
curl https://api.themoviedb.org/3/movie/550?api_key=YOUR_KEY

# Check for missing TMDB_IDs
mysql -u root -p -e "
  SELECT COUNT(*) as missing_tmdb 
  FROM reviewroll.Movie 
  WHERE TMDB_ID IS NULL;
"
```

### Monthly Maintenance

- Review embed provider status (are links still working?)
- Update provider list if any are unavailable
- Check error logs for issues
- Verify TMDB API usage haven't exceeded quota

### Update Providers

If a provider becomes unavailable:

1. Edit `EMBED_PROVIDERS` in streaming.js
2. Remove or update the provider
3. Test thoroughly
4. Deploy changes

```javascript
// Example: Remove broken provider
const EMBED_PROVIDERS = {
  vidsrc: { ... },
  // vidsrcme: { ... },  // Commented out - appears broken
  superembed: { ... },
};
```

---

## Advanced Features

### Custom Provider Implementation

To add a custom embed provider or streaming source:

```javascript
// 1. Add to EMBED_PROVIDERS
EMBED_PROVIDERS.custom = {
  name: 'Custom Provider',
  tmdb: (id) => `https://custom.com/embed/${id}`,
  imdb: (id) => `https://custom.com/title/${id}`
};

// 2. Add to priority order
DEFAULT_PROVIDERS_ORDER.push('custom');

// 3. Test thoroughly before deploying
```

### Analytics

Track which providers are most used:

```javascript
// In streamingPlayer.js
async switchProvider(index) {
  this.currentProvider = this.allProviders[index];
  
  // Track usage
  fetch('/api/analytics/provider-usage', {
    method: 'POST',
    body: JSON.stringify({
      movieId: this.currentMovie.id,
      provider: this.currentProvider.key
    })
  });
  
  this.renderModal();
}
```

---

## FAQ

**Q: Is streaming content hosted by ReviewRoll?**\
A: No. We only embed players from third-party providers. All content is streamed directly from external sources.

**Q: Are these legal?**\
A: Community embed providers operate in a legal gray area. We show official legal options first. Users access content at their own discretion.

**Q: Will my app get DMCA takedowns?**\
A: No. Since we don't host content, we're not liable for DMCA. Embed providers handle that. Include clear disclaimers in your ToS.

**Q: What if a provider goes down?**\
A: Users can switch to another provider using the provider buttons. All providers are tested and included as fallbacks.

**Q: Can I customize providers?**\
A: Yes! Edit `EMBED_PROVIDERS` and `DEFAULT_PROVIDERS_ORDER` in streaming.js or streaming.py

**Q: Does this work on mobile?**\
A: Yes! The player is fully responsive. Some embeds may require fullscreen viewing on mobile.

---

## Support & Issues

### Reporting Issues

Include:
1. Movie title and ID
2. Which provider failed
3. Screenshot/error message
4. Browser and OS
5. Region/country

### Getting Help

- Check [vidsrc.to](https://vidsrc.to) status
- Try different providers
- Verify TMDB API key is active
- Check server logs for errors

---

## Version History

**v1.0.0** (Current)
- Initial release with Watch Now feature
- Support for 4 embed providers
- TMDB integration
- Legal provider lookup
- Beautiful responsive player

---

## License & Credits

ReviewRoll Streaming Feature\
Built with community embed providers through vidsrc.to, vidsrc.me, SuperEmbed, MultiEmbed\
Powered by TMDB (The Movie Database) API

---

## Next Steps

1. ✅ Run database migration
2. ✅ Set TMDB_API_KEY in `.env`
3. ✅ Deploy to Render/hosting platform
4. ✅ Test Watch Now feature on live site
5. ✅ Add legal disclaimers to ToS
6. ✅ Monitor for issues and log errors

**Your app is now ready for deployment with the Watch Now streaming feature!**
