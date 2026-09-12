// Uji fitur v0.6.0: gerbang password, file .TS, watermark/logo, codec H.265, 15 font.
// Jalankan: BASE=http://127.0.0.1:3000 node scripts/uji-v060.mjs
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";

const BASE = process.env.BASE || "http://127.0.0.1:3000";
const SAMPLE = "/home/z/my-project/vidsplit/work/sample";
const KELUAR = "/home/z/my-project/vidsplit/work/uji-v060";
// hasil ekspor disimpan di work/output/<id>/ (server), bukan di KELUAR
const DIR_OUT = "/home/z/my-project/vidsplit/work/output";
mkdirSync(KELUAR, { recursive: true });

let lulus = 0;
let gagalN = 0;
function ok(label) {
  lulus++;
  console.log(`  [LOLOS] ${label}`);
}
function gagal(label, detail = "") {
  gagalN++;
  console.error(`  [GAGAL] ${label} ${detail}`);
}
function cek(kondisi, label, detail = "") {
  kondisi ? ok(label) : gagal(label, detail);
}

const readBuf = (f) => readFileSync(f);

async function unggah(kind, file, nama) {
  const r = await fetch(`${BASE}/api/upload?kind=${kind}&nama=${encodeURIComponent(nama)}`, {
    method: "POST",
    body: readBuf(file),
  });
  const j = await r.json();
  if (!j.ok) throw new Error(`upload ${nama}: ${j.error}`);
  return j.file;
}

