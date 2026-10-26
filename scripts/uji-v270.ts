// Uji v2.7.0 — KATEGORI FRAME HIBURAN/MOVIE/DRAMA/CINEMA + GESER BEBAS VIDEO
//   1) BINGKAI_BAWAAN: 67 frame — hiburan/movie/drama/cinema MASING-MASING 10,
//      slug unik, kategori benar, semua PNG -916 & -169 ADA + dimensi benar +
//      TENGAH TRANSPARAN (video terlihat) + strip tengah 13–87% bersih di zona
//   2) migrasiSimpanan: posisiPotong lama → geserBlurX; bawaan geserBlurY=0
//   3) rapikanGeserBlur clamp −100..100
//   4) terapkanSebagian: geserBlurX/Y ikut kartu 01 ke SEMUA video
//   5) RENDER NYATA: mode blur + geser atas penuh (gy=-100, z=100) → video
//      menempel ATAS, blur di bawah; geser kanan (gx=100, z=125) → bergeser kanan
// Jalankan: bun scripts/uji-v270.ts
import { existsSync } from "node:fs";
import path from "node:path";
import { BINGKAI_BAWAAN, adalahSlugBawaan, type KategoriBingkai } from "../src/lib/vidsplit/bingkaiBawaan";
import { bangunArgumenPart, jalankanFfmpeg, pilihFfmpeg } from "../src/lib/vidsplit/ffmpeg";
import {
  migrasiSimpanan,
  pengaturanDefault,
  rapikanGeserBlur,
  terapkanSebagian,
  type Pengaturan,
} from "../src/lib/vidsplit/types";

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

console.log("1) DATA 40 FRAME KATEGORI");
{
  const hitung = (k: KategoriBingkai) => BINGKAI_BAWAAN.filter((b) => b.kategori === k).length;
  ok(BINGKAI_BAWAAN.length === 77, `total frame = 77 (nyata ${BINGKAI_BAWAAN.length})`);
  ok(hitung("hiburan") === 10, "kategori hiburan = 10");
  ok(hitung("movie") === 10, "kategori movie = 10");
  ok(hitung("drama") === 10, "kategori drama = 10");
  ok(hitung("cinema") === 10, "kategori cinema = 10");
  const slugSet = new Set(BINGKAI_BAWAAN.map((b) => b.slug));
  ok(slugSet.size === BINGKAI_BAWAAN.length, "semua slug unik");
  const baru = ["hiburan-1", "hiburan-10", "movie-5", "drama-3", "cinema-10"];
  ok(baru.every((s) => adalahSlugBawaan(s)), "slug baru dikenali adalahSlugBawaan");
  ok(adalahSlugBawaan("garis-emas") && adalahSlugBawaan("horor-alam-gaib-19"), "slug lama tetap dikenali");
  // semua PNG ada + dimensi benar
  const dimensi: Array<[string, number, number]> = [];
  for (const b of BINGKAI_BAWAAN.filter((x) => x.kategori && !["dasar", "dangdut", "horor"].includes(x.kategori))) {
    for (const [rasio, W, H] of [["916", 1080, 1920], ["169", 1920, 1080]] as const) {
      const p = path.join(process.cwd(), "public", "bingkai", `${b.slug}-${rasio}.png`);
      if (existsSync(p)) dimensi.push([p, W, H]);
    }
  }
  ok(dimensi.length === 80, `80 PNG kategori ada (nyata ${dimensi.length})`);
  const sharp = (await import("sharp")).default;
  let dimsOk = true;
  let tengahTransparan = true;
  let stripTengahBersih = true;
  for (const [p, W, H] of dimensi) {
    const meta = await sharp(p).metadata();
    if (meta.width !== W || meta.height !== H) { dimsOk = false; console.error("   dimensi salah:", p, meta.width, meta.height); }
    const raw = await sharp(p).raw().toBuffer(); // RGBA
    const ch = meta.channels ?? 4;
    // piksel tengah (y=60% tinggi, x=tengah) harus transparan penuh
    const aTengah = raw[(Math.round(H * 0.6) * W + Math.round(W / 2)) * ch + 3];
    if (aTengah !== 0) { tengahTransparan = false; console.error("   tengah tak transparan:", p, "alpha", aTengah); }
    // strip vertikal x=50% DI BAWAH zona atas: transparan penuh. Zona atas
    // semi-transparan (keluarga frame spesial — sama dgn horor v0.52): 916 berakhir
    // ±25% tinggi, 169 ±37% → ambang bawah beda per rasio.
    const frs = p.endsWith("-916.png") ? [0.32, 0.5, 0.7, 0.85] : [0.45, 0.6, 0.75, 0.85];
    for (const fr of frs) {
      const a = raw[(Math.round(H * fr) * W + Math.round(W * 0.5)) * ch + 3];
      if (a > 8) { stripTengahBersih = false; console.error("   strip tengah terisi:", p, "fr", fr, "alpha", a); }
    }
  }
  ok(dimsOk, "semua dimensi benar (916=1080×1920, 169=1920×1080)");
  ok(tengahTransparan, "tengah frame transparan (video terlihat)");
  ok(stripTengahBersih, "strip vertikal tengah bersih (hiasan hanya sisi/zona)");
}

