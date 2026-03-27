// Home Page — The Hub
async function renderHome(container) {
  let movies = [];
  let threads = [];
  try {
    movies = await api.getMovies();
    threads = await api.getThreads();
  } catch (e) {
    console.error('Failed to load home data:', e);
  }

  const featured = movies.slice(0, 4);
  const trending = [...movies].sort((a,b) => b.Movie_ID - a.Movie_ID).slice(0, 4);
  const topRated = [...movies].sort((a,b) => b.avg_rating - a.avg_rating).slice(0, 4);
  const topGrossing = [...movies].sort((a,b) => b.Revenue - a.Revenue).slice(0, 4);

  const heroSlides = featured.map((m, i) => {
    const bg = components.backdropUrl(m.Movie_ID) || m.Image_URL;
    const grad = components.posterGradients[(m.Movie_ID - 1) % components.posterGradients.length];
    return `<div class="hero__slide ${i === 0 ? 'active' : ''}"
      style="background-image: url('${bg}'); background-color: #0a0a0a;">
    </div>`;
  }).join('');

  const heroDots = featured.map((_, i) =>
    `<button class="hero__dot ${i === 0 ? 'active' : ''}" onclick="homePage.goToSlide(${i})"></button>`
  ).join('');

  const heroContent = `
    <div class="hero__content" id="hero-content">
      <div class="hero__tag">★ FEATURED FILM</div>
      <h1 class="hero__title" id="hero-title">${featured[0]?.Title || 'REVIEWROLL'}</h1>
      <p class="hero__desc" id="hero-desc">${(featured[0]?.Description || 'Your Digital Entertainment Hub').substring(0, 150)}...</p>
      <div class="hero__actions">
        <button class="btn btn--primary" id="hero-view-btn" onclick="location.hash='#/movie/${featured[0]?.Movie_ID || 1}'">VIEW DETAILS</button>
        <button class="btn btn--outline" onclick="location.hash='#/movies'">BROWSE ALL</button>
      </div>
    </div>`;

  const threadItems = threads.slice(0, 6).map(t => `
    <div style="min-width:320px;max-width:360px;">
      ${components.threadItem(t)}
    </div>
  `).join('');

  container.innerHTML = `
    <div class="hero">
      <div class="hero__slider" id="hero-slider">${heroSlides}</div>
      ${heroContent}
      <div class="hero__dots" id="hero-dots">${heroDots}</div>
    </div>

    <div class="section">
      <div class="container">
        ${components.sectionHeader('TRENDING NOW', 'View All', '#/movies')}
        <div class="grid grid--4">${trending.map(m => components.movieCard(m)).join('')}</div>
      </div>
    </div>

    <div class="section" style="background:var(--surface-elevated);border-top:1px solid var(--border-color);border-bottom:1px solid var(--border-color);">
      <div class="container">
        ${components.sectionHeader('TOP RATED', '', '')}
        <div class="grid grid--4">${topRated.map(m => components.movieCard(m)).join('')}</div>
      </div>
    </div>

    <div class="section">
      <div class="container">
        ${components.sectionHeader('TOP GROSSING BOX OFFICE', '', '')}
        <div class="grid grid--4">${topGrossing.map(m => components.movieCard(m)).join('')}</div>
      </div>
    </div>

    <div class="section" style="background:var(--bg-dark);border-top:1px solid var(--border-color);border-bottom:1px solid var(--border-color);">
      <div class="container">
        ${components.sectionHeader('COMMUNITY PULSE', 'All Threads', '#/forum')}
        <div class="hscroll">${threadItems || '<p class="text-muted">No discussions yet.</p>'}</div>
      </div>
    </div>
  `;

  // Init slider
  homePage.currentSlide = 0;
  homePage.featured = featured;
  homePage.startAutoSlide();
}

const homePage = {
  currentSlide: 0,
  featured: [],
  timer: null,

  goToSlide(idx) {
    this.currentSlide = idx;
    const slides = document.querySelectorAll('.hero__slide');
    const dots = document.querySelectorAll('.hero__dot');
    slides.forEach((s, i) => s.classList.toggle('active', i === idx));
    dots.forEach((d, i) => d.classList.toggle('active', i === idx));

    const movie = this.featured[idx];
    if (movie) {
      document.getElementById('hero-title').textContent = movie.Title;
      document.getElementById('hero-desc').textContent = movie.Description || '';
      const viewBtn = document.getElementById('hero-view-btn');
      if (viewBtn) viewBtn.onclick = () => location.hash = `#/movie/${movie.Movie_ID}`;
    }
  },

  startAutoSlide() {
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => {
      const next = (this.currentSlide + 1) % (this.featured.length || 1);
      this.goToSlide(next);
    }, 5000);
  }
};
