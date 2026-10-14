#!/usr/bin/env bash
# Pengunduh model AI tahan-gagal: ulangi curl dgn resume (-C -) sampai ukuran stabil.
set -u
BASE="https://huggingface.co"
TUJUAN="/home/z/my-project/vidsplit/assets/ai-models"

unduh() { # unduh <repo> <file>
  local repo="$1" file="$2" ok=0
  local out="$TUJUAN/$repo/$file"
  mkdir -p "$(dirname "$out")"
  for coba in 1 2 3 4 5 6 7 8; do
    # anggap beres bila curl -I menunjukkan ukuran sama dgn berkas lokal
    ukuranServer=$(curl -fsSLI "$BASE/$repo/resolve/main/$file" 2>/dev/null | grep -i "^content-length" | tail -1 | tr -dc '0-9')
    ukuranLokal=$(stat -c%s "$out" 2>/dev/null || echo 0)
    if [ -n "$ukuranServer" ] && [ "$ukuranLokal" = "$ukuranServer" ]; then
      echo "  ✓ utuh: $repo/$file ($((ukuranLokal/1048576)) MB)"
      return 0
    fi
    echo "  ↓ unduh/resume ($coba/8): $repo/$file ($((ukuranLokal/1048576)) MB → server ${ukuranServer:-?} B)"
    curl -fsSL --retry 2 --retry-delay 2 -C - -o "$out" "$BASE/$repo/resolve/main/$file" && ok=1
    sleep 2
  done
  return 1
}

W="onnx-community/whisper-small"
for f in \
  config.json generation_config.json preprocessor_config.json \
  tokenizer.json tokenizer_config.json special_tokens_map.json \
  added_tokens.json normalizer.json merges.txt vocab.json quantize_config.json \
  onnx/encoder_model_quantized.onnx onnx/decoder_model_merged_quantized.onnx; do
  unduh "$W" "$f" || exit 1
done

T="Xenova/opus-mt-en-id"
for f in \
  config.json generation_config.json tokenizer.json tokenizer_config.json \
  special_tokens_map.json vocab.json source.spm target.spm quantize_config.json \
  onnx/encoder_model_quantized.onnx onnx/decoder_model_merged_quantized.onnx; do
  unduh "$T" "$f" || exit 1
done

echo "=== SEMUA MODEL UTUH ==="
du -sh "$TUJUAN"
