// VidSplit v0.57.0 — GENERATOR 10 FRAME HOROR "ALAM GAIB" BARU (SVG → sharp → PNG)
// Dijalankan: bun scripts/buat-bingkai-spesial-v56.ts
//
// Permintaan user: tambah 10 frame LAGI bertema horor hantu (pocong, kuntilanak,
// & seram lainnya) — tulisan di atas frame HANYA "ALAM GAIB" (tanpa nama desain).
//
// Mengikuti keluarga v0.52/v0.54 (helper diimpor dari buat-bingkai-spesial-v52.ts):
//   • latar HANYA zona atas + pita bawah — TENGAH TRANSPARAN (video terlihat)
//   • teks "ALAM GAIB" puncaknya MENYENTUH garis bingkai atas (Creepster)
//   • TANPA teks nama desain di mana pun (uji piksel strip tema ≤100 terang)
//   • bingkai dobel TIPIS + hiasan sisi ≤ ±11% lebar (strip 13–87% kosong)
//   • tiap rasio varian sendiri: -916.png (1080×1920) & -169.png (1920×1080)
// Keluaran 20 PNG di public/bingkai/: horor-alam-gaib-10..19-916.png / -169.png
import path from "node:path";
import sharp from "sharp";
import {
  R916,
  R169,
  type Rasio,
  teksAlamGaib,
  pembatas,
  bingkaiTipis,
  pitaBawahHoror,
  kelelawar,
  arwah,
  tengkorak,
  mataNyala,
  salib,
  nisan,
  api,
  star4,
  fsHero,
} from "./buat-bingkai-spesial-v52";

const OUT = path.join(process.cwd(), "public", "bingkai");

/* ==================== HELPER ELEMEN HOROR v0.57 ==================== */

/** POCONG — kain kafan putih + tali pengikat 3 tingkat + wajah gelap.
 *  Lebar ±88, tinggi ±118 (skala bebas). */
export function pocong(
  x: number,
  y: number,
  sc: number,
  flip = false,
  kain = "#e9e7df",
  tali = "#b4ac9a",
  op = 1,
): string {
  const gelap = "#0a0a0c";
  return (
    `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${flip ? -sc : sc} ${sc})" opacity="${op}">` +
    // badan kafun (kapsul)
    `<path d="M0 -59 C -34 -59 -44 -44 -44 -26 L -44 34 C -44 50 -34 59 0 59 C 34 59 44 50 44 34 L 44 -26 C 44 -44 34 -59 0 -59 Z" fill="${kain}" stroke="#8f8878" stroke-width="2"/>` +
    // lipatan kain halus
    `<path d="M -30 -50 C -34 -20 -34 20 -30 50 M 30 -50 C 34 -20 34 20 30 50 M -16 -55 C -18 -18 -18 22 -16 55" stroke="#cfc9ba" stroke-width="1.6" fill="none" opacity="0.65"/>` +
    // wajah gelap mengintip (celah kain)
    `<ellipse cx="0" cy="-34" rx="15" ry="19" fill="${gelap}"/>` +
    `<ellipse cx="-5.5" cy="-38" rx="3.2" ry="4.6" fill="#ff2e3e"/>` +
    `<ellipse cx="5.5" cy="-38" rx="3.2" ry="4.6" fill="#ff2e3e"/>` +
    `<ellipse cx="0" cy="-26" rx="4" ry="6" fill="#1a1418"/>` +
    // tali pengikat 3 tingkat + simpul sisi
    `<rect x="-45" y="-46" width="90" height="7" rx="3.4" fill="${tali}"/>` +
    `<rect x="-45" y="-4" width="90" height="7" rx="3.4" fill="${tali}"/>` +
    `<rect x="-45" y="40" width="90" height="7" rx="3.4" fill="${tali}"/>` +
    `<circle cx="46" cy="-42.5" r="4.6" fill="${tali}"/>` +
    `<circle cx="46" cy="-0.5" r="4.6" fill="${tali}"/>` +
    `<circle cx="46" cy="43.5" r="4.6" fill="${tali}"/>` +
    `</g>`
  );
}

/** KUNTILANAK — gaun putih memanjang + rambut hitam panjang + mata merah.
 *  Lebar ±64, tinggi ±120 (skala bebas). */
export function kuntilanak(
  x: number,
  y: number,
  sc: number,
  flip = false,
  gaun = "#e9eaf0",
  rambut = "#0b0a0e",
  op = 1,
): string {
  return (
    `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${flip ? -sc : sc} ${sc})" opacity="${op}">` +
    // tirai rambut belakang (lebih lebar dr badan)
    `<path d="M0 -62 C -30 -58 -34 -30 -32 0 C -31 26 -30 48 -26 62 L 26 62 C 30 48 31 26 32 0 C 34 -30 30 -58 0 -62 Z" fill="${rambut}"/>` +
    // gaun A-line
    `<path d="M -12 -30 C -26 -4 -30 28 -27 62 L 27 62 C 30 28 26 -4 12 -30 C 7 -38 -7 -38 -12 -30 Z" fill="${gaun}" opacity="0.94"/>` +
    `<path d="M -8 6 L 8 6 M -10 26 L 10 26 M -11 44 L 11 44" stroke="#b9bccb" stroke-width="1.6" opacity="0.7"/>` +
    // wajah pucat di balik rambut depan
    `<ellipse cx="0" cy="-45" rx="12.5" ry="14.5" fill="#d8d4d2"/>` +
    // rambut depan membelah
    `<path d="M -13 -52 C -15 -40 -14 -30 -11 -22 L -7 -34 C -10 -40 -11 -47 -9 -53 Z" fill="${rambut}"/>` +
    `<path d="M 13 -52 C 15 -40 14 -30 11 -22 L 7 -34 C 10 -40 11 -47 9 -53 Z" fill="${rambut}"/>` +
    `<path d="M0 -60 C -12 -60 -14 -52 -13 -48 C -8 -54 8 -54 13 -48 C 14 -52 12 -60 0 -60 Z" fill="${rambut}"/>` +
    // mata merah menyala
    `<ellipse cx="-4.6" cy="-46" rx="2.1" ry="3" fill="#ff2e3e"/>` +
    `<ellipse cx="4.6" cy="-46" rx="2.1" ry="3" fill="#ff2e3e"/>` +
    `</g>`
  );
}

/** WAJAH HANTU PUCAT (mata cekung, mulut menganga) — lebar ±52, tinggi ±68. */
export function wajahHantu(x: number, y: number, sc: number, miring = 0, op = 1): string {
  const pucat = "#c9cdd6";
  const cekung = "#10131c";
  return (
    `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${miring}) scale(${sc})" opacity="${op}">` +
    `<ellipse cx="0" cy="0" rx="26" ry="34" fill="${pucat}"/>` +
    `<ellipse cx="0" cy="0" rx="26" ry="34" fill="none" stroke="#8f96a4" stroke-width="1.6" opacity="0.7"/>` +
    `<ellipse cx="-9.5" cy="-8" rx="6" ry="8.5" fill="${cekung}"/>` +
    `<ellipse cx="9.5" cy="-8" rx="6" ry="8.5" fill="${cekung}"/>` +
    `<circle cx="-9.5" cy="-6" r="2.2" fill="#b9ffcf" opacity="0.9"/>` +
    `<circle cx="9.5" cy="-6" r="2.2" fill="#b9ffcf" opacity="0.9"/>` +
    `<ellipse cx="0" cy="14" rx="6.5" ry="10" fill="${cekung}"/>` +
    `</g>`
  );
}

