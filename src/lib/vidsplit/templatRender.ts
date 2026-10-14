// VidSplit v0.46.0 — rasterisasi latar template halaman (server-side)
// svgLatarTemplate → PNG RGBA (interior jendela video transparan) via sharp.
// DI-CACHE per (W,H,grad1,grad2) di work/templat/ — render sekali per kombinasi.
import { createHash } from "node:crypto";
import path from "node:path";
import sharp from "sharp";
import { dirWork } from "./ffmpeg";
import {
  rapikanTemplat,
  svgLatarTemplate,
  svgMaskLatarTemplate,
  type SetelanTemplat,
} from "./templatLayar";

/** Render PNG latar template — kembalikan path absolut. Aman dipanggil berulang. */
export async function siapkanLatarTemplate(
  W: number,
  H: number,
  setelanMentah: Partial<SetelanTemplat> | undefined,
): Promise<string> {
  const t = rapikanTemplat(setelanMentah);
  const kunci =
    createHash("sha1").update(`${W}x${H}|${t.grad1}|${t.grad2}|v1`).digest("hex").slice(0, 16) +
    ".png";
  const keluar = path.join(dirWork("templat"), kunci);
  try {
    await sharp(keluar).metadata(); // ada & terbaca → cache hit
    return keluar;
  } catch {
    /* belum ada → render baru */
  }
  const latar = await sharp(Buffer.from(svgLatarTemplate(W, H, t))).png().toBuffer();
  // potong interior jendela video jadi transparan (dest-in dgn mask lubang)
  await sharp(latar)
    .composite([{ input: Buffer.from(svgMaskLatarTemplate(W, H)), blend: "dest-in" }])
    .png({ compressionLevel: 9 })
    .toFile(keluar);
  return keluar;
}
