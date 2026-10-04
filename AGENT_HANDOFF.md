# 📘 KAITOON — AGENT HANDOFF & ARCHITECTURE SPECIFICATION

> **Untuk Agen AI Berikutnya**: Dokumen ini dirancang agar Anda dapat langsung melanjutkan pengembangan proyek `kaitoon` tanpa perlu melakukan investigasi ulang terhadap arsitektur web Shinigami, reverse-engineering endpoint, atau format data. Baca dokumen ini dari awal hingga akhir.

---

## 1. Ringkasan Eksekutif Proyek

* **Nama Proyek**: `kaitoon`
* **Lokasi Root**: `/root/kaitoon`
* **Tujuan**: Membangun modul scraper, reader backend, dan downloader untuk komik (Manga, Manhwa, Manhua) dengan sumber konten dari jaringan **Shinigami Scans** (`https://shinigami.to/` -> `https://11.shinigami.asia/`).
* **Status Saat Ini**: 
  - ✅ Arsitektur target telah berhasil di-reverse engineer secara tuntas.
  - ✅ Core client library (`client.py`) selesai dan lulus uji coba live.
  - ✅ Multithreaded downloader (`downloader.py`) selesai dan siap pakai.
  - ✅ Interactive CLI (`cli.py`) telah diuji coba untuk command `latest`, `search`, `detail`, `chapters`, `pages`, `download`, `export`.

---

## 2. Topologi Arsitektur & Reverse Engineering Shinigami

Situs Shinigami memiliki arsitektur terdistribusi multi-layer:

```
[User Request]
       │
       ▼
1. Landing Page (shinigami.to)
       │──> Membaca https://shinigami.to/links.json
       │──> Mengambil URL mirror aktif: "https://11.shinigami.asia"
       ▼
2. Frontend Web (11.shinigami.asia)
       │──> Framework: SvelteKit (Client-side rendering)
       │──> Cloudflare Turnstile proteksi di browser (CAPTCHA)
       ▼
3. Backend REST API (api.shngm.io/v1/)  <─── [KITA LANGSUNG NEMBAK KE SINI]
       │──> Port: 443 HTTPS
       │──> Memvalidasi Origin & Referer
       │──> Mengembalikan JSON terstruktur murni tanpa CAPTCHA jika header sesuai
       ▼
4. CDN Asset Storage (assets.shngm.id)
       └──> Menyimpan Cover Image & Panel Komik per Chapter
```

### Keunggulan Bypass:
Kita **tidak perlu** melewati Cloudflare Turnstile atau rendering browser headless (Playwright/Puppeteer) karena server API backend mereka (`api.shngm.io`) terbuka untuk komunikasi REST JSON selama menyertakan header `Origin` dan `Referer` yang cocok dengan mirror aktif.

---

## 3. Spesifikasi Lengkap REST API Shinigami (`api.shngm.io`)

### A. Base Configuration & Headers Wajib
* **API Base URL**: `https://api.shngm.io/v1`
* **Headers**:
  ```python
  {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Origin": "https://11.shinigami.asia",
      "Referer": "https://11.shinigami.asia/",
      "Accept": "application/json, text/plain, */*"
  }
  ```

---

### B. Endpoint Reference

#### 1. Dynamic Mirror Resolver
* **URL**: `GET https://shinigami.to/links.json`
* **Deskripsi**: Mengambil daftar domain mirror terkini. Cari item dengan `icon: "globe"` atau kata `"website"` di judulnya.
* **Output**:
  ```json
  [
    { "title": "Link Website", "href": "https://11.shinigami.asia", "icon": "globe" }
  ]
  ```

#### 2. Listing & Pencarian Komik
* **Endpoint**: `GET /v1/manga/list`
* **Query Parameters**:
  - `q` (*string*, opsional): Kata kunci pencarian judul (misal: `q=Solo Leveling`). **Catatan:** Jangan gunakan `search` atau `keyword`, wajib `q`.
  - `page` (*int*): Nomor halaman (default: `1`).
  - `page_size` (*int*): Jumlah komik per halaman (default: `20`).
  - `sort` (*string*): Kriteria pengurutan (`latest`, `popular`, `alphabet`, `rating`).
  - `sort_order` (*string*): `desc` atau `asc`.
* **Sample Response Item**:
  ```json
  {
    "manga_id": "5c612573-fe38-42df-8618-dc3de1c9d04a",
    "title": "Solo Leveling",
    "alternative_title": "Na Honjaman Level-Up...",
    "cover_image_url": "https://assets.shngm.id/thumbnail/cover/048dbc142b97.png",
    "latest_chapter_number": 179,
    "user_rate": 9.9,
    "view_count": 24343052,
    "taxonomy": {
      "Genre": [{"name": "Action", "slug": "action"}, {"name": "Fantasy", "slug": "fantasy"}]
    }
  }
  ```

#### 3. Detail Komik Lengkap
* **Endpoint**: `GET /v1/manga/detail/{manga_id}`
* **Deskripsi**: Mengambil sinopsis lengkap, pengarang, artis, rank, status penerbitan (`1` = Ongoing, `2` = Completed).