/** LILIN tidak = badan + sumbu + api (pakai api() dari v52) */
export function lilin(x: number, y: number, sc: number, badan = "#efe3c2", op = 1): string {
  return (
    `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${sc})" opacity="${op}">` +
    `<rect x="-7" y="-30" width="14" height="30" rx="2.4" fill="${badan}"/>` +
    `<path d="M -7 -18 L 7 -14 M -7 -8 L 7 -4" stroke="#d9c9a0" stroke-width="1.4" opacity="0.8"/>` +
    `<line x1="0" y1="-30" x2="0" y2="-35" stroke="#3a3128" stroke-width="1.8"/>` +
    api(0, -34, 11, 24) +
    `<circle cx="0" cy="-52" r="7" fill="#ffd76b" opacity="0.16"/>` +
    `</g>`
  );
}

/** Tali/rambut gantung sisi TIPIS: garis vertikal + simpul kecil bergantian */
export function taliSisi(x: number, y1: number, y2: number, langkah: number, warna: string, s: number): string {
  let out = `<line x1="${x.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${warna}" stroke-width="${(1.7 * s).toFixed(1)}" opacity="0.75"/>`;
  let i = 0;
  for (let y = y1 + langkah * 0.5; y <= y2; y += langkah) {
    out += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${((i % 2 === 0 ? 3.4 : 2.4) * s).toFixed(1)}" fill="${warna}" opacity="${i % 2 === 0 ? 0.85 : 0.55}"/>`;
    i++;
  }
  return out;
}

/** Rambut rontok sisi TIPIS: helai lengkung pendek berjajar */
export function rambutSisi(x: number, y1: number, y2: number, langkah: number, warna: string, s: number, flip = false): string {
  let out = "";
  let i = 0;
  for (let y = y1; y <= y2; y += langkah) {
    const dir = (i % 2 === 0 ? 1 : -1) * (flip ? -1 : 1);
    out +=
      `<path d="M ${x.toFixed(1)} ${y.toFixed(1)} q ${(dir * 8 * s).toFixed(1)} ${(langkah * 0.35).toFixed(1)} ${(dir * 3 * s).toFixed(1)} ${(langkah * 0.8).toFixed(1)}" ` +
      `fill="none" stroke="${warna}" stroke-width="${(2.4 * s).toFixed(1)}" stroke-linecap="round" opacity="0.8"/>`;
    i++;
  }
  return out;
}

/** Kabut gulungan (ellips blur) — butuh filter blur id di defs */
export function kabutGulung(cx: number, cy: number, rx: number, ry: number, warna: string, op: number, idBlur: string): string {
  return `<ellipse cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" rx="${rx.toFixed(0)}" ry="${ry.toFixed(0)}" fill="${warna}" opacity="${op}" filter="url(#${idBlur})"/>`;
}

/* ============ KERANGKA BERSAMA (identik keluarga v52) ============ */

interface Dasar {
  W: number;
  H: number;
  l: boolean;
  s: number;
  inset: number;
  rx: number;
  zona: number;
}

function dasar(r: Rasio): Dasar {
  const { W, H, l } = r;
  const s = Math.min(W, H) / 1080;
  return {
    W,
    H,
    l,
    s,
    inset: Math.round(22 * s),
    rx: Math.round(40 * s),
    zona: (l ? 400 : 480) * s,
  };
}

