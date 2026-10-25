#!/bin/bash
# E2E v2.3.0 — SATU COVER UNTUK SEMUA PART + GAYA FUTURISTIK via API+jobs penuh.
# Server dev + uji HARUS dalam satu sesi shell (proses latar mati antar panggilan tool).
set -e
cd /home/z/my-project/vidsplit
PORT=3100
W=work
rm -rf "$W/e2e-v230" && mkdir -p "$W/e2e-v230"

echo "== 1. video uji 90 dtk (testsrc 640x360 + sine) =="
ffmpeg -y -v error -f lavfi -i "testsrc2=s=640x360:d=90:r=25" -f lavfi -i "sine=frequency=440:duration=90" -pix_fmt yuv420p -c:a aac -shortest "$W/e2e-v230/e2e-v230-sumber.mp4"
ls -la "$W/e2e-v230/e2e-v230-sumber.mp4"

echo "== 2. hidupkan dev server (port $PORT) =="
npx next dev -p $PORT > "$W/e2e-v230/server.log" 2>&1 &
SRV=$!
trap "kill $SRV 2>/dev/null || true" EXIT
for i in $(seq 1 60); do
  if curl -s -o /dev/null "http://localhost:$PORT/" ; then echo "server siap ($i dtk)"; break; fi
  sleep 1
done

echo "== 3. unggah video =="
UNGGAH=$(curl -s -X POST "http://localhost:$PORT/api/upload?kind=video&nama=e2e-v230-sumber.mp4" --data-binary @"$W/e2e-v230/e2e-v230-sumber.mp4" -H "Content-Type: application/octet-stream")
echo "$UNGGAH"
FILE=$(echo "$UNGGAH" | python3 -c "import json,sys; print(json.load(sys.stdin)['file'])")
echo "file=$FILE"

echo "== 4. mulai ekspor: 3 part, thumbnail mode=SATU gaya=FUTURISTIK =="
MULAI=$(curl -s -X POST "http://localhost:$PORT/api/export" -H "Content-Type: application/json" -d "{
  \"daftar\": [{
    \"file\": \"$FILE\",
    \"pengaturan\": { \"judul\": \"UJI E2E V230\", \"durasiPart\": 30, \"mode\": \"asli\", \"resolusi\": \"720\", \"prosesParalel\": 3, \"pakaiGpu\": false, \"kataPart\": \"Part\", \"introAktif\": false }
  }],
  \"modeEkspor\": \"cepat\",
  \"thumbnail\": { \"aktif\": true, \"kata\": \"Part\", \"format\": \"jpg\", \"mode\": \"satu\", \"gaya\": \"futuristik\" }
}")
echo "$MULAI"
ID=$(echo "$MULAI" | python3 -c "import json,sys; print(json.load(sys.stdin)['id'])")
echo "job=$ID"

echo "== 5. poling sampai selesai (maks 300 dtk) =="
SELESAI=False
for i in $(seq 1 300); do
  ST=$(curl -s "http://localhost:$PORT/api/job?id=$ID")
  SELESAI=$(echo "$ST" | python3 -c "import json,sys; d=json.load(sys.stdin); print((d.get('job') or {}).get('selesaiSemua'))" 2>/dev/null || echo False)
  if [ "$SELESAI" = "True" ]; then echo "selesai setelah $i dtk"; break; fi
  sleep 1
done
if [ "$SELESAI" != "True" ]; then echo "GAGAL: job tidak selesai dalam 300 dtk"; exit 1; fi

echo "== 6. verifikasi hasil =="
ST=$(curl -s "http://localhost:$PORT/api/job?id=$ID")
echo "$ST" > "$W/e2e-v230/job.json"
python3 - <<'PYEOF'
import json, subprocess, glob, os
job = json.load(open("work/e2e-v230/job.json"))["job"]
err = job.get("error")
assert not err, f"job error: {err}"
outs = [o["file"] for o in job["outputs"]]
part = [f for f in outs if "part-" in f and f.endswith(".mp4")]
thumb = [f for f in outs if "thumbnail" in f]
print("part:", part)
print("thumbnail:", thumb)
assert len(part) == 3, f"harus 3 part, dapat {len(part)}"
assert len(thumb) == 3, f"harus 3 thumbnail (SATU UNTUK SEMUA), dapat {len(thumb)}"
ok = True
for t in thumb:
    p = os.path.join("work/output/" + job["id"], t)
    dim = json.loads(subprocess.check_output(["ffprobe", "-v", "error", "-print_format", "json", "-show_streams", p]))
    w = dim["streams"][0]["width"]; h = dim["streams"][0]["height"]
    uk = os.path.getsize(p)
    print(f"  {t}: {w}x{h}, {uk} B")
    if not (w == 720 and h == 1280 and uk > 5000): ok = False
assert ok, "ada thumbnail tidak 720x1280 / terlalu kecil"
# SEMUA cover dari frame BERSAMA → variasi ukuran antar file kecil (beda teks label saja)
ukuran = sorted(os.path.getsize(os.path.join("work/output/" + job["id"], t)) for t in thumb)
selisih = ukuran[-1] - ukuran[0]
print(f"selisih ukuran thumbnail: {selisih} B (frame bersama → kecil)")
assert selisih < 20000, "thumbnail terlalu beda — kemungkinan frame TIDAK bersama"
# frame bersama tmp sudah terbuang setelah job tuntas
sisa = glob.glob("work/tmp/*frame-satu*.png")
assert not sisa, f"frame bersama tersisa di tmp: {sisa}"
print("E2E V230 LOLOS SEMUA")
PYEOF

echo "== 7. matikan server & tunggu pipe tertutup =="
kill $SRV 2>/dev/null || true
pkill -f "next dev -p $PORT" 2>/dev/null || true
pkill -f "next-server" 2>/dev/null || true
sleep 2
echo "== SELESAI =="
