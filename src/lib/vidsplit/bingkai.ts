// VidSplit v0.46.0 — resolusi path frame bawaan/unggahan (SERVER saja)
// Frame bawaan tinggal di public/bingkai/<slug>.png (ikut dikemas after-pack).
// Untuk ffmpeg (pathAman membatasi di work/), file bawaan DICOPY sekali ke
// work/upload/bawaan-<slug>.png — cache permanen per instalasi.
import { copyFileSync, existsSync } from "node:fs";
import path from "node:path";
import { dirWork } from "./ffmpeg";
import { adalahSlugBawaan } from "./bingkaiBawaan";

export { BINGKAI_BAWAAN, adalahSlugBawaan } from "./bingkaiBawaan";
export type { BingkaiBawaan } from "./bingkaiBawaan";

/** Path asal PNG bawaan (folder public) — null bila slug tak dikenal */
export function jalurAsalBawaan(slug: string): string | null {
  if (!adalahSlugBawaan(slug)) return null;
  return path.join(process.cwd(), "public", "bingkai", `${slug}.png`);
}

/**
 * Resolve frameId → path absolut siap pakai ffmpeg.
 *   ""                       → null (tanpa frame)
 *   "bawaan:<slug>"          → copy public/bingkai/<slug>.png → work/upload/
 *   "upload/<berkas>"        → work/upload/<berkas> (unggahan user, PNG alpha)
 * Selalu verifikasi file ada — bila gagal → null (tanpa frame, ekspor tetap
 * jalan; lebih baik dari pada gagal total).
 */
export function siapkanBingkai(frameId: string): string | null {
  const id = (frameId || "").trim();
  if (!id) return null;
  try {
    if (id.startsWith("bawaan:")) {
      const slug = id.slice(7);
      const asal = jalurAsalBawaan(slug);
      if (!asal || !existsSync(asal)) return null;
      const tujuan = path.join(dirWork("upload"), `bawaan-${slug}.png`);
      if (!existsSync(tujuan)) copyFileSync(asal, tujuan);
      return tujuan;
    }
    if (id.startsWith("upload/")) {
      const p = path.resolve(dirWork("upload"), path.basename(id.slice(7)));
      return existsSync(p) ? p : null;
    }
  } catch {
    return null;
  }
  return null;
}
