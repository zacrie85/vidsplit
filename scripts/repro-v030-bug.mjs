// REPRO v0.30.0 bug user: "Merender adegan stak di 2/13" + "suara backsound tidak muncul"
// Skenario persis UI bawaan: 1080p 9:16, narasi AI (Piper), musik sintesis 80%,
// menegangkan, cerita satu alur. Poll 900ms — catat SETIAP perubahan pesan + waktu.
// Jalankan: VIDSPLIT_PIPER=/tmp/my-project/piper-linux/piper node scripts/repro-v030-bug.mjs
import { spawn } from "node:child_process";
import { existsSync, statSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(ROOT);
const PORT = process.env.PORT || 3121;
const BASE = `http://127.0.0.1:${PORT}`;
const WORK = path.join(ROOT, "work", "repro-v030");
const tidur = (ms) => new Promise((r) => setTimeout(r, ms));

rmSync(WORK, { recursive: true, force: true });
mkdirSync(WORK, { recursive: true });

async function tungguServer() {
  for (let i = 0; i < 120; i++) {
    try { const r = await fetch(`${BASE}/api/horor/suara`); if (r.ok) return true; } catch {}
    await tidur(500);
  }
  return false;
}

let proc = spawn("node", [path.join(ROOT, ".next", "standalone", "server.js")], {
  env: { ...process.env, HOSTNAME: "127.0.0.1", PORT: String(PORT), VIDSPLIT_WORK: WORK }, stdio: "ignore",
});
const up = await tungguServer();
console.log(`server: ${up ? "OK" : "GAGAL"}`);
if (!up) process.exit(1);

// ---- cerita (AI Story Generator) -> SATU alur seperti UI v0.30 ----
const rC = await fetch(`${BASE}/api/horor/cerita`, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ panjang: "sedang", seed: 4242, ide: "mahasiswa baru yang tersesat ke asrama kosong lantai lima" }),
});
const jC = await rC.json();
const paragraf = jC.cerita.bab.flatMap((b) => b.paragraf);
const ceritaSatuAlur = { ...jC.cerita, bab: [{ judul: "", paragraf }] };
console.log(`cerita: "${jC.cerita.judul}" — ${paragraf.length} paragraf, ${paragraf.join(" ").split(/\s+/).length} kata`);

// ---- render persis default UI ----
const t0 = Date.now();
const dt = () => `+${((Date.now() - t0) / 1000).toFixed(1).padStart(6)}s`;
const rR = await fetch(`${BASE}/api/horor/render`, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    cerita: ceritaSatuAlur, judul: jC.cerita.judul, genreId: "horor",
    narasi: true, mesinNarasi: "ai", kecepatanNarasi: 1, volumeNarasi: 1,
    intensitasMusik: "menegangkan", volumeMusik: 0.8, rasio: "9:16", resolusi: "1080p",
    temaId: "kelam", sumberMusik: "sintesis", ilustrasi: true,
  }),
});
const jR = await rR.json();
console.log(`render dimulai id=${jR.id}`);

let job = null;
let pesanTerakhir = "";
let perubahan = 0;
while (Date.now() - t0 < 900_000) {
  await tidur(900);
  try {
    const jJ = await (await fetch(`${BASE}/api/horor/job?id=${jR.id}`)).json();
    if (jJ.ok) {
      job = jJ.job;
      if (job.pesan !== pesanTerakhir) {
        perubahan++;
        console.log(`${dt()} [${job.tahap} ${String(job.progres).padStart(3)}%] ${job.pesan}`);
        pesanTerakhir = job.pesan;
      }
      if (job.selesai) break;
    }
  } catch (e) { console.log(`${dt()} POLL ERROR: ${e.message}`); }
}

console.log(`\n== JOB SELESAI: error=${job?.error ?? "null"} dibatalkan=${job?.dibatalkan} perubahanPesan=${perubahan}`);
console.log(`peringatan: ${JSON.stringify(job?.peringatan ?? [])}`);
console.log(`outputs: ${JSON.stringify(job?.outputs ?? [])}`);

const mp4 = job?.outputs?.[0];
if (mp4) {
  const abs = path.join(WORK, "output", jR.id, mp4.file);
  const ff = "node_modules/ffmpeg-static/ffmpeg";
  const fp = process.platform === "win32" ? "node_modules/ffprobe-static/bin/win/x64/ffprobe.exe" : "node_modules/ffprobe-static/bin/linux/x64/ffprobe";
  const { execSync } = await import("node:child_process");
  console.log(`\nMP4: ${Math.round(statSync(abs).size / 1024)} KB`);
  console.log(execSync(`${fp} -v error -show_entries stream=codec_type,codec_name,duration -of compact ${JSON.stringify(abs)}`, { encoding: "utf8" }));
  const vol = ([a, b]) => (execSync(
    `${ff} -ss ${a} -t ${(b - a).toFixed(2)} -i ${JSON.stringify(abs)} -af volumedetect -f null - 2>&1 | grep -oE "(mean|max)_volume: *-?[0-9.]+" | tr '\\n' ' '`,
    { encoding: "utf8" },
  ).trim());
  // Cari batas kartu judul (3.5 dtk) — window musik-saja; adegan 1 = narasi+musik
  console.log(`[0.3–3.2] kartu judul (musik saja) : ${vol([0.3, 3.2])}`);
  console.log(`[4.5–10 ] adegan-1 (narasi+musik) : ${vol([4.5, 10])}`);
  const dur = Number((execSync(`${fp} -v error -show_entries format=duration -of csv=p=0 ${JSON.stringify(abs)}`, { encoding: "utf8" }).match(/[\d.]+/) || [0])[0]);
  console.log(`[${(dur - 5).toFixed(1)}–${(dur - 0.3).toFixed(1)}] kartu tamat (musik saja)  : ${vol([dur - 5, dur - 0.3])}`);
}

try { proc.kill(); } catch {}
process.exit(0);
