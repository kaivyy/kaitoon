/**
 * URL Hash Router and Session Persistence for Kaitoon Web Reader
 * Rule R-02 Compliance: Zero em dashes or en dashes allowed.
 */

export function setRoute(routeStr) {
  const hash = `#/${routeStr}`;
  try {
    sessionStorage.setItem('kaitoon_route', hash);
    localStorage.setItem('kaitoon_route', hash);
  } catch {
    // Ignore storage errors in restricted contexts
  }
  if (window.location.hash !== hash) {
    window.location.hash = hash;
  }
}

let isHandlingRoute = false;

export async function handleRoute({ onReader, onManga, onTab }) {
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
        onTab('favorites');
      }
      return;
    }

    // Route: #/history
    if (parts[0] === 'history') {
      if (onTab) {
        onTab('history');
      }
      return;
    }

    // Default Route: #/latest
    if (onTab) {
      onTab('latest');
    }
  } finally {
    isHandlingRoute = false;
  }
}
