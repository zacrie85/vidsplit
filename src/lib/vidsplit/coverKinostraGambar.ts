/* ================================================================
   VidSplit v3.7.0 — coverKinostraGambar.ts
   PORT PENUH engine cover NOVACUT dari KINOSTRA (renderer/js/nccover.js
   v3.13) ke TypeScript — dipakai komponen pratinjau canvas (client).

   Permintaan user: "hapus total menu cover yang sekarang, transplantasikan
   menu cover yang ada pada KINOSTRA ke dalam aplikasi ini beserta dengan
   fitur preview nya" — jadi mesin gambar ini PERSIS KINOSTRA:
     1) 100 template = 10 LAYOUT × 10 PALET (gambaran piksel sama)
     2) latar ADEGAN (frame video) / HITAM + gradasi gelap per layout
     3) BINGKAI cover KLASIK/MODERN/FUTURISTIK (alpha 0.75)
     4) KEN BURNS (zoom in/out, pan x/y, diam) pada latar
     5) 8+1 ANIMASI MASUK teks (fade/rise/typewriter/slam/neon/tracking/
        glitch/wipe) — judul & badge part beranimasi mandiri
     6) 28 TRANSISI cover→video (4 kategori) — dipakai tombol
        MAINKAN PRATINJAU di UI
   Semua fungsi murni dari setelan + waktu → deterministik (pratinjau =
   pola ekspor server yang memakai port SVG sama dgn coverNovacut.ts).
   MURNI: tanpa import node:* / React; kanvas dibuat lewat pabrik yg
   diberi pemanggil (browser). Font dipetakan ke font bundel VidSplit
   (VDS Anton / VDS Bebas Neue / VDS Playfair Display / DejaVu Sans).
   ================================================================ */

