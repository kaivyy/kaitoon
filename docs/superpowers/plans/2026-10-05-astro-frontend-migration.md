# Astro Frontend Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate Kaitoon Web Reader frontend to Astro using pnpm, running dev server on port 5555 and compiling static production output to `kaitoon/static/` with 100% visual and functional parity.

**Architecture:** Decompose monolithic HTML/CSS/JS frontend into modular `.astro` templates (`Layout.astro`, `Header.astro`, `MobileNav.astro`, `ComicGrid.astro`, `ComicCard.astro`, `DetailView.astro`, `ReaderView.astro`, `EpisodeDrawer.astro`) and modular client scripts (`router.js`, `api.js`, `reader.js`, `main.js`). Astro dev server runs on port 5555 with transparent Vite proxy to FastAPI backend on port 9000, and `pnpm build` outputs directly to `kaitoon/static/`.

**Tech Stack:** Astro v5, pnpm v12, Node.js v22, Vanilla ES6 JavaScript, OLED Pure Black CSS3, FastAPI, Python 3.13, SQLite.

## Global Constraints

- Absolute prohibition of em dash (`U+2014`) and en dash (`U+2013`) in all code, comments, documentation, and strings (Rule R-02).
- Pure black OLED theme canvas `#000000`, surface `#0d0d0d`, border `#1a1a1a`, text `#f3f4f6`, emerald accent `#10b981`.
- Minimum 44px touch targets across all interactive buttons (Rule R-03).
- Astro development server must bind to port 5555 with `host: true`.
- Reverse proxy in Astro config forwards `/api/*` to `http://localhost:9000`.
- Static build output must populate `../static/` to maintain FastAPI root serving.
- All 40 existing pytest unit and integration tests must continue to pass cleanly.

---

### Task 1: Astro Project Scaffolding & Configuration

**Files:**
- Create: `kaitoon/frontend/package.json`
- Create: `kaitoon/frontend/astro.config.mjs`
- Create: `kaitoon/frontend/tsconfig.json`
- Create: `kaitoon/frontend/.gitignore`

**Interfaces:**
- Consumes: Node.js 22, pnpm 12, FastAPI backend on port 9000
- Produces: Working Astro project on port 5555 with build targeting `../static/`

- [ ] **Step 1: Create frontend directory and package.json**
Create `kaitoon/frontend/package.json` with dependencies for Astro and build scripts (`dev`, `build`, `preview`).

- [ ] **Step 2: Create astro.config.mjs**
Configure Astro with `output: 'static'`, `outDir: '../static'`, `server: { port: 5555, host: true }`, and `vite.server.proxy` forwarding `/api` to `http://localhost:9000`.

- [ ] **Step 3: Create tsconfig.json and .gitignore**
Add standard Astro tsconfig (`astro/tsconfigs/strict` or base) and gitignore for `node_modules` and `dist`.

- [ ] **Step 4: Install dependencies using pnpm**
Run `pnpm install` in `kaitoon/frontend` and confirm clean installation.

- [ ] **Step 5: Verify build pipeline**
Run `pnpm build` in `kaitoon/frontend` to verify Astro compiles and outputs without errors.

- [ ] **Step 6: Commit**
`git add kaitoon/frontend && git commit -m "chore(frontend): scaffold astro project with pnpm on port 5555"`

---

### Task 2: Styles, Base Layout, and Core UI Shell Components

**Files:**
- Create: `kaitoon/frontend/src/styles/global.css`
- Create: `kaitoon/frontend/src/layouts/Layout.astro`
- Create: `kaitoon/frontend/src/components/Header.astro`
- Create: `kaitoon/frontend/src/components/MobileNav.astro`
- Create: `kaitoon/frontend/src/components/StatePanels.astro`

**Interfaces:**
- Consumes: OLED CSS design system rules
- Produces: Document layout, header with pill search and tabs, mobile bottom navigation, resilience banners

- [ ] **Step 1: Create global.css**
Port the complete OLED Pure Black CSS stylesheet with custom scrollbars, animations, 44px tap targets, floating dock styles, and drawer transitions. Verify zero em/en dashes.

