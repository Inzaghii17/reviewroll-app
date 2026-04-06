import { useEffect, useMemo, useState } from 'react';
import { Link, Route, Routes, useParams } from 'react-router-dom';
import { apiBase } from './lib/config';
import { api } from './lib/api';

function AuthPanel({ user, onLogin, onRegister, onLogout, busy, error }) {
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  if (user) {
    return (
      <section className="panel auth-panel">
        <h2>Signed In</h2>
        <p>Welcome, <strong>{user.name}</strong> ({user.role})</p>
        <button className="btn" onClick={onLogout}>Logout</button>
      </section>
    );
  }

  const submit = async (event) => {
    event.preventDefault();
    if (mode === 'login') {
      await onLogin(email, password);
      return;
    }
    await onRegister(name, email, password);
  };

  return (
    <section className="panel auth-panel">
      <h2>{mode === 'login' ? 'Login' : 'Create Account'}</h2>
      <form onSubmit={submit} className="auth-form">
        {mode === 'register' && (
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" required />
        )}
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required />
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" required />
        <button className="btn" type="submit" disabled={busy}>
          {busy ? 'Please wait...' : mode === 'login' ? 'Login' : 'Register'}
        </button>
      </form>
      <button className="linkish" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
        {mode === 'login' ? 'Need an account? Register' : 'Have an account? Login'}
      </button>
      {error && <p className="error">{error}</p>}
    </section>
  );
}