console.log("2) MIGRASI SIMPANAN LAMA → GESER BEBAS");
{
  const m1 = migrasiSimpanan({ posisiPotong: 0 } as Partial<Pengaturan>);
  ok(m1.geserBlurX === -100, "posisiPotong 0 → geserBlurX -100", m1.geserBlurX);
  const m2 = migrasiSimpanan({ posisiPotong: 100 } as Partial<Pengaturan>);
  ok(m2.geserBlurX === 100, "posisiPotong 100 → geserBlurX +100", m2.geserBlurX);
  const m3 = migrasiSimpanan({ posisiPotong: 50 } as Partial<Pengaturan>);
  ok(m3.geserBlurX === 0 && m3.geserBlurY === 0, "posisiPotong 50 (tengah lama) → 0/0");
  const m4 = migrasiSimpanan({ geserBlurX: 40 } as Partial<Pengaturan>);
  ok(m4.geserBlurX === 40, "simpanan baru dgn geserBlurX tidak disentuh");
  const m5 = migrasiSimpanan({} as Partial<Pengaturan>);
  ok(m5.geserBlurX === 0 && m5.geserBlurY === 0, "simpanan kosong → bawaan 0/0");
}

console.log("3) RAPIKAN GESER BLUR");
{
  ok(rapikanGeserBlur(40) === 40, "nilai normal utuh");
  ok(rapikanGeserBlur(250) === 100, "250 → clamp 100");
  ok(rapikanGeserBlur(-250) === -100, "-250 → clamp -100");
  ok(rapikanGeserBlur(Number.NaN) === 0, "NaN → 0");
  ok(rapikanGeserBlur(Number.NaN, -50) === -50, "NaN → bawaan -50");
}

console.log("4) TERAPKAN KE SEMUA (kartu 01 ikut)");
{
  const sumber: Pengaturan = { ...pengaturanDefault, geserBlurX: -60, geserBlurY: 30 };
  const target: Pengaturan = { ...pengaturanDefault };
  const hasil = terapkanSebagian(sumber, target);
  ok(hasil.geserBlurX === -60 && hasil.geserBlurY === 30, "geserBlurX/Y tersalin ke target");
}

console.log("5) FILTER MODE BLUR MEMAKAI GESER BEBAS");
function filterDari(parsial: Partial<Pengaturan>, W = 1080, H = 1920): string {
  const { args } = bangunArgumenPart({
    src: "x.mp4",
    bg: null,
    pengaturan: { ...pengaturanDefault, mode: "blur", judul: "U", ...parsial },
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
    tag: "uji-v270",
    codecArgs: ["-c:v", "libx264", "-preset", "ultrafast", "-crf", "30"],
    keluar: "/tmp/uji-v270.mp4",
  });
  return args[args.indexOf("-filter_complex") + 1];
}
{
  const f = filterDari({ geserBlurX: -100, geserBlurY: 100, zoomBlur: 125 });
  ok(f.includes("overlay=x='(W-w)/2*(1+-100/100)':y='(H-h)/2*(1+100/100)'"), "rumus overlay geser bebas", f.slice(-260));
  const f2 = filterDari({});
  ok(f2.includes("overlay=x='(W-w)/2*(1+0/100)':y='(H-h)/2*(1+0/100)'"), "bawaan 0/0 = tengah (nol regresi)");
}