- [ ] **Step 2: Create Layout.astro**
Implement base HTML structure, meta tags (`viewport`, `description`, `title`), dark color scheme, and global CSS injection.

- [ ] **Step 3: Create Header.astro**
Implement header markup: brand logo with icon and "Reader" badge, pill search input with 400ms debounce support and clear button, desktop segmented tab dock (`Terbaru`, `Favorit`, `Riwayat`).

- [ ] **Step 4: Create MobileNav.astro**
Implement mobile bottom navigation bar with OLED glassmorphism, safe area padding, and tab buttons (`mobile-tab-latest`, `mobile-tab-favorites`, `mobile-tab-history`).

- [ ] **Step 5: Create StatePanels.astro**
Implement resilient state elements: `#global-loader` (spinner), `#error-state` (retry button), `#empty-state` (action button), and `#toast` (toast banner).

- [ ] **Step 6: Verify template rendering**
Build with `pnpm build` and verify HTML contains semantic tags and attributes.

- [ ] **Step 7: Commit**
`git add kaitoon/frontend/src && git commit -m "feat(frontend): create base layout, header, mobile nav, and state panels"`

---

### Task 3: Catalog and Comic Detail Components

**Files:**
- Create: `kaitoon/frontend/src/components/ComicCard.astro`
- Create: `kaitoon/frontend/src/components/ComicGrid.astro`
- Create: `kaitoon/frontend/src/components/DetailView.astro`

**Interfaces:**
- Consumes: Layout, Header, StatePanels
- Produces: Catalog section (`#catalog-view`) with pagination, Detail section (`#detail-view`) with chapter list

- [ ] **Step 1: Create ComicCard.astro & ComicGrid.astro**
Implement catalog grid container `#catalog-view` with title, count, `#comic-grid`, and `#pagination-controls` dock. Implement card template with 3:4 cover, rating badge, and 2 latest chapter buttons (`Ch. X` + relative time, and `Ch. X` + `Baca >`).

- [ ] **Step 2: Create DetailView.astro**
Implement detail container `#detail-view` with `#detail-back-btn`, cover image, title, alternative title, status pill, user rating, views, genre container `#detail-genres`, synopsis, `#detail-continue-btn`, `#detail-favorite-btn`, chapter filter input `#chapter-filter-input`, sort button `#sort-order-btn`, and chapter list container `#chapter-list`.

- [ ] **Step 3: Verify component builds**
Run `pnpm build` in `kaitoon/frontend` to verify syntax.

- [ ] **Step 4: Commit**
`git add kaitoon/frontend/src/components && git commit -m "feat(frontend): add comic grid, comic card, and detail view components"`

---

### Task 4: Dual-Mode Reader & Episode Drawer Components

**Files:**
- Create: `kaitoon/frontend/src/components/ReaderView.astro`
- Create: `kaitoon/frontend/src/components/EpisodeDrawer.astro`
- Create: `kaitoon/frontend/src/pages/index.astro`

**Interfaces:**
- Consumes: All UI components from Tasks 2 and 3
- Produces: Full SPA entrypoint in `src/pages/index.astro`

- [ ] **Step 1: Create ReaderView.astro**
Implement reader container `#reader-view`:
- Floating auto-hiding header `#reader-header`: `#reader-exit-btn`, `#reader-home-btn`, title, chapter label, `#reader-episodes-btn`, `#reader-mode-toggle`, `#reader-download-btn`.
- Reader stage `#reader-container`: `#webtoon-scroll-container` (vertical continuous flow) and `#manga-slide-container` with tap zones (`#tap-prev`, `#tap-center`, `#tap-next`) and `#manga-slide-img`.
- Floating bottom dock `#reader-footer`:
  - `#reader-dock-home-btn`
  - `#reader-prev-chapter`
  - `#reader-chapter-dock-btn` (floating chapter button with text `#reader-dock-chapter-text` and chevron)
  - `<select id="reader-chapter-select" hidden>` (for test client compatibility)
  - `#reader-next-chapter`
  - `#reader-prev-page`, `#reader-page-counter`, `#reader-next-page` (manga mode)

