# Watch Now Feature — Quick Start

Get the free embedded movie streaming feature up and running in 5 minutes.

## 📋 What's Included

- **Embedded Streaming Player** — Modal-based video player with provider switching
- **Multiple Providers** — vidsrc.to, vidsrc.me, SuperEmbed, MultiEmbed
- **Legal Provider Lookup** — Shows Netflix, Prime Video, etc. first if available
- **Responsive Design** — Works perfectly on mobile, tablet, desktop
- **Error Recovery** — Automatic provider fallback if one fails

## ⚡ Quick Setup (5 minutes)

### 1. Get TMDB API Key (2 min)

1. Visit https://www.themoviedb.org/settings/api
2. Sign up (free)
3. Request API key
4. Copy your API key

### 2. Configure Environment (1 min)

```bash
# Copy example config
cp .env.example .env

# Edit .env:
TMDB_API_KEY=your_key_here
```

### 3. Run Database Migration (1 min)

```bash
mysql -u root -p reviewroll < db/migration_streaming_01.sql
```

### 4. Start Server (1 min)

```bash
npm start
# or with Python/Flask:
cd backend-flask && python run.py
```

### 5. Test It! (instant)

1. Go to a movie detail page
2. Click "🎬 WATCH NOW" button
3. Embedded player opens! 🎉

## 📱 User Experience

**Before:**
- Click "Watch Now" → redirects to external site
- Lost users, broken experience

**After:**
- Click "Watch Now" → beautiful modal player
- Watch in-app, stay in community
- Try different providers if one fails

## 🔧 Files Added/Modified

### New Files
- `server/routes/streaming.js` — Express streaming API
- `backend-flask/app/routes/streaming.py` — Flask streaming API
- `public/js/pages/streamingPlayer.js` — Player modal component
- `public/css/streaming.css` — Player styling
- `db/migration_streaming_01.sql` — Database update
- `STREAMING_DEPLOYMENT.md` — Full deployment guide

### Modified Files
- `server/server.js` — Added streaming route
- `public/index.html` — Added streaming scripts/styles
- `public/js/api.js` — Added streaming API methods
- `public/js/pages/movieDetail.js` — Updated watchNow function
- `backend-flask/app/__init__.py` — Registered streaming blueprint
- `.env.example` — Added TMDB_API_KEY config

## 🎯 Features

### For Users
- ✅ Watch movies directly in app
- ✅ Switch providers if one doesn't work
- ✅ See legal streaming options first
- ✅ Works on all devices
- ✅ Beautiful UI with animations

### For Developers
- ✅ Easy to deploy
- ✅ Multiple provider fallback
- ✅ Configurable providers
- ✅ Automatic TMDB lookups
- ✅ Error handling built-in
- ✅ Works with Express and Flask

## 🚀 Deployment

### Render (Recommended)

1. Push to GitHub
2. Go to render.com
3. Create Web Service
4. Set env variables:
   - `TMDB_API_KEY`
   - `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
5. Deploy!

See [STREAMING_DEPLOYMENT.md](STREAMING_DEPLOYMENT.md) for detailed guide.

### Vercel/Netlify (React Frontend)

```bash
vercel
# Add REACT_APP_API_URL environment variable
```

## ⚠️ Important Legal Notes

- **No hosting** — ReviewRoll doesn't host any video content
- **Third-party embeds** — Content streamed from external providers
- **Legal frameworks** — Show official streaming options first
- **User responsibility** — Users access at their own discretion

Add to your Terms of Service:

```
ReviewRoll provides embedded streaming players for convenience.
We do not host, distribute, or endorse any content.
Access third-party content at your own discretion and risk.
```

See [STREAMING_DEPLOYMENT.md](STREAMING_DEPLOYMENT.md) for full T&S template.

## 🐛 Troubleshooting

### Player Won't Load
- Check TMDB_API_KEY is set in `.env`
- Try switching providers (click provider buttons)
- Check browser console for errors

### "TMDB ID not found"
- Verify API key is active at themoviedb.org
- Movie might not be on TMDB (try popular movies first)

### Provider Blocked in Region
- This is normal — try another provider
- Use legal streaming services instead
- Check available options in the player

## 📊 Tech Stack

- **Backend**: Express.js (Node.js) or Flask (Python)
- **Frontend**: Vanilla JavaScript with modal player
- **Database**: MySQL (stores TMDB_IDs)
- **Streaming**: Community embed providers
- **Legal data**: TMDB API

## 📖 Full Documentation

See **[STREAMING_DEPLOYMENT.md](STREAMING_DEPLOYMENT.md)** for:
- Detailed installation steps
- API documentation
- Provider information
- Configuration options
- Performance optimization
- Legal compliance details
- Troubleshooting guide
- Advanced customization

## 🤝 Contributing

To add a new provider or improve the feature:

1. Edit `EMBED_PROVIDERS` in streaming.js/streaming.py
2. Add your provider URL format
3. Test thoroughly
4. Submit PR

## ✨ What's Next?

- **Analytics** — Track which providers users choose
- **Watchlist Integration** — Save "to watch" movies
- **Comments** — Community reviews during watch
- **Recommendations** — Similar movies while watching

## 📞 Support

If you have questions:
1. Check [STREAMING_DEPLOYMENT.md](STREAMING_DEPLOYMENT.md)
2. Review API endpoint documentation
3. Check browser console for errors
4. Verify TMDB API key and database connection

---

**You're all set!** The Watch Now feature is ready to delight your users. 🎬🍿