#### 4. Daftar Chapter
* **Endpoint**: `GET /v1/chapter/{manga_id}/list`
* **Query Parameters**:
  - `page` (*int*): Nomor halaman.
  - `page_size` (*int*): Jumlah chapter (misal: `50` atau `100`).
  - `sort_by` (*string*, **WAJIB VALID**): Wajib menggunakan `chapter_number` atau `created_at`. *Jika diisi selain ini, server mengembalikan HTTP 400 Bad Request.*
  - `sort_order` (*string*): `desc` (chapter terbaru) atau `asc` (chapter awal).
* **Sample Response Item**:
  ```json
  {
    "chapter_id": "646a7f28-3d1e-4d59-942d-ab3a31d47ece",
    "manga_id": "5c612573-fe38-42df-8618-dc3de1c9d04a",
    "chapter_number": 179,
    "chapter_title": "",
    "release_date": "2024-11-26T08:16:00Z",
    "view_count": 12890
  }
  ```

#### 5. Rekonstruksi Gambar Panel Chapter
* **Endpoint**: `GET /v1/chapter/detail/{chapter_id}`
* **Sample Response Data**:
  ```json
  {
    "chapter_id": "646a7f28-3d1e-4d59-942d-ab3a31d47ece",
    "base_url": "https://assets.shngm.id",
    "chapter": {
      "path": "/chapter/manga_5c612573.../chapter_646a7f28.../",
      "data": [
        "1-0b7073308a4d.jpg",
        "2-831c6f63c63a.jpg"
      ]
    }
  }
  ```
* **Rumus Rekonstruksi URL Gambar**:
  $$\text{Image URL} = \text{base\_url} + \text{path} + \text{filename}$$
  *Contoh:* `https://assets.shngm.id/chapter/manga_.../chapter_.../1-0b7073308a4d.jpg`

---

## 4. Struktur File & Peran Modul di `/root/kaitoon/`

```
/root/kaitoon/
├── client.py          # Modul Core API Client (ShinigamiClient)
├── downloader.py      # Multithreaded Image & Chapter Downloader
├── cli.py             # CLI Interaktif untuk eksekusi terminal
├── README.md          # Petunjuk cepat penggunaan user
└── AGENT_HANDOFF.md   # Dokumen spesifikasi teknis ini
```

### Detail Modul:
1. **`client.py`**:
   - `ShinigamiClient()`: Otomatis memanggil `resolve_active_domain()`.
   - `list_manga()`, `search_manga()`, `get_manga_detail()`
   - `list_chapters()`, `get_chapter_detail()`, `get_chapter_image_urls()`
2. **`downloader.py`**:
   - `download_image(url, save_path, referer)`
   - `download_chapter(client, chapter_id, output_dir, max_workers=5)`
3. **`cli.py`**:
   - CLI argparser yang membungkus semua fungsi ke perintah terminal yang ramah pengguna.

---

## 5. Rencana & Rekomendasi Pengembangan Lanjutan (Next Tasks)

Jika Anda (agen selanjutnya) ditugaskan untuk mengembangkan `kaitoon` lebih jauh, berikut adalah roadmap arsitektur yang direkomendasikan:

### Task 1: Database Persistence (SQLite / PostgreSQL)
* Buat modul `db.py` (menggunakan `sqlite3` atau `SQLAlchemy`) dengan skema tabel:
  - `mangas`: `id`, `title`, `alt_title`, `cover_url`, `status`, `rating`, `last_synced_at`
  - `chapters`: `id`, `manga_id`, `chapter_number`, `release_date`, `downloaded_status`
  - `genres`: relasi many-to-many ke manga

### Task 2: Background Auto-Sync Worker
* Buat worker (misal via Python script atau cron job) yang mengecek `client.list_manga(page=1)` setiap 30 menit.
* Jika ada chapter baru yang dirilis, otomatis simpan ke database dan kirim notifikasi/webhook (Telegram / Discord bot).

### Task 3: API Server / Web Reader Sendiri
* Bangun backend API menggunakan **FastAPI** di `/root/kaitoon/server.py` yang menyediakan endpoint:
  - `GET /api/comics` -> list komik lokal / cache
  - `GET /api/comics/{id}/read/{chapter_id}` -> menyajikan gambar untuk web reader custom (Next.js / Vue).

### Task 4: Converter ke E-Book / Comic Archive (CBZ & PDF)
* Tambahkan fungsi di `downloader.py` untuk mengompres folder chapter hasil download menjadi file `.cbz` (ZIP standar komik digital) atau file `.pdf` agar bisa dibaca langsung di iPad, Kindle, atau aplikasi Tachiyomi/Mihon.

---

## 6. Verifikasi & Pengujian Cepat

Untuk memverifikasi bahwa semua sistem masih berjalan normal saat Anda mengambil alih sesi ini, jalankan perintah-perintah berikut:

```bash
# 1. Tes konektivitas resolver dan listing manga
python3 /root/kaitoon/cli.py latest --limit 3

# 2. Tes pencarian
python3 /root/kaitoon/cli.py search "Solo Leveling" --limit 2

# 3. Tes ekstraksi halaman chapter (tanpa unduh)
python3 /root/kaitoon/cli.py pages 646a7f28-3d1e-4d59-942d-ab3a31d47ece
```

Jika ketiga perintah di atas mengembalikan data JSON/teks tanpa error, maka koneksi ke Shinigami backend aktif 100%.
