// Uji unit v0.8.0 — watermark posisi BEBAS + default font baru:
//   (a) default font judul = 40, Part = 35 (permintaan user)
//   (b) filter overlay memakai logoX/logoY % frame dgn clamp aman
//   (c) POSISI_LOGO_PRESET 4 pojok mengisi logoX/logoY dengan benar
//   (d) regresi: tanpa logo tetap rantai teks biasa; ukuran logo tetap 5–40%
// Jalankan: bun scripts/uji-logo-bebas.ts
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { bangunArgumenPart } from "../src/lib/vidsplit/ffmpeg";
import {
  pengaturanDefault,
  POSISI_LOGO_PRESET,
  type Pengaturan,
  type PosisiLogo,
} from "../src/lib/vidsplit/types";

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

const dirTmp = mkdtempSync(path.join(os.tmpdir(), "uji-logo-"));
const SRC = "/home/z/my-project/vidsplit/work/sample/uji-a.mp4";
const LOGO = "/home/z/my-project/vidsplit/work/sample/bg-kuning.png";

function buat(parsial: Partial<Pengaturan>): Pengaturan {
  return { ...pengaturanDefault, ...parsial };
}

function bangun(p: Pengaturan, W: number, H: number) {
  const { args } = bangunArgumenPart({
    src: SRC,
    bg: null,
    logo: p.logoId ? LOGO : null, // ikuti pengaturan — logoId kosong = tanpa watermark
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
    tag: "uji-logo",
    codecArgs: ["-c:v", "libx264", "-preset", "ultrafast", "-crf", "23"],
    keluar: path.join(dirTmp, "keluar.mp4"),
  });
  const i = args.indexOf("-filter_complex");
  return { filter: args[i + 1] ?? "", args };
}

console.log("\n════ FITUR 4 — default font judul 40 / Part 35 ════");
cek("gayaJudul.ukuran default = 40", pengaturanDefault.gayaJudul.ukuran === 40, `ada ${pengaturanDefault.gayaJudul.ukuran}`);
cek("gayaPart.ukuran default = 35", pengaturanDefault.gayaPart.ukuran === 35, `ada ${pengaturanDefault.gayaPart.ukuran}`);

console.log("\n════ FITUR 2 — posisi bebas watermark ════");
cek("default logoX = 81.5 (≈ kanan-bawah lama)", pengaturanDefault.logoX === 81.5, `ada ${pengaturanDefault.logoX}`);
cek("default logoY = 88.5", pengaturanDefault.logoY === 88.5, `ada ${pengaturanDefault.logoY}`);

const presetBenar: Record<PosisiLogo, [number, number]> = {
  "kiri-atas": [3.5, 3],
  "kanan-atas": [81.5, 3],
  "kiri-bawah": [3.5, 88.5],
  "kanan-bawah": [81.5, 88.5],
};
for (const [k, [x, y]] of Object.entries(presetBenar) as [PosisiLogo, [number, number]][]) {
  const p = POSISI_LOGO_PRESET[k];
  cek(`preset ${k} = (${x}, ${y})`, p.x === x && p.y === y, `ada (${p.x}, ${p.y})`);
}

// posisi default → ekspresi overlay dgn 81.5/88.5
const fDefault = bangun(buat({ logoId: "logo.png" }), 1080, 1920).filter;
cek(
  "overlay memakai W*81.5/100 & H*88.5/100 (default)",
  fDefault.includes("W*81.5/100") && fDefault.includes("H*88.5/100"),
  fDefault,
);

// posisi kustom → angka ikut berubah
const fKustom = bangun(buat({ logoId: "logo.png", logoX: 25.5, logoY: 60 }), 1080, 1920).filter;
cek(
  "overlay ikut logoX=25.5 & logoY=60 kustom",
  fKustom.includes("W*25.5/100") && fKustom.includes("H*60/100"),
  fKustom,
);

// clamp: nilai di luar 0–100 dijepit sebelum masuk filter
const fClamp = bangun(buat({ logoId: "logo.png", logoX: 150, logoY: -20 }), 1080, 1920).filter;
cek(
  "logoX=150 → dijepit ke 100; logoY=-20 → dijepit ke 0",
  fClamp.includes("W*100/100") && fClamp.includes("H*0/100") && !fClamp.includes("W*150"),
  fClamp,
);

// pojok tetap aman walau ukuran logo besar — min(...,W-w) menjaga di dalam frame
const fBesar = bangun(buat({ logoId: "logo.png", logoX: 95, logoY: 95, ukuranLogo: 40 }), 1080, 1920).filter;
cek(
  "ekspresi min(max(0,…),W-w)/min(max(0,…),H-h) ada (logo tak keluar frame)",
  fBesar.includes("min(max(0,W*95/100),W-w)") && fBesar.includes("min(max(0,H*95/100),H-h)"),
  fBesar,
);

// ukuran logo 15% @1080 → scale 162
cek("scale logo 15% dari 1080 = 162", fDefault.includes("scale=162:-1"), fDefault);

// ukuran logo di luar 5–40 dijepit
const fKecil = bangun(buat({ logoId: "logo.png", ukuranLogo: 2 }), 1080, 1920).filter;
cek("ukuranLogo=2 → dijepit ke 5% (scale=54)", fKecil.includes("scale=54:-1"), fKecil);

console.log("\n════ REGRESI ════");
// tanpa logo → tidak ada overlay, teks tetap digambar
const pTanpa = buat({ logoId: "" });
const { filter: fTanpa, args: aTanpa } = bangun(pTanpa, 1080, 1920);
cek("tanpa logo → tanpa overlay watermark (label [wmf])", !fTanpa.includes("[wmf]"), fTanpa);
cek("tanpa logo → rantai teks tetap ada (drawtext)", aTanpa.some((a) => a.includes("drawtext") || a === "subtitle" || a.startsWith("fontsdir") || a.includes(".txt")), aTanpa.join(" "));

// mode lain tidak berubah oleh fitur logo (blur tetap ada boxblur)
const fBlur = bangun(buat({ logoId: "logo.png", mode: "blur" }), 1080, 1920).filter;
cek("mode blur tetap punya boxblur", fBlur.includes("boxblur"), fBlur);

console.log(`\n════ HASIL: ${lolos} lolos, ${gagalN} gagal ════`);
process.exit(gagalN ? 1 : 0);
