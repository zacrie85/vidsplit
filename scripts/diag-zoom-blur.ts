// Diagnostik v0.51.0-bug: apakah zoomBlur benar2 memperbesar video di hasil ekspor?
// Ukur TINGGI pita video tajam di frame 9:16 (720x1280):
//   sumber 640x360 (16:9): contain = min(720/640,1280/360)=1.125
//   z=100 → video 720x405  → pita y=437..842 (tinggi 405)
//   z=200 → video 1440x810 → pita y=235..1045 (tinggi 810)
//   z=300 → video 2160x1214→ pita y=33..1247 (tinggi 1214)
// Jika tinggi pita TIDAK bertambah dgn zoom → bug ekspor terbukti.
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { bangunArgumenPart, jalankanFfmpeg, pilihFfmpeg } from "../src/lib/vidsplit/ffmpeg";
import { pengaturanDefault } from "../src/lib/vidsplit/types";

const OUT = path.join(process.cwd(), "work", "diag-zoom-blur");
mkdirSync(OUT, { recursive: true });
const ff = await pilihFfmpeg();

const sumber = path.join(OUT, "sumber.mp4");
if (!existsSync(sumber)) {
  await jalankanFfmpeg(
    ["-y", "-hide_banner", "-v", "error", "-f", "lavfi", "-i", "testsrc2=size=640x360:rate=15:duration=2,noise=alls=60:allf=t", "-c:v", "libx264", "-preset", "ultrafast", "-crf", "23", sumber],
    30, undefined, ff.bin,
  );
}

async function render(zoom: number, pp: number, tag: string): Promise<string> {
  const keluar = path.join(OUT, `${tag}.mp4`);
  const { args } = bangunArgumenPart({
    src: sumber, bg: null,
    pengaturan: { ...pengaturanDefault, mode: "blur", zoomBlur: zoom, posisiPotong: pp, judul: "D", durasiPart: 2, resolusi: "720" },
    n: 1, mulai: 0, durasi: 2, W: 720, H: 1280, fps: 15, adaAudio: false,
    judulTxt: "D", partTxt: "Part 1", dirTmp: OUT, tag,
    codecArgs: ["-c:v", "libx264", "-preset", "ultrafast", "-crf", "30"],
    keluar,
  });
  await jalankanFfmpeg(args, 60, undefined, ff.bin);
  return keluar;
}

// batas pita video: cari baris dgn gradien horizontal > ambang (video tajam)
async function pitaVideo(file: string): Promise<{ atas: number; bawah: number; tinggi: number }> {
  const png = file.replace(".mp4", ".png");
  await jalankanFfmpeg(["-y", "-hide_banner", "-v", "error", "-ss", "1", "-i", file, "-frames:v", "1", png], 30, undefined, ff.bin);
  const sharp = (await import("sharp")).default;
  const buf = await sharp(png).raw().toBuffer();
  const { width: W2, height: H2, channels: C2 = 3 } = await sharp(png).metadata();
  const grad = (y: number) => {
    let j = 0, n = 0;
    for (let x = 4; x < (W2 ?? 0) - 5; x += 2) {
      j += Math.abs(buf[(y * (W2 ?? 0) + x + 1) * C2] - buf[(y * (W2 ?? 0) + x) * C2]);
      n++;
    }
    return j / Math.max(1, n);
  };
  // ambang = titik tengah antara gradien blur (~0.2) dan video (~bebas); pakai 2.0
  let atas = -1, bawah = -1;
  for (let y = 2; y < (H2 ?? 0) - 2; y++) {
    const g = grad(y);
    if (atas < 0 && g > 2.0) atas = y;
    if (g > 2.0) bawah = y;
  }
  return { atas, bawah, tinggi: bawah - atas };
}

for (const z of [100, 150, 200, 300]) {
  const f = await render(z, 50, `z${z}`);
  const p = await pitaVideo(f);
  console.log(`z=${z}% pp=50 → pita video: y=${p.atas}..${p.bawah} tinggi=${p.tinggi}px (harus ≈ ${Math.round(405 * z / 100)}px)`);
}
console.log("--- efek geser pada z=200 ---");
for (const pp of [0, 50, 100]) {
  const f = await render(200, pp, `z200pp${pp}`);
  const p = await pitaVideo(f);
  console.log(`z=200% pp=${pp} → pita: y=${p.atas}..${p.bawah} tinggi=${p.tinggi}px`);
}
