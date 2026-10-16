// VidSplit v0.51.2 — DIAGNOSTIK NYATA jalur "Subtitle AI Cepat (Base)".
// Membuktikan perbaikan bug v0.51.0: dulu, bundel tanpa whisper-base membuat
// transkripDiterjemahkan(modelCepat:true) mengembalikan null → ekspor berjalan
// TANPA subtitle. Kini wajib: (a) mode penuh — model Base dimuat & benar-benar
// men-decode audio; (b) mode hanya-small (simulasi bundel lama) — otomatis jatuh
// ke model Tepat + peringatan, hasil TIDAK pernah null.
//
// Jalankan (butuh model — bash scripts/unduh-model-ai.sh):
//   VIDSPLIT_AI_MODELS="$PWD/assets/ai-models" bun scripts/diag-sub-cepat.ts penuh
//   VIDSPLIT_AI_MODELS=<dir tanpa whisper-base> bun scripts/diag-sub-cepat.ts hanya-small
import { existsSync } from "node:fs";
import path from "node:path";
import {
  ekstrakAudioF32,
  modelCepatTersedia,
  modelTersedia,
  transkripDiterjemahkan,
} from "../src/lib/vidsplit/subtitle.ts";

const mode = process.argv[2] === "hanya-small" ? "hanya-small" : "penuh";
let lulus = 0;
let gagal = 0;
function cek(nama: string, ok: boolean, detail?: unknown) {
  if (ok) {
    lulus += 1;
    console.log(`  ✓ ${nama}`);
  } else {
    gagal += 1;
    console.error(`  ✗ GAGAL: ${nama}`, detail ?? "");
  }
}

cek("modelTersedia() = true", modelTersedia() === true);
const tersediaCepat = modelCepatTersedia();
if (mode === "penuh") {
  cek("modelCepatTersedia() = true (Small+Base dibundel)", tersediaCepat === true);
} else {
  cek("modelCepatTersedia() = false (simulasi bundel lama tanpa Base)", tersediaCepat === false);
}

// berkas model Base wajib lengkap (13 berkas persis seperti skrip unduh)
const daftarBerkasBase = [
  "config.json",
  "generation_config.json",
  "preprocessor_config.json",
  "tokenizer.json",
  "tokenizer_config.json",
  "special_tokens_map.json",
  "added_tokens.json",
  "normalizer.json",
  "merges.txt",
  "vocab.json",
  "quantize_config.json",
  "onnx/encoder_model_quantized.onnx",
  "onnx/decoder_model_merged_quantized.onnx",
];
if (mode === "penuh") {
  const dir = process.env.VIDSPLIT_AI_MODELS || "assets/ai-models";
  const kurang = daftarBerkasBase.filter(
    (f) => !existsSync(path.join(dir, "onnx-community", "whisper-base", f)),
  );
  cek("berkas whisper-base lengkap (13)", kurang.length === 0, kurang);
}

const ffmpegBin = process.env.VIDSPLIT_FFMPEG || "ffmpeg";
const audio = await ekstrakAudioF32("work/sample/musik-uji.mp3", 0, 10, ffmpegBin);
cek("audio terekstrak (10 dtk @16 kHz)", audio.length === 16000 * 10, audio.length);

console.log("  … memuat Whisper + transkrip 10 dtk (CPU, bisa ±1 mnt) …");
const hasil = await transkripDiterjemahkan(audio, {
  modelCepat: true,
  onTahap: (t) => console.log(`    [tahap] ${t}`),
});
// KUNCI: dulu (bug v0.51.0) hasil = null → ekspor tanpa subtitle. Sekarang TIDAK BOLEH null.
cek("transkrip TIDAK null (subtitle tetap dihasilkan)", hasil !== null);
if (hasil) {
  cek("segmen berupa array", Array.isArray(hasil.segmen));
  if (mode === "hanya-small") {
    cek(
      "peringatan: otomatis memakai model Tepat",
      !!hasil.peringatan && hasil.peringatan.includes("Mode cepat (Base) tidak tersedia"),
      hasil.peringatan,
    );
  } else {
    cek("tanpa peringatan (model cepat benar-benar dipakai)", !hasil.peringatan, hasil.peringatan);
  }
  console.log(`  [info] ${hasil.segmen.length} segmen · bahasa=${hasil.bahasa}`);
  for (const s of hasil.segmen.slice(0, 5)) {
    console.log(`    ${s.a.toFixed(1)}–${s.b.toFixed(1)} dtk: ${s.t}`);
  }
}

console.log(`\n=== diag-sub-cepat (${mode}): ${lulus} LULUS, ${gagal} GAGAL ===`);
if (gagal > 0) process.exit(1);
