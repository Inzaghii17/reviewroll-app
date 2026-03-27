# ReviewRoll — Hosting & Deployment Guide

This guide will walk you through deploying ReviewRoll to the web so anyone can access it. Because ReviewRoll relies on both a **Node.js** web server and a **MySQL** database, we need to host both. 

I've configured the project using `render.yaml` to make this process as easy as possible.

## Step 1: Host Your Database (Free on Aiven or TiDB)
Render no longer offers free MySQL databases, so we will use a dedicated database provider.
1. Sign up at [Aiven.io](https://aiven.io/mysql) or [TiDB Serverless](https://www.pingcap.com/tidb-serverless/). Both offer excellent free forever MySQL tiers.
2. Create a new MySQL cluster. 
3. Copy the **Connection Details**:
   - Host (`DB_HOST`)
   - Port (`DB_PORT` - usually 3306 or 4000)
   - User (`DB_USER`)
   - Password (`DB_PASSWORD`)
   - Database Name (`DB_NAME` - usually `defaultdb` or `reviewroll`)

**CRITICAL**: You must manually run your Database Migration script on the remote database before using the app! 
Just temporarily update your local `.env` file to point to the remote Aiven parameters, and run `node db/migrate.js` from your local terminal.

## Step 2: Host the Web App (Free on Render)
1. Push your ReviewRoll code to a GitHub repository.
2. Sign up at [Render.com](https://render.com) and link your GitHub account.
3. Click **New +** and select **Blueprint**.
4. Connect the ReviewRoll repository.
5. Render will automatically detect the `render.yaml` file I created in your project and configure the server!
6. Provide the environment variables it asks for (from Step 1):
   - `DB_HOST`
   - `DB_USER`
   - `DB_PASSWORD`
   - `DB_NAME`
   - `TMDB_API_KEY` (Your free TMDB key from tmdb.org)

Render will then build and start your application. It will give you a live URL (e.g. `https://reviewroll-api.onrender.com`).

## Step 3: Desktop App Distro
I have already set up the `electron-builder` config in your codebase. If you ran `npm run build` locally, your fully functional Desktop App installer is now located at `dist/ReviewRoll Setup 1.0.0.exe`!

If you wish to distribute your app after deploying to Render, you should first update `public/js/api.js` to change `const API_BASE = '/api';` to your hosted Render URL so the desktop app communicates with the cloud instead of localhost, before you run `npm run build`.

Congratulations on launching ReviewRoll!
