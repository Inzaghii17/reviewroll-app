# ReviewRoll — DBMS Project

> Full-stack movie platform with ratings, reviews, watchlists, discussions, movie requests, admin panel, and **free embedded streaming** 🎬

## ✨ Latest Features

### 🎬 Watch Now — Free Embedded Streaming
Watch movies directly in the app using free community embed providers!
- Multiple providers (vidsrc.to, vidsrc.me, SuperEmbed, MultiEmbed) with automatic fallback
- Legal streaming options first (Netflix, Prime Video, etc.)
- Beautiful responsive player with provider switching
- Works perfectly on mobile, tablet, and desktop

**Get started:** See [WATCH_NOW_QUICK_START.md](WATCH_NOW_QUICK_START.md)\
**Full guide:** See [STREAMING_DEPLOYMENT.md](STREAMING_DEPLOYMENT.md)

## Vercel Deployment

Deploy this app on Vercel using the serverless setup in this repo:
- Guide: [VERCEL_DEPLOYMENT.md](VERCEL_DEPLOYMENT.md)

### 🖥 Desktop App + Website Sync (Hosted Mode)
The Electron desktop app can now run in hosted mode and open your deployed web URL directly.
That means desktop and browser users share:
- Same login/auth
- Same API
- Same production database

See [HOSTING_GUIDE.md](HOSTING_GUIDE.md) for full deployment and ZIP distribution steps.

## Tech Stack
- **Backend**: Node.js + Express (with Flask migration in progress)
- **Database**: MySQL (mysql2/promise · persistent, never auto-dropped)
- **Frontend**: Vanilla HTML/CSS/JS (SPA) with React migration foundation
- **Auth**: JWT + bcryptjs
- **Streaming**: Community embed providers + TMDB legal streaming lookup

## Migration Track (Flask + React)

A migration foundation now exists in this repository to move toward Flask API + React frontend incrementally:

- Migration plan: `MIGRATION_FLASK_REACT.md`
- Flask API skeleton: `backend-flask/`
- React app skeleton: `frontend-react/`

This allows side-by-side development without breaking the current production flow.

### Run Flask Skeleton

```bash
cd backend-flask
pip install -r requirements.txt
copy .env.example .env
python run.py
```

Health check:
- `GET http://localhost:5000/api/health`

### Run React Skeleton

```bash
cd frontend-react
npm install
copy .env.example .env
npm run dev
```

Default URL:
- `http://localhost:5173`

---

## IMPORTANT: Database Safety

The server **never drops or recreates** the database.
- `schema.sql` uses `CREATE TABLE IF NOT EXISTS` — safe to re-run
- Admin user is seeded automatically on every server start (no duplicate created)

---

## Setup (First Time Only)

```bash
# 1. Set your MySQL password in .env
DB_PASSWORD=your_mysql_password

# 2. Import schema ONCE
mysql -u root -p < db/schema.sql

# 3. Install deps
npm install

# 4. Start server
npm start
```

Server starts at **http://localhost:3000**

## Desktop Build Commands

```bash
# Configure desktop app to open deployed web app
npm run desktop:configure:web -- https://your-render-url.onrender.com

# Build Windows zip
npm run build:desktop:zip

# Publish latest zip into web-download folder
npm run desktop:publish-zip
```

End-user download URL after deploy:
- `/download/desktop`

On startup, admin is auto-seeded:
- **Email**: admin@reviewroll.com
- **Password**: admin123

---

## Roles

| Role  | Can Do |
|-------|--------|
| USER  | Rate, review, watchlist, request movies, post in forums |
| ADMIN | Add movies directly, approve/reject requests, promote users, delete any post |
| ADMIN | Cannot create watchlists or request movies |

---

## Admin Features
- `/admin` panel — 3 tabs:
  1. **Movie Requests** — Approve (opens modal with form + image upload) / Reject
  2. **Add Movie** — Directly add title, year, duration, genres, image (file or URL)
  3. **User Management** — Promote any user to ADMIN

---

## SQL Triggers
1. `after_rating_insert` — auto-updates Movie.Avg_rating
2. `after_rating_update` — auto-updates Movie.Avg_rating on update
3. `before_movie_request_insert` — rejects duplicate requests (same title+year)
4. `after_movie_insert` — auto-creates a Discussion_Thread for every new movie
5. `after_genre_insert` — auto-creates a Discussion_Thread for every new genre
