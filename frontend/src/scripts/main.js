/**
 * Main Application Orchestrator for Kaitoon Web Reader
 * Astro Client Script Module
 * Rule R-02 Compliance: Zero em dashes or en dashes allowed.
 */

import { apiFetch, formatRelativeTime, escapeHtml } from './api.js';
import { setRoute, handleRoute } from './router.js';
import { createReaderController } from './reader.js';

(() => {
  'use strict';

  // Application State
  const state = {
    currentView: 'catalog',
    activeTab: 'latest',
    activeManga: null,
    activeMangaId: null,
    activeChapterId: null,
    activeChapterNumber: null,
    activeChapterPages: [],
    currentPageIndex: 0,
    readMode: 'webtoon',
    chapterSortOrder: 'desc',
    isControllerVisible: true,
    searchDebounceTimer: null,
    catalogPage: 1,
    catalogTotalPages: null,
    catalogHasNext: true,
    favoritesList: [],
    historyList: [],
    activeHistoryItem: null,
    lastScrollY: 0,
    activeDownloadPolls: new Set(),
    isAutoScrolling: false,
    autoScrollSpeed: parseFloat(localStorage.getItem('autoScrollSpeed')) || 1.0,
    activeServer: localStorage.getItem('kaitoon_server') || 'shinigami',
    renderedTab: 'latest'
  };

  // DOM Elements Cache
  const DOM = {
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

    globalLoader: document.getElementById('global-loader'),
    errorState: document.getElementById('error-state'),
    errorTitle: document.getElementById('error-title'),
    errorMessage: document.getElementById('error-message'),
    retryBtn: document.getElementById('retry-btn'),
    emptyState: document.getElementById('empty-state'),
    emptyTitle: document.getElementById('empty-title'),
    emptyMessage: document.getElementById('empty-message'),
    emptyActionBtn: document.getElementById('empty-action-btn'),

    catalogView: document.getElementById('catalog-view'),
    catalogTitle: document.getElementById('catalog-title'),
    catalogCount: document.getElementById('catalog-count'),
    comicGrid: document.getElementById('comic-grid'),
    paginationControls: document.getElementById('pagination-controls'),
    paginationPages: document.getElementById('pagination-pages'),
    prevPageBtn: document.getElementById('prev-page-btn'),
    nextPageBtn: document.getElementById('next-page-btn'),
    pageNumDisplay: document.getElementById('page-num-display'),
    serverSwitcherBar: document.getElementById('server-switcher-bar'),
    serverBtnShinigami: document.getElementById('server-btn-shinigami'),
    serverBtnKomiku: document.getElementById('server-btn-komiku'),

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
    detailProgressText: document.getElementById('detail-progress-text'),
    detailProgressUnread: document.getElementById('detail-progress-unread'),
    detailMarkAllBtn: document.getElementById('detail-mark-all-btn'),
    chapterFilterInput: document.getElementById('chapter-filter-input'),
    sortOrderBtn: document.getElementById('sort-order-btn'),
    chapterList: document.getElementById('chapter-list'),

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

    // Autoscroll & Speed Settings Controls
    readerAutoscrollBtn: document.getElementById('reader-autoscroll-btn'),
    readerAutoscrollIconPlay: document.getElementById('reader-autoscroll-icon-play'),
    readerAutoscrollIconPause: document.getElementById('reader-autoscroll-icon-pause'),
    readerAutoscrollText: document.getElementById('reader-autoscroll-text'),
    readerSpeedBtn: document.getElementById('reader-speed-btn'),
    readerDockSpeedText: document.getElementById('reader-dock-speed-text'),

    // Floating Autoscroll Status Pill
    autoscrollFloatingPill: document.getElementById('autoscroll-floating-pill'),
    floatingAutoscrollToggle: document.getElementById('floating-autoscroll-toggle'),
    floatingSpeedBtn: document.getElementById('floating-speed-btn'),
    floatingSpeedText: document.getElementById('floating-speed-text'),

    // Autoscroll Settings Modal
    autoscrollModal: document.getElementById('autoscroll-modal'),
    autoscrollModalClose: document.getElementById('autoscroll-modal-close'),
    speedIndicatorVal: document.getElementById('speed-indicator-val'),
    autoscrollSpeedSlider: document.getElementById('autoscroll-speed-slider'),
    modalAutoscrollToggleBtn: document.getElementById('modal-autoscroll-toggle-btn'),
    modalPlayIcon: document.getElementById('modal-play-icon'),
    modalPlayText: document.getElementById('modal-play-text'),

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

  // Slug Helpers
  function slugify(text) {
    if (!text) return '';
    return text
      .toString()
      .toLowerCase()
      .trim()
      .replace(/['"’“”]+/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function getMangaSlug(manga, fallbackId = '') {
    if (manga && manga.slug) return manga.slug;
    if (manga && manga.title) {
      const s = slugify(manga.title);
      if (s) return s;
    }
    return fallbackId || '';
  }

  // Read Chapters Persistence & Local Synchronization
  function getStorageReadChaptersKey(mangaId) {
    return `kaitoon_read_chapters_${mangaId}`;
  }

  function getLocalReadSet(mangaId) {
    if (!mangaId) return new Set();
    try {
      const raw = localStorage.getItem(getStorageReadChaptersKey(mangaId));
      if (!raw) return new Set();
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        return new Set(list.map(String));
      }
      return new Set();
    } catch {
      return new Set();
    }
  }

  function saveLocalReadSet(mangaId, set) {
    if (!mangaId) return;
    try {
      const arr = Array.from(set);
      localStorage.setItem(getStorageReadChaptersKey(mangaId), JSON.stringify(arr));
    } catch {}
  }

  function markChapterAsReadLocal(mangaId, chapterId, chapterNumber) {
    if (!mangaId) return;
    const set = getLocalReadSet(mangaId);
    if (chapterId) set.add(String(chapterId));
    if (chapterNumber != null) set.add(String(chapterNumber));
    saveLocalReadSet(mangaId, set);
  }

  function isChapterRead(mangaId, chapter, historyItem = null) {
    if (!mangaId || !chapter) return false;
    const chId = chapter.chapter_id || chapter.id;
    const chNum = chapter.chapter_number;
    const set1 = getLocalReadSet(mangaId);
    if (chId && set1.has(String(chId))) return true;
    if (chNum != null && set1.has(String(chNum))) return true;
    if (state.activeMangaId && state.activeMangaId !== mangaId) {
      const set2 = getLocalReadSet(state.activeMangaId);
      if (chId && set2.has(String(chId))) return true;
      if (chNum != null && set2.has(String(chNum))) return true;
    }
    if (historyItem) {
      if (chId && historyItem.last_chapter_id && String(historyItem.last_chapter_id) === String(chId)) return true;
      if (chNum != null && historyItem.last_chapter_number != null && Number(chNum) === Number(historyItem.last_chapter_number)) return true;
    }
    return false;
  }

  async function toggleChapterRead(mangaId, chapter, isRead) {
    if (!mangaId || !chapter) return;
    const chId = chapter.chapter_id || chapter.id || '';
    const chNum = chapter.chapter_number != null ? Number(chapter.chapter_number) : null;
    const set = getLocalReadSet(mangaId);
    if (isRead) {
      if (chId) set.add(String(chId));
      if (chNum != null) set.add(String(chNum));
    } else {
      if (chId) set.delete(String(chId));
      if (chNum != null) set.delete(String(chNum));
    }
    saveLocalReadSet(mangaId, set);
    if (state.activeMangaId && state.activeMangaId !== mangaId) {
      saveLocalReadSet(state.activeMangaId, set);
    }

    try {
      await apiFetch('/api/history/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          manga_id: mangaId,
          chapter_id: chId,
          chapter_number: chNum,
          is_read: isRead
        })
      });
    } catch (err) {
      console.warn('Gagal sinkronisasi tanda baca chapter ke server:', err);
    }

    if (state.activeManga && state.activeManga.chapters) {
      renderChapterList(state.activeManga.chapters, state.activeHistoryItem);
    }
  }

  async function markAllChaptersReadHandler(chapters) {
    if (!state.activeMangaId || !chapters || chapters.length === 0) return;
    const mangaId = state.activeMangaId;
    const set = getLocalReadSet(mangaId);
    const chapterPayloads = [];
    chapters.forEach(ch => {
      const chId = ch.chapter_id || ch.id || '';
      const chNum = ch.chapter_number != null ? Number(ch.chapter_number) : null;
      if (chId) set.add(String(chId));
      if (chNum != null) set.add(String(chNum));
      chapterPayloads.push({ chapter_id: chId, chapter_number: chNum });
    });
    saveLocalReadSet(mangaId, set);

    try {
      await apiFetch('/api/history/mark-all-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          manga_id: mangaId,
          chapters: chapterPayloads
        })
      });
      showToast('Semua chapter berhasil ditandai sudah dibaca.');
    } catch (err) {
      showToast(`Gagal menandai semua chapter: ${err.message}`);
    }

    renderChapterList(chapters, state.activeHistoryItem);
  }

  // UI State Helpers
  function showLoading(show = true) {
    if (!DOM.globalLoader) return;
    if (show) {
      hideError();
      hideEmpty();
      DOM.globalLoader.hidden = false;
      DOM.globalLoader.classList.remove('is-finishing');
      DOM.globalLoader.classList.add('is-loading');
    } else {
      DOM.globalLoader.classList.remove('is-loading');
      DOM.globalLoader.classList.add('is-finishing');
      setTimeout(() => {
        if (!DOM.globalLoader.classList.contains('is-loading')) {
          DOM.globalLoader.classList.remove('is-finishing');
          DOM.globalLoader.hidden = true;
        }
      }, 250);
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
        DOM.emptyActionBtn.onclick = () => {
          hideEmpty();
          if (actionCallback) actionCallback();
          else switchTab('latest');
        };
      }
    }
  }

  function hideEmpty() {
    if (DOM.emptyState) DOM.emptyState.hidden = true;
  }

  // View Navigation
  function switchView(viewName) {
    state.currentView = viewName;
    document.documentElement.classList.remove('route-reader-initial', 'route-detail-initial');
    hideError();
    hideEmpty();

    if (viewName !== 'reader') {
      stopAutoScroll();
      closeAutoScrollModal();
    }

    if (viewName === 'catalog') {
      DOM.catalogView.hidden = false;
      DOM.detailView.hidden = true;
      DOM.readerView.hidden = true;
      DOM.appHeader.hidden = false;
      if (DOM.mobileBottomNav) DOM.mobileBottomNav.hidden = false;
      window.scrollTo(0, state.lastScrollY || 0);
    }
 else if (viewName === 'detail') {
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
      readerController.showReaderControls(true);
    }
  }

  // Tab Navigation UI
  function updateTabButtonsUI(tabKey) {
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
      if (DOM.catalogTitle) DOM.catalogTitle.textContent = 'Komik Terbaru';
    } else if (tabKey === 'favorites') {
      if (DOM.tabFavorites) DOM.tabFavorites.classList.add('active');
      if (DOM.mobileTabFavorites) DOM.mobileTabFavorites.classList.add('active');
      if (DOM.catalogTitle) DOM.catalogTitle.textContent = 'Komik Favorit';
    } else if (tabKey === 'history') {
      if (DOM.tabHistory) DOM.tabHistory.classList.add('active');
      if (DOM.mobileTabHistory) DOM.mobileTabHistory.classList.add('active');
      if (DOM.catalogTitle) DOM.catalogTitle.textContent = 'Riwayat Baca';
    }
  }

  // Smooth Catalog Return without Blank Screen
  function returnToCatalog(targetTab = 'latest') {
    const tabKey = targetTab || state.activeTab || 'latest';
    state.activeTab = tabKey;

    if (DOM.comicGrid && DOM.comicGrid.children.length > 0 && (state.renderedTab === tabKey || tabKey === 'latest')) {
      switchView('catalog');
      updateTabButtonsUI(tabKey);
      if (DOM.serverSwitcherBar) {
        DOM.serverSwitcherBar.hidden = (tabKey !== 'latest');
      }
      setRoute(tabKey);
      window.scrollTo(0, state.lastScrollY || 0);
      return;
    }

    switchTab(tabKey, true);
  }

  // Tab Navigation
  function switchTab(tabKey, updateHash = true) {
    state.activeTab = tabKey;
    state.catalogPage = 1;
    state.lastScrollY = 0;
    if (DOM.searchInput) DOM.searchInput.value = '';
    if (DOM.searchClearBtn) DOM.searchClearBtn.hidden = true;

    updateTabButtonsUI(tabKey);

    if (DOM.serverSwitcherBar) {
      DOM.serverSwitcherBar.hidden = (tabKey !== 'latest') || (!DOM.comicGrid || DOM.comicGrid.children.length === 0);
    }

    if (tabKey === 'latest') {
      loadLatestComics(1);
    } else if (tabKey === 'favorites') {
      loadFavorites();
    } else if (tabKey === 'history') {
      loadHistory();
    }
    switchView('catalog');
    if (updateHash) {
      setRoute(tabKey);
    }
  }

  // Server Switcher Controls
  function updateServerSwitcherUI() {
    if (!DOM.serverBtnShinigami || !DOM.serverBtnKomiku) return;
    const isKomiku = state.activeServer === 'komiku';
    DOM.serverBtnShinigami.classList.toggle('active', !isKomiku);
    DOM.serverBtnShinigami.setAttribute('aria-checked', (!isKomiku).toString());
    DOM.serverBtnKomiku.classList.toggle('active', isKomiku);
    DOM.serverBtnKomiku.setAttribute('aria-checked', isKomiku.toString());
  }

  function switchServer(newServer) {
    if (state.activeServer === newServer) return;
    state.activeServer = newServer;
    localStorage.setItem('kaitoon_server', newServer);
    updateServerSwitcherUI();
    showToast(newServer === 'komiku' ? 'Server beralih ke Server 2 (Komiku)' : 'Server beralih ke Server 1 (Shinigami)');
    state.catalogPage = 1;

    // Immediately restore cached catalog for target server if available
    if (state.currentView === 'catalog' && (!DOM.searchInput || !DOM.searchInput.value.trim())) {
      try {
        const cached = localStorage.getItem('kaitoon_catalog_html_' + newServer);
        if (cached && DOM.comicGrid) {
          DOM.comicGrid.innerHTML = cached;
          if (DOM.serverSwitcherBar) DOM.serverSwitcherBar.hidden = false;
        } else if (DOM.comicGrid) {
          DOM.comicGrid.innerHTML = '';
          if (DOM.serverSwitcherBar) DOM.serverSwitcherBar.hidden = true;
        }
      } catch (e) {}
    }

    if (state.currentView === 'catalog') {
      if (DOM.searchInput && DOM.searchInput.value.trim()) {
        performSearch(DOM.searchInput.value.trim());
      } else {
        loadLatestComics(1);
      }
    }
  }

  // Load Latest Comics
  async function loadLatestComics(page = 1) {
    if (DOM.serverSwitcherBar) {
      DOM.serverSwitcherBar.hidden = !DOM.comicGrid || DOM.comicGrid.children.length === 0;
    }
    showLoading(true);

    try {
      const result = await apiFetch(`/api/latest?page=${page}&page_size=24&server=${state.activeServer}`);
      showLoading(false);
      hideError();
      hideEmpty();
      const items = Array.isArray(result) ? result : (result.data || []);

      if (!state.historyList || state.historyList.length === 0) {
        apiFetch('/api/history').then(hist => {
          if (Array.isArray(hist) && hist.length > 0) {
            state.historyList = hist;
            items.forEach(it => {
              const h = hist.find(x => x.manga_id === it.manga_id);
              if (h && h.last_chapter_number && DOM.comicGrid) {
                const card = DOM.comicGrid.querySelector(`[data-manga-id="${it.manga_id}"]`);
                if (card) {
                  const badgeRow = card.querySelector('.card-badge-row');
                  if (badgeRow && !badgeRow.querySelector('.card-pill-progress')) {
                    const pill = document.createElement('span');
                    pill.className = 'card-pill card-pill-progress';
                    pill.textContent = `Dibaca Ch. ${h.last_chapter_number}`;
                    pill.title = `Terakhir dibaca: Ch. ${h.last_chapter_number}`;
                    badgeRow.appendChild(pill);
                  }
                }
              }
            });
          }
        }).catch(() => {});
      }

      if (!items || items.length === 0) {
        DOM.comicGrid.innerHTML = '';
        if (DOM.paginationControls) DOM.paginationControls.hidden = true;
        if (DOM.serverSwitcherBar) DOM.serverSwitcherBar.hidden = true;
        showEmpty('Tidak Ada Komik', 'Belum ada komik terbaru dari server ini.', 'Muat Ulang', () => loadLatestComics(1));
        return;
      }

      state.catalogPage = page;
      if (result && result.meta && result.meta.total_page) {
        state.catalogTotalPages = Number(result.meta.total_page);
      } else {
        state.catalogTotalPages = null;
      }
      state.catalogHasNext = (result && result.meta && result.meta.has_next != null)
        ? Boolean(result.meta.has_next)
        : (state.catalogTotalPages ? state.catalogPage < state.catalogTotalPages : items.length >= (state.activeServer === 'komiku' ? 10 : 20));
      if (DOM.catalogCount) {
        DOM.catalogCount.textContent = `(${items.length} judul)`;
      }

      renderComicGrid(items);
      setupPagination();
      if (DOM.serverSwitcherBar) DOM.serverSwitcherBar.hidden = false;
      state.renderedTab = 'latest';
      if (page > 1) {
        window.scrollTo({ top: 0, behavior: 'instant' });
      }
    } catch (err) {
      showLoading(false);
      showError(`Gagal memuat komik terbaru: ${err.message}`, () => loadLatestComics(page));
    }
  }

  // Load Watchlist
  async function loadFavorites() {
    showLoading(true);

    try {
      const items = await apiFetch('/api/watchlist');
      showLoading(false);
      hideError();
      hideEmpty();
      state.favoritesList = items || [];

      if (!items || items.length === 0) {
        DOM.comicGrid.innerHTML = '';
        if (DOM.paginationControls) DOM.paginationControls.hidden = true;
        if (DOM.serverSwitcherBar) DOM.serverSwitcherBar.hidden = true;
        showEmpty('Belum Ada Favorit', 'Tandai komik favorit Anda untuk menerima pembaruan otomatis.', 'Jelajahi Terbaru', () => switchTab('latest'));
        return;
      }

      if (DOM.paginationControls) DOM.paginationControls.hidden = true;
      if (DOM.serverSwitcherBar) DOM.serverSwitcherBar.hidden = true;
      if (DOM.catalogCount) DOM.catalogCount.textContent = `(${items.length} judul tersimpan)`;
      renderComicGrid(items.map(item => ({
        manga_id: item.manga_id,
        title: item.manga_title,
        cover_image_url: item.cover_url,
        latest_chapter_number: item.latest_chapter_number,
        user_rate: null,
        has_new_update: item.has_new_update
      })));
      state.renderedTab = 'favorites';
    } catch (err) {
      showLoading(false);
      showError(`Gagal memuat favorit: ${err.message}`, () => loadFavorites());
    }
  }

  // Load History
  async function loadHistory() {
    showLoading(true);

    try {
      const items = await apiFetch('/api/history');
      showLoading(false);
      hideError();
      hideEmpty();
      state.historyList = items || [];

      if (!items || items.length === 0) {
        DOM.comicGrid.innerHTML = '';
        if (DOM.paginationControls) DOM.paginationControls.hidden = true;
        if (DOM.serverSwitcherBar) DOM.serverSwitcherBar.hidden = true;
        showEmpty('Belum Ada Riwayat', 'Komik yang Anda baca akan otomatis tercatat di sini.', 'Mulai Membaca', () => switchTab('latest'));
        return;
      }

      if (DOM.paginationControls) DOM.paginationControls.hidden = true;
      if (DOM.serverSwitcherBar) DOM.serverSwitcherBar.hidden = true;
      if (DOM.catalogCount) DOM.catalogCount.textContent = `(${items.length} judul terakhir dibaca)`;
      renderComicGrid(items.map(item => ({
        manga_id: item.manga_id,
        title: item.manga_title,
        cover_image_url: item.cover_url,
        last_chapter_number: item.last_chapter_number,
        last_chapter_id: item.last_chapter_id,
        read_mode: item.read_mode,
        user_rate: null
      })));
      state.renderedTab = 'history';
    } catch (err) {
      showLoading(false);
      showError(`Gagal memuat riwayat: ${err.message}`, () => loadHistory());
    }
  }

  // Render Comic Grid
  function renderComicGrid(items) {
    DOM.comicGrid.innerHTML = '';
    items.forEach(item => {
      const card = document.createElement('div');
      card.className = 'comic-card';
      card.setAttribute('role', 'listitem');
      card.setAttribute('data-manga-id', item.manga_id);
      card.tabIndex = 0;

      const coverUrl = item.cover_image_url || '';
      const title = item.title || 'Tanpa Judul';
      const rating = item.user_rate ? Number(item.user_rate).toFixed(1) : null;
      const latestCh = item.latest_chapter_number;
      const lastCh = item.last_chapter_number;
      const hasUpdate = item.has_new_update;

      let ch1Num = latestCh || lastCh || '';
      let ch2Num = '';
      if (ch1Num && Number(ch1Num) > 1) {
        ch2Num = String(Number(ch1Num) - 1);
      }

      const ch1Id = item.latest_chapter_id || item.last_chapter_id || '';

      const isCh1Read = ch1Num ? isChapterRead(item.manga_id, { chapter_number: ch1Num, chapter_id: ch1Id }) : false;
      const isCh2Read = ch2Num ? isChapterRead(item.manga_id, { chapter_number: ch2Num }) : false;

      const hist = (state.historyList || []).find(h => h.manga_id === item.manga_id);
      const lastReadNum = item.last_chapter_number || (hist && hist.last_chapter_number);

      let timeText = 'Terbaru';
      if (item.release_time) {
        timeText = item.release_time;
      } else if (item.latest_chapter_date) {
        timeText = formatRelativeTime(item.latest_chapter_date) || 'Terbaru';
      } else if (item.updated_at) {
        timeText = formatRelativeTime(item.updated_at) || 'Terbaru';
      }

      card.innerHTML = `
        <div class="card-thumb card-poster-wrap">
          <img class="card-poster" src="${escapeHtml(coverUrl)}" alt="Sampul ${escapeHtml(title)}" loading="lazy" referrerpolicy="no-referrer">
          <div class="card-badge-row">
            ${rating ? `<span class="card-pill card-pill-rating">&star; ${rating}</span>` : ''}
            ${hasUpdate ? '<span class="card-pill card-pill-new">BARU</span>' : ''}
            ${lastReadNum ? `<span class="card-pill card-pill-progress" title="Terakhir dibaca: Ch. ${escapeHtml(String(lastReadNum))}">Dibaca Ch. ${escapeHtml(String(lastReadNum))}</span>` : ''}
          </div>
        </div>
        <div class="card-body">
          <h3 class="card-title" title="${escapeHtml(title)}">${escapeHtml(title)}</h3>
          ${ch1Num ? `
          <div class="card-chapter-row">
            <button type="button" class="card-ch-btn card-ch-btn-1 card-ch-btn-latest ${isCh1Read ? 'is-read-btn' : ''}"
              data-manga-id="${escapeHtml(item.manga_id)}"
              data-ch-id="${escapeHtml(ch1Id)}"
              data-ch-num="${escapeHtml(String(ch1Num))}"
              title="${isCh1Read ? 'Sudah dibaca: Chapter ' + escapeHtml(String(ch1Num)) : 'Belum dibaca: Chapter ' + escapeHtml(String(ch1Num))}">
              <span class="ch-btn-num">Ch. ${escapeHtml(String(ch1Num))}</span>
              <span class="ch-btn-time" title="${escapeHtml(timeText)}">
                ${escapeHtml(timeText)}
                ${isCh1Read ? '<span class="ch-read-icon" title="Sudah dibaca"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg></span>' : '<span class="ch-unread-dot" title="Belum dibaca"></span>'}
              </span>
            </button>
            ${ch2Num ? `
            <button type="button" class="card-ch-btn card-ch-btn-2 ${isCh2Read ? 'is-read-btn' : ''}"
              data-manga-id="${escapeHtml(item.manga_id)}"
              data-ch-num="${escapeHtml(String(ch2Num))}"
              title="${isCh2Read ? 'Sudah dibaca: Chapter ' + escapeHtml(String(ch2Num)) : 'Belum dibaca: Chapter ' + escapeHtml(String(ch2Num))}">
              <span class="ch-btn-num">Ch. ${escapeHtml(String(ch2Num))}</span>
              <span class="ch-btn-action">
                <span>Baca</span>
                ${isCh2Read ? '<span class="ch-read-icon" title="Sudah dibaca"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg></span>' : '<span class="ch-unread-dot" title="Belum dibaca"></span>'}
              </span>
            </button>
            ` : ''}
          </div>
          ` : ''}
        </div>
      `;

      DOM.comicGrid.appendChild(card);
    });

    if (state.currentView === 'catalog' && state.activeTab === 'latest' && state.catalogPage === 1 && items && items.length > 0 && (!DOM.searchInput || !DOM.searchInput.value.trim())) {
      try {
        localStorage.setItem('kaitoon_catalog_html_' + state.activeServer, DOM.comicGrid.innerHTML);
      } catch (e) {}
    }
  }

  // Delegated Click & Keydown Handler for Comic Grid (Supports Cached Frame 0 Cards)
  if (DOM.comicGrid) {
    DOM.comicGrid.addEventListener('click', (e) => {
      const ch1Btn = e.target.closest('.card-ch-btn-1');
      if (ch1Btn) {
        e.stopPropagation();
        const mangaId = ch1Btn.getAttribute('data-manga-id');
        const chId = ch1Btn.getAttribute('data-ch-id');
        const chNum = ch1Btn.getAttribute('data-ch-num');
        if (mangaId) {
          if (chId) {
            openReader(mangaId, chId, chNum, state.readMode);
          } else if (chNum) {
            openDirectChapterByNumber(mangaId, chNum);
          }
        }
        return;
      }

      const ch2Btn = e.target.closest('.card-ch-btn-2');
      if (ch2Btn) {
        e.stopPropagation();
        const mangaId = ch2Btn.getAttribute('data-manga-id');
        const chNum = ch2Btn.getAttribute('data-ch-num');
        if (mangaId && chNum) {
          openDirectChapterByNumber(mangaId, chNum);
        }
        return;
      }

      const card = e.target.closest('.comic-card');
      if (card) {
        const mangaId = card.getAttribute('data-manga-id');
        if (mangaId) {
          openMangaDetail(mangaId);
        }
      }
    });

    DOM.comicGrid.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        if (e.target.closest('button')) return;
        const card = e.target.closest('.comic-card');
        if (card) {
          e.preventDefault();
          const mangaId = card.getAttribute('data-manga-id');
          if (mangaId) {
            openMangaDetail(mangaId);
          }
        }
      }
    });
  }

  // Setup Pagination (< ..234.. >)
  function setupPagination() {
    if (state.activeTab !== 'latest') {
      if (DOM.paginationControls) DOM.paginationControls.hidden = true;
      return;
    }
    if (DOM.paginationControls) DOM.paginationControls.hidden = false;

    if (DOM.pageNumDisplay) {
      DOM.pageNumDisplay.textContent = `Halaman ${state.catalogPage}`;
    }

    const currentPage = state.catalogPage;
    const totalPages = state.catalogTotalPages;
    const hasNext = state.catalogHasNext;

    if (DOM.prevPageBtn) {
      DOM.prevPageBtn.disabled = currentPage <= 1;
      DOM.prevPageBtn.onclick = () => {
        if (currentPage > 1) {
          loadLatestComics(currentPage - 1);
        }
      };
    }

    if (DOM.nextPageBtn) {
      DOM.nextPageBtn.disabled = !hasNext;
      DOM.nextPageBtn.onclick = () => {
        if (hasNext) {
          loadLatestComics(currentPage + 1);
        }
      };
    }

    if (!DOM.paginationPages) return;
    DOM.paginationPages.innerHTML = '';

    // Calculate visible page numbers and ellipsis
    let pages = [];
    let showLeadingEllipsis = false;
    let showTrailingEllipsis = false;

    if (currentPage <= 2) {
      const maxP = totalPages ? Math.min(totalPages, 4) : (hasNext ? 4 : currentPage);
      for (let i = 1; i <= maxP; i++) {
        pages.push(i);
      }
      showLeadingEllipsis = false;
      showTrailingEllipsis = totalPages ? (totalPages > maxP) : hasNext;
    } else {
      showLeadingEllipsis = true;
      if (totalPages && currentPage >= totalPages) {
        const startP = Math.max(1, totalPages - 2);
        for (let i = startP; i <= totalPages; i++) {
          pages.push(i);
        }
        showTrailingEllipsis = false;
      } else if (totalPages && currentPage === totalPages - 1) {
        const startP = Math.max(1, currentPage - 1);
        for (let i = startP; i <= totalPages; i++) {
          pages.push(i);
        }
        showTrailingEllipsis = false;
      } else {
        pages = [currentPage - 1, currentPage, currentPage + 1];
        showTrailingEllipsis = totalPages ? (currentPage + 1 < totalPages) : hasNext;
      }
    }

    // 1. Leading Ellipsis (.. )
    if (showLeadingEllipsis) {
      const leadBtn = document.createElement('button');
      leadBtn.type = 'button';
      leadBtn.className = 'btn-page-ellipsis';
      leadBtn.textContent = '..';
      const targetPage = Math.max(1, currentPage - 3);
      leadBtn.setAttribute('data-page', targetPage.toString());
      leadBtn.setAttribute('aria-label', `Lompat ke halaman ${targetPage}`);
      leadBtn.title = `Lompat ke halaman ${targetPage}`;
      DOM.paginationPages.appendChild(leadBtn);
    }

    // 2. Numbered Page Buttons
    pages.forEach(p => {
      const pageBtn = document.createElement('button');
      pageBtn.type = 'button';
      pageBtn.className = 'btn-page-num' + (p === currentPage ? ' active' : '');
      pageBtn.textContent = p.toString();
      pageBtn.setAttribute('data-page', p.toString());
      pageBtn.setAttribute('aria-label', `Halaman ${p}`);
      if (p === currentPage) {
        pageBtn.setAttribute('aria-current', 'page');
      }
      DOM.paginationPages.appendChild(pageBtn);
    });

    // 3. Trailing Ellipsis (.. )
    if (showTrailingEllipsis) {
      const trailBtn = document.createElement('button');
      trailBtn.type = 'button';
      trailBtn.className = 'btn-page-ellipsis';
      trailBtn.textContent = '..';
      const targetPage = totalPages ? Math.min(totalPages, currentPage + 3) : (currentPage + 3);
      trailBtn.setAttribute('data-page', targetPage.toString());
      trailBtn.setAttribute('aria-label', `Lompat ke halaman ${targetPage}`);
      trailBtn.title = `Lompat ke halaman ${targetPage}`;
      DOM.paginationPages.appendChild(trailBtn);
    }
  }

  // Delegated Click Handler for Page Numbers & Ellipsis
  if (DOM.paginationPages) {
    DOM.paginationPages.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-page]');
      if (btn) {
        const pageNum = parseInt(btn.getAttribute('data-page'), 10);
        if (pageNum && pageNum !== state.catalogPage && pageNum >= 1) {
          loadLatestComics(pageNum);
        }
      }
    });
  }

  // Open Detail View
  async function openMangaDetail(mangaId, updateHash = true) {
    switchView('detail');
    showLoading(true);
    try {
      const [detailRes, historyItems, watchlistItems, serverReadChapters] = await Promise.all([
        apiFetch(`/api/manga/${encodeURIComponent(mangaId)}?server=${state.activeServer}`),
        apiFetch('/api/history').catch(() => []),
        apiFetch('/api/watchlist').catch(() => []),
        apiFetch(`/api/history/${encodeURIComponent(mangaId)}/chapters`).catch(() => [])
      ]);

      showLoading(false);
      hideError();
      hideEmpty();
      const detail = detailRes.data || detailRes;
      state.activeManga = detail;
      const canonicalId = (detail && detail.manga_id) || mangaId;
      state.activeMangaId = canonicalId;
      if (Array.isArray(historyItems)) state.historyList = historyItems;

      if (Array.isArray(serverReadChapters) && serverReadChapters.length > 0) {
        const set = getLocalReadSet(canonicalId);
        serverReadChapters.forEach(rc => {
          if (rc.chapter_id) set.add(String(rc.chapter_id));
          if (rc.chapter_number != null) set.add(String(rc.chapter_number));
        });
        saveLocalReadSet(canonicalId, set);
      }

      if (DOM.chapterFilterInput) DOM.chapterFilterInput.value = '';

      DOM.detailCover.src = detail.cover_image_url || '';
      DOM.detailCover.alt = `Sampul ${detail.title || 'Komik'}`;
      DOM.detailTitle.textContent = detail.title || 'Tanpa Judul';
      DOM.detailAltTitle.textContent = detail.alternative_title || '';
      DOM.detailAltTitle.hidden = !detail.alternative_title;

      const isOngoing = Number(detail.status) === 1;
      DOM.detailStatus.textContent = isOngoing ? 'Ongoing' : 'Tamat';
      DOM.detailRating.textContent = detail.user_rate ? `Rating: ${Number(detail.user_rate).toFixed(1)}` : 'Rating: N/A';
      DOM.detailViews.textContent = detail.view_count ? `${Number(detail.view_count).toLocaleString()} views` : '';
      DOM.detailViews.hidden = !detail.view_count;

      DOM.detailGenres.innerHTML = '';
      const genreList = (detail.taxonomy && detail.taxonomy.Genre) || [];
      genreList.forEach(g => {
        const span = document.createElement('span');
        span.className = 'genre-tag';
        span.textContent = g.name || g;
        DOM.detailGenres.appendChild(span);
      });

      DOM.detailSynopsis.textContent = detail.description || 'Tidak ada sinopsis yang tersedia.';

      const isWatchlisted = watchlistItems.some(w => w.manga_id === canonicalId);
      updateFavoriteButton(isWatchlisted);

      const histItem = historyItems.find(h => h.manga_id === canonicalId);
      state.activeHistoryItem = histItem;
      setupContinueReadingButton(detail, histItem);

      const chapters = detail.chapters || [];
      DOM.detailChapterCount.textContent = `${chapters.length} Chapter`;

      if (DOM.detailMarkAllBtn) {
        DOM.detailMarkAllBtn.onclick = () => {
          markAllChaptersReadHandler(chapters);
        };
      }

      renderChapterList(chapters, histItem);

      switchView('detail');
      if (updateHash) {
        const slug = getMangaSlug(detail, canonicalId);
        setRoute(`manga/${encodeURIComponent(slug)}`);
      }
    } catch (err) {
      showLoading(false);
      showError(`Gagal memuat detail komik: ${err.message}`, () => openMangaDetail(mangaId, updateHash));
    }
  }

  function updateFavoriteButton(isFavorited) {
    if (isFavorited) {
      DOM.detailFavoriteBtn.innerHTML = `
        <svg class="btn-icon-svg" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
        </svg>
        <span>Favorit Tersimpan</span>
      `;
      DOM.detailFavoriteBtn.classList.remove('btn-secondary');
      DOM.detailFavoriteBtn.classList.add('btn-ghost');
    } else {
      DOM.detailFavoriteBtn.innerHTML = `
        <svg class="btn-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
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
    let preferredMode = 'webtoon';

    if (historyItem && historyItem.last_chapter_id) {
      targetChapter = chapters.find(c => c.chapter_id === historyItem.last_chapter_id);
      preferredMode = historyItem.read_mode || 'webtoon';
    }
    if (!targetChapter) {
      const sorted = [...chapters].sort((a, b) => Number(a.chapter_number || 0) - Number(b.chapter_number || 0));
      targetChapter = sorted[0];
    }

    DOM.detailContinueBtn.innerHTML = `
      <svg class="btn-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <polygon points="5 3 19 12 5 21 5 3"></polygon>
      </svg>
      <span>${historyItem ? `Lanjut Ch. ${historyItem.last_chapter_number}` : `Mulai Baca Ch. ${targetChapter.chapter_number}`}</span>
    `;

    DOM.detailContinueBtn.onclick = () => {
      openReader(manga.manga_id, targetChapter.chapter_id, targetChapter.chapter_number, preferredMode);
    };
  }

  function renderChapterList(chapters, historyItem) {
    DOM.chapterList.innerHTML = '';

    // Calculate reading progress counts across all chapters of this comic
    let readCount = 0;
    chapters.forEach(c => {
      if (isChapterRead(state.activeMangaId, c, historyItem)) {
        readCount += 1;
      }
    });
    const totalChapters = chapters.length;
    const unreadCount = Math.max(0, totalChapters - readCount);

    if (DOM.detailProgressText) {
      DOM.detailProgressText.textContent = `Progres: ${readCount} dari ${totalChapters} dibaca`;
    }
    if (DOM.detailProgressUnread) {
      DOM.detailProgressUnread.textContent = `${unreadCount} belum dibaca`;
      DOM.detailProgressUnread.style.display = unreadCount === 0 ? 'none' : 'inline-block';
    }

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
    const lastReadChNum = historyItem ? historyItem.last_chapter_number : null;

    sorted.forEach(ch => {
      const isLastRead = (ch.chapter_id && ch.chapter_id === lastReadChId) ||
                         (lastReadChNum != null && Number(ch.chapter_number) === Number(lastReadChNum));
      const isRead = isChapterRead(state.activeMangaId, ch, historyItem);

      const item = document.createElement('div');
      item.className = 'chapter-item' + (isLastRead ? ' is-last-read' : (isRead ? ' is-read' : ' is-unread'));

      let statusBadge = '';
      if (isLastRead) {
        statusBadge = '<span class="chapter-badge-last-read">Terakhir Dibaca</span>';
      } else if (isRead) {
        statusBadge = `
          <span class="chapter-badge-read">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            <span>Sudah Dibaca</span>
          </span>
        `;
      } else {
        statusBadge = `
          <span class="chapter-badge-unread">
            <span class="unread-dot-indicator"></span>
            <span>Belum Dibaca</span>
          </span>
        `;
      }

      const releaseDate = ch.release_date || '';

      item.innerHTML = `
        <div class="chapter-item-left">
          <span class="chapter-num">Chapter ${ch.chapter_number}</span>
          ${ch.chapter_title ? `<span class="chapter-title">${escapeHtml(ch.chapter_title)}</span>` : ''}
          ${statusBadge}
        </div>
        <div class="chapter-item-right">
          <span class="chapter-date">${formatRelativeTime(releaseDate)}</span>
          <button type="button" class="chapter-toggle-read-btn ${isRead ? 'is-read' : ''}"
            title="${isRead ? 'Tandai belum dibaca' : 'Tandai sudah dibaca'}"
            aria-label="${isRead ? 'Tandai belum dibaca' : 'Tandai sudah dibaca'}">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              ${isRead ? '<polyline points="20 6 9 17 4 12"></polyline>' : '<circle cx="12" cy="12" r="9"></circle>'}
            </svg>
          </button>
        </div>
      `;

      const toggleBtn = item.querySelector('.chapter-toggle-read-btn');
      if (toggleBtn) {
        toggleBtn.onclick = (e) => {
          e.stopPropagation();
          toggleChapterRead(state.activeMangaId, ch, !isRead);
        };
      }

      item.onclick = () => {
        openReader(state.activeMangaId, ch.chapter_id, ch.chapter_number, state.readMode);
      };

      DOM.chapterList.appendChild(item);
    });
  }

  // Direct Chapter Opening Helper
  async function openDirectChapterByNumber(mangaId, chapterNumber, fallbackChapterId = null) {
    if (fallbackChapterId) {
      return openReader(mangaId, fallbackChapterId, chapterNumber, state.readMode);
    }
    try {
      let manga = state.activeManga;
      if (!manga || (manga.manga_id !== mangaId && manga.slug !== mangaId) || !manga.chapters) {
        const res = await apiFetch(`/api/manga/${encodeURIComponent(mangaId)}?server=${state.activeServer}`);
        manga = res.data || res;
        state.activeManga = manga;
      }
      const canonicalId = (manga && manga.manga_id) || mangaId;
      state.activeMangaId = canonicalId;
      const chapters = (manga && manga.chapters) || [];
      let target = chapters.find(ch => Number(ch.chapter_number) === Number(chapterNumber));
      if (!target && chapters.length > 0) {
        const sorted = [...chapters].sort((a, b) => Number(b.chapter_number) - Number(a.chapter_number));
        target = sorted.find(c => Number(c.chapter_number) <= Number(chapterNumber)) || sorted[0];
      }
      if (target) {
        return openReader(canonicalId, target.chapter_id, target.chapter_number, state.readMode);
      } else {
        showToast(`Chapter ${chapterNumber} tidak tersedia.`);
      }
    } catch (err) {
      showError(`Gagal membuka chapter: ${err.message}`);
    }
  }

  // Dual-Mode Reader Implementation
  function getStorageProgressKey(mangaId, chapterId) {
    return `kaitoon_progress_${mangaId}_${chapterId}`;
  }

  function saveLocalProgress(mangaId, chapterId, data) {
    if (!mangaId || !chapterId) return;
    try {
      const key = getStorageProgressKey(mangaId, chapterId);
      const existing = getLocalProgress(mangaId, chapterId) || {};
      const payload = {
        ...existing,
        ...data,
        mangaId,
        chapterId,
        chapterNumber: state.activeChapterNumber,
        readMode: state.readMode,
        timestamp: Date.now()
      };
      localStorage.setItem(key, JSON.stringify(payload));
      localStorage.setItem('kaitoon_last_reader', JSON.stringify({
        mangaId,
        chapterId,
        chapterNumber: state.activeChapterNumber,
        readMode: state.readMode
      }));
    } catch {
      // Ignore storage errors in restricted contexts
    }
  }

  function getLocalProgress(mangaId, chapterId) {
    if (!mangaId || !chapterId) return null;
    try {
      const raw = localStorage.getItem(getStorageProgressKey(mangaId, chapterId));
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function getCurrentReaderScroll() {
    return (DOM.readerView && DOM.readerView.scrollTop) || window.scrollY || 0;
  }

  function saveCurrentWebtoonPosition() {
    if (state.currentView !== 'reader' || state.readMode !== 'webtoon') return;
    if (!state.activeMangaId || !state.activeChapterId) return;

    const scrollTop = getCurrentReaderScroll();
    let imageIndex = 0;
    if (DOM.webtoonContainer) {
      const imgs = DOM.webtoonContainer.querySelectorAll('.webtoon-img');
      const readerTop = DOM.readerView ? DOM.readerView.getBoundingClientRect().top : 0;
      for (let i = 0; i < imgs.length; i++) {
        const rect = imgs[i].getBoundingClientRect();
        if (rect.bottom >= readerTop + 60) {
          imageIndex = i;
          break;
        }
      }
    }

    saveLocalProgress(state.activeMangaId, state.activeChapterId, {
      scrollTop,
      imageIndex
    });
  }

  let webtoonScrollSaveTimer = null;
  function debouncedSaveWebtoonPosition() {
    if (webtoonScrollSaveTimer) clearTimeout(webtoonScrollSaveTimer);
    webtoonScrollSaveTimer = setTimeout(() => {
      saveCurrentWebtoonPosition();
    }, 150);
  }

  function restoreWebtoonPosition(savedProgress) {
    if (!savedProgress) return;
    const targetScroll = Number(savedProgress.scrollTop) || 0;
    const targetImageIdx = Number(savedProgress.imageIndex) || 0;

    const applyScroll = () => {
      if (DOM.readerView && targetScroll > 0) {
        DOM.readerView.scrollTop = targetScroll;
      }
      if (targetScroll > 0) {
        window.scrollTo(0, targetScroll);
      }

      if (targetImageIdx > 0 && DOM.webtoonContainer) {
        const imgs = DOM.webtoonContainer.querySelectorAll('.webtoon-img');
        const targetImg = imgs[targetImageIdx];
        if (targetImg) {
          const rect = targetImg.getBoundingClientRect();
          if (rect.top < -300 || rect.top > window.innerHeight + 300) {
            targetImg.scrollIntoView({ block: 'start', behavior: 'instant' });
          }
        }
      }
    };

    applyScroll();
    requestAnimationFrame(applyScroll);
    setTimeout(applyScroll, 80);
    setTimeout(applyScroll, 250);
  }

  async function openReader(mangaId, chapterId, chapterNumber, mode = 'webtoon', updateHash = true) {
    stopAutoScroll();
    closeAutoScrollModal();
    switchView('reader');
    showLoading(true);
    if (DOM.readerView) DOM.readerView.scrollTop = 0;
    window.scrollTo(0, 0);

    if (state.activeManga && (state.activeManga.manga_id === mangaId || state.activeManga.slug === mangaId)) {
      DOM.readerMangaTitle.textContent = state.activeManga.title || 'Komik';
    }
    if (chapterNumber != null) {
      DOM.readerChapterTitle.textContent = `Chapter ${chapterNumber}`;
      if (DOM.readerDockChapterText) {
        DOM.readerDockChapterText.textContent = `Ch. ${chapterNumber}`;
      }
    }

    if (DOM.webtoonContainer && (!state.activeChapterPages || state.activeChapterPages.length === 0)) {
      DOM.webtoonContainer.innerHTML = '';
    }

    try {
      let manga = state.activeManga;
      if (!manga || (manga.manga_id !== mangaId && manga.slug !== mangaId) || !manga.chapters) {
        const mangaRes = await apiFetch(`/api/manga/${encodeURIComponent(mangaId)}?server=${state.activeServer}`);
        manga = mangaRes.data || mangaRes;
        state.activeManga = manga;
      }

      const realMangaId = (manga && manga.manga_id) || mangaId;
      state.activeMangaId = realMangaId;

      let realChapterId = chapterId;
      let realChapterNumber = chapterNumber;
      const chapters = (manga && manga.chapters) || [];

      if (!realChapterId) {
        let target = chapters.find(ch => Number(ch.chapter_number) === Number(chapterNumber));
        if (!target && chapters.length > 0) {
          const sorted = [...chapters].sort((a, b) => Number(b.chapter_number) - Number(a.chapter_number));
          target = sorted.find(c => Number(c.chapter_number) <= Number(chapterNumber)) || sorted[0];
        }
        if (target) {
          realChapterId = target.chapter_id;
          realChapterNumber = target.chapter_number;
        } else {
          showError(`Chapter ${chapterNumber} tidak tersedia.`);
          return;
        }
      } else if (realChapterNumber == null) {
        const chInfo = chapters.find(c => c.chapter_id === realChapterId);
        if (chInfo) realChapterNumber = chInfo.chapter_number;
      }

      state.activeChapterId = realChapterId;
      state.activeChapterNumber = realChapterNumber;

      const saved = getLocalProgress(realMangaId, realChapterId);
      state.readMode = (saved && saved.readMode) ? saved.readMode : mode;
      state.currentPageIndex = (saved && saved.pageIndex != null) ? Number(saved.pageIndex) : 0;

      const pagesRes = await apiFetch(`/api/chapter/${realChapterId}/pages?server=${state.activeServer}`);
      saveReadingProgress(realMangaId, realChapterId, realChapterNumber, state.readMode);
      saveLocalProgress(realMangaId, realChapterId, { readMode: state.readMode });

      showLoading(false);
      hideError();
      hideEmpty();
      const pages = pagesRes.pages || pagesRes.data || [];
      state.activeChapterPages = pages;

      if (!pages || pages.length === 0) {
        showError('Tidak ada halaman gambar dalam chapter ini.', () => openReader(realMangaId, realChapterId, realChapterNumber, state.readMode, updateHash));
        return;
      }

      DOM.readerMangaTitle.textContent = (manga && manga.title) || 'Komik';
      DOM.readerChapterTitle.textContent = `Chapter ${realChapterNumber}`;
      if (DOM.readerDockChapterText) {
        DOM.readerDockChapterText.textContent = `Ch. ${realChapterNumber}`;
      }

      populateChapterDropdown();
      renderReaderMode();

      switchView('reader');
      if (updateHash) {
        const slug = getMangaSlug(manga, realMangaId);
        setRoute(`reader/${encodeURIComponent(slug)}/${encodeURIComponent(realChapterNumber)}`);
      }
    } catch (err) {
      showLoading(false);
      showError(`Gagal memuat halaman chapter: ${err.message}`, () => openReader(mangaId, chapterId, chapterNumber, state.readMode, updateHash));
    }
  }

  async function saveReadingProgress(mangaId, chapterId, chapterNumber, mode) {
    if (mangaId) {
      markChapterAsReadLocal(mangaId, chapterId, chapterNumber);
      if (state.activeMangaId && state.activeMangaId !== mangaId) {
        markChapterAsReadLocal(state.activeMangaId, chapterId, chapterNumber);
      }
    }
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

      DOM.webtoonContainer.innerHTML = '';
      state.activeChapterPages.forEach((url, i) => {
        const img = document.createElement('img');
        img.className = 'webtoon-img';
        img.src = url;
        img.alt = `Halaman ${i + 1}`;
        img.loading = i < 3 ? 'eager' : 'lazy';
        img.referrerPolicy = 'no-referrer';
        DOM.webtoonContainer.appendChild(img);
      });

      const { nextChapter, prevChapter } = getAdjacentChapters();
      const endCard = document.createElement('div');
      endCard.className = 'chapter-end-card';
      endCard.innerHTML = `
        <span class="chapter-end-badge">Selesai Membaca</span>
        <h3 class="chapter-end-title">Akhir Chapter ${state.activeChapterNumber}</h3>
        <div class="chapter-end-btn-group">
          ${prevChapter ? `
          <button type="button" class="btn btn-secondary chapter-end-btn end-prev-btn" aria-label="Chapter Sebelumnya">
            <svg class="btn-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
            <span>Ch. ${prevChapter.chapter_number}</span>
          </button>
          ` : ''}
          <button type="button" class="btn btn-secondary chapter-end-btn end-episodes-btn" aria-label="Daftar Episode">
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
          readerController.openEpisodeDrawer();
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
      readerController.preloadNearbyImages(state.activeChapterPages, 0);

      const savedProgress = getLocalProgress(state.activeMangaId, state.activeChapterId);
      if (savedProgress && (Number(savedProgress.scrollTop) > 50 || Number(savedProgress.imageIndex) > 0)) {
        restoreWebtoonPosition(savedProgress);
      } else {
        window.scrollTo(0, 0);
        if (DOM.readerView) DOM.readerView.scrollTop = 0;
      }
    } else {
      DOM.webtoonContainer.hidden = true;
      DOM.mangaContainer.hidden = false;
      DOM.readerPrevPage.hidden = false;
      DOM.readerNextPage.hidden = false;
      DOM.readerPageCounter.hidden = false;

      const savedProgress = getLocalProgress(state.activeMangaId, state.activeChapterId);
      if (savedProgress && Number(savedProgress.pageIndex) > 0) {
        state.currentPageIndex = Math.min(Number(savedProgress.pageIndex), (state.activeChapterPages || []).length - 1);
      }
      readerController.updateMangaSlide();
    }
  }

  // Reader Controller Instance
  const readerController = createReaderController({
    state,
    DOM,
    openReaderCallback: (mangaId, chapterId, chapterNumber, mode) => {
      openReader(mangaId, chapterId, chapterNumber, mode);
    },
    onPageChangeCallback: (pageIndex) => {
      saveLocalProgress(state.activeMangaId, state.activeChapterId, { pageIndex });
    },
    isChapterReadCallback: (ch) => {
      return isChapterRead(state.activeMangaId, ch, state.activeHistoryItem);
    }
  });

  // Tap Zones Listeners
  if (DOM.tapPrev) DOM.tapPrev.onclick = () => readerController.goToPrevPage(getAdjacentChapters);
  if (DOM.tapCenter) DOM.tapCenter.onclick = () => readerController.toggleReaderControls();
  if (DOM.tapNext) DOM.tapNext.onclick = () => readerController.goToNextPage(getAdjacentChapters);

  if (DOM.readerPrevPage) DOM.readerPrevPage.onclick = () => readerController.goToPrevPage(getAdjacentChapters);
  if (DOM.readerNextPage) DOM.readerNextPage.onclick = () => readerController.goToNextPage(getAdjacentChapters);

  if (DOM.readerModeToggle) {
    DOM.readerModeToggle.onclick = () => {
      state.readMode = state.readMode === 'webtoon' ? 'manga' : 'webtoon';
      renderReaderMode();
      showToast(`Beralih ke mode ${state.readMode === 'webtoon' ? 'Webtoon' : 'Manga Slide'}`);
      saveReadingProgress(state.activeMangaId, state.activeChapterId, state.activeChapterNumber, state.readMode);
      saveLocalProgress(state.activeMangaId, state.activeChapterId, { readMode: state.readMode });
    };
  }

  if (DOM.webtoonContainer) {
    DOM.webtoonContainer.onclick = (e) => {
      if (e.target.closest('.chapter-end-card') || e.target.closest('button')) return;
      readerController.toggleReaderControls();
    };
  }

  // Scroll Auto-Hide and Position Saving
  let lastScrollPos = 0;
  function handleWebtoonScroll() {
    if (state.currentView !== 'reader' || state.readMode !== 'webtoon') return;
    const currentScrollPos = getCurrentReaderScroll();
    debouncedSaveWebtoonPosition();

    if (state.isAutoScrolling) {
      lastScrollPos = currentScrollPos;
      return;
    }

    if (Math.abs(currentScrollPos - lastScrollPos) < 20) return;

    if (currentScrollPos > lastScrollPos && currentScrollPos > 100) {
      readerController.showReaderControls(false);
    } else {
      readerController.showReaderControls(true);
    }
    lastScrollPos = currentScrollPos;
  }

  if (DOM.readerView) {
    DOM.readerView.addEventListener('scroll', handleWebtoonScroll, { passive: true });
  }
  window.addEventListener('scroll', handleWebtoonScroll, { passive: true });

  // Auto Play Scroll Engine
  let autoScrollAnimId = null;
  let lastAutoScrollTimestamp = 0;

  function autoScrollStep(timestamp) {
    if (!state.isAutoScrolling || state.currentView !== 'reader' || state.readMode !== 'webtoon') {
      stopAutoScroll();
      return;
    }

    if (!lastAutoScrollTimestamp) {
      lastAutoScrollTimestamp = timestamp;
    }
    const deltaSeconds = Math.min((timestamp - lastAutoScrollTimestamp) / 1000, 0.1);
    lastAutoScrollTimestamp = timestamp;

    const currentSpeed = Number(state.autoScrollSpeed) || 1.0;
    const pixelsToScroll = 180 * currentSpeed * deltaSeconds;

    if (DOM.readerView) {
      DOM.readerView.scrollTop += pixelsToScroll;
    } else {
      window.scrollBy(0, pixelsToScroll);
    }

    const scrollContainer = DOM.readerView || document.documentElement;
    const isAtBottom = (scrollContainer.scrollTop + scrollContainer.clientHeight) >= (scrollContainer.scrollHeight - 20);
    if (isAtBottom) {
      stopAutoScroll();
      showToast('Akhir chapter tercapai.');
      return;
    }

    autoScrollAnimId = requestAnimationFrame(autoScrollStep);
  }

  function startAutoScroll() {
    if (state.currentView !== 'reader' || state.readMode !== 'webtoon') {
      showToast('Auto scroll hanya tersedia pada mode Webtoon.');
      return;
    }
    state.isAutoScrolling = true;
    lastAutoScrollTimestamp = 0;
    lastScrollPos = getCurrentReaderScroll();
    readerController.showReaderControls(true);
    updateAutoScrollUI(true);
    autoScrollAnimId = requestAnimationFrame(autoScrollStep);
  }

  function stopAutoScroll() {
    state.isAutoScrolling = false;
    if (autoScrollAnimId) {
      cancelAnimationFrame(autoScrollAnimId);
      autoScrollAnimId = null;
    }
    lastAutoScrollTimestamp = 0;
    lastScrollPos = getCurrentReaderScroll();
    readerController.showReaderControls(true);
    updateAutoScrollUI(false);
  }

  function toggleAutoScroll() {
    if (state.isAutoScrolling) {
      stopAutoScroll();
    } else {
      startAutoScroll();
    }
  }

  function setAutoScrollSpeed(speed) {
    const validSpeed = Math.round(Number(speed) * 100) / 100;
    state.autoScrollSpeed = validSpeed;
    try {
      localStorage.setItem('autoScrollSpeed', String(validSpeed));
    } catch {
      // Ignore storage errors in restricted contexts
    }
    updateSpeedUI(validSpeed);
  }

  function updateAutoScrollUI(isPlaying) {
    if (DOM.readerAutoscrollBtn) {
      if (isPlaying) {
        DOM.readerAutoscrollBtn.classList.add('is-playing');
        DOM.readerAutoscrollBtn.setAttribute('title', 'Jeda Auto Scroll (Spasi)');
        DOM.readerAutoscrollBtn.setAttribute('aria-label', 'Jeda Auto Scroll');
        if (DOM.readerAutoscrollIconPlay) DOM.readerAutoscrollIconPlay.hidden = true;
        if (DOM.readerAutoscrollIconPause) DOM.readerAutoscrollIconPause.hidden = false;
        if (DOM.readerAutoscrollText) DOM.readerAutoscrollText.textContent = 'Jeda';
      } else {
        DOM.readerAutoscrollBtn.classList.remove('is-playing');
        DOM.readerAutoscrollBtn.setAttribute('title', 'Putar Auto Scroll (Spasi)');
        DOM.readerAutoscrollBtn.setAttribute('aria-label', 'Putar Auto Scroll');
        if (DOM.readerAutoscrollIconPlay) DOM.readerAutoscrollIconPlay.hidden = false;
        if (DOM.readerAutoscrollIconPause) DOM.readerAutoscrollIconPause.hidden = true;
        if (DOM.readerAutoscrollText) DOM.readerAutoscrollText.textContent = 'Auto';
      }
    }

    if (DOM.modalAutoscrollToggleBtn) {
      if (DOM.modalPlayText) {
        DOM.modalPlayText.textContent = isPlaying ? 'Jeda Auto Scroll' : 'Mulai Auto Scroll';
      }
      if (DOM.modalPlayIcon) {
        DOM.modalPlayIcon.innerHTML = isPlaying
          ? '<rect x="6" y="4" width="4" height="16" rx="1"></rect><rect x="14" y="4" width="4" height="16" rx="1"></rect>'
          : '<polygon points="5 3 19 12 5 21 5 3"></polygon>';
      }
    }
  }

  function updateSpeedUI(speed) {
    const text = `${speed}x`;
    if (DOM.readerDockSpeedText) DOM.readerDockSpeedText.textContent = text;
    if (DOM.speedIndicatorVal) DOM.speedIndicatorVal.textContent = text;

    if (DOM.autoscrollSpeedSlider) {
      DOM.autoscrollSpeedSlider.value = Math.round(speed * 100);
    }

    const presetBtns = document.querySelectorAll('.speed-preset-btn');
    presetBtns.forEach(btn => {
      const btnSpeed = Number(btn.dataset.speed);
      if (Math.abs(btnSpeed - speed) < 0.05) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  function openAutoScrollModal() {
    if (!DOM.autoscrollModal) return;
    updateSpeedUI(state.autoScrollSpeed);
    updateAutoScrollUI(state.isAutoScrolling);
    DOM.autoscrollModal.hidden = false;
  }

  function closeAutoScrollModal() {
    if (!DOM.autoscrollModal) return;
    DOM.autoscrollModal.hidden = true;
  }

  // Event Listeners for Autoscroll Controls
  if (DOM.readerAutoscrollBtn) {
    DOM.readerAutoscrollBtn.onclick = (e) => {
      e.stopPropagation();
      toggleAutoScroll();
    };
  }

  if (DOM.readerSpeedBtn) {
    DOM.readerSpeedBtn.onclick = (e) => {
      e.stopPropagation();
      openAutoScrollModal();
    };
  }

  if (DOM.autoscrollModalClose) {
    DOM.autoscrollModalClose.onclick = (e) => {
      if (e) e.stopPropagation();
      closeAutoScrollModal();
    };
  }

  if (DOM.autoscrollModal) {
    DOM.autoscrollModal.onclick = (e) => {
      if (e.target === DOM.autoscrollModal) {
        closeAutoScrollModal();
      }
    };
  }

  if (DOM.modalAutoscrollToggleBtn) {
    DOM.modalAutoscrollToggleBtn.onclick = (e) => {
      if (e) e.stopPropagation();
      toggleAutoScroll();
    };
  }

  if (DOM.autoscrollSpeedSlider) {
    DOM.autoscrollSpeedSlider.addEventListener('input', (e) => {
      const spd = Number(e.target.value) / 100;
      setAutoScrollSpeed(spd);
    });
  }

  const speedPresetButtons = document.querySelectorAll('.speed-preset-btn');
  speedPresetButtons.forEach(btn => {
    btn.onclick = (e) => {
      if (e) e.stopPropagation();
      const spd = Number(btn.dataset.speed);
      if (spd) {
        setAutoScrollSpeed(spd);
      }
    };
  });

  if (DOM.readerView) {
    DOM.readerView.addEventListener('wheel', (e) => {
      if (state.isAutoScrolling && e.deltaY < -20) {
        stopAutoScroll();
      }
    }, { passive: true });
  }

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
        total_pages: (state.activeChapterPages || []).length || 0
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
        const status = await apiFetch(`/api/chapter/${chapterId}/status`);
        if (status.status === 'completed') {
          clearInterval(interval);
          state.activeDownloadPolls.delete(chapterId);
          showToast(`Unduhan Ch. ${chapterNumber} selesai! Tersimpan di folder unduhan.`);
        } else if (status.status === 'failed') {
          clearInterval(interval);
          state.activeDownloadPolls.delete(chapterId);
          showToast(`Unduhan Ch. ${chapterNumber} gagal: ${status.error || 'Terjadi kesalahan'}`);
        }
      } catch {
        clearInterval(interval);
        state.activeDownloadPolls.delete(chapterId);
      }
    }, 2000);
  }

  if (DOM.readerDownloadBtn) {
    DOM.readerDownloadBtn.onclick = () => {
      const manga = state.activeManga;
      const title = (manga && manga.title) || 'Manga';
      triggerChapterDownload(state.activeChapterId, title, state.activeChapterNumber);
    };
  }

  // Navigation Button Handlers
  if (DOM.readerExitBtn) {
    DOM.readerExitBtn.onclick = () => {
      const manga = state.activeManga;
      const slug = getMangaSlug(manga, state.activeMangaId);
      if (slug) {
        setRoute(`manga/${encodeURIComponent(slug)}`);
        openMangaDetail(state.activeMangaId || slug, false);
      } else {
        returnToCatalog('latest');
      }
    };
  }

  if (DOM.readerHomeBtn) {
    DOM.readerHomeBtn.onclick = () => {
      returnToCatalog('latest');
    };
  }

  if (DOM.readerDockHomeBtn) {
    DOM.readerDockHomeBtn.onclick = () => {
      returnToCatalog('latest');
    };
  }

  if (DOM.readerEpisodesBtn) {
    DOM.readerEpisodesBtn.onclick = () => {
      readerController.openEpisodeDrawer();
    };
  }

  if (DOM.readerChapterDockBtn) {
    DOM.readerChapterDockBtn.onclick = (e) => {
      e.stopPropagation();
      readerController.openEpisodeDrawer();
    };
  }

  if (DOM.episodeDrawerClose) {
    DOM.episodeDrawerClose.onclick = () => {
      readerController.closeEpisodeDrawer();
    };
  }

  if (DOM.episodeDrawerBackdrop) {
    DOM.episodeDrawerBackdrop.onclick = () => {
      readerController.closeEpisodeDrawer();
    };
  }

  if (DOM.episodeSearchInput) {
    DOM.episodeSearchInput.addEventListener('input', () => {
      readerController.renderEpisodeDrawerList();
    });
  }

  if (DOM.detailBackBtn) {
    DOM.detailBackBtn.onclick = () => {
      returnToCatalog(state.activeTab || 'latest');
    };
  }

  if (DOM.brandLogo) {
    DOM.brandLogo.onclick = () => {
      returnToCatalog('latest');
    };
    DOM.brandLogo.onkeydown = (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setRoute('latest');
        switchTab('latest', false);
      }
    };
  }

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

  if (DOM.chapterFilterInput) {
    DOM.chapterFilterInput.addEventListener('input', () => {
      if (state.activeManga && state.activeManga.chapters) {
        renderChapterList(state.activeManga.chapters, state.activeHistoryItem);
      }
    });
  }

  // Tabs Click Handlers
  if (DOM.tabLatest) DOM.tabLatest.onclick = () => switchTab('latest');
  if (DOM.tabFavorites) DOM.tabFavorites.onclick = () => switchTab('favorites');
  if (DOM.tabHistory) DOM.tabHistory.onclick = () => switchTab('history');
  if (DOM.mobileTabLatest) DOM.mobileTabLatest.onclick = () => switchTab('latest');
  if (DOM.mobileTabFavorites) DOM.mobileTabFavorites.onclick = () => switchTab('favorites');
  if (DOM.mobileTabHistory) DOM.mobileTabHistory.onclick = () => switchTab('history');

  // Search Input Handler (400ms Debounce)
  async function performSearch(query) {
    const trimmed = query.trim();
    if (!trimmed) {
      returnToCatalog(state.activeTab || 'latest');
      return;
    }

    if (DOM.serverSwitcherBar) {
      DOM.serverSwitcherBar.hidden = !DOM.comicGrid || DOM.comicGrid.children.length === 0;
    }
    DOM.catalogTitle.textContent = `Hasil Pencarian: "${trimmed}"`;
    showLoading(true);

    try {
      const results = await apiFetch(`/api/search?q=${encodeURIComponent(trimmed)}&server=${state.activeServer}`);
      showLoading(false);
      hideError();
      hideEmpty();

      const items = Array.isArray(results) ? results : (results.data || []);
      if (DOM.paginationControls) DOM.paginationControls.hidden = true;
      if (DOM.catalogCount) DOM.catalogCount.textContent = `(${items.length} ditemukan)`;

      if (items.length === 0) {
        DOM.comicGrid.innerHTML = '';
        if (DOM.serverSwitcherBar) DOM.serverSwitcherBar.hidden = true;
        showEmpty('Tidak Ditemukan', `Tidak ada komik yang cocok dengan "${trimmed}".`, 'Lihat Terbaru', () => returnToCatalog('latest'));
        return;
      }

      renderComicGrid(items);
      if (DOM.serverSwitcherBar) DOM.serverSwitcherBar.hidden = false;
      state.renderedTab = 'search';
    } catch (err) {
      showLoading(false);
      showError(`Gagal mencari komik: ${err.message}`, () => performSearch(trimmed));
    }
  }

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

  if (DOM.searchClearBtn) {
    DOM.searchClearBtn.onclick = () => {
      DOM.searchInput.value = '';
      DOM.searchClearBtn.hidden = true;
      switchTab(state.activeTab);
    };
  }

  // Keyboard Shortcuts Listener
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (DOM.autoscrollModal && !DOM.autoscrollModal.hidden) {
        closeAutoScrollModal();
        return;
      }
      if (DOM.episodeDrawer && !DOM.episodeDrawer.hidden) {
        readerController.closeEpisodeDrawer();
        return;
      }
      if (state.currentView === 'reader') {
        DOM.readerExitBtn.click();
      } else if (state.currentView === 'detail') {
        DOM.detailBackBtn.click();
      }
      return;
    }

    if (state.currentView === 'reader') {
      if (e.key === ' ' || e.code === 'Space') {
        const activeTag = document.activeElement ? document.activeElement.tagName : '';
        if (activeTag !== 'INPUT' && activeTag !== 'TEXTAREA') {
          e.preventDefault();
          toggleAutoScroll();
          return;
        }
      }

      if (e.key === '[' || e.key === '-') {
        e.preventDefault();
        const newSpeed = Math.max(0.5, (Number(state.autoScrollSpeed) || 1.0) - 0.25);
        setAutoScrollSpeed(newSpeed);
        showToast(`Kecepatan: ${newSpeed}x`);
        return;
      }

      if (e.key === ']' || e.key === '=' || e.key === '+') {
        e.preventDefault();
        const newSpeed = Math.min(2.0, (Number(state.autoScrollSpeed) || 1.0) + 0.25);
        setAutoScrollSpeed(newSpeed);
        showToast(`Kecepatan: ${newSpeed}x`);
        return;
      }

      if (state.readMode === 'manga') {
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          readerController.goToNextPage(getAdjacentChapters);
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          readerController.goToPrevPage(getAdjacentChapters);
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

  // Window Hashchange Listener for back and forward navigation
  window.addEventListener('hashchange', () => {
    handleRoute({
      onReader: (mangaId, chapterId, chapterNumber) => openReader(mangaId, chapterId, chapterNumber, state.readMode, false),
      onManga: (mangaId) => openMangaDetail(mangaId, false),
      onTab: (tabKey) => switchTab(tabKey, false)
    });
  });

  // Mobile app/tab switch persistence and restoration
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      if (state.isAutoScrolling) {
        stopAutoScroll();
      }
      if (state.currentView === 'reader') {
        if (state.readMode === 'webtoon') {
          saveCurrentWebtoonPosition();
        } else if (state.readMode === 'manga') {
          saveLocalProgress(state.activeMangaId, state.activeChapterId, { pageIndex: state.currentPageIndex });
        }
      }
    } else if (document.visibilityState === 'visible') {
      if (state.currentView === 'reader' && state.readMode === 'webtoon') {
        const currentScroll = getCurrentReaderScroll();
        const saved = getLocalProgress(state.activeMangaId, state.activeChapterId);
        if (currentScroll < 20 && saved && (Number(saved.scrollTop) > 50 || Number(saved.imageIndex) > 0)) {
          restoreWebtoonPosition(saved);
        }
      }
    }
  });

  window.addEventListener('pagehide', () => {
    if (state.isAutoScrolling) {
      stopAutoScroll();
    }
    if (state.currentView === 'reader') {
      if (state.readMode === 'webtoon') {
        saveCurrentWebtoonPosition();
      } else if (state.readMode === 'manga') {
        saveLocalProgress(state.activeMangaId, state.activeChapterId, { pageIndex: state.currentPageIndex });
      }
    }
  });

  window.addEventListener('beforeunload', () => {
    if (state.isAutoScrolling) {
      stopAutoScroll();
    }
    if (state.currentView === 'reader') {
      if (state.readMode === 'webtoon') {
        saveCurrentWebtoonPosition();
      } else if (state.readMode === 'manga') {
        saveLocalProgress(state.activeMangaId, state.activeChapterId, { pageIndex: state.currentPageIndex });
      }
    }
  });

  // Initial Boot and Route Dispatcher
  if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
  }
  state.lastScrollY = 0;

  // Initialize Autoscroll Speed UI
  updateSpeedUI(state.autoScrollSpeed);

  // Initialize Server Switcher UI
  if (DOM.serverBtnShinigami) {
    DOM.serverBtnShinigami.onclick = () => switchServer('shinigami');
  }
  if (DOM.serverBtnKomiku) {
    DOM.serverBtnKomiku.onclick = () => switchServer('komiku');
  }
  updateServerSwitcherUI();

  // Restore active route on load or refresh
  handleRoute({
    onReader: (mangaId, chapterId, chapterNumber) => openReader(mangaId, chapterId, chapterNumber, state.readMode, false),
    onManga: (mangaId) => openMangaDetail(mangaId, false),
    onTab: (tabKey) => switchTab(tabKey, false)
  });
})();
