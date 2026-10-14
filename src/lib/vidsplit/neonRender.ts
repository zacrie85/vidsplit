// VidSplit v0.46.0 — render sequence PNG frame neon (server-side)
// Menggambar svgFrameNeon() per frame via sharp (SVG → PNG RGBA), disimpan di
// work/neon/<kunci>/ lalu dirujuk ffmpeg sbg input overlay berulang
// (-framerate F -stream_loop -1 -i f%04d.png). Render pada SETENGAH resolusi
// (sisi pendek maks 540) lalu ffmpeg scale — glow neon lembut, 4× lebih cepat.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { dirWork } from "./ffmpeg";
import {
  kunciCacheNeon,
  rencanaSequence,
  svgFrameNeon,
  type SetelanNeon,
} from "./neonLayar";

export interface SequenceNeon {
  dir: string;
  fps: number;
  jumlah: number;
}

/** Konkurensi rasterisasi (sharp pool sudah internal — cukup antrian kecil) */
const JUMLAH_RASTER_PARALEL = 6;

/**
 * Siapkan sequence PNG neon untuk kanvas W×H. Hasil DI-CACHE per parameter —
 * video kedua dst dgn setelan sama tidak merender ulang. Aman dipanggil
 * konkuren (penjaga Map sama seperti pratinjau subtitle).
 */
export async function siapkanSequenceNeon(
  W: number,
  H: number,
  setelan: SetelanNeon,
): Promise<SequenceNeon> {
  // render setengah resolusi (genap utk yuv420p) — ffmpeg scale ke W:H saat overlay
  const wKecil = Math.max(2, Math.round(W / 2 / 2) * 2);
  const hKecil = Math.max(2, Math.round(H / 2 / 2) * 2);
  const kunci = createHash("sha1")
    .update(`${kunciCacheNeon(wKecil, hKecil, setelan)}|v3`)
    .digest("hex")
    .slice(0, 16);
  const dir = path.join(dirWork("neon"), kunci);
  mkdirSync(dir, { recursive: true });
  const { fps, jumlah } = rencanaSequence(setelan.kecepatan);

  const perlu = (i: number) => !existsSync(path.join(dir, `f${String(i + 1).padStart(4, "0")}.png`));
  const indeksPerlu: number[] = [];
  for (let i = 0; i < jumlah; i++) if (perlu(i)) indeksPerlu.push(i);

  if (indeksPerlu.length) {
    // rasterisasi berkelompok — hindari membanjiri memori dgn jutaan piksel sekaligus
    for (let mulai = 0; mulai < indeksPerlu.length; mulai += JUMLAH_RASTER_PARALEL) {
      const kelompok = indeksPerlu.slice(mulai, mulai + JUMLAH_RASTER_PARALEL);
      await Promise.all(
        kelompok.map(async (i) => {
          const svg = svgFrameNeon({
            W: wKecil,
            H: hKecil,
            setelan,
            progres: i / jumlah,
          });
          await sharp(Buffer.from(svg))
            .png({ compressionLevel: 6 })
            .toFile(path.join(dir, `f${String(i + 1).padStart(4, "0")}.png`));
        }),
      );
    }
  }
  return { dir, fps, jumlah };
}
