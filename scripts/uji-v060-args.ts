// Uji unit bangunArgumenPart v0.6.0: fontfile 18 font, overlay logo, idx input,
// codec args. Jalankan: bun scripts/uji-v060-args.ts
import { bangunArgumenPart, dirFontKandidat } from "../src/lib/vidsplit/ffmpeg";
import {
  FONT_DASAR,
  INFO_FONT,
  pengaturanDefault,
  type NamaFont,
} from "../src/lib/vidsplit/types";
import { existsSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

// file nyata untuk guard existsSync di bangunArgumenPart
const LOGO = "/tmp/uji-logo-nyata.png";
const BG = "/tmp/uji-bg-nyata.png";
if (!existsSync(LOGO)) {
  execFileSync("ffmpeg", ["-y", "-v", "error", "-f", "lavfi", "-i", "color=c=magenta:s=200x200", "-frames:v", "1", LOGO]);
}
if (!existsSync(BG)) {
  execFileSync("ffmpeg", ["-y", "-v", "error", "-f", "lavfi", "-i", "color=c=yellow:s=1080x1920", "-frames:v", "1", BG]);
}

/** gabungkan argumen jadi satu string supaya mudah dicari (filter = 1 elemen panjang) */
const gabung = (args: string[]) => args.join("\u0001");
/** cari path fontfile dari argumen gabungan — bentuk: fontfile='...'/fontfile=... */
function cariFontfile(filterGabung: string): string {
  const m = filterGabung.match(/fontfile=([^\u0001;]+?)(?=[\u0001;]|$|:(?=\w+=))/);
  if (!m) return "";
  return m[1].replace(/^'/, "").replace(/'$/, "").replace(/\\:/g, ":").replace(/\\'/g, "'");
}

let lulus = 0;
let gagal = 0;
const cek = (k: boolean, label: string, detail = "") => {
  if (k) {
    lulus++;
    console.log(`  [LOLOS] ${label}`);
  } else {
    gagal++;
    console.error(`  [GAGAL] ${label} ${detail}`);
  }
};

const dasar = {
  ...pengaturanDefault,
  judul: "Uji Judul",
  kataPart: "Part",
  durasiPart: 3,
};

// 1) fontfile untuk SEMUA font (3 bawaan + 15 sinematik) ditemukan
console.log("\n== FONTFILE SEMUA FONT ==");
const semuaFont = Object.keys(INFO_FONT) as NamaFont[];
for (const f of semuaFont) {
  const { args } = bangunArgumenPart({
    src: "/tmp/x.mp4",
    bg: null,
    logo: null,
    pengaturan: {
      ...dasar,
      gayaJudul: { font: f, ukuran: 60, warna: "#ffffff", outlineLebar: 2, outlineWarna: "#000000" },
      gayaPart: { font: f, ukuran: 50, warna: "#ffffff", outlineLebar: 2, outlineWarna: "#000000" },
    },
    n: 1,
    mulai: 0,
    durasi: 3,
    W: 720,
    H: 1280,
    fps: 30,
    adaAudio: true,
    judulTxt: "Uji",
    partTxt: "Part 1",
    dirTmp: "/tmp",
    tag: "uji",
    codecArgs: ["-c:v", "libx264", "-crf", "23"],
    keluar: "/tmp/out.mp4",
  });
  const filterGabung = gabung(args);
  const fontfile = cariFontfile(filterGabung);
  const ada = !!fontfile && existsSync(fontfile);
  cek(ada, `font "${f}" → ${fontfile || "(tidak ada fontfile!)"}`);
}

// 2) logo overlay: idx input benar (tanpa bg = 2, dgn bg = 3), posisi & skala
console.log("\n== OVERLAY LOGO ==");
const pengaturanLogo = {
  ...dasar,
  logoId: "upload/logo.png",
  posisiLogo: "kanan-atas" as const,
  ukuranLogo: 20,
};
const tanpaBg = bangunArgumenPart({
  src: "/tmp/x.mp4",
  bg: null,
  logo: LOGO,
  pengaturan: pengaturanLogo,
  n: 1,
  mulai: 0,
  durasi: 3,
  W: 720,
  H: 1280,
  fps: 30,
  adaAudio: true,
  judulTxt: "Uji",
  partTxt: "Part 1",
  dirTmp: "/tmp",
  tag: "uji2",
  codecArgs: ["-c:v", "libx264"],
  keluar: "/tmp/out.mp4",
});
const filterTanpa = tanpaBg.args[tanpaBg.args.indexOf("-filter_complex") + 1];
cek(filterTanpa.includes("[2:v]scale=144:"), "logo idx=2 saat tanpa bg (scale 20% dari 720)", filterTanpa.match(/\[\d+:v\]scale=\d+/)?.[0]);
cek(filterTanpa.includes("[vtx][wmf]overlay=x=W-w-"), "posisi kanan-atas benar");
cek(tanpaBg.args.includes("-loop"), "dgn logo → ada -loop utk input logo");
const idxI1 = tanpaBg.args.reduce<number[]>((acc, a, i) => (a === "-i" ? [...acc, i] : acc), []);
cek(tanpaBg.args[idxI1[idxI1.length - 1] + 1] === LOGO, "input logo paling akhir (tanpa bg)");

const dgnBg = bangunArgumenPart({
  src: "/tmp/x.mp4",
  bg: BG,
  logo: LOGO,
  pengaturan: { ...pengaturanLogo, durasiIntro: 2 },
  n: 1,
  mulai: 0,
  durasi: 3,
  W: 720,
  H: 1280,
  fps: 30,
  adaAudio: true,
  judulTxt: "Uji",
  partTxt: "Part 1",
  dirTmp: "/tmp",
  tag: "uji3",
  codecArgs: ["-c:v", "libx264"],
  keluar: "/tmp/out.mp4",
});
const filterDgn = dgnBg.args[dgnBg.args.indexOf("-filter_complex") + 1];
cek(filterDgn.includes("[3:v]scale=144:"), "logo idx=3 saat dgn bg");
// urutan input: src, bg, anullsrc, logo → -i logo harus SETELAH -i anullsrc
const iTerakhir = dgnBg.args.reduce<number[]>((acc, a, i) => (a === "-i" ? [...acc, i] : acc), []);
cek(dgnBg.args[iTerakhir[3] + 1] === LOGO, "input logo paling akhir (indeks -i ke-4)");
cek(dgnBg.total === 5, "total = durasiIntro + durasi (2+3)", String(dgnBg.total));

// 3) codec h265 CPU
console.log("\n== CODEC H.265 ==");
const { codecCpu } = await import("../src/lib/vidsplit/ffmpeg");
const h265 = codecCpu("medium", 20, "h265");
cek(h265.includes("libx265"), "codecCpu h265 = libx265", h265.join(" "));
cek(h265.includes("hvc1"), "tag hvc1 ada (kompatibel Apple)");
const h264 = codecCpu("medium", 20, "h264");
cek(h264.includes("libx264"), "codecCpu h264 = libx264");

// 4) daftar folder font (untuk /api/font & drawtext)
console.log("\n== DIR FONT ==");
const dirs = dirFontKandidat();
console.log("  kandidat:", dirs.join(" | "));
cek(dirs.length > 0, "ada kandidat folder font");
const adaAnton = dirs.some((d) => existsSync(path.join(d, "Anton.ttf")));
cek(adaAnton, "Anton.ttf ditemukan di salah satu kandidat");

console.log(`\n===== HASIL: ${lulus} lolos, ${gagal} gagal =====`);
process.exit(gagal ? 1 : 0);
