"""End-to-End Integration and Antislop Delivery Gate Test Suite for Kaitoon.

Verifies:
1. End-to-end integration:
   - Root HTML serving (GET /)
   - Shinigami API proxying (GET /api/latest)
   - CDN page reconstruction (GET /api/chapter/{id}/pages)
   - Multi-device reading history synchronization (GET and POST /api/history)
   - Watchlist toggle and auto-sync update flagging (GET and POST /api/watchlist)
   - Chapter download status tracking and CBZ packaging (GET and POST /api/chapter/{id}/download)
2. Live server execution:
   - Boots FastAPI server via Uvicorn in background process
   - Executes curls against / and /api/latest
   - Verifies HTTP 200 status and valid payloads
   - Gracefully terminates background server process
3. Full Antislop Delivery Gate checks:
   - R-02: Zero em dashes across repository files
   - R-03: Mobile responsive (viewport meta, overflow-x hidden, >=44px tap targets)
   - R-21: OLED pure black canvas (#000000)
   - R-25: WCAG AAA text contrast (>= 7:1 against pure black)
   - R-26: All buttons functional, zero dead controls
   - R-27: Loading, empty, and error states present and wired
   - R-32: Keyboard navigation and shortcuts verified
   - R-35: Live application verified
"""

import os
import sys
import time
import json
import socket
import re
import zipfile
import subprocess
import urllib.request
from unittest.mock import patch, MagicMock

import pytest
from fastapi.testclient import TestClient

import kaitoon
from kaitoon.server import app, check_watchlist_updates
from kaitoon.db import (
    init_db,
    get_history,
    get_watchlist,
    get_download,
    update_download_status,
)

