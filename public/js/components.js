// Shared UI Components — ReviewRoll
const components = {

  // Resolve image URL: prefer DB Image_URL, then TMDB map, then gradient
  posterGradients: [
    'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
    'linear-gradient(135deg, #2d1b69 0%, #11998e 100%)',
    'linear-gradient(135deg, #0c0c0c 0%, #E63946 100%)',
    'linear-gradient(135deg, #141e30 0%, #243b55 100%)',
    'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)',
    'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)',
    'linear-gradient(135deg, #232526 0%, #414345 100%)'
  ],

  tmdbPosters: {
    1: 'https://image.tmdb.org/t/p/w500/oYuLEt3zVCKq57qu2F8dT7NIa6f.jpg',
    2: 'https://image.tmdb.org/t/p/w500/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg',
    3: 'https://image.tmdb.org/t/p/w500/d5NXSklXo0qyIYkgV94XAgMIckC.jpg',
    4: 'https://image.tmdb.org/t/p/w500/qJ2tW6WMUDux911BTUgMe9Nh4wj.jpg',
    5: 'https://image.tmdb.org/t/p/w500/kyeqWdyUXW608qlYkRqosgbbJyK.jpg',
    6: 'https://image.tmdb.org/t/p/w500/k68nPLbIST6NP96JmTxmZijEvCA.jpg',
    7: 'https://image.tmdb.org/t/p/w500/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg',
  },

  tmdbBackdrops: {
    1: 'https://image.tmdb.org/t/p/original/8ZTVqvKDQ8emSGUEMjsS4yHAwrp.jpg',
    2: 'https://image.tmdb.org/t/p/original/xJHokMbljXjADYdit5fK1B4Q2Nk.jpg',
    3: 'https://image.tmdb.org/t/p/original/jYEW5xZkZk2WTrdbMGAPFuBqbDc.jpg',
    4: 'https://image.tmdb.org/t/p/original/nMKdUUepR0i5zn0y1T4CsSB5ez.jpg',
    5: 'https://image.tmdb.org/t/p/original/o0s4XsEDfDlvit5pDRKjzXR4pp2.jpg',
    6: 'https://image.tmdb.org/t/p/original/k68nPLbIST6NP96JmTxmZijEvCA.jpg',
    7: 'https://image.tmdb.org/t/p/original/fNG7i7RqMErkcqhohV2a6cV1Ehy.jpg',
  },

  posterUrl(movie) {
    if (movie && movie.Image_URL) return movie.Image_URL;
    if (movie && this.tmdbPosters[movie.Movie_ID]) return this.tmdbPosters[movie.Movie_ID];
    return '';
  },

  backdropUrl(movie) {
    if (movie && movie.Image_URL) return movie.Image_URL;
    if (movie && this.tmdbBackdrops[movie.Movie_ID]) return this.tmdbBackdrops[movie.Movie_ID];
    return '';
  },

  // ─── Movie Card (fixed hover panel) ───────────────────────────
  movieCard(movie) {
    const avgRating = movie.avg_rating ? parseFloat(movie.avg_rating).toFixed(1) : 'N/A';
    const isHighRated = parseFloat(movie.avg_rating) >= 9;
    const posterSrc = this.posterUrl(movie);
    const gradientBg = this.posterGradients[(movie.Movie_ID - 1) % this.posterGradients.length];

    return `
      <div class="movie-card fade-in" id="movie-card-${movie.Movie_ID}" onclick="location.hash='#/movie/${movie.Movie_ID}'">
        <div class="movie-card__inner">
          <!-- Front -->
          <div class="movie-card__front">
            ${isHighRated ? '<div class="integrity-badge">★ VERIFIED</div>' : ''}
            <div class="movie-card__poster" style="background: ${gradientBg};">
              ${posterSrc ? `<img src="${posterSrc}" alt="${this.escapeHtml(movie.Title)}" loading="lazy"
                style="width:100%;height:100%;object-fit:cover;position:absolute;top:0;left:0;"
                onerror="this.style.display='none'">` : ''}
            </div>
            <div class="movie-card__info-overlay">
              <div class="movie-card__title">${this.escapeHtml(movie.Title)}</div>
              <div class="movie-card__meta">
                <span class="movie-card__rating">★ ${avgRating}</span>
                <span>${movie.Release_year}</span>
                <span>${movie.Duration}m</span>
              </div>
              <div class="movie-card__genres">${movie.genres || ''}</div>
            </div>
          </div>

          <!-- Back -->
          <div class="movie-card__back">
            <div class="movie-card__hover-title">${this.escapeHtml(movie.Title)}</div>
            <div class="movie-card__hover-meta">
              <span>⏱ ${movie.Duration}m</span>
              <span>★ ${avgRating}</span>
              <span>${movie.Release_year}</span>
            </div>
            <div class="movie-card__hover-genres">${movie.genres || ''}</div>
            <div class="movie-card__hover-desc">${(movie.Description || '').substring(0, 100)}${movie.Description && movie.Description.length > 100 ? '…' : ''}</div>
            <div class="movie-card__hover-actions">
              <button class="btn btn--primary btn--sm" onclick="event.stopPropagation();location.hash='#/movie/${movie.Movie_ID}'">VIEW DETAILS</button>
              <button class="btn btn--outline btn--sm" onclick="event.stopPropagation();components.goToMovieThread(${movie.Movie_ID})">💬 DISCUSS</button>
            </div>
          </div>
        </div>
      </div>`;
  },

  async goToMovieThread(movieId) {
    try {
      const data = await api.getMovieThread(movieId);
      location.hash = `#/forum/${data.threadId}`;
    } catch (e) {
      location.hash = `#/movie/${movieId}`;
    }
  },

  // ─── Section header ────────────────────────────────────────────
  sectionHeader(title, linkText, linkHref) {
    return `
      <div class="section-header">
        <h2 class="section-header__title">${title}</h2>
        <div class="section-header__line"></div>
        ${linkText ? `<a href="${linkHref}" class="btn btn--ghost">${linkText} →</a>` : ''}
      </div>`;
  },

  // ─── Thread item (forum list) ─────────────────────────────────
  threadItem(thread) {
    const isMovieThread = !!thread.movie_title;
    const title = isMovieThread
      ? `🎬 ${thread.movie_title}`
      : `🏷 ${thread.Genre_name} Genre`;
    const lastActivity = thread.last_activity
      ? this.timeAgo(new Date(thread.last_activity))
      : 'No posts yet';
    const posterSrc = thread.movie_image || '';

    return `
      <div class="thread-item" onclick="location.hash='#/forum/${thread.Thread_ID}'" id="thread-${thread.Thread_ID}">
        <div class="thread-item__thumb ${posterSrc ? '' : 'thread-item__thumb--genre'}">
          ${posterSrc
            ? `<img src="${posterSrc}" alt="" onerror="this.parentElement.classList.add('thread-item__thumb--genre');this.remove();">`
            : '<span>GENRE</span>'}
        </div>
        <div class="thread-item__body">
          <div class="thread-item__header">
            <span class="thread-item__title">${title}</span>
            <span class="thread-item__status ${thread.Status === 'OPEN' ? '' : 'closed'}">${thread.Status}</span>
          </div>
          <div class="thread-item__meta">
            <span class="trending-badge">💬 ${thread.post_count || 0} posts</span>
            <span>👥 ${thread.active_users || 0} users</span>
            <span>🕐 ${lastActivity}</span>
            <span>📍 ${isMovieThread ? 'Movie' : 'Genre'}</span>
          </div>
        </div>
      </div>`;
  },

  // ─── Reddit-style post item ───────────────────────────────────
  postItem(post, depth = 0) {
    const initial = (post.user_name || '?')[0].toUpperCase();
    const timeStr = this.timeAgo(new Date(post.Created_at));
    const isOwnPost = api.isLoggedIn() && api.user && (String(api.user.id) === String(post.User_ID));
    const isAdmin = api.isAdmin();
    const canDelete = isOwnPost || isAdmin;
    const indent = Math.min(depth, 4) * 20;

    const repliesHtml = post.replies && post.replies.length > 0
      ? `<div class="post__replies">${post.replies.map(r => this.postItem(r, depth + 1)).join('')}</div>`
      : '';

    return `
      <div class="post fade-in" style="margin-left:${indent}px" id="post-${post.Post_ID}">
        <div class="post__header">
          <div class="post__avatar">${initial}</div>
          <span class="post__author">${this.escapeHtml(post.user_name)}</span>
          <span class="post__time">· ${timeStr}</span>
          ${depth > 0 ? `<span class="post__depth-badge">↳ reply</span>` : ''}
        </div>
        <div class="post__content">${this.escapeHtml(post.Content)}</div>
        <div class="post__actions">
          ${api.isLoggedIn() ? `<button class="post__action-btn" onclick="threadPage.openReply(${post.Post_ID})">↩ Reply</button>` : ''}
          ${canDelete ? `<button class="post__action-btn post__action-btn--danger" onclick="threadPage.deletePost(${post.Post_ID})">🗑 Delete</button>` : ''}
        </div>
        <div class="post__reply-box" id="reply-box-${post.Post_ID}" style="display:none;">
          <textarea class="textarea" style="min-height:70px;margin-top:8px;" id="reply-input-${post.Post_ID}" placeholder="Write a reply..."></textarea>
          <div style="display:flex;gap:8px;margin-top:6px;">
            <button class="btn btn--primary btn--sm" onclick="threadPage.submitReply(${post.Post_ID})">POST REPLY</button>
            <button class="btn btn--ghost btn--sm" onclick="threadPage.closeReply(${post.Post_ID})">Cancel</button>
          </div>
        </div>
        ${repliesHtml}
      </div>`;
  },

  // ─── Review card ──────────────────────────────────────────────
  reviewCard(review) {
    const initial = (review.user_name || '?')[0].toUpperCase();
    const isOwnReview = api.isLoggedIn() && api.user && (String(api.user.id) === String(review.User_ID));
    return `
      <div class="review-card fade-in" id="review-${review.Review_ID}">
        <div class="review-card__header">
          <div class="post__avatar">${initial}</div>
          <div>
            <div class="post__author">${this.escapeHtml(review.user_name)}</div>
            <div class="review-card__date">${this.timeAgo(new Date(review.Created_at))}</div>
          </div>
          ${isOwnReview ? `<button class="post__action-btn post__action-btn--danger" style="margin-left:auto;" onclick="movieDetailPage.deleteReview(${review.Review_ID})">🗑</button>` : ''}
        </div>
        <div class="review-card__text">${this.escapeHtml(review.Review_text)}</div>
      </div>`;
  },

  // ─── Star rating ──────────────────────────────────────────────
  starRating(current = 0, interactive = false, movieId = null) {
    let html = '<div class="star-rating">';
    for (let i = 1; i <= 10; i++) {
      const filled = i <= current ? 'filled' : '';
      const click = interactive && movieId ? `onclick="app.rateMovie(${movieId}, ${i})"` : '';
      const hover = interactive
        ? `onmouseenter="components.hoverStars(this, ${i})" onmouseleave="components.unhoverStars(this, ${current})"`
        : '';
      html += `<span class="star-rating__star ${filled}" ${click} ${hover}>★</span>`;
    }
    html += '</div>';
    return html;
  },

  hoverStars(el, rating) {
    el.parentElement.querySelectorAll('.star-rating__star').forEach((s, i) => s.classList.toggle('filled', i < rating));
  },
  unhoverStars(el, current) {
    el.parentElement.querySelectorAll('.star-rating__star').forEach((s, i) => s.classList.toggle('filled', i < current));
  },

  // ─── Stat card ────────────────────────────────────────────────
  statCard(value, label) {
    return `
      <div class="stat-card fade-in">
        <div class="stat-card__value">${value}</div>
        <div class="stat-card__label">${label}</div>
      </div>`;
  },

  barChart(title, data, maxVal) {
    const bars = data.map(d => {
      const pct = maxVal > 0 ? (d.value / maxVal * 100) : 0;
      return `
        <div class="chart-bar">
          <span class="chart-bar__label">${d.label}</span>
          <div style="flex:1;background:var(--bg-dark);border-radius:var(--radius-sm);overflow:hidden;">
            <div class="chart-bar__fill" style="width:${pct}%"></div>
          </div>
          <span class="chart-bar__value">${d.value}</span>
        </div>`;
    }).join('');
    return `<div class="chart-container"><div class="chart-container__title">${title}</div>${bars}</div>`;
  },

  // ─── Watchlist picker modal ───────────────────────────────────
  showWatchlistModal(movieId, watchlists) {
    const existing = document.getElementById('wl-picker-modal');
    if (existing) existing.remove();

    const listHtml = watchlists.length > 0
      ? watchlists.map(wl => `
          <div class="wl-picker-item" onclick="components.pickWatchlist(${wl.Watchlist_ID}, ${movieId}, '${this.escapeHtml(wl.Watchlist_name)}')">
            <span>📁 ${this.escapeHtml(wl.Watchlist_name)}</span>
            <span class="watchlist-card__count">${wl.item_count} movies</span>
          </div>`).join('')
      : '<p class="text-muted" style="padding:16px 0;">No watchlists yet.</p>';

    const modal = document.createElement('div');
    modal.id = 'wl-picker-modal';
    modal.className = 'modal-overlay';
    modal.style.display = 'flex';
    modal.innerHTML = `
      <div class="modal" style="max-width:400px;width:90%;">
        <button class="modal__close" onclick="document.getElementById('wl-picker-modal').remove()">×</button>
        <h2 class="modal__title" style="font-size:16px;">ADD TO WATCHLIST</h2>
        <div style="margin-bottom:16px;">
          ${listHtml}
        </div>
        <div style="border-top:1px solid var(--border-color);padding-top:16px;">
          <p style="font-size:12px;color:var(--text-muted);margin-bottom:8px;">OR CREATE NEW</p>
          <div style="display:flex;gap:8px;">
            <input type="text" class="input" id="wl-new-name-modal" placeholder="New watchlist name..." style="flex:1;">
            <button class="btn btn--primary btn--sm" onclick="components.createAndAdd(${movieId})">CREATE</button>
          </div>
          <p id="wl-modal-msg" style="color:var(--success);font-size:13px;margin-top:8px;display:none;"></p>
        </div>
      </div>`;
    document.body.appendChild(modal);
  },

  async pickWatchlist(wlId, movieId, name) {
    try {
      await api.addToWatchlist(wlId, movieId);
      const msgEl = document.getElementById('wl-modal-msg');
      if (msgEl) { msgEl.textContent = `Added to "${name}"!`; msgEl.style.display = 'block'; }
      if (app && typeof app.showPopup === 'function') app.showPopup(`Added to "${name}"`, 'success');
      setTimeout(() => { const m = document.getElementById('wl-picker-modal'); if (m) m.remove(); }, 1500);
    } catch (e) {
      if (app && typeof app.showPopup === 'function') app.showPopup(e.error || 'This movie is already added to this watchlist.', 'error');
    }
  },

  async createAndAdd(movieId) {
    const nameEl = document.getElementById('wl-new-name-modal');
    const name = nameEl ? nameEl.value.trim() : '';
    if (!name) return;
    try {
      const wl = await api.createWatchlist(name);
      await api.addToWatchlist(wl.Watchlist_ID, movieId);
      const msgEl = document.getElementById('wl-modal-msg');
      if (msgEl) { msgEl.textContent = `Created and added to "${name}"!`; msgEl.style.display = 'block'; }
      if (app && typeof app.showPopup === 'function') app.showPopup(`Created "${name}" and added movie`, 'success');
      setTimeout(() => { const m = document.getElementById('wl-picker-modal'); if (m) m.remove(); }, 1500);
    } catch (e) {
      if (app && typeof app.showPopup === 'function') app.showPopup(e.error || 'Failed to create watchlist', 'error');
    }
  },

  // ─── Utilities ────────────────────────────────────────────────
  timeAgo(date) {
    const diff = Math.floor((new Date() - date) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return date.toLocaleDateString();
  },

  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }
};