/** Sisa svg (definisi→penutup) dgn struktur seragam keluarga ALAM GAIB */
function kumpulkan(
  d: Dasar,
  defs: string,
  isiZona: string,
  idFill: string,
  idGlow: string,
  warnaGlow: string,
  stroke: string,
  warnaBingkai: string,
  warnaBingkai2: string,
  warnaPembatas: string,
  idBand: string,
  warnaBand: string,
  ornamenPitaKiri = "",
  ornamenPitaKanan = "",
): string {
  const { W, H, l, s, inset, rx, zona } = d;
  const hero = teksAlamGaib(W, l, s, idFill, idGlow, warnaGlow, stroke);
  const pembatasY = hero.baseline + (l ? 84 : 102);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<defs>${defs}</defs>` +
    `<rect x="0" y="0" width="${W}" height="${zona.toFixed(0)}" fill="url(#${idBand ? idBand.replace("Band", "Atas") : ""})"/>` +
    `<ellipse cx="${W / 2}" cy="${(235 * s).toFixed(0)}" rx="${(W * 0.53).toFixed(0)}" ry="${(275 * s).toFixed(0)}" fill="url(#${idGlow ? idGlow + "Latar" : ""})"/>` +
    bingkaiTipis(W, H, s, inset, rx, warnaBingkai, warnaBingkai2) +
    isiZona +
    hero.svg +
    pembatas(W, pembatasY, s, warnaPembatas) +
    pitaBawahHoror(W, H, s, l, idBand, warnaBand, ornamenPitaKiri, ornamenPitaKanan) +
    `</svg>`
  );
}

/* ============ DESEN 10 — POCONG MENGAPIT (abu kubur) ============ */

export function svgHoror10(r: Rasio): string {
  const d = dasar(r);
  const { W, H, l, s, inset, zona } = d;
  const pasang =
    pocong((l ? 300 : 172) * s, (l ? 240 : 285) * s, (l ? 1.05 : 1.15) * s, false) +
    pocong(W - (l ? 300 : 172) * s, (l ? 250 : 295) * s, (l ? 1.05 : 1.15) * s, true);
  const kabut =
    kabutGulung(W * 0.28, zona - 40 * s, 320 * s, 42 * s, "#c9c5ba", 0.12, "h10Kabut") +
    kabutGulung(W * 0.72, zona - 22 * s, 300 * s, 38 * s, "#c9c5ba", 0.1, "h10Kabut");
  const sisi = taliSisi(52 * s, zona + 26 * s, H - 220 * s, 44 * s, "#b4ac9a", s) +
    taliSisi(W - 52 * s, zona + 26 * s, H - 220 * s, 44 * s, "#b4ac9a", s);
  return kumpulkan(
    d,
    `<linearGradient id="h10Atas" x1="0" y1="0" x2="0" y2="1">` +
      `<stop offset="0" stop-color="#191817" stop-opacity="0.99"/><stop offset="0.55" stop-color="#100f0e" stop-opacity="0.93"/><stop offset="1" stop-color="#060605" stop-opacity="0"/>` +
      `</linearGradient>` +
      `<radialGradient id="h10GlowLatar" cx="0.5" cy="0.5" r="0.5">` +
      `<stop offset="0" stop-color="#5a564c" stop-opacity="0.55"/><stop offset="1" stop-color="#5a564c" stop-opacity="0"/>` +
      `</radialGradient>` +
      `<linearGradient id="gKain" x1="0" y1="0" x2="0" y2="1">` +
      `<stop offset="0" stop-color="#ffffff"/><stop offset="0.45" stop-color="#efece2"/><stop offset="0.78" stop-color="#c9c4b4"/><stop offset="1" stop-color="#8f8a78"/>` +
      `</linearGradient>` +
      `<linearGradient id="h10Band" x1="0" y1="0" x2="0" y2="1">` +
      `<stop offset="0" stop-color="#100f0e" stop-opacity="0"/><stop offset="0.5" stop-color="#1a1917" stop-opacity="0.92"/><stop offset="1" stop-color="#232120" stop-opacity="0.97"/>` +
      `</linearGradient>` +
      `<filter id="h10Glow" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="${(10 * s).toFixed(1)}"/></filter>` +
      `<filter id="h10Kabut" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="${(24 * s).toFixed(1)}"/></filter>`,
    kelelawar(W * 0.3, (l ? 82 : 112) * s, 1.15 * s, false, "#15140f") +
      kelelawar(W * 0.66, (l ? 62 : 92) * s, 0.95 * s, true, "#15140f") +
      pasang +
      kabut +
      star4(W * 0.24, (l ? 130 : 170) * s, 8 * s, 0.6, "#efece2") +
      star4(W * 0.75, (l ? 90 : 130) * s, 7 * s, 0.55, "#efece2") +
      sisi,
    "gKain",
    "h10Glow",
    "#e9e7df",
    "#14120e",
    "#d9d4c6",
    "#5f594c",
    "#a89e88",
    "h10Band",
    "#a89e88",
    pocong(92 * s, H - 82 * s, 0.52 * s),
    pocong(W - 92 * s, H - 82 * s, 0.52 * s, true),
  );
}

/* ============ DESEN 11 — POCONG MELANTAI (hijau pucat) ============ */

export function svgHoror11(r: Rasio): string {
  const d = dasar(r);
  const { W, H, l, s, inset, zona } = d;
  const melayang =
    `<g transform="rotate(-8 ${W / 2} ${(l ? 96 : 140) * s})">` +
    pocong(W / 2, (l ? 96 : 140) * s, (l ? 0.85 : 0.9) * s, false, "#e3e8df") +
    `</g>` +
    `<ellipse cx="${W / 2}" cy="${(l ? 175 : 215) * s}" rx="${(130 * s).toFixed(0)}" ry="${(16 * s).toFixed(0)}" fill="#0c110c" opacity="0.55" filter="url(#h11Kabut)"/>`;
  const kabut =
    kabutGulung(W * 0.3, zona - 34 * s, 330 * s, 44 * s, "#cfe0cd", 0.13, "h11Kabut") +
    kabutGulung(W * 0.72, zona - 18 * s, 300 * s, 40 * s, "#cfe0cd", 0.11, "h11Kabut");
  const sisi = rambutSisi(52 * s, zona + 30 * s, H - 230 * s, 52 * s, "#93a892", s, false) +
    rambutSisi(W - 52 * s, zona + 30 * s, H - 230 * s, 52 * s, "#93a892", s, true);
  return kumpulkan(
    d,
    `<linearGradient id="h11Atas" x1="0" y1="0" x2="0" y2="1">` +
      `<stop offset="0" stop-color="#121a12" stop-opacity="0.99"/><stop offset="0.55" stop-color="#0b120b" stop-opacity="0.93"/><stop offset="1" stop-color="#040704" stop-opacity="0"/>` +
      `</linearGradient>` +
      `<radialGradient id="h11GlowLatar" cx="0.5" cy="0.5" r="0.5">` +
      `<stop offset="0" stop-color="#31503a" stop-opacity="0.55"/><stop offset="1" stop-color="#31503a" stop-opacity="0"/>` +
      `</radialGradient>` +
      `<linearGradient id="gPucat11" x1="0" y1="0" x2="0" y2="1">` +
      `<stop offset="0" stop-color="#ffffff"/><stop offset="0.42" stop-color="#e2efdc"/><stop offset="0.75" stop-color="#a8c9a2"/><stop offset="1" stop-color="#688a66"/>` +
      `</linearGradient>` +
      `<linearGradient id="h11Band" x1="0" y1="0" x2="0" y2="1">` +
      `<stop offset="0" stop-color="#0b120b" stop-opacity="0"/><stop offset="0.5" stop-color="#132013" stop-opacity="0.92"/><stop offset="1" stop-color="#1c2d1c" stop-opacity="0.97"/>` +
      `</linearGradient>` +
      `<filter id="h11Glow" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="${(10 * s).toFixed(1)}"/></filter>` +
      `<filter id="h11Kabut" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="${(24 * s).toFixed(1)}"/></filter>`,
    melayang + kabut + sisi,
    "gPucat11",
    "h11Glow",
    "#c9f0c2",
    "#0a130b",
    "#a8c9a2",
    "#44603f",
    "#7fa878",
    "h11Band",
    "#7fa878",
    pocong(94 * s, H - 82 * s, 0.5 * s, false, "#e3e8df"),
    pocong(W - 94 * s, H - 82 * s, 0.5 * s, true, "#e3e8df"),
  );
}

/* ============ DESEN 12 — KUNTILANAK BERDIRI (merah-putih) ============ */

export function svgHoror12(r: Rasio): string {
  const d = dasar(r);
  const { W, H, l, s, inset, zona } = d;
  const pasang =
    kuntilanak((l ? 310 : 180) * s, (l ? 250 : 300) * s, (l ? 1.05 : 1.2) * s, false) +
    kuntilanak(W - (l ? 310 : 180) * s, (l ? 260 : 310) * s, (l ? 1.05 : 1.2) * s, true);
  const bungaLayu = (x: number, y: number, sc: number) => {
    let g = `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${sc})" opacity="0.85">`;
    for (let i = 0; i < 5; i++) {
      const a = (i * 72 * Math.PI) / 180;
      g += `<ellipse cx="${(Math.cos(a) * 9).toFixed(1)}" cy="${(Math.sin(a) * 9).toFixed(1)}" rx="6.5" ry="3.4" transform="rotate(${i * 72} ${(Math.cos(a) * 9).toFixed(1)} ${(Math.sin(a) * 9).toFixed(1)})" fill="#8f5a6a"/>`;
    }
    g += `<circle cx="0" cy="0" r="3.2" fill="#5c3040"/></g>`;
    return g;
  };
  const sisi = rambutSisi(52 * s, zona + 24 * s, H - 220 * s, 46 * s, "#1c1620", s, false) +
    rambutSisi(W - 52 * s, zona + 24 * s, H - 220 * s, 46 * s, "#1c1620", s, true);
  return kumpulkan(
    d,
    `<linearGradient id="h12Atas" x1="0" y1="0" x2="0" y2="1">` +
      `<stop offset="0" stop-color="#1c1016" stop-opacity="0.99"/><stop offset="0.55" stop-color="#130a10" stop-opacity="0.93"/><stop offset="1" stop-color="#070305" stop-opacity="0"/>` +
      `</linearGradient>` +
      `<radialGradient id="h12GlowLatar" cx="0.5" cy="0.5" r="0.5">` +
      `<stop offset="0" stop-color="#6e2233" stop-opacity="0.55"/><stop offset="1" stop-color="#6e2233" stop-opacity="0"/>` +
      `</radialGradient>` +
      `<linearGradient id="gMentija" x1="0" y1="0" x2="0" y2="1">` +
      `<stop offset="0" stop-color="#ffffff"/><stop offset="0.4" stop-color="#f3e2e6"/><stop offset="0.72" stop-color="#d97f92"/><stop offset="1" stop-color="#8f2c42"/>` +
      `</linearGradient>` +
      `<linearGradient id="h12Band" x1="0" y1="0" x2="0" y2="1">` +
      `<stop offset="0" stop-color="#130a10" stop-opacity="0"/><stop offset="0.5" stop-color="#21121a" stop-opacity="0.92"/><stop offset="1" stop-color="#2f1a24" stop-opacity="0.97"/>` +
      `</linearGradient>` +
      `<filter id="h12Glow" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="${(10 * s).toFixed(1)}"/></filter>`,
    kelelawar(W * 0.28, (l ? 80 : 110) * s, 1.1 * s, false, "#170d12") +
      kelelawar(W * 0.68, (l ? 62 : 90) * s, 0.9 * s, true, "#170d12") +
      pasang +
      bungaLayu(W * (l ? 0.24 : 0.3), zona - 46 * s, 1.1 * s) +
      bungaLayu(W - (l ? 0.24 : 0.3) * W, zona - 52 * s, 0.9 * s) +
      sisi,
    "gMentija",
    "h12Glow",
    "#ffd6de",
    "#170a0f",
    "#e9dfe4",
    "#5c2c3a",
    "#d97f92",
    "h12Band",
    "#d97f92",
    kuntilanak(96 * s, H - 86 * s, 0.62 * s),
    kuntilanak(W - 96 * s, H - 86 * s, 0.62 * s, true),
  );
}

