// Uji e2e ANTREAN batch VidSplit v0.4.0:
//   3 video (durasi/warna beda) + pengaturan PER VIDEO berbeda
//   → ekspor berurutan → verifikasi status antrean, jumlah part,
//     durasi, dimensi, dan warna frame (intro bg + isi video).
// Jalankan: BASE=http://127.0.0.1:3000 node scripts/uji-antrean.mjs
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const BASE = process.env.BASE || "http://127.0.0.1:3000";
const SAMPLE = "/home/z/my-project/vidsplit/work/sample";

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
import { readFileSync } from "node:fs";
const readBuf = (f) => readFileSync(f);

/** ekstrak warna piksel tengah (8x8) pada detik t → {r,g,b} */
function warnaPiksel(file, t) {
  const buf = execFileSync("ffmpeg", [
    "-v", "error", "-ss", String(t), "-i", file,
    "-frames:v", "1", "-vf", "crop=8:8:356:636",
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
  // 1) unggah 3 video + 2 bg
  const vA = await unggah("video", path.join(SAMPLE, "uji-a.mp4"), "uji-a.mp4");
  const vB = await unggah("video", path.join(SAMPLE, "uji-b.mp4"), "uji-b.mp4");
  const vC = await unggah("video", path.join(SAMPLE, "uji-c.mp4"), "uji-c.mp4");
  const bgKuning = await unggah("bg", path.join(SAMPLE, "bg-kuning.png"), "bg-kuning.png");
  const bgCyan = await unggah("bg", path.join(SAMPLE, "bg-cyan.png"), "bg-cyan.png");

  // 2) ekspor ANTREAN — pengaturan berbeda per video
  const r = await fetch(`${BASE}/api/export`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      modeEkspor: "cepat",
      daftar: [
        { // video A: merah 8 dtk, bg kuning intro 1 dtk → 1 part (9 dtk)
          file: vA, bg: bgKuning,
          pengaturan: { mode: "blur", judul: "Video A", kataPart: "Bagian", durasiPart: 10, durasiIntro: 1, resolusi: "720" },
        },
        { // video B: biru 15 dtk, bg cyan intro 2 dtk → 2 part (12 + 7 dtk)
          file: vB, bg: bgCyan,
          pengaturan: { mode: "blur", judul: "Video B", kataPart: "Part", durasiPart: 10, durasiIntro: 2, resolusi: "720" },
        },
        { // video C: hijau 22 dtk, TANPA bg, mode warna magenta → 3 part (10+10+2 dtk)
          file: vC,
          pengaturan: { mode: "warna", warnaLatar: "#FF00FF", judul: "Video C", kataPart: "Segmen", durasiPart: 10, durasiIntro: 3, resolusi: "720" },
        },
      ],
    }),
  });
  const mulai = await r.json();
  if (!mulai.ok) gagal("export:", mulai.error);
  log(`antrean dimulai → job ${mulai.id}, video=${mulai.total}, totalPart=${mulai.totalPart}`);
  if (mulai.total !== 3 || mulai.totalPart !== 6) gagal("total/totalPart salah:", mulai.total, mulai.totalPart);

  // 3) polling — cek urutan proses (videoAktif naik berurutan)
  const t0 = Date.now();
  let job;
  let aktifMaks = -1;
  while (Date.now() - t0 < 300_000) {
    await new Promise((res) => setTimeout(res, 1000));
    job = (await (await fetch(`${BASE}/api/job?id=${mulai.id}`)).json()).job;
    const ringkas = job.antrean.map((v) => `${v.status[0]}${v.selesai}/${v.total}`).join(" ");
    log(`progres total=${job.progresTotal}% videoAktif=${job.videoAktif} [${ringkas}] enc=${job.akselerasi}`);
    if (job.videoAktif >= 0) aktifMaks = Math.max(aktifMaks, job.videoAktif);
    if (job.selesaiSemua || job.error) break;
  }
  if (job.error) gagal("job error:", job.error);
  if (!job.selesaiSemua) gagal("timeout menunggu antrean");
  if (job.adaGagal) gagal("ada video gagal");
  // videoAktif terakhir harus video ke-2 (index) — proses benar-benar berurutan sampai habis
  if (aktifMaks !== 2) gagal("urutan proses tidak sampai video terakhir (aktifMaks=" + aktifMaks + ")");
  for (const v of job.antrean) if (v.status !== "selesai") gagal("status antrean bukan selesai:", JSON.stringify(job.antrean));
  const selesaiPerVideo = job.antrean.map((v) => v.selesai);
  log("part per video:", selesaiPerVideo.join(","));
  if (selesaiPerVideo.join(",") !== "1,2,3") gagal("jumlah part per video salah:", selesaiPerVideo.join(","));

  // 4) verifikasi output: urutan slot = A1, B1, B2, C1, C2, C3
  const folder = `/home/z/my-project/vidsplit/work/output/${mulai.id}`;
  if (!existsSync(folder)) gagal("folder output tidak ada:", folder);
  const ekspektasi = [
    { slug: "video-a", dur: 9,  isi: [255, 0, 0],   bg: [255, 255, 0], tBg: 0.5 },
    { slug: "video-b", dur: 12, isi: [0, 0, 255],   bg: [0, 255, 255], tBg: 1.0 },
    { slug: "video-b", dur: 7,  isi: [0, 0, 255],   bg: [0, 255, 255], tBg: 1.0 },
    { slug: "video-c", dur: 10, isi: [0, 128, 0],   bg: null },
    { slug: "video-c", dur: 10, isi: [0, 128, 0],   bg: null },
    { slug: "video-c", dur: 2,  isi: [0, 128, 0],   bg: null },
  ];
  if (job.outputs.length !== 6) gagal("jumlah output salah:", job.outputs.length);
  for (let i = 0; i < job.outputs.length; i++) {
    const o = job.outputs[i];
    const eks = ekspektasi[i];
    const f = path.join(folder, o.file);
    // o.file = "<slug-judul>-part-XX.mp4" — slug harus mengikuti judul per video
    if (!o.file.startsWith(eks.slug) || !existsSync(f)) gagal(`output ${i + 1} tidak sesuai:`, o.file, "≠", eks.slug + "-part-*");
    const probe = JSON.parse(
      execFileSync("ffprobe", ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", f]).toString(),
    );
    const dur = parseFloat(probe.format.duration);
    const vs = probe.streams.find((s) => s.codec_type === "video");
    const aud = probe.streams.find((s) => s.codec_type === "audio");
    log(`output ${i + 1}: ${o.video} dur=${dur.toFixed(2)} ${vs.width}x${vs.height} audio=${!!aud}`);
    if (Math.abs(dur - eks.dur) > 0.3) gagal(`durasi output ${i + 1} salah: ${dur} ≠ ${eks.dur}`);
    if (vs.width !== 720 || vs.height !== 1280) gagal("dimensi salah:", `${vs.width}x${vs.height}`);
    if (!aud) gagal("audio hilang pada", o.video);

    // frame tengah isi video = warna sumber
    const tIsi = Math.min(eks.dur - 0.5, eks.dur / 2 + 1);
    cekWarna(`${o.video} t=${tIsi} (isi)`, warnaPiksel(f, tIsi), ...eks.isi);
    // frame awal = warna background intro (bila ada)
    if (eks.bg) cekWarna(`${o.video} t=${eks.tBg} (intro)`, warnaPiksel(f, eks.tBg), ...eks.bg);
  }

  console.log("\n=== SEMUA UJI ANTREAN LOLOS ===");
  console.log(`job id: ${mulai.id}`);
  console.log(`folder: ${folder}`);
}

main().catch((e) => gagal(e.message));
