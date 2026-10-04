/**
 * Kaitoon Web Reader Application
 * Single-Page App with OLED Pure Black Minimalist Interface
 * Ad-free streaming, dual-mode reading, and SQLite multi-device sync
 * Rule R-02 Compliance: Absolutely no em dashes allowed in code, comments, or copy.
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
    sortOrderBtn: document.getElementById('sort-order-btn'),
    chapterList: document.getElementById('chapter-list'),

    // Reader View
    readerView: document.getElementById('reader-view'),
    readerHeader: document.getElementById('reader-header'),
    readerFooter: document.getElementById('reader-footer'),
    readerExitBtn: document.getElementById('reader-exit-btn'),
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
    readerPrevPage: document.getElementById('reader-prev-page'),
    readerNextPage: document.getElementById('reader-next-page'),
    readerChapterSelect: document.getElementById('reader-chapter-select'),
    readerPageCounter: document.getElementById('reader-page-counter')
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

  // UI State Helpers
  function showLoading(show = true) {
    if (DOM.globalLoader) DOM.globalLoader.hidden = !show;
    if (show) {
      hideError();
      hideEmpty();
    }
  }

  function showError(message, retryCallback = null) {
    showLoading(false);
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
      DOM.catalogView.hidden = false;
      DOM.detailView.hidden = true;
      DOM.readerView.hidden = true;
      DOM.appHeader.hidden = false;
      window.scrollTo(0, state.lastScrollY);
    } else if (viewName === 'detail') {
      DOM.catalogView.hidden = true;
      DOM.detailView.hidden = false;
      DOM.readerView.hidden = true;
      DOM.appHeader.hidden = false;
      window.scrollTo(0, 0);
    } else if (viewName === 'reader') {
      state.lastScrollY = window.scrollY;
      DOM.catalogView.hidden = true;
      DOM.detailView.hidden = true;
      DOM.readerView.hidden = false;
      DOM.appHeader.hidden = true;
      showReaderControls(true);
    }
  }

  // Tab Navigation
  function switchTab(tabKey) {
    state.activeTab = tabKey;
    state.catalogPage = 1;
    DOM.searchInput.value = '';
    DOM.searchClearBtn.hidden = true;

    [DOM.tabLatest, DOM.tabFavorites, DOM.tabHistory].forEach(btn => {
      if (btn) btn.classList.remove('active');
    });

    if (tabKey === 'latest') {
      DOM.tabLatest.classList.add('active');
      DOM.catalogTitle.textContent = 'Komik Terbaru';
      loadLatestComics(1);
    } else if (tabKey === 'favorites') {
      DOM.tabFavorites.classList.add('active');
      DOM.catalogTitle.textContent = 'Komik Favorit';
      loadFavorites();
    } else if (tabKey === 'history') {
      DOM.tabHistory.classList.add('active');
      DOM.catalogTitle.textContent = 'Riwayat Baca';
      loadHistory();
    }
    switchView('catalog');
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

  // Live Search
  async function performSearch(query) {
    const q = query.trim();
    if (!q) {
      switchTab(state.activeTab);
      return;
    }

    showLoading(true);
    DOM.comicGrid.innerHTML = '';
    DOM.paginationControls.hidden = true;
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

  // Render Grid Cards
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

      card.innerHTML = `
        <div class="card-poster-wrap">
          <img class="card-poster" src="${posterUrl}" alt="Sampul ${escapeHtml(item.title || '')}" loading="lazy" referrerpolicy="no-referrer">
        </div>
        <div class="card-body">
          <h2 class="card-title">${escapeHtml(item.title || 'Tanpa Judul')}</h2>
          <div class="card-meta">
            ${latestCh ? `<span class="card-ch-pill">Ch. ${latestCh}</span>` : '<span></span>'}
            ${rating ? `<span class="card-rating">&#9733; ${rating}</span>` : ''}
          </div>
        </div>
      `;

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

      card.innerHTML = `
        <div class="card-poster-wrap">
          <img class="card-poster" src="${posterUrl}" alt="Sampul ${escapeHtml(item.manga_title || '')}" loading="lazy" referrerpolicy="no-referrer">
          ${hasNew ? '<span class="card-badge-update">UPDATE</span>' : ''}
        </div>
        <div class="card-body">
          <h2 class="card-title">${escapeHtml(item.manga_title || 'Tanpa Judul')}</h2>
          <div class="card-meta">
            <span class="card-ch-pill">Ch. ${latestCh}</span>
          </div>
        </div>
      `;

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

      card.innerHTML = `
        <div class="card-poster-wrap">
          <img class="card-poster" src="${posterUrl}" alt="Sampul ${escapeHtml(item.manga_title || '')}" loading="lazy" referrerpolicy="no-referrer">
        </div>
        <div class="card-body">
          <h2 class="card-title">${escapeHtml(item.manga_title || 'Tanpa Judul')}</h2>
          <div class="card-meta">
            <span class="card-ch-pill">Terakhir: Ch. ${lastCh}</span>
          </div>
        </div>
      `;

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
  async function openMangaDetail(mangaId) {
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
      setupContinueReadingButton(detail, histItem);

      // Render Chapters
      const chapters = detail.chapters || [];
      DOM.detailChapterCount.textContent = chapters.length;
      renderChapterList(chapters, histItem);

      switchView('detail');
    } catch (err) {
      showError(`Gagal memuat detail komik: ${err.message}`, () => openMangaDetail(mangaId));
    }
  }

  function updateFavoriteButton(isFavorited) {
    if (isFavorited) {
      DOM.detailFavoriteBtn.textContent = 'Hapus dari Favorit';
      DOM.detailFavoriteBtn.classList.remove('btn-secondary');
      DOM.detailFavoriteBtn.classList.add('btn-ghost');
    } else {
      DOM.detailFavoriteBtn.textContent = 'Tambah ke Favorit';
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
    if (historyItem && historyItem.last_chapter_id) {
      targetChapter = chapters.find(c => c.chapter_id === historyItem.last_chapter_id);
      if (targetChapter) {
        DOM.detailContinueBtn.textContent = `Lanjut Baca Ch. ${historyItem.last_chapter_number}`;
      }
    }

    if (!targetChapter) {
      // Find lowest/first chapter
      const sortedAsc = [...chapters].sort((a, b) => Number(a.chapter_number) - Number(b.chapter_number));
      targetChapter = sortedAsc[0];
      DOM.detailContinueBtn.textContent = `Mulai Baca Ch. ${targetChapter.chapter_number}`;
    }

    DOM.detailContinueBtn.onclick = () => {
      const preferredMode = (historyItem && historyItem.read_mode) || state.readMode;
      openReader(manga.manga_id, targetChapter.chapter_id, targetChapter.chapter_number, preferredMode);
    };
  }

  function renderChapterList(chapters, historyItem) {
    DOM.chapterList.innerHTML = '';
    const sorted = [...chapters].sort((a, b) => {
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
          <button class="btn chapter-dl-btn" title="Unduh chapter offline .cbz" aria-label="Unduh chapter ${ch.chapter_number}">Unduh</button>
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
      DOM.sortOrderBtn.textContent = state.chapterSortOrder === 'desc' ? 'Urutan: Terbaru \u2193' : 'Urutan: Terlama \u2191';
      if (state.activeManga && state.activeManga.chapters) {
        renderChapterList(state.activeManga.chapters, null);
      }
    };
  }

  // Dual-Mode Reader Implementation
  async function openReader(mangaId, chapterId, chapterNumber, mode = 'webtoon') {
    showLoading(true);
    state.activeMangaId = mangaId;
    state.activeChapterId = chapterId;
    state.activeChapterNumber = chapterNumber;
    state.readMode = mode;
    state.currentPageIndex = 0;

    try {
      const [pagesRes] = await Promise.all([
        apiFetch(`/api/chapter/${chapterId}/pages`),
        saveReadingProgress(mangaId, chapterId, chapterNumber, mode)
      ]);

      showLoading(false);
      hideError();
      hideEmpty();
      const pages = pagesRes.pages || pagesRes.data || [];
      state.activeChapterPages = pages;

      if (!pages || pages.length === 0) {
        showError('Tidak ada halaman gambar dalam chapter ini.', () => openReader(mangaId, chapterId, chapterNumber, mode));
        return;
      }

      // Populate Header Titles
      const manga = state.activeManga;
      DOM.readerMangaTitle.textContent = (manga && manga.title) || 'Komik';
      DOM.readerChapterTitle.textContent = `Chapter ${chapterNumber}`;

      // Populate Chapter Select Dropdown
      populateChapterDropdown();

      // Render Mode
      renderReaderMode();

      switchView('reader');
    } catch (err) {
      showError(`Gagal memuat halaman chapter: ${err.message}`, () => openReader(mangaId, chapterId, chapterNumber, mode));
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

  // Populate Dropdown Options
  function populateChapterDropdown() {
    DOM.readerChapterSelect.innerHTML = '';
    const manga = state.activeManga;
    if (!manga || !manga.chapters) return;

    // Sort chapters descending for selector
    const sorted = [...manga.chapters].sort((a, b) => Number(b.chapter_number) - Number(a.chapter_number));
    sorted.forEach(ch => {
      const opt = document.createElement('option');
      opt.value = ch.chapter_id;
      opt.textContent = `Chapter ${ch.chapter_number}`;
      if (ch.chapter_id === state.activeChapterId) {
        opt.selected = true;
      }
      DOM.readerChapterSelect.appendChild(opt);
    });

    DOM.readerChapterSelect.onchange = (e) => {
      const chosenId = e.target.value;
      const ch = manga.chapters.find(c => c.chapter_id === chosenId);
      if (ch) {
        openReader(manga.manga_id, ch.chapter_id, ch.chapter_number, state.readMode);
      }
    };

    // Adjacent chapter buttons
    setupChapterNavButtons(sorted);
  }

  function setupChapterNavButtons(sortedDesc) {
    const currentIndex = sortedDesc.findIndex(c => c.chapter_id === state.activeChapterId);
    
    // In sortedDesc: previous chapter has higher index, next chapter has lower index
    const nextChapter = currentIndex > 0 ? sortedDesc[currentIndex - 1] : null;
    const prevChapter = currentIndex < sortedDesc.length - 1 ? sortedDesc[currentIndex + 1] : null;

    DOM.readerPrevChapter.disabled = !prevChapter;
    DOM.readerNextChapter.disabled = !nextChapter;

    DOM.readerPrevChapter.onclick = () => {
      if (prevChapter) {
        openReader(state.activeMangaId, prevChapter.chapter_id, prevChapter.chapter_number, state.readMode);
      }
    };

    DOM.readerNextChapter.onclick = () => {
      if (nextChapter) {
        openReader(state.activeMangaId, nextChapter.chapter_id, nextChapter.chapter_number, state.readMode);
      }
    };
  }

  // Render Reader View Based on Mode
  function renderReaderMode() {
    const isWebtoon = state.readMode === 'webtoon';
    DOM.readerModeToggle.textContent = isWebtoon ? 'Mode: Webtoon' : 'Mode: Manga';

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
      // Last page reached: check next chapter
      showToast('Akhir chapter. Tekan Next Ch untuk chapter berikutnya.');
    }
  }

  function goToPrevPage() {
    if (state.currentPageIndex > 0) {
      state.currentPageIndex -= 1;
      updateMangaSlide();
    } else {
      showToast('Awal chapter.');
    }
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
      // Update reading mode preference in history
      saveReadingProgress(state.activeMangaId, state.activeChapterId, state.activeChapterNumber, state.readMode);
    };
  }

  // Webtoon Click to Toggle Controls
  if (DOM.webtoonContainer) {
    DOM.webtoonContainer.onclick = () => {
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
      // Scrolling down: hide controller
      showReaderControls(false);
    } else {
      // Scrolling up: show controller
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
          
          // Trigger browser file download
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
        switchView('detail');
      } else {
        switchView('catalog');
      }
    };
  }

  // Back to Catalog Button in Detail View
  if (DOM.detailBackBtn) {
    DOM.detailBackBtn.onclick = () => switchView('catalog');
  }

  // Brand Logo Click
  if (DOM.brandLogo) {
    DOM.brandLogo.onclick = () => switchTab('latest');
    DOM.brandLogo.onkeydown = (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        switchTab('latest');
      }
    };
  }

  // Tabs Click Handlers
  if (DOM.tabLatest) DOM.tabLatest.onclick = () => switchTab('latest');
  if (DOM.tabFavorites) DOM.tabFavorites.onclick = () => switchTab('favorites');
  if (DOM.tabHistory) DOM.tabHistory.onclick = () => switchTab('history');

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
    // Escape key closes reader or detail view
    if (e.key === 'Escape') {
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

  // Initial Boot
  loadLatestComics(1);
})();
