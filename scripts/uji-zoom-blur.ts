// Uji v0.51.0 — ZOOM MANUAL BLUR LEMBUT (mode blur, zoomBlur 100–300):
//   1) filter z=100 PERSIS seperti jalur lama (nol regresi)
//   2) filter z>100 memuat skala contain×zoom dimensi genap + overlay (W-w)*pp/100
//   3) RENDER NYATA ffmpeg: zoom 200% + posisi 30% pada video 16:9 → keluar 9:16,
//      video TAJAM mengisi tengah (melebihi lebar frame), baris atas/bawah = blur.
// Jalankan: bun scripts/uji-zoom-blur.ts
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

const OUT = path.join(process.cwd(), "work", "uji-zoom-blur");
mkdirSync(OUT, { recursive: true });

function filterDari(zoomBlur: number, posisiPotong: number, W = 1080, H = 1920): string {
  const { args } = bangunArgumenPart({
    src: "x.mp4",
    bg: null,
    pengaturan: { ...pengaturanDefault, mode: "blur", zoomBlur, posisiPotong, judul: "U" },
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
    tag: "uji-zoom-blur",
    codecArgs: ["-c:v", "libx264", "-preset", "ultrafast", "-crf", "30"],
    keluar: "/tmp/uji-zoom-blur.mp4",
  });
  return args[args.indexOf("-filter_complex") + 1];
}

// ===== 1) z=100 — jalur lama utuh =====
const f100 = filterDari(100, 30);
ok(
  f100.includes(`[isi]scale=1080:1920:force_original_aspect_ratio=decrease[isif]`),
  "z=100: skala contain lama persis",
  f100,
);
ok(f100.includes(`overlay=(W-w)/2:(H-h)/2`), "z=100: overlay tengah lama persis");
ok(!f100.includes("*(W-w)*") && !f100.includes("(W-w)*30"), "z=100: tanpa rumus geser baru");

// ===== 2) z>100 — skala contain×zoom + overlay posisi =====
const f200 = filterDari(200, 30);
ok(f200.includes("[0:v]split=2[isi][blur]"), "z=200: latar blur split", f200);
ok(
  f200.includes(`min(1080/iw,1920/ih)*2.000`),
  "z=200: skala contain×2 (bukan cover!)",
  f200,
);
ok(f200.includes(`trunc(iw*min(1080/iw,1920/ih)*2.000/2)*2`), "z=200: dimensi genap");
ok(f200.includes(`overlay=x='(W-w)*30/100':y='(H-h)/2'`), "z=200: overlay posisi 30%, tegak tengah");
// rumus SAMA dgn zoomPotong (konsisten pratinjau)
ok(!f200.includes("force_original_aspect_ratio=decrease[isif]"), "z=200: jalur contain lama tak dipakai");

// clamp angka aneh
const fAneh = filterDari(500, 200);
ok(fAneh.includes("*3.000"), "zoom 500 → clamp 3.000", fAneh);
ok(fAneh.includes("(W-w)*100/100"), "posisi 200 → clamp 100");
const fNaN = filterDari(Number.NaN, 50);
ok(
  fNaN.includes(`force_original_aspect_ratio=decrease[isif]`) && fNaN.includes(`overlay=(W-w)/2`),
  "zoom NaN → dianggap 100 (jalur lama)",
);
// zoom 150 posisi 0 = menempel kiri
const f150 = filterDari(150, 0);
ok(f150.includes("(W-w)*0/100"), "z=150 posisi 0 → x=(W-w)*0/100");

// ===== 3) RENDER NYATA =====
const sumber = path.join(OUT, "sumber-169.mp4");
const hasil = path.join(OUT, "hasil-zoom200.mp4");
if (!existsSync(sumber)) {
  const ff0 = await pilihFfmpeg();
  await jalankanFfmpeg(
    ["-y", "-hide_banner", "-v", "error", "-f", "lavfi", "-i", "testsrc2=size=640x360:rate=15:duration=2,noise=alls=60:allf=t", "-c:v", "libx264", "-preset", "ultrafast", "-crf", "23", sumber],
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
  pengaturan: { ...pengaturanDefault, mode: "blur", zoomBlur: 200, posisiPotong: 30, judul: "Uji Zoom Blur", durasiPart: 2, resolusi: "720" },
  n: 1,
  mulai: 0,
  durasi: 2,
  W: 720,
  H: 1280,
  fps: 15,
  adaAudio: false,
  judulTxt: "Uji Zoom Blur",
  partTxt: "Part 1",
  dirTmp: OUT,
  tag: "zblur200",
  codecArgs: ["-c:v", "libx264", "-preset", "ultrafast", "-crf", "30"],
  keluar: hasil,
});
await jalankanFfmpeg(args, 60, undefined, ff.bin);
ok(existsSync(hasil), "render zoom blur 200% sukses", hasil);
ok(existsSync(hasil) && statSync(hasil).size > 10_000, "hasil berukuran wajar", existsSync(hasil) ? statSync(hasil).size : 0);

// verifikasi piksel: 640x360 → 720p: contain = min(720/640,1280/360)=1.125 → 720×405,
// ×2 → 1440×810 → x=(720-1440)*0.3=-216 (kiri terpotong), y=(1280-810)/2=235.
// → baris tengah (y=640) = VIDEO TAJAM melewati seluruh lebar; baris atas (y=8) & bawah = BLUR.
// Pembeda tajam-vs-blur: GRADIEN horizontal rata-rata (blur = lembut/kecil).
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
  const gradienBaris = (y: number) => {
    let jumlah = 0;
    let n = 0;
    for (let x = 2; x < (W2 ?? 0) - 3; x += 2) {
      jumlah += Math.abs(buf[(y * (W2 ?? 0) + x + 1) * C2] - buf[(y * (W2 ?? 0) + x) * C2]);
      n += 1;
    }
    return jumlah / Math.max(1, n);
  };
  const gVideo = gradienBaris(640); // tengah → video tajam
  const gBlurAtas = gradienBaris(8); // atas → latar blur
  const gBlurBawah = gradienBaris((H2 ?? 0) - 9); // bawah → latar blur
  ok(gVideo > 4, `baris tengah = video tajam (gradien ${gVideo.toFixed(1)})`);
  ok(gBlurAtas < gVideo * 0.5, `baris atas = blur lembut (gradien ${gBlurAtas.toFixed(1)} vs ${gVideo.toFixed(1)})`);
  ok(gBlurBawah < gVideo * 0.5, `baris bawah = blur lembut (gradien ${gBlurBawah.toFixed(1)} vs ${gVideo.toFixed(1)})`);
}

console.log(`\n${lolos}/${total} uji LOLOS`);
if (lolos !== total) process.exit(1);
console.log("=== SEMUA UJI ZOOM BLUR LOLOS ===");