/* ============ DESEN 13 — KUNTILANAK TERIK (wajah + tirai rambut + bulan) ============ */

export function svgHoror13(r: Rasio): string {
  const d = dasar(r);
  const { W, H, l, s, inset, zona } = d;
  const tirai =
    `<path d="M ${W * 0.14} ${inset + 6 * s} C ${W * 0.2} ${(l ? 170 : 200) * s} ${W * 0.16} ${(l ? 260 : 320) * s} ${W * 0.22} ${zona} L ${W * 0.3} ${zona} C ${W * 0.26} ${(l ? 240 : 290) * s} ${W * 0.3} ${(l ? 150 : 185) * s} ${W * 0.26} ${inset + 6 * s} Z" fill="#0b0a0e" opacity="0.8"/>` +
    `<path d="M ${W * 0.86} ${inset + 6 * s} C ${W * 0.8} ${(l ? 170 : 200) * s} ${W * 0.84} ${(l ? 260 : 320) * s} ${W * 0.78} ${zona} L ${W * 0.7} ${zona} C ${W * 0.74} ${(l ? 240 : 290) * s} ${W * 0.7} ${(l ? 150 : 185) * s} ${W * 0.74} ${inset + 6 * s} Z" fill="#0b0a0e" opacity="0.8"/>`;
  // wajah besar DI BELAKANG teks hero — posisi dinaikkan agar TIDAK menyentuh
  // strip tema (uji piksel): lanskap cy 122 → bawah wajah 161 < 169 (strip atas)
  const wajahBesar = wajahHantu(W / 2, (l ? 122 : 155) * s, (l ? 1.15 : 1.0) * s, 0, 0.9);
  const bulan =
    `<circle cx="${(l ? W * 0.8 : W * 0.79).toFixed(0)}" cy="${(l ? 125 : 130) * s}" r="${(78 * s).toFixed(0)}" fill="#c96a75" opacity="0.2" filter="url(#h13Glow)"/>` +
    `<circle cx="${(l ? W * 0.8 : W * 0.79).toFixed(0)}" cy="${(l ? 125 : 130) * s}" r="${(46 * s).toFixed(0)}" fill="#d98a96" opacity="0.24"/>`;
  const sisi = rambutSisi(52 * s, zona + 26 * s, H - 225 * s, 44 * s, "#14101a", s, false) +
    rambutSisi(W - 52 * s, zona + 26 * s, H - 225 * s, 44 * s, "#14101a", s, true);
  return kumpulkan(
    d,
    `<linearGradient id="h13Atas" x1="0" y1="0" x2="0" y2="1">` +
      `<stop offset="0" stop-color="#16101b" stop-opacity="0.99"/><stop offset="0.55" stop-color="#0e0a13" stop-opacity="0.93"/><stop offset="1" stop-color="#060409" stop-opacity="0"/>` +
      `</linearGradient>` +
      `<radialGradient id="h13GlowLatar" cx="0.5" cy="0.5" r="0.5">` +
      `<stop offset="0" stop-color="#5c2c44" stop-opacity="0.5"/><stop offset="1" stop-color="#5c2c44" stop-opacity="0"/>` +
      `</radialGradient>` +
      `<linearGradient id="gPucat13" x1="0" y1="0" x2="0" y2="1">` +
      `<stop offset="0" stop-color="#ffffff"/><stop offset="0.45" stop-color="#ecdfe8"/><stop offset="0.75" stop-color="#c2a3b6"/><stop offset="1" stop-color="#7c5c72"/>` +
      `</linearGradient>` +
      `<linearGradient id="h13Band" x1="0" y1="0" x2="0" y2="1">` +
      `<stop offset="0" stop-color="#0e0a13" stop-opacity="0"/><stop offset="0.5" stop-color="#1a1220" stop-opacity="0.92"/><stop offset="1" stop-color="#251a2e" stop-opacity="0.97"/>` +
      `</linearGradient>` +
      `<filter id="h13Glow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="${(18 * s).toFixed(1)}"/></filter>`,
    tirai + wajahBesar + bulan + sisi,
    "gPucat13",
    "h13Glow",
    "#e8d4e0",
    "#12080f",
    "#d9c8d4",
    "#4c2c44",
    "#b07f9c",
    "h13Band",
    "#b07f9c",
    wajahHantu(96 * s, H - 84 * s, 0.5 * s, -6),
    wajahHantu(W - 96 * s, H - 84 * s, 0.5 * s, 6),
  );
}

/* ============ DESEN 14 — WAJAH PUCAT MENGINTIP (biru dingin) ============ */

