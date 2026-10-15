// VidSplit v0.50.0 — GENERATOR 6 FRAME SPESIAL IDOLA DESA (SVG → sharp → PNG)
// Dijalankan: bun scripts/buat-bingkai-spesial-v50.ts
//
// Permintaan user: tambah 6 frame khusus LAGI untuk IDOLA DESA bertema dangdut,
// dengan tulisan "IDOLA DESA" di bagian frame (referensi keluarga frame spesial
// v0.47–v0.49). Semua mengikuti pelajaran keluarga frame spesial:
//   • latar HANYA zona atas + pita bawah — TENGAH TRANSPARAN (video terlihat)
//   • teks besar puncaknya MENYENTUH garis bingkai atas (pelajaran v0.49)
//   • pita bawah bertuliskan "DANGDUT IDOLA DESA"
//   • tiap rasio punya varian sendiri: -916.png (1080×1920) & -169.png (1920×1080)
// Keluaran 12 PNG di public/bingkai/: dangdut-idola-desa-3..8-916.png / -169.png
//
// PENTING (temuan v0.50.0): font "Cinzel Decorative" & "DejaVu" WAJIB terpasang
// di fontconfig (folder ~/.fonts) sebelum render — sesi lama melewatkan ini
// sehingga frame v0.49 dirender dengan font fallback DejaVu Sans. Setelah
// font dipasang, script v49 juga dijalankan ulang agar 4 frame lamanya ikut
// ter-render dgn font aslinya.
import { mkdirSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const OUT = path.join(process.cwd(), "public", "bingkai");
mkdirSync(OUT, { recursive: true });

export interface Rasio {
  W: number;
  H: number;
  l: boolean;
  nama: string;
}
export const R916: Rasio = { W: 1080, H: 1920, l: false, nama: "916" };
export const R169: Rasio = { W: 1920, H: 1080, l: true, nama: "169" };

/* ============ HELPER GAMBAR (selaras buat-bingkai-spesial-v49) ============ */

/** Bintang kilau 4 titik */
export function star4(x: number, y: number, r: number, op = 1, fill = "#ffe9a8"): string {
  const k = (r * 0.16).toFixed(1);
  return (
    `<path transform="translate(${x.toFixed(1)} ${y.toFixed(1)})" fill="${fill}" opacity="${op}" ` +
    `d="M0 ${-r} C ${k} ${-k} ${k} ${-k} ${r} 0 C ${k} ${k} ${k} ${k} 0 ${r} C ${-k} ${k} ${-k} ${k} ${-r} 0 C ${-k} ${-k} ${-k} ${-k} 0 ${-r} Z"/>`
  );
}

/** Spiral ukiran utk sudut bingkai */
export function curl(x: number, y: number, s: number, rot: number, warna: string, sw = 3): string {
  const d =
    "M0 0 C -26 -4 -40 14 -30 30 C -22 42 -6 38 -6 26 C -6 18 -14 15 -19 21 " +
    "M0 0 C 6 -18 26 -26 44 -18 C 60 -11 62 8 50 12 C 41 15 35 7 40 0";
  return `<path transform="translate(${x} ${y}) rotate(${rot}) scale(${s})" fill="none" stroke="${warna}" stroke-width="${sw}" stroke-linecap="round" d="${d}"/>`;
}

/** Daun flourish utk sudut */
export function daun(x: number, y: number, s: number, rot: number, warna: string): string {
  const d = "M0 0 C 10 -6 22 -6 30 2 C 22 10 10 10 0 0 Z M0 0 C -10 -6 -22 -6 -30 2 C -22 10 -10 10 0 0 Z";
  return `<path transform="translate(${x} ${y}) rotate(${rot}) scale(${s})" fill="${warna}" opacity="0.9" d="${d}"/>`;
}

/** Bunga 5 kelopak (garland) — pusat bulat emas, kelopak warna bebas */
export function bunga(x: number, y: number, r: number, kelopak: string, pusat = "#fbbf24", op = 1): string {
  let s = "";
  for (let i = 0; i < 5; i++) {
    const a = (i * 72 - 90) * (Math.PI / 180);
    s += `<circle cx="${(Math.cos(a) * r * 0.85).toFixed(1)}" cy="${(Math.sin(a) * r * 0.85).toFixed(1)}" r="${(r * 0.62).toFixed(1)}" fill="${kelopak}" opacity="${op}"/>`;
  }
  s += `<circle cx="0" cy="0" r="${(r * 0.4).toFixed(1)}" fill="${pusat}" opacity="${op}"/>`;
  return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})">${s}</g>`;
}

/** Gong: tali + piringan ganda + pembosongan tengah (tema panggung dangdut) */
export function gong(x: number, y: number, r: number, s: number, garis: string): string {
  return (
    `<line x1="${x}" y1="${(y - r - 34 * s).toFixed(1)}" x2="${x}" y2="${(y - r).toFixed(1)}" stroke="${garis}" stroke-width="${(2.4 * s).toFixed(1)}" opacity="0.8"/>` +
    `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${garis}" stroke-width="${(5 * s).toFixed(1)}"/>` +
    `<circle cx="${x}" cy="${y}" r="${(r * 0.74).toFixed(1)}" fill="none" stroke="${garis}" stroke-width="${(2.2 * s).toFixed(1)}" opacity="0.85"/>` +
    `<circle cx="${x}" cy="${y}" r="${(r * 0.26).toFixed(1)}" fill="${garis}"/>` +
    `<circle cx="${x - r * 0.28}" cy="${y - r * 0.3}" r="${(r * 0.12).toFixed(1)}" fill="#fff7d6" opacity="0.65"/>`
  );
}

