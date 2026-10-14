// VidSplit v0.47.0 — BENCHMARK kecepatan subtitle AI: jalur lama vs jalur baru.
// Jalankan: VIDSPLIT_AI_MODELS=assets/ai-models bun scripts/benchmark-ai-sub.mjs [durasiDetik]
// Mengukur (audio espeak-ng bahasa Indonesia):
//   A. deteksi ganda 2x24 dtk (jalur lama, hanya mode "deteksi")
//   B. transkrip penuh SATU sesi (jalur lama tanpa deteksi)
//   C. transkrip BLOK paralel dgn N sesi (jalur baru — fokus Indonesia)
//   D. transkrip blok SEQUENTIAL 1 sesi (jalur baru di mesin lemah)
import path from "node:path";
import fs from "node:fs";
import { spawnSync } from "node:child_process";

const ROOT = path.resolve(import.meta.dirname, "..");
const DURASI = Number(process.argv[2] || 130);
const SR = 16000;

process.env.VIDSPLIT_AI_MODELS = path.join(ROOT, "assets/ai-models");
const { cariDirModelAi } = await import("../src/lib/vidsplit/subtitle.ts");
const { bagiBlokAudio, gabungSegmenBlok } = await import("../src/lib/vidsplit/subtitle.ts");
const dir = cariDirModelAi();
if (!dir) {
  console.error("model AI tidak ditemukan — unduh dulu: bash scripts/unduh-model-ai.sh whisper-small");
  process.exit(1);
}
console.log(`[info] model: ${dir}`);

const m = await import("@huggingface/transformers");
m.env.allowRemoteModels = false;
m.env.localModelPath = dir;

async function buatPipa() {
  return m.pipeline("automatic-speech-recognition", "onnx-community/whisper-small", {
    dtype: "q8",
    device: "cpu",
  });
}
const pipa1 = await buatPipa();
console.log("[info] pipa 1 siap");

// ---- audio: buat/muat PCM f32 dari wav espeak (diulang sampai DURASI) ----
const wavAsal = path.join(ROOT, "work/tmp/suara-indo.wav");
const ffargs = ["-v", "error", "-i", wavAsal, "-vn", "-ac", "1", "-ar", String(SR), "-f", "f32le", "pipe:1"];
const ulang = Math.ceil(DURASI / 85);
const input = ulang > 1
  ? spawnSync("ffmpeg", ["-v", "error", "-stream_loop", String(ulang - 1), "-i", wavAsal, "-t", String(DURASI), ...ffargs.slice(2)], { maxBuffer: 1024 * 1024 * 200 })
  : spawnSync("ffmpeg", ffargs, { maxBuffer: 1024 * 1024 * 200 });
const buf = input.stdout;
const audio = new Float32Array(Math.floor(buf.length / 4));
for (let i = 0; i < audio.length; i += 1) audio[i] = buf.readFloatLE(i * 4);
console.log(`[info] audio: ${audio.length / SR} detik`);

const fmt = (ms) => {
  const s = ms / 1000;
  return `${s.toFixed(1)} dtk`;
};

const hasil = {};

// ---- A. deteksi ganda (jalur lama) ----
{
  const cuplikan = audio.slice(0, 24 * SR);
  const t0 = performance.now();
  await pipa1(cuplikan, { chunk_length_s: 30, stride_length_s: 5, return_timestamps: false, language: "indonesian", task: "transcribe" });
  await pipa1(cuplikan, { chunk_length_s: 30, stride_length_s: 5, return_timestamps: false, language: "english", task: "transcribe" });
  hasil.deteksi = performance.now() - t0;
  console.log(`A. DETEKSI GANDA (2x24 dtk, jalur lama)      : ${fmt(hasil.deteksi)}`);
}

// ---- B. transkrip penuh satu sesi (jalur lama tanpa deteksi) ----
{
  const t0 = performance.now();
  const r = await pipa1(audio, { chunk_length_s: 30, stride_length_s: 5, return_timestamps: true, language: "indonesian", task: "transcribe" });
  hasil.penuh1 = performance.now() - t0;
  const seg = (r.chunks || []).length;
  console.log(`B. PENUH 1 SESI (jalur baru tanpa deteksi)   : ${fmt(hasil.penuh1)}  (${seg} segmen)`);
}

