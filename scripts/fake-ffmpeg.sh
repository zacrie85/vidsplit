#!/usr/bin/env bash
# Fake ffmpeg utk uji batas waktu adaptif VidSplit v0.55.0 — mode dikelola
# env FAKE_FFMPEG_MODE. Meniru pola stderr ffmpeg (frame=/time=/speed=).
MODE="${FAKE_FFMPEG_MODE:-lambat}"
case "$MODE" in
  lambat)
    # Media maju 2 dtk tiap 1,5 dtk wall → 10 dtk media tuntas ±6,2 dtk wall.
    # Dulu (batas absolut kaku): dibunuh di absolutMs 4 dtk; kini: tenggat
    # diperpanjang tiap kemajuan → SELESAI.
    for t in 02.00 04.00 06.00 08.00 10.00; do
      printf 'frame=64 fps=1.4 q=-1.0 size=256kB time=00:00:%s bitrate=1200.0kbits/s speed=0.08x\n' "$t" >&2
      sleep 1.5
    done
    ;;
  beku)
    # Cetak satu kali lalu SUNYI total → ditangkap diamMs ("ffmpeg macet").
    printf 'frame=30 fps=30 q=28.0 size=512kB time=00:00:01.00 bitrate=900.0kbits/s speed=1x\n' >&2
    sleep 30
    ;;
  beku-waktu)
    # stderr mengalir tapi time= BEKU di 0.00 (delta=0 → perpanjangan TAK terjadi)
    # → tenggat dasar habis → "macet pelan".
    while true; do
      printf 'frame=30 fps=0.1 q=28.0 size=512kB time=00:00:00.00 bitrate=900.0kbits/s speed=0.001x\n' >&2
      sleep 0.3
    done
    ;;
  kriek)
    # v0.56.0 — MAJU KECIL-KECIL (persis laporan user v0.55): tiap event stderr
    # hanya maju 0,05 dtk media tiap 0,2 dtk wall. Ambang lama 0,25 dtk/event
    # membuat perpanjangan tak pernah terjadi → dibunuh di tenggat dasar 4 dtk;
    # ambang baru 0,001 → tenggat terus digeser → SELESAI di ±8 dtk.
    t=0.05
    for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20 \
             21 22 23 24 25 26 27 28 29 30 31 32 33 34 35 36 37 38 39 40; do
      printf 'frame=%s fps=1.9 q=28.0 size=128kB time=00:00:0%s bitrate=2000.0kbits/s speed=0.06x\n' "$i" "$t" >&2
      t=$(awk "BEGIN{printf \"%.2f\", $t + 0.05}")
      sleep 0.2
    done
    ;;
  frame-berat)
    # v0.57.1 — KASUS LAPORAN USER: pesan inisialisasi font/libass, lalu SUNYI
    # (frame pertama berat — belum ada time= sama sekali). v0.57.0 membunuh di
    # diamMs (uji: 5 dtk) padahal masih bekerja; v0.57.1 fase awal diberi
    # diamAwalMs → SELESAI.
    printf "[Parsed_subtitles_16 @ 0x0] Loading font file 'C:/Program Files/VidSplit/resources/fonts/Teko-Bold.ttf'\n" >&2
    printf "[Parsed_subtitles_16 @ 0x0] Error opening memory font 'LISENSI-FONT.txt'\n" >&2
    printf "[Parsed_subtitles_16 @ 0x0] fontselect: (DejaVu Sans, 400, 0) -> DejaVuSans, 0, DejaVuSans\n" >&2
    sleep "${FAKE_DIAM_AWAL:-8}"
    for t in 02.00 04.00 06.00 08.00 10.00; do
      printf 'frame=64 fps=1.4 q=-1.0 size=256kB time=00:00:%s bitrate=1200.0kbits/s speed=0.08x\n' "$t" >&2
      sleep 0.2
    done
    ;;
  beku-media)
    # v0.57.1 — stderr HIDUP (time= 01.00 BERULANG, tak pernah naik) → aturan
    # diamMs tak menembak (stderr terus menulis), yang menangkap = bekuMediaMs
    # ("media tidak maju") — dulu menggantung sampai tenggat adaptif.
    printf 'frame=8 fps=0.1 q=28.0 size=512kB time=00:00:01.00 bitrate=900.0kbits/s speed=0.001x\n' >&2
    sleep 1
    for i in $(seq 1 400); do
      printf 'frame=%s fps=0.0 q=28.0 size=512kB time=00:00:01.00 bitrate=900.0kbits/s speed=0.001x\n' "$i" >&2
      sleep 0.3
    done
    ;;
  sunyi)
    # v0.57.1 — SUNYI TOTAL tanpa baris time= (menguji diamAwalMs fase awal).
    sleep 30
    ;;
esac
exit 0