export function svgHoror14(r: Rasio): string {
  const d = dasar(r);
  const { W, H, l, s, inset, zona } = d;
  const pengintip =
    wajahHantu((l ? 280 : 165) * s, (l ? 240 : 290) * s, (l ? 1.1 : 1.25) * s, -8) +
    wajahHantu(W - (l ? 280 : 165) * s, (l ? 255 : 300) * s, (l ? 1.1 : 1.25) * s, 8) +
    wajahHantu((l ? 455 : 300) * s, (l ? 320 : 380) * s, 0.62 * s, 10, 0.75) +
    wajahHantu(W - (l ? 455 : 300) * s, (l ? 330 : 385) * s, 0.62 * s, -10, 0.75);
  const kabut =
    kabutGulung(W * 0.3, zona - 36 * s, 340 * s, 46 * s, "#aeb9c9", 0.14, "h14Kabut") +
    kabutGulung(W * 0.7, zona - 18 * s, 310 * s, 42 * s, "#aeb9c9", 0.12, "h14Kabut");
  const sisi = kabutGulung(52 * s, zona + 90 * s, 26 * s, 60 * s, "#8ea2c4", 0.35, "h14Kabut") +
    kabutGulung(52 * s, zona + 230 * s, 24 * s, 55 * s, "#8ea2c4", 0.28, "h14Kabut") +
    kabutGulung(52 * s, H - 300 * s, 26 * s, 60 * s, "#8ea2c4", 0.3, "h14Kabut") +
    kabutGulung(W - 52 * s, zona + 90 * s, 26 * s, 60 * s, "#8ea2c4", 0.35, "h14Kabut") +
    kabutGulung(W - 52 * s, zona + 230 * s, 24 * s, 55 * s, "#8ea2c4", 0.28, "h14Kabut") +
    kabutGulung(W - 52 * s, H - 300 * s, 26 * s, 60 * s, "#8ea2c4", 0.3, "h14Kabut");
  return kumpulkan(
    d,
    `<linearGradient id="h14Atas" x1="0" y1="0" x2="0" y2="1">` +
      `<stop offset="0" stop-color="#0d1420" stop-opacity="0.99"/><stop offset="0.55" stop-color="#080e18" stop-opacity="0.93"/><stop offset="1" stop-color="#04070e" stop-opacity="0"/>` +
      `</linearGradient>` +
      `<radialGradient id="h14GlowLatar" cx="0.5" cy="0.5" r="0.5">` +
      `<stop offset="0" stop-color="#24405e" stop-opacity="0.55"/><stop offset="1" stop-color="#24405e" stop-opacity="0"/>` +
      `</radialGradient>` +
      `<linearGradient id="gEs14" x1="0" y1="0" x2="0" y2="1">` +
      `<stop offset="0" stop-color="#ffffff"/><stop offset="0.42" stop-color="#dceafc"/><stop offset="0.72" stop-color="#9ec8ff"/><stop offset="1" stop-color="#5a86c2"/>` +
      `</linearGradient>` +
      `<linearGradient id="h14Band" x1="0" y1="0" x2="0" y2="1">` +
      `<stop offset="0" stop-color="#080e18" stop-opacity="0"/><stop offset="0.5" stop-color="#101a2c" stop-opacity="0.92"/><stop offset="1" stop-color="#182640" stop-opacity="0.97"/>` +
      `</linearGradient>` +
      `<filter id="h14Glow" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="${(11 * s).toFixed(1)}"/></filter>` +
      `<filter id="h14Kabut" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="${(22 * s).toFixed(1)}"/></filter>`,
    kelelawar(W * 0.3, (l ? 78 : 106) * s, 1.05 * s, false, "#0b111c") +
      kelelawar(W * 0.66, (l ? 60 : 86) * s, 0.9 * s, true, "#0b111c") +
      pengintip +
      kabut +
      star4(W * 0.22, (l ? 120 : 158) * s, 8 * s, 0.6, "#dceafc") +
      star4(W * 0.76, (l ? 84 : 120) * s, 7 * s, 0.55, "#dceafc") +
      sisi,
    "gEs14",
    "h14Glow",
    "#cfe4ff",
    "#070d18",
    "#d4e2f5",
    "#3c4d6b",
    "#8ea2c4",
    "h14Band",
    "#8ea2c4",
    wajahHantu(94 * s, H - 84 * s, 0.55 * s, -5),
    wajahHantu(W - 94 * s, H - 84 * s, 0.55 * s, 5),
  );
}

/* ============ DESEN 15 — LORONG MAKAM KUNO (coklat batu + lilin) ============ */

export function svgHoror15(r: Rasio): string {
  const d = dasar(r);
  const { W, H, l, s, inset, zona } = d;
  // tiga busur lorong mengecil (kesan kedalaman) — dibiarkan DI BAWAH strip tema
  // (tinggi pendek) agar tidak menyeberangi strip tengah yang diuji kosong
  const busur = (cx: number, yDasar: number, lebar: number, tinggi: number, warna: string, sw: number, op: number) =>
    `<path d="M ${cx - lebar} ${yDasar} L ${cx - lebar} ${yDasar - tinggi * 0.55} C ${cx - lebar} ${yDasar - tinggi} ${cx + lebar} ${yDasar - tinggi} ${cx + lebar} ${yDasar - tinggi * 0.55} L ${cx + lebar} ${yDasar}" fill="none" stroke="${warna}" stroke-width="${sw}" opacity="${op}"/>`;
  const lorong =
    busur(W / 2, zona - 30 * s, 250 * s, 180 * s, "#b9a888", 5 * s, 0.8) +
    busur(W / 2, zona - 30 * s, 180 * s, 140 * s, "#a89a78", 4 * s, 0.7) +
    busur(W / 2, zona - 30 * s, 120 * s, 100 * s, "#8f8266", 3.4 * s, 0.65) +
    `<rect x="${W / 2 - 250 * s}" y="${zona - 30 * s}" width="${500 * s}" height="${(14 * s).toFixed(0)}" fill="#3a332a" opacity="0.8" rx="${(4 * s).toFixed(0)}"/>`;
  const lilins = lilin((l ? 180 : 120) * s, zona - 34 * s, (l ? 1.1 : 1.0) * s) +
    lilin(W - (l ? 180 : 120) * s, zona - 34 * s, (l ? 1.1 : 1.0) * s, "#efe3c2", 0.9);
  const sisi = (() => {
    let out = "";
    let i = 0;
    for (let y = zona + 30 * s; y <= H - 230 * s; y += 58 * s) {
      out += `<rect x="${(44 * s).toFixed(1)}" y="${y.toFixed(1)}" width="${(17 * s).toFixed(1)}" height="${(26 * s).toFixed(1)}" rx="${(2 * s).toFixed(1)}" fill="#8f8266" opacity="${i % 2 === 0 ? 0.75 : 0.5}" transform="rotate(${i % 2 === 0 ? 0 : 3} ${(52 * s).toFixed(1)} ${y.toFixed(1)})"/>`;
      out += `<rect x="${(W - 61 * s).toFixed(1)}" y="${(y + 20 * s).toFixed(1)}" width="${(17 * s).toFixed(1)}" height="${(26 * s).toFixed(1)}" rx="${(2 * s).toFixed(1)}" fill="#8f8266" opacity="${i % 2 === 0 ? 0.5 : 0.75}" transform="rotate(${i % 2 === 0 ? -3 : 0} ${(W - 52 * s).toFixed(1)} ${y.toFixed(1)})"/>`;
      i++;
    }
    return out;
  })();
  return kumpulkan(
    d,
    `<linearGradient id="h15Atas" x1="0" y1="0" x2="0" y2="1">` +
      `<stop offset="0" stop-color="#181410" stop-opacity="0.99"/><stop offset="0.55" stop-color="#100d09" stop-opacity="0.93"/><stop offset="1" stop-color="#060503" stop-opacity="0"/>` +
      `</linearGradient>` +
      `<radialGradient id="h15GlowLatar" cx="0.5" cy="0.5" r="0.5">` +
      `<stop offset="0" stop-color="#54462e" stop-opacity="0.55"/><stop offset="1" stop-color="#54462e" stop-opacity="0"/>` +
      `</radialGradient>` +
      `<linearGradient id="gBatu15" x1="0" y1="0" x2="0" y2="1">` +
      `<stop offset="0" stop-color="#fff8e6"/><stop offset="0.42" stop-color="#f0e3c2"/><stop offset="0.74" stop-color="#c2a878"/><stop offset="1" stop-color="#7c6a48"/>` +
      `</linearGradient>` +
      `<linearGradient id="h15Band" x1="0" y1="0" x2="0" y2="1">` +
      `<stop offset="0" stop-color="#100d09" stop-opacity="0"/><stop offset="0.5" stop-color="#1c1710" stop-opacity="0.92"/><stop offset="1" stop-color="#2a2118" stop-opacity="0.97"/>` +
      `</linearGradient>` +
      `<filter id="h15Glow" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="${(10 * s).toFixed(1)}"/></filter>`,
    lorong + lilins + sisi,
    "gBatu15",
    "h15Glow",
    "#ffdf9e",
    "#170f06",
    "#e2d4b2",
    "#5c4c32",
    "#c2a878",
    "h15Band",
    "#c2a878",
    lilin(94 * s, H - 66 * s, 0.85 * s),
    lilin(W - 94 * s, H - 66 * s, 0.85 * s),
  );
}

