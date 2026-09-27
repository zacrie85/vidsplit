// VidSplit v0.42.0 — pembungkus teks otomatis (word-wrap) yang DIPAKAI BERSAMA
// oleh pratinjau browser & render ffmpeg drawtext.
//
// MASALAH YANG DIPERBAIKI (laporan user): "jika aku besarkan ukuran font nya maka
// di video preview nya font nya akan bergeser ke bawah, akan tetapi hasil eksport
// dan split videonya tulisannya malah hanya lurus saja sehingga tulisan terpotong
// di awal dan di akhir" — pratinjau CSS melipat teks panjang ke baris baru, tetapi
// drawtext ffmpeg menggambar teks SATU BARIS lurus tanpa melipat, sehingga teks
// besar keluar dari frame & terpotong kiri-kanan.
//
// SOLUSI: teks DIBUNGKUS sekali di JS (baris baru disisipkan) dengan estimasi
// lebar karakter per font, lalu:
//   • render  → teks terbungkus ditulis ke textfile drawtext (multi-baris asli);
//   • pratinjau → teks terbungkus DITAMPILKAN APA ADANYA (whitespace-pre), jadi
//     posisi pindah baris di pratinjau = PERSIS di hasil ekspor/split.
//
// Murni & bebas node:* — aman diimpor komponen client maupun lib server.
import type { GayaTeks, NamaFont, Pengaturan } from "./types";

/**
 * Faktor lebar rata-rata karakter per font — pecahan dari ukuran font (em).
 * Nilai sengaja KONSERVATIF (sedikit lebih besar dari metrik asli font) agar
 * hasil render TIDAK PERNAH meluber keluar frame; akibatnya garis baru bisa
 * terjadi 1–2 karakter lebih awal — kosmetik saja, dan konsisten di pratinjau.
 */
const FAKTOR_LEBAR_FONT: Record<NamaFont, number> = {
  tebal: 0.64, // DejaVu Sans (dipakai bold di pratinjau)
  bersih: 0.6, // DejaVu Sans reguler
  klasik: 0.64, // DejaVu Serif
  bebas: 0.46, // Bebas Neue — sempit
  anton: 0.54,
  cinzel: 0.74,
  cinzeldec: 0.78, // Cinzel Decorative Bold — lebar
  playfair: 0.6,
  marcellus: 0.58,
  julius: 0.62,
  oswald: 0.52,
  sixcaps: 0.36, // Six Caps — sangat sempit
  teko: 0.52,
  alfaslab: 0.68,
  abril: 0.62,
  blackops: 0.68,
  creepster: 0.62,
  monoton: 0.92, // Monoton — sangat lebar
};

/** Faktor font tak dikenal (jaga-jaga) */
const FAKTOR_BAWAAN = 0.66;

/** Pengaman ekstra di atas faktor tabel — garis baru sedikit lebih awal */
const AMAN_LEBAR = 1.06;

/** v0.42.0 — lebar maks teks = 92% lebar frame (sisi kiri-kanan ≈ 4% + pengaman),
 *  menyamai padding px-[4cqw] blok teks di pratinjau live. */
export const BATAS_LEBAR_TEKS = 0.92;

/** Skala ukuran font render terhadap pengaturan: sisi TERPENDEK frame / 1080.
 *  (Vertikal 1080×1920 → 1, 720×1280 → 0.667, dst — identik dgn rantaiTeks.) */
export function skalaTeksRender(W: number, H: number): number {
  return Math.min(W, H) / 1080;
}

/** Perkiraan lebar satu baris teks dalam px render */
function lebarPerkiraan(teks: string, ukuranPx: number, font: NamaFont): number {
  return Array.from(teks).length * (FAKTOR_LEBAR_FONT[font] ?? FAKTOR_BAWAAN) * AMAN_LEBAR * ukuranPx;
}

/**
 * Lipat teks ke beberapa baris agar tiap baris muat dalam lebarPx.
 *   • baris baru (\n) buatan user dipertahankan — tiap paragraf dilipat sendiri;
 *   • kata yang lebih panjang dari satu baris dipotong keras per karakter;
 *   • input kosong / nilai tak valid → dikembalikan apa adanya (tanpa lipat).
 * Murni — input tidak diubah.
 */
export function bungkusTeks(
  teks: string,
  lebarPx: number,
  ukuranPx: number,
  font: NamaFont,
): string {
  if (!teks) return teks;
  if (!Number.isFinite(lebarPx) || !Number.isFinite(ukuranPx) || lebarPx <= 0 || ukuranPx <= 0)
    return teks;
  const faktor = (FAKTOR_LEBAR_FONT[font] ?? FAKTOR_BAWAAN) * AMAN_LEBAR;
  const maksKarakter = Math.max(1, Math.floor(lebarPx / (faktor * ukuranPx)));
  const baris: string[] = [];
  for (const paragraf of teks.split("\n")) {
    const kata = paragraf.split(/\s+/).filter(Boolean);
    if (!kata.length) {
      baris.push(""); // baris kosong buatan user tetap ada
      continue;
    }
    let kini = "";
    for (let k of kata) {
      // kata super panjang (URL/sambungan tanpa spasi) → potong keras
      while (Array.from(k).length > maksKarakter) {
        if (kini) {
          baris.push(kini);
          kini = "";
        }
        const huruf = Array.from(k);
        baris.push(huruf.slice(0, maksKarakter).join(""));
        k = huruf.slice(maksKarakter).join("");
      }
      const coba = kini ? `${kini} ${k}` : k;
      if (Array.from(coba).length <= maksKarakter) kini = coba;
      else {
        baris.push(kini);
        kini = k;
      }
    }
    if (kini) baris.push(kini);
  }
  return baris.join("\n");
}

/**
 * Bungkus SATU teks gaya utk render dgn dimensi frame W×H — parameter ukuran px
 * & batas lebar identik dgn rantaiTeks() di ffmpeg.ts. minPx = lantai ukuran
 * (12 utk judul, 10 utk Part/deskripsi — sama dgn rantaiTeks).
 */
export function bungkusTeksRender(
  teks: string,
  gaya: GayaTeks,
  W: number,
  H: number,
  minPx: number,
): string {
  const ukuranPx = Math.max(minPx, gaya.ukuran * skalaTeksRender(W, H));
  return bungkusTeks(teks, W * BATAS_LEBAR_TEKS, ukuranPx, gaya.font);
}

/**
 * v0.42.0 — teks SIAP GAMBAR utk satu part: judul + part + deskripsi sudah
 * dibungkus dgn aturan yang sama. Dipakai bangunArgumenPart (menulis textfile
 * drawtext) & komponen pratinjau (menampilkan apa adanya).
 */
export function teksSiapGambar(
  judulTxt: string,
  partTxt: string,
  deskripsiTxt: string,
  p: Pengaturan,
  W: number,
  H: number,
): { judul: string; part: string; deskripsi: string } {
  return {
    judul: bungkusTeksRender(judulTxt ?? "", p.gayaJudul, W, H, 12),
    part: bungkusTeksRender(partTxt ?? "", p.gayaPart, W, H, 10),
    deskripsi: bungkusTeksRender(deskripsiTxt ?? "", p.gayaDeskripsi, W, H, 10),
  };
}
