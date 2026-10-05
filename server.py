"""FastAPI Backend Server and Auto-Sync Worker for Kaitoon Web Reader.

Provides REST API endpoints for:
- Browsing latest releases and searching manga
- Retrieving manga details and chapter pages
- Reading history and watchlist synchronization
- Chapter downloads (.cbz packaging)
- Serving static assets and web reader UI
"""

import os
import sys

# Ensure parent directory is in sys.path for direct script execution
_pkg_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _pkg_dir not in sys.path:
    sys.path.insert(0, _pkg_dir)

import asyncio
import logging
from contextlib import asynccontextmanager
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, BackgroundTasks, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from kaitoon.client import ShinigamiClient
from kaitoon.db import (
    DEFAULT_DB_PATH,
    init_db,
    upsert_history,
    get_history,
    toggle_watchlist,
    get_watchlist,
    update_watchlist_chapter,
    create_download,
    update_download_status,
    get_download,
)
from kaitoon.downloader import package_chapter_cbz

logger = logging.getLogger("KaitoonServer")

STATIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")
os.makedirs(STATIC_DIR, exist_ok=True)

DOWNLOADS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "downloads")
os.makedirs(DOWNLOADS_DIR, exist_ok=True)

client = ShinigamiClient(web_url="https://11.shinigami.asia")


class HistoryPayload(BaseModel):
    manga_id: str
    manga_title: str
    cover_url: str = ""
    chapter_id: str
    chapter_number: float
    read_mode: str = "webtoon"


class WatchlistTogglePayload(BaseModel):
    manga_id: str
    manga_title: str
    cover_url: str = ""
    latest_chapter_number: float = 0.0


class DownloadRequestPayload(BaseModel):
    manga_id: Optional[str] = None
    manga_title: Optional[str] = "Manga"
    chapter_number: Optional[float] = None
    total_pages: Optional[int] = 0


