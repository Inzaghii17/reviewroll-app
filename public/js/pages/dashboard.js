// Dashboard Page
async function renderDashboard(container) {
  if (!api.isLoggedIn()) {
    container.innerHTML = `
      <div class="page"><div class="container">
        <div class="empty-state">
          <div class="empty-state__icon">🔐</div>
          <div class="empty-state__text">Login to access your dashboard</div>
          <button class="btn btn--primary" onclick="app.showAuthModal('login')">LOGIN</button>
        </div>
      </div></div>`;
    return;
  }

  let stats, watchlists;
  try {
    [stats, watchlists] = await Promise.all([
      api.getDashboardStats(),
      api.getWatchlists()
    ]);
  } catch (e) {
    container.innerHTML = `<div class="page"><div class="container">
      <div class="empty-state"><div class="empty-state__icon">⚠</div>
      <div class="empty-state__text">Failed to load dashboard</div></div></div></div>`;
    return;
  }

  const t = stats.totals;

  // Rating distribution chart data
  const ratingData = [];
  for (let i = 1; i <= 10; i++) {
    const entry = stats.ratingDistribution.find(d => d.Rating_value === i);
    ratingData.push({ label: i.toString(), value: entry ? entry.count : 0 });
  }
  const maxRating = Math.max(...ratingData.map(d => d.value), 1);

  // Genre preferences chart data
  const genreData = stats.genrePreferences.map(g => ({
    label: g.Genre_name,
    value: g.count
  }));
  const maxGenre = Math.max(...genreData.map(d => d.value), 1);

  // Watchlist cards
  let watchlistHtml = '';
  if (watchlists.length > 0) {
    const firstWl = await api.getWatchlist(watchlists[0].Watchlist_ID);
    const wlMovies = firstWl.movies || [];
    watchlistHtml = `
      <div class="watchlist-section">
        ${components.sectionHeader(`WATCHLIST: ${firstWl.Watchlist_name}`, '', '')}
        ${wlMovies.length > 0
          ? `<div class="grid grid--4">${wlMovies.map(m => components.movieCard(m)).join('')}</div>`
          : '<p class="text-muted">No movies in this watchlist yet.</p>'}
      </div>`;
    // Show other watchlists as buttons
    if (watchlists.length > 1) {
      watchlistHtml += `
        <div style="margin-bottom:var(--space-4);">
          <p class="text-muted" style="margin-bottom:var(--space-1);">Other watchlists:</p>
          <div style="display:flex;gap:var(--space-1);flex-wrap:wrap;">
            ${watchlists.slice(1).map(wl =>
              `<a href="#/dashboard" onclick="dashboardPage.loadWatchlist(${wl.Watchlist_ID}, '${wl.Watchlist_name}')" class="btn btn--outline btn--sm">${wl.Watchlist_name} (${wl.item_count})</a>`
            ).join('')}
          </div>
        </div>`;
    }
  } else {
    watchlistHtml = `
      <div class="watchlist-section">
        ${components.sectionHeader('MY WATCHLISTS', '', '')}
        <p class="text-muted">No watchlists yet. Create one from a movie page!</p>
      </div>`;
  }

  // Recent activity
  const recentHtml = stats.recentRatings.length > 0
    ? stats.recentRatings.map(r => `
        <div style="display:flex;align-items:center;gap:var(--space-2);padding:var(--space-1) 0;border-bottom:1px solid rgba(51,51,51,0.5);">
          <span style="color:var(--warning);font-weight:700;min-width:28px;">★ ${r.Rating_value}</span>
          <a href="#/movie/${r.Movie_ID}" style="color:var(--text-primary);font-weight:500;">${r.Title}</a>
          <span style="margin-left:auto;font-size:var(--fs-xs);color:var(--text-muted);">${components.timeAgo(new Date(r.Rated_at))}</span>
        </div>`).join('')
    : '<p class="text-muted">No recent ratings.</p>';

  container.innerHTML = `
    <div class="page">
      <div class="container">
        <div class="page__header">
          <h1 class="page__title">DASHBOARD</h1>
          <p class="page__subtitle">Welcome back, ${api.user.name} — Your data center</p>
        </div>

        <div class="dashboard-stats">
          ${components.statCard(t.total_ratings, 'Ratings')}
          ${components.statCard(t.total_reviews, 'Reviews')}
          ${components.statCard(t.total_watchlists, 'Watchlists')}
          ${components.statCard(t.total_posts, 'Forum Posts')}
        </div>

        <div class="dashboard-charts">
          ${components.barChart('RATING DISTRIBUTION', ratingData, maxRating)}
          ${components.barChart('GENRE PREFERENCES', genreData, maxGenre)}
        </div>

        <div class="chart-container" style="margin-bottom:var(--space-5);">
          <div class="chart-container__title">RECENT ACTIVITY</div>
          ${recentHtml}
        </div>

        ${watchlistHtml}
      </div>
    </div>
  `;
}

const dashboardPage = {
  async loadWatchlist(id, name) {
    try {
      const wl = await api.getWatchlist(id);
      const section = document.querySelector('.watchlist-section');
      if (section) {
        section.innerHTML = `
          ${components.sectionHeader(`WATCHLIST: ${name}`, '', '')}
          ${wl.movies && wl.movies.length > 0
            ? `<div class="grid grid--4">${wl.movies.map(m => components.movieCard(m)).join('')}</div>`
            : '<p class="text-muted">No movies in this watchlist.</p>'}`;
      }
    } catch (e) {
      console.error(e);
    }
  }
};
