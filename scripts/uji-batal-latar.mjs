// VidSplit v0.53.0 — e2e BATAL SAAT MENUNGGU SUBTITLE AI (jalur latar baru):
//   ekspor video 120 dtk dgn subtitleAktif → batal saat transkrip/cakupan jalan
//   → job berakhir "dibatalkan", ffmpeg mati, hasil parsial dirapikan, dan
//     cache subtitle TIDAK diracuni hasil kosong (ekspor ulang tetap beres).
// Jalankan: node scripts/uji-batal-latar.mjs http://127.0.0.1:3100
import { existsSync, readdirSync, readFileSync, statSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";

const BASE = process.argv[2] || "http://127.0.0.1:3100";
const KERJA = process.env.VIDSPLIT_WORK || "/home/z/my-project/vidsplit/work-uji-latar";
const SAMPANJANG = "/home/z/my-project/vidsplit/work/sample/uji-panjang.mp4";

let lulus = 0;
let gagal = 0;
function cek(nama, kondisi, detail) {
  if (kondisi) { lulus += 1; console.log(`  ✓ ${nama}`); }
  else { gagal += 1; console.error(`  ✗ GAGAL: ${nama}`, detail ?? ""); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

if (!existsSync(SAMPANJANG) || statSync(SAMPANJANG).size < 100000) {
  execFileSync("ffmpeg", [
    "-y", "-v", "error",
    "-f", "lavfi", "-i", "testsrc2=size=640x360:rate=24:duration=120",
    "-f", "lavfi", "-i", "sine=frequency=440:duration=120",
    "-c:v", "libx264", "-preset", "ultrafast", "-crf", "30",
    "-c:a", "aac", "-shortest", SAMPANJANG,
  ], { timeout: 180000 });
}

console.log("[1] unggah + mulai ekspor dgn subtitle AI …");
const up = await fetch(`${BASE}/api/upload?kind=video&nama=batal-latar.mp4`, {
  method: "POST", body: readFileSync(SAMPANJANG),
});
const upj = await up.json();
const r0 = await fetch(`${BASE}/api/export`, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    daftar: [{ file: upj.file, nama: "batal-latar", pengaturan: { judul: "Batal Latar", durasiPart: 10, subtitleAktif: true, subtitleCepat: true } }],
    modeEkspor: "cepat",
  }),
});
const j0 = await r0.json();
cek("ekspor dimulai", j0.ok === true && !!j0.id, j0);
const id = j0.id;

console.log("[2] tunggu job proses lalu BATALKAN …");
let job = null;
for (let i = 0; i < 60; i++) {
  await sleep(500);
  const j = (await (await fetch(`${BASE}/api/job?id=${id}`)).json()).job;
  if (j?.videoAktif >= 0) { job = j; break; }
}
cek("job berjalan", !!job);
await sleep(1500); // biarkan transkrip/cakupan di tengah jalan
const rb = await fetch(`${BASE}/api/job`, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ id, aksi: "batal" }),
});
const jb = await rb.json();
cek("permintaan batal diterima", jb.ok === true, jb);

console.log("[3] tunggu job berakhir …");
let akhir = null;
for (let i = 0; i < 120; i++) {
  await sleep(500);
  const j = (await (await fetch(`${BASE}/api/job?id=${id}`)).json()).job;
  if (j?.selesaiSemua) { akhir = j; break; }
}
cek("job selesai diproses", akhir?.selesaiSemua === true);
cek("status dibatalkan", akhir?.dibatalkan === true, { dibatalkan: akhir?.dibatalkan, batalDiminta: akhir?.batalDiminta });
cek("tidak ada video gagal (batal ≠ gagal)", akhir?.adaGagal !== true, akhir?.error);

console.log("[4] cache subtitle tidak diracuni …");
// semua entri cache utk video ini WAJIB tidak ada (batal di tengah transkrip)
const dirCache = path.join(KERJA, "subtitle-ai");
const cacheFiles = existsSync(dirCache) ? readdirSync(dirCache) : [];
cek("folder cache kosong (tidak ada hasil parsial)", cacheFiles.length === 0, cacheFiles);

rmSync(path.join(KERJA, "output", id), { recursive: true, force: true });
console.log(`\n=== uji-batal-latar: ${lulus} LULUS, ${gagal} GAGAL ===`);
if (gagal > 0) process.exit(1);
