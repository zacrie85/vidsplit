// Uji coba pipeline subtitle AI v0.44.0 — prototipe modul src/lib/vidsplit/subtitle.ts
// 1) ekstrak audio video → Float32Array 16 kHz mono (f32le via ffmpeg pipe)
// 2) Whisper ASR (q8, lokal) → segmen [{a,b,t}] dgn timestamp
// 3) heuristik bahasa (kata umum ID vs EN)
// 4) EN → terjemahan Indonesia via opus-mt-en-id (q8, lokal)
// Jalankan: node scripts/uji-sub-ai-proto.mjs <video.mp4>
import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const MODELS = path.join(ROOT, "assets", "ai-models");
const video = process.argv[2] || path.join(ROOT, "work/uji-sub/video-indo.mp4");
const MODEL_ID = process.env.MODEL_ID || "onnx-community/whisper-base";

// ---------- 1. ekstrak audio ----------
async function ekstrakF32(file, mulai = 0, durasi = 0) {
  const args = ["-nostdin", "-v", "error"];
  if (mulai > 0) args.push("-ss", mulai.toFixed(3));
  args.push("-i", file);
  if (durasi > 0) args.push("-t", durasi.toFixed(3));
  args.push("-vn", "-ac", "1", "-ar", "16000", "-f", "f32le", "pipe:1");
  const c = spawn(process.env.VIDSPLIT_FFMPEG || "ffmpeg", args, { stdio: ["ignore", "pipe", "pipe"] });
  const potongan = [];
  c.stdout.on("data", (b) => potongan.push(b));
  let err = "";
  c.stderr.on("data", (b) => (err += b));
  await new Promise((ok, gagal) => {
    c.on("error", gagal);
    c.on("close", (code) => (code === 0 ? ok() : gagal(new Error(err.slice(-300)))));
  });
  const buf = Buffer.concat(potongan);
  const f32 = new Float32Array(buf.length / 4);
  for (let i = 0; i < f32.length; i++) f32[i] = buf.readFloatLE(i * 4);
  return f32; // 16000 sampel/detik
}

// ---------- 2. heuristik bahasa ----------
const KATA_ID = ["yang", "dan", "di", "itu", "dengan", "untuk", "ini", "kita", "tidak", "akan", "dari", "pada", "saya", "kamu", "ada", "juga", "bisa", "karena", "selalu", "sudah", "banyak", "seperti", "kalau", "sudah", "bagaimana", "selamat", "terima", "kasih"];
const KATA_EN = ["the", "and", "is", "you", "that", "with", "for", "this", "are", "not", "will", "from", "have", "they", "about", "how", "today", "more", "forget", "subscribe", "everyone", "welcome", "started", "let", "us", "daily", "life", "changes"];
export function tebakBahasa(teks) {
  const kata = (teks || "").toLowerCase().match(/[a-zà-ÿ]+/g) || [];
  if (!kata.length) return "id";
  let id = 0, en = 0;
  for (const k of kata) {
    if (KATA_ID.includes(k)) id++;
    if (KATA_EN.includes(k)) en++;
  }
  return en > id ? "en" : "id";
}

// ---------- 3. pipeline AI ----------
const { pipeline, env } = await import("@huggingface/transformers");
env.allowRemoteModels = false;
env.localModelPath = MODELS;
console.log("[env] localModelPath =", MODELS);

console.log("[asr] memuat", MODEL_ID, "(q8)…");
let t0 = Date.now();
const asr = await pipeline("automatic-speech-recognition", MODEL_ID, { dtype: "q8", device: "cpu" });
console.log(`[asr] siap dalam ${((Date.now() - t0) / 1000).toFixed(1)} dtk`);

const audio = await ekstrakF32(video);
console.log(`[asr] audio: ${(audio.length / 16000).toFixed(1)} dtk`);
t0 = Date.now();
const hasil = await asr(audio, {
  chunk_length_s: 30,
  stride_length_s: 5,
  return_timestamps: true,
  language: process.env.LANG_ASR || "indonesian",
  task: "transcribe",
});
console.log(`[asr] selesai dalam ${((Date.now() - t0) / 1000).toFixed(1)} dtk`);
const segmen = (hasil.chunks || []).map((c) => ({
  a: c.timestamp?.[0] ?? 0,
  b: c.timestamp?.[1] ?? 0,
  t: String(c.text || "").trim(),
})).filter((s) => s.t);
console.log("[asr] teks penuh:", JSON.stringify(hasil.text));
console.log("[asr] segmen:", JSON.stringify(segmen, null, 1));

const bahasa = tebakBahasa(hasil.text || "");
console.log("[lang] terdeteksi =", bahasa);

if (bahasa === "en") {
  console.log("[mt] memuat opus-mt-en-id (q8)…");
  t0 = Date.now();
  const penerjemah = await pipeline("translation", "Xenova/opus-mt-en-id", { dtype: "q8", device: "cpu" });
  console.log(`[mt] siap dalam ${((Date.now() - t0) / 1000).toFixed(1)} dtk`);
  const teks = segmen.map((s) => s.t);
  t0 = Date.now();
  const terjemah = await penerjemah(teks);
  console.log(`[mt] terjemahan ${teks.length} baris dalam ${((Date.now() - t0) / 1000).toFixed(1)} dtk`);
  terjemah.forEach((r, i) => {
    segmen[i].t = String(r.translation_text || segmen[i].t).trim();
  });
  console.log("[mt] segmen ID:", JSON.stringify(segmen, null, 1));
}
console.log("=== UJI PROTO SELESAI ===");