- [ ] **Step 2: Create EpisodeDrawer.astro**
Implement slide-up drawer `#episode-drawer`: `#episode-drawer-backdrop`, header with title, subtitle, close button `#episode-drawer-close`, search input `#episode-search-input`, and chapter container `#episode-drawer-list`.

- [ ] **Step 3: Create index.astro**
Assemble `Header`, `StatePanels`, `ComicGrid`, `DetailView`, `ReaderView`, `EpisodeDrawer`, and `MobileNav` inside `Layout`.

- [ ] **Step 4: Verify static compilation**
Run `pnpm build` in `kaitoon/frontend`.

- [ ] **Step 5: Commit**
`git add kaitoon/frontend/src && git commit -m "feat(frontend): add reader view, episode drawer, and index entrypoint"`

---

### Task 5: Client Scripts & Hash Routing Engine

**Files:**
- Create: `kaitoon/frontend/src/scripts/api.js`
- Create: `kaitoon/frontend/src/scripts/router.js`
- Create: `kaitoon/frontend/src/scripts/reader.js`
- Create: `kaitoon/frontend/src/scripts/main.js`
- Modify: `kaitoon/frontend/src/pages/index.astro` (import client script)

**Interfaces:**
- Consumes: FastAPI REST endpoints, browser DOM
- Produces: Reactive client-side application matching 100% of existing behavior

- [ ] **Step 1: Create api.js**
Export `apiFetch(endpoint, options)` with JSON parsing and error handling, relative time formatting, and HTML entity escaping.

- [ ] **Step 2: Create router.js**
Export `setRoute(routeStr)` and `handleRoute()` managing URL hash routes (`#/`, `#/latest`, `#/favorites`, `#/history`, `#/manga/{id}`, `#/reader/{mangaId}/{chapterId}/{num}`) with `sessionStorage` fallback so browser refresh preserves reading position without returning to homepage.

- [ ] **Step 3: Create reader.js**
Export reader view functions: tap zones handling, controller bar auto-hiding on scroll, webtoon image rendering, manga slide flip, and keyboard navigation.

- [ ] **Step 4: Create main.js**
Orchestrate application startup: DOM cache, search input with 400ms debounce, catalog loading, detail rendering, chapter opening, watchlist toggle, CBZ download tracking, and event delegation.

- [ ] **Step 5: Wire client script into index.astro**
Include `<script src="../scripts/main.js"></script>` in `index.astro`.

- [ ] **Step 6: Build and verify bundle**
Run `pnpm build` in `kaitoon/frontend` and verify all scripts and HTML bundle cleanly into `kaitoon/static/`.

- [ ] **Step 7: Commit**
`git add kaitoon/frontend/src/scripts kaitoon/frontend/src/pages && git commit -m "feat(frontend): implement modular client routing and reader engine"`

---

### Task 6: System Verification & Delivery Gate

**Files:**
- Output: `kaitoon/static/*`
- Test: `kaitoon/tests/*`
- Doc: `docs/superpowers/plans/2026-10-05-astro-frontend-migration.md`

**Interfaces:**
- Consumes: Compiled Astro assets, running FastAPI server
- Produces: 100% passing test suite, live Astro dev server on port 5555

- [ ] **Step 1: Compile production build**
Run `pnpm build` in `kaitoon/frontend`.

- [ ] **Step 2: Verify R-02 Zero Tolerance**
Run Python scan across `kaitoon/frontend/` and `kaitoon/static/` confirming 0 em dashes and 0 en dashes.

- [ ] **Step 3: Run full pytest suite**
Run `PYTHONPATH=/root pytest /root/kaitoon/tests/ -v` and `PYTHONPATH=/root pytest /root/tests/ -v`. Confirm all 40 tests pass.

- [ ] **Step 4: Test live Astro dev server on port 5555**
Start Astro dev server in background on port 5555. Run curl checks:
- `curl -s http://localhost:5555/` -> returns HTTP 200 with HTML payload.
- `curl -s http://localhost:5555/api/latest` -> returns HTTP 200 with proxied JSON data.

- [ ] **Step 5: Update AST knowledge graph**
Run `graphify update .`.

- [ ] **Step 6: Final commit**
Commit all migration deliverables and report completion.
