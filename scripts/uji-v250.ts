// VidSplit v2.5.0 — uji unit + render nyata MODE COVER "IDENTIK" (SAMA PERSIS SEMUA):
//   (1) rapikanThumbnail — mode "identik" diterima; nilai asing/kapital → per-part;
//       payload lama v2.1/v2.3 tanpa field tetap utuh (nol regresi).
//   (2) bangunArgumenThumbnail dgn labelTxt="" (yang diproduksi mode identik):
//       futuristik TANPA garis magenta (terjaga oleh label), jumlah drawbox benar,
//       argumen DETERMINISTIK (dua panggilan sama → string sama → hasil identik).
//   (3) RENDER NYATA — bukti inti permintaan user ("1 cover ... untuk semua hasil
//       splitannya jadi cover yang di pakai sama semua"): frame bersama 1× + komposisi
//       3× (simulasi 3 part) → ketiga file cover SHA-256 IDENTIK bit-per-bit.
//       Cover berlabel ("satu") dibuat juga → BERBEDA (membuktikan identik benar2 tanpa nomor).
// Jalankan: npx tsx scripts/uji-v250.ts
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { dirWork, fontfileNama } from "../src/lib/vidsplit/ffmpeg";
import { bangunArgumenFrameSumber, bangunArgumenThumbnail, GAYA_COVER } from "../src/lib/vidsplit/thumbnail";
import { GAYA_THUMBNAIL, MODE_THUMBNAIL, opsiThumbnailDefault, rapikanThumbnail } from "../src/lib/vidsplit/types";

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
const sha256 = (f: string) => createHash("sha256").update(require("node:fs").readFileSync(f)).digest("hex");
const DIR = dirWork("tmp");
const VID = path.join(DIR, "uji-v250-sumber.mp4");

/* ================= (1) rapikanThumbnail — mode identik ================= */
console.log("\n== (1) rapikanThumbnail — mode identik v2.5.0 ==");
{
  const d = rapikanThumbnail({});
  cek(d.mode === "per-part" && d.gaya === "modern", "kosong → bawaan per-part + modern (nol regresi)");
  cek(rapikanThumbnail({ mode: "identik" }).mode === "identik", "identik → identik");
  cek(rapikanThumbnail({ mode: "IDENTIK" }).mode === "per-part", "IDENTIK (kapital) → bawaan per-part");
  cek(rapikanThumbnail({ mode: "satu" }).mode === "satu", "satu → satu (jalur v2.3 tetap)");
  cek(rapikanThumbnail({ mode: "apapun" }).mode === "per-part", "nilai asing → per-part");
  const lama = rapikanThumbnail({ aktif: true, kata: "Episode", format: "png" });
  cek(lama.mode === "per-part" && lama.gaya === "modern" && lama.aktif && lama.kata === "Episode" && lama.format === "png", "payload lama v2.1 tanpa mode/gaya → utuh");
  cek(MODE_THUMBNAIL.length === 3 && MODE_THUMBNAIL[2] === "identik", "MODE_THUMBNAIL: 3 mode, identik di urutan akhir");
  cek(opsiThumbnailDefault.mode === "per-part", "bawaan tetap per-part (nol regresi)");
}

