import os
import tempfile
import pytest
from kaitoon.db import (
    init_db,
    upsert_history,
    get_history,
    get_history_by_manga,
    toggle_watchlist,
    get_watchlist,
    is_in_watchlist,
    update_watchlist_chapter,
    clear_watchlist_update,
    create_download,
    update_download_status,
    get_download,
)

@pytest.fixture
def temp_db():
    fd, path = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    init_db(path)
    yield path
    if os.path.exists(path):
        os.remove(path)

def test_reading_history_crud(temp_db):
    upsert_history("manga-1", "Solo Farming", "http://cover.jpg", "ch-100", 100.0, "webtoon", db_path=temp_db)
    item = get_history_by_manga("manga-1", db_path=temp_db)
    assert item is not None
    assert item["manga_title"] == "Solo Farming"
    assert item["last_chapter_number"] == 100.0
    assert item["read_mode"] == "webtoon"

    # Upsert with newer chapter
    upsert_history("manga-1", "Solo Farming", "http://cover.jpg", "ch-101", 101.0, "manga", db_path=temp_db)
    updated = get_history_by_manga("manga-1", db_path=temp_db)
    assert updated["last_chapter_number"] == 101.0
    assert updated["read_mode"] == "manga"

    history_list = get_history(limit=10, db_path=temp_db)
    assert len(history_list) == 1
    assert history_list[0]["manga_id"] == "manga-1"

def test_watchlist_crud(temp_db):
    assert is_in_watchlist("manga-2", db_path=temp_db) is False

    # Add to watchlist
    is_saved = toggle_watchlist("manga-2", "Magic Emperor", "http://cover2.jpg", 50.0, db_path=temp_db)
    assert is_saved is True
    assert is_in_watchlist("manga-2", db_path=temp_db) is True

    # Update with new chapter
    update_watchlist_chapter("manga-2", 51.0, has_new=True, db_path=temp_db)
    wl = get_watchlist(db_path=temp_db)
    assert len(wl) == 1
    assert wl[0]["latest_chapter_number"] == 51.0
    assert wl[0]["has_new_update"] == 1

    # Clear update flag
    clear_watchlist_update("manga-2", db_path=temp_db)
    wl_cleared = get_watchlist(db_path=temp_db)
    assert wl_cleared[0]["has_new_update"] == 0

    # Toggle removes from watchlist
    is_saved_after = toggle_watchlist("manga-2", "Magic Emperor", "http://cover2.jpg", 51.0, db_path=temp_db)
    assert is_saved_after is False
    assert is_in_watchlist("manga-2", db_path=temp_db) is False

def test_downloads_tracking(temp_db):
    create_download("ch-uuid-1", "manga-1", "Solo Farming", 10.0, 20, db_path=temp_db)
    dl = get_download("ch-uuid-1", db_path=temp_db)
    assert dl is not None
    assert dl["status"] == "pending"
    assert dl["total_pages"] == 20

    update_download_status("ch-uuid-1", "completed", "/downloads/ch10.cbz", db_path=temp_db)
    dl_done = get_download("ch-uuid-1", db_path=temp_db)
    assert dl_done["status"] == "completed"
    assert dl_done["file_path"] == "/downloads/ch10.cbz"

    # Status update without file path
    update_download_status("ch-uuid-1", "failed", db_path=temp_db)
    dl_failed = get_download("ch-uuid-1", db_path=temp_db)
    assert dl_failed["status"] == "failed"
    assert dl_failed["file_path"] == "/downloads/ch10.cbz"

def test_edge_cases(temp_db):
    # Non-existent history
    assert get_history_by_manga("non-existent", db_path=temp_db) is None
    # Empty history
    assert get_history(limit=10, db_path=temp_db) == []

    # Non-existent download
    assert get_download("non-existent-ch", db_path=temp_db) is None

    # Update watchlist chapter with has_new=False
    toggle_watchlist("manga-3", "Test Title", "http://cover3.jpg", 1.0, db_path=temp_db)
    update_watchlist_chapter("manga-3", 2.0, has_new=False, db_path=temp_db)
    wl = get_watchlist(db_path=temp_db)
    assert len(wl) == 1
    assert wl[0]["latest_chapter_number"] == 2.0
    assert wl[0]["has_new_update"] == 0