/* ============ DESEN 16 — POHON ARWAH (ungu mistis + arwah gantung) ============ */

export function svgHoror16(r: Rasio): string {
  const d = dasar(r);
  const { W, H, l, s, inset, zona } = d;
  const dahan = (x0: number, flip: boolean) => {
    const dir = flip ? -1 : 1;
    let g =
      `<path d="M ${x0} ${inset + 4 * s} C ${x0 + dir * 130 * s} ${inset + 46 * s} ${x0 + dir * 210 * s} ${inset + 104 * s} ${x0 + dir * 255 * s} ${inset + 195 * s}" fill="none" stroke="#3d2a4c" stroke-width="${(7 * s).toFixed(1)}" stroke-linecap="round"/>` +
      `<path d="M ${x0 + dir * 140 * s} ${inset + 50 * s} C ${x0 + dir * 175 * s} ${inset + 40 * s} ${x0 + dir * 205 * s} ${inset + 48 * s} ${x0 + dir * 228 * s} ${inset + 74 * s}" fill="none" stroke="#322241" stroke-width="${(4.4 * s).toFixed(1)}" stroke-linecap="round"/>` +
      `<path d="M ${x0 + dir * 95 * s} ${inset + 34 * s} C ${x0 + dir * 108 * s} ${inset + 14 * s} ${x0 + dir * 122 * s} ${inset + 8 * s} ${x0 + dir * 140 * s} ${inset + 12 * s}" fill="none" stroke="#322241" stroke-width="${(3.4 * s).toFixed(1)}" stroke-linecap="round"/>`;
    // sulur kecil menggantung
    for (let i = 0; i < 3; i++) {
      const tx = x0 + dir * (170 + i * 34) * s;
      const ty = inset + (58 + i * 34) * s;
      g += `<path d="M ${tx.toFixed(1)} ${ty.toFixed(1)} q ${(dir * -8 * s).toFixed(1)} ${(20 * s).toFixed(1)} ${(dir * 2 * s).toFixed(1)} ${(34 * s).toFixed(1)}" fill="none" stroke="#322241" stroke-width="${(2.4 * s).toFixed(1)}" stroke-linecap="round"/>`;
    }
    return g;
  };
  const dahans = dahan(inset + 4 * s, false) + dahan(W - inset - 4 * s, true);
  const arwahGantung =
    arwah((l ? 350 : 230) * s, (l ? 290 : 355) * s, (l ? 0.72 : 0.8) * s, false, "#cbbfe0") +
    arwah(W - (l ? 350 : 230) * s, (l ? 305 : 370) * s, (l ? 0.72 : 0.8) * s, true, "#cbbfe0");
  const mata = mataNyala((l ? 210 : 140) * s, (l ? 330 : 400) * s, (l ? 1.1 : 1.3) * s, "#c9a4ff", "h16GlowKecil") +
    mataNyala(W - (l ? 210 : 140) * s, (l ? 350 : 420) * s, (l ? 1.0 : 1.2) * s, "#a4e4ff", "h16GlowKecil");
  const sisi = (() => {
    let out = "";
    let i = 0;
    for (let y = zona + 26 * s; y <= H - 235 * s; y += 52 * s) {
      const dir = i % 2 === 0 ? 1 : -1;
      out += `<path d="M ${52 * s} ${y.toFixed(0)} q ${(dir * 10 * s).toFixed(1)} ${(22 * s).toFixed(1)} 0 ${(44 * s).toFixed(1)}" fill="none" stroke="#4c3860" stroke-width="${(2.6 * s).toFixed(1)}" stroke-linecap="round"/>`;
      out += `<path d="M ${W - 52 * s} ${(y + 26 * s).toFixed(0)} q ${(-dir * 10 * s).toFixed(1)} ${(22 * s).toFixed(1)} 0 ${(44 * s).toFixed(1)}" fill="none" stroke="#4c3860" stroke-width="${(2.6 * s).toFixed(1)}" stroke-linecap="round"/>`;
      i++;
    }
    return out;
  })();
  return kumpulkan(
    d,
    `<linearGradient id="h16Atas" x1="0" y1="0" x2="0" y2="1">` +
      `<stop offset="0" stop-color="#130d1c" stop-opacity="0.99"/><stop offset="0.55" stop-color="#0c0813" stop-opacity="0.93"/><stop offset="1" stop-color="#050309" stop-opacity="0"/>` +
      `</linearGradient>` +
      `<radialGradient id="h16GlowLatar" cx="0.5" cy="0.5" r="0.5">` +
      `<stop offset="0" stop-color="#41285c" stop-opacity="0.55"/><stop offset="1" stop-color="#41285c" stop-opacity="0"/>` +
      `</radialGradient>` +
      `<linearGradient id="gUngu16" x1="0" y1="0" x2="0" y2="1">` +
      `<stop offset="0" stop-color="#f5f0ff"/><stop offset="0.4" stop-color="#dcc8f2"/><stop offset="0.74" stop-color="#a982d4"/><stop offset="1" stop-color="#6b4a94"/>` +
      `</linearGradient>` +
      `<linearGradient id="h16Band" x1="0" y1="0" x2="0" y2="1">` +
      `<stop offset="0" stop-color="#0c0813" stop-opacity="0"/><stop offset="0.5" stop-color="#181026" stop-opacity="0.92"/><stop offset="1" stop-color="#241836" stop-opacity="0.97"/>` +
      `</linearGradient>` +
      `<filter id="h16Glow" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="${(10 * s).toFixed(1)}"/></filter>` +
      `<filter id="h16GlowKecil" x="-120%" y="-120%" width="340%" height="340%"><feGaussianBlur stdDeviation="${(5 * s).toFixed(1)}"/></filter>` +
      `<filter id="agGlow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="${(10 * s).toFixed(1)}"/></filter>`,
    dahans + arwahGantung + mata + sisi,
    "gUngu16",
    "h16Glow",
    "#d9c2ff",
    "#0f0818",
    "#cbbfe0",
    "#3c2c52",
    "#a982d4",
    "h16Band",
    "#a982d4",
    mataNyala(96 * s, H - 80 * s, 0.9 * s, "#c9a4ff", "h16GlowKecil"),
    mataNyala(W - 96 * s, H - 80 * s, 0.9 * s, "#a4e4ff", "h16GlowKecil"),
  );
}

/* ============ DESEN 17 — LILIN & TENGGKORAK (amber gelap) ============ */

