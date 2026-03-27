// Watchlist Page — ReviewRoll
async function renderWatchlist(container) {
  if (!api.isLoggedIn()) {
    container.innerHTML = `
      <div class="page"><div class="container">
        <div class="empty-state">
          <div class="empty-state__icon">🔒</div>
          <div class="empty-state__text">Login to view your watchlists</div>
          <button class="btn btn--primary" onclick="app.showAuthModal('login')">LOGIN</button>
        </div>
      </div></div>`;
    return;
  }

  container.innerHTML = `
    <div class="page">
      <div class="page__hero">
        <div class="container">
          <h1 class="page__hero-title">MY WATCHLISTS</h1>
          <p class="page__hero-sub">Your curated movie collections</p>
        </div>
      </div>
      <div class="container" style="padding-top:40px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:32px;flex-wrap:wrap;gap:12px;">
          <h2 style="font-family:var(--font-heading);font-size:20px;letter-spacing:2px;">COLLECTIONS</h2>
          <div style="display:flex;gap:12px;align-items:center;">
            <input type="text" id="wl-new-name" class="input" placeholder="New watchlist name..." style="width:220px;">
            <button class="btn btn--primary" onclick="watchlistPage.createWatchlist()">+ CREATE</button>
          </div>
        </div>
        <div id="wl-error" class="form-error" style="display:none;margin-bottom:16px;"></div>
        <div id="wl-list"></div>
      </div>
    </div>`;

  await watchlistPage.loadWatchlists();
}

const watchlistPage = {
  async loadWatchlists() {
    const listEl = document.getElementById('wl-list');
    try {
      const watchlists = await api.getWatchlists();
      if (watchlists.length === 0) {
        listEl.innerHTML = `
          <div class="empty-state">
            <div class="empty-state__icon">📋</div>
            <div class="empty-state__text">No watchlists yet. Create one above!</div>
          </div>`;
        return;
      }

      listEl.innerHTML = watchlists.map(wl => `
        <div class="watchlist-card fade-in" id="wl-${wl.Watchlist_ID}">
          <div class="watchlist-card__header" onclick="watchlistPage.toggleWatchlist(${wl.Watchlist_ID})">
            <div>
              <span class="watchlist-card__name">📁 ${components.escapeHtml(wl.Watchlist_name)}</span>
              <span class="watchlist-card__count">${wl.item_count} movie${wl.item_count !== 1 ? 's' : ''}</span>
            </div>
            <span class="watchlist-card__toggle" id="wl-toggle-${wl.Watchlist_ID}">▼</span>
          </div>
          <div class="watchlist-card__body" id="wl-body-${wl.Watchlist_ID}" style="display:none;">
            <div class="watchlist-card__movies" id="wl-movies-${wl.Watchlist_ID}">
              <div class="text-muted" style="padding:16px 0;">Loading...</div>
            </div>
          </div>
        </div>`).join('');
    } catch (err) {
      listEl.innerHTML = `<div class="empty-state"><div class="empty-state__icon">⚠</div><div class="empty-state__text">Failed to load watchlists</div></div>`;
    }
  },

  async toggleWatchlist(id) {
    const body = document.getElementById(`wl-body-${id}`);
    const toggle = document.getElementById(`wl-toggle-${id}`);
    const isOpen = body.style.display !== 'none';

    if (isOpen) {
      body.style.display = 'none';
      toggle.textContent = '▼';
    } else {
      body.style.display = 'block';
      toggle.textContent = '▲';
      await this.loadMovies(id);
    }
  },

  async loadMovies(watchlistId) {
    const moviesEl = document.getElementById(`wl-movies-${watchlistId}`);
    try {
      const data = await api.getWatchlist(watchlistId);
      if (!data.movies || data.movies.length === 0) {
        moviesEl.innerHTML = `<div class="text-muted" style="padding:16px 0;">No movies yet. Add from a movie's detail page!</div>`;
        return;
      }
      moviesEl.innerHTML = data.movies.map(m => `
        <div class="watchlist-movie" id="wlm-${watchlistId}-${m.Movie_ID}">
          <div class="watchlist-movie__info" onclick="location.hash='#/movie/${m.Movie_ID}'" style="cursor:pointer;">
            <div class="watchlist-movie__title">${components.escapeHtml(m.Title)}</div>
            <div class="watchlist-movie__meta">
              <span>★ ${m.avg_rating || 'N/A'}</span>
              <span>${m.Release_year}</span>
              <span>${m.genres || ''}</span>
            </div>
          </div>
          <button class="btn btn--outline btn--sm" style="color:var(--accent-red);border-color:var(--accent-red);"
            onclick="watchlistPage.removeMovie(${watchlistId}, ${m.Movie_ID})">✕ Remove</button>
        </div>`).join('');
    } catch (err) {
      moviesEl.innerHTML = `<div class="text-muted" style="padding:16px 0;">Failed to load movies.</div>`;
    }
  },

  async removeMovie(watchlistId, movieId) {
    try {
      await api.removeFromWatchlist(watchlistId, movieId);
      const el = document.getElementById(`wlm-${watchlistId}-${movieId}`);
      if (el) el.remove();
    } catch (err) {
      alert('Failed to remove movie.');
    }
  },

  async createWatchlist() {
    const nameInput = document.getElementById('wl-new-name');
    const errorEl = document.getElementById('wl-error');
    const name = nameInput.value.trim();
    if (!name) {
      errorEl.textContent = 'Please enter a watchlist name.';
      errorEl.style.display = 'block';
      return;
    }
    errorEl.style.display = 'none';
    try {
      await api.createWatchlist(name);
      nameInput.value = '';
      await this.loadWatchlists();
    } catch (err) {
      errorEl.textContent = err.error || 'Failed to create watchlist.';
      errorEl.style.display = 'block';
    }
  }
};
