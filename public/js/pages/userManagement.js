// User Management Page — Admin only
async function renderUserManagement(container) {
  if (!api.isLoggedIn() || !api.isAdmin()) {
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
          <h1 class="page__hero-title">USER MANAGEMENT</h1>
          <p class="page__hero-sub">Search, promote, and remove platform users</p>
        </div>
      </div>
      <div class="container" style="padding-top:36px;max-width:960px;">

        <!-- Search bar -->
        <div style="margin-bottom:24px;">
          <input
            type="text"
            class="input"
            id="user-search-input"
            placeholder="Search by name or email..."
            oninput="userMgmtPage.search(this.value)"
            style="max-width:440px;"
          >
        </div>

        <!-- Action message -->
        <div id="um-msg" style="display:none;margin-bottom:16px;padding:12px 16px;border-radius:var(--radius);font-size:14px;"></div>

        <!-- Users table -->
        <div id="um-table-wrap">
          <div class="empty-state" style="padding:32px;"><div class="empty-state__icon">⏳</div><div class="empty-state__text">Loading users...</div></div>
        </div>
      </div>
    </div>`;

  await userMgmtPage.load();
}

const userMgmtPage = {
  allUsers: [],

  async load() {
    try {
      this.allUsers = await api.getAdminUsers();
      this.render(this.allUsers);
    } catch (e) {
      const wrap = document.getElementById('um-table-wrap');
      if (wrap) wrap.innerHTML = `<div class="empty-state"><div class="empty-state__icon">⚠</div><div class="empty-state__text">${e.error || 'Failed to load users'}</div></div>`;
    }
  },

  render(users) {
    const wrap = document.getElementById('um-table-wrap');
    if (!wrap) return;

    if (!users.length) {
      wrap.innerHTML = `<div class="empty-state" style="padding:32px;"><div class="empty-state__icon">👤</div><div class="empty-state__text">No users found</div></div>`;
      return;
    }

    wrap.innerHTML = `
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${users.map(u => {
              const isSelf = api.user && String(u.User_ID) === String(api.user.id);
              return `
              <tr id="um-row-${u.User_ID}">
                <td style="color:var(--text-muted);">${u.User_ID}</td>
                <td><strong>${components.escapeHtml(u.Name)}</strong></td>
                <td style="font-size:13px;color:var(--text-muted);">${u.Email}</td>
                <td><span class="role-badge ${u.Role === 'ADMIN' ? 'role-badge--admin' : ''}">${u.Role}</span></td>
                <td>
                  <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
                    ${u.Role !== 'ADMIN'
                      ? `<button class="btn btn--outline btn--sm" onclick="userMgmtPage.promote(${u.User_ID},'${components.escapeHtml(u.Name)}')">⬆ Promote</button>`
                      : `<span style="font-size:12px;color:var(--text-muted);">Admin</span>`}
                    ${!isSelf
                      ? `<button class="btn btn--outline btn--sm" style="color:var(--danger);border-color:var(--danger);" onclick="userMgmtPage.deleteUser(${u.User_ID},'${components.escapeHtml(u.Name)}')">🗑 Delete</button>`
                      : `<span style="font-size:12px;color:var(--text-muted);">(you)</span>`}
                  </div>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
      <p style="font-size:12px;color:var(--text-muted);margin-top:12px;">${users.length} user(s) shown</p>`;
  },

  search(q) {
    if (!q.trim()) {
      this.render(this.allUsers);
      return;
    }
    const lower = q.toLowerCase();
    const filtered = this.allUsers.filter(u =>
      u.Name.toLowerCase().includes(lower) ||
      u.Email.toLowerCase().includes(lower)
    );
    this.render(filtered);
  },

  async promote(userId, name) {
    if (!confirm(`Promote "${name}" to ADMIN role?`)) return;
    try {
      const result = await api.promoteUser(userId);
      this.showMsg(result.message, 'success');
      // Update local data and re-render
      const u = this.allUsers.find(u => u.User_ID === userId);
      if (u) u.Role = 'ADMIN';
      const q = document.getElementById('user-search-input')?.value || '';
      this.search(q);
    } catch (e) {
      alert(e.error || 'Promote failed');
    }
  },

  async deleteUser(userId, name) {
    if (!confirm(`Delete user "${name}"? This cannot be undone.`)) return;
    try {
      const result = await api.deleteUser(userId);
      this.showMsg(result.message, 'success');
      // Remove from local data and re-render
      this.allUsers = this.allUsers.filter(u => u.User_ID !== userId);
      const q = document.getElementById('user-search-input')?.value || '';
      this.search(q);
    } catch (e) {
      alert(e.error || 'Delete failed');
    }
  },

  showMsg(msg, type) {
    const el = document.getElementById('um-msg');
    if (!el) return;
    el.textContent = msg;
    el.style.background = type === 'success' ? 'rgba(46,204,113,0.15)' : 'rgba(231,76,60,0.15)';
    el.style.color = type === 'success' ? '#2ecc71' : '#e74c3c';
    el.style.border = `1px solid ${type === 'success' ? 'rgba(46,204,113,0.3)' : 'rgba(231,76,60,0.3)'}`;
    el.style.display = 'block';
    setTimeout(() => { if (el) el.style.display = 'none'; }, 5000);
  }
};
