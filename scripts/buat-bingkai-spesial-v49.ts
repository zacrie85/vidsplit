// VidSplit v0.49.0 — GENERATOR 4 FRAME SPESIAL (SVG → sharp → PNG)
// Dijalankan: bun scripts/buat-bingkai-spesial-v49.ts
//
// Permintaan user (2 gambar referensi): teks DANGDUT IDOLA DESA & HOROR ALAM
// GAIB DIGESER KE ATAS sampai MENYENTUH garis frame paling atas.
// + 2 frame BARU (referensi gambar 3 = bingkai barok putih di atas hitam,
//   bulan sabit, arwah di sisi, tengkorak + lilin) yang lebih menarik & serem.
//
// Keluaran 8 PNG di public/bingkai/:
//   dangdut-idola-desa-916/169.png   (diperbarui — teks ke atas)
//   horor-alam-gaib-916/169.png      (diperbarui — teks ke atas)
//   dangdut-idola-desa-2-916/169.png (BARU — premium panggung emas)
//   horor-alam-gaib-2-916/169.png    (BARU — filigri putih + bulan sabit)
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

/* ============ HELPER GAMBAR ============ */

/** Bintang kilau 4 titik */
export function star4(x: number, y: number, r: number, op = 1, fill = "#ffe9a8"): string {
  const k = (r * 0.16).toFixed(1);
  return (
    `<path transform="translate(${x.toFixed(1)} ${y.toFixed(1)})" fill="${fill}" opacity="${op}" ` +
    `d="M0 ${-r} C ${k} ${-k} ${k} ${-k} ${r} 0 C ${k} ${k} ${k} ${k} 0 ${r} C ${-k} ${k} ${-k} ${k} ${-r} 0 C ${-k} ${-k} ${-k} ${-k} 0 ${-r} Z"/>`
  );
}

/** Tetesan darah menggantung dari garis y (kepala + butir bulat) */
export function tetes(x: number, y: number, len: number, w = 5, warna = "#a5121e"): string {
  const e = y + len;
  return (
    `<path fill="${warna}" d="M ${(x - w / 2).toFixed(1)} ${y.toFixed(1)} ` +
    `C ${(x - w / 2).toFixed(1)} ${(y + len * 0.45).toFixed(1)} ${(x - w * 0.35).toFixed(1)} ${(e - w).toFixed(1)} ${x.toFixed(1)} ${e.toFixed(1)} ` +
    `C ${(x + w * 0.35).toFixed(1)} ${(e - w).toFixed(1)} ${(x + w / 2).toFixed(1)} ${(y + len * 0.45).toFixed(1)} ${(x + w / 2).toFixed(1)} ${y.toFixed(1)} Z"/>`
  );
}

/** Siluet kelelawar kecil (s = skala) */
export function kelelawar(x: number, y: number, s: number, flip = false, warna = "#1d1d1f"): string {
  const d =
    "M0 0 C-3 -6 -8 -9 -15 -8 C-11 -5 -12 -1 -17 2 C-9 1 -6 3 -4 8 C-2 4 2 4 4 8 " +
    "C6 3 9 1 17 2 C12 -1 11 -5 15 -8 C8 -9 3 -6 0 0 Z";
  return `<path transform="translate(${x} ${y}) scale(${flip ? -s : s} ${s})" fill="${warna}" d="${d}"/>`;
}

/** Spiral ukiran (curl) utk sudut bingkai emas */
export function curl(x: number, y: number, s: number, rot: number, warna: string, sw = 3): string {
  const d =
    "M0 0 C -26 -4 -40 14 -30 30 C -22 42 -6 38 -6 26 C -6 18 -14 15 -19 21 " +
    "M0 0 C 6 -18 26 -26 44 -18 C 60 -11 62 8 50 12 C 41 15 35 7 40 0";
  return `<path transform="translate(${x} ${y}) rotate(${rot}) scale(${s})" fill="none" stroke="${warna}" stroke-width="${sw}" stroke-linecap="round" d="${d}"/>`;
}

/** Pohon+laur gabus? tidak — daun kecil flourish utk sudut premium */
export function daun(x: number, y: number, s: number, rot: number, warna: string): string {
  const d = "M0 0 C 10 -6 22 -6 30 2 C 22 10 10 10 0 0 Z M0 0 C -10 -6 -22 -6 -30 2 C -22 10 -10 10 0 0 Z";
  return `<path transform="translate(${x} ${y}) rotate(${rot}) scale(${s})" fill="${warna}" opacity="0.9" d="${d}"/>`;
}

/* ============ DESEN 1 — DANGDUT IDOLA DESA (DIPERBARUI) ============ */