// ---- C. blok paralel N sesi (jalur baru) ----
const PARALEL = Math.max(2, Math.min(4, Number(process.env.BENCH_PARALEL || 2)));
{
  const extra = [];
  for (let i = 1; i < PARALEL; i += 1) {
    extra.push(await buatPipa());
    console.log(`[info] pipa ${i + 1} siap`);
  }
  const pool = [pipa1, ...extra];
  const blok = bagiBlokAudio(audio);
  console.log(`[info] ${blok.length} blok, ${pool.length} sesi paralel`);
  let berikut = 0;
  const hasilBlok = blok.map(() => null);
  const t0 = performance.now();
  await Promise.all(pool.map(async (pipa) => {
    for (;;) {
      const i = berikut; berikut += 1;
      if (i >= blok.length) return;
      const r = await pipa(blok[i].data, { chunk_length_s: 30, stride_length_s: 5, return_timestamps: true, language: "indonesian", task: "transcribe" });
      const geser = blok[i].mulai;
      hasilBlok[i] = { mulai: geser, segmen: (r.chunks || []).map((c) => ({ a: (c.timestamp?.[0] ?? 0) + geser, b: (c.timestamp?.[1] ?? 0) + geser, t: String(c.text || "").trim() })) };
    }
  }));
  hasil.paralel = performance.now() - t0;
  const seg = gabungSegmenBlok(hasilBlok.filter(Boolean));
  console.log(`C. BLOK PARALEL ${pool.length} SESI (jalur baru)     : ${fmt(hasil.paralel)}  (${seg.length} segmen)`);
  console.log(`   contoh teks: "${seg.slice(0, 3).map((s) => s.t).join(" | ").slice(0, 160)}"`);
}

// ---- D. blok sequential 1 sesi (mesin lemah) ----
{
  const blok = bagiBlokAudio(audio);
  const t0 = performance.now();
  const hasilBlok = [];
  for (const b of blok) {
    const r = await pipa1(b.data, { chunk_length_s: 30, stride_length_s: 5, return_timestamps: true, language: "indonesian", task: "transcribe" });
    const geser = b.mulai;
    hasilBlok.push({ mulai: geser, segmen: (r.chunks || []).map((c) => ({ a: (c.timestamp?.[0] ?? 0) + geser, b: (c.timestamp?.[1] ?? 0) + geser, t: String(c.text || "").trim() })) });
  }
  hasil.blokSeq = performance.now() - t0;
  const seg = gabungSegmenBlok(hasilBlok);
  console.log(`D. BLOK SEQUENTIAL 1 SESI (mesin lemah)      : ${fmt(hasil.blokSeq)}  (${seg.length} segmen)`);
}

console.log("\n===== RINGKASAN =====");
const lamaTotal = hasil.deteksi + hasil.penuh1;
console.log(`JALUR LAMA (deteksi + penuh)     : ${fmt(lamaTotal)}`);
console.log(`JALUR BARU fokus (tanpa deteksi) : ${fmt(hasil.penuh1)}  → hemat ${((1 - hasil.penuh1 / lamaTotal) * 100).toFixed(0)}% (deteksi dibuang)`);
console.log(`JALUR BARU paralel ${PARALEL} sesi      : ${fmt(hasil.paralel)}  → ${(lamaTotal / hasil.paralel).toFixed(2)}x lebih cepat dari jalur lama`);
console.log(`JALUR BARU blok sequential       : ${fmt(hasil.blokSeq)}  → ${(lamaTotal / hasil.blokSeq).toFixed(2)}x dari jalur lama`);
fs.writeFileSync(path.join(ROOT, "work/tmp/benchmark-ai.json"), JSON.stringify({ durasi: DURASI, ...hasil, paralel: PARALEL }, null, 2));
