// VidSplit v0.29.0 — uji render genre non-horor: dongeng + narasi AI (Piper) +
// musik hangat + ilustrasi cerah. Server standalone dinyalakan otomatis.
import { spawn } from "node:child_process";
import { existsSync, statSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(ROOT);
const PORT = process.env.PORT || 3106;
const BASE = `http://127.0.0.1:${PORT}`;
const WORK = path.join(ROOT, "work", "uji-genre-render");
const tidur = (ms) => new Promise((r) => setTimeout(r, ms));

let gagal = 0;
function cek(k, nama) { if (k) console.log(`  [LOLOS] ${nama}`); else { gagal++; console.log(`  [GAGAL] ${nama}`); } }

async function tungguServer() {
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(`${BASE}/api/horor/suara`); if (r.ok) return true; } catch {}
    await tidur(500);
  }
  return false;
}
mkdirSync(WORK, { recursive: true });
let proc = null;
try { const r = await fetch(`${BASE}/api/horor/suara`, { signal: AbortSignal.timeout(1200) }); if (!r.ok) throw 0; } catch {
  proc = spawn("node", [path.join(ROOT, ".next", "standalone", "server.js")], {
    env: { ...process.env, HOSTNAME: "127.0.0.1", PORT: String(PORT), VIDSPLIT_WORK: WORK }, stdio: "ignore",
  });
}
cek(await tungguServer(), "server merespons");

// 1) cerita dongeng
const rC = await fetch(`${BASE}/api/horor/cerita`, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ genre: "dongeng", panjang: "pendek", seed: 2029, ide: "biji bintang jatuh di kebun kedai kue" }),
});
const jC = await rC.json();
cek(jC.ok && jC.cerita?.genre === "dongeng", `cerita dongeng dibuat (${jC.cerita?.judul ?? "?"})`);

// 2) render dengan narasi AI + musik hangat
const rR = await fetch(`${BASE}/api/horor/render`, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    cerita: jC.cerita, judul: "Uji Genre Dongeng", genreId: "dongeng",
    narasi: true, mesinNarasi: "ai", kecepatanNarasi: 1, volumeNarasi: 1,
    intensitasMusik: "santai", volumeMusik: 0.7, rasio: "9:16", resolusi: "720p",
    temaId: "permata", sumberMusik: "sintesis", ilustrasi: true,
  }),
});
const jR = await rR.json();
cek(jR.ok && typeof jR.id === "string", `render dimulai (id=${jR.id ?? "-"})`);

let job = null;
const t0 = Date.now();
while (Date.now() - t0 < 420_000) {
  await tidur(1500);
  const jJ = await (await fetch(`${BASE}/api/horor/job?id=${jR.id}`)).json();
  if (jJ.ok) {
    if (job?.tahap !== jJ.job.tahap) console.log(`    ${jJ.job.tahap} ${jJ.job.progres}% — ${jJ.job.pesan}`);
    job = jJ.job;
    if (job.selesai) break;
  }
}
cek(job?.selesai === true && !job.error, `job selesai tanpa error (${job?.error ?? "bersih"})`);
cek(!job?.peringatan?.length, `tanpa peringatan narasi (${job?.peringatan?.join(" | ") ?? "kosong"})`);
cek(job?.pesan?.includes("narasi"), `ikhtisar menyebut narasi (${job?.pesan ?? "-"})`);
const mp4 = job?.outputs?.[0];
cek(!!mp4 && mp4.file.startsWith("video-ai-"), `berkas keluaran video-ai- (${mp4?.file ?? "-"})`);

if (mp4) {
  const abs = path.join(WORK, "output", jR.id, mp4.file);
  cek(existsSync(abs) && statSync(abs).size > 200_000, `MP4 ada (${Math.round(statSync(abs).size / 1024)} KB)`);
  const { execSync } = await import("node:child_process");
  const ffprobe = process.platform === "win32"
    ? "node_modules/ffprobe-static/bin/win/x64/ffprobe.exe"
    : "node_modules/ffprobe-static/bin/linux/x64/ffprobe";
  const dur = Number((execSync(
    `${ffprobe} -v error -show_entries format=duration -of csv=p=0 ${JSON.stringify(abs)}`,
    { encoding: "utf8" },
  ).match(/[\d.]+/) || [0])[0]);
  cek(dur > 40 && dur < 200, `durasi masuk akal (${Math.round(dur)} dtk)`);
  const vol = execSync(
    `node_modules/ffmpeg-static/ffmpeg -i ${JSON.stringify(abs)} -af volumedetect -f null - 2>&1 | grep -oE "mean_volume: *-?[0-9.]+|max_volume: *-?[0-9.]+"`,
    { encoding: "utf8" },
  );
  const mean = Number((vol.match(/mean_volume: *(-?[0-9.]+)/) || [])[1] ?? -99);
  cek(mean > -45, `audio terdengar (mean ${mean.toFixed(1)} dB) — narasi AI + musik hangat`);
}

if (proc) { try { proc.kill(); } catch {} }
console.log(gagal === 0 ? "\nUJI GENRE DONGENG: SEMUA LOLOS" : `\nUJI GENRE DONGENG: ${gagal} GAGAL`);
process.exit(gagal === 0 ? 0 : 1);
