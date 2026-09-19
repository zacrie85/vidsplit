import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  output: "standalone",
  // v0.20.0 — onnxruntime-node (mesin pisah vokal AI) TIDAK dibundel webpack —
  // modul native (.node/.dll) di-resolve saat runtime dari node_modules/resources.
  // v0.25.0 — resvg-js (render halaman teks Studio Horor) juga modul native.
  serverExternalPackages: ["onnxruntime-node", "@resvg/resvg-js"],
  // Sertakan font DejaVu ke dalam trace standalone agar drawtext ffmpeg
  // tetap menemukan fontfile saat server jalan dari hasil build standalone.
  // v0.25.0 — sertakan juga binary native resvg-js.
  outputFileTracingIncludes: {
    "/**": [path.join(process.cwd(), "assets/fonts/**"), "node_modules/@resvg/resvg-js/**"],
  },
};

export default nextConfig;