/* ---------- easing (port visual.ts) ---------- */
export const ncEaseInOut = (p: number) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);
export const ncEaseOut = (p: number) => 1 - Math.pow(1 - p, 3);
export const ncEaseOutBack = (p: number) => {
  const c = 1.9;
  return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2);
};
export const ncClamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** RNG deterministik — pengganti Math.random agar pratinjau = hasil ekspor */
export function ncSeeded(seed: number): () => number {
  let a = ((seed | 0) + 0x9e3779b9) | 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- 10 PALET WARNA (port NCPALETTES) ---------- */
export interface PaletKino {
  k: string;
  n: string;
  fg: string;
  acc: string;
  bg1: string;
  bg2: string;
}
export const KINO_PALETTES: PaletKino[] = [
  { k: "cyber", n: "CYBER NEON", fg: "#eafcff", acc: "#22d3ee", bg1: "#0b0f2a", bg2: "#310e5f" },
  { k: "sunset", n: "SUNSET FIRE", fg: "#fff7ec", acc: "#fb923c", bg1: "#3b0d20", bg2: "#7c2d12" },
  { k: "gold", n: "GOLD LUXURY", fg: "#fffbe9", acc: "#f5c542", bg1: "#141005", bg2: "#3d2e05" },
  { k: "ice", n: "ICE COOL", fg: "#f2fbff", acc: "#7dd3fc", bg1: "#071c26", bg2: "#0b3a4a" },
  { k: "toxic", n: "TOXIC GREEN", fg: "#f2fff2", acc: "#4ade80", bg1: "#05140a", bg2: "#0f3d22" },
  { k: "royal", n: "ROYAL PURPLE", fg: "#faf5ff", acc: "#c084fc", bg1: "#160a2b", bg2: "#3b1263" },
  { k: "blood", n: "BLOOD RED", fg: "#fff2f2", acc: "#f87171", bg1: "#1b0505", bg2: "#450a0a" },
  { k: "mono", n: "MONOCHROME", fg: "#fafafa", acc: "#ffffff", bg1: "#09090b", bg2: "#27272a" },
  { k: "candy", n: "CANDY POP", fg: "#fffafc", acc: "#f472b6", bg1: "#2b0a1e", bg2: "#701a45" },
  { k: "ocean", n: "OCEAN DEEP", fg: "#effffa", acc: "#2dd4bf", bg1: "#04161c", bg2: "#134e4a" },
];
export const ncPal = (k: string): PaletKino => KINO_PALETTES.find((p) => p.k === k) ?? KINO_PALETTES[0];

/* ---------- 10 LAYOUT (port NCLAYOUTS) ---------- */
export const KINO_LAYOUTS: { k: string; n: string }[] = [
  { k: "impact", n: "IMPACT TENGAH" },
  { k: "lower", n: "LOWER THIRD" },
  { k: "banner", n: "BANNER ATAS" },
  { k: "side", n: "GRADIEN SISI" },
  { k: "boxed", n: "KOTAK JUDUL" },
  { k: "neon", n: "NEON GLOW" },
  { k: "bars", n: "BAR SINEMA" },
  { k: "sticker", n: "STICKER BADGE" },
  { k: "outline", n: "OUTLINE RAKSASA" },
  { k: "band", n: "PITA DIAGONAL" },
];

/* ---------- 4 BINGKAI COVER (port NCCOVER_FRAMES) ---------- */
export const KINO_BINGKAI: { k: string; n: string }[] = [
  { k: "none", n: "TANPA" },
  { k: "klasik", n: "KLASIK" },
  { k: "modern", n: "MODERN" },
  { k: "futuristik", n: "FUTURISTIK" },
];

/* ---------- 9 ANIMASI MASUK TEKS (port NCTEXTANIMS) ---------- */
export const KINO_ANIMASI: { k: string; n: string }[] = [
  { k: "off", n: "TANPA" },
  { k: "fade", n: "FADE" },
  { k: "rise", n: "RISE UP" },
  { k: "typewriter", n: "TYPEWRITER" },
  { k: "slam", n: "TITLE SLAM" },
  { k: "neon", n: "NEON FLICKER" },
  { k: "tracking", n: "TRACKING" },
  { k: "glitch", n: "GLITCH" },
  { k: "wipe", n: "WIPE" },
];

/* ---------- font stack — dipetakan ke font bundel VidSplit (offline) ---------- */
type JenisFontKino = "display" | "impact" | "condensed" | "serif" | "sans";
export function ncFontStack(id: JenisFontKino): string {
  switch (id) {
    case "display":
      return '"VDS Anton", "Arial Black", sans-serif';
    case "impact":
      return '"VDS Anton", Impact, "Arial Black", sans-serif';
    case "condensed":
      return '"VDS Bebas Neue", "Arial Narrow", sans-serif';
    case "serif":
      return '"VDS Playfair Display", Georgia, serif';
    default:
      return '"DejaVu Sans", "Segoe UI", sans-serif';
  }
}
/* ---------- v3.8.0 — PEMILIH FONT JUDUL/PART cover (pratinjau canvas) ----------
   Kunci = kunci FONT_COVER server (coverNovacut.ts). ""/null = bawaan layout.
   Stack memakai @font-face "VDS *" (globals.css) — pratinjau = ekspor. */
export const FAMILI_KINO: Record<string, string> = {
  impact: '"VDS Anton", Impact, "Arial Black", sans-serif',
  condensed: '"VDS Bebas Neue", "Arial Narrow", sans-serif',
  serif: '"VDS Cinzel Decorative", Georgia, serif',
  display: '"VDS Black Ops One", "Arial Black", sans-serif',
  sans: '"DejaVu Sans", "Segoe UI", sans-serif',
  monoton: '"VDS Monoton", "Arial Black", sans-serif',
  cinzel: '"VDS Cinzel", Georgia, serif',
  playfair: '"VDS Playfair Display", Georgia, serif',
  marcellus: '"VDS Marcellus", Georgia, serif',
  julius: '"VDS Julius Sans One", "Segoe UI", sans-serif',
  oswald: '"VDS Oswald", "Arial Narrow", sans-serif',
  sixcaps: '"VDS Six Caps", "Arial Narrow", sans-serif',
  teko: '"VDS Teko", "Arial Narrow", sans-serif',
  alfaslab: '"VDS Alfa Slab One", "Arial Black", sans-serif',
  abril: '"VDS Abril Fatface", Georgia, serif',
  creepster: '"VDS Creepster", "Arial Black", sans-serif',
};

/* pilihan font aktif (diatur PanelCoverKinostra sebelum menggambar) */
let fontOvJudul = "";
let fontOvPart = "";

/** set pilihan font judul/part cover pratinjau — "" = bawaan layout */
export function aturFontKino(judul: string, part: string): void {
  fontOvJudul = judul || "";
  fontOvPart = part || "";
}

/** stack font JUDUL: ikut pilihan user bila ada, selain itu font khas layout */
export function ncFontStackJudul(id: JenisFontKino): string {
  return (fontOvJudul && FAMILI_KINO[fontOvJudul]) || ncFontStack(id);
}

/** stack font PART: ikut pilihan user bila ada, selain itu font khas layout */
export function ncFontStackPart(id: JenisFontKino): string {
  return (fontOvPart && FAMILI_KINO[fontOvPart]) || ncFontStack(id);
}

/** pastikan font bundel termuat sebelum mengukur/menggambar (best-effort) */
export async function siapkanFontKino(): Promise<void> {
  try {
    if (typeof document === "undefined" || !document.fonts) return;
    await Promise.all(
        (
        [
          // v3.8.0 — semua face pilihan font cover (agar pratinjau = ekspor)
          ['400 40px "VDS Anton"', "VDS Anton"],
          ['700 40px "VDS Bebas Neue"', "VDS Bebas Neue"],
          ['700 40px "VDS Cinzel"', "VDS Cinzel"],
          ['700 40px "VDS Cinzel Decorative"', "VDS Cinzel Decorative"],
          ['700 40px "VDS Playfair Display"', "VDS Playfair Display"],
          ['400 40px "VDS Marcellus"', "VDS Marcellus"],
          ['400 40px "VDS Julius Sans One"', "VDS Julius Sans One"],
          ['600 40px "VDS Oswald"', "VDS Oswald"],
          ['400 40px "VDS Six Caps"', "VDS Six Caps"],
          ['700 40px "VDS Teko"', "VDS Teko"],
          ['400 40px "VDS Alfa Slab One"', "VDS Alfa Slab One"],
          ['400 40px "VDS Abril Fatface"', "VDS Abril Fatface"],
          ['400 40px "VDS Black Ops One"', "VDS Black Ops One"],
          ['400 40px "VDS Creepster"', "VDS Creepster"],
          ['400 40px "VDS Monoton"', "VDS Monoton"],
          ['400 40px "DejaVu Sans"', "DejaVu Sans"],
        ] as [string, string][]
      ).map(([f]) => document.fonts.load(f, "PART 01 Judul ABC").catch(() => undefined)),
    );
  } catch {
    /* font gagal muat → canvas jatuh ke fallback stack */
  }
}

/* ---------- wrap teks (kata panjang dipecah per karakter) ---------- */
export function ncWrapText(x: CanvasRenderingContext2D, text: string, maxW: number, maxLines: number): string[] {
  const out: string[] = [];
  let line = "";
  for (const raw of String(text || "").split(/\s+/)) {
    let w = raw;
    /* kata melebihi lebar → pecah per karakter agar judul panjang tetap terbaca */
    while (x.measureText(w).width > maxW && w.length > 1) {
      let cut = w.length;
      while (cut > 1 && x.measureText(w.slice(0, cut)).width > maxW) cut--;
      const head = w.slice(0, cut);
      if (line) {
        out.push(line);
        line = "";
      }
      out.push(head);
      w = w.slice(cut);
    }
    const t = line ? line + " " + w : w;
    if (x.measureText(t).width > maxW && line) {
      out.push(line);
      line = w;
    } else line = t;
    if (maxLines && out.length >= maxLines) break;
  }
  if (line && !(maxLines && out.length >= maxLines)) out.push(line);
  return maxLines ? out.slice(0, maxLines) : out;
}

/* ---------- AUTO-FIT JUDUL: font mengecil sampai SEMUA kata tercakup ---------- */
export function ncFitTitle(
  x: CanvasRenderingContext2D,
  title: string,
  fontOf: (s: number) => string,
  fs0: number,
  maxW: number,
  maxLines: number,
  minFs: number,
): { fs: number; lines: string[] } {
  let fs = fs0;
  x.font = fontOf(fs);
  let lines = ncWrapText(x, title, maxW, 0);
  while (lines.length > maxLines && fs > minFs) {
    fs = Math.max(minFs, fs * 0.92);
    x.font = fontOf(fs);
    lines = ncWrapText(x, title, maxW, 0);
  }
  return { fs, lines };
}

/* ---------- setelan satu kali gambar layout ---------- */
export interface OpsiLayoutKino {
  img: CanvasImageSource | null;
  bgStyle: "adegan" | "hitam";
  pal: PaletKino;
  title: string;
  part: string;
  ps: number; // skala tulisan part 0.5–2.5
}

/* ---------- LATAR (port drawBackground — palet eksplisit, tanpa global) ---------- */
export function ncDrawBackground(
  x: CanvasRenderingContext2D,
  W: number,
  H: number,
  img: CanvasImageSource | null,
  bgStyle: "adegan" | "hitam",
  darken: number,
  palBg1: string,
  palBg2: string,
): void {
  const swOf = (i: CanvasImageSource) => (i as HTMLCanvasElement).width || (i as HTMLImageElement).naturalWidth || 2;
  const shOf = (i: CanvasImageSource) => (i as HTMLCanvasElement).height || (i as HTMLImageElement).naturalHeight || 2;
  if (bgStyle === "hitam" || !img) {
    x.fillStyle = "#000";
    x.fillRect(0, 0, W, H);
    if (bgStyle === "hitam") {
      const gv = x.createRadialGradient(W / 2, H / 2, H * 0.2, W / 2, H / 2, H * 0.85);
      gv.addColorStop(0, "rgba(30,30,34,0.35)");
      gv.addColorStop(1, "rgba(0,0,0,0)");
      x.fillStyle = gv;
      x.fillRect(0, 0, W, H);
    }
    if (img) {
      /* gambar tetap ditaruh cover-fit (mode hitam dgn img manual) */
      const sw = swOf(img), sh = shOf(img);
      const s = Math.max(W / sw, H / sh) * 1.02;
      x.drawImage(img, (W - sw * s) / 2, (H - sh * s) / 2, sw * s, sh * s);
    } else {
      const g = x.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, palBg1);
      g.addColorStop(1, palBg2);
      x.fillStyle = g;
      x.fillRect(0, 0, W, H);
    }
  } else {
    const sw = swOf(img), sh = shOf(img);
    const s = Math.max(W / sw, H / sh) * 1.02;
    x.drawImage(img, (W - sw * s) / 2, (H - sh * s) / 2, sw * s, sh * s);
  }
  const g2 = x.createLinearGradient(0, 0, 0, H);
  g2.addColorStop(0, `rgba(0,0,0,${darken * 0.7})`);
  g2.addColorStop(0.5, `rgba(0,0,0,${darken * 0.25})`);
  g2.addColorStop(1, `rgba(0,0,0,${darken})`);
  x.fillStyle = g2;
  x.fillRect(0, 0, W, H);
}

/* ---------- BADGE PART (port drawPartBadge) — kotak aksen + teks hitam ---------- */
export function ncDrawPartBadge(
  x: CanvasRenderingContext2D,
  part: string,
  pal: PaletKino,
  px: number,
  py: number,
  size: number,
  align: CanvasTextAlign = "left",
): void {
  if (!part) return;
  x.font = `700 ${size}px ${ncFontStackPart("condensed")}`;
  const prev = x.textAlign;
  x.textAlign = align;
  const tw = x.measureText(String(part).toUpperCase()).width;
  const padX = size * 0.5;
  const boxW = tw + padX * 2;
  const boxH = size * 1.6;
  const bx = align === "center" ? px - boxW / 2 : align === "right" ? px - boxW : px;
  x.fillStyle = pal.acc;
  x.fillRect(bx, py, boxW, boxH);
  x.fillStyle = "#000";
  x.textBaseline = "middle";
  x.fillText(String(part).toUpperCase(), bx + padX, py + boxH / 2 + size * 0.04);
  x.textBaseline = "alphabetic";
  x.textAlign = prev;
}

