// ============================================================
// VidSplit v3.3.0 — MESIN COVER NOVACUT (100 TEMPLATE + 3 DASAR)
// Port dari renderer/js/nccover.js KINOSTRA v3.16.0 (NOVACUT COVER
// ENGINE v3.11–v3.13, yang asli port NOVACUT Studio v1.0.23):
//   • 100 template = 10 LAYOUT × 10 PALET
//     (impact/lower/banner/side/boxed/neon/bars/sticker/outline/band
//      × cyber/sunset/gold/ice/toxic/royal/blood/mono/candy/ocean)
//   • 3 gaya cover LAMA VidSplit (modern/klasik/futuristik) menjadi
//     kategori "DASAR" di dalam galeri yang sama — bukan menu terpisah
//     (permintaan user v3.3.0)
//   • latar ADEGAN (frame video) atau HITAM + scrim gelap per layout
//
// Port ke SVG: layout yang di canvas KINOSTRA digambar fungsi
// ncLayoutPass(lay, phase) di-port jadi pembangkit MARKUP SVG murni —
// dirender server via @resvg/resvg-js (PNG utk ffmpeg) dan dipratinjau
// client langsung sebagai data-URL SVG (pratinjau = hasil ekspor).
// Modul ini MURNI (tanpa import Node/DOM) supaya aman di pihak mana pun.
// ============================================================

// ---------- 10 PALET WARNA (port NCPALETTES) ----------
export interface PaletNovacut {
  k: string;
  n: string;
  fg: string;
  acc: string;
  bg1: string;
  bg2: string;
}

