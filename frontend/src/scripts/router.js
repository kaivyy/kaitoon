/**
 * URL Hash Router and Session Persistence for Kaitoon Web Reader
 * Rule R-02 Compliance: Zero em dashes or en dashes allowed.
 */

let isHandlingRoute = false;
let suppressHashChange = false;

export function setRoute(routeStr) {
  const hash = `#/${routeStr}`;
  try {
    sessionStorage.setItem('kaitoon_route', hash);
    localStorage.setItem('kaitoon_route', hash);
  } catch {
    // Ignore storage errors in restricted contexts
  }
  if (window.location.hash !== hash) {
    suppressHashChange = true;
    window.location.hash = hash;
  }
}

export async function handleRoute({ onReader, onManga, onTab }) {
  if (suppressHashChange) {
    suppressHashChange = false;
    return;
  }
  if (isHandlingRoute) return;
  isHandlingRoute = true;
  try {
    let rawHash = window.location.hash || '';
    if (!rawHash) {
      try {
        rawHash = sessionStorage.getItem('kaitoon_route') || localStorage.getItem('kaitoon_route') || '';
      } catch {
        // Ignore storage errors
      }
    }

    const cleanHash = rawHash.replace(/^#\/?/, '');
    const parts = cleanHash.split('/').filter(Boolean);

    // Route: #/reader/{slug-or-id}/{chapterNumber} (Clean Route)
    // or Route: #/reader/{mangaId}/{chapterId}/{chapterNumber} (Legacy Route)
    if (parts[0] === 'reader') {
      if (parts.length >= 4) {
        const mangaId = decodeURIComponent(parts[1]);
        const chapterId = decodeURIComponent(parts[2]);
        const chapterNumber = decodeURIComponent(parts[3]);
        if (onReader) {
          await onReader(mangaId, chapterId, chapterNumber);
        }
        return;
      } else if (parts.length >= 3) {
        const mangaIdOrSlug = decodeURIComponent(parts[1]);
        const chapterNumber = decodeURIComponent(parts[2]);
        if (onReader) {
          await onReader(mangaIdOrSlug, null, chapterNumber);
        }
        return;
      }
    }

    // Route: #/manga/{mangaId}
    if (parts[0] === 'manga' && parts.length >= 2) {
      const mangaId = decodeURIComponent(parts[1]);
      if (onManga) {
        await onManga(mangaId);
      }
      return;
    }

    // Route: #/favorites
    if (parts[0] === 'favorites') {
      if (onTab) {
        await onTab('favorites', 1);
      }
      return;
    }

    // Route: #/history
    if (parts[0] === 'history') {
      if (onTab) {
        await onTab('history', 1);
      }
      return;
    }

    // Route: #/latest, #/latest/page/{num}, #/latest/{num}, #/page/{num}
    let catalogPage = 1;
    if (parts[0] === 'latest') {
      if (parts[1] === 'page' && parts[2]) {
        const p = parseInt(parts[2], 10);
        if (!isNaN(p) && p >= 1) catalogPage = p;
      } else if (parts[1]) {
        const p = parseInt(parts[1], 10);
        if (!isNaN(p) && p >= 1) catalogPage = p;
      }
    } else if (parts[0] === 'page' && parts[1]) {
      const p = parseInt(parts[1], 10);
      if (!isNaN(p) && p >= 1) catalogPage = p;
    }

    const pageMatch = rawHash.match(/[?&]page=(\d+)/);
    if (pageMatch && pageMatch[1]) {
      const p = parseInt(pageMatch[1], 10);
      if (!isNaN(p) && p >= 1) catalogPage = p;
    }

    // Default Route: #/latest with catalogPage
    if (onTab) {
      await onTab('latest', catalogPage);
    }
  } finally {
    isHandlingRoute = false;
  }
}
