// VidSplit v2.2.0 — uji unit + render nyata BACKGROUND INTRO DARI VIDEO:
//   (1) detikFrameIntro — posisi frame 0–100% di dalam potongan (slider bebas),
//   (2) labelIntro — label "Part/Bagian/Episode NN" dr kataPart bebas,
//   (3) bangunArgumenFrameSumber — ekstraksi 1 frame polos dr video SUMBER,
//   (4) bangunArgumenPart — teks intro OTOMATIS (judul nama file + label):
//       textfile ditulis, drawtext judul + label kuning, urutan input utuh,
//   (5) render NYATA ujung-ke-ujung: frame diambil dari video uji (posisi 35%),
//       dipakai sbg bg intro (zoom-masuk + fade + teks + suara) → durasi TEPAT,
//       frame pertama hasil = frame video (bukan hitam/hijau).
// Jalankan: npx tsx scripts/uji-v211.ts
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pengaturanDefault, type Pengaturan } from "../src/lib/vidsplit/types";
import { bangunArgumenPart, dirWork } from "../src/lib/vidsplit/ffmpeg";
import {
  bangunArgumenFrameSumber,
  bersihkanNamaJudul,
  detikFrameIntro,
  labelIntro,
} from "../src/lib/vidsplit/thumbnail";

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

const aturDasar = (extra: Partial<Pengaturan> = {}): Pengaturan => ({
  ...pengaturanDefault,
  ...extra,
});

/* ================= (1) DETIK FRAME INTRO ================= */
console.log("\n== (1) detikFrameIntro — posisi 0-100% ==");
cek(Math.abs(detikFrameIntro(10, 20, 35) - 17) < 1e-9, "10+20×35% = 17 (bawaan, sama dgn thumbnail)");
cek(detikFrameIntro(5, 10, 0) === 5, "0% = awal potongan");
cek(Math.abs(detikFrameIntro(5, 10, 100) - 15) < 1e-9, "100% = akhir potongan");
cek(Math.abs(detikFrameIntro(0, 4, 35) - 1.4) < 1e-9, "0+4×35% = 1.4");
cek(detikFrameIntro(0, 0, 50) === 0, "durasi 0 → 0 (aman)");
cek(Math.abs(detikFrameIntro(2, 8, -5) - 2) < 1e-9, "posisi negatif → clamp 0%");
cek(Math.abs(detikFrameIntro(2, 8, 500) - 10) < 1e-9, "posisi >100 → clamp 100%");
cek(Math.abs(detikFrameIntro(2, 8, NaN) - 2) < 1e-9, "NaN → clamp 0%");

/* ================= (2) LABEL INTRO ================= */
console.log("\n== (2) labelIntro — kata bebas + nomor 2 digit ==");
cek(labelIntro("Part", 3) === "Part 03", "Part 03");
cek(labelIntro("Bagian", 12) === "Bagian 12", "Bagian 12");
cek(labelIntro("Episode", 7) === "Episode 07", "Episode 07");
cek(labelIntro("Segmen", 4) === "Segmen 04", "kataPart bebas (Segmen) dihormati");
cek(labelIntro("", 4) === "Part 04", "kata kosong → Part");
cek(labelIntro("  ", 4) === "Part 04", "kata spasi → Part");
cek(labelIntro("Part", 0) === "Part 01", "nomor 0 → clamp 01");
cek(labelIntro("Part", 123) === "Part 123", "nomor >99 tetap tampil apa adanya");

/* ================= (3) ARGS FRAME SUMBER ================= */
console.log("\n== (3) bangunArgumenFrameSumber ==");
const af = bangunArgumenFrameSumber("/vid/sumber.mp4", 1.4, "/tmp/frame.png");
cek(af[0] === "-y" && af[1] === "-hide_banner", "mulai -y -hide_banner");
cek(af.indexOf("-ss") === 2 && af[3] === "1.400", "-ss detik tepat (3 desimal)");
cek(af.indexOf("-i") === 4 && af[5] === "/vid/sumber.mp4", "-ss SEBELUM -i (seek cepat)");
cek(af.includes("-frames:v") && af.includes("1"), "cuma 1 frame");
cek(af[af.length - 1] === "/tmp/frame.png", "argumen terakhir = keluaran");
cek(af.length === 9, `tanpa filter/tulisan — 9 argumen polos (${af.length})`);

/* ================= (4) TEKS INTRO OTOMATIS DI bangunArgumenPart ================= */
console.log("\n== (4) bangunArgumenPart — teks intro otomatis ==");
const fBg = path.join(DIR, "uji-v211-bg.png");
const fSuara = path.join(DIR, "uji-v211-suara.mp3");
if (!existsSync(fBg))
  execFileSync("ffmpeg", ["-y", "-v", "error", "-f", "lavfi", "-i", "gradients=s=540x960:c0=#0b1210:c1=#243b32:d=1", "-frames:v", "1", fBg]);
