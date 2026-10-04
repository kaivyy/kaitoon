# Design Specification: Astro Frontend Migration for Kaitoon Web Reader

**Author**: Antigravity Assistant & Engineering Team  
**Date**: 2026-10-05  
**Status**: Draft for User Review  
**Branch**: `feature/web-reader`  
**Package Manager**: `pnpm`  
**Development Port**: `5555`  
**Rule R-02 Compliance**: Zero em dashes or en dashes allowed in any code, markdown, comments, or documentation.

---

## 1. Problem Statement & Motivation

Kaitoon currently has a working single-page application built with vanilla HTML5, CSS3, and ES6 JavaScript located in `kaitoon/static/`. While functional, maintaining all component templates, state transitions, and reader layouts in a single monolithic `app.js` file (over 1,700 lines) makes modular development, component testing, and future styling enhancements harder to scale.

Migrating the frontend architecture to **Astro** using **pnpm** provides:
1. **Component-Driven Architecture**: Clean decomposition into reusable `.astro` and client script modules (`Layout.astro`, `Header.astro`, `MobileNav.astro`, `ComicCard.astro`, `DetailView.astro`, `ReaderView.astro`, `EpisodeDrawer.astro`).
2. **Identical Visual Design & OLED Theme**: Retaining 100% of the custom pure black `#000000` styling, typography, animations, floating docks, and responsive layouts.
3. **Identical Functional Logic & API Integration**: Preserving all existing API endpoints, SQLite synchronization, CBZ downloads, and URL hash routing across page refreshes.
4. **Seamless Backend Interoperability**: Astro builds static production assets directly into `kaitoon/static/` via `pnpm build`, allowing FastAPI (`kaitoon/server.py`) on port 9000 to serve the application in production without architectural change, while Astro dev server operates on port 5555 with transparent API proxying.

---

## 2. System Architecture & Directory Structure

```
kaitoon/
├── frontend/                     # Astro Frontend Project Root
│   ├── astro.config.mjs          # Astro config (port 5555, vite proxy to :9000, outDir: ../static)
│   ├── package.json              # pnpm package manifest
│   ├── pnpm-lock.yaml            # pnpm dependency lockfile
│   ├── tsconfig.json             # TypeScript configuration for Astro
│   ├── src/
│   │   ├── components/
│   │   │   ├── Header.astro      # Site header, logo, pill search, desktop tabs
│   │   │   ├── MobileNav.astro   # Mobile bottom navigation bar with OLED glassmorphism
│   │   │   ├── ComicGrid.astro   # Grid of comic cards with pagination controls
│   │   │   ├── ComicCard.astro   # Comic card with 2 latest chapter click targets
│   │   │   ├── DetailView.astro  # Comic detail synopsis, genres, continue btn, chapter list
│   │   │   ├── ReaderView.astro  # Dual-mode reader stage, floating bars, bottom dock
│   │   │   ├── EpisodeDrawer.astro # Slide-up chapter sheet with search
│   │   │   └── StatePanels.astro # Global loader, error state, empty state, toast
│   │   ├── layouts/
│   │   │   └── Layout.astro      # Base document structure, meta tags, OLED theme
│   │   ├── pages/
│   │   │   └── index.astro       # Root single-page application entrypoint
│   │   ├── scripts/
│   │   │   ├── api.js            # Fetch wrapper with error handling and retry
│   │   │   ├── router.js         # URL hash router & sessionStorage persistence
│   │   │   ├── reader.js         # Dual-mode reader engine (webtoon continuous vs manga slide)
│   │   │   └── main.js           # Client orchestration & event delegation
│   │   └── styles/
│   │       └── global.css        # Pure black OLED design system & CSS variables
├── static/                       # Production Static Assets Output (built by Astro)
│   ├── index.html                # Compiled entrypoint served by FastAPI
│   ├── _astro/                   # Bundled CSS and JavaScript chunks
│   ├── style.css                 # Legacy CSS preserved or bundled
│   └── app.js                    # Legacy JS preserved or bundled
├── server.py                     # FastAPI application backend (port 9000)
├── db.py                         # SQLite persistence layer
├── downloader.py                 # CBZ packager
└── tests/                        # Automated test suite (Python pytest)
```

---

## 3. Configuration & Port Specifications

### 3.1 `frontend/astro.config.mjs`
```javascript
import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'static',
  outDir: '../static',
  server: {
    port: 5555,
    host: true
  },
  vite: {
    server: {
      proxy: {
        '/api': {
          target: 'http://localhost:9000',
          changeOrigin: true
        }
      }
    }
  }
});
```

Key Properties:
- **Port 5555**: Astro dev server explicitly runs on port 5555 as requested.
- **Vite Proxy**: `/api/*` requests in development are transparently proxied to FastAPI on port 9000 (`http://localhost:9000`).
- **Static Output**: `outDir: '../static'` compiles production assets directly into the directory mounted by FastAPI.

---

## 4. Component Decomposition & Responsibilities

### 4.1 `Layout.astro`
- Sets pure black background `#000000`, viewport meta tags, dark color-scheme.
- Injects `global.css` containing the complete OLED theme palette, contrast standards, and touch targets.
- Slots in the main application views and overlay components.

