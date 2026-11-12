// VidSplit — tipe data & pengaturan aplikasi
import { rapikanNeon, type SetelanNeon } from "./neonLayar";
import { rapikanTemplat, type SetelanTemplat } from "./templatLayar";
// v3.5.0 — validasi id bingkai judul futuristik (bingkaiJudul.ts MURNI, tanpa
// impor balik — aman dari lingkaran dependensi)
import { BINGKAI_JUDUL } from "./bingkaiJudul";

/** "asli" = video original — tanpa konversi, rasio/ukuran tetap seperti sumber.
 *  v0.46.0 "template" = halaman desain 9:16: judul di kotak atas, video DI DALAM
 *  kotak tengah, deskripsi & Part di kotak bawah, latar gradasi (sketsa user). */
export type ModeKonversi = "blur" | "crop" | "warna" | "asli" | "template";
export type Resolusi = "1080" | "720";

/** v3.5.1 — bentuk pratinjau live, DIPAKAI BERSAMA oleh Preview.tsx & page.tsx
 *  agar wadah bracket di halaman selalu sepaham dgn bingkai di dalamnya:
 *  · true  = POTRET (9:16 / sumber vertikal / template) → tinggi-mengatur,
 *    wadah halaman w-fit (bracket menempel bingkai);
 *  · false = LANSKAP/persegi (Video original dgn sumber melebar) → lebar-mengatur,
 *    wadah halaman WAJIB w-full — kalau w-fit, lebar kolaps ke baris kontrol
 *    (±285px) karena video absolut tak ikut mengisi → pratinjau kecil banget
 *    (bug laporan user: "Video Original gambar nya kecil banget"). */
export function pratinjauPotret(mode: string, lebar: number, tinggi: number): boolean {
  if (mode === "template") return true;
  if (mode !== "asli" || !(lebar > 0) || !(tinggi > 0)) return true;
  return tinggi > lebar;
}

/* ============ v2.0.0 — SPLIT PER ADEGAN & JUMLAH PART OTOMATIS ============ */

/** v2.0.0 — cara memecah part: "durasi" = per batas durasi (perilaku lama),
 *  "adegan" = video DIANALISIS 100% offline (piksel + histogram, ambang adaptif
 *  median+MAD) → part terpecah TEPAT di pergantian adegan film. */
export type ModeSplit = "durasi" | "adegan";

/** v2.0.0 — resolusi output eksplisit. "auto" = perilaku lama (mengikuti field
 *  `resolusi` 720/1080). Lainnya = dikunci ke resolusi pilihan user; rasio
 *  vertikal 9:16 otomatis dibalik sesuai konvensi TikTok/Shorts (4K = 2160×3840). */
export type ResolusiOutput = "auto" | "720p" | "1080p" | "2k" | "4k";

/** v2.0.0 — ZOOM PEMBICARA OTOMATIS (100% offline, model YOLO ±12 MB unduh
 *  sekali): "mati" = tanpa zoom; "geser" = GESER HALUS (kamera meluncur ke
 *  pembicara baru); "fade" = FADE (gambar lama melebur/dissolve ke yang baru);
 *  "langsung" = LANGSUNG (cut instan ala TV). */
export type ModePembicara = "mati" | "geser" | "fade" | "langsung";

/** v2.0.0 — kecepatan pindah fokus saat pembicara berganti (GESER HALUS) */
export type LajuPindah = "cepat" | "normal" | "lambat";

/* ============ v2.1.0 — UPGRADE BACKGROUND INTRO ============ */

/** v2.1.0 — animasi gambar intro (efek Ken Burns, 100% ffmpeg):
 *  "mati" = gambar diam (perilaku lama); "zoom-masuk" = perlahan membesar;
 *  "zoom-keluar" = mulai besar lalu mengecil; "geser-kiri"/"geser-kanan" =
 *  kamera meluncur pelan ke samping (zoom ±8% memberi ruang geser).
 *  v2.2.0 — bawaan "zoom-masuk" (background intro kini frame dari video). */
export type AnimasiIntro =
  | "mati"
  | "zoom-masuk"
  | "zoom-keluar"
  | "geser-kiri"
  | "geser-kanan"
  // v3.4.0 — PAN VERTIKAL (menu COVER KINOSTRA seg EFEK COVER: PAN Y)
  | "geser-atas"
  | "geser-bawah";

/** v2.1.0 — di potongan mana gambar intro tampil: "semua" (perilaku lama),
 *  "pertama" = hanya part 1, "pertama-terakhir" = part 1 dan part terakhir */
export type TampilIntro = "semua" | "pertama" | "pertama-terakhir";

/** v2.1.0 — apakah part ke-n (1..total) menampilkan gambar intro. Fungsi murni
 *  — dipakai jobs.ts utk memutuskan bg per part (dan offset backsound/subtitle
 *  ikut konsisten). Nilai tampil tak dikenal = "semua" (perilaku lama). */
export function pilihBgPart(tampil: TampilIntro | undefined, n: number, total: number): boolean {
  const t = tampil === "pertama" ? "pertama" : tampil === "pertama-terakhir" ? "pertama-terakhir" : "semua";
  if (t === "pertama") return n <= 1;
  if (t === "pertama-terakhir") return n <= 1 || n >= Math.max(1, total);
  return true;
}

/* ============ v2.1.0 — THUMBNAIL OTOMATIS ============ */

/** v2.3.0 — cakupan frame cover: "per-part" = tiap part mengambil frame sendiri
 *  (perilaku lama, tiap cover beda); "satu" = SATU frame dari video sumber
 *  (posisi part 1, dipetakan menit 1–3) dipakai SEMUA part — seek ekstraksi cuma
 *  1× per video (lebih cepat) dan semua cover seragam. Permintaan user:
 *  "1 gambar saja dari setiap video untuk dijadikan sebagai cover untuk semua
 *  hasil splitan".
 *  v2.5.0 — + "identik": SATU frame dari video sumber dipakai SEMUA part DAN
 *  TANPA label nomor part → file cover 100% IDENTIK satu sama lain (judulnya
 *  sama untuk semua part video yang sama). Permintaan user: "aku ingin di
 *  tambahkan bisa memakai 1 cover dari video yang akan di eksport dan split
 *  untuk semua hasil splitannya jadi cover yang di pakai sama semua". */
export type ModeThumbnail = "per-part" | "satu" | "identik";

/** v2.3.0 — gaya BINGKAI cover (permintaan user: "pilihan klasik modern dan
 *  futuristik"): "modern" = kotak gelap bersih (bawaan, = rantai lama PERSIS),
 *  "klasik" = bingkai emas ganda + huruf fantasi Cinzel Decorative,
 *  "futuristik" = aksen neon cyan/magenta + sudut bracket + huruf Anton/Monoton. */
export type GayaThumbnail = "modern" | "klasik" | "futuristik";
/** v3.3.0 — gaya cover diperluas: 3 gaya lama menjadi kategori "DASAR" di
 *  dalam galeri 100 template NOVACUT (10 layout × 10 palet) — bukan menu
 *  terpisah (permintaan user). Nilai valid = 3 gaya lama ATAU id template
 *  dari daftarTemplateCover() di coverNovacut.ts (mis. "impact--cyber").
 *  types.ts menyimpan string agar bebas dependensi; validasi di coverNovacut. */
export type GayaCoverLanjutan = GayaThumbnail | (string & {});

/** v2.1.0 — opsi THUMBNAIL OTOMATIS (per-JOB ekspor/gabung, bukan per-video):
 *  tiap part selesai dirender → ambil 1 frame dari video sumber (±35% awal part)
 *  → overlay judul (dari NAMA FILE) + label "Part/Bagian/Episode N" → simpan
 *  JPG/PNG di folder output, ikut daftar unduhan & ZIP.
 *  v2.3.0 — + mode (cakupan frame) & gaya (bingkai). */
export interface OpsiThumbnail {
  aktif: boolean;
  kata: "Part" | "Bagian" | "Episode";
  format: "jpg" | "png";
  mode: ModeThumbnail;
  /** v3.3.0 — id template cover (3 gaya dasar / 100 template NOVACUT) */
  gaya: GayaCoverLanjutan;
}
export const KATA_THUMBNAIL: Array<OpsiThumbnail["kata"]> = ["Part", "Bagian", "Episode"];
export const MODE_THUMBNAIL: Array<OpsiThumbnail["mode"]> = ["per-part", "satu", "identik"];
export const GAYA_THUMBNAIL: Array<OpsiThumbnail["gaya"]> = ["modern", "klasik", "futuristik"];
export const opsiThumbnailDefault: OpsiThumbnail = {
  aktif: false,
  kata: "Part",
  format: "jpg",
  mode: "per-part",
  gaya: "modern",
};

/** v2.1.0 — rapikan opsi thumbnail dari body API (aman thd nilai aneh/kosong).
 *  v2.3.0 — + mode & gaya: nilai lama tanpa kedua field → bawaan (per-part +
 *  modern) = perilaku lama persis.
 *  v2.5.0 — + mode "identik". */
export function rapikanThumbnail(raw: unknown): OpsiThumbnail {
  const o = (raw ?? {}) as Partial<OpsiThumbnail> & {
    kata?: string;
    format?: string;
    mode?: string;
    gaya?: string;
  };
  return {
    aktif: o.aktif === true,
    kata: o.kata === "Bagian" || o.kata === "Episode" ? o.kata : "Part",
    format: o.format === "png" ? "png" : "jpg",
    mode: o.mode === "satu" || o.mode === "identik" ? o.mode : "per-part",
    // v3.3.0 — gaya divalidasi THD katalog (dasar + 100 template NOVACUT);
    // katalog diimpor longgar agar types.ts tetap bebas dependensi berat
    gaya: gayaCoverValid(o.gaya) ? String(o.gaya) : "modern",
  };
}

/** v3.3.0 — validasi longgar id gaya cover (3 dasar ATAU "layout--palet" NOVACUT).
 *  Fungsi murni tanpa import katalog — pola id dijamin konsisten oleh generator. */
export function gayaCoverValid(g: unknown): boolean {
  if (typeof g !== "string") return false;
  if (g === "modern" || g === "klasik" || g === "futuristik") return true;
  return /^[a-z]+--[a-z]+$/.test(g);
}

/** durasi pindah fokus (detik, pada waktu HASIL) per laju */
export const DURASI_PINDAH: Record<LajuPindah, number> = { cepat: 0.35, normal: 0.8, lambat: 1.6 };
/** durasi crossfade FADE antar segmen fokus (detik) */
export const DURASI_FADE = 0.45;
/** maks segmen fokus utk rantai xfade FADE — lebih dari ini jatuh ke GESER */
export const MAKS_SEGMEN_FADE = 60;
export type CodecVideo = "h264" | "h265";
export type PosisiLogo = "kiri-atas" | "kanan-atas" | "kiri-bawah" | "kanan-bawah";
export type PosisiTeks = "atas" | "tengah" | "bawah";

/** v0.57.0 — transisi antar part: "" = tanpa transisi (perilaku lama),
 *  "fade" = pudar ke hitam (masuk + keluar tiap part),
 *  "slide" = geser (masuk dari kanan, keluar ke kiri).
 *  v3.3.0 — USANG: digantikan mesin transisi NOVACUT 28 gaya (efekTransisi).
 *  Field tetap ada agar simpanan lama tidak rusak; migrasi memetakan
 *  "fade"→"crossfade" & "slide"→"slide-l" lalu mengosongkan field ini. */
export type TransisiPart = "" | "fade" | "slide";
/** durasi transisi tiap sisi (detik) */
export const DURASI_TRANSISI = 0.5;

