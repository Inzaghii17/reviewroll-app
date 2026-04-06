// Movie Detail Page — with Image_URL support + single discussion thread
async function renderMovieDetail(container, params) {
  const movieId = params.id;
  let movie;
  try {
    movie = await api.getMovie(movieId);
  } catch (e) {
    container.innerHTML = `<div class="page"><div class="container">
      <div class="empty-state"><div class="empty-state__icon">🎬</div>
      <div class="empty-state__text">Movie not found</div>
      <a href="#/movies" class="btn btn--primary">BROWSE MOVIES</a></div></div></div>`;
    return;
  }

  const backdrop = movie.Image_URL || components.tmdbBackdrops[movie.Movie_ID] || '';
  const poster = movie.Image_URL || components.tmdbPosters[movie.Movie_ID] || '';
  const avgRating = movie.avg_rating ? parseFloat(movie.avg_rating).toFixed(1) : 'N/A';
  const genres = movie.genres
    ? movie.genres.split(', ').map(g => `<span class="tag">${g}</span>`).join('')
    : '';
  const userRating = movie.userRating || 0;
  const isLoggedIn = api.isLoggedIn();
  const isAdmin = api.isAdmin();

  // Build reviews HTML
  const reviewsHtml = movie.reviews && movie.reviews.length > 0
    ? movie.reviews.map(r => components.reviewCard(r)).join('')
    : '<p class="text-muted">No reviews yet. Be the first!</p>';

  container.innerHTML = `
    <div class="movie-hero" style="${backdrop ? `background-image:url('${backdrop}');` : `background:${components.posterGradients[(movie.Movie_ID-1)%7]};`}">
      <div class="movie-hero__content">
        <div class="movie-hero__poster-wrap">
          ${poster
            ? `<img class="movie-hero__poster" src="${poster}" alt="${components.escapeHtml(movie.Title)}"
                onerror="this.style.background='${components.posterGradients[(movie.Movie_ID-1)%7]}';this.style.minHeight='360px';">`
            : `<div class="movie-hero__poster" style="background:${components.posterGradients[(movie.Movie_ID-1)%7]};min-height:360px;display:flex;align-items:center;justify-content:center;font-size:64px;">🎬</div>`}
        </div>
        <div class="movie-hero__info">
          <div class="movie-hero__genres">${genres}</div>
          <h1 class="movie-hero__title">${components.escapeHtml(movie.Title)}</h1>
          <div class="movie-hero__meta">
            <span>📅 ${movie.Release_year}</span>
            <span>⏱ ${movie.Duration} min</span>
            <span>🌐 ${movie.Language}</span>
            <span>★ ${avgRating} (${movie.rating_count || 0} ratings)</span>
          </div>
          <p class="movie-hero__desc">${movie.Description || ''}</p>
        </div>
      </div>
    </div>

    <div class="interaction-bar">
      <div class="interaction-bar__inner">
        <div class="interaction-bar__rating">
          <span class="interaction-bar__avg" id="detail-avg-rating">${avgRating}</span>
          <div>
            <div style="font-size:12px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;">Avg Rating</div>
            <div class="interaction-bar__count" id="detail-rating-count">${movie.rating_count || 0} ratings</div>
          </div>
        </div>
        <div class="interaction-bar__actions">
          ${isLoggedIn && !isAdmin ? `
            <div style="display:flex;align-items:center;gap:8px;">
              <span style="font-size:12px;color:var(--text-secondary);text-transform:uppercase;">Your Rating:</span>
              ${components.starRating(userRating, true, movie.Movie_ID)}
            </div>
            <button class="btn btn--blue btn--sm" onclick="app.addToWatchlistPrompt(${movie.Movie_ID})">+ WATCHLIST</button>
          ` : !isLoggedIn ? `
            <button class="btn btn--outline btn--sm" onclick="app.showAuthModal('login')">LOGIN TO RATE</button>
          ` : ''}
          <button class="btn btn--primary btn--sm" style="display:flex;align-items:center;gap:6px;background:var(--brand-main);color:white;text-decoration:none;" onclick="movieDetailPage.watchNow(${movie.Movie_ID}, '${components.escapeHtml(movie.Title)}')">
            <svg style="width:14px;height:14px;" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg> WATCH NOW
          </button>
          <button class="btn btn--outline btn--sm" onclick="movieDetailPage.goToDiscussion(${movie.Movie_ID})">💬 DISCUSSION</button>
        </div>
      </div>
    </div>

    <div class="section" style="background: var(--bg-dark); border-top: 1px solid var(--border-color);">
      <div class="container grid grid--3">
        <div style="grid-column: span 2;">
          <h2 style="font-family:var(--font-heading);font-size:20px;margin-bottom:16px;">TOP CAST</h2>
          <div class="cast-grid" style="display:flex;gap:24px;overflow-x:auto;padding-bottom:16px;">
            ${movie.cast && movie.cast.length > 0 ? movie.cast.map(c => `
              <div class="cast-member" style="flex-shrink:0;width:90px;" onclick="location.hash='#/actors/${c.Person_ID}'">
                <div class="cast-member__avatar" style="width:90px;height:90px;border-radius:50%;background-image:url('${c.Profile_Image_URL || ''}'); background-size:cover; background-position:center;border:2px solid var(--border-color);">
                  ${!c.Profile_Image_URL ? c.Name.charAt(0) : ''}
                </div>
                <div class="cast-member__name" style="margin-top:8px;font-size:12px;font-weight:600;white-space:normal;text-align:center;">${components.escapeHtml(c.Name)}</div>
                <div class="cast-member__role" style="font-size:11px;color:var(--brand-main);white-space:normal;text-align:center;">${components.escapeHtml(c.Character_name)}</div>
              </div>
            `).join('') : '<p class="text-muted" style="padding-left:16px;">No cast available.</p>'}
          </div>
          
          ${movie.Trailer_URL ? `
          <h2 style="font-family:var(--font-heading);font-size:20px;margin:32px 0 16px;">TRAILER</h2>
          <div style="position:relative;padding-bottom:56.25%;height:0;border-radius:var(--radius-lg);overflow:hidden;border:1px solid var(--glass-border);box-shadow:var(--shadow-card);">
            <iframe src="${movie.Trailer_URL}" style="position:absolute;top:0;left:0;width:100%;height:100%;border:none;" allowfullscreen></iframe>
          </div>
          ` : ''}
        </div>
        <div>
          <h2 style="font-family:var(--font-heading);font-size:20px;margin-bottom:16px;">DETAILS</h2>
          <div class="card" style="padding:24px;">
            <p style="margin-bottom:12px;font-size:14px;"><strong style="color:var(--text-secondary);text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:4px;font-size:11px;">Release Date</strong> <span style="font-weight:600;">${movie.Release_date ? new Date(movie.Release_date).toLocaleDateString() : 'N/A'}</span></p>
            <p style="margin-bottom:12px;font-size:14px;"><strong style="color:var(--text-secondary);text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:4px;font-size:11px;">Budget</strong> <span style="font-weight:600;">${movie.Budget ? '$'+movie.Budget.toLocaleString() : 'N/A'}</span></p>
            <p style="margin-bottom:12px;font-size:14px;"><strong style="color:var(--text-secondary);text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:4px;font-size:11px;">Box Office</strong> <span style="font-weight:600;">${movie.Revenue ? '$'+movie.Revenue.toLocaleString() : 'N/A'}</span></p>
            <p style="font-size:14px;"><strong style="color:var(--text-secondary);text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:4px;font-size:11px;">Trivia</strong> <span style="line-height:1.5;">${movie.Trivia || 'None'}</span></p>
          </div>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="container">
        <div class="tabs">
          <button class="tab active" onclick="movieDetailPage.switchTab(event,'reviews')">REVIEWS</button>
          <button class="tab" onclick="movieDetailPage.switchTab(event,'discussions')">DISCUSSION</button>
        </div>

        <div class="tab-content active" id="tab-reviews">
          ${isLoggedIn ? `
            <div style="margin-bottom:var(--space-4);">
              <textarea class="textarea" id="review-text" placeholder="Write your review..."></textarea>
              <button class="btn btn--primary btn--sm" style="margin-top:var(--space-1);" onclick="movieDetailPage.submitReview(${movie.Movie_ID})">SUBMIT REVIEW</button>
              <p class="form-error" id="review-error" style="display:none;"></p>
            </div>
          ` : ''}
          <div id="reviews-list" style="display:grid;gap:var(--space-2);">${reviewsHtml}</div>
        </div>

        <div class="tab-content" id="tab-discussions">
          <div id="discussion-embed" style="margin-top:8px;">
            <p class="text-muted">Loading discussion thread...</p>
          </div>
        </div>
      </div>
    </div>`;

  // Pre-load discussion thread when tab clicked
  movieDetailPage._movieId = movie.Movie_ID;
  movieDetailPage._threadLoaded = false;
}

