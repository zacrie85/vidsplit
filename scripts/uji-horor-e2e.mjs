// VidSplit v0.25.0 — E2E Studio Horor: server standalone jalan -> API cerita ->
// API render -> poll job -> MP4 final terprobe (durasi, 2 stream, ukuran) ->
// frame sample dicek (bukan hitam total) + audio bukan senyap.
// Jalankan: node scripts/uji-horor-e2e.mjs  (butuh server di :3000 — mulai otomatis)
import { spawn } from "node:child_process";
import { existsSync, statSync, rmSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(ROOT);

const PORT = process.env.PORT || 3105;
const BASE = `http://127.0.0.1:${PORT}`;
const WORK = path.join(ROOT, "work", "uji-horor-e2e");

let gagal = 0;
function cek(kondisi, nama) {
  if (kondisi) { console.log(`  [LOLOS] ${nama}`); }
  else { gagal++; console.log(`  [GAGAL] ${nama}`); }
}
const tidur = (ms) => new Promise((r) => setTimeout(r, ms));

async function tungguServer() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`${BASE}/api/horor/suara`);
      if (r.ok) return true;
    } catch { /* coba lagi */ }
    await tidur(500);
  }
  return false;
}

// ---- mulai server standalone bila belum ada ----
mkdirSync(WORK, { recursive: true });
let serverProc = null;
let serverUp = false;
try {
  const r = await fetch(`${BASE}/api/horor/suara`, { signal: AbortSignal.timeout(1500) });
  serverUp = r.ok;
} catch { serverUp = false; }
if (!serverUp) {
  console.log("Menyalakan server standalone uji…");
  serverProc = spawn("node", [path.join(ROOT, ".next", "standalone", "server.js")], {
    env: { ...process.env, HOSTNAME: "127.0.0.1", PORT: String(PORT), VIDSPLIT_WORK: WORK },
    stdio: "ignore",
  });
  serverUp = await tungguServer();
}
cek(serverUp, "server merespons");

// ---- 1) buat cerita (v0.26.0: dgn PROMPT IDE) ----
const rC = await fetch(`${BASE}/api/horor/cerita`, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ panjang: "pendek", seed: 2026, ide: "penjaga pemakaman yang mendengar tawa dari dekat makam tua" }),
});
const jC = await rC.json();
cek(jC.ok && jC.cerita?.bab?.length === 3, `cerita dibuat (3 bab, judul: ${jC.cerita?.judul ?? "?"})`);
cek(jC.cerita?.tema === "desa", `tema dari ide = desa (${jC.cerita?.tema})`);
cek(JSON.stringify(jC.cerita).includes("makam") || JSON.stringify(jC.cerita).includes("pemakaman"), "kata kunci ide masuk ke cerita");

// ---- 1b) v0.29.0 — genre AI Video Generator via API ----
const rG = await fetch(`${BASE}/api/horor/cerita`, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ genre: "motivasi", panjang: "pendek", seed: 77 }),
});
const jG = await rG.json();
cek(jG.ok && jG.cerita?.genre === "motivasi", `API genre motivasi ok (judul: ${jG.cerita?.judul ?? "?"})`);
cek(jG.cerita?.bab?.[jG.cerita.bab.length - 1]?.judul === "Pelajaran", "bab akhir motivasi = Pelajaran");

// ---- 2) daftar suara + UJI SUARA AI NEURAL (Piper, bila bundel ada di env) ----
const rS = await fetch(`${BASE}/api/horor/suara`);
const jS = await rS.json();
cek(jS.ok && Array.isArray(jS.suara), `daftar suara ok (${jS.suara?.length ?? 0} suara)`);
cek(typeof jS.adaAi === "boolean", `flag adaAi terkirim (${jS.adaAi})`);
const rAi = await fetch(`${BASE}/api/horor/suara`, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ mesin: "ai" }),
});
const jAi = await rAi.json();
if (jS.adaAi) {
  cek(jAi.ok === true && typeof jAi.wav === "string" && jAi.wav.startsWith("data:audio/wav"), `UJI SUARA AI NEURAL lolos (${jAi.metode ?? jAi.galat ?? "-"})`);
} else {
  // lingkungan uji tanpa bundel Piper (mis. Linux tanpa binari piper) — perilaku benar = galat rapi, bukan crash
  cek(jAi.ok === false && typeof jAi.galat === "string" && jAi.wav === undefined, `UJI SUARA AI dilewati dgn galat rapi (${jAi.galat ?? "-"})`);
}
const rW = await fetch(`${BASE}/api/horor/suara`, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ mesin: "windows" }),
});
const jW = await rW.json();
cek(jW.ok === (process.platform === "win32"), `uji suara Windows konsisten dgn platform (ok=${jW.ok})`);