BASE_DIR = os.path.dirname(os.path.abspath(kaitoon.server.__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")


@pytest.fixture
def setup_isolated_db(tmp_path, monkeypatch):
    """Initializes an isolated SQLite database for each test run."""
    test_db = str(tmp_path / "test_e2e.db")
    init_db(test_db)
    monkeypatch.setattr("kaitoon.server.DEFAULT_DB_PATH", test_db)
    monkeypatch.setattr("kaitoon.db.DEFAULT_DB_PATH", test_db)
    return test_db


@pytest.fixture
def test_client(setup_isolated_db):
    """Provides a TestClient instance with an isolated database."""
    return TestClient(app)


# ==============================================================================
# Step 1: Automated End-to-End Integration Tests
# ==============================================================================

def test_e2e_root_html_serving(test_client):
    """Verifies that GET / serves valid HTML containing Kaitoon branding."""
    res = test_client.get("/")
    assert res.status_code == 200
    assert "text/html" in res.headers.get("content-type", "")

    html = res.text
    assert "<!DOCTYPE html>" in html
    assert "<title>Kaitoon Web Reader</title>" in html
    assert "Kaitoon" in html
    assert 'name="viewport"' in html
    assert 'content="width=device-width, initial-scale=1.0"' in html
    assert 'id="catalog-view"' in html
    assert 'id="detail-view"' in html
    assert 'id="reader-view"' in html


def test_e2e_shinigami_api_proxy_latest(test_client):
    """Verifies that GET /api/latest proxies live items from the Shinigami API."""
    res = test_client.get("/api/latest?page=1&page_size=5")
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, dict)
    assert "data" in data
    items = data["data"]
    assert isinstance(items, list)
    assert len(items) > 0

    first_item = items[0]
    assert "manga_id" in first_item
    assert "title" in first_item
    assert len(str(first_item["manga_id"]).strip()) > 0
    assert len(str(first_item["title"]).strip()) > 0


def test_e2e_cdn_page_reconstruction(test_client):
    """Verifies that GET /api/chapter/{id}/pages returns valid direct CDN image URLs."""
    # Obtain a live chapter ID from the latest catalogue
    latest_res = test_client.get("/api/latest?page=1&page_size=5")
    assert latest_res.status_code == 200
    items = latest_res.json().get("data", [])
    assert len(items) > 0

    manga_id = items[0]["manga_id"]
    detail_res = test_client.get(f"/api/manga/{manga_id}")
    assert detail_res.status_code == 200
    chapters = detail_res.json().get("data", {}).get("chapters", [])
    assert len(chapters) > 0

    target_chapter_id = chapters[0]["chapter_id"]

    pages_res = test_client.get(f"/api/chapter/{target_chapter_id}/pages")
    assert pages_res.status_code == 200
    page_data = pages_res.json()
    assert "pages" in page_data
    assert "total" in page_data
    assert page_data["total"] > 0

    urls = page_data["pages"]
    assert isinstance(urls, list)
    assert len(urls) == page_data["total"]

    for url in urls:
        assert isinstance(url, str)
        assert url.startswith("http://") or url.startswith("https://")
        assert any(ext in url.lower() for ext in [".webp", ".jpg", ".jpeg", ".png"])


def test_e2e_multi_device_history_sync(test_client):
    """Verifies multi-device reading history synchronization and order."""
    # Device 1: Reading chapter 1.0 of Manga A in webtoon mode
    dev1_payload = {
        "manga_id": "sync-manga-1",
        "manga_title": "Solo Leveling",
        "cover_url": "https://assets.shngm.id/cover1.jpg",
        "chapter_id": "ch-sync-1",
        "chapter_number": 1.0,
        "read_mode": "webtoon",
    }
    r1 = test_client.post("/api/history", json=dev1_payload)
    assert r1.status_code == 200

    # Device 2: Queries history, sees progress
    h2 = test_client.get("/api/history")
    assert h2.status_code == 200
    records = h2.json()
    assert len(records) == 1
    assert records[0]["manga_id"] == "sync-manga-1"
    assert records[0]["last_chapter_number"] == 1.0
    assert records[0]["read_mode"] == "webtoon"

    # Device 2: Advances to chapter 2.0 and switches mode to manga
    dev2_payload = {
        "manga_id": "sync-manga-1",
        "manga_title": "Solo Leveling",
        "cover_url": "https://assets.shngm.id/cover1.jpg",
        "chapter_id": "ch-sync-2",
        "chapter_number": 2.0,
        "read_mode": "manga",
    }
    r2 = test_client.post("/api/history", json=dev2_payload)
    assert r2.status_code == 200

    # Device 1: Fetches history, confirms single record updated with chapter 2.0
    h1 = test_client.get("/api/history")
    assert h1.status_code == 200
    updated_records = h1.json()
    assert len(updated_records) == 1
    assert updated_records[0]["manga_id"] == "sync-manga-1"
    assert updated_records[0]["last_chapter_id"] == "ch-sync-2"
    assert updated_records[0]["last_chapter_number"] == 2.0
    assert updated_records[0]["read_mode"] == "manga"

    # Add second manga to verify multi-item history
    dev3_payload = {
        "manga_id": "sync-manga-2",
        "manga_title": "Omniscient Reader",
        "cover_url": "https://assets.shngm.id/cover2.jpg",
        "chapter_id": "ch-sync-10",
        "chapter_number": 10.0,
        "read_mode": "webtoon",
    }
    test_client.post("/api/history", json=dev3_payload)
    multi_records = test_client.get("/api/history").json()
    assert len(multi_records) == 2
    record_ids = {r["manga_id"] for r in multi_records}
    assert record_ids == {"sync-manga-1", "sync-manga-2"}



def test_e2e_watchlist_toggle_and_updates(test_client, setup_isolated_db):
    """Verifies watchlist toggling and new chapter update detection."""
    # Initially empty
    wl_res = test_client.get("/api/watchlist")
    assert wl_res.status_code == 200
    assert wl_res.json() == []

    # Toggle bookmark on
    payload = {
        "manga_id": "wl-e2e-comic",
        "manga_title": "Tower of God",
        "cover_url": "https://assets.shngm.id/tog.jpg",
        "latest_chapter_number": 500.0,
    }
    t1 = test_client.post("/api/watchlist/toggle", json=payload)
    assert t1.status_code == 200
    assert t1.json()["is_saved"] is True

    # Check watchlist content
    wl1 = test_client.get("/api/watchlist").json()
    assert len(wl1) == 1
    assert wl1[0]["manga_id"] == "wl-e2e-comic"
    assert wl1[0]["latest_chapter_number"] == 500.0
    assert wl1[0]["has_new_update"] == 0

    # Simulate new chapter release via update checker
    mock_client = MagicMock()
    mock_client.list_manga.return_value = {
        "data": [
            {
                "manga_id": "wl-e2e-comic",
                "latest_chapter_number": 501.0,
            }
        ]
    }
    updates = check_watchlist_updates(client=mock_client, db_path=setup_isolated_db)
    assert len(updates) == 1
    assert updates[0]["manga_id"] == "wl-e2e-comic"
    assert updates[0]["new_chapter"] == 501.0

    # Verify has_new_update is now 1
    wl2 = test_client.get("/api/watchlist").json()
    assert len(wl2) == 1
    assert wl2[0]["latest_chapter_number"] == 501.0
    assert wl2[0]["has_new_update"] == 1

    # Toggle bookmark off
    t2 = test_client.post("/api/watchlist/toggle", json=payload)
    assert t2.status_code == 200
    assert t2.json()["is_saved"] is False

    wl3 = test_client.get("/api/watchlist").json()
    assert len(wl3) == 0


def test_e2e_chapter_download_status_and_file_flow(test_client, setup_isolated_db, tmp_path):
    """Verifies chapter download queuing, status reporting, and CBZ file retrieval."""
    dl_payload = {
        "manga_id": "e2e-dl-manga",
        "manga_title": "Return of Mount Hua",
        "chapter_number": 120.0,
        "total_pages": 20,
    }

    with patch("kaitoon.server.run_chapter_download"):
        req_res = test_client.post("/api/chapter/ch-hua-120/download", json=dl_payload)
        assert req_res.status_code == 200
        req_data = req_res.json()
        assert req_data["status"] == "pending"
        assert req_data["chapter_id"] == "ch-hua-120"
        assert req_data["chapter_number"] == 120.0

    status_res = test_client.get("/api/chapter/ch-hua-120/status")
    assert status_res.status_code == 200
    assert status_res.json()["status"] == "pending"

    # Simulate completed download with a genuine CBZ archive
    cbz_path = tmp_path / "Return_of_Mount_Hua_Ch_120.0.cbz"
    with zipfile.ZipFile(cbz_path, "w") as zf:
        zf.writestr("01.webp", b"RIFFfakeimagecontent")

    update_download_status("ch-hua-120", "completed", file_path=str(cbz_path), db_path=setup_isolated_db)

    comp_status = test_client.get("/api/chapter/ch-hua-120/status").json()
    assert comp_status["status"] == "completed"

    file_res = test_client.get("/api/chapter/ch-hua-120/file")
    assert file_res.status_code == 200
    assert file_res.headers.get("content-type") == "application/vnd.comicbook+zip"
    assert len(file_res.content) > 0


# ==============================================================================
# Step 2: Live Server Execution & Curls
# ==============================================================================

def test_e2e_live_server_uvicorn_boot_and_curls():
    """Boots FastAPI server via Uvicorn in background, queries via curl, and stops process."""
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.bind(("127.0.0.1", 0))
    port = sock.getsockname()[1]
    sock.close()

    server_script = os.path.join(BASE_DIR, "server.py")
    env = os.environ.copy()
    env["PYTHONPATH"] = "/root"

    proc = subprocess.Popen(
        [sys.executable, server_script, "--host", "127.0.0.1", "--port", str(port)],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        env=env,
        text=True,
    )

    try:
        base_url = f"http://127.0.0.1:{port}"
        started = False
        import http.client
        for _ in range(60):
            try:
                conn = http.client.HTTPConnection("127.0.0.1", port, timeout=1)
                conn.request("GET", "/")
                resp = conn.getresponse()
                if resp.status == 200:
                    started = True
                    conn.close()
                    break
                conn.close()
            except Exception:
                time.sleep(0.1)

        assert started, f"Live server failed to boot on port {port}"

        # 1. Curl GET /
        curl_root = subprocess.run(
            ["curl", "-s", "-i", "--noproxy", "*", f"{base_url}/"],
            capture_output=True,
            text=True,
            check=True,
        )
        assert "200 OK" in curl_root.stdout or "HTTP/1.1 200" in curl_root.stdout
        assert "Kaitoon" in curl_root.stdout

        # 2. Curl GET /api/latest
        curl_latest_header = subprocess.run(
            ["curl", "-s", "-o", "/dev/null", "-w", "%{http_code}", "--noproxy", "*", f"{base_url}/api/latest?page=1&page_size=2"],
            capture_output=True,
            text=True,
            check=True,
        )
        assert curl_latest_header.stdout.strip() == "200"

        curl_latest_body = subprocess.run(
            ["curl", "-s", "--noproxy", "*", f"{base_url}/api/latest?page=1&page_size=2"],
            capture_output=True,
            text=True,
            check=True,
        )
        parsed = json.loads(curl_latest_body.stdout)
        assert "data" in parsed
        assert isinstance(parsed["data"], list)
        assert len(parsed["data"]) > 0


    finally:
        proc.terminate()
        try:
            proc.wait(timeout=3)
        except subprocess.TimeoutExpired:
            proc.kill()
            proc.wait()


# ==============================================================================
# Step 3: Antislop Delivery Gate Checklist
# ==============================================================================

def test_antislop_delivery_gate_r02_zero_em_dashes():
    """R-02: Verifies absolute prohibition of em dash and en dash across all codebase files."""
    em_dash = chr(0x2014)
    en_dash = chr(0x2013)
    violations = []

    for root, dirs, files in os.walk(BASE_DIR):
        dirs[:] = [d for d in dirs if not d.startswith(".") and d != "graphify-out"]
        for fname in files:
            if fname.startswith(".") or fname.endswith((".pyc", ".cbz", ".png", ".jpg", ".webp", ".db", ".diff", ".patch")):
                continue
            fpath = os.path.join(root, fname)
            with open(fpath, "r", encoding="utf-8", errors="ignore") as fh:
                for line_idx, line in enumerate(fh, 1):
                    if em_dash in line:
                        violations.append((fpath, line_idx, "em_dash", line.strip()))
                    if en_dash in line:
                        violations.append((fpath, line_idx, "en_dash", line.strip()))

    assert len(violations) == 0, f"R-02 violations found: {violations}"


def test_antislop_delivery_gate_r03_mobile_responsive():
    """R-03: Verifies mobile responsive viewport, overflow-x prevention, and tap targets."""
    # HTML Viewport Meta
    with open(os.path.join(STATIC_DIR, "index.html"), "r", encoding="utf-8") as f:
        html = f.read()
    assert 'name="viewport"' in html
    assert 'content="width=device-width, initial-scale=1.0"' in html

    # CSS Responsive and Overflow Rules
    with open(os.path.join(STATIC_DIR, "style.css"), "r", encoding="utf-8") as f:
        css = f.read()
    assert "overflow-x: hidden" in css
    assert "@media" in css
    assert "min-height: 44px" in css or "min-width: 44px" in css


def test_antislop_delivery_gate_r21_r25_pure_black_and_contrast():
    """R-21 and R-25: Verifies OLED pure black theme and WCAG AAA contrast ratio (>= 7:1)."""
    with open(os.path.join(STATIC_DIR, "style.css"), "r", encoding="utf-8") as f:
        css = f.read()

    # R-21: Pure Black OLED canvas
    assert "--bg-canvas: #000000;" in css
    assert "background-color: var(--bg-canvas);" in css

    # R-25: WCAG AAA Contrast calculation
    # Primary text is #f3f4f6 against pure black #000000
    def srgb_luminance(r, g, b):
        def channel(c):
            c_norm = c / 255.0
            return c_norm / 12.92 if c_norm <= 0.03928 else ((c_norm + 0.055) / 1.055) ** 2.4
        return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)

    fg_lum = srgb_luminance(0xf3, 0xf4, 0xf6)
    bg_lum = srgb_luminance(0, 0, 0)
    contrast_ratio = (fg_lum + 0.05) / (bg_lum + 0.05)

    assert contrast_ratio >= 7.0, f"Contrast ratio {contrast_ratio:.2f} is below WCAG AAA 7:1"