/** Kendang sederhana (barrel + tali silang + lace ujung) utk pita bawah */
export function kendang(x: number, y: number, len: number, rot: number, s: number, garis: string, isi: string): string {
  const w = len * 0.42;
  const lace = (cx: number) =>
    `<circle cx="${cx}" cy="0" r="${(w * 0.5).toFixed(1)}" fill="${isi}" stroke="${garis}" stroke-width="${(3 * s).toFixed(1)}"/>` +
    `<circle cx="${cx}" cy="0" r="${(w * 0.26).toFixed(1)}" fill="none" stroke="${garis}" stroke-width="${(1.8 * s).toFixed(1)}" opacity="0.8"/>`;
  let tali = "";
  for (let i = 1; i <= 4; i++) {
    const t = i / 5;
    const px = -len / 2 + len * t;
    tali += `<line x1="${px.toFixed(1)}" y1="${(-w * 0.52).toFixed(1)}" x2="${px.toFixed(1)}" y2="${(w * 0.52).toFixed(1)}" stroke="${garis}" stroke-width="${(1.6 * s).toFixed(1)}" opacity="0.6"/>`;
  }
  return (
    `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${rot})">` +
    `<path d="M ${-len / 2} 0 C ${-len / 2 + len * 0.18} ${-w * 0.62} ${len / 2 - len * 0.18} ${-w * 0.62} ${len / 2} 0 C ${len / 2 - len * 0.18} ${w * 0.62} ${-len / 2 + len * 0.18} ${w * 0.62} ${-len / 2} 0 Z" fill="${isi}" stroke="${garis}" stroke-width="${(3.4 * s).toFixed(1)}"/>` +
    tali + lace(-len / 2) + lace(len / 2) +
    `</g>`
  );
}

/* ===== kerangka teks — dipakai SEMUA desain agar seragam ===== */

/** Puncak huruf Cinzel Decorative Bold ≈ 0.70em di atas baseline.
 *  Baseline dihitung agar puncak huruf MENYENTUH garis bingkai atas
 *  (pelajaran v0.49: teks dinaikkan sampai mentok garis paling atas). */
const CAP = 0.7;

export function fsHero(l: boolean): number {
  return l ? 104 : 122;
}
export function baselineHero(l: boolean, s: number): number {
  return Math.round(fsHero(l) * CAP + 34 * s);
}

/** Teks besar "IDOLA DESA" (glow + isi gradient + stroke) — puncak menyentuh atas */
export function teksHero(
  W: number,
  l: boolean,
  s: number,
  idFill: string,
  idGlow: string,
  warnaGlow: string,
  stroke: string,
): { svg: string; baseline: number } {
  const fs = fsHero(l);
  const baseline = baselineHero(l, s);
  const svg =
    `<text x="${W / 2}" y="${baseline}" text-anchor="middle" font-family="Cinzel Decorative" font-weight="bold" font-size="${fs}" fill="${warnaGlow}" opacity="0.5" filter="url(#${idGlow})">IDOLA DESA</text>` +
    `<text x="${W / 2}" y="${baseline}" text-anchor="middle" font-family="Cinzel Decorative" font-weight="bold" font-size="${fs}" fill="url(#${idFill})" stroke="${stroke}" stroke-width="${(1.8 * s).toFixed(1)}">IDOLA DESA</text>`;
  return { svg, baseline };
}

/** Teks tema kecil di bawah hero: "★ LABEL ★" */
export function teksTema(
  W: number,
  baseline: number,
  l: boolean,
  s: number,
  label: string,
  warna: string,
  stroke: string,
): string {
  const fs = l ? 46 : 56;
  return `<text x="${W / 2}" y="${baseline}" text-anchor="middle" font-family="Cinzel Decorative" font-weight="bold" font-size="${fs}" fill="${warna}" stroke="${stroke}" stroke-width="${(1.1 * s).toFixed(1)}" letter-spacing="${(4 * s).toFixed(0)}"><tspan font-family="DejaVu Sans" font-weight="bold">★</tspan> ${label} <tspan font-family="DejaVu Sans" font-weight="bold">★</tspan></text>`;
}

/** Pembatas garis + wajik tengah */
export function pembatas(W: number, y: number, s: number, warna: string): string {
  const panjang = 250 * s;
  return (
    `<line x1="${W / 2 - panjang}" y1="${y}" x2="${W / 2 - 34 * s}" y2="${y}" stroke="${warna}" stroke-width="${(2.2 * s).toFixed(1)}"/>` +
    `<line x1="${W / 2 + 34 * s}" y1="${y}" x2="${W / 2 + panjang}" y2="${y}" stroke="${warna}" stroke-width="${(2.2 * s).toFixed(1)}"/>` +
    `<rect x="${W / 2 - 9 * s}" y="${y - 9 * s}" width="${18 * s}" height="${18 * s}" transform="rotate(45 ${W / 2} ${y})" fill="${warna}"/>`
  );
}