/* ================= (2) argumen cover TANPA label (produk identik) ================= */
console.log("\n== (2) bangunArgumenThumbnail — label kosong (identik) ==");
const dasarArg = {
  judulTxt: "RINDUNYA HATIKU AJENG FEBRIA",
  labelTxt: "",
  W: 720,
  H: 1280,
  fileJudul: path.join(DIR, "uji-v250-j.txt"),
  fileLabel: path.join(DIR, "uji-v250-l.txt"),
  ukuranJudul: 52,
  ukuranLabel: 74,
  format: "jpg" as const,
};
writeFileSync(dasarArg.fileJudul, dasarArg.judulTxt, "utf8");
writeFileSync(dasarArg.fileLabel, "", "utf8");
for (const g of GAYA_THUMBNAIL) {
  const a = bangunArgumenThumbnail({ ...dasarArg, src: "v.mp4", detik: 5, gaya: g });
  const r = a[a.indexOf("-filter_complex") + 1];
  cek(!r.includes("uji-v250-l.txt"), `${g}: label kosong → textfile label TAK dipakai`);
  const drawbox = (r.match(/drawbox/g) || []).length;
  cek(drawbox === (g === "modern" ? 1 : g === "klasik" ? 4 : 10), `${g}: jumlah drawbox tanpa label = ${g === "modern" ? 1 : g === "klasik" ? 4 : 10}`, String(drawbox));
  cek(r.includes("drawtext=textfile="), `${g}: judul tetap digambar`);
}
{
  const futu = bangunArgumenThumbnail({ ...dasarArg, src: "v.mp4", detik: 5, gaya: "futuristik" });
  const rF = futu[futu.indexOf("-filter_complex") + 1];
  cek(!rF.includes("#e879f9"), "futuristik identik: TANPA garis magenta (magka terikat label)");
  cek((rF.match(/#22d3ee/g) || []).length >= 9, "futuristik identik: aksen cyan tetap (border+garis judul+bracket)");
  // determinisme — dua panggilan sama → string argumen sama
  const futu2 = bangunArgumenThumbnail({ ...dasarArg, src: "v.mp4", detik: 5, gaya: "futuristik" });
  cek(JSON.stringify(futu) === JSON.stringify(futu2), "argumen DETERMINISTIK (dua panggilan identik)");
}

/* ================= (3) RENDER NYATA — cover identik bit-per-bit ================= */
console.log("\n== (3) render nyata — 3 cover identik = SHA-256 sama ==");
try {
  execFileSync(
    "ffmpeg",
    ["-y", "-v", "error", "-f", "lavfi", "-i", "testsrc=s=320x240:d=6:r=25", "-f", "lavfi", "-i", "sine=frequency=440:duration=6", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", VID],
    { stdio: ["ignore", "ignore", "pipe"] },
  );
  cek(existsSync(VID), "video uji 6 dtk dibuat");
} catch (e) {
  cek(false, "video uji 6 dtk dibuat", String(e));
}

// frame bersama diekstrak SEKALI (persis seperti janjiFrameSatu di jobs.ts)
const fBersama = path.join(DIR, "uji-v250-frame-bersama.png");
try {
  execFileSync("ffmpeg", bangunArgumenFrameSumber(VID, 2.0, fBersama, 720, 1280), { stdio: ["ignore", "ignore", "pipe"] });
  cek(existsSync(fBersama) && statSync(fBersama).size > 1000, `frame bersama 720×1280 diekstraksi (${statSync(fBersama).size} B)`);
} catch (e) {
  cek(false, "frame bersama diekstraksi", String(e));
}

const hashIdentik: string[] = [];
for (const n of [1, 2, 3]) {
  const keluar = path.join(DIR, `uji-v250-cover-identik-part-${String(n).padStart(2, "0")}.jpg`);
  const gy = GAYA_COVER.futuristik;
  try {
    execFileSync(
      "ffmpeg",
      bangunArgumenThumbnail({
        gambar: fBersama,
        judulTxt: dasarArg.judulTxt,
        labelTxt: "", // v2.5.0 — mode identik: label kosong
        W: 720,
        H: 1280,
        fileJudul: dasarArg.fileJudul,
        fileLabel: dasarArg.fileLabel,
        ukuranJudul: 52,
        ukuranLabel: 74,
        fontfile: fontfileNama(gy.fontJudul),
        fontLabel: fontfileNama(gy.fontLabel),
        gaya: "futuristik",
        keluar,
        format: "jpg",
      }),
      { stdio: ["ignore", "ignore", "pipe"] },
    );
    cek(existsSync(keluar) && statSync(keluar).size > 5000, `cover identik part ${n} dirender (${statSync(keluar).size} B)`);
    hashIdentik.push(sha256(keluar));
  } catch (e) {
    cek(false, `cover identik part ${n} dirender`, String(e));
  }
}
cek(hashIdentik.length === 3, "3 cover identik tersedia");
cek(hashIdentik[0] === hashIdentik[1] && hashIdentik[1] === hashIdentik[2], "SHA-256 ketiganya IDENTIK — cover yang dipakai sama semua", hashIdentik.join(" | "));

// cover berlabel (mode "satu") → HARUS berbeda dr identik (ada "Part 01")
{
  const keluar = path.join(DIR, "uji-v250-cover-berlabel.jpg");
  const fileL = path.join(DIR, "uji-v250-l2.txt");
  writeFileSync(fileL, "Part 01", "utf8");
  const gy = GAYA_COVER.futuristik;
  try {
    execFileSync(
      "ffmpeg",
      bangunArgumenThumbnail({
        gambar: fBersama,
        judulTxt: dasarArg.judulTxt,
        labelTxt: "Part 01",
        W: 720,
        H: 1280,
        fileJudul: dasarArg.fileJudul,
        fileLabel: fileL,
        ukuranJudul: 52,
        ukuranLabel: 74,
        fontfile: fontfileNama(gy.fontJudul),
        fontLabel: fontfileNama(gy.fontLabel),
        gaya: "futuristik",
        keluar,
        format: "jpg",
      }),
      { stdio: ["ignore", "ignore", "pipe"] },
    );
    cek(existsSync(keluar), "cover berlabel (mode satu) dirender");
    cek(sha256(keluar) !== hashIdentik[0], "cover berlabel BERBEDA dr cover identik (mode benar2 tanpa nomor)");
  } catch (e) {
    cek(false, "cover berlabel (mode satu)", String(e));
  }
}

console.log(`\n========== HASIL uji-v250: ${lulus} LOLOS, ${gagal} GAGAL ==========`);
process.exit(gagal ? 1 : 0);
