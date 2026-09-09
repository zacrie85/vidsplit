# VidSplit

Aplikasi desktop untuk kreator konten: ubah video **horizontal → vertikal 9:16**, beri
**tulisan judul** statis + tulisan **Part** yang berganti otomatis sesuai durasi set,
**split otomatis** tepat di batas part, dan sisipkan **background intro** (PNG/JPG) di
awal setiap hasil split. Diproses 100% lokal memakai ffmpeg — tanpa unggah ke internet.

## Fitur

- 3 cara konversi vertikal: **blur lembut** (isi tengah, latar blur), **potong penuh**
  (zoom sampai penuh), **warna solid** (pilih warna sisi kiri/kanan).
- Tulisan judul multi-baris + tulisan `Part N` otomatis: 0–20 dtk = Part 1, 21–40 = Part 2,
  dst. (durasi set bisa diatur 5–3600 detik, preset 20/30/45/60).
- Gaya teks bisa diatur: font (tebal/bersih/klasik), ukuran, warna, outline.
- Split otomatis mengikuti batas part — mode **Presisi** (potongan tepat, kualitas baik)
  atau **Cepat** (render kilat untuk uji coba).
- Background intro 1–10 detik di awal **setiap** potongan, audio video tetap sinkron
  (intro diisi hening).
- Pratinjau live di browser aplikasi: peta part, klik part untuk lompat.
- Unduh per file atau semua sekaligus dalam ZIP (+ BACA-SAYA.txt).
- Resolusi hasil: 1080×1920 atau 720×1280.

## Jalankan mode web (development)

```bash
bun install
bun run dev        # http://localhost:3100
```

Syarat: ffmpeg + ffprobe tersedia di PATH (atau set env `VIDSPLIT_FFMPEG` /
`VIDSPLIT_FFPROBE`).

## Build installer Windows

```bash
bun install
bun run build      # next build (standalone)
bun run dist:win   # electron-builder NSIS → release/VidSplit-Setup-<versi>.exe
```

Installer membundel server Next standalone, font DejaVu, `ffmpeg-static`, dan
`ffprobe-static` — user tidak perlu install ffmpeg sendiri.

## Struktur

```
electron/          proses utama + preload Electron
src/app/api/       upload, probe, export, job, file (serve + Range)
src/lib/vidsplit/  types, ffmpeg (filter graph), jobs (antrean ekspor)
src/components/    PanelAtur, Preview, PanelEkspor, bits
assets/fonts/      DejaVu (dibundel untuk drawtext)
```

## Catatan teknis

- Server: Next.js standalone (`output: "standalone"`) dijalankan oleh Electron
  sebagai proses anak (`ELECTRON_RUN_AS_NODE=1`).
- Teks dibakar via `drawtext` dengan `textfile=` (aman unicode/multi-baris).
- Audio: `anullsrc` hening untuk intro + `aformat/atrim` audio sumber → `concat`,
  sehingga durasi tiap potongan selalu `durasiIntro + durasiPart`.
- `-ss` input-seek + re-encode → potongan presisi di batas part.