/** v3.3.0 — MESIN EFEK NOVACUT (port novacut-fx KolosalCut v1.4.9):
 *  28 transisi antar part (xfade ffmpeg asli antar ekor part sebelumnya &
 *  kepala part sekarang) + 20 efek klip blockbuster (rantai filter ffmpeg).
 *  Registry lengkap + pemetaan xfade ada di efekNovacut.ts — types.ts hanya
 *  menyimpan id (string) agar modul ini bebas dependensi. */
/** id transisi NOVACUT ("" = mati); validasi di efekNovacut.ts */
export type IdTransisiNovacut = string;
/** durasi transisi antar part NOVACUT (detik, 0.2–1.5) */
export const DURASI_TRANSISI_NOVACUT_BAWAAN = 0.6;
/** batas jumlah efek klip aktif bersamaan (mencegah rantai filter tak masuk akal) */
export const MAKS_EFEK_KLIP = 6;

/** v3.3.0 — MESIN SUBTITLE WHISPER.CPP (port transcribe.ts KolosalCut):
 *  pilihan model ggml q5_1 — ringan=tiny (paling cepat), cepat=base, akurat=small
 *  v3.4.0 — + turbo=large-v3-turbo (±547 MB, paling akurat — menu VOCALIS v4
 *  KINOSTRA mod 06 memunculkannya sbg pilihan pertama) */
export type ModelSubtitle = "ringan" | "cepat" | "akurat" | "turbo";
/** v3.3.0 — bahasa subtitle: id=Indonesia, jw=Jawa, jwid=probe ganda Jawa/
 *  Indonesia (pola KINOSTRA), enid=Inggris→terjemah Indonesia (opus-mt) */

export type BahasaSubtitle = "id" | "jw" | "jwid" | "enid";
/** v3.4.0 — label mesin VOCALIS v4 (mod 06 KINOSTRA) — MURNI supaya aman
 *  diimpor komponen client (whisperCpp.ts membawa node:child_process) */
export const LABEL_MODEL: Record<ModelSubtitle, string> = {
  ringan: "Ringan (Tiny)",
  cepat: "Cepat (Base)",
  akurat: "Akurat (Small)",
  turbo: "Turbo (Large-v3-T)",
};
/** v3.3.0 — ANIMASI MASUK TEKS (judul & label part) — 8 gaya ala KINOSTRA/
 *  NOVACUT, dieksekusi drawtext (ekspresi alpha/x/y): "" = mati (perilaku lama) */
export type AnimasiTeks =
  | ""
  | "fade"
  | "naik"
  | "turun"
  | "geser-kiri"
  | "geser-kanan"
  | "neon"
  | "denyut"
  | "slam";
/** label ramah + urutan utk UI */
export const ANIMASI_TEKS: Array<{ id: AnimasiTeks; nama: string }> = [
  { id: "", nama: "Mati" },
  { id: "fade", nama: "Fade" },
  { id: "naik", nama: "Naik" },
  { id: "turun", nama: "Turun" },
  { id: "geser-kiri", nama: "Geser Kiri" },
  { id: "geser-kanan", nama: "Geser Kanan" },
  { id: "neon", nama: "Neon" },
  { id: "denyut", nama: "Denyut" },
  { id: "slam", nama: "Slam" },
];

/** v3.4.0 — ANIMASI MASUK TEKS COVER (menu COVER KINOSTRA mod 13 — port
 *  NCTEXTANIMS nccover.js): 8 gaya + TANPA. Judul & badge part di cover
 *  masuk dgn animasi masing-masing (part ditunda 0,25 dtk ala KINOSTRA). */
export type AnimasiCover =
  | ""
  | "fade"
  | "rise"
  | "typewriter"
  | "slam"
  | "neon"
  | "tracking"
  | "glitch"
  | "wipe";
export const ANIMASI_COVER: Array<{ id: AnimasiCover; nama: string }> = [
  { id: "", nama: "TANPA" },
  { id: "fade", nama: "FADE" },
  { id: "rise", nama: "RISE UP" },
  { id: "typewriter", nama: "TYPEWRITER" },
  { id: "slam", nama: "TITLE SLAM" },
  { id: "neon", nama: "NEON FLICKER" },
  { id: "tracking", nama: "TRACKING" },
  { id: "glitch", nama: "GLITCH" },
  { id: "wipe", nama: "WIPE" },
];
/** v3.4.0 — BINGKAI COVER (port NCCOVER_FRAMES nccover.js — alpha 0.75):
 *  TANPA / KLASIK (emas ganda + berlian) / MODERN (bulat putih + aksen) /
 *  FUTURISTIK (oktagon + bracket neon + tick) */
export type BingkaiCover = "none" | "klasik" | "modern" | "futuristik";
/** v3.4.0 — SUMBER COVER ala KINOSTRA: auto = frame tiap part (posisi intro),
 *  single = SATU adegan utk semua part video itu, manual = gambar unggahan */
export type SumberCover = "auto" | "single" | "manual";
/** v3.4.0 — MODE WATERMARK ala KINOSTRA mod 08: mati / teks / logo */
export type ModeWatermark = "off" | "teks" | "logo";
/** v3.4.0 — KEN BURNS VIDEO (mod 09 GERAK & TRANSISI KINOSTRA): perbesar/
 *  geser perlahan otomatis di dalam video, kekuatan 0.05–0.6 */
export type ModeKenburns = "off" | "in" | "out" | "panx" | "pany" | "diag";
/** v3.4.0 — label teks part di sampul: "" = TANPA | PART | EPISODE | EPS |
 *  BAGIAN | # (seg KINOSTRA “TULISAN PART DI SAMPUL”) */
export type KataPartCover = "" | "PART" | "EPISODE" | "EPS" | "BAGIAN" | "#";
/** v3.4.0 — label ramah part cover + format label (“#3”, “EPS 03”, …) */
export const KATA_PART_COVER: Array<KataPartCover> = ["", "PART", "EPISODE", "EPS", "BAGIAN", "#"];
/** label part di sampul — murni: "" = tanpa, "#" = “#3”, lainnya “EPS 03” */
export function labelPartCover(kata: string | undefined, n: number): string {
  const k = String(kata ?? "").trim().toUpperCase();
  if (!k) return "";
  if (k === "#") return `#${Math.max(1, Math.floor(n))}`;
  return `${k} ${String(Math.max(1, Math.floor(n))).padStart(2, "0")}`;
}

/** v3.4.0 — FILTER WARNA SATU KLIK (port COLORFILTERS core.js KINOSTRA v3.16):
 *  10 gaya sinematik. Nilai filter ffmpeg dihitung rantaiVfx (ffmpeg.ts) —
 *  di sini hanya katalog murni utk UI. */
export const FILTER_WARNA: Array<{ k: string; n: string; d: string }> = [
  { k: "", n: "NORMAL", d: "Warna asli videomu" },
  { k: "horor", n: "HOROR MISTIS", d: "Dingin kehijauan · seram" },
  { k: "dangdut", n: "DANGDUT EMAS", d: "Hangat keemasan pesta" },
  { k: "teal", n: "SINEMA TEAL-ORANGE", d: "Warna film Hollywood" },
  { k: "noir", n: "NOIR HITAM-PUTIH", d: "Monokrom klasik tegas" },
  { k: "vintage", n: "VINTAGE 80-an", d: "Pudar hangat nostalgia" },
  { k: "vivid", n: "VIVID TAJAM", d: "Warna pekat berani" },
  { k: "dingin", n: "DINGIN BIRU", d: "Nuansa malam sejuk" },
  { k: "pucat", n: "PUCAT MIMPI", d: "Lembut terang fantasi" },
  { k: "seram", n: "SERAM MERAH", d: "Darah & bayangan gelap" },
];

/** durasi animasi masuk teks (detik) */
export const DURASI_ANIMASI_TEKS = 0.7;
/** v0.57.0 — langkah kecepatan tayang (×): 0,5 sampai 2 */
export const LANGKAH_KECEPATAN = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
/** Rapikan kecepatan ke langkah terdekat — aman thd nilai aneh dari simpanan
 *  lama / input manual (NaN → 1). Fungsi murni — dites unit. */
export function rapikanKecepatan(n: unknown): number {
  const x = Number(n);
  if (!Number.isFinite(x)) return 1;
  let terbaik = 1;
  let beda = Number.POSITIVE_INFINITY;
  for (const k of LANGKAH_KECEPATAN) {
    const b = Math.abs(k - x);
    if (b < beda) {
      beda = b;
      terbaik = k;
    }
  }
  return terbaik;
}

/** v0.57.0 — POTONG & HAPUS BAGIAN: satu zona (detik, ABSOLUT dari awal video)
 *  yang dilewati saat pemecahan part — bagian video yang tak ingin ditayangkan
 *  (intro panjang, momen salah, iklan). Zona boleh tumpang-tindih; dirapikan
 *  dgn rapikanZonaHapus() sebelum dipakai. */
export interface ZonaHapus {
  mulai: number;
  akhir: number;
}

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

/** Batas jumlah video dalam satu antrean ekspor
 *  v0.43.0 — 15 → 100 (permintaan user: "apakah bisa kamu buat agar aplikasi ini
 *  bisa dimasukan video sampai dengan maksimal 100 video kawan dan di proses
 *  sesuai dengan urutannya") — antrean tetap BERURUTAN atas→bawah, ZIP hasil
 *  tetap streaming server (satu file di memori per saat) jadi aman utk 100. */
