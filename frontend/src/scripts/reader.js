/**
 * Dual-Mode Reader Engine and Episode Drawer for Kaitoon Web Reader
 * Rule R-02 Compliance: Zero em dashes or en dashes allowed.
 */

import { formatRelativeTime } from './api.js';

export function createReaderController({ state, DOM, openReaderCallback, onPageChangeCallback, isChapterReadCallback }) {
  function toggleReaderControls() {
    state.isControllerVisible = !state.isControllerVisible;
    showReaderControls(state.isControllerVisible);
  }

  function showReaderControls(show) {
    state.isControllerVisible = show;
    if (show) {
      if (DOM.readerHeader) DOM.readerHeader.classList.remove('hidden-bar');
      if (DOM.readerFooter) DOM.readerFooter.classList.remove('hidden-bar');
    } else {
      if (DOM.readerHeader) DOM.readerHeader.classList.add('hidden-bar');
      if (DOM.readerFooter) DOM.readerFooter.classList.add('hidden-bar');
    }
  }

  function preloadNearbyImages(pages, currentIndex) {
    if (!pages || pages.length === 0) return;
    const targets = [
      currentIndex + 1,
      currentIndex + 2,
      currentIndex + 3,
      currentIndex - 1
    ];
    for (const i of targets) {
      if (i >= 0 && i < pages.length && pages[i]) {
        const img = new Image();
        img.referrerPolicy = 'no-referrer';
        img.src = pages[i];
      }
    }
  }

  function updateMangaSlide() {
    const pages = state.activeChapterPages || [];
    const idx = state.currentPageIndex;
    if (pages.length === 0) return;

    const targetUrl = pages[idx];
    if (DOM.mangaSlideImg && targetUrl) {
      const probe = new Image();
      probe.referrerPolicy = 'no-referrer';
      probe.src = targetUrl;

      if (probe.complete) {
        DOM.mangaSlideImg.src = targetUrl;
        DOM.mangaSlideImg.alt = `Halaman ${idx + 1} dari ${pages.length}`;
        DOM.mangaSlideImg.style.opacity = '1';
      } else {
        DOM.mangaSlideImg.style.opacity = '0.6';
        probe.onload = () => {
          if (state.currentPageIndex === idx && DOM.mangaSlideImg) {
            DOM.mangaSlideImg.src = targetUrl;
            DOM.mangaSlideImg.alt = `Halaman ${idx + 1} dari ${pages.length}`;
            DOM.mangaSlideImg.style.opacity = '1';
          }
        };
        probe.onerror = () => {
          if (state.currentPageIndex === idx && DOM.mangaSlideImg) {
            DOM.mangaSlideImg.src = targetUrl;
            DOM.mangaSlideImg.style.opacity = '1';
          }
        };
      }
    }
    if (DOM.readerPageCounter) {
      DOM.readerPageCounter.textContent = `${idx + 1} / ${pages.length}`;
    }
    if (DOM.readerPrevPage) {
      DOM.readerPrevPage.disabled = idx === 0;
    }
    if (DOM.readerNextPage) {
      DOM.readerNextPage.disabled = idx === pages.length - 1;
    }
    if (typeof onPageChangeCallback === 'function') {
      onPageChangeCallback(idx);
    }
    preloadNearbyImages(pages, idx);
  }

  function goToNextPage(getAdjacentChapters) {
    if (state.currentPageIndex < (state.activeChapterPages || []).length - 1) {
      state.currentPageIndex += 1;
      updateMangaSlide();
    } else {
      const { nextChapter } = getAdjacentChapters();
      if (nextChapter && openReaderCallback) {
        openReaderCallback(state.activeMangaId, nextChapter.chapter_id, nextChapter.chapter_number, state.readMode);
      } else {
        openEpisodeDrawer();
      }
    }
  }

  function goToPrevPage(getAdjacentChapters) {
    if (state.currentPageIndex > 0) {
      state.currentPageIndex -= 1;
      updateMangaSlide();
    } else {
      const { prevChapter } = getAdjacentChapters();
      if (prevChapter && openReaderCallback) {
        openReaderCallback(state.activeMangaId, prevChapter.chapter_id, prevChapter.chapter_number, state.readMode);
      } else {
        openEpisodeDrawer();
      }
    }
  }

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
      const isRead = typeof isChapterReadCallback === 'function' ? isChapterReadCallback(ch) : false;
      const item = document.createElement('div');
      item.className = `episode-drawer-item ${isCurrent ? 'active' : (isRead ? 'is-read' : 'is-unread')}`;
      item.setAttribute('role', 'listitem');
      item.tabIndex = 0;

      const dateStr = ch.release_date || '';
      const relTime = formatRelativeTime(dateStr);

      let statusBadge = '';
      if (isCurrent) {
        statusBadge = '<span class="ep-badge-active">Sedang Dibaca</span>';
      } else if (isRead) {
        statusBadge = `
          <span class="ep-badge-read">
            <svg class="ep-badge-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            <span>Sudah Dibaca</span>
          </span>
        `;
      } else {
        statusBadge = `
          <span class="ep-badge-unread">
            <span class="ep-unread-dot"></span>
            <span>Belum Dibaca</span>
          </span>
        `;
      }

      item.innerHTML = `
        <div class="ep-item-info">
          <span class="ep-item-num">Chapter ${ch.chapter_number}</span>
          ${statusBadge}
        </div>
        <div class="ep-item-meta">
          ${relTime ? `<span class="ep-item-date">${relTime}</span>` : ''}
        </div>
      `;

      const clickHandler = () => {
        closeEpisodeDrawer();
        if (!isCurrent && openReaderCallback) {
          openReaderCallback(state.activeMangaId, ch.chapter_id, ch.chapter_number, state.readMode);
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

  return {
    toggleReaderControls,
    showReaderControls,
    updateMangaSlide,
    goToNextPage,
    goToPrevPage,
    openEpisodeDrawer,
    closeEpisodeDrawer,
    renderEpisodeDrawerList,
    preloadNearbyImages
  };
}
