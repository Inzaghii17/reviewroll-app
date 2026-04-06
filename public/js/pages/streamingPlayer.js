/**
 * Streaming Player Modal
 * Free embedded movie streaming with multiple provider fallback
 */

const streamingPlayer = {
  modalElement: null,
  currentMovie: null,
  currentProvider: null,
  allProviders: [],

  /**
   * Initialize and show streaming player modal
   */
  async show(movieId, movieTitle) {
    try {
      // Show loading state
      this.createModal();
      this.setLoading(true);

      // Fetch embed data
      const data = await api.getStreamingEmbed(movieId, { includeAll: true });

      this.currentMovie = {
        id: movieId,
        tmdbId: data.tmdbId,
        title: movieTitle || data.title
      };

      this.allProviders = data.all || [data.primary];
      this.currentProvider = data.primary;

      // Build and display modal
      this.renderModal();
      this.setLoading(false);
    } catch (error) {
      console.error('Streaming player error:', error);
      this.showError(error.message || 'Failed to load streaming player');
    }
  },

  /**
   * Create modal structure
   */
  createModal() {
    if (this.modalElement) return;

    const modal = document.createElement('div');
    modal.id = 'streaming-modal';
    modal.className = 'streaming-modal';
    modal.innerHTML = `
      <div class="streaming-modal__overlay"></div>
      <div class="streaming-modal__container">
        <div class="streaming-modal__header">
          <h2 class="streaming-modal__title">🎬 Watch Now</h2>
          <button class="streaming-modal__close" onclick="streamingPlayer.close()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div class="streaming-modal__content" id="streaming-content">
          <div class="streaming-player__loading">
            <div class="spinner"></div>
            <p>Loading streaming player...</p>
          </div>
        </div>

        <div class="streaming-modal__footer" id="streaming-footer" style="display:none;">
          <div class="streaming-providers">
            <label style="margin-right: 12px; color: var(--text-secondary); font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Provider:</label>
            <div class="provider-buttons" id="provider-buttons"></div>
          </div>
          <p class="streaming-disclaimer" style="margin-top: 12px; font-size: 11px; color: var(--text-muted);">
            ⚠️ Using free community embed sources. For the best experience, support creators by watching on official platforms.
          </p>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    this.modalElement = modal;

    // Close on overlay click
    modal.querySelector('.streaming-modal__overlay').addEventListener('click', () => this.close());

    // Close on escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.modalElement) this.close();
    });
  },

  /**
   * Render the player and controls
   */
  renderModal() {
    const content = document.getElementById('streaming-content');
    const footer = document.getElementById('streaming-footer');

    if (!content) return;

    // Render iframe
    content.innerHTML = `
      <div class="streaming-player__frame">
        <iframe
          class="streaming-player__iframe"
          src="${this.currentProvider.url}"
          frameborder="0"
          allowfullscreen
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          style="width: 100%; height: 100%; border-radius: var(--radius-md);">
        </iframe>
      </div>
    `;

    // Render provider buttons
    if (footer && this.allProviders.length > 1) {
      footer.style.display = 'block';
      const buttons = document.getElementById('provider-buttons');
      buttons.innerHTML = this.allProviders
        .map(
          (prov, idx) => `
          <button
            class="provider-btn ${prov.key === this.currentProvider.key ? 'active' : ''}"
            onclick="streamingPlayer.switchProvider(${idx})"
            title="Try ${prov.provider} if current player doesn't work">
            ${prov.provider}
          </button>
          `
        )
        .join('');
    }
  },

  /**
   * Switch to different provider
   */
  switchProvider(index) {
    if (index < 0 || index >= this.allProviders.length) return;
    this.currentProvider = this.allProviders[index];
    this.renderModal();

    // Update active button
    document.querySelectorAll('.provider-btn').forEach((btn, idx) => {
      btn.classList.toggle('active', idx === index);
    });
  },

  /**
   * Set loading state
   */
  setLoading(isLoading) {
    if (!this.modalElement) return;
    const content = document.getElementById('streaming-content');
    if (isLoading) {
      content.innerHTML = `
        <div class="streaming-player__loading">
          <div class="spinner"></div>
          <p>Loading streaming player...</p>
        </div>
      `;
    }
  },

  /**
   * Show error message
   */
  showError(message) {
    if (!this.modalElement) return;
    const content = document.getElementById('streaming-content');
    content.innerHTML = `
      <div class="streaming-player__error">
        <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
        <h3 style="margin-bottom: 8px;">Streaming Not Available</h3>
        <p style="margin-bottom: 16px; color: var(--text-secondary); font-size: 14px;">${components.escapeHtml(message)}</p>
        <div style="display: flex; gap: 8px;">
          <button class="btn btn--sm btn--primary" onclick="streamingPlayer.close()">Close</button>
          <button class="btn btn--sm btn--outline" onclick="window.open('https://www.justwatch.com/us/search?q=${encodeURIComponent(this.currentMovie.title)}', '_blank')">
            Find Legal Streams
          </button>
        </div>
      </div>
    `;
  },

  /**
   * Close the modal
   */
  close() {
    if (this.modalElement) {
      this.modalElement.classList.add('closing');
      setTimeout(() => {
        if (this.modalElement) {
          this.modalElement.remove();
          this.modalElement = null;
        }
      }, 300);
    }
  }
};