/** Pita bawah + teks "DANGDUT IDOLA DESA" + dua garis sisi + dua bintang */
export function pitaBawah(
  W: number,
  H: number,
  s: number,
  l: boolean,
  idBand: string,
  warnaTeks: string,
  warnaGaris: string,
): string {
  const fsBand = l ? 32 : 40;
  return (
    `<rect x="0" y="${H - 150 * s}" width="${W}" height="${150 * s}" fill="url(#${idBand})"/>` +
    `<line x1="${W * 0.13}" y1="${H - 62 * s}" x2="${W * 0.13 + 110 * s}" y2="${H - 62 * s}" stroke="${warnaGaris}" stroke-width="${(1.8 * s).toFixed(1)}"/>` +
    `<line x1="${W * 0.87}" y1="${H - 62 * s}" x2="${W * 0.87 - 110 * s}" y2="${H - 62 * s}" stroke="${warnaGaris}" stroke-width="${(1.8 * s).toFixed(1)}"/>` +
    `<text x="${W / 2}" y="${H - 50 * s}" text-anchor="middle" font-family="Cinzel Decorative" font-weight="bold" font-size="${fsBand}" fill="${warnaTeks}" letter-spacing="${(5 * s).toFixed(0)}">DANGDUT IDOLA DESA</text>` +
    star4(210 * s, H - 90 * s, 10 * s, 0.8, warnaGaris) +
    star4(W - 210 * s, H - 90 * s, 10 * s, 0.8, warnaGaris)
  );
}

/** Bingkai ganda + 4 curl sudut (kerangka keluarga spesial) */
export function bingkai(
  W: number,
  H: number,
  s: number,
  inset: number,
  rx: number,
  warnaUtama: string,
  warnaDalam: string,
  warnaCurl: string,
): string {
  return (
    `<rect x="${inset}" y="${inset}" width="${W - 2 * inset}" height="${H - 2 * inset}" rx="${rx}" fill="none" stroke="${warnaUtama}" stroke-width="${(4.2 * s).toFixed(1)}"/>` +
    `<rect x="${inset + 16 * s}" y="${inset + 16 * s}" width="${W - 2 * inset - 32 * s}" height="${H - 2 * inset - 32 * s}" rx="${(34 * s).toFixed(0)}" fill="none" stroke="${warnaDalam}" stroke-width="${(1.7 * s).toFixed(1)}" opacity="0.9"/>` +
    curl(inset + 34 * s, inset + 40 * s, 1.05 * s, 8, warnaCurl, 3) +
    curl(W - inset - 34 * s, inset + 40 * s, 1.05 * s, 82, warnaCurl, 3) +
    curl(W - inset - 34 * s, H - inset - 40 * s, 1.05 * s, 172, warnaCurl, 3) +
    curl(inset + 34 * s, H - inset - 40 * s, 1.05 * s, 262, warnaCurl, 3)
  );
}

/** Kolom payet tipis kiri & kanan (sisi, tidak menutup tengah) */
export function payetSisi(W: number, H: number, s: number, terang: string, redup: string): string {
  let out = "";
  const inset = 24 * s;
  for (const x of [inset + 36 * s, W - inset - 36 * s]) {
    for (let y = 440 * s; y <= H - 290 * s; y += 24 * s) {
      const hi = Math.round(y / (24 * s)) % 4 === 0;
      out += `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${(3.2 * s).toFixed(1)}" fill="${hi ? terang : redup}" opacity="${hi ? 0.95 : 0.65}"/>`;
    }
  }
  return out;
}

/* ============ DESEN 3 — GONG EMAS (maroon-emas, gong kembar) ============ */