async function probe(file) {
  const r = await fetch(`${BASE}/api/probe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file }),
  });
  return r.json();
}

/** ekspor 1 antrean (1 video) → tunggu selesai → { outputs, job } */
async function eksporSatu(item, modeEkspor = "cepat") {
  const r = await fetch(`${BASE}/api/export`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ daftar: [item], modeEkspor }),
  });
  const j = await r.json();
  if (!j.ok) throw new Error(`export: ${j.error}`);
  for (let i = 0; i < 300; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    const s = await (await fetch(`${BASE}/api/job?id=${j.id}`)).json();
    if (s.job?.selesaiSemua) return { id: j.id, job: s.job };
  }
  throw new Error("timeout menunggu ekspor");
}

function ffprobeCodec(file) {
  const out = execFileSync("ffprobe", [
    "-v", "error", "-select_streams", "v:0",
    "-show_entries", "stream=codec_name,width,height",
    "-of", "json", file,
  ]).toString();
  return JSON.parse(out).streams[0];
}

function ffprobeDurasi(file) {
  const out = execFileSync("ffprobe", [
    "-v", "error", "-show_entries", "format=duration", "-of", "json", file,
  ]).toString();
  return parseFloat(JSON.parse(out).format.duration);
}

/** rata piksel 6x6 pada (x,y) frame detik t */
function piksel(file, t, x, y) {
  const buf = execFileSync("ffmpeg", [
    "-v", "error", "-ss", String(t), "-i", file,
    "-frames:v", "1", "-vf", `crop=6:6:${x}:${y}`,
    "-f", "rawvideo", "-pix_fmt", "rgb24", "-",
  ]);
  let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i + 2 < buf.length; i += 3) {
    r += buf[i]; g += buf[i + 1]; b += buf[i + 2]; n++;
  }
  return { r: r / n, g: g / n, b: b / n };
}
const dekat = (c, r, g, b, tol = 70) =>
  Math.abs(c.r - r) <= tol && Math.abs(c.g - g) <= tol && Math.abs(c.b - b) <= tol;

/* ================= 1. GERBANG PASSWORD ================= */
async function ujiGerbang() {
  console.log("\n== 1. GERBANG PASSWORD ==");
  const g = await (await fetch(`${BASE}/api/gate`)).json();
  cek(g.ok && g.terpasang === true, "GET /api/gate terpasang");

  const buka = async (password) =>
    fetch(`${BASE}/api/gate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aksi: "buka", password }),
    });

  let r = await buka("salah-banget");
  cek(r.status === 401, "password salah ditolak (401)", `status=${r.status}`);

  r = await buka("A$rama33");
  let j = await r.json();
  cek(j.ok === true, "password default A$rama33 diterima", j.error);

  // ganti → lama tak berlaku → baru berlaku → kembalikan default
  r = await fetch(`${BASE}/api/gate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ aksi: "ganti", lama: "salah", baru: "Uji$Pass45" }),
  });
  j = await r.json();
  cek(!j.ok && r.status === 400, "ganti password dgn lama salah ditolak");

  r = await fetch(`${BASE}/api/gate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ aksi: "ganti", lama: "A$rama33", baru: "Uji$Pass45" }),
  });
  j = await r.json();
  cek(j.ok === true, "ganti password sukses", j.error);

  r = await buka("A$rama33");
  cek(r.status === 401, "password lama tidak berlaku setelah diganti");

  r = await buka("Uji$Pass45");
  j = await r.json();
  cek(j.ok === true, "password baru diterima", j.error);

  r = await fetch(`${BASE}/api/gate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ aksi: "ganti", lama: "Uji$Pass45", baru: "A$rama33" }),
  });
  j = await r.json();
  cek(j.ok === true, "kembalikan password default", j.error);
}

/* ================= 2. FILE .TS ================= */
async function siapSampel() {
  rmSync(KELUAR, { recursive: true, force: true });
  mkdirSync(KELUAR, { recursive: true });
  // video .TS (mpegts) 6 dtk — merah kehijauan, ada audio tone
  if (!existsSync(path.join(SAMPLE, "uji-ts.ts"))) {
    execFileSync("ffmpeg", [
      "-y", "-v", "error",
      "-f", "lavfi", "-i", "testsrc2=size=640x360:rate=30:duration=6",
      "-f", "lavfi", "-i", "sine=frequency=440:duration=6",
      "-c:v", "libx264", "-preset", "ultrafast", "-c:a", "aac",
      "-f", "mpegts", path.join(SAMPLE, "uji-ts.ts"),
    ]);
  }
  // logo magenta 200x200 dgn alpha
  execFileSync("ffmpeg", [
    "-y", "-v", "error",
    "-f", "lavfi", "-i", "color=c=magenta:s=200x200",
    "-frames:v", "1", path.join(KELUAR, "logo-uji.png"),
  ]);
  // video mp4 6 dtk (biru) tanpa audio — sekaligus uji kasus tanpa-bg+tanpa-audio
  if (!existsSync(path.join(SAMPLE, "uji-biru-tanpa-audio.mp4"))) {
    execFileSync("ffmpeg", [
      "-y", "-v", "error",
      "-f", "lavfi", "-i", "testsrc=size=640x360:rate=30:duration=6",
      "-c:v", "libx264", "-preset", "ultrafast",
      path.join(SAMPLE, "uji-biru-tanpa-audio.mp4"),
    ]);
  }
}

async function ujiTS() {
  console.log("\n== 2. DUKUNGAN FILE .TS ==");
  await siapSampel();
  const fTs = await unggah("video", path.join(SAMPLE, "uji-ts.ts"), "uji-ts.ts");
  const p = await probe(fTs);
  cek(p.ok === true, "probe .ts ok", p.error);
  cek(Math.abs((p.durasi || 0) - 6) < 1.5, `durasi .ts ≈ 6 dtk (${p.durasi})`);
  cek(p.lebar === 640 && p.tinggi === 360, `dimensi .ts 640x360 (${p.lebar}x${p.tinggi})`);

  // ekspor .ts dgn judul font sinematik + part → verifikasi hasil
  // (durasiPart min 5 dtk di server — pakai 6 agar 1 part penuh)
  const { id, job } = await eksporSatu({
    file: fTs,
    nama: "uji-ts.ts",
    pengaturan: {
      ...({} ),
      mode: "blur", warnaLatar: "#101010", judul: "Uji TS", kataPart: "Bagian",
      gayaJudul: { font: "anton", ukuran: 72, warna: "#ffffff", outlineLebar: 3, outlineWarna: "#000000" },
      gayaPart: { font: "bebas", ukuran: 56, warna: "#ffe14d", outlineLebar: 2, outlineWarna: "#000000" },
      durasiPart: 6, bgId: "", durasiIntro: 0, resolusi: "720", posisiTeks: "tengah",
      posisiPotong: 50, mulaiDetik: 0, akhirDetik: 0, codec: "h264", logoId: "",
      posisiLogo: "kanan-bawah", ukuranLogo: 15, prosesParalel: 1, pakaiGpu: false,
    },
  });
  cek(job.antrean[0].status === "selesai", "ekspor .ts selesai", job.error);
  // 6.023 dtk ÷ 6 = 1 part penuh + ekor pendek (sisa 0,023 → part 0,5 dtk) = 2
  cek(job.antrean[0].total === 2, ".ts 6.02 dtk ÷ 6 = 2 part (1 penuh + ekor)", `total=${job.antrean[0].total}`);
  const namaOut = job.outputs[0]?.file || "";
  const out = path.join(DIR_OUT, id, namaOut);
  cek(existsSync(out) && namaOut.startsWith("uji-ts-"), `file part ada: ${namaOut}`);
  const st = ffprobeCodec(out);
  cek(st.codec_name === "h264", `codec hasil .ts h264 (${st.codec_name})`);
  const d = ffprobeDurasi(out);
  cek(Math.abs(d - 6.02) < 0.6, `durasi part ≈ 6 dtk (${d.toFixed(2)})`);
  return { fTs, idOut: id };
}

/* ================= 3. WATERMARK / LOGO ================= */
async function ujiLogo() {
  console.log("\n== 3. WATERMARK / LOGO ==");
  const logoRel = await unggah(
    "logo", path.join(KELUAR, "logo-uji.png"), "logo-uji.png",
  );

  const fBiru = await unggah(
    "video", path.join(SAMPLE, "uji-biru-tanpa-audio.mp4"), "uji-biru.mp4",
  );

  const hasil = await eksporSatu({
    file: fBiru,
    nama: "uji-biru.mp4",
    logo: logoRel,
    pengaturan: {
      mode: "warna", warnaLatar: "#101010", judul: "", kataPart: "P",
      gayaJudul: { font: "tebal", ukuran: 60, warna: "#ffffff", outlineLebar: 2, outlineWarna: "#000000" },
      gayaPart: { font: "tebal", ukuran: 50, warna: "#ffffff", outlineLebar: 2, outlineWarna: "#000000" },
      durasiPart: 6, bgId: "", durasiIntro: 0, resolusi: "720", posisiTeks: "tengah",
      posisiPotong: 50, mulaiDetik: 0, akhirDetik: 0, codec: "h264", logoId: logoRel,
      posisiLogo: "kanan-bawah", ukuranLogo: 15, prosesParalel: 1, pakaiGpu: false,
    },
  });
  cek(hasil.job.antrean[0].status === "selesai", "ekspor dgn logo (tanpa bg, TANPA audio) selesai", hasil.job.error);
  const out = path.join(DIR_OUT, hasil.id, hasil.job.outputs[0]?.file || "");
  cek(existsSync(out), `file part dgn logo ada: ${hasil.job.outputs[0]?.file}`);

  // kasus lama bermasalah: tanpa bg + tanpa audio dulu GAGAL -map 2:a — kini harus ok
  const st = ffprobeCodec(out);
  cek(!!st.width, `stream video valid (${st.codec_name} ${st.width}x${st.height})`);

  // verifikasi logo magenta di sudut kanan-bawah (720x1280: mx=25,my=38,logo 108px)
  const cx = Math.round(720 - 25 - 108 / 2);
  const cy = Math.round(1280 - 38 - 108 / 2);
  const p = piksel(out, 2, cx - 3, cy - 3);
  console.log(`  piksel pusat logo (${cx},${cy}): rgb(${Math.round(p.r)},${Math.round(p.g)},${Math.round(p.b)})`);
  cek(dekat(p, 255, 0, 255, 90), "logo magenta terlihat di kanan-bawah");

  // area jauh dari logo ≠ magenta
  const p2 = piksel(out, 2, 10, 600);
  cek(!dekat(p2, 255, 0, 255, 50), "area kiri tidak tertutup logo");

  // verifikasi audio: tanpa-audio + tanpa-bg → track hening tetap ada (map 1:a)
  const audio = JSON.parse(
    execFileSync("ffprobe", [
      "-v", "error", "-select_streams", "a:0", "-show_entries", "stream=codec_name",
      "-of", "json", out,
    ]).toString(),
  );
  cek(!!audio.streams?.length, "track audio hening ada (kasus tanpa bg+tanpa audio)");
}

/* ================= 4. H.265 ================= */
async function ujiH265() {
  console.log("\n== 4. CODEC H.265 ==");
  const fB = await unggah("video", path.join(SAMPLE, "uji-b.mp4"), "uji-b.mp4");
  const hasil = await eksporSatu({
    file: fB,
    nama: "uji-b.mp4",
    pengaturan: {
      mode: "crop", warnaLatar: "#101010", judul: "", kataPart: "Part",
      gayaJudul: { font: "tebal", ukuran: 60, warna: "#ffffff", outlineLebar: 2, outlineWarna: "#000000" },
      gayaPart: { font: "tebal", ukuran: 50, warna: "#ffffff", outlineLebar: 2, outlineWarna: "#000000" },
      durasiPart: 7, bgId: "", durasiIntro: 0, resolusi: "720", posisiTeks: "bawah",
      posisiPotong: 50, mulaiDetik: 0, akhirDetik: 0, codec: "h265", logoId: "",
      posisiLogo: "kanan-bawah", ukuranLogo: 15, prosesParalel: 1, pakaiGpu: false,
    },
  });
  cek(hasil.job.antrean[0].status === "selesai", "ekspor h265 selesai", hasil.job.error);
  cek(/x265|265/i.test(hasil.job.akselerasi), `akselerasi menyebut 265: "${hasil.job.akselerasi}"`);
  const out = path.join(DIR_OUT, hasil.id, hasil.job.outputs[0]?.file || "");
  const st = ffprobeCodec(out);
  cek(st.codec_name === "hevc", `codec hevc (${st.codec_name})`);
  const d = ffprobeDurasi(out);
  cek(Math.abs(d - 7) < 0.8, `durasi part ≈ 7 dtk (${d.toFixed(2)})`);
}

/* ================= main ================= */
async function main() {
  await ujiGerbang();
  await ujiTS();
  await ujiLogo();
  await ujiH265();
  console.log(`\n===== HASIL: ${lulus} lolos, ${gagalN} gagal =====`);
  process.exit(gagalN ? 1 : 0);
}
main().catch((e) => {
  console.error("[FATAL]", e);
  process.exit(1);
});
