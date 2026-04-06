// SPA Router for ReviewRoll
const router = {
  routes: {},
  currentRoute: null,

  add(path, handler) {
    this.routes[path] = handler;
  },

  async navigate(hash) {
    const loader = document.getElementById('integrity-loader');
    loader.classList.add('active');

    // Parse hash
    const cleanHash = hash.replace('#', '') || '/';
    const parts = cleanHash.split('/').filter(Boolean);

    let route = null;
    let params = {};

    // Match routes
    if (parts.length === 0 || cleanHash === '/') {
      route = '/';
    } else if (parts[0] === 'movies' && parts.length === 1) {
      route = '/movies';
    } else if (parts[0] === 'movie' && parts[1]) {
      route = '/movie/:id';
      params.id = parts[1];
    } else if (parts[0] === 'actors' && parts[1]) {
      route = '/actors/:id';
      params.id = parts[1];
    } else if (parts[0] === 'forum' && parts.length === 1) {
      route = '/forum';
    } else if (parts[0] === 'forum' && parts[1]) {
      route = '/forum/:id';
      params.id = parts[1];
    } else if (parts[0] === 'watchlist') {
      route = '/watchlist';
    } else if (parts[0] === 'request') {
      route = '/request';
    } else if (parts[0] === 'admin') {
      route = '/admin';
    } else if (parts[0] === 'users') {
      route = '/users';
    }

    this.currentRoute = route;
    this.updateNavActive(parts[0] || 'home');

    const handler = this.routes[route];
    const appEl = document.getElementById('app');

    if (handler) {
      try {
        await handler(appEl, params);
      } catch (err) {
        console.error('Route error:', err);
        appEl.innerHTML = `
          <div class="page"><div class="container">
            <div class="empty-state">
              <div class="empty-state__icon">⚠</div>
              <div class="empty-state__text">Something went wrong loading this page.</div>
              <p class="text-muted">${err.message || 'Unknown error'}</p>
            </div>
          </div></div>`;
      }
    } else {
      appEl.innerHTML = `
        <div class="page"><div class="container">
          <div class="empty-state">
            <div class="empty-state__icon">404</div>
            <div class="empty-state__text">Page not found</div>
            <a href="#/" class="btn btn--primary">BACK TO HUB</a>
          </div>
        </div></div>`;
    }

    // Remove loader
    setTimeout(() => {
      loader.classList.remove('active');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 600);
  },

  updateNavActive(page) {
    document.querySelectorAll('.navbar__link').forEach(link => {
      link.classList.toggle('active', link.dataset.page === page);
    });
  },

  init() {
    window.addEventListener('hashchange', () => {
      this.navigate(location.hash);
    });
    this.navigate(location.hash || '#/');
  }
};