export function svgDangdut(r: Rasio): string {
  const { W, H, l } = r;
  const s = Math.min(W, H) / 1080; // skala goresan
  const inset = Math.round(24 * s);
  const rx = Math.round(46 * s);
  const fsBesar = l ? 116 : 148;
  fsBesar; // baseline dihitung dari cap-height di bawah
  const baseline1 = l ? 146 : 158;
  const fsKecil = l ? 70 : 90;
  const baseline2 = l ? 250 : 268;
  const yDiv = l ? 300 : 322;
  const fsBand = l ? 34 : 42;

  const notKiri = l ? "♪" : "♪";
  const notKanan = l ? "♫" : "♫";

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<defs>` +
    // latar HANYA zona atas & pita bawah — TENGAH TRANSPARAN (video terlihat)
    `<linearGradient id="bgAtas" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="#4d0b09" stop-opacity="0.98"/><stop offset="0.5" stop-color="#2b0505" stop-opacity="0.9"/><stop offset="1" stop-color="#1a0303" stop-opacity="0"/>` +
    `</linearGradient>` +
    `<radialGradient id="hangat" cx="0.5" cy="0.5" r="0.5">` +
    `<stop offset="0" stop-color="#8a2a10" stop-opacity="0.85"/><stop offset="1" stop-color="#8a2a10" stop-opacity="0"/>` +
    `</radialGradient>` +
    `<linearGradient id="emas" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="#fff3b0"/><stop offset="0.3" stop-color="#ffd76b"/><stop offset="0.55" stop-color="#d9a637"/><stop offset="0.85" stop-color="#8a5a14"/><stop offset="1" stop-color="#c9962e"/>` +
    `</linearGradient>` +
    `<linearGradient id="band" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="#3d0707" stop-opacity="0"/><stop offset="0.45" stop-color="#3d0707" stop-opacity="0.9"/><stop offset="1" stop-color="#4d0b09" stop-opacity="0.96"/>` +
    `</linearGradient>` +
    `<filter id="glowB" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="${(9 * s).toFixed(1)}"/></filter>` +
    `<filter id="glowS" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="${(4 * s).toFixed(1)}"/></filter>` +
    `</defs>` +
    // latar zona atas + sorot hangat di balik teks (tengah tetap transparan)
    `<rect x="0" y="0" width="${W}" height="${(470 * s).toFixed(0)}" fill="url(#bgAtas)"/>` +
    `<ellipse cx="${W / 2}" cy="${(230 * (l ? 0.85 : 1)).toFixed(0)}" rx="${(W * 0.58).toFixed(0)}" ry="${(270 * s).toFixed(0)}" fill="url(#hangat)"/>` +
    // bingkai emas tipis ganda + pusaran sudut
    `<rect x="${inset}" y="${inset}" width="${W - 2 * inset}" height="${H - 2 * inset}" rx="${rx}" fill="none" stroke="#d8ab4a" stroke-width="${(4.2 * s).toFixed(1)}"/>` +
    `<rect x="${inset + 16 * s}" y="${inset + 16 * s}" width="${W - 2 * inset - 32 * s}" height="${H - 2 * inset - 32 * s}" rx="${(34 * s).toFixed(0)}" fill="none" stroke="#a97e2f" stroke-width="${(1.7 * s).toFixed(1)}" opacity="0.9"/>` +
    curl(inset + 34 * s, inset + 40 * s, 1.05 * s, 8, "#e3b95e", 3) +
    curl(W - inset - 34 * s, inset + 40 * s, 1.05 * s, 82, "#e3b95e", 3) +
    curl(W - inset - 34 * s, H - inset - 40 * s, 1.05 * s, 172, "#e3b95e", 3) +
    curl(inset + 34 * s, H - inset - 40 * s, 1.05 * s, 262, "#e3b95e", 3) +
    // TEKS BESAR — puncak huruf MENYENTUH garis bingkai atas (permintaan user)
    `<text x="${W / 2}" y="${baseline1}" text-anchor="middle" font-family="Cinzel Decorative" font-weight="bold" font-size="${fsBesar}" fill="#ff9d2e" opacity="0.6" filter="url(#glowB)">DANGDUT</text>` +
    `<text x="${W / 2}" y="${baseline1}" text-anchor="middle" font-family="Cinzel Decorative" font-weight="bold" font-size="${fsBesar}" fill="url(#emas)" stroke="#3a2504" stroke-width="${(1.6 * s).toFixed(1)}">DANGDUT</text>` +
    `<text x="${W / 2}" y="${baseline2}" text-anchor="middle" font-family="Cinzel Decorative" font-weight="bold" font-size="${fsKecil}" fill="#ffcf6e" opacity="0.55" filter="url(#glowS)">${notKiri} IDOLA DESA ${notKanan}</text>` +
    `<text x="${W / 2}" y="${baseline2}" text-anchor="middle" font-family="Cinzel Decorative" font-weight="bold" font-size="${fsKecil}" fill="url(#emas)" stroke="#3a2504" stroke-width="${(1.2 * s).toFixed(1)}">` +
    `<tspan font-family="DejaVu Sans" font-weight="bold">${notKiri}</tspan> IDOLA DESA <tspan font-family="DejaVu Sans" font-weight="bold">${notKanan}</tspan></text>` +
    // pembatas garis + wajik
    `<line x1="${W / 2 - 250 * s}" y1="${yDiv}" x2="${W / 2 - 34 * s}" y2="${yDiv}" stroke="#c9962e" stroke-width="${(2.2 * s).toFixed(1)}"/>` +
    `<line x1="${W / 2 + 34 * s}" y1="${yDiv}" x2="${W / 2 + 250 * s}" y2="${yDiv}" stroke="#c9962e" stroke-width="${(2.2 * s).toFixed(1)}"/>` +
    `<rect x="${W / 2 - 9 * s}" y="${yDiv - 9 * s}" width="${18 * s}" height="${18 * s}" transform="rotate(45 ${W / 2} ${yDiv})" fill="#e9c25f"/>` +
    // kilau bintang
    star4(150 * s + (l ? 60 : 0), 300 * s, 15 * s, 0.95) +
    star4(W - 150 * s - (l ? 60 : 0), 330 * s, 12 * s, 0.9) +
    star4(120 * s, 130 * s, 11 * s, 0.85) +
    star4(W - 120 * s, 150 * s, 13 * s, 0.9) +
    star4(85 * s, 540 * s, 9 * s, 0.6) +
    star4(W - 85 * s, 600 * s, 10 * s, 0.65) +
    // pita bawah
    `<rect x="0" y="${H - 150 * s}" width="${W}" height="${150 * s}" fill="url(#band)"/>` +
    `<line x1="${W * 0.13}" y1="${H - 62 * s}" x2="${W * 0.13 + 110 * s}" y2="${H - 62 * s}" stroke="#c9962e" stroke-width="${(1.8 * s).toFixed(1)}"/>` +
    `<line x1="${W * 0.87}" y1="${H - 62 * s}" x2="${W * 0.87 - 110 * s}" y2="${H - 62 * s}" stroke="#c9962e" stroke-width="${(1.8 * s).toFixed(1)}"/>` +
    `<text x="${W / 2}" y="${H - 50 * s}" text-anchor="middle" font-family="Cinzel Decorative" font-weight="bold" font-size="${fsBand}" fill="#e9c25f">` +
    `<tspan font-family="DejaVu Sans">${notKiri}</tspan> DANGDUT IDOLA DESA <tspan font-family="DejaVu Sans">${notKanan}</tspan></text>` +
    star4(210 * s, H - 90 * s, 10 * s, 0.8) +
    star4(W - 210 * s, H - 90 * s, 10 * s, 0.8) +
    `</svg>`
  );
}

/* ============ DESEN 2 — HOROR ALAM GAIB (DIPERBARUI) ============ */

export function svgHoror(r: Rasio): string {
  const { W, H, l } = r;
  const s = Math.min(W, H) / 1080;
  const inset = Math.round(22 * s);
  const rx = Math.round(40 * s);
  const fsBesar = l ? 116 : 150;
  const baseline1 = l ? 144 : 154;
  const fsKecil = l ? 70 : 92;
  const baseline2 = l ? 246 : 268;
  const fsBand = l ? 32 : 38;

  // tetesan darah di bawah teks (posisi relatif tengah)
  const dripY = baseline1 + 8 * s;
  const drips =
    tetes(W / 2 - fsBesar * 1.52, dripY, 52 * s, 6 * s) +
    tetes(W / 2 + fsBesar * 0.55, dripY, 74 * s, 6.5 * s) +
    tetes(W / 2 + fsBesar * 1.62, dripY, 40 * s, 5 * s) +
    tetes(W / 2 - fsBesar * 0.5, baseline2 + 8 * s, 46 * s, 5.5 * s) +
    tetes(W / 2 + fsBesar * 1.15, baseline2 + 8 * s, 64 * s, 6 * s);

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<defs>` +
    `<radialGradient id="tintMerah" cx="0.5" cy="0.5" r="0.5">` +
    `<stop offset="0" stop-color="#4d0a08" stop-opacity="0.7"/><stop offset="1" stop-color="#4d0a08" stop-opacity="0"/>` +
    `</radialGradient>` +
    `<radialGradient id="bulan" cx="0.5" cy="0.5" r="0.5">` +
    `<stop offset="0" stop-color="#cfd6dd" stop-opacity="0.26"/><stop offset="1" stop-color="#cfd6dd" stop-opacity="0"/>` +
    `</radialGradient>` +
    `<linearGradient id="darah" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="#ffffff"/><stop offset="0.42" stop-color="#f3eef0"/><stop offset="0.62" stop-color="#d94343"/><stop offset="1" stop-color="#8f1420"/>` +
    `</linearGradient>` +
    `<linearGradient id="gelapAtas" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="#000" stop-opacity="0.62"/><stop offset="1" stop-color="#000" stop-opacity="0"/>` +
    `</linearGradient>` +
    `<linearGradient id="kabutB" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="#0a0a0b" stop-opacity="0"/><stop offset="1" stop-color="#20242a" stop-opacity="0.55"/>` +
    `</linearGradient>` +
    `<filter id="hGlow" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="${(11 * s).toFixed(1)}"/></filter>` +
    `<filter id="kabut" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="${(26 * s).toFixed(1)}"/></filter>` +
    `</defs>` +
    // zona atas saja — TENGAH TRANSPARAN (video terlihat)
    `<rect x="0" y="0" width="${W}" height="${(480 * s).toFixed(0)}" fill="url(#gelapAtas)"/>` +
    `<ellipse cx="${W / 2}" cy="${(210 * s).toFixed(0)}" rx="${(W * 0.52).toFixed(0)}" ry="${(300 * s).toFixed(0)}" fill="url(#tintMerah)"/>` +
    // pendaran bulan + kelelawar
    `<circle cx="${W * 0.79}" cy="${(150 * s).toFixed(0)}" r="${(160 * s).toFixed(0)}" fill="url(#bulan)"/>` +
    kelelawar(120 * s, 150 * s, 1.5 * s, false, "#232326") +
    kelelawar(230 * s, 105 * s, 1.05 * s, true, "#1d1d20") +
    kelelawar(W * 0.62, 95 * s, 0.9 * s, false, "#202023") +
    kelelawar(W - 200 * s, 320 * s, 1.2 * s, true, "#1f1f22") +
    // bingkai jahitan merah
    `<rect x="${inset}" y="${inset}" width="${W - 2 * inset}" height="${H - 2 * inset}" rx="${rx}" fill="none" stroke="#cc3a2e" stroke-width="${(5 * s).toFixed(1)}" stroke-dasharray="${(15 * s).toFixed(0)} ${(10 * s).toFixed(0)}" stroke-linecap="round"/>` +
    `<rect x="${inset + 13 * s}" y="${inset + 13 * s}" width="${W - 2 * inset - 26 * s}" height="${H - 2 * inset - 26 * s}" rx="${(30 * s).toFixed(0)}" fill="none" stroke="#6e1a12" stroke-width="${(2 * s).toFixed(1)}" stroke-dasharray="${(6 * s).toFixed(0)} ${(9 * s).toFixed(0)}"/>` +
    // goresan cakaran sudut
    `<path d="M ${inset + 26 * s} ${inset + 90 * s} q ${26 * s} ${-34 * s} ${64 * s} ${-40 * s}" stroke="#7a140c" stroke-width="${(2.4 * s).toFixed(1)}" fill="none" opacity="0.85"/>` +
    `<path d="M ${W - inset - 26 * s} ${H - inset - 90 * s} q ${-26 * s} ${34 * s} ${-64 * s} ${40 * s}" stroke="#7a140c" stroke-width="${(2.4 * s).toFixed(1)}" fill="none" opacity="0.85"/>` +
    // TEKS BESAR — menyentuh garis bingkai atas
    `<text x="${W / 2}" y="${baseline1}" text-anchor="middle" font-family="Cinzel Decorative" font-weight="bold" font-size="${fsBesar}" fill="#ff2b1f" opacity="0.55" filter="url(#hGlow)">HOROR</text>` +
    `<text x="${W / 2}" y="${baseline1}" text-anchor="middle" font-family="Cinzel Decorative" font-weight="bold" font-size="${fsBesar}" fill="url(#darah)" stroke="#2b0305" stroke-width="${(1.6 * s).toFixed(1)}">HOROR</text>` +
    `<text x="${W / 2}" y="${baseline2}" text-anchor="middle" font-family="Cinzel Decorative" font-weight="bold" font-size="${fsKecil}" fill="url(#darah)" stroke="#2b0305" stroke-width="${(1.2 * s).toFixed(1)}" opacity="0.96">ALAM GAIB</text>` +
    drips +
    // kabut bawah + pita teks
    `<rect x="0" y="${H - 300 * s}" width="${W}" height="${300 * s}" fill="url(#kabutB)"/>` +
    `<ellipse cx="${W * 0.3}" cy="${(H - 170 * s).toFixed(0)}" rx="${(300 * s).toFixed(0)}" ry="${(52 * s).toFixed(0)}" fill="#aeb7c2" opacity="0.13" filter="url(#kabut)"/>` +
    `<ellipse cx="${W * 0.72}" cy="${(H - 130 * s).toFixed(0)}" rx="${(340 * s).toFixed(0)}" ry="${(46 * s).toFixed(0)}" fill="#aeb7c2" opacity="0.10" filter="url(#kabut)"/>` +
    kelelawar(W * 0.22, H - 74 * s, 1.15 * s, false, "#2a2f36") +
    kelelawar(W * 0.78, H - 74 * s, 1.15 * s, true, "#2a2f36") +
    `<text x="${W / 2}" y="${H - 48 * s}" text-anchor="middle" font-family="Cinzel Decorative" font-weight="bold" font-size="${fsBand}" fill="#c9ced6" letter-spacing="${(10 * s).toFixed(0)}">ALAM GAIB</text>` +
    `</svg>`
  );
}