function Home({ movies, loading, error, showPopup }) {
  return (
    <section className="panel">
      <h2>Home (Flask + React)</h2>
      <p>Connected to Flask auth and movies API.</p>
      {loading && <p>Loading movies...</p>}
      {error && <p className="error">{error}</p>}
      {!loading && !error && (
        <div className="movie-grid">
          {movies.map((movie) => (
            <article key={movie.Movie_ID} className="movie-card">
              <h3>
                <Link className="movie-link" to={`/movies/${movie.Movie_ID}`}>{movie.Title}</Link>
              </h3>
              <p>{movie.Release_year} • {movie.Duration}m</p>
              <p>Rating: {movie.avg_rating ?? 'N/A'} ({movie.rating_count ?? 0})</p>
              <p className="muted">{movie.genres || 'No genres'}</p>
              <p><Link className="inline-link" to={`/movies/${movie.Movie_ID}`}>View details</Link></p>
              <button className="btn btn-ghost" onClick={() => showPopup('Use movie detail page to add to watchlist.', 'info')}>Add to Watchlist</button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function MovieDetail({ user, showPopup }) {
  const { id } = useParams();
  const [movie, setMovie] = useState(null);
  const [ratingValue, setRatingValue] = useState('');
  const [reviewText, setReviewText] = useState('');
  const [watchlists, setWatchlists] = useState([]);
  const [selectedWatchlist, setSelectedWatchlist] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadMovie() {
      setLoading(true);
      setError('');
      try {
        const [movieData, watchlistData] = await Promise.all([
          api.getMovie(id),
          user && user.role !== 'ADMIN' ? api.getWatchlists() : Promise.resolve([]),
        ]);
        setMovie(movieData);
        setWatchlists(watchlistData);
        if (watchlistData.length) setSelectedWatchlist(String(watchlistData[0].Watchlist_ID));
      } catch (err) {
        setError(err.error || 'Failed to load movie detail');
      } finally {
        setLoading(false);
      }
    }
    loadMovie();
  }, [id, user]);

  const addToWatchlist = async () => {
    if (!selectedWatchlist) {
      showPopup('Create a watchlist first.', 'error');
      return;
    }
    try {
      await api.addToWatchlist(Number(selectedWatchlist), Number(id));
      showPopup('Movie added to watchlist.', 'success');
    } catch (err) {
      showPopup(err.error || 'Failed to add movie to watchlist.', 'error');
    }
  };

  const submitRating = async () => {
    if (!user) {
      showPopup('Login required to rate movies.', 'error');
      return;
    }
    const numeric = Number(ratingValue);
    if (!Number.isInteger(numeric) || numeric < 1 || numeric > 10) {
      showPopup('Rating must be between 1 and 10.', 'error');
      return;
    }
    try {
      const result = await api.rateMovie(Number(id), numeric);
      setMovie((prev) => prev ? { ...prev, avg_rating: result.avg_rating, rating_count: result.count } : prev);
      setRatingValue('');
      showPopup('Rating saved.', 'success');
    } catch (err) {
      showPopup(err.error || 'Failed to save rating.', 'error');
    }
  };

  const submitReview = async () => {
    if (!user) {
      showPopup('Login required to post review.', 'error');
      return;
    }
    const value = reviewText.trim();
    if (!value) {
      showPopup('Review text is required.', 'error');
      return;
    }
    try {
      const review = await api.addReview(Number(id), value);
      setMovie((prev) => prev ? { ...prev, reviews: [review, ...(prev.reviews || [])] } : prev);
      setReviewText('');
      showPopup('Review posted.', 'success');
    } catch (err) {
      showPopup(err.error || 'Failed to post review.', 'error');
    }
  };

  const deleteReview = async (reviewId) => {
    try {
      await api.deleteReview(reviewId);
      setMovie((prev) => prev ? { ...prev, reviews: (prev.reviews || []).filter((r) => r.Review_ID !== reviewId) } : prev);
      showPopup('Review deleted.', 'success');
    } catch (err) {
      showPopup(err.error || 'Failed to delete review.', 'error');
    }
  };

  if (loading) return <section className="panel"><p>Loading movie detail...</p></section>;
  if (error) return <section className="panel"><p className="error">{error}</p></section>;
  if (!movie) return <section className="panel"><p className="error">Movie not found</p></section>;

  return (
    <section className="panel detail-panel">
      <p><Link className="inline-link" to="/movies">Back to movies</Link></p>
      <h2>{movie.Title}</h2>
      <p>{movie.Release_year} • {movie.Duration}m • {movie.Language || 'Unknown'}</p>
      <p>Average rating: {movie.avg_rating ?? 'N/A'} ({movie.rating_count ?? 0} ratings)</p>
      <p className="muted">Genres: {movie.genres || 'No genres'}</p>
      <p>{movie.Description || 'No description.'}</p>

      <div className="movie-actions">
        <div className="movie-action-box">
          <h3>Rate Movie</h3>
          <div className="inline-form">
            <input
              type="number"
              min="1"
              max="10"
              value={ratingValue}
              onChange={(e) => setRatingValue(e.target.value)}
              placeholder="1-10"
            />
            <button className="btn" onClick={submitRating}>Submit Rating</button>
          </div>
        </div>
        <div className="movie-action-box">
          <h3>Write Review</h3>
          <textarea value={reviewText} onChange={(e) => setReviewText(e.target.value)} placeholder="Share your thoughts..." />
          <button className="btn" onClick={submitReview}>Submit Review</button>
        </div>
      </div>

      {user && user.role !== 'ADMIN' && (
        <div className="watchlist-inline">
          <select value={selectedWatchlist} onChange={(e) => setSelectedWatchlist(e.target.value)}>
            {watchlists.length ? watchlists.map((wl) => (
              <option key={wl.Watchlist_ID} value={wl.Watchlist_ID}>{wl.Watchlist_name}</option>
            )) : <option value="">No watchlists</option>}
          </select>
          <button className="btn" onClick={addToWatchlist}>Add To Watchlist</button>
        </div>
      )}

      <div className="detail-columns">
        <div>
          <h3>Cast ({movie.cast?.length || 0})</h3>
          <ul>
            {(movie.cast || []).slice(0, 8).map((item) => (
              <li key={`${item.Person_ID}-${item.Cast_order}`}>{item.Name} {item.Character_name ? `as ${item.Character_name}` : ''}</li>
            ))}
          </ul>
        </div>
        <div>
          <h3>Recent Reviews ({movie.reviews?.length || 0})</h3>
          <ul>
            {(movie.reviews || []).slice(0, 5).map((review) => (
              <li key={review.Review_ID}>
                <span>{review.user_name}: {review.Review_text}</span>
                {user && (String(user.id) === String(review.User_ID) || user.role === 'ADMIN') && (
                  <button className="btn btn-danger" onClick={() => deleteReview(review.Review_ID)}>Delete</button>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function RequestPage({ user, showPopup }) {
  const [title, setTitle] = useState('');
  const [year, setYear] = useState('');
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadMyRequests = async () => {
    if (!user || user.role === 'ADMIN') {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await api.getMyRequests();
      setRequests(data);
    } catch (err) {
      setError(err.error || 'Failed to load your requests.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadMyRequests(); }, [user]);

  const submit = async (event) => {
    event.preventDefault();
    if (!title.trim() || !year) {
      showPopup('Movie title and release year are required.', 'error');
      return;
    }
    try {
      const result = await api.submitMovieRequest(title.trim(), Number(year));
      showPopup(result.message || 'Request submitted.', 'success');
      setTitle('');
      setYear('');
      loadMyRequests();
    } catch (err) {
      showPopup(err.error || 'Failed to submit request.', 'error');
    }
  };

  if (!user) return <section className="panel"><p>Please login to request movies.</p></section>;
  if (user.role === 'ADMIN') return <section className="panel"><p>Movie requests are for USER accounts.</p></section>;

  return (
    <section className="panel">
      <h2>Request A Movie</h2>
      <form className="request-form" onSubmit={submit}>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Movie title" required />
        <input type="number" min="1900" max="2100" value={year} onChange={(e) => setYear(e.target.value)} placeholder="Release year" required />
        <button className="btn" type="submit">Submit Request</button>
      </form>

      {loading && <p>Loading requests...</p>}
      {error && <p className="error">{error}</p>}

      {!loading && !error && (
        <div className="request-list">
          <h3 className="section-label">My Requests</h3>
          {requests.length ? (
            <ul>
              {requests.map((item) => (
                <li key={item.Request_ID}>{item.Requested_title} ({item.Release_year})</li>
              ))}
            </ul>
          ) : <p className="muted">No requests submitted yet.</p>}
        </div>
      )}
    </section>
  );
}

function threadScore(thread) {
  const posts = Number(thread.post_count || 0);
  const activeUsers = Number(thread.active_users || 0);
  const recentMs = thread.last_activity ? Date.now() - new Date(thread.last_activity).getTime() : Number.POSITIVE_INFINITY;
  const recencyBoost = Number.isFinite(recentMs) ? Math.max(0, 72 - Math.floor(recentMs / (1000 * 60 * 60))) : 0;
  return (posts * 5) + (activeUsers * 2) + recencyBoost;
}

function ForumThreadCard({ thread }) {
  const title = thread.movie_title ? `🎬 ${thread.movie_title}` : `🏷 ${thread.Genre_name} Genre`;
  return (
    <article className="forum-thread-card">
      <h3><Link className="movie-link" to={`/forum/${thread.Thread_ID}`}>{title}</Link></h3>
      <p className="muted">{thread.Status} • {thread.post_count || 0} posts • {thread.active_users || 0} users</p>
    </article>
  );
}

function ForumPage() {
  const [threads, setThreads] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadThreads = async (q = '') => {
    setLoading(true);
    setError('');
    try {
      const data = q.trim() ? await api.searchThreads(q.trim()) : await api.getThreads();
      setThreads(data);
    } catch (err) {
      setError(err.error || 'Failed to load forum threads');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadThreads(); }, []);

  const movieThreads = threads.filter((thread) => thread.movie_title).sort((a, b) => threadScore(b) - threadScore(a));
  const topMovieThreads = movieThreads.slice(0, 8);
  const genreThreads = threads.filter((thread) => thread.Genre_name).sort((a, b) => threadScore(b) - threadScore(a));

  return (
    <section className="panel">
      <h2>Forum</h2>
      <p>Trending movie threads first, all genre threads below.</p>

      <form className="forum-search" onSubmit={(event) => { event.preventDefault(); loadThreads(query); }}>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search movie or genre threads" />
        <button className="btn" type="submit">Search</button>
        <button className="btn btn-secondary" type="button" onClick={() => { setQuery(''); loadThreads(''); }}>Reset</button>
      </form>

      {loading && <p>Loading threads...</p>}
      {error && <p className="error">{error}</p>}

      {!loading && !error && (
        <>
          <h3 className="section-label">Trending Movie Threads</h3>
          <div className="forum-grid">
            {topMovieThreads.length ? topMovieThreads.map((thread) => <ForumThreadCard key={thread.Thread_ID} thread={thread} />) : <p className="muted">No movie threads found.</p>}
          </div>
          {movieThreads.length > topMovieThreads.length && <p className="muted">Showing top {topMovieThreads.length} movie threads by activity and recency.</p>}

          <h3 className="section-label">All Genre Threads</h3>
          <div className="forum-grid">
            {genreThreads.length ? genreThreads.map((thread) => <ForumThreadCard key={thread.Thread_ID} thread={thread} />) : <p className="muted">No genre threads found.</p>}
          </div>
        </>
      )}
    </section>
  );
}

function ThreadDetailPage() {
  const { id } = useParams();
  const [thread, setThread] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadThread() {
      setLoading(true);
      setError('');
      try {
        const data = await api.getThread(id);
        setThread(data);
      } catch (err) {
        setError(err.error || 'Failed to load thread detail');
      } finally {
        setLoading(false);
      }
    }
    loadThread();
  }, [id]);

  if (loading) return <section className="panel"><p>Loading thread...</p></section>;
  if (error) return <section className="panel"><p className="error">{error}</p></section>;
  if (!thread) return <section className="panel"><p className="error">Thread not found</p></section>;

  return (
    <section className="panel detail-panel">
      <p><Link className="inline-link" to="/forum">Back to forum</Link></p>
      <h2>{thread.movie_title ? `🎬 ${thread.movie_title}` : `🏷 ${thread.Genre_name} Genre`}</h2>
      <p className="muted">Status: {thread.Status} • Posts: {thread.posts?.length || 0}</p>

      <h3 className="section-label">Posts</h3>
      {thread.posts?.length ? (
        <ul className="thread-posts">
          {thread.posts.map((post) => (<li key={post.Post_ID}><strong>{post.user_name}:</strong> {post.Content}</li>))}
        </ul>
      ) : <p className="muted">No posts yet.</p>}
    </section>
  );
}

function WatchlistPage({ user, showPopup }) {
  const [watchlists, setWatchlists] = useState([]);
  const [watchlistMovies, setWatchlistMovies] = useState({});
  const [newName, setNewName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    if (!user || user.role === 'ADMIN') {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await api.getWatchlists();
      setWatchlists(data);
    } catch (err) {
      setError(err.error || 'Failed to load watchlists');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [user]);

  const createList = async () => {
    if (!newName.trim()) {
      showPopup('Please enter a watchlist name.', 'error');
      return;
    }
    try {
      await api.createWatchlist(newName.trim());
      setNewName('');
      showPopup('Watchlist created.', 'success');
      load();
    } catch (err) {
      showPopup(err.error || 'Failed to create watchlist.', 'error');
    }
  };

  const loadMovies = async (watchlistId) => {
    try {
      const data = await api.getWatchlist(watchlistId);
      setWatchlistMovies((prev) => ({ ...prev, [watchlistId]: data.movies || [] }));
    } catch (err) {
      showPopup(err.error || 'Failed to load watchlist movies.', 'error');
    }
  };

  const removeMovie = async (watchlistId, movieId) => {
    try {
      await api.removeFromWatchlist(watchlistId, movieId);
      setWatchlistMovies((prev) => ({
        ...prev,
        [watchlistId]: (prev[watchlistId] || []).filter((m) => m.Movie_ID !== movieId),
      }));
      showPopup('Movie removed from watchlist.', 'success');
      load();
    } catch (err) {
      showPopup(err.error || 'Failed to remove movie.', 'error');
    }
  };

  if (!user) return <section className="panel"><p>Please login to use watchlists.</p></section>;
  if (user.role === 'ADMIN') return <section className="panel"><p>Watchlists are available for USER accounts.</p></section>;

  return (
    <section className="panel">
      <h2>My Watchlists</h2>
      <div className="watchlist-create">
        <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New watchlist name" />
        <button className="btn" onClick={createList}>Create</button>
      </div>

      {loading && <p>Loading watchlists...</p>}
      {error && <p className="error">{error}</p>}

      {!loading && !error && (
        <div className="watchlist-grid">
          {watchlists.length ? watchlists.map((wl) => (
            <article key={wl.Watchlist_ID} className="watchlist-card">
              <div className="watchlist-head">
                <h3>{wl.Watchlist_name}</h3>
                <span>{wl.item_count} movies</span>
              </div>
              <button className="btn btn-secondary" onClick={() => loadMovies(wl.Watchlist_ID)}>Load Movies</button>
              <ul>
                {(watchlistMovies[wl.Watchlist_ID] || []).map((movie) => (
                  <li key={movie.Movie_ID}>
                    <Link className="inline-link" to={`/movies/${movie.Movie_ID}`}>{movie.Title}</Link>
                    <button className="btn btn-danger" onClick={() => removeMovie(wl.Watchlist_ID, movie.Movie_ID)}>Remove</button>
                  </li>
                ))}
              </ul>
            </article>
          )) : <p className="muted">No watchlists yet.</p>}
        </div>
      )}
    </section>
  );
}

function AdminPage({ user, showPopup }) {
  const [stats, setStats] = useState(null);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    if (!user || user.role !== 'ADMIN') {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const [statsData, requestsData] = await Promise.all([api.getAdminStats(), api.getAdminRequests()]);
      setStats(statsData);
      setRequests(requestsData);
    } catch (err) {
      setError(err.error || 'Failed to load admin data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [user]);

  const approve = async (reqRow) => {
    try {
      const result = await api.approveRequest(reqRow.Request_ID, {
        title: reqRow.Requested_title,
        year: reqRow.Release_year,
        duration: 120,
        autoFetch: true,
      });
      showPopup(`${result.message}${result.source === 'tmdb+manual' ? ' (TMDB)' : ''}`, 'success');
      load();
    } catch (err) {
      showPopup(err.error || 'Approval failed', 'error');
    }
  };

  const reject = async (reqRow) => {
    try {
      const result = await api.rejectRequest(reqRow.Request_ID);
      showPopup(result.message || 'Request rejected.', 'info');
      load();
    } catch (err) {
      showPopup(err.error || 'Reject failed', 'error');
    }
  };

  if (!user) return <section className="panel"><p>Please login as admin.</p></section>;
  if (user.role !== 'ADMIN') return <section className="panel"><p>Admin access only.</p></section>;

  return (
    <section className="panel">
      <h2>Admin Panel</h2>
      {loading && <p>Loading admin data...</p>}
      {error && <p className="error">{error}</p>}

      {!loading && !error && (
        <>
          {stats && (
            <div className="admin-stats">
              <div><strong>{stats.total_users}</strong><span>Users</span></div>
              <div><strong>{stats.total_movies}</strong><span>Movies</span></div>
              <div><strong>{stats.pending_requests}</strong><span>Pending Requests</span></div>
              <div><strong>{stats.total_posts}</strong><span>Forum Posts</span></div>
            </div>
          )}

          <h3 className="section-label">Movie Requests</h3>
          <div className="admin-requests">
            {requests.length ? requests.map((reqRow) => (
              <article key={reqRow.Request_ID} className="admin-request-card">
                <div>
                  <h4>{reqRow.Requested_title} ({reqRow.Release_year})</h4>
                  <p className="muted">By {reqRow.user_name} • {reqRow.user_email}</p>
                </div>
                <div className="admin-actions">
                  <button className="btn" onClick={() => approve(reqRow)}>Approve + TMDB</button>
                  <button className="btn btn-danger" onClick={() => reject(reqRow)}>Reject</button>
                </div>
              </article>
            )) : <p className="muted">No pending requests.</p>}
          </div>
        </>
      )}
    </section>
  );
}

function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div className={`toast toast-${toast.type || 'info'}`}>
      <span>{toast.message}</span>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('rr_flask_user');
    return raw ? JSON.parse(raw) : null;
  });
  const [movies, setMovies] = useState([]);
  const [loadingMovies, setLoadingMovies] = useState(true);
  const [moviesError, setMoviesError] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState('');
  const [toast, setToast] = useState(null);

  const loggedIn = useMemo(() => Boolean(localStorage.getItem('rr_flask_token')), [user]);

  const showPopup = (message, type = 'info') => {
    setToast({ message, type });
    window.clearTimeout(window.__rrToastTimer);
    window.__rrToastTimer = window.setTimeout(() => setToast(null), 2800);
  };

  useEffect(() => {
    async function loadMovies() {
      setLoadingMovies(true);
      setMoviesError('');
      try {
        const data = await api.getMovies();
        setMovies(data);
      } catch (err) {
        setMoviesError(err.error || 'Failed to load movies from Flask API');
      } finally {
        setLoadingMovies(false);
      }
    }
    loadMovies();
  }, []);

  useEffect(() => {
    async function loadProfile() {
      if (!loggedIn) return;
      try {
        const me = await api.me();
        setUser(me);
        localStorage.setItem('rr_flask_user', JSON.stringify(me));
      } catch {
        localStorage.removeItem('rr_flask_token');
        localStorage.removeItem('rr_flask_user');
        setUser(null);
      }
    }
    loadProfile();
  }, [loggedIn]);

  const handleLogin = async (email, password) => {
    setAuthBusy(true);
    setAuthError('');
    try {
      const result = await api.login(email, password);
      localStorage.setItem('rr_flask_token', result.token);
      localStorage.setItem('rr_flask_user', JSON.stringify(result.user));
      setUser(result.user);
      showPopup('Logged in successfully.', 'success');
    } catch (err) {
      setAuthError(err.error || 'Login failed');
    } finally {
      setAuthBusy(false);
    }
  };

  const handleRegister = async (name, email, password) => {
    setAuthBusy(true);
    setAuthError('');
    try {
      const result = await api.register(name, email, password);
      localStorage.setItem('rr_flask_token', result.token);
      localStorage.setItem('rr_flask_user', JSON.stringify(result.user));
      setUser(result.user);
      showPopup('Account created successfully.', 'success');
    } catch (err) {
      setAuthError(err.error || 'Registration failed');
    } finally {
      setAuthBusy(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('rr_flask_token');
    localStorage.removeItem('rr_flask_user');
    setUser(null);
    showPopup('Logged out.', 'info');
  };

  return (
    <div className="app-shell">
      <div className="ambient ambient-a" />
      <div className="ambient ambient-b" />
      <header className="topbar">
        <h1>ReviewRoll React Migration</h1>
        <nav>
          <Link to="/">Home</Link>
          <Link to="/movies">Movies</Link>
          <Link to="/forum">Forum</Link>
          <Link to="/watchlist">Watchlist</Link>
          <Link to="/request">Request</Link>
          <Link to="/admin">Admin</Link>
        </nav>
      </header>

      <main className="content">
        <p className="api-note">API target: {apiBase}</p>
        <AuthPanel
          user={user}
          onLogin={handleLogin}
          onRegister={handleRegister}
          onLogout={handleLogout}
          busy={authBusy}
          error={authError}
        />
        <Routes>
          <Route path="/" element={<Home movies={movies} loading={loadingMovies} error={moviesError} showPopup={showPopup} />} />
          <Route path="/movies" element={<Home movies={movies} loading={loadingMovies} error={moviesError} showPopup={showPopup} />} />
          <Route path="/movies/:id" element={<MovieDetail user={user} showPopup={showPopup} />} />
          <Route path="/forum" element={<ForumPage />} />
          <Route path="/forum/:id" element={<ThreadDetailPage />} />
          <Route path="/watchlist" element={<WatchlistPage user={user} showPopup={showPopup} />} />
          <Route path="/request" element={<RequestPage user={user} showPopup={showPopup} />} />
          <Route path="/admin" element={<AdminPage user={user} showPopup={showPopup} />} />
        </Routes>
      </main>
      <Toast toast={toast} />
    </div>
  );
}
