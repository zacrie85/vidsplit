// VidSplit v0.44.0 — SUBTITLE AI OTOMATIS (100% OFFLINE, tanpa unggahan ke internet)
// Permintaan user: "fitur AI yang bisa automatis membuat subtitle dalam bahasa
// indonesia yang di ambil dari suara yang ada di dalam video dan langsung muncul
// di dalam video yang akan di eksport dan split... baik suara dalam bahasa
// indonesia maupun dalam bahasa inggris akan otomatis dibuatkan teksnya dalam
// bahasa indonesia".
//
// Alur lengkap:
//  1. ffmpeg mengekstrak audio video (rentang trim) → PCM float32 mono 16 kHz
//  2. WHISPER (whisper-small q8 via onnxruntime-node) → segmen {a,b,t} bertanda waktu
//     · transformers.js TIDAK mendeteksi bahasa otomatis (default Inggris) — maka
//       dilakukan DETEKSI GANDA: 24 dtk pertama ditranskrip dua kali (dipaksa
//       "indonesian" dan "english"), skor kata umum memilih bahasa yang benar,
//       lalu audio PENUH ditranskrip sekali dengan bahasa terpilih.
//  3. Bila bahasa Inggris → OPUS-MT (Xenova/opus-mt-en-id q8) menerjemahkan tiap
//     segmen ke bahasa Indonesia (batch per 8 segmen). Model terjemahan tidak ada?
//     teks Inggris asli tetap dipakai + peringatan (tidak menggagalkan ekspor).
//  4. Hasil di-cache per (file, ukuran, mtime, trim) di work/subtitle-ai/<hash>.json
//     — ekspor ulang video yang sama TIDAK menghitung ulang AI (instan).
//  5. Tiap part dirender libass: filter `subtitles=filename=<ass>:fontsdir=<fonts>`
//     (pola yang sama dengan Studio Musik) — posisi/warna via gaya ASS.
//
// Model dibundel di assets/ai-models → resources/ai-models (extraResources) dengan
// struktur repo HF: <dir>/onnx-community/whisper-small/... dan <dir>/Xenova/opus-mt-en-id/...
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export interface SegmenSub {
  /** detik mulai (relatif rentang trim) */
  a: number;
  /** detik akhir (relatif rentang trim) */
  b: number;
  /** teks (sudah bahasa Indonesia bila suara Inggris) */
  t: string;
}

export const ID_MODEL_WHISPER = "onnx-community/whisper-small";
/** v0.51.0 — model CEPAT (±2–3× lebih cepat dari small di CPU, ketepatan sedikit
 *  turun) — pilihan user di PanelSubtitle: "Cepat — Whisper Base". */
export const ID_MODEL_WHISPER_CEPAT = "onnx-community/whisper-base";
export const ID_MODEL_TERJEMAH = "Xenova/opus-mt-en-id";
/** batas aman durasi audio yang dianalisis (4 jam) — cegah memori membengkak */
export const MAKS_DURASI_ANALISIS = 4 * 3600;
/** panjang potongan deteksi bahasa (detik) — hanya mode "deteksi" */
export const DURASI_DETEKSI = 24;
/** ukuran batch terjemahan */
export const BATCH_TERJEMAH = 8;
/**
 * v0.47.0 — PERCEPATAN: audio dibagi blok ±90 dtk lalu ditranskrip PARALEL
 * dgn beberapa sesi Whisper (decoder Whisper = token-per-token, CPU jarang
 * penuh — sesi ganda saling mengisi). Blok berjarak sama, tumpang-tindih
 * OVERLAP_BLOK detik di batasnya agar kalimat yang memotong batas tetap utuh.
 */
export const DURASI_BLOK = 90;
export const OVERLAP_BLOK = 1.5;
/**
 * v0.51.0 — PERCEPATAN 2: blok yang RMS-nya di bawah AMBATANG_SUNYI (±-50 dBFS)
 * dianggap SUNYI dan DILEWATI tanpa transkrip — intro/instrumen/keheningan
 * tidak lagi memakan waktu decode Whisper (plus menghilangkan sumber
 * halusinasi teks pada bagian tanpa suara).
 */
export const AMBATANG_SUNYI = 0.003;
/**
 * v0.54.0 — JUMLAH BENANG (thread) ONNX PER SESI dari kemampuan mesin (murni —
 * dites unit). Dulu: tiap sesi onnxruntime memakai SEMUA core fisik — dgn pool
 * 4 sesi paralel di mesin 8 core = 32 benang menimpa-nimpa (thrashing) sehingga
 * transkrip jauh lebih lambat dr seharusnya. Lalu v0.54 benang per sesi = core ÷
 * jalur (8 core ÷ 4 jalur = 2 benang × 4 sesi = 8 benang).
 * v0.55.0 — SISAKAN CORE UTK RENDER: transkrip latar berjalan BERBARENGAN dgn
 * render ffmpeg (v0.53). Bila 4 sesi memakai seluruh 8 core, ffmpeg TIDAK
 * kebagian CPU → render part 45 dtk melorot ke 0,06x (fps 1,9) → kena batas
 * waktu 675 dtk & eksport gagal (laporan user v0.54). Kini benang per sesi =
 * (core − 2) ÷ jalur (min 1, maks 8) — render SELALU punya ±2 core.
 * 0 = biarkan bawaan (dipakai bila hanya 1 jalur).
 * env VIDSPLIT_AI_BENANG memaksa nilai (1–16).
 */
export function benangPerSesi(cores: number, ramGb: number): number {
  const env = Number(process.env.VIDSPLIT_AI_BENANG || "");
  if (Number.isFinite(env) && env >= 1) return Math.min(16, Math.floor(env));
  const jalur = jumlahPipaParalel(cores, ramGb);
  if (jalur <= 1) return 0; // satu jalur → default bawaan (semua core utk 1 sesi)
  return Math.min(8, Math.max(1, Math.floor((cores - 2) / jalur)));
}

/**
 * v0.54.0 — OPSI DECODE WHISPER per blok (murni — dites unit):
 *  · do_sample: false — greedy deterministik (identik dulu, dijamin tidak
 *    berubah-ubah antar percobaan);
 *  · model Cepat (Base) + no_repeat_ngram_size 3 — memblok loop 3-gram
 *    (halusinasi berulang khas model kecil) tanpa biaya waktu berarti.
 * Model Tepat (Small) TIDAK diubah perilakunya (tanpa ngram) — hasil lama
 * tetap konsisten dgn cache.
 */
export function opsiAsrWhisper(bahasa: "id" | "en", cepat: boolean): Record<string, unknown> {
  const dasar: Record<string, unknown> = {
    chunk_length_s: 30,
    stride_length_s: 5,
    return_timestamps: true,
    language: bahasa === "id" ? "indonesian" : "english",
    task: "transcribe",
    do_sample: false,
  };
  if (cepat) dasar.no_repeat_ngram_size = 3;
  return dasar;
}

/**
 * v0.54.0 — WARNA TEKS SUBTITLE: "#rrggbb" → warna ASS "&H00BBGGRR" (BGR!
 * & alpha 00 = pekat). Hex tak valid / kosong → nilai cadangan (putih/hitam)
 * supaya ekspor tidak pernah gagal krn warna. Fungsi murni — dites unit.
 */
export function warnaAss(hex: string | undefined | null, cadangan = "#ffffff"): string {
  const h = typeof hex === "string" ? hex.trim() : "";
  const cocok = /^#[0-9a-fA-F]{6}$/.test(h) ? h : cadangan;
  const r = cocok.slice(1, 3);
  const g = cocok.slice(3, 5);
  const b = cocok.slice(5, 7);
  return `&H00${b}${g}${r}`.toUpperCase();
}

/**
 * v0.54.0 — PERBAIKAN EJAAN RINGAN pasca-transkrip (murni — dites unit).
 * Model kecil (Base) sering salah menulis kata umum Indonesia dgn varian mirip
 * (spasi hilang sebelum "-nya", artefak karakter aneh). Dua aturan aman:
 *  · sambung spasi sebelum akhiran enklitik "-nya/lah/kah/pun" yang terpisah;
 *  · buang tanda kutip salindung ` (artefak decode Base).
 * Konservatif — TIDAK mengganti kata dgn kamus (berisiko merusak teks benar).
 */