function ncGlowText(x: CanvasRenderingContext2D, text: string, gx: number, gy: number, glow: string): void {
  x.save();
  x.shadowColor = glow;
  x.shadowBlur = 28;
  x.fillText(text, gx, gy);
  x.fillText(text, gx, gy);
  x.restore();
}

/* ================================================================
   10 LAYOUT — tiap layout menggambar 3 FASE terpisah:
     'bg'    = latar + dekorasi (dianimasikan KEN BURNS)
     'title' = blok judul (dianimasikan ANIMASI JUDUL)
     'part'  = badge / tulisan part (dianimasikan ANIMASI PART)
   ================================================================ */
export function ncLayoutPass(lay: string, phase: "bg" | "title" | "part", x: CanvasRenderingContext2D, W: number, H: number, o: OpsiLayoutKino): void {
  const pal = o.pal, fg = pal.fg, acc = pal.acc;
  const title = o.title || "";
  const part = o.part || "";
  const darkenOf: Record<string, number> = { impact: 0.45, lower: 0.3, banner: 0.3, side: 0.25, boxed: 0.35, neon: 0.55, bars: 0.2, sticker: 0.3, outline: 0.25, band: 0.25 };
  if (phase === "bg") {
    ncDrawBackground(x, W, H, o.img, o.bgStyle, darkenOf[lay] ?? 0.35, pal.bg1, pal.bg2);
    if (lay === "lower") {
      x.fillStyle = "rgba(0,0,0,0.72)";
      x.fillRect(0, H * 0.68, W * 0.72, H * 0.24);
      x.fillStyle = acc;
      x.fillRect(0, H * 0.68, W * 0.012, H * 0.24);
    } else if (lay === "banner") {
      x.fillStyle = pal.bg1;
      x.fillRect(0, 0, W, H * 0.22);
      x.fillStyle = acc;
      x.fillRect(0, H * 0.22, W, H * 0.012);
    } else if (lay === "side") {
      const g = x.createLinearGradient(0, 0, W * 0.62, 0);
      g.addColorStop(0, pal.bg1);
      g.addColorStop(0.75, pal.bg2);
      g.addColorStop(1, "rgba(0,0,0,0)");
      x.save();
      x.globalAlpha = 0.92;
      x.fillStyle = g;
      x.fillRect(0, 0, W * 0.62, H);
      x.restore();
      x.fillStyle = acc;
      x.fillRect(0, 0, W * 0.014, H);
    } else if (lay === "boxed") {
      x.strokeStyle = fg;
      x.lineWidth = H * 0.006;
      x.strokeRect(W * 0.09, H * 0.3, W * 0.82, H * 0.4);
    } else if (lay === "neon") {
      x.save();
      x.strokeStyle = acc;
      x.globalAlpha = 0.6;
      x.lineWidth = 2;
      x.strokeRect(W * 0.06, H * 0.08, W * 0.88, H * 0.84);
      x.restore();
    } else if (lay === "bars") {
      x.fillStyle = "#000";
      x.fillRect(0, 0, W, H * 0.14);
      x.fillRect(0, H * 0.86, W, H * 0.14);
      x.fillStyle = "rgba(255,255,255,0.35)";
      for (let fx = W * 0.03; fx < W; fx += W * 0.09) {
        x.fillRect(fx, H * 0.055, W * 0.03, H * 0.03);
        x.fillRect(fx, H * 0.915, W * 0.03, H * 0.03);
      }
    } else if (lay === "band") {
      x.save();
      x.translate(W / 2, H / 2);
      x.rotate(-0.06);
      const g = x.createLinearGradient(-W * 0.55, 0, W * 0.55, 0);
      g.addColorStop(0, pal.bg1);
      g.addColorStop(1, pal.bg2);
      x.globalAlpha = 0.95;
      x.fillStyle = g;
      x.fillRect(-W * 0.6, -H * 0.14, W * 1.2, H * 0.28);
      x.globalAlpha = 1;
      x.fillStyle = acc;
      x.fillRect(-W * 0.6, -H * 0.14, W * 1.2, H * 0.012);
      x.fillRect(-W * 0.6, H * 0.128, W * 1.2, H * 0.012);
      x.restore();
    }
    return;
  }
  if (phase === "title") {
    if (!title) return;
    x.textBaseline = "alphabetic";
    x.lineJoin = "round";
    if (lay === "impact") {
      x.textAlign = "center";
      const ft = ncFitTitle(x, title, (s) => `900 ${s}px ${ncFontStackJudul("impact")}`, H * 0.115, W * 0.84, 3, H * 0.024);
      x.font = `900 ${ft.fs}px ${ncFontStackJudul("impact")}`;
      const lh = ft.fs * (0.125 / 0.115);
      const startY = H / 2 - ((ft.lines.length - 1) * lh) / 2 + H * 0.03;
      ft.lines.forEach((ln, i) => {
        const y = startY + i * lh;
        x.fillStyle = "#000";
        x.fillText(ln, W / 2 + H * 0.006, y + H * 0.006);
        x.fillStyle = fg;
        x.fillText(ln, W / 2, y);
      });
      x.fillStyle = acc;
      x.fillRect(W / 2 - W * 0.08, startY + ft.lines.length * lh - lh * 0.48, W * 0.16, H * 0.012);
    } else if (lay === "lower") {
      x.textAlign = "left";
      const ft = ncFitTitle(x, title, (s) => `900 ${s}px ${ncFontStackJudul("impact")}`, H * 0.085, W * 0.64, 2, H * 0.024);
      x.font = `900 ${ft.fs}px ${ncFontStackJudul("impact")}`;
      const lh = ft.fs * (0.095 / 0.085);
      ft.lines.forEach((ln, i) => {
        x.fillStyle = "#000";
        x.fillText(ln, W * 0.04 + 3, H * 0.79 + i * lh + 3);
        x.fillStyle = fg;
        x.fillText(ln, W * 0.04, H * 0.79 + i * lh);
      });
    } else if (lay === "banner") {
      x.textAlign = "center";
      const bf = (s: number) => `900 ${s}px ${ncFontStackJudul("condensed")}`;
      let ft = ncFitTitle(x, title, bf, H * 0.1, W * 0.86, 1, H * 0.07);
      if (ft.lines.length > 1) ft = ncFitTitle(x, title, bf, H * 0.062, W * 0.86, 3, H * 0.024);
      x.font = bf(ft.fs);
      x.fillStyle = fg;
      if (ft.lines.length > 1) {
        const lh = ft.fs * (0.08 / 0.062);
        ft.lines.forEach((ln, i) => x.fillText(ln.toUpperCase(), W / 2, H * 0.095 + i * lh));
      } else x.fillText((ft.lines[0] || "").toUpperCase(), W / 2, H * 0.15);
    } else if (lay === "side") {
      x.textAlign = "left";
      const ft = ncFitTitle(x, title, (s) => `900 ${s}px ${ncFontStackJudul("impact")}`, H * 0.095, W * 0.5, 3, H * 0.024);
      x.font = `900 ${ft.fs}px ${ncFontStackJudul("impact")}`;
      const lh = ft.fs * (0.11 / 0.095);
      x.fillStyle = fg;
      ft.lines.forEach((ln, i) => x.fillText(ln, W * 0.05, H * 0.42 + i * lh));
    } else if (lay === "boxed") {
      x.textAlign = "center";
      const ft = ncFitTitle(x, title, (s) => `900 ${s}px ${ncFontStackJudul("condensed")}`, H * 0.09, W * 0.72, 3, H * 0.024);
      x.font = `900 ${ft.fs}px ${ncFontStackJudul("condensed")}`;
      const lh = ft.fs * (0.105 / 0.09);
      ft.lines.forEach((ln, i) => {
        x.fillStyle = fg;
        x.fillText(ln.toUpperCase(), W / 2, H * 0.47 + (i - (ft.lines.length - 1) / 2) * lh);
      });
    } else if (lay === "neon") {
      x.textAlign = "center";
      const ft = ncFitTitle(x, title, (s) => `900 ${s}px ${ncFontStackJudul("display")}`, H * 0.1, W * 0.8, 3, H * 0.024);
      x.font = `900 ${ft.fs}px ${ncFontStackJudul("display")}`;
      const lh = ft.fs * 1.3;
      ft.lines.forEach((ln, i) => {
        const y = H * 0.48 + (i - (ft.lines.length - 1) / 2) * lh;
        x.fillStyle = acc;
        ncGlowText(x, ln.toUpperCase(), W / 2, y, acc);
        x.fillStyle = "#fff";
        x.fillText(ln.toUpperCase(), W / 2, y);
      });
    } else if (lay === "bars") {
      x.textAlign = "center";
      const ft = ncFitTitle(x, title, (s) => `900 ${s}px ${ncFontStackJudul("condensed")}`, H * 0.075, W * 0.8, 3, H * 0.024);
      x.font = `900 ${ft.fs}px ${ncFontStackJudul("condensed")}`;
      const lh = ft.fs * (0.085 / 0.075);
      x.fillStyle = fg;
      ft.lines.forEach((ln, i) => x.fillText(ln.toUpperCase(), W / 2, H * 0.62 + (i - (ft.lines.length - 1) / 2) * lh));
    } else if (lay === "sticker") {
      x.textAlign = "center";
      const ft = ncFitTitle(x, title, (s) => `900 ${s}px ${ncFontStackJudul("impact")}`, H * 0.105, W * 0.8, 3, H * 0.024);
      x.font = `900 ${ft.fs}px ${ncFontStackJudul("impact")}`;
      const lh = ft.fs * (0.115 / 0.105);
      ft.lines.forEach((ln, i) => {
        const y = H * 0.62 + (i - (ft.lines.length - 1) / 2) * lh;
        x.fillStyle = "#000";
        x.fillText(ln, W / 2 + 4, y + 4);
        x.fillStyle = fg;
        x.fillText(ln, W / 2, y);
      });
    } else if (lay === "outline") {
      x.textAlign = "center";
      const ft = ncFitTitle(x, (title || "").toUpperCase(), (s) => `900 ${s}px ${ncFontStackJudul("impact")}`, H * 0.17, W * 0.9, 3, H * 0.024);
      x.font = `900 ${ft.fs}px ${ncFontStackJudul("impact")}`;
      const lh = ft.fs;
      ft.lines.forEach((ln, i) => {
        const y = H * 0.52 + (i - (ft.lines.length - 1) / 2) * lh;
        x.strokeStyle = fg;
        x.lineWidth = H * 0.008;
        x.strokeText(ln, W / 2, y);
        x.fillStyle = "rgba(0,0,0,0.25)";
        x.fillText(ln, W / 2, y);
      });
    } else if (lay === "band") {
      x.save();
      x.translate(W / 2, H / 2);
      x.rotate(-0.06);
      x.textAlign = "center";
      const ft = ncFitTitle(x, title, (s) => `900 ${s}px ${ncFontStackJudul("condensed")}`, H * 0.085, W * 0.84, 3, H * 0.024);
      x.font = `900 ${ft.fs}px ${ncFontStackJudul("condensed")}`;
      const lh = ft.fs * (0.095 / 0.085);
      x.fillStyle = fg;
      ft.lines.forEach((ln, i) => x.fillText(ln.toUpperCase(), 0, (i - (ft.lines.length - 1) / 2) * lh + H * 0.032));
      x.restore();
    }
    return;
  }
  /* phase === 'part' — semua ukuran × ps (skala 50%–250%) */
  if (!part) return;
  const ps = o.ps || 1;
  if (lay === "impact") ncDrawPartBadge(x, part, pal, W / 2, H * 0.74, H * 0.032 * ps, "center");
  else if (lay === "lower") {
    x.textAlign = "left";
    x.font = `700 ${H * 0.03 * ps}px ${ncFontStackPart("sans")}`;
    x.fillStyle = acc;
    x.fillText(String(part).toUpperCase(), W * 0.04, H * 0.885);
  } else if (lay === "banner") ncDrawPartBadge(x, part, pal, W / 2, H * 0.8, H * 0.032 * ps, "center");
  else if (lay === "side") {
    x.textAlign = "left";
    x.fillStyle = acc;
    x.font = `700 ${H * 0.028 * ps}px ${ncFontStackPart("sans")}`;
    x.fillText(String(part).toUpperCase(), W * 0.05, H * 0.42 - H * 0.06);
  } else if (lay === "boxed") {
    x.font = `700 ${H * 0.026 * ps}px ${ncFontStackPart("sans")}`;
    const bw2 = Math.max(W * 0.32, x.measureText(String(part).toUpperCase()).width + H * 0.026 * ps * 2);
    x.fillStyle = pal.bg1;
    x.fillRect(W / 2 - bw2 / 2, H * 0.28, bw2, H * 0.045 * ps);
    x.fillStyle = acc;
    x.textAlign = "center";
    x.fillText(String(part).toUpperCase(), W / 2, H * 0.312 + H * 0.0225 * (ps - 1));
  } else if (lay === "neon") {
    x.textAlign = "center";
    x.fillStyle = "#fff";
    x.font = `700 ${H * 0.028 * ps}px ${ncFontStackPart("sans")}`;
    x.fillText(String(part).toUpperCase(), W / 2, H * 0.62);
  } else if (lay === "bars") {
    x.textAlign = "center";
    x.fillStyle = acc;
    x.font = `700 ${H * 0.024 * ps}px ${ncFontStackPart("sans")}`;
    x.fillText(String(part).toUpperCase(), W / 2, H * 0.8);
  } else if (lay === "sticker") {
    x.save();
    x.translate(W * 0.72, H * 0.24);
    x.rotate(-0.12);
    x.fillStyle = acc;
    x.beginPath();
    const bw = W * 0.2 * ps, bh = H * 0.13 * ps;
    const rr = x as CanvasRenderingContext2D & { roundRect?: (a: number, b: number, c: number, d: number, e: number) => void };
    if (rr.roundRect) rr.roundRect(-bw / 2, -bh / 2, bw, bh, H * 0.02 * ps);
    else x.rect(-bw / 2, -bh / 2, bw, bh);
    x.fill();
    x.fillStyle = "#000";
    x.font = `900 ${H * 0.032 * ps}px ${ncFontStackPart("impact")}`;
    x.textAlign = "center";
    x.fillText(String(part).toUpperCase().slice(0, 12), 0, H * 0.012 * ps);
    x.restore();
  } else if (lay === "outline") {
    x.font = `900 ${H * 0.032 * ps}px ${ncFontStackPart("impact")}`;
    const sw2 = Math.max(W * 0.6, x.measureText(String(part).toUpperCase()).width + H * 0.032 * ps * 2);
    const sh2 = H * 0.05 * ps;
    x.fillStyle = acc;
    x.fillRect(W / 2 - sw2 / 2, H * 0.725 - sh2 / 2, sw2, sh2);
    x.fillStyle = "#000";
    x.textAlign = "center";
    x.fillText(String(part).toUpperCase(), W / 2, H * 0.74 + (ps - 1) * H * 0.032 * 0.35);
  } else if (lay === "band") ncDrawPartBadge(x, part, pal, W * 0.06, H * 0.78, H * 0.03 * ps, "left");
}

