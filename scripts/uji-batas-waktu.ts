// VidSplit v0.55.0 — uji BATAS WAKTU ADAPTIF ffmpeg (laporan user: eksport gagal
// "ffmpeg melewati batas waktu 675 detik" padahal stderr menunjukkan time= MASIH
// BERTAMBAH — proses maju, bukan macet). Batas absolut kaku diganti tenggat yang
// diperpanjang tiap media maju, plus batas keras 2 jam sebagai jaring terakhir.
// v0.57.1 — laporan user baru: "ffmpeg macet (tidak ada progres 40 detik)" dgn
// stderr terakhir hanya pesan inisialisasi font/libass (fontselect) — frame
// PERTAMA yang berat tak menulis time= sama sekali → dibunuh padahal bekerja.
// Kini: fase awal diberi diamAwalMs (bawaan 150 dtk) berbasis tanda hidup stderr
// + aturan bekuMediaMs (stderr hidup tapi time= tak naik → terhenti).
// Jalankan: bun scripts/uji-batas-waktu.ts
import { jalankanFfmpeg, hitungBatasKeras, perpanjangTenggat } from "../src/lib/vidsplit/ffmpeg";
import path from "node:path";

let lulus = 0;
let gagal = 0;
function cek(nama: string, kondisi: boolean, detail?: unknown) {
  if (kondisi) {
    lulus += 1;
  } else {
    gagal += 1;
    console.error(`  GAGAL: ${nama}`, detail ?? "");
  }
}

// ===================== unit hitungBatasKeras =====================
cek("batas keras: 675 dtk → 2 jam", hitungBatasKeras(675_000) === 2 * 3_600_000);
cek("batas keras: 400 dtk (×6 < 2 jam) → 2 jam", hitungBatasKeras(400_000) === 2 * 3_600_000);
cek("batas keras: 30 mnt (×6 > 2 jam) → 3 jam", hitungBatasKeras(1_800_000) === 10_800_000);

// ===================== unit perpanjangTenggat =====================
const T0 = 1_000_000; // epoch ms mulai (murni utk hitungan)

// 1) media beku (delta ≤ 0,001) → tenggat TIDAK berubah (nanti dibunuh tenggat/diamMs)
cek(
  "perpanjang: delta 0 → tak berubah",
  perpanjangTenggat(5_000_000, 2_000_000, T0, 675_000, 45, 42.6, 42.6) === 5_000_000,
);
// 1b) v0.56.0 — maju kecil-kecil (0,05 dtk/event persis kasus user fps=1,9) KINI
//     dihitung maju → tenggat digeser (ambang lama 0,25 membuat perpanjangan tak
//     pernah terjadi — laporan user kedua: dibunuh di tenggat dasar 300 dtk)
const b1b = perpanjangTenggat(T0 + 300_000, T0 + 300_000, T0, 300_000, 20, 18.85, 18.80);
cek("perpanjang: maju kecil 0,05 dtk → tenggat digeser (v0.56)", b1b > T0 + 300_000);
// 2) KASUS LAPORAN USER: 675 dtk berjalan, media 42,6/45 (kecepatan 15,85x) →
//    dulu: DIBUNUH persis di sini. Kini: estimasi sisa 38 dtk → tenggat digeser.
const tenggatLama = T0 + 675_000;
const baru = perpanjangTenggat(tenggatLama, T0 + 675_000, T0, 675_000, 45, 42.6, 42.3);
cek("perpanjang: kasus user — tenggat melewati batas lama", baru > tenggatLama);
cek(
  "perpanjang: kasus user — tambah = lantai absolutMs (675 dtk)",
  baru === T0 + 675_000 + 675_000,
);
// 3) render sehat: kecepatan rendah → tambah tetap dilantai ke absolutMs
const b3 = perpanjangTenggat(T0 + 675_000, T0 + 22_500, T0, 675_000, 45, 10, 9.5);
cek("perpanjang: render cepat — lantai absolutMs", b3 === T0 + 22_500 + 675_000);
// 4) mulai super lambat (60 dtk wall utk 1 dtk media) → plafon absolutMs×4
const b4 = perpanjangTenggat(T0 + 675_000, T0 + 60_000, T0, 675_000, 45, 1, 0.5);
cek("perpanjang: plafon absolutMs×4", b4 === T0 + 60_000 + 2_700_000);
// 5) tenggat lama lebih besar dr hasil perpanjangan → dipertahankan (max)
const b5 = perpanjangTenggat(T0 + 9_000_000, T0 + 1_000, T0, 675_000, 45, 5, 4);
cek("perpanjang: tenggat lama lebih besar → dipertahankan", b5 === T0 + 9_000_000);

// ===================== integrasi dgn ffmpeg palsu =====================
const fake = path.join(import.meta.dir, "fake-ffmpeg.sh");

// A. LAMBAT TAPI MAJU → SELESAI (perilaku lama: DIBUNUH di 4 dtk — persis kasus user)
process.env.FAKE_FFMPEG_MODE = "lambat";
let oke = false;
let errA = "";
try {
  await jalankanFfmpeg(["-nostdin"], 10, undefined, fake, undefined, {
    absolutMs: 4_000,
    diamMs: 10_000,
  });
  oke = true;
} catch (e) {
  errA = e instanceof Error ? e.message : String(e);
}
cek("integrasi: render lambat-tapi-maju SELESAI (dulu dibunuh di 4 dtk)", oke, errA);

// B. BEKU SUNYI (stderr berhenti) → tetap tertangkap diamMs sebagai "macet"
process.env.FAKE_FFMPEG_MODE = "beku";
let msgB = "";
try {
  await jalankanFfmpeg(["-nostdin"], 10, undefined, fake, undefined, {
    absolutMs: 60_000,
    diamMs: 2_500,
  });
} catch (e) {
  msgB = e instanceof Error ? e.message : String(e);
}
cek("integrasi: beku sunyi → macet", msgB.includes("macet"), msgB);