export function perbaikiEjaan(teks: string): string {
  return (teks || "")
    .replace(/`/g, "")
    .replace(/\s+(nya|lah|kah|pun)\b/gi, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * v0.47.0 — mode bahasa:
 *  · "fokus" (bawaan) = LANGSUNG transkrip bahasa Indonesia sekali jalan —
 *    tanpa deteksi ganda (dulu 24 dtk ditranskrip 2x = buang waktu), tanpa
 *    muat penerjemah. Paling cepat, sesuai pemakaian umum aplikasi.
 *  · "deteksi" (mode lama) = uji Indonesia vs Inggris dulu, terjemah EN→ID
 *    bila suara Inggris. Lebih lambat — dipakai bila video ada suara Inggris.
 */
export type ModeBahasa = "fokus" | "deteksi";

export interface OpsiTranskrip {
  onTahap?: (tahap: string) => void;
  modeBahasa?: ModeBahasa;
  /** v0.51.0 — true = pakai Whisper Base (cepat, ketepatan sedikit turun);
   *  false (bawaan) = Whisper Small (paling tepat). Hasil cache dipisah.
   *  v0.51.2 — model Base tak ada di bundel? otomatis jatuh ke Small + peringatan
   *  (dulu: gagal diam-diam → video diekspor tanpa subtitle). */
  modelCepat?: boolean;
  /** v0.53.0 — blok PERTAMA dibuat lebih pendek (detik, "kickstart") supaya
   *  zona part-part awal cepat tercakup dan render part bisa mulai lebih awal.
   *  0/undefined = perilaku lama (blok seragam DURASI_BLOK). */
  blokPertamaDtk?: number;
  /** v0.53.0 — daftar zona SEMUA blok (termasuk blok sunyi) dilaporkan sebelum
   *  transkrip dimulai — dipakai TranskripLatar untuk melacak cakupan. */
  onBlokDaftar?: (
    daftar: Array<{ mulai: number; akhir: number; sunyi: boolean }>,
  ) => void;
  /** v0.53.0 — dilaporkan tiap blok selesai dianalisis (sukses ATAU gagal).
   *  `indeks` = urutan zona dr onBlokDaftar; `segmen` null = blok gagal. */
  onBlokSelesai?: (info: {
    indeks: number;
    mulai: number;
    akhir: number;
    segmen: SegmenSub[] | null;
  }) => void;
  /** v0.53.0 — bila mengembalikan true, pekerja berhenti MENGAMBIL blok baru
   *  (ekspor dibatalkan) — blok yang sedang berjalan dibiarkan selesai. */
  apakahBerhenti?: () => boolean;
}

export interface HasilTranskrip {
  segmen: SegmenSub[];
  bahasa: string;
  diterjemahkan: boolean;
  /** v0.47.0 — bila sebagian blok gagal dianalisis (jarang): teks bisa kurang */
  peringatan?: string;
}

// ================= heuristik bahasa (murni — dites unit) =================

/** Kata-kata umum yang nyaris hanya muncul di salah satu bahasa. */
export const KATA_ID = [
  "yang", "dan", "di", "itu", "dengan", "untuk", "ini", "kita", "tidak", "akan",
  "dari", "pada", "saya", "kami", "kamu", "ada", "juga", "bisa", "karena",
  "selalu", "sudah", "banyak", "seperti", "kalau", "bagaimana", "selamat",
  "terima", "kasih", "hari", "orang", "jangan", "lama", "tapi", "saat", "lebih",
  "harus", "mereka", "semua", "kalau", "memang", "besar", "kecil", "satu",
];
export const KATA_EN = [
  "the", "and", "is", "you", "that", "with", "for", "this", "are", "not",
  "will", "from", "have", "they", "about", "how", "today", "more", "forget",
  "subscribe", "everyone", "welcome", "started", "let", "us", "daily", "life",
  "changes", "channel", "there", "would", "could", "because", "people", "when",
  "what", "your", "just", "always", "being", "don't", "it's", "we're", "video",
];

/**
 * Skor kata kunci: berapa banyak kata teks yang termasuk kamus tiap bahasa.
 * Fungsi murni — dites unit. Dipakai tebakBahasa & deteksi bahasa ganda.
 */
export function skorBahasa(teks: string): { id: number; en: number; total: number } {
  const kata = (teks || "").toLowerCase().match(/[a-zà-ÿ']+/g) || [];
  let id = 0;
  let en = 0;
  for (const k of kata) {
    if (KATA_ID.includes(k)) id += 1;
    if (KATA_EN.includes(k)) en += 1;
  }
  return { id, en, total: kata.length };
}

/**
 * Tebak bahasa dari teks transkrip: rasio kata umum ID vs EN.
 * Indonesia menang seri (audio tanpa kata kunci sama sekali dianggap Indonesia,
 * karena tujuan akhir aplikasi ini teks Indonesia).
 * Fungsi murni — dites di scripts/uji-subtitle.ts.
 */
export function tebakBahasa(teks: string): "id" | "en" {
  const s = skorBahasa(teks);
  if (!s.total) return "id";
  if (s.id === s.en) return "id";
  return s.en > s.id ? "en" : "id";
}

/**
 * Bersihkan artefak teks Whisper/opus-mt: pemisah "::", spasi ganda, strip
 * penggantung, kutip miring, garis putus. Fungsi murni — dites unit.
 */
export function bersihTeksSub(teks: string): string {
  return (teks || "")
    .replace(/\s+/g, " ")
    .replace(/[:;]{2,}\s*$/g, "")
    .replace(/^[-–—\s]+/, "")
    .replace(/[-–—\s]+$/, "")
    .replace(/\\+/g, "")
    .trim();
}

/**
 * v0.51.0 — RMS (akar rata-rata kuadrat) sinyal audio — murni & dites unit.
 * Dipakai utk melewatkan blok sunyi tanpa memanggil Whisper.
 */
export function rmsBlok(data: Float32Array): number {
  if (!data || !data.length) return 0;
  let jumlah = 0;
  for (let i = 0; i < data.length; i += 1) jumlah += data[i] * data[i];
  return Math.sqrt(jumlah / data.length);
}

/** v0.51.0 — blok dianggap sunyi bila RMS di bawah ambang (bawaan AMBATANG_SUNYI). */
export function apakahBlokSunyi(data: Float32Array, ambang = AMBATANG_SUNYI): boolean {
  return rmsBlok(data) < ambang;
}

/**
 * v0.51.0 — bersihkan halusinasi khas Whisper (murni — dites unit):
 *  · teks tanpa huruf/angka sama sekali dibuang;
 *  · satu kata diulang ≥4× ("hah hah hah hah") dibuang;
 *  · rangkaian ≥3 segmen berurutan berteks sama (loop halusinasi pada musik/
 *    keheningan) dilipat — 2 pertama dipertahankan, sisanya dibuang.
 * Konservatif: pengulangan 2× bisa jadi ucapan sungguhan, jadi tetap disimpan.
 */
export function bersihSegmenHalusinasi(segmen: SegmenSub[]): SegmenSub[] {
  const normal = (t: string) => (t || "").toLowerCase().replace(/\s+/g, " ").trim();
  const keluar: SegmenSub[] = [];
  for (const s of segmen) {
    const kunci = normal(s.t);
    if (!/[a-z0-9à-ÿ]/i.test(kunci)) continue; // tanpa huruf/angka
    const kata = kunci.split(" ").filter(Boolean);
    if (kata.length >= 4 && new Set(kata).size === 1) continue; // 1 kata ≥4×
    if (keluar.length >= 2) {
      const d1 = normal(keluar[keluar.length - 1].t);
      const d2 = normal(keluar[keluar.length - 2].t);
      if (d1 === kunci && d2 === kunci) continue; // ≥3 identik berurutan
    }
    keluar.push({ ...s });
  }
  return keluar;
}

/**
 * v0.51.0 — perkiraan sisa waktu transkrip (detik) dari kecepatan rata-rata
 * (murni — dites unit): (berjalan/selesai) × sisa ÷ jumlah jalur paralel.
 */
export function perkiraanSisaDtk(
  berjalanMs: number,
  selesai: number,
  total: number,
  jalur: number,
): number {
  if (!Number.isFinite(berjalanMs) || berjalanMs <= 0) return 0;
  if (selesai <= 0 || total <= selesai) return 0;
  const jalurEf = Number.isFinite(jalur) ? Math.max(1, Math.floor(jalur)) : 1;
  // berjalanMs/selesai = ms per blok → × sisa blok ÷ jalur = ms sisa → /1000 = detik
  return Math.max(0, Math.round((berjalanMs / selesai) * (total - selesai) / jalurEf / 1000));
}

// ================= resolusi model + runtime =================

/** Folder kandidat berisi struktur model HF (dipakai env.localModelPath). */
export function cariDirModelAi(): string | null {
  const res = (process as unknown as { resourcesPath?: string }).resourcesPath;
  const kandidat = [
    process.env.VIDSPLIT_AI_MODELS || "",
    path.join(process.cwd(), "assets", "ai-models"),
    path.join(process.cwd(), "..", "assets", "ai-models"),
    path.join(process.cwd(), "..", "..", "assets", "ai-models"),
    res ? path.join(res, "ai-models") : "",
    res ? path.join(res, "server", "assets", "ai-models") : "",
  ].filter(Boolean);
  for (const d of kandidat) {
    if (existsSync(path.join(d, ID_MODEL_WHISPER, "config.json"))) return d;
  }
  return null;
}

/** Model ASR + terjemahan benar-benar ada di bundel? (murah — cek berkas saja) */
export function modelTersedia(): boolean {
  return cariDirModelAi() !== null;
}

/**
 * v0.51.2 — model CEPAT (Whisper Base) benar-benar ada di folder model terpilih?
 * (murah — cek berkas saja) LATAR BUG v0.51.0: bundel rilis hanya membawa Whisper
 * Small (workflow CI hanya mengunduh whisper-small) sehingga memilih "Cepat (Base)"
 * membuat pipeline gagal → transkrip null → video diekspor TANPA subtitle.
 * Dengan pemeriksaan ini, pilihan cepat yang tak tersedia OTOMATIS jatuh ke model
 * Tepat dan diberi tahu lewat peringatan — subtitle tidak pernah hilang diam-diam.
 * Fungsi murni-filesystem — dites di scripts/uji-subtitle.ts.
 */
export function modelCepatTersedia(): boolean {
  const dir = cariDirModelAi();
  if (!dir) return false;
  return existsSync(path.join(dir, ID_MODEL_WHISPER_CEPAT, "config.json"));
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type ModulTransformers = any;

let modTf: ModulTransformers | null | undefined;

/** v0.58.0 — batas waktu pemuatan pipeline/satu panggilan AI non-blok (dulu TANPA
 *  jaring: pemuatan model / deteksi bahasa / terjemahan yang menghangu membekukan
 *  ekspor selamanya — watchdog 900 dtk hanya melindungi decode blok mode fokus). */
const MS_MUAT_MODEL = 300_000; // pemuatan model normal 5–60 dtk
const MS_TAHAP_AI = 300_000; // deteksi (2× cuplikan 24 dtk) & batch terjemah

/** Muat modul transformers.js sekali; env lokal (tanpa internet). */
async function muatTransformers(): Promise<ModulTransformers | null> {
  if (modTf !== undefined) return modTf;
  try {
    const m = await import("@huggingface/transformers");
    const dir = cariDirModelAi();
    if (!dir) {
      modTf = undefined; // v0.58.0 — jangan cache kegagalan: boleh dicoba lagi (mis. model baru selesai dipasang)
      return null;
    }
    m.env.allowRemoteModels = false;
    m.env.localModelPath = dir;
    modTf = m;
  } catch {
    modTf = undefined; // v0.58.0 — gagal sementara (OOM saat impor) tak lagi permanen
    return null;
  }
  return modTf;
}

/** Pabrik sesi ASR Whisper (q8, CPU) — dipanggil beberapa kali utk pool paralel.
 *  v0.51.0 — `cepat` memilih Whisper Base (±2–3× lebih cepat, sedikit kurang tepat).
 *  v0.54.0 — BENANG DIATUR: intraOpNumThreads = core ÷ jalur (benangPerSesi)
 *  supaya beberapa sesi paralel TIDAK saling merebut core (dulu tiap sesi pakai
 *  semua core → 4 sesi = 4× oversubscribe → transkrip jauh lebih lambat). */
async function buatPipaAsr(cepat = false): Promise<ModulTransformers | null> {
  const m = await muatTransformers();
  if (!m) return null;
  const opsiSesi: Record<string, unknown> = {};
  try {
    const { cpus, totalmem } = await import("node:os");
    const benang = benangPerSesi(cpus().length, totalmem() / 1073741824);
    if (benang > 0) {
      opsiSesi.intraOpNumThreads = benang;
      opsiSesi.interOpNumThreads = 1;
    }
  } catch {
    /* tanpa info mesin — pakai bawaan onnxruntime */
  }
  try {
    // v0.58.0 — pemuatan pipeline diberi batas waktu: dulu hang saat muat =
    // seluruh ekspor berhenti selamanya tanpa pesan
    const hasil = await balapanWaktu(
      m.pipeline("automatic-speech-recognition", cepat ? ID_MODEL_WHISPER_CEPAT : ID_MODEL_WHISPER, {
        dtype: "q8",
        device: "cpu",
        session_options: opsiSesi,
      }),
      MS_MUAT_MODEL,
    );
    if (hasil) return hasil;
    // null = kehabisan waktu — jatuh ke percobaan model Tepat bila tadi Base
    if (!cepat) return null;
    const cadangan = await balapanWaktu(
      m.pipeline("automatic-speech-recognition", ID_MODEL_WHISPER, {
        dtype: "q8",
        device: "cpu",
        session_options: opsiSesi,
      }),
      MS_MUAT_MODEL,
    );
    return cadangan;
  } catch {
    // v0.51.2 — model cepat (Base) tak bisa dimuat (berkas tak lengkap/tak
    // dibundel)? JANGAN biarkan subtitle hilang diam-diam — jatuh ke model
    // Tepat (Small) supaya hasil tetap bersubtitle.
    if (!cepat) return null;
    try {
      return await m.pipeline("automatic-speech-recognition", ID_MODEL_WHISPER, {
        dtype: "q8",
        device: "cpu",
        session_options: opsiSesi,
      });
    } catch {
      return null;
    }
  }
}

/** Sesi utama (selalu ada) — dimuat sekali lalu dipakai ulang (dipisah per model).
 *  v0.58.0 — yang di-cache PROMISE-nya (bukan hasil): dua pemanggil serentak
 *  dulu sama-sama melihat "belum ada" lalu membuat DUA sesi Whisper (±250 MB
 *  per sesi yang bocor permanen). Kegagalan juga tak lagi di-cache permanen. */
const pipaUtama: Record<"tepat" | "cepat", Promise<ModulTransformers | null> | undefined> = {
  tepat: undefined,
  cepat: undefined,
};
function ambilPipaAsr(cepat = false): Promise<ModulTransformers | null> {
  const kunci = cepat ? "cepat" : "tepat";
  if (!pipaUtama[kunci]) {
    pipaUtama[kunci] = balapanWaktu(buatPipaAsr(cepat), MS_MUAT_MODEL).then((r) => {
      if (r === null) pipaUtama[kunci] = undefined; // gagal sementara — boleh coba lagi
      return r;
    });
  }
  return pipaUtama[kunci];
}

/** Sesi tambahan utk pool paralel — dibuat sekali, dipakai ulang antar video.
 *  v0.58.0 — pemperbesar pool DI-DEDUP: dua pemanggil serentak dulu sama-sama
 *  memasuki while-loop → sesi dobel tersimpan PERMANEN di pipaTambahan (RAM). */
const pipaTambahan: Record<"tepat" | "cepat", ModulTransformers[]> = { tepat: [], cepat: [] };
const poolJanji: Record<"tepat" | "cepat", Promise<ModulTransformers[]> | null> = {
  tepat: null,
  cepat: null,
};
async function ambilPoolAsr(n: number, cepat = false): Promise<ModulTransformers[]> {
  const kunci = cepat ? "cepat" : "tepat";
  const utama = await ambilPipaAsr(cepat);
  if (!utama) return [];
  if (n <= 1) return [utama];
  const tambahan = pipaTambahan[kunci];
  if (tambahan.length >= n - 1) return [utama, ...tambahan];
  if (!poolJanji[kunci]) {
    poolJanji[kunci] = (async () => {
      while (tambahan.length < n - 1) {
        const p = await buatPipaAsr(cepat);
        if (!p) break; // memori/lingkungan tak sanggup — turunkan jumlah jalur
        tambahan.push(p);
      }
      return [utama, ...tambahan];
    })().finally(() => {
      poolJanji[kunci] = null;
    });
  }
  return poolJanji[kunci];
}

/**
 * Jumlah jalur paralel dari kemampuan mesin (murni — dites unit).
 * Bukan sekadar jumlah core: tiap sesi onnxruntime sudah multi-thread, dan RAM
 * harus cukup utk beberapa salinan model. env VIDSPLIT_AI_PARALEL memaksa nilai.
 * v0.51.0 — mesin besar (≥8 core DAN ≥8 GB RAM) dapat 4 jalur (sebelumnya maks 3).
 */
export function jumlahPipaParalel(cores: number, ramGb: number): number {
  const env = Number(process.env.VIDSPLIT_AI_PARALEL || "");
  if (Number.isFinite(env) && env >= 1) return Math.min(6, Math.floor(env));
  if (ramGb < 3.5) return 1;
  if (cores <= 2) return 1;
  if (ramGb < 6) return Math.min(2, cores);
  if (cores <= 5) return 2;
  if (cores <= 7 || ramGb < 8) return 3;
  return 4;
}

/** Pipeline terjemahan EN→ID — dimuat hanya saat dibutuhkan.
 *  v0.58.0 — memoize promise (anti-race dobel sesi) + batas waktu muat + kegagalan
 *  tak lagi di-cache permanen. */
let pipaTerjemahJanji: Promise<ModulTransformers | null> | null = null;
function ambilPipaTerjemah(): Promise<ModulTransformers | null> {
  if (!pipaTerjemahJanji) {
    pipaTerjemahJanji = balapanWaktu(
      (async (): Promise<ModulTransformers | null> => {
        const m = await muatTransformers();
        if (!m) return null;
        try {
          return await m.pipeline("translation", ID_MODEL_TERJEMAH, {
            dtype: "q8",
            device: "cpu",
          });
        } catch {
          return null;
        }
      })(),
      MS_MUAT_MODEL,
    ).then((r) => {
      if (r === null) pipaTerjemahJanji = null;
      return r;
    });
  }
  return pipaTerjemahJanji;
}

// ================= ekstraksi audio (ffmpeg → float32 16 kHz mono) =================

export async function ekstrakAudioF32(
  src: string,
  mulai: number,
  durasi: number,
  ffmpegBin: string,
): Promise<Float32Array> {
  const { spawn } = await import("node:child_process");
  const args = ["-nostdin", "-v", "error"];
  if (mulai > 0) args.push("-ss", mulai.toFixed(3));
  args.push("-i", src, "-t", durasi.toFixed(3));
  args.push("-vn", "-ac", "1", "-ar", "16000", "-f", "f32le", "pipe:1");
  const c = spawn(ffmpegBin, args, { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  const potongan: Buffer[] = [];
  let stderr = "";
  c.stdout.on("data", (b: Buffer) => potongan.push(b));
  c.stderr.on("data", (b: Buffer) => (stderr += b.toString()));
  await new Promise<void>((ok, gagal) => {
    c.on("error", gagal);
    c.on("close", (code) => (code === 0 ? ok() : gagal(new Error(`ffmpeg gagal: ${stderr.slice(-300)}`))));
  });
  const buf = Buffer.concat(potongan);
  const jumlah = Math.floor(buf.length / 4);
  if (buf.byteOffset % 4 === 0) {
    // v0.58.0 — view nol-salin: dulu loop readFloatLE per-sampel (±900 juta
    // pemanggilan utk audio 4 jam) makan detik-detik CPU di event loop
    return new Float32Array(buf.buffer, buf.byteOffset, jumlah);
  }
  const f32 = new Float32Array(jumlah);
  for (let i = 0; i < jumlah; i += 1) f32[i] = buf.readFloatLE(i * 4);
  return f32;
}

// ================= ASR + terjemahan =================

/** v0.53.0 — batas waktu SATU percobaan blok (detik) — jaring pengaman anti-hang:
 *  sesi WASM kadang menghangu selamanya di audio tertentu (dulu: ekspor berhenti
 *  selamanya tanpa pesan). 900 dtk jauh di atas waktu normal blok 90 dtk (60–150
 *  dtk di mesin lemah) sehingga hanya menangkap kemacetan sungguhan. */
export const MAKS_DTK_BLOK = 900;
const WAKTU_MAKS_BLOK_MS = MAKS_DTK_BLOK * 1000;

/**
 * v0.53.0 — balapan janji dgn penjaga waktu: null bila `p` belum selesai dalam
 * `ms`. Catatan: inferensi WASM tak bisa dibunuh — sesi bisa tetap sibuk di
 * latar; pemanggil memperlakukan null sebagai kegagalan percobaan (coba lagi,
 * lalu lewati blok tsb).
 * Fungsi murni-asinkron — dites di scripts/uji-subtitle.ts.
 */
export async function balapanWaktu<T>(p: Promise<T>, ms: number): Promise<T | null> {
  p.catch(() => {}); // cegah unhandled rejection bila p kalah balapan
  let penjaga: ReturnType<typeof setTimeout> | undefined;
  const batas = new Promise<null>((ok) => {
    penjaga = setTimeout(() => ok(null), ms);
  });
  try {
    return await Promise.race([p, batas]);
  } finally {
    clearTimeout(penjaga);
  }
}

function potongHasil(hasil: ModulTransformers): SegmenSub[] {
  const chunks = (hasil?.chunks || []) as Array<{ text?: string; timestamp?: [number | null, number | null] }>;
  const segmen: SegmenSub[] = [];
  for (const c of chunks) {
    // v0.54.0 — ejaan dirapikan (enklitik & artefak kutip) — terutama membantu
    // model Cepat (Base) yang sering memisah "-nya/-lah" dgn spasi
    const teks = perbaikiEjaan(bersihTeksSub(String(c.text || "")));
    if (!teks) continue;
    const a = Number(c.timestamp?.[0] ?? 0);
    const b = Number(c.timestamp?.[1] ?? a + 1);
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
    segmen.push({ a: Math.max(0, a), b: Math.max(a + 0.1, b), t: teks });
  }
  return segmen;
}

// ================= v0.47.0 — BLOK PARALEL (murni — dites unit) =================

export interface BlokAudio {
  /** detik mulai blok dalam audio penuh */
  mulai: number;
  data: Float32Array;
}

/**
 * Bagi audio jadi blok-blok ±DURASI_BLOK dgn tumpang-tindih OVERLAP_BLOK detik
 * di tiap batas. Langkah antar blok uniform supaya beban seimbang. Fungsi murni.
 * v0.53.0 — `durasiPertama` > 0 = blok PERTAMA hanya sepanjang itu (kickstart):
 * zona part awal cepat tercakup tanpa menunggu blok 90 dtk penuh; blok berikutnya
 * tetap uniform dan zona tetap menyambung dgn overlap yang sama.
 */
export function bagiBlokAudio(
  audio: Float32Array,
  durasiBlok = DURASI_BLOK,
  overlap = OVERLAP_BLOK,
  durasiPertama = 0,
): BlokAudio[] {
  const sr = 16000;
  const totalKick = audio.length / sr;
  if (durasiPertama > 0 && totalKick > durasiPertama + overlap) {
    const blokKick: BlokAudio[] = [];
    const a0 = 0;
    const b0 = Math.max(a0 + 1, Math.floor((durasiPertama + overlap) * sr));
    blokKick.push({ mulai: 0, data: audio.slice(a0, b0) });
    const sisa = totalKick - durasiPertama;
    const efektifKick = Math.max(0, sisa - overlap);
    const nKick = Math.max(1, Math.ceil(efektifKick / durasiBlok));
    const langkahKick = efektifKick / nKick;
    for (let i = 0; i < nKick; i += 1) {
      const mulai = durasiPertama + i * langkahKick;
      const akhir = Math.min(totalKick, mulai + langkahKick + overlap);
      const a = Math.floor(mulai * sr);
      const b = Math.max(a + 1, Math.floor(akhir * sr));
      blokKick.push({ mulai, data: audio.slice(a, b) });
    }
    return blokKick;
  }
  const total = audio.length / sr;
  const efektif = Math.max(0, total - overlap);
  const n = Math.max(1, Math.ceil(efektif / durasiBlok));
  const langkah = efektif / n;
  const blok: BlokAudio[] = [];
  for (let i = 0; i < n; i += 1) {
    const mulai = i * langkah;
    const akhir = Math.min(total, mulai + langkah + overlap);
    const a = Math.floor(mulai * sr);
    const b = Math.max(a + 1, Math.floor(akhir * sr));
    blok.push({ mulai, data: audio.slice(a, b) });
  }
  return blok;
}

/**
 * Gabung hasil tiap blok: buang segmen yang mulainya di zona tumpang-tindih
 * (milik blok sebelumnya), lalu buang duplikat pendek yang menimpa segmen
 * terakhir. Fungsi murni — dites unit.
 */
export function gabungSegmenBlok(
  daftar: Array<{ mulai: number; segmen: SegmenSub[] }>,
  overlap = OVERLAP_BLOK,
): SegmenSub[] {
  const keluar: SegmenSub[] = [];
  daftar.forEach((blok, i) => {
    const batas = blok.mulai + overlap;
    for (const s of blok.segmen) {
      if (i > 0 && s.a < batas - 0.01) continue;
      const sebelumnya = keluar[keluar.length - 1];
      if (sebelumnya && s.a < sebelumnya.b - 0.15) {
        // menimpa segmen sebelumnya — simpan hanya yang lebih panjang (lebih lengkap)
        if (s.b - s.a <= sebelumnya.b - sebelumnya.a) continue;
        keluar[keluar.length - 1] = s;
        continue;
      }
      keluar.push({ ...s });
    }
  });
  return keluar.sort((x, y) => x.a - y.a);
}

/**
 * Transkrip audio → segmen bertanda waktu + bahasa + terjemahan (bila perlu).
 * Return null bila mesin AI tidak tersedia (model/modul hilang).
 * v0.47.0: mode "fokus" = tanpa deteksi ganda; transkrip penuh berjalan
 * PARALEL per blok dgn beberapa sesi Whisper (lihat bagiBlokAudio).
 * v0.51.0: blok SUNYI dilewati (rmsBlok), progres dgn perkiraan sisa waktu,
 * hasil dibersihkan dr halusinasi loop (bersihSegmenHalusinasi), dan opsi
 * modelCepat memilih Whisper Base (±2–3× lebih cepat, ketepatan sedikit turun).
 */
export async function transkripDiterjemahkan(
  audio: Float32Array,
  opsi?: OpsiTranskrip,
): Promise<HasilTranskrip | null> {
  const cepatDiminta = opsi?.modelCepat === true;
  // v0.51.2 — model cepat WAJIB benar-benar ada; bila tidak, jatuh ke model Tepat
  // (dulu: pipeline Base gagal → null → ekspor berjalan TANPA subtitle — bug v0.51.0)
  const cepat = cepatDiminta && modelCepatTersedia();
  const asrUtama = await ambilPipaAsr(cepat);
  if (!asrUtama) return null;
  const tahap = opsi?.onTahap ?? (() => {});
  const mode: ModeBahasa = opsi?.modeBahasa === "deteksi" ? "deteksi" : "fokus";

  // ---- 1. bahasa: fokus = langsung Indonesia (instan, tanpa transkrip uji);
  //      deteksi = mode lama (24 dtk ditranskrip 2x lalu dibandingkan). ----
  let bahasa: "id" | "en" = "id";
  if (mode === "deteksi") {
    const sr = 16000;
    const nDeteksi = Math.min(audio.length, DURASI_DETEKSI * sr);
    const cuplikan = nDeteksi < audio.length ? audio.slice(0, nDeteksi) : audio;
    tahap("deteksi bahasa…");
    try {
      const opsiDasar = { chunk_length_s: 30, stride_length_s: 5, return_timestamps: false, task: "transcribe" };
      // v0.58.0 — deteksi bahasa diberi batas waktu (dulu: hang di sini = ekspor beku)
      const cobaId = await balapanWaktu<ModulTransformers>(
        asrUtama(cuplikan, { ...opsiDasar, language: "indonesian" }),
        MS_TAHAP_AI,
      );
      const cobaEn = await balapanWaktu<ModulTransformers>(
        asrUtama(cuplikan, { ...opsiDasar, language: "english" }),
        MS_TAHAP_AI,
      );
      const teksId = String(cobaId?.text || "");
      const teksEn = String(cobaEn?.text || "");
      const nilaiId = skorBahasa(teksId).id / Math.max(1, skorBahasa(teksId).total);
      const nilaiEn = skorBahasa(teksEn).en / Math.max(1, skorBahasa(teksEn).total);
      // Inggris hanya dipilih bila jelas lebih khas (hindari salah-pick pada audio
      // pendek/tanpa kata kunci — bawaan tetap Indonesia sesuai tujuan aplikasi)
      bahasa = nilaiEn > nilaiId && nilaiEn >= 0.1 ? "en" : "id";
    } catch {
      bahasa = "id";
    }
  }

  // ---- 2. transkrip PENUH — blok paralel dgn pool sesi Whisper ----
  const bahasaLabel = bahasa === "id" ? "(Indonesia)" : "(Inggris)";
  // v0.51.0 — blok SUNYI (RMS < AMBATANG_SUNYI) dilewati tanpa transkrip:
  // intro/keheningan/instrumen tak memakan waktu decode + tak memicu halusinasi
  // v0.53.0 — indeks hasil = indeks zona SEMUA blok (sunyi tetap dilaporkan sbg
  // zona tuntas) supaya pelacak cakupan mode latar selalu sinkron.
  const semuaBlok = bagiBlokAudio(audio, DURASI_BLOK, OVERLAP_BLOK, opsi?.blokPertamaDtk || 0);
  const indeksAktif: number[] = [];
  let sunyi = 0;
  semuaBlok.forEach((b, i) => {
    if (apakahBlokSunyi(b.data)) sunyi += 1;
    else indeksAktif.push(i);
  });
  // v0.53.0 — laporkan zona semua blok (sunyi = tuntas seketika) sebelum transkrip
  opsi?.onBlokDaftar?.(
    semuaBlok.map((b) => ({
      mulai: b.mulai,
      akhir: b.mulai + b.data.length / 16000,
      sunyi: apakahBlokSunyi(b.data),
    })),
  );
  const { cpus, totalmem } = await import("node:os");
  const jalurMax = jumlahPipaParalel(cpus().length, totalmem() / 1073741824);
  const pool = indeksAktif.length > 1 ? await ambilPoolAsr(jalurMax, cepat) : [asrUtama];
  const jalur = Math.max(1, pool.length);
  tahap(
    `transkrip suara ${bahasaLabel}${cepat ? " — mode cepat" : ""}${
      jalur > 1 ? ` — ${jalur} jalur paralel` : ""
    }${sunyi > 0 ? ` — ${sunyi} bagian sunyi dilewati` : ""}…`,
  );

  const hasilBlok: Array<{ mulai: number; segmen: SegmenSub[] } | null> = semuaBlok.map(() => null);
  let gagal = 0;
  let selesai = 0;
  const mulaiTranskrip = Date.now();
  // v0.54.0 — opsi decode lewat pembangun murni (dites): greedy + ngram utk Base
  const opsiAsr = opsiAsrWhisper(bahasa, cepat);

  const kerjakanBlok = async (i: number, pipa: ModulTransformers): Promise<SegmenSub[] | null> => {
    const b = semuaBlok[i];
    for (let coba = 0; coba < 2; coba += 1) {
      try {
        // v0.53.0 — blok yang menghangu dijatuhi batas waktu lalu dicoba sekali
        // lagi; tetap macet → blok dilewati (ekspor TIDAK berhenti selamanya)
        const r = await balapanWaktu(pipa(b.data, opsiAsr), WAKTU_MAKS_BLOK_MS);
        if (r === null) continue; // kehabisan waktu — coba lagi sekali
        const geser = b.mulai;
        return potongHasil(r).map((s) => ({ a: s.a + geser, b: s.b + geser, t: s.t }));
      } catch {
        /* coba lagi sekali — model kadang tersendat di blok tertentu */
      }
    }
    return null;
  };

  let berikut = 0;
  const pekerja = pool.map(async (pipa) => {
    for (;;) {
      // v0.53.0 — ekspor dibatalkan? jangan ambil blok baru (yang berjalan selesai)
      if (opsi?.apakahBerhenti?.()) return;
      const k = berikut;
      berikut += 1;
      if (k >= indeksAktif.length) return;
      const i = indeksAktif[k];
      const b = semuaBlok[i];
      const r = await kerjakanBlok(i, pipa);
      if (r) hasilBlok[i] = { mulai: b.mulai, segmen: r };
      else gagal += 1;
      selesai += 1;
      // v0.53.0 — laporkan blok selesai (pelacak cakupan mode latar)
      opsi?.onBlokSelesai?.({
        indeks: i,
        mulai: b.mulai,
        akhir: b.mulai + b.data.length / 16000,
        segmen: r,
      });
      if (indeksAktif.length > 1) {
        // v0.51.0 — progres + perkiraan sisa waktu (rata-rata kecepatan ÷ jalur)
        const pct = Math.round((selesai / indeksAktif.length) * 100);
        const sisa = perkiraanSisaDtk(Date.now() - mulaiTranskrip, selesai, indeksAktif.length, jalur);
        const sisaTeks = sisa >= 90 ? `±${Math.max(1, Math.round(sisa / 60))} mnt` : `±${sisa} dtk`;
        tahap(
          `transkrip suara ${bahasaLabel}… ${pct}% (${selesai}/${indeksAktif.length} bagian) — sisa ${sisaTeks}`,
        );
      }
    }
  });
  await Promise.all(pekerja);

  // v0.51.0 — halusinasi loop Whisper (teks berulang pada musik/keheningan) dibersihkan
  const segmenGabung = bersihSegmenHalusinasi(
    gabungSegmenBlok(hasilBlok.filter((h): h is { mulai: number; segmen: SegmenSub[] } => h !== null)),
  );
  let segmen = segmenGabung;
  if (!segmen.length) {
    return { segmen: [], bahasa, diterjemahkan: false };
  }

  // ---- 3. terjemahan EN → ID ----
  if (bahasa === "en") {
    const penerjemah = await ambilPipaTerjemah();
    if (!penerjemah) {
      // fallback: teks Inggris asli tetap dipakai (ekspor tidak digagalkan)
      return { segmen, bahasa, diterjemahkan: false };
    }
    const hasilBaru: SegmenSub[] = [];
    for (let i = 0; i < segmen.length; i += BATCH_TERJEMAH) {
      tahap(`terjemah Indonesia… ${Math.min(i + BATCH_TERJEMAH, segmen.length)}/${segmen.length}`);
      const batch = segmen.slice(i, i + BATCH_TERJEMAH);
      let keluar: Array<{ translation_text?: string }> = [];
      try {
        // v0.58.0 — batch terjemahan diberi batas waktu: hang = teks asli dipakai
        // (fallback aman), ekspor tidak pernah beku di tengah penerjemahan
        keluar = (await balapanWaktu(penerjemah(batch.map((s) => s.t)), MS_TAHAP_AI)) ?? [];
      } catch {
        keluar = [];
      }
      for (let j = 0; j < batch.length; j += 1) {
        const t = bersihTeksSub(String(keluar[j]?.translation_text || "")) || batch[j].t;
        hasilBaru.push({ a: batch[j].a, b: batch[j].b, t });
      }
    }
    segmen = hasilBaru;
  }
  // v0.51.2 — beri tahu bila pilihan "Cepat" diturunkan ke model Tepat
  const peringatanModel = cepatDiminta && !cepat
    ? "Mode cepat (Base) tidak tersedia — otomatis memakai model Tepat (Small)"
    : undefined;
  const peringatanGagal = gagal > 0
    ? `${gagal} bagian audio gagal dianalisis — sebagian teks mungkin tidak muncul`
    : undefined;
  const peringatan =
    [peringatanModel, peringatanGagal].filter(Boolean).join(" ") || undefined;
  return { segmen, bahasa, diterjemahkan: bahasa === "en", peringatan };
}

// ================= cache hasil AI =================

/**
 * Kunci cache stabil dari identitas berkas + rentang trim + mode bahasa.
 * v0.47.0: mode ikut kunci — hasil "fokus" vs "deteksi" bisa beda, dan cache
 * lama (sebelum v0.47) otomatis tak terpakai (analisis ulang sekali, kini lebih cepat).
 * v0.51.0: pilihan model CEPAT (Whisper Base) ikut kunci dgn akhiran "|cepat" —
 * KUNCI BAWAAN (Whisper Small) TIDAK BERUBAH agar cache v0.47–v0.50 tetap valid.
 * Fungsi murni.
 */
export function kunciCache(
  file: string,
  ukuran: number,
  mtimeMs: number,
  mulaiDetik: number,
  akhirDetik: number,
  mode: ModeBahasa = "fokus",
  cepat = false,
): string {
  return createHash("sha1")
    .update(
      `${file}|${ukuran}|${mtimeMs}|${mulaiDetik.toFixed(3)}|${akhirDetik.toFixed(3)}|${mode}${cepat ? "|cepat" : ""}`,
    )
    .digest("hex")
    .slice(0, 24);
}

function dirCache(): string {
  const root = process.env.VIDSPLIT_WORK
    ? path.resolve(process.env.VIDSPLIT_WORK)
    : path.join(process.cwd(), "work");
  const d = path.join(root, "subtitle-ai");
  mkdirSync(d, { recursive: true });
  return d;
}

/** Ambil cache hasil analisis (null = belum ada). */
export function ambilCache(kunci: string): HasilTranskrip | null {
  const p = path.join(dirCache(), `${kunci}.json`);
  if (!existsSync(p)) return null;
  try {
    const j = JSON.parse(readFileSync(p, "utf8")) as {
      segmen?: SegmenSub[];
      bahasa?: string;
      diterjemahkan?: boolean;
      peringatan?: string;
    };
    if (!Array.isArray(j.segmen)) return null;
    return {
      segmen: j.segmen.filter((s) => s && typeof s.t === "string"),
      bahasa: j.bahasa || "id",
      diterjemahkan: !!j.diterjemahkan,
      peringatan: j.peringatan,
    };
  } catch {
    return null;
  }
}

/** Simpan hasil analisis ke cache. */
export function simpanCache(
  kunci: string,
  hasil: HasilTranskrip,
): void {
  try {
    writeFileSync(
      path.join(dirCache(), `${kunci}.json`),
      JSON.stringify({ ...hasil, dibuat: Date.now() }),
      "utf8",
    );
  } catch {
    /* cache adalah bonus — gagal menulis tidak apa-apa */
  }
}

/**
 * Pipa utama untuk jobs.ts: pastikan ada hasil subtitle utk video (dgn cache).
 * durasiSumber = durasi total video (probed) — dipakai bila akhirDetik 0.
 * ffmpegBin dipakai utk ekstraksi audio. Return null bila mesin tidak siap.
 */
export async function siapkanSegmenSubtitle(
  file: string,
  mulaiDetik: number,
  akhirDetik: number,
  durasiSumber: number,
  ffmpegBin: string,
  opsi?: OpsiTranskrip,
): Promise<HasilTranskrip | null> {
  if (!modelTersedia()) return null;
  const mode: ModeBahasa = opsi?.modeBahasa === "deteksi" ? "deteksi" : "fokus";
  // v0.51.2 — kunci cache memakai model yang EFEKTIF dipakai (Base hanya bila
  // benar-benar ada) — hasil Small tak pernah salah slot di "|cepat"
  const cepat = opsi?.modelCepat === true && modelCepatTersedia();
  let stat: { size: number; mtimeMs: number } | null = null;
  try {
    const { statSync } = await import("node:fs");
    stat = statSync(file) as unknown as { size: number; mtimeMs: number };
  } catch {
    return null;
  }
  const kunci = kunciCache(file, stat.size, stat.mtimeMs, mulaiDetik, akhirDetik, mode, cepat);
  const tersimpan = ambilCache(kunci);
  if (tersimpan) return tersimpan;

  const batasAkhir = akhirDetik > 0 ? Math.min(akhirDetik, durasiSumber) : durasiSumber;
  const durasi = Math.min(
    MAKS_DURASI_ANALISIS,
    Math.max(0.5, batasAkhir - mulaiDetik),
  );
  const audio = await ekstrakAudioF32(file, mulaiDetik, durasi, ffmpegBin);
  if (!audio.length) return { segmen: [], bahasa: "id", diterjemahkan: false };
  const hasil = await transkripDiterjemahkan(audio, opsi);
  if (!hasil) return null;
  simpanCache(kunci, hasil);
  return hasil;
}

// ================= v0.53.0 — TRANSKRIP LATAR (berbarengan dgn render part) =================

/**
 * v0.53.0 — LATAR BELAKANG: dulu jobs.ts MENUNGGU transkrip SELURUH video tuntas
 * sebelum part pertama dirender — video 30 mnt+ terasa "tidak mulai-mulai"
 * berpuluh menit (persis laporan user). Kini transkrip dijalankan DI LATAR dan
 * tiap part hanya menunggu zona waktunya sendiri siap — eksport & part mulai
 * jalan dalam hitungan detik, sisanya menyusul berbarengan.
 */

/** durasi blok PERTAMA (kickstart, detik) pada mode latar — part-part awal tak
 *  perlu menunggu blok penuh 90 dtk sebelum bisa dirender. */
export const BLOK_PERTAMA_DTK = 30;

export interface TranskripLatar {
  /** hasil PENUH (termasuk terjemahan EN→ID) — resolve setelah semua blok
   *  beres; null = mesin tidak siap / ekspor dibatalkan sebelum beres. */
  janji: Promise<HasilTranskrip | null>;
  /**
   * Tunggu sampai zona [0..sampaiDtk] (relatif rentang trim) bisa disubtitle:
   * semua blok yang memotong zona itu sudah selesai dianalisis (sukses ATAU
   * gagal), atau transkrip tuntas/gagal total. Mengembalikan segmen yang sudah
   * tersedia sejauh ini (bisa kosong bila semua blok zona gagal — part tetap
   * dirender tanpa teks, sama seperti perilaku "AI gagal tidak menggagalkan
   * ekspor"). Mode "deteksi" selalu menunggu hasil penuh (teks Inggris baru
   * jadi Indonesia setelah semua blok beres).
   * v0.58.0 — isBatal opsional: loop memeriksanya tiap putaran (maks 400 ms)
   * lalu melempar "DIBATALKAN" — SATU loop tunggu per part, tanpa race 500 ms
   * yang dulu menumpuk loop-zombie.
   */
  tungguCakupan: (sampaiDtk: number, isBatal?: () => boolean) => Promise<SegmenSub[]>;
  /**
   * v0.56.0 — true bila transkrip latar sudah BERAKHIR (sukses/gagal) atau
   * langsung kena cache. Dipakai jobs.ts utk menahan render paralel: selama AI
   * masih menganalisis, render part dibatasi SATU per satu supaya ffmpeg tidak
   * berebut CPU dgn sesi Whisper (fps=1.9 → kena batas waktu, laporan user).
   */
  apakahTuntas: () => boolean;
}

/**
 * Indeks blok TERAKHIR yang memotong [0..t] — daftar zona terurut menaik dan
 * menyambung (tiap blok menjangkau blok berikutnya lewat overlap). -1 bila t
 * masih sebelum blok pertama. Fungsi murni — dites di scripts/uji-subtitle.ts.
 */
export function indeksBlokTerakhirSebelum(
  daftar: Array<{ mulai: number }>,
  t: number,
): number {
  let last = -1;
  for (let i = 0; i < daftar.length; i += 1) {
    if (daftar[i].mulai < t - 0.01) last = i;
    else break;
  }
  return last;
}

/**
 * v0.53.0 — mulai transkrip DI LATAR untuk satu video (dgn cache, sama seperti
 * siapkanSegmenSubtitle) TAPI tidak menunggu: pemanggil bisa langsung merender
 * part dan memanggil tungguCakupan() per part. Return null bila mesin tidak siap
 * atau cache/berkas bermasalah (video tetap diekspor tanpa subtitle).
 */
export async function mulaiTranskripLatar(
  file: string,
  mulaiDetik: number,
  akhirDetik: number,
  durasiSumber: number,
  ffmpegBin: string,
  opsi?: OpsiTranskrip,
): Promise<TranskripLatar | null> {
  if (!modelTersedia()) return null;
  const mode: ModeBahasa = opsi?.modeBahasa === "deteksi" ? "deteksi" : "fokus";
  // kunci cache memakai model yang EFEKTIF dipakai (sama dgn siapkanSegmenSubtitle)
  const cepat = opsi?.modelCepat === true && modelCepatTersedia();
  let stat: { size: number; mtimeMs: number } | null = null;
  try {
    const { statSync } = await import("node:fs");
    stat = statSync(file) as unknown as { size: number; mtimeMs: number };
  } catch {
    return null;
  }
  const kunci = kunciCache(file, stat.size, stat.mtimeMs, mulaiDetik, akhirDetik, mode, cepat);
  const tersimpan = ambilCache(kunci);
  if (tersimpan) {
    // cache kena — segmen penuh tersedia SEKETIKA, render tak pernah menunggu
    return {
      janji: Promise.resolve(tersimpan),
      tungguCakupan: async (_t: number, isBatal?: () => boolean) => {
        if (isBatal?.()) throw new Error("DIBATALKAN");
        return tersimpan.segmen;
      },
      apakahTuntas: () => true,
    };
  }

  const batasAkhir = akhirDetik > 0 ? Math.min(akhirDetik, durasiSumber) : durasiSumber;
  const durasi = Math.min(MAKS_DURASI_ANALISIS, Math.max(0.5, batasAkhir - mulaiDetik));

  // ---- pelacak cakupan (diisi lewat callback dr transkripDiterjemahkan) ----
  let zona: Array<{ mulai: number; akhir: number; sunyi: boolean }> = [];
  const zonaTuntas = new Set<number>(); // indeks zona yang sudah selesai (sukses/gagal/sunyi)
  const potonganBlok = new Map<number, { mulai: number; segmen: SegmenSub[] }>();
  let tuntas = false; // transkrip latar berakhir (hasil apa pun)

  const penunggu = new Set<() => void>();
  const tandai = () => {
    for (const p of [...penunggu]) p();
    penunggu.clear();
  };
  const tungguTanda = () =>
    new Promise<void>((ok) => {
      penunggu.add(ok);
    });
  const tidur = (ms: number) => new Promise<void>((ok) => setTimeout(ok, ms));

  /** segmen gabungan dr semua blok yang sudah selesai — fungsi gabung yang sama
   *  dgn jalur hasil akhir supaya hasil tahapan konsisten. */
  const segmenSaatIni = (): SegmenSub[] => {
    if (!potonganBlok.size) return [];
    const daftar = [...potonganBlok.entries()]
      .sort((x, y) => x[0] - y[0])
      .map(([, h]) => ({ mulai: h.mulai, segmen: h.segmen }));
    return bersihSegmenHalusinasi(gabungSegmenBlok(daftar));
  };

  const tungguCakupan = async (
    sampaiDtk: number,
    isBatal?: () => boolean,
  ): Promise<SegmenSub[]> => {
    const t = Math.max(0, sampaiDtk);
    // mode "deteksi": teks Inggris diterjemahkan SETELAH semua blok — segmen
    // bertahap belum berbahasa akhir → tunggu hasil penuh (perilaku lama).
    if (mode === "deteksi") {
      const hasil = await janpi.catch(() => null);
      return hasil?.segmen ?? [];
    }
    for (;;) {
      // v0.58.0 — sinyal batal diperiksa tiap putaran (bangun tiap ≤400 ms)
      if (isBatal?.()) throw new Error("DIBATALKAN");
      if (tuntas) return segmenSaatIni();
      if (!zona.length) {
        // ekstraksi audio masih berjalan — atau mesin gagal sebelum zona terbentuk
        await Promise.race([tungguTanda(), tidur(400)]);
        continue;
      }
      const last = indeksBlokTerakhirSebelum(zona, t);
      let tercakup = true;
      for (let j = 0; j <= last; j += 1) {
        if (!zonaTuntas.has(j)) {
          tercakup = false;
          break;
        }
      }
      if (tercakup) return segmenSaatIni();
      await Promise.race([tungguTanda(), tidur(400)]);
    }
  };

  const janpi = (async (): Promise<HasilTranskrip | null> => {
    try {
      const audio = await ekstrakAudioF32(file, mulaiDetik, durasi, ffmpegBin);
      if (!audio.length) return { segmen: [], bahasa: "id", diterjemahkan: false };
      const hasil = await transkripDiterjemahkan(audio, {
        ...opsi,
        blokPertamaDtk: opsi?.blokPertamaDtk ?? BLOK_PERTAMA_DTK,
        onBlokDaftar: (d) => {
          zona = d;
          d.forEach((z, i) => {
            if (z.sunyi) zonaTuntas.add(i); // blok sunyi = tuntas seketika
          });
          tandai();
        },
        onBlokSelesai: (info) => {
          zonaTuntas.add(info.indeks);
          if (info.segmen) potonganBlok.set(info.indeks, { mulai: info.mulai, segmen: info.segmen });
          tandai();
        },
      });
      // v0.53.0 — JANGAN simpan cache bila ekspor dibatalkan di tengah jalan:
      // hasil parsial/kosong akan meracuni cache (ekspor ulang tanpa subtitle).
      if (hasil && !opsi?.apakahBerhenti?.()) simpanCache(kunci, hasil);
      return hasil;
    } catch {
      return null;
    } finally {
      tuntas = true;
      tandai();
    }
  })();

  return { janji: janpi, tungguCakupan, apakahTuntas: () => tuntas };
}

// ================= ASS utk satu part (murni — dites unit) =================

/** detik → waktu ASS "H:MM:SS.cc" */
export function kebabAssSub(t: number): string {
  // v0.58.0 — FLOOR ke sentidetik: dulu 59.995 dibulatkan toFixed → "0:00:60.00"
  // (waktu tak valid utk libass → teks bisa melompat), jendela 10 ms per menit
  const total = Math.floor(Math.max(0, t) * 100) / 100;
  const jam = Math.floor(total / 3600);
  const menit = Math.floor((total % 3600) / 60);
  const detik = total % 60;
  return `${jam}:${String(menit).padStart(2, "0")}:${detik.toFixed(2).padStart(5, "0")}`;
}

function bersihTeksAssSub(t: string): string {
  return (t || "").replace(/[{}]/g, "").replace(/\\/g, " ").replace(/\r?\n/g, " ").trim();
}

export interface OpsiAssSub {
  /** segmen hasil AI — waktu RELATIF RENTANG TRIM (0 = detik mulai trim) */
  segmen: SegmenSub[];
  /** posisi part dalam waktu RELATIF RENTANG TRIM (part-1 = 0) */
  mulaiPartRel: number;
  /** durasi part (detik) */
  durasiPart: number;
  /** offset intro background (detik) — subtitle digeser sesudah intro */
  offsetIntro: number;
  W: number;
  H: number;
  /** ukuran huruf px pada sisi terpendek 1080 (konvensi sama dgn drawtext) */
  ukuran: number;
  /** persen tinggi frame utk TITIK BAWAH teks (88 = 12% dari bawah) */
  yPersen: number;
  /** v0.54.0 — warna teks subtitle #rrggbb (tak valid → putih) */
  warna?: string;
  /** v0.54.0 — warna outline huruf #rrggbb (tak valid → hitam) */
  warnaOutline?: string;
}

/**
 * Bangun isi berkas .ass untuk SATU part: segmen di luar jendela part dibuang,
 * segmen yang memotong batas diclip, waktu digeser ke timeline part (+ intro).
 * Fungsi murni — dites di scripts/uji-subtitle.ts.
 */
export function bangunAssSubtitle(opsi: OpsiAssSub): string {
  const { segmen, mulaiPartRel, durasiPart, offsetIntro, W, H, ukuran, yPersen } = opsi;
  const skala = Math.min(W, H) / 1080;
  const fs = Math.max(12, Math.round(ukuran * skala));
  const outline = Math.max(2, Math.round(fs * 0.11));
  // PENTING: Alignment 2 libass menghitung MarginV dari BAWAH frame — user mengatur
  // yPersen = posisi titik BAWAH teks diukur dari ATAS (88 = 88% turun), jadi
  // margin dari bawah = (100 - y)%
  const marginV = Math.round((H * (100 - Math.min(100, Math.max(0, yPersen)))) / 100);
  const akhirPart = mulaiPartRel + durasiPart;
  // v0.54.0 — warna teks & outline pilihan user (bawaan putih/hitam = gaya lama)
  const warnaSub = warnaAss(opsi.warna, "#ffffff");
  const warnaGaris = warnaAss(opsi.warnaOutline, "#000000");

  const kepala = [
    "[Script Info]",
    "; VidSplit v0.44.0 — subtitle AI otomatis",
    "ScriptType: v4.00+",
    `PlayResX: ${W}`,
    `PlayResY: ${H}`,
    "WrapStyle: 0",
    "ScaledBorderAndShadow: yes",
    "",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    `Style: Sub,DejaVu Sans,${fs},${warnaSub},&H000000FF,${warnaGaris},&H96000000,0,0,0,0,100,100,0,0,1,${outline},1,2,48,48,${marginV},1`,
    "",
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
  ];

  const dialog: string[] = [];
  const urut = [...segmen].sort((x, y) => x.a - y.a);
  for (let i = 0; i < urut.length; i += 1) {
    const s = urut[i];
    if (!s.t.trim()) continue;
    // clip ke jendela part [mulaiPartRel, akhirPart]
    const a = Math.max(s.a, mulaiPartRel);
    const b = Math.min(s.b, akhirPart);
    if (b - a < 0.2) continue; // terlalu tipis di jendela ini — lewati
    let mulai = a - mulaiPartRel + offsetIntro;
    let akhir = b - mulaiPartRel + offsetIntro;
    // jangan menimpa segmen berikutnya; durasi minimum agar terbaca
    const berikut = urut[i + 1];
    if (berikut) {
      const batas = Math.max(0, Math.min(berikut.a, akhirPart) - mulaiPartRel + offsetIntro);
      if (akhir > batas) akhir = Math.max(mulai + 0.4, batas);
    }
    if (akhir - mulai < 0.4) akhir = mulai + 0.4;
    if (mulai >= akhir) continue;
    dialog.push(
      `Dialogue: 0,${kebabAssSub(mulai)},${kebabAssSub(akhir)},Sub,,0,0,0,,{\\fad(120,120)}${bersihTeksAssSub(s.t)}`,
    );
  }
  if (!dialog.length) return "";
  return [...kepala, ...dialog, ""].join("\n");
}
