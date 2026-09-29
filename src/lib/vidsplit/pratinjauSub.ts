// VidSplit v0.45.0 — PRATINJAU SUBTITLE AI
// Permintaan user: "kawan ini tidak ada priview nya ya apakah subtitle nya ada
// atau tidak" — subtitle AI v0.44.0 baru terlihat SETELAH ekspor (AI bekerja saat
// ekspor). Panel ini menampilkan KEPING video ±15 detik pertama yang SUDAH
// dibakari subtitle (persis gaya ekspor: ukuran & posisi sama) + daftar teksnya,
// sehingga user bisa memastikan subtitle ADA sebelum memulai ekspor penuh.
//
// Hasil analisis AI dipakai dari CACHE yang sama dengan ekspor
// (work/subtitle-ai/<hash>.json) — pratinjau sekali, ekspor tak menghitung ulang.
// Modul MURNI & aman-browser (tanpa import node:*) — dipakai UI + dites unit.

/** Durasi keping pratinjau (detik) — cukup membaca 2-4 baris subtitle pertama. */
export const DURASI_PRATINJAU_SUB = 15;

/** Jumlah baris teks yang ditampilkan di daftar transkrip pratinjau. */
export const MAKS_BARIS_TAMPIL = 60;

export interface InfoSumberPratinjau {
  durasi: number;
  lebar: number;
  tinggi: number;
  adaAudio: boolean;
}

/**
 * Dimensi keping pratinjau: proporsi SAMA dengan hasil ekspor tapi lebih kecil
 * agar render cepat (libass menskala font dgn sisi terpendek — proporsi teks
 * & posisi persis seperti ekspor).
 *  - mode "asli": rasio asli sumber, sisi terpendek 540 (digenapkan utk yuv420p)
 *  - mode lain (blur/crop/warna): ekspor selalu 9:16 → pratinjau 540×960
 * Fungsi murni — dites di scripts/uji-pratinjau-sub.ts.
 */
export function dimensiPratinjau(
  mode: string,
  lebar: number,
  tinggi: number,
): { W: number; H: number } {
  if (mode !== "asli") return { W: 540, H: 960 };
  const w = Math.round(lebar || 0);
  const h = Math.round(tinggi || 0);
  if (w < 2 || h < 2) return { W: 540, H: 960 }; // sumber tak valid → pakai proporsi frame
  const skala = 540 / Math.min(w, h);
  const genap = (n: number) => Math.max(2, Math.round(n) - (Math.round(n) % 2));
  return { W: genap(w * skala), H: genap(h * skala) };
}

/** detik → "m:ss" (pratinjau tak pernah lebih dari sejam) — murni. */
export function formatWaktuSub(t: number): string {
  const d = Math.max(0, t || 0);
  const m = Math.floor(d / 60);
  const s = Math.floor(d % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export interface SegmenTampil {
  a: number;
  b: number;
  t: string;
}

/**
 * Ambil segmen pertama utk daftar transkrip di UI (amannya MAKS_BARIS_TAMPIL).
 * Fungsi murni — masukan apa pun (null/tersangkut) menghasilkan array bersih.
 */
export function potongSegmenTampil(
  segmen: unknown,
  maks: number = MAKS_BARIS_TAMPIL,
): SegmenTampil[] {
  const bulat = Math.round(Number(maks));
  const batas = Number.isFinite(bulat)
    ? Math.max(1, Math.min(200, bulat))
    : MAKS_BARIS_TAMPIL;
  if (!Array.isArray(segmen)) return [];
  const keluar: SegmenTampil[] = [];
  for (const s of segmen.slice(0, batas)) {
    const o = s as { a?: unknown; b?: unknown; t?: unknown };
    const a = Number(o?.a);
    const b = Number(o?.b);
    const t = String(o?.t ?? "").trim();
    if (!Number.isFinite(a) || !Number.isFinite(b) || !t) continue;
    keluar.push({ a, b, t });
  }
  return keluar;
}

/** Label bahasa utk lencana hasil pratinjau. */
export function labelBahasa(bahasa: string, diterjemahkan: boolean): string {
  if (bahasa === "en") return diterjemahkan ? "Suara Inggris → diterjemahkan Indonesia" : "Suara Inggris (penerjemah tidak tersedia)";
  return "Suara Indonesia";
}
