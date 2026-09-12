// VidSplit — tipe data & pengaturan aplikasi

export type ModeKonversi = "blur" | "crop" | "warna";
export type Resolusi = "1080" | "720";
export type CodecVideo = "h264" | "h265";
export type PosisiLogo = "kiri-atas" | "kanan-atas" | "kiri-bawah" | "kanan-bawah";
export type PosisiTeks = "atas" | "tengah" | "bawah";

/** 3 font dasar + 15 font sinematik (berkas TTF dibundel di assets/fonts) */
export type NamaFont =
  | "tebal"
  | "bersih"
  | "klasik"
  | "bebas"
  | "anton"
  | "cinzel"
  | "cinzeldec"
  | "playfair"
  | "marcellus"
  | "julius"
  | "oswald"
  | "sixcaps"
  | "teko"
  | "alfaslab"
  | "abril"
  | "blackops"
  | "creepster"
  | "monoton";

/** Batas jumlah video dalam satu antrean ekspor */
export const BATAS_VIDEO = 15;

export interface GayaTeks {
  font: NamaFont;
  /** px pada lebar 1080 — otomatis diskalakan untuk 720 */
  ukuran: number;
  warna: string;
  outlineLebar: number;
  outlineWarna: string;
}

export interface Pengaturan {
  mode: ModeKonversi;
  warnaLatar: string;
  judul: string;
  gayaJudul: GayaTeks;
  kataPart: string;
  gayaPart: GayaTeks;
  /** durasi tiap part dalam detik (5–3600) */
  durasiPart: number;
  /** path relatif background di work/upload ("" = tanpa bg) */
  bgId: string;
  /** durasi intro background di awal tiap potongan (1–10 dtk) */
  durasiIntro: number;
  resolusi: Resolusi;
  posisiTeks: PosisiTeks;
  /** posisi area potong horizontal utk mode "crop" — 0=kiri, 50=tengah, 100=kanan */
  posisiPotong: number;
  /** detik mulai rentang video yang diproses (0 = dari awal) */
  mulaiDetik: number;
  /** detik akhir rentang video yang diproses (0 = sampai habis) */
  akhirDetik: number;
  /** codec video hasil — h265 menghasilkan file jauh lebih kecil */
  codec: CodecVideo;
  /** path relatif logo watermark di work/upload ("" = tanpa logo) */
  logoId: string;
  /** sudut penempatan logo */
  posisiLogo: PosisiLogo;
  /** lebar logo dalam % lebar frame (5–40) */
  ukuranLogo: number;
  /** jumlah part dirender serentak (1–4) */
  prosesParalel: number;
  /** pakai akselerasi GPU (NVENC/QSV/AMF) bila tersedia */
  pakaiGpu: boolean;
}

export const pengaturanDefault: Pengaturan = {
  mode: "blur",
  warnaLatar: "#111827",
  judul: "Judul Video",
  gayaJudul: { font: "tebal", ukuran: 64, warna: "#ffffff", outlineLebar: 4, outlineWarna: "#000000" },
  kataPart: "Part",
  gayaPart: { font: "tebal", ukuran: 48, warna: "#fbbf24", outlineLebar: 3, outlineWarna: "#000000" },
  durasiPart: 20,
  bgId: "",
  durasiIntro: 3,
  resolusi: "1080",
  posisiTeks: "atas",
  posisiPotong: 50,
  mulaiDetik: 0,
  akhirDetik: 0,
  codec: "h264",
  logoId: "",
  posisiLogo: "kanan-bawah",
  ukuranLogo: 15,
  prosesParalel: 2,
  pakaiGpu: true,
};

export const INFO_FONT: Record<NamaFont, string> = {
  tebal: "Tebal (bawaan)",
  bersih: "Bersih (bawaan)",
  klasik: "Klasik (bawaan)",
  bebas: "Bebas Neue — blokbuster",
  anton: "Anton — impak tebal",
  cinzel: "Cinzel — epik Romawi",
  cinzeldec: "Cinzel Decorative — fantasi",
  playfair: "Playfair Display — drama",
  marcellus: "Marcellus — klasik film",
  julius: "Julius Sans One — minimal",
  oswald: "Oswald — dokumenter",
  sixcaps: "Six Caps — tinggi padat",
  teko: "Teko — modern sporty",
  alfaslab: "Alfa Slab One — poster retro",
  abril: "Abril Fatface — poster tebal",
  blackops: "Black Ops One — aksi/militer",
  creepster: "Creepster — horor",
  monoton: "Monoton — retro neon",
};

/** Jumlah part minimal 1 — dibulatkan ke atas */
export function hitungPart(durasiVideo: number, durasiPart: number): number {
  return Math.max(1, Math.ceil(durasiVideo / Math.max(1, durasiPart)));
}

