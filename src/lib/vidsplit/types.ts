// VidSplit — tipe data & pengaturan aplikasi
import { rapikanNeon, type SetelanNeon } from "./neonLayar";
import { rapikanTemplat, type SetelanTemplat } from "./templatLayar";

/** "asli" = video original — tanpa konversi, rasio/ukuran tetap seperti sumber.
 *  v0.46.0 "template" = halaman desain 9:16: judul di kotak atas, video DI DALAM
 *  kotak tengah, deskripsi & Part di kotak bawah, latar gradasi (sketsa user). */
export type ModeKonversi = "blur" | "crop" | "warna" | "asli" | "template";
export type Resolusi = "1080" | "720";

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
 *  "slide" = geser (masuk dari kanan, keluar ke kiri) */
export type TransisiPart = "" | "fade" | "slide";
/** durasi transisi tiap sisi (detik) */
export const DURASI_TRANSISI = 0.5;
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
  /** path relatif background di work/upload ("" = tanpa bg) */
  bgId: string;
  /** durasi intro background di awal tiap potongan (1–10 dtk) */
  durasiIntro: number;
  resolusi: Resolusi;
  posisiTeks: PosisiTeks;
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
   *  300 = paling besar (±3×). */
  zoomBlur: number;
  /** v0.57.0 — kecepatan tayang video (0,5–2 ×; bawaan 1 = normal).
   *  Video & audio dipercepat/diperlambat seragam; subtitle ikut bergeser
   *  otomatis; durasi part hasil = durasi sumber ÷ kecepatan. */
  kecepatanVideo: number;
  /** v0.57.0 — transisi antar part ("" = tanpa; "fade" = pudar hitam;
   *  "slide" = geser dari kanan → keluar ke kiri). Diterapkan di AWAL & AKHIR
   *  tiap part sehingga antar part terasa ada perpindahannya. */
  transisiPart: TransisiPart;
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
   *  BASE — ±2–3× lebih cepat di CPU, ketepatan sedikit turun (video panjang). */
  subtitleCepat: boolean;
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
  bgId: "",
  durasiIntro: 3,
  resolusi: "1080",
  posisiTeks: "atas",
  posisiPotong: 50,
  // v0.50.0 — zoom manual potong: bawaan 100 = perilaku lama (potong penuh)
  zoomPotong: 100,
  // v0.51.0 — zoom manual blur: bawaan 100 = perilaku lama (video pas layar)
  zoomBlur: 100,
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
  subtitleCepat: false,
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
  return hasil;
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
    if (pakaiIntro) sumberDetik += Math.max(0, durasiIntro);
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
 *   • kartu 5 — Background intro (bgId + durasiIntro)
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
    resolusi: sumber.resolusi,
    codec: sumber.codec,
    mulaiDetik: sumber.mulaiDetik,
    akhirDetik: sumber.akhirDetik,
    // v0.57.0 — kecepatan tayang, transisi antar part & zona hapus ikut
    // diterapkan ke semua video (zona disalin dalam agar tak bersambung referensi)
    kecepatanVideo: sumber.kecepatanVideo,
    transisiPart: sumber.transisiPart,
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
    // kartu 3 — Tulisan Part otomatis (v0.41.0: ukuran huruf TETAP milik target)
    kataPart: sumber.kataPart,
    durasiPart: sumber.durasiPart,
    gayaPart: { ...sumber.gayaPart, ukuran: target.gayaPart.ukuran },
    posisiTeks: sumber.posisiTeks,
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
