// Uji e2e VidSplit: upload → probe → ekspor 3 part → verifikasi durasi/dimensi/frame
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync, statSync, readdirSync } from "node:fs";
import path from "node:path";

const BASE = process.env.BASE || "http://127.0.0.1:3100";
const SAMPLE = "/home/z/my-project/vidsplit/work/sample";
const KELUAR = "/home/z/my-project/vidsplit/work/uji-e2e";

function log(...a) {
  console.log("[uji]", ...a);
}
function gagal(...a) {
  console.error("[GAGAL]", ...a);
  process.exit(1);
}

async function unggah(kind, file, nama) {
  const r = await fetch(
    `${BASE}/api/upload?kind=${kind}&nama=${encodeURIComponent(nama)}`,
    { method: "POST", body: readFileSync(file) },
  );
  const j = await r.json();
  if (!j.ok) gagal("upload", kind, j.error);
  log(`unggah ${kind} → ${j.file} (${j.ukuran} B)`);
  return j;
}

async function main() {
  // 1. unggah video + bg
  const upV = await unggah("video", path.join(SAMPLE, "uji-mini.mp4"), "uji-mini.mp4");
  const upB = await unggah("bg", path.join(SAMPLE, "bg-uji.png"), "bg-uji.png");

  // 2. probe
  let r = await fetch(`${BASE}/api/probe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file: upV.file }),
  });
  const info = await r.json();
  if (!info.ok) gagal("probe:", info.error);
  log(`probe → durasi=${info.durasi}s ${info.lebar}x${info.tinggi} fps=${info.fps} audio=${info.adaAudio}`);
  if (Math.abs(info.durasi - 25) > 0.5) gagal("durasi tidak sesuai (harus ~25):", info.durasi);

  // 3. mulai ekspor — 25 dtk ÷ 10 dtk = 3 part; intro bg 1 dtk; 720p; cepat
  r = await fetch(`${BASE}/api/export`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      file: upV.file,
      bg: upB.file,
      modeEkspor: "cepat",
      pengaturan: {
        mode: "blur",
        judul: "Uji VidSplit\nbaris kedua",
        kataPart: "Bagian",
        durasiPart: 10,
        durasiIntro: 1,
        resolusi: "720",
        posisiTeks: "atas",
        bgId: upB.file,
      },
    }),
  });
  const mulai = await r.json();
  if (!mulai.ok) gagal("export:", mulai.error);
  log(`ekspor dimulai → job ${mulai.id}`);

  // 4. polling
  const t0 = Date.now();
  let job;
  while (Date.now() - t0 < 240_000) {
    await new Promise((res) => setTimeout(res, 1200));
    const j = await (await fetch(`${BASE}/api/job?id=${mulai.id}`)).json();
    job = j.job;
    const av = job.antrean[0];
    log(`progres: ${av.selesai}/${av.total} part=${job.partAktif} total=${job.progresTotal}% err=${job.error}`);
    if (job.selesaiSemua || job.error) break;
  }
  if (job.error) gagal("job error:", job.error);
  if (!job.selesaiSemua) gagal("timeout menunggu job");
  if (job.outputs.length !== 3) gagal("jumlah output salah:", job.outputs.length);

  // 5. verifikasi tiap output: durasi = 1 (intro) + 10/10/5 = 11/11/6 dtk, 720x1280
  const folder = `/home/z/my-project/vidsplit/work/output/${mulai.id}`;
  if (!existsSync(folder)) gagal("folder output tidak ada:", folder);
  const ekspektasi = [11, 11, 6];
  for (let i = 0; i < job.outputs.length; i++) {
    const f = path.join(folder, job.outputs[i].file);
    if (!existsSync(f)) gagal("file tidak ada:", f);
    const probe = JSON.parse(
      execFileSync("ffprobe", ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", f]).toString(),
    );
    const dur = parseFloat(probe.format.duration);
    const v = probe.streams.find((s) => s.codec_type === "video");
    const a = probe.streams.find((s) => s.codec_type === "audio");
    const durEks = ekspektasi[i];
    log(`output ${i + 1}: ${job.outputs[i].file} durasi=${dur.toFixed(3)} ${v.width}x${v.height} audio=${!!a}`);
    if (Math.abs(dur - durEks) > 0.25) gagal(`durasi part ${i + 1} salah: ${dur} ≠ ${durEks}`);
    if (v.width !== 720 || v.height !== 1280) gagal("dimensi salah:", `${v.width}x${v.height}`);
    if (!a) gagal("audio hilang pada part", i + 1);
  }

  // 6. unduh per file (cek Content-Disposition + ukuran)
  const nama1 = job.outputs[0].file;
  r = await fetch(`${BASE}/api/file?p=${encodeURIComponent(`output/${mulai.id}/${nama1}`)}&dl=1`);
  const disp = r.headers.get("content-disposition") || "";
  const buf = Buffer.from(await r.arrayBuffer());
  log(`unduh: ${buf.length} B, disposition=${disp.slice(0, 50)}…`);
  if (buf.length < 10_000) gagal("file unduhan terlalu kecil");
  if (!disp.includes("attachment")) gagal("content-disposition bukan attachment");

  // 7. Range request (untuk seek pratinjau)
  r = await fetch(`${BASE}/api/file?p=${encodeURIComponent(`output/${mulai.id}/${nama1}`)}`, {
    headers: { Range: "bytes=0-1023" },
  });
  log(`range: status=${r.status} content-range=${(r.headers.get("content-range") || "").slice(0, 30)}`);
  if (r.status !== 206) gagal("range request bukan 206");

  // 8. ekstrak frame: t=0.5 (harus intro bg) & t=6 (harus video + teks)
  execFileSync("ffmpeg", ["-y", "-v", "error", "-ss", "0.5", "-i", path.join(folder, nama1), "-frames:v", "1", path.join(KELUAR, "frame-intro.png")]);
  execFileSync("ffmpeg", ["-y", "-v", "error", "-ss", "6", "-i", path.join(folder, nama1), "-frames:v", "1", path.join(KELUAR, "frame-part1.png")]);
  const fIntro = statSync(path.join(KELUAR, "frame-intro.png")).size;
  const fPart = statSync(path.join(KELUAR, "frame-part1.png")).size;
  log(`frame intro=${fIntro} B, part=${fPart} B`);

  console.log("\n=== SEMUA UJI LOLOS ===");
  console.log(`job id: ${mulai.id}`);
  console.log(`folder: ${folder}`);
}

main().catch((e) => gagal(e.message));
