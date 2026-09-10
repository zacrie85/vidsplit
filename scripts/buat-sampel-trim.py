#!/usr/bin/env python3
"""Video uji TRIM: 20 dtk, warna berganti tiap 5 dtk:
   0-5 merah, 5-10 biru, 10-15 hijau, 15-20 kuning.
   Trim 5..15 harus memuat biru lalu hijau (bukan merah/kuning)."""
import subprocess, os

SAMPLE = "/home/z/my-project/vidsplit/work/sample"
os.makedirs(SAMPLE, exist_ok=True)
f = os.path.join(SAMPLE, "uji-trim.mp4")

def segmen(warna, dur):
    return ["-f", "lavfi", "-i", f"color=c={warna}:s=640x360:d={dur}:r=24",
            "-f", "lavfi", "-i", f"sine=frequency=440:duration={dur}"]

# concat 4 segmen via filter_complex concat
inputs = []
for w in ["red", "blue", "green", "yellow"]:
    inputs += ["-f", "lavfi", "-i", f"color=c={w}:s=640x360:d=5:r=24"]
    inputs += ["-f", "lavfi", "-i", f"sine=frequency=440:duration=5"]

n = 4
fc = "".join(f"[{2*i}:v][{2*i+1}:a]" for i in range(n)) + f"concat=n={n}:v=1:a=1[vout]"
subprocess.run([
    "ffmpeg", "-y", "-v", "error", *inputs,
    "-filter_complex", fc, "-map", "[vout]",
    "-c:v", "libx264", "-preset", "ultrafast", "-c:a", "aac", "-pix_fmt", "yuv420p", f,
], check=True)
print("ok:", f, "20 dtk 4 segmen warna")