export function svgHoror17(r: Rasio): string {
  const d = dasar(r);
  const { W, H, l, s, inset, zona } = d;
  // barisan lilin di dasar zona atas + tengkorak di tengah antara lilin
  let lilins = "";
  const posisi = l ? [150, 260, 1660, 1770] : [110, 200, 880, 970];
  for (const x of posisi) lilins += lilin(x * s, zona - 26 * s, (l ? 1.05 : 0.95) * s, "#efe3c2", 0.95);
  const tengkorakTengah = tengkorak(W / 2, (l ? 350 : 400) * s, (l ? 1.0 : 1.15) * s, "#d9d4c6", "#0c0b0e", 0.95);
  const kabut =
    kabutGulung(W * 0.3, zona - 30 * s, 330 * s, 40 * s, "#e8d9b2", 0.1, "h17Kabut") +
    kabutGulung(W * 0.72, zona - 16 * s, 300 * s, 36 * s, "#e8d9b2", 0.09, "h17Kabut");
  const sisi = (() => {
    let out = "";
    let i = 0;
    for (let y = zona + 34 * s; y <= H - 235 * s; y += 60 * s) {
      out += api(52 * s, y, 13 * s, (18 + (i % 3) * 6) * s, "#7c2d12", "#fdba74");
      out += api(W - 52 * s, y + 30 * s, 13 * s, (18 + ((i + 1) % 3) * 6) * s, "#7c2d12", "#fdba74");
      i++;
    }
    return out;
  })();
  return kumpulkan(
    d,
    `<linearGradient id="h17Atas" x1="0" y1="0" x2="0" y2="1">` +
      `<stop offset="0" stop-color="#1a130a" stop-opacity="0.99"/><stop offset="0.55" stop-color="#120d06" stop-opacity="0.93"/><stop offset="1" stop-color="#070502" stop-opacity="0"/>` +
      `</linearGradient>` +
      `<radialGradient id="h17GlowLatar" cx="0.5" cy="0.5" r="0.5">` +
      `<stop offset="0" stop-color="#6b4a1a" stop-opacity="0.5"/><stop offset="1" stop-color="#6b4a1a" stop-opacity="0"/>` +
      `</radialGradient>` +
      `<linearGradient id="gApi17" x1="0" y1="0" x2="0" y2="1">` +
      `<stop offset="0" stop-color="#fff7c2"/><stop offset="0.35" stop-color="#ffd76b"/><stop offset="0.65" stop-color="#f59e0b"/><stop offset="1" stop-color="#b45309"/>` +
      `</linearGradient>` +
      `<linearGradient id="h17Band" x1="0" y1="0" x2="0" y2="1">` +
      `<stop offset="0" stop-color="#120d06" stop-opacity="0"/><stop offset="0.5" stop-color="#201709" stop-opacity="0.92"/><stop offset="1" stop-color="#30230e" stop-opacity="0.97"/>` +
      `</linearGradient>` +
      `<filter id="h17Glow" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="${(11 * s).toFixed(1)}"/></filter>` +
      `<filter id="h17Kabut" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="${(22 * s).toFixed(1)}"/></filter>`,
    tengkorakTengah + lilins + kabut + sisi,
    "gApi17",
    "h17Glow",
    "#ffd76b",
    "#1c1204",
    "#e2c48a",
    "#5c4322",
    "#f59e0b",
    "h17Band",
    "#f59e0b",
    api(96 * s, H - 56 * s, 18 * s, 40 * s),
    api(W - 96 * s, H - 56 * s, 18 * s, 40 * s),
  );
}

/* ============ DESEN 18 — NISAN BERCAHAYA (hijau hantu) ============ */

export function svgHoror18(r: Rasio): string {
  const d = dasar(r);
  const { W, H, l, s, inset, zona } = d;
  const makam =
    nisan((l ? 270 : 160) * s, (l ? 290 : 345) * s, (l ? 1.1 : 1.3) * s, "#6f8269", "#33402f", 0.95) +
    salib(W - (l ? 270 : 160) * s, (l ? 285 : 340) * s, (l ? 1.0 : 1.15) * s, "#93a88c", 0.9) +
    nisan((l ? 460 : 300) * s, (l ? 330 : 390) * s, 0.7 * s, "#5c6e58", "#2c3829", 0.65) +
    salib(W - (l ? 460 : 300) * s, (l ? 335 : 395) * s, 0.7 * s, "#84967f", 0.6);
  // cahaya hijau dari balik nisan
  const cahaya =
    `<ellipse cx="${(l ? 270 : 160) * s}" cy="${(l ? 250 : 300) * s}" rx="${(110 * s).toFixed(0)}" ry="${(90 * s).toFixed(0)}" fill="#7dff8a" opacity="0.14" filter="url(#h18Glow)"/>` +
    `<ellipse cx="${W - (l ? 270 : 160) * s}" cy="${(l ? 245 : 295) * s}" rx="${(110 * s).toFixed(0)}" ry="${(90 * s).toFixed(0)}" fill="#7dff8a" opacity="0.12" filter="url(#h18Glow)"/>`;
  const mata = mataNyala((l ? 380 : 245) * s, (l ? 350 : 420) * s, (l ? 1.05 : 1.2) * s, "#a4ff4d", "h18GlowKecil") +
    mataNyala(W - (l ? 380 : 245) * s, (l ? 365 : 430) * s, (l ? 1.0 : 1.15) * s, "#a4ff4d", "h18GlowKecil");
  const rumputSisi = (x: number, flip: boolean) => {
    let out = "";
    let i = 0;
    for (let y = zona + 30 * s; y <= H - 235 * s; y += 48 * s) {
      const dir = (i % 2 === 0 ? 1 : -1) * (flip ? -1 : 1);
      out += `<path d="M ${x} ${y.toFixed(0)} q ${(dir * 6 * s).toFixed(1)} ${(-16 * s).toFixed(1)} ${(dir * 2 * s).toFixed(1)} ${(-30 * s).toFixed(1)}" fill="none" stroke="#4c6a3c" stroke-width="${(2.4 * s).toFixed(1)}" stroke-linecap="round"/>`;
      i++;
    }
    return out;
  };
  const sisi = rumputSisi(52 * s, false) + rumputSisi(W - 52 * s, true);
  return kumpulkan(
    d,
    `<linearGradient id="h18Atas" x1="0" y1="0" x2="0" y2="1">` +
      `<stop offset="0" stop-color="#0c150d" stop-opacity="0.99"/><stop offset="0.55" stop-color="#070f08" stop-opacity="0.93"/><stop offset="1" stop-color="#030603" stop-opacity="0"/>` +
      `</linearGradient>` +
      `<radialGradient id="h18GlowLatar" cx="0.5" cy="0.5" r="0.5">` +
      `<stop offset="0" stop-color="#255c2e" stop-opacity="0.55"/><stop offset="1" stop-color="#255c2e" stop-opacity="0"/>` +
      `</radialGradient>` +
      `<linearGradient id="gHijau18" x1="0" y1="0" x2="0" y2="1">` +
      `<stop offset="0" stop-color="#f2ffdc"/><stop offset="0.4" stop-color="#c8f57e"/><stop offset="0.72" stop-color="#8ed449"/><stop offset="1" stop-color="#4c8a26"/>` +
      `</linearGradient>` +
      `<linearGradient id="h18Band" x1="0" y1="0" x2="0" y2="1">` +
      `<stop offset="0" stop-color="#070f08" stop-opacity="0"/><stop offset="0.5" stop-color="#0f2012" stop-opacity="0.92"/><stop offset="1" stop-color="#17301b" stop-opacity="0.97"/>` +
      `</linearGradient>` +
      `<filter id="h18Glow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="${(16 * s).toFixed(1)}"/></filter>` +
      `<filter id="h18GlowKecil" x="-120%" y="-120%" width="340%" height="340%"><feGaussianBlur stdDeviation="${(5 * s).toFixed(1)}"/></filter>`,
    kelelawar(W * 0.3, (l ? 76 : 104) * s, 1.0 * s, false, "#0b130c") +
      kelelawar(W * 0.67, (l ? 58 : 84) * s, 0.85 * s, true, "#0b130c") +
      cahaya +
      makam +
      mata +
      sisi,
    "gHijau18",
    "h18Glow",
    "#c2ff9e",
    "#07130a",
    "#9fb8a4",
    "#33591f",
    "#7bb04a",
    "h18Band",
    "#7bb04a",
    salib(94 * s, H - 88 * s, 0.6 * s, "#9fb8a4", 0.9),
    salib(W - 94 * s, H - 88 * s, 0.6 * s, "#9fb8a4", 0.9),
  );
}

