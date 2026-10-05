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

def test_api_manga_detail_all_chapters_pagination(client):
    mock_detail = {"data": {"manga_id": "m2", "title": "Manga Two"}}
    page1 = {
        "data": [{"chapter_id": f"c{i}", "chapter_number": float(i)} for i in range(100, 50, -1)],
        "meta": {"page": 1, "page_size": 50, "total_page": 2, "total_record": 100}
    }
    page2 = {
        "data": [{"chapter_id": f"c{i}", "chapter_number": float(i)} for i in range(50, 0, -1)],
        "meta": {"page": 2, "page_size": 50, "total_page": 2, "total_record": 100}
    }
    def mock_list_chapters(manga_id, page=1, **kwargs):
        return page1 if page == 1 else page2

    with patch("kaitoon.server.client.get_manga_detail", return_value=mock_detail), \
         patch("kaitoon.server.client.list_chapters", side_effect=mock_list_chapters):
        res = client.get("/api/manga/m2")
        assert res.status_code == 200
        chapters = res.json()["data"]["chapters"]
        assert len(chapters) == 100
        assert chapters[0]["chapter_number"] == 100.0
        assert chapters[-1]["chapter_number"] == 1.0

def test_api_manga_detail_slug_resolution(client):
    mock_search = {"data": [{"manga_id": "uuid-1234", "title": "The Heavenly Sovereign"}]}
    mock_detail = {"data": {"manga_id": "uuid-1234", "title": "The Heavenly Sovereign"}}
    mock_chapters = {"data": [{"chapter_id": "c1", "chapter_number": 1.0}]}

    with patch("kaitoon.server.client.search_manga", return_value=mock_search), \
         patch("kaitoon.server.client.get_manga_detail", return_value=mock_detail), \
         patch("kaitoon.server.client.list_chapters", return_value=mock_chapters):
        res = client.get("/api/manga/the-heavenly-sovereign")
        assert res.status_code == 200
        data = res.json()["data"]
        assert data["manga_id"] == "uuid-1234"
        assert data["slug"] == "the-heavenly-sovereign"
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


@pytest.mark.anyio
async def test_auto_sync_watchlist_task_cycle(tmp_path):
    import asyncio
    test_db = str(tmp_path / "sync_task.db")
    init_db(test_db)
    from kaitoon.db import toggle_watchlist
    from kaitoon.server import auto_sync_watchlist_task

    toggle_watchlist("sync-test-1", "Sync Task Comic", "http://c.jpg", 10.0, db_path=test_db)

    mock_client = MagicMock()
    mock_client.list_manga.return_value = {
        "data": [
            {"manga_id": "sync-test-1", "latest_chapter_number": 11.0}
        ]
    }

    with patch("kaitoon.server.client", mock_client), \
         patch("kaitoon.server.DEFAULT_DB_PATH", test_db):
        task = asyncio.create_task(auto_sync_watchlist_task(interval_seconds=0))
        # Yield to let the task run one cycle
        await asyncio.sleep(0.02)
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass

    assert mock_client.list_manga.called


def test_api_latest_komiku_server(client):
    mock_komiku = {
        "data": [{"manga_id": "komiku-1", "title": "Komiku Comic 1", "server": "komiku"}],
        "meta": {"page": 1, "page_size": 1, "server": "komiku"}
    }
    with patch("kaitoon.server.komiku_client.list_latest", return_value=mock_komiku):
        res = client.get("/api/latest?page=1&server=komiku")
        assert res.status_code == 200
        assert res.json()["meta"]["server"] == "komiku"
        assert res.json()["data"][0]["title"] == "Komiku Comic 1"


def test_api_search_komiku_server(client):
    mock_search = {
        "data": [{"manga_id": "komiku-s", "title": "Search Result", "server": "komiku"}],
        "meta": {"page": 1, "page_size": 1, "server": "komiku"}
    }
    with patch("kaitoon.server.komiku_client.search_manga", return_value=mock_search):
        res = client.get("/api/search?q=piece&server=komiku")
        assert res.status_code == 200
        assert res.json()["meta"]["server"] == "komiku"
        assert res.json()["data"][0]["manga_id"] == "komiku-s"


def test_api_manga_detail_komiku_server(client):
    mock_detail = {
        "data": {
            "manga_id": "one-piece",
            "title": "One Piece",
            "chapters": [{"chapter_id": "ch-1", "chapter_number": 1.0}],
            "server": "komiku"
        }
    }
    with patch("kaitoon.server.komiku_client.get_manga_detail", return_value=mock_detail):
        res = client.get("/api/manga/one-piece?server=komiku")
        assert res.status_code == 200
        assert res.json()["data"]["server"] == "komiku"
        assert res.json()["data"]["title"] == "One Piece"


def test_api_chapter_pages_komiku_server(client):
    mock_pages = ["https://image1.komiku.to/01.webp", "https://image1.komiku.to/02.webp"]
    with patch("kaitoon.server.komiku_client.get_chapter_image_urls", return_value=mock_pages):
        res = client.get("/api/chapter/ch-one-piece-1100-bahasa-indonesia/pages")
        assert res.status_code == 200
        assert res.json()["server"] == "komiku"
        assert len(res.json()["pages"]) == 2


@pytest.mark.anyio
async def test_auto_sync_komiku_task_cycle():
    import asyncio
    from kaitoon.server import auto_sync_komiku_task

    mock_kclient = MagicMock()
    mock_kclient.crawl_latest.return_value = 0

    with patch("kaitoon.server.komiku_client", mock_kclient):
        task = asyncio.create_task(auto_sync_komiku_task(interval_seconds=0))
        await asyncio.sleep(0.02)
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass

    assert mock_kclient.crawl_latest.called




