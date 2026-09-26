// Uji unit terapkanSebagian — v0.38.0 "Terapkan pengaturan video #N ke SEMUA video"
// yang kini SELEKTIF: hanya kartu 1 (vertikal), 3 (Part otomatis) & 5 (watermark)
// yang mengikuti video sumber; judul (kartu 2), background (kartu 4) & performa
// ekspor tetap milik tiap video.
import { pengaturanDefault, terapkanSebagian, type Pengaturan } from "../src/lib/vidsplit/types";

let lulus = 0;
let gagal = 0;
function cek(nama: string, ok: boolean, detail = "") {
  if (ok) lulus++;
  else {
    gagal++;
    console.log(`GAGAL: ${nama}${detail ? ` — ${detail}` : ""}`);
  }
}

// sumber = video #1 yang diatur lengkap; target = video lain dgn nilai BERBEDA di semua bidang
const sumber: Pengaturan = {
  ...pengaturanDefault,
  // kartu 1
  mode: "crop",
  warnaLatar: "#0ea5e9",
  posisiPotong: 72,
  resolusi: "720",
  codec: "h265",
  mulaiDetik: 15,
  akhirDetik: 95,
  // kartu 2 — judul khas video #1
  judul: "Judul Video Satu",
  gayaJudul: { font: "creepster", ukuran: 88, warna: "#ff0044", outlineLebar: 9, outlineWarna: "#110000" },
  // kartu 4 — deskripsi khas video #1 (v0.39.0: TIDAK ikut tersalin)
  deskripsi: "Deskripsi khas video satu",
  gayaDeskripsi: { font: "oswald", ukuran: 40, warna: "#00ddff", outlineLebar: 4, outlineWarna: "#001122" },
  deskripsiX: 12.5,
  deskripsiY: 90.5,
  // kartu 3
  kataPart: "Bagian",
  durasiPart: 45,
  gayaPart: { font: "anton", ukuran: 52, warna: "#fbbf24", outlineLebar: 6, outlineWarna: "#000000" },
  posisiTeks: "tengah",
  // kartu 4
  bgId: "bg-sumber.png",
  durasiIntro: 7,
  // kartu 5
  logoId: "logo-sumber.png",
  posisiLogo: "kiri-atas",
  logoX: 3.5,
  logoY: 3,
  ukuranLogo: 22,
  // performa ekspor
  prosesParalel: 4,
  pakaiGpu: false,
};

const target: Pengaturan = {
  ...pengaturanDefault,
  // kartu 1 milik video lain (harus DIGANTI oleh sumber)
  mode: "blur",
  warnaLatar: "#111827",
  posisiPotong: 50,
  resolusi: "1080",
  codec: "h264",
  mulaiDetik: 0,
  akhirDetik: 0,
  // kartu 2 — JUDUL KHAS VIDEO LAIN (harus TETAP)
  judul: "Judul Khas Video Dua",
  gayaJudul: { font: "cinzel", ukuran: 33, warna: "#00ff88", outlineLebar: 2, outlineWarna: "#001100" },
  // kartu 4 — DESKRIPSI KHAS VIDEO LAIN (harus TETAP, v0.39.0)
  deskripsi: "Deskripsi khas video dua",
  gayaDeskripsi: { font: "bersih", ukuran: 24, warna: "#ffffff", outlineLebar: 1, outlineWarna: "#000000" },
  deskripsiX: 70,
  deskripsiY: 20,
  // kartu 3 (harus DIGANTI)
  kataPart: "Part",
  durasiPart: 20,
  gayaPart: { font: "tebal", ukuran: 35, warna: "#ffffff", outlineLebar: 3, outlineWarna: "#000000" },
  posisiTeks: "atas",
  // kartu 4 — background milik video lain (harus TETAP)
  bgId: "bg-lain.jpg",
  durasiIntro: 2,
  // kartu 5 (harus DIGANTI)
  logoId: "logo-lama.png",
  posisiLogo: "kanan-bawah",
  logoX: 81.5,
  logoY: 88.5,
  ukuranLogo: 15,
  // performa ekspor milik video lain (harus TETAP)
  prosesParalel: 1,
  pakaiGpu: true,
};

const hasil = terapkanSebagian(sumber, target);

// ===== kartu 1 — Cara ubah ke vertikal: MENGIKUTI sumber =====
cek("mode mengikuti", hasil.mode === "crop");
cek("warnaLatar mengikuti", hasil.warnaLatar === "#0ea5e9");
cek("posisiPotong mengikuti", hasil.posisiPotong === 72);
cek("resolusi mengikuti", hasil.resolusi === "720");
cek("codec mengikuti", hasil.codec === "h265");
cek("mulaiDetik mengikuti", hasil.mulaiDetik === 15);
cek("akhirDetik mengikuti", hasil.akhirDetik === 95);

