// VidSplit v0.30.0 — UJI RENDER AI TEXT-TO-VIDEO GENERATOR (versi komik):
// server standalone + PIPER nyata -> cerita -> render jalur komik (gambar atas
// berganti ±3 dtk, kolom cerita bawah, tanpa bab) -> narasi disisipkan ->
// verifikasi: ikhtisar job, MP4, durasi, NARASI TERDENGAR, dan SINKRON
// (jendela kartu judul = musik saja lebih senyap daripada jendela adegan pertama
// yang berisi narasi). Jalankan: VIDSPLIT_PIPER=<dir> node scripts/uji-komik-render.mjs
import { spawn, execFileSync } from "node:child_process";
const execFileSync3 = execFileSync;
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
async function tungguJob(id) {
  let j = null;
  const t0 = Date.now();
  while (Date.now() - t0 < 600_000) {
    await tidur(1500);
    const jJ = await (await fetch(`${BASE}/api/horor/job?id=${id}`)).json();
    if (jJ.ok) {
      if (j?.tahap !== jJ.job.tahap || j?.progres !== jJ.job.progres) console.log(`    ${jJ.job.tahap} ${jJ.job.progres}% — ${jJ.job.pesan}`);
      j = jJ.job;
      if (j.selesai || j.error) break;
    }
  }
  return j;
}
const t0 = Date.now();
job = await tungguJob(jR.id);
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
  // v0.31.0 — backsound WAJIB terdengar di jendela musik-saja (kartu judul):
  // mencegah regresi "suara backsound tidak muncul" pada pass sisip apa pun
  cek(judul > -40, `backsound terdengar di kartu judul (${judul.toFixed(1)} dB > -40)`);
  // frame bukan hitam
  const frame = path.join(WORK, "frame-komik.jpg");
  try { require("node:child_process").execFileSync("node_modules/ffmpeg-static/ffmpeg", ["-y", "-ss", "12", "-i", abs, "-frames:v", "1", frame], { stdio: "ignore" }); } catch { /* cek YAVG menangkap */ }
  const yavg = Number((execSync(
    `node_modules/ffmpeg-static/ffmpeg -i ${JSON.stringify(frame)} -vf "signalstats,metadata=print:key=lavfi.signalstats.YAVG" -f null - 2>&1 | grep -o "YAVG=[0-9.]*" | head -1`,
    { encoding: "utf8" },
  ).match(/YAVG=([0-9.]+)/) || [0, 0])[1]);
  cek(yavg > 8, `frame tengah bukan hitam (YAVG=${yavg.toFixed(1)})`);
}

// ================= v0.36.0 — SKENARIO 2: GENRE DONGENG (CERAH) =================
// Persis kasus user: tema "Permata Dongeng" = genre cerah. Dulu (v0.34-0.35)
// genre cerah MELEWATI seluruh pustaka 60 gambar dan memakai ilustrasi SVG
// prosedural lama (~8 jenis berulang) → "hanya ada 5 gambar yang terus diulang".
// Kini: genre cerah WAJIB memakai pustaka yang sama (pewarnaan terang), dan
// ikhtisar menyebut jumlah ilustrasi berbeda yang benar-benar tampil.
console.log("\n-- Skenario 2: genre DONGENG (cerah — kasus user) --");
const rC2 = await fetch(`${BASE}/api/horor/cerita`, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ panjang: "pendek", seed: 404, genre: "dongeng", ide: "kancil dan bubah yang menabur bintang di sawah" }),
});
const jC2 = await rC2.json();
cek(jC2.ok && jC2.cerita?.bab?.length >= 1, `cerita dongeng dibuat (${jC2.cerita?.judul ?? "?"})`);
const paragraf2 = jC2.cerita.bab.flatMap((b) => b.paragraf);
const cerita2 = { ...jC2.cerita, bab: [{ judul: "", paragraf: paragraf2 }] };
const rR2 = await fetch(`${BASE}/api/horor/render`, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    cerita: cerita2, judul: "Uji Komik Dongeng", genreId: "dongeng",
    narasi: true, mesinNarasi: "ai", kecepatanNarasi: 1, volumeNarasi: 1,
    intensitasMusik: "santai", volumeMusik: 0.7, rasio: "9:16", resolusi: "720p",
    temaId: "permata", sumberMusik: "sintesis", ilustrasi: true,
  }),
});
const jR2 = await rR2.json();
cek(jR2.ok && typeof jR2.id === "string", `render dongeng dimulai (id=${jR2.id ?? "-"})`);
const job2 = await tungguJob(jR2.id);
cek(job2?.selesai === true && !job2.error, `job dongeng selesai tanpa error (${job2?.error ?? "bersih"})`);
cek(!(job2?.peringatan ?? []).some((p) => p.includes("Pustaka")),
  `pustaka 60 gambar TERPAKAI utk genre dongeng (peringatan: ${job2?.peringatan?.join(" | ") ?? "kosong"})`);
