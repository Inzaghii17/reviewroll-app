// Admin Panel Page — full-featured with Add Movie, Requests, Users
async function renderAdmin(container) {
  if (!api.isLoggedIn()) {
    container.innerHTML = `<div class="page"><div class="container">
      <div class="empty-state"><div class="empty-state__icon">🔒</div>
      <div class="empty-state__text">Login required</div>
      <button class="btn btn--primary" onclick="app.showAuthModal('login')">LOGIN</button>
    </div></div></div>`;
    return;
  }
  if (api.user.role !== 'ADMIN') {
    container.innerHTML = `<div class="page"><div class="container">
      <div class="empty-state"><div class="empty-state__icon">⛔</div>
      <div class="empty-state__text">Admin access only</div>
      <a href="#/" class="btn btn--outline">HOME</a>
    </div></div></div>`;
    return;
  }

  container.innerHTML = `
    <div class="page">
      <div class="page__hero">
        <div class="container">
          <h1 class="page__hero-title">ADMIN PANEL</h1>
          <p class="page__hero-sub">Platform management & controls</p>
        </div>
      </div>
      <div class="container" style="padding-top:40px;">

        <!-- Stats -->
        <div id="admin-stats" class="stats-grid" style="margin-bottom:48px;"></div>

        <!-- Tabs -->
        <div class="tabs" style="margin-bottom:28px;">
          <button class="tab active" onclick="adminPage.switchTab(event,'requests')">MOVIE REQUESTS</button>
          <button class="tab" onclick="adminPage.switchTab(event,'add-movie')">ADD MOVIE</button>
          <button class="tab" onclick="adminPage.switchTab(event,'users')">USER MANAGEMENT</button>
        </div>

        <div id="admin-action-msg" style="display:none;margin-bottom:16px;padding:12px 16px;border-radius:var(--radius);font-size:14px;"></div>

        <!-- Movie Requests Tab -->
        <div class="tab-content active" id="tab-requests">
          <div id="admin-requests-wrap"></div>
        </div>

        <!-- Add Movie Tab -->
        <div class="tab-content" id="tab-add-movie">
          <div class="card" style="max-width:600px; margin-bottom: 24px; border-color: var(--brand-main);">
            <h2 style="font-family:var(--font-heading);font-size:16px;letter-spacing:1px;margin-bottom:12px; color: var(--brand-main);">[TMDB] AUTO-FETCH MOVIE</h2>
            <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 16px;">Automatically import movie details, poster, cast, and crew from The Movie Database.</p>
            <form id="auto-fetch-form" onsubmit="adminPage.submitAutoFetch(event)" style="display:flex; gap:12px;">
              <input type="text" id="af-title" class="input" required placeholder="Movie Title (e.g. The Matrix)">
              <button type="submit" class="btn btn--primary" id="af-submit-btn" style="white-space:nowrap;">AUTO FETCH</button>
            </form>
            <p class="form-error" id="af-error" style="display:none;margin-top:12px;"></p>
          </div>

          <div class="card" style="max-width:600px;">
            <h2 style="font-family:var(--font-heading);font-size:16px;letter-spacing:1px;margin-bottom:24px;">MANUAL ADD</h2>
            <form id="add-movie-form" onsubmit="adminPage.submitAddMovie(event)">
              <div class="form-group">
                <label>TITLE *</label>
                <input type="text" id="am-title" class="input" required placeholder="e.g. Inception">
              </div>
              <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;">
                <div class="form-group">
                  <label>YEAR *</label>
                  <input type="number" id="am-year" class="input" min="1900" max="2100" required placeholder="2024">
                </div>
                <div class="form-group">
                  <label>DURATION (min) *</label>
                  <input type="number" id="am-duration" class="input" min="1" required placeholder="120">
                </div>
                <div class="form-group">
                  <label>LANGUAGE</label>
                  <input type="text" id="am-language" class="input" placeholder="English" value="English">
                </div>
              </div>
              <div class="form-group">
                <label>GENRES <span style="color:var(--text-muted);font-style:normal;">(comma-separated)</span></label>
                <input type="text" id="am-genres" class="input" placeholder="Sci-Fi, Action, Thriller">
              </div>
              <div class="form-group">
                <label>DESCRIPTION</label>
                <textarea class="textarea" id="am-desc" style="min-height:80px;" placeholder="Brief description of the movie..."></textarea>
              </div>
              <div class="form-group">
                <label>MOVIE POSTER</label>
                <div style="display:flex;flex-direction:column;gap:8px;">
                  <input type="file" id="am-image-file" accept="image/*" class="input" style="padding:8px;" onchange="adminPage.previewAddImage(this)">
                  <div style="text-align:center;color:var(--text-muted);font-size:12px;margin:4px 0;">— OR paste a URL —</div>
                  <input type="url" id="am-image-url" class="input" placeholder="https://example.com/poster.jpg">
                  <div id="am-preview-wrap" style="display:none;margin-top:8px;">
                    <img id="am-preview-img" style="max-height:140px;border-radius:4px;border:1px solid var(--border-color);" alt="Preview">
                  </div>
                </div>
              </div>
              <p class="form-error" id="am-error" style="display:none;margin-bottom:12px;"></p>
              <button type="submit" class="btn btn--primary btn--full" id="am-submit-btn">ADD MOVIE TO CATALOG</button>
            </form>
          </div>
        </div>

        <!-- Users Tab -->
        <div class="tab-content" id="tab-users">
          <div id="admin-users-wrap"></div>
        </div>
      </div>
    </div>

    <!-- Request Approval Modal -->
    <div class="modal-overlay" id="approve-modal" style="display:none;">
      <div class="modal" style="max-width:520px;width:95%;">
        <button class="modal__close" onclick="adminPage.closeApproveModal()">×</button>
        <h2 class="modal__title">APPROVE REQUEST</h2>
        <form id="approve-form" onsubmit="adminPage.submitApproval(event)">
          <input type="hidden" id="approve-request-id">
          <div class="form-group"><label>TITLE</label><input type="text" id="approve-title" class="input" required></div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div class="form-group"><label>YEAR</label><input type="number" id="approve-year" class="input" required></div>
            <div class="form-group"><label>DURATION (min)</label><input type="number" id="approve-duration" class="input" value="120" required></div>
          </div>
          <label style="display:flex;align-items:center;gap:8px;margin:-2px 0 10px;font-size:13px;color:var(--text-secondary);cursor:pointer;">
            <input type="checkbox" id="approve-auto-fetch" checked>
            Auto-fetch movie details from TMDB when approving
          </label>
          <div class="form-group"><label>DESCRIPTION</label><textarea class="textarea" id="approve-desc" style="min-height:70px;"></textarea></div>
          <div class="form-group">
            <label>POSTER IMAGE</label>
            <input type="file" id="approve-image-file" accept="image/*" class="input" style="padding:8px;" onchange="adminPage.previewImage(this)">
            <div style="text-align:center;color:var(--text-muted);font-size:12px;margin:6px 0;">— OR paste URL —</div>
            <input type="url" id="approve-image-url" class="input" placeholder="https://...">
            <div id="approve-image-preview" style="display:none;margin-top:8px;"><img id="approve-preview-img" style="max-height:100px;border-radius:4px;" alt="Preview"></div>
          </div>
          <p class="form-error" id="approve-error" style="display:none;"></p>
          <button type="submit" class="btn btn--primary btn--full" id="approve-submit-btn">APPROVE &amp; ADD MOVIE</button>
        </form>
      </div>
    </div>`;

  adminPage.loadStats();
  adminPage.loadRequests();
}

