// Uji visual v0.49.0 — komposit frame spesial di atas video nyata + judul
// terbakar (posisi default atas 4.5%) untuk memeriksa tampilan akhir.
// Jalankan: bun scripts/uji-bingkai-komposit.ts
import { mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { jalankanFfmpeg, pilihFfmpeg, dirWork } from "../src/lib/vidsplit/ffmpeg";
import { siapkanBingkai } from "../src/lib/vidsplit/bingkai";

const OUT = path.join(process.cwd(), "work", "uji-bingkai");
mkdirSync(OUT, { recursive: true });

const SLUGS = [
  "dangdut-idola-desa",
  "horor-alam-gaib",
  "dangdut-idola-desa-2",
  "horor-alam-gaib-2",
  // v0.50.0 — 6 frame IDOLA DESA baru
  "dangdut-idola-desa-3",
  "dangdut-idola-desa-4",
  "dangdut-idola-desa-5",
  "dangdut-idola-desa-6",
  "dangdut-idola-desa-7",
  "dangdut-idola-desa-8",
  // v0.52.0 — 7 frame HOROR ALAM GAIB baru (teks atas + sisi tipis)
  "horor-alam-gaib-3",
  "horor-alam-gaib-4",
  "horor-alam-gaib-5",
  "horor-alam-gaib-6",
  "horor-alam-gaib-7",
  "horor-alam-gaib-8",
  "horor-alam-gaib-9",
  // v0.57.0 — 10 frame horor baru (pocong, kuntilanak dkk)
  "horor-alam-gaib-10",
  "horor-alam-gaib-11",
  "horor-alam-gaib-12",
  "horor-alam-gaib-13",
  "horor-alam-gaib-14",
  "horor-alam-gaib-15",
  "horor-alam-gaib-16",
  "horor-alam-gaib-17",
  "horor-alam-gaib-18",
  "horor-alam-gaib-19",
];

async function utama() {
  const ff = await pilihFfmpeg();
  // 1) frame video sumber 9:16 (testsrc2 agar ada konten warna-warni)
  const sumber = path.join(OUT, "sumber-916.png");
  await jalankanFfmpeg(
    ["-y", "-hide_banner", "-v", "error", "-f", "lavfi", "-i", "testsrc2=size=1080x1920:rate=1:duration=1", "-frames:v", "1", sumber],
    5,
    undefined,
    ff.bin,
  );
  // 2) judul terbakar di posisi default (y = 4.5% = 86px, ukuran 35, font Cinzel)
  const font = "/home/z/my-project/vidsplit/assets/fonts/CinzelDecorative-Bold.ttf";
  const dgnJudul = path.join(OUT, "sumber-judul.png");
  const judul = "RINDUNYA HATIKU AJENG FEBRIA FT OM NIRWANA";
  const fileJudul = path.join(OUT, "judul.txt");
  await (await import("node:fs/promises")).writeFile(fileJudul, judul, "utf8");
  await jalankanFfmpeg(
    [
      "-y", "-hide_banner", "-v", "error", "-i", sumber,
      "-vf",
      `drawtext=textfile='${fileJudul}':fontfile='${font}':fontsize=35:fontcolor=white:borderw=3:bordercolor=black:x=(w-text_w)/2:y=86`,
      "-frames:v", "1", dgnJudul,
    ],
    5,
    undefined,
    ff.bin,
  );
  // 3) komposit tiap frame spesial
  for (const slug of SLUGS) {
    const p = siapkanBingkai(`bawaan:${slug}`, false);
    if (!p || !existsSync(p)) {
      console.error("✗ frame tidak ada:", slug);
      continue;
    }
    const hasil = path.join(OUT, `komposit-${slug}.png`);
    await sharp(dgnJudul).composite([{ input: p }]).png().toFile(hasil);
    console.log("✓", hasil);
  }
  console.log("SELESAI");
}
utama();