// C. time= BEKU tapi stderr mengalir → tenggat TIDAK diperpanjang → "macet pelan"
process.env.FAKE_FFMPEG_MODE = "beku-waktu";
let msgC = "";
const tC = Date.now();
try {
  await jalankanFfmpeg(["-nostdin"], 10, undefined, fake, undefined, {
    absolutMs: 4_000,
    diamMs: 30_000,
  });
} catch (e) {
  msgC = e instanceof Error ? e.message : String(e);
}
const dC = Date.now() - tC;
cek("integrasi: time= beku → macet pelan", msgC.includes("macet pelan"), msgC);
cek("integrasi: time= beku dibunuh dekat tenggat (3,5–9,5 dtk)", dC >= 3_500 && dC <= 9_500, `${dC} ms`);

// D. pesan galat menyertakan diagnosa kecepatan utk kasus C
cek("integrasi: pesan macet pelan menyertakan kecepatan", msgC.includes("kecepatan"), msgC);

// E. v0.56.0 — KRIEK: maju kecil-kecil (0,05 dtk tiap 0,2 dtk wall) → SELESAI
//    (perilaku lama v0.55: ambang 0,25/event → tenggat tak pernah digeser →
//    DIBUNUH di absolutMs 4 dtk — persis laporan user "melewati batas waktu")
process.env.FAKE_FFMPEG_MODE = "kriek";
let okeE = false;
let errE = "";
const tE = Date.now();
try {
  await jalankanFfmpeg(["-nostdin"], 2, undefined, fake, undefined, {
    absolutMs: 4_000,
    diamMs: 5_000,
  });
  okeE = true;
} catch (e) {
  errE = e instanceof Error ? e.message : String(e);
}
const dE = Date.now() - tE;
cek("integrasi: kriek maju kecil-kecil SELESAI (dulu dibunuh di 4 dtk)", okeE, errE);
cek("integrasi: kriek selesai ±8–14 dtk (0,06x jalan sampai tuntas)", dE >= 7_500 && dE <= 14_000, `${dE} ms`);

// F. v0.57.1 — KASUS LAPORAN USER: inisialisasi font/libass + frame pertama
//    berat (SUNYI > diamMs tanpa time= sama sekali). v0.57.0: DIBUNUH "macet"
//    padahal bekerja; v0.57.1: fase awal diberi diamAwalMs → SELESAI.
process.env.FAKE_FFMPEG_MODE = "frame-berat";
let okeF = false;
let errF = "";
const tF = Date.now();
try {
  await jalankanFfmpeg(["-nostdin"], 10, undefined, fake, undefined, {
    absolutMs: 60_000,
    diamMs: 5_000, // v0.57.0: membunuh di sini saat fase awal
    diamAwalMs: 12_000, // v0.57.1: masa tenggang frame pertama
  });
  okeF = true;
} catch (e) {
  errF = e instanceof Error ? e.message : String(e);
}
const dF = Date.now() - tF;
cek("integrasi: frame pertama berat (font init + sunyi) SELESAI (v0.57.0: dibunuh)", okeF, errF);
cek("integrasi: frame pertama berat selesai ±9–14 dtk (sunyi 8 + render cepat)", dF >= 7_500 && dF <= 14_000, `${dF} ms`);

// G. v0.57.1 — stderr HIDUP tapi time= TAK NAIK → bekuMediaMs menangkap
//    ("media tidak maju"); dulu menggantung sampai tenggat (60 dtk).
process.env.FAKE_FFMPEG_MODE = "beku-media";
let msgG = "";
const tG = Date.now();
try {
  await jalankanFfmpeg(["-nostdin"], 10, undefined, fake, undefined, {
    absolutMs: 60_000,
    diamMs: 30_000,
    bekuMediaMs: 4_000,
  });
} catch (e) {
  msgG = e instanceof Error ? e.message : String(e);
}
const dG = Date.now() - tG;
cek("integrasi: stderr hidup + time= tak naik → 'media tidak maju'", msgG.includes("media tidak maju"), msgG);
cek("integrasi: beku-media dibunuh dekat bekuMediaMs (4–9,5 dtk)", dG >= 3_500 && dG <= 9_500, `${dG} ms`);

// H. v0.57.1 — fase awal SUNYI TOTAL tanpa time= → dibunuh diamAwalMs dgn
//    pesan yang JELAS (dulu: "macet 40 detik — file rusak" yang menyesatkan).
//    Catatan: ambang fase awal = max(diamMs, diamAwalMs) — tak boleh lebih
//    ketat dr fase jalan — jadi diamMs ikut diperkecil di skenario ini.
process.env.FAKE_FFMPEG_MODE = "sunyi";
let msgH = "";
const tH = Date.now();
try {
  await jalankanFfmpeg(["-nostdin"], 10, undefined, fake, undefined, {
    absolutMs: 90_000,
    diamMs: 5_000,
    diamAwalMs: 6_000,
  });
} catch (e) {
  msgH = e instanceof Error ? e.message : String(e);
}
const dH = Date.now() - tH;
cek("integrasi: fase awal sunyi total → pesan 'belum menghasilkan frame pertama'", msgH.includes("belum menghasilkan frame pertama"), msgH);
cek("integrasi: fase awal sunyi dibunuh dekat diamAwalMs (8–13,5 dtk)", dH >= 7_500 && dH <= 13_500, `${dH} ms`);

console.log(`\nHASIL: ${lulus} lulus, ${gagal} gagal`);
process.exit(gagal ? 1 : 0);
