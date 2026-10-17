// VidSplit v0.47.0 — resolusi path frame bawaan/unggahan (SERVER saja)
// Frame bawaan tinggal di public/bingkai/ ikut dikemas after-pack. v0.47.0:
// tiap frame punya DUA varian rasio — <slug>-916.png (1080×1920) utk video
// potret dan <slug>-169.png (1920×1080) utk lanskap — sehingga bingkai &
// teks (DANGDUT IDOLA DESA / HOROR ALAM GAIB) tampil PENUH tanpa ter-crop.
// Untuk ffmpeg (pathAman membatasi di work/), varian terpilih DICOPY sekali
// ke work/upload/bawaan-<slug>-<rasio>.png — cache permanen per instalasi.
// v0.54.0 — RECOLOR frame: pilihan user warna solid / gradasi vertikal,
// diterapkan TANPA mengubah bentuk (warna mengikuti terang/luminance piksel
// asli — garis, hiasan, alpha transparan persis seperti frame aslinya).
import { copyFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import path from "node:path";
import { dirWork, jalankanFfmpeg, probe } from "./ffmpeg";
import { adalahSlugBawaan } from "./bingkaiBawaan";

export { BINGKAI_BAWAAN, adalahSlugBawaan } from "./bingkaiBawaan";
export type { BingkaiBawaan } from "./bingkaiBawaan";

/** Hex "#rrggbb" (huruf besar/kecil) → "0xrrggbb" utk ffmpeg; null bila salah. */
export function hexKeFf(h: string): string | null {
  const t = (h || "").trim();
  return /^#[0-9a-fA-F]{6}$/.test(t) ? `0x${t.slice(1).toLowerCase()}` : null;
}

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
      // v0.49.0 — salin ulang bila ukuran sumber berubah (PNG frame diperbarui
      // oleh rilis baru tidak lagi terjebak cache lama).
      let perluSalin = true;
      if (existsSync(tujuan)) {
        try {
          perluSalin = statSync(tujuan).size !== statSync(asal).size;
        } catch {
          perluSalin = true;
        }
      }
      if (perluSalin) copyFileSync(asal, tujuan);
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

/** Folder cache PNG frame hasil pewarnaan (dibuat otomatis). */
function dirWarna(): string {
  return dirWork("bingkai-warna");
}

/**
 * v0.54.0 — RANTAI FILTER RECOLOR (murni — dites dgn ffmpeg sungguhan di
 * scripts/uji-warna-bingkai.ts). Warna baru = warna pilihan user dikalikan
 * TERANG piksel asli (multiply) — bentuk, gradasi terang-gelap, dan area
 * transparan frame TETAP PERSIS (permintaan user: ganti warna tanpa ubah bentuk).
 *  [0] frame PNG → split RGB & alpha
 *  · alpha → disimpan (alphaextract)
 *  · RGB → luminance (colorchannelmixer, tetap format RGB agar blend
 *    tidak mengubah gradien jadi abu-abu — pelajaran uji pertama)
 *  · [1] gradients c0→c1 vertikal (c1=c0 utk warna solid)
 *  · multiply grad × luminance → gabung alpha lagi (alphamerge)
 */
export function rantaiRecolorBingkai(): string {
  return (
    `[0:v]format=rgba,split=2[rgb][aa]` +
    `;[aa]alphaextract[alp]` +
    `;[rgb]format=rgb24,colorchannelmixer=rr=.299:rg=.587:rb=.114:gr=.299:gg=.587:gb=.114:br=.299:bg=.587:bb=.114[lum]` +
    `;[1:v]format=rgb24[grad]` +
    `;[grad][lum]blend=all_mode=multiply[mul]` +
    `;[mul][alp]alphamerge[out]`
  );
}

/** Desimal 0–255 dari kanal hex "0xrrggbb". */
function kanal(hex: string, ofs: number): number {
  return parseInt(hex.slice(2 + ofs, 4 + ofs), 16) || 0;
}

/** Argumen input lavfi utk GRADIEN vertikal penuh — DETERMINISTIK (tanpa
 *  filter "gradients" yang fase/rotasinya diacak tiap jalan — pelajaran uji:
 *  seed acak membuat warna atas/bawah berubah-ubah antar ekspor). Solid =
 *  c2 kosong → rumus jatuh ke warna tetap. */
export function argGradienBingkai(c1: string, c2: string, W: number, H: number): string {
  const r1 = kanal(c1, 0);
  const g1 = kanal(c1, 2);
  const b1 = kanal(c1, 4);
  const r2 = c2 ? kanal(c2, 0) : r1;
  const g2 = c2 ? kanal(c2, 2) : g1;
  const b2 = c2 ? kanal(c2, 4) : b1;
  const t = "(Y/(H-1))";
  return (
    `color=c=black:s=${W}x${H}:r=1:d=1,format=rgb24,` +
    `geq=r='${r1}+(${r2 - r1})*${t}':g='${g1}+(${g2 - g1})*${t}':b='${b1}+(${b2 - b1})*${t}'`
  );
}

/**
 * v0.54.0 — Warnai ulang PNG frame dgn warna pilihan user (SOLID atau GRADASI
 * vertikal) TANPA mengubah bentuk. Hasil di-cache di work/bingkai-warna/<hash>.png
 * (kunci = berkas+mtime+warna). Gagal (ffmpeg/probe) → kembalikan path ASLI
 * supaya ekspor tetap jalan dengan frame asli — pewarnaan tidak pernah
 * menggagalkan ekspor.
 */
export async function siapkanBingkaiWarna(
  frameAbs: string,
  warna1: string,
  warna2: string,
  ffmpegBin: string,
): Promise<string> {
  const c1 = hexKeFf(warna1);
  if (!c1) return frameAbs; // warna kosong/salah → frame asli
  const c2 = hexKeFf(warna2);
  try {
    const info = await probe(frameAbs);
    const W = Math.max(2, Math.round(info.lebar));
    const H = Math.max(2, Math.round(info.tinggi));
    const stat = statSync(frameAbs);
    const { createHash } = await import("node:crypto");
    const kunci =
      createHash("sha1")
        .update(`${path.basename(frameAbs)}|${stat.size}|${stat.mtimeMs}|${c1}|${c2 || ""}`)
        .digest("hex")
        .slice(0, 24) + ".png";
    const keluar = path.join(dirWarna(), kunci);
    if (existsSync(keluar)) return keluar;
    mkdirSync(dirWarna(), { recursive: true });
    await jalankanFfmpeg(
      [
        "-y",
        "-hide_banner",
        "-v",
        "error",
        "-i",
        frameAbs,
        "-f",
        "lavfi",
        "-i",
        argGradienBingkai(c1, c2 || "", W, H),
        "-frames:v",
        "1",
        "-filter_complex",
        rantaiRecolorBingkai(),
        "-map",
        "[out]",
        keluar,
      ],
      0,
      undefined,
      ffmpegBin,
      undefined,
      { diamMs: 20_000, diamAwalMs: 20_000, absolutMs: 60_000 },
    );
    return existsSync(keluar) ? keluar : frameAbs;
  } catch {
    return frameAbs; // gagal warna → frame asli (ekspor tetap jalan)
  }
}
