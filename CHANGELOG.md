# Changelog

Semua perubahan penting pada proyek **Kaitoon** akan didokumentasikan di berkas ini.

Format berkas ini mengacu pada panduan [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) dan mematuhi prinsip [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.1.1] - 2026-10-14

### Diperbaiki
- **Preservasi Halaman dan Scroll Katalog**:
  - Mengatasi bug saat navigasi kembali dari detail komik atau reader yang mereset halaman katalog ke halaman 1.
  - URL hash kini mendukung rute paginasi `#/latest/page/{num}` dan query `?page={num}`.
  - Posisi scroll katalog disimpan otomatis dan dikembalikan secara instan saat kembali tanpa memuat ulang data atau layar berkedip.
- **Auto-Hide Bar Reader saat Scroll ke Atas**:
  - Memastikan floating navbar dan bar controller di reader tetap tersembunyi saat menggulir ke atas hingga layar diklik atau disentuh 1 kali.
- **Kalkulasi Waktu Rilis Chapter di Beranda**:
  - Memprioritaskan `latest_chapter_time` daripada `updated_at` agar badge waktu rilis chapter di beranda sinkron dengan waktu chapter terbaru di halaman detail.

---

## [2.1.0] - 2026-10-11

### Ditambahkan
- **Pelacak Episode Sudah Dibaca dan Belum Dibaca**:
  - Penanda visual status baca menyeluruh pada semua komik, baik yang ada di daftar favorit maupun bukan.
  - Label status pada setiap chapter: *Sudah Dibaca* (ikon centang hijau emerald), *Belum Dibaca* (titik indikator biru), dan *Terakhir Dibaca* (badge kuning emas).
  - Ringkasan metrik progres pada halaman detail komik (*Progres: X dari Y episode dibaca* dan *Z belum dibaca*).
  - Tombol *Tandai Semua Dibaca* untuk menandai seluruh episode komik dalam 1 kali klik.
  - Tombol toggle status baca individual pada setiap baris chapter di halaman detail komik.
  - Penanda *Sedang Dibaca*, *Sudah Dibaca*, dan *Belum Dibaca* di dalam Episode Drawer reader.
  - Ikon centang dan indikator belum dibaca pada tombol chapter kartu komik di beranda, katalog, dan favorit.
  - Badge *Dibaca Ch. X* pada poster kartu komik jika memiliki riwayat baca.
- **Dukungan API dan Basis Data Baru**:
  - Tabel SQLite `read_chapters` untuk pencatatan permanen setiap episode yang telah dibaca.
  - Endpoint `GET /api/history/{manga_id}/chapters` untuk mengambil daftar chapter yang telah dibaca.
  - Endpoint `POST /api/history/mark-read` untuk mengubah status baca satu chapter secara spesifik.
  - Endpoint `POST /api/history/mark-all-read` untuk menandai kumpulan chapter secara sekaligus.
  - Mekanisme sinkronisasi dua arah antara `localStorage` peramban dan SQLite server.

---

## [2.0.0] - 2026-10-06

### Ditambahkan
- **Integrasi Multi-Provider Server 2 (Komiku.org)**:
  - Modul provider scraping HTML berkecepatan tinggi untuk `komiku.org`.
  - Agregasi katalog multi-halaman otomatis pada saat aplikasi dinyalakan.
  - Sistem penyimpanan cache permanen di SQLite untuk penelusuran komik tanpa jeda.
  - Komponen pemilih server (*server switcher bar*) di bagian bawah halaman katalog.
- **Auto-Scroll Pintar dengan Kontrol Kecepatan**:
  - Fitur gulir otomatis berkelanjutan untuk mode Webtoon.
  - Pengatur kecepatan presisi mulai dari 0.5x hingga 5.0x tersimpan otomatis di penyimpanan lokal.
  - Tombol aksi play/pause langsung pada floating dock bawah reader.
  - Floating pill status kecepatan autoscroll di sudut atas layar.
  - Modal pengaturan autoscroll dengan slider interaktif.
- **Navigasi Rute URL Berbasis Slug**:
  - Rute URL bersih dan mudah dibaca (contoh: `#manga/solo-leveling` dan `#manga/solo-leveling/chapter-1`).
  - Resolusi otomatis antara slug nama komik dan UUID kanonik.
- **Kompresi Data Gzip**:
  - Middleware GZip aktif untuk semua tanggapan REST API dan berkas statis, menghemat penggunaan kuota hingga 80%.
- **Sistem Paginasi Baru**:
  - Paginasi bernomor compact dengan tombol chevron di katalog utama.
- **Top Loading Progress Bar**:
  - Bar indikator pemuatan modern di bagian paling atas layar menggantikan spinner tengah layar yang mengganggu.

### Diperbaiki
- Mengatasi masalah kedipan layar (*white flash*) saat menyegarkan halaman katalog melalui *synchronous cache preloading*.
- Mengatasi layar kosong sesaat saat kembali ke katalog, berpindah halaman, atau membuka reader.
- Menghilangkan gangguan pemuatan ulang halaman di ponsel saat pengguna berpindah ke aplikasi lain.
- Mempertahankan posisi scroll membaca secara persisten di penyimpanan lokal.

---

## [1.0.0] - 2026-10-05

### Ditambahkan
- **Migrasi Frontend ke Astro 5**:
  - Arsitektur berbasis komponen (`Header`, `ComicGrid`, `DetailView`, `ReaderView`, `EpisodeDrawer`, `MobileNav`).
  - Pembuatan bundel statis berkas produksi berkecepatan tinggi tanpa dependensi framework runtime berat.
- **Tampilan Pure OLED Black**:
  - Tema hitam pekat (`#000000`) dengan aksen emerald (`#10b981`) yang hemat daya pada layar AMOLED.
  - Rasio kontras tinggi sesuai standar aksesibilitas WCAG AAA.
  - Target sentuhan minimal 44px ramah perangkat genggam.
- **Dual-Mode Web Reader**:
  - Mode Webtoon (gulir vertikal tak terbatas).
  - Mode Manga (pembalik halaman per lembar dengan pembagian 3 zona ketukan layar dan tombol panah keyboard).
  - Kontrol pembaca otomatis menyembunyikan diri saat komik dibaca.
- **Episode Drawer Sheet**:
  - Lembar drawer episode interaktif dengan pencarian instan chapter.
- **Backend FastAPI & Pekerja Latar Belakang**:
  - Server REST API asinkron lengkap (10 endpoint utama).
  - Basis data SQLite untuk riwayat membaca, daftar tontonan/favorit, dan pelacakan unduhan.
  - Pekerja sinkronisasi otomatis (*auto-sync worker*) untuk memperbarui bab baru pada komik favorit.
  - Pengunduh bab multi-utas dan pembuat arsip digital `.cbz`.
- **Pengujian Menyeluruh**:
  - Rangkaian 48 uji kasus otomatis (unit, integrasi, dan antislop delivery gate).
- **Konfigurasi Produksi PM2**:
  - Berkas `ecosystem.config.cjs` untuk menjalankan daemon server backend dan frontend di sistem Linux.

---

## [0.1.0] - 2026-10-04

### Ditambahkan
- Inisialisasi dasar klien API Shinigami (`client.py`) dengan pendeteksi domain mirror dinamis (`shinigami.to`).
- Modul downloader multi-utas dengan pembuatan berkas arsip komik digital `.cbz` (`downloader.py`).
- Antarmuka baris perintah interaktif (`cli.py`) untuk penelusuran katalog, pembacaan, dan pengunduhan via terminal.
- Server REST API awal berbasis FastAPI (`server.py`).