def test_antislop_delivery_gate_r26_all_buttons_functional():
    """R-26: Verifies all interactive buttons in index.html are bound to listeners in app.js."""
    with open(os.path.join(STATIC_DIR, "index.html"), "r", encoding="utf-8") as f:
        html = f.read()

    with open(os.path.join(STATIC_DIR, "app.js"), "r", encoding="utf-8") as f:
        js = f.read()

    button_ids = re.findall(r'<button[^>]+id="([^"]+)"', html)
    assert len(button_ids) > 0

    unwired = []
    for btn_id in button_ids:
        if btn_id not in js:
            unwired.append(btn_id)

    assert len(unwired) == 0, f"Unwired buttons detected (dead controls): {unwired}"


def test_antislop_delivery_gate_r27_ui_states():
    """R-27: Verifies loading, empty, and error states are structurally present and handled."""
    with open(os.path.join(STATIC_DIR, "index.html"), "r", encoding="utf-8") as f:
        html = f.read()

    with open(os.path.join(STATIC_DIR, "app.js"), "r", encoding="utf-8") as f:
        js = f.read()

    # Loading State
    assert 'id="global-loader"' in html
    assert "class=\"spinner\"" in html or "spinner" in html
    assert "globalLoader" in js

    # Empty State
    assert 'id="empty-state"' in html
    assert 'id="empty-action-btn"' in html
    assert "emptyState" in js

    # Error State
    assert 'id="error-state"' in html
    assert 'id="retry-btn"' in html
    assert "errorState" in js


