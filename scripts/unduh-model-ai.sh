#!/usr/bin/env bash
# VidSplit v0.51.2 — unduh SEMUA model AI subtitle otomatis (100% offline setelah diunduh):
#   1. Whisper ASR Tepat (onnx-community/whisper-small) — bawaan, paling tepat
#   2. Whisper ASR Cepat (onnx-community/whisper-base)  — pilihan "Cepat" (v0.51.0)
#   3. Opus-MT      (Xenova/opus-mt-en-id)              — penerjemah Inggris → Indonesia
# Struktur hasil = struktur repo HF (env.localModelPath transformers.js):
#   assets/ai-models/onnx-community/whisper-small/...
#   assets/ai-models/onnx-community/whisper-base/...
#   assets/ai-models/Xenova/opus-mt-en-id/...
#
# Pemakaian: bash scripts/unduh-model-ai.sh [model1 model2 ...]
#   tanpa argumen = unduh whisper-small + whisper-base (v0.51.2).
#   ⚠ v0.51.0 punya bug: workflow CI hanya memanggil "unduh-model-ai.sh whisper-small"
#     sehingga whisper-base TIDAK ikut di bundel → memilih "Cepat (Base)" membuat
#     pipeline gagal → video diekspor TANPA subtitle. Kini dua-duanya wajib ada.
# Model _quantized (q8) yang dipakai transformers.js dtype "q8".
set -euo pipefail

if [ $# -gt 0 ]; then MODEL_LIST=("$@"); else MODEL_LIST=(whisper-small whisper-base); fi
BASE="https://huggingface.co"
TUJUAN="$(cd "$(dirname "$0")/.." && pwd)/assets/ai-models"

unduh() { # unduh <repo> <file>
  local repo="$1" file="$2"
  local out="$TUJUAN/$repo/$file"
  if [ -s "$out" ]; then
    echo "  ✓ sudah ada: $repo/$file"
    return 0
  fi
  mkdir -p "$(dirname "$out")"
  echo "  ↓ unduh: $repo/$file"
  curl -fsSL --retry 3 --retry-delay 3 -o "$out" "$BASE/$repo/resolve/main/$file"
}

for WHISPER in "${MODEL_LIST[@]}"; do
  echo "=== Whisper ASR: onnx-community/$WHISPER ==="
  W="onnx-community/$WHISPER"
  for f in \
    config.json generation_config.json preprocessor_config.json \
    tokenizer.json tokenizer_config.json special_tokens_map.json \
    added_tokens.json normalizer.json merges.txt vocab.json quantize_config.json \
    onnx/encoder_model_quantized.onnx onnx/decoder_model_merged_quantized.onnx; do
    unduh "$W" "$f"
  done
done

echo "=== Penerjemah EN→ID: Xenova/opus-mt-en-id ==="
T="Xenova/opus-mt-en-id"
for f in \
  config.json generation_config.json tokenizer.json tokenizer_config.json \
  special_tokens_map.json vocab.json source.spm target.spm quantize_config.json \
  onnx/encoder_model_quantized.onnx onnx/decoder_model_merged_quantized.onnx; do
  unduh "$T" "$f"
done

echo "=== SELESAI — isi assets/ai-models: ==="
find "$TUJUAN" -type f -printf "%-72p %10s byte\n" | sort
