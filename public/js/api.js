// API utility for ReviewRoll
const API_BASE = '/api';

const api = {
  token: localStorage.getItem('rr_token') || null,
  user: JSON.parse(localStorage.getItem('rr_user') || 'null'),

  setAuth(token, user) {
    this.token = token;
    this.user = user;
    localStorage.setItem('rr_token', token);
    localStorage.setItem('rr_user', JSON.stringify(user));
  },

  clearAuth() {
    this.token = null;
    this.user = null;
    localStorage.removeItem('rr_token');
    localStorage.removeItem('rr_user');
  },

  isLoggedIn() { return !!this.token; },
  isAdmin() { return this.user && this.user.role === 'ADMIN'; },

  headers(json = true) {
    const h = {};
    if (json) h['Content-Type'] = 'application/json';
    if (this.token) h['Authorization'] = `Bearer ${this.token}`;
    return h;
  },

  async get(path) {
    const res = await fetch(`${API_BASE}${path}`, { headers: this.headers(false) });
    if (!res.ok) throw await res.json();
    return res.json();
  },

  async post(path, body) {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(body)
    });
    if (!res.ok) throw await res.json();
    return res.json();
  },

  async postForm(path, formData) {
    // For multipart/form-data (file upload) — no Content-Type header, browser sets it
    const headers = {};
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers,
      body: formData
    });
    if (!res.ok) throw await res.json();
    return res.json();
  },

  async patch(path, body) {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'PATCH',
      headers: this.headers(),
      body: JSON.stringify(body)
    });
    if (!res.ok) throw await res.json();
    return res.json();
  },

  async put(path, body = {}) {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'PUT',
      headers: this.headers(),
      body: JSON.stringify(body)
    });
    if (!res.ok) throw await res.json();
    return res.json();
  },

  async delete(path) {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'DELETE',
      headers: this.headers()
    });
    if (!res.ok) throw await res.json();
    return res.json();
  },

  // Auth
  login: (email, password) => api.post('/auth/login', { email, password }),
  register: (name, email, password) => api.post('/auth/register', { name, email, password }),
  getProfile: () => api.get('/auth/me'),

  // Movies
  getMovies: () => api.get('/movies'),
  getMovie: (id) => api.get(`/movies/${id}`),
  searchMovies: (q) => api.get(`/movies/search/${encodeURIComponent(q)}`),
  getMovieThread: (id) => api.get(`/movies/${id}/thread`),
  getPerson: (id) => api.get(`/people/${id}`),

  // Ratings
  rateMovie: (movieId, rating) => api.post(`/ratings/${movieId}`, { rating }),
  getMovieRatings: (movieId) => api.get(`/ratings/${movieId}`),

  // Reviews
  addReview: (movieId, text) => api.post(`/reviews/${movieId}`, { text }),
  getReviews: (movieId) => api.get(`/reviews/${movieId}`),
  deleteReview: (id) => api.delete(`/reviews/${id}`),

  // Watchlists
  getWatchlists: () => api.get('/watchlists'),
  getWatchlist: (id) => api.get(`/watchlists/${id}`),
  createWatchlist: (name) => api.post('/watchlists', { name }),
  addToWatchlist: (wlId, movieId) => api.post(`/watchlists/${wlId}/movies`, { movieId }),
  removeFromWatchlist: (wlId, movieId) => api.delete(`/watchlists/${wlId}/movies/${movieId}`),

  // Forum
  getThreads: () => api.get('/forum'),
  searchThreads: (q) => api.get(`/forum/search?q=${encodeURIComponent(q)}`),
  getThread: (id) => api.get(`/forum/${id}`),
  addPost: (threadId, content, parentPostId) => api.post(`/forum/${threadId}/posts`, { content, parentPostId }),
  deletePost: (postId) => api.delete(`/forum/posts/${postId}`),

  // Dashboard
  getDashboardStats: () => api.get('/dashboard/stats'),

  // Movie Requests
  submitMovieRequest: (title, year) => api.post('/requests', { title, year }),
  getMyRequests: () => api.get('/requests/my'),

  // Admin
  getAdminRequests: () => api.get('/admin/requests'),
  getAdminStats: () => api.get('/admin/stats'),
  getAdminUsers: () => api.get('/admin/users'),
  searchUsers: (q) => api.get(`/admin/users/search?q=${encodeURIComponent(q)}`),
  addMovie: (formData) => api.postForm('/admin/add-movie', formData),
  approveRequest: (id, formData) => api.postForm(`/admin/requests/${id}/approve`, formData),
  rejectRequest: (id) => api.delete(`/admin/requests/${id}`),
  promoteUser: (id) => api.put(`/admin/promote/${id}`),
  deleteUser: (id) => api.delete(`/admin/user/${id}`),
  adminDeleteThread: (threadId) => api.delete(`/admin/thread/${threadId}`),
  autoFetchMovie: (title) => api.post('/tmdb/auto-fetch', { title }),
  getWatchProviders: (movieId, region = 'US') => api.get(`/tmdb/watch-providers/${movieId}?region=${encodeURIComponent(region)}`),

  // Streaming (Community Embeds)
  getStreamingEmbed: (movieId, options = {}) => {
    const params = new URLSearchParams();
    if (options.provider) params.append('provider', options.provider);
    if (options.includeAll) params.append('includeAll', options.includeAll);
    return api.get(`/streaming/embed/${movieId}?${params}`);
  },
  getStreamingInfo: (movieId, region = 'US') => api.get(`/streaming/info/${movieId}?region=${encodeURIComponent(region)}`),
};