export const BATAS_VIDEO = 100;

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
  /** v2.2.0 — background intro kini OTOMATIS dari frame video (fitur lama
   *  unggah gambar/template DIHAPUS — permintaan user "ganti total").
   *  introAktif = sakelar pembuka; introPosisi = posisi frame di potongan. */
  introAktif: boolean;
  /** durasi intro background di awal tiap potongan (1–10 dtk) */
  durasiIntro: number;
  /** v2.2.0 — posisi frame background intro DI DALAM potongan (0–100 %, bawaan 35):
   *  0 = awal potongan, 35 = sepertiga awal (sama dgn thumbnail otomatis),
   *  100 = akhir potongan. Frame diambil dari video SUMBER (bersih).
   *  v2.2.1 — posisi DIPETAKAN ke rentang MENIT 1–3 video (detikRentangCover)
   *  agar seek dekat awal = ekstraksi cepat (video ≥ 75 dtk; lebih pendek =
   *  persis di potongan). */
  introPosisi: number;
  resolusi: Resolusi;
  /** v2.4.0 — POSISI BEBAS JUDUL (ganti posisiTeks lama, permintaan user:
   *  "menu 2 Tulisan judul juga dibuat pilihan letaknya, bisa bebas ditaruh
   *  dimana saja dengan cara digeser") — X = persen LEBAR frame, titik TENGAH
   *  blok teks (50 = rata tengah seperti lama); Y = persen TINGGI frame, titik
   *  ATAS blok teks. Y = -1 → OTOMATIS: margin atas lama (H × 4,5%). */
  judulX: number;
  judulY: number;
  /** v2.4.0 — POSISI BEBAS PART, TERPISAH dari judul (permintaan user: "posisi
   *  judul serta part bisa dipisah posisinya"). Semantik sama dgn judulX/Y.
   *  Y = -1 → OTOMATIS: tepat di bawah blok judul (perilaku lama utuh — juga
   *  saat judul kosong, agar hasil lama persis sama). */
  partX: number;
  partY: number;
  /** v3.3.0 — animasi masuk judul & label part ("" = mati = perilaku lama).
   *  Hanya berlaku saat teks itu tampil; drawtext alpha/x/y ekspresi. */
  animasiTeks: AnimasiTeks;
  /** v3.5.0 — BINGKAI JUDUL FUTURISTIK (permintaan user: "pada menu TEKS
   *  tambahkan/buatkan 10 frame untuk judul dengan tampilan futuristik dan
   *  juga transparan dimana lebar dan tinggi frame nya mengikuti judul yang
   *  ada dan bisa di geser geser ke atas bawah kiri dan kanan"): id gaya dari
   *  BINGKAI_JUDUL (bingkaiJudul.ts), "" = mati (perilaku lama). Kotak frame
   *  mengikuti blok teks judul (baris terbungkus × ukuran font); posisi ikut
   *  judulX/judulY (jangkar sama dgn drawtext) → geser judul = geser bingkai.
   *  Dirender PNG transparan (resvg) di-overlay DI BAWAH drawtext judul. */
  bingkaiJudul: string;
  /** v3.3.0 — template cover utk BACKGROUND INTRO ("" = gaya lama polos):
   *  id dari daftarTemplateCover() (mis. "impact--cyber") — frame video +
   *  overlay SVG template (judul & label part terbakar di PNG). */
  introTemplate: string;
  /** posisi area potong horizontal utk mode "crop" — 0=kiri, 50=tengah, 100=kanan */
  posisiPotong: number;
  /** v0.50.0 — zoom manual utk mode "crop" (50–100, bawaan 100).
   *  100 = potong penuh seperti semula (video mengisi penuh 9:16, dipotong
   *  kiri/kanan). Di bawah 100 video diskalakan lebih kecil (zoom × skala-cover)
   *  di ATAS latar blur — sisa frame terisi blur lembut, posisi geser kiri/kanan
   *  tetap lewat posisiPotong. 50 = zoom setengah (paling kecil). */
  zoomPotong: number;
  /** v0.51.0 — zoom manual utk mode "blur" (100–300, bawaan 100).
   *  100 = blur lembut seperti semula (video pas/contain di tengah). Di atas
   *  100 video DIPERBESAR (skala-contain × zoom) di ATAS latar blur — posisi
   *  geser kiri/kanan lewat posisiPotong (rumus overlay sama dgn zoomPotong).
   *  300 = paling besar (±3×).
   *  v2.7.0 — slider zoom DIHAPUS dari UI mode blur (permintaan user: "pengaturan
   *  Zoom video serta Geser kiri geser kanan gantikan dengan geser bebas pakai
   *  tombol panah") — state tetap ada untuk mesin render: tekan panah kiri/kanan
   *  pertama otomatis menaikkan zoom ke 125 agar geser horizontal berdampak. */
  zoomBlur: number;
  /** v2.7.0 — GESER BEBAS VIDEO mode "blur" (permintaan user: panah ← ↑ ↓ →
   *  "seperti yang tadi kamu buat untuk posisi tulisan judul (geser bebas) jadi
   *  aku bisa menggeser videonya ke atas atau kebawah kekiri atau kekanan").
   *  Persen −100..100, 0 = tengah (perilaku lama PERSIS). X: −100 = menempel
   *  kiri, +100 = menempel kanan (butuh zoom >100 agar ada ruang — auto-naik).
   *  Y: −100 = menempel atas, +100 = menempel bawah. Rumus overlay:
   *  x = (W−w)/2 × (1 + X/100), y = (H−h)/2 × (1 + Y/100). */
  geserBlurX: number;
  geserBlurY: number;
  /** v0.57.0 — kecepatan tayang video (0,5–2 ×; bawaan 1 = normal).
   *  Video & audio dipercepat/diperlambat seragam; subtitle ikut bergeser
   *  otomatis; durasi part hasil = durasi sumber ÷ kecepatan. */
  kecepatanVideo: number;
  /** v0.57.0 — transisi antar part ("" = tanpa; "fade" = pudar hitam;
   *  "slide" = geser dari kanan → keluar ke kiri). Diterapkan di AWAL & AKHIR
   *  tiap part sehingga antar part terasa ada perpindahannya.
   *  v3.3.0 — USANG (lihat TransisiPart): selalu "" setelah migrasi. */
  transisiPart: TransisiPart;
  /** v3.3.0 — TRANSISI ANTAR PART NOVACUT: id dari 28 transisi (efekNovacut.ts),
 *  "" = mati. Di-render ffmpeg xfade ANTARA ekor part sebelumnya & kepala
 *  part ini (transisi silang sungguhan, bukan fade ke hitam) — port dari
 *  registry novacut-fx KolosalCut. Menggantikan transisiPart. */
  efekTransisi: IdTransisiNovacut;
  /** v3.3.0 — durasi transisi NOVACUT (0.2–1.5 dtk, bawaan 0.6) */
  efekTransisiDurasi: number;
  /** v3.3.0 — EFEK KLIP NOVACUT aktif (maks 6, diterapkan berurutan registry):
 *  8 color grading + 12 efek visual ala KolosalCut/NOVACUT. */
  efekKlip: string[];
  /** detik mulai rentang video yang diproses (0 = dari awal) */
  mulaiDetik: number;
  /** detik akhir rentang video yang diproses (0 = sampai habis) */
  akhirDetik: number;
  /** v0.57.0 — zona yang DIHAPUS dari pemecahan part (Potong & Hapus Bagian)
   *  — absen pada simpanan lama = tanpa zona (perilaku lama) */
  zonaHapus: ZonaHapus[];
  /** v2.0.0 — cara memecah part: per durasi (lama) atau per adegan (AI offline) */
  modeSplit: ModeSplit;
  /** v2.0.0 — JUMLAH PART OTOMATIS: >0 → video dibagi MERATA menjadi N part
   *  (durasi part = durasi efektif ÷ N); 0 = mati, ikuti durasiPart manual */
  jumlahPartOtomatis: number;
  /** v2.0.0 — resolusi output eksplisit 720p/1080p/2K/4K (auto = ikuti `resolusi`) */
  resolusiOutput: ResolusiOutput;
  /** v2.0.0 — ZOOM PEMBICARA OTOMATIS (AI offline): mati/geser/fade/langsung */
  zoomPembicara: ModePembicara;
  /** v2.0.0 — kecepatan pindah fokus (cepat/normal/lambat) */
  lajuPindah: LajuPindah;
  /** v2.0.0 — saat senyap: "tetap" di pembicara terakhir | "semua" tampilkan frame penuh */
  senyapPembicara: "tetap" | "semua";
  /** v2.0.0 — backsound musik pilihan sendiri (MP3/WAV/M4A) */
  backsoundAktif: boolean;
  /** v2.0.0 — path file musik: relatif work/upload (web) atau ABSOLUT (dialog Electron) */
  backsoundFile: string;
  /** v2.0.0 — volume backsound 0–150 % (bawaan 80) */
  backsoundVolume: number;
  /** v2.1.0 — animasi gambar intro (Ken Burns). v2.2.0 — bawaan "zoom-masuk" */
  introAnimasi: AnimasiIntro;
  /** v2.1.0 — transisi intro → video utama: true = fade lembut (xfade + afade
   *  audio), false = potong langsung (perilaku lama). Bawaan TRUE (pengalaman baru). */
  introFade: boolean;
  /** v2.2.0 — teks intro OTOMATIS: judul dari NAMA FILE (dibersihkan & dibungkus)
   *  + label "Part/Bagian/Episode NN" (kata ikut kataPart). Field introTeks lama
   *  (teks manual) DIHAPUS — gaya huruf di bawah tetap dipakai utk teks otomatis. */
  /** v2.2.0 — gaya huruf teks intro otomatis */
  introTeksFont: NamaFont;
  /** v2.1.0 — ukuran huruf teks intro (px pada sisi terpendek 1080) */
  introTeksUkuran: number;
  /** v2.1.0 — warna teks intro (#rrggbb); outline hitam selalu ikut agar terbaca */
  introTeksWarna: string;
  /** v2.1.0 — intro tampil di potongan mana (semua/pertama/pertama-terakhir) */
  introTampil: TampilIntro;
  /** v2.1.0 — file suara intro: relatif work/upload (web) atau ABSOLUT (Electron);
   *  "" = tanpa suara. Diputar selama intro (LOOP bila lebih pendek). */
  introSuaraFile: string;
  /** v2.1.0 — volume suara intro 0–150 % (bawaan 100) */
  introSuaraVolume: number;
  /** codec video hasil — h265 menghasilkan file jauh lebih kecil */
  codec: CodecVideo;
  /** v0.39.0 — teks deskripsi bebas yang dibakar ke dalam video ("" = tanpa deskripsi).
   *  Boleh multi-baris; posisinya BEBAS di mana pun lewat deskripsiX/deskripsiY. */
  deskripsi: string;
  /** v0.39.0 — gaya huruf deskripsi */
  gayaDeskripsi: GayaTeks;
  /** v0.39.0 posisi BEBAS deskripsi — persen LEBAR frame, titik TENGAH teks (0–100) */
  deskripsiX: number;
  /** v0.39.0 posisi BEBAS deskripsi — persen TINGGI frame, titik ATAS teks (0–100) */
  deskripsiY: number;
  /** path relatif logo watermark di work/upload ("" = tanpa logo) */
  logoId: string;
  /** v0.44.0 — subtitle AI otomatis: suara (ID/EN) ditranskrip Whisper lokal,
   *  diterjemahkan ke Indonesia bila perlu, lalu dibakar libass ke tiap part */
  subtitleAktif: boolean;
  /** v0.44.0 — ukuran huruf subtitle (px pada sisi terpendek 1080) */
  subtitleUkuran: number;
  /** v0.44.0 — posisi vertikal subtitle: persen tinggi frame titik BAWAH teks
   *  (88 = 12% dari bawah) */
  subtitleY: number;
  /** v0.47.0 — false (bawaan) = FOKUS INDONESIA: transkrip sekali jalan tanpa
   *  deteksi ganda — paling cepat. true = mode lama: deteksi ID/EN + terjemah
   *  Inggris→Indonesia (untuk video bersuara Inggris, lebih lambat). */
  subtitleDeteksiBahasa: boolean;
  /** v0.51.0 — false (bawaan) = Whisper SMALL (paling tepat). true = Whisper
   *  BASE — ±2–3× lebih cepat di CPU, ketepatan sedikit turun (video panjang).
   *  v3.3.0 — USANG: digantikan subtitleModel; migrasi memetakannya. */
  subtitleCepat: boolean;
  /** v3.3.0 — model mesin teks otomatis whisper.cpp: ringan=tiny q5_1 (paling
   *  cepat), cepat=base q5_1 (bawaan), akurat=small q5_1 (paling tepat) */
  subtitleModel: ModelSubtitle;
  /** v3.3.0 — bahasa suara: "id" Indonesia (bawaan), "jw" Jawa, "jwid" probe
   *  ganda Jawa/Indonesia (pola KINOSTRA), "enid" Inggris→terjemah Indonesia */
  subtitleBahasa: BahasaSubtitle;
  /** v0.54.0 — warna teks subtitle (#rrggbb) — dibakar lewat gaya ASS */
  subtitleWarna: string;
  /** v0.54.0 — warna outline/bingkai huruf subtitle (#rrggbb) */
  subtitleOutlineWarna: string;
  /** v0.54.0 — warna frame hiasan ("" = warna asli frame; #rrggbb = diwarnai
   *  ulang TANPA mengubah bentuk — bentuk/alpha diambil dari luminance asli) */
  frameWarna: string;
  /** v0.54.0 — warna kedua gradasi frame ("" = solid 1 warna; #rrggbb =
   *  gradasi vertikal atas→bawah). Aktif hanya bila frameWarna juga diisi. */
  frameWarna2: string;
  /** v0.46.0 — frame hiasan: "" = tanpa, "bawaan:<slug>" = bawaan aplikasi
   *  (public/bingkai), "upload/<berkas>" = unggahan user (work/upload).
   *  Video tampil di balik frame, terlihat lewat jendela transparan frame. */
  frameId: string;
  /** v0.46.0 — frame neon berputar (komet bercahaya di bingkai membulat) */
  neonAktif: boolean;
  neonWarna: string;
  /** 2–16 px pada sisi terpendek 1080 */
  neonTebal: number;
  /** 0.2–3 × (1 = satu putaran 6 detik) */
  neonKecepatan: number;
  /** garis kedua berlawanan arah */
  neonDuaGaris: boolean;
  /** v0.46.0 — warna gradasi latar mode template (#rrggbb) */
  templateGrad1: string;
  templateGrad2: string;
  /** sudut penempatan logo — preset cepat (v0.8.0: posisi sebenarnya di logoX/logoY) */
  posisiLogo: PosisiLogo;
  /** v0.8.0 posisi BEBAS logo — persen dari frame, titik KIRI-ATAS logo (0–100) */
  logoX: number;
  /** v0.8.0 posisi BEBAS logo — persen tinggi frame, titik KIRI-ATAS logo (0–100) */
  logoY: number;
  /** lebar logo dalam % lebar frame (5–40) */
  ukuranLogo: number;
  /** jumlah part dirender serentak (1–4) */
  prosesParalel: number;
  /** pakai akselerasi GPU (NVENC/QSV/AMF) bila tersedia */
  pakaiGpu: boolean;

  /* ================= v3.4.0 — MENU KINOSTRA (mod 13/08/09/06) ================= */
  /* ---- COVER VIDEO PEMBUKA · NOVACUT (mod 13) ---- */
  /** sumber latar cover: auto = frame tiap part, single = satu adegan utk
   *  semua part, manual = gambar unggahan (coverFile) */
  coverSumber: SumberCover;
  /** path relatif gambar cover unggahan (work/upload) — sumber "manual" */
  coverFile: string;
  /** judul khusus di sampul ("" = judul dari nama file — perilaku lama) */
  coverJudul: string;
  /** layout cover — kunci NOVACUT_LAYOUTS (impact/lower/banner/…/band) */
  coverLayout: string;
  /** palet warna cover — kunci NOVACUT_PALETTES (cyber/sunset/gold/…/ocean) */
  coverPalet: string;
  /** latar sampul: adegan (frame video) | hitam (polos + vignette) */
  coverLatar: "adegan" | "hitam";
  /** bingkai cover (alpha 0.75 — port NCCOVER_FRAMES) */
  coverBingkai: BingkaiCover;
  /** label part di sampul: "" tanpa / PART / EPISODE / EPS / BAGIAN / # */
  coverKataPart: KataPartCover;
  /** ukuran tulisan part di cover (0.5–2.5, 1 = 100%) */
  coverSkalaPart: number;
  /** animasi masuk judul cover (NCTEXTANIMS, "" = tanpa) */
  coverAnimJudul: AnimasiCover;
  /** animasi masuk tulisan part cover (ditunda 0,25 dtk ala KINOSTRA) */
  coverAnimPart: AnimasiCover;
  /** transisi cover → video: id 28 transisi NOVACUT ("" = potong kering) */
  coverTrans: IdTransisiNovacut;
  /** durasi transisi cover → video (0.2–1.5 dtk) */
  coverTransDurasi: number;
  /* ---- EFEK VISUAL & WATERMARK (mod 08) ---- */
  /** kecerahan (0.5–1.5, 1 = normal) — filter eq */
  vfxKecerahan: number;
  /** kontras (0.5–1.5, 1 = normal) */
  vfxKontras: number;
  /** kejenuhan warna (0–2, 1 = normal) */
  vfxKejenuhan: number;
  /** sudut gelap vignette */
  vfxVignette: boolean;
  /** bintik film analog */
  vfxGrain: boolean;
  /** filter warna satu klik — kunci FILTER_WARNA ("" = normal) */
  vfxFilter: string;
  /** watermark: mati / teks / logo (logo = logoId lama) */
  wmMode: ModeWatermark;
  /** teks watermark (mis. @KAMU, maks 28) */
  wmTeks: string;
  /** opasitas watermark 0.1–1 (teks & logo) */
  wmOpasitas: number;
  /* ---- GERAK & TRANSISI (mod 09) ---- */
  /** Ken Burns video: mati / zoom in / zoom out / pan X / pan Y / diag */
  kbMode: ModeKenburns;
  /** kekuatan gerak Ken Burns (0.05–0.6) */
  kbKekuatan: number;
  /* ---- SUBTITEL AI · VOCALIS v4 (mod 06) ---- */
  /** mode lagu/vokal (video bernyanyi) — jendela suara lebih longgar */
  subtitleLagu: boolean;
  /** lewati bagian tanpa suara (mode turbo — jauh lebih cepat) */
  subtitleLewatiSunyi: boolean;
  /** bakar subtitle ke video (mati = transkrip tetap dibuat, tak dibakar) */
  subtitleBakar: boolean;
  /** geser waktu SEMUA baris teks (detik, −30..30) */
  subtitleGeser: number;
}

