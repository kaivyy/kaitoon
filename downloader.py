import os
import urllib.request
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import List
from client import ShinigamiClient

logger = logging.getLogger("KaitoonDownloader")

def download_image(url: str, save_path: str, referer: str = "https://11.shinigami.asia/") -> bool:
    """Mengunduh 1 file gambar dengan headers yang tepat."""
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": referer
    }
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=20) as resp:
            data = resp.read()
            with open(save_path, "wb") as f:
                f.write(data)
        return True
    except Exception as e:
        logger.error(f"Gagal download {url}: {e}")
        return False

def download_chapter(client: ShinigamiClient, chapter_id: str, output_dir: str = "./downloads", max_workers: int = 5) -> str:
    """
    Mengunduh seluruh halaman dalam 1 chapter ke dalam folder terpisah.
    """
    chapter_detail = client.get_chapter_detail(chapter_id)
    ch_data = chapter_detail.get("data", {})
    manga_id = ch_data.get("manga_id", "unknown_manga")
    ch_num = ch_data.get("chapter_number", chapter_id)
    
    # Ambil detail manga untuk nama folder yang rapi jika memungkinkan
    folder_name = f"manga_{manga_id[:8]}_ch_{ch_num}"
    target_dir = os.path.join(output_dir, folder_name)
    os.makedirs(target_dir, exist_ok=True)
    
    image_urls = client.get_chapter_image_urls(chapter_id)
    logger.info(f"Mulai download Chapter {ch_num} ({len(image_urls)} halaman) ke {target_dir}")
    
    results = []
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        future_to_idx = {}
        for idx, img_url in enumerate(image_urls):
            ext = img_url.split(".")[-1].split("?")[0] if "." in img_url else "jpg"
            file_name = f"{idx+1:03d}.{ext}"
            file_path = os.path.join(target_dir, file_name)
            
            # Lewati jika sudah ada
            if os.path.exists(file_path) and os.path.getsize(file_path) > 0:
                continue
                
            future = executor.submit(download_image, img_url, file_path, client.web_url)
            future_to_idx[future] = (idx, file_name)
            
        for future in as_completed(future_to_idx):
            idx, fname = future_to_idx[future]
            success = future.result()
            results.append(success)
            status = "OK" if success else "GAGAL"
            print(f"[{status}] Hal {idx+1}/{len(image_urls)}: {fname}")
            
    success_count = sum(1 for r in results if r)
    logger.info(f"Selesai: {success_count}/{len(image_urls)} file berhasil diunduh ke {target_dir}")
    return target_dir
