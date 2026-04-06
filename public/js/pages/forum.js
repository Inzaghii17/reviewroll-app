// Forum Page — Trending + Search
async function renderForum(container) {
  container.innerHTML = `
    <div class="page">
      <div class="page__hero">
        <div class="container">
          <h1 class="page__hero-title">DISCUSSION BOARDS</h1>
          <p class="page__hero-sub">Trending threads — sorted by most active</p>
        </div>
      </div>
      <div class="container" style="padding-top:36px;">
        <div class="forum-search-bar" style="margin-bottom:28px;">
          <input type="text" id="forum-search" class="input" placeholder="Search by movie title or genre..." oninput="forumPage.search(this.value)" style="max-width:480px;">
        </div>
        <div id="forum-threads-list" class="threads-list"></div>
      </div>
    </div>`;

  await forumPage.loadThreads();
}

const forumPage = {
  allThreads: [],
  trendingMovieLimit: 8,

  async loadThreads() {
    const el = document.getElementById('forum-threads-list');
    if (!el) return;
    try {
      const threads = await api.getThreads();
      this.allThreads = threads;
      this.renderList(threads);
    } catch (e) {
      el.innerHTML = `<div class="empty-state"><div class="empty-state__icon">⚠</div><div class="empty-state__text">Failed to load threads</div></div>`;
    }
  },

  threadScore(t) {
    const posts = Number(t.post_count || 0);
    const activeUsers = Number(t.active_users || 0);
    const recentMs = t.last_activity ? (Date.now() - new Date(t.last_activity).getTime()) : Number.POSITIVE_INFINITY;
    const recencyBoost = Number.isFinite(recentMs)
      ? Math.max(0, 72 - Math.floor(recentMs / (1000 * 60 * 60)))
      : 0;
    return (posts * 5) + (activeUsers * 2) + recencyBoost;
  },

  renderList(threads) {
    const el = document.getElementById('forum-threads-list');
    if (!el) return;
    if (!threads || threads.length === 0) {
      el.innerHTML = `<div class="empty-state"><div class="empty-state__icon">💬</div><div class="empty-state__text">No discussions found</div></div>`;
      return;
    }

    // Show only highest-signal movie discussions first, then all genre threads.
    const movie = threads
      .filter(t => t.movie_title)
      .sort((a, b) => this.threadScore(b) - this.threadScore(a));
    const genre = threads
      .filter(t => t.Genre_name)
      .sort((a, b) => this.threadScore(b) - this.threadScore(a));
    const topMovie = movie.slice(0, this.trendingMovieLimit);

    let html = '';
    if (topMovie.length) {
      html += `<div class="section-header" style="margin-bottom:16px;"><h2 class="section-header__title" style="font-size:14px;">🎬 TRENDING MOVIE THREADS</h2><div class="section-header__line"></div></div>`;
      html += `<div style="display:flex;flex-direction:column;gap:12px;margin-bottom:10px;">${topMovie.map(t => components.threadItem(t)).join('')}</div>`;
      if (movie.length > topMovie.length) {
        html += `<p class="text-muted" style="font-size:12px;margin:0 0 26px;">Showing top ${topMovie.length} movie threads by recency and activity.</p>`;
      }
    }
    if (genre.length) {
      html += `<div class="section-header" style="margin-bottom:16px;"><h2 class="section-header__title" style="font-size:14px;">🏷 ALL GENRE THREADS</h2><div class="section-header__line"></div></div>`;
      html += `<div style="display:flex;flex-direction:column;gap:12px;">${genre.map(t => components.threadItem(t)).join('')}</div>`;
    }
    el.innerHTML = html;
  },

  async search(q) {
    if (!q.trim()) {
      this.renderList(this.allThreads);
      return;
    }
    try {
      const results = await api.searchThreads(q.trim());
      this.renderList(results);
    } catch (e) {
      console.error('Search failed', e);
    }
  }
};
