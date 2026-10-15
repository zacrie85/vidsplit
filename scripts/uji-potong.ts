// Uji unit v0.9.0 — matematika jendela pratinjau potong (preset cepat sudah DIHAPUS
// dari aplikasi sejak v0.9.0, ujinya ikut disederhanakan menjadi uji-potong)
// Jalankan: bun scripts/uji-potong.ts

let lolos = 0;
let total = 0;
function ok(kondisi: boolean, nama: string, detail?: unknown) {
  total++;
  if (kondisi) {
    lolos++;
    console.log(`  ✓ ${nama}`);
  } else {
    console.error(`  ✗ GAGAL: ${nama}`, detail ?? "");
  }
}

console.log("== MATEMATIKA JENDELA PRATINJAU POTONG ==");
// rumus sama dgn PratinjauPotong.tsx — wajib konsisten dgn filter ffmpeg:
//   skala = max(1080/w, 1920/h); fraksi = 1080/(w*skala); kiri = (1-fraksi)*pp/100
// v0.50.0 — dgn zoom manual: fraksiJendela = fraksi/(zoom/100) (clamp ≤1);
// filter ffmpeg: video diskalakan cover×zoom, overlay x=(W-w)*pp/100 — lebar
// video yang terlihat = W/skala → fraksi terlihat = fraksi/zoom. Konsisten.
function fraksiJendela(w: number, h: number): number {
  const skala = Math.max(1080 / w, 1920 / h);
  return Math.min(1, Math.max(0.05, 1080 / (w * skala)));
}
function fraksiJendelaZoom(w: number, h: number, zoom: number): number {
  const z = Math.min(100, Math.max(50, Number.isFinite(zoom) ? zoom : 100)) / 100;
  return Math.min(1, Math.max(0.05, fraksiJendela(w, h) / z));
}
function kiriPersen(w: number, h: number, pp: number, zoom = 100): number {
  return (1 - fraksiJendelaZoom(w, h, zoom)) * Math.min(100, Math.max(0, pp));
}

// 16:9 → skala tinggi: lebarTerskala = 1920*(1920/1080)=3413.33 → fraksi 0.31640…
const f169 = fraksiJendela(1920, 1080);
ok(Math.abs(f169 - 0.3164) < 0.001, "video 16:9: jendela ±31.6% lebar", f169);
// 4:3 → skala tinggi juga: lebarTerskala=1440*(1.7777)=2560 → fraksi 0.4219
const f43 = fraksiJendela(1440, 1080);
ok(Math.abs(f43 - 0.4219) < 0.001, "video 4:3: jendela ±42.2% lebar", f43);
// video vertikal sudah 9:16 → jendela penuh
ok(fraksiJendela(1080, 1920) === 1, "video vertikal 9:16: jendela 100%");

// kiri bergerak 0 → (1-fraksi); posisi 0 = kiri penuh, 100 = kanan penuh
ok(kiriPersen(1920, 1080, 0) === 0, "posisi 0 → jendela di tepi kiri");
ok(
  Math.abs(kiriPersen(1920, 1080, 100) - (1 - f169) * 100) < 0.001,
  "posisi 100 → jendela di tepi kanan",
);
ok(
  Math.abs(kiriPersen(1920, 1080, 50) - ((1 - f169) * 100) / 2) < 0.001,
  "posisi 50 → jendela di tengah",
);

// properti kunci: gerak jendela monoton naik dgn posisi
let monoton = true;
for (let p = 1; p <= 100; p++) {
  if (kiriPersen(1920, 1080, p) < kiriPersen(1920, 1080, p - 1)) monoton = false;
}
ok(monoton, "jendela selalu bergeser kanan saat posisi naik");

console.log("\n== ZOOM MANUAL POTONG (v0.50.0) ==");
// zoom 100 = perilaku lama (identik dgn fraksi tanpa zoom)
ok(
  fraksiJendelaZoom(1920, 1080, 100) === fraksiJendela(1920, 1080),
  "zoom 100% → jendela sama persis dgn perilaku lama",
);
// zoom 50 → jendela melebar 2× (video tampak 2× lebih banyak)
const f169z = fraksiJendela(1920, 1080);
ok(
  Math.abs(fraksiJendelaZoom(1920, 1080, 50) - f169z * 2) < 0.001,
  "zoom 50% → jendela 2× lebih lebar (0.6328)",
  fraksiJendelaZoom(1920, 1080, 50),
);
// clamp: jendela tidak pernah > 100% (video vertikal dgn zoom 50)
ok(fraksiJendelaZoom(1080, 1920, 50) === 1, "video vertikal + zoom 50% → jendela tetap 100% (clamp)");
ok(fraksiJendelaZoom(1920, 1080, 30) === fraksiJendelaZoom(1920, 1080, 50), "zoom < 50 di-clamp ke 50");
ok(fraksiJendelaZoom(1920, 1080, 150) === fraksiJendelaZoom(1920, 1080, 100), "zoom > 100 di-clamp ke 100");
ok(fraksiJendelaZoom(1920, 1080, NaN) === f169z, "zoom NaN → dianggap 100");
// kiri tetap monoton utk SEMUA zoom (geser kiri/kanan tetap bekerja)
let monotonZoom = true;
for (const z of [50, 60, 75, 90, 100]) {
  for (let p = 1; p <= 100; p++) {
    if (kiriPersen(1920, 1080, p, z) < kiriPersen(1920, 1080, p - 1, z)) monotonZoom = false;
  }
}
ok(monotonZoom, "geser kiri/kanan monoton pada semua tingkat zoom");
// posisi 50 → jendela selalu di tengah, apapun zoomnya
ok(
  Math.abs(kiriPersen(1920, 1080, 50, 60) - (1 - fraksiJendelaZoom(1920, 1080, 60)) * 50) < 0.001,
  "posisi 50 → jendela di tengah pada zoom 60%",
);

console.log(`\n${lolos}/${total} uji LOLOS`);
if (lolos !== total) process.exit(1);
console.log("=== SEMUA UJI PRATINJAU POTONG LOLOS ===");