/* ============ DESEN 19 — KABUT KUBURAN (biru kelabu + gerbang) ============ */

export function svgHoror19(r: Rasio): string {
  const d = dasar(r);
  const { W, H, l, s, inset, zona } = d;
  // gerbang pagar besi: dua pilar + pucuk runcing + bilah vertikal
  const pilar = (x: number) =>
    `<rect x="${(x - 16 * s).toFixed(1)}" y="${(l ? 130 : 150) * s}" width="${(32 * s).toFixed(1)}" height="${(zona - (l ? 130 : 150) * s - 24 * s).toFixed(0)}" fill="#2c3340" stroke="#4c5a70" stroke-width="${(1.6 * s).toFixed(1)}"/>` +
    `<path d="M ${(x - 16 * s).toFixed(1)} ${(l ? 130 : 150) * s} L ${x} ${(l ? 96 : 112) * s} L ${(x + 16 * s).toFixed(1)} ${(l ? 130 : 150) * s} Z" fill="#3c4656"/>`;
  const gerbang =
    pilar(W * 0.16) + pilar(W * 0.84) +
    (() => {
      let out = "";
      for (let x = W * 0.2; x <= W * 0.81; x += 34 * s) {
        out += `<line x1="${x.toFixed(0)}" y1="${(l ? 260 : 290) * s}" x2="${x.toFixed(0)}" y2="${zona - 34 * s}" stroke="#4c5a70" stroke-width="${(2.2 * s).toFixed(1)}" opacity="0.75"/>`;
      }
      return out;
    })() +
    `<line x1="${W * 0.18}" y1="${(l ? 230 : 260) * s}" x2="${W * 0.82}" y2="${(l ? 230 : 260) * s}" stroke="#4c5a70" stroke-width="${(3 * s).toFixed(1)}" opacity="0.8"/>`;
  const kabutTeal =
    kabutGulung(W * 0.32, zona - 44 * s, 360 * s, 54 * s, "#b9c2cc", 0.2, "h19Kabut") +
    kabutGulung(W * 0.68, zona - 24 * s, 340 * s, 48 * s, "#b9c2cc", 0.17, "h19Kabut") +
    kabutGulung(W * 0.5, zona - 70 * s, 280 * s, 40 * s, "#b9c2cc", 0.12, "h19Kabut");
  const bulan =
    `<circle cx="${(l ? W * 0.5 : W * 0.5).toFixed(0)}" cy="${(l ? 110 : 120) * s}" r="${(66 * s).toFixed(0)}" fill="#dce3ea" opacity="0.16" filter="url(#h19Glow)"/>` +
    `<circle cx="${(l ? W * 0.5 : W * 0.5).toFixed(0)}" cy="${(l ? 110 : 120) * s}" r="${(38 * s).toFixed(0)}" fill="#dce3ea" opacity="0.22"/>`;
  const sisi = kabutGulung(52 * s, zona + 80 * s, 25 * s, 62 * s, "#8ea2b4", 0.4, "h19Kabut") +
    kabutGulung(52 * s, zona + 220 * s, 23 * s, 56 * s, "#8ea2b4", 0.32, "h19Kabut") +
    kabutGulung(52 * s, H - 290 * s, 25 * s, 60 * s, "#8ea2b4", 0.34, "h19Kabut") +
    kabutGulung(W - 52 * s, zona + 80 * s, 25 * s, 62 * s, "#8ea2b4", 0.4, "h19Kabut") +
    kabutGulung(W - 52 * s, zona + 220 * s, 23 * s, 56 * s, "#8ea2b4", 0.32, "h19Kabut") +
    kabutGulung(W - 52 * s, H - 290 * s, 25 * s, 60 * s, "#8ea2b4", 0.34, "h19Kabut");
  return kumpulkan(
    d,
    `<linearGradient id="h19Atas" x1="0" y1="0" x2="0" y2="1">` +
      `<stop offset="0" stop-color="#12161c" stop-opacity="0.99"/><stop offset="0.55" stop-color="#0b0e13" stop-opacity="0.93"/><stop offset="1" stop-color="#050608" stop-opacity="0"/>` +
      `</linearGradient>` +
      `<radialGradient id="h19GlowLatar" cx="0.5" cy="0.5" r="0.5">` +
      `<stop offset="0" stop-color="#3a4454" stop-opacity="0.55"/><stop offset="1" stop-color="#3a4454" stop-opacity="0"/>` +
      `</radialGradient>` +
      `<linearGradient id="gKabu19" x1="0" y1="0" x2="0" y2="1">` +
      `<stop offset="0" stop-color="#ffffff"/><stop offset="0.42" stop-color="#dbe4ec"/><stop offset="0.72" stop-color="#aebecb"/><stop offset="1" stop-color="#6b7a88"/>` +
      `</linearGradient>` +
      `<linearGradient id="h19Band" x1="0" y1="0" x2="0" y2="1">` +
      `<stop offset="0" stop-color="#0b0e13" stop-opacity="0"/><stop offset="0.5" stop-color="#161b22" stop-opacity="0.92"/><stop offset="1" stop-color="#20262f" stop-opacity="0.97"/>` +
      `</linearGradient>` +
      `<filter id="h19Glow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="${(20 * s).toFixed(1)}"/></filter>` +
      `<filter id="h19Kabut" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="${(24 * s).toFixed(1)}"/></filter>`,
    gerbang + bulan + kabutTeal + sisi,
    "gKabu19",
    "h19Glow",
    "#dbe4ec",
    "#0b0e13",
    "#b9c2cc",
    "#3c4656",
    "#8ea2b4",
    "h19Band",
    "#8ea2b4",
    `<rect x="${(88 * s).toFixed(0)}" y="${(H - 100 * s).toFixed(0)}" width="${(18 * s).toFixed(1)}" height="${(34 * s).toFixed(1)}" rx="${(2 * s).toFixed(1)}" fill="#4c5a70" opacity="0.8"/>`,
    `<rect x="${(W - 106 * s).toFixed(0)}" y="${(H - 100 * s).toFixed(0)}" width="${(18 * s).toFixed(1)}" height="${(34 * s).toFixed(1)}" rx="${(2 * s).toFixed(1)}" fill="#4c5a70" opacity="0.8"/>`,
  );
}

/* ============ RENDER SEMUA (20 PNG) ============ */

async function render(nama: string, svg: string) {
  const tujuan = path.join(OUT, nama);
  await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(tujuan);
  console.log("✓", nama);
}

const daftar: [string, (r: Rasio) => string][] = [
  ["horor-alam-gaib-10", svgHoror10],
  ["horor-alam-gaib-11", svgHoror11],
  ["horor-alam-gaib-12", svgHoror12],
  ["horor-alam-gaib-13", svgHoror13],
  ["horor-alam-gaib-14", svgHoror14],
  ["horor-alam-gaib-15", svgHoror15],
  ["horor-alam-gaib-16", svgHoror16],
  ["horor-alam-gaib-17", svgHoror17],
  ["horor-alam-gaib-18", svgHoror18],
  ["horor-alam-gaib-19", svgHoror19],
];

for (const [slug, fn] of daftar) {
  await render(`${slug}-916.png`, fn(R916));
  await render(`${slug}-169.png`, fn(R169));
}
console.log("SELESAI →", OUT);
