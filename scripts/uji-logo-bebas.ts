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
  migrasiSimpanan,
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

console.log("\n════ FITUR 4 — default ukuran judul 35 / Part 30 (v0.40.0) ════");
cek("gayaJudul.ukuran default = 35", pengaturanDefault.gayaJudul.ukuran === 35, `ada ${pengaturanDefault.gayaJudul.ukuran}`);
cek("gayaPart.ukuran default = 30", pengaturanDefault.gayaPart.ukuran === 30, `ada ${pengaturanDefault.gayaPart.ukuran}`);
// v0.9.2 — default font Cinzel Decorative utk menu 2 & 3 (permintaan user)
cek("gayaJudul.font default = cinzeldec (Cinzel Decorative)", pengaturanDefault.gayaJudul.font === "cinzeldec", `ada ${pengaturanDefault.gayaJudul.font}`);
cek("gayaPart.font default = cinzeldec (Cinzel Decorative)", pengaturanDefault.gayaPart.font === "cinzeldec", `ada ${pengaturanDefault.gayaPart.font}`);

console.log("\n════ v0.40.0 — migrasiSimpanan (ukuran bawaan lama → baru) ════");
{
  // simpanan instalasi LAMA = seluruh bawaan lama (judul 40, Part 35, deskripsi 28)
  const lama = migrasiSimpanan({
    ...pengaturanDefault,
    gayaJudul: { font: "tebal", ukuran: 40, warna: "#ffffff", outlineLebar: 4, outlineWarna: "#000000" },
    gayaPart: { font: "cinzeldec", ukuran: 35, warna: "#fbbf24", outlineLebar: 3, outlineWarna: "#000000" },
    gayaDeskripsi: { font: "bersih", ukuran: 28, warna: "#ffffff", outlineLebar: 3, outlineWarna: "#000000" },
  });
  cek("judul bawaan lama 40 → 35", lama.gayaJudul?.ukuran === 35, `ada ${lama.gayaJudul?.ukuran}`);
  cek("Part bawaan lama 35 → 30", lama.gayaPart?.ukuran === 30, `ada ${lama.gayaPart?.ukuran}`);
  cek("deskripsi bawaan lama 28 → 23", lama.gayaDeskripsi?.ukuran === 23, `ada ${lama.gayaDeskripsi?.ukuran}`);
  cek("font 'tebal' ikut dimigrasi → cinzeldec", lama.gayaJudul?.font === "cinzeldec", `ada ${lama.gayaJudul?.font}`);

  // nilai khas user TIDAK disentuh
  const khas = migrasiSimpanan({
    gayaJudul: { font: "anton", ukuran: 64, warna: "#ff0000", outlineLebar: 2, outlineWarna: "#000000" },
    gayaPart: { font: "bebas", ukuran: 52, warna: "#ffffff", outlineLebar: 3, outlineWarna: "#000000" },
    gayaDeskripsi: { font: "klasik", ukuran: 31, warna: "#00ff00", outlineLebar: 1, outlineWarna: "#000000" },
  });
  cek("judul khas 64 tetap 64", khas.gayaJudul?.ukuran === 64, `ada ${khas.gayaJudul?.ukuran}`);
  cek("Part khas 52 tetap 52", khas.gayaPart?.ukuran === 52, `ada ${khas.gayaPart?.ukuran}`);
  cek("deskripsi khas 31 tetap 31", khas.gayaDeskripsi?.ukuran === 31, `ada ${khas.gayaDeskripsi?.ukuran}`);
  cek("font khas tetap (anton/bebas/klasik)", khas.gayaJudul?.font === "anton" && khas.gayaPart?.font === "bebas" && khas.gayaDeskripsi?.font === "klasik", "font khas berubah!");

  // judul 35 (khas dlm instalasi lama) tak tersentuh — bukan 40, bukan target migrasi
  const j35 = migrasiSimpanan({ gayaJudul: { font: "cinzeldec", ukuran: 35, warna: "#ffffff", outlineLebar: 4, outlineWarna: "#000000" } });
  cek("judul 35 (khas lama) tetap 35", j35.gayaJudul?.ukuran === 35, `ada ${j35.gayaJudul?.ukuran}`);

  // murni: input tidak berubah
  const masuk: Partial<Pengaturan> = { gayaJudul: { font: "tebal", ukuran: 40, warna: "#ffffff", outlineLebar: 4, outlineWarna: "#000000" } };
  migrasiSimpanan(masuk);
  cek("input migrasi tidak diubah (murni)", masuk.gayaJudul?.ukuran === 40 && masuk.gayaJudul?.font === "tebal", "input berubah — tidak murni!");

  // simpanan kosong aman
  const kosong = migrasiSimpanan({});
  cek("simpanan kosong → hasil kosong aman", Object.keys(kosong).length === 0, `ada ${Object.keys(kosong).length}`);
}

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
