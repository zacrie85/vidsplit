// Uji unit + render v0.39.0 — TULIS DESKRIPSI: teks bebas posisi-bebas yang
// dibakar ke video lewat drawtext (kartu 4, saudara Tulisan judul & Part).
// Jalankan: bun scripts/uji-deskripsi.ts
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { bangunArgumenPart, ekspresiPosisiDeskripsi, pilihFfmpeg } from "../src/lib/vidsplit/ffmpeg";
import { pengaturanDefault, type Pengaturan } from "../src/lib/vidsplit/types";

let lolos = 0;
let total = 0;
function ok(kondisi: boolean, nama: string, detail?: unknown) {
  total++;
  if (kondisi) {
    lolos++;
    console.log(`  ✓ ${nama}`);
  } else {
    console.error(`  ✗ GAGAL: ${nama}`, detail ?? "");
  }
}

console.log("== DEFAULT & TIPE ==");
ok(pengaturanDefault.deskripsi === "", "bawaan deskripsi = kosong (fitur mati)");
ok(pengaturanDefault.gayaDeskripsi.font === "bersih", "bawaan gayaDeskripsi.font = bersih (mudah dibaca)");
ok(pengaturanDefault.gayaDeskripsi.ukuran === 28, "bawaan gayaDeskripsi.ukuran = 28");
ok(pengaturanDefault.deskripsiX === 50, "bawaan deskripsiX = 50 (tengah)");
ok(pengaturanDefault.deskripsiY === 80, "bawaan deskripsiY = 80 (bawah-tengah, aman dari judul/Part atas)");

console.log("== EKSPRESI POSISI DRAWTEXT (murni) ==");
const d0 = ekspresiPosisiDeskripsi(50, 80);
ok(d0.x === "min(max(0,W*50/100-text_w/2),W-text_w)", "X bawaan: tengah blok teks di 50% lebar", d0.x);
ok(d0.y === "min(max(0,H*80/100),H-text_h)", "Y bawaan: atas blok teks di 80% tinggi", d0.y);
const dNeg = ekspresiPosisiDeskripsi(-10, 250);
ok(dNeg.x.includes("W*0/100"), "X diclamp ke 0", dNeg.x);
ok(dNeg.y.includes("H*100/100"), "Y diclamp ke 100", dNeg.y);
const dNaN = ekspresiPosisiDeskripsi(NaN, Infinity);
ok(dNaN.x.includes("W*50/100") && dNaN.y.includes("H*80/100"), "NaN/Infinity jatuh ke bawaan 50/80", `${dNaN.x} ${dNaN.y}`);
const dDes = ekspresiPosisiDeskripsi(33.333, 12.25);
ok(dDes.x.includes("W*33.33/100"), "desimal dibulatkan 2 angka", dDes.x);
ok(dDes.y.includes("H*12.25/100"), "desimal persis dipertahankan", dDes.y);
ok(d0.x.startsWith("min(max(0,") && d0.x.endsWith("W-text_w)"), "struktur X selalu min/max agar teks tak keluar frame", d0.x);

console.log("== BANGUN ARGUMEN: DENGAN DESKRIPSI ==");
const dirTmp = mkdtempSync(path.join(tmpdir(), "vds-uji-deskripsi-"));
const srcPalsu = path.join(dirTmp, "src.mp4"); // path tak wajib ada utk pembangunan argumen
const keluar1 = path.join(dirTmp, "dengan-deskripsi.mp4");

const dasar: Pengaturan = {
  ...pengaturanDefault,
  judul: "Judul Ajaib",
  kataPart: "Bagian",
  deskripsi: "Deskripsi keren\nbaris kedua",
  gayaDeskripsi: { font: "bersih", ukuran: 30, warna: "#ffffff", outlineLebar: 3, outlineWarna: "#000000" },
  deskripsiX: 20,
  deskripsiY: 90,
  durasiPart: 20,
  mode: "blur",
  resolusi: "1080",
  codec: "h264",
  prosesParalel: 1,
  pakaiGpu: false,
};

const a1 = bangunArgumenPart({
  src: srcPalsu,
  bg: null,
  logo: null,
  pengaturan: dasar,
  n: 1,
  mulai: 0,
  durasi: 1.2,
  W: 1080,
  H: 1920,
  fps: 30,
  adaAudio: true,
  judulTxt: dasar.judul,
  partTxt: `${dasar.kataPart} 1`,
  deskripsiTxt: dasar.deskripsi,
  dirTmp,
  tag: "uji-1",
  codecArgs: ["-c:v", "libx264", "-preset", "ultrafast", "-crf", "30"],
  keluar: keluar1,
});
const f1 = a1.args.join(" ");
const fileDes = path.join(dirTmp, "uji-1-deskripsi.txt");
ok(existsSync(fileDes), "berkas teks deskripsi ditulis", fileDes);
ok(readFileSync(fileDes, "utf8").includes("baris kedua"), "isi berkas deskripsi benar (multi-baris utk unicode aman)");
ok((f1.match(/drawtext=/g) || []).length === 3, "ada TIGA drawtext (judul + Part + deskripsi)", (f1.match(/drawtext=/g) || []).length);
ok(f1.includes("W*20/100-text_w/2"), "X deskripsi 20% (tengah-teks) masuk graf", "");
ok(f1.includes("H*90/100"), "Y deskripsi 90% (atas-teks) masuk graf");
ok(f1.includes("x='min(max(0,W*20/100-text_w/2),W-text_w)'"), "ekspresi X dibungkus kutip tunggal (koma aman dr parser filter_complex)");
ok(f1.includes("y='min(max(0,H*90/100),H-text_h)'"), "ekspresi Y dibungkus kutip tunggal");
ok(/drawtext=[^\]]*deskripsi\.txt[^\]]*line_spacing=/.test(f1), "drawtext deskripsi punya line_spacing utk multi-baris");
ok(f1.includes("fontcolor=0xffffff"), "warna teks deskripsi putih masuk graf");
ok(f1.includes("borderw="), "outline deskripsi masuk graf");
ok(a1.total === 1.2, "total durasi tak berubah oleh deskripsi", a1.total);

