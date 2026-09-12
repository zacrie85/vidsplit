// Uji e2e v0.7.0 — mode "Video original" (asli) lewat API sungguhan:
//   antrean 2 video landscape 640x360 (durasiPart min API = 5 dtk):
//     C) hijau 22 dtk, tanpa bg, durasiPart 10 → 3 part (10+10+2 dtk)
//     B) biru 15 dtk, bg kuning intro 1 dtk, durasiPart 10 → 2 part (11+6 dtk)
//   lalu verifikasi ffprobe dimensi/durasi + warna piksel.
// Jalankan: BASE=http://127.0.0.1:3000 node scripts/uji-asli.mjs
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const BASE = process.env.BASE || "http://127.0.0.1:3000";
const SAMPLE = "/home/z/my-project/vidsplit/work/sample";
const readBuf = (f) => readFileSync(f);

function log(...a) {
  console.log("[uji]", ...a);
}
function gagal(...a) {
  console.error("[GAGAL]", ...a);
  process.exit(1);
}

async function unggah(kind, file, nama) {
  const r = await fetch(`${BASE}/api/upload?kind=${kind}&nama=${encodeURIComponent(nama)}`, {
    method: "POST",
    body: readBuf(file),
  });
  const j = await r.json();
  if (!j.ok) gagal(`upload ${kind}`, j.error);
  log(`unggah ${kind} → ${j.file}`);
  return j.file;
}

/** warna piksel tengah 8x8 (koordinat utk frame 640x360) */
function warnaPiksel(file, t) {
  const buf = execFileSync("ffmpeg", [
    "-v", "error", "-ss", String(t), "-i", file,
    "-frames:v", "1", "-vf", "crop=8:8:316:176",
    "-f", "rawvideo", "-pix_fmt", "rgb24", "-",
  ]);
  let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i + 2 < buf.length; i += 3) {
    r += buf[i]; g += buf[i + 1]; b += buf[i + 2]; n++;
  }
  return { r: r / n, g: g / n, b: b / n };
}
function dekat(a, target, toleransi = 60) {
  return Math.abs(a - target) <= toleransi;
}
function cekWarna(label, c, r, g, b) {
  log(`${label}: rgb(${Math.round(c.r)},${Math.round(c.g)},${Math.round(c.b)}) — ekspektasi (${r},${g},${b})`);
  if (!dekat(c.r, r) || !dekat(c.g, g) || !dekat(c.b, b)) gagal("warna salah:", label);
}

async function main() {
  const vC = await unggah("video", path.join(SAMPLE, "uji-c.mp4"), "uji-c.mp4");
  const vB = await unggah("video", path.join(SAMPLE, "uji-b.mp4"), "uji-b.mp4");
  const bgKuning = await unggah("bg", path.join(SAMPLE, "bg-kuning.png"), "bg-kuning.png");

  const r = await fetch(`${BASE}/api/export`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      modeEkspor: "cepat",
      daftar: [
        { // C hijau 22 dtk — asli tanpa bg, durasiPart 10 → 3 part (10+10+2)
          file: vC,
          pengaturan: { mode: "asli", judul: "Asli C", kataPart: "Part", durasiPart: 10, resolusi: "1080" },
        },
        { // B biru 15 dtk — asli + bg kuning intro 1 dtk, durasiPart 10 → 2 part (11+6)
          file: vB, bg: bgKuning,
          pengaturan: { mode: "asli", judul: "Asli B", kataPart: "Bagian", durasiPart: 10, durasiIntro: 1, resolusi: "1080" },
        },
      ],
    }),
  });
  const mulai = await r.json();
  if (!mulai.ok) gagal("export:", mulai.error);
  log(`antrean dimulai → job ${mulai.id}, totalPart=${mulai.totalPart}`);
  if (mulai.totalPart !== 5) gagal("totalPart salah:", mulai.totalPart);

  const t0 = Date.now();
  let job;
  while (Date.now() - t0 < 300_000) {
    await new Promise((res) => setTimeout(res, 1000));
    job = (await (await fetch(`${BASE}/api/job?id=${mulai.id}`)).json()).job;
    const ringkas = job.antrean.map((v) => `${v.status[0]}${v.selesai}/${v.total}`).join(" ");
    log(`progres total=${job.progresTotal}% [${ringkas}] enc=${job.akselerasi}`);
    if (job.selesaiSemua || job.error) break;
  }
  if (job.error) gagal("job error:", job.error);
  if (!job.selesaiSemua) gagal("timeout menunggu antrean");
  if (job.adaGagal) gagal("ada video gagal");
  if (job.antrean.map((v) => v.selesai).join(",") !== "3,2")
    gagal("jumlah part salah:", JSON.stringify(job.antrean));
  const folder = `/home/z/my-project/vidsplit/work/output/${mulai.id}`;
  if (!existsSync(folder)) gagal("folder output tidak ada:", folder);

  const ekspektasi = [
    { slug: "asli-c", dur: 10, dims: [640, 360], isi: [0, 128, 0], bg: null },
    { slug: "asli-c", dur: 10, dims: [640, 360], isi: [0, 128, 0], bg: null },
    { slug: "asli-c", dur: 2, dims: [640, 360], isi: [0, 128, 0], bg: null },
    { slug: "asli-b", dur: 11, dims: [640, 360], isi: [0, 0, 255], bg: [255, 255, 0] },
    { slug: "asli-b", dur: 6, dims: [640, 360], isi: [0, 0, 255], bg: [255, 255, 0] },
  ];
  if (job.outputs.length !== 5) gagal("jumlah output salah:", job.outputs.length);

  for (let i = 0; i < job.outputs.length; i++) {
    const o = job.outputs[i];
    const eks = ekspektasi[i];
    const f = path.join(folder, o.file);
    if (!o.file.startsWith(eks.slug) || !existsSync(f)) gagal(`output ${i + 1} tidak sesuai:`, o.file);
    const probe = JSON.parse(
      execFileSync("ffprobe", ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", f]).toString(),
    );
    const dur = parseFloat(probe.format.duration);
    const vs = probe.streams.find((s) => s.codec_type === "video");
    const aud = probe.streams.find((s) => s.codec_type === "audio");
    log(`output ${i + 1}: ${o.file} dur=${dur.toFixed(2)} ${vs.width}x${vs.height} audio=${!!aud}`);
    if (vs.width !== eks.dims[0] || vs.height !== eks.dims[1])
      gagal(`dimensi salah: ${vs.width}x${vs.height} ≠ ${eks.dims[0]}x${eks.dims[1]} — rasio asli TIDAK terjaga`);
    if (Math.abs(dur - eks.dur) > 0.3) gagal(`durasi output ${i + 1} salah: ${dur} ≠ ${eks.dur}`);
    if (!aud) gagal("audio hilang pada", o.file);

    const tIsi = Math.min(eks.dur - 0.5, eks.dur / 2 + 1);
    cekWarna(`${o.file} t=${tIsi} (isi)`, warnaPiksel(f, tIsi), ...eks.isi);
    if (eks.bg) cekWarna(`${o.file} t=0.5 (intro)`, warnaPiksel(f, 0.5), ...eks.bg);
  }

  console.log("\n=== SEMUA UJI ASLI LOLOS — rasio asli terjaga 640x360 ===");
  console.log(`job id: ${mulai.id}`);
  console.log(`folder: ${folder}`);
}

main().catch((e) => gagal(e.message));
