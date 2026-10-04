import os
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
from kaitoon.server import app, check_watchlist_updates
from kaitoon.db import init_db

@pytest.fixture(autouse=True)
def setup_test_db(tmp_path):
    test_db_path = str(tmp_path / "test_api.db")
    init_db(test_db_path)
    with patch("kaitoon.server.DEFAULT_DB_PATH", test_db_path), \
         patch("kaitoon.db.DEFAULT_DB_PATH", test_db_path):
        yield

@pytest.fixture
def client():
    return TestClient(app)

def test_api_history_flow(client):
    res = client.get("/api/history")
    assert res.status_code == 200
    assert res.json() == []

    payload = {
        "manga_id": "test-manga",
        "manga_title": "Test Comic",
        "cover_url": "http://img.jpg",
        "chapter_id": "ch-1",
        "chapter_number": 1.0,
        "read_mode": "webtoon"
    }
    post_res = client.post("/api/history", json=payload)
    assert post_res.status_code == 200

    after_res = client.get("/api/history")
    assert len(after_res.json()) == 1
    assert after_res.json()[0]["manga_title"] == "Test Comic"

def test_api_watchlist_toggle(client):
    payload = {
        "manga_id": "wl-manga",
        "manga_title": "Watchlist Comic",
        "cover_url": "http://cover.jpg",
        "latest_chapter_number": 25.0
    }
    toggle_res = client.post("/api/watchlist/toggle", json=payload)
    assert toggle_res.status_code == 200
    assert toggle_res.json()["is_saved"] is True

    get_res = client.get("/api/watchlist")
    assert len(get_res.json()) == 1
    assert get_res.json()[0]["manga_id"] == "wl-manga"

    # Toggle again to remove
    toggle_res2 = client.post("/api/watchlist/toggle", json=payload)
    assert toggle_res2.json()["is_saved"] is False
    assert len(client.get("/api/watchlist").json()) == 0

def test_api_latest(client):
    mock_data = {"data": [{"manga_id": "m1", "title": "Comic 1"}]}
    with patch("kaitoon.server.client.list_manga", return_value=mock_data):
        res = client.get("/api/latest?page=1&page_size=10")
        assert res.status_code == 200
        assert res.json() == mock_data

def test_api_search(client):
    mock_data = {"data": [{"manga_id": "m2", "title": "Searched Comic"}]}
    with patch("kaitoon.server.client.search_manga", return_value=mock_data):
        res = client.get("/api/search?q=Solo")
        assert res.status_code == 200
        assert res.json() == mock_data

def test_api_manga_detail(client):
    mock_detail = {"data": {"manga_id": "m1", "title": "Manga One"}}
    mock_chapters = {"data": [{"chapter_id": "c1", "chapter_number": 1.0}]}
    with patch("kaitoon.server.client.get_manga_detail", return_value=mock_detail), \
         patch("kaitoon.server.client.list_chapters", return_value=mock_chapters):
        res = client.get("/api/manga/m1")
        assert res.status_code == 200
        data = res.json()["data"]
        assert data["title"] == "Manga One"
        assert len(data.get("chapters", [])) == 1

def test_api_chapter_pages(client):
    mock_urls = ["http://img1.jpg", "http://img2.jpg"]
    with patch("kaitoon.server.client.get_chapter_image_urls", return_value=mock_urls):
        res = client.get("/api/chapter/ch-1/pages")
        assert res.status_code == 200
        assert res.json()["pages"] == mock_urls
        assert res.json()["total"] == 2

def test_api_chapter_download_and_file_flow(client, tmp_path):
    # Test 404 for unknown chapter status
    unknown_res = client.get("/api/chapter/unknown-ch/status")
    assert unknown_res.status_code == 404

    # Trigger download
    dummy_file = tmp_path / "comic.cbz"
    dummy_file.write_bytes(b"PK\x03\x04dummycbzdata")

    with patch("kaitoon.server.package_chapter_cbz", return_value=str(dummy_file)):
        req_payload = {
            "manga_id": "m-dl",
            "manga_title": "Download Manga",
            "chapter_number": 5.0
        }
        dl_res = client.post("/api/chapter/ch-5/download", json=req_payload)
        assert dl_res.status_code == 200
        assert dl_res.json()["status"] == "pending"

        # Check status
        st_res = client.get("/api/chapter/ch-5/status")
        assert st_res.status_code == 200
        assert st_res.json()["status"] in ["pending", "completed", "downloading"]

        # Fetch file after completed
        file_res = client.get("/api/chapter/ch-5/file")
        assert file_res.status_code == 200
        assert file_res.content == b"PK\x03\x04dummycbzdata"

def test_root_and_static_routes(client, tmp_path):
    # Test root endpoint fallback when index.html does not exist
    with patch("kaitoon.server.STATIC_DIR", str(tmp_path / "empty_static")):
        os.makedirs(str(tmp_path / "empty_static"), exist_ok=True)
        res = client.get("/")
        assert res.status_code == 200
        assert "status" in res.json()

    # Test root endpoint when index.html exists
    static_folder = tmp_path / "custom_static"
    static_folder.mkdir(parents=True, exist_ok=True)
    index_file = static_folder / "index.html"
    index_file.write_text("<html><body>Kaitoon Reader</body></html>")

    with patch("kaitoon.server.STATIC_DIR", str(static_folder)):
        res = client.get("/")
        assert res.status_code == 200
        assert "Kaitoon Reader" in res.text

def test_auto_sync_watchlist(tmp_path):
    test_db = str(tmp_path / "sync.db")
    init_db(test_db)
    from kaitoon.db import toggle_watchlist, get_watchlist

    toggle_watchlist("sync-1", "Sync Manga", "http://c.jpg", 10.0, db_path=test_db)

    mock_client = MagicMock()
    mock_client.list_manga.return_value = {
        "data": [
            {"manga_id": "sync-1", "latest_chapter_number": 12.0}
        ]
    }

    updates = check_watchlist_updates(client=mock_client, db_path=test_db)
    assert len(updates) == 1
    assert updates[0]["new_chapter"] == 12.0

    wl = get_watchlist(db_path=test_db)
    assert wl[0]["latest_chapter_number"] == 12.0
    assert wl[0]["has_new_update"] == 1