export function svgGongEmas(r: Rasio): string {
  const { W, H, l } = r;
  const s = Math.min(W, H) / 1080;
  const inset = Math.round(24 * s);
  const rx = Math.round(46 * s);
  const zona = (l ? 400 : 480) * s;

  const hero = teksHero(W, l, s, "gEmas", "gGlow", "#ffcf6e", "#3a2504");
  const temaY = hero.baseline + (l ? 84 : 102);

  // gong kembar di bawah teks tema (masih dalam zona atas, tidak menutup tengah)
  const gongY = (l ? 330 : 372) * s;
  const gongR = (l ? 46 : 54) * s;
  const gongs =
    gong(W * (l ? 0.3 : 0.21), gongY, gongR, s, "#d9a637") +
    gong(W * (l ? 0.7 : 0.79), gongY, gongR, s, "#d9a637");

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<defs>` +
    `<linearGradient id="gAtas" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="#4d0b09" stop-opacity="0.98"/><stop offset="0.5" stop-color="#2b0505" stop-opacity="0.9"/><stop offset="1" stop-color="#1a0303" stop-opacity="0"/>` +
    `</linearGradient>` +
    `<radialGradient id="gHangat" cx="0.5" cy="0.5" r="0.5">` +
    `<stop offset="0" stop-color="#8a2a10" stop-opacity="0.8"/><stop offset="1" stop-color="#8a2a10" stop-opacity="0"/>` +
    `</radialGradient>` +
    `<linearGradient id="gEmas" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="#fff3b0"/><stop offset="0.3" stop-color="#ffd76b"/><stop offset="0.55" stop-color="#d9a637"/><stop offset="0.85" stop-color="#8a5a14"/><stop offset="1" stop-color="#c9962e"/>` +
    `</linearGradient>` +
    `<linearGradient id="gBand" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="#3d0707" stop-opacity="0"/><stop offset="0.45" stop-color="#3d0707" stop-opacity="0.9"/><stop offset="1" stop-color="#4d0b09" stop-opacity="0.96"/>` +
    `</linearGradient>` +
    `<filter id="gGlow" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="${(9 * s).toFixed(1)}"/></filter>` +
    `</defs>` +
    `<rect x="0" y="0" width="${W}" height="${zona.toFixed(0)}" fill="url(#gAtas)"/>` +
    `<ellipse cx="${W / 2}" cy="${(230 * s).toFixed(0)}" rx="${(W * 0.55).toFixed(0)}" ry="${(260 * s).toFixed(0)}" fill="url(#gHangat)"/>` +
    bingkai(W, H, s, inset, rx, "#d8ab4a", "#a97e2f", "#e3b95e") +
    gongs +
    hero.svg +
    teksTema(W, temaY, l, s, "GONG EMAS", "#ffcf6e", "#3a2504") +
    pembatas(W, temaY + (l ? 46 : 58), s, "#c9962e") +
    star4(150 * s, 300 * s, 14 * s, 0.9) +
    star4(W - 150 * s, 330 * s, 11 * s, 0.85) +
    star4(W - 120 * s, 140 * s, 10 * s, 0.75) +
    payetSisi(W, H, s, "#ffe08a", "#c69534") +
    pitaBawah(W, H, s, l, "gBand", "#e9c25f", "#c9962e") +
    `</svg>`
  );
}

/* ============ DESEN 4 — KENDANG RIA (hijau zamrud-emas) ============ */

export function svgKendangRia(r: Rasio): string {
  const { W, H, l } = r;
  const s = Math.min(W, H) / 1080;
  const inset = Math.round(24 * s);
  const rx = Math.round(46 * s);
  const zona = (l ? 400 : 480) * s;

  const hero = teksHero(W, l, s, "kEmas", "kGlow", "#fde68a", "#052e16");
  const temaY = hero.baseline + (l ? 84 : 102);

  // roset kawung (4 elips bersilang) di pojok zona atas
  const kawung = (cx: number, cy: number, sc: number, op: number) => {
    let g = `<g transform="translate(${cx.toFixed(0)} ${cy.toFixed(0)}) scale(${sc})" fill="none" stroke="#c9a227" stroke-width="2.4" opacity="${op}">`;
    for (let i = 0; i < 4; i++) {
      const a = (i * 90 + 45) * (Math.PI / 180);
      g += `<ellipse cx="${(Math.cos(a) * 16).toFixed(1)}" cy="${(Math.sin(a) * 16).toFixed(1)}" rx="9" ry="14" transform="rotate(${i * 90 + 45} ${(Math.cos(a) * 16).toFixed(1)} ${(Math.sin(a) * 16).toFixed(1)})"/>`;
    }
    g += `<circle cx="0" cy="0" r="4.5"/>`;
    return g + `</g>`;
  };
  const roset =
    kawung(110 * s, 340 * s, 1.5 * s, 0.5) +
    kawung(200 * s, 260 * s, 1.1 * s, 0.4) +
    kawung(W - 110 * s, 340 * s, 1.5 * s, 0.5) +
    kawung(W - 200 * s, 260 * s, 1.1 * s, 0.4);

  // pasangan kendang di pita bawah (kiri & kanan, condong ke tengah)
  const yK = H - 88 * s;
  const kendangs =
    kendang(W * (l ? 0.24 : 0.2), yK, 150 * s, l ? -16 : -20, s, "#e8bd5c", "#1d4a30") +
    kendang(W * (l ? 0.76 : 0.8), yK, 150 * s, l ? 16 : 20, s, "#e8bd5c", "#1d4a30");

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<defs>` +
    `<linearGradient id="kAtas" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="#062b1a" stop-opacity="0.98"/><stop offset="0.55" stop-color="#04160d" stop-opacity="0.92"/><stop offset="1" stop-color="#020a06" stop-opacity="0"/>` +
    `</linearGradient>` +
    `<radialGradient id="kHijau" cx="0.5" cy="0.5" r="0.5">` +
    `<stop offset="0" stop-color="#14532d" stop-opacity="0.85"/><stop offset="1" stop-color="#14532d" stop-opacity="0"/>` +
    `</radialGradient>` +
    `<linearGradient id="kEmas" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="#fef9c3"/><stop offset="0.32" stop-color="#fcd34d"/><stop offset="0.6" stop-color="#d99a26"/><stop offset="1" stop-color="#a16207"/>` +
    `</linearGradient>` +
    `<linearGradient id="kBand" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="#03130b" stop-opacity="0"/><stop offset="0.5" stop-color="#052e16" stop-opacity="0.9"/><stop offset="1" stop-color="#062b1a" stop-opacity="0.97"/>` +
    `</linearGradient>` +
    `<filter id="kGlow" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="${(9 * s).toFixed(1)}"/></filter>` +
    `</defs>` +
    `<rect x="0" y="0" width="${W}" height="${zona.toFixed(0)}" fill="url(#kAtas)"/>` +
    `<ellipse cx="${W / 2}" cy="${(230 * s).toFixed(0)}" rx="${(W * 0.55).toFixed(0)}" ry="${(260 * s).toFixed(0)}" fill="url(#kHijau)"/>` +
    bingkai(W, H, s, inset, rx, "#d9b45a", "#8a6a24", "#e8c76a") +
    roset +
    hero.svg +
    teksTema(W, temaY, l, s, "KENDANG RIA", "#fde68a", "#052e16") +
    pembatas(W, temaY + (l ? 46 : 58), s, "#c9a227") +
    star4(160 * s, 180 * s, 12 * s, 0.85, "#fef08a") +
    star4(W - 160 * s, 200 * s, 10 * s, 0.8, "#fef08a") +
    payetSisi(W, H, s, "#fde68a", "#a16207") +
    kendangs +
    pitaBawah(W, H, s, l, "kBand", "#fde68a", "#c9a227") +
    `</svg>`
  );
}