// ---- 3) mulai render (resolusi kecil agar cepat) ----
const rR = await fetch(`${BASE}/api/horor/render`, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    cerita: jC.cerita, judul: "Uji E2E Horor",
    narasi: false, intensitasMusik: "menegangkan", volumeMusik: 0.7,
    rasio: "9:16", resolusi: "720p", temaId: "kelam",
    sumberMusik: "horor-ambient", ilustrasi: true,
  }),
});
const jR = await rR.json();
cek(jR.ok && typeof jR.id === "string", `render dimulai (id=${jR.id ?? "-"})`);

// ---- 4) poll sampai selesai ----
let job = null;
const t0 = Date.now();
while (Date.now() - t0 < 300_000) {
  await tidur(1000);
  const rJ = await fetch(`${BASE}/api/horor/job?id=${jR.id}`);
  const jJ = await rJ.json();
  if (jJ.ok) {
    job = jJ.job;
    if (job.tahap !== job._tahapTampil) {
      console.log(`    tahap: ${job.tahap} ${job.progres}% — ${job.pesan}`);
    }
    if (job.selesai) break;
  }
}
cek(job?.selesai === true, `job selesai (progres ${job?.progres}%)`);
cek(!job?.error, `tanpa error (${job?.error ?? "bersih"})`);
const mp4 = job?.outputs?.[0];
cek(!!mp4 && mp4.ukuran > 200_000, `MP4 keluaran ada (${mp4 ? Math.round(mp4.ukuran / 1024) + " KB" : "tidak ada"})`);

// ---- 5) probe MP4 final via /api/probe ----
if (mp4) {
  const rel = `output/${jR.id}/${mp4.file}`;
  const abs = path.join(WORK, rel);
  cek(existsSync(abs), "berkas MP4 ada di work");
  const rP = await fetch(`${BASE}/api/probe`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file: rel }),
  });
  const jP = await rP.json();
  cek(jP.ok === true, `probe ok (durasi ${jP.durasi?.toFixed?.(1) ?? "?"} dtk, ${jP.lebar}x${jP.tinggi})`);
  cek(jP.adaAudio === true, "MP4 punya trek audio (musik horor)");
  // durasi wajar: judul 7 + 3 label + 6 paragraf + tamat 6
  cek(jP.durasi > 40 && jP.durasi < 200, `durasi masuk akal (${Math.round(jP.durasi)} dtk)`);
  // frame sample: tarik 1 frame di tengah, pastikan bukan hitam total
  const { execFileSync } = await import("node:child_process");
  const frame = path.join(WORK, "frame.jpg");
  execFileSync("node_modules/ffmpeg-static/ffmpeg", [
    "-y", "-ss", String(Math.floor(jP.durasi / 2)), "-i", abs, "-frames:v", "1", frame,
  ], { stdio: "ignore" });
  const { execSync } = await import("node:child_process");
  const info = execSync(
    `node_modules/ffmpeg-static/ffmpeg -i ${JSON.stringify(frame)} -vf "signalstats,metadata=print:key=lavfi.signalstats.YAVG" -f null - 2>&1 | grep -o "YAVG=[0-9.]*" | head -1`,
    { encoding: "utf8" },
  );
  const yavg = Number((info.match(/YAVG=([0-9.]+)/) || [])[1] ?? 0);
  cek(yavg > 8, `frame tengah bukan hitam total (YAVG=${yavg.toFixed(1)})`);
  // audio level
  const vol = execSync(
    `node_modules/ffmpeg-static/ffmpeg -i ${JSON.stringify(abs)} -af volumedetect -f null - 2>&1 | grep -oE "mean_volume: *-?[0-9.]+" | head -1`,
    { encoding: "utf8" },
  );
  const mv = Number((vol.match(/-?[0-9.]+/) || [])[0] ?? -99);
  cek(mv > -60, `audio terdengar (mean ${mv.toFixed(1)} dB)`);
}

// ---- 6) batal dgn job hantu tidak boleh crash ----
const rB = await fetch(`${BASE}/api/horor/job?id=tidakada`, { method: "DELETE" });
const jB = await rB.json();
cek(jB.ok === false, "batal job hantu ditolak rapi");

if (serverProc) { try { serverProc.kill(); } catch {} }
console.log(gagal === 0 ? "\nE2E HOROR: SEMUA LOLOS" : `\nE2E HOROR: ${gagal} GAGAL`);
process.exit(gagal === 0 ? 0 : 1);
