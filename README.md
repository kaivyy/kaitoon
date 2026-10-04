# Kaitoon: Shinigami Scraper & API Client

Folder ini dibuat untuk mengekstrak dan mengelola konten komik (manga/manhwa/manhua) dari jaringan Shinigami (`https://shinigami.to/` yang mengarah ke `https://11.shinigami.asia/`).

---

## 🔍 Hasil Analisis Arsitektur

1. **Auto-Resolving Domain (`shinigami.to`)**:
   - `https://shinigami.to/links.json` digunakan sebagai resolver link mirror aktif.
   - Script client otomatis mendeteksi domain aktif saat ini (`https://11.shinigami.asia`). Jika di masa depan domain berganti ke mirror lain, script akan otomatis menyesuaikan diri tanpa perlu hardcode ulang.

2. **Frontend & Backend Endpoint**:
   - **Frontend**: SvelteKit di `https://11.shinigami.asia/`.
   - **Backend REST API**: `https://api.shngm.io/v1/`
   - **CDN Asset Gambar**: `https://assets.shngm.id`

---

## 🚀 Fitur Script

- **`server.py` & `static/`**: Web Reader Single-Page App bebas iklan dengan tema OLED Pure Black, Dual-Mode Reader (Webtoon & Manga), serta sinkronisasi multi-device via SQLite. Default berjalan di port `9000`.
- **`client.py`**: Modul Python core Shinigami API client (pencarian, listing, detail komik, daftar chapter, dan URL gambar).
- **`downloader.py`**: Modul multithreaded downloader dan packager arsip komik digital `.cbz`.
- **`cli.py`**: CLI interaktif yang siap digunakan untuk navigasi dan unduhan via terminal.

---

## 🌐 Menjalankan Web Reader (Bebas Iklan)

Jalankan server lokal di port 9000:
```bash
cd /root/kaitoon
python3 server.py
# atau dengan port kustom:
python3 server.py --port 9000
```
Buka browser di `http://localhost:9000` untuk membaca komik.

---

## 📖 Cara Penggunaan CLI

Masuk ke folder `kaitoon`:
```bash
cd /root/kaitoon
```

### 1. Lihat Manga Update Terbaru
```bash
python3 cli.py latest --limit 10
```

### 2. Cari Judul Manga/Manhwa
```bash
python3 cli.py search "Solo Leveling"
python3 cli.py search "Magic Emperor"
```

### 3. Lihat Informasi Lengkap & Sinopsis Komik
```bash
python3 cli.py detail <manga_id>
# Contoh:
python3 cli.py detail 5c612573-fe38-42df-8618-dc3de1c9d04a
```

### 4. Lihat Daftar Chapter
```bash
python3 cli.py chapters <manga_id> --page 1 --limit 30 --order desc
```

### 5. Lihat URL Gambar dalam Satu Chapter
```bash
python3 cli.py pages <chapter_id>
# Contoh:
python3 cli.py pages 646a7f28-3d1e-4d59-942d-ab3a31d47ece
```

### 6. Download Seluruh Halaman Chapter
```bash
python3 cli.py download <chapter_id> --output ./downloads --workers 5
```

### 7. Ekspor Metadata & Daftar Chapter ke File JSON
```bash
python3 cli.py export <manga_id> --output manga_data.json
```

---

## 🛠️ Integrasi Python ke Project Sendiri

Anda dapat mengimpor `ShinigamiClient` langsung ke aplikasi atau bot Anda:

```python
from client import ShinigamiClient

client = ShinigamiClient()

# Cari manga
results = client.search_manga("Solo Leveling")
manga_id = results["data"][0]["manga_id"]

# Ambil daftar chapter
chapters = client.list_chapters(manga_id, page=1, page_size=10)

# Ambil gambar chapter pertama
first_ch_id = chapters["data"][0]["chapter_id"]
images = client.get_chapter_image_urls(first_ch_id)
print(images)
```