const adminPage = {
  switchTab(e, name) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    e.target.classList.add('active');
    document.getElementById(`tab-${name}`).classList.add('active');
    if (name === 'users') adminPage.loadUsers();
  },

  async loadStats() {
    const el = document.getElementById('admin-stats');
    if (!el) return;
    try {
      const s = await api.getAdminStats();
      el.innerHTML = [
        components.statCard(s.total_users, 'Users'),
        components.statCard(s.total_movies, 'Movies'),
        components.statCard(s.total_ratings, 'Ratings'),
        components.statCard(s.total_reviews, 'Reviews'),
        components.statCard(s.pending_requests, 'Pending Requests'),
        components.statCard(s.total_posts, 'Forum Posts'),
      ].join('');
    } catch { if (el) el.innerHTML = '<p class="text-muted">Stats unavailable</p>'; }
  },

  async loadRequests() {
    const wrap = document.getElementById('admin-requests-wrap');
    if (!wrap) return;
    try {
      const requests = await api.getAdminRequests();
      if (!requests.length) {
        wrap.innerHTML = `<div class="empty-state" style="padding:40px;"><div class="empty-state__icon">✅</div><div class="empty-state__text">No pending requests</div></div>`;
        return;
      }
      wrap.innerHTML = `
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>#</th><th>Title</th><th>Year</th><th>Requested By</th><th>Date</th><th>Actions</th></tr></thead>
            <tbody>
              ${requests.map(r => `
                <tr id="req-row-${r.Request_ID}">
                  <td>${r.Request_ID}</td>
                  <td><strong>${components.escapeHtml(r.Requested_title)}</strong></td>
                  <td>${r.Release_year}</td>
                  <td>${components.escapeHtml(r.user_name)}<br><span style="color:var(--text-muted);font-size:12px;">${r.user_email}</span></td>
                  <td style="font-size:12px;color:var(--text-muted);">${components.timeAgo(new Date(r.Requested_at))}</td>
                  <td><div style="display:flex;gap:8px;">
                    <button class="btn btn--primary btn--sm" onclick="adminPage.openApproveModal(${r.Request_ID},'${components.escapeHtml(r.Requested_title)}',${r.Release_year})">✓ Approve</button>
                    <button class="btn btn--outline btn--sm" style="color:var(--danger);border-color:var(--danger);" onclick="adminPage.rejectRequest(${r.Request_ID},'${components.escapeHtml(r.Requested_title)}')">✕ Reject</button>
                  </div></td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>`;
    } catch (e) {
      wrap.innerHTML = `<div class="empty-state"><div class="empty-state__icon">⚠</div><div class="empty-state__text">${e.error || 'Failed to load'}</div></div>`;
    }
  },

  previewAddImage(input) {
    const f = input.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = e => {
      document.getElementById('am-preview-img').src = e.target.result;
      document.getElementById('am-preview-wrap').style.display = 'block';
    };
    r.readAsDataURL(f);
  },

  async submitAddMovie(e) {
    e.preventDefault();
    const btn = document.getElementById('am-submit-btn');
    const errEl = document.getElementById('am-error');
    btn.disabled = true; btn.textContent = 'ADDING...'; errEl.style.display = 'none';

    const fd = new FormData();
    fd.append('title', document.getElementById('am-title').value.trim());
    fd.append('year', document.getElementById('am-year').value);
    fd.append('duration', document.getElementById('am-duration').value);
    fd.append('language', document.getElementById('am-language').value.trim() || 'Unknown');
    fd.append('description', document.getElementById('am-desc').value.trim());
    fd.append('genres', document.getElementById('am-genres').value.trim());

    const imageFile = document.getElementById('am-image-file').files[0];
    const imageUrl = document.getElementById('am-image-url').value.trim();
    if (imageFile) fd.append('image', imageFile);
    else if (imageUrl) fd.append('imageUrl', imageUrl);

    try {
      const result = await api.addMovie(fd);
      this.showMsg(result.message, 'success');
      document.getElementById('add-movie-form').reset();
      document.getElementById('am-preview-wrap').style.display = 'none';
      this.loadStats();
    } catch (err) {
      errEl.textContent = err.error || 'Failed to add movie';
      errEl.style.display = 'block';
    } finally {
      btn.disabled = false; btn.textContent = 'ADD MOVIE TO CATALOG';
    }
  },

  async submitAutoFetch(e) {
    e.preventDefault();
    const btn = document.getElementById('af-submit-btn');
    const errEl = document.getElementById('af-error');
    const title = document.getElementById('af-title').value.trim();
    
    btn.disabled = true; btn.textContent = 'FETCHING...'; errEl.style.display = 'none';
    
    try {
      const result = await api.autoFetchMovie(title);
      this.showMsg(result.message, 'success');
      document.getElementById('auto-fetch-form').reset();
      this.loadStats();
    } catch (err) {
      errEl.textContent = err.error || 'Failed to auto-fetch movie';
      errEl.style.display = 'block';
    } finally {
      btn.disabled = false; btn.textContent = 'AUTO FETCH';
    }
  },

  openApproveModal(reqId, title, year) {
    document.getElementById('approve-request-id').value = reqId;
    document.getElementById('approve-title').value = title;
    document.getElementById('approve-year').value = year;
    document.getElementById('approve-desc').value = '';
    document.getElementById('approve-image-url').value = '';
    document.getElementById('approve-image-file').value = '';
    document.getElementById('approve-auto-fetch').checked = true;
    document.getElementById('approve-image-preview').style.display = 'none';
    document.getElementById('approve-error').style.display = 'none';
    document.getElementById('approve-modal').style.display = 'flex';
  },

  closeApproveModal() { document.getElementById('approve-modal').style.display = 'none'; },

  previewImage(input) {
    const f = input.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = e => {
      document.getElementById('approve-preview-img').src = e.target.result;
      document.getElementById('approve-image-preview').style.display = 'block';
    };
    r.readAsDataURL(f);
  },

  async submitApproval(e) {
    e.preventDefault();
    const btn = document.getElementById('approve-submit-btn');
    const errEl = document.getElementById('approve-error');
    btn.disabled = true; btn.textContent = 'APPROVING...'; errEl.style.display = 'none';

    const reqId = document.getElementById('approve-request-id').value;
    const fd = new FormData();
    fd.append('title', document.getElementById('approve-title').value.trim());
    fd.append('year', document.getElementById('approve-year').value);
    fd.append('duration', document.getElementById('approve-duration').value);
    fd.append('description', document.getElementById('approve-desc').value.trim());
    fd.append('autoFetch', document.getElementById('approve-auto-fetch').checked ? 'true' : 'false');
    const imageFile = document.getElementById('approve-image-file').files[0];
    const imageUrl = document.getElementById('approve-image-url').value.trim();
    if (imageFile) fd.append('image', imageFile);
    else if (imageUrl) fd.append('imageUrl', imageUrl);

    try {
      const result = await api.approveRequest(reqId, fd);
      this.closeApproveModal();
      document.getElementById(`req-row-${reqId}`)?.remove();
      this.showMsg(`${result.message}${result.source === 'tmdb+manual' ? ' (TMDB-enhanced)' : ''}`, 'success');
      this.loadStats();
    } catch (err) {
      errEl.textContent = err.error || 'Approval failed';
      errEl.style.display = 'block';
    } finally {
      btn.disabled = false; btn.textContent = 'APPROVE & ADD MOVIE';
    }
  },

  async rejectRequest(reqId, title) {
    if (!confirm(`Reject request for "${title}"?`)) return;
    try {
      const result = await api.rejectRequest(reqId);
      document.getElementById(`req-row-${reqId}`)?.remove();
      this.showMsg(result.message, 'danger');
      this.loadStats();
    } catch (e) { alert(e.error || 'Reject failed'); }
  },

  async loadUsers() {
    const wrap = document.getElementById('admin-users-wrap');
    if (!wrap) return;
    try {
      const users = await api.getAdminUsers();
      wrap.innerHTML = `
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>#</th><th>Name</th><th>Email</th><th>Role</th><th>Action</th></tr></thead>
            <tbody>
              ${users.map(u => `
                <tr id="user-row-${u.User_ID}">
                  <td>${u.User_ID}</td>
                  <td>${components.escapeHtml(u.Name)}</td>
                  <td style="font-size:13px;color:var(--text-muted);">${u.Email}</td>
                  <td><span class="role-badge ${u.Role === 'ADMIN' ? 'role-badge--admin' : ''}">${u.Role}</span></td>
                  <td>${u.Role !== 'ADMIN'
                    ? `<button class="btn btn--outline btn--sm" onclick="adminPage.promoteUser(${u.User_ID},'${components.escapeHtml(u.Name)}')">⬆ Promote</button>`
                    : '<span style="color:var(--text-muted);font-size:12px;">Admin</span>'}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>`;
    } catch { wrap.innerHTML = `<div class="empty-state"><div class="empty-state__icon">⚠</div><div class="empty-state__text">Failed to load users</div></div>`; }
  },

  async promoteUser(userId, name) {
    if (!confirm(`Promote "${name}" to ADMIN?`)) return;
    try {
      const result = await api.promoteUser(userId);
      this.showMsg(result.message, 'success');
      const row = document.getElementById(`user-row-${userId}`);
      if (row) {
        row.querySelector('.role-badge')?.classList.add('role-badge--admin');
        if (row.querySelector('.role-badge')) row.querySelector('.role-badge').textContent = 'ADMIN';
        row.querySelector('button')?.replaceWith(Object.assign(document.createElement('span'), {
          textContent: 'Admin', style: 'color:var(--text-muted);font-size:12px;'
        }));
      }
    } catch (e) { alert(e.error || 'Promote failed'); }
  },

  showMsg(msg, type) {
    const el = document.getElementById('admin-action-msg');
    if (!el) return;
    el.textContent = msg;
    el.style.background = type === 'success' ? 'rgba(46,204,113,0.15)' : 'rgba(231,76,60,0.15)';
    el.style.color = type === 'success' ? '#2ecc71' : '#e74c3c';
    el.style.border = `1px solid ${type === 'success' ? 'rgba(46,204,113,0.3)' : 'rgba(231,76,60,0.3)'}`;
    el.style.display = 'block';
    setTimeout(() => { if (el) el.style.display = 'none'; }, 5000);
  }
};
