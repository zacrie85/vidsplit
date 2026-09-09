import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  output: "standalone",
  // Sertakan font DejaVu ke dalam trace standalone agar drawtext ffmpeg
  // tetap menemukan fontfile saat server jalan dari hasil build standalone.
  outputFileTracingIncludes: {
    "/**": [path.join(process.cwd(), "assets/fonts/**")],
  },
};

export default nextConfig;
