import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  output: "standalone",
  // v0.20.0 — onnxruntime-node (mesin pisah vokal AI) TIDAK dibundel webpack —
  // modul native (.node/.dll) di-resolve saat runtime dari node_modules/resources.
  serverExternalPackages: ["onnxruntime-node"],
  // Sertakan font DejaVu ke dalam trace standalone agar drawtext ffmpeg
  // tetap menemukan fontfile saat server jalan dari hasil build standalone.
  outputFileTracingIncludes: {
    "/**": [path.join(process.cwd(), "assets/fonts/**")],
  },
};

export default nextConfig;
