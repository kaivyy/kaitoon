/**
 * Kaitoon Web Reader Application
 * Single-Page App with OLED Pure Black Minimalist Interface
 * Ad-free streaming, dual-mode reading, and SQLite multi-device sync
 * Rule R-02 Compliance: Absolutely no em dashes or en dashes allowed in code, comments, or copy.
 */

(() => {
  'use strict';

  // Application State
  const state = {
    currentView: 'catalog', // 'catalog', 'detail', 'reader'
    activeTab: 'latest',    // 'latest', 'favorites', 'history'
    activeManga: null,      // Full detail object
    activeMangaId: null,
    activeChapterId: null,
    activeChapterNumber: null,
    activeChapterPages: [],
    currentPageIndex: 0,
    readMode: 'webtoon',    // 'webtoon' or 'manga'
    chapterSortOrder: 'desc', // 'desc' (terbaru) or 'asc' (terlama)
    isControllerVisible: true,
    controllerTimer: null,
    searchDebounceTimer: null,
    catalogPage: 1,
    catalogHasNext: true,
    favoritesList: [],
    historyList: [],
    activeHistoryItem: null,
    lastScrollY: 0,
    activeDownloadPolls: new Set()
  };

  // DOM Elements
  const DOM = {
    // Header & Navigation
    appHeader: document.getElementById('app-header'),
    brandLogo: document.getElementById('brand-logo'),
    searchInput: document.getElementById('search-input'),
    searchClearBtn: document.getElementById('search-clear-btn'),
    tabLatest: document.getElementById('tab-latest'),
    tabFavorites: document.getElementById('tab-favorites'),
    tabHistory: document.getElementById('tab-history'),
    mobileBottomNav: document.getElementById('mobile-bottom-nav'),
    mobileTabLatest: document.getElementById('mobile-tab-latest'),
    mobileTabFavorites: document.getElementById('mobile-tab-favorites'),
    mobileTabHistory: document.getElementById('mobile-tab-history'),
    toast: document.getElementById('toast'),

    // State Containers
    globalLoader: document.getElementById('global-loader'),
    errorState: document.getElementById('error-state'),
    errorTitle: document.getElementById('error-title'),
    errorMessage: document.getElementById('error-message'),
    retryBtn: document.getElementById('retry-btn'),
    emptyState: document.getElementById('empty-state'),
    emptyTitle: document.getElementById('empty-title'),
    emptyMessage: document.getElementById('empty-message'),
    emptyActionBtn: document.getElementById('empty-action-btn'),

    // Catalog View
    catalogView: document.getElementById('catalog-view'),
    catalogTitle: document.getElementById('catalog-title'),
    catalogCount: document.getElementById('catalog-count'),
    comicGrid: document.getElementById('comic-grid'),
    paginationControls: document.getElementById('pagination-controls'),
    prevPageBtn: document.getElementById('prev-page-btn'),
    nextPageBtn: document.getElementById('next-page-btn'),
    pageNumDisplay: document.getElementById('page-num-display'),

    // Detail View
    detailView: document.getElementById('detail-view'),
    detailBackBtn: document.getElementById('detail-back-btn'),
    detailCover: document.getElementById('detail-cover'),
    detailTitle: document.getElementById('detail-title'),
    detailAltTitle: document.getElementById('detail-alt-title'),
    detailStatus: document.getElementById('detail-status'),
    detailRating: document.getElementById('detail-rating'),
    detailViews: document.getElementById('detail-views'),
    detailGenres: document.getElementById('detail-genres'),
    detailSynopsis: document.getElementById('detail-synopsis'),
    detailContinueBtn: document.getElementById('detail-continue-btn'),
    detailFavoriteBtn: document.getElementById('detail-favorite-btn'),
    detailChapterCount: document.getElementById('detail-chapter-count'),
    chapterFilterInput: document.getElementById('chapter-filter-input'),
    sortOrderBtn: document.getElementById('sort-order-btn'),
    chapterList: document.getElementById('chapter-list'),

    // Reader View
    readerView: document.getElementById('reader-view'),
    readerHeader: document.getElementById('reader-header'),
    readerFooter: document.getElementById('reader-footer'),
    readerExitBtn: document.getElementById('reader-exit-btn'),
    readerHomeBtn: document.getElementById('reader-home-btn'),
    readerDockHomeBtn: document.getElementById('reader-dock-home-btn'),
    readerEpisodesBtn: document.getElementById('reader-episodes-btn'),
    readerMangaTitle: document.getElementById('reader-manga-title'),
    readerChapterTitle: document.getElementById('reader-chapter-title'),
    readerModeToggle: document.getElementById('reader-mode-toggle'),
    readerDownloadBtn: document.getElementById('reader-download-btn'),
    readerContainer: document.getElementById('reader-container'),
    webtoonContainer: document.getElementById('webtoon-scroll-container'),
    mangaContainer: document.getElementById('manga-slide-container'),
    mangaSlideImg: document.getElementById('manga-slide-img'),
    tapPrev: document.getElementById('tap-prev'),
    tapCenter: document.getElementById('tap-center'),
    tapNext: document.getElementById('tap-next'),
    readerPrevChapter: document.getElementById('reader-prev-chapter'),
    readerNextChapter: document.getElementById('reader-next-chapter'),
    readerChapterDockBtn: document.getElementById('reader-chapter-dock-btn'),
    readerDockChapterText: document.getElementById('reader-dock-chapter-text'),
    readerPrevPage: document.getElementById('reader-prev-page'),
    readerNextPage: document.getElementById('reader-next-page'),
    readerChapterSelect: document.getElementById('reader-chapter-select'),
    readerPageCounter: document.getElementById('reader-page-counter'),

    // Episode Drawer
    episodeDrawer: document.getElementById('episode-drawer'),
    episodeDrawerBackdrop: document.getElementById('episode-drawer-backdrop'),
    episodeDrawerClose: document.getElementById('episode-drawer-close'),
    episodeDrawerComicTitle: document.getElementById('episode-drawer-comic-title'),
    episodeSearchInput: document.getElementById('episode-search-input'),
    episodeDrawerList: document.getElementById('episode-drawer-list')
  };

  // Toast Notification
  let toastTimer = null;
  function showToast(message, duration = 3000) {
    if (!DOM.toast) return;
    DOM.toast.textContent = message;
    DOM.toast.hidden = false;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      DOM.toast.hidden = true;
    }, duration);
  }

  // Format Relative Timestamp
  function formatRelativeTime(dateStr) {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      const now = new Date();
      const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);
      if (diffSec < 60) return 'Baru saja';
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `${diffMin} mnt lalu`;
      const diffHour = Math.floor(diffMin / 60);
      if (diffHour < 24) return `${diffHour} jam lalu`;
      const diffDay = Math.floor(diffHour / 24);
      if (diffDay === 1) return 'Kemarin';
      if (diffDay < 7) return `${diffDay} hari lalu`;
      const diffWeek = Math.floor(diffDay / 7);
      if (diffWeek < 4) return `${diffWeek} mgg lalu`;
      return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
    } catch {
      return '';
    }
  }

  // UI State Helpers
  function showLoading(show = true) {
    if (DOM.globalLoader) DOM.globalLoader.hidden = !show;
    if (show) {
      hideError();
      hideEmpty();
      if (DOM.catalogView && state.currentView === 'catalog') {
        DOM.catalogView.hidden = true;
      }
    } else {
      if (DOM.catalogView && state.currentView === 'catalog') {
        DOM.catalogView.hidden = false;
      }
    }
  }

  function showError(message, retryCallback = null) {
    showLoading(false);
    hideEmpty();
    if (DOM.errorState) {
      DOM.errorState.hidden = false;
      if (DOM.errorMessage) DOM.errorMessage.textContent = message;
      if (DOM.retryBtn && retryCallback) {
        DOM.retryBtn.onclick = () => {
          hideError();
          retryCallback();
        };
      }
    }
  }

  function hideError() {
    if (DOM.errorState) DOM.errorState.hidden = true;
  }

  function showEmpty(title, message, actionLabel = 'Kembali', actionCallback = null) {
    showLoading(false);
    hideError();
    if (DOM.emptyState) {
      DOM.emptyState.hidden = false;
      if (DOM.emptyTitle) DOM.emptyTitle.textContent = title;
      if (DOM.emptyMessage) DOM.emptyMessage.textContent = message;
      if (DOM.emptyActionBtn) {
        DOM.emptyActionBtn.textContent = actionLabel;
        if (actionCallback) {
          DOM.emptyActionBtn.onclick = () => {
            hideEmpty();
            actionCallback();
          };
        } else {
          DOM.emptyActionBtn.onclick = () => {
            hideEmpty();
            switchTab('latest');
          };
        }
      }
    }
  }

  function hideEmpty() {
    if (DOM.emptyState) DOM.emptyState.hidden = true;
  }

  // View Navigation
  function switchView(viewName) {
    state.currentView = viewName;
    hideError();
    hideEmpty();

    if (viewName === 'catalog') {
      if (DOM.globalLoader && !DOM.globalLoader.hidden) {
        DOM.catalogView.hidden = true;
      } else {
        DOM.catalogView.hidden = false;
      }
      DOM.detailView.hidden = true;
      DOM.readerView.hidden = true;
      DOM.appHeader.hidden = false;
      if (DOM.mobileBottomNav) DOM.mobileBottomNav.hidden = false;
      window.scrollTo(0, state.lastScrollY);
    } else if (viewName === 'detail') {
      DOM.catalogView.hidden = true;
      DOM.detailView.hidden = false;
      DOM.readerView.hidden = true;
      DOM.appHeader.hidden = false;
      if (DOM.mobileBottomNav) DOM.mobileBottomNav.hidden = false;
      window.scrollTo(0, 0);
    } else if (viewName === 'reader') {
      state.lastScrollY = window.scrollY;
      DOM.catalogView.hidden = true;
      DOM.detailView.hidden = true;
      DOM.readerView.hidden = false;
      DOM.appHeader.hidden = true;
      if (DOM.mobileBottomNav) DOM.mobileBottomNav.hidden = true;
      showReaderControls(true);
    }
  }

  // URL Hash and Storage Routing Helper
  function setRoute(routeStr) {
    const hash = `#/${routeStr}`;
    try {
      sessionStorage.setItem('kaitoon_route', hash);
    } catch {
      // Ignore storage errors in restricted contexts
    }
    if (window.location.hash !== hash) {
      window.location.hash = hash;
    }
  }

  let isHandlingRoute = false;
  async function handleRoute() {
    if (isHandlingRoute) return;
    isHandlingRoute = true;
    try {
      let rawHash = window.location.hash || '';
      if (!rawHash) {
        try {
          rawHash = sessionStorage.getItem('kaitoon_route') || '';
        } catch {
          // Ignore storage errors
        }
      }

      const cleanHash = rawHash.replace(/^#\/?/, '');
      const parts = cleanHash.split('/').filter(Boolean);

      // Route: #/reader/{mangaId}/{chapterId}/{chapterNumber}
      if (parts[0] === 'reader' && parts.length >= 4) {
        const mangaId = decodeURIComponent(parts[1]);
        const chapterId = decodeURIComponent(parts[2]);
        const chapterNumber = decodeURIComponent(parts[3]);
        if (state.currentView !== 'reader' || state.activeChapterId !== chapterId) {
          await openReader(mangaId, chapterId, chapterNumber, state.readMode, false);
        }
        return;
      }

      // Route: #/manga/{mangaId}
      if (parts[0] === 'manga' && parts.length >= 2) {
        const mangaId = decodeURIComponent(parts[1]);
        if (state.currentView !== 'detail' || state.activeMangaId !== mangaId) {
          await openMangaDetail(mangaId, false);
        }
        return;
      }

      // Route: #/favorites
      if (parts[0] === 'favorites') {
        if (state.currentView !== 'catalog' || state.activeTab !== 'favorites') {
          switchTab('favorites', false);
        }
        return;
      }

      // Route: #/history
      if (parts[0] === 'history') {
        if (state.currentView !== 'catalog' || state.activeTab !== 'history') {
          switchTab('history', false);
        }
        return;
      }

      // Default Route: #/latest
      if (state.currentView !== 'catalog' || state.activeTab !== 'latest') {
        switchTab('latest', false);
      }
    } finally {
      isHandlingRoute = false;
    }
  }

  // Tab Navigation
  function switchTab(tabKey, updateHash = true) {
    state.activeTab = tabKey;
    state.catalogPage = 1;
    state.lastScrollY = 0;
    DOM.searchInput.value = '';
    DOM.searchClearBtn.hidden = true;

    [
      DOM.tabLatest,
      DOM.tabFavorites,
      DOM.tabHistory,
      DOM.mobileTabLatest,
      DOM.mobileTabFavorites,
      DOM.mobileTabHistory
    ].forEach(btn => {
      if (btn) btn.classList.remove('active');
    });

    if (tabKey === 'latest') {
      if (DOM.tabLatest) DOM.tabLatest.classList.add('active');
      if (DOM.mobileTabLatest) DOM.mobileTabLatest.classList.add('active');
      DOM.catalogTitle.textContent = 'Komik Terbaru';
      loadLatestComics(1);
    } else if (tabKey === 'favorites') {
      if (DOM.tabFavorites) DOM.tabFavorites.classList.add('active');
      if (DOM.mobileTabFavorites) DOM.mobileTabFavorites.classList.add('active');
      DOM.catalogTitle.textContent = 'Komik Favorit';
      loadFavorites();
    } else if (tabKey === 'history') {
      if (DOM.tabHistory) DOM.tabHistory.classList.add('active');
      if (DOM.mobileTabHistory) DOM.mobileTabHistory.classList.add('active');
      DOM.catalogTitle.textContent = 'Riwayat Baca';
      loadHistory();
    }
    switchView('catalog');
    if (updateHash) {
      setRoute(tabKey);
    }
  }

  // API Callers
  async function apiFetch(endpoint, options = {}) {
    try {
      const response = await fetch(endpoint, options);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `HTTP Error ${response.status}`);
      }
      return await response.json();
    } catch (err) {
      console.error(`API Fetch Error [${endpoint}]:`, err);
      throw err;
    }
  }

  // Load Latest Comics
  async function loadLatestComics(page = 1) {
    showLoading(true);
    DOM.comicGrid.innerHTML = '';
    DOM.paginationControls.hidden = true;
    if (DOM.catalogCount) DOM.catalogCount.textContent = '';

    try {
      const result = await apiFetch(`/api/latest?page=${page}&page_size=24`);
      showLoading(false);
      hideError();
      hideEmpty();
      const items = Array.isArray(result) ? result : (result.data || []);
      
      if (!items || items.length === 0) {
        showEmpty('Tidak Ada Komik', 'Belum ada komik terbaru dari server.', 'Muat Ulang', () => loadLatestComics(1));
        return;
      }

      state.catalogPage = page;
      state.catalogHasNext = items.length >= 24;
      DOM.catalogCount.textContent = `(${items.length} judul)`;

      renderComicGrid(items);
      setupPagination();
    } catch (err) {
      showError(`Gagal memuat komik terbaru: ${err.message}`, () => loadLatestComics(page));
    }
  }

  // Load Watchlist / Favorites
  async function loadFavorites() {
    showLoading(true);
    DOM.comicGrid.innerHTML = '';
    DOM.paginationControls.hidden = true;
    if (DOM.catalogCount) DOM.catalogCount.textContent = '';

    try {
      const items = await apiFetch('/api/watchlist');
      showLoading(false);
      hideError();
      hideEmpty();
      state.favoritesList = items || [];

      if (!items || items.length === 0) {
        showEmpty(
          'Belum Ada Favorit',
          'Tandai komik favorit Anda untuk menerima pembaruan otomatis.',
          'Jelajahi Terbaru',
          () => switchTab('latest')
        );
        return;
      }

      DOM.catalogCount.textContent = `(${items.length} judul tersimpan)`;
      renderFavoritesGrid(items);
    } catch (err) {
      showError(`Gagal memuat daftar favorit: ${err.message}`, () => loadFavorites());
    }
  }

  // Load Reading History
  async function loadHistory() {
    showLoading(true);
    DOM.comicGrid.innerHTML = '';
    DOM.paginationControls.hidden = true;
    if (DOM.catalogCount) DOM.catalogCount.textContent = '';

    try {
      const items = await apiFetch('/api/history?limit=50');
      showLoading(false);
      hideError();
      hideEmpty();
      state.historyList = items || [];

      if (!items || items.length === 0) {
        showEmpty(
          'Belum Ada Riwayat Baca',
          'Mulai membaca komik untuk menyimpan progres baca Anda secara otomatis.',
          'Mulai Membaca',
          () => switchTab('latest')
        );
        return;
      }

      DOM.catalogCount.textContent = `(${items.length} riwayat)`;
      renderHistoryGrid(items);
    } catch (err) {
      showError(`Gagal memuat riwayat baca: ${err.message}`, () => loadHistory());
    }
  }

  // Live Search (400ms Debounce)
  async function performSearch(query) {
    const q = query.trim();
    if (!q) {
      switchTab(state.activeTab);
      return;
    }

    showLoading(true);
    DOM.comicGrid.innerHTML = '';
    DOM.paginationControls.hidden = true;
    if (DOM.catalogCount) DOM.catalogCount.textContent = '';
    DOM.catalogTitle.textContent = `Hasil Pencarian: "${q}"`;

    try {
      const result = await apiFetch(`/api/search?q=${encodeURIComponent(q)}&page=1&page_size=24`);
      showLoading(false);
      hideError();
      hideEmpty();
      const items = Array.isArray(result) ? result : (result.data || []);

      if (!items || items.length === 0) {
        showEmpty(
          'Hasil Tidak Ditemukan',
          `Tidak ada komik yang cocok dengan kata kunci "${q}".`,
          'Kembali ke Beranda',
          () => switchTab('latest')
        );
        return;
      }

      DOM.catalogCount.textContent = `(${items.length} hasil)`;
      renderComicGrid(items);
    } catch (err) {
      showError(`Pencarian gagal: ${err.message}`, () => performSearch(q));
    }
  }

  // Render Grid Cards (Web Comic Style with Badges)
  function renderComicGrid(items) {
    DOM.comicGrid.innerHTML = '';
    items.forEach(item => {
      const card = document.createElement('article');
      card.className = 'comic-card';
      card.tabIndex = 0;
      card.setAttribute('role', 'listitem');
      card.setAttribute('aria-label', item.title || 'Komik');

      const posterUrl = item.cover_image_url || item.cover_url || '';
      const latestCh = item.latest_chapter_number || item.latest_chapter || '';
      const rating = item.user_rate ? Number(item.user_rate).toFixed(1) : '';

      // Determine comic format (Manhwa / Manga / Manhua)
      let format = '';
      if (item.taxonomy && item.taxonomy.Format && item.taxonomy.Format.length > 0) {
        format = item.taxonomy.Format[0].name || item.taxonomy.Format[0];
      } else if (item.country_id === 'KR') {
        format = 'Manhwa';
      } else if (item.country_id === 'JP') {
        format = 'Manga';
      } else if (item.country_id === 'CN') {
        format = 'Manhua';
      }

      const ch1Num = item.latest_chapter_number || item.latest_chapter || '';
      const ch1Time = formatRelativeTime(item.latest_chapter_time || item.updated_at);
      let ch2Num = '';
      if (ch1Num && Number(ch1Num) > 1) {
        ch2Num = Math.floor(Number(ch1Num)) === Number(ch1Num) ? (Number(ch1Num) - 1) : (Number(ch1Num) - 1).toFixed(1);
      }

      card.innerHTML = `
        <div class="card-poster-wrap">
          <img class="card-poster" src="${posterUrl}" alt="Sampul ${escapeHtml(item.title || '')}" loading="lazy" referrerpolicy="no-referrer">
          ${format ? `<span class="card-badge-format">${escapeHtml(format)}</span>` : ''}
          ${rating ? `<span class="card-badge-rating">&#9733; ${rating}</span>` : ''}
          <div class="card-poster-shadow"></div>
          ${latestCh ? `<span class="card-poster-ch-tag">Ch. ${latestCh}</span>` : ''}
        </div>
        <div class="card-body">
          <h2 class="card-title">${escapeHtml(item.title || 'Tanpa Judul')}</h2>
          <div class="card-meta">
            <span class="card-status-text">${format || 'Komik'}</span>
            ${rating ? `<span class="card-rating">&#9733; ${rating}</span>` : ''}
          </div>
          ${ch1Num ? `
          <div class="card-chapters-list">
            <button type="button" class="card-ch-btn card-ch-btn-1" aria-label="Baca Chapter ${ch1Num}">
              <span class="card-ch-name">Ch. ${ch1Num}</span>
              <span class="card-ch-time">${ch1Time || 'Terbaru'}</span>
            </button>
            ${ch2Num ? `
            <button type="button" class="card-ch-btn card-ch-btn-2" aria-label="Baca Chapter ${ch2Num}">
              <span class="card-ch-name">Ch. ${ch2Num}</span>
              <span class="card-ch-action">
                <span>Baca</span>
                <svg class="mini-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
              </span>
            </button>
            ` : ''}
          </div>
          ` : ''}
        </div>
      `;

      const ch1Btn = card.querySelector('.card-ch-btn-1');
      if (ch1Btn) {
        ch1Btn.onclick = (e) => {
          e.stopPropagation();
          if (item.latest_chapter_id) {
            openReader(item.manga_id, item.latest_chapter_id, ch1Num, state.readMode);
          } else {
            openDirectChapterByNumber(item.manga_id, ch1Num);
          }
        };
      }

      const ch2Btn = card.querySelector('.card-ch-btn-2');
      if (ch2Btn) {
        ch2Btn.onclick = (e) => {
          e.stopPropagation();
          openDirectChapterByNumber(item.manga_id, ch2Num);
        };
      }

      const clickHandler = () => openMangaDetail(item.manga_id);
      card.onclick = clickHandler;
      card.onkeydown = (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          clickHandler();
        }
      };

      DOM.comicGrid.appendChild(card);
    });
  }

  function renderFavoritesGrid(items) {
    DOM.comicGrid.innerHTML = '';
    items.forEach(item => {
      const card = document.createElement('article');
      card.className = 'comic-card';
      card.tabIndex = 0;
      card.setAttribute('role', 'listitem');

      const posterUrl = item.cover_url || '';
      const latestCh = item.latest_chapter_number || 0;
      const hasNew = Number(item.has_new_update) === 1;

      const ch1Num = item.latest_chapter_number || 0;
      let ch2Num = '';
      if (ch1Num && Number(ch1Num) > 1) {
        ch2Num = Math.floor(Number(ch1Num)) === Number(ch1Num) ? (Number(ch1Num) - 1) : (Number(ch1Num) - 1).toFixed(1);
      }

      card.innerHTML = `
        <div class="card-poster-wrap">
          <img class="card-poster" src="${posterUrl}" alt="Sampul ${escapeHtml(item.manga_title || '')}" loading="lazy" referrerpolicy="no-referrer">
          ${hasNew ? '<span class="card-badge-update">UPDATE</span>' : ''}
          <div class="card-poster-shadow"></div>
          <span class="card-poster-ch-tag">Ch. ${latestCh}</span>
        </div>
        <div class="card-body">
          <h2 class="card-title">${escapeHtml(item.manga_title || 'Tanpa Judul')}</h2>
          <div class="card-meta">
            <span class="card-status-text">${hasNew ? '<span style="color:var(--accent-emerald); font-weight:700;">Baru Diupdate</span>' : 'Favorit'}</span>
            <span class="card-rating">&#9733; Favorit</span>
          </div>
          ${ch1Num ? `
          <div class="card-chapters-list">
            <button type="button" class="card-ch-btn card-ch-btn-1" aria-label="Baca Chapter ${ch1Num}">
              <span class="card-ch-name">Ch. ${ch1Num}</span>
              <span class="card-ch-time">${hasNew ? 'Update' : 'Terbaru'}</span>
            </button>
            ${ch2Num ? `
            <button type="button" class="card-ch-btn card-ch-btn-2" aria-label="Baca Chapter ${ch2Num}">
              <span class="card-ch-name">Ch. ${ch2Num}</span>
              <span class="card-ch-action">
                <span>Baca</span>
                <svg class="mini-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
              </span>
            </button>
            ` : ''}
          </div>
          ` : ''}
        </div>
      `;

      const ch1Btn = card.querySelector('.card-ch-btn-1');
      if (ch1Btn) {
        ch1Btn.onclick = (e) => {
          e.stopPropagation();
          openDirectChapterByNumber(item.manga_id, ch1Num);
        };
      }

      const ch2Btn = card.querySelector('.card-ch-btn-2');
      if (ch2Btn) {
        ch2Btn.onclick = (e) => {
          e.stopPropagation();
          openDirectChapterByNumber(item.manga_id, ch2Num);
        };
      }

      const clickHandler = () => openMangaDetail(item.manga_id);
      card.onclick = clickHandler;
      card.onkeydown = (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          clickHandler();
        }
      };

      DOM.comicGrid.appendChild(card);
    });
  }

  function renderHistoryGrid(items) {
    DOM.comicGrid.innerHTML = '';
    items.forEach(item => {
      const card = document.createElement('article');
      card.className = 'comic-card';
      card.tabIndex = 0;
      card.setAttribute('role', 'listitem');

      const posterUrl = item.cover_url || '';
      const lastCh = item.last_chapter_number || 0;
      let nextCh = Number(lastCh) > 0 ? (Number(lastCh) + 1) : '';

      card.innerHTML = `
        <div class="card-poster-wrap">
          <img class="card-poster" src="${posterUrl}" alt="Sampul ${escapeHtml(item.manga_title || '')}" loading="lazy" referrerpolicy="no-referrer">
          <div class="card-poster-shadow"></div>
          <span class="card-poster-ch-tag">Ch. ${lastCh}</span>
        </div>
        <div class="card-body">
          <h2 class="card-title">${escapeHtml(item.manga_title || 'Tanpa Judul')}</h2>
          <div class="card-meta">
            <span class="card-status-text">Riwayat Baca</span>
            <span class="card-rating">&#9733; Terakhir</span>
          </div>
          <div class="card-chapters-list">
            <button type="button" class="card-ch-btn card-ch-btn-1" aria-label="Lanjut Chapter ${lastCh}">
              <span class="card-ch-name">Ch. ${lastCh}</span>
              <span class="card-ch-time">Terakhir</span>
            </button>
            ${nextCh ? `
            <button type="button" class="card-ch-btn card-ch-btn-2" aria-label="Baca Chapter ${nextCh}">
              <span class="card-ch-name">Ch. ${nextCh}</span>
              <span class="card-ch-action">
                <span>Lanjut</span>
                <svg class="mini-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
              </span>
            </button>
            ` : ''}
          </div>
        </div>
      `;

      const ch1Btn = card.querySelector('.card-ch-btn-1');
      if (ch1Btn) {
        ch1Btn.onclick = (e) => {
          e.stopPropagation();
          if (item.last_chapter_id) {
            openReader(item.manga_id, item.last_chapter_id, lastCh, item.read_mode || state.readMode);
          } else {
            openDirectChapterByNumber(item.manga_id, lastCh);
          }
        };
      }

      const ch2Btn = card.querySelector('.card-ch-btn-2');
      if (ch2Btn) {
        ch2Btn.onclick = (e) => {
          e.stopPropagation();
          openDirectChapterByNumber(item.manga_id, nextCh);
        };
      }

      const clickHandler = () => openMangaDetail(item.manga_id);
      card.onclick = clickHandler;
      card.onkeydown = (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          clickHandler();
        }
      };

      DOM.comicGrid.appendChild(card);
    });
  }

  function setupPagination() {
    DOM.paginationControls.hidden = false;
    DOM.pageNumDisplay.textContent = `Halaman ${state.catalogPage}`;
    DOM.prevPageBtn.disabled = state.catalogPage <= 1;
    DOM.nextPageBtn.disabled = !state.catalogHasNext;

    DOM.prevPageBtn.onclick = () => {
      if (state.catalogPage > 1) {
        loadLatestComics(state.catalogPage - 1);
        window.scrollTo(0, 0);
      }
    };
    DOM.nextPageBtn.onclick = () => {
      if (state.catalogHasNext) {
        loadLatestComics(state.catalogPage + 1);
        window.scrollTo(0, 0);
      }
    };
  }

  // Open Detail View
  async function openMangaDetail(mangaId, updateHash = true) {
    showLoading(true);
    state.activeMangaId = mangaId;

    try {
      const [detailRes, historyItems, watchlistItems] = await Promise.all([
        apiFetch(`/api/manga/${mangaId}`),
        apiFetch('/api/history').catch(() => []),
        apiFetch('/api/watchlist').catch(() => [])
      ]);

      showLoading(false);
      hideError();
      hideEmpty();
      const detail = detailRes.data || detailRes;
      state.activeManga = detail;

      // Reset chapter filter
      if (DOM.chapterFilterInput) DOM.chapterFilterInput.value = '';

      // Populate Detail View Elements
      DOM.detailCover.src = detail.cover_image_url || '';
      DOM.detailCover.alt = `Sampul ${detail.title || 'Komik'}`;
      DOM.detailTitle.textContent = detail.title || 'Tanpa Judul';
      DOM.detailAltTitle.textContent = detail.alternative_title || '';
      DOM.detailAltTitle.hidden = !detail.alternative_title;

      // Badges
      const isOngoing = Number(detail.status) === 1;
      DOM.detailStatus.textContent = isOngoing ? 'Ongoing' : 'Tamat';
      DOM.detailRating.textContent = detail.user_rate ? `Rating: ${Number(detail.user_rate).toFixed(1)}` : 'Rating: N/A';
      DOM.detailViews.textContent = detail.view_count ? `${Number(detail.view_count).toLocaleString()} views` : '';
      DOM.detailViews.hidden = !detail.view_count;

      // Genres
      DOM.detailGenres.innerHTML = '';
      const genreList = (detail.taxonomy && detail.taxonomy.Genre) || [];
      genreList.forEach(g => {
        const span = document.createElement('span');
        span.className = 'genre-tag';
        span.textContent = g.name || g;
        DOM.detailGenres.appendChild(span);
      });

      // Synopsis
      DOM.detailSynopsis.textContent = detail.description || 'Tidak ada sinopsis yang tersedia.';

      // Watchlist Status
      const isWatchlisted = watchlistItems.some(w => w.manga_id === mangaId);
      updateFavoriteButton(isWatchlisted);

      // Reading History Status
      const histItem = historyItems.find(h => h.manga_id === mangaId);
      state.activeHistoryItem = histItem;
      setupContinueReadingButton(detail, histItem);

      // Render Chapters
      const chapters = detail.chapters || [];
      DOM.detailChapterCount.textContent = `${chapters.length} Chapter`;
      renderChapterList(chapters, histItem);

      switchView('detail');
      if (updateHash) {
        setRoute(`manga/${encodeURIComponent(mangaId)}`);
      }
    } catch (err) {
      showError(`Gagal memuat detail komik: ${err.message}`, () => openMangaDetail(mangaId, updateHash));
    }
  }

  function updateFavoriteButton(isFavorited) {
    if (isFavorited) {
      DOM.detailFavoriteBtn.innerHTML = `
        <svg class="btn-icon-svg" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
        </svg>
        <span>Hapus dari Favorit</span>
      `;
      DOM.detailFavoriteBtn.classList.remove('btn-secondary');
      DOM.detailFavoriteBtn.classList.add('btn-ghost');
    } else {
      DOM.detailFavoriteBtn.innerHTML = `
        <svg class="btn-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
        </svg>
        <span>Tambah ke Favorit</span>
      `;
      DOM.detailFavoriteBtn.classList.remove('btn-ghost');
      DOM.detailFavoriteBtn.classList.add('btn-secondary');
    }

    DOM.detailFavoriteBtn.onclick = async () => {
      const manga = state.activeManga;
      if (!manga) return;
      try {
        const payload = {
          manga_id: manga.manga_id,
          manga_title: manga.title || 'Manga',
          cover_url: manga.cover_image_url || '',
          latest_chapter_number: Number(manga.latest_chapter_number || 0)
        };
        const res = await apiFetch('/api/watchlist/toggle', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        updateFavoriteButton(res.is_saved);
        showToast(res.is_saved ? 'Ditambahkan ke Favorit' : 'Dihapus dari Favorit');
      } catch (err) {
        showToast(`Gagal mengubah status favorit: ${err.message}`);
      }
    };
  }

  function setupContinueReadingButton(manga, historyItem) {
    const chapters = manga.chapters || [];
    if (chapters.length === 0) {
      DOM.detailContinueBtn.hidden = true;
      return;
    }
    DOM.detailContinueBtn.hidden = false;

    let targetChapter = null;
    let label = 'Mulai Membaca';

    if (historyItem && historyItem.last_chapter_id) {
      targetChapter = chapters.find(c => c.chapter_id === historyItem.last_chapter_id);
      if (targetChapter) {
        label = `Lanjut Baca Ch. ${historyItem.last_chapter_number}`;
      }
    }

    if (!targetChapter) {
      const sortedAsc = [...chapters].sort((a, b) => Number(a.chapter_number) - Number(b.chapter_number));
      targetChapter = sortedAsc[0];
      label = `Mulai Baca Ch. ${targetChapter.chapter_number}`;
    }

    DOM.detailContinueBtn.innerHTML = `
      <svg class="btn-icon-svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <polygon points="5 3 19 12 5 21 5 3"></polygon>
      </svg>
      <span>${label}</span>
    `;

    DOM.detailContinueBtn.onclick = () => {
      const preferredMode = (historyItem && historyItem.read_mode) || state.readMode;
      openReader(manga.manga_id, targetChapter.chapter_id, targetChapter.chapter_number, preferredMode);
    };
  }

  function renderChapterList(chapters, historyItem) {
    DOM.chapterList.innerHTML = '';

    // Apply chapter search filter if provided
    const query = (DOM.chapterFilterInput && DOM.chapterFilterInput.value.trim().toLowerCase()) || '';
    let filtered = chapters;
    if (query) {
      filtered = chapters.filter(c => {
        const chNum = String(c.chapter_number || '').toLowerCase();
        const chTitle = String(c.chapter_title || '').toLowerCase();
        return chNum.includes(query) || chTitle.includes(query);
      });
    }

    if (filtered.length === 0) {
      const emptyItem = document.createElement('div');
      emptyItem.className = 'chapter-item';
      emptyItem.style.justifyContent = 'center';
      emptyItem.style.color = 'var(--text-muted)';
      emptyItem.textContent = `Tidak ada chapter yang cocok dengan "${query}".`;
      DOM.chapterList.appendChild(emptyItem);
      return;
    }

    const sorted = [...filtered].sort((a, b) => {
      const numA = Number(a.chapter_number || 0);
      const numB = Number(b.chapter_number || 0);
      return state.chapterSortOrder === 'desc' ? numB - numA : numA - numB;
    });

    const lastReadChId = historyItem ? historyItem.last_chapter_id : null;

    sorted.forEach(ch => {
      const item = document.createElement('div');
      item.className = 'chapter-item';
      if (ch.chapter_id === lastReadChId) {
        item.classList.add('is-read');
      }

      const releaseDate = ch.release_date || '';
      const isReadBadge = ch.chapter_id === lastReadChId ? '<span class="chapter-read-badge">Terakhir Dibaca</span>' : '';

      item.innerHTML = `
        <div class="chapter-item-left">
          <span class="chapter-num">Chapter ${ch.chapter_number}</span>
          ${isReadBadge}
        </div>
        <div class="chapter-item-right">
          ${releaseDate ? `<span class="chapter-date">${releaseDate}</span>` : ''}
          <button class="btn chapter-dl-btn" title="Unduh chapter offline .cbz" aria-label="Unduh chapter ${ch.chapter_number}">
            <svg class="btn-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="width:14px;height:14px;">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            <span>Unduh</span>
          </button>
        </div>
      `;

      item.onclick = (e) => {
        if (e.target.closest('.chapter-dl-btn')) {
          e.stopPropagation();
          triggerChapterDownload(ch.chapter_id, state.activeManga.title, ch.chapter_number);
          return;
        }
        openReader(state.activeMangaId, ch.chapter_id, ch.chapter_number, state.readMode);
      };

      DOM.chapterList.appendChild(item);
    });
  }

  // Toggle Chapter Sort Order
  if (DOM.sortOrderBtn) {
    DOM.sortOrderBtn.onclick = () => {
      state.chapterSortOrder = state.chapterSortOrder === 'desc' ? 'asc' : 'desc';
      const isDesc = state.chapterSortOrder === 'desc';
      DOM.sortOrderBtn.innerHTML = `
        <svg class="btn-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <polyline points="${isDesc ? '19 12 12 19 5 12' : '19 12 12 5 5 12'}"></polyline>
        </svg>
        <span>Urutan: ${isDesc ? 'Terbaru \u2193' : 'Terlama \u2191'}</span>
      `;
      if (state.activeManga && state.activeManga.chapters) {
        renderChapterList(state.activeManga.chapters, state.activeHistoryItem);
      }
    };
  }

  // Chapter Filter Input Handler
  if (DOM.chapterFilterInput) {
    DOM.chapterFilterInput.addEventListener('input', () => {
      if (state.activeManga && state.activeManga.chapters) {
        renderChapterList(state.activeManga.chapters, state.activeHistoryItem);
      }
    });
  }

  // Direct Chapter Opening Helper
  async function openDirectChapterByNumber(mangaId, chapterNumber, fallbackChapterId = null) {
    if (fallbackChapterId) {
      return openReader(mangaId, fallbackChapterId, chapterNumber, state.readMode);
    }
    showLoading(true);
    try {
      let manga = state.activeManga;
      if (!manga || manga.manga_id !== mangaId || !manga.chapters) {
        const res = await apiFetch(`/api/manga/${mangaId}`);
        manga = res.data || res;
        state.activeManga = manga;
        state.activeMangaId = manga.manga_id || mangaId;
      }
      const chapters = (manga && manga.chapters) || [];
      let target = chapters.find(ch => Number(ch.chapter_number) === Number(chapterNumber));
      if (!target && chapters.length > 0) {
        const sorted = [...chapters].sort((a, b) => Number(b.chapter_number) - Number(a.chapter_number));
        target = sorted.find(c => Number(c.chapter_number) <= Number(chapterNumber)) || sorted[0];
      }
      if (target) {
        return openReader(mangaId, target.chapter_id, target.chapter_number, state.readMode);
      } else {
        showLoading(false);
        showToast(`Chapter ${chapterNumber} tidak tersedia.`);
      }
    } catch (err) {
      showError(`Gagal membuka chapter: ${err.message}`);
    }
  }

  // Dual-Mode Reader Implementation
  async function openReader(mangaId, chapterId, chapterNumber, mode = 'webtoon', updateHash = true) {
    showLoading(true);
    state.activeMangaId = mangaId;
    state.activeChapterId = chapterId;
    state.activeChapterNumber = chapterNumber;
    state.readMode = mode;
    state.currentPageIndex = 0;

    try {
      const fetchPromises = [
        apiFetch(`/api/chapter/${chapterId}/pages`)
      ];
      if (!state.activeManga || state.activeManga.manga_id !== mangaId || !state.activeManga.chapters) {
        fetchPromises.push(apiFetch(`/api/manga/${mangaId}`));
      }

      const results = await Promise.all(fetchPromises);
      const pagesRes = results[0];
      if (results[1]) {
        state.activeManga = results[1].data || results[1];
      }

      saveReadingProgress(mangaId, chapterId, chapterNumber, mode);

      showLoading(false);
      hideError();
      hideEmpty();
      const pages = pagesRes.pages || pagesRes.data || [];
      state.activeChapterPages = pages;

      if (!pages || pages.length === 0) {
        showError('Tidak ada halaman gambar dalam chapter ini.', () => openReader(mangaId, chapterId, chapterNumber, mode, updateHash));
        return;
      }

      // Populate Header Titles
      const manga = state.activeManga;
      DOM.readerMangaTitle.textContent = (manga && manga.title) || 'Komik';
      DOM.readerChapterTitle.textContent = `Chapter ${chapterNumber}`;
      if (DOM.readerDockChapterText) {
        DOM.readerDockChapterText.textContent = `Ch. ${chapterNumber}`;
      }

      // Populate Chapter Select Dropdown
      populateChapterDropdown();

      // Render Mode
      renderReaderMode();

      switchView('reader');
      if (updateHash) {
        setRoute(`reader/${encodeURIComponent(mangaId)}/${encodeURIComponent(chapterId)}/${encodeURIComponent(chapterNumber)}`);
      }
    } catch (err) {
      showError(`Gagal memuat halaman chapter: ${err.message}`, () => openReader(mangaId, chapterId, chapterNumber, mode, updateHash));
    }
  }

  // Save Reading Progress to Server
  async function saveReadingProgress(mangaId, chapterId, chapterNumber, mode) {
    const manga = state.activeManga;
    const payload = {
      manga_id: mangaId,
      manga_title: (manga && manga.title) || 'Manga',
      cover_url: (manga && manga.cover_image_url) || '',
      chapter_id: chapterId,
      chapter_number: Number(chapterNumber),
      read_mode: mode
    };
    try {
      await apiFetch('/api/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (err) {
      console.warn('Gagal menyimpan progres baca:', err);
    }
  }

  // Adjacent Chapters Helper
  function getAdjacentChapters() {
    const manga = state.activeManga;
    if (!manga) return { nextChapter: null, prevChapter: null, sortedDesc: [] };
    const chapters = manga.chapters || (manga.data && manga.data.chapters) || [];
    if (chapters.length === 0) return { nextChapter: null, prevChapter: null, sortedDesc: [] };

    const sortedDesc = [...chapters].sort((a, b) => Number(b.chapter_number) - Number(a.chapter_number));

    let currentIndex = -1;
    if (state.activeChapterId) {
      currentIndex = sortedDesc.findIndex(c => (c.chapter_id && c.chapter_id === state.activeChapterId) || (c.id && c.id === state.activeChapterId));
    }
    if (currentIndex === -1 && state.activeChapterNumber != null) {
      currentIndex = sortedDesc.findIndex(c => Number(c.chapter_number) === Number(state.activeChapterNumber));
    }

    const nextChapter = currentIndex > 0 ? sortedDesc[currentIndex - 1] : null;
    const prevChapter = (currentIndex >= 0 && currentIndex < sortedDesc.length - 1) ? sortedDesc[currentIndex + 1] : null;
    return { nextChapter, prevChapter, sortedDesc };
  }

  // Populate Dropdown Options
  function populateChapterDropdown() {
    DOM.readerChapterSelect.innerHTML = '';
    const { sortedDesc } = getAdjacentChapters();
    if (!sortedDesc || sortedDesc.length === 0) return;

    sortedDesc.forEach(ch => {
      const opt = document.createElement('option');
      opt.value = ch.chapter_id;
      opt.textContent = `Chapter ${ch.chapter_number}`;
      if (ch.chapter_id === state.activeChapterId || Number(ch.chapter_number) === Number(state.activeChapterNumber)) {
        opt.selected = true;
      }
      DOM.readerChapterSelect.appendChild(opt);
    });

    DOM.readerChapterSelect.onchange = (e) => {
      const chosenId = e.target.value;
      const manga = state.activeManga;
      const ch = manga && manga.chapters && manga.chapters.find(c => c.chapter_id === chosenId);
      if (ch) {
        openReader(state.activeMangaId, ch.chapter_id, ch.chapter_number, state.readMode);
      }
    };

    // Adjacent chapter buttons
    setupChapterNavButtons();
  }

  function setupChapterNavButtons() {
    const { nextChapter, prevChapter } = getAdjacentChapters();

    DOM.readerPrevChapter.disabled = !prevChapter;
    DOM.readerNextChapter.disabled = !nextChapter;

    DOM.readerPrevChapter.onclick = (e) => {
      e.stopPropagation();
      if (prevChapter) {
        openReader(state.activeMangaId, prevChapter.chapter_id, prevChapter.chapter_number, state.readMode);
      }
    };

    DOM.readerNextChapter.onclick = (e) => {
      e.stopPropagation();
      if (nextChapter) {
        openReader(state.activeMangaId, nextChapter.chapter_id, nextChapter.chapter_number, state.readMode);
      }
    };
  }

  // Render Reader View Based on Mode
  function renderReaderMode() {
    const isWebtoon = state.readMode === 'webtoon';
    if (DOM.readerModeToggle) {
      DOM.readerModeToggle.innerHTML = `
        <svg class="btn-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect>
          <line x1="12" y1="18" x2="12" y2="18"></line>
        </svg>
        <span>Mode: ${isWebtoon ? 'Webtoon' : 'Manga'}</span>
      `;
    }

    if (isWebtoon) {
      DOM.webtoonContainer.hidden = false;
      DOM.mangaContainer.hidden = true;
      DOM.readerPrevPage.hidden = true;
      DOM.readerNextPage.hidden = true;
      DOM.readerPageCounter.hidden = true;

      // Render Webtoon continuous vertical images
      DOM.webtoonContainer.innerHTML = '';
      state.activeChapterPages.forEach((url, idx) => {
        const img = document.createElement('img');
        img.className = 'webtoon-img';
        img.src = url;
        img.alt = `Halaman ${idx + 1}`;
        img.loading = 'lazy';
        img.setAttribute('referrerpolicy', 'no-referrer');
        DOM.webtoonContainer.appendChild(img);
      });

      // Render End-of-Chapter Card
      const { nextChapter, prevChapter } = getAdjacentChapters();
      const endCard = document.createElement('div');
      endCard.className = 'chapter-end-card';
      endCard.innerHTML = `
        <span class="chapter-end-badge">Selesai Membaca</span>
        <h3 class="chapter-end-title">Chapter ${state.activeChapterNumber} telah selesai</h3>
        <div class="chapter-end-btn-group">
          ${prevChapter ? `
          <button type="button" class="btn btn-secondary chapter-end-btn end-prev-btn" aria-label="Chapter Sebelumnya">
            <svg class="btn-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
            <span>Ch. ${prevChapter.chapter_number}</span>
          </button>
          ` : ''}
          <button type="button" class="btn btn-secondary chapter-end-btn end-episodes-btn" aria-label="Buka Daftar Episode">
            <svg class="btn-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <line x1="8" y1="6" x2="21" y2="6"></line>
              <line x1="8" y1="12" x2="21" y2="12"></line>
              <line x1="8" y1="18" x2="21" y2="18"></line>
            </svg>
            <span>Daftar Episode</span>
          </button>
          ${nextChapter ? `
          <button type="button" class="btn btn-primary chapter-end-btn end-next-btn" aria-label="Chapter Berikutnya">
            <span>Ch. ${nextChapter.chapter_number}</span>
            <svg class="btn-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </button>
          ` : ''}
        </div>
      `;

      const prevBtn = endCard.querySelector('.end-prev-btn');
      if (prevBtn && prevChapter) {
        prevBtn.onclick = (e) => {
          e.stopPropagation();
          openReader(state.activeMangaId, prevChapter.chapter_id, prevChapter.chapter_number, state.readMode);
        };
      }
      const episodesBtn = endCard.querySelector('.end-episodes-btn');
      if (episodesBtn) {
        episodesBtn.onclick = (e) => {
          e.stopPropagation();
          openEpisodeDrawer();
        };
      }
      const nextBtn = endCard.querySelector('.end-next-btn');
      if (nextBtn && nextChapter) {
        nextBtn.onclick = (e) => {
          e.stopPropagation();
          openReader(state.activeMangaId, nextChapter.chapter_id, nextChapter.chapter_number, state.readMode);
        };
      }

      DOM.webtoonContainer.appendChild(endCard);

      window.scrollTo(0, 0);
      if (DOM.readerView) DOM.readerView.scrollTop = 0;
    } else {
      DOM.webtoonContainer.hidden = true;
      DOM.mangaContainer.hidden = false;
      DOM.readerPrevPage.hidden = false;
      DOM.readerNextPage.hidden = false;
      DOM.readerPageCounter.hidden = false;

      updateMangaSlide();
    }
  }

  // Manga Slide Mode Page Update
  function updateMangaSlide() {
    const pages = state.activeChapterPages;
    const idx = state.currentPageIndex;
    if (pages.length === 0) return;

    DOM.mangaSlideImg.src = pages[idx];
    DOM.mangaSlideImg.alt = `Halaman ${idx + 1} dari ${pages.length}`;
    DOM.readerPageCounter.textContent = `${idx + 1} / ${pages.length}`;

    DOM.readerPrevPage.disabled = idx === 0;
    DOM.readerNextPage.disabled = idx === pages.length - 1;
  }

  function goToNextPage() {
    if (state.currentPageIndex < state.activeChapterPages.length - 1) {
      state.currentPageIndex += 1;
      updateMangaSlide();
    } else {
      const { nextChapter } = getAdjacentChapters();
      if (nextChapter) {
        openReader(state.activeMangaId, nextChapter.chapter_id, nextChapter.chapter_number, state.readMode);
      } else {
        openEpisodeDrawer();
      }
    }
  }

  function goToPrevPage() {
    if (state.currentPageIndex > 0) {
      state.currentPageIndex -= 1;
      updateMangaSlide();
    } else {
      const { prevChapter } = getAdjacentChapters();
      if (prevChapter) {
        openReader(state.activeMangaId, prevChapter.chapter_id, prevChapter.chapter_number, state.readMode);
      } else {
        openEpisodeDrawer();
      }
    }
  }

  // Episode Drawer Logic
  function openEpisodeDrawer() {
    if (!DOM.episodeDrawer) return;
    const manga = state.activeManga;
    if (DOM.episodeDrawerComicTitle) {
      DOM.episodeDrawerComicTitle.textContent = (manga && manga.title) || '';
    }
    if (DOM.episodeSearchInput) {
      DOM.episodeSearchInput.value = '';
    }
    renderEpisodeDrawerList();
    DOM.episodeDrawer.hidden = false;
  }

  function closeEpisodeDrawer() {
    if (!DOM.episodeDrawer) return;
    DOM.episodeDrawer.hidden = true;
  }

  function renderEpisodeDrawerList() {
    if (!DOM.episodeDrawerList) return;
    DOM.episodeDrawerList.innerHTML = '';
    const manga = state.activeManga;
    const chapters = (manga && (manga.chapters || (manga.data && manga.data.chapters))) || [];

    if (chapters.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'episode-drawer-item';
      empty.style.justifyContent = 'center';
      empty.style.color = 'var(--text-muted)';
      empty.textContent = 'Daftar episode tidak tersedia.';
      DOM.episodeDrawerList.appendChild(empty);
      return;
    }

    const query = (DOM.episodeSearchInput && DOM.episodeSearchInput.value.trim().toLowerCase()) || '';
    let filtered = chapters;
    if (query) {
      filtered = chapters.filter(c => {
        const numStr = String(c.chapter_number || '').toLowerCase();
        const titleStr = String(c.chapter_title || '').toLowerCase();
        return numStr.includes(query) || titleStr.includes(query);
      });
    }

    const sorted = [...filtered].sort((a, b) => Number(b.chapter_number || 0) - Number(a.chapter_number || 0));

    sorted.forEach(ch => {
      const isCurrent = (ch.chapter_id && ch.chapter_id === state.activeChapterId) || Number(ch.chapter_number) === Number(state.activeChapterNumber);
      const item = document.createElement('div');
      item.className = `episode-drawer-item ${isCurrent ? 'active' : ''}`;
      item.setAttribute('role', 'listitem');
      item.tabIndex = 0;

      const dateStr = ch.release_date || '';
      const relTime = formatRelativeTime(dateStr);

      item.innerHTML = `
        <div class="ep-item-info">
          <span class="ep-item-num">Chapter ${ch.chapter_number}</span>
          ${isCurrent ? '<span class="ep-badge-active">Sedang Dibaca</span>' : ''}
        </div>
        <div class="ep-item-meta">
          ${relTime ? `<span class="ep-item-date">${relTime}</span>` : ''}
        </div>
      `;

      const clickHandler = () => {
        closeEpisodeDrawer();
        if (!isCurrent) {
          openReader(state.activeMangaId, ch.chapter_id, ch.chapter_number, state.readMode);
        }
      };

      item.onclick = clickHandler;
      item.onkeydown = (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          clickHandler();
        }
      };

      DOM.episodeDrawerList.appendChild(item);
    });
  }

  // Tap Zones & Controller Bar Auto-Hiding
  function toggleReaderControls() {
    state.isControllerVisible = !state.isControllerVisible;
    showReaderControls(state.isControllerVisible);
  }

  function showReaderControls(show) {
    state.isControllerVisible = show;
    if (show) {
      DOM.readerHeader.classList.remove('hidden-bar');
      DOM.readerFooter.classList.remove('hidden-bar');
    } else {
      DOM.readerHeader.classList.add('hidden-bar');
      DOM.readerFooter.classList.add('hidden-bar');
    }
  }

  // Event Listeners for Tap Zones
  if (DOM.tapPrev) DOM.tapPrev.onclick = () => goToPrevPage();
  if (DOM.tapCenter) DOM.tapCenter.onclick = () => toggleReaderControls();
  if (DOM.tapNext) DOM.tapNext.onclick = () => goToNextPage();

  if (DOM.readerPrevPage) DOM.readerPrevPage.onclick = () => goToPrevPage();
  if (DOM.readerNextPage) DOM.readerNextPage.onclick = () => goToNextPage();

  // Mode Toggle Button
  if (DOM.readerModeToggle) {
    DOM.readerModeToggle.onclick = () => {
      state.readMode = state.readMode === 'webtoon' ? 'manga' : 'webtoon';
      renderReaderMode();
      showToast(`Beralih ke mode ${state.readMode === 'webtoon' ? 'Webtoon' : 'Manga Slide'}`);
      saveReadingProgress(state.activeMangaId, state.activeChapterId, state.activeChapterNumber, state.readMode);
    };
  }

  // Webtoon Click to Toggle Controls
  if (DOM.webtoonContainer) {
    DOM.webtoonContainer.onclick = (e) => {
      if (e.target.closest('.chapter-end-card') || e.target.closest('button')) {
        return;
      }
      toggleReaderControls();
    };
  }

  // Webtoon Scroll Auto-Hide Handler
  let lastScrollPos = 0;
  function handleWebtoonScroll() {
    if (state.currentView !== 'reader' || state.readMode !== 'webtoon') return;
    const currentScrollPos = DOM.readerView ? DOM.readerView.scrollTop : window.scrollY;
    if (Math.abs(currentScrollPos - lastScrollPos) < 20) return;

    if (currentScrollPos > lastScrollPos && currentScrollPos > 100) {
      showReaderControls(false);
    } else {
      showReaderControls(true);
    }
    lastScrollPos = currentScrollPos;
  }

  if (DOM.readerView) {
    DOM.readerView.addEventListener('scroll', handleWebtoonScroll, { passive: true });
  }
  window.addEventListener('scroll', handleWebtoonScroll, { passive: true });

  // Download Chapter Flow (.cbz)
  async function triggerChapterDownload(chapterId, mangaTitle, chapterNumber) {
    if (state.activeDownloadPolls.has(chapterId)) {
      showToast('Chapter ini sedang diunduh...');
      return;
    }

    state.activeDownloadPolls.add(chapterId);
    showToast(`Memulai pengunduhan Ch. ${chapterNumber}...`);

    try {
      const payload = {
        manga_id: state.activeMangaId,
        manga_title: mangaTitle || 'Manga',
        chapter_number: Number(chapterNumber),
        total_pages: state.activeChapterPages.length || 0
      };

      await apiFetch(`/api/chapter/${chapterId}/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      pollDownloadStatus(chapterId, chapterNumber);
    } catch (err) {
      state.activeDownloadPolls.delete(chapterId);
      showToast(`Gagal memulai unduhan: ${err.message}`);
    }
  }

  function pollDownloadStatus(chapterId, chapterNumber) {
    const interval = setInterval(async () => {
      try {
        const statusData = await apiFetch(`/api/chapter/${chapterId}/status`);
        const status = statusData.status;

        if (status === 'completed') {
          clearInterval(interval);
          state.activeDownloadPolls.delete(chapterId);
          showToast(`Ch. ${chapterNumber} selesai diunduh. Memulai transfer file...`, 4000);
          
          const link = document.createElement('a');
          link.href = `/api/chapter/${chapterId}/file`;
          link.download = '';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        } else if (status === 'failed') {
          clearInterval(interval);
          state.activeDownloadPolls.delete(chapterId);
          showToast(`Gagal mengunduh Ch. ${chapterNumber}. Silakan coba lagi.`);
        }
      } catch (err) {
        clearInterval(interval);
        state.activeDownloadPolls.delete(chapterId);
        showToast(`Gagal memeriksa status unduhan: ${err.message}`);
      }
    }, 1500);
  }

  // Reader Download Button
  if (DOM.readerDownloadBtn) {
    DOM.readerDownloadBtn.onclick = () => {
      const manga = state.activeManga;
      const title = (manga && manga.title) || 'Manga';
      triggerChapterDownload(state.activeChapterId, title, state.activeChapterNumber);
    };
  }

  // Exit Reader Button
  if (DOM.readerExitBtn) {
    DOM.readerExitBtn.onclick = () => {
      if (state.activeMangaId) {
        setRoute(`manga/${encodeURIComponent(state.activeMangaId)}`);
        openMangaDetail(state.activeMangaId, false);
      } else {
        setRoute('latest');
        switchTab('latest', false);
      }
    };
  }

  // Home Buttons in Reader View
  if (DOM.readerHomeBtn) {
    DOM.readerHomeBtn.onclick = () => {
      setRoute('latest');
      switchTab('latest', false);
    };
  }

  if (DOM.readerDockHomeBtn) {
    DOM.readerDockHomeBtn.onclick = () => {
      setRoute('latest');
      switchTab('latest', false);
    };
  }

  // Reader Episodes Button
  if (DOM.readerEpisodesBtn) {
    DOM.readerEpisodesBtn.onclick = () => {
      openEpisodeDrawer();
    };
  }

  // Reader Floating Dock Chapter Button
  if (DOM.readerChapterDockBtn) {
    DOM.readerChapterDockBtn.onclick = (e) => {
      e.stopPropagation();
      openEpisodeDrawer();
    };
  }

  // Episode Drawer Close Button & Backdrop
  if (DOM.episodeDrawerClose) {
    DOM.episodeDrawerClose.onclick = () => {
      closeEpisodeDrawer();
    };
  }

  if (DOM.episodeDrawerBackdrop) {
    DOM.episodeDrawerBackdrop.onclick = () => {
      closeEpisodeDrawer();
    };
  }

  if (DOM.episodeSearchInput) {
    DOM.episodeSearchInput.addEventListener('input', () => {
      renderEpisodeDrawerList();
    });
  }

  // Back to Catalog Button in Detail View
  if (DOM.detailBackBtn) {
    DOM.detailBackBtn.onclick = () => {
      const targetTab = state.activeTab || 'latest';
      setRoute(targetTab);
      switchTab(targetTab, false);
    };
  }

  // Brand Logo Click
  if (DOM.brandLogo) {
    DOM.brandLogo.onclick = () => {
      setRoute('latest');
      switchTab('latest', false);
    };
    DOM.brandLogo.onkeydown = (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setRoute('latest');
        switchTab('latest', false);
      }
    };
  }

  // Tabs Click Handlers
  if (DOM.tabLatest) DOM.tabLatest.onclick = () => switchTab('latest');
  if (DOM.tabFavorites) DOM.tabFavorites.onclick = () => switchTab('favorites');
  if (DOM.tabHistory) DOM.tabHistory.onclick = () => switchTab('history');
  if (DOM.mobileTabLatest) DOM.mobileTabLatest.onclick = () => switchTab('latest');
  if (DOM.mobileTabFavorites) DOM.mobileTabFavorites.onclick = () => switchTab('favorites');
  if (DOM.mobileTabHistory) DOM.mobileTabHistory.onclick = () => switchTab('history');

  // Search Input Handler (400ms Debounce)
  if (DOM.searchInput) {
    DOM.searchInput.addEventListener('input', (e) => {
      const val = e.target.value;
      if (DOM.searchClearBtn) DOM.searchClearBtn.hidden = val.length === 0;

      if (state.searchDebounceTimer) clearTimeout(state.searchDebounceTimer);
      state.searchDebounceTimer = setTimeout(() => {
        performSearch(val);
      }, 400);
    });

    DOM.searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        if (state.searchDebounceTimer) clearTimeout(state.searchDebounceTimer);
        performSearch(e.target.value);
      }
    });
  }

  // Search Clear Button
  if (DOM.searchClearBtn) {
    DOM.searchClearBtn.onclick = () => {
      DOM.searchInput.value = '';
      DOM.searchClearBtn.hidden = true;
      switchTab(state.activeTab);
    };
  }

  // Keyboard Shortcuts Listener
  window.addEventListener('keydown', (e) => {
    // Escape key closes episode drawer, reader, or detail view
    if (e.key === 'Escape') {
      if (DOM.episodeDrawer && !DOM.episodeDrawer.hidden) {
        closeEpisodeDrawer();
        return;
      }
      if (state.currentView === 'reader') {
        DOM.readerExitBtn.click();
      } else if (state.currentView === 'detail') {
        DOM.detailBackBtn.click();
      }
      return;
    }

    // Reader View Keyboard Navigation
    if (state.currentView === 'reader') {
      if (state.readMode === 'manga') {
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          goToNextPage();
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          goToPrevPage();
        }
      } else if (state.readMode === 'webtoon') {
        if (e.key === 'ArrowRight' || e.key === 'PageDown') {
          e.preventDefault();
          const target = DOM.readerView || window;
          target.scrollBy({ top: window.innerHeight * 0.8, behavior: 'smooth' });
        } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
          e.preventDefault();
          const target = DOM.readerView || window;
          target.scrollBy({ top: -window.innerHeight * 0.8, behavior: 'smooth' });
        }
      }
    }
  });

  // HTML Entity Escaper Utility
  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Window Hashchange Listener for back and forward navigation
  window.addEventListener('hashchange', () => {
    handleRoute();
  });

  // Initial Boot and Route Dispatcher
  if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
  }
  state.lastScrollY = 0;

  // Restore active route (reader, manga detail, or catalog tab) on load or refresh
  handleRoute();
})();