const movieDetailPage = {
  _movieId: null,
  _threadLoaded: false,

  async watchNow(movieId, movieTitle) {
    // Use embedded streaming player with fallback to legal providers
    streamingPlayer.show(movieId, movieTitle);
  },

  switchTab(e, name) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    e.target.classList.add('active');
    document.getElementById(`tab-${name}`).classList.add('active');
    if (name === 'discussions' && !this._threadLoaded) {
      this._threadLoaded = true;
      this.loadDiscussion(this._movieId);
    }
  },

  async loadDiscussion(movieId) {
    const embed = document.getElementById('discussion-embed');
    if (!embed) return;
    try {
      const data = await api.getMovieThread(movieId);
      const thread = await api.getThread(data.threadId);
      const isLoggedIn = api.isLoggedIn();

      const postsHtml = thread.posts && thread.posts.length > 0
        ? thread.posts.map(p => components.postItem(p, 0)).join('')
        : '<p class="text-muted">No posts yet. Start the conversation!</p>';

      embed.innerHTML = `
        <div style="margin-bottom:20px;display:flex;justify-content:flex-end;">
          <a href="#/forum/${thread.Thread_ID}" class="btn btn--ghost btn--sm">Open Full Thread →</a>
        </div>
        ${isLoggedIn ? `
          <div style="margin-bottom:20px;">
            <textarea class="textarea" style="min-height:80px;" id="thread-new-post" placeholder="Start a new discussion..."></textarea>
            <button class="btn btn--primary btn--sm" style="margin-top:8px;" onclick="movieDetailPage.postToThread(${thread.Thread_ID})">POST</button>
          </div>` : ''}
        <div id="thread-posts-embed">${postsHtml}</div>`;
      // Update threadPage context
      threadPage.currentThreadId = thread.Thread_ID;
    } catch (e) {
      embed.innerHTML = '<p class="text-muted">Discussion thread not available yet.</p>';
    }
  },

  async postToThread(threadId) {
    const ta = document.getElementById('thread-new-post');
    const content = ta ? ta.value.trim() : '';
    if (!content) return;
    try {
      const post = await api.addPost(threadId, content, null);
      post.replies = [];
      const container = document.getElementById('thread-posts-embed');
      if (container) container.insertAdjacentHTML('afterbegin', components.postItem(post, 0));
      threadPage.currentThreadId = threadId;
      if (ta) ta.value = '';
    } catch (e) {
      alert(e.error || 'Failed to post');
    }
  },

  async goToDiscussion(movieId) {
    try {
      const data = await api.getMovieThread(movieId);
      location.hash = `#/forum/${data.threadId}`;
    } catch (e) {
      location.hash = `#/forum`;
    }
  },

  async submitReview(movieId) {
    const ta = document.getElementById('review-text');
    const errEl = document.getElementById('review-error');
    const text = ta ? ta.value.trim() : '';
    if (!text) return;
    errEl.style.display = 'none';
    try {
      const review = await api.addReview(movieId, text);
      if (ta) ta.value = '';
      const list = document.getElementById('reviews-list');
      list.insertAdjacentHTML('afterbegin', components.reviewCard(review));
    } catch (e) {
      errEl.textContent = e.error || 'Failed to submit review';
      errEl.style.display = 'block';
    }
  },

  async deleteReview(reviewId) {
    if (!confirm('Delete your review?')) return;
    try {
      await api.deleteReview(reviewId);
      const el = document.getElementById(`review-${reviewId}`);
      if (el) el.remove();
    } catch (e) {
      alert(e.error || 'Failed to delete review');
    }
  }
};