/* ---------- BINGKAI COVER (port drawCoverFrame — alpha 0.75) ---------- */
export function ncDrawCoverFrame(x: CanvasRenderingContext2D, W: number, H: number, style: string, accent = "#5ec8f8"): void {
  if (!style || style === "none") return;
  x.save();
  x.globalAlpha = 0.75;
  const m = Math.min(W, H) * 0.05;
  if (style === "klasik") ncFrameKlasik(x, W, H, m);
  else if (style === "modern") ncFrameModern(x, W, H, m, accent);
  else ncFrameFuturistik(x, W, H, m, accent);
  x.restore();
}
function ncFrameKlasik(x: CanvasRenderingContext2D, W: number, H: number, m: number): void {
  const gold = "#ecd9a0", deep = "#c9a24b";
  x.strokeStyle = gold;
  x.lineWidth = Math.max(2, H * 0.006);
  x.strokeRect(m, m, W - m * 2, H - m * 2);
  const m2 = m * 1.6;
  x.lineWidth = Math.max(1, H * 0.0022);
  x.strokeRect(m2, m2, W - m2 * 2, H - m2 * 2);
  const d = m * 0.6;
  for (const [cx, cy] of [[m, m], [W - m, m], [m, H - m], [W - m, H - m]] as [number, number][]) {
    x.save();
    x.translate(cx, cy);
    x.rotate(Math.PI / 4);
    x.fillStyle = deep;
    x.fillRect(-d / 2, -d / 2, d, d);
    x.restore();
    x.fillStyle = gold;
    x.beginPath();
    x.arc(cx, cy, d * 0.26, 0, Math.PI * 2);
    x.fill();
  }
  x.strokeStyle = gold;
  x.lineWidth = Math.max(1.5, H * 0.003);
  const a = m * 0.5;
  for (const [px, py, dx, dy] of [[W / 2, m, 1, 0], [W / 2, H - m, 1, 0], [m, H / 2, 0, 1], [W - m, H / 2, 0, 1]] as [number, number, number, number][]) {
    x.beginPath();
    if (dx) x.arc(px, py, a, Math.PI * 0.15, Math.PI * 0.85, dy === 0);
    else x.arc(px, py, a, Math.PI * (dy > 0 ? 0.65 : -0.35), Math.PI * (dy > 0 ? 0.35 : -0.65));
    x.stroke();
  }
}
function ncFrameModern(x: CanvasRenderingContext2D, W: number, H: number, m: number, accent: string): void {
  const r = H * 0.022;
  x.strokeStyle = "#ffffff";
  x.lineWidth = Math.max(2.5, H * 0.0075);
  x.beginPath();
  const rr = x as CanvasRenderingContext2D & { roundRect?: (a: number, b: number, c: number, d: number, e: number) => void };
  if (rr.roundRect) rr.roundRect(m, m, W - m * 2, H - m * 2, r);
  else x.rect(m, m, W - m * 2, H - m * 2);
  x.stroke();
  x.save();
  x.globalAlpha *= 0.55;
  x.lineWidth = Math.max(1, H * 0.002);
  const mo = m * 0.62;
  x.beginPath();
  if (rr.roundRect) rr.roundRect(mo, mo, W - mo * 2, H - mo * 2, r * 0.7);
  else x.rect(mo, mo, W - mo * 2, H - mo * 2);
  x.stroke();
  x.restore();
  const s = Math.min(W, H) * 0.02;
  x.fillStyle = accent;
  x.fillRect(W - m - s / 2, m - s / 2, s, s);
  x.fillRect(m - s / 2, H - m - s / 2, s, s);
}
function ncFrameFuturistik(x: CanvasRenderingContext2D, W: number, H: number, m: number, accent: string): void {
  x.save();
  x.globalAlpha *= 0.5;
  x.strokeStyle = accent;
  x.lineWidth = Math.max(1, H * 0.0022);
  const ch = Math.min(W, H) * 0.035;
  x.beginPath();
  x.moveTo(m + ch, m);
  x.lineTo(W - m - ch, m);
  x.lineTo(W - m, m + ch);
  x.lineTo(W - m, H - m - ch);
  x.lineTo(W - m - ch, H - m);
  x.lineTo(m + ch, H - m);
  x.lineTo(m, H - m - ch);
  x.lineTo(m, m + ch);
  x.closePath();
  x.stroke();
  x.restore();
  const L = Math.min(W, H) * 0.13;
  x.strokeStyle = accent;
  x.lineWidth = Math.max(3, H * 0.0085);
  x.shadowColor = accent;
  x.shadowBlur = Math.max(6, H * 0.018);
  for (const [px, py, sx, sy] of [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]] as [number, number, number, number][]) {
    x.beginPath();
    x.moveTo(px + sx * L, py);
    x.lineTo(px, py);
    x.lineTo(px, py + sy * L);
    x.stroke();
  }
  x.shadowBlur = 0;
  x.fillStyle = accent;
  const n = 14, tw = Math.max(1.5, H * 0.0028);
  for (let i = 3; i < n - 2; i++) {
    const px = m + ((W - m * 2) * i) / n;
    const len = i % 2 === 0 ? H * 0.014 : H * 0.008;
    x.fillRect(px - tw / 2, m + H * 0.004, tw, len);
    x.fillRect(px - tw / 2, H - m - H * 0.004 - len, tw, len);
  }
  const tri = Math.min(W, H) * 0.011;
  x.beginPath();
  x.moveTo(m, H / 2 - tri);
  x.lineTo(m + tri * 1.3, H / 2);
  x.lineTo(m, H / 2 + tri);
  x.closePath();
  x.fill();
  x.beginPath();
  x.moveTo(W - m, H / 2 - tri);
  x.lineTo(W - m - tri * 1.3, H / 2);
  x.lineTo(W - m, H / 2 + tri);
  x.closePath();
  x.fill();
}