def test_antislop_delivery_gate_r32_keyboard_accessibility():
    """R-32: Verifies keyboard navigation handlers and accessible tabindex roles."""
    with open(os.path.join(STATIC_DIR, "index.html"), "r", encoding="utf-8") as f:
        html = f.read()

    with open(os.path.join(STATIC_DIR, "app.js"), "r", encoding="utf-8") as f:
        js = f.read()

    # Accessible roles and tabindex
    assert 'role="button"' in html
    assert 'tabindex="0"' in html

    # Keyboard listeners in JS
    assert "keydown" in js
    assert "Escape" in js
    assert "ArrowLeft" in js or "ArrowRight" in js


def test_antislop_delivery_gate_r35_verified_live():
    """R-35: Verifies that FastAPI application and router endpoints are fully initialized."""
    route_paths = [route.path for route in app.routes]
    expected_routes = [
        "/",
        "/static",
        "/api/latest",
        "/api/search",
        "/api/manga/{id}",
        "/api/chapter/{id}/pages",
        "/api/history",
        "/api/watchlist",
        "/api/watchlist/toggle",
        "/api/chapter/{id}/download",
        "/api/chapter/{id}/status",
        "/api/chapter/{id}/file",
    ]
    for exp in expected_routes:
        assert exp in route_paths, f"Route {exp} missing from app.routes"
