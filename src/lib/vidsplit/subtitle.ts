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
export const ID_MODEL_TERJEMAH = "Xenova/opus-mt-en-id";
/** batas aman durasi audio yang dianalisis (4 jam) — cegah memori membengkak */
export const MAKS_DURASI_ANALISIS = 4 * 3600;
/** panjang potongan deteksi bahasa (detik) */
export const DURASI_DETEKSI = 24;
/** ukuran batch terjemahan */
export const BATCH_TERJEMAH = 8;

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

/* eslint-disable @typescript-eslint/no-explicit-any */
type ModulTransformers = any;

let modTf: ModulTransformers | null | undefined;
let pipaAsr: ModulTransformers | null | undefined;
let pipaTerjemah: ModulTransformers | null | undefined;

/** Muat modul transformers.js sekali; env lokal (tanpa internet). */
async function muatTransformers(): Promise<ModulTransformers | null> {
  if (modTf !== undefined) return modTf;
  try {
    const m = await import("@huggingface/transformers");
    const dir = cariDirModelAi();
    if (!dir) {
      modTf = null;
      return modTf;
    }
    m.env.allowRemoteModels = false;
    m.env.localModelPath = dir;
    modTf = m;
  } catch {
    modTf = null;
  }
  return modTf;
}

/** Pipeline ASR Whisper (q8, CPU) — dimuat sekali lalu dipakai ulang. */
async function ambilPipaAsr(): Promise<ModulTransformers | null> {
  if (pipaAsr !== undefined) return pipaAsr;
  const m = await muatTransformers();
  if (!m) {
    pipaAsr = null;
    return pipaAsr;
  }
  try {
    pipaAsr = await m.pipeline("automatic-speech-recognition", ID_MODEL_WHISPER, {
      dtype: "q8",
      device: "cpu",
    });
  } catch {
    pipaAsr = null;
  }
  return pipaAsr;
}

/** Pipeline terjemahan EN→ID — dimuat hanya saat dibutuhkan. */
async function ambilPipaTerjemah(): Promise<ModulTransformers | null> {
  if (pipaTerjemah !== undefined) return pipaTerjemah;
  const m = await muatTransformers();
  if (!m) {
    pipaTerjemah = null;
    return pipaTerjemah;
  }
  try {
    pipaTerjemah = await m.pipeline("translation", ID_MODEL_TERJEMAH, {
      dtype: "q8",
      device: "cpu",
    });
  } catch {
    pipaTerjemah = null;
  }
  return pipaTerjemah;
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
  const f32 = new Float32Array(Math.floor(buf.length / 4));
  for (let i = 0; i < f32.length; i += 1) f32[i] = buf.readFloatLE(i * 4);
  return f32;
}

// ================= ASR + terjemahan =================

function potongHasil(hasil: ModulTransformers): SegmenSub[] {
  const chunks = (hasil?.chunks || []) as Array<{ text?: string; timestamp?: [number | null, number | null] }>;
  const segmen: SegmenSub[] = [];
  for (const c of chunks) {
    const teks = bersihTeksSub(String(c.text || ""));
    if (!teks) continue;
    const a = Number(c.timestamp?.[0] ?? 0);
    const b = Number(c.timestamp?.[1] ?? a + 1);
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
    segmen.push({ a: Math.max(0, a), b: Math.max(a + 0.1, b), t: teks });
  }
  return segmen;
}

/**
 * Transkrip audio → segmen bertanda waktu + bahasa + terjemahan (bila perlu).
 * Return null bila mesin AI tidak tersedia (model/modul hilang).
 */
