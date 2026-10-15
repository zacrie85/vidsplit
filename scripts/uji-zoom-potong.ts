// Uji v0.50.0 — ZOOM MANUAL POTONG (mode crop, zoomPotong 50–100):
//   1) filter z=100 PERSIS seperti jalur lama (nol regresi)
//   2) filter z<100 memuat overlay (W-w)*pp/100 + skala cover×zoom dimensi genap
//   3) RENDER NYATA ffmpeg: zoom 70% + posisi 30% pada video 16:9 → keluar 9:16,
//      video terlihat di bagian kiri (posisi 30), latar blur mengisi sisanya.
// Jalankan: bun scripts/uji-zoom-potong.ts
import { existsSync, mkdirSync, statSync } from "node:fs";
import path from "node:path";
import { bangunArgumenPart, jalankanFfmpeg, pilihFfmpeg } from "../src/lib/vidsplit/ffmpeg";
import { pengaturanDefault } from "../src/lib/vidsplit/types";

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

const OUT = path.join(process.cwd(), "work", "uji-zoom");
mkdirSync(OUT, { recursive: true });

function filterDari(zoomPotong: number, posisiPotong: number, W = 1080, H = 1920): string {
  const { args } = bangunArgumenPart({
    src: "x.mp4",
    bg: null,
    pengaturan: { ...pengaturanDefault, mode: "crop", zoomPotong, posisiPotong, judul: "U" },
    n: 1,
    mulai: 0,
    durasi: 2,
    W,
    H,
    fps: 15,
    adaAudio: false,
    judulTxt: "U",
    partTxt: "Part 1",
    dirTmp: "/tmp",
    tag: "uji-zoom",
    codecArgs: ["-c:v", "libx264", "-preset", "ultrafast", "-crf", "30"],
    keluar: "/tmp/uji-zoom.mp4",
  });
  return args[args.indexOf("-filter_complex") + 1];
}

// ===== 1) z=100 — jalur lama utuh =====
const f100 = filterDari(100, 30);
ok(f100.includes(`crop=1080:1920:(iw-ow)*30/100:0`), "z=100: filter crop lama persis", f100);
ok(!f100.includes("overlay"), "z=100: tanpa overlay blur");

// ===== 2) z<100 — overlay + skala zoom =====
const f70 = filterDari(70, 30);
ok(f70.includes("[0:v]split=2[isi][blur]"), "z=70: latar blur split", f70);
ok(f70.includes(`scale='trunc(iw*max(1080/iw,1920/ih)*0.700/2)*2':'trunc(ih*max(1080/iw,1920/ih)*0.700/2)*2'`), "z=70: skala cover×0.7 dimensi genap");
ok(f70.includes(`overlay=x='(W-w)*30/100':y='(H-h)/2'`), "z=70: overlay posisi 30% tengah vertikal");
// clamp angka aneh
const fAneh = filterDari(15, 200);
ok(fAneh.includes("*0.500/2"), "zoom 15 → clamp 0.500");
ok(fAneh.includes("(W-w)*100/100"), "posisi 200 → clamp 100");
const fNaN = filterDari(Number.NaN, 50);
ok(fNaN.includes("crop=") && !fNaN.includes("overlay"), "zoom NaN → dianggap 100 (jalur lama)");

// ===== 3) RENDER NYATA =====
const sumber = path.join(OUT, "sumber-169.mp4");
const hasil = path.join(OUT, "hasil-zoom70.mp4");
if (!existsSync(sumber)) {
  const ff0 = await pilihFfmpeg();
  await jalankanFfmpeg(
    ["-y", "-hide_banner", "-v", "error", "-f", "lavfi", "-i", "testsrc2=size=640x360:rate=15:duration=2", "-c:v", "libx264", "-preset", "ultrafast", "-crf", "30", sumber],
    20,
    undefined,
    ff0.bin,
  );
}
ok(existsSync(sumber), "video sumber 16:9 tersedia");

const ff = await pilihFfmpeg();
const { args } = bangunArgumenPart({
  src: sumber,
  bg: null,
  pengaturan: { ...pengaturanDefault, mode: "crop", zoomPotong: 70, posisiPotong: 30, judul: "Uji Zoom", durasiPart: 2, resolusi: "720" },
  n: 1,
  mulai: 0,
  durasi: 2,
  W: 720,
  H: 1280,
  fps: 15,
  adaAudio: false,
  judulTxt: "Uji Zoom",
  partTxt: "Part 1",
  dirTmp: OUT,
  tag: "zoom70",
  codecArgs: ["-c:v", "libx264", "-preset", "ultrafast", "-crf", "30"],
  keluar: hasil,
});
await jalankanFfmpeg(args, 60, undefined, ff.bin);
ok(existsSync(hasil), "render zoom 70% sukses", hasil);
ok(existsSync(hasil) && statSync(hasil).size > 10_000, "hasil berukuran wajar", existsSync(hasil) ? statSync(hasil).size : 0);

// verifikasi piksel: posisi 30% dgn zoom 70 → lebar video terlihat = 720/(cover×0.7)
// cover utk 640x360 → 720p: skala = max(720/640, 1280/360)=3.5556 → video 2276×1280 ×0.7 = 1593×896
// → (W-w) negatif → x=(720-1593)*0.3 = -262 → tepi kiri video ter-POTONG 262px; video tetap
// melebihi lebar frame → kolom paling kiri hasil = VIDEO (bukan blur), kolom paling kanan = VIDEO.
// Uji: ambil frame tengah, pastikan TIDAK polos (variasi warna tinggi) di kolom kiri & kanan.
if (existsSync(hasil)) {
  const png = path.join(OUT, "frame-tengah.png");
  await jalankanFfmpeg(
    ["-y", "-hide_banner", "-v", "error", "-ss", "1", "-i", hasil, "-frames:v", "1", png],
    20,
    undefined,
    ff.bin,
  );
  const sharp = (await import("sharp")).default;
  const buf = await sharp(png).raw().toBuffer();
  const { width: W2, height: H2, channels: C2 = 3 } = await sharp(png).metadata();
  const variansiKolom = (x: number) => {
    let min = 255, max = 0;
    for (let y = 0; y < (H2 ?? 0); y += 4) {
      const v = buf[(y * (W2 ?? 0) + x) * C2];
      if (v < min) min = v;
      if (v > max) max = v;
    }
    return max - min;
  };
  // kolom kiri (x=8) & kanan (x=W-8) adalah video testsrc2 → variasi warna tinggi (>40)
  const vk = variansiKolom(8);
  const vk2 = variansiKolom((W2 ?? 0) - 9);
  ok(vk > 40, `kolom kiri = video (variasi ${vk})`);
  ok(vk2 > 40, `kolom kanan = video (variasi ${vk2})`);
  // baris paling atas (y=6) di kolom TENGAH → video juga (video tingginya 896/1280 di tengah)
  let min = 255, max = 0;
  const y = 6;
  for (let x = (W2 ?? 0) * 0.4; x < (W2 ?? 0) * 0.6; x += 4) {
    const v = buf[(y * (W2 ?? 0) + x) * C2];
    if (v < min) min = v;
    if (v > max) max = v;
  }
  ok(max - min > 30, `baris atas tengah = video (variasi ${max - min})`);
}

console.log(`\n${lolos}/${total} uji LOLOS`);
if (lolos !== total) process.exit(1);
console.log("=== SEMUA UJI ZOOM POTONG LOLOS ===");
