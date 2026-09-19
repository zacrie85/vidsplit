// VidSplit v0.30.0 — UJI RENDER AI TEXT-TO-VIDEO GENERATOR (versi komik):
// server standalone + PIPER nyata -> cerita -> render jalur komik (gambar atas
// berganti ±3 dtk, kolom cerita bawah, tanpa bab) -> narasi disisipkan ->
// verifikasi: ikhtisar job, MP4, durasi, NARASI TERDENGAR, dan SINKRON
// (jendela kartu judul = musik saja lebih senyap daripada jendela adegan pertama
// yang berisi narasi). Jalankan: VIDSPLIT_PIPER=<dir> node scripts/uji-komik-render.mjs
import { spawn } from "node:child_process";
import { existsSync, statSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(ROOT);
const PORT = process.env.PORT || 3107;
const BASE = `http://127.0.0.1:${PORT}`;
const WORK = path.join(ROOT, "work", "uji-komik-render");
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

// 1) flag AI + uji suara neural
const jS = await (await fetch(`${BASE}/api/horor/suara`)).json();
cek(jS.ok && jS.adaAi === true, `Piper terdeteksi (adaAi=${jS.adaAi})`);
const jAi = await (await fetch(`${BASE}/api/horor/suara`, {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mesin: "ai" }),
})).json();
cek(jAi.ok === true && typeof jAi.wav === "string", `Uji Suara AI lolos (${jAi.metode ?? jAi.galat ?? "-"})`);

// 2) cerita (AI Story Generator)
const rC = await fetch(`${BASE}/api/horor/cerita`, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ panjang: "pendek", seed: 3030, ide: "penjaga mercusuar mendengar lonceng dari dasar laut" }),
});
const jC = await rC.json();
cek(jC.ok && jC.cerita?.bab?.length === 3, `cerita dibuat (${jC.cerita?.judul ?? "?"})`);
// kirim sbg SATU alur (persis UI v0.30): bab dilebur, tanpa judul bab
const paragraf = jC.cerita.bab.flatMap((b) => b.paragraf);
const ceritaSatuAlur = { ...jC.cerita, bab: [{ judul: "", paragraf }] };
cek(paragraf.length >= 4, `paragraf satu alur (${paragraf.length})`);

// 3) render jalur komik (bawaan) + narasi AI + musik
const rR = await fetch(`${BASE}/api/horor/render`, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    cerita: ceritaSatuAlur, judul: "Uji Komik Sync", genreId: "horor",
    narasi: true, mesinNarasi: "ai", kecepatanNarasi: 1, volumeNarasi: 1,
    intensitasMusik: "menegangkan", volumeMusik: 0.7, rasio: "9:16", resolusi: "720p",
    temaId: "kelam", sumberMusik: "sintesis", ilustrasi: true,
  }),
});
const jR = await rR.json();
cek(jR.ok && typeof jR.id === "string", `render komik dimulai (id=${jR.id ?? "-"})`);

let job = null;
const t0 = Date.now();
while (Date.now() - t0 < 600_000) {
  await tidur(1500);
  const jJ = await (await fetch(`${BASE}/api/horor/job?id=${jR.id}`)).json();
  if (jJ.ok) {
    if (job?.tahap !== jJ.job.tahap || job?.progres !== jJ.job.progres) console.log(`    ${jJ.job.tahap} ${jJ.job.progres}% — ${jJ.job.pesan}`);
    job = jJ.job;
    if (job.selesai) break;
  }
}
cek(job?.selesai === true && !job.error, `job selesai tanpa error (${job?.error ?? "bersih"})`);
cek(!job?.peringatan?.length, `tanpa peringatan narasi (${job?.peringatan?.join(" | ") ?? "kosong"})`);
cek(/video komik \d+ adegan \+ narasi/.test(job?.pesan ?? ""), `ikhtisar: video komik + narasi (${job?.pesan ?? "-"})`);
const mp4 = job?.outputs?.[0];
cek(!!mp4 && mp4.file.startsWith("video-ai-"), `keluaran video-ai-* (${mp4?.file ?? "-"})`);

if (mp4) {
  const abs = path.join(WORK, "output", jR.id, mp4.file);
  cek(existsSync(abs) && statSync(abs).size > 200_000, `MP4 ada (${Math.round(statSync(abs).size / 1024)} KB)`);
  const { execSync } = await import("node:child_process");
  const ffprobe = process.platform === "win32"
    ? "node_modules/ffprobe-static/bin/win/x64/ffprobe.exe"
    : "node_modules/ffprobe-static/bin/linux/x64/ffprobe";
  const dur = Number((execSync(`${ffprobe} -v error -show_entries format=duration -of csv=p=0 ${JSON.stringify(abs)}`, { encoding: "utf8" }).match(/[\d.]+/) || [0])[0]);
  cek(dur > 30 && dur < 200, `durasi masuk akal (${Math.round(dur)} dtk)`);
  const vol = (q) => Number((execSync(
    `node_modules/ffmpeg-static/ffmpeg -ss ${q[0]} -t ${(q[1] - q[0]).toFixed(2)} -i ${JSON.stringify(abs)} -af volumedetect -f null - 2>&1 | grep -oE "mean_volume: *-?[0-9.]+"`,
    { encoding: "utf8" },
  ).match(/mean_volume: *(-?[0-9.]+)/) || [0, -99])[1]);
  const judul = vol([0.3, 3.2]);   // kartu judul: musik saja
  const narasi = vol([3.8, 9.5]);  // adegan pertama: musik + narasi AI
  cek(narasi > judul + 2, `SINKRON: narasi adegan-1 lebih keras dr kartu judul (narasi ${narasi.toFixed(1)} dB > judul ${judul.toFixed(1)} dB)`);
  cek(narasi > -35, `narasi AI terdengar jelas (${narasi.toFixed(1)} dB)`);
  // frame bukan hitam
  const frame = path.join(WORK, "frame-komik.jpg");
  try { require("node:child_process").execFileSync("node_modules/ffmpeg-static/ffmpeg", ["-y", "-ss", "12", "-i", abs, "-frames:v", "1", frame], { stdio: "ignore" }); } catch { /* cek YAVG menangkap */ }
  const yavg = Number((execSync(
    `node_modules/ffmpeg-static/ffmpeg -i ${JSON.stringify(frame)} -vf "signalstats,metadata=print:key=lavfi.signalstats.YAVG" -f null - 2>&1 | grep -o "YAVG=[0-9.]*" | head -1`,
    { encoding: "utf8" },
  ).match(/YAVG=([0-9.]+)/) || [0, 0])[1]);
  cek(yavg > 8, `frame tengah bukan hitam (YAVG=${yavg.toFixed(1)})`);
}

if (proc) { try { proc.kill(); } catch {} }
console.log(gagal === 0 ? "\nUJI KOMIK SYNC: SEMUA LOLOS" : `\nUJI KOMIK SYNC: ${gagal} GAGAL`);
process.exit(gagal === 0 ? 0 : 1);