const mIkhtisar = /\((\d+) ilustrasi pustaka (komik|realistis|realistis\+komik) berbeda/.exec(job2?.pesan ?? "");
cek(!!mIkhtisar && Number(mIkhtisar[1]) >= 10,
  `ikhtisar menyebut jumlah ilustrasi berbeda (${job2?.pesan ?? "-"})`);
const mp42 = job2?.outputs?.[0];
if (mp42) {
  const abs2 = path.join(WORK, "output", jR2.id, mp42.file);
  cek(existsSync(abs2) && statSync(abs2).size > 200_000, `MP4 dongeng ada (${Math.round(statSync(abs2).size / 1024)} KB)`);
  const { execSync } = await import("node:child_process");
  // ekstrak 3 frame pada potongan berbeda utk bukti visual gambar berganti
  for (const t of [6, 22, 50]) {
    const f = path.join(WORK, `frame-dongeng-t${t}.jpg`);
    try { execFileSync3(`node_modules/ffmpeg-static/ffmpeg`, ["-y", "-ss", String(t), "-i", abs2, "-frames:v", "1", f]); } catch {}
    cek(existsSync(f), `frame dongeng t=${t} terekstrak (bukti visual gambar berganti)`);
  }
}

// ================= v0.37.0 — SKENARIO 3: GAYA REALISTIS (agen pendamping) =================
// Kartu 6: pustaka hantu-real (41 ilustrasi still film horor fotorealistis)
// menggantikan pustaka komik; cerita & mesin persis menu 5.
console.log("\n-- Skenario 3: gaya REALISTIS (kartu 6 — agen pendamping menu 5) --");
const rR3 = await fetch(`${BASE}/api/horor/render`, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    cerita: ceritaSatuAlur, judul: "Uji Komik Realistis", genreId: "horor",
    narasi: true, mesinNarasi: "ai", kecepatanNarasi: 1, volumeNarasi: 1,
    intensitasMusik: "menegangkan", volumeMusik: 0.7, rasio: "9:16", resolusi: "720p",
    temaId: "kelam", sumberMusik: "sintesis", ilustrasi: true,
    gayaIlustrasi: "realistis",
  }),
});
const jR3 = await rR3.json();
cek(jR3.ok && typeof jR3.id === "string", `render realistis dimulai (id=${jR3.id ?? "-"})`);
const job3 = await tungguJob(jR3.id);
cek(job3?.selesai === true && !job3.error, `job realistis selesai tanpa error (${job3?.error ?? "bersih"})`);
cek(!(job3?.peringatan ?? []).some((p) => p.includes("Pustaka")),
  `pustaka realistis TERPAKAI (peringatan: ${job3?.peringatan?.join(" | ") ?? "kosong"})`);
cek(/video realistis \d+ adegan/.test(job3?.pesan ?? ""), `ikhtisar menyebut video realistis (${job3?.pesan ?? "-"})`);
const mReal = /\((\d+) ilustrasi pustaka realistis berbeda/.exec(job3?.pesan ?? "");
cek(!!mReal && Number(mReal[1]) >= 8,
  `ikhtisar: ilustrasi pustaka REALISTIS berbeda (${mReal?.[1] ?? "-"})`);
const mp43 = job3?.outputs?.[0];
if (mp43) {
  const abs3 = path.join(WORK, "output", jR3.id, mp43.file);
  cek(existsSync(abs3) && statSync(abs3).size > 200_000, `MP4 realistis ada (${Math.round(statSync(abs3).size / 1024)} KB)`);
  for (const t of [8, 30]) {
    const f = path.join(WORK, `frame-realistis-t${t}.jpg`);
    try { execFileSync3(`node_modules/ffmpeg-static/ffmpeg`, ["-y", "-ss", String(t), "-i", abs3, "-frames:v", "1", f]); } catch {}
    cek(existsSync(f), `frame realistis t=${t} terekstrak (bukti visual)`);
  }
}

if (proc) { try { proc.kill(); } catch {} }
console.log(gagal === 0 ? "\nUJI KOMIK SYNC: SEMUA LOLOS" : `\nUJI KOMIK SYNC: ${gagal} GAGAL`);
process.exit(gagal === 0 ? 0 : 1);
