// VidSplit v0.45.0 — uji unit PRATINJAU SUBTITLE AI (fungsi murni pratinjauSub.ts)
// Jalankan: bun scripts/uji-pratinjau-sub.ts
import {
  DURASI_PRATINJAU_SUB,
  dimensiPratinjau,
  formatWaktuSub,
  labelBahasa,
  MAKS_BARIS_TAMPIL,
  potongSegmenTampil,
} from "../src/lib/vidsplit/pratinjauSub";

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

// ============ dimensiPratinjau ============
// mode frame (blur/crop/warna) → ekspor selalu 9:16 → pratinjau 540x960
cek("dimensi: blur → 540x960", JSON.stringify(dimensiPratinjau("blur", 1920, 1080)) === JSON.stringify({ W: 540, H: 960 }));
cek("dimensi: crop → 540x960", JSON.stringify(dimensiPratinjau("crop", 640, 640)) === JSON.stringify({ W: 540, H: 960 }));
cek("dimensi: warna → 540x960", JSON.stringify(dimensiPratinjau("warna", 0, 0)) === JSON.stringify({ W: 540, H: 960 }));
// mode asli → rasio sumber dipertahankan, sisi terpendek 540, hasil genap
const asliPotret = dimensiPratinjau("asli", 1080, 1920);
cek("dimensi: asli potret 1080x1920 → 540x960", asliPotret.W === 540 && asliPotret.H === 960, asliPotret);
const asliLanskap = dimensiPratinjau("asli", 1920, 1080);
cek("dimensi: asli lanskap 1920x1080 → 960x540", asliLanskap.W === 960 && asliLanskap.H === 540, asliLanskap);
const asliPersegi = dimensiPratinjau("asli", 800, 800);
cek("dimensi: asli persegi 800x800 → 540x540", asliPersegi.W === 540 && asliPersegi.H === 540, asliPersegi);
const asliGanjil = dimensiPratinjau("asli", 853, 479);
cek("dimensi: asli ganjil 853x479 → genap, sisi pendek ±540", asliGanjil.W % 2 === 0 && asliGanjil.H % 2 === 0, asliGanjil);
const asliKecil = dimensiPratinjau("asli", 240, 320);
cek("dimensi: asli kecil 240x320 → digenapkan naik", asliKecil.W === 540 && asliKecil.H === 720, asliKecil);
cek("dimensi: asli nol → fallback 540x960", JSON.stringify(dimensiPratinjau("asli", 0, 0)) === JSON.stringify({ W: 540, H: 960 }));
// proporsi selalu 9:16 utk mode frame — konsisten dgn ekspor (subtitle proporsional)
const f = dimensiPratinjau("blur", 100, 100);
cek("dimensi: rasio frame 9:16", Math.abs(f.W / f.H - 540 / 960) < 1e-9);

// ============ formatWaktuSub ============
cek("waktu: 0 → 0:00", formatWaktuSub(0) === "0:00");
cek("waktu: 4.7 → 0:04", formatWaktuSub(4.7) === "0:04");
cek("waktu: 65 → 1:05", formatWaktuSub(65) === "1:05");
cek("waktu: 600 → 10:00", formatWaktuSub(600) === "10:00");
cek("waktu: negatif → 0:00", formatWaktuSub(-3) === "0:00");
cek("waktu: NaN → 0:00", formatWaktuSub(NaN) === "0:00");

// ============ potongSegmenTampil ============
const seg = [
  { a: 0, b: 2.5, t: "Selamat datang" },
  { a: 3, b: 6, t: "di podcast kita" },
  { a: 7, b: 9, t: "" }, // kosong → dibuang
  { a: "x", b: 9, t: "rusak" }, // a tak valid → dibuang
  { a: 10, b: 12, t: "baris ketiga" },
];
const pot = potongSegmenTampil(seg);
cek("potong: 3 segmen valid", pot.length === 3, pot);
cek("potong: urutan & isi utuh", pot[0].t === "Selamat datang" && pot[2].t === "baris ketiga");
cek("potong: null → []", potongSegmenTampil(null).length === 0);
cek("potong: undefined → []", potongSegmenTampil(undefined).length === 0);
cek("potong: angka → []", potongSegmenTampil(42).length === 0);
const banyak = Array.from({ length: 100 }, (_, i) => ({ a: i, b: i + 1, t: `b${i}` }));
cek("potong: default maks = MAKS_BARIS_TAMPIL", potongSegmenTampil(banyak).length === MAKS_BARIS_TAMPIL);
cek("potong: maks khusus 5", potongSegmenTampil(banyak, 5).length === 5);
cek("potong: maks 0 → 1 (lantai aman)", potongSegmenTampil(banyak, 0).length === 1);
cek("potong: maks 999 → dipangkas ke 200", potongSegmenTampil(Array.from({ length: 300 }, (_, i) => ({ a: i, b: i + 1, t: `x${i}` })), 999).length === 200);

// ============ labelBahasa ============
cek("label: id", labelBahasa("id", false) === "Suara Indonesia");
cek("label: en diterjemahkan", labelBahasa("en", true) === "Suara Inggris → diterjemahkan Indonesia");
cek("label: en tanpa penerjemah", labelBahasa("en", false) === "Suara Inggris (penerjemah tidak tersedia)");

// ============ konstanta ============
cek("konstanta: durasi pratinjau 15 dtk", DURASI_PRATINJAU_SUB === 15);
cek("konstanta: maks baris 60", MAKS_BARIS_TAMPIL === 60);

console.log(`\nuji-pratinjau-sub: ${lulus} LULUS, ${gagal} GAGAL`);
if (gagal > 0) process.exit(1);
