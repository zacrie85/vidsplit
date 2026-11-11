/* ================================================================
   VidSplit v2.9.0 — kilat/komposisi.ts  (KOMPOSISI CANVAS KILAT)
   ================================================================
   Replika PERSIS rumus rantaiUtama() ffmpeg (src/lib/vidsplit/
   ffmpeg.ts) di canvas 2D, agar hasil mesin KILAT (WebCodecs)
   se-desain persis dgn mesin render ffmpeg:

   - mode "asli"   : contain + pad hitam (tanpa konversi rasio)
   - mode "crop"   : cover-crop jendela W×H pada posisiPotong;
                     zoomPotong < 100 → latar blur + isi cover×z
   - mode "warna"  : contain + pad warnaLatar
   - mode "blur"   : latar boxblur 24:2 + eq(−0.04, 1.15) → canvas
                     filter blur/brightness/saturate; isi contain
                     (× zoomBlur), posisi geser bebas ← ↑ ↓ →:
                     x = (W−w)/2 × (1 + gx/100)  (identik ffmpeg)

   v2.9.0 — teks/bingkai/intro/logo BELUM di jalur kilat: gerbang
   kilat menolak setelan yang membakar elemen tersebut (jalur
   ffmpeg yang menggambar). v3.0.0 = mesin visual canvas penuh.
   ================================================================ */
"use client";

import type { Pengaturan } from "../types";

export type SumberFrame = VideoFrame | HTMLVideoElement | HTMLCanvasElement | ImageBitmap;

const clampN = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/* filter latar blur — padanan boxblur=24:2,eq=brightness=-0.04:saturation=1.15 */
function filterLatarBlur(): string {
  return "blur(12px) brightness(0.96) saturate(1.15)";
}

/** Gambar SATU frame sumber ke kanvas W×H sesuai mode konversi.
 *  cx HARUS berukuran W×H (kanvas keluaran part). */
export function gambarKomposisi(
  cx: CanvasRenderingContext2D,
  frame: SumberFrame,
  W: number,
  H: number,
  p: Pengaturan,
): void {
  const sw = "displayWidth" in frame ? frame.displayWidth : frame.width;
  const sh = "displayHeight" in frame ? frame.displayHeight : frame.height;
  if (!sw || !sh) return;
  cx.filter = "none";
  cx.globalAlpha = 1;
  cx.globalCompositeOperation = "source-over";
  cx.fillStyle = "#000";
  cx.fillRect(0, 0, W, H);

  if (p.mode === "asli" || p.mode === "warna") {
    /* [0:v]scale=W:H:force_original_aspect_ratio=decrease,pad=...:color */
    const s = Math.min(W / sw, H / sh);
    const w = sw * s,
      h = sh * s;
    if (p.mode === "warna") {
      cx.fillStyle = p.warnaLatar || "#111827";
      cx.fillRect(0, 0, W, H);
    }
    cx.drawImage(frame as CanvasImageSource, (W - w) / 2, (H - h) / 2, w, h);
    return;
  }

  if (p.mode === "crop") {
    const pp = clampN(p.posisiPotong ?? 50, 0, 100);
    const z = clampN(Number.isFinite(p.zoomPotong) ? p.zoomPotong : 100, 50, 100) / 100;
    if (z >= 0.995) {
      /* scale=increase,crop=W:H:(iw-ow)*pp/100:0 — cover lalu geser jendela */
      const s = Math.max(W / sw, H / sh);
      const w = sw * s,
        h = sh * s;
      cx.drawImage(frame as CanvasImageSource, -(w - W) * (pp / 100), -(h - H) / 2, w, h);
      return;
    }
    /* zoomPotong < 100: latar blur memenuhi layar + isi cover×z overlay
       x = (W−w)×pp/100, y = (H−h)/2 */
    cx.save();
    cx.filter = filterLatarBlur();
    const sB = Math.max(W / sw, H / sh);
    cx.drawImage(frame as CanvasImageSource, (W - sw * sB) / 2, (H - sh * sB) / 2, sw * sB, sh * sB);
    cx.restore();
    const s = Math.max(W / sw, H / sh) * z;
    const w = sw * s,
      h = sh * s;
    cx.drawImage(frame as CanvasImageSource, (W - w) * (pp / 100), (H - h) / 2, w, h);
    return;
  }

  /* mode "blur" (bawaan): latar = video di-blur memenuhi layar,
     isi = contain (× zoomBlur 100–300), geser bebas X/Y −100..100 */
  cx.save();
  cx.filter = filterLatarBlur();
  const sB = Math.max(W / sw, H / sh);
  cx.drawImage(frame as CanvasImageSource, (W - sw * sB) / 2, (H - sh * sB) / 2, sw * sB, sh * sB);
  cx.restore();

  const gx = clampN(Number.isFinite(p.geserBlurX) ? p.geserBlurX : 0, -100, 100);
  const gy = clampN(Number.isFinite(p.geserBlurY) ? p.geserBlurY : 0, -100, 100);
  const z = clampN(Number.isFinite(p.zoomBlur) ? p.zoomBlur : 100, 100, 300) / 100;
  const s = Math.min(W / sw, H / sh) * z;
  const w = sw * s,
    h = sh * s;
  /* rumus overlay rantaiUtama: x='(W-w)/2*(1+gx/100)' — GENAP walau w>W
     (zoom besar: geser tetap jalan, tepi negatif = potong sisi) */
  cx.drawImage(
    frame as CanvasImageSource,
    (W - w) / 2 * (1 + gx / 100),
    (H - h) / 2 * (1 + gy / 100),
    w,
    h,
  );
}