export const pengaturanDefault: Pengaturan = {
  mode: "blur",
  warnaLatar: "#111827",
  judul: "Judul Video",
  // v0.8.0 default ukuran font atas permintaan user: judul 40, Part 35
  // v0.9.2 default font atas permintaan user: Cinzel Decorative (cinzeldec) utk judul & Part
  // v0.40.0 default ukuran: judul 35, Part 30
  // v0.42.0 default SEMUA ukuran font = 23 atas permintaan user: "rubah default
  // semua ukuran font nya menjadi 23" (instalasi lama yang masih menyimpan
  // ukuran default lama dimigrasi otomatis di migrasiSimpanan)
  gayaJudul: { font: "cinzeldec", ukuran: 23, warna: "#ffffff", outlineLebar: 4, outlineWarna: "#000000" },
  kataPart: "Part",
  gayaPart: { font: "cinzeldec", ukuran: 23, warna: "#fbbf24", outlineLebar: 3, outlineWarna: "#000000" },
  durasiPart: 20,
  // v2.2.0 — background intro OTOMATIS dari frame video (bawaan MATI — ekspor
  // lama persis sama sampai user menyalakannya; template & unggah gambar dihapus)
  introAktif: false,
  durasiIntro: 2,
  introPosisi: 35,
  resolusi: "1080",
  // v2.4.0 — posisi bawaan = PERSIS perilaku lama "atas": judul di margin atas,
  // part tepat di bawah judul (keduanya OTOMATIS via -1) → nol regresi visual
  judulX: 50,
  judulY: -1,
  partX: 50,
  partY: -1,
  // v3.3.0 — animasi teks mati bawaan (hasil lama persis)
  animasiTeks: "" as AnimasiTeks,
  // v3.5.0 — bingkai judul futuristik: mati bawaan (nol regresi)
  bingkaiJudul: "",
  posisiPotong: 50,
  // v0.50.0 — zoom manual potong: bawaan 100 = perilaku lama (potong penuh)
  zoomPotong: 100,
  // v0.51.0 — zoom manual blur: bawaan 100 = perilaku lama (video pas layar)
  zoomBlur: 100,
  // v2.7.0 — geser bebas video (panah) mode blur: 0/0 = tengah = perilaku lama
  geserBlurX: 0,
  geserBlurY: 0,
  // v0.57.0 — kecepatan normal, tanpa transisi, tanpa zona hapus (perilaku lama)
  kecepatanVideo: 1,
  transisiPart: "" as TransisiPart,
  zonaHapus: [] as ZonaHapus[],
  // v2.0.0 — split per durasi (lama), jumlah otomatis mati, resolusi auto,
  // zoom pembicara mati, backsound mati (semua perilaku lama dgn default ini)
  modeSplit: "durasi" as ModeSplit,
  jumlahPartOtomatis: 0,
  resolusiOutput: "auto" as ResolusiOutput,
  zoomPembicara: "mati" as ModePembicara,
  lajuPindah: "normal" as LajuPindah,
  senyapPembicara: "tetap" as "tetap" | "semua",
  backsoundAktif: false,
  backsoundFile: "",
  backsoundVolume: 80,
  // v2.2.0 — intro: animasi bawaan ZOOM MASUK (permintaan user), fade lembut
  // AKTIF (chip "Langsung" tersedia utk potong kering); teks OTOMATIS dr nama file
  introAnimasi: "zoom-masuk" as AnimasiIntro,
  introFade: true,
  introTeksFont: "anton" as NamaFont,
  introTeksUkuran: 64,
  introTeksWarna: "#ffffff",
  introTampil: "semua" as TampilIntro,
  introSuaraFile: "",
  introSuaraVolume: 100,
  mulaiDetik: 0,
  akhirDetik: 0,
  codec: "h264",
  // v0.39.0 — deskripsi: bawaan kosong (fitur mati) + posisi tengah-bawah yang aman
  // v0.40.0 — bawaan ukuran deskripsi 23 (dr 28) · v0.42.0 — tetap 23 (seragam semua)
  deskripsi: "",
  gayaDeskripsi: { font: "bersih", ukuran: 23, warna: "#ffffff", outlineLebar: 3, outlineWarna: "#000000" },
  deskripsiX: 50,
  deskripsiY: 80,
  logoId: "",
  // v0.46.0 — frame & bingkai: bawaan MATI (tanpa frame, tanpa neon)
  frameId: "",
  neonAktif: false,
  neonWarna: "cyan",
  neonTebal: 6,
  neonKecepatan: 1,
  neonDuaGaris: false,
  templateGrad1: "#f59e0b",
  templateGrad2: "#ec4899",
  // v0.44.0 — subtitle AI otomatis: MATI bawaan (ekspor dgn AI menambah waktu
  // analisis suara), ukuran 26 & posisi 12% dari bawah agar tidak menimpa teks lain
  subtitleAktif: false,
  subtitleUkuran: 26,
  subtitleY: 88,
  // v0.47.0 — bawaan FOKUS INDONESIA (paling cepat); deteksi ID/EN opt-in
  subtitleDeteksiBahasa: false,
  // v0.51.0 — bawaan Whisper Small (paling tepat); Base = pilihan "Cepat"
  // v3.3.0 — otak baru whisper.cpp: model CEPAT (base q5_1), bahasa Indonesia
  subtitleCepat: false,
  subtitleModel: "cepat" as ModelSubtitle,
  subtitleBahasa: "id" as BahasaSubtitle,
  // v3.3.0 — mesin efek NOVACUT: mati bawaan (ekspor lama persis sama)
  efekTransisi: "" as IdTransisiNovacut,
  efekTransisiDurasi: DURASI_TRANSISI_NOVACUT_BAWAAN,
  efekKlip: [] as string[],
  // v3.3.0 — template cover intro ("" = gaya lama polos persis)
  introTemplate: "",
  // v0.54.0 — subtitle: putih + outline hitam (persis gaya lama yang hardcoded)
  subtitleWarna: "#ffffff",
  subtitleOutlineWarna: "#000000",
  // v0.54.0 — frame: warna asli (recolor mati) bawaan
  frameWarna: "",
  frameWarna2: "",
  posisiLogo: "kanan-bawah",
  // v0.8.0 posisi bebas logo — default ≈ kanan-bawah lama (kiri-atas logo)
  logoX: 81.5,
  logoY: 88.5,
  ukuranLogo: 15,
  prosesParalel: 2,
  pakaiGpu: true,

  /* v3.4.0 — MENU KINOSTRA (semua mati/normal bawaan KECUALI animasi cover
     slam+slam & transisi cover flash — persis bawaan KINOSTRA mod 13) */
  coverSumber: "auto" as SumberCover,
  coverFile: "",
  coverJudul: "",
  coverLayout: "impact",
  coverPalet: "cyber",
  coverLatar: "adegan" as "adegan" | "hitam",
  coverBingkai: "none" as BingkaiCover,
  coverKataPart: "PART" as KataPartCover,
  coverSkalaPart: 1,
  coverAnimJudul: "slam" as AnimasiCover,
  coverAnimPart: "slam" as AnimasiCover,
  coverTrans: "flash" as IdTransisiNovacut,
  coverTransDurasi: DURASI_TRANSISI_NOVACUT_BAWAAN,
  vfxKecerahan: 1,
  vfxKontras: 1,
  vfxKejenuhan: 1,
  vfxVignette: false,
  vfxGrain: false,
  vfxFilter: "",
  wmMode: "off" as ModeWatermark,
  wmTeks: "@VIDSPLIT",
  wmOpasitas: 0.6,
  kbMode: "off" as ModeKenburns,
  kbKekuatan: 0.3,
  subtitleLagu: false,
  subtitleLewatiSunyi: true,
  subtitleBakar: true,
  subtitleGeser: 0,
};