if (!existsSync(fSuara))
  execFileSync("ffmpeg", ["-y", "-v", "error", "-f", "lavfi", "-i", "sine=frequency=440:duration=4", "-ar", "44100", "-ac", "2", fSuara]);
const VID = "/tmp/uji-v211-vid.mp4";
if (!existsSync(VID)) {
  execFileSync("ffmpeg", ["-y", "-v", "error", "-f", "lavfi", "-i", "testsrc=s=320x240:d=6:r=25", "-f", "lavfi", "-i", "sine=frequency=440:duration=6", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", VID]);
}
const codec = ["-c:v", "libx264", "-preset", "ultrafast", "-crf", "30"];

// A) judul + label → dua textfile + dua drawtext
const pA = aturDasar({ introAktif: true, introAnimasi: "zoom-masuk", introFade: false, introTeksUkuran: 60 });
const { args: aA, total: tA } = bangunArgumenPart({
  src: VID, bg: fBg, logo: null, pengaturan: pA, n: 3, mulai: 8, durasi: 5,
  W: 1080, H: 1920, fps: 25, adaAudio: true,
  judulTxt: "", partTxt: "", deskripsiTxt: "",
  introJudulTxt: bersihkanNamaJudul("Hutan_Mistis_Episode_12.mp4"), introLabelTxt: labelIntro("Bagian", 3),
  dirTmp: DIR, tag: "uji-v211-a", codecArgs: codec, keluar: "/tmp/uji-v211-a.mp4",
});
const flA = aA[aA.indexOf("-filter_complex") + 1];
cek(Math.abs(tA - 7) < 1e-9, `total = intro 2 + durasi 5 = 7 (${tA})`);
const fileJA = path.join(DIR, "uji-v211-a-intro.txt");
const fileLA = path.join(DIR, "uji-v211-a-intro-l.txt");
cek(existsSync(fileJA) && existsSync(fileLA), "textfile judul & label intro ditulis");
const isiJ = existsSync(fileJA) ? readFileSync(fileJA, "utf8") : "";
const isiL = existsSync(fileLA) ? readFileSync(fileLA, "utf8") : "";
cek(isiJ === "Hutan Mistis", `judul OTOMATIS dari nama file: "${isiJ}"`);
cek(isiL === "Bagian 03", `label dari kataPart: "${isiL}"`);
cek((flA.match(/drawtext=textfile=/g) || []).length === 2, "filter: 2 drawtext (judul + label)");
cek(flA.includes("fontcolor=0xffffff"), "judul: warna bawaan putih");
cek(flA.includes("fontcolor=#fbbf24"), "label: kuning #fbbf24");
cek(flA.includes("fontsize=60.0"), "judul: ukuran 60");
cek(flA.includes("fontsize=33.0"), "label: 55% ukuran judul (33)");
cek(flA.includes("expansion=none"), "expansion=none di kedua drawtext");

// B) tanpa judul (nama file aneh) tapi label ada → hanya label, posisi tengah
const { args: aB } = bangunArgumenPart({
  src: VID, bg: fBg, logo: null, pengaturan: pA, n: 1, mulai: 0, durasi: 4,
  W: 1080, H: 1920, fps: 25, adaAudio: false,
  judulTxt: "", partTxt: "", deskripsiTxt: "",
  introJudulTxt: "", introLabelTxt: "Part 01",
  dirTmp: DIR, tag: "uji-v211-b", codecArgs: codec, keluar: "/tmp/uji-v211-b.mp4",
});
const flB = aB[aB.indexOf("-filter_complex") + 1];
cek((flB.match(/drawtext=textfile=/g) || []).length === 1, "tanpa judul → cuma 1 drawtext (label)");
cek(flB.includes(":y=" + String(Math.round(1920 * 0.42))), "label tanpa judul: y = 42% (tengah)");

// C) introAktif + judul panjang → terbungkus multi-baris (baris memengaruhi posisi label)
const { args: aC } = bangunArgumenPart({
  src: VID, bg: fBg, logo: null, pengaturan: pA, n: 1, mulai: 0, durasi: 4,
  W: 1080, H: 1920, fps: 25, adaAudio: false,
  judulTxt: "", partTxt: "", deskripsiTxt: "",
  introJudulTxt: "Cerita Mistis Hutan Pemburu Hilang Di Tengah Malam Hari Yang Sangat Mengerikan Sekali",
  introLabelTxt: "Part 01",
  dirTmp: DIR, tag: "uji-v211-c", codecArgs: codec, keluar: "/tmp/uji-v211-c.mp4",
});
const fileJC = path.join(DIR, "uji-v211-c-intro.txt");
const isiJC = existsSync(fileJC) ? readFileSync(fileJC, "utf8") : "";
const barisJC = isiJC.split("\n").length;
cek(barisJC > 1, `judul panjang terbungkus ${barisJC} baris`);
const flC = aC[aC.indexOf("-filter_complex") + 1];
cek(flC.includes(":y=" + String(Math.round(1920 * 0.42 + barisJC * 60 * 1.5 + 60 * 0.45))), "label turun mengikuti jumlah baris judul");

// D) TANPA teks intro sama sekali → tanpa drawtext intro, rantai tetap jalan
const { args: aD } = bangunArgumenPart({
  src: VID, bg: fBg, logo: null, pengaturan: pA, n: 1, mulai: 0, durasi: 4,
  W: 1080, H: 1920, fps: 25, adaAudio: false,
  judulTxt: "", partTxt: "", deskripsiTxt: "",
  introJudulTxt: "", introLabelTxt: "",
  dirTmp: DIR, tag: "uji-v211-d", codecArgs: codec, keluar: "/tmp/uji-v211-d.mp4",
});
const flD = aD[aD.indexOf("-filter_complex") + 1];
cek(!flD.split("[bgv]")[0].includes("drawtext"), "tanpa teks → rantai bg polos tanpa drawtext intro");

/* ================= (5) RENDER NYATA — INTRO DARI FRAME VIDEO ================= */
console.log("\n== (5) RENDER NYATA: frame dari video jadi background intro ==");
// frame dari video uji pada posisi 35% dari part 4 dtk → 1.4 dtk
const fFrame = path.join(DIR, "uji-v211-frame.png");
const dtk = detikFrameIntro(0, 4, 35);
execFileSync("ffmpeg", bangunArgumenFrameSumber(VID, dtk, fFrame), { stdio: ["ignore", "ignore", "pipe"] });
cek(existsSync(fFrame) && statSync(fFrame).size > 1000, `frame sumber diambil @ ${dtk.toFixed(3)} dtk (${statSync(fFrame).size} B)`);

const pR = aturDasar({ introAktif: true, durasiIntro: 2, introAnimasi: "zoom-masuk", introFade: true, introTeksUkuran: 64 });
const keluarR = "/tmp/uji-v211-render.mp4";
const { args: argsR, total: totalR } = bangunArgumenPart({
  src: VID, bg: fFrame, logo: null, pengaturan: pR, n: 1, mulai: 0, durasi: 4,
  W: 720, H: 1280, fps: 25, adaAudio: true,
  judulTxt: "", partTxt: "", deskripsiTxt: "",
  fileSuaraIntro: fSuara,
  introJudulTxt: bersihkanNamaJudul("Hutan_Mistis_Episode_12.mp4"),
  introLabelTxt: labelIntro("Bagian", 1),
  dirTmp: DIR, tag: "uji-v211-r", codecArgs: ["-c:v", "libx264", "-preset", "ultrafast", "-crf", "30"], keluar: keluarR,
});
execFileSync("ffmpeg", argsR, { stdio: ["ignore", "ignore", "pipe"] });
const prR = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-print_format", "json", "-show_format", keluarR]).toString());
const durR = Number(prR.format.duration);
cek(Math.abs(durR - totalR) < 0.35, `render lengkap: durasi ${durR.toFixed(2)} ≈ ${totalR} (intro 2 + fade + video 4)`);

// frame pertama hasil = isi video (bukan hitam): JPEG di t=0.5 dtk harus berukuran wajar
const fCek = "/tmp/uji-v211-cek.jpg";
execFileSync("ffmpeg", ["-y", "-v", "error", "-ss", "0.5", "-i", keluarR, "-frames:v", "1", fCek], { stdio: ["ignore", "ignore", "pipe"] });
cek(existsSync(fCek) && statSync(fCek).size > 3000, `frame intro hasil berisi gambar nyata (${existsSync(fCek) ? statSync(fCek).size : 0} B — testsrc berwarna, bukan hitam)`);

// frame di akhir intro (1.9 dtk — menjelang selesai fade) juga harus berisi gambar
const fCek2 = "/tmp/uji-v211-cek2.jpg";
execFileSync("ffmpeg", ["-y", "-v", "error", "-ss", "1.9", "-i", keluarR, "-frames:v", "1", fCek2], { stdio: ["ignore", "ignore", "pipe"] });
cek(existsSync(fCek2) && statSync(fCek2).size > 1500, `frame menjelang akhir intro (fade) masih berisi gambar (${existsSync(fCek2) ? statSync(fCek2).size : 0} B)`);

for (const f of [keluarR, fCek, fCek2]) {
  try { unlinkSync(f); } catch { /* abaikan */ }
}
writeFileSync(path.join(DIR, "uji-v211-ok.txt"), "selesai", "utf8");

console.log(`\n===== HASIL: ${lulus} LOLOS, ${gagal} GAGAL =====`);
if (gagal > 0) process.exit(1);