console.log("6) RENDER NYATA GESER BEBAS");
const OUT = path.join(process.cwd(), "work", "uji-v270");
{
  const { mkdirSync } = await import("node:fs");
  mkdirSync(OUT, { recursive: true });
  const sumber = path.join(OUT, "sumber-169.mp4");
  if (!existsSync(sumber)) {
    const ff0 = await pilihFfmpeg();
    await jalankanFfmpeg(
      ["-y", "-hide_banner", "-v", "error", "-f", "lavfi", "-i", "testsrc2=size=640x360:rate=15:duration=2", "-c:v", "libx264", "-preset", "ultrafast", "-crf", "23", sumber],
      20,
      undefined,
      ff0.bin,
    );
  }
  ok(existsSync(sumber), "video sumber 16:9 tersedia");
  const ff = await pilihFfmpeg();
  const sharp = (await import("sharp")).default;

  // A) geser ATAS penuh (gy=-100, zoom 100): video menempel atas, bawah blur
  const hasilA = path.join(OUT, "geser-atas.mp4");
  {
    const { args } = bangunArgumenPart({
      src: sumber,
      bg: null,
      pengaturan: { ...pengaturanDefault, mode: "blur", geserBlurY: -100, judul: "Geser Atas", durasiPart: 2 },
      n: 1, mulai: 0, durasi: 2, W: 720, H: 1280, fps: 15, adaAudio: false,
      judulTxt: "Geser Atas", partTxt: "Part 1", dirTmp: OUT, tag: "v270a",
      codecArgs: ["-c:v", "libx264", "-preset", "ultrafast", "-crf", "30"], keluar: hasilA,
    });
    await jalankanFfmpeg(args, 60, undefined, ff.bin);
    ok(existsSync(hasilA), "render geser atas sukses");
    const png = path.join(OUT, "a.png");
    await jalankanFfmpeg(["-y", "-hide_banner", "-v", "error", "-ss", "1", "-i", hasilA, "-frames:v", "1", png], 20, undefined, ff.bin);
    const buf = await sharp(png).raw().toBuffer();
    const meta = await sharp(png).metadata();
    const W2 = meta.width ?? 0;
    const C2 = meta.channels ?? 3;
    // video contain 16:9 di 720x1280 → tinggi 405. gy=-100 → menempel atas (y=0).
    // baris y=100 = video; y=1200 = blur latar
    const variasi = (y: number) => {
      let mn = 255, mx = 0;
      for (let x = 40; x < W2 - 40; x += 4) { const v = buf[(y * W2 + x) * C2]; if (v < mn) mn = v; if (v > mx) mx = v; }
      return mx - mn;
    };
    ok(variasi(100) > 30, "baris atas = video (variasi warna tinggi)", variasi(100));
    ok(variasi(1200) < variasi(100), "baris bawah = latar blur (lebih datar)", variasi(1200));
  }

  // B) geser KANAN penuh (gx=100, zoom 125): video bergeser kanan
  const hasilB = path.join(OUT, "geser-kanan.mp4");
  {
    const { args } = bangunArgumenPart({
      src: sumber,
      bg: null,
      pengaturan: { ...pengaturanDefault, mode: "blur", geserBlurX: 100, zoomBlur: 125, judul: "Geser Kanan", durasiPart: 2 },
      n: 1, mulai: 0, durasi: 2, W: 720, H: 1280, fps: 15, adaAudio: false,
      judulTxt: "Geser Kanan", partTxt: "Part 1", dirTmp: OUT, tag: "v270b",
      codecArgs: ["-c:v", "libx264", "-preset", "ultrafast", "-crf", "30"], keluar: hasilB,
    });
    await jalankanFfmpeg(args, 60, undefined, ff.bin);
    ok(existsSync(hasilB), "render geser kanan sukses");
    const png = path.join(OUT, "b.png");
    await jalankanFfmpeg(["-y", "-hide_banner", "-v", "error", "-ss", "1", "-i", hasilB, "-frames:v", "1", png], 20, undefined, ff.bin);
    // video 720x405×1.25=900×506 → gx=100 → x=(720-900)/2*2=-90 (geser kanan penuh)
    // kolom kiri (x=20, y=640) harus LATAR (datar); kolom kanan (x=700) = VIDEO
    const bufB = await sharp(png).raw().toBuffer();
    const metaB = await sharp(png).metadata();
    const W3 = metaB.width ?? 0;
    const C3 = metaB.channels ?? 3;
    const variasiKolom = (x: number) => {
      let mn = 255, mx = 0;
      for (let y = 400; y < 900; y += 4) { const v = bufB[(y * W3 + x) * C3]; if (v < mn) mn = v; if (v > mx) mx = v; }
      return mx - mn;
    };
    ok(variasiKolom(700) > 30, "kolom kanan = video setelah geser kanan", variasiKolom(700));
    ok(variasiKolom(20) < variasiKolom(700), "kolom kiri = latar blur", variasiKolom(20));
  }
}

console.log(`\n${lolos}/${total} uji LOLOS`);
if (lolos !== total) process.exit(1);
console.log("=== SEMUA UJI v2.7.0 LOLOS ===");