### 4.2 `Header.astro`
- Brand Logo with icon and minimal uppercase "Reader" badge.
- Search input with smooth rounded pill design (`border-radius: 9999px; background: #111111; border: 1px solid #222222;`) and 400ms debounce.
- Desktop navigation tab segmented switch (`Terbaru`, `Favorit`, `Riwayat`).

### 4.3 `MobileNav.astro`
- Mobile bottom navigation bar hidden on desktop (`> 768px`) and fixed to bottom on mobile.
- Clean backdrop blur (`blur(20px)`), safe-area inset padding, active emerald indicator.
- Three tab buttons: `mobile-tab-latest`, `mobile-tab-favorites`, `mobile-tab-history`.

### 4.4 `ComicCard.astro` & `ComicGrid.astro`
- Card layout with 3:4 aspect ratio covers, subtle hover elevation, rating badge, and title.
- Direct chapter quick-links:
  - Primary button: Chapter number with relative release time (`Terbaru` or `X jam lalu`).
  - Secondary button: Chapter number with `Baca >` chevron link.
  - Clicking a chapter pill directly launches Reader View without forcing a trip through Detail View.

### 4.5 `DetailView.astro`
- Header banner with large cover image, title, alternative title, status badge, user rating, views, and genre pills.
- Action row: `Lanjut Baca` (Continue reading based on SQLite history) and `Simpan Favorit` (Watchlist toggle with count).
- Chapter list with real-time text filter and sort order toggle (Terbaru vs Terlama).

### 4.6 `ReaderView.astro` & Floating Bottom Dock
- Distraction-free full-screen stage (`inset: 0; z-index: 1000; position: fixed;`).
- Mode 1: Webtoon continuous vertical scroll (`max-width: 800px; margin: 0 auto;`).
- Mode 2: Manga slide viewport fitting (`height: 100vh; object-fit: contain;`).
- Auto-hiding floating header (`reader-header`) with comic title, chapter label, mode toggle, and CBZ download button.
- Auto-hiding floating bottom dock (`reader-bottom-dock`):
  - `[ Beranda ]`: Home icon returning to catalog.
  - `[ < Prev Ch ]`: Previous chapter navigation.
  - `[ 📑 Ch. {number} v ]`: Floating chapter button opening Episode Drawer.
  - `[ Next Ch > ]`: Next chapter navigation.
  - Manga mode controls: Previous page `< `, Page counter `Hal X / Y`, Next page `>`.
  - Hidden `<select id="reader-chapter-select" hidden>` maintained for test client compatibility.

### 4.7 `EpisodeDrawer.astro`
- Slide-up bottom sheet with backdrop overlay.
- Search input for instant chapter number filtering.
- Interactive chapter items displaying active reading badge (`Sedang Dibaca`) and relative dates.

---

## 5. Client Script Architecture & State Machine

The client-side logic will be modularized into `/root/kaitoon/frontend/src/scripts/`:

### 5.1 `router.js`: URL Hash Routing & Persistence
- Listens to `hashchange` and initial page boot.
- Route formats:
  - `#/`: Latest catalog
  - `#/latest`: Latest catalog
  - `#/favorites`: Watchlist bookmarks
  - `#/history`: Reading history
  - `#/manga/{mangaId}`: Comic detail view
  - `#/reader/{mangaId}/{chapterId}/{chapterNumber}`: Reader view at specific chapter
- `sessionStorage` fallback ensures accidental reloads or restricted webview environments retain the exact active chapter without returning to homepage.

### 5.2 `api.js`: Unified API Client
- Wrapper for fetch calls with JSON response handling and error toast notifications.
- Interacts with:
  - `GET /api/latest`
  - `GET /api/search?q={query}`
  - `GET /api/manga/{id}`
  - `GET /api/chapter/{id}/pages`
  - `GET /api/history` & `POST /api/history`
  - `GET /api/watchlist` & `POST /api/watchlist/toggle`
  - `POST /api/chapter/{id}/download` & `GET /api/chapter/{id}/status`

### 5.3 `reader.js`: Dual-Mode Reading Engine
- Touch tap zones: left 35% (prev), center 30% (toggle controller), right 35% (next).
- Keyboard shortcuts:
  - `Escape`: Close drawer or exit reader.
  - `ArrowLeft` / `ArrowRight`: Page flip in manga mode or smooth vertical scrollBy in webtoon mode.
  - `PageUp` / `PageDown`: Rapid vertical scroll in webtoon mode.
- Scroll auto-hide: scrolling down hides bars; scrolling up reveals bars.

---

## 6. Verification & Quality Gates

1. **R-02 Zero Tolerance**: Automated scan verifies 0 em dashes (`U+2014`) and 0 en dashes (`U+2013`) across all newly created `.astro`, `.mjs`, `.js`, and `.css` files.
2. **Test Suite Compatibility**:
   - `pnpm build` creates production output in `kaitoon/static/`.
   - FastAPI server starts and passes all 40 pytest tests (`PYTHONPATH=/root pytest /root/kaitoon/tests/ -v`).
3. **Live Astro Verification**:
   - `pnpm dev` boots Astro on port 5555.
   - Curl on `http://localhost:5555/` returns HTTP 200 with Astro HTML payload.
   - API calls through proxy `http://localhost:5555/api/latest` return HTTP 200 and valid JSON data.
4. **Graphify Update**: Run `graphify update .` to update the AST knowledge graph.
