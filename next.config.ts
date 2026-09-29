import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  output: "standalone",
  // v0.20.0 — onnxruntime-node (mesin pisah vokal AI) TIDAK dibundel webpack —
  // modul native (.node/.dll) di-resolve saat runtime dari node_modules/resources.
  // v0.25.0 — resvg-js (render halaman teks Studio Horor) juga modul native.
  // v0.44.0 — @huggingface/transformers (Whisper ASR + penerjemah EN→ID subtitle AI)
  // dan sharp (dependensi wajib transformers) tetap eksternal agar native binding
  // di-resolve dari node_modules hasil trace / salinan after-pack.
  serverExternalPackages: ["onnxruntime-node", "@resvg/resvg-js", "@huggingface/transformers", "sharp"],
  // Sertakan font DejaVu ke dalam trace standalone agar drawtext ffmpeg
  // tetap menemukan fontfile saat server jalan dari hasil build standalone.
  // v0.25.0 — sertakan juga binary native resvg-js.
  outputFileTracingIncludes: {
    "/**": [
      path.join(process.cwd(), "assets/fonts/**"),
      "node_modules/@resvg/resvg-js/**",
      // v0.44.0 — binari native sharp (@img) wajib: transformers.js me-require sharp
      // secara EAGER; tanpa @img import transformers gagal → subtitle AI mati
      "node_modules/@img/**",
    ],
  },
};

export default nextConfig;
