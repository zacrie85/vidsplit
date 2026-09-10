#!/usr/bin/env python3
"""Buat 3 video uji mini berbeda (warna+durasi beda) + 2 background PNG."""
import subprocess, os

SAMPLE = "/home/z/my-project/vidsplit/work/sample"
os.makedirs(SAMPLE, exist_ok=True)

video = [
    # (nama, durasi, warna lavfi)
    ("uji-a.mp4", 8,  "red"),      # merah   → 1 part @10dtk
    ("uji-b.mp4", 15, "blue"),     # biru    → 2 part @10dtk
    ("uji-c.mp4", 22, "green"),    # hijau   → 3 part @10dtk
]
for nama, dur, warna in video:
    subprocess.run([
        "ffmpeg", "-y", "-v", "error",
        "-f", "lavfi", "-i", f"color=c={warna}:s=640x360:d={dur}:r=24",
        "-f", "lavfi", "-i", f"sine=frequency=440:duration={dur}",
        "-c:v", "libx264", "-preset", "ultrafast", "-c:a", "aac",
        "-pix_fmt", "yuv420p", os.path.join(SAMPLE, nama),
    ], check=True)
    print("video ok:", nama, dur, "dtk")

# background PNG berbeda utk tiap video: kuning & cyan
for nama, warna in [("bg-kuning.png", "yellow"), ("bg-cyan.png", "cyan")]:
    subprocess.run([
        "ffmpeg", "-y", "-v", "error",
        "-f", "lavfi", "-i", f"color=c={warna}:s=1080x1920:d=1",
        "-frames:v", "1", os.path.join(SAMPLE, nama),
    ], check=True)
    print("bg ok:", nama)

print("SELESAI — sampel siap di", SAMPLE)
