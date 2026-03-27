// ReviewRoll — Main Application Entry
const app = {
  authMode: 'login',

  init() {
    // Setup routes
    router.add('/', renderHome);
    router.add('/movies', renderMovies);
    router.add('/movie/:id', renderMovieDetail);
    router.add('/actors/:id', renderActorDetail);
    router.add('/forum', renderForum);
    router.add('/forum/:id', renderThreadDetail);
    router.add('/watchlist', renderWatchlist);
    router.add('/request', renderMovieRequest);
    router.add('/admin', renderAdmin);
    router.add('/users', renderUserManagement);

    // Update auth UI
    this.updateAuthUI();

    // Hamburger menu
    const hamburger = document.getElementById('hamburger-btn');
    if (hamburger) {
      hamburger.addEventListener('click', () => {
        document.querySelector('.navbar__links').classList.toggle('open');
      });
    }

    // Start router
    router.init();
  },

  updateAuthUI() {
    const loginBtn = document.getElementById('btn-login');
    const registerBtn = document.getElementById('btn-register');
    const userInfo = document.getElementById('user-info');
    const userName = document.getElementById('user-display-name');
    const watchlistLink = document.getElementById('nav-watchlist');
    const requestLink = document.getElementById('nav-request');
    const adminLink = document.getElementById('nav-admin');
    const usersLink = document.getElementById('nav-users');

    if (api.isLoggedIn()) {
      if (loginBtn) loginBtn.style.display = 'none';
      if (registerBtn) registerBtn.style.display = 'none';
      if (userInfo) userInfo.style.display = 'flex';
      if (userName) userName.textContent = api.user.name;
      const isAdmin = api.user.role === 'ADMIN';
      if (watchlistLink) watchlistLink.style.display = isAdmin ? 'none' : '';
      if (requestLink) requestLink.style.display = isAdmin ? 'none' : '';
      if (adminLink) adminLink.style.display = isAdmin ? '' : 'none';
      if (usersLink) usersLink.style.display = isAdmin ? '' : 'none';
    } else {
      if (loginBtn) loginBtn.style.display = '';
      if (registerBtn) registerBtn.style.display = '';
      if (userInfo) userInfo.style.display = 'none';
      if (watchlistLink) watchlistLink.style.display = 'none';
      if (requestLink) requestLink.style.display = 'none';
      if (adminLink) adminLink.style.display = 'none';
      if (usersLink) usersLink.style.display = 'none';
    }
  },

  showAuthModal(mode) {
    this.authMode = mode;
    const modal = document.getElementById('auth-modal');
    const title = document.getElementById('auth-modal-title');
    const nameGroup = document.getElementById('auth-name-group');
    const switchText = document.getElementById('auth-switch');
    const errorEl = document.getElementById('auth-error');

    modal.style.display = 'flex';
    errorEl.style.display = 'none';

    if (mode === 'login') {
      title.textContent = 'LOGIN';
      nameGroup.style.display = 'none';
      switchText.innerHTML = 'Don\'t have an account? <a onclick="app.showAuthModal(\'register\')">Sign Up</a>';
    } else {
      title.textContent = 'SIGN UP';
      nameGroup.style.display = 'block';
      switchText.innerHTML = 'Already have an account? <a onclick="app.showAuthModal(\'login\')">Login</a>';
    }
  },

  closeAuthModal() {
    document.getElementById('auth-modal').style.display = 'none';
    document.getElementById('auth-form').reset();
  },

  async handleAuth(e) {
    e.preventDefault();
    const errorEl = document.getElementById('auth-error');
    errorEl.style.display = 'none';

    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;

    try {
      let result;
      if (this.authMode === 'login') {
        result = await api.login(email, password);
      } else {
        const name = document.getElementById('auth-name').value;
        if (!name) {
          errorEl.textContent = 'Name is required';
          errorEl.style.display = 'block';
          return;
        }
        result = await api.register(name, email, password);
      }

      api.setAuth(result.token, result.user);
      this.closeAuthModal();
      this.updateAuthUI();
      // Reload current page
      router.navigate(location.hash || '#/');
    } catch (err) {
      errorEl.textContent = err.error || 'Authentication failed';
      errorEl.style.display = 'block';
    }
  },

  logout() {
    api.clearAuth();
    this.updateAuthUI();
    location.hash = '#/';
    router.navigate('#/');
  },

  async rateMovie(movieId, rating) {
    if (!api.isLoggedIn()) {
      this.showAuthModal('login');
      return;
    }
    try {
      const result = await api.rateMovie(movieId, rating);
      // Update UI
      const avgEl = document.getElementById('detail-avg-rating');
      const countEl = document.getElementById('detail-rating-count');
      if (avgEl) avgEl.textContent = result.avg_rating;
      if (countEl) countEl.textContent = `${result.count} ratings`;
      // Update star visual
      components.unhoverStars(
        document.querySelector('.star-rating__star'),
        rating
      );
    } catch (err) {
      alert(err.error || 'Failed to rate movie');
    }
  },

  async addToWatchlistPrompt(movieId) {
    if (!api.isLoggedIn()) {
      this.showAuthModal('login');
      return;
    }
    try {
      const watchlists = await api.getWatchlists();
      // Add item_count for display
      components.showWatchlistModal(movieId, watchlists);
    } catch (err) {
      alert(err.error || 'Could not load watchlists');
    }
  }
};

// Boot
document.addEventListener('DOMContentLoaded', () => app.init());
