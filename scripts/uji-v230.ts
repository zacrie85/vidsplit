// VidSplit v2.3.0 — uji unit + render nyata SATU COVER UNTUK SEMUA PART + GAYA BINGKAI:
//   (1) rapikanThumbnail — mode ("per-part"|"satu") & gaya ("modern"|"klasik"|"futuristik")
//       dinormalisasi; simpanan lama TANPA kedua field → bawaan (per-part + modern,
//       nol regresi), nilai aneh → bawaan.
//   (2) GAYA_COVER — integritas preset: font per gaya (modern=tebal, klasik=cinzeldec,
//       futuristik=anton+monoton), hiasan, warna.
//   (3) bangunArgumenThumbnail — NOL REGRESI: gaya "modern" (atau tanpa gaya) = rantai
//       lama PERSIS (string-sajar); klasik = bingkai emas ganda + garis pemisah;
//       futuristik = aksen cyan/magenta + 8 bracket sudut, label TANPA border;
//       mode GAMBAR (input frame bersama, tanpa -ss) vs mode VIDEO (-ss).
//   (4) Anchor frame bersama: detikFrameThumbnail part 1 dipetakan menit 1–3.
//   (5) Render NYATA: frame bersama diekstrak SEKALI (W,H = 720×1280 PERSIS), lalu
//       cover tersusun dr GAMBAR di 3 gaya (+1 PNG) — semua 720×1280 & berisi gambar;
//       mode VIDEO dgn gaya klasik juga dirender (jalur lama tetap hidup).
// Jalankan: npx tsx scripts/uji-v230.ts
import { execFileSync } from "node:child_process";
import { existsSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { dirWork, fontfileNama } from "../src/lib/vidsplit/ffmpeg";
import {
  bangunArgumenFrameSumber,
  bangunArgumenThumbnail,
  detikFrameThumbnail,
  GAYA_COVER,
} from "../src/lib/vidsplit/thumbnail";
import {
  GAYA_THUMBNAIL,
  MODE_THUMBNAIL,
  opsiThumbnailDefault,
  rapikanThumbnail,
} from "../src/lib/vidsplit/types";

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
const DIR = dirWork("tmp");
const VID = path.join(DIR, "uji-v230-sumber.mp4");

/* ================= (1) rapikanThumbnail — mode & gaya ================= */
console.log("\n== (1) rapikanThumbnail — mode & gaya v2.3.0 ==");
{
  const d = rapikanThumbnail({});
  cek(d.mode === "per-part" && d.gaya === "modern", "kosong → bawaan per-part + modern", JSON.stringify(d));
  cek(
    d.aktif === false && d.kata === "Part" && d.format === "jpg",
    "kosong → aktif/kata/format bawaan tetap",
  );
  cek(rapikanThumbnail(undefined).mode === "per-part", "undefined → per-part");
  cek(rapikanThumbnail(null).gaya === "modern", "null → modern");
  cek(rapikanThumbnail({ mode: "satu" }).mode === "satu", "satu → satu");
  cek(rapikanThumbnail({ mode: "SATU" }).mode === "per-part", "SATU (kapital) → bawaan per-part");
  cek(rapikanThumbnail({ mode: "apapun" }).mode === "per-part", "nilai asing → per-part");
  cek(rapikanThumbnail({ gaya: "klasik" }).gaya === "klasik", "klasik → klasik");
  cek(rapikanThumbnail({ gaya: "futuristik" }).gaya === "futuristik", "futuristik → futuristik");
  cek(rapikanThumbnail({ gaya: "neon" }).gaya === "modern", "gaya asing → modern");
  cek(rapikanThumbnail({ gaya: "Modern" }).gaya === "modern", "Modern (kapital) → modern");
  // simpanan lama v2.1–v2.2 (tanpa mode/gaya) tetap dipahami
  const lama = rapikanThumbnail({ aktif: true, kata: "Episode", format: "png" });
  cek(
    lama.aktif === true && lama.kata === "Episode" && lama.format === "png" && lama.mode === "per-part" && lama.gaya === "modern",
    "payload lama v2.1 (tanpa mode/gaya) → perilaku lama utuh",
    JSON.stringify(lama),
  );
  cek(
    JSON.stringify(MODE_THUMBNAIL) === JSON.stringify(["per-part", "satu", "identik"]),
    "MODE_THUMBNAIL lengkap (urutan stabil utk UI — v2.5.0 + identik)",
  );
  cek(
    JSON.stringify(GAYA_THUMBNAIL) === JSON.stringify(["modern", "klasik", "futuristik"]),
    "GAYA_THUMBNAIL lengkap (urutan stabil utk UI)",
  );
  cek(opsiThumbnailDefault.mode === "per-part" && opsiThumbnailDefault.gaya === "modern", "opsiThumbnailDefault = perilaku lama");
}

/* ================= (2) GAYA_COVER — integritas preset ================= */
console.log("\n== (2) GAYA_COVER — preset 3 gaya ==");
cek(GAYA_COVER.modern.fontJudul === "tebal" && GAYA_COVER.modern.fontLabel === "tebal", "modern = tebal/tebal (font lama)");
cek(GAYA_COVER.modern.hiasan === "", "modern tanpa hiasan (= rantai lama)");
cek(GAYA_COVER.klasik.fontJudul === "cinzeldec" && GAYA_COVER.klasik.fontLabel === "cinzeldec", "klasik = Cinzel Decorative");
cek(GAYA_COVER.klasik.hiasan === "emas", "klasik = hiasan emas");
cek(GAYA_COVER.futuristik.fontJudul === "anton" && GAYA_COVER.futuristik.fontLabel === "monoton", "futuristik = Anton + Monoton");
cek(GAYA_COVER.futuristik.hiasan === "neon", "futuristik = hiasan neon");
cek(GAYA_COVER.futuristik.tebalBorderLabel === 0, "futuristik label tanpa border (Monoton sudah outline)");
cek(GAYA_COVER.modern.warnaLabel === "#fbbf24", "modern warna label kuning = warna lama");
cek(GAYA_COVER.modern.boxJudul === "black@0.45" && GAYA_COVER.modern.boxLabel === "black@0.55", "modern kotak = alpha lama");

/* ================= (3) bangunArgumenThumbnail — rantai per gaya ================= */
const dasarArg = {
  judulTxt: "JUDUL UJI\nDUA BARIS",
  labelTxt: "Part 03",
  W: 720,
  H: 1280,
  fileJudul: "uji-j.txt",
  fileLabel: "uji-l.txt",
  ukuranJudul: 52,
  ukuranLabel: 74,
  fontfile: "/fonts/DejaVuSans-Bold.ttf",
  keluar: "uji-thumb.jpg",
  format: "jpg" as const,
};

console.log("\n== (3a) NOL REGRESI — modern (dan tanpa gaya) = rantai lama PERSIS ==");
const tanpaGaya = bangunArgumenThumbnail({ ...dasarArg, src: "v.mp4", detik: 90 });
const modern = bangunArgumenThumbnail({ ...dasarArg, src: "v.mp4", detik: 90, gaya: "modern" });
const modernFontL = bangunArgumenThumbnail({
  ...dasarArg, src: "v.mp4", detik: 90, gaya: "modern", fontLabel: "/fonts/DejaVuSans-Bold.ttf",
});
cek(JSON.stringify(tanpaGaya) === JSON.stringify(modern), "tanpa gaya ≡ gaya modern (string-sajar)");
cek(JSON.stringify(modern) === JSON.stringify(modernFontL), "fontLabel kosong ≡ fontLabel = font judul (modern)");
// rantai lama v2.1: kotak black@0.45 + label black@0.55 + teks putih/kuning + border 2 teks
const rantaiM = modern[modern.indexOf("-filter_complex") + 1];
cek(rantaiM.includes("color=black@0.45:t=fill"), "modern: kotak judul black@0.45 (lama)");
cek(rantaiM.includes("color=black@0.55:t=fill"), "modern: kotak label black@0.55 (lama)");
cek(rantaiM.includes("fontcolor=white") && rantaiM.includes("fontcolor=#fbbf24"), "modern: teks putih + kuning (lama)");
cek((rantaiM.match(/borderw=/g) || []).length === 2, "modern: 2 border teks (judul+label)");
cek((rantaiM.match(/drawbox/g) || []).length === 2, "modern: 2 drawbox (judul+label) — tanpa hiasan");
cek(modern[2] === "-ss" && modern[3] === "90.000" && modern[4] === "-i" && modern[5] === "v.mp4", "modern: input video + -ss (lama)");

console.log("\n== (3b) GAYA KLASIK — bingkai emas ganda ==");
const klasik = bangunArgumenThumbnail({ ...dasarArg, src: "v.mp4", detik: 90, gaya: "klasik", fontfile: "/fonts/CinzelDecorative-Bold.ttf", fontLabel: "/fonts/CinzelDecorative-Bold.ttf" });
const rantaiK = klasik[klasik.indexOf("-filter_complex") + 1];
cek((rantaiK.match(/drawbox/g) || []).length === 5, "klasik: 5 drawbox (judul+label+bingkai ganda+pemisah)", String((rantaiK.match(/drawbox/g) || []).length));
cek(rantaiK.includes("color=#d4af37@0.9:t="), "klasik: bingkai luar emas");
cek(rantaiK.includes("color=#d4af37@0.45:t="), "klasik: bingkai dalam emas tipis");
cek(rantaiK.includes("color=#d4af37@0.75:t=fill"), "klasik: garis pemisah emas bawah judul");
cek(rantaiK.includes("fontcolor=#f5e6c8") && rantaiK.includes("fontcolor=#f5d061"), "klasik: teks gading + label emas muda");
cek(rantaiK.includes("black@0.55") && rantaiK.includes("black@0.6"), "klasik: kotak 0.55/0.6");

console.log("\n== (3c) GAYA FUTURISTIK — neon cyan + bracket sudut ==");
const futu = bangunArgumenThumbnail({ ...dasarArg, src: "v.mp4", detik: 90, gaya: "futuristik", fontfile: "/fonts/Anton.ttf", fontLabel: "/fonts/Monoton.ttf" });
const rantaiF = futu[futu.indexOf("-filter_complex") + 1];
cek((rantaiF.match(/drawbox/g) || []).length === 12, "futuristik: 12 drawbox (2 kotak + 2 garis aksen + 8 bracket)", String((rantaiF.match(/drawbox/g) || []).length));
cek((rantaiF.match(/#22d3ee/g) || []).length >= 10, "futuristik: aksen cyan berulang (border+garis+bracket)");
cek(rantaiF.includes("color=#e879f9@0.9:t=fill"), "futuristik: garis aksen magenta atas label");
cek(rantaiF.includes("color=#020617@0.78:t=fill"), "futuristik: kotak label slate gelap");
cek(rantaiF.includes("fontcolor=white") && rantaiF.includes("fontcolor=#22d3ee"), "futuristik: judul putih + label cyan");
cek((rantaiF.match(/borderw=/g) || []).length === 1, "futuristik: HANYA judul berborder (label polos)");
cek(rantaiF.includes("bordercolor=#22d3ee"), "futuristik: border judul cyan (neon)");

console.log("\n== (3d) label kosong (gabung) — semua gaya tetap sah ==");
for (const g of GAYA_THUMBNAIL) {
  const a = bangunArgumenThumbnail({ ...dasarArg, src: "v.mp4", detik: 5, labelTxt: "", gaya: g });
  const r = a[a.indexOf("-filter_complex") + 1];
  cek(!r.includes("uji-l.txt"), `${g}: tanpa label → textfile label tak dipakai`);
  cek((r.match(/drawbox/g) || []).length === (g === "modern" ? 1 : g === "klasik" ? 4 : 10), `${g}: jumlah drawbox tanpa label benar`);
}

console.log("\n== (3e) MODE GAMBAR (satu cover) — tanpa -ss ==");
const dariGambar = bangunArgumenThumbnail({ ...dasarArg, gambar: "frame.png", detik: 999, gaya: "futuristik" });
cek(dariGambar[2] === "-i" && dariGambar[3] === "frame.png", "gambar: input langsung -i frame.png");
cek(!dariGambar.includes("-ss"), "gambar: TANPA -ss (detik diabaikan)");
cek(dariGambar.includes("-frames:v") && dariGambar.includes("1"), "gambar: tetap -frames:v 1");
const rG = dariGambar[dariGambar.indexOf("-filter_complex") + 1];
cek(rG.includes("scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280"), "gambar: scale cover W×H tetap");

/* ================= (4) anchor frame bersama ================= */
console.log("\n== (4) anchor frame bersama (part 1 → menit 1–3) ==");
{
  // video 1 jam, part 1 durasi 20 mnt → 35% × 1200 = 420 dtk → dipetakan: 60+(420/3600)×120
  const dtk = detikFrameThumbnail(0, 1200, 3600);
  const harap = 60 + (420 / 3600) * 120;
  cek(Math.abs(dtk - harap) < 1e-9, "part 1 video 1 jam → di dalam menit 1–3", `${dtk} ≈ ${harap}`);
  cek(dtk >= 60 && dtk <= 180, "anchor di rentang menit 1–3");
  // video pendek → posisi persis (perilaku v2.2.1)
  cek(Math.abs(detikFrameThumbnail(0, 20, 60) - 7) < 1e-9, "video 60 dtk → persis 0+20×35% = 7");
}

/* ================= (5) RENDER NYATA ================= */
console.log("\n== (5) render nyata — frame bersama + 3 gaya ==");
try {
  execFileSync("ffmpeg", ["-y", "-v", "error", "-f", "lavfi", "-i", "testsrc=s=320x240:d=6:r=25", "-f", "lavfi", "-i", "sine=frequency=440:duration=6", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", VID], { stdio: ["ignore", "ignore", "pipe"] });
  cek(existsSync(VID), "video uji 6 dtk dibuat");
} catch (e) {
  cek(false, "video uji 6 dtk dibuat", String(e));
}

// (5a) ekstraksi frame bersama SEKALI (mode W,H → 720×1280 persis)
const fBersama = path.join(DIR, "uji-v230-frame-bersama.png");
try {
  execFileSync("ffmpeg", bangunArgumenFrameSumber(VID, 2.0, fBersama, 720, 1280), { stdio: ["ignore", "ignore", "pipe"] });
  const dim = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-print_format", "json", "-show_streams", fBersama]).toString());
  cek(existsSync(fBersama) && Number(dim.streams?.[0]?.width) === 720 && Number(dim.streams?.[0]?.height) === 1280, "frame bersama PERSIS 720×1280", `${dim.streams?.[0]?.width}x${dim.streams?.[0]?.height}`);
} catch (e) {
  cek(false, "frame bersama PERSIS 720×1280", String(e));
}

// (5b) cover dr GAMBAR utk 3 gaya (+ PNG futuristik) — semua 720×1280
const fileJ = path.join(DIR, "uji-v230-j.txt");
const fileL = path.join(DIR, "uji-v230-l.txt");
writeFileSync(fileJ, "RINDUNYA HATIKU\nUJI SATU COVER", "utf8");
writeFileSync(fileL, "Part 03", "utf8");
for (const g of GAYA_THUMBNAIL) {
  const keluar = path.join(DIR, `uji-v230-cover-${g}.jpg`);
  const gy = GAYA_COVER[g];
  try {
    execFileSync(
      "ffmpeg",
      bangunArgumenThumbnail({
        gambar: fBersama,
        judulTxt: "RINDUNYA HATIKU\nUJI SATU COVER",
        labelTxt: "Part 03",
        W: 720,
        H: 1280,
        fileJudul: fileJ,
        fileLabel: fileL,
        ukuranJudul: 52,
        ukuranLabel: 74,
        fontfile: fontfileNama(gy.fontJudul),
        fontLabel: fontfileNama(gy.fontLabel),
        gaya: g,
        keluar,
        format: "jpg",
      }),
      { stdio: ["ignore", "ignore", "pipe"] },
    );
    const dim = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-print_format", "json", "-show_streams", keluar]).toString());
    const w = Number(dim.streams?.[0]?.width);
    const h = Number(dim.streams?.[0]?.height);
    const ukuran = existsSync(keluar) ? statSync(keluar).size : 0;
    cek(existsSync(keluar) && ukuran > 5000 && w === 720 && h === 1280, `cover ${g} (dr gambar) 720×1280, ${ukuran} B`, `${w}x${h} ${ukuran}B`);
  } catch (e) {
    cek(false, `cover ${g} (dr gambar) 720×1280`, String(e));
  }
}
{
  const keluar = path.join(DIR, "uji-v230-cover-futu.png");
  const gy = GAYA_COVER.futuristik;
  try {
    execFileSync(
      "ffmpeg",
      bangunArgumenThumbnail({
        gambar: fBersama,
        judulTxt: "RINDUNYA HATIKU\nUJI SATU COVER",
        labelTxt: "Part 03",
        W: 720,
        H: 1280,
        fileJudul: fileJ,
        fileLabel: fileL,
        ukuranJudul: 52,
        ukuranLabel: 74,
        fontfile: fontfileNama(gy.fontJudul),
        fontLabel: fontfileNama(gy.fontLabel),
        gaya: "futuristik",
        keluar,
        format: "png",
      }),
      { stdio: ["ignore", "ignore", "pipe"] },
    );
    cek(existsSync(keluar) && statSync(keluar).size > 5000, `cover futuristik PNG (${statSync(keluar).size} B)`);
  } catch (e) {
    cek(false, "cover futuristik PNG", String(e));
  }
}

// (5c) mode VIDEO + gaya klasik — jalur lama (per-part) tetap hidup dgn gaya
{
  const keluar = path.join(DIR, "uji-v230-cover-video.jpg");
  const gy = GAYA_COVER.klasik;
  try {
    execFileSync(
      "ffmpeg",
      bangunArgumenThumbnail({
        src: VID,
        detik: 2.0,
        judulTxt: "RINDUNYA HATIKU\nUJI SATU COVER",
        labelTxt: "Part 03",
        W: 720,
        H: 1280,
        fileJudul: fileJ,
        fileLabel: fileL,
        ukuranJudul: 52,
        ukuranLabel: 74,
        fontfile: fontfileNama(gy.fontJudul),
        fontLabel: fontfileNama(gy.fontLabel),
        gaya: "klasik",
        keluar,
        format: "jpg",
      }),
      { stdio: ["ignore", "ignore", "pipe"] },
    );
    const dim = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-print_format", "json", "-show_streams", keluar]).toString());
    cek(existsSync(keluar) && Number(dim.streams?.[0]?.width) === 720 && Number(dim.streams?.[0]?.height) === 1280, "cover klasik dr VIDEO (jalur per-part) 720×1280");
  } catch (e) {
    cek(false, "cover klasik dr VIDEO (jalur per-part) 720×1280", String(e));
  }
}

console.log(`\n========== HASIL uji-v230: ${lulus} LOLOS, ${gagal} GAGAL ==========`);
process.exit(gagal ? 1 : 0);
