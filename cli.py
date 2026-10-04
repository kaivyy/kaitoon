#!/usr/bin/env python3
import sys
import json
import argparse
from client import ShinigamiClient
from downloader import download_chapter

def cmd_latest(client: ShinigamiClient, args):
    res = client.list_manga(page=1, page_size=args.limit, sort="latest")
    items = res.get("data", [])
    print(f"\n=== DAFTAR MANGA TERBARU (Total {len(items)}) ===")
    for idx, item in enumerate(items, 1):
        manga_id = item.get("manga_id")
        title = item.get("title")
        latest_ch = item.get("latest_chapter_number")
        rating = item.get("user_rate")
        print(f"[{idx:02d}] {title}")
        print(f"     ID: {manga_id} | Ch Terakhir: {latest_ch} | Rating: {rating}")
    print()

def cmd_search(client: ShinigamiClient, args):
    res = client.search_manga(args.query, page=1, page_size=args.limit)
    items = res.get("data", [])
    print(f"\n=== HASIL PENCARIAN: '{args.query}' ({len(items)} Ditemukan) ===")
    for idx, item in enumerate(items, 1):
        manga_id = item.get("manga_id")
        title = item.get("title")
        alt = item.get("alternative_title") or "-"
        latest_ch = item.get("latest_chapter_number")
        print(f"[{idx:02d}] {title}")
        print(f"     Alt: {alt}")
        print(f"     ID : {manga_id} | Ch: {latest_ch}")
    print()

def cmd_detail(client: ShinigamiClient, args):
    res = client.get_manga_detail(args.manga_id)
    d = res.get("data", {})
    print(f"\n=== DETAIL KOMIK: {d.get('title')} ===")
    print(f"ID          : {d.get('manga_id')}")
    print(f"Judul Lain  : {d.get('alternative_title')}")
    print(f"Status      : {'Ongoing' if d.get('status') == 1 else 'Completed'}")
    print(f"Rating      : {d.get('user_rate')} ({d.get('view_count'):,} views)")
    print(f"Cover       : {d.get('cover_image_url')}")
    
    genres = [g.get('name') for g in d.get('taxonomy', {}).get('Genre', [])]
    print(f"Genre       : {', '.join(genres)}")
    print("\n[Sinopsis]")
    print(d.get("description", "-")[:400] + "...\n")
    
    # Ambil 5 chapter terbaru
    ch_res = client.list_chapters(args.manga_id, page=1, page_size=5)
    chapters = ch_res.get("data", [])
    print(f"[5 Chapter Terbaru]")
    for ch in chapters:
        print(f"  - Chapter {ch.get('chapter_number')}: ID={ch.get('chapter_id')} (Rilis: {ch.get('release_date')})")
    print()

def cmd_chapters(client: ShinigamiClient, args):
    res = client.list_chapters(args.manga_id, page=args.page, page_size=args.limit, sort_order=args.order)
    chapters = res.get("data", [])
    print(f"\n=== DAFTAR CHAPTER (Page {args.page}, Order {args.order.upper()}) ===")
    for ch in chapters:
        print(f"Chapter {ch.get('chapter_number'):<5} | ID: {ch.get('chapter_id')} | Views: {ch.get('view_count'):,}")
    print()

def cmd_pages(client: ShinigamiClient, args):
    urls = client.get_chapter_image_urls(args.chapter_id)
    print(f"\n=== DAFTAR GAMBAR CHAPTER ({len(urls)} Halaman) ===")
    for idx, u in enumerate(urls, 1):
        print(f"[{idx:02d}] {u}")
    print()

def cmd_download(client: ShinigamiClient, args):
    target = download_chapter(client, args.chapter_id, output_dir=args.output, max_workers=args.workers)
    print(f"\nSelesai! Gambar disimpan di folder: {target}\n")

def cmd_export(client: ShinigamiClient, args):
    manga = client.get_manga_detail(args.manga_id).get("data", {})
    chapters = client.list_chapters(args.manga_id, page=1, page_size=500).get("data", [])
    
    data = {
        "metadata": manga,
        "total_chapters": len(chapters),
        "chapters": chapters
    }
    
    filename = args.output or f"manga_{args.manga_id}.json"
    with open(filename, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"\nMetadata dan {len(chapters)} chapter berhasil diekspor ke: {filename}\n")

def main():
    parser = argparse.ArgumentParser(description="Kaitoon Shinigami CLI - Scraper & API Client")
    subparsers = parser.add_subparsers(dest="command", required=True)

    # Subcommand: latest
    p_latest = subparsers.add_parser("latest", help="Lihat daftar manga update terbaru")
    p_latest.add_argument("--limit", type=int, default=10, help="Jumlah komik (default: 10)")

    # Subcommand: search
    p_search = subparsers.add_parser("search", help="Cari komik berdasarkan judul")
    p_search.add_argument("query", type=str, help="Judul atau kata kunci")
    p_search.add_argument("--limit", type=int, default=10, help="Jumlah hasil (default: 10)")

    # Subcommand: detail
    p_detail = subparsers.add_parser("detail", help="Lihat informasi lengkap komik")
    p_detail.add_argument("manga_id", type=str, help="UUID Manga")

    # Subcommand: chapters
    p_ch = subparsers.add_parser("chapters", help="Lihat daftar chapter komik")
    p_ch.add_argument("manga_id", type=str, help="UUID Manga")
    p_ch.add_argument("--page", type=int, default=1, help="Nomor halaman (default: 1)")
    p_ch.add_argument("--limit", type=int, default=30, help="Jumlah chapter per halaman (default: 30)")
    p_ch.add_argument("--order", choices=["desc", "asc"], default="desc", help="Urutan chapter (default: desc)")

    # Subcommand: pages
    p_pages = subparsers.add_parser("pages", help="Lihat URL semua halaman/gambar dalam chapter")
    p_pages.add_argument("chapter_id", type=str, help="UUID Chapter")

    # Subcommand: download
    p_dl = subparsers.add_parser("download", help="Download seluruh gambar dalam chapter")
    p_dl.add_argument("chapter_id", type=str, help="UUID Chapter")
    p_dl.add_argument("--output", default="./downloads", help="Direktori penyimpanan (default: ./downloads)")
    p_dl.add_argument("--workers", type=int, default=5, help="Thread download simultan (default: 5)")

    # Subcommand: export
    p_exp = subparsers.add_parser("export", help="Ekspor metadata komik & daftar chapter ke file JSON")
    p_exp.add_argument("manga_id", type=str, help="UUID Manga")
    p_exp.add_argument("--output", default=None, help="Nama file output .json")

    args = parser.parse_args()
    client = ShinigamiClient()

    cmd_map = {
        "latest": cmd_latest,
        "search": cmd_search,
        "detail": cmd_detail,
        "chapters": cmd_chapters,
        "pages": cmd_pages,
        "download": cmd_download,
        "export": cmd_export
    }

    cmd_map[args.command](client, args)

if __name__ == "__main__":
    main()