/**
 * v0.40.0 — migrasi preferensi tersimpan (localStorage) dari instalasi lama:
 *   (1) font bawaan lama "tebal" → "cinzeldec" (lanjutan pola migrasi v0.9.2);
 *   (2) ukuran bawaan lama judul 40 → 35, Part 35 → 30, deskripsi 28 → 23.
 * v0.42.0 — lanjutan: default SEMUA ukuran font = 23 (permintaan user: "rubah
 * default semua ukuran font nya menjadi 23") — nilai bawaan LAMA dinaikkan/
 * diturunkan otomatis ke 23: judul 40/35 → 23, Part 35/30 → 23, deskripsi 28 → 23.
 * Nilai lain yang sengaja dipilih user TIDAK disentuh. Fungsi murni — input tidak
 * diubah, hasil salinan baru. Catatan ambigu (didokumentasikan): 40/35 (judul)
 * dan 35/30 (Part) adalah bawaan lama, jadi user yang sengaja mengatur angka itu
 * ikut bergeser ke 23.
 */
export function migrasiSimpanan(simpanan: Partial<Pengaturan>): Partial<Pengaturan> {
  const hasil = { ...simpanan };
  if (hasil.gayaJudul?.font === "tebal")
    hasil.gayaJudul = { ...hasil.gayaJudul, font: "cinzeldec" };
  if (hasil.gayaPart?.font === "tebal")
    hasil.gayaPart = { ...hasil.gayaPart, font: "cinzeldec" };
  if (hasil.gayaJudul?.ukuran === 40 || hasil.gayaJudul?.ukuran === 35)
    hasil.gayaJudul = { ...hasil.gayaJudul, ukuran: 23 };
  if (hasil.gayaPart?.ukuran === 35 || hasil.gayaPart?.ukuran === 30)
    hasil.gayaPart = { ...hasil.gayaPart, ukuran: 23 };
  if (hasil.gayaDeskripsi?.ukuran === 28)
    hasil.gayaDeskripsi = { ...hasil.gayaDeskripsi, ukuran: 23 };
  // v0.57.0 — simpanan lama tanpa fitur baru: isi bawaan agar tak pernah undefined
  if (hasil.transisiPart === undefined) hasil.transisiPart = "";
  // v3.3.0 — MESIN EFEK NOVACUT: migrasi transisiPart lama → efekTransisi baru
  // (fade→crossfade, slide→slide-l) lalu transisiPart dikosongkan (usang).
  // Field baru diisi bawaan agar simpanan lama tak pernah undefined.
  if (hasil.efekTransisi === undefined) {
    hasil.efekTransisi =
      hasil.transisiPart === "fade" ? "crossfade" : hasil.transisiPart === "slide" ? "slide-l" : "";
  }
  hasil.transisiPart = "";
  if (hasil.efekTransisiDurasi === undefined)
    hasil.efekTransisiDurasi = DURASI_TRANSISI_NOVACUT_BAWAAN;
  else {
    const d = Number(hasil.efekTransisiDurasi);
    hasil.efekTransisiDurasi = Number.isFinite(d)
      ? Math.min(1.5, Math.max(0.2, d))
      : DURASI_TRANSISI_NOVACUT_BAWAAN;
  }
  if (!Array.isArray(hasil.efekKlip)) hasil.efekKlip = [];
  else hasil.efekKlip = hasil.efekKlip.filter((x): x is string => typeof x === "string").slice(0, MAKS_EFEK_KLIP);
  if (hasil.introTemplate === undefined) hasil.introTemplate = "";
  // v3.3.0 — animasi teks: simpanan lama tanpa field → mati
  if (hasil.animasiTeks === undefined) hasil.animasiTeks = "";
  else if (!ANIMASI_TEKS.some((a) => a.id === hasil.animasiTeks)) hasil.animasiTeks = "";
  // v3.5.0 — bingkai judul: nilai tak dikenal → mati (nol regresi)
  if (hasil.bingkaiJudul === undefined) hasil.bingkaiJudul = "";
  else if (hasil.bingkaiJudul !== "" && !BINGKAI_JUDUL.some((b) => b.id === hasil.bingkaiJudul))
    hasil.bingkaiJudul = "";
  // v3.3.0 — otak subtitle whisper.cpp: peta field usang → field baru
  if (hasil.subtitleModel === undefined)
    hasil.subtitleModel = hasil.subtitleCepat === true ? "cepat" : "akurat";
  // v3.4.0 — pilihan model lama tetap sah; simpanan tanpa field baru → bawaan
  // KINOSTRA (turbo pilihan pertama tapi BERAT ±547 MB — bawaan tetap cepat)
  else if (hasil.subtitleModel === "turbo") {
    /* sah */
  }
  if (hasil.subtitleLagu === undefined) hasil.subtitleLagu = false;
  if (hasil.subtitleLewatiSunyi === undefined) hasil.subtitleLewatiSunyi = true;
  if (hasil.subtitleBakar === undefined) hasil.subtitleBakar = true;
  if (hasil.subtitleGeser === undefined) hasil.subtitleGeser = 0;
  else hasil.subtitleGeser = Math.min(30, Math.max(-30, Number(hasil.subtitleGeser) || 0));
  // v3.4.0 — MENU COVER KINOSTRA: simpanan lama dipetakan supaya hasil lama
  // tidak berubah (nol regresi) — template "layout--palet" → chips layout/palet;
  // introFade → coverTrans (fade → crossfade, mati → potong kering);
  // label intro lama ikut kataPart (coverKataPart "" = fallback kataPart).
  if (hasil.coverSumber === undefined) hasil.coverSumber = "auto";
  if (hasil.coverFile === undefined) hasil.coverFile = "";
  if (hasil.coverJudul === undefined) hasil.coverJudul = "";
  if (hasil.coverLayout === undefined || hasil.coverPalet === undefined) {
    const tpl = String((hasil as Record<string, unknown>).introTemplate ?? "");
    const cocok = /^([a-z]+)--([a-z]+)$/.exec(tpl);
    if (cocok) {
      hasil.coverLayout = cocok[1];
      hasil.coverPalet = cocok[2];
    } else {
      // id gaya dasar lama (modern/klasik/futuristik) atau "" polos → dipertahankan
      hasil.coverLayout = ["modern", "klasik", "futuristik"].includes(tpl) ? tpl : "";
      hasil.coverPalet = "cyber";
    }
  }
  if (hasil.coverLatar === undefined) hasil.coverLatar = "adegan";
  if (hasil.coverBingkai === undefined) hasil.coverBingkai = "none";
  if (hasil.coverKataPart === undefined) hasil.coverKataPart = "";
  if (hasil.coverSkalaPart === undefined) hasil.coverSkalaPart = 1;
  else hasil.coverSkalaPart = Math.min(2.5, Math.max(0.5, Number(hasil.coverSkalaPart) || 1));
  // animasi cover lama tak pernah ada → TANPA (hasil lama persis); instalasi
  // BARU (pengaturanDefault) memakai slam/slam ala KINOSTRA
  if (hasil.coverAnimJudul === undefined) hasil.coverAnimJudul = "";
  if (hasil.coverAnimPart === undefined) hasil.coverAnimPart = "";
  if (hasil.coverTrans === undefined) {
    hasil.coverTrans = hasil.introFade === true ? "crossfade" : "";
  }
  if (hasil.coverTransDurasi === undefined)
    hasil.coverTransDurasi = DURASI_TRANSISI_NOVACUT_BAWAAN;
  else {
    const d2 = Number(hasil.coverTransDurasi);
    hasil.coverTransDurasi = Number.isFinite(d2)
      ? Math.min(1.5, Math.max(0.2, d2))
      : DURASI_TRANSISI_NOVACUT_BAWAAN;
  }
  // v3.4.0 — EFEK VISUAL & GERAK (bawaan normal = hasil lama persis)
  if (hasil.vfxKecerahan === undefined) hasil.vfxKecerahan = 1;
  else hasil.vfxKecerahan = Math.min(1.5, Math.max(0.5, Number(hasil.vfxKecerahan) || 1));
  if (hasil.vfxKontras === undefined) hasil.vfxKontras = 1;
  else hasil.vfxKontras = Math.min(1.5, Math.max(0.5, Number(hasil.vfxKontras) || 1));
  if (hasil.vfxKejenuhan === undefined) hasil.vfxKejenuhan = 1;
  else hasil.vfxKejenuhan = Math.min(2, Math.max(0, Number(hasil.vfxKejenuhan) || 1));
  if (hasil.vfxVignette === undefined) hasil.vfxVignette = false;
  if (hasil.vfxGrain === undefined) hasil.vfxGrain = false;
  if (hasil.vfxFilter === undefined) hasil.vfxFilter = "";
  if (hasil.wmMode === undefined)
    hasil.wmMode = (hasil.logoId || "").trim() ? "logo" : "off";
  if (hasil.wmTeks === undefined) hasil.wmTeks = "@VIDSPLIT";
  else hasil.wmTeks = String(hasil.wmTeks).slice(0, 28);
  if (hasil.wmOpasitas === undefined) hasil.wmOpasitas = 0.6;
  else hasil.wmOpasitas = Math.min(1, Math.max(0.1, Number(hasil.wmOpasitas) || 0.6));
  if (hasil.kbMode === undefined) hasil.kbMode = "off";
  if (hasil.kbKekuatan === undefined) hasil.kbKekuatan = 0.3;
  else hasil.kbKekuatan = Math.min(0.6, Math.max(0.05, Number(hasil.kbKekuatan) || 0.3));
  if (hasil.subtitleBahasa === undefined)
    hasil.subtitleBahasa = hasil.subtitleDeteksiBahasa === true ? "enid" : "id";
  if (hasil.kecepatanVideo === undefined) hasil.kecepatanVideo = 1;
  else hasil.kecepatanVideo = rapikanKecepatan(hasil.kecepatanVideo);
  if (hasil.zonaHapus === undefined || !Array.isArray(hasil.zonaHapus))
    hasil.zonaHapus = [];
  // v2.0.0 — simpanan lama tanpa fitur V2: isi bawaan agar tak pernah undefined
  if (hasil.modeSplit === undefined) hasil.modeSplit = "durasi";
  if (hasil.jumlahPartOtomatis === undefined) hasil.jumlahPartOtomatis = 0;
  if (hasil.resolusiOutput === undefined) hasil.resolusiOutput = "auto";
  if (hasil.zoomPembicara === undefined) hasil.zoomPembicara = "mati";
  if (hasil.lajuPindah === undefined) hasil.lajuPindah = "normal";
  if (hasil.senyapPembicara === undefined) hasil.senyapPembicara = "tetap";
  if (hasil.backsoundAktif === undefined) hasil.backsoundAktif = false;
  if (hasil.backsoundFile === undefined) hasil.backsoundFile = "";
  if (hasil.backsoundVolume === undefined) hasil.backsoundVolume = 80;
  else hasil.backsoundVolume = Math.min(150, Math.max(0, Number(hasil.backsoundVolume) || 0));
  // v2.2.0 — simpanan lama: fitur background intro DIGANTI TOTAL (frame dari
  // video). bgId (gambar unggahan) & introTeks (teks manual) dihapus dr simpanan;
  // field baru diisi bawaan; simpanan lama tanpa introAnimasi → "zoom-masuk"
  // (bawaan baru). Nilai yang sengaja dipilih user TIDAK dipaksa berubah.
  delete (hasil as Record<string, unknown>).bgId;
  delete (hasil as Record<string, unknown>).introTeks;
  if (hasil.introAktif === undefined) hasil.introAktif = false;
  if (hasil.introPosisi === undefined) hasil.introPosisi = 35;
  else hasil.introPosisi = Math.min(100, Math.max(0, Math.round(Number(hasil.introPosisi) || 0)));
  if (hasil.introAnimasi === undefined) hasil.introAnimasi = "zoom-masuk";
  if (hasil.introFade === undefined) hasil.introFade = true;
  if (hasil.introTeksFont === undefined) hasil.introTeksFont = "anton";
  if (hasil.introTeksUkuran === undefined) hasil.introTeksUkuran = 64;
  else hasil.introTeksUkuran = Math.min(160, Math.max(20, Math.round(Number(hasil.introTeksUkuran) || 64)));
  if (hasil.introTeksWarna === undefined) hasil.introTeksWarna = "#ffffff";
  if (hasil.introTampil === undefined) hasil.introTampil = "semua";
  if (hasil.introSuaraFile === undefined) hasil.introSuaraFile = "";
  if (hasil.introSuaraVolume === undefined) hasil.introSuaraVolume = 100;
  else hasil.introSuaraVolume = Math.min(150, Math.max(0, Number(hasil.introSuaraVolume) || 0));
  // v2.4.0 — simpanan lama dgn posisiTeks (atas/tengah/bawah) → dipetakan ke
  // posisi bebas baru. "atas" (bawaan) → keduanya OTOMATIS (-1) = PERSIS lama;
  // "tengah"/"bawah" → perkiraan konkret (user bisa geser ulang dgn tombol).
  // Simpanan BARU yang sudah punya judulY tidak disentuh. Kunci lama dibuang.
  if (hasil.judulY === undefined) {
    const m = dariPosisiTeksLama((hasil as Record<string, unknown>).posisiTeks as string);
    hasil.judulX = m.judulX;
    hasil.judulY = m.judulY;
    hasil.partX = m.partX;
    hasil.partY = m.partY;
  }
  delete (hasil as Record<string, unknown>).posisiTeks;
  hasil.judulX = rapikanPosisiXY(hasil.judulX, 50);
  hasil.judulY = rapikanPosisiY(hasil.judulY, -1);
  hasil.partX = rapikanPosisiXY(hasil.partX, 50);
  hasil.partY = rapikanPosisiY(hasil.partY, -1);
  // v2.7.0 — simpanan lama tanpa geser bebas video (panah): isi bawaan tengah.
  // Nilai posisiPotong lama yang dipakai mode blur utk geser kiri/kanan
  // DIMIGRASI: pp 0–100 → geserBlurX −100..100 ((pp−50)×2) supaya hasil lama
  // tetap sama persis; simpanan yang sudah punya geserBlurX tidak disentuh.
  if (hasil.geserBlurX === undefined) {
    const pp = Number(hasil.posisiPotong);
    hasil.geserBlurX = Number.isFinite(pp) ? Math.min(100, Math.max(-100, Math.round((pp - 50) * 2))) : 0;
  }
  if (hasil.geserBlurY === undefined) hasil.geserBlurY = 0;
  return hasil;
}