export async function transkripDiterjemahkan(
  audio: Float32Array,
  opsi?: { onTahap?: (tahap: string) => void },
): Promise<{ segmen: SegmenSub[]; bahasa: string; diterjemahkan: boolean } | null> {
  const asr = await ambilPipaAsr();
  if (!asr) return null;
  const tahap = opsi?.onTahap ?? (() => {});

  // ---- 1. deteksi bahasa: transkrip potongan awal dengan DUA bahasa, lalu
  // bandingkan SEBERAPA "Indonesia" transkrip terpaksa-ID vs SEBERAPA "Inggris"
  // transkrip terpaksa-Inggris (rasio kata kunci) — yang lebih khas menang.
  const sr = 16000;
  const nDeteksi = Math.min(audio.length, DURASI_DETEKSI * sr);
  const cuplikan = nDeteksi < audio.length ? audio.slice(0, nDeteksi) : audio;
  tahap("deteksi bahasa…");
  let bahasa: "id" | "en" = "id";
  try {
    const opsiDasar = { chunk_length_s: 30, stride_length_s: 5, return_timestamps: false, task: "transcribe" };
    const cobaId = await asr(cuplikan, { ...opsiDasar, language: "indonesian" });
    const cobaEn = await asr(cuplikan, { ...opsiDasar, language: "english" });
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

  // ---- 2. transkrip PENUH dengan bahasa terpilih ----
  tahap(bahasa === "id" ? "transkrip suara (Indonesia)…" : "transkrip suara (Inggris)…");
  const hasil = await asr(audio, {
    chunk_length_s: 30,
    stride_length_s: 5,
    return_timestamps: true,
    language: bahasa === "id" ? "indonesian" : "english",
    task: "transcribe",
  });
  let segmen = potongHasil(hasil);
  if (!segmen.length) return { segmen: [], bahasa, diterjemahkan: false };

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
        keluar = await penerjemah(batch.map((s) => s.t));
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
  return { segmen, bahasa, diterjemahkan: bahasa === "en" };
}

// ================= cache hasil AI =================

/** Kunci cache stabil dari identitas berkas + rentang trim. Fungsi murni. */
export function kunciCache(
  file: string,
  ukuran: number,
  mtimeMs: number,
  mulaiDetik: number,
  akhirDetik: number,
): string {
  return createHash("sha1")
    .update(`${file}|${ukuran}|${mtimeMs}|${mulaiDetik.toFixed(3)}|${akhirDetik.toFixed(3)}`)
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
export function ambilCache(kunci: string): { segmen: SegmenSub[]; bahasa: string; diterjemahkan: boolean } | null {
  const p = path.join(dirCache(), `${kunci}.json`);
  if (!existsSync(p)) return null;
  try {
    const j = JSON.parse(readFileSync(p, "utf8")) as {
      segmen?: SegmenSub[];
      bahasa?: string;
      diterjemahkan?: boolean;
    };
    if (!Array.isArray(j.segmen)) return null;
    return {
      segmen: j.segmen.filter((s) => s && typeof s.t === "string"),
      bahasa: j.bahasa || "id",
      diterjemahkan: !!j.diterjemahkan,
    };
  } catch {
    return null;
  }
}

/** Simpan hasil analisis ke cache. */
export function simpanCache(
  kunci: string,
  hasil: { segmen: SegmenSub[]; bahasa: string; diterjemahkan: boolean },
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
  opsi?: { onTahap?: (tahap: string) => void },
): Promise<{ segmen: SegmenSub[]; bahasa: string; diterjemahkan: boolean } | null> {
  if (!modelTersedia()) return null;
  let stat: { size: number; mtimeMs: number } | null = null;
  try {
    const { statSync } = await import("node:fs");
    stat = statSync(file) as unknown as { size: number; mtimeMs: number };
  } catch {
    return null;
  }
  const kunci = kunciCache(file, stat.size, stat.mtimeMs, mulaiDetik, akhirDetik);
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

// ================= ASS utk satu part (murni — dites unit) =================

/** detik → waktu ASS "H:MM:SS.cc" */
export function kebabAssSub(t: number): string {
  const j = Math.max(0, t);
  const jam = Math.floor(j / 3600);
  const menit = Math.floor((j % 3600) / 60);
  const detik = j % 60;
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
    `Style: Sub,DejaVu Sans,${fs},&H00FFFFFF,&H000000FF,&H00000000,&H96000000,0,0,0,0,100,100,0,0,1,${outline},1,2,48,48,${marginV},1`,
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