// ===== kartu 2 — Tulisan judul: TIDAK IKUT, tetap milik target =====
cek("judul TIDAK ikut", hasil.judul === "Judul Khas Video Dua", `dapat "${hasil.judul}"`);
cek("gayaJudul TIDAK ikut — font", hasil.gayaJudul.font === "cinzel");
cek("gayaJudul TIDAK ikut — ukuran", hasil.gayaJudul.ukuran === 33);
cek("gayaJudul TIDAK ikut — warna", hasil.gayaJudul.warna === "#00ff88");
cek("gayaJudul tetap objek target sendiri (bukan referensi sumber)", hasil.gayaJudul !== sumber.gayaJudul);

// ===== kartu 4 — Tulis Deskripsi: TIDAK IKUT, tetap milik target (v0.39.0) =====
cek("deskripsi TIDAK ikut", hasil.deskripsi === "Deskripsi khas video dua", `dapat "${hasil.deskripsi}"`);
cek("gayaDeskripsi TIDAK ikut — font", hasil.gayaDeskripsi.font === "bersih");
cek("gayaDeskripsi TIDAK ikut — ukuran", hasil.gayaDeskripsi.ukuran === 24);
cek("gayaDeskripsi tetap objek target sendiri (bukan referensi sumber)", hasil.gayaDeskripsi !== sumber.gayaDeskripsi);
cek("deskripsiX TIDAK ikut", hasil.deskripsiX === 70);
cek("deskripsiY TIDAK ikut", hasil.deskripsiY === 20);

// ===== kartu 3 — Tulisan Part otomatis: MENGIKUTI sumber =====
cek("kataPart mengikuti", hasil.kataPart === "Bagian");
cek("durasiPart mengikuti", hasil.durasiPart === 45);
cek("gayaPart mengikuti — font", hasil.gayaPart.font === "anton");
cek("gayaPart mengikuti — ukuran", hasil.gayaPart.ukuran === 52);
cek("gayaPart mengikuti — warna", hasil.gayaPart.warna === "#fbbf24");
cek("posisiTeks mengikuti", hasil.posisiTeks === "tengah");

// ===== kartu 4 — Background intro: TIDAK IKUT =====
cek("bgId TIDAK ikut", hasil.bgId === "bg-lain.jpg", `dapat "${hasil.bgId}"`);
cek("durasiIntro TIDAK ikut", hasil.durasiIntro === 2, `dapat ${hasil.durasiIntro}`);

// ===== kartu 5 — Watermark / logo: MENGIKUTI sumber =====
cek("logoId mengikuti", hasil.logoId === "logo-sumber.png", `dapat "${hasil.logoId}"`);
cek("posisiLogo mengikuti", hasil.posisiLogo === "kiri-atas");
cek("logoX mengikuti", hasil.logoX === 3.5);
cek("logoY mengikuti", hasil.logoY === 3);
cek("ukuranLogo mengikuti", hasil.ukuranLogo === 22);

// ===== performa ekspor: TIDAK IKUT =====
cek("prosesParalel TIDAK ikut", hasil.prosesParalel === 1, `dapat ${hasil.prosesParalel}`);
cek("pakaiGpu TIDAK ikut", hasil.pakaiGpu === true);

// ===== kebersihan referensi =====
cek("gayaPart hasil SALINAN baru", hasil.gayaPart !== sumber.gayaPart && hasil.gayaPart !== target.gayaPart);
const salinanGaya = { ...hasil.gayaPart };
salinanGaya.ukuran = 999;
cek("mengubah salinan gaya tak merusak sumber", sumber.gayaPart.ukuran === 52);
cek("target asli tak terubah (fungsi murni)", target.judul === "Judul Khas Video Dua" && target.mode === "blur" && target.bgId === "bg-lain.jpg");

// ===== kasus: video sumber TANPA logo → semua video ikut TANPA logo =====
const sumberTanpaLogo: Pengaturan = { ...sumber, logoId: "" };
const hasil2 = terapkanSebagian(sumberTanpaLogo, target);
cek("tanpa logo di sumber → logoId target dikosongkan", hasil2.logoId === "");
cek("tanpa logo di sumber → posisi logo tetap ikut sumber", hasil2.posisiLogo === "kiri-atas");

// ===== kasus: bidang default tetap utuh (tidak ada bidang hilang) =====
const kunciPengaturan = Object.keys(pengaturanDefault).sort().join(",");
const kunciHasil = Object.keys(hasil).sort().join(",");
cek("semua bidang Pengaturan tetap ada", kunciPengaturan === kunciHasil, `${kunciHasil}`);

console.log(`\n${lulus}/${lulus + gagal} lulus`);
process.exit(gagal === 0 ? 0 : 1);
