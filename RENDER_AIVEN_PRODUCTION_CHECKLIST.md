# ReviewRoll Render + Aiven Production Checklist

Use this checklist to deploy your API + web app on Render with managed MySQL on Aiven.

## 1) Create Aiven MySQL service

Collect these values from Aiven:

- `DB_HOST`
- `DB_PORT`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`

## 2) Initialize remote database

Run locally against Aiven:

```bash
mysql -h <DB_HOST> -P <DB_PORT> -u <DB_USER> -p <DB_NAME> < db/schema.sql
node db/migrate.js
```

## 3) Deploy on Render (Blueprint)

1. Push code to GitHub.
2. In Render, create Blueprint from this repo.
3. Confirm service name and build/start commands from `render.yaml`.

## 4) Set Render environment variables

Set these values in Render service environment:

- `NODE_ENV=production`
- `PORT=10000`
- `DB_HOST=<from_aiven>`
- `DB_PORT=<from_aiven>`
- `DB_USER=<from_aiven>`
- `DB_PASSWORD=<from_aiven>`
- `DB_NAME=<from_aiven>`
- `DB_SSL=true`
- `DB_SSL_REJECT_UNAUTHORIZED=false`
- `JWT_SECRET=<long_random_secret>`
- `TMDB_API_KEY=<your_tmdb_key>`
- `CORS_ORIGINS=https://<your-render-domain>`
- `DESKTOP_DOWNLOAD_URL=<external_zip_url_optional>`

## 5) Verify first deploy

After Render deploy completes:

1. Open home page URL.
2. Call `/api/movies`.
3. Login/register flow should work.
4. Confirm admin seed log says admin exists/seeded.

## 6) Configure desktop hosted mode

Point Electron app to hosted website:

```bash
npm run desktop:configure:web -- https://<your-render-domain>
```

## 7) Build and publish desktop ZIP

```bash
npm run build:desktop:zip
```

Then upload ZIP to GitHub Releases (recommended) and set:

- `DESKTOP_DOWNLOAD_URL=https://github.com/<owner>/<repo>/releases/download/<tag>/ReviewRoll-...zip`

## 8) Validate desktop download route

Visit:

- `https://<your-render-domain>/download/desktop`

Expected: redirect to hosted ZIP (or local file if bundled in public downloads).

## 9) Validate sync across web and desktop

1. Login with same user in browser and desktop app.
2. Add watchlist item in desktop.
3. Refresh browser and verify data appears.
4. Rate/review on browser and verify desktop reflects it.

## 10) Post-deploy hardening

- Restrict `CORS_ORIGINS` to production domains only.
- Rotate `JWT_SECRET` if leaked.
- Keep Aiven backups enabled.
- Add uptime checks for `/api/movies` and `/download/desktop`.
