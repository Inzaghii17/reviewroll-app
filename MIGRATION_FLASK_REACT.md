# Flask + React Migration Foundation

This branch starts an incremental migration from the existing Express + Vanilla SPA app to Flask + React while preserving the current product behavior.

## Branch
- migration/flask-react-foundation

## Migration Strategy
- Keep MySQL schema and data unchanged.
- Introduce Flask API in parallel with existing Express API.
- Introduce React frontend in parallel with existing SPA.
- Migrate route-by-route and feature-by-feature.
- Cut traffic only after parity checks pass.

## Phase Plan

### Phase 1: Foundation (this commit)
- Create Flask project skeleton with app factory pattern.
- Add health endpoint.
- Create React (Vite) starter app skeleton.
- Add migration checklist and endpoint mapping.

### Phase 2: Auth + Core Models
- Auth parity status: in progress
- Completed in this branch:
  - POST /api/auth/login
  - POST /api/auth/register
  - GET /api/auth/me
- JWT callbacks now mimic existing Express semantics:
  - missing token -> 401 { error: 'Access token required' }
  - invalid/expired token -> 403 { error: 'Invalid or expired token' }
- Next for phase completion:
  - Add SQLAlchemy models mapping to existing schema
  - Add auth integration tests against MySQL

### Phase 3: Movies + Forum + Watchlist
- Port high-traffic routes:
  - movies, forum, watchlists, ratings, reviews
- Keep response payloads backward-compatible.

### Phase 4: Admin + TMDB + Requests
- Port admin panel APIs and TMDB auto-fetch workflow.
- Preserve duplicate prevention and transaction behavior.

### Phase 5: React UI Parity and Enhancements
- Rebuild pages:
  - Home, Movies, Movie Detail, Forum, Thread, Watchlist, Request, Admin
- Preserve current interactions, then add stronger animation layer.

#### Current milestone completed
- React home now calls Flask APIs directly for:
  - auth login/register/me
  - movie listing (`GET /api/movies`)
- Token and user persistence added in `localStorage` for migration testing.
- Movie detail slice now connected:
  - Flask: `GET /api/movies/:id` implemented with reviews, userRating, threads, cast, crew
  - React: `/movies/:id` route added and wired to Flask movie detail response
- Forum slice now connected:
  - Flask:
    - `GET /api/forum`
    - `GET /api/forum/search?q=`
    - `GET /api/forum/:id`
  - React:
    - `/forum` page with trending movie threads first and all genre threads below
    - `/forum/:id` thread detail page
- Watchlist slice now connected:
  - Flask:
    - `GET /api/watchlists`
    - `GET /api/watchlists/:id`
    - `POST /api/watchlists`
    - `POST /api/watchlists/:id/movies` (returns 409 on duplicate)
    - `DELETE /api/watchlists/:id/movies/:movieId`
  - React:
    - `/watchlist` page for creating lists, loading list movies, and removing items
    - Movie detail page can add to selected watchlist and now surfaces duplicate-add popup errors
- Admin request approval + TMDB flow now connected:
  - Flask:
    - `GET /api/admin/stats`
    - `GET /api/admin/requests`
    - `POST /api/admin/requests/:id/approve` (supports `autoFetch=true` with TMDB)
    - `DELETE /api/admin/requests/:id`
  - React:
    - `/admin` page loads stats and requests with Approve + TMDB and Reject actions
- React visual pass improved toward parity:
  - richer atmospheric background, glass panels, elevated cards, styled toasts, and stronger motion cues
- Request + ratings/reviews interactive slice now connected:
  - Flask:
    - `POST /api/requests`
    - `GET /api/requests/my`
    - `POST /api/ratings/:movieId`
    - `GET /api/ratings/:movieId`
    - `POST /api/reviews/:movieId`
    - `GET /api/reviews/:movieId`
    - `DELETE /api/reviews/:reviewId`
  - React:
    - `/request` page with submit + request history
    - Movie detail page interactive rating submit
    - Movie detail page interactive review submit and delete (owner/admin)
- Remaining in this phase:
  - Full visual parity with production UI

### Phase 6: Cutover
- Run parity tests and manual QA.
- Switch primary API and frontend serving.
- Keep Express fallback for rollback window.

## Endpoint Migration Matrix

| Feature | Express Route Group | Flask Blueprint |
|---|---|---|
| Auth | /api/auth | auth_bp |
| Movies | /api/movies | movies_bp |
| Ratings | /api/ratings | ratings_bp |
| Reviews | /api/reviews | reviews_bp |
| Watchlists | /api/watchlists | watchlists_bp |
| Forum | /api/forum | forum_bp |
| Requests | /api/requests | requests_bp |
| Admin | /api/admin | admin_bp |
| TMDB | /api/tmdb | tmdb_bp |
| People | /api/people | people_bp |

## Data Compatibility Rules
- Do not rename existing MySQL tables/columns during migration.
- Preserve enum values (Role, Status) exactly.
- Preserve JSON response keys used by current frontend.

## Verification Gates
- Login/register parity.
- Movie listing parity.
- Thread listing parity (trending ordering).
- Watchlist duplicate protection parity.
- Admin approve + TMDB auto-fetch parity.

## Next Execution Steps
1. Build SQLAlchemy models mirroring the existing schema.
2. Port auth endpoints and validate with Postman.
3. Port movies + forum endpoints and run side-by-side API diff checks.
4. Connect React app to Flask for auth + home pages first.

## Streaming Integration Note (Stream Box Analysis)

- Repository checked: `jonbarrow/stream-box`
- Findings:
  - Last active around 7 years ago
  - No published releases/packages
  - Labeled with piracy-related topic metadata on GitHub
  - Not a stable/legal dependency target for production integration
- Decision:
  - Do not integrate Stream Box directly into ReviewRoll.
  - Use legal provider routing via TMDB watch providers instead.

### Implemented legal Watch Now flow
- Added backend endpoint:
  - `GET /api/tmdb/watch-providers/:movieId?region=US`
- Movie detail `WATCH NOW` now:
  - Opens TMDB provider link when available
  - Falls back to JustWatch search when provider data is missing

## Desktop App Delivery Plan (exe + zip)

ReviewRoll already has a native Electron desktop app process (separate app binary, not a browser wrapper).

### Build commands
- `npm run build:desktop` -> builds `nsis`, `portable`, and `zip`
- `npm run build:desktop:exe` -> installer only
- `npm run build:desktop:portable` -> portable app only
- `npm run build:desktop:zip` -> zip package only

### Distribution
- Artifacts are emitted to `dist/`
- Website can serve these files directly via existing static `dist` hosting route
