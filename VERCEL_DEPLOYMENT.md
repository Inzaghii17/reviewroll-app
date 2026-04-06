# ReviewRoll - Vercel Deployment Guide

This guide deploys your current Node/Express + MySQL app on Vercel.

## 1. Prerequisites

- GitHub repository with this project
- Managed MySQL database (Aiven, TiDB Serverless, PlanetScale, etc.)
- Vercel account linked to your GitHub

## 2. Architecture Used

- `api/index.js` is the Vercel serverless entrypoint.
- `server/app.js` contains the shared Express app.
- `server/server.js` is still used for local `npm start`.
- `vercel.json` rewrites all routes to `api/index` so your SPA + API both work.

## 3. Database Setup (Remote)

Run schema and migration against your hosted MySQL:

```bash
mysql -h <DB_HOST> -u <DB_USER> -p <DB_NAME> < db/schema.sql
node db/migrate.js
```

## 4. Import Project in Vercel

1. Go to Vercel dashboard -> Add New -> Project.
2. Import this GitHub repository.
3. Framework preset: `Other`.
4. Build command: leave empty (or `npm install`).
5. Output directory: leave empty.

## 5. Environment Variables in Vercel

Set these in Project Settings -> Environment Variables:

- `NODE_ENV=production`
- `DB_HOST`
- `DB_PORT` (usually `3306`)
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`
- `JWT_SECRET`
- `TMDB_API_KEY`
- `CORS_ORIGINS`
- `DESKTOP_DOWNLOAD_URL` (recommended)

Example `CORS_ORIGINS`:

```text
https://your-project.vercel.app,http://localhost:3000
```

## 6. Desktop Download Strategy on Vercel

Large binaries should not be bundled with serverless functions.

Recommended:
- Upload desktop ZIP to GitHub Releases (or S3/R2).
- Set `DESKTOP_DOWNLOAD_URL` to that direct file URL.
- Users download from:
  - `https://your-project.vercel.app/download/desktop`

That endpoint will redirect to your hosted ZIP.

## 7. Deploy

Push to `main` (or selected production branch). Vercel auto-deploys.

## 8. Validate Production

Check these URLs:

- `/` -> app homepage
- `/api/health` (if available) or another API route like `/api/movies`
- `/download/desktop` -> redirects to desktop ZIP URL

Then verify data sync:

1. Login on website
2. Login on desktop app
3. Create/update data on one client
4. Confirm same change appears in the other

## 9. Desktop Build for Hosted Mode

Before building desktop app, configure it to open the Vercel URL:

```bash
npm run desktop:configure:web -- https://your-project.vercel.app
npm run build:desktop:zip
```

Then upload the generated ZIP to your release storage and update `DESKTOP_DOWNLOAD_URL`.

## 10. Common Issues

- 500 errors on API: check DB env vars in Vercel.
- CORS blocked: ensure exact production origin in `CORS_ORIGINS`.
- Desktop download 404: set `DESKTOP_DOWNLOAD_URL`.
- MySQL TLS requirement: if provider requires SSL, update DB pool config accordingly.