/* ================================================================
   KONDISI ANIMASI TEKS (port ncTextState) — dipakai judul & badge part
   saat pratinjau bermain. Durasi 1e9 = TANPA outro-fade (teks menahan
   posisi sampai transisi mengambil alih — pola KINOSTRA v3.11).
   ================================================================ */
export interface KondisiTeksKino {
  alpha: number;
  dy: number;
  scale: number;
  kind: "typewriter" | "tracking" | "glitch" | "wipe" | null;
  inP?: number;
  local?: number;
}
export function ncTextState(anim: string, local: number, dur = 4, seed = 0): KondisiTeksKino {
  if (!anim || anim === "off") return { alpha: 1, dy: 0, scale: 1, kind: null };
  const inDur = Math.min(0.55, dur * 0.35);
  const inP = ncClamp01(local / Math.max(0.05, inDur));
  const outP = ncClamp01((dur - local) / Math.min(0.4, dur * 0.3));
  let alpha = Math.min(inP >= 1 ? 1 : inP, outP);
  let dy = 0, scale = 1, kind: KondisiTeksKino["kind"] = null;
  switch (anim) {
    case "rise":
      dy = (1 - ncEaseOut(inP)) * 0.09;
      alpha *= inP;
      break;
    case "slam": {
      const p = ncEaseOut(Math.min(1, inP * 1.15));
      scale = 1 + (1 - p) * 1.6;
      alpha *= Math.min(1, inP * 2.2) * outP;
      if (local < 0.32 && inP >= 0.95) dy = (ncSeeded(seed)() - 0.5) * 8 / 1000;
      break;
    }
    case "neon":
      alpha *= 0.78 + 0.22 * Math.abs(Math.sin(local * 18));
      break;
    case "typewriter":
      kind = "typewriter";
      break;
    case "tracking":
      kind = "tracking";
      break;
    case "glitch":
      kind = "glitch";
      break;
    case "wipe":
      kind = "wipe";
      alpha = 1;
      break;
    default:
      alpha *= inP;
  }
  return { alpha: ncClamp01(alpha), dy, scale, kind, inP, local };
}

/* ---------- KEN BURNS LATAR COVER (port clipTransform fx-kenburns) ---------- */
export function ncKenburnsRect(p: number, W: number, H: number, mode: string): { x: number; y: number; w: number; h: number } {
  let scale = 1, panX = 0, panY = 0;
  if (mode === "in") scale = 1 + 0.14 * p;
  else if (mode === "out") scale = 1 + 0.14 * (1 - p);
  else if (mode === "panx") {
    scale = 1.12;
    panX = (p * 2 - 1) * 0.09;
  } else if (mode === "pany") {
    scale = 1.12;
    panY = (p * 2 - 1) * 0.09;
  }
  const dw = W * scale, dh = H * scale;
  return { x: (W - dw) / 2 + panX * W * 0.09, y: (H - dh) / 2 + panY * H * 0.09, w: dw, h: dh };
}

/* ================================================================
   PEMBANGUN LAPISAN COVER — render sekali per part (port ncBuildCoverLayers):
     bg    = latar + dekorasi (digerakkan KEN BURNS per frame)
     title = blok judul layout (dianimasikan)
     part  = badge/tulisan part (dianimasikan)
     frame = bingkai cover (statis, paling atas)
     final = komposisi lengkap tanpa animasi — sumber TRANSISI
   buatKanvas = pabrik kanvas (browser: () => document.createElement('canvas'))
   ================================================================ */