/* ============ DESEN 5 — TIRAI MERAH (velvet merah + rambut emas) ============ */

export function svgTiraiMerah(r: Rasio): string {
  const { W, H, l } = r;
  const s = Math.min(W, H) / 1080;
  const inset = Math.round(24 * s);
  const rx = Math.round(46 * s);
  const zona = (l ? 400 : 480) * s;

  const hero = teksHero(W, l, s, "tEmas", "tGlow", "#ffd76b", "#3d0404");
  const temaY = hero.baseline + (l ? 84 : 102);

  // dua tirai sudut: kipas lipatan dari pojok atas ke bawah (hanya zona atas)
  const tirai = (x0: number, flip: boolean) => {
    const dir = flip ? -1 : 1;
    const ujung = x0 + dir * (l ? 300 : 250) * s;
    const bawah = (l ? 330 : 380) * s;
    let d = `M ${x0} 0 L ${ujung} 0 Q ${ujung - dir * 30 * s} ${bawah * 0.55} ${ujung - dir * 74 * s} ${bawah} `;
    d += `Q ${x0 + dir * (l ? 90 : 70) * s} ${bawah * 0.72} ${x0 + dir * 6 * s} ${bawah * 0.34} Z`;
    const lipatan =
      `<path d="M ${x0 + dir * 40 * s} 0 Q ${x0 + dir * 60 * s} ${bawah * 0.4} ${x0 + dir * 34 * s} ${bawah * 0.86}" stroke="#a11212" stroke-width="${(3 * s).toFixed(1)}" fill="none" opacity="0.6"/>` +
      `<path d="M ${x0 + dir * 90 * s} 0 Q ${x0 + dir * 118 * s} ${bawah * 0.4} ${x0 + dir * 96 * s} ${bawah * 0.8}" stroke="#a11212" stroke-width="${(2.4 * s).toFixed(1)}" fill="none" opacity="0.45"/>`;
    // tali emas + renda di ujung tirai
    const tx = ujung - dir * 74 * s;
    const ty = bawah;
    const renda =
      `<line x1="${tx}" y1="${ty}" x2="${tx}" y2="${ty + 26 * s}" stroke="#e8bd5c" stroke-width="${(3 * s).toFixed(1)}"/>` +
      `<circle cx="${tx}" cy="${ty + 32 * s}" r="${(7 * s).toFixed(1)}" fill="#e8bd5c"/>`;
    return `<path d="${d}" fill="url(#tKain)" stroke="#e8bd5c" stroke-width="${(2 * s).toFixed(1)}"/>` + lipatan + renda;
  };

  // berkas sorot dari dua pojok (hanya zona atas)
  let berkas = "";
  for (const [x0, arah] of [[0, 1], [W, -1]] as [number, number][]) {
    berkas += `<path d="M ${x0} -20 L ${x0 + arah * 130 * s} -20 L ${x0 + arah * (l ? 620 : 480) * s} ${zona} L ${x0 + arah * (l ? 380 : 300) * s} ${zona} Z" fill="#ffcf6e" opacity="0.05"/>`;
  }

  // renda emas di tepi atas pita bawah (deretan segitiga)
  let rendaBawah = "";
  for (let x = 30 * s; x < W - 20 * s; x += 26 * s) {
    rendaBawah += `<path d="M ${x.toFixed(0)} ${(H - 150 * s).toFixed(0)} l ${13 * s} ${12 * s} l ${13 * s} ${-12 * s} Z" fill="#e8bd5c" opacity="0.55"/>`;
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<defs>` +
    `<linearGradient id="tAtas" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="#7f1d1d" stop-opacity="0.99"/><stop offset="0.5" stop-color="#450a0a" stop-opacity="0.95"/><stop offset="1" stop-color="#1f0303" stop-opacity="0"/>` +
    `</linearGradient>` +
    `<linearGradient id="tKain" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="#991b1b"/><stop offset="1" stop-color="#5c0e0e"/>` +
    `</linearGradient>` +
    `<linearGradient id="tEmas" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="#fff6c4"/><stop offset="0.3" stop-color="#ffdd7a"/><stop offset="0.55" stop-color="#dca93a"/><stop offset="1" stop-color="#a16207"/>` +
    `</linearGradient>` +
    `<linearGradient id="tBand" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="#450a0a" stop-opacity="0"/><stop offset="0.5" stop-color="#5c0e0e" stop-opacity="0.92"/><stop offset="1" stop-color="#7f1d1d" stop-opacity="0.97"/>` +
    `</linearGradient>` +
    `<filter id="tGlow" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="${(9 * s).toFixed(1)}"/></filter>` +
    `</defs>` +
    `<rect x="0" y="0" width="${W}" height="${zona.toFixed(0)}" fill="url(#tAtas)"/>` +
    berkas +
    bingkai(W, H, s, inset, rx, "#e8bd5c", "#8a5a14", "#e8bd5c") +
    tirai(inset + 4 * s, false) +
    tirai(W - inset - 4 * s, true) +
    hero.svg +
    teksTema(W, temaY, l, s, "TIRAI MERAH", "#ffe1a0", "#3d0404") +
    pembatas(W, temaY + (l ? 46 : 58), s, "#e8bd5c") +
    star4(W / 2 - (l ? 330 : 280) * s, 150 * s, 11 * s, 0.8) +
    star4(W / 2 + (l ? 330 : 280) * s, 170 * s, 9 * s, 0.75) +
    rendaBawah +
    pitaBawah(W, H, s, l, "tBand", "#ffe1a0", "#e8bd5c") +
    `</svg>`
  );
}

/* ============ DESEN 6 — PAYET DISCO (ungu-magenta, lampu marquee) ============ */

export function svgPayetDisco(r: Rasio): string {
  const { W, H, l } = r;
  const s = Math.min(W, H) / 1080;
  const inset = Math.round(24 * s);
  const rx = Math.round(46 * s);
  const zona = (l ? 410 : 490) * s;

  const hero = teksHero(W, l, s, "pEmas", "pGlow", "#f0abfc", "#3b0764");
  const temaY = hero.baseline + (l ? 84 : 102);

  // lampu marquee sepanjang dalam bingkai atas
  let lampu = "";
  const yL = inset + 20 * s;
  let i = 0;
  for (let x = 100 * s; x <= W - 100 * s; x += (l ? 46 : 36) * s) {
    const terang = i % 2 === 0;
    i++;
    lampu +=
      `<circle cx="${x.toFixed(0)}" cy="${yL.toFixed(0)}" r="${(9 * s).toFixed(1)}" fill="${terang ? "#f0abfc" : "#fbbf24"}" opacity="${terang ? 0.3 : 0.16}"/>` +
      `<circle cx="${x.toFixed(0)}" cy="${yL.toFixed(0)}" r="${(4.4 * s).toFixed(1)}" fill="${terang ? "#fdf4ff" : "#fbbf24"}"/>`;
  }

  // kolom payet wajik kiri & kanan (sisi)
  let payet = "";
  for (const x of [inset + 38 * s, W - inset - 38 * s]) {
    let j = 0;
    for (let y = 440 * s; y <= H - 300 * s; y += 26 * s) {
      const warna = ["#f0abfc", "#e879f9", "#fbbf24"][j % 3];
      const op = j % 4 === 0 ? 0.85 : 0.45;
      j++;
      payet += `<rect x="${(x - 6 * s).toFixed(1)}" y="${(y - 6 * s).toFixed(1)}" width="${(12 * s).toFixed(1)}" height="${(12 * s).toFixed(1)}" transform="rotate(45 ${x.toFixed(0)} ${y.toFixed(0)})" fill="${warna}" opacity="${op}"/>`;
    }
  }

  // bokeh disco
  let bokeh = "";
  const bh: [number, number, number, number][] = l
    ? [[240, 330, 15, 0.25], [1680, 350, 17, 0.22], [960, 190, 8, 0.3], [420, 950, 10, 0.18], [1500, 940, 11, 0.18]]
    : [[170, 400, 15, 0.25], [910, 370, 17, 0.22], [540, 240, 8, 0.3], [90, H - 210, 10, 0.18], [1015, H - 230, 11, 0.18]];
  for (const [x, y, rr, op] of bh) bokeh += `<circle cx="${x * s}" cy="${y * s}" r="${(rr * s).toFixed(1)}" fill="#e879f9" opacity="${op}" filter="url(#pBokeh)"/>`;

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<defs>` +
    `<linearGradient id="pAtas" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="#3b0764" stop-opacity="0.99"/><stop offset="0.5" stop-color="#6b21a8" stop-opacity="0.93"/><stop offset="1" stop-color="#2e0a4f" stop-opacity="0"/>` +
    `</linearGradient>` +
    `<radialGradient id="pDisco" cx="0.5" cy="0.5" r="0.5">` +
    `<stop offset="0" stop-color="#ec4899" stop-opacity="0.4"/><stop offset="1" stop-color="#ec4899" stop-opacity="0"/>` +
    `</radialGradient>` +
    `<linearGradient id="pEmas" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="#fff7ed"/><stop offset="0.35" stop-color="#fbcfe8"/><stop offset="0.62" stop-color="#f0abfc"/><stop offset="1" stop-color="#fbbf24"/>` +
    `</linearGradient>` +
    `<linearGradient id="pBand" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="#2e0a4f" stop-opacity="0"/><stop offset="0.5" stop-color="#3b0764" stop-opacity="0.9"/><stop offset="1" stop-color="#4c1d95" stop-opacity="0.97"/>` +
    `</linearGradient>` +
    `<filter id="pGlow" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="${(10 * s).toFixed(1)}"/></filter>` +
    `<filter id="pBokeh" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="${(5 * s).toFixed(1)}"/></filter>` +
    `</defs>` +
    `<rect x="0" y="0" width="${W}" height="${zona.toFixed(0)}" fill="url(#pAtas)"/>` +
    `<ellipse cx="${W / 2}" cy="${(240 * s).toFixed(0)}" rx="${(W * 0.55).toFixed(0)}" ry="${(270 * s).toFixed(0)}" fill="url(#pDisco)"/>` +
    bingkai(W, H, s, inset, rx, "#f0abfc", "#9d5bb5", "#fbbf24") +
    lampu +
    bokeh +
    hero.svg +
    teksTema(W, temaY, l, s, "PAYET DISCO", "#fbcfe8", "#3b0764") +
    pembatas(W, temaY + (l ? 46 : 58), s, "#e879f9") +
    payet +
    pitaBawah(W, H, s, l, "pBand", "#fbcfe8", "#e879f9") +
    `</svg>`
  );
}

/* ============ DESEN 7 — BATIK MEGA (teal-krem, gelombang megamendung) ============ */

export function svgBatikMega(r: Rasio): string {
  const { W, H, l } = r;
  const s = Math.min(W, H) / 1080;
  const inset = Math.round(24 * s);
  const rx = Math.round(46 * s);
  const zona = (l ? 400 : 480) * s;

  const hero = teksHero(W, l, s, "bKrem", "bGlow", "#fef3c7", "#134e4a");
  const temaY = hero.baseline + (l ? 84 : 102);

  // satu pita gelombang megamendung: deretan busur runcing selebar frame
  const gelombang = (y0: number, tinggi: number, warna: string, op: number) => {
    const periode = 90 * s;
    let d = `M -20 ${y0} `;
    for (let x = -20; x < W + periode; x += periode) {
      d += `q ${periode / 2} ${-tinggi} ${periode} 0 `;
    }
    d += `L ${W + 40} ${y0 + tinggi * 0.9} L -20 ${y0 + tinggi * 0.9} Z`;
    return `<path d="${d}" fill="${warna}" opacity="${op}"/>`;
  };
  // awan megamendung di dasar zona atas + cermin di atas pita bawah
  const megaAtas =
    gelombang(zona - 6 * s, 44 * s, "#fef3c7", 0.42) +
    gelombang(zona - 30 * s, 40 * s, "#fde68a", 0.28) +
    gelombang(zona - 52 * s, 36 * s, "#fde68a", 0.16);
  const megaBawah =
    gelombang(H - 150 * s + 4 * s, 34 * s, "#fef3c7", 0.3) +
    gelombang(H - 150 * s - 16 * s, 30 * s, "#fde68a", 0.16);

  // titik isen di pojok zona atas
  const isen = (cx: number, cy: number) =>
    [0, 1, 2].map((i) => `<circle cx="${(cx + i * 16 * s).toFixed(0)}" cy="${cy.toFixed(0)}" r="${(3 * s).toFixed(1)}" fill="#fde68a" opacity="${0.55 - i * 0.15}"/>`).join("");
  const titik = isen(90 * s, 200 * s) + isen(W - 140 * s, 230 * s) + isen(120 * s, 250 * s);

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<defs>` +
    `<linearGradient id="bAtas" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="#134e4a" stop-opacity="0.99"/><stop offset="0.5" stop-color="#115e59" stop-opacity="0.94"/><stop offset="1" stop-color="#042f2e" stop-opacity="0"/>` +
    `</linearGradient>` +
    `<linearGradient id="bKrem" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="#fffbeb"/><stop offset="0.4" stop-color="#fef3c7"/><stop offset="0.75" stop-color="#fcd34d"/><stop offset="1" stop-color="#d97706"/>` +
    `</linearGradient>` +
    `<linearGradient id="bBand" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="#042f2e" stop-opacity="0"/><stop offset="0.5" stop-color="#134e4a" stop-opacity="0.92"/><stop offset="1" stop-color="#115e59" stop-opacity="0.97"/>` +
    `</linearGradient>` +
    `<filter id="bGlow" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="${(9 * s).toFixed(1)}"/></filter>` +
    `</defs>` +
    `<rect x="0" y="0" width="${W}" height="${zona.toFixed(0)}" fill="url(#bAtas)"/>` +
    bingkai(W, H, s, inset, rx, "#fde68a", "#a8892e", "#fde68a") +
    daun(inset + 96 * s, inset + 30 * s, 1.1 * s, -8, "#a8892e") +
    daun(W - inset - 96 * s, inset + 30 * s, 1.1 * s, 8, "#a8892e") +
    titik +
    hero.svg +
    teksTema(W, temaY, l, s, "BATIK MEGA", "#fef3c7", "#134e4a") +
    pembatas(W, temaY + (l ? 46 : 58), s, "#fcd34d") +
    megaAtas +
    megaBawah +
    pitaBawah(W, H, s, l, "bBand", "#fef3c7", "#fcd34d") +
    `</svg>`
  );
}

