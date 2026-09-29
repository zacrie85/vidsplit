// VidSplit v0.45.0 — e2e PRATINJAU SUBTITLE AI:
// POST /api/subtitle-preview untuk video Indonesia & Inggris + kasus tanpa audio,
// lalu pastikan klip tersaji via /api/file. Jalankan: node scripts/uji-pratinjau-sub-e2e.mjs [BASE]
import { execFileSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import path from "node:path";

const BASE = process.argv[2] || "http://127.0.0.1:3100";
const KERJA = process.env.VIDSPLIT_WORK || "/home/z/my-project/vidsplit/work/uji-standalone";

let lulus = 0;
let gagal = 0;
function cek(nama, kondisi, detail) {
  if (kondisi) {
    lulus += 1;
    console.log(`  ✓ ${nama}`);
  } else {
    gagal += 1;
    console.error(`  ✗ GAGAL: ${nama}`, detail ?? "");
  }
}

async function pratinjau(file, pengaturan = {}) {
  const r = await fetch(`${BASE}/api/subtitle-preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      file,
      pengaturan: { subtitleAktif: true, subtitleUkuran: 30, subtitleY: 88, ...pengaturan },
    }),
  });
  return r.json();
}

console.log("[1] pratinjau video INDONESIA …");
const t0 = Date.now();
const j1 = await pratinjau("upload/video-indo2.mp4");
console.log(`    (${Math.round((Date.now() - t0) / 1000)} dtk)`, JSON.stringify({ ok: j1.ok, alasan: j1.alasan, pesan: j1.pesan, bahasa: j1.bahasa, n: j1.jumlahSegmen }));
cek("ok=true", j1.ok === true, j1);
cek("klip di folder pratinjau-sub", typeof j1.klip === "string" && j1.klip.startsWith("pratinjau-sub/"), j1.klip);
cek("bahasa terdeteksi id", j1.bahasa === "id", j1.bahasa);
cek("ada segmen teks", (j1.segmen || []).length > 0 && j1.jumlahSegmen > 0, j1.jumlahSegmen);
const fileKlip = path.join(KERJA, j1.klip || "");
cek("berkas klip ada di work", existsSync(fileKlip) && statSync(fileKlip).size > 50_000, fileKlip);
if (j1.ok) console.log("    contoh teks:", JSON.stringify((j1.segmen || []).slice(0, 3).map((s) => s.t)));

console.log("[2] klip tersaji via /api/file …");
const rf = await fetch(`${BASE}/api/file?p=${encodeURIComponent(j1.klip)}`);
cek("HTTP 200", rf.status === 200, rf.status);
cek("content-type video/mp4", (rf.headers.get("content-type") || "").includes("video/mp4"), rf.headers.get("content-type"));
const ukuran = Number(rf.headers.get("content-length") || 0);
cek("ukuran wajar (>50 KB)", ukuran > 50_000, ukuran);

console.log("[3] pratinjau ulang = INSTAN (cache keping) …");
const t1 = Date.now();
const j1b = await pratinjau("upload/video-indo2.mp4");
const dtkUlang = (Date.now() - t1) / 1000;
cek("hasil sama & cepat (<15 dtk)", j1b.ok === true && j1b.klip === j1.klip && dtkUlang < 15, dtkUlang);

console.log("[4] pratinjau video ENGLISH (terjemahan EN→ID) …");
const j2 = await pratinjau("upload/video-english2.mp4");
console.log("    ", JSON.stringify({ ok: j2.ok, alasan: j2.alasan, bahasa: j2.bahasa, diterjemahkan: j2.diterjemahkan, n: j2.jumlahSegmen }));
cek("ok=true", j2.ok === true, j2);
cek("bahasa en", j2.bahasa === "en", j2.bahasa);
cek("diterjemahkan=true", j2.diterjemahkan === true, j2.diterjemahkan);
if (j2.ok) console.log("    contoh teks:", JSON.stringify((j2.segmen || []).slice(0, 2).map((s) => s.t)));

console.log("[5] video TANPA AUDIO → ditolak jelas …");
const fileSenyap = path.join(KERJA, "upload", "uji-tanpa-audio.mp4");
if (!existsSync(fileSenyap)) {
  execFileSync("ffmpeg", [
    "-y", "-v", "error",
    "-f", "lavfi", "-i", "color=c=red:s=320x240:d=2:r=15",
    "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p",
    fileSenyap,
  ]);
}
const j3 = await pratinjau("upload/uji-tanpa-audio.mp4");
cek("ok=false alasan 'audio'", j3.ok === false && j3.alasan === "audio", j3);
cek("pesan jelas", typeof j3.pesan === "string" && j3.pesan.includes("suara"), j3.pesan);

console.log("[6] file tak dikenal → gagal sopan …");
const j4 = await pratinjau("upload/tidak-ada-xyz.mp4");
cek("ok=false, tanpa crash", j4.ok === false && typeof j4.pesan === "string", j4);

console.log(`\nuji-pratinjau-sub-e2e: ${lulus} LULUS, ${gagal} GAGAL`);
if (gagal > 0) process.exit(1);
