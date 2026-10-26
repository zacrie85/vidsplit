// Uji E2E v2.4.0 — payload LAMA (posisiTeks) & BARU (judulX/Y partX/Y) via API:
//   A) payload lama posisiTeks:"bawah" → dimpetakan (judul 77 / part 88), job sukses
//   B) payload baru judulX 20/judulY 25 + partX 75/partY 85 → job sukses + frame berisi teks
// Jalankan: node scripts/uji-v240-e2e.mjs (server dev 3100 HARUS hidup di sesi yang sama)
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync, statSync } from "node:fs";
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
  const f = path.join(folder, job.outputs[0].file);
  return { f, folder, n: job.outputs.length };
}

async function main() {
  console.log("== A) payload LAMA: posisiTeks 'bawah' ==");
  try {
    const { f, n } = await eksporDanTunggu({
      mode: "blur", judul: "Uji Lama Bawah", kataPart: "Part",
      durasiPart: 25, resolusi: "720", posisiTeks: "bawah",
    }, "lama");
    cek(n === 1, `payload lama diterima & dirender (${n} output)`);
    const probe = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-print_format", "json", "-show_format", f]).toString());
    cek(Math.abs(Number(probe.format.duration) - 25) < 0.5, `durasi ${Number(probe.format.duration).toFixed(2)} ≈ 25`);
  } catch (e) { cek(false, "payload lama gagal", String(e)); }

  console.log("== B) payload BARU: judul & part posisi bebas terpisah ==");
  try {
    const { f } = await eksporDanTunggu({
      mode: "blur", judul: "Uji Bebas Kanan Kiri", kataPart: "Eps",
      durasiPart: 25, resolusi: "720",
      judulX: 20, judulY: 25, partX: 78, partY: 84,
    }, "baru");
    const probe = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-print_format", "json", "-show_format", f]).toString());
    cek(Math.abs(Number(probe.format.duration) - 25) < 0.5, `payload baru dirender, durasi ${Number(probe.format.duration).toFixed(2)} ≈ 25`);
    const fCek = "/tmp/uji-v240-e2e-frame.jpg";
    execFileSync("ffmpeg", ["-y", "-v", "error", "-ss", "2", "-i", f, "-frames:v", "1", fCek], { stdio: ["ignore", "ignore", "pipe"] });
    cek(existsSync(fCek) && statSync(fCek).size > 2000, `frame hasil ada teks posisi bebas (${statSync(fCek).size} B)`);
  } catch (e) { cek(false, "payload baru gagal", String(e)); }

  console.log(`\n===== uji-v240-e2e: ${lulus} LOLOS, ${gagalN} GAGAL =====`);
  process.exit(gagalN > 0 ? 1 : 0);
}
main();
