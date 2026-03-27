// Thread Detail Page — Reddit-style nested posts
async function renderThreadDetail(container, params) {
  let thread;
  try {
    thread = await api.getThread(params.id);
  } catch (e) {
    container.innerHTML = `<div class="page"><div class="container">
      <div class="empty-state"><div class="empty-state__icon">💬</div>
      <div class="empty-state__text">Thread not found</div>
      <a href="#/forum" class="btn btn--primary">BACK TO FORUM</a></div></div></div>`;
    return;
  }

  const title = thread.movie_title
    ? `🎬 ${thread.movie_title}`
    : `🏷 Genre: ${thread.Genre_name}`;

  const isLoggedIn = api.isLoggedIn();
  const isAdmin = api.isAdmin();
  const posterSrc = thread.movie_image || '';

  container.innerHTML = `
    <div class="page">
      <div class="container" style="max-width:860px;padding-top:90px;">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px;flex-wrap:wrap;">
          <a href="#/forum" class="btn btn--ghost">← FORUM</a>
          ${thread.Movie_ID ? `<a href="#/movie/${thread.Movie_ID}" class="btn btn--ghost">🎬 Movie Page</a>` : ''}
          ${isAdmin ? `<button class="btn btn--outline btn--sm" style="color:var(--danger);border-color:var(--danger);margin-left:auto;" onclick="threadPage.adminClearThread(${thread.Thread_ID})">⚠ Admin: Clear Thread</button>` : ''}
        </div>

        <div class="thread-detail__header" style="display:flex;gap:20px;align-items:flex-start;margin-bottom:32px;">
          ${posterSrc ? `<img src="${posterSrc}" style="width:80px;height:120px;object-fit:cover;border-radius:4px;border:1px solid var(--border-color);flex-shrink:0;" onerror="this.style.display='none'">` : ''}
          <div>
            <h1 class="thread-detail__title">${title}</h1>
            <div class="thread-detail__meta">
              Status: <span style="color:var(--success);">${thread.Status}</span>
              · ${thread.posts ? thread.posts.length : 0} top-level post(s)
            </div>
          </div>
        </div>

        <!-- New top-level post box -->
        ${isLoggedIn ? `
          <div class="card" style="margin-bottom:32px;">
            <h3 style="font-size:13px;text-transform:uppercase;letter-spacing:1px;color:var(--text-secondary);margin-bottom:12px;">START A NEW DISCUSSION</h3>
            <textarea class="textarea" id="new-post-content" placeholder="Share your thoughts about this movie..."></textarea>
            <button class="btn btn--primary btn--sm" style="margin-top:10px;" onclick="threadPage.submitTopLevel(${thread.Thread_ID})">POST</button>
          </div>
        ` : `<p class="text-muted" style="margin-bottom:24px;"><a href="#" onclick="app.showAuthModal('login')">Login</a> to post.</p>`}

        <!-- Posts -->
        <div id="posts-container">
          ${thread.posts && thread.posts.length > 0
            ? thread.posts.map(p => components.postItem(p, 0)).join('')
            : '<div class="empty-state" style="padding:32px 0;"><div class="empty-state__icon">💬</div><div class="empty-state__text">No posts yet. Be the first!</div></div>'}
        </div>
      </div>
    </div>`;

  // Store thread ID for use by threadPage methods
  threadPage.currentThreadId = thread.Thread_ID;
}

const threadPage = {
  currentThreadId: null,

  async submitTopLevel(threadId) {
    const ta = document.getElementById('new-post-content');
    const content = ta ? ta.value.trim() : '';
    if (!content) return;
    try {
      const post = await api.addPost(threadId, content, null);
      post.replies = [];
      const container = document.getElementById('posts-container');
      const emptyState = container.querySelector('.empty-state');
      if (emptyState) emptyState.remove();
      container.insertAdjacentHTML('afterbegin', components.postItem(post, 0));
      ta.value = '';
    } catch (e) {
      alert(e.error || 'Failed to post');
    }
  },

  openReply(postId) {
    const box = document.getElementById(`reply-box-${postId}`);
    if (box) {
      box.style.display = box.style.display === 'none' ? 'block' : 'none';
      if (box.style.display === 'block') {
        const ta = document.getElementById(`reply-input-${postId}`);
        if (ta) ta.focus();
      }
    }
  },

  closeReply(postId) {
    const box = document.getElementById(`reply-box-${postId}`);
    if (box) box.style.display = 'none';
  },

  async submitReply(parentPostId) {
    const ta = document.getElementById(`reply-input-${parentPostId}`);
    const content = ta ? ta.value.trim() : '';
    if (!content) return;
    try {
      const post = await api.addPost(this.currentThreadId, content, parentPostId);
      post.replies = [];
      // Insert reply right after the parent's reply-box
      const box = document.getElementById(`reply-box-${parentPostId}`);
      if (box) {
        // Find or create the replies container after the box
        let repliesEl = document.getElementById(`post-${parentPostId}`)?.querySelector('.post__replies');
        if (!repliesEl) {
          repliesEl = document.createElement('div');
          repliesEl.className = 'post__replies';
          box.parentElement.appendChild(repliesEl);
        }
        repliesEl.insertAdjacentHTML('beforeend', components.postItem(post, 1));
        ta.value = '';
        this.closeReply(parentPostId);
      }
    } catch (e) {
      alert(e.error || 'Failed to reply');
    }
  },

  async deletePost(postId) {
    if (!confirm('Delete this post?')) return;
    try {
      await api.deletePost(postId);
      const el = document.getElementById(`post-${postId}`);
      if (el) {
        el.innerHTML = '<div class="post__content text-muted" style="font-style:italic;">[deleted]</div>';
        el.querySelector('.post__actions') && (el.querySelector('.post__actions').remove());
      }
    } catch (e) {
      alert(e.error || 'Delete failed');
    }
  },

  async adminClearThread(threadId) {
    if (!confirm('Clear all posts in this thread? (Admin only)')) return;
    try {
      await api.adminDeleteThread(threadId);
      document.getElementById('posts-container').innerHTML =
        '<div class="empty-state" style="padding:32px 0;"><div class="empty-state__icon">🗑</div><div class="empty-state__text">Thread cleared by admin</div></div>';
    } catch (e) {
      alert(e.error || 'Failed to clear thread');
    }
  }
};
