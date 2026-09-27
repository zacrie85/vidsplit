// Uji e2e v0.42.0 — RENDER SUNGUHAN dgn font besar + teks panjang:
// pembuktian perbaikan bug "tulisan terpotong di awal dan di akhir" — teks kini
// dilipat multi-baris oleh drawtext (textfile terbungkus) dan tidak meluber.
// Jalankan: bun scripts/uji-wrap-render.ts
import { existsSync, mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { bangunArgumenPart, pilihFfmpeg } from "../src/lib/vidsplit/ffmpeg";
import { teksSiapGambar } from "../src/lib/vidsplit/bungkus";
import { pengaturanDefault, type Pengaturan } from "../src/lib/vidsplit/types";

let lolos = 0;
let total = 0;
function ok(kondisi: boolean, nama: string, detail = "") {
  total += 1;
  if (kondisi) console.log(`  ✓ ${nama}`);
  else {
    lolos = lolos; // gagal tetap dihitung di total
    console.error(`  ✗ ${nama}${detail ? ` — ${detail}` : ""}`);
    process.exitCode = 1;
  }
  if (kondisi) lolos += 1;
}

const dirTmp = mkdtempSync(path.join(os.tmpdir(), "uji-wrap-"));
const JUDUL = "Cerita Fantasi Epik Sang Pendekar Matahari Terbit Dari Seberang Gunung";
const DESKRIPSI = "Ikuti kisah lengkapnya dari awal sampai akhir — jangan lupa like dan follow untuk cerita bagian selanjutnya";

const p: Pengaturan = {
  ...pengaturanDefault,
  judul: JUDUL,
  gayaJudul: { font: "cinzeldec", ukuran: 90, warna: "#ffffff", outlineLebar: 4, outlineWarna: "#000000" },
  kataPart: "Bagian",
  gayaPart: { font: "cinzeldec", ukuran: 60, warna: "#fbbf24", outlineLebar: 3, outlineWarna: "#000000" },
  deskripsi: DESKRIPSI,
  gayaDeskripsi: { font: "bersih", ukuran: 45, warna: "#ffffff", outlineLebar: 3, outlineWarna: "#000000" },
  deskripsiX: 50,
  deskripsiY: 72,
  durasiPart: 20,
  mode: "blur",
  resolusi: "1080",
};

console.log("== A) teksSiapGambar — teks memang terlipat ==");
const siap = teksSiapGambar(p.judul, "Bagian 1", p.deskripsi, p, 1080, 1920);
const barisJ = siap.judul.split("\n");
const barisD = siap.deskripsi.split("\n");
ok(barisJ.length >= 2, `judul terlipat jadi ${barisJ.length} baris (ukuran 90)`, siap.judul);
ok(barisD.length >= 2, `deskripsi terlipat jadi ${barisD.length} baris (ukuran 45)`, siap.deskripsi);
console.log(`    judul  : ${barisJ.map((b) => `"${b}"`).join(" ⏎ ")}`);
console.log(`    deskrip: ${barisD.map((b) => `"${b}"`).join(" ⏎ ")}`);

console.log("== B) bangunArgumenPart — textfile berisi teks terbungkus ==");
const srcPalsu = "/tmp/uji-wrap-src.mp4";
const a1 = bangunArgumenPart({
  src: srcPalsu,
  bg: null,
  logo: null,
  pengaturan: p,
  n: 1,
  mulai: 0,
  durasi: 2,
  W: 1080,
  H: 1920,
  fps: 30,
  adaAudio: true,
  judulTxt: p.judul,
  partTxt: "Bagian 1",
  deskripsiTxt: p.deskripsi,
  dirTmp,
  tag: "uji-wrap",
  codecArgs: ["-c:v", "libx264", "-preset", "ultrafast", "-crf", "30"],
  keluar: path.join(dirTmp, "keluar.mp4"),
});
ok(readFileSync(path.join(dirTmp, "uji-wrap-judul.txt"), "utf8") === siap.judul, "judul.txt = teks terbungkus");
ok(readFileSync(path.join(dirTmp, "uji-wrap-deskripsi.txt"), "utf8") === siap.deskripsi, "deskripsi.txt = teks terbungkus");
ok(siap.part === "Bagian 1", "part.txt pendek tetap 1 baris");

console.log("== C) RENDER SUNGUHAN (pilihFfmpeg — wajib punya drawtext) ==");
const ffPilih = await pilihFfmpeg();
if (!ffPilih.drawtext) {
  console.error(`  ✗ Tidak ada ffmpeg dgn drawtext (${ffPilih.bin}) — render dilewati`);
  process.exit(1);
}
const ff = ffPilih.bin;
console.log(`  ffmpeg: ${ff}`);
const srcNyata = path.join(dirTmp, "src.mp4");
const r0 = spawnSync(ff, [
  "-y", "-hide_banner", "-loglevel", "error",
  "-f", "lavfi", "-i", "testsrc=size=1080x1920:rate=30:duration=2",
  "-f", "lavfi", "-i", "sine=frequency=440:duration=2",
  "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p",
  "-c:a", "aac", "-shortest", srcNyata,
]);
ok(r0.status === 0, "video uji 1080x1920 dibuat", r0.stderr?.toString());

const r1 = spawnSync(ff, a1.args.map((s) => s.replace(srcPalsu, srcNyata)), { timeout: 180_000 });
ok(r1.status === 0, "render dgn teks besar SUKSES", r1.stderr?.toString().slice(-400));
const keluar = path.join(dirTmp, "keluar.mp4");
ok(existsSync(keluar) && statSync(keluar).size > 10_000, "hasil render ada & >10 KB", existsSync(keluar) ? String(statSync(keluar).size) : "tidak ada");

// ekstrak frame utk verifikasi visual (judul wrap di atas, deskripsi wrap di bawah)
const framePng = path.join(dirTmp, "frame-wrap.png");
const r2 = spawnSync(ff, ["-y", "-hide_banner", "-loglevel", "error", "-ss", "1", "-i", keluar, "-frames:v", "1", framePng]);
ok(r2.status === 0 && existsSync(framePng) && statSync(framePng).size > 1_000, "frame ter-ekstrak utk verifikasi visual");

// salin frame ke work/ agar bisa dilihat
try {
  const dirVis = "/home/z/my-project/vidsplit/work/uji-wrap";
  require("node:fs").mkdirSync(dirVis, { recursive: true });
  writeFileSync(path.join(dirVis, "frame-wrap.png"), readFileSync(framePng));
  console.log(`  frame visual: ${dirVis}/frame-wrap.png`);
} catch { /* abaikan */ }

console.log(`\n${lolos}/${total} lulus`);
process.exit(lolos === total ? 0 : 1);