def check_watchlist_updates(
    client: Optional[ShinigamiClient] = None,
    db_path: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """Checks the watchlist against latest releases to flag updated chapters."""
    active_client = client or globals().get("client")
    target_db = db_path or DEFAULT_DB_PATH
    watchlist = get_watchlist(db_path=target_db)
    if not watchlist:
        return []

    updates_found = []
    wl_map = {item["manga_id"]: item for item in watchlist}
    try:
        latest = active_client.list_manga(page=1, page_size=50, sort="latest")
        items = latest.get("data", []) if isinstance(latest, dict) else []
        for item in items:
            m_id = item.get("manga_id")
            if m_id in wl_map:
                curr_num = float(item.get("latest_chapter_number") or 0.0)
                saved_num = float(wl_map[m_id].get("latest_chapter_number") or 0.0)
                if curr_num > saved_num:
                    update_watchlist_chapter(m_id, curr_num, has_new=True, db_path=target_db)
                    updates_found.append({
                        "manga_id": m_id,
                        "manga_title": wl_map[m_id].get("manga_title"),
                        "new_chapter": curr_num,
                    })
    except Exception as err:
        logger.error(f"Error checking watchlist updates: {err}")

    return updates_found


async def auto_sync_watchlist_task(interval_seconds: int = 1800) -> None:
    """Background loop that periodically checks watchlist items for updates."""
    try:
        while True:
            await asyncio.sleep(interval_seconds)
            try:
                await asyncio.to_thread(check_watchlist_updates, client=client, db_path=DEFAULT_DB_PATH)
            except Exception as err:
                logger.error(f"Watchlist auto-sync cycle failed: {err}")
    except asyncio.CancelledError:
        logger.info("Watchlist auto-sync background worker stopped.")


def run_chapter_download(
    chapter_id: str,
    manga_title: str,
    db_path: str,
) -> None:
    """Worker function to process chapter image downloading and CBZ archiving."""
    try:
        update_download_status(chapter_id, "downloading", db_path=db_path)
        cbz_path = package_chapter_cbz(
            client=client,
            chapter_id=chapter_id,
            manga_title=manga_title,
            output_dir=DOWNLOADS_DIR,
        )
        update_download_status(chapter_id, "completed", file_path=cbz_path, db_path=db_path)
    except Exception as err:
        logger.error(f"Chapter download failed for {chapter_id}: {err}")
        update_download_status(chapter_id, "failed", db_path=db_path)


@asynccontextmanager
async def lifespan(app_instance: FastAPI):
    """Lifespan manager for database bootstrap and background worker lifecycle."""
    init_db(DEFAULT_DB_PATH)
    worker_task = asyncio.create_task(auto_sync_watchlist_task())
    yield
    worker_task.cancel()
    try:
        await worker_task
    except asyncio.CancelledError:
        pass


app = FastAPI(
    title="Kaitoon Web Reader API",
    description="Backend API and offline downloader for Kaitoon Web Reader",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
astro_assets_dir = os.path.join(STATIC_DIR, "_astro")
os.makedirs(astro_assets_dir, exist_ok=True)
app.mount("/_astro", StaticFiles(directory=astro_assets_dir), name="astro")


@app.get("/")
def get_root():
    """Serves index.html if present, otherwise returns API status metadata."""
    index_file = os.path.join(STATIC_DIR, "index.html")
    if os.path.exists(index_file):
        return FileResponse(index_file)
    return {
        "status": "ok",
        "app": "Kaitoon Web Reader",
        "version": "1.0.0",
        "message": "Static frontend not yet built. API endpoints active.",
    }


@app.get("/api/latest")
def get_latest_manga(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    sort: str = "latest",
    sort_order: str = "desc",
):
    """Retrieves list of latest updated manga from Shinigami API."""
    try:
        return client.list_manga(page=page, page_size=page_size, sort=sort, sort_order=sort_order)
    except Exception as err:
        logger.error(f"Failed to fetch latest manga: {err}")
        raise HTTPException(status_code=500, detail=str(err))


@app.get("/api/search")
def search_manga_endpoint(
    q: str = Query("", description="Search keywords"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    """Searches manga titles with keyword query."""
    if not q.strip():
        return {"data": [], "meta": {"page": page, "page_size": page_size, "total": 0}}
    try:
        return client.search_manga(query=q.strip(), page=page, page_size=page_size)
    except Exception as err:
        logger.error(f"Search request failed: {err}")
        raise HTTPException(status_code=500, detail=str(err))


@app.get("/api/manga/{id}")
def get_manga_endpoint(
    id: str,
    page: Optional[int] = Query(None, ge=1),
    page_size: Optional[int] = Query(None, ge=1, le=1000),
    sort_order: str = "desc",
    all_chapters: bool = Query(True, description="Whether to fetch all chapters across pages"),
):
    """Retrieves full manga details along with chapter listings."""
    try:
        detail = client.get_manga_detail(id)
        try:
            if all_chapters and page is None and hasattr(client, "get_all_chapters"):
                chapters = client.get_all_chapters(id, sort_order=sort_order)
            else:
                chapters = client.list_chapters(
                    id, page=page or 1, page_size=page_size or 100, sort_order=sort_order
                )
            if isinstance(detail, dict) and "data" in detail and isinstance(detail["data"], dict):
                detail["data"]["chapters"] = chapters.get("data", [])
                detail["data"]["chapters_meta"] = chapters.get("meta", {})
        except Exception as ch_err:
            logger.warning(f"Failed to fetch chapters for manga {id}: {ch_err}")
        return detail
    except Exception as err:
        logger.error(f"Failed to fetch manga detail for {id}: {err}")
        raise HTTPException(status_code=500, detail=str(err))


@app.get("/api/chapter/{id}/pages")
def get_chapter_pages_endpoint(id: str):
    """Retrieves direct CDN image URLs for all pages in a chapter."""
    try:
        urls = client.get_chapter_image_urls(id)
        return {
            "chapter_id": id,
            "pages": urls,
            "data": urls,
            "total": len(urls),
        }
    except Exception as err:
        logger.error(f"Failed to fetch chapter pages for {id}: {err}")
        raise HTTPException(status_code=500, detail=str(err))


@app.get("/api/history")
def get_reading_history(limit: int = Query(50, ge=1, le=200)):
    """Retrieves stored reading history ordered by recency."""
    return get_history(limit=limit, db_path=DEFAULT_DB_PATH)


@app.post("/api/history")
def save_reading_history(payload: HistoryPayload):
    """Records or updates reading history position for a manga."""
    upsert_history(
        manga_id=payload.manga_id,
        title=payload.manga_title,
        cover_url=payload.cover_url,
        ch_id=payload.chapter_id,
        ch_num=payload.chapter_number,
        read_mode=payload.read_mode,
        db_path=DEFAULT_DB_PATH,
    )
    return {"status": "ok"}


@app.get("/api/watchlist")
def get_watchlist_endpoint():
    """Retrieves bookmarked manga in the watchlist."""
    return get_watchlist(db_path=DEFAULT_DB_PATH)


@app.post("/api/watchlist/toggle")
def toggle_watchlist_endpoint(payload: WatchlistTogglePayload):
    """Toggles bookmark status of a manga in the watchlist."""
    is_saved = toggle_watchlist(
        manga_id=payload.manga_id,
        title=payload.manga_title,
        cover_url=payload.cover_url,
        latest_ch=payload.latest_chapter_number,
        db_path=DEFAULT_DB_PATH,
    )
    return {"status": "ok", "is_saved": is_saved}


@app.post("/api/chapter/{id}/download")
def download_chapter_endpoint(
    id: str,
    background_tasks: BackgroundTasks,
    payload: Optional[DownloadRequestPayload] = None,
):
    """Enqueues a chapter download task to run in the background."""
    req = payload or DownloadRequestPayload()
    m_id = req.manga_id or "unknown"
    title = req.manga_title or "Manga"
    ch_num = req.chapter_number or 0.0
    pages = req.total_pages or 0

    if not req.manga_id or req.chapter_number is None or pages == 0:
        try:
            ch_detail = client.get_chapter_detail(id)
            ch_data = ch_detail.get("data", {}) if isinstance(ch_detail, dict) else {}
            if not req.manga_id:
                m_id = ch_data.get("manga_id", m_id)
            if req.chapter_number is None:
                ch_num = float(ch_data.get("chapter_number", ch_num))
            if pages == 0:
                pages = len(ch_data.get("chapter", {}).get("data", []))
        except Exception as err:
            logger.warning(f"Could not retrieve chapter metadata for {id}: {err}")

    create_download(
        ch_id=id,
        manga_id=m_id,
        title=title,
        ch_num=ch_num,
        total_pages=pages,
        db_path=DEFAULT_DB_PATH,
    )

    background_tasks.add_task(run_chapter_download, id, title, DEFAULT_DB_PATH)

    return {
        "status": "pending",
        "chapter_id": id,
        "manga_id": m_id,
        "manga_title": title,
        "chapter_number": ch_num,
        "total_pages": pages,
    }


@app.get("/api/chapter/{id}/status")
def get_chapter_download_status(id: str):
    """Returns status and progress of a chapter download task."""
    record = get_download(id, db_path=DEFAULT_DB_PATH)
    if not record:
        raise HTTPException(status_code=404, detail="Chapter download record not found")
    return record


@app.get("/api/chapter/{id}/file")
def get_chapter_download_file(id: str):
    """Streams or downloads the packaged CBZ file for an offline chapter."""
    record = get_download(id, db_path=DEFAULT_DB_PATH)
    if not record:
        raise HTTPException(status_code=404, detail="Chapter download not found")

    file_path = record.get("file_path")
    if not file_path or not os.path.exists(file_path):
        raise HTTPException(
            status_code=404,
            detail="Chapter file not ready or not found on storage"
        )

    return FileResponse(
        path=file_path,
        filename=os.path.basename(file_path),
        media_type="application/vnd.comicbook+zip",
    )


if __name__ == "__main__":
    import argparse
    import uvicorn

    parser = argparse.ArgumentParser(description="Kaitoon Web Reader API Server")
    parser.add_argument("--host", default="0.0.0.0", help="Host interface to bind")
    parser.add_argument("--port", type=int, default=9000, help="Port to listen on")
    parser.add_argument("--reload", action="store_true", help="Enable reload mode")
    args = parser.parse_args()

    if args.reload:
        uvicorn.run(
            "kaitoon.server:app",
            host=args.host,
            port=args.port,
            reload=True,
            loop="asyncio",
            http="h11",
        )
    else:
        uvicorn.run(
            app,
            host=args.host,
            port=args.port,
            loop="asyncio",
            http="h11",
        )


