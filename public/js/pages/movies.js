// Movies Page — Browse All
async function renderMovies(container) {
  let movies = [];
  try {
    movies = await api.getMovies();
  } catch (e) {
    console.error('Failed to load movies:', e);
  }

  // Extract unique genres
  const allGenres = new Set();
  movies.forEach(m => {
    if (m.genres) m.genres.split(', ').forEach(g => allGenres.add(g));
  });

  const genreTags = ['All', ...Array.from(allGenres)].map(g =>
    `<button class="filter-tag ${g === 'All' ? 'active' : ''}" onclick="moviesPage.filterByGenre('${g}')">${g}</button>`
  ).join('');

  const movieCards = movies.map(m => components.movieCard(m)).join('');

  container.innerHTML = `
    <div class="page">
      <div class="container">
        <div class="page__header">
          <h1 class="page__title">MOVIES</h1>
          <p class="page__subtitle">Browse the complete database — ${movies.length} records indexed</p>
        </div>
        <div class="movies-toolbar">
          <input type="text" class="input" placeholder="Search movies..." id="movie-search" oninput="moviesPage.search(this.value)">
          <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;">
            <div class="filter-tags" id="genre-filters">${genreTags}</div>
            ${api.isAdmin() ? `<a href="#/admin" class="btn btn--primary btn--sm" style="white-space:nowrap;">+ ADD MOVIE</a>` : ''}
          </div>
        </div>
        <div class="grid grid--4" id="movies-grid">${movieCards}</div>
      </div>
    </div>
  `;

  moviesPage.allMovies = movies;
}

const moviesPage = {
  allMovies: [],
  activeGenre: 'All',

  filterByGenre(genre) {
    this.activeGenre = genre;
    document.querySelectorAll('.filter-tag').forEach(t =>
      t.classList.toggle('active', t.textContent === genre)
    );
    this.applyFilters();
  },

  search(query) {
    this.searchQuery = query.toLowerCase();
    this.applyFilters();
  },

  applyFilters() {
    let filtered = this.allMovies;
    if (this.activeGenre !== 'All') {
      filtered = filtered.filter(m => m.genres && m.genres.includes(this.activeGenre));
    }
    if (this.searchQuery) {
      filtered = filtered.filter(m =>
        m.Title.toLowerCase().includes(this.searchQuery)
      );
    }
    const grid = document.getElementById('movies-grid');
    if (grid) {
      grid.innerHTML = filtered.length > 0
        ? filtered.map(m => components.movieCard(m)).join('')
        : '<div class="empty-state"><div class="empty-state__icon">🔍</div><div class="empty-state__text">No movies found</div></div>';
    }
  }
};
