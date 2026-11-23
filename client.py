import urllib.request
import urllib.parse
import json
import re
import logging
from typing import Dict, List, Optional, Any

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("KaitoonShinigami")

class ShinigamiClient:
    """
    Client resmi/reverse-engineered untuk Shinigami API.
    Mendukung dynamic resolution dari shinigami.to -> web_url aktif -> api_base aktif.
    """
    
    LANDING_URL = "https://shinigami.to/links.json"
    DEFAULT_WEB_URL = "https://s1.shinigami.mx"
    DEFAULT_API_BASE = "https://api.shinigami.io/v1"
    API_BASE = DEFAULT_API_BASE
    
    def __init__(self, web_url: Optional[str] = None, api_base: Optional[str] = None):
        self.web_url = web_url or self.resolve_active_domain()
        self.api_base = api_base or self.resolve_api_base()
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Origin": self.web_url,
            "Referer": f"{self.web_url}/",
            "Accept": "application/json, text/plain, */*"
        }

    def resolve_active_domain(self) -> str:
        """Mendapatkan link domain aktif saat ini dari shinigami.to"""
        try:
            req = urllib.request.Request(self.LANDING_URL, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=5) as res:
                links = json.loads(res.read().decode("utf-8"))
                for link in links:
                    if "website" in link.get("title", "").lower() or link.get("icon") == "globe":
                        raw_href = link.get("href", "").strip()
                        parsed = urllib.parse.urlparse(raw_href)
                        active_url = f"{parsed.scheme}://{parsed.netloc}" if parsed.scheme and parsed.netloc else raw_href.rstrip("/")
                        logger.info(f"Resolved active Shinigami domain: {active_url}")
                        return active_url
        except Exception as e:
            logger.warning(f"Gagal resolve domain via shinigami.to ({e}), memakai default {self.DEFAULT_WEB_URL}")
        return self.DEFAULT_WEB_URL

    def resolve_api_base(self) -> str:
        """Mengekstrak URL API aktif dari bundle JS web utama Shinigami."""
        try:
            req = urllib.request.Request(self.web_url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=8) as res:
                html = res.read().decode("utf-8", errors="ignore")
            script_match = re.search(r'<script[^>]+src=["\']([^"\']*?/assets/index-[^"\']+\.js)["\']', html)
            if script_match:
                script_url = urllib.parse.urljoin(f"{self.web_url}/", script_match.group(1))
                js_req = urllib.request.Request(script_url, headers={"User-Agent": "Mozilla/5.0"})
                with urllib.request.urlopen(js_req, timeout=10) as js_res:
                    js_text = js_res.read().decode("utf-8", errors="ignore")
                # Match default API base URL pattern in bundle, excluding staging/dev hosts
                api_match = re.search(r'default\s*:\s*["\'](https://api\.[^"\'\s/]+/v\d+)["\']', js_text)
                if api_match:
                    resolved = api_match.group(1).rstrip("/")
                    logger.info(f"Resolved active Shinigami API base: {resolved}")
                    return resolved
        except Exception as e:
            logger.warning(f"Gagal ekstrak API base dari {self.web_url} ({e}), memakai default {self.DEFAULT_API_BASE}")
        return self.DEFAULT_API_BASE

    def _get(self, endpoint: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        url = f"{self.api_base}/{endpoint.lstrip('/')}"
        if params:
            url += f"?{urllib.parse.urlencode(params)}"
            
        req = urllib.request.Request(url, headers=self.headers)
        try:
            with urllib.request.urlopen(req, timeout=15) as res:
                return json.loads(res.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8", errors="ignore")
            logger.error(f"HTTP {e.code} on {url}: {err_body}")
            raise RuntimeError(f"API Error {e.code}: {err_body}")
        except Exception as e:
            logger.error(f"Request failed on {url}: {e}")
            raise

    def list_manga(self, page: int = 1, page_size: int = 20, sort: str = "latest", sort_order: str = "desc") -> Dict[str, Any]:
        """Mengambil daftar manga terbaru atau terpopuler."""
        offset = max(0, (page - 1) * page_size)
        params = {
            "page": page,
            "page_size": page_size,
            "limit": page_size,
            "offset": offset,
            "sort": sort,
            "sort_order": sort_order
        }
        return self._get("manga/list", params)

    def search_manga(self, query: str, page: int = 1, page_size: int = 20) -> Dict[str, Any]:
        """Mencari manga berdasarkan judul atau kata kunci."""
        offset = max(0, (page - 1) * page_size)
        params = {
            "q": query,
            "page": page,
            "page_size": page_size,
            "limit": page_size,
            "offset": offset,
        }
        return self._get("manga/list", params)

    def get_manga_detail(self, manga_id: str) -> Dict[str, Any]:
        """Mengambil detail komik (sinopsis, cover, penulis, rating, genre)."""
        return self._get(f"manga/detail/{manga_id}")

    def list_chapters(self, manga_id: str, page: int = 1, page_size: int = 50, 
                      sort_by: str = "chapter_number", sort_order: str = "desc",
                      cursor: Optional[str] = None) -> Dict[str, Any]:
        """
        Mengambil daftar chapter komik.
        sort_by: 'chapter_number' atau 'created_at'
        sort_order: 'desc' (terbaru ke terlama) atau 'asc' (awal ke akhir)
        """
        params: Dict[str, Any] = {
            "page": page,
            "page_size": page_size,
            "limit": page_size,
            "sort_by": sort_by,
            "sort_order": sort_order
        }
        if cursor:
            params["cursor"] = cursor
        return self._get(f"chapter/{manga_id}/list", params)

    def get_all_chapters(self, manga_id: str, sort_by: str = "chapter_number", 
                         sort_order: str = "desc") -> Dict[str, Any]:
        """
        Mengambil semua chapter komik di semua halaman (mendukung cursor pagination & page pagination).
        """
        all_chapters = []
        page = 1
        page_size = 1000
        cursor: Optional[str] = None
        seen_cursors = set()
        first_meta = {}

        while True:
            kwargs: Dict[str, Any] = {
                "page": page,
                "page_size": page_size,
                "sort_by": sort_by,
                "sort_order": sort_order,
            }
            if cursor:
                kwargs["cursor"] = cursor
            res = self.list_chapters(manga_id, **kwargs)
            if not isinstance(res, dict):
                break
            chapters = res.get("data", [])
            if not isinstance(chapters, list):
                chapters = []
            if not first_meta:
                meta = res.get("meta")
                first_meta = meta.copy() if isinstance(meta, dict) else {}

            all_chapters.extend(chapters)

            meta = res.get("meta") or {}
            has_next = meta.get("has_next") if isinstance(meta, dict) else False
            next_cursor = meta.get("next_cursor") if isinstance(meta, dict) else None
            total_page = meta.get("total_page") if isinstance(meta, dict) else None

            if not chapters or page >= 50:
                break

            if next_cursor:
                if not has_next or next_cursor in seen_cursors:
                    break
                seen_cursors.add(next_cursor)
                cursor = next_cursor
                page += 1
            elif total_page is not None:
                if page >= total_page:
                    break
                page += 1
            else:
                break

        first_meta["page"] = 1
        first_meta["page_size"] = len(all_chapters)
        first_meta["total_page"] = 1
        first_meta["total_record"] = len(all_chapters)

        return {
            "ret": 200,
            "data": all_chapters,
            "meta": first_meta
        }

    def get_chapter_detail(self, chapter_id: str) -> Dict[str, Any]:
        """Mengambil detail chapter beserta path dan list nama file gambar."""
        return self._get(f"chapter/detail/{chapter_id}")

    def get_chapter_image_urls(self, chapter_id: str) -> List[str]:
        """
        Mengembalikan daftar URL gambar lengkap untuk dibaca atau diunduh.
        Format: {base_url}{chapter.path}{filename}
        """
        res = self.get_chapter_detail(chapter_id)
        data = res.get("data", {})
        base_url = data.get("base_url") or "https://assets.shngm.id"
        chapter_info = data.get("chapter", {})
        path = chapter_info.get("path", "")
        filenames = chapter_info.get("data", [])
        
        urls = []
        for fn in filenames:
            urls.append(f"{base_url.rstrip('/')}/{path.strip('/')}/{fn}")
        return urls
