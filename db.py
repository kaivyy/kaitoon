"""SQLite database module for Kaitoon Web Reader.

Manages persistent storage for:
- Reading history
- Watchlist bookmarks
- Download tasks
"""

import os
import sqlite3
from typing import Any, Dict, List, Optional

DEFAULT_DB_PATH = os.path.join(os.path.dirname(__file__), "data", "kaitoon.db")


def get_connection(db_path: Optional[str] = None) -> sqlite3.Connection:
    """Create and return a SQLite connection with Row factory enabled."""
    target = db_path or DEFAULT_DB_PATH
    os.makedirs(os.path.dirname(os.path.abspath(target)), exist_ok=True)
    conn = sqlite3.connect(target)
    conn.row_factory = sqlite3.Row
    return conn


def init_db(db_path: Optional[str] = None) -> None:
    """Initialize database tables if they do not already exist."""
    conn = get_connection(db_path)
    try:
        with conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS reading_history (
                    manga_id TEXT PRIMARY KEY,
                    manga_title TEXT NOT NULL,
                    cover_url TEXT,
                    last_chapter_id TEXT NOT NULL,
                    last_chapter_number REAL NOT NULL,
                    read_mode TEXT NOT NULL DEFAULT 'webtoon',
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS watchlist (
                    manga_id TEXT PRIMARY KEY,
                    manga_title TEXT NOT NULL,
                    cover_url TEXT,
                    latest_chapter_number REAL DEFAULT 0,
                    has_new_update INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS downloads (
                    chapter_id TEXT PRIMARY KEY,
                    manga_id TEXT NOT NULL,
                    manga_title TEXT NOT NULL,
                    chapter_number REAL NOT NULL,
                    status TEXT NOT NULL,
                    file_path TEXT,
                    total_pages INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS read_chapters (
                    manga_id TEXT NOT NULL,
                    chapter_id TEXT NOT NULL,
                    chapter_number REAL NOT NULL,
                    read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (manga_id, chapter_id)
                )
                """
            )
    finally:
        conn.close()


def upsert_history(
    manga_id: str,
    title: str,
    cover_url: str,
    ch_id: str,
    ch_num: float,
    read_mode: str = "webtoon",
    db_path: Optional[str] = None,
) -> None:
    """Insert or update a reading history entry for a manga."""
    conn = get_connection(db_path)
    try:
        with conn:
            conn.execute(
                """
                INSERT INTO reading_history (
                    manga_id,
                    manga_title,
                    cover_url,
                    last_chapter_id,
                    last_chapter_number,
                    read_mode,
                    updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(manga_id) DO UPDATE SET
                    manga_title = excluded.manga_title,
                    cover_url = excluded.cover_url,
                    last_chapter_id = excluded.last_chapter_id,
                    last_chapter_number = excluded.last_chapter_number,
                    read_mode = excluded.read_mode,
                    updated_at = CURRENT_TIMESTAMP
                """,
                (manga_id, title, cover_url, ch_id, ch_num, read_mode),
            )
            conn.execute(
                """
                INSERT OR IGNORE INTO read_chapters (manga_id, chapter_id, chapter_number, read_at)
                VALUES (?, ?, ?, CURRENT_TIMESTAMP)
                """,
                (manga_id, ch_id, ch_num),
            )
    finally:
        conn.close()


def mark_chapter_read(
    manga_id: str,
    chapter_id: str,
    chapter_number: float,
    is_read: bool = True,
    db_path: Optional[str] = None,
) -> None:
    """Marks or unmarks a chapter as read in the database."""
    conn = get_connection(db_path)
    try:
        with conn:
            if is_read:
                conn.execute(
                    """
                    INSERT OR IGNORE INTO read_chapters (manga_id, chapter_id, chapter_number, read_at)
                    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
                    """,
                    (manga_id, chapter_id, chapter_number),
                )
            else:
                conn.execute(
                    "DELETE FROM read_chapters WHERE manga_id = ? AND chapter_id = ?",
                    (manga_id, chapter_id),
                )
    finally:
        conn.close()


def mark_all_chapters_read(
    manga_id: str,
    chapters: List[Dict[str, Any]],
    db_path: Optional[str] = None,
) -> int:
    """Marks multiple chapters as read for a manga."""
    conn = get_connection(db_path)
    count = 0
    try:
        with conn:
            for ch in chapters:
                ch_id = str(ch.get("chapter_id") or ch.get("id") or "")
                ch_num = float(ch.get("chapter_number") or 0)
                if ch_id:
                    conn.execute(
                        """
                        INSERT OR IGNORE INTO read_chapters (manga_id, chapter_id, chapter_number, read_at)
                        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
                        """,
                        (manga_id, ch_id, ch_num),
                    )
                    count += 1
        return count
    finally:
        conn.close()


def get_read_chapters(
    manga_id: str, db_path: Optional[str] = None
) -> List[Dict[str, Any]]:
    """Retrieve all read chapters for a given manga ID."""
    conn = get_connection(db_path)
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT chapter_id, chapter_number, read_at FROM read_chapters WHERE manga_id = ? ORDER BY chapter_number ASC",
            (manga_id,),
        )
        return [dict(r) for r in cur.fetchall()]
    finally:
        conn.close()


def get_history(limit: int = 50, db_path: Optional[str] = None) -> List[Dict[str, Any]]:
    """Retrieve reading history ordered by most recently updated."""
    conn = get_connection(db_path)
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT * FROM reading_history ORDER BY updated_at DESC LIMIT ?",
            (limit,),
        )
        return [dict(r) for r in cur.fetchall()]
    finally:
        conn.close()


def get_history_by_manga(
    manga_id: str, db_path: Optional[str] = None
) -> Optional[Dict[str, Any]]:
    """Retrieve reading history entry for a specific manga ID."""
    conn = get_connection(db_path)
    try:
        cur = conn.cursor()
        cur.execute("SELECT * FROM reading_history WHERE manga_id = ?", (manga_id,))
        row = cur.fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def toggle_watchlist(
    manga_id: str,
    title: str,
    cover_url: str,
    latest_ch: float = 0.0,
    db_path: Optional[str] = None,
) -> bool:
    """Toggle watchlist presence for a manga. Returns True if added, False if removed."""
    conn = get_connection(db_path)
    try:
        cur = conn.cursor()
        cur.execute("SELECT manga_id FROM watchlist WHERE manga_id = ?", (manga_id,))
        exists = cur.fetchone()
        if exists:
            with conn:
                conn.execute("DELETE FROM watchlist WHERE manga_id = ?", (manga_id,))
            return False
        else:
            with conn:
                conn.execute(
                    """
                    INSERT INTO watchlist (
                        manga_id,
                        manga_title,
                        cover_url,
                        latest_chapter_number,
                        has_new_update
                    )
                    VALUES (?, ?, ?, ?, 0)
                    """,
                    (manga_id, title, cover_url, latest_ch),
                )
            return True
    finally:
        conn.close()


def get_watchlist(db_path: Optional[str] = None) -> List[Dict[str, Any]]:
    """Retrieve all watchlist items ordered by new updates first, then creation date."""
    conn = get_connection(db_path)
    try:
        cur = conn.cursor()
        cur.execute("SELECT * FROM watchlist ORDER BY has_new_update DESC, created_at DESC")
        return [dict(r) for r in cur.fetchall()]
    finally:
        conn.close()


def is_in_watchlist(manga_id: str, db_path: Optional[str] = None) -> bool:
    """Check whether a manga is in the watchlist."""
    conn = get_connection(db_path)
    try:
        cur = conn.cursor()
        cur.execute("SELECT 1 FROM watchlist WHERE manga_id = ?", (manga_id,))
        return cur.fetchone() is not None
    finally:
        conn.close()


def update_watchlist_chapter(
    manga_id: str,
    latest_ch: float,
    has_new: bool = True,
    db_path: Optional[str] = None,
) -> None:
    """Update latest chapter number and update notification flag for a watchlist item."""
    conn = get_connection(db_path)
    try:
        with conn:
            conn.execute(
                """
                UPDATE watchlist
                SET latest_chapter_number = ?, has_new_update = ?
                WHERE manga_id = ?
                """,
                (latest_ch, 1 if has_new else 0, manga_id),
            )
    finally:
        conn.close()


def clear_watchlist_update(manga_id: str, db_path: Optional[str] = None) -> None:
    """Clear new update notification flag for a watchlist item."""
    conn = get_connection(db_path)
    try:
        with conn:
            conn.execute(
                "UPDATE watchlist SET has_new_update = 0 WHERE manga_id = ?",
                (manga_id,),
            )
    finally:
        conn.close()


def create_download(
    ch_id: str,
    manga_id: str,
    title: str,
    ch_num: float,
    total_pages: int,
    db_path: Optional[str] = None,
) -> None:
    """Record a pending download task in the database."""
    conn = get_connection(db_path)
    try:
        with conn:
            conn.execute(
                """
                INSERT OR REPLACE INTO downloads (
                    chapter_id,
                    manga_id,
                    manga_title,
                    chapter_number,
                    status,
                    total_pages
                )
                VALUES (?, ?, ?, ?, 'pending', ?)
                """,
                (ch_id, manga_id, title, ch_num, total_pages),
            )
    finally:
        conn.close()


def update_download_status(
    ch_id: str,
    status: str,
    file_path: Optional[str] = None,
    db_path: Optional[str] = None,
) -> None:
    """Update the status and optional file path for a download task."""
    conn = get_connection(db_path)
    try:
        with conn:
            if file_path:
                conn.execute(
                    "UPDATE downloads SET status = ?, file_path = ? WHERE chapter_id = ?",
                    (status, file_path, ch_id),
                )
            else:
                conn.execute(
                    "UPDATE downloads SET status = ? WHERE chapter_id = ?",
                    (status, ch_id),
                )
    finally:
        conn.close()


def get_download(
    ch_id: str, db_path: Optional[str] = None
) -> Optional[Dict[str, Any]]:
    """Retrieve details for a download task by chapter ID."""
    conn = get_connection(db_path)
    try:
        cur = conn.cursor()
        cur.execute("SELECT * FROM downloads WHERE chapter_id = ?", (ch_id,))
        row = cur.fetchone()
        return dict(row) if row else None
    finally:
        conn.close()
