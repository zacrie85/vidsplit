// Uji kompatibilitas ffmpeg — v0.17.1
// Masalah v0.17.0: graf visual lolos uji sandbox (ffmpeg 7.1.x) tapi GAGAL di PC user
// karena installer membundel ffmpeg-static 7.0.x yang tidak punya opsi `rate` di
// showspectrum (`Error applying option 'rate' to filter 'showspectrum': Option not found`).
// Solusi: skrip ini merender SEMUA gaya visual + bentuk graf ekspor penuh memakai
// binary node_modules/ffmpeg-static (7.0.x — kembaran versi bundel Windows), plus
// ffmpeg sistem bila ada, sehingga ketidakcocokan versi tertangkap SEBELUM rilis.
// Jalankan: bun scripts/uji-kompat-ffmpeg.ts
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { bangunRantaiVisual, VISUAL_MUSIK, opsiVisualDefault } from "../src/lib/vidsplit/musik";

const DUR = 2;
const W = 320, H = 568; // 9:16 kecil — cepat, tetap mewakili resolusi vertikal bawaan
const FPS = 30;

const kandidat = [
  "node_modules/ffmpeg-static/ffmpeg", // static 7.0.x — kembaran versi bundel installer Windows
  "/usr/bin/ffmpeg",                   // sandbox/CI — versi lebih baru
].filter((p) => existsSync(p));

if (kandidat.length === 0) {
  console.error("Tidak ada binary ffmpeg untuk diuji");
  process.exit(1);
}

let lulus = 0;
let gagal = 0;
const daftarGagal: string[] = [];

function versiDari(bin: string): string {
  const r = spawnSync(bin, ["-version"], { encoding: "utf8" });
  return (r.stdout || "?").split("\n")[0] || "?";
}

function uji(bin: string, label: string) {
  console.log(`\n== ${label}: ${versiDari(bin).slice(0, 60)} ==`);
  VISUAL_MUSIK.forEach((v, idx) => {
    const o = {
      ...opsiVisualDefault,
      // selang-seling agar jalur `gradients` (gradien) & `color` (gelap/hitam) keduanya teruji
      bgMode: (idx % 2 === 0 ? "gradien" : "hitam") as typeof opsiVisualDefault.bgMode,
    };
    const grafViz = bangunRantaiVisual(v.id, { w: W, h: H, fps: FPS, durasi: DUR, o }).replace("[av]", "[av2]");
    // bentuk graf identik dgn renderVid (musikJobs.ts): split audio utk MP3 + video visualizer
    const graf = [
      "[0:a]aformat=channel_layouts=stereo[asrc]",
      "[asrc]asplit=2[ae][av]",
      "[av]volume=0.0dB[av2]",
      grafViz,
      "[viz]format=yuv420p[vfin]",
    ].join(";");
    const r = spawnSync(bin, [
      "-hide_banner", "-v", "error",
      "-f", "lavfi", "-i", `anoisesrc=d=${DUR}:c=pink:r=48000`,
      "-filter_complex", graf,
      "-map", "[vfin]", "-map", "[ae]",
      "-t", String(DUR),
      "-f", "null", "-",
    ], { encoding: "utf8", timeout: 180_000 });
    const ok = r.status === 0 && !(r.stderr || "").includes("Option not found");
    if (ok) {
      lulus++;
      console.log(`  LULUS  ${v.id}`);
    } else {
      gagal++;
      daftarGagal.push(`${label} :: ${v.id}`);
      const s = (r.stderr || r.stdout || "tanpa stderr").trim().split("\n").slice(0, 3).join("\n    ");
      console.log(`  GAGAL  ${v.id}\n    ${s}`);
    }
  });
}

for (const [i, bin] of kandidat.entries()) {
  uji(bin, i === 0 ? "BUNDEL (ffmpeg-static, versi dgn installer Windows)" : `SISTEM #${i}`);
}

console.log(`\n===== HASIL: ${lulus} lulus, ${gagal} gagal =====`);
if (gagal > 0) {
  console.log("Gaya gagal: " + daftarGagal.join(", "));
  process.exit(1);
}