/** Clamp geser bebas video (−100..100, bawaan bila NaN). Murni. */
export function rapikanGeserBlur(n: unknown, bawaan = 0): number {
  const v = Number(n);
  if (!Number.isFinite(v)) return bawaan;
  return Math.min(100, Math.max(-100, Math.round(v * 10) / 10));
}

/** Clamp X posisi bebas (0–100, bawaan bila NaN). Murni. */
export function rapikanPosisiXY(n: unknown, bawaan: number): number {
  const v = Number(n);
  if (!Number.isFinite(v)) return bawaan;
  return Math.min(100, Math.max(0, Math.round(v * 10) / 10));
}

/** Clamp Y posisi bebas: nilai < 0 → -1 (OTOMATIS); 0–100 → clamp 1 desimal.
 *  Murni. */
export function rapikanPosisiY(n: unknown, bawaan: number): number {
  const v = Number(n);
  if (!Number.isFinite(v)) return bawaan;
  if (v < 0) return -1;
  return Math.min(100, Math.max(0, Math.round(v * 10) / 10));
}

/** v2.4.0 — peta posisiTeks LAMA (atas/tengah/bawah) → posisi bebas baru.
 *  "atas" (bawaan & paling umum) = keduanya -1 (OTOMATIS) → hasil render PERSIS
 *  sama dulu. "tengah"/"bawah" = perkiraan persen utk 9:16 dgn ukuran bawaan —
 *  user bisa menyempurnakan lewat tombol geser. Nilai tak dikenal → "atas".
 *  Murni — dites unit. */
export function dariPosisiTeksLama(pos: unknown): {
  judulX: number; judulY: number; partX: number; partY: number;
} {
  if (pos === "tengah") return { judulX: 50, judulY: 47, partX: 50, partY: 53 };
  if (pos === "bawah") return { judulX: 50, judulY: 77, partX: 50, partY: 88 };
  return { judulX: 50, judulY: -1, partX: 50, partY: -1 }; // "atas" / tak dikenal
}

/** v2.4.0 — hitung posisi Y efektif (px) blok judul & part utk drawtext.
 *  Semantik identik rantai lama: judulY=-1 → margin atas (mrg); partY=-1 →
 *  tepat di bawah blok judul (yJ + tJ + gap) — TERMASUK saat judul kosong
 *  (rantai lama tetap menghitung tJ utk judul kosong = 1 baris, jadi hasil
 *  lama persis dipertahankan). Nilai konkret → H×Y/100, di-clamp agar blok
 *  tak keluar frame. Murni — dites unit & dipakai ffmpeg.ts + Preview.tsx. */
export function posisiTeksBlok(
  judulY: number,
  partY: number,
  H: number,
  mrg: number,
  tJ: number,
  tP: number,
  gap: number,
): { yJ: number; yP: number } {
  const tinggi = Math.max(1, H);
  const yJ = judulY >= 0
    ? Math.min(Math.max(0, tinggi - tJ), Math.max(0, (tinggi * judulY) / 100))
    : mrg;
  const yP = partY >= 0
    ? Math.min(Math.max(0, tinggi - tP), Math.max(0, (tinggi * partY) / 100))
    : yJ + tJ + gap;
  return { yJ, yP };
}

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

/* ============ v0.57.0 — POTONG & HAPUS BAGIAN (zona hapus) ============ */

/** Rapikan daftar zona hapus: clip ke rentang trim, tukar mulai>akhir, buang
 *  zona < 0,5 dtk, urutkan, dan GABUNGKAN yang tumpang-tindih/bersinggungan.
 *  Fungsi murni — dites unit. */
export function rapikanZonaHapus(
  zonas: ZonaHapus[],
  mulaiDetik: number,
  akhirDetik: number,
  durasiVideo: number,
): ZonaHapus[] {
  const efAkhir =
    akhirDetik > 0 ? Math.min(Math.max(akhirDetik, mulaiDetik + 0.5), durasiVideo) : durasiVideo;
  const efMulai = Math.max(0, Math.min(mulaiDetik, efAkhir - 0.5));
  const urut = (zonas || [])
    .map((z) => ({
      mulai: Math.max(efMulai, Math.min(Number(z?.mulai) || 0, Number(z?.akhir) || 0)),
      akhir: Math.min(efAkhir, Math.max(Number(z?.mulai) || 0, Number(z?.akhir) || 0)),
    }))
    .filter((z) => z.akhir - z.mulai >= 0.5)
    .sort((a, b) => a.mulai - b.mulai);
  const gabung: ZonaHapus[] = [];
  for (const z of urut) {
    const last = gabung[gabung.length - 1];
    if (last && z.mulai <= last.akhir + 0.001) last.akhir = Math.max(last.akhir, z.akhir);
    else gabung.push({ ...z });
  }
  return gabung;
}

/** Potongan video yang TETAP DIPROSES = rentang trim minus zona hapus. Potongan
 *  < 0,5 dtk dibuang (terlalu kecil utk satu part). Murni — dites unit. */
export function potonganEfektif(
  durasiVideo: number,
  mulaiDetik: number,
  akhirDetik: number,
  zonas: ZonaHapus[],
): ZonaHapus[] {
  const efAkhir =
    akhirDetik > 0 ? Math.min(Math.max(akhirDetik, mulaiDetik + 0.5), durasiVideo) : durasiVideo;
  const efMulai = Math.max(0, Math.min(mulaiDetik, efAkhir - 0.5));
  const bersih = rapikanZonaHapus(zonas, mulaiDetik, akhirDetik, durasiVideo);
  const pot: ZonaHapus[] = [];
  let kursor = efMulai;
  for (const z of bersih) {
    if (z.mulai > kursor + 0.001) pot.push({ mulai: kursor, akhir: Math.min(z.mulai, efAkhir) });
    kursor = Math.max(kursor, z.akhir);
    if (kursor >= efAkhir) break;
  }
  if (kursor < efAkhir - 0.001) pot.push({ mulai: kursor, akhir: efAkhir });
  return pot.filter((p) => p.akhir - p.mulai >= 0.5);
}

/** Jumlah part dgn zona hapus — tanpa zona = hitungPart lama PERSIS (nol
 *  regresi). Tiap potongan dipecah mandiri (part TIDAK melintasi zona). */
export function hitungPartDgnHapus(
  durasiVideo: number,
  durasiPart: number,
  mulaiDetik: number,
  akhirDetik: number,
  zonas: ZonaHapus[],
): number {
  if (!zonas || !zonas.length)
    return hitungPart(durasiEfektif(durasiVideo, mulaiDetik, akhirDetik), durasiPart);
  const dp = Math.max(1, durasiPart);
  return potonganEfektif(durasiVideo, mulaiDetik, akhirDetik, zonas).reduce(
    (a, p) => a + Math.max(1, Math.ceil((p.akhir - p.mulai) / dp)),
    0,
  );
}

/** [mulai, durasi] part ke-n dgn zona hapus — part mengisi potongan berurutan
 *  dan TIDAK PERNAH melintasi zona. WAJIB dipakai berpasangan dgn
 *  hitungPartDgnHapus (total part sama). Murni — dites unit. */
