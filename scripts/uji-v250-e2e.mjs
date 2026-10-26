// Uji E2E v2.5.0 — MODE COVER "IDENTIK" via API ekspor nyata:
//   A) thumbnail.mode="identik" → semua part dapat cover, SEMUA file cover
//      SHA-256-nya IDENTIK (permintaan user: "cover yang di pakai sama semua")
//   B) thumbnail.mode="satu" → cover frame sama tapi label Part beda → file BERBEDA
// Jalankan: node scripts/uji-v250-e2e.mjs (server dev 3100 HARUS hidup di sesi yang sama)
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const BASE = process.env.BASE || "http://127.0.0.1:3100";
const SAMPLE = "/home/z/my-project/vidsplit/work/sample/uji-mini.mp4";
let lulus = 0, gagalN = 0;
const cek = (k, label, detail = "") => {
  if (k) { lulus++; console.log(`  [LOLOS] ${label}`); }
  else { gagalN++; console.error(`  [GAGAL] ${label} ${detail}`); }
};
const sha256 = (f) => createHash("sha256").update(readFileSync(f)).digest("hex");

async function unggah() {
  const r = await fetch(`${BASE}/api/upload?kind=video&nama=${encodeURIComponent("uji-mini.mp4")}`, {
    method: "POST", body: readFileSync(SAMPLE),
  });
  return r.json();
}

/** ekspor antrean 1 video dgn opsi thumbnail, tunggu selesai, baliki daftar file cover */
async function ekspor(mode, label) {
  const upV = await unggah();
  if (!upV.ok) throw new Error("upload gagal: " + upV.error);
  const r = await fetch(`${BASE}/api/export`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      daftar: [{ file: upV.file, nama: "uji-mini.mp4", pengaturan: { mode: "blur", judul: "Uji Cover Identik", kataPart: "Part", durasiPart: 10, resolusi: "720" } }],
      modeEkspor: "cepat",
      thumbnail: { aktif: true, kata: "Part", format: "jpg", mode, gaya: "futuristik" },
    }),
  });
  const mulai = await r.json();
  if (!mulai.ok) throw new Error("export gagal: " + mulai.error);
  const t0 = Date.now();
  let job;
  while (Date.now() - t0 < 300_000) {
    await new Promise((res) => setTimeout(res, 1500));
    const j = await (await fetch(`${BASE}/api/job?id=${mulai.id}`)).json();
    job = j.job;
    if (job.selesaiSemua || job.error) break;
  }
  if (job.error) throw new Error(`job error (${label}): ${job.error}`);
  if (!job.selesaiSemua) throw new Error(`timeout (${label})`);
  const folder = `/home/z/my-project/vidsplit/work/output/${mulai.id}`;
  const covers = job.outputs.filter((o) => String(o.file).includes("-thumbnail.")).map((o) => path.join(folder, o.file));
  const partVideos = job.outputs.filter((o) => !String(o.file).includes("-thumbnail."));
  return { covers, partVideos };
}

async function main() {
  console.log("== A) mode IDENTIK — semua cover SHA-256 sama ==");
  let hashA = [];
  try {
    const { covers, partVideos } = await ekspor("identik", "identik");
    cek(partVideos.length >= 2, `video dipecah ≥2 part (${partVideos.length} part)`);
    cek(covers.length === partVideos.length, `tiap part punya cover (${covers.length} cover)`);
    cek(covers.length >= 2 && covers.every(existsSync), "semua file cover ada");
    hashA = covers.map(sha256);
    cek(hashA.every((h) => h === hashA[0]), "SHA-256 SEMUA cover IDENTIK — cover dipakai sama semua", hashA.join(" | ").slice(0, 120));
  } catch (e) { cek(false, "mode identik gagal", String(e)); }

  console.log("== B) mode SATU — cover frame sama, label Part beda → file beda ==");
  try {
    const { covers } = await ekspor("satu", "satu");
    const hashB = covers.map(sha256);
    cek(covers.length >= 2, `mode satu tetap jalan (${covers.length} cover)`);
    cek(!hashB.every((h) => h === hashB[0]), "mode satu: cover antar part BERBEDA (label part)", hashB.join(" | ").slice(0, 120));
    if (hashA.length && covers.length) {
      cek(hashB[0] !== hashA[0], "hasil mode satu ≠ mode identik (dua mode benar2 beda)");
    }
  } catch (e) { cek(false, "mode satu gagal", String(e)); }

  console.log(`\n===== uji-v250-e2e: ${lulus} LOLOS, ${gagalN} GAGAL =====`);
  process.exit(gagalN > 0 ? 1 : 0);
}
main();
