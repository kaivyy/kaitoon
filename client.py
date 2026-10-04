import urllib.request
import urllib.parse
import json
import logging
from typing import Dict, List, Optional, Any

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("KaitoonShinigami")

class ShinigamiClient:
    """
    Client resmi/reverse-engineered untuk Shinigami API.
    Mendukung dynamic resolution dari shinigami.to -> 11.shinigami.asia
    dan berkomunikasi langsung dengan backend api.shngm.io.
    """
    
    LANDING_URL = "https://shinigami.to/links.json"
    DEFAULT_WEB_URL = "https://11.shinigami.asia"
    API_BASE = "https://api.shngm.io/v1"
    
    def __init__(self, web_url: Optional[str] = None):
        self.web_url = web_url or self.resolve_active_domain()
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
                        active_url = link.get("href", "").rstrip("/")
                        logger.info(f"Resolved active Shinigami domain: {active_url}")
                        return active_url
        except Exception as e:
            logger.warning(f"Gagal resolve domain via shinigami.to ({e}), memakai default {self.DEFAULT_WEB_URL}")
        return self.DEFAULT_WEB_URL

    def _get(self, endpoint: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        url = f"{self.API_BASE}/{endpoint.lstrip('/')}"
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
        params = {
            "page": page,
            "page_size": page_size,
            "sort": sort,
            "sort_order": sort_order
        }
        return self._get("manga/list", params)

    def search_manga(self, query: str, page: int = 1, page_size: int = 20) -> Dict[str, Any]:
        """Mencari manga berdasarkan judul atau kata kunci."""
        params = {
            "q": query,
            "page": page,
            "page_size": page_size
        }
        return self._get("manga/list", params)

    def get_manga_detail(self, manga_id: str) -> Dict[str, Any]:
        """Mengambil detail komik (sinopsis, cover, penulis, rating, genre)."""
        return self._get(f"manga/detail/{manga_id}")

    def list_chapters(self, manga_id: str, page: int = 1, page_size: int = 50, 
                      sort_by: str = "chapter_number", sort_order: str = "desc") -> Dict[str, Any]:
        """
        Mengambil daftar chapter komik.
        sort_by: 'chapter_number' atau 'created_at'
        sort_order: 'desc' (terbaru ke terlama) atau 'asc' (awal ke akhir)
        """
        params = {
            "page": page,
            "page_size": page_size,
            "sort_by": sort_by,
            "sort_order": sort_order
        }
        return self._get(f"chapter/{manga_id}/list", params)

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
