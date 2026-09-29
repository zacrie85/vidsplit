// VidSplit v0.44.0 — e2e SUBTITLE AI OTOMATIS: ekspor 2 video (Indonesia & Inggris)
// dgn subtitleAktif=true, tunggu job selesai, cek hasil + frame.
// Jalankan: node scripts/uji-subtitle-e2e.mjs [BASE]
import path from "node:path";
import fs from "node:fs";

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

const daftar = [
  {
    file: "upload/video-indo2.mp4",
    nama: "uji-indonesia",
    pengaturan: {
      judul: "Uji Subtitle Indonesia",
      durasiPart: 10,
      subtitleAktif: true,
      subtitleUkuran: 30,
      subtitleY: 88,
    },
  },
  {
    file: "upload/video-english2.mp4",
    nama: "uji-english",
    pengaturan: {
      judul: "Uji Subtitle English",
      durasiPart: 7,
      subtitleAktif: true,
      subtitleUkuran: 30,
      subtitleY: 88,
    },
  },
];

// hasil AI di-cache antar ekspor — tahap "AI: …" hanya terlihat pada ekspor PERTAMA
const adaCache = fs.existsSync(path.join(KERJA, "subtitle-ai")) &&
  (fs.readdirSync(path.join(KERJA, "subtitle-ai")).length || 0) > 0;
console.log(`[info] cache AI: ${adaCache ? "ADA (ekspor instan, tahap AI tak wajib)" : "KOSONG (tahap AI wajib tampil)"}`);

console.log("[1] POST /api/export …");
const r0 = await fetch(`${BASE}/api/export`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ daftar, modeEkspor: "cepat" }),
});
const j0 = await r0.json();
cek("ekspor dimulai", j0.ok === true && !!j0.id, j0);
if (!j0.ok) process.exit(1);
const id = j0.id;
console.log(`    job id = ${id} (total ${j0.total} video, ${j0.totalPart} part)`);

console.log("[2] polling job …");
let job = null;
let terlihatTahapAi = false;
for (let i = 0; i < 600; i++) {
  await new Promise((r) => setTimeout(r, 1000));
  const rj = await fetch(`${BASE}/api/job?id=${id}`);
  const jj = await rj.json();
  if (jj.ok && jj.job) {
    job = jj.job;
    for (const v of job.antrean || []) {
      if (v.tahap && String(v.tahap).startsWith("AI:")) terlihatTahapAi = true;
    }
    const sisa = job.antrean.filter((v) => !["selesai", "gagal", "dibatalkan"].includes(v.status)).length;
    process.stdout.write(`\r    ${job.progresTotal}% · ${job.antrean.map((v) => `${v.status[0]}${v.tahap ? "·" + v.tahap : ""}`).join(" | ")}   `);
    if (job.selesaiSemua) break;
  }
}
console.log("\n");
cek("job selesai", job?.selesaiSemua === true);
cek("tidak ada video gagal", job?.adaGagal !== true, job?.error);
cek("tahap AI pernah tampil ATAU hasil dari cache", terlihatTahapAi || adaCache);
cek("outputs >= 4 part", (job?.outputs?.length || 0) >= 4, job?.outputs);
cek("tanpa peringatan subtitle", !job?.peringatanSubtitle, job?.peringatanSubtitle);

console.log("[3] cek file hasil …");
const folder = path.join(KERJA, "output", id);
const files = fs.existsSync(folder) ? fs.readdirSync(folder) : [];
cek("folder hasil ada", files.length >= 4, files);
const indo1 = files.find((f) => f.includes("indonesia-part-01"));
cek("…indonesia-part-01.mp4 ada", !!indo1, files);
const eng1 = files.find((f) => f.includes("english-part-01"));
cek("…english-part-01.mp4 ada", !!eng1, files);

console.log("[4] cache hasil AI tersimpan …");
const dirCache = path.join(KERJA, "subtitle-ai");
const cacheFiles = fs.existsSync(dirCache) ? fs.readdirSync(dirCache) : [];
cek("2 entri cache (1 per video)", cacheFiles.length === 2, cacheFiles);

fs.writeFileSync(
  "/tmp/uji-sub-e2e-info.json",
  JSON.stringify({ id, folder, files, job }, null, 2),
);
console.log(`\n=== uji-subtitle-e2e: ${lulus} LULUS, ${gagal} GAGAL (job=${id}) ===`);
if (gagal > 0) process.exit(1);
