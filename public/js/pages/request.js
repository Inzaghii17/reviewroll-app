// Movie Request Page — ReviewRoll
async function renderMovieRequest(container) {
  if (!api.isLoggedIn()) {
    container.innerHTML = `
      <div class="page"><div class="container">
        <div class="empty-state">
          <div class="empty-state__icon">🔒</div>
          <div class="empty-state__text">Login to request movies</div>
          <button class="btn btn--primary" onclick="app.showAuthModal('login')">LOGIN</button>
        </div>
      </div></div>`;
    return;
  }

  let myRequests = [];
  try { myRequests = await api.getMyRequests(); } catch (_) {}

  container.innerHTML = `
    <div class="page">
      <div class="page__hero">
        <div class="container">
          <h1 class="page__hero-title">REQUEST A MOVIE</h1>
          <p class="page__hero-sub">Can't find a movie? Ask us to add it.</p>
        </div>
      </div>
      <div class="container" style="max-width:700px;padding-top:48px;">

        <div class="card" style="margin-bottom:40px;">
          <h2 style="font-family:var(--font-heading);font-size:18px;letter-spacing:2px;margin-bottom:24px;">SUBMIT REQUEST</h2>
          <form id="request-form" onsubmit="movieRequestPage.submitRequest(event)">
            <div class="form-group">
              <label for="req-title">MOVIE TITLE</label>
              <input type="text" id="req-title" class="input" placeholder="e.g. Oppenheimer" required>
            </div>
            <div class="form-group">
              <label for="req-year">RELEASE YEAR</label>
              <input type="number" id="req-year" class="input" placeholder="e.g. 2023" min="1900" max="2100" required>
            </div>
            <p class="form-error" id="req-error" style="display:none;"></p>
            <p class="text-success" id="req-success" style="display:none;color:var(--accent-green);font-size:14px;margin-bottom:12px;"></p>
            <button type="submit" class="btn btn--primary btn--full" id="req-btn">SUBMIT REQUEST</button>
          </form>
        </div>

        <div>
          <h2 style="font-family:var(--font-heading);font-size:18px;letter-spacing:2px;margin-bottom:20px;">MY REQUESTS</h2>
          ${myRequests.length === 0
            ? `<div class="empty-state" style="padding:32px;"><div class="empty-state__icon">📭</div><div class="empty-state__text">No requests yet</div></div>`
            : `<div class="table-wrap">
                <table class="data-table">
                  <thead><tr><th>Title</th><th>Year</th><th>Requested</th></tr></thead>
                  <tbody>
                    ${myRequests.map(r => `
                      <tr>
                        <td>${components.escapeHtml(r.Requested_title)}</td>
                        <td>${r.Release_year}</td>
                        <td>${components.timeAgo(new Date(r.Requested_at))}</td>
                      </tr>`).join('')}
                  </tbody>
                </table>
              </div>`}
        </div>
      </div>
    </div>`;
}

const movieRequestPage = {
  async submitRequest(e) {
    e.preventDefault();
    const errorEl = document.getElementById('req-error');
    const successEl = document.getElementById('req-success');
    const btn = document.getElementById('req-btn');
    errorEl.style.display = 'none';
    successEl.style.display = 'none';
    btn.disabled = true;
    btn.textContent = 'SUBMITTING...';

    const title = document.getElementById('req-title').value.trim();
    const year = document.getElementById('req-year').value;

    try {
      const result = await api.submitMovieRequest(title, year);
      successEl.textContent = result.message;
      successEl.style.display = 'block';
      document.getElementById('request-form').reset();
      // Reload to show new request in the list
      setTimeout(() => renderMovieRequest(document.getElementById('app')), 1500);
    } catch (err) {
      errorEl.textContent = err.error || 'Failed to submit request';
      errorEl.style.display = 'block';
    } finally {
      btn.disabled = false;
      btn.textContent = 'SUBMIT REQUEST';
    }
  }
};
