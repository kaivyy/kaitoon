"""Komiku.org Provider and Scraper with Permanent SQLite Caching.

Provides methods to:
- Browse latest updated comics from Komiku.org
- Search comics by keyword
- Retrieve manga details and chapter listings
- Extract direct WebP image URLs with permanent caching

Rule R-02 Compliance: Absolutely no em dashes or en dashes allowed.
"""

import json
import logging
import os
import re
import sqlite3
import urllib.parse
import urllib.request
from typing import Any, Dict, List, Optional

from kaitoon.db import DEFAULT_DB_PATH

logger = logging.getLogger("KomikuProvider")

DEFAULT_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)


def init_komiku_tables(db_path: str = DEFAULT_DB_PATH) -> None:
    """Creates SQLite tables for caching Komiku manga, chapters, and pages."""
    conn = sqlite3.connect(db_path)
    try:
        with conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS komiku_manga (
                    slug TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    cover_url TEXT,
                    description TEXT,
                    status INTEGER DEFAULT 1,
                    type TEXT,
                    genre TEXT,
                    latest_chapter_number REAL DEFAULT 0.0,
                    release_time TEXT,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS komiku_chapters (
                    chapter_id TEXT PRIMARY KEY,
                    manga_slug TEXT NOT NULL,
                    chapter_number REAL NOT NULL,
                    title TEXT,
                    release_date TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(manga_slug) REFERENCES komiku_manga(slug) ON DELETE CASCADE
                );
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS komiku_pages (
                    chapter_id TEXT PRIMARY KEY,
                    pages_json TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                """
            )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_komiku_ch_manga ON komiku_chapters(manga_slug, chapter_number DESC);"
            )
    finally:
        conn.close()


class KomikuClient:
    """Client for scraping and caching comics from Komiku.org."""

    def __init__(
        self,
        base_url: str = "https://komiku.org",
        api_url: str = "https://api.komiku.org",
        db_path: str = DEFAULT_DB_PATH,
        user_agent: str = DEFAULT_USER_AGENT,
        timeout: int = 12,
    ):
        self.base_url = base_url.rstrip("/")
        self.api_url = api_url.rstrip("/")
        self.db_path = db_path
        self.user_agent = user_agent
        self.timeout = timeout
        self.web_url = self.base_url
        init_komiku_tables(self.db_path)

    def _fetch_html(self, url: str) -> str:
        """Fetches HTML content with appropriate User-Agent headers."""
        headers = {
            "User-Agent": self.user_agent,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "id,en;q=0.9",
        }
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=self.timeout) as resp:
            raw_bytes = resp.read()
            return raw_bytes.decode("utf-8", errors="replace")

    def crawl_latest(self, num_pages: int = 5) -> int:
        """
        Crawls latest comics across multiple pages into the SQLite database.
        Returns the number of crawled comics.
        """
        from concurrent.futures import ThreadPoolExecutor

        def fetch_sub_page(sub_p: int) -> List[Dict[str, Any]]:
            url = f"{self.api_url}/manga/page/{sub_p}/" if sub_p > 1 else f"{self.api_url}/manga/"
            try:
                html = self._fetch_html(url)
                return self._parse_comic_cards(html)
            except Exception as e:
                logger.warning(f"Crawl error on Komiku sub-page {sub_p}: {e}")
                return []

        all_items = []
        with ThreadPoolExecutor(max_workers=min(5, num_pages)) as executor:
            page_results = list(executor.map(fetch_sub_page, range(1, num_pages + 1)))

        for res in page_results:
            all_items.extend(res)

        if all_items:
            self._save_manga_list(all_items)

        logger.info(f"Crawled {len(all_items)} comics across {num_pages} Komiku pages.")
        return len(all_items)

    def list_latest(self, page: int = 1, page_size: int = 20) -> Dict[str, Any]:
        """
        Retrieves list of latest updated comics from Komiku.org.
        Uses api.komiku.org HTMX partial endpoint for fast response.
        Aggregates multiple Komiku sub-pages if page_size > 10.
        """
        num_sub_pages = max(1, (page_size + 9) // 10)
        start_sub_page = (page - 1) * num_sub_pages + 1
        sub_pages = list(range(start_sub_page, start_sub_page + num_sub_pages))

        def fetch_sub_page(sub_p: int) -> List[Dict[str, Any]]:
            url = f"{self.api_url}/manga/page/{sub_p}/" if sub_p > 1 else f"{self.api_url}/manga/"
            try:
                html = self._fetch_html(url)
                return self._parse_comic_cards(html)
            except Exception as e:
                logger.warning(f"Error fetching Komiku sub-page {sub_p}: {e}")
                return []

        all_items = []
        try:
            if len(sub_pages) == 1:
                all_items = fetch_sub_page(sub_pages[0])
            else:
                from concurrent.futures import ThreadPoolExecutor
                with ThreadPoolExecutor(max_workers=min(4, len(sub_pages))) as executor:
                    page_results = list(executor.map(fetch_sub_page, sub_pages))
                for res in page_results:
                    all_items.extend(res)

            if all_items:
                self._save_manga_list(all_items)

            sliced_items = all_items[:page_size] if page_size else all_items

            return {
                "data": sliced_items,
                "meta": {
                    "page": page,
                    "page_size": len(sliced_items),
                    "total": len(sliced_items),
                    "has_next": len(all_items) >= page_size,
                    "server": "komiku",
                    "server_name": "Komiku.org",
                },
            }
        except Exception as err:
            logger.error(f"Failed to fetch latest from Komiku: {err}")
            offset = (page - 1) * page_size
            cached = self._get_cached_latest(limit=page_size, offset=offset)
            if cached:
                return {
                    "data": cached,
                    "meta": {
                        "page": page,
                        "page_size": len(cached),
                        "total": len(cached),
                        "has_next": len(cached) >= page_size,
                        "server": "komiku",
                        "fallback": True,
                    },
                }
            raise

    def search_manga(self, query: str, page: int = 1, page_size: int = 20) -> Dict[str, Any]:
        """Searches comics on Komiku.org using keyword query."""
        if not query.strip():
            return {"data": [], "meta": {"page": page, "page_size": page_size, "total": 0}}

        encoded_q = urllib.parse.quote(query.strip())
        url = f"{self.api_url}/?post_type=manga&s={encoded_q}"
        if page > 1:
            url += f"&page={page}"

        try:
            html = self._fetch_html(url)
            items = self._parse_comic_cards(html)
            self._save_manga_list(items)

            return {
                "data": items,
                "meta": {
                    "page": page,
                    "page_size": len(items),
                    "total": len(items),
                    "server": "komiku",
                },
            }
        except Exception as err:
            logger.error(f"Search failed on Komiku: {err}")
            # Search in local cached manga
            cached = self._search_cached_manga(query.strip())
            return {
                "data": cached,
                "meta": {
                    "page": page,
                    "page_size": len(cached),
                    "total": len(cached),
                    "server": "komiku",
                    "fallback": True,
                },
            }

    def get_manga_detail(self, manga_slug: str, force_refresh: bool = False) -> Dict[str, Any]:
        """
        Retrieves full manga details and chapter listings for a given slug.
        Checks local SQLite cache first for instant response.
        """
        clean_slug = manga_slug.strip().strip("/")

        # Check local database cache if not force refresh
        if not force_refresh:
            cached_detail = self._get_cached_manga_detail(clean_slug)
            if cached_detail and cached_detail.get("chapters"):
                return {"data": cached_detail}

        url = f"{self.base_url}/manga/{clean_slug}/"
        try:
            html = self._fetch_html(url)
            detail = self._parse_manga_detail_html(html, clean_slug)
            self._save_full_manga_detail(detail)
            return {"data": detail}
        except Exception as err:
            logger.error(f"Failed to fetch detail for {clean_slug} from Komiku: {err}")
            cached_detail = self._get_cached_manga_detail(clean_slug)
            if cached_detail:
                return {"data": cached_detail}
            raise

    def get_chapter_image_urls(self, chapter_id: str) -> List[str]:
        """
        Retrieves direct WebP image URLs for all pages in a chapter.
        Uses permanent SQLite caching so chapter pages are only scraped once.
        """
        clean_id = chapter_id.strip().strip("/")

        # Check permanent SQLite cache first
        cached_pages = self._get_cached_pages(clean_id)
        if cached_pages:
            return cached_pages

        url = f"{self.base_url}/{clean_id}/"
        try:
            html = self._fetch_html(url)
            pages = self._parse_chapter_pages_html(html)
            if pages:
                self._save_cached_pages(clean_id, pages)
            return pages
        except Exception as err:
            logger.error(f"Failed to fetch chapter pages for {clean_id}: {err}")
            cached_pages = self._get_cached_pages(clean_id)
            if cached_pages:
                return cached_pages
            raise

    def get_chapter_detail(self, chapter_id: str) -> Dict[str, Any]:
        """Retrieves metadata for a chapter ID from local database or parses slug."""
        clean_id = chapter_id.strip().strip("/")
        conn = sqlite3.connect(self.db_path)
        try:
            conn.row_factory = sqlite3.Row
            row = conn.execute(
                "SELECT * FROM komiku_chapters WHERE chapter_id = ? LIMIT 1",
                (clean_id,),
            ).fetchone()
            if row:
                return {
                    "data": {
                        "chapter_id": row["chapter_id"],
                        "chapter_number": row["chapter_number"],
                        "title": row["title"] or f"Chapter {row['chapter_number']}",
                        "manga_id": row["manga_slug"],
                    }
                }
        finally:
            conn.close()

        num_match = re.search(r"chapter-([0-9.]+)", clean_id, re.IGNORECASE)
        ch_num = float(num_match.group(1)) if num_match else 1.0
        m_slug = clean_id.split("-chapter-")[0] if "-chapter-" in clean_id else "manga"
        return {
            "data": {
                "chapter_id": clean_id,
                "chapter_number": ch_num,
                "title": f"Chapter {ch_num}",
                "manga_id": m_slug,
            }
        }

    # HTML Parsers
    def _parse_comic_cards(self, html: str) -> List[Dict[str, Any]]:
        """Parses .bge comic cards from Komiku HTML."""
        cards = re.findall(r'<div class="bge">(.*?)</div>\s*</div>', html, re.DOTALL)
        results = []
        for c in cards:
            title_match = re.search(
                r'href=[\'"](?:https?://komiku\.org)?/manga/([^/\'"]+)/?[\'"][^>]*><h3>(.*?)</h3>',
                c,
                re.DOTALL,
            )
            if not title_match:
                continue

            slug = title_match.group(1).strip()
            title = re.sub(r"<[^>]*>", "", title_match.group(2)).strip()

            img_match = re.search(r'<img[^>]*src=[\'"]([^\'"]+)[\'"]', c)
            cover = img_match.group(1) if img_match else ""

            info_match = re.search(r'<span class="judul2">(.*?)</span>', c)
            info_text = info_match.group(1).strip() if info_match else ""

            type_match = re.search(r"<b>(Manhwa|Manga|Manhua)</b>", c, re.IGNORECASE)
            comic_type = type_match.group(1).capitalize() if type_match else "Manga"

            latest_match = re.search(r"<span>Terbaru:\s*</span><span>Chapter\s*([^<]+)</span>", c)
            latest_ch_str = latest_match.group(1).strip() if latest_match else ""
            num_match = re.search(r"([0-9.]+)", latest_ch_str)
            latest_ch = float(num_match.group(1)) if num_match else 0.0

            results.append(
                {
                    "manga_id": slug,
                    "title": title,
                    "slug": slug,
                    "cover_image_url": cover,
                    "latest_chapter_number": latest_ch,
                    "latest_chapter_id": f"{slug}-chapter-{int(latest_ch) if latest_ch.is_integer() else latest_ch}",
                    "type": comic_type,
                    "release_time": info_text,
                    "user_rate": 7.5,
                    "server": "komiku",
                }
            )
        return results

    def _parse_manga_detail_html(self, html: str, slug: str) -> Dict[str, Any]:
        """Parses full manga detail and chapter tree from Komiku HTML."""
        t_match = re.search(r"<title>Komik\s+(.*?)\s+-\s+Komiku</title>", html, re.IGNORECASE)
        title = t_match.group(1).strip() if t_match else slug.replace("-", " ").title()

        desc_match = re.search(r'<meta\s+name=[\'"]description[\'"]\s+content=[\'"](.*?)[\'"]', html, re.DOTALL)
        desc = desc_match.group(1).strip() if desc_match else "Tidak ada sinopsis."

        c_match = re.search(r'<meta\s+property=[\'"]og:image[\'"]\s+content=[\'"](.*?)[\'"]', html)
        cover = c_match.group(1) if c_match else ""

        # Status check
        is_completed = bool(re.search(r"Tamat|Completed", html, re.IGNORECASE))
        status_num = 0 if is_completed else 1

        # Chapters parsing
        ch_rows = re.findall(r'<a[^>]*href=[\'"](/[^/\'"]*-chapter-[^/\'"]*/?)[\'"][^>]*>(.*?)</a>', html)
        chapters = []
        seen = set()
        for link, raw_title in ch_rows:
            ch_slug = link.strip("/")
            if ch_slug in seen:
                continue
            seen.add(ch_slug)

            t_clean = re.sub(r"<[^>]*>", "", raw_title).strip()
            num_match = re.search(r"Chapter\s*([0-9.]+)", t_clean, re.IGNORECASE)
            ch_num = float(num_match.group(1)) if num_match else 0.0

            chapters.append(
                {
                    "chapter_id": ch_slug,
                    "chapter_number": ch_num,
                    "title": t_clean or f"Chapter {ch_num}",
                    "slug": ch_slug,
                    "release_date": "",
                }
            )

        # Ensure sorted descending by chapter number
        chapters.sort(key=lambda x: x["chapter_number"], reverse=True)

        return {
            "manga_id": slug,
            "title": title,
            "slug": slug,
            "description": desc,
            "cover_image_url": cover,
            "status": status_num,
            "chapters": chapters,
            "server": "komiku",
        }

    def _parse_chapter_pages_html(self, html: str) -> List[str]:
        """Extracts direct WebP image URLs from chapter HTML."""
        imgs = re.findall(r'<img[^>]*src=[\'"](https?://image\d*\.komiku\.to/[^\'"]+)[\'"]', html)
        # Filter out promotional banners and watermarks
        valid_pages = [
            img for img in imgs
            if "promosi" not in img.lower()
            and "promo" not in img.lower()
            and "iklan" not in img.lower()
        ]
        return valid_pages

    # SQLite Persistence Helpers
    def _save_manga_list(self, items: List[Dict[str, Any]]) -> None:
        if not items:
            return
        conn = sqlite3.connect(self.db_path)
        try:
            with conn:
                for it in items:
                    conn.execute(
                        """
                        INSERT INTO komiku_manga (
                            slug, title, cover_url, latest_chapter_number, release_time, updated_at
                        )
                        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                        ON CONFLICT(slug) DO UPDATE SET
                            title = excluded.title,
                            cover_url = excluded.cover_url,
                            latest_chapter_number = excluded.latest_chapter_number,
                            release_time = excluded.release_time,
                            updated_at = CURRENT_TIMESTAMP;
                        """,
                        (
                            it["slug"],
                            it["title"],
                            it.get("cover_image_url", ""),
                            it.get("latest_chapter_number", 0.0),
                            it.get("release_time", ""),
                        ),
                    )
        finally:
            conn.close()

    def _save_full_manga_detail(self, detail: Dict[str, Any]) -> None:
        slug = detail.get("slug")
        if not slug:
            return
        conn = sqlite3.connect(self.db_path)
        try:
            with conn:
                conn.execute(
                    """
                    INSERT INTO komiku_manga (
                        slug, title, cover_url, description, status, updated_at
                    )
                    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                    ON CONFLICT(slug) DO UPDATE SET
                        title = excluded.title,
                        cover_url = excluded.cover_url,
                        description = excluded.description,
                        status = excluded.status,
                        updated_at = CURRENT_TIMESTAMP;
                    """,
                    (
                        slug,
                        detail.get("title", slug),
                        detail.get("cover_image_url", ""),
                        detail.get("description", ""),
                        detail.get("status", 1),
                    ),
                )
                chapters = detail.get("chapters", [])
                for ch in chapters:
                    conn.execute(
                        """
                        INSERT OR REPLACE INTO komiku_chapters (
                            chapter_id, manga_slug, chapter_number, title, release_date
                        )
                        VALUES (?, ?, ?, ?, ?);
                        """,
                        (
                            ch["chapter_id"],
                            slug,
                            ch.get("chapter_number", 0.0),
                            ch.get("title", ""),
                            ch.get("release_date", ""),
                        ),
                    )
        finally:
            conn.close()

    def _get_cached_latest(self, limit: int = 20, offset: int = 0) -> List[Dict[str, Any]]:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        try:
            cur = conn.cursor()
            cur.execute(
                "SELECT * FROM komiku_manga ORDER BY updated_at DESC LIMIT ? OFFSET ?",
                (limit, offset),
            )
            rows = cur.fetchall()
            return [
                {
                    "manga_id": r["slug"],
                    "title": r["title"],
                    "slug": r["slug"],
                    "cover_image_url": r["cover_url"],
                    "latest_chapter_number": r["latest_chapter_number"],
                    "release_time": r["release_time"] or "",
                    "server": "komiku",
                }
                for r in rows
            ]
        finally:
            conn.close()

    def _search_cached_manga(self, query: str, limit: int = 20) -> List[Dict[str, Any]]:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        try:
            cur = conn.cursor()
            cur.execute(
                "SELECT * FROM komiku_manga WHERE title LIKE ? OR slug LIKE ? LIMIT ?",
                (f"%{query}%", f"%{query}%", limit),
            )
            rows = cur.fetchall()
            return [
                {
                    "manga_id": r["slug"],
                    "title": r["title"],
                    "slug": r["slug"],
                    "cover_image_url": r["cover_url"],
                    "latest_chapter_number": r["latest_chapter_number"],
                    "server": "komiku",
                }
                for r in rows
            ]
        finally:
            conn.close()

    def _get_cached_manga_detail(self, slug: str) -> Optional[Dict[str, Any]]:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        try:
            cur = conn.cursor()
            cur.execute("SELECT * FROM komiku_manga WHERE slug = ?", (slug,))
            manga_row = cur.fetchone()
            if not manga_row:
                return None

            cur.execute(
                "SELECT * FROM komiku_chapters WHERE manga_slug = ? ORDER BY chapter_number DESC",
                (slug,),
            )
            ch_rows = cur.fetchall()
            chapters = [
                {
                    "chapter_id": r["chapter_id"],
                    "chapter_number": r["chapter_number"],
                    "title": r["title"],
                    "slug": r["chapter_id"],
                    "release_date": r["release_date"] or "",
                }
                for r in ch_rows
            ]

            return {
                "manga_id": manga_row["slug"],
                "title": manga_row["title"],
                "slug": manga_row["slug"],
                "description": manga_row["description"] or "",
                "cover_image_url": manga_row["cover_url"] or "",
                "status": manga_row["status"] if manga_row["status"] is not None else 1,
                "chapters": chapters,
                "server": "komiku",
            }
        finally:
            conn.close()

    def _get_cached_pages(self, chapter_id: str) -> Optional[List[str]]:
        conn = sqlite3.connect(self.db_path)
        try:
            cur = conn.cursor()
            cur.execute("SELECT pages_json FROM komiku_pages WHERE chapter_id = ?", (chapter_id,))
            row = cur.fetchone()
            if row and row[0]:
                return json.loads(row[0])
            return None
        finally:
            conn.close()

    def _save_cached_pages(self, chapter_id: str, pages: List[str]) -> None:
        conn = sqlite3.connect(self.db_path)
        try:
            with conn:
                conn.execute(
                    """
                    INSERT OR REPLACE INTO komiku_pages (chapter_id, pages_json, created_at)
                    VALUES (?, ?, CURRENT_TIMESTAMP);
                    """,
                    (chapter_id, json.dumps(pages)),
                )
        finally:
            conn.close()
