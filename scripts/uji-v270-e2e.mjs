// Uji E2E v2.7.0 — GESER BEBAS VIDEO via API (route /api/export):
//   A) payload baru geserBlurX:-100 / geserBlurY:-100 (mode blur) → job sukses,
//      frame hasil: video TAJAM menempel atas (bukan tengah), bawah = blur
//   B) payload tanpa geser (bawaan) → job sukses (nol regresi)
// Jalankan: bun scripts/uji-v270-e2e.mjs (server dev 3100 hidup di sesi sama)
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const BASE = process.env.BASE || "http://127.0.0.1:3100";
const SAMPLE = "/home/z/my-project/vidsplit/work/sample/uji-mini.mp4";
let lulus = 0, gagalN = 0;
const cek = (k, label, detail = "") => {
  if (k) { lulus++; console.log(`  [LOLOS] ${label}`); }
  else { gagalN++; console.error(`  [GAGAL] ${label} ${detail}`); }
};

async function unggah() {
  const r = await fetch(`${BASE}/api/upload?kind=video&nama=${encodeURIComponent("uji-mini.mp4")}`, {
    method: "POST", body: readFileSync(SAMPLE),
  });
  return r.json();
}

async function eksporDanTunggu(pengaturan, label) {
  const upV = await unggah();
  if (!upV.ok) throw new Error("upload gagal: " + upV.error);
  const r = await fetch(`${BASE}/api/export`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file: upV.file, modeEkspor: "cepat", pengaturan }),
  });
  const mulai = await r.json();
  if (!mulai.ok) throw new Error("export gagal: " + mulai.error);
  const t0 = Date.now();
  let job;
  while (Date.now() - t0 < 240_000) {
    await new Promise((res) => setTimeout(res, 1200));
    const j = await (await fetch(`${BASE}/api/job?id=${mulai.id}`)).json();
    job = j.job;
    if (job.selesaiSemua || job.error) break;
  }
  if (job.error) throw new Error(`job error (${label}): ${job.error}`);
  if (!job.selesaiSemua) throw new Error(`timeout (${label})`);
  const folder = `/home/z/my-project/vidsplit/work/output/${mulai.id}`;
  return path.join(folder, job.outputs[0].file);
}

async function frameKePng(video, png) {
  execFileSync("ffmpeg", ["-y", "-v", "error", "-ss", "1", "-i", video, "-frames:v", "1", png]);
  return existsSync(png) ? png : null;
}

async function main() {
  console.log("== A) geser bebas penuh atas (geserBlurY -100, mode blur) ==");
  try {
    const f = await eksporDanTunggu({
      mode: "blur", judul: "Geser Atas E2E", kataPart: "Part", durasiPart: 6, resolusi: "720",
      geserBlurX: 0, geserBlurY: -100,
    }, "geser-atas");
    cek(existsSync(f), "ekspor geser-atas sukses", f);
    const png = await frameKePng(f, "/tmp/uji-v270-e2e-a.png");
    const sharp = (await import("sharp")).default;
    const buf = await sharp(png).raw().toBuffer();
    const meta = await sharp(png).metadata();
    const W = meta.width, C = meta.channels ?? 3;
    const variasi = (y) => {
      let mn = 255, mx = 0;
      for (let x = 40; x < W - 40; x += 4) { const v = buf[(y * W + x) * C]; if (v < mn) mn = v; if (v > mx) mx = v; }
      return mx - mn;
    };
    // video contain 640x360→720x1280: tinggi 405; gy=-100 → video menempel ATAS
    cek(variasi(150) > 25, `baris y=150 = video tajam (variasi ${variasi(150)})`);
    cek(variasi(1100) < variasi(150), `baris y=1100 = blur latar (${variasi(1100)} < ${variasi(150)})`);
  } catch (e) { cek(false, "geser-atas gagal", String(e)); }

  console.log("== B) bawaan tanpa geser (nol regresi API) ==");
  try {
    const f = await eksporDanTunggu({
      mode: "blur", judul: "Bawaan E2E", kataPart: "Part", durasiPart: 6, resolusi: "720",
    }, "bawaan");
    cek(existsSync(f), "ekspor bawaan sukses");
  } catch (e) { cek(false, "bawaan gagal", String(e)); }

  console.log(`\n===== uji-v270-e2e: ${lulus} LOLOS, ${gagalN} GAGAL =====`);
  if (gagalN > 0) process.exit(1);
}
main();
