// Uji v0.52.0 (diperbarui v0.54.0) — pemeriksaan piksel 14 PNG bingkai horor
// baru (7 desain × 2 rasio):
//   1) TENGAH HARUS TEMBUS PANDANG (alpha rata < 40/255) — video terlihat
//   2) SISI TIPIS (SYARAT USER): strip tengah 13%–87% lebar pada ketinggian
//      40–60% harus kosong (alpha < 40) — hiasan sisi TIDAK BOLEH melewati
//      batas ±13% lebar; dan strip 1.5%–11% per sisi HARUS berisi (frame +
//      hiasan sisi tipis memang ada).
//   3) zona atas harus ada piksel (teks ALAM GAIB + motif)
//   4) pita bawah harus ada piksel (pita gradasi + ornamen — TANPA teks, v0.54.0)
//   5) TULISAN NAMA DESAIN HILANG: strip tengah pada ketinggian tema lama
//      (nama desain TENGGKORAK BERTANDUK dsb.) kosong — v0.54.0 hanya
//      "ALAM GAIB" yang tersisa di atas (permintaan user)
//   6) dimensi benar per rasio (teks menyentuh atas diverifikasi visual)
// Jalankan: bun scripts/uji-bingkai-alpha-v52.ts
import { existsSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

let lolos = 0;
let total = 0;
function ok(kondisi: boolean, nama: string, detail?: unknown) {
  total++;
  if (kondisi) {
    lolos++;
    console.log(`  ✓ ${nama}`);
  } else {
    console.error(`  ✗ GAGAL: ${nama}`, detail ?? "");
  }
}

const DIR = path.join(process.cwd(), "public", "bingkai");
// v0.57.0 — daftar frame horor diperluas: 3–9 (v0.52) + 10–19 (v0.57, pocong &
// kuntilanak dkk) — semua diuji aturan yang sama
const HOROR_V52 = [
  "horor-alam-gaib-3",
  "horor-alam-gaib-4",
  "horor-alam-gaib-5",
  "horor-alam-gaib-6",
  "horor-alam-gaib-7",
  "horor-alam-gaib-8",
  "horor-alam-gaib-9",
  "horor-alam-gaib-10",
  "horor-alam-gaib-11",
  "horor-alam-gaib-12",
  "horor-alam-gaib-13",
  "horor-alam-gaib-14",
  "horor-alam-gaib-15",
  "horor-alam-gaib-16",
  "horor-alam-gaib-17",
  "horor-alam-gaib-18",
  "horor-alam-gaib-19",
];

async function alphaRata(img: sharp.Sharp, kiri: number, atas: number, w: number, h: number): Promise<number> {
  const buf = await img.clone().extract({ left: kiri, top: atas, width: w, height: h }).raw().toBuffer();
  let sum = 0;
  const ch = 4; // RGBA
  for (let i = 3; i < buf.length; i += ch) sum += buf[i];
  return sum / ((buf.length / ch) || 1);
}

/** v0.54.0 — jumlah piksel OPAK & TERANG (utk deteksi teks di zona atas yang
 *  berlatar gelap-OPAK — alpha di sana selalu 255, jadi diukur kecerahannya). */
async function pikselTerang(img: sharp.Sharp, kiri: number, atas: number, w: number, h: number, ambang = 140): Promise<number> {
  const buf = await img.clone().extract({ left: kiri, top: atas, width: w, height: h }).raw().toBuffer();
  let n = 0;
  for (let i = 0; i < buf.length; i += 4) {
    if (buf[i + 3] < 200) continue;
    if ((buf[i] + buf[i + 1] + buf[i + 2]) / 3 > ambang) n++;
  }
  return n;
}

for (const slug of HOROR_V52) {
  for (const varian of ["916", "169"] as const) {
    const p = path.join(DIR, `${slug}-${varian}.png`);
    if (!existsSync(p)) {
      ok(false, `${slug}-${varian}: berkas ada`, p);
      continue;
    }
    const meta = await sharp(p).metadata();
    const W = meta.width ?? 0;
    const H = meta.height ?? 0;
    const potret = varian === "916";
    ok(potret ? W === 1080 && H === 1920 : W === 1920 && H === 1080, `${slug}-${varian}: dimensi ${W}×${H}`);

    const img = sharp(p).ensureAlpha();

    const tengah = await alphaRata(img, Math.round(W * 0.3), Math.round(H * 0.42), Math.round(W * 0.4), Math.round(H * 0.2));
    ok(tengah < 40, `${slug}-${varian}: tengah tembus pandang (alpha ${tengah.toFixed(2)} < 40)`);

    // SYARAT USER — sisi kiri-kanan TIPIS: tidak ada hiasan melewati 13% lebar
    const sisiKiriLebar = Math.round(W * 0.13);
    const zonaTengahLebar = W - 2 * sisiKiriLebar;
    const stripTengah = await alphaRata(
      img,
      sisiKiriLebar,
      Math.round(H * 0.4),
      zonaTengahLebar,
      Math.round(H * 0.2),
    );
    ok(stripTengah < 40, `${slug}-${varian}: sisi tipis — strip 13–87% kosong (alpha ${stripTengah.toFixed(2)} < 40)`);

    // sisi tipis MEMANG ADA di 1.5–11% lebar (bingkai + hiasan sisi)
    const sisiKiri = await alphaRata(img, Math.round(W * 0.015), Math.round(H * 0.4), Math.round(W * 0.095), Math.round(H * 0.2));
    const sisiKanan = await alphaRata(img, Math.round(W * 0.89), Math.round(H * 0.4), Math.round(W * 0.095), Math.round(H * 0.2));
    ok(sisiKiri > 1, `${slug}-${varian}: hiasan sisi kiri ada (alpha ${sisiKiri.toFixed(2)} > 1)`);
    ok(sisiKanan > 1, `${slug}-${varian}: hiasan sisi kanan ada (alpha ${sisiKanan.toFixed(2)} > 1)`);

    const atas = await alphaRata(img, Math.round(W * 0.2), Math.round(H * 0.04), Math.round(W * 0.6), Math.round(H * 0.08));
    ok(atas > 3, `${slug}-${varian}: zona atas berisi (alpha ${atas.toFixed(2)})`);

    const bawah = await alphaRata(img, Math.round(W * 0.2), Math.round(H - (potret ? 120 : 110)), Math.round(W * 0.6), 70);
    ok(bawah > 3, `${slug}-${varian}: pita bawah berisi (alpha ${bawah.toFixed(2)})`);

    // v0.54.0 — nama desain dihapus: strip tengah pada posisi teks tema lama
    // (temaY = baseline hero + 102/84, huruf Cinzel 52/42) harus TANPA piksel
    // terang (zona atas opak-gelap — teks lama berwarna terang mudah terdeteksi)
    const s = Math.min(W, H) / 1080;
    const cap = 0.75;
    const fsHero = potret ? 150 : 116;
    const temaY = Math.round(fsHero * cap + 34 * s + (potret ? 102 : 84));
    const tTema = potret ? 52 : 42;
    const stripTema = await pikselTerang(
      img,
      Math.round(W * 0.3),
      temaY - Math.round(tTema * 0.85),
      Math.round(W * 0.4),
      Math.round(tTema * 0.62),
    );
    // ornamen kecil (bara/kunang) boleh lolos — tulisan lama ±2000+ piksel terang
    ok(stripTema <= 100, `${slug}-${varian}: nama desain hilang (piksel terang strip tema = ${stripTema} ≤ 100)`);
  }
}

console.log(`\n${lolos}/${total} uji LOLOS`);
if (lolos !== total) process.exit(1);
console.log("=== SEMUA UJI ALPHA BINGKAI HOROR v52 LOLOS ===");
