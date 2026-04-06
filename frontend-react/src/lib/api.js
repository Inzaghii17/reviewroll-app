import { apiBase } from './config';

function headers(withJson = true) {
  const token = localStorage.getItem('rr_flask_token');
  const result = {};
  if (withJson) result['Content-Type'] = 'application/json';
  if (token) result.Authorization = `Bearer ${token}`;
  return result;
}

async function request(path, options = {}) {
  const response = await fetch(`${apiBase}${path}`, options);
  let data;
  try {
    data = await response.json();
  } catch {
    data = { error: 'Unexpected response' };
  }

  if (!response.ok) {
    throw data;
  }

  return data;
}

export const api = {
  getMovies: () => request('/movies', { headers: headers(false) }),
  getMovie: (movieId) => request(`/movies/${movieId}`, { headers: headers(false) }),
  getThreads: () => request('/forum', { headers: headers(false) }),
  searchThreads: (query) => request(`/forum/search?q=${encodeURIComponent(query)}`, { headers: headers(false) }),
  getThread: (threadId) => request(`/forum/${threadId}`, { headers: headers(false) }),

  getWatchlists: () => request('/watchlists', { headers: headers(false) }),
  getWatchlist: (watchlistId) => request(`/watchlists/${watchlistId}`, { headers: headers(false) }),
  createWatchlist: (name) =>
    request('/watchlists', {
      method: 'POST',
      headers: headers(true),
      body: JSON.stringify({ name }),
    }),
  addToWatchlist: (watchlistId, movieId) =>
    request(`/watchlists/${watchlistId}/movies`, {
      method: 'POST',
      headers: headers(true),
      body: JSON.stringify({ movieId }),
    }),
  removeFromWatchlist: (watchlistId, movieId) =>
    request(`/watchlists/${watchlistId}/movies/${movieId}`, {
      method: 'DELETE',
      headers: headers(false),
    }),

  getAdminStats: () => request('/admin/stats', { headers: headers(false) }),
  getAdminRequests: () => request('/admin/requests', { headers: headers(false) }),
  approveRequest: (requestId, payload) =>
    request(`/admin/requests/${requestId}/approve`, {
      method: 'POST',
      headers: headers(true),
      body: JSON.stringify(payload),
    }),
  rejectRequest: (requestId) =>
    request(`/admin/requests/${requestId}`, {
      method: 'DELETE',
      headers: headers(false),
    }),

  submitMovieRequest: (title, year) =>
    request('/requests', {
      method: 'POST',
      headers: headers(true),
      body: JSON.stringify({ title, year }),
    }),
  getMyRequests: () => request('/requests/my', { headers: headers(false) }),

  rateMovie: (movieId, rating) =>
    request(`/ratings/${movieId}`, {
      method: 'POST',
      headers: headers(true),
      body: JSON.stringify({ rating }),
    }),
  getMovieRatings: (movieId) => request(`/ratings/${movieId}`, { headers: headers(false) }),

  addReview: (movieId, text) =>
    request(`/reviews/${movieId}`, {
      method: 'POST',
      headers: headers(true),
      body: JSON.stringify({ text }),
    }),
  getReviews: (movieId) => request(`/reviews/${movieId}`, { headers: headers(false) }),
  deleteReview: (reviewId) =>
    request(`/reviews/${reviewId}`, {
      method: 'DELETE',
      headers: headers(false),
    }),

  login: (email, password) =>
    request('/auth/login', {
      method: 'POST',
      headers: headers(true),
      body: JSON.stringify({ email, password }),
    }),

  register: (name, email, password) =>
    request('/auth/register', {
      method: 'POST',
      headers: headers(true),
      body: JSON.stringify({ name, email, password }),
    }),

  me: () => request('/auth/me', { headers: headers(false) }),
};