export interface SetelanCoverKino {
  layout: string;
  palette: string;
  bg: "adegan" | "hitam";
  frame: string;
  fx: string; // 'in' | 'out' | 'panx' | 'pany' | 'off'
  titleAnim: string;
  partAnim: string;
  partScale: number;
}
export interface LapisCoverKino {
  W: number;
  H: number;
  nc: SetelanCoverKino;
  pal: PaletKino;
  bg: HTMLCanvasElement;
  title: HTMLCanvasElement;
  part: HTMLCanvasElement;
  frame: HTMLCanvasElement | null;
  final: HTMLCanvasElement;
}
export function ncBuildCoverLayers(
  W: number,
  H: number,
  opts: { nc: SetelanCoverKino; img?: CanvasImageSource | null; title?: string; part?: string; ps?: number },
  buatKanvas: () => HTMLCanvasElement,
): LapisCoverKino {
  const nc = opts.nc;
  const pal = ncPal(nc.palette);
  const ps = Math.max(0.5, Math.min(2.5, Number(opts.ps ?? nc.partScale) || 1));
  const o: OpsiLayoutKino = { img: opts.img ?? null, bgStyle: nc.bg, pal, title: opts.title || "", part: opts.part || "", ps };
  const mk = () => {
    const c = buatKanvas();
    c.width = W;
    c.height = H;
    return c;
  };
  const draw = (cv: HTMLCanvasElement, phase: "bg" | "title" | "part") => {
    const g = cv.getContext("2d", { alpha: phase !== "bg" }) as CanvasRenderingContext2D;
    g.clearRect(0, 0, W, H);
    ncLayoutPass(nc.layout, phase, g, W, H, o);
  };
  const L: LapisCoverKino = { W, H, nc, pal, bg: mk(), title: mk(), part: mk(), frame: null, final: mk() };
  draw(L.bg, "bg");
  draw(L.title, "title");
  draw(L.part, "part");
  if (nc.frame && nc.frame !== "none") {
    L.frame = mk();
    ncDrawCoverFrame(L.frame.getContext("2d") as CanvasRenderingContext2D, W, H, nc.frame, pal.acc);
  }
  ncComposeCoverFrame(L.final.getContext("2d") as CanvasRenderingContext2D, W, H, L, { p: 1, tLocal: 99, dur: 1, animate: false });
  return L;
}

/* ---------- SATU FRAME COVER — dipanggil per frame saat pratinjau bermain ---------- */
export function ncComposeCoverFrame(
  x: CanvasRenderingContext2D,
  W: number,
  H: number,
  L: LapisCoverKino,
  o: { p: number; tLocal: number; dur: number; animate: boolean },
): void {
  const nc = L.nc;
  x.save();
  x.globalAlpha = 1;
  x.globalCompositeOperation = "source-over";
  x.fillStyle = "#000";
  x.fillRect(0, 0, W, H);
  /* 1) latar + KEN BURNS */
  const kr = ncKenburnsRect(ncClamp01(o.p), W, H, nc.fx || "in");
  x.drawImage(L.bg, kr.x, kr.y, kr.w, kr.h);
  /* 2) judul dgn animasi masuk — TANPA outro-fade (polo KINOSTRA v3.11:
     teks menahan posisi sampai transisi mengambil alih) */
  const st = o.animate === false ? { alpha: 1, dy: 0, scale: 1, kind: null } : ncTextState(nc.titleAnim, o.tLocal, 1e9, 11);
  if (st.alpha > 0.004) {
    x.save();
    x.globalAlpha = st.alpha;
    const cx = W / 2, cy = H / 2 + st.dy * H;
    if (st.scale !== 1) {
      x.translate(cx, cy);
      x.scale(st.scale, st.scale);
      x.translate(-cx, -cy);
    } else if (st.dy) x.translate(0, st.dy * H);
    x.drawImage(L.title, 0, 0);
    x.restore();
  }
  /* 3) badge part dgn animasinya sendiri (ditunda 0,25 dtk — pola KINOSTRA) */
  const sp = o.animate === false ? { alpha: 1, dy: 0, scale: 1, kind: null } : ncTextState(nc.partAnim, Math.max(0, o.tLocal - 0.25), 1e9, 77);
  if (sp.alpha > 0.004) {
    x.save();
    x.globalAlpha = sp.alpha;
    const cx = W / 2, cy = H / 2 + sp.dy * H;
    if (sp.scale !== 1) {
      x.translate(cx, cy);
      x.scale(sp.scale, sp.scale);
      x.translate(-cx, -cy);
    } else if (sp.dy) x.translate(0, sp.dy * H);
    x.drawImage(L.part, 0, 0);
    x.restore();
  }
  /* 4) bingkai cover — statis paling atas (alpha 0.75) */
  if (L.frame) x.drawImage(L.frame, 0, 0);
  x.restore();
}

/* ================================================================
   28 TRANSISI (port applyTransition) — 4 kategori; a = kanvas cover,
   b = kanvas video, p = 0..1; randomness via ncSeeded → deterministik.
   ================================================================ */
export interface TransisiKino {
  k: string;
  n: string;
  g: string;
  d: string;
}
export const KINO_TRANSISI: TransisiKino[] = [
  { k: "flash", n: "FLASH SNAP", g: "TRAILER HOLLYWOOD", d: "Kilat putih ala trailer aksi" },
  { k: "whip-pan", n: "WHIP PAN", g: "TRAILER HOLLYWOOD", d: "Kamerasapu cepat dgn blur" },
  { k: "zoom-punch", n: "ZOOM PUNCH", g: "TRAILER HOLLYWOOD", d: "Dorongan zoom blockbuster" },
  { k: "zoom-blast", n: "ZOOM BLAST", g: "TRAILER HOLLYWOOD", d: "Ledakan zoom radial + blur" },
  { k: "glitch-rgb", n: "RGB GLITCH", g: "TRAILER HOLLYWOOD", d: "Glitch digital sci-fi" },
  { k: "shake-impact", n: "IMPACT SHAKE", g: "TRAILER HOLLYWOOD", d: "Guncangan impact" },
  { k: "bars-reveal", n: "CINEMATIC BARS", g: "TRAILER HOLLYWOOD", d: "Bar hitam tutup lalu buka" },
  { k: "film-burn", n: "FILM BURN", g: "TRAILER HOLLYWOOD", d: "Light leak api film 35mm" },
  { k: "slide-l", n: "SLIDE KIRI", g: "IKLAN PRODUK", d: "Geser masuk dari kanan" },
  { k: "slide-r", n: "SLIDE KANAN", g: "IKLAN PRODUK", d: "Geser masuk dari kiri" },
  { k: "slide-u", n: "SLIDE ATAS", g: "IKLAN PRODUK", d: "Geser masuk dari bawah" },
  { k: "slide-d", n: "SLIDE BAWAH", g: "IKLAN PRODUK", d: "Geser masuk dari atas" },
  { k: "push-l", n: "PUSH PARALLAX", g: "IKLAN PRODUK", d: "Dorongan parallax halus" },
  { k: "wipe-diag", n: "DIAGONAL WIPE", g: "IKLAN PRODUK", d: "Sapuan diagonal + garis cahaya" },
  { k: "iris", n: "IRIS CIRCLE", g: "IKLAN PRODUK", d: "Bukaan lingkaran klasik" },
  { k: "blinds", n: "WINDOW BLINDS", g: "IKLAN PRODUK", d: "Bukaan tirai horizontal" },
  { k: "split-v", n: "SPLIT REVEAL", g: "IKLAN PRODUK", d: "Belahan layar terbuka" },
  { k: "bounce", n: "BOUNCE POP", g: "IKLAN PRODUK", d: "Pantulan elastis" },
  { k: "flare-sweep", n: "FLARE SWEEP", g: "IKLAN PRODUK", d: "Sapuan flare premium" },
  { k: "crossfade", n: "CROSS DISSOLVE", g: "SINEMATIK", d: "Lebur klasik halus" },
  { k: "dip-black", n: "DIP KE HITAM", g: "SINEMATIK", d: "Tenggelam ke hitam lalu bangkit" },
  { k: "dip-white", n: "DIP KE PUTIH", g: "SINEMATIK", d: "Tenggelam ke putih terang" },
  { k: "blur-dissolve", n: "BLUR DISSOLVE", g: "SINEMATIK", d: "Lebur dgn blur mimpi" },
  { k: "spin-swap", n: "SPIN SWAP", g: "TREND VIRAL", d: "Putaran pertukaran adegan" },
  { k: "pixelate", n: "PIXELATE", g: "TREND VIRAL", d: "Pecah piksel retro" },
  { k: "tv-static", n: "TV STATIC", g: "TREND VIRAL", d: "Debu TV analog" },
  { k: "chroma-slide", n: "CHROMATIC SLIDE", g: "TREND VIRAL", d: "Geser dgn bayangan RGB" },
  { k: "mosaic", n: "MOSAIC REVEAL", g: "TREND VIRAL", d: "Ubin mosaik menyusun adegan" },
];
export const ncTransById = (k: string): TransisiKino | null => KINO_TRANSISI.find((t) => t.k === k) ?? null;

