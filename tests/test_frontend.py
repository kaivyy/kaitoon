"""Frontend UI and Static Asset Tests for Kaitoon Web Reader.

Verifies:
- Static assets existence and integrity (HTML, CSS, JS)
- Rule R-02 compliance: zero em dashes across all frontend assets
- FastAPI static serving on /, /static/style.css, and /static/app.js
- Semantic HTML structure (Catalog, Detail, and Dual-Mode Reader views)
- OLED Pure Black theme values and 44px minimum tap targets in CSS
- Client-side navigation, debounce search, and sync hooks in JS
"""

import os
import pytest
from fastapi.testclient import TestClient
import kaitoon
from kaitoon.server import app

STATIC_DIR = os.path.join(os.path.dirname(os.path.abspath(kaitoon.server.__file__)), "static")


@pytest.fixture
def client():
    """Provides a TestClient instance for testing server static routes."""
    return TestClient(app)


def test_static_files_exist():
    """Checks that all required frontend assets exist in the static directory."""
    expected_files = ["index.html", "style.css", "app.js"]
    for filename in expected_files:
        filepath = os.path.join(STATIC_DIR, filename)
        assert os.path.exists(filepath), f"File {filename} does not exist in {STATIC_DIR}"
        assert os.path.getsize(filepath) > 0, f"File {filename} is empty"


def test_rule_r02_no_em_dashes():
    """Enforces absolute prohibition of em dash (U+2014) in all frontend files."""
    em_dash_char = chr(0x2014)
    en_dash_char = chr(0x2013)
    for filename in ["index.html", "style.css", "app.js"]:
        filepath = os.path.join(STATIC_DIR, filename)
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()

        assert em_dash_char not in content, f"Em dash detected in {filename} (R-02 violation)"
        assert en_dash_char not in content, f"En dash detected in {filename} (R-02 compliance)"


def test_server_serves_root_html(client):
    """Verifies that GET / serves the index.html single-page application."""
    res = client.get("/")
    assert res.status_code == 200
    assert "text/html" in res.headers.get("content-type", "")
    assert "<title>Kaitoon Web Reader</title>" in res.text
    assert 'id="catalog-view"' in res.text
    assert 'id="detail-view"' in res.text
    assert 'id="reader-view"' in res.text


def test_server_serves_static_assets(client):
    """Verifies that static assets are served through the /static mount."""
    res_css = client.get("/static/style.css")
    assert res_css.status_code == 200
    assert "text/css" in res_css.headers.get("content-type", "")
    assert "#000000" in res_css.text

    res_js = client.get("/static/app.js")
    assert res_js.status_code == 200
    assert any(
        js_type in res_css.headers.get("content-type", "") or "javascript" in res_js.headers.get("content-type", "")
        for js_type in ["javascript", "application/javascript"]
    )
    assert "openReader" in res_js.text


def test_html_semantic_structure():
    """Verifies essential view containers, tabs, and accessibility elements in index.html."""
    html_path = os.path.join(STATIC_DIR, "index.html")
    with open(html_path, "r", encoding="utf-8") as f:
        content = f.read()

    # View Containers
    assert 'id="catalog-view"' in content
    assert 'id="detail-view"' in content
    assert 'id="reader-view"' in content

    # Navigation Tabs
    assert 'id="tab-latest"' in content
    assert 'id="tab-favorites"' in content
    assert 'id="tab-history"' in content

    # Search Box
    assert 'id="search-input"' in content
    assert 'id="search-clear-btn"' in content

    # Dual-Mode Reader Elements
    assert 'id="webtoon-scroll-container"' in content
    assert 'id="manga-slide-container"' in content
    assert 'id="manga-slide-img"' in content
    assert 'id="tap-prev"' in content
    assert 'id="tap-center"' in content
    assert 'id="tap-next"' in content
    assert 'id="reader-chapter-select"' in content

    # Resilience States
    assert 'id="global-loader"' in content
    assert 'id="error-state"' in content
    assert 'id="empty-state"' in content
    assert 'id="toast"' in content


def test_css_styling_and_contrast():
    """Verifies OLED Pure Black palette, responsive grid, and touch target rules in style.css."""
    css_path = os.path.join(STATIC_DIR, "style.css")
    with open(css_path, "r", encoding="utf-8") as f:
        content = f.read()

    # OLED Palette & Accents
    assert "#000000" in content  # OLED Canvas
    assert "#0d0d0d" in content  # Surface
    assert "#1a1a1a" in content  # Border
    assert "#f3f4f6" in content  # High contrast text (AAA)
    assert "#9ca3af" in content  # Muted silver text (AA)
    assert "#10b981" in content  # Emerald functional accent

    # 44px Minimum Touch Targets (WCAG / Mobile)
    assert "44px" in content

    # Webtoon Continuous Flow & Manga Centered Viewport
    assert "800px" in content
    assert "100vh" in content
    assert "object-fit: contain" in content

    # Controller Auto-Hide Floating Styles
    assert ".reader-floating-bar" in content
    assert ".hidden-bar" in content


def test_javascript_logic_integrity():
    """Verifies that app.js implements required API hooks, debounce, and navigation."""
    js_path = os.path.join(STATIC_DIR, "app.js")
    with open(js_path, "r", encoding="utf-8") as f:
        content = f.read()

    # API Endpoints
    assert "/api/latest" in content
    assert "/api/search" in content
    assert "/api/manga/" in content
    assert "/api/chapter/" in content
    assert "/api/history" in content
    assert "/api/watchlist" in content
    assert "/api/watchlist/toggle" in content
    assert "/api/chapter/" in content
    assert "/download" in content
    assert "/status" in content

    # Search Debounce (400ms)
    assert "400" in content

    # Dual-Mode Reader & Tap Zone Handlers
    assert "webtoon" in content
    assert "manga" in content
    assert "tapPrev" in content
    assert "tapCenter" in content
    assert "tapNext" in content

    # Keyboard Listener Keys
    assert "Escape" in content
    assert "ArrowRight" in content
    assert "ArrowLeft" in content
