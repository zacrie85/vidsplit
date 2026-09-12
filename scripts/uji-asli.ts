// Uji unit v0.7.0 — mode "Video original" (asli):
//   pastikan rantai filter TIDAK mengubah rasio (tanpa crop/pad/boxblur ke 9:16),
//   ukuran output = dimensi sumber (digenapkan oleh jobs.ts), teks tetap digambar,
//   dan mode lama (blur/crop/warna) tidak berubah (regresi).
// Jalankan: bun scripts/uji-asli.ts
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { bangunArgumenPart } from "../src/lib/vidsplit/ffmpeg";
import type { Pengaturan } from "../src/lib/vidsplit/types";

let lolos = 0;
let gagalN = 0;
function cek(nama: string, kondisi: boolean, detail?: string) {
  if (kondisi) {
    lolos++;
    console.log(`  ✓ ${nama}`);
  } else {
    gagalN++;
    console.error(`  ✗ ${nama}${detail ? ` — ${detail}` : ""}`);
  }
}

const dirTmp = mkdtempSync(path.join(os.tmpdir(), "uji-asli-"));
const SRC = path.join("/home/z/my-project/vidsplit/work/sample", "uji-a.mp4");

function buat(parsial: Partial<Pengaturan>): Pengaturan {
  return {
    mode: "asli",
    warnaLatar: "#111827",
    judul: "Uji Asli",
    gayaJudul: { font: "tebal", ukuran: 64, warna: "#ffffff", outlineLebar: 4, outlineWarna: "#000000" },
    kataPart: "Part",
    gayaPart: { font: "tebal", ukuran: 48, warna: "#fbbf24", outlineLebar: 3, outlineWarna: "#000000" },
    durasiPart: 3,
    bgId: "",
    durasiIntro: 1,
    resolusi: "1080", // sengaja 1080 — harus DIABAIKAN saat mode asli
    posisiTeks: "atas",
    posisiPotong: 50,
    mulaiDetik: 0,
    akhirDetik: 0,
    codec: "h264",
    logoId: "",
    posisiLogo: "kanan-bawah",
    ukuranLogo: 15,
    prosesParalel: 2,
    pakaiGpu: false,
    ...parsial,
  };
}

function bangun(p: Pengaturan, W: number, H: number, bg: string | null = null) {
  const { args, total } = bangunArgumenPart({
    src: SRC,
    bg,
    logo: null,
    pengaturan: p,
    n: 1,
    mulai: 0,
    durasi: 3,
    W,
    H,
    fps: 25,
    adaAudio: true,
    judulTxt: p.judul,
    partTxt: "Part 1",
    dirTmp,
    tag: "uji-asli",
    codecArgs: ["-c:v", "libx264", "-preset", "ultrafast", "-crf", "23"],
    keluar: path.join(dirTmp, "keluar.mp4"),
  });
  const i = args.indexOf("-filter_complex");
  return { filter: args[i + 1] ?? "", total, args };
}

console.log("A) asli landscape 640x360 — tanpa bg:");
{
  const { filter, total } = bangun(buat({}), 640, 360);
  cek("utama: [0:v]scale=640:360 langsung (tanpa force rasio)", /\[0:v\]scale=640:360,fps=/.test(filter));
  cek("tanpa crop 9:16", !/crop=640:360/.test(filter), "tidak boleh ada crop");
  cek("tanpa pad", !/pad=/.test(filter));
  cek("tanpa boxblur", !/boxblur/.test(filter));
  cek("teks tetap digambar (drawtext)", /drawtext/.test(filter));
  // skala teks = sisi terpendek: min(640,360)/1080 = 1/3 → judul 64 → 21.3
  cek("fontsize proporsional sisi terpendek (21.3)", /fontsize=21\.3/.test(filter), filter.slice(0, 200));
  cek("total = durasi part (tanpa intro)", total === 3, `total=${total}`);
}

console.log("B) asli vertikal 1080x1920 — skala teks identik perilaku lama:");
{
  const { filter } = bangun(buat({}), 1080, 1920);
  cek("utama: [0:v]scale=1080:1920", /\[0:v\]scale=1080:1920,fps=/.test(filter));
  cek("fontsize 64.0 (skala = 1, regresi vertikal)", /fontsize=64\.0/.test(filter));
}

console.log("C) asli + background intro — bg mengisi frame seukuran sumber:");
{
  const { filter, total } = bangun(buat({ bgId: "bg" }), 640, 360, "/home/z/my-project/vidsplit/work/sample/bg-kuning.png");
  cek("bg: scale increase ke 640x360", /\[1:v\]scale=640:360:force_original_aspect_ratio=increase/.test(filter));
  cek("utama tetap tanpa konversi rasio", /\[0:v\]scale=640:360,fps=/.test(filter));
  cek("concat bg+utama", /concat=n=2:v=1:a=0/.test(filter));
  cek("total = intro + durasi", total === 4, `total=${total}`);
}

console.log("D) regresi mode lama (1080x1920):");
{
  const blur = bangun(buat({ mode: "blur" }), 1080, 1920);
  cek("blur: masih ada boxblur", /boxblur=24:2/.test(blur.filter));
  cek("blur: tetap scale increase+decrease", /force_original_aspect_ratio=increase/.test(blur.filter));
  const crop = bangun(buat({ mode: "crop" }), 1080, 1920);
  cek("crop: masih scale increase + crop", /force_original_aspect_ratio=increase,crop=1080:1920/.test(crop.filter));
  const warna = bangun(buat({ mode: "warna" }), 1080, 1920);
  cek("warna: masih pad", /pad=1080:1920/.test(warna.filter));
}

console.log(`\n=== ${lolos} LOLOS, ${gagalN} GAGAL ===`);
process.exit(gagalN ? 1 : 0);