/* ==== DESEN 3 — DANGDUT IDOLA DESA 2 (BARU, premium panggung emas) ==== */

export function svgDangdut2(r: Rasio): string {
  const { W, H, l } = r;
  const s = Math.min(W, H) / 1080;
  const inset = Math.round(24 * s);
  const rx = Math.round(48 * s);
  const fsBesar = l ? 118 : 150;
  const baseline1 = l ? 146 : 158;
  const plakatY = l ? 180 : 196;
  const plakatH = l ? 78 : 98;
  const fsPlakat = l ? 56 : 74;
  const yDiv = plakatY + plakatH + (l ? 26 : 34);
  const fsBand = l ? 32 : 40;

  // lampu panggung (marquee) di sepanjang dalam bingkai atas
  let lampu = "";
  const yLampu = inset + 20 * s;
  for (let x = 100 * s; x <= W - 100 * s; x += (l ? 46 : 36) * s) {
    const terang = Math.round(x / (l ? 46 : 36) / s) % 2 === 0;
    lampu +=
      `<circle cx="${x.toFixed(0)}" cy="${yLampu.toFixed(0)}" r="${(9 * s).toFixed(1)}" fill="#ffca5f" opacity="${terang ? 0.3 : 0.16}"/>` +
      `<circle cx="${x.toFixed(0)}" cy="${yLampu.toFixed(0)}" r="${(4.6 * s).toFixed(1)}" fill="${terang ? "#ffedbd" : "#c9992e"}"/>`;
  }
  // payet sisi (tipis) kiri & kanan
  let payet = "";
  for (const x of [inset + 36 * s, W - inset - 36 * s]) {
    for (let y = 430 * s; y <= H - 280 * s; y += 24 * s) {
      const terang = (Math.round(y / (24 * s)) % 4) === 0;
      payet += `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${(3.2 * s).toFixed(1)}" fill="${terang ? "#ffe08a" : "#c69534"}" opacity="${terang ? 0.95 : 0.7}"/>`;
    }
  }
  // berkas cahaya dari atas tengah — hanya di zona atas (tidak menutup video)
  let berkas = "";
  const batasBerkas = 540 * s;
  for (let i = -4; i <= 4; i++) {
    const a = i * 11;
    const panjang = batasBerkas;
    const x0 = W / 2;
    const x1 = x0 + Math.tan((a * Math.PI) / 180) * panjang;
    berkas += `<path d="M ${x0 - 26 * s} ${-20} L ${x0 + 26 * s} ${-20} L ${x1 + 60 * s} ${panjang} L ${x1 - 60 * s} ${panjang} Z" fill="#ffcf6e" opacity="${0.055 + (Math.abs(i) % 2) * 0.028}"/>`;
  }
  // bokeh emas
  let bokeh = "";
  const bh: [number, number, number, number][] = l
    ? [[180, 340, 16, 0.25], [420, 260, 9, 0.2], [1500, 330, 18, 0.22], [1700, 430, 8, 0.18], [960, 210, 7, 0.3], [300, 940, 11, 0.2], [1620, 950, 12, 0.18]]
    : [[180, 420, 16, 0.25], [420, 330, 9, 0.2], [900, 380, 18, 0.22], [1010, 470, 8, 0.18], [560, 250, 7, 0.3], [940, H - 190, 12, 0.2], [70, H - 230, 8, 0.2], [1015, H - 210, 9, 0.18]];
  for (const [x, y, rr, op] of bh) bokeh += `<circle cx="${x * s}" cy="${y * s}" r="${(rr * s).toFixed(1)}" fill="#ffbf55" opacity="${op}" filter="url(#gBokeh)"/>`;

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<defs>` +
    // latar zona atas (merah panggung) — TENGAH TRANSPARAN
    `<linearGradient id="bg2Atas" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="#8a1414" stop-opacity="0.99"/><stop offset="0.55" stop-color="#4a0808" stop-opacity="0.94"/><stop offset="1" stop-color="#2a0404" stop-opacity="0"/>` +
    `</linearGradient>` +
    `<linearGradient id="emas2" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="#fff6c4"/><stop offset="0.28" stop-color="#ffdd7a"/><stop offset="0.55" stop-color="#dca93a"/><stop offset="0.85" stop-color="#8a5a14"/><stop offset="1" stop-color="#d3a13a"/>` +
    `</linearGradient>` +
    `<linearGradient id="plakat" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="#6b0d0d"/><stop offset="1" stop-color="#a01818"/>` +
    `</linearGradient>` +
    `<linearGradient id="band2" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="#2a0303" stop-opacity="0"/><stop offset="0.5" stop-color="#3a0606" stop-opacity="0.9"/><stop offset="1" stop-color="#4d0b09" stop-opacity="0.97"/>` +
    `</linearGradient>` +
    `<radialGradient id="panggung" cx="0.5" cy="0.5" r="0.5">` +
    `<stop offset="0" stop-color="#ff8f2e" stop-opacity="0.26"/><stop offset="1" stop-color="#ff8f2e" stop-opacity="0"/>` +
    `</radialGradient>` +
    `<filter id="gTeks" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="${(10 * s).toFixed(1)}"/></filter>` +
    `<filter id="gBokeh" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="${(5 * s).toFixed(1)}"/></filter>` +
    `</defs>` +
    `<rect x="0" y="0" width="${W}" height="${(560 * s).toFixed(0)}" fill="url(#bg2Atas)"/>` +
    berkas +
    bokeh +
    // bingkai emas ganda + filigri sudut
    `<rect x="${inset}" y="${inset}" width="${W - 2 * inset}" height="${H - 2 * inset}" rx="${rx}" fill="none" stroke="#eec873" stroke-width="${(5 * s).toFixed(1)}"/>` +
    `<rect x="${inset + 17 * s}" y="${inset + 17 * s}" width="${W - 2 * inset - 34 * s}" height="${H - 2 * inset - 34 * s}" rx="${(36 * s).toFixed(0)}" fill="none" stroke="#b8892f" stroke-width="${(2 * s).toFixed(1)}"/>` +
    curl(inset + 38 * s, inset + 46 * s, 1.15 * s, 8, "#eec873", 3.2) +
    curl(W - inset - 38 * s, inset + 46 * s, 1.15 * s, 82, "#eec873", 3.2) +
    curl(W - inset - 38 * s, H - inset - 46 * s, 1.15 * s, 172, "#eec873", 3.2) +
    curl(inset + 38 * s, H - inset - 46 * s, 1.15 * s, 262, "#eec873", 3.2) +
    daun(inset + 96 * s, inset + 30 * s, 1.1 * s, -8, "#d9a83c") +
    daun(W - inset - 96 * s, inset + 30 * s, 1.1 * s, 8, "#d9a83c") +
    lampu +
    // TEKS 3D — puncak menyentuh garis bingkai
    `<text x="${W / 2}" y="${baseline1}" text-anchor="middle" font-family="Cinzel Decorative" font-weight="bold" font-size="${fsBesar}" fill="#5e3a08" transform="translate(${(4 * s).toFixed(1)} ${(4 * s).toFixed(1)})">DANGDUT</text>` +
    `<text x="${W / 2}" y="${baseline1}" text-anchor="middle" font-family="Cinzel Decorative" font-weight="bold" font-size="${fsBesar}" fill="#7a4a0c" transform="translate(${(7 * s).toFixed(1)} ${(7 * s).toFixed(1)})">DANGDUT</text>` +
    `<text x="${W / 2}" y="${baseline1}" text-anchor="middle" font-family="Cinzel Decorative" font-weight="bold" font-size="${fsBesar}" fill="#ffb23e" opacity="0.55" filter="url(#gTeks)">DANGDUT</text>` +
    `<text x="${W / 2}" y="${baseline1}" text-anchor="middle" font-family="Cinzel Decorative" font-weight="bold" font-size="${fsBesar}" fill="url(#emas2)" stroke="#33210a" stroke-width="${(2 * s).toFixed(1)}">DANGDUT</text>` +
    // plakat merah "IDOLA DESA"
    `<rect x="${W / 2 - W * 0.31}" y="${plakatY}" width="${W * 0.62}" height="${plakatH}" rx="${(14 * s).toFixed(0)}" fill="url(#plakat)" stroke="#e8bd5c" stroke-width="${(3 * s).toFixed(1)}"/>` +
    `<rect x="${W / 2 - W * 0.31 + 8 * s}" y="${plakatY + 7 * s}" width="${W * 0.62 - 16 * s}" height="${plakatH - 14 * s}" rx="${(10 * s).toFixed(0)}" fill="none" stroke="#8a5a14" stroke-width="${(1.4 * s).toFixed(1)}" opacity="0.8"/>` +
    `<text x="${W / 2}" y="${plakatY + plakatH / 2 + fsPlakat * 0.34}" text-anchor="middle" font-family="Cinzel Decorative" font-weight="bold" font-size="${fsPlakat}" fill="#ffe9a8" stroke="#5e3a08" stroke-width="${(1.2 * s).toFixed(1)}">` +
    `<tspan font-family="DejaVu Sans">★</tspan> IDOLA DESA <tspan font-family="DejaVu Sans">★</tspan></text>` +
    // not balok melayang
    `<text x="${W / 2 - W * 0.36}" y="${plakatY + plakatH * 0.7}" font-family="DejaVu Sans" font-weight="bold" font-size="${(58 * s).toFixed(0)}" fill="#ffdd7a" transform="rotate(-12 ${W / 2 - W * 0.36} ${plakatY + plakatH * 0.7})">♪</text>` +
    `<text x="${W / 2 + W * 0.33}" y="${plakatY + plakatH * 0.75}" font-family="DejaVu Sans" font-weight="bold" font-size="${(52 * s).toFixed(0)}" fill="#ffdd7a" transform="rotate(12 ${W / 2 + W * 0.33} ${plakatY + plakatH * 0.75})">♫</text>` +
    star4(190 * s, 300 * s, 16 * s, 0.95) +
    star4(W - 190 * s, 320 * s, 13 * s, 0.9) +
    star4(300 * s, 120 * s, 10 * s, 0.8) +
    star4(W - 300 * s, 130 * s, 12 * s, 0.85) +
    payet +
    // sorot panggung + pita bawah
    `<ellipse cx="${W * 0.25}" cy="${H + 30 * s}" rx="${(360 * s).toFixed(0)}" ry="${(210 * s).toFixed(0)}" fill="url(#panggung)"/>` +
    `<ellipse cx="${W * 0.75}" cy="${H + 30 * s}" rx="${(360 * s).toFixed(0)}" ry="${(210 * s).toFixed(0)}" fill="url(#panggung)"/>` +
    `<rect x="0" y="${H - 150 * s}" width="${W}" height="${150 * s}" fill="url(#band2)"/>` +
    `<line x1="${W * 0.12}" y1="${H - 60 * s}" x2="${W * 0.12 + 120 * s}" y2="${H - 60 * s}" stroke="#e8bd5c" stroke-width="${(2 * s).toFixed(1)}"/>` +
    `<line x1="${W * 0.88}" y1="${H - 60 * s}" x2="${W * 0.88 - 120 * s}" y2="${H - 60 * s}" stroke="#e8bd5c" stroke-width="${(2 * s).toFixed(1)}"/>` +
    `<text x="${W / 2}" y="${H - 46 * s}" text-anchor="middle" font-family="Cinzel Decorative" font-weight="bold" font-size="${fsBand}" fill="#ffe1a0" letter-spacing="${(6 * s).toFixed(0)}">DANGDUT IDOLA DESA</text>` +
    star4(230 * s, H - 84 * s, 11 * s, 0.85) +
    star4(W - 230 * s, H - 84 * s, 11 * s, 0.85) +
    `</svg>`
  );
}

/* ==== DESEN 4 — HOROR ALAM GAIB 2 (BARU, filigri putih ala referensi 3) ==== */

/** arwah/kelambu hantu: tubuh putih pudar bermata jorok miring (serem) */
export function arwah(x: number, y: number, sc: number, flip = false): string {
  const d =
    "M0 -58 C -26 -58 -34 -36 -34 -16 C -34 -4 -36 8 -34 22 C -30 14 -26 18 -24 28 " +
    "C -20 20 -16 24 -14 34 C -10 26 -6 28 -4 38 C 0 28 4 30 6 38 C 8 28 12 26 14 34 " +
    "C 16 24 20 20 24 28 C 26 18 30 14 34 22 C 36 8 34 -4 34 -16 C 34 -36 26 -58 0 -58 Z";
  const mata =
    `<ellipse cx="-11" cy="-26" rx="4.6" ry="8.5" fill="#0a0a0c" transform="rotate(18 -11 -26)"/>` +
    `<ellipse cx="11" cy="-26" rx="4.6" ry="8.5" fill="#0a0a0c" transform="rotate(-18 11 -26)"/>` +
    `<ellipse cx="0" cy="-4" rx="5.5" ry="10" fill="#0a0a0c"/>`;
  return (
    `<g transform="translate(${x} ${y}) scale(${flip ? -sc : sc} ${sc})">` +
    `<path d="${d}" fill="#c9ced6" opacity="0.55" filter="url(#h2Glow)"/>` +
    `<path d="${d}" fill="#d6dbe2" opacity="0.92"/>${mata}</g>`
  );
}

/** sulur berduri sepanjang sisi (duri keluar-masuk) */
function sulur(x1: number, y1: number, x2: number, y2: number, amp: number, warna: string, sw: number): string {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  const n = Math.max(6, Math.round(len / 64));
  const ux = dx / len;
  const uy = dy / len;
  const nx = -uy;
  const ny = ux;
  let d = `M ${x1.toFixed(1)} ${y1.toFixed(1)}`;
  let thorn = "";
  for (let i = 0; i < n; i++) {
    const t0 = i / n;
    const t1 = (i + 0.5) / n;
    const t2 = (i + 1) / n;
    const sgn = i % 2 === 0 ? 1 : -1;
    const cx = x1 + dx * t1 + nx * amp * sgn;
    const cy = y1 + dy * t1 + ny * amp * sgn;
    const ex = x1 + dx * t2;
    const ey = y1 + dy * t2;
    d += ` Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}`;
    if (i % 2 === 0) {
      // duri segitiga ke arah luar (normal × arah maju)
      const bx = x1 + dx * (t1 - 0.06);
      const by = y1 + dy * (t1 - 0.06);
      const px = bx + nx * (amp + 7) * sgn;
      const py = by + ny * (amp + 7) * sgn;
      thorn += `<path d="M ${(bx + nx * amp * sgn * 0.8).toFixed(1)} ${(by + ny * amp * sgn * 0.8).toFixed(1)} L ${px.toFixed(1)} ${py.toFixed(1)} L ${(bx + ux * 8 + nx * amp * sgn * 0.55).toFixed(1)} ${(by + uy * 8 + ny * amp * sgn * 0.55).toFixed(1)} Z" fill="${warna}"/>`;
    }
  }
  return `<path d="${d}" fill="none" stroke="${warna}" stroke-width="${sw}" stroke-linecap="round"/>` + thorn;
}

export function svgHoror2(r: Rasio): string {
  const { W, H, l } = r;
  const s = Math.min(W, H) / 1080;
  const inset = Math.round(26 * s);
  const rx = Math.round(30 * s);
  const fsBesar = l ? 150 : 168;
  const baseline1 = l ? 176 : 196;
  const fsKecil = l ? 84 : 96;
  const baseline2 = l ? 300 : 330;
  const bulanCy = l ? 132 : 168;
  const bulanR = l ? 108 : 128;
  const tengkorakCy = H - (l ? 190 : 235) * s;

  // sulur di 4 sisi (dalam bingkai, sisi TIPIS)
  const sulurTop = sulur(inset + 70 * s, inset + 16 * s, W - inset - 70 * s, inset + 16 * s, 9 * s, "#dfe3e9", 2.2 * s);
  const sulurBawah = sulur(inset + 70 * s, H - inset - 16 * s, W - inset - 70 * s, H - inset - 16 * s, 9 * s, "#dfe3e9", 2.2 * s);
  const sulurKiri = sulur(inset + 16 * s, inset + 80 * s, inset + 16 * s, H - inset - 80 * s, 6 * s, "#cfd4da", 1.8 * s);
  const sulurKanan = sulur(W - inset - 16 * s, inset + 80 * s, W - inset - 16 * s, H - inset - 80 * s, 6 * s, "#cfd4da", 1.8 * s);

  // bulan sabit (mask: lingkaran penuh − lingkaran gigitan)
  const mx = W / 2;
  const my = bulanCy;
  const sabit =
    `<mask id="sabitM">` +
    `<rect x="0" y="0" width="${W}" height="${H}" fill="black"/>` +
    `<circle cx="${mx}" cy="${my}" r="${bulanR}" fill="white"/>` +
    `<circle cx="${mx + bulanR * 0.44}" cy="${my - bulanR * 0.1}" r="${bulanR * 0.86}" fill="black"/>` +
    `</mask>` +
    `<circle cx="${mx}" cy="${my}" r="${bulanR}" fill="#eef1f5" opacity="0.5" filter="url(#h2Glow)" mask="url(#sabitM)"/>` +
    `<circle cx="${mx}" cy="${my}" r="${bulanR}" fill="#eef1f5" opacity="0.95" mask="url(#sabitM)"/>` +
    // wajah bulan: mata terpejam + senyum tipis (aura gaib)
    `<g mask="url(#sabitM)" opacity="0.85">` +
    `<path d="M ${mx - bulanR * 0.52} ${my - bulanR * 0.08} q ${-9 * (bulanR / 128)} ${6 * (bulanR / 128)} ${-18 * (bulanR / 128)} 0" stroke="#3a3f46" stroke-width="${(3 * s).toFixed(1)}" fill="none" stroke-linecap="round"/>` +
    `<path d="M ${mx - bulanR * 0.5} ${my + bulanR * 0.34} q ${12 * (bulanR / 128)} ${9 * (bulanR / 128)} ${24 * (bulanR / 128)} 0" stroke="#3a3f46" stroke-width="${(3 * s).toFixed(1)}" fill="none" stroke-linecap="round"/>` +
    `</g>`;

  // tengkorak + lilin di bawah tengah
  const sk = s;
  const tengkorak =
    `<g transform="translate(${mx} ${tengkorakCy}) scale(${sk})">` +
    `<path d="M0 -46 C -30 -46 -38 -24 -38 -6 C -38 8 -30 16 -22 20 L -22 32 C -22 38 -16 42 -8 42 L 8 42 C 16 42 22 38 22 32 L 22 20 C 30 16 38 8 38 -6 C 38 -24 30 -46 0 -46 Z" fill="#e6e9ee" opacity="0.95"/>` +
    `<ellipse cx="-14" cy="-8" rx="8.5" ry="10" fill="#0a0a0c"/>` +
    `<ellipse cx="14" cy="-8" rx="8.5" ry="10" fill="#0a0a0c"/>` +
    `<path d="M0 4 L -6 18 L 6 18 Z" fill="#0a0a0c"/>` +
    `<rect x="-16" y="30" width="4.5" height="10" fill="#0a0a0c"/><rect x="-9" y="30" width="4.5" height="10" fill="#0a0a0c"/>` +
    `<rect x="-2.2" y="30" width="4.5" height="10" fill="#0a0a0c"/><rect x="4.6" y="30" width="4.5" height="10" fill="#0a0a0c"/>` +
    `<rect x="11.5" y="30" width="4.5" height="10" fill="#0a0a0c"/>` +
    `</g>`;
  let lilin = "";
  const posisiLilin: [number, number][] = l
    ? [[-200, 0], [-150, -14], [150, -14], [200, 0]]
    : [[-190, 0], [-135, -16], [135, -16], [190, 0]];
  for (const [ox, oy] of posisiLilin) {
    const cx = mx + ox * s;
    const cy = H - (l ? 120 : 128) * s + oy * s;
    lilin +=
      `<rect x="${(cx - 8 * s).toFixed(1)}" y="${(cy - 44 * s).toFixed(1)}" width="${(16 * s).toFixed(1)}" height="${(44 * s).toFixed(1)}" rx="${(4 * s).toFixed(1)}" fill="#dfe3e8" opacity="0.92"/>` +
      `<line x1="${cx.toFixed(1)}" y1="${(cy - 44 * s).toFixed(1)}" x2="${cx.toFixed(1)}" y2="${(cy - 54 * s).toFixed(1)}" stroke="#8a8f96" stroke-width="${(2 * s).toFixed(1)}"/>` +
      `<circle cx="${cx.toFixed(1)}" cy="${(cy - 66 * s).toFixed(1)}" r="${(13 * s).toFixed(1)}" fill="#ffd76b" opacity="0.28" filter="url(#h2Soft)"/>` +
      `<path d="M ${cx.toFixed(1)} ${(cy - 76 * s).toFixed(1)} C ${(cx + 6 * s).toFixed(1)} ${(cy - 66 * s).toFixed(1)} ${(cx + 4.5 * s).toFixed(1)} ${(cy - 58 * s).toFixed(1)} ${cx.toFixed(1)} ${(cy - 56 * s).toFixed(1)} C ${(cx - 4.5 * s).toFixed(1)} ${(cy - 58 * s).toFixed(1)} ${(cx - 6 * s).toFixed(1)} ${(cy - 66 * s).toFixed(1)} ${cx.toFixed(1)} ${(cy - 76 * s).toFixed(1)} Z" fill="#ffe9a8"/>`;
  }

  // posisi arwah
  const arwahKiri = l
    ? arwah(inset + 120 * s, H * 0.6, 1.35 * s) + arwah(inset + 95 * s, H * 0.32, 0.9 * s, true)
    : arwah(inset + 118 * s, H * 0.52, 1.5 * s) + arwah(inset + 90 * s, H * 0.3, 0.95 * s, true);
  const arwahKanan = l
    ? arwah(W - inset - 120 * s, H * 0.6, 1.35 * s, true) + arwah(W - inset - 95 * s, H * 0.32, 0.9 * s)
    : arwah(W - inset - 118 * s, H * 0.52, 1.5 * s, true) + arwah(W - inset - 90 * s, H * 0.3, 0.95 * s);

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<defs>` +
    `<radialGradient id="buln" cx="0.5" cy="0.5" r="0.5">` +
    `<stop offset="0" stop-color="#0a0a0b" stop-opacity="0.55"/><stop offset="1" stop-color="#0a0a0b" stop-opacity="0"/>` +
    `</radialGradient>` +
    `<linearGradient id="gelapH2" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="#060607" stop-opacity="0.93"/><stop offset="0.7" stop-color="#060607" stop-opacity="0.55"/><stop offset="1" stop-color="#060607" stop-opacity="0"/>` +
    `</linearGradient>` +
    `<linearGradient id="kabut2" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="#0a0a0b" stop-opacity="0"/><stop offset="1" stop-color="#23272e" stop-opacity="0.5"/>` +
    `</linearGradient>` +
    `<filter id="h2Glow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="${(12 * s).toFixed(1)}"/></filter>` +
    `<filter id="h2Soft" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="${(5 * s).toFixed(1)}"/></filter>` +
    `<filter id="h2Merah" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="${(13 * s).toFixed(1)}"/></filter>` +
    `</defs>` +
    // zona atas gelap (bulan + teks) & zona bawah (tengkorak) — TENGAH TRANSPARAN
    `<rect x="0" y="0" width="${W}" height="${(600 * s).toFixed(0)}" fill="url(#gelapH2)"/>` +
    `<circle cx="${W / 2}" cy="${bulanCy}" r="${(bulanR * 1.5).toFixed(0)}" fill="url(#buln)" opacity="0.5"/>` +
    `<ellipse cx="${W * 0.2}" cy="${(H - 150 * s).toFixed(0)}" rx="${(280 * s).toFixed(0)}" ry="${(60 * s).toFixed(0)}" fill="#aeb7c2" opacity="0.09" filter="url(#h2Glow)"/>` +
    `<ellipse cx="${W * 0.8}" cy="${(H - 190 * s).toFixed(0)}" rx="${(240 * s).toFixed(0)}" ry="${(50 * s).toFixed(0)}" fill="#aeb7c2" opacity="0.07" filter="url(#h2Glow)"/>` +
    sabit +
    star4(mx - bulanR - 46 * s, my - bulanR * 0.4, 9 * s, 0.8, "#e8ecf2") +
    star4(mx + bulanR + 40 * s, my + bulanR * 0.2, 7 * s, 0.7, "#e8ecf2") +
    star4(mx + bulanR * 0.9, my - bulanR - 30 * s, 6 * s, 0.6, "#e8ecf2") +
    // bingkai dasar + sulur duri
    `<rect x="${inset}" y="${inset}" width="${W - 2 * inset}" height="${H - 2 * inset}" rx="${rx}" fill="none" stroke="#e4e8ee" stroke-width="${(2.6 * s).toFixed(1)}" opacity="0.85"/>` +
    sulurTop + sulurBawah + sulurKiri + sulurKanan +
    // filigri sudut (3 spiral bertingkat)
    curl(inset + 52 * s, inset + 52 * s, 1.35 * s, 98, "#eef1f5", 2.6) +
    curl(inset + 86 * s, inset + 44 * s, 0.8 * s, 30, "#cfd4da", 2) +
    curl(W - inset - 52 * s, inset + 52 * s, 1.35 * s, 8, "#eef1f5", 2.6) +
    curl(W - inset - 86 * s, inset + 44 * s, 0.8 * s, 60, "#cfd4da", 2) +
    curl(W - inset - 52 * s, H - inset - 52 * s, 1.35 * s, 278, "#eef1f5", 2.6) +
    curl(W - inset - 86 * s, H - inset - 44 * s, 0.8 * s, 240, "#cfd4da", 2) +
    curl(inset + 52 * s, H - inset - 52 * s, 1.35 * s, 188, "#eef1f5", 2.6) +
    curl(inset + 86 * s, H - inset - 44 * s, 0.8 * s, 150, "#cfd4da", 2) +
    arwahKiri + arwahKanan +
    // TEKS BESAR — menyentuh garis bingkai atas, darah merah menyala
    `<text x="${W / 2}" y="${baseline1}" text-anchor="middle" font-family="Creepster" font-size="${fsBesar}" fill="#ff1f1f" opacity="0.6" filter="url(#h2Merah)" transform="rotate(-2 ${W / 2} ${baseline1})">HOROR</text>` +
    `<text x="${W / 2}" y="${baseline1}" text-anchor="middle" font-family="Creepster" font-size="${fsBesar}" fill="#f2f4f6" stroke="#3a0507" stroke-width="${(1.6 * s).toFixed(1)}" transform="rotate(-2 ${W / 2} ${baseline1})">HOROR</text>` +
    `<text x="${W / 2}" y="${baseline2}" text-anchor="middle" font-family="Creepster" font-size="${fsKecil}" fill="#dfe3e8" stroke="#3a0507" stroke-width="${(1.1 * s).toFixed(1)}" letter-spacing="${(6 * s).toFixed(0)}" transform="rotate(-1 ${W / 2} ${baseline2})">ALAM GAIB</text>` +
    tetes(W / 2 - fsBesar * 1.35, baseline1 + 10 * s, 56 * s, 6 * s, "#7e0d12") +
    tetes(W / 2 + fsBesar * 0.7, baseline1 + 10 * s, 78 * s, 7 * s, "#7e0d12") +
    tetes(W / 2 - fsBesar * 0.2, baseline2 + 8 * s, 44 * s, 5 * s, "#7e0d12") +
    // tengkorak + lilin + kabut bawah
    `<rect x="0" y="${H - 320 * s}" width="${W}" height="${320 * s}" fill="url(#kabut2)"/>` +
    // latar lembut di belakang tengkorak + teks bawah agar terbaca di atas video
    `<ellipse cx="${W / 2}" cy="${(H - 150 * s).toFixed(0)}" rx="${(W * 0.46).toFixed(0)}" ry="${(170 * s).toFixed(0)}" fill="url(#buln)"/>` +
    lilin + tengkorak +
    `<text x="${W / 2}" y="${H - 44 * s}" text-anchor="middle" font-family="Creepster" font-size="${(30 * s).toFixed(0)}" fill="#c9ced6" letter-spacing="${(12 * s).toFixed(0)}">ALAM GAIB</text>` +
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
  ["dangdut-idola-desa", svgDangdut],
  ["horor-alam-gaib", svgHoror],
  ["dangdut-idola-desa-2", svgDangdut2],
  ["horor-alam-gaib-2", svgHoror2],
];

for (const [slug, fn] of daftar) {
  await render(`${slug}-916.png`, fn(R916));
  await render(`${slug}-169.png`, fn(R169));
}
console.log("SELESAI →", OUT);
