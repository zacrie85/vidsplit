#!/bin/bash
# Jalankan E2E v2.5.0: start dev server 3100 → uji → matikan server (via PID, aman)
cd /home/z/my-project/vidsplit
nohup npx next dev -p 3100 > /tmp/dev3100.log 2>&1 &
PID=$!
echo "server pid=$PID"
SIAP=0
for i in $(seq 1 40); do
  sleep 3
  KODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 4 http://127.0.0.1:3100/ 2>/dev/null)
  if [ "$KODE" = "200" ]; then echo "server siap (percobaan $i)"; SIAP=1; break; fi
done
if [ "$SIAP" != "1" ]; then echo "SERVER TIDAK SIAP"; kill $PID 2>/dev/null; exit 2; fi
node scripts/uji-v250-e2e.mjs
HASIL=$?
# matikan server: cari proses pemakai port 3100 (bukan pola nama — aman dr self-kill)
PIDPORT=$(ss -tlnp 2>/dev/null | grep 3100 | grep -oP 'pid=\K[0-9]+' | head -1)
[ -n "$PIDPORT" ] && kill "$PIDPORT" 2>/dev/null
kill $PID 2>/dev/null
exit $HASIL