export const NOVACUT_PALETTES: PaletNovacut[] = [
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

// ---------- 10 LAYOUT (port NCLAYOUTS) ----------
export const NOVACUT_LAYOUTS: { k: string; n: string }[] = [
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

// ---------- katalog template (3 DASAR + 100 NOVACUT) ----------
export interface TemplateCover {
  id: string;
  nama: string;
  kategori: "dasar" | "novacut";
  layout?: string;
  palet?: string;
  populer?: boolean;
}

/** 3 gaya cover lama VidSplit (v2.3.0) sebagai kategori DASAR.
 *  Nama persis gaya lama agar user lama langsung mengenali. */
export const GAYA_DASAR_COVER: TemplateCover[] = [
  { id: "modern", nama: "DASAR · Modern", kategori: "dasar" },
  { id: "klasik", nama: "DASAR · Klasik Emas", kategori: "dasar" },
  { id: "futuristik", nama: "DASAR · Futuristik", kategori: "dasar" },
];

let cacheKatalog: TemplateCover[] | null = null;

/** Katalog lengkap 103 template (3 dasar + 10×10 NOVACUT). Murni — dicache. */
export function daftarTemplateCover(): TemplateCover[] {
  if (cacheKatalog) return cacheKatalog;
  const populer: Record<string, boolean> = {
    "impact--cyber": true,
    "impact--sunset": true,
    "neon--cyber": true,
    "gold--gold": false,
    "lower--blood": true,
    "bars--mono": true,
  };
  const list: TemplateCover[] = [...GAYA_DASAR_COVER];
  for (const lay of NOVACUT_LAYOUTS) {
    for (const pal of NOVACUT_PALETTES) {
      list.push({
        id: `${lay.k}--${pal.k}`,
        nama: `${lay.n} · ${pal.n}`,
        kategori: "novacut",
        layout: lay.k,
        palet: pal.k,
        populer: populer[`${lay.k}--${pal.k}`] === true,
      });
    }
  }
  cacheKatalog = list;
  return list;
}

export function templateCoverValid(id: string): boolean {
  return daftarTemplateCover().some((t) => t.id === id);
}

export function cariTemplateCover(id: string): TemplateCover | undefined {
  return daftarTemplateCover().find((t) => t.id === id);
}

// ---------- font cover (dipetakan ke TTF bundel VidSplit) ----------
// KINOSTRA memakai Orbitron (display) — VidSplit tidak membundelnya,
// diganti Black Ops One (stencil futuristik, satu keluarga vibe). Impact
// = Anton, condensed = Bebas Neue, serif = Cinzel Decorative (gaya klasik),
// sans = DejaVu Sans (pakai DejaVu karena Chakra Petch tak dibundel).
export type KunciFontCover = "impact" | "condensed" | "serif" | "display" | "sans" | "monoton";

export const FONT_COVER: Record<KunciFontCover, { family: string; ttf: string[]; bobot: number }> = {
  impact: { family: "Anton", ttf: ["Anton.ttf"], bobot: 400 },
  condensed: { family: "Bebas Neue", ttf: ["BebasNeue.ttf"], bobot: 400 },
  serif: { family: "Cinzel Decorative", ttf: ["CinzelDecorative-Bold.ttf"], bobot: 700 },
  display: { family: "Black Ops One", ttf: ["BlackOpsOne.ttf"], bobot: 400 },
  sans: { family: "DejaVu Sans", ttf: ["DejaVuSans-Bold.ttf", "DejaVuSans.ttf"], bobot: 700 },
  monoton: { family: "Monoton", ttf: ["Monoton.ttf"], bobot: 400 },
};

/** Semua family yang harus didaftarkan ke resvg (fontFiles server) */
export function daftarTtfCover(): string[] {
  const set = new Set<string>();
  for (const f of Object.values(FONT_COVER)) for (const t of f.ttf) set.add(t);
  return [...set];
}

/** Pengukur teks — disuntik pemanggil (server: TTF nyata via teksLayar;
 *  client: estimator lebar rata-rata). Murni. */
export interface PengukurTeks {
  /** lebar teks (px) pada font kunci + ukuran px */
  lebar(teks: string, font: KunciFontCover, fs: number): number;
}

/** Estimator client (tanpa TTF): faktor lebar rata-rata per font.
 *  Cukup akurat untuk pratinjau galeri; ekspor memakai pengukur TTF. */
export function pengukurPerkiraan(): PengukurTeks {
  const FAKTOR: Record<KunciFontCover, number> = {
    impact: 0.46,
    condensed: 0.38,
    serif: 0.62,
    display: 0.62,
    sans: 0.58,
    monoton: 0.68,
  };
  return {
    lebar: (teks, font, fs) => teks.length * fs * FAKTOR[font],
  };
}

// ---------- wrap + auto-fit (port ncWrapText & ncFitTitle) ----------
function bungkusUkur(
  teks: string,
  maksLebar: number,
  maksBaris: number,
  font: KunciFontCover,
  fs: number,
  ukur: PengukurTeks,
): string[] {
  const keluar: string[] = [];
  // \n = potongan baris PAKSA dari pemanggil (judul sudah dibungkus di luar) —
  // tiap segmen dibungkus ulang secara mandiri, lalu disambung berurutan.
  let penuh = false;
  for (const segmen of String(teks || "").split("\n")) {
    let baris = "";
    for (const raw of segmen.split(/\s+/)) {
      let w = raw;
      // kata melebihi lebar → pecah per karakter agar judul panjang tetap terbaca
      while (ukur.lebar(w, font, fs) > maksLebar && w.length > 1) {
        let potong = w.length;
        while (potong > 1 && ukur.lebar(w.slice(0, potong), font, fs) > maksLebar) potong--;
        const kepala = w.slice(0, potong);
        if (baris) {
          keluar.push(baris);
          baris = "";
        }
        keluar.push(kepala);
        w = w.slice(potong);
      }
      const coba = baris ? `${baris} ${w}` : w;
      if (ukur.lebar(coba, font, fs) > maksLebar && baris) {
        keluar.push(baris);
        baris = w;
      } else baris = coba;
      if (maksBaris && keluar.length >= maksBaris) {
        penuh = true;
        break;
      }
    }
    if (baris && !penuh) keluar.push(baris);
    if (penuh) break;
  }
  return maksBaris ? keluar.slice(0, maksBaris) : keluar;
}

/** port ncFitTitle — font mengecil 8% per langkah sampai SEMUA kata tercakup */
function pasFitJudul(
  judul: string,
  font: KunciFontCover,
  fs0: number,
  maksLebar: number,
  maksBaris: number,
  fsMin: number,
  ukur: PengukurTeks,
): { fs: number; baris: string[] } {
  let fs = fs0;
  let baris = bungkusUkur(judul, maksLebar, 0, font, fs, ukur);
  while (baris.length > maksBaris && fs > fsMin) {
    fs = Math.max(fsMin, fs * 0.92);
    baris = bungkusUkur(judul, maksLebar, 0, font, fs, ukur);
  }
  return { fs, baris };
}

// ---------- util ----------
const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c] as string);
const r2 = (n: number) => Math.round(n * 100) / 100;

