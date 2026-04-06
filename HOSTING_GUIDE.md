# ReviewRoll — Hosting & Deployment Guide

This guide deploys ReviewRoll as:

1. A hosted website/API on Render
2. A downloadable Windows desktop ZIP that opens the hosted website
3. One shared database for perfect sync between web and desktop users

## Step 1: Host Your MySQL Database

Use Aiven MySQL or TiDB Serverless (or any managed MySQL provider).

Collect:

- `DB_HOST`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`

Then run the schema and migration against that remote DB:

```bash
mysql -h <DB_HOST> -u <DB_USER> -p <DB_NAME> < db/schema.sql
node db/migrate.js
```

## Step 2: Deploy Website/API to Render (Blueprint)

1. Push this repo to GitHub.
2. On Render, create a new Blueprint from the repo.
3. Set required environment variables:

- `NODE_ENV=production`
- `PORT=10000` (Render injects this)
- `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- `JWT_SECRET`
- `TMDB_API_KEY`
- `CORS_ORIGINS` (comma-separated list of allowed origins)
- `DESKTOP_DOWNLOAD_URL` (optional, set after desktop ZIP is hosted)

Example `CORS_ORIGINS`:

```text
https://reviewroll-api.onrender.com,http://localhost:3000
```

After deploy, verify:

- Website loads at your Render URL
- Login works
- APIs respond under `/api/*`

## Step 3: Build Desktop App in Hosted Mode

The desktop app now supports hosted mode by reading `electron/build-config.json`.

Configure it to load your deployed website URL:

```bash
npm run desktop:configure:web -- https://reviewroll-api.onrender.com
```

Build ZIP artifact:

```bash
npm run build:desktop:zip
```

This ZIP can be extracted and run by users on Windows.

## Step 4: Publish Downloadable ZIP

Publish latest ZIP into web-served downloads folder:

```bash
npm run desktop:publish-zip
```

This creates:

- `public/downloads/ReviewRoll-latest-win.zip`
- `public/downloads/ReviewRoll-latest-win.zip.sha256`

Commit and redeploy. Users can download from:

- `<YOUR_WEB_URL>/download/desktop`

If you prefer external hosting (GitHub Releases, S3, etc.), set:

- `DESKTOP_DOWNLOAD_URL=https://.../ReviewRoll-latest-win.zip`

and `/download/desktop` will redirect there.

## Why Web and Desktop Stay in Sync

Both clients use the same hosted backend and database:

- Website calls `/api/*` on your deployed domain
- Desktop app opens the same deployed domain in Electron
- Same login/auth and same MySQL data are shared automatically

No separate desktop database is used in hosted mode.

## Quick Validation Checklist

1. Register/login on website
2. Open desktop app ZIP build and login with same account
3. Add rating/watchlist item on desktop
4. Refresh website and confirm data appears (and vice versa)

If all four pass, deployment is fully synced.