/* ============ DESEN 8 — BUNGA RAMPAK (rose-krem, untaian bunga) ============ */

export function svgBungaRampak(r: Rasio): string {
  const { W, H, l } = r;
  const s = Math.min(W, H) / 1080;
  const inset = Math.round(24 * s);
  const rx = Math.round(46 * s);
  const zona = (l ? 410 : 490) * s;

  const hero = teksHero(W, l, s, "uKrem", "uGlow", "#fbcfe8", "#4c0519");
  const temaY = hero.baseline + (l ? 84 : 102);

  // untaian bunga di sepanjang dalam bingkai atas + bawah
  const untaian = (y: number, langkah: number) => {
    let out = "";
    let i = 0;
    for (let x = 90 * s; x <= W - 90 * s; x += langkah) {
      const yy = y + (i % 2 === 0 ? 8 : -8) * s;
      if (i % 3 === 2) {
        out += `<g transform="translate(${x.toFixed(0)} ${yy.toFixed(0)}) rotate(${i % 2 === 0 ? -40 : 40})"><path d="M0 0 C 10 -6 22 -6 30 2 C 22 10 10 10 0 0 Z" fill="#4ade80" opacity="0.5" transform="scale(${(1.1 * s).toFixed(2)})"/></g>`;
      } else {
        out += bunga(x, yy, 13 * s, i % 2 === 0 ? "#fce7f3" : "#f9a8d4", "#fbbf24", 0.9);
      }
      i++;
    }
    return out;
  };

  // kelopak bertaburan di zona atas
  let kelopak = "";
  const kp: [number, number, number][] = l
    ? [[300, 300, -20], [1620, 260, 30], [960, 330, 10], [500, 200, -35], [1400, 210, 20]]
    : [[200, 330, -20], [880, 300, 30], [540, 250, 10], [760, 350, -35], [320, 220, 20], [1000, 200, 40]];
  for (const [x, y, rot] of kp) {
    kelopak += `<ellipse cx="${x * s}" cy="${y * s}" rx="${(10 * s).toFixed(1)}" ry="${(5 * s).toFixed(1)}" transform="rotate(${rot} ${(x * s).toFixed(0)} ${(y * s).toFixed(0)})" fill="#f9a8d4" opacity="0.5"/>`;
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<defs>` +
    `<linearGradient id="uAtas" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="#500724" stop-opacity="0.99"/><stop offset="0.5" stop-color="#831843" stop-opacity="0.9"/><stop offset="1" stop-color="#2b0413" stop-opacity="0"/>` +
    `</linearGradient>` +
    `<radialGradient id="uRose" cx="0.5" cy="0.5" r="0.5">` +
    `<stop offset="0" stop-color="#be185d" stop-opacity="0.5"/><stop offset="1" stop-color="#be185d" stop-opacity="0"/>` +
    `</radialGradient>` +
    `<linearGradient id="uKrem" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="#fff1f2"/><stop offset="0.4" stop-color="#fce7f3"/><stop offset="0.7" stop-color="#f9a8d4"/><stop offset="1" stop-color="#fda4af"/>` +
    `</linearGradient>` +
    `<linearGradient id="uBand" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="#2b0413" stop-opacity="0"/><stop offset="0.5" stop-color="#500724" stop-opacity="0.9"/><stop offset="1" stop-color="#831843" stop-opacity="0.97"/>` +
    `</linearGradient>` +
    `<filter id="uGlow" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="${(10 * s).toFixed(1)}"/></filter>` +
    `</defs>` +
    `<rect x="0" y="0" width="${W}" height="${zona.toFixed(0)}" fill="url(#uAtas)"/>` +
    `<ellipse cx="${W / 2}" cy="${(240 * s).toFixed(0)}" rx="${(W * 0.55).toFixed(0)}" ry="${(265 * s).toFixed(0)}" fill="url(#uRose)"/>` +
    bingkai(W, H, s, inset, rx, "#fbcfe8", "#be6b9a", "#fde68a") +
    untaian(inset + 26 * s, l ? 84 : 74) +
    kelopak +
    hero.svg +
    teksTema(W, temaY, l, s, "BUNGA RAMPAK", "#fce7f3", "#4c0519") +
    pembatas(W, temaY + (l ? 46 : 58), s, "#f9a8d4") +
    pitaBawah(W, H, s, l, "uBand", "#fce7f3", "#f9a8d4") +
    bunga(150 * s, H - 84 * s, 12 * s, "#fce7f3", "#fbbf24", 0.85) +
    bunga(W - 150 * s, H - 84 * s, 12 * s, "#fce7f3", "#fbbf24", 0.85) +
    `</svg>`
  );
}

/* ============ RENDER SEMUA ============ */

async function render(nama: string, svg: string) {
  const tujuan = path.join(OUT, nama);
  await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(tujuan);
  console.log("✓", nama);
}

const daftar: [string, (r: Rasio) => string][] = [
  ["dangdut-idola-desa-3", svgGongEmas],
  ["dangdut-idola-desa-4", svgKendangRia],
  ["dangdut-idola-desa-5", svgTiraiMerah],
  ["dangdut-idola-desa-6", svgPayetDisco],
  ["dangdut-idola-desa-7", svgBatikMega],
  ["dangdut-idola-desa-8", svgBungaRampak],
];

for (const [slug, fn] of daftar) {
  await render(`${slug}-916.png`, fn(R916));
  await render(`${slug}-169.png`, fn(R169));
}
console.log("SELESAI →", OUT);