console.log("== BANGUN ARGUMEN: TANPA DESKRIPSI ==");
const tanpa: Pengaturan = { ...dasar, deskripsi: "" };
const a2 = bangunArgumenPart({
  src: srcPalsu,
  bg: null,
  logo: null,
  pengaturan: tanpa,
  n: 1,
  mulai: 0,
  durasi: 1.2,
  W: 1080,
  H: 1920,
  fps: 30,
  adaAudio: true,
  judulTxt: tanpa.judul,
  partTxt: `${tanpa.kataPart} 1`,
  deskripsiTxt: "",
  dirTmp,
  tag: "uji-2",
  codecArgs: ["-c:v", "libx264", "-preset", "ultrafast", "-crf", "30"],
  keluar: path.join(dirTmp, "tanpa-deskripsi.mp4"),
});
const f2 = a2.args.join(" ");
ok((f2.match(/drawtext=/g) || []).length === 2, "tanpa deskripsi → hanya 2 drawtext (judul + Part)", (f2.match(/drawtext=/g) || []).length);
ok(!f2.includes("deskripsi.txt"), "filter TIDAK merujuk berkas deskripsi");

const spasi: Pengaturan = { ...dasar, deskripsi: "   \n  " };
const a3 = bangunArgumenPart({
  src: srcPalsu,
  bg: null,
  logo: null,
  pengaturan: spasi,
  n: 1,
  mulai: 0,
  durasi: 1.2,
  W: 1080,
  H: 1920,
  fps: 30,
  adaAudio: true,
  judulTxt: spasi.judul,
  partTxt: `${spasi.kataPart} 1`,
  deskripsiTxt: spasi.deskripsi,
  dirTmp,
  tag: "uji-3",
  codecArgs: ["-c:v", "libx264", "-preset", "ultrafast", "-crf", "30"],
  keluar: path.join(dirTmp, "spasi.mp4"),
});
ok((a3.args.join(" ").match(/drawtext=/g) || []).length === 2, "deskripsi spasi-putih dianggap kosong → 2 drawtext");

console.log("== RENDER SUNGUHAN (pilihFfmpeg — wajib punya drawtext) ==");
// PENTING: JANGAN pakai node_modules/ffmpeg-static mentah — varian npm TIDAK punya
// drawtext (libfreetype). pilihFfmpeg() = logika produksi yang mendeteksi drawtext
// dan memilih binary terbaik (installer Windows bundel varian dgn drawtext).
const ffPilih = await pilihFfmpeg();
if (!ffPilih.drawtext) {
  console.error(`  ✗ Tidak ada ffmpeg dgn drawtext di lingkungan ini (${ffPilih.bin}) — render dilewati`);
  console.log(`\n${lolos}/${total} lulus (render dilewati)`);
  process.exit(lolos === total ? 0 : 1);
}
const ff = ffPilih.bin;
console.log(`  ffmpeg: ${ff} (drawtext: ya)`);
const srcNyata = path.join(dirTmp, "src-nyata.mp4");
const r0 = spawnSync(ff, [
  "-y", "-hide_banner", "-loglevel", "error",
  "-f", "lavfi", "-i", "testsrc=size=270x480:rate=30:duration=2",
  // WAJIB ada audio — graf filter produksi merujuk [0:a] bila adaAudio=true
  "-f", "lavfi", "-i", "sine=frequency=440:duration=2",
  "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p",
  "-c:a", "aac", "-shortest", srcNyata,
]);
ok(r0.status === 0, "video uji 270x480 dibuat", r0.stderr?.toString());

// 1) deskripsi pojok kiri-bawah + judul + Part
const r1 = spawnSync(ff, a1.args.map((s) => s.replace(srcPalsu, srcNyata)), { timeout: 120_000 });
ok(r1.status === 0, "render dgn deskripsi SUKSES", r1.stderr?.toString().slice(-400));
ok(existsSync(keluar1) && statSync(keluar1).size > 10_000, "hasil render ada & >10 KB", existsSync(keluar1) ? statSync(keluar1).size : "tidak ada");

const pr = spawnSync(ff, ["-hide_banner", "-i", keluar1]); // tanpa -loglevel error: baris Duration = level info
ok(/Duration: 00:00:01\.2/.test(pr.stderr?.toString() || ""), "durasi hasil ≈ 1.2 dtk", (pr.stderr?.toString().match(/Duration: [^\s,]+/) || [])[0]);

// 2) tanpa deskripsi — regresi
const args2 = a2.args.map((s) => s.replace(srcPalsu, srcNyata));
const r2 = spawnSync(ff, args2, { timeout: 120_000 });
ok(r2.status === 0, "render TANPA deskripsi tetap SUKSES (regresi)", r2.stderr?.toString().slice(-300));

// 3) deskripsi multi-baris @20%/90% — teks nyata di frame
const framePng = path.join(dirTmp, "frame.png");
const r3 = spawnSync(ff, [
  "-y", "-hide_banner", "-loglevel", "error",
  "-ss", "0.5", "-i", keluar1, "-frames:v", "1", framePng,
]);
ok(r3.status === 0 && existsSync(framePng) && statSync(framePng).size > 1_000, "frame ter-ekstrak utk verifikasi visual", existsSync(framePng) ? statSync(framePng).size : "tidak ada");

console.log(`\n${lolos}/${total} lulus`);
process.exit(lolos === total ? 0 : 1);
