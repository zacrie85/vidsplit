// VidSplit v0.47.0 — resolusi path frame bawaan/unggahan (SERVER saja)
// Frame bawaan tinggal di public/bingkai/ ikut dikemas after-pack. v0.47.0:
// tiap frame punya DUA varian rasio — <slug>-916.png (1080×1920) utk video
// potret dan <slug>-169.png (1920×1080) utk lanskap — sehingga bingkai &
// teks (DANGDUT IDOLA DESA / HOROR ALAM GAIB) tampil PENUH tanpa ter-crop.
// Untuk ffmpeg (pathAman membatasi di work/), varian terpilih DICOPY sekali
// ke work/upload/bawaan-<slug>-<rasio>.png — cache permanen per instalasi.
import { copyFileSync, existsSync } from "node:fs";
import path from "node:path";
import { dirWork } from "./ffmpeg";
import { adalahSlugBawaan } from "./bingkaiBawaan";

export { BINGKAI_BAWAAN, adalahSlugBawaan } from "./bingkaiBawaan";
export type { BingkaiBawaan } from "./bingkaiBawaan";

/** Path asal PNG bawaan utk rasio "916"|"169" — null bila slug tak dikenal.
 *  Fallback: bila varian rasio tak ada tapi <slug>.png ada (paket lama),
 *  pakai berkas itu agar ekspor tetap jalan. */
export function jalurAsalBawaan(slug: string, lanskap: boolean): string | null {
  if (!adalahSlugBawaan(slug)) return null;
  const dasar = path.join(process.cwd(), "public", "bingkai");
  const varian = path.join(dasar, `${slug}-${lanskap ? "169" : "916"}.png`);
  if (existsSync(varian)) return varian;
  const tunggal = path.join(dasar, `${slug}.png`);
  return existsSync(tunggal) ? tunggal : null;
}

/**
 * Resolve frameId → path absolut siap pakai ffmpeg.
 *   ""                       → null (tanpa frame)
 *   "bawaan:<slug>"          → copy varian rasio (lanskap=true → 1920×1080)
 *   "upload/<berkas>"        → work/upload/<berkas> (unggahan user, PNG alpha)
 * Selalu verifikasi file ada — bila gagal → null (tanpa frame, ekspor tetap
 * jalan; lebih baik dari pada gagal total).
 */
export function siapkanBingkai(frameId: string, lanskap = false): string | null {
  const id = (frameId || "").trim();
  if (!id) return null;
  try {
    if (id.startsWith("bawaan:")) {
      const slug = id.slice(7);
      const asal = jalurAsalBawaan(slug, lanskap);
      if (!asal || !existsSync(asal)) return null;
      const nama = path.basename(asal);
      const tujuan = path.join(dirWork("upload"), `bawaan-${nama}`);
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