/** Durasi rentang yang benar-benar diproses, dengan pembatasan aman (min 0.5 dtk).
 *  akhirDetik 0 berarti sampai habis; nilai di luar video otomatis diclip. */
export function durasiEfektif(durasiVideo: number, mulaiDetik: number, akhirDetik: number): number {
  const mulai = Math.max(0, Math.min(mulaiDetik, durasiVideo - 0.5));
  const akhir =
    akhirDetik > 0 ? Math.max(mulai + 0.5, Math.min(akhirDetik, durasiVideo)) : durasiVideo;
  return Math.max(0.5, akhir - mulai);
}

/** [mulai, durasi] utk part ke-n — mendukung rentang trim (mulaiDetik/akhirDetik).
 *  Durasi terakhir dipotong sampai batas akhir rentang. */
export function rentangPart(
  n: number,
  durasiVideo: number,
  durasiPart: number,
  mulaiDetik = 0,
  akhirDetik = 0,
): [number, number] {
  const efektif = durasiEfektif(durasiVideo, mulaiDetik, akhirDetik);
  const mulai = mulaiDetik + (n - 1) * durasiPart;
  const durasi = Math.min(durasiPart, Math.max(0.5, efektif - (n - 1) * durasiPart));
  return [mulai, durasi];
}

/** Label ramah utk posisi logo */
export function labelPosisiLogo(p: PosisiLogo): string {
  const map: Record<PosisiLogo, string> = {
    "kiri-atas": "Kiri atas",
    "kanan-atas": "Kanan atas",
    "kiri-bawah": "Kiri bawah",
    "kanan-bawah": "Kanan bawah",
  };
  return map[p];
}

/** Uraikan teks waktu jadi detik — terima "90", "1:30", "1:02:03" — -1 bila tak valid */
export function uraiWaktu(teks: string): number {
  const t = (teks || "").trim();
  if (!t || !/^(\d+:){0,2}\d+(\.\d+)?$/.test(t)) return -1;
  let det = 0;
  for (const bagian of t.split(":")) det = det * 60 + Number(bagian);
  return Number.isFinite(det) ? det : -1;
}

/** Label ramah utk posisi potong 0–100 */
export function labelPosisiPotong(n: number): string {
  if (n <= 20) return `Kiri (${n}%)`;
  if (n >= 80) return `Kanan (${n}%)`;
  if (n >= 40 && n <= 60) return `Tengah (${n}%)`;
  return n < 50 ? `Agak kiri (${n}%)` : `Agak kanan (${n}%)`;
}

export function formatDurasi(det: number): string {
  const d = Math.max(0, Math.floor(det));
  const j = Math.floor(d / 3600);
  const m = Math.floor((d % 3600) / 60);
  const s = d % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return j > 0 ? `${j}:${mm}:${ss}` : `${m}:${ss}`;
}

export function slugify(teks: string): string {
  const slug =
    (teks || "")
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40);
  return slug || "vidsplit";
}

/** Font-family CSS utk pratinjau browser (cocokkan dgn @font-face di globals.css;
 *  nama "VDS *" = font sinematik bundel di /fonts). Render final tetap pakai TTF
 *  lewat drawtext fontfile — peta ini hanya agar pratinjau mirip hasil akhir. */
export const FONT_CSS: Record<NamaFont, string> = {
  tebal: "'DejaVu Sans', Arial, sans-serif",
  bersih: "'DejaVu Sans', Arial, sans-serif",
  klasik: "'DejaVu Serif', 'Times New Roman', serif",
  bebas: "'VDS Bebas Neue', Impact, sans-serif",
  anton: "'VDS Anton', Impact, sans-serif",
  cinzel: "'VDS Cinzel', 'Times New Roman', serif",
  cinzeldec: "'VDS Cinzel Decorative', 'Times New Roman', serif",
  playfair: "'VDS Playfair Display', Georgia, serif",
  marcellus: "'VDS Marcellus', Georgia, serif",
  julius: "'VDS Julius Sans One', sans-serif",
  oswald: "'VDS Oswald', 'Arial Narrow', sans-serif",
  sixcaps: "'VDS Six Caps', Impact, sans-serif",
  teko: "'VDS Teko', 'Arial Narrow', sans-serif",
  alfaslab: "'VDS Alfa Slab One', Rockwell, serif",
  abril: "'VDS Abril Fatface', Georgia, serif",
  blackops: "'VDS Black Ops One', Impact, sans-serif",
  creepster: "'VDS Creepster', Impact, sans-serif",
  monoton: "'VDS Monoton', Impact, sans-serif",
};

/** Id font dasar (bukan sinematik) — untuk pengelompokan daftar pilihan */
export const FONT_DASAR: NamaFont[] = ["tebal", "bersih", "klasik"];
