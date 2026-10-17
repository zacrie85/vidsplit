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
    # stderr mengalir tapi time= BEKU di 0.10 → terakhirProgres menyegarkan,
    # tapi media tak maju → tenggat TIDAK diperpanjang → "melewati batas waktu".
    while true; do
      printf 'frame=30 fps=0.1 q=28.0 size=512kB time=00:00:00.10 bitrate=900.0kbits/s speed=0.001x\n' >&2
      sleep 0.3
    done
    ;;
esac
exit 0
