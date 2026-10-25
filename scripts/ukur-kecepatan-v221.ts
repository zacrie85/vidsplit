// UJI KECEPATAN v2.2.1 — bukti percepatan pengambilan frame:
//   LAMA: frame di posisi DI DALAM PART (video panjang → detik jauh, mis. 448)
//         full-res video, tanpa scale
//   BARU: frame DIPETAKAN ke menit 1–3 (detik 60–180) + langsung scale W×H + -an
// Ukur waktu ffmpeg & ukuran file. Butuh: ffmpeg di PATH.
import { execFileSync } from "node:child_process";
import { existsSync, statSync, rmSync } from "node:fs";

const VID = "/tmp/ukur-v221-vid.mp4";
const DURASI = 480; // 8 menit

if (!existsSync(VID)) {
  console.log(`membuat video uji ${DURASI / 60} menit (sintetis, ultrafast)...`);
  execFileSync(
    "ffmpeg",
    [
      "-y", "-v", "error",
      "-f", "lavfi", "-i", `testsrc2=s=1280x720:d=${DURASI}:r=25`,
      "-f", "lavfi", "-i", `sine=frequency=330:duration=${DURASI}`,
      "-pix_fmt", "yuv420p", "-c:v", "libx264", "-preset", "ultrafast", "-crf", "28",
      "-c:a", "aac", "-shortest", VID,
    ],
    { stdio: ["ignore", "ignore", "inherit"] },
  );
}

const ukur = (label: string, args: string[], keluar: string) => {
  rmSync(keluar, { force: true });
  const t0 = performance.now();
  execFileSync("ffmpeg", args, { stdio: ["ignore", "ignore", "ignore"] });
  const dtk = (performance.now() - t0) / 1000;
  const mb = statSync(keluar).size / 1024 / 1024;
  console.log(`${label.padEnd(46)} ${dtk.toFixed(2).padStart(6)} dtk   file ${mb.toFixed(2)} MB`);
  return dtk;
};

console.log("\n== EKSTRAKSI FRAME — LAMA vs BARU v2.2.1 ==");
// LAMA — part 8 dari video 8 menit (mulai ~420 dtk) + 35% part 60 dtk → detik 441
const lama = ukur(
  "LAMA  posisi part jauh (-ss 441, full-res)",
  ["-y", "-hide_banner", "-ss", "441.000", "-i", VID, "-frames:v", "1", "/tmp/ukur-lama.png"],
  "/tmp/ukur-lama.png",
);
// BARU — dipetakan ke menit 1–3 (441/480 → 60+0.919×120 ≈ 170 dtk) + scale + -an
const baru = ukur(
  "BARU  menit 1–3 (-ss 170, scale 1080×1920, -an)",
  ["-y", "-hide_banner", "-ss", "170.000", "-i", VID,
   "-vf", "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920",
   "-an", "-frames:v", "1", "/tmp/ukur-baru.png"],
  "/tmp/ukur-baru.png",
);
// tambahan: BARU pada posisi yang sama dgn LAMA (murni efek scale+an)
const baruSama = ukur(
  "BARU  di posisi lama 441 (efek scale+an saja)",
  ["-y", "-hide_banner", "-ss", "441.000", "-i", VID,
   "-vf", "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920",
   "-an", "-frames:v", "1", "/tmp/ukur-baru2.png"],
  "/tmp/ukur-baru2.png",
);
console.log(
  `\nfile baru ${(statSync("/tmp/ukur-baru.png").size / statSync("/tmp/ukur-lama.png").size * 100).toFixed(0)}% dari ukuran lama` +
    ` · frame baru valid: ${existsSync("/tmp/ukur-baru.png") ? "YA" : "TIDAK"}`,
);
