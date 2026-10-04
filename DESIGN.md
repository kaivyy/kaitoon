# DESIGN.md - Kaitoon Web Reader

Visual identity, dials, and style direction for Kaitoon Web Reader.

## Dials
Reading this as: Webtoon & Manga Web Reader for comic fans who hate ads, in an OLED Pure Black minimalist style.
Dial: ENERGY 1 / RHYTHM 2 / MOTION 1

## Identity & Atmosphere
- **Mood**: Focused, immersive, distraction-free, night-reading friendly.
- **Audience**: Manga, Manhwa, and Manhua readers seeking a lightning-fast experience without ads, tracking, or clutter.

## Color Palette
- **Canvas / Background**: `#000000` (OLED pure black, maximum power savings on mobile AMOLED).
- **Cards & Surfaces**: `#0d0d0d` with `#1a1a1a` border.
- **Primary Text**: `#f3f4f6` (Off-white, WCAG AAA compliant contrast).
- **Secondary Text**: `#9ca3af` (Muted silver, WCAG AA compliant contrast).
- **Functional Accent**: `#10b981` (Emerald Green, strictly for active states, new chapter badges, and progress indicators).

## Typography
- System sans-serif stack: `system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`.
- High legibility, zero external font download delay.

## Reader Principles
- **No Ads**: No banners, no pop-ups, no tracking scripts.
- **Direct Streaming**: Images stream directly from CDN via `referrerpolicy="no-referrer"`.
- **Dual-Mode**: Vertical continuous scroll for Manhwa/Webtoons; page-by-page slide flip for traditional Manga.
- **Auto-Hiding Controls**: Controller bar automatically fades out during reading to provide 100% full-screen comic immersion.
