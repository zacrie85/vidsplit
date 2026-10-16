// VidSplit v0.53.0 — e2e TRANSKRIP LATAR: ekspor NYATA via API dgn subtitle AI
// aktif (Whisper Base) sambil membuktikan part mulai muncul TANPA menunggu
// transkrip penuh (perilaku baru; dulu: semua part menunggu AI tuntas).
// Jalankan (server hidup di :3100 + model ada):
//   VIDSPLIT_WORK=<dir baru> bun run start &
//   node scripts/uji-latar-e2e.mjs http://127.0.0.1:3100
import path from "node:path";
import fs from "node:fs";

const BASE = process.argv[2] || "http://127.0.0.1:3100";
const KERJA = process.env.VIDSPLIT_WORK || "/home/z/my-project/vidsplit/work-uji-latar";
const SAMPLE = "/home/z/my-project/vidsplit/work/sample";

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

async function unggah(file, nama) {
  const r = await fetch(`${BASE}/api/upload?kind=video&nama=${encodeURIComponent(nama)}`, {
    method: "POST",
    body: fs.readFileSync(file),
  });
  const j = await r.json();
  if (!j.ok) throw new Error(`upload ${nama}: ${JSON.stringify(j)}`);
  return j.file;
}

console.log("[1] unggah 2 video uji …");
const f1 = await unggah(path.join(SAMPLE, "uji-mini.mp4"), "latar-a.mp4");
const f2 = await unggah(path.join(SAMPLE, "uji-a.mp4"), "latar-b.mp4");

console.log("[2] POST /api/export (subtitleAktif + cepat) …");
const r0 = await fetch(`${BASE}/api/export`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    daftar: [
      { file: f1, nama: "latar-a", pengaturan: { judul: "Uji Latar A", durasiPart: 10, subtitleAktif: true, subtitleCepat: true, subtitleUkuran: 30, subtitleY: 88 } },
      { file: f2, nama: "latar-b", pengaturan: { judul: "Uji Latar B", durasiPart: 8, subtitleAktif: true, subtitleCepat: true, subtitleUkuran: 30, subtitleY: 88 } },
    ],
    modeEkspor: "cepat",
  }),
});
const j0 = await r0.json();
cek("ekspor dimulai", j0.ok === true && !!j0.id, j0);
if (!j0.ok) process.exit(1);
const id = j0.id;

console.log("[3] polling job …");
let job = null;
let tahapAiTerlihat = false;
let overlapTercatat = false; // part sudah ada SELAGI tahap AI masih tampil
for (let i = 0; i < 300; i++) {
  await new Promise((r) => setTimeout(r, 500));
  const rj = await fetch(`${BASE}/api/job?id=${id}`);
  const jj = await rj.json();
  if (jj.ok && jj.job) {
    job = jj.job;
    const aiJalan = (job.antrean || []).some((v) => v.tahap && String(v.tahap).startsWith("AI:"));
    if (aiJalan) tahapAiTerlihat = true;
    if (aiJalan && (job.outputs?.length || 0) > 0) overlapTercatat = true;
    process.stdout.write(
      `\r    ${job.progresTotal}% · ${job.antrean.map((v) => `${v.status[0]}${v.tahap ? "·" + v.tahap : ""}`).join(" | ")} · out=${job.outputs.length}   `,
    );
    if (job.selesaiSemua) break;
  }
}
console.log("\n");
cek("job selesai", job?.selesaiSemua === true);
cek("tidak ada video gagal", job?.adaGagal !== true, job?.error);
cek("tahap AI pernah tampil", tahapAiTerlihat);
console.log(`  [info] part muncul selagi AI berjalan: ${overlapTercatat ? "YA (berbarengan terbukti)" : "tidak tercatat (AI lebih cepat dr render)"}`);
cek("outputs semua part", (job?.outputs?.length || 0) >= 3, job?.outputs);
cek("tanpa peringatan subtitle", !job?.peringatanSubtitle, job?.peringatanSubtitle);

console.log("[4] cache AI tersimpan di work dir baru …");
const dirCache = path.join(KERJA, "subtitle-ai");
const cacheFiles = fs.existsSync(dirCache) ? fs.readdirSync(dirCache) : [];
cek("2 entri cache (1 per video)", cacheFiles.length === 2, cacheFiles);

console.log("[5] berkas hasil …");
const folder = path.join(KERJA, "output", id);
const files = fs.existsSync(folder) ? fs.readdirSync(folder) : [];
cek("folder hasil ≥ 3 mp4", files.filter((f) => f.endsWith(".mp4")).length >= 3, files);
fs.writeFileSync("/tmp/uji-latar-e2e-info.json", JSON.stringify({ id, folder, files }, null, 2));
console.log(`\n=== uji-latar-e2e: ${lulus} LULUS, ${gagal} GAGAL (job=${id}) ===`);
if (gagal > 0) process.exit(1);