/* kanvas bantu bersama (pixelate/tv-static) — dibuat malas, browser saja */
let _ncNoise: HTMLCanvasElement | null = null;
function ncNoiseCanvas(buatKanvas: () => HTMLCanvasElement): HTMLCanvasElement {
  if (_ncNoise) return _ncNoise;
  const c = buatKanvas();
  c.width = 256;
  c.height = 256;
  const g = c.getContext("2d") as CanvasRenderingContext2D;
  const img = g.createImageData(256, 256);
  const rnd = ncSeeded(20260);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = rnd() * 255;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  _ncNoise = c;
  return c;
}
let _ncScratch: HTMLCanvasElement | null = null;
function ncScratchCanvas(buatKanvas: () => HTMLCanvasElement): HTMLCanvasElement {
  return _ncScratch ?? (_ncScratch = buatKanvas());
}

export function ncDrawCoverFit(x: CanvasRenderingContext2D, src: CanvasImageSource, W: number, H: number, opt: { scale?: number; dx?: number; dy?: number; alpha?: number } = {}): void {
  const sw = (src as HTMLCanvasElement).width || 2;
  const sh = (src as HTMLCanvasElement).height || 2;
  const s = Math.max(W / sw, H / sh) * (opt.scale || 1);
  const dw = sw * s, dh = sh * s;
  /* alpha DIKALIKAN dgn alpha ambien — transisi lebur tetap benar */
  const ga = x.globalAlpha;
  x.globalAlpha = ga * (opt.alpha ?? 1);
  x.drawImage(src, (W - dw) / 2 + (opt.dx || 0), (H - dh) / 2 + (opt.dy || 0), dw, dh);
  x.globalAlpha = ga;
}
export function ncWithAlpha(x: CanvasRenderingContext2D, a: number, fn: () => void): void {
  const old = x.globalAlpha;
  x.globalAlpha = a;
  fn();
  x.globalAlpha = old;
}

