// v0.34.0 — bukti visual: cerita penuh hantu (pocong & kuntilanak) -> video komik
// -> ekstrak frame -> cek berkas frame utk dilihat manual.
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(ROOT);
const PORT = process.env.PORT || 3119;
const BASE = `http://127.0.0.1:${PORT}`;
const WORK = path.join(ROOT, "work", "uji-galeri-hantu");
const tidur = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync(WORK, { recursive: true });

let proc = null;
try { const r = await fetch(`${BASE}/api/horor/suara`, { signal: AbortSignal.timeout(1200) }); if (!r.ok) throw 0; } catch {
  proc = spawn("node", [path.join(ROOT, ".next", "standalone", "server.js")], {
    env: { ...process.env, HOSTNAME: "127.0.0.1", PORT: String(PORT), VIDSPLIT_WORK: WORK }, stdio: "ignore",
  });
}
for (let i = 0; i < 60; i++) { try { const r = await fetch(`${BASE}/api/horor/suara`); if (r.ok) break; } catch {} await tidur(500); }

let jC = null;
for (let i = 0; i < 10 && !jC; i++) {
  await tidur(1500);
  const rC = await fetch(`${BASE}/api/horor/cerita`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ panjang: "pendek", seed: 777, ide: "pocong bangkit dari kuburan dan kuntilanak menuntut balas di rumah tua", genre: "horor" }),
  });
  if (!rC.ok) { console.log(`cerita HTTP ${rC.status} — mencoba ulang…`); continue; }
  jC = await rC.json();
  if (!jC.ok) jC = null;
}
const paragraf = jC.cerita.bab.flatMap((b) => b.paragraf);
const cerita = { ...jC.cerita, bab: [{ judul: "", paragraf }] };
console.log("cerita:", jC.cerita.judul);

const rR = await fetch(`${BASE}/api/horor/render`, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    cerita, judul: "Uji Galeri Hantu", genreId: "horor",
    narasi: false, volumeMusik: 0.7, rasio: "9:16", resolusi: "720p",
    temaId: "kelam", sumberMusik: "sintesis", ilustrasi: true,
  }),
});
const jR = await rR.json();
console.log("job:", jR.id);
let job = null;
for (let i = 0; i < 240; i++) {
  await tidur(1000);
  job = (await (await fetch(`${BASE}/api/horor/job?id=${jR.id}`)).json()).job;
  if (job.selesai) break;
  if (i % 6 === 0) console.log(` ${job.progres}% — ${job.pesan}`);
}
console.log("status:", job.pesan, "| error:", job.error ?? "-");
if (job.outputs?.[0]) {
  const abs = path.join(WORK, "output", jR.id, job.outputs[0].file);
  const ff = "node_modules/ffmpeg-static/ffmpeg";
  const dur = 75;
  for (let t = 6; t < Math.min(dur, 70); t += 5) {
    spawn("node_modules/ffmpeg-static/ffmpeg", ["-y", "-ss", String(t), "-i", abs, "-frames:v", "1", path.join(WORK, `galeri-${String(t).padStart(2, "0")}.jpg`)], { stdio: "ignore" });
  }
  await tidur(4000);
  console.log("frame tersimpan di", WORK);
}
if (proc) proc.kill();
process.exit(job?.selesai && !job?.error ? 0 : 1);
