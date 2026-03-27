# ReviewRoll — DBMS Project

> Full-stack movie platform with ratings, reviews, watchlists, discussions, movie requests, and admin panel.

## Tech Stack
- **Backend**: Node.js + Express
- **Database**: MySQL (mysql2/promise · persistent, never auto-dropped)
- **Frontend**: Vanilla HTML/CSS/JS (Single Page Application)
- **Auth**: JWT + bcryptjs

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