export function rentangPartHapus(
  n: number,
  durasiVideo: number,
  durasiPart: number,
  mulaiDetik: number,
  akhirDetik: number,
  zonas: ZonaHapus[],
): [number, number] {
  const dp = Math.max(1, durasiPart);
  let sisa = Math.max(1, n);
  for (const p of potonganEfektif(durasiVideo, mulaiDetik, akhirDetik, zonas)) {
    const jml = Math.max(1, Math.ceil((p.akhir - p.mulai) / dp));
    if (sisa <= jml) {
      const mulai = p.mulai + (sisa - 1) * dp;
      return [mulai, Math.min(dp, p.akhir - mulai)];
    }
    sisa -= jml;
  }
  // di luar cakupan (n > total) — nilai aman agar ekspor tidak crash
  return [mulaiDetik, 0.5];
}

/* ============ v2.0.0 — JUMLAH PART OTOMATIS ============ */

/**
 * v2.0.0 — Rapikan JUMLAH PART OTOMATIS dari input user (fungsi murni — dites unit).
 * n > 0 → dibulatkan, clamp 1..MAKS; MAKS = floor(durasiEfektif) (biar tiap part
 * minimal ±1 dtk) dan ≤ 1000 (jaring aman angka ekstrem). n ≤ 0 / NaN / kosong
 * → 0 (mati — ikuti durasiPart manual). Video < 1 dtk → 0 (tidak bermakna).
 */
export function rapikanJumlahPart(n: unknown, durasiEfektif: number): number {
  const x = Math.floor(Number(n));
  if (!Number.isFinite(x) || x <= 0) return 0;
  if (!(durasiEfektif >= 1)) return 0;
  const maks = Math.min(1000, Math.floor(durasiEfektif));
  return Math.max(1, Math.min(maks, x));
}

/**
 * v2.0.0 — Durasi part yang BENAR-BENAR dipakai (fungsi murni — dites unit):
 * jumlahPartOtomatis aktif → durasi part = PANJANG TOTAL YANG DIPROSES ÷ jumlah
 * (tanpa zona) / ÷ jumlah dgn zona juga (part mengisi potongan dgn durasi sama,
 * potongan terakhir bisa lebih pendek — persis perilaku split biasa).
 * Jumlah mati → durasiPart manual seperti lama (nol perubahan).
 */
export function durasiPartDipakai(
  p: { jumlahPartOtomatis?: number; durasiPart: number },
  durasiVideo: number,
  mulaiDetik = 0,
  akhirDetik = 0,
  zonas: ZonaHapus[] = [],
): number {
  const n = Math.floor(Number(p.jumlahPartOtomatis) || 0);
  if (n <= 0) return Math.max(1, p.durasiPart);
  const efektif = durasiEfektif(durasiVideo, mulaiDetik, akhirDetik);
  let panjang = efektif;
  if (zonas && zonas.length) {
    const pot = potonganEfektif(durasiVideo, mulaiDetik, akhirDetik, zonas);
    panjang = pot.reduce((a, z) => a + (z.akhir - z.mulai), 0);
  }
  return Math.max(1, panjang / n);
}

/**
 * v2.0.0 — Hitung part MENGHORMATI jumlah otomatis (murni — dites unit).
 * Tanpa zona = hitungPart lama dgn durasi part efektif; dgn zona = per potongan.
 */
export function hitungPartV2(
  durasiVideo: number,
  p: { jumlahPartOtomatis?: number; durasiPart: number },
  mulaiDetik = 0,
  akhirDetik = 0,
  zonas: ZonaHapus[] = [],
): number {
  const n = Math.floor(Number(p.jumlahPartOtomatis) || 0);
  if (n <= 0) return hitungPartDgnHapus(durasiVideo, p.durasiPart, mulaiDetik, akhirDetik, zonas);
  return Math.max(1, hitungPartDgnHapus(durasiVideo, durasiPartDipakai(p, durasiVideo, mulaiDetik, akhirDetik, zonas), mulaiDetik, akhirDetik, zonas));
}

/**
 * v2.0.0 — Posisi lagu KONTINU antar part (murni — dites unit): offset (detik,
 * pada waktu HASIL) tempat backsound mulai diputar utk part ke-n.
 * = Σ (durasi sumber part k<n + intro per part) ÷ kecepatan — zona hapus ikut
 * dilewati (lagu berjalan di atas hasil akhir, bagian yang dihapus tak memutar
 * lagu). Part pertama → 0.
 */
export function offsetBacksound(
  n: number,
  durasiVideo: number,
  durasiPart: number,
  mulaiDetik: number,
  akhirDetik: number,
  zonas: ZonaHapus[],
  pakaiIntro: boolean,
  durasiIntro: number,
  kecepatan: number,
  /** v2.1.0 — predikat part-ke-k menampilkan intro (introTampil gating).
   *  Absen = semua part ber-intro (perilaku lama). */
  introUntuk?: (k: number) => boolean,
): number {
  const kec = Math.max(0.1, kecepatan || 1);
  let sumberDetik = 0;
  if (n <= 1) return 0;
  for (let k = 1; k < Math.floor(n); k++) {
    const [m, d] =
      zonas && zonas.length
        ? rentangPartHapus(k, durasiVideo, durasiPart, mulaiDetik, akhirDetik, zonas)
        : rentangPart(k, durasiVideo, durasiPart, mulaiDetik, akhirDetik);
    sumberDetik += d;
    if (pakaiIntro && (introUntuk ? introUntuk(k) : true)) sumberDetik += Math.max(0, durasiIntro);
  }
  return Math.max(0, sumberDetik / kec);
}

/* ============ v2.0.0 — RESOLUSI OUTPUT ============ */

/** Pemetaan resolusi output (LANDSCAPE dasar — vertikal dibalik di dimensiOutput) */
export const RESOLUSI_OUTPUT_PX: Record<Exclude<ResolusiOutput, "auto">, [number, number]> = {
  "720p": [1280, 720],
  "1080p": [1920, 1080],
  "2k": [2560, 1440],
  "4k": [3840, 2160],
};

/** Label ramah resolusi (vertikal 9:16 sesuai konvensi TikTok/Shorts) */
export function labelResolusiOutput(r: ResolusiOutput): string {
  if (r === "auto") return "Auto (ikuti skala lama)";
  const [w, h] = RESOLUSI_OUTPUT_PX[r];
  const nama: Record<string, string> = { "720p": "720p HD", "1080p": "1080p FULL HD", "2k": "2K QHD", "4k": "4K ULTRA HD" };
  return `${nama[r]} — ${h} × ${w}`;
}

/**
 * v2.0.0 — Dimensi render akhir (murni — dites unit). Mode "asli" tetap ikut
 * sumber (digenapkan). Mode vertikal: resolusiOutput ≠ auto → kunci ke px
 * pilihan user DIBALIK (4K vertikal = 2160×3840); auto → perilaku lama
 * (resolusi 720/1080).
 */
export function dimensiOutput(
  mode: ModeKonversi,
  resolusi: Resolusi,
  resolusiOutput: ResolusiOutput,
  lebarSumber: number,
  tinggiSumber: number,
): { W: number; H: number } {
  if (mode === "asli") {
    return {
      W: Math.max(2, (lebarSumber || 2) - ((lebarSumber || 2) % 2)),
      H: Math.max(2, (tinggiSumber || 2) - ((tinggiSumber || 2) % 2)),
    };
  }
  const r = (resolusiOutput || "auto") as ResolusiOutput;
  if (r !== "auto" && RESOLUSI_OUTPUT_PX[r]) {
    const [wl, hl] = RESOLUSI_OUTPUT_PX[r];
    return { W: hl, H: wl }; // dibalik: vertikal 9:16 (4K = 2160×3840)
  }
  return resolusi === "720" ? { W: 720, H: 1280 } : { W: 1080, H: 1920 };
}

/**
 * v2.0.0 — H.264 level sesuai standar utk resolusi/fps (murni — dites unit):
 * ≥2K → "5.1"; 4K (3840×2160) → "5.1" bila ≤30 fps, "5.2" bila lebih (60 fps).
 * Resolusi kecil → null (biarkan encoder pilih otomatis seperti lama).
 */
export function levelH264(lebar: number, tinggi: number, fps: number): string | null {
  const w = Math.max(lebar, 0);
  const h = Math.max(tinggi, 0);
  const maksSisi = Math.max(w, h);
  const f = Math.max(1, fps || 30);
  if (maksSisi >= 3840) return f > 30 ? "5.2" : "5.1";
  if (maksSisi >= 2560) return "5.1";
  return null;
}

/**
 * v2.0.0 — Bitrate target dari KOMPRES PINTAR (murni — dites unit): target MB
 * untuk total file (video+audio) dgn durasi tertentu → kbps video.
 * Audio 192 kbps dikurangkan dulu. target ≤ 0 / durasi ≤ 0 → null (mati).
 * Plafon aman 100 Mbps (4K). Lantai 200 kbps agar tak absurd.
 */
export function bitrateKbpsTarget(targetMb: number, durasiDetik: number): number | null {
  const mb = Number(targetMb);
  const d = Number(durasiDetik);
  if (!Number.isFinite(mb) || mb <= 0 || !Number.isFinite(d) || d <= 0) return null;
  const totalKbps = (mb * 8 * 1024) / d;
  const video = totalKbps - 192;
  return Math.round(Math.min(100_000, Math.max(200, video)));
}

/** v0.38.0 — salinan SELEKTIF utk tombol "Terapkan pengaturan video #N ke SEMUA video".
 *  Yang mengikuti video sumber HANYA 3 kartu ini:
 *   • kartu 1 — Cara ubah ke vertikal (mode, warna latar, posisi potong, zoom
 *     potong (v0.50.0), zoom blur (v0.51.0), resolusi, codec, rentang diproses)
 *   • kartu 3 — Tulisan Part otomatis (kata part, durasi, gaya huruf, posisi teks)
 *   • kartu 6 — Watermark / logo (logoId, posisi & ukuran)
 *  Yang TIDAK disentuh (tetap milik masing-masing video):
 *   • kartu 2 — Tulisan judul (judul + gayaJudul) — tiap video punya judulnya sendiri
 *   • kartu 4 — Tulis Deskripsi (deskripsi + gayaDeskripsi + deskripsiX/Y) — tiap
 *     video punya deskripsinya sendiri (v0.39.0)
 *   • kartu 5 — Background intro (introAktif + introPosisi + durasiIntro)
 *   • setelan performa ekspor (prosesParalel, pakaiGpu)
 *  v0.41.0 — UKURAN HURUF tidak ikut lagi (permintaan user: "hanya ukuran
 *  videonya ya kawan bukan judul dan part nya"): gaya huruf Part
 *  (font/warna/outline) tetap mengikuti sumber, tapi ukuran huruf Part tiap
 *  video tetap miliknya sendiri; ukuran judul & deskripsi memang tidak pernah
 *  ikut tersalin. */