export function ncApplyTransition(id: string, x: CanvasRenderingContext2D, a: CanvasImageSource, b: CanvasImageSource, p: number, W: number, H: number, accent = "#fff"): void {
  const e = ncEaseInOut(p);
  const A = () => ncDrawCoverFit(x, a, W, H);
  const B = () => ncDrawCoverFit(x, b, W, H);
  const rnd = ncSeeded(Math.floor(p * 4096) + 5);
  const buatKanvas = () => document.createElement("canvas");
  x.fillStyle = "#000";
  x.fillRect(0, 0, W, H);
  switch (id) {
    case "crossfade":
      A();
      ncWithAlpha(x, p, B);
      break;
    case "dip-black":
      if (p < 0.5) ncWithAlpha(x, 1 - p * 2, A);
      else ncWithAlpha(x, (p - 0.5) * 2, B);
      break;
    case "dip-white":
      x.fillStyle = "#fff";
      x.fillRect(0, 0, W, H);
      if (p < 0.5) ncWithAlpha(x, 1 - p * 2, A);
      else ncWithAlpha(x, (p - 0.5) * 2, B);
      break;
    case "flash": {
      if (p < 0.5) A();
      else B();
      const fl = Math.pow(Math.sin(p * Math.PI), 4) * 0.98;
      x.fillStyle = `rgba(255,255,255,${fl})`;
      x.fillRect(0, 0, W, H);
      break;
    }
    case "whip-pan": {
      const blur = Math.sin(p * Math.PI) * 16;
      x.filter = `blur(${blur}px)`;
      ncDrawCoverFit(x, a, W, H, { dx: -e * W });
      ncDrawCoverFit(x, b, W, H, { dx: (1 - e) * W });
      x.filter = "none";
      break;
    }
    case "zoom-punch":
      ncDrawCoverFit(x, a, W, H, { scale: 1 + 0.45 * ncEaseOut(p), alpha: 1 - p * 0.9 });
      ncWithAlpha(x, Math.min(1, p * 1.4), () => ncDrawCoverFit(x, b, W, H, { scale: 0.65 + 0.35 * ncEaseOutBack(p) }));
      break;
    case "zoom-blast":
      x.filter = `blur(${p * 9}px)`;
      ncDrawCoverFit(x, a, W, H, { scale: 1 + 1.3 * p * p, alpha: 1 - p });
      x.filter = `blur(${(1 - p) * 9}px)`;
      ncWithAlpha(x, p, () => ncDrawCoverFit(x, b, W, H, { scale: 1.55 - 0.55 * ncEaseOut(p) }));
      x.filter = "none";
      break;
    case "glitch-rgb": {
      const base = p < 0.5 ? a : b;
      const inten = Math.sin(p * Math.PI);
      ncDrawCoverFit(x, base, W, H);
      x.save();
      x.globalCompositeOperation = "lighter";
      ncWithAlpha(x, 0.3 * inten, () => {
        x.filter = "hue-rotate(120deg) saturate(3)";
        ncDrawCoverFit(x, base, W, H, { dx: 10 * inten });
        x.filter = "hue-rotate(-120deg) saturate(3)";
        ncDrawCoverFit(x, base, W, H, { dx: -10 * inten });
      });
      x.restore();
      x.filter = "none";
      const bsH = (base as HTMLCanvasElement).height / H;
      for (let i = 0; i < 7; i++) {
        const sy = rnd() * H, sh = 6 + rnd() * 36;
        const dx = (rnd() - 0.5) * 90 * inten;
        x.drawImage(base, 0, sy * bsH, (base as HTMLCanvasElement).width, sh * bsH, dx, sy, W, sh);
      }
      break;
    }
    case "shake-impact": {
      const base = p < 0.5 ? a : b;
      const amp = Math.sin(p * Math.PI) * 22;
      ncDrawCoverFit(x, base, W, H, { scale: 1.03, dx: (rnd() - 0.5) * amp, dy: (rnd() - 0.5) * amp });
      break;
    }
    case "bars-reveal": {
      if (p < 0.5) {
        A();
        const bh = ncEaseInOut(p * 2) * (H / 2);
        x.fillStyle = "#000";
        x.fillRect(0, 0, W, bh);
        x.fillRect(0, H - bh, W, bh);
      } else {
        B();
        const bh = (1 - ncEaseInOut((p - 0.5) * 2)) * (H / 2);
        x.fillStyle = "#000";
        x.fillRect(0, 0, W, bh);
        x.fillRect(0, H - bh, W, bh);
      }
      break;
    }
    case "film-burn": {
      A();
      ncWithAlpha(x, ncClamp01((p - 0.35) / 0.3), B);
      const cx = W * (-0.25 + 1.5 * p), cy = H * 0.5, r = W * 0.3;
      const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, "rgba(255,255,220,0.95)");
      g.addColorStop(0.4, "rgba(255,150,40,0.75)");
      g.addColorStop(0.75, "rgba(200,40,10,0.35)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      x.save();
      x.globalCompositeOperation = "screen";
      x.globalAlpha = Math.sin(p * Math.PI);
      x.fillStyle = g;
      x.fillRect(0, 0, W, H);
      x.restore();
      break;
    }
    case "slide-l":
      A();
      ncDrawCoverFit(x, b, W, H, { dx: (1 - e) * W });
      break;
    case "slide-r":
      A();
      ncDrawCoverFit(x, b, W, H, { dx: -(1 - e) * W });
      break;
    case "slide-u":
      A();
      ncDrawCoverFit(x, b, W, H, { dy: -(1 - e) * H });
      break;
    case "slide-d":
      A();
      ncDrawCoverFit(x, b, W, H, { dy: (1 - e) * H });
      break;
    case "push-l":
      ncDrawCoverFit(x, a, W, H, { dx: -e * W });
      ncDrawCoverFit(x, b, W, H, { dx: (1 - e) * W });
      break;
    case "wipe-diag": {
      /* p=0 = cover penuh → p=1 = video penuh, garis cahaya memimpin tepi */
      A();
      x.save();
      x.beginPath();
      const xTop = W * 1.55 - e * W * 2.3, xBot = xTop - W * 0.4;
      x.moveTo(xBot, H);
      x.lineTo(xTop, 0);
      x.lineTo(W + 2, 0);
      x.lineTo(W + 2, H);
      x.closePath();
      x.clip();
      B();
      x.restore();
      const lx = (1 - e) * (W * 1.4);
      const grad = x.createLinearGradient(lx - 60, 0, lx + 60, 0);
      grad.addColorStop(0, "rgba(255,255,255,0)");
      grad.addColorStop(0.5, `rgba(255,255,255,${Math.sin(p * Math.PI) * 0.7})`);
      grad.addColorStop(1, "rgba(255,255,255,0)");
      x.fillStyle = grad;
      x.fillRect(lx - 60, 0, 120, H);
      break;
    }
    case "iris": {
      A();
      const r = e * Math.hypot(W, H) * 0.55;
      x.save();
      x.beginPath();
      x.arc(W / 2, H / 2, r, 0, Math.PI * 2);
      x.clip();
      B();
      x.restore();
      x.strokeStyle = accent;
      x.globalAlpha = Math.sin(p * Math.PI) * 0.6;
      x.lineWidth = 4;
      x.beginPath();
      x.arc(W / 2, H / 2, r, 0, Math.PI * 2);
      x.stroke();
      x.globalAlpha = 1;
      break;
    }
    case "blinds": {
      A();
      const n = 8;
      for (let i = 0; i < n; i++) {
        const lp = ncClamp01(p * 1.5 - (i / n) * 0.5);
        if (lp <= 0) continue;
        const y = (i * H) / n, bh = (H / n) * ncEaseInOut(lp);
        x.save();
        x.beginPath();
        x.rect(0, y, W, bh);
        x.clip();
        B();
        x.restore();
      }
      break;
    }
    case "split-v": {
      A();
      const half = (W / 2) * e;
      x.save();
      x.beginPath();
      x.rect(0, 0, half, H);
      x.clip();
      ncDrawCoverFit(x, b, W, H, { dx: -((W / 2) * (1 - e)) });
      x.restore();
      x.save();
      x.beginPath();
      x.rect(W - half, 0, half + 1, H);
      x.clip();
      ncDrawCoverFit(x, b, W, H, { dx: (W / 2) * (1 - e) });
      x.restore();
      x.fillStyle = "rgba(255,255,255,0.75)";
      x.fillRect(W / 2 - 1.5, 0, 3, H * Math.sin(p * Math.PI));
      break;
    }
    case "bounce": {
      A();
      const s = ncEaseOutBack(p);
      ncWithAlpha(x, Math.min(1, p * 2.5), () => ncDrawCoverFit(x, b, W, H, { scale: s }));
      break;
    }
    case "flare-sweep": {
      A();
      x.save();
      x.beginPath();
      x.rect(0, 0, W * e, H);
      x.clip();
      B();
      x.restore();
      const px = W * p;
      const grad = x.createLinearGradient(px - W * 0.18, 0, px + W * 0.18, 0);
      grad.addColorStop(0, "rgba(255,255,255,0)");
      grad.addColorStop(0.5, `rgba(255,250,220,${Math.sin(p * Math.PI) * 0.85})`);
      grad.addColorStop(1, "rgba(255,255,255,0)");
      x.save();
      x.globalCompositeOperation = "screen";
      x.fillStyle = grad;
      x.fillRect(px - W * 0.18, 0, W * 0.36, H);
      x.restore();
      break;
    }
    case "blur-dissolve":
      x.filter = `blur(${p * 12}px)`;
      A();
      x.filter = `blur(${(1 - p) * 12}px)`;
      ncWithAlpha(x, p, B);
      x.filter = "none";
      break;
    case "spin-swap": {
      x.save();
      x.translate(W / 2, H / 2);
      x.rotate(e * Math.PI * 0.5);
      x.globalAlpha = 1 - p;
      const s1 = 1 - e * 0.5;
      x.drawImage(a, (-W * s1) / 2, (-H * s1) / 2, W * s1, H * s1);
      x.restore();
      x.save();
      x.translate(W / 2, H / 2);
      x.rotate((e - 1) * Math.PI * 0.5);
      x.globalAlpha = p;
      const s2 = 0.5 + 0.5 * e;
      x.drawImage(b, (-W * s2) / 2, (-H * s2) / 2, W * s2, H * s2);
      x.restore();
      x.globalAlpha = 1;
      break;
    }
    case "pixelate": {
      const base = p < 0.5 ? a : b;
      const px = Math.max(2, Math.round(Math.sin(p * Math.PI) * 48));
      const sc = ncScratchCanvas(buatKanvas);
      const tw = Math.max(2, Math.round(W / px)), th = Math.max(2, Math.round(H / px));
      sc.width = tw;
      sc.height = th;
      const sctx = sc.getContext("2d") as CanvasRenderingContext2D;
      sctx.drawImage(base, 0, 0, tw, th);
      x.imageSmoothingEnabled = false;
      x.drawImage(sc, 0, 0, W, H);
      x.imageSmoothingEnabled = true;
      break;
    }
    case "tv-static": {
      const base = p < 0.45 ? a : b;
      ncDrawCoverFit(x, base, W, H);
      const inten = Math.pow(Math.sin(p * Math.PI), 1.4);
      if (inten > 0.02) {
        const nz = ncNoiseCanvas(buatKanvas);
        x.save();
        x.globalAlpha = inten;
        x.imageSmoothingEnabled = false;
        const ox = -rnd() * 200, oy = -rnd() * 200;
        for (let px = ox; px < W; px += nz.width) for (let py = oy; py < H; py += nz.height) x.drawImage(nz, px, py);
        x.restore();
      }
      break;
    }
    case "chroma-slide": {
      const inten = Math.sin(p * Math.PI);
      ncDrawCoverFit(x, a, W, H, { dx: -e * W * 0.35, alpha: 1 - p * 0.6 });
      ncDrawCoverFit(x, b, W, H, { dx: (1 - e) * W });
      x.save();
      x.globalCompositeOperation = "lighter";
      ncWithAlpha(x, 0.35 * inten, () => {
        x.filter = "hue-rotate(140deg) saturate(4)";
        ncDrawCoverFit(x, b, W, H, { dx: (1 - e) * W - 12 * inten });
        x.filter = "hue-rotate(-140deg) saturate(4)";
        ncDrawCoverFit(x, b, W, H, { dx: (1 - e) * W + 12 * inten });
      });
      x.restore();
      x.filter = "none";
      break;
    }
    case "mosaic": {
      A();
      const cols = 7, rows = 4;
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          const seed = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
          const rndCell = seed - Math.floor(seed);
          const lp = ncClamp01((p - rndCell * 0.4) / 0.6);
          if (lp <= 0) continue;
          const cw = W / cols, chh = H / rows;
          x.save();
          x.beginPath();
          x.rect(i * cw, j * chh, cw * ncEaseOut(lp), chh * ncEaseOut(lp));
          x.clip();
          B();
          x.restore();
        }
      }
      break;
    }
    default:
      A();
      ncWithAlpha(x, p, B);
  }
}
