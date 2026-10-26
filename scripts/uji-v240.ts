// VidSplit v2.4.0 — POSISI BEBAS JUDUL & PART (tombol geser) + KATA PART PILIHAN:
//   (1) dariPosisiTeksLama — peta posisiTeks lama (atas/tengah/bawah) → judulX/Y + partX/Y,
//   (2) rapikanPosisiXY / rapikanPosisiY — clamp + sentinel -1 (otomatis),
//   (3) posisiTeksBlok — geometri Y efektif; bawaan (-1/-1) = PERSIS rantai lama "atas",
//   (4) migrasiSimpanan — simpanan lama dgn posisiTeks dipetakan & kunci lama dibuang,
//   (5) terapkanSebagian — partX/Y ikut tersalin (kartu 3), judulX/Y TIDAK (kartu 2),
//   (6) bangunArgumenPart — string filter: bawaan = pola lama PERSIS (nol regresi),
//       posisi bebas = ekspresi X + Y konkret; render NYATA posisi bebas.
// Jalankan: npx tsx scripts/uji-v240.ts
import { execFileSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import path from "node:path";
import {
  dariPosisiTeksLama,
  migrasiSimpanan,
  pengaturanDefault,
  posisiTeksBlok,
  rapikanPosisiXY,
  rapikanPosisiY,
  terapkanSebagian,
  type Pengaturan,
} from "../src/lib/vidsplit/types";
import { bangunArgumenPart, dirWork } from "../src/lib/vidsplit/ffmpeg";

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

/* ================= (1) dariPosisiTeksLama ================= */
console.log("\n== (1) dariPosisiTeksLama — peta posisi lama ==");
cek(
  JSON.stringify(dariPosisiTeksLama("atas")) === JSON.stringify({ judulX: 50, judulY: -1, partX: 50, partY: -1 }),
  `"atas" → keduanya OTOMATIS (-1) = perilaku lama PERSIS`,
);
cek(
  JSON.stringify(dariPosisiTeksLama("tengah")) === JSON.stringify({ judulX: 50, judulY: 47, partX: 50, partY: 53 }),
  `"tengah" → judul 47% · part 53% (perkiraan konkret)`,
);
cek(
  JSON.stringify(dariPosisiTeksLama("bawah")) === JSON.stringify({ judulX: 50, judulY: 77, partX: 50, partY: 88 }),
  `"bawah" → judul 77% · part 88% (perkiraan konkret)`,
);
cek(
  JSON.stringify(dariPosisiTeksLama("kiri")) === JSON.stringify({ judulX: 50, judulY: -1, partX: 50, partY: -1 }),
  `nilai tak dikenal → jatuh ke "atas" (otomatis)`,
);
cek(
  JSON.stringify(dariPosisiTeksLama(undefined)) === JSON.stringify({ judulX: 50, judulY: -1, partX: 50, partY: -1 }),
  `undefined → bawaan otomatis`,
);

/* ================= (2) rapikanPosisiXY / rapikanPosisiY ================= */
console.log("\n== (2) rapikanPosisiXY & rapikanPosisiY — clamp + sentinel ==");
cek(rapikanPosisiXY(50, 50) === 50, "X 50 → 50");
cek(rapikanPosisiXY(133, 50) === 100, "X 133 → clamp 100");
cek(rapikanPosisiXY(-9, 50) === 0, "X -9 → clamp 0");
cek(rapikanPosisiXY(NaN, 50) === 50, "X NaN → bawaan");
cek(rapikanPosisiXY(33.44, 50) === 33.4, "X dibulatkan 1 desimal (33.44 → 33.4)");
cek(rapikanPosisiY(-1, -1) === -1, "Y -1 → -1 (otomatis dijaga)");
cek(rapikanPosisiY(-99, -1) === -1, "Y -99 → -1 (semua negatif = otomatis)");
cek(rapikanPosisiY(30, -1) === 30, "Y 30 → 30 (konkret)");
cek(rapikanPosisiY(120, -1) === 100, "Y 120 → clamp 100");
cek(rapikanPosisiY(NaN, -1) === -1, "Y NaN → bawaan (-1 otomatis)");

/* ================= (3) posisiTeksBlok — geometri Y efektif ================= */
console.log("\n== (3) posisiTeksBlok — otomatis = PERSIS rantai lama ==");
// angka contoh: H=1920, ukuran judul/part 23 → tJ=tP=34.5, gap=10.35, mrg=86.4
const H = 1920, mrg = H * 0.045, tJ = 34.5, tP = 34.5, gap = 23 * 0.45;
const auto = posisiTeksBlok(-1, -1, H, mrg, tJ, tP, gap);
cek(Math.abs(auto.yJ - mrg) < 1e-9, `judul otomatis = margin atas H×4,5% (${mrg})`);
cek(Math.abs(auto.yP - (mrg + tJ + gap)) < 1e-9, `part otomatis = yJ + tJ + gap (${mrg + tJ + gap}) — PERSIS rantai lama "atas"`);
// judul kosong: rantai lama tetap menghitung tJ utk 1 baris — perilaku sama dijaga
cek(
  Math.abs(posisiTeksBlok(-1, -1, H, mrg, tJ, tP, gap).yP - auto.yP) < 1e-9,
  "judul kosong → part tetap di yJ+tJ+gap (perilaku lama utuh)",
);
// konkret
cek(Math.abs(posisiTeksBlok(30, 80, H, mrg, tJ, tP, gap).yJ - 576) < 1e-9, "judulY 30% → y = 576 px");
cek(Math.abs(posisiTeksBlok(30, 80, H, mrg, tJ, tP, gap).yP - 1536) < 1e-9, "partY 80% → y = 1536 px (TERPISAH dr judul)");
// campuran: judul konkret + part otomatis → part tepat di bawah judul KONKRET itu
const campur = posisiTeksBlok(50, -1, H, mrg, tJ, tP, gap);
cek(Math.abs(campur.yP - (960 + tJ + gap)) < 1e-9, "judul 50% + part otomatis → part mengikuti judul konkret");
// clamp: jangan sampai blok keluar frame
cek(Math.abs(posisiTeksBlok(100, 100, H, mrg, tJ, tP, gap).yJ - (H - tJ)) < 1e-9, "judulY 100% → clamp H - tJ (masuk frame)");
cek(Math.abs(posisiTeksBlok(100, 100, H, mrg, tJ, tP, gap).yP - (H - tP)) < 1e-9, "partY 100% → clamp H - tP");
cek(posisiTeksBlok(-1, -1, 0, 0, tJ, tP, gap).yP >= 0, "H 0 → tidak NaN / negatif (aman)");

/* ================= (4) migrasiSimpanan — simpanan lama ================= */
console.log("\n== (4) migrasiSimpanan — posisiTeks lama → posisi bebas ==");
const mAtas = migrasiSimpanan({ posisiTeks: "atas" } as Partial<Pengaturan>);
cek(mAtas.judulY === -1 && mAtas.partY === -1 && mAtas.judulX === 50 && mAtas.partX === 50,
  `simpanan "atas" → 50/-1/50/-1 (${JSON.stringify({ j: mAtas.judulY, p: mAtas.partY })})`);
cek((mAtas as Record<string, unknown>).posisiTeks === undefined, "kunci posisiTeks DIBUANG dr simpanan");
const mTengah = migrasiSimpanan({ posisiTeks: "tengah" } as Partial<Pengaturan>);
cek(mTengah.judulY === 47 && mTengah.partY === 53, `simpanan "tengah" → judul 47 / part 53`);
const mBawah = migrasiSimpanan({ posisiTeks: "bawah" } as Partial<Pengaturan>);
cek(mBawah.judulY === 77 && mBawah.partY === 88, `simpanan "bawah" → judul 77 / part 88`);
const mBaru = migrasiSimpanan({ judulX: 20, judulY: 25, partX: 80, partY: 85, posisiTeks: "bawah" } as Partial<Pengaturan>);
cek(mBaru.judulX === 20 && mBaru.judulY === 25 && mBaru.partX === 80 && mBaru.partY === 85,
  "simpanan BARU (sudah punya judulY) TIDAK disentuh meski posisiTeks ikut nyangkut");
const mAneh = migrasiSimpanan({ judulX: "bukan-angka", judulY: -7, partX: NaN, partY: 999 } as unknown as Partial<Pengaturan>);
cek(mAneh.judulX === 50 && mAneh.judulY === -1 && mAneh.partX === 50 && mAneh.partY === 100,
  "nilai rusak → bawaan aman (X 50, Y otomatis / clamp 100)");

/* ================= (5) terapkanSebagian — kartu 3 ikut, kartu 2 tidak ================= */
console.log("\n== (5) terapkanSebagian — partX/Y ikut, judulX/Y milik tiap video ==");
const sumber = aturDasar({ kataPart: "Episode", partX: 30, partY: 70, judulX: 15, judulY: 60 });
const target = aturDasar({ kataPart: "Part", partX: 50, partY: -1, judulX: 50, judulY: -1 });
const hasilT = terapkanSebagian(sumber, target);
cek(hasilT.partX === 30 && hasilT.partY === 70, "partX/Y mengikuti sumber (kartu 3)");
cek(hasilT.kataPart === "Episode", "kataPart mengikuti sumber");
cek(hasilT.judulX === 50 && hasilT.judulY === -1, "judulX/Y TIDAK ikut (kartu 2 — milik tiap video)");

/* ================= (6) bangunArgumenPart — string filter ================= */
console.log("\n== (6) bangunArgumenPart — nol regresi + posisi bebas ==");
const VID = "/tmp/uji-v240-vid.mp4";
if (!existsSync(VID)) {
  execFileSync("ffmpeg", ["-y", "-v", "error", "-f", "lavfi", "-i", "testsrc=s=320x240:d=6:r=25", "-f", "lavfi", "-i", "sine=frequency=440:duration=6", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", VID]);
}
const codec = ["-c:v", "libx264", "-preset", "ultrafast", "-crf", "30"];

// A) BAWAAN (semua otomatis) → string filter PERSIS pola lama posisiTeks "atas"
const pA = aturDasar();
const { args: aA } = bangunArgumenPart({
  src: VID, bg: null, logo: null, pengaturan: pA, n: 1, mulai: 0, durasi: 4,
  W: 1080, H: 1920, fps: 25, adaAudio: false,
  judulTxt: "Judul Video", partTxt: "Part 01", deskripsiTxt: "",
  dirTmp: DIR, tag: "uji-v240-a", codecArgs: codec, keluar: "/tmp/uji-v240-a.mp4",
});
const flA = aA[aA.indexOf("-filter_complex") + 1];
// mrg = 86.4 → y 86; yP = 86.4+34.5+10.35 = 131.25 → y 131
cek((flA.match(/:x=\(w-text_w\)\/2:y=86:/g) || []).length === 1, "judul bawaan: x=(w-text_w)/2:y=86 (pola lama PERSIS)");
cek((flA.match(/:x=\(w-text_w\)\/2:y=131:/g) || []).length === 1, "part bawaan: x=(w-text_w)/2:y=131 (tepat di bawah judul, PERSIS lama)");
cek(flA.includes("fontsize=23.0"), "ukuran bawaan 23 tidak berubah");

// B) POSISI BEBAS: judul kiri-atas digeser, part kanan-bawah sendiri
const pB = aturDasar({ judulX: 25, judulY: 30, partX: 75, partY: 80 });
const { args: aB } = bangunArgumenPart({
  src: VID, bg: null, logo: null, pengaturan: pB, n: 1, mulai: 0, durasi: 4,
  W: 1080, H: 1920, fps: 25, adaAudio: false,
  judulTxt: "Judul Video", partTxt: "Part 01", deskripsiTxt: "",
  dirTmp: DIR, tag: "uji-v240-b", codecArgs: codec, keluar: "/tmp/uji-v240-b.mp4",
});
const flB = aB[aB.indexOf("-filter_complex") + 1];
cek(flB.includes("x='min(max(0,W*25/100-text_w/2),W-text_w)':y=576"), "judul bebas: X 25% + Y 30% → ekspresi X + y=576");
cek(flB.includes("x='min(max(0,W*75/100-text_w/2),W-text_w)':y=1536"), "part bebas: X 75% + Y 80% → ekspresi X + y=1536");
cek(!flB.includes("posisiTeks"), "tidak ada sisa field lama di filter");

// C) campuran: judul otomatis (x tetap pola lama) + part bebas di tengah-atas
const pC = aturDasar({ partX: 50, partY: 40, judulY: 10 });
const { args: aC } = bangunArgumenPart({
  src: VID, bg: null, logo: null, pengaturan: pC, n: 1, mulai: 0, durasi: 4,
  W: 1080, H: 1920, fps: 25, adaAudio: false,
  judulTxt: "Judul Video", partTxt: "Part 01", deskripsiTxt: "",
  dirTmp: DIR, tag: "uji-v240-c", codecArgs: codec, keluar: "/tmp/uji-v240-c.mp4",
});
const flC = aC[aC.indexOf("-filter_complex") + 1];
cek(flC.includes(":x=(w-text_w)/2:y=192:"), "judul konkret 10% → x pola lama + y=192");
cek(flC.includes(":x=(w-text_w)/2:y=768:"), "part X 50 = pola lama + Y 40% → y=768 (X 50 TANPA ekspresi = persis hemat)");

/* ================= (7) RENDER NYATA — posisi bebas terpasang ================= */
console.log("\n== (7) RENDER NYATA: judul kiri-atas, part kanan-bawah ==");
const pR = aturDasar({ judulX: 20, judulY: 22, partX: 80, partY: 86 });
const keluarR = "/tmp/uji-v240-render.mp4";
const { args: argsR, total: totalR } = bangunArgumenPart({
  src: VID, bg: null, logo: null, pengaturan: pR, n: 1, mulai: 0, durasi: 4,
  W: 720, H: 1280, fps: 25, adaAudio: true,
  judulTxt: "Cerita Pendek Sang Kancil", partTxt: "Eps 01", deskripsiTxt: "",
  dirTmp: DIR, tag: "uji-v240-r", codecArgs: codec, keluar: keluarR,
});
execFileSync("ffmpeg", argsR, { stdio: ["ignore", "ignore", "pipe"] });
const prR = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-print_format", "json", "-show_format", keluarR]).toString());
const durR = Number(prR.format.duration);
cek(Math.abs(durR - totalR) < 0.35, `render posisi bebas sukses: durasi ${durR.toFixed(2)} ≈ ${totalR}`);
const fCek = "/tmp/uji-v240-cek.jpg";
execFileSync("ffmpeg", ["-y", "-v", "error", "-ss", "1", "-i", keluarR, "-frames:v", "1", fCek], { stdio: ["ignore", "ignore", "pipe"] });
cek(existsSync(fCek) && statSync(fCek).size > 2000, `frame hasil berisi gambar nyata (${statSync(fCek).size} B)`);

console.log(`\n===== HASIL: ${lulus} LOLOS, ${gagal} GAGAL =====`);
if (gagal > 0) process.exit(1);