export function terapkanSebagian(sumber: Pengaturan, target: Pengaturan): Pengaturan {
  return {
    ...target,
    // kartu 1 — Cara ubah ke vertikal
    mode: sumber.mode,
    warnaLatar: sumber.warnaLatar,
    posisiPotong: sumber.posisiPotong,
    zoomPotong: sumber.zoomPotong,
    zoomBlur: sumber.zoomBlur,
    // v2.7.0 — geser bebas video (panah) ikut kartu 01 saat "Terapkan ke SEMUA"
    geserBlurX: sumber.geserBlurX ?? 0,
    geserBlurY: sumber.geserBlurY ?? 0,
    resolusi: sumber.resolusi,
    codec: sumber.codec,
    mulaiDetik: sumber.mulaiDetik,
    akhirDetik: sumber.akhirDetik,
    // v0.57.0 — kecepatan tayang, transisi antar part & zona hapus ikut
    // diterapkan ke semua video (zona disalin dalam agar tak bersambung referensi)
    // v3.3.0 — transisiPart usang → mesin NOVACUT: efekTransisi (+durasi) dan
    // daftar efek klip (disalin dalam) ikut "Terapkan ke SEMUA"
    kecepatanVideo: sumber.kecepatanVideo,
    transisiPart: "",
    efekTransisi: sumber.efekTransisi,
    efekTransisiDurasi: sumber.efekTransisiDurasi,
    efekKlip: (sumber.efekKlip || []).slice(0, MAKS_EFEK_KLIP),
    zonaHapus: (sumber.zonaHapus || []).map((z) => ({ ...z })),
    // v2.0.0 — mode split, jumlah otomatis, resolusi output, zoom pembicara &
    // backsound ikut diterapkan ke semua video (sesuai kartu 1 & 3 + panel baru)
    modeSplit: sumber.modeSplit,
    jumlahPartOtomatis: sumber.jumlahPartOtomatis,
    resolusiOutput: sumber.resolusiOutput,
    zoomPembicara: sumber.zoomPembicara,
    lajuPindah: sumber.lajuPindah,
    senyapPembicara: sumber.senyapPembicara,
    backsoundAktif: sumber.backsoundAktif,
    backsoundFile: sumber.backsoundFile,
    backsoundVolume: sumber.backsoundVolume,
    // kartu 3 — Tulisan Part otomatis (v0.41.0: ukuran huruf TETAP milik target;
    // v2.4.0: posisi bebas Part ikut — posisi judul tetap milik masing-masing
    // video karena termasuk kartu 2)
    kataPart: sumber.kataPart,
    durasiPart: sumber.durasiPart,
    animasiTeks: sumber.animasiTeks,
    // v3.5.0 — bingkai judul futuristik ikut diterapkan ke semua video
    bingkaiJudul: sumber.bingkaiJudul,
    gayaPart: { ...sumber.gayaPart, ukuran: target.gayaPart.ukuran },
    partX: sumber.partX,
    partY: sumber.partY,
    // kartu 5 — Watermark / logo
    logoId: sumber.logoId,
    posisiLogo: sumber.posisiLogo,
    logoX: sumber.logoX,
    logoY: sumber.logoY,
    ukuranLogo: sumber.ukuranLogo,
  };
}

/** v0.42.0 — bagian teks yang ukuran hurufnya bisa diterapkan ke semua video:
 *  judul (kartu 2), part (kartu 3), deskripsi (kartu 4). */
export type BagianUkuran = "judul" | "part" | "deskripsi";

/**
 * v0.42.0 — salin UKURAN HURUF satu bagian dari video sumber ke target.
 * Permintaan user: "saya ingin mengubah ukuran font bisa diterapkan ke semua
 * video" — kini tiap panel tulisan punya tombol "Terapkan ukuran ke semua video".
 * HANYA angka ukuran yang ikut — font/warna/outline tiap video tetap miliknya
 * (berbeda dgn terapkanSebagian yang tidak menyentuh ukuran sama sekali).
 * Fungsi murni — input tidak diubah.
 */
export function terapkanUkuranHuruf(
  sumber: Pengaturan,
  target: Pengaturan,
  bagian: BagianUkuran,
): Pengaturan {
  if (bagian === "judul")
    return { ...target, gayaJudul: { ...target.gayaJudul, ukuran: sumber.gayaJudul.ukuran } };
  if (bagian === "part")
    return { ...target, gayaPart: { ...target.gayaPart, ukuran: sumber.gayaPart.ukuran } };
  return {
    ...target,
    gayaDeskripsi: { ...target.gayaDeskripsi, ukuran: sumber.gayaDeskripsi.ukuran },
  };
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

/** v0.8.0 — preset cepat posisi logo: chip sudut mengisi logoX/logoY (persen frame,
 *  titik kiri-atas logo). Angka margin ≈ perilaku lama (3.5% dari lebar, 3% dari tinggi). */
export const POSISI_LOGO_PRESET: Record<PosisiLogo, { x: number; y: number }> = {
  "kiri-atas": { x: 3.5, y: 3 },
  "kanan-atas": { x: 81.5, y: 3 },
  "kiri-bawah": { x: 3.5, y: 88.5 },
  "kanan-bawah": { x: 81.5, y: 88.5 },
};

/** Label ramah utk mode konversi (dipakai ringkasan & panel lain) */
export function labelMode(m: ModeKonversi): string {
  const map: Record<ModeKonversi, string> = {
    blur: "Blur lembut",
    crop: "Potong penuh",
    warna: "Warna solid",
    asli: "Video original",
    template: "Template halaman",
  };
  return map[m];
}

/** Hex #rrggbb valid? (murni — dipakai warna subtitle & frame v0.54.0) */
export function hexValid(h: string | undefined | null): boolean {
  return typeof h === "string" && /^#[0-9a-fA-F]{6}$/.test(h.trim());
}

/** Rapikan warna hex → "#rrggbb" huruf kecil; null bila tidak valid / kosong.
 *  Fungsi murni — dites di scripts/uji-subtitle.ts. */
export function rapikanHex(h: string | undefined | null): string | null {
  if (!hexValid(h)) return null;
  return (h as string).trim().toLowerCase();
}

/**
 * v0.54.0 — URL pratinjau frame DENGAN warna pilihan user.
 * frameWarna kosong → URL PNG asli (perilaku lama); diisi → lewat API
 * /api/bingkai-warna yang mewarnai ulang frame di server (cache) — dipakai
 * pratinjau live & kartu pilihan frame agar WYSIWYG dgn hasil ekspor.
 */
export function urlBingkaiWarna(
  p: { frameId: string; frameWarna?: string; frameWarna2?: string },
  lanskap = false,
): string {
  const c1 = rapikanHex(p.frameWarna);
  if (!c1) return urlBingkai(p.frameId, lanskap);
  const c2 = rapikanHex(p.frameWarna2);
  const q = new URLSearchParams({ frame: p.frameId, c1, l: lanskap ? "1" : "0" });
  if (c2) q.set("c2", c2);
  return `/api/bingkai-warna?${q.toString()}`;
}

/** v0.47.0 — URL pratinjau frame hiasan: bawaan = varian rasio
 *  /bingkai/<slug>-916.png (potret, bawaan) atau -169.png (lanskap),
 *  unggahan = API file kerja. "" → "". */
export function urlBingkai(frameId: string, lanskap = false): string {
  const id = (frameId || "").trim();
  if (!id) return "";
  if (id.startsWith("bawaan:")) {
    const slug = id.slice(7);
    return `/bingkai/${encodeURIComponent(slug)}-${lanskap ? "169" : "916"}.png`;
  }
  if (id.startsWith("upload/")) return `/api/file?p=${encodeURIComponent(id)}`;
  return "";
}

/** v0.46.0 — setelan neon terstruktur dari pengaturan flat (clamp aman) */
export function neonDari(p: {
  neonAktif?: boolean;
  neonWarna?: string;
  neonTebal?: number;
  neonKecepatan?: number;
  neonDuaGaris?: boolean;
}): SetelanNeon {
  return rapikanNeon({
    aktif: p.neonAktif,
    warna: p.neonWarna as SetelanNeon["warna"],
    tebal: p.neonTebal,
    kecepatan: p.neonKecepatan,
    duaGaris: p.neonDuaGaris,
  });
}

/** v0.46.0 — setelan template terstruktur dari pengaturan flat (clamp aman) */
export function templatDari(p: {
  templateGrad1?: string;
  templateGrad2?: string;
}): SetelanTemplat {
  return rapikanTemplat({ grad1: p.templateGrad1, grad2: p.templateGrad2 });
}

/**
 * v0.46.0 — salin setelan FRAME & BINGKAI dari video sumber ke target.
 * Permintaan user: "Frame berlaku ke semua video dalam antrean sekaligus" —
 * panel Frame & Bingkai punya tombol terapkan-ke-semua yang memakai fungsi ini.
 * Mencakup: frame hiasan, seluruh setelan neon, warna gradasi template.
 * Fungsi murni — input tidak diubah.
 */
export function terapkanFrame(sumber: Pengaturan, target: Pengaturan): Pengaturan {
  return {
    ...target,
    frameId: sumber.frameId,
    neonAktif: sumber.neonAktif,
    neonWarna: sumber.neonWarna,
    neonTebal: sumber.neonTebal,
    neonKecepatan: sumber.neonKecepatan,
    neonDuaGaris: sumber.neonDuaGaris,
    templateGrad1: sumber.templateGrad1,
    templateGrad2: sumber.templateGrad2,
    // v0.54.0 — warna frame (recolor) ikut tersalin
    frameWarna: sumber.frameWarna,
    frameWarna2: sumber.frameWarna2,
  };
}

/** Uraikan teks waktu jadi detik — terima "90", "1:30", "1:02:03" — -1 bila tak valid */
export function uraiWaktu(teks: string): number {
  const t = (teks || "").trim();
  if (!t || !/^(\d+:){0,2}\d+(\.\d+)?$/.test(t)) return -1;
  let det = 0;
  for (const bagian of t.split(":")) det = det * 60 + Number(bagian);
  return Number.isFinite(det) ? det : -1;
}

/** v0.50.0 — Label ramah utk zoom potong 50–100 */
export function labelZoomPotong(n: number): string {
  const z = Math.round(Math.min(100, Math.max(50, n)));
  if (z >= 100) return "Potong penuh (100%)";
  if (z >= 90) return `Sangat dekat (${z}%)`;
  if (z >= 75) return `Dekat (${z}%)`;
  if (z >= 60) return `Sedang (${z}%)`;
  return `Setengah — latar blur (${z}%)`;
}

/** v0.51.0 — Label ramah utk zoom blur 100–300 */
export function labelZoomBlur(n: number): string {
  const z = Math.round(Math.min(300, Math.max(100, Number.isFinite(n) ? n : 100)));
  if (z <= 100) return "Pas layar (100%)";
  if (z <= 130) return `Agak besar (${z}%)`;
  if (z <= 200) return `Besar (${z}%)`;
  return `Sangat besar (${z}%)`;
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

/** Judul otomatis dari nama file video — "video-kuda_laut.mp4" → "Video Kuda Laut".
 *  Buang ekstensi & path, ganti pemisah umum jadi spasi, pisah camelCase,
 *  kapitalisasi tiap kata, potong 80 karakter agar aman di layar. */
export function judulDariNama(nama: string): string {
  const dasar = (nama || "").replace(/^.*[\\/]/, "").replace(/\.[^.]+$/, "");
  const bersih = dasar
    .replace(/[_\-.]+/g, " ")
    .replace(/([a-zà-ÿ])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
  if (!bersih) return "";
  const kapital = bersih
    .split(" ")
    .map((k) => k[0].toUpperCase() + k.slice(1).toLowerCase())
    .join(" ");
  return kapital.length > 80 ? kapital.slice(0, 80).trimEnd() + "…" : kapital;
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

/**
 * v0.58.0 — slug UNIK per video dalam satu antrean (fungsi murni — dites unit):
 * dua video dengan judul sama (atau dua-duanya kosong) dulu menghasilkan nama
 * part file IDENTIK di folder output bersama → hasil saling menimpa tanpa
 * peringatan. Judul ke-2 dst. yang bentrok diberi akhiran -2, -3, …
 * Judul unik → hasil persis slugify() lama (nol perubahan perilaku lama).
 */
export function slugUnikDaftar(judul: string[]): string[] {
  const pemakaian = new Map<string, number>();
  return judul.map((t) => {
    const dasar = slugify(t);
    const c = pemakaian.get(dasar) ?? 0;
    pemakaian.set(dasar, c + 1);
    return c === 0 ? dasar : `${dasar}-${c + 1}`;
  });
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