/** scrim gelap per layout (port darkenOf) */
const DARKEN: Record<string, number> = {
  impact: 0.45, lower: 0.3, banner: 0.3, side: 0.25, boxed: 0.35,
  neon: 0.55, bars: 0.2, sticker: 0.3, outline: 0.25, band: 0.25,
};

export interface OpsiSvgCover {
  template: string;
  W: number;
  H: number;
  /** judul (mentah — dibungkus otomatis per layout) */
  judul: string;
  /** label part (mis. "Part 03") — "" = tanpa badge */
  labelPart: string;
  /** adegan = transparan (frame video dari ffmpeg di belakang); hitam = opak */
  latar: "adegan" | "hitam";
  /** skala tulisan part 0.5–2.5 (bawaan 1) */
  skalaPart?: number;
}

/**
 * Bangun markup SVG SATU cover penuh (port 3 fase ncLayoutPass jadi lapisan
 * statis: latar+dekorasi → judul → part → tanpa bingkai animasi).
 * Latar "adegan": dasar transparan — ffmpeg menempelkan PNG ini di atas frame.
 * Latar "hitam": hitam + vignette radial (port ncDrawBackground).
 */
export function svgCover(o: OpsiSvgCover, ukur: PengukurTeks): string {
  const W = Math.max(2, Math.round(o.W));
  const H = Math.max(2, Math.round(o.H));
  const tpl = cariTemplateCover(o.template);
  const judul = (o.judul || "").trim();
  const part = (o.labelPart || "").trim();
  const ps = Math.min(2.5, Math.max(0.5, o.skalaPart ?? 1));

  const svg: string[] = [];
  svg.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`);

  // ---------- template DASAR (3 gaya lama, dibangun ulang di sistem baru) ----------
  if (!tpl || tpl.kategori === "dasar") {
    const k = tpl?.id ?? "modern";
    const u = H / 1080; // unit skala ala gaya lama (sisi 1080)
    if (o.latar === "hitam") {
      svg.push(`<rect width="${W}" height="${H}" fill="#050608"/>`);
    } else {
      // scrim agar teks terbaca di atas frame (setara kotak gelap gaya lama)
      svg.push(`<rect width="${W}" height="${H}" fill="black" opacity="${k === "futuristik" ? 0.3 : 0.22}"/>`);
    }
    if (k === "klasik") {
      // bingkai emas ganda + garis emas bawah kotak judul (port hiasan "emas")
      const jarak = r2(16 * u);
      svg.push(`<rect x="${r2(2 * u)}" y="${r2(2 * u)}" width="${W - 4 * u}" height="${H - 4 * u}" fill="none" stroke="#d4af37" stroke-opacity="0.9" stroke-width="${r2(5 * u)}"/>`);
      svg.push(`<rect x="${jarak}" y="${jarak}" width="${r2(W - jarak * 2)}" height="${r2(H - jarak * 2)}" fill="none" stroke="#d4af37" stroke-opacity="0.45" stroke-width="${r2(2 * u)}"/>`);
    } else if (k === "futuristik") {
      // 8 bracket sudut cyan (port hiasan "neon")
      const s = 64 * u, t = 3 * u;
      const br: Array<[number, number, number, number]> = [
        [0, 0, s, t], [0, 0, t, s],
        [W - s, 0, s, t], [W - t, 0, t, s],
        [0, H - t, s, t], [0, H - s, t, s],
        [W - s, H - t, s, t], [W - t, H - s, t, s],
      ];
      for (const [x, y, w, h] of br)
        svg.push(`<rect x="${r2(x)}" y="${r2(y)}" width="${r2(w)}" height="${r2(h)}" fill="#22d3ee" opacity="0.9"/>`);
    }
    // judul + label — pemetaan gaya lama: font/warna GAYA_COVER
    const gayaTeks =
      k === "klasik"
        ? { font: "serif" as KunciFontCover, warnaJ: "#f5e6c8", warnaL: "#f5d061", kotakJ: "black", opJ: 0.55, kotakL: "black", opL: 0.6 }
        : k === "futuristik"
          ? { font: "impact" as KunciFontCover, warnaJ: "#ffffff", warnaL: "#22d3ee", kotakJ: "#020617", opJ: 0.6, kotakL: "#020617", opL: 0.78 }
          : { font: "sans" as KunciFontCover, warnaJ: "#ffffff", warnaL: "#fbbf24", kotakJ: "black", opJ: 0.45, kotakL: "black", opL: 0.55 };
    const fsJ = 64 * u;
    const ft = pasFitJudul(judul, gayaTeks.font, fsJ, W * 0.9, 3, 24 * u, ukur);
    const barisJ = Math.max(1, ft.baris.length);
    const yJudul = H * 0.055;
    const hBoxJ = barisJ * ft.fs * 1.35 + ft.fs * 0.5;
    // kotak judul gelap + teks
    svg.push(`<rect x="0" y="${r2(yJudul)}" width="${W}" height="${r2(hBoxJ)}" fill="${gayaTeks.kotakJ}" opacity="${gayaTeks.opJ}"/>`);
    ft.baris.forEach((b, i) => {
      svg.push(
        `<text x="${W / 2}" y="${r2(yJudul + ft.fs * 0.25 + ft.fs * (0.95 + i * 1.32))}" font-family="${FONT_COVER[gayaTeks.font].family}" font-size="${r2(ft.fs)}" font-weight="${FONT_COVER[gayaTeks.font].bobot}" fill="${gayaTeks.warnaJ}" text-anchor="middle">${esc(b)}</text>`,
      );
    });
    if (k === "klasik")
      svg.push(`<rect x="0" y="${r2(yJudul + hBoxJ)}" width="${W}" height="${r2(2 * u)}" fill="#d4af37" opacity="0.75"/>`);
    if (k === "futuristik")
      svg.push(`<rect x="0" y="${r2(yJudul + hBoxJ)}" width="${W}" height="${r2(2 * u)}" fill="#22d3ee" opacity="0.9"/>`);
    if (part) {
      const yLabel = H * 0.76;
      const fsL = 56 * u;
      const hL = fsL * 1.6;
      svg.push(`<rect x="0" y="${r2(yLabel)}" width="${W}" height="${r2(hL)}" fill="${gayaTeks.kotakL}" opacity="${gayaTeks.opL}"/>`);
      if (k === "futuristik")
        svg.push(`<rect x="0" y="${r2(yLabel - 2 * u)}" width="${W}" height="${r2(2 * u)}" fill="#e879f9" opacity="0.9"/>`);
      svg.push(
        `<text x="${W / 2}" y="${r2(yLabel + hL * 0.72)}" font-family="${FONT_COVER[gayaTeks.font].family}" font-size="${r2(fsL)}" font-weight="${FONT_COVER[gayaTeks.font].bobot}" fill="${gayaTeks.warnaL}" text-anchor="middle">${esc(part.toUpperCase())}</text>`,
      );
    }
    svg.push("</svg>");
    return svg.join("");
  }

  // ---------- template NOVACUT (port ncLayoutPass) ----------
  const pal = NOVACUT_PALETTES.find((p) => p.k === tpl.palet) ?? NOVACUT_PALETTES[0];
  const lay = tpl.layout ?? "impact";
  const fg = pal.fg;
  const acc = pal.acc;

  // defs gradien + glow
  svg.push(
    `<defs>` +
      `<linearGradient id="ncg1" x1="0" y1="0" x2="${lay === "side" ? 1 : 0}" y2="${lay === "side" ? 0 : 1}">` +
      `<stop offset="0" stop-color="${pal.bg1}"/><stop offset="1" stop-color="${pal.bg2}"/></linearGradient>` +
      `<linearGradient id="ncg2" x1="0" y1="0" x2="0" y2="1">` +
      `<stop offset="0" stop-color="black" stop-opacity="${r2(DARKEN[lay] * 0.7)}"/>` +
      `<stop offset="0.5" stop-color="black" stop-opacity="${r2(DARKEN[lay] * 0.25)}"/>` +
      `<stop offset="1" stop-color="black" stop-opacity="${r2(DARKEN[lay])}"/></linearGradient>` +
      `<radialGradient id="ncvig" cx="0.5" cy="0.5" r="0.65">` +
      `<stop offset="0" stop-color="#1e1e22" stop-opacity="0.35"/>` +
      `<stop offset="1" stop-color="#000000" stop-opacity="0"/></radialGradient>` +
      `<filter id="ncglow" x="-30%" y="-30%" width="160%" height="160%">` +
      `<feGaussianBlur stdDeviation="${r2(H * 0.014)}" result="b"/>` +
      `<feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>` +
      `</filter></defs>`,
  );

  // ===== FASE bg — latar + dekorasi =====
  if (o.latar === "hitam") {
    svg.push(`<rect width="${W}" height="${H}" fill="#000"/>`);
    svg.push(`<rect width="${W}" height="${H}" fill="url(#ncvig)"/>`);
  }
  svg.push(`<rect width="${W}" height="${H}" fill="url(#ncg2)"/>`); // scrim per layout (juga di adegan)
  if (lay === "lower") {
    svg.push(`<rect x="0" y="${r2(H * 0.68)}" width="${r2(W * 0.72)}" height="${r2(H * 0.24)}" fill="black" opacity="0.72"/>`);
    svg.push(`<rect x="0" y="${r2(H * 0.68)}" width="${r2(W * 0.012)}" height="${r2(H * 0.24)}" fill="${acc}"/>`);
  } else if (lay === "banner") {
    svg.push(`<rect x="0" y="0" width="${W}" height="${r2(H * 0.22)}" fill="url(#ncg1)"/>`);
    svg.push(`<rect x="0" y="${r2(H * 0.22)}" width="${W}" height="${r2(H * 0.012)}" fill="${acc}"/>`);
  } else if (lay === "side") {
    svg.push(`<g opacity="0.92"><rect x="0" y="0" width="${r2(W * 0.62)}" height="${H}" fill="url(#ncg1)"/></g>`);
    svg.push(`<rect x="0" y="0" width="${r2(W * 0.014)}" height="${H}" fill="${acc}"/>`);
  } else if (lay === "boxed") {
    svg.push(`<rect x="${r2(W * 0.09)}" y="${r2(H * 0.3)}" width="${r2(W * 0.82)}" height="${r2(H * 0.4)}" fill="none" stroke="${fg}" stroke-width="${r2(H * 0.006)}"/>`);
  } else if (lay === "neon") {
    svg.push(`<rect x="${r2(W * 0.06)}" y="${r2(H * 0.08)}" width="${r2(W * 0.88)}" height="${r2(H * 0.84)}" fill="none" stroke="${acc}" stroke-opacity="0.6" stroke-width="2"/>`);
  } else if (lay === "bars") {
    svg.push(`<rect x="0" y="0" width="${W}" height="${r2(H * 0.14)}" fill="black"/>`);
    svg.push(`<rect x="0" y="${r2(H * 0.86)}" width="${W}" height="${r2(H * 0.14)}" fill="black"/>`);
    for (let fx = W * 0.03; fx < W; fx += W * 0.09) {
      svg.push(`<rect x="${r2(fx)}" y="${r2(H * 0.055)}" width="${r2(W * 0.03)}" height="${r2(H * 0.03)}" fill="white" opacity="0.35"/>`);
      svg.push(`<rect x="${r2(fx)}" y="${r2(H * 0.915)}" width="${r2(W * 0.03)}" height="${r2(H * 0.03)}" fill="white" opacity="0.35"/>`);
    }
  } else if (lay === "band") {
    svg.push(
      `<g transform="rotate(-3.44 ${W / 2} ${H / 2})">` +
        `<rect x="${r2(-W * 0.6 + W / 2 - W / 2)}" y="${r2(H / 2 - H * 0.14)}" width="${r2(W * 1.2)}" height="${r2(H * 0.28)}" fill="url(#ncg1)" opacity="0.95"/>` +
        `<rect x="0" y="${r2(H / 2 - H * 0.14)}" width="${W}" height="${r2(H * 0.012)}" fill="${acc}"/>` +
        `<rect x="0" y="${r2(H / 2 + H * 0.128 - H * 0.012)}" width="${W}" height="${r2(H * 0.012)}" fill="${acc}"/>` +
        `</g>`,
    );
  }

  // ===== FASE title =====
  const teks = (
    b: string,
    x: number,
    y: number,
    font: KunciFontCover,
    fs: number,
    isi: string,
    opsi?: { isiWarna?: string; stroke?: string; strokeW?: number; isiOpacity?: number; glow?: boolean; bayangan?: boolean; anchor?: "start" | "middle" | "end" },
  ) => {
    const fam = FONT_COVER[font];
    const anchor = opsi?.anchor ?? "start";
    let warna = opsi?.isiWarna ?? fg;
    let extra = "";
    if (opsi?.bayangan) extra += ` style="paint-order:stroke" stroke="black" stroke-width="${r2(fs * 0.08)}" stroke-linejoin="round"`;
    if (opsi?.stroke) {
      // fill jangan ditulis dua kali — cukup ubah warna (layout outline raksasa)
      warna = "rgba(0,0,0,0.25)";
      extra = ` stroke="${opsi.stroke}" stroke-width="${r2(opsi.strokeW ?? H * 0.008)}"`;
    }
    svg.push(
      `<text x="${r2(x)}" y="${r2(y)}" font-family="${fam.family}" font-size="${r2(fs)}" font-weight="${fam.bobot}" fill="${warna}"${opsi?.isiOpacity !== undefined ? ` opacity="${opsi.isiOpacity}"` : ""}${extra}${opsi?.glow ? ` filter="url(#ncglow)"` : ""} text-anchor="${anchor}">${esc(isi)}</text>`,
    );
  };

  if (judul) {
    if (lay === "impact") {
      const ft = pasFitJudul(judul, "impact", H * 0.115, W * 0.84, 3, H * 0.024, ukur);
      const lh = ft.fs * (0.125 / 0.115);
      const startY = H / 2 - ((ft.baris.length - 1) * lh) / 2 + H * 0.03;
      ft.baris.forEach((b, i) => {
        const y = startY + i * lh;
        teks(b, W / 2 + H * 0.006, y + H * 0.006, "impact", ft.fs, b, { isiWarna: "#000000", anchor: "middle" });
        teks(b, W / 2, y, "impact", ft.fs, b, { anchor: "middle" });
      });
      svg.push(`<rect x="${r2(W / 2 - W * 0.08)}" y="${r2(startY + ft.baris.length * lh - lh * 0.48)}" width="${r2(W * 0.16)}" height="${r2(H * 0.012)}" fill="${acc}"/>`);
    } else if (lay === "lower") {
      const ft = pasFitJudul(judul, "impact", H * 0.085, W * 0.64, 2, H * 0.024, ukur);
      const lh = ft.fs * (0.095 / 0.085);
      ft.baris.forEach((b, i) => {
        const y = H * 0.79 + i * lh;
        teks(b, W * 0.04 + 3, y + 3, "impact", ft.fs, b, { isiWarna: "#000000" });
        teks(b, W * 0.04, y, "impact", ft.fs, b);
      });
    } else if (lay === "banner") {
      let ft = pasFitJudul(judul, "condensed", H * 0.1, W * 0.86, 1, H * 0.07, ukur);
      if (ft.baris.length > 1) ft = pasFitJudul(judul, "condensed", H * 0.062, W * 0.86, 3, H * 0.024, ukur);
      if (ft.baris.length > 1) {
        const lh = ft.fs * (0.08 / 0.062);
        ft.baris.forEach((b, i) => teks(b, W / 2, H * 0.095 + i * lh, "condensed", ft.fs, b.toUpperCase(), { anchor: "middle" }));
      } else teks(judul, W / 2, H * 0.15, "condensed", ft.fs, (ft.baris[0] || "").toUpperCase(), { anchor: "middle" });
    } else if (lay === "side") {
      const ft = pasFitJudul(judul, "impact", H * 0.095, W * 0.5, 3, H * 0.024, ukur);
      const lh = ft.fs * (0.11 / 0.095);
      ft.baris.forEach((b, i) => teks(b, W * 0.05, H * 0.42 + i * lh, "impact", ft.fs, b));
    } else if (lay === "boxed") {
      const ft = pasFitJudul(judul, "condensed", H * 0.09, W * 0.72, 3, H * 0.024, ukur);
      const lh = ft.fs * (0.105 / 0.09);
      ft.baris.forEach((b, i) =>
        teks(b, W / 2, H * 0.47 + (i - (ft.baris.length - 1) / 2) * lh, "condensed", ft.fs, b.toUpperCase(), { anchor: "middle" }),
      );
    } else if (lay === "neon") {
      const ft = pasFitJudul(judul, "display", H * 0.1, W * 0.8, 3, H * 0.024, ukur);
      const lh = ft.fs * 1.3;
      ft.baris.forEach((b, i) => {
        const y = H * 0.48 + (i - (ft.baris.length - 1) / 2) * lh;
        teks(b, W / 2, y, "display", ft.fs, b.toUpperCase(), { isiWarna: "#ffffff", glow: true, anchor: "middle" });
      });
    } else if (lay === "bars") {
      const ft = pasFitJudul(judul, "condensed", H * 0.075, W * 0.8, 3, H * 0.024, ukur);
      const lh = ft.fs * (0.085 / 0.075);
      ft.baris.forEach((b, i) =>
        teks(b, W / 2, H * 0.62 + (i - (ft.baris.length - 1) / 2) * lh, "condensed", ft.fs, b.toUpperCase(), { anchor: "middle" }),
      );
    } else if (lay === "sticker") {
      const ft = pasFitJudul(judul, "impact", H * 0.105, W * 0.8, 3, H * 0.024, ukur);
      const lh = ft.fs * (0.115 / 0.105);
      ft.baris.forEach((b, i) => {
        const y = H * 0.62 + (i - (ft.baris.length - 1) / 2) * lh;
        teks(b, W / 2 + 4, y + 4, "impact", ft.fs, b, { isiWarna: "#000000", anchor: "middle" });
        teks(b, W / 2, y, "impact", ft.fs, b, { anchor: "middle" });
      });
    } else if (lay === "outline") {
      const ft = pasFitJudul(judul.toUpperCase(), "impact", H * 0.17, W * 0.9, 3, H * 0.024, ukur);
      const lh = ft.fs;
      ft.baris.forEach((b, i) => {
        const y = H * 0.52 + (i - (ft.baris.length - 1) / 2) * lh;
        teks(b, W / 2, y, "impact", ft.fs, b, { stroke: fg, strokeW: H * 0.008, anchor: "middle" });
      });
    } else if (lay === "band") {
      const ft = pasFitJudul(judul, "condensed", H * 0.085, W * 0.84, 3, H * 0.024, ukur);
      const lh = ft.fs * (0.095 / 0.085);
      svg.push(`<g transform="rotate(-3.44 ${W / 2} ${H / 2})">`);
      ft.baris.forEach((b, i) =>
        teks(b, W / 2, (i - (ft.baris.length - 1) / 2) * lh + H * 0.032, "condensed", ft.fs, b.toUpperCase(), { anchor: "middle" }),
      );
      svg.push(`</g>`);
    }
  }

  // ===== FASE part (port fase part, semua ukuran × ps) =====
  if (part) {
    const badge = (px: number, py: number, size: number, align: "left" | "center" | "right") => {
      const tw = ukur.lebar(part.toUpperCase(), "condensed", size);
      const boxW = tw + size * 0.5 * 2;
      const boxH = size * 1.6;
      const bx = align === "center" ? px - boxW / 2 : align === "right" ? px - boxW : px;
      svg.push(`<rect x="${r2(bx)}" y="${r2(py)}" width="${r2(boxW)}" height="${r2(boxH)}" fill="${acc}"/>`);
      svg.push(
        `<text x="${r2(bx + size * 0.5)}" y="${r2(py + boxH / 2 + size * 0.04)}" font-family="${FONT_COVER.condensed.family}" font-size="${r2(size)}" font-weight="${FONT_COVER.condensed.bobot}" fill="#000" dominant-baseline="middle">${esc(part.toUpperCase())}</text>`,
      );
    };
    if (lay === "impact") badge(W / 2, H * 0.74, H * 0.032 * ps, "center");
    else if (lay === "lower") {
      const fs = H * 0.03 * ps;
      svg.push(
        `<text x="${r2(W * 0.04)}" y="${r2(H * 0.885)}" font-family="${FONT_COVER.sans.family}" font-size="${r2(fs)}" font-weight="${FONT_COVER.sans.bobot}" fill="${acc}">${esc(part.toUpperCase())}</text>`,
      );
    } else if (lay === "banner") badge(W / 2, H * 0.8, H * 0.032 * ps, "center");
    else if (lay === "side") {
      const fs = H * 0.028 * ps;
      svg.push(
        `<text x="${r2(W * 0.05)}" y="${r2(H * 0.42 - H * 0.06)}" font-family="${FONT_COVER.sans.family}" font-size="${r2(fs)}" font-weight="${FONT_COVER.sans.bobot}" fill="${acc}">${esc(part.toUpperCase())}</text>`,
      );
    } else if (lay === "boxed") {
      const fs = H * 0.026 * ps;
      const bw2 = Math.max(W * 0.32, ukur.lebar(part.toUpperCase(), "sans", fs) + fs * 2);
      svg.push(`<rect x="${r2(W / 2 - bw2 / 2)}" y="${r2(H * 0.28)}" width="${r2(bw2)}" height="${r2(H * 0.045 * ps)}" fill="${pal.bg1}"/>`);
      svg.push(
        `<text x="${W / 2}" y="${r2(H * 0.312 + H * 0.0225 * (ps - 1))}" font-family="${FONT_COVER.sans.family}" font-size="${r2(fs)}" font-weight="${FONT_COVER.sans.bobot}" fill="${acc}" text-anchor="middle" dominant-baseline="middle">${esc(part.toUpperCase())}</text>`,
      );
    } else if (lay === "neon") {
      const fs = H * 0.028 * ps;
      svg.push(
        `<text x="${W / 2}" y="${r2(H * 0.62)}" font-family="${FONT_COVER.sans.family}" font-size="${r2(fs)}" font-weight="${FONT_COVER.sans.bobot}" fill="#fff" text-anchor="middle">${esc(part.toUpperCase())}</text>`,
      );
    } else if (lay === "bars") {
      const fs = H * 0.024 * ps;
      svg.push(
        `<text x="${W / 2}" y="${r2(H * 0.8)}" font-family="${FONT_COVER.sans.family}" font-size="${r2(fs)}" font-weight="${FONT_COVER.sans.bobot}" fill="${acc}" text-anchor="middle">${esc(part.toUpperCase())}</text>`,
      );
    } else if (lay === "sticker") {
      const bw = W * 0.2 * ps, bh = H * 0.13 * ps;
      const fs = H * 0.032 * ps;
      svg.push(
        `<g transform="translate(${r2(W * 0.72)} ${r2(H * 0.24)}) rotate(-6.88)">` +
          `<rect x="${r2(-bw / 2)}" y="${r2(-bh / 2)}" width="${r2(bw)}" height="${r2(bh)}" rx="${r2(H * 0.02 * ps)}" fill="${acc}"/>` +
          `<text x="0" y="${r2(H * 0.012 * ps)}" font-family="${FONT_COVER.impact.family}" font-size="${r2(fs)}" font-weight="900" fill="#000" text-anchor="middle">${esc(part.toUpperCase().slice(0, 12))}</text></g>`,
      );
    } else if (lay === "outline") {
      const fs = H * 0.032 * ps;
      const sw2 = Math.max(W * 0.6, ukur.lebar(part.toUpperCase(), "impact", fs) + fs * 2);
      const sh2 = H * 0.05 * ps;
      svg.push(`<rect x="${r2(W / 2 - sw2 / 2)}" y="${r2(H * 0.725 - sh2 / 2)}" width="${r2(sw2)}" height="${r2(sh2)}" fill="${acc}"/>`);
      svg.push(
        `<text x="${W / 2}" y="${r2(H * 0.74 + (ps - 1) * H * 0.032 * 0.35)}" font-family="${FONT_COVER.impact.family}" font-size="${r2(fs)}" font-weight="900" fill="#000" text-anchor="middle">${esc(part.toUpperCase())}</text>`,
      );
    } else if (lay === "band") badge(W * 0.06, H * 0.78, H * 0.03 * ps, "left");
  }

  svg.push("</svg>");
  return svg.join("");
}

/** Data-URL SVG utk pratinjau client (img src) — murni */
export function svgCoverDataUrl(o: OpsiSvgCover, ukur: PengukurTeks): string {
  const b64 = typeof btoa !== "undefined"
    ? btoa(unescape(encodeURIComponent(svgCover(o, ukur))))
    : Buffer.from(svgCover(o, ukur), "utf8").toString("base64");
  return `data:image/svg+xml;base64,${b64}`;
}
