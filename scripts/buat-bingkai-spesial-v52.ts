// VidSplit v0.52.0 — GENERATOR 7 FRAME HOROR "ALAM GAIB" (SVG → sharp → PNG)
// Dijalankan: bun scripts/buat-bingkai-spesial-v52.ts
//
// Permintaan user: tambah 7 frame LAGI bertema HOROR di menu Frame & bingkai,
// dengan tulisan "ALAM GAIB" di bagian ATAS frame (referensi: 2 gambar gothic
// berisi tengkorak bertanduk, iblis, sulur & ornamen gelap). SYARAT PENTING
// user: SISI KIRI-KANAN frame HARUS TIPIS (video tetap luas terlihat).
//
// Mengikuti pelajaran keluarga frame spesial (v0.47–v0.50):
//   • latar HANYA zona atas + pita bawah — TENGAH TRANSPARAN (video terlihat)
//   • teks "ALAM GAIB" puncaknya MENYENTUH garis bingkai atas (baseline dari
//     cap-height Creepster 0.75em — diukur scripts/probe-font-v52.ts)
//   • v0.54.0: SEMUA teks selain "ALAM GAIB" atas DIHAPUS (nama desain & pita)
//   • bingkai dobel TIPIS + hiasan sisi selebar maks ±11% lebar per sisi
//     (diverifikasi uji-bingkai-alpha-v52.ts: strip 13–87% tengah kosong)
//   • tiap rasio varian sendiri: -916.png (1080×1920) & -169.png (1920×1080)
//   • font WAJIB terpasang di fontconfig (~/.fonts) sebelum render
// Keluaran 14 PNG di public/bingkai/: horor-alam-gaib-3..9-916.png / -169.png
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

/* ==================== HELPER ELEMEN HOROR ==================== */

/** Bintang kilau 4 titik */
export function star4(x: number, y: number, r: number, op = 1, fill = "#e8e4d8"): string {
  const k = (r * 0.16).toFixed(1);
  return (
    `<path transform="translate(${x.toFixed(1)} ${y.toFixed(1)})" fill="${fill}" opacity="${op}" ` +
    `d="M0 ${-r} C ${k} ${-k} ${k} ${-k} ${r} 0 C ${k} ${k} ${k} ${k} 0 ${r} C ${-k} ${k} ${-k} ${k} ${-r} 0 C ${-k} ${-k} ${-k} ${-k} 0 ${-r} Z"/>`
  );
}

/** Tetesan darah menggantung dari garis y (pelajaran v0.49) */
export function tetes(x: number, y: number, len: number, w = 5, warna = "#a5121e"): string {
  const e = y + len;
  return (
    `<path fill="${warna}" d="M ${(x - w / 2).toFixed(1)} ${y.toFixed(1)} ` +
    `C ${(x - w / 2).toFixed(1)} ${(y + len * 0.45).toFixed(1)} ${(x - w * 0.35).toFixed(1)} ${(e - w).toFixed(1)} ${x.toFixed(1)} ${e.toFixed(1)} ` +
    `C ${(x + w * 0.35).toFixed(1)} ${(e - w).toFixed(1)} ${(x + w / 2).toFixed(1)} ${(y + len * 0.45).toFixed(1)} ${(x + w / 2).toFixed(1)} ${y.toFixed(1)} Z"/>`
  );
}

/** Kelelawar siluet (v0.49) */
export function kelelawar(x: number, y: number, s: number, flip = false, warna = "#1d1d1f"): string {
  const d =
    "M0 0 C-3 -6 -8 -9 -15 -8 C-11 -5 -12 -1 -17 2 C-9 1 -6 3 -4 8 C-2 4 2 4 4 8 " +
    "C6 3 9 1 17 2 C12 -1 11 -5 15 -8 C8 -9 3 -6 0 0 Z";
  return `<path transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${flip ? -s : s} ${s})" fill="${warna}" d="${d}"/>`;
}

/** Tengkorak kecil (bentuk v0.49, skala bebas) — lebar ±38, tinggi ±46+ */
export function tengkorak(x: number, y: number, sc: number, tulang = "#e6e9ee", mata = "#0a0a0c", op = 1): string {
  return (
    `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${sc})" opacity="${op}">` +
    `<path d="M0 -46 C -30 -46 -38 -24 -38 -6 C -38 8 -30 16 -22 20 L -22 32 C -22 38 -16 42 -8 42 L 8 42 C 16 42 22 38 22 32 L 22 20 C 30 16 38 8 38 -6 C 38 -24 30 -46 0 -46 Z" fill="${tulang}"/>` +
    `<ellipse cx="-14" cy="-8" rx="8.5" ry="10" fill="${mata}"/>` +
    `<ellipse cx="14" cy="-8" rx="8.5" ry="10" fill="${mata}"/>` +
    `<path d="M0 4 L -6 18 L 6 18 Z" fill="${mata}"/>` +
    `<rect x="-16" y="30" width="4.5" height="10" fill="${mata}"/><rect x="-9" y="30" width="4.5" height="10" fill="${mata}"/>` +
    `<rect x="-2.2" y="30" width="4.5" height="10" fill="${mata}"/><rect x="4.6" y="30" width="4.5" height="10" fill="${mata}"/>` +
    `<rect x="11.5" y="30" width="4.5" height="10" fill="${mata}"/>` +
    `</g>`
  );
}

/** TENGGKORAK BERTANDUK (elemen utama — meniru referensi user: tengkorak
 *  bertanduk besar di atas; tanduk = goresan lengkap menebal, gigi, tulang
 *  pipi). Lebar total ±64 (tanduk), badan ±40, tinggi ±70. */
export function tengkorakTanduk(x: number, y: number, sc: number, tulang = "#e6e2d6", gelap = "#0a0a0c", tanduk = "#c9c2b0"): string {
  return (
    `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${sc})">` +
    // tanduk kiri & kanan (lengkung menebal keluar-atas)
    `<path d="M -32 -34 C -48 -40 -58 -56 -56 -76 C -47 -64 -38 -58 -28 -56" fill="none" stroke="${tanduk}" stroke-width="11" stroke-linecap="round"/>` +
    `<path d="M -31 -41 C -42 -46 -49 -57 -48 -69" fill="none" stroke="#8f8875" stroke-width="3.4" stroke-linecap="round" opacity="0.8"/>` +
    `<path d="M 32 -34 C 48 -40 58 -56 56 -76 C 47 -64 38 -58 28 -56" fill="none" stroke="${tanduk}" stroke-width="11" stroke-linecap="round"/>` +
    `<path d="M 31 -41 C 42 -46 49 -57 48 -69" fill="none" stroke="#8f8875" stroke-width="3.4" stroke-linecap="round" opacity="0.8"/>` +
    // tengkorak
    `<path d="M0 -54 C -28 -54 -38 -34 -38 -16 C -38 -2 -32 8 -24 13 L -24 28 C -24 34 -18 39 -10 39 L 10 39 C 18 39 24 34 24 28 L 24 13 C 32 8 38 -2 38 -16 C 38 -34 28 -54 0 -54 Z" fill="${tulang}" stroke="#2b2823" stroke-width="2"/>` +
    // rongga mata besar serem + alis miring iblis
    `<ellipse cx="-15" cy="-14" rx="10" ry="11.5" fill="${gelap}" transform="rotate(14 -15 -14)"/>` +
    `<ellipse cx="15" cy="-14" rx="10" ry="11.5" fill="${gelap}" transform="rotate(-14 15 -14)"/>` +
    `<path d="M -27 -26 L -6 -18" stroke="${gelap}" stroke-width="4" stroke-linecap="round"/>` +
    `<path d="M 27 -26 L 6 -18" stroke="${gelap}" stroke-width="4" stroke-linecap="round"/>` +
    // hidung + gigi
    `<path d="M0 2 C -3 8 -6 13 -6 16 C -6 19 -3 20 0 20 C 3 20 6 19 6 16 C 6 13 3 8 0 2 Z" fill="${gelap}"/>` +
    `<rect x="-16" y="28" width="4.4" height="11" fill="${gelap}"/><rect x="-9" y="28" width="4.4" height="11" fill="${gelap}"/>` +
    `<rect x="-2" y="28" width="4.4" height="11" fill="${gelap}"/><rect x="5" y="28" width="4.4" height="11" fill="${gelap}"/>` +
    `<rect x="12" y="28" width="4.4" height="11" fill="${gelap}"/>` +
    // retakan dahi
    `<path d="M0 -52 L 0 -40 M -8 -49 L -5 -43 M 8 -49 L 5 -43" stroke="#8f8875" stroke-width="1.6" fill="none" opacity="0.7"/>` +
    `</g>`
  );
}

/** Arwah/kelambu hantu (v0.49) — memakai filter glow id `agGlow` */
export function arwah(x: number, y: number, sc: number, flip = false, warna = "#d6dbe2"): string {
  const d =
    "M0 -58 C -26 -58 -34 -36 -34 -16 C -34 -4 -36 8 -34 22 C -30 14 -26 18 -24 28 " +
    "C -20 20 -16 24 -14 34 C -10 26 -6 28 -4 38 C 0 28 4 30 6 38 C 8 28 12 26 14 34 " +
    "C 16 24 20 20 24 28 C 26 18 30 14 34 22 C 36 8 34 -4 34 -16 C 34 -36 26 -58 0 -58 Z";
  const mata =
    `<ellipse cx="-11" cy="-26" rx="4.6" ry="8.5" fill="#0a0a0c" transform="rotate(18 -11 -26)"/>` +
    `<ellipse cx="11" cy="-26" rx="4.6" ry="8.5" fill="#0a0a0c" transform="rotate(-18 11 -26)"/>` +
    `<ellipse cx="0" cy="-4" rx="5.5" ry="10" fill="#0a0a0c"/>`;
  return (
    `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${flip ? -sc : sc} ${sc})">` +
    `<path d="${d}" fill="${warna}" opacity="0.45" filter="url(#agGlow)"/>` +
    `<path d="${d}" fill="${warna}" opacity="0.92"/>${mata}</g>`
  );
}

/** Sulur berduri (v0.49) */
export function sulur(x1: number, y1: number, x2: number, y2: number, amp: number, warna: string, sw: number): string {
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
      const bx = x1 + dx * (t1 - 0.06);
      const by = y1 + dy * (t1 - 0.06);
      const px = bx + nx * (amp + 7) * sgn;
      const py = by + ny * (amp + 7) * sgn;
      thorn += `<path d="M ${(bx + nx * amp * sgn * 0.8).toFixed(1)} ${(by + ny * amp * sgn * 0.8).toFixed(1)} L ${px.toFixed(1)} ${py.toFixed(1)} L ${(bx + ux * 8 + nx * amp * sgn * 0.55).toFixed(1)} ${(by + uy * 8 + ny * amp * sgn * 0.55).toFixed(1)} Z" fill="${warna}"/>`;
    }
  }
  return `<path d="${d}" fill="none" stroke="${warna}" stroke-width="${sw}" stroke-linecap="round"/>` + thorn;
}

/** Laba-laba: badan 2 lingkaran + 8 kaki + mata merah */
export function labaLaba(x: number, y: number, sc: number, badan = "#18161c", kaki = "#2a2730", mata = "#e0342a"): string {
  let g = `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${sc})">`;
  // kaki 4 kiri + 4 kanan (lengkung keluar)
  for (const sgn of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const ly = -6 + i * 5;
      const sx = sgn * (12 + i * 1.5);
      g += `<path d="M ${sgn * 5} ${ly} C ${sx} ${ly - 8} ${sx + sgn * 8} ${ly + 2} ${sx + sgn * 5} ${ly + 12}" fill="none" stroke="${kaki}" stroke-width="2.4" stroke-linecap="round"/>`;
    }
  }
  g +=
    `<circle cx="0" cy="6" r="9" fill="${badan}"/>` +
    `<circle cx="0" cy="-5" r="6" fill="${badan}"/>` +
    `<circle cx="-2.4" cy="-6.5" r="1.4" fill="${mata}"/><circle cx="2.4" cy="-6.5" r="1.4" fill="${mata}"/>` +
    `<path d="M -5 14 L -7 18 M -2 15 L -3 19 M 2 15 L 3 19 M 5 14 L 7 18" stroke="${badan}" stroke-width="1.6"/>` +
    `</g>`;
  return g;
}

/** Jaring laba-laba di sudut (spoke + busur melengkung turun) */
export function jaringSudut(cx: number, cy: number, r: number, dari: number, ke: number, warna: string, sw = 1.6, flipX = false): string {
  let g = `<g transform="translate(${cx.toFixed(1)} ${cy.toFixed(1)}) scale(${flipX ? -1 : 1} 1)" opacity="0.9">`;
  const n = 5;
  const pts: [number, number][][] = [];
  for (let i = 0; i <= n; i++) {
    const a = ((dari + ((ke - dari) * i) / n) * Math.PI) / 180;
    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
    g += `<line x1="0" y1="0" x2="${(Math.cos(a) * r).toFixed(1)}" y2="${(Math.sin(a) * r).toFixed(1)}" stroke="${warna}" stroke-width="${sw}"/>`;
  }
  for (const rr of [0.35, 0.55, 0.75, 0.95]) {
    let d = `M ${(pts[0][0] * rr).toFixed(1)} ${(pts[0][1] * rr).toFixed(1)}`;
    for (let i = 1; i <= n; i++) {
      const px = pts[i - 1][0] * rr;
      const py = pts[i - 1][1] * rr;
      const qx = pts[i][0] * rr;
      const qy = pts[i][1] * rr;
      const mx = (px + qx) / 2;
      const my = (py + qy) / 2;
      d += ` Q ${mx.toFixed(1)} ${(my + rr * 4).toFixed(1)} ${qx.toFixed(1)} ${qy.toFixed(1)}`;
    }
    g += `<path d="${d}" fill="none" stroke="${warna}" stroke-width="${sw}"/>`;
  }
  return g + `</g>`;
}

/** Lidah api tunggal (badan luar + inti terang) */
export function api(x: number, y: number, w: number, h: number, luar = "#e8541c", inti = "#ffc94d"): string {
  return (
    `<path transform="translate(${x.toFixed(1)} ${y.toFixed(1)})" d="M0 0 C ${-w * 0.55} ${-h * 0.25} ${-w * 0.4} ${-h * 0.6} 0 ${-h} C ${w * 0.4} ${-h * 0.6} ${w * 0.55} ${-h * 0.25} 0 0 Z" fill="${luar}"/>` +
    `<path transform="translate(${x.toFixed(1)} ${y.toFixed(1)})" d="M0 0 C ${-w * 0.26} ${-h * 0.18} ${-w * 0.2} ${-h * 0.42} 0 ${-h * 0.66} C ${w * 0.2} ${-h * 0.42} ${w * 0.26} ${-h * 0.18} 0 0 Z" fill="${inti}"/>`
  );
}

/** Rantai vertikal (lingkaran bertaut) utk sisi tipis */
export function rantai(x: number, y1: number, y2: number, langkah: number, warna: string, sw = 2): string {
  let g = "";
  let i = 0;
  for (let y = y1; y <= y2; y += langkah) {
    const rx = langkah * 0.34;
    g += `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="${rx.toFixed(1)}" ry="${(rx * 1.45).toFixed(1)}" fill="none" stroke="${warna}" stroke-width="${sw}" opacity="${i % 2 === 0 ? 0.9 : 0.65}"/>`;
    i++;
  }
  return g;
}

/** Sepasang mata menyala di gelap */
export function mataNyala(x: number, y: number, sc: number, warna = "#a4ff4d", idGlow: string): string {
  return (
    `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${sc})">` +
    `<ellipse cx="-9" cy="0" rx="5" ry="3.4" fill="${warna}" filter="url(#${idGlow})"/>` +
    `<ellipse cx="9" cy="0" rx="5" ry="3.4" fill="${warna}" filter="url(#${idGlow})"/>` +
    `<ellipse cx="-9" cy="0" rx="2.2" ry="2.6" fill="#05130a"/>` +
    `<ellipse cx="9" cy="0" rx="2.2" ry="2.6" fill="#05130a"/>` +
    `</g>`
  );
}

/** Nisan salib (kuburan) */
export function salib(x: number, y: number, sc: number, warna: string, op = 1): string {
  return (
    `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${sc})" opacity="${op}">` +
    `<rect x="-5" y="-52" width="10" height="78" rx="3" fill="${warna}"/>` +
    `<rect x="-26" y="-34" width="52" height="10" rx="3" fill="${warna}"/>` +
    `<rect x="-16" y="26" width="32" height="9" rx="2" fill="${warna}" opacity="0.85"/>` +
    `</g>`
  );
}

/** Nisan batu nisan (puncak membulat) */
export function nisan(x: number, y: number, sc: number, batu: string, garis: string, op = 1): string {
  return (
    `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${sc})" opacity="${op}">` +
    `<path d="M -24 34 L -24 -18 C -24 -40 24 -40 24 -18 L 24 34 Z" fill="${batu}" stroke="${garis}" stroke-width="2"/>` +
    `<line x1="-11" y1="-16" x2="11" y2="-16" stroke="${garis}" stroke-width="2.4"/>` +
    `<line x1="0" y1="-26" x2="0" y2="-2" stroke="${garis}" stroke-width="2.4"/>` +
    `<line x1="-13" y1="14" x2="13" y2="14" stroke="${garis}" stroke-width="2" opacity="0.7"/>` +
    `<line x1="-13" y1="21" x2="13" y2="21" stroke="${garis}" stroke-width="2" opacity="0.7"/>` +
    `</g>`
  );
}

/* ============ KERANGKA KELUARGA "ALAM GAIB" (seragam semua desain) ============ */

// Puncak huruf Creepster ≈ 0.75em di atas baseline (terukur probe-font-v52).
const CAP = 0.75;

export function fsHero(l: boolean): number {
  return l ? 116 : 150;
}
export function baselineHero(l: boolean, s: number): number {
  return Math.round(fsHero(l) * CAP + 34 * s);
}

/** Teks besar "ALAM GAIB" (Creepster, glow + isi gradient + stroke) — puncak
 *  huruf MENYENTUH garis bingkai atas (permintaan user). */
export function teksAlamGaib(
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
    `<text x="${W / 2}" y="${baseline}" text-anchor="middle" font-family="Creepster" font-size="${fs}" fill="${warnaGlow}" opacity="0.55" filter="url(#${idGlow})">ALAM GAIB</text>` +
    `<text x="${W / 2}" y="${baseline}" text-anchor="middle" font-family="Creepster" font-size="${fs}" fill="url(#${idFill})" stroke="${stroke}" stroke-width="${(1.6 * s).toFixed(1)}">ALAM GAIB</text>`;
  return { svg, baseline };
}

/** Teks tema kecil di bawah hero — v0.54.0 DIHAPUS dari semua frame (permintaan
 *  user: cukup tulisan "ALAM GAIB" saja di bagian atas). Fungsi ditinggalkan
 *  tanpa pemanggil demi riwayat (tidak dipakai lagi). */
export function teksTema(
  W: number,
  baseline: number,
  l: boolean,
  s: number,
  label: string,
  warna: string,
  stroke: string,
): string {
  const fs = l ? 42 : 52;
  return `<text x="${W / 2}" y="${baseline}" text-anchor="middle" font-family="Cinzel Decorative" font-weight="bold" font-size="${fs}" fill="${warna}" stroke="${stroke}" stroke-width="${(1 * s).toFixed(1)}" letter-spacing="${(5 * s).toFixed(0)}">${label}</text>`;
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

/** Bingkai dobel TIPIS + aksen sudut kecil (SYARAT USER: kiri-kanan tipis —
 *  hanya 2 garis 4–5px & 2px, tanpa kolom lebar) */
export function bingkaiTipis(
  W: number,
  H: number,
  s: number,
  inset: number,
  rx: number,
  warnaUtama: string,
  warnaDalam: string,
): string {
  return (
    `<rect x="${inset}" y="${inset}" width="${W - 2 * inset}" height="${H - 2 * inset}" rx="${rx}" fill="none" stroke="${warnaUtama}" stroke-width="${(4.2 * s).toFixed(1)}"/>` +
    `<rect x="${inset + 13 * s}" y="${inset + 13 * s}" width="${W - 2 * inset - 26 * s}" height="${H - 2 * inset - 26 * s}" rx="${(30 * s).toFixed(0)}" fill="none" stroke="${warnaDalam}" stroke-width="${(1.7 * s).toFixed(1)}" opacity="0.9"/>`
  );
}

/** Pita bawah + garis sisi + sepasang ornamen — v0.54.0 TANPA teks (permintaan
 *  user: cukup tulisan "ALAM GAIB" di bagian atas frame). Pita tetap sbg hiasan. */
export function pitaBawahHoror(
  W: number,
  H: number,
  s: number,
  l: boolean,
  idBand: string,
  warnaGaris: string,
  ornamenKiri = "",
  ornamenKanan = "",
): string {
  const garis =
    `<line x1="${W * 0.1}" y1="${H - 60 * s}" x2="${W * 0.1 + 120 * s}" y2="${H - 60 * s}" stroke="${warnaGaris}" stroke-width="${(1.8 * s).toFixed(1)}"/>` +
    `<line x1="${W * 0.9}" y1="${H - 60 * s}" x2="${W * 0.9 - 120 * s}" y2="${H - 60 * s}" stroke="${warnaGaris}" stroke-width="${(1.8 * s).toFixed(1)}"/>`;
  return (
    `<rect x="0" y="${H - 150 * s}" width="${W}" height="${150 * s}" fill="url(#${idBand})"/>` +
    garis +
    ornamenKiri +
    ornamenKanan
  );
}

/* ============ DESEN 3 — TENGGKORAK BERTANDUK (arang-tulang-darah) ============ */

export function svgHoror3(r: Rasio): string {
  const { W, H, l } = r;
  const s = Math.min(W, H) / 1080;
  const inset = Math.round(22 * s);
  const rx = Math.round(40 * s);
  const zona = (l ? 400 : 480) * s;

  const hero = teksAlamGaib(W, l, s, "gDarah", "gGlow", "#ff2b1f", "#1c0505");
  // v0.54.0 — nama desain dihapus; pembatas naik ke posisi semula nama desain
  const pembatasY = hero.baseline + (l ? 84 : 102);

  // sepasang tengkorak bertanduk BESAR mengapit teks hero (meniru referensi
  // user) — ditarik ke sisi agar tidak menabrak teks (teks hero mulai ±253px)
  const tengkorakPasang =
    tengkorakTanduk((l ? 330 : 150) * s, (l ? 155 : 118) * s, (l ? 0.95 : 1.0) * s) +
    tengkorakTanduk(W - (l ? 330 : 150) * s, (l ? 155 : 118) * s, (l ? 0.95 : 1.0) * s);

  // tengkorak bertanduk BESAR di tengah + dua tengkorak kecil mengapit
  const yTengah = (l ? 355 : 402) * s;
  const tengkorakTengah =
    tengkorakTanduk(W / 2, yTengah, (l ? 0.9 : 1.1) * s) +
    tengkorak(W / 2 - (l ? 160 : 185) * s, yTengah + 10 * s, 0.6 * s, "#ded9ca", "#111013", 0.92) +
    tengkorak(W / 2 + (l ? 160 : 185) * s, yTengah + 10 * s, 0.6 * s, "#ded9ca", "#111013", 0.92);

  // tulang belakang sisi (TIPIS): ruja tulang kecil bergantian
  const ruasSisi = (x: number) => {
    let out = "";
    for (let y = zona + 30 * s; y <= H - 210 * s; y += 30 * s) {
      const besar = Math.round(y / (30 * s)) % 2 === 0;
      out += `<rect x="${(x - (besar ? 9 : 6) * s).toFixed(1)}" y="${y.toFixed(1)}" width="${((besar ? 18 : 12) * s).toFixed(1)}" height="${(10 * s).toFixed(1)}" rx="${(5 * s).toFixed(1)}" fill="#cfc9ba" opacity="${besar ? 0.85 : 0.55}"/>`;
    }
    return out;
  };
  const sisi = ruasSisi(52 * s) + ruasSisi(W - 52 * s);

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<defs>` +
    `<linearGradient id="gAtas" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="#141114" stop-opacity="0.99"/><stop offset="0.55" stop-color="#0c0a0c" stop-opacity="0.93"/><stop offset="1" stop-color="#050405" stop-opacity="0"/>` +
    `</linearGradient>` +
    `<radialGradient id="gMerah" cx="0.5" cy="0.5" r="0.5">` +
    `<stop offset="0" stop-color="#5c0d0a" stop-opacity="0.75"/><stop offset="1" stop-color="#5c0d0a" stop-opacity="0"/>` +
    `</radialGradient>` +
    `<linearGradient id="gDarah" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="#ffffff"/><stop offset="0.4" stop-color="#f3eee6"/><stop offset="0.62" stop-color="#d94343"/><stop offset="1" stop-color="#8f1420"/>` +
    `</linearGradient>` +
    `<linearGradient id="gBand" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="#0c0a0b" stop-opacity="0"/><stop offset="0.5" stop-color="#171318" stop-opacity="0.92"/><stop offset="1" stop-color="#1d1519" stop-opacity="0.97"/>` +
    `</linearGradient>` +
    `<filter id="gGlow" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="${(11 * s).toFixed(1)}"/></filter>` +
    `</defs>` +
    `<rect x="0" y="0" width="${W}" height="${zona.toFixed(0)}" fill="url(#gAtas)"/>` +
    `<ellipse cx="${W / 2}" cy="${(230 * s).toFixed(0)}" rx="${(W * 0.52).toFixed(0)}" ry="${(280 * s).toFixed(0)}" fill="url(#gMerah)"/>` +
    bingkaiTipis(W, H, s, inset, rx, "#cfc9ba", "#6b6659") +
    // aksen sudut BAWAH saja (sudut atas dipakai tengkorak bertanduk)
    tengkorak(inset + 52 * s, H - inset - 62 * s, 0.5 * s, "#cfc9ba", "#111013", 0.8) +
    tengkorak(W - inset - 52 * s, H - inset - 62 * s, 0.5 * s, "#cfc9ba", "#111013", 0.8) +
    kelelawar(W * (l ? 0.42 : 0.36), (l ? 80 : 108) * s, 1.2 * s, false, "#1f1d22") +
    kelelawar(W * (l ? 0.58 : 0.64), (l ? 62 : 88) * s, 0.9 * s, true, "#1f1d22") +
    tengkorakPasang +
    hero.svg +
    pembatas(W, pembatasY, s, "#9a4436") +
    tengkorakTengah +
    tetes(W / 2 - (l ? 240 : 235) * s, pembatasY, 42 * s, 4.6 * s) +
    tetes(W / 2 + (l ? 240 : 235) * s, pembatasY, 54 * s, 5 * s) +
    sisi +
    pitaBawahHoror(W, H, s, l, "gBand", "#8f6a4a",
      tengkorak(90 * s, H - 74 * s, 0.5 * s, "#cfc9ba", "#111013", 0.85),
      tengkorak(W - 90 * s, H - 74 * s, 0.5 * s, "#cfc9ba", "#111013", 0.85)) +
    `</svg>`
  );
}

/* ============ DESEN 4 — TANAH KUBUR (hijau lumut + kabut) ============ */

export function svgHoror4(r: Rasio): string {
  const { W, H, l } = r;
  const s = Math.min(W, H) / 1080;
  const inset = Math.round(22 * s);
  const rx = Math.round(40 * s);
  const zona = (l ? 400 : 480) * s;

  const hero = teksAlamGaib(W, l, s, "gHijau", "h4Glow", "#9dff8a", "#0a150c");
  // v0.54.0 — nama desain dihapus; pembatas naik ke posisi semula nama desain
  const pembatasY4 = hero.baseline + (l ? 84 : 102);

  // salib + nisan di sisi zona atas (tanah kubur)
  const makam =
    salib((l ? 250 : 150) * s, (l ? 250 : 300) * s, (l ? 1.1 : 1.25) * s, "#b9c7b0", 0.9) +
    nisan(W - (l ? 250 : 150) * s, (l ? 255 : 305) * s, (l ? 1.0 : 1.15) * s, "#8fa08a", "#4c5a48", 0.9) +
    salib(W - (l ? 420 : 265) * s, (l ? 290 : 350) * s, 0.72 * s, "#a7b5a0", 0.55) +
    nisan((l ? 420 : 265) * s, (l ? 295 : 355) * s, 0.72 * s, "#84967f", "#45523f", 0.55);

  // kawah tanah gundukan di dasar zona atas
  const gundukan =
    `<path d="M -${W * 0.3} ${zona} Q ${W / 2 - 160 * s} ${zona - 56 * s} ${W / 2} ${zona - 20 * s} Q ${W / 2 + 170 * s} ${zona - 60 * s} ${W + W * 0.3} ${zona} Z" fill="#141d15" opacity="0.75"/>`;

  // kabut pelan di zona atas & pita
  const kabut =
    `<ellipse cx="${W * 0.3}" cy="${(zona - 40 * s).toFixed(0)}" rx="${(330 * s).toFixed(0)}" ry="${(46 * s).toFixed(0)}" fill="#b9c7b0" opacity="0.12" filter="url(#h4Kabut)"/>` +
    `<ellipse cx="${W * 0.74}" cy="${(zona - 20 * s).toFixed(0)}" rx="${(300 * s).toFixed(0)}" ry="${(40 * s).toFixed(0)}" fill="#b9c7b0" opacity="0.1" filter="url(#h4Kabut)"/>`;

  // pagar tanah perkuburan sisi (TIPIS): pucuk kayu + bilah lebar (bukan panah)
  const pagarSisi = (x: number) => {
    let out = "";
    for (let y = zona + 24 * s; y <= H - 220 * s; y += 64 * s) {
      out +=
        `<path d="M ${(x - 5 * s).toFixed(1)} ${(y + 16 * s).toFixed(1)} L ${x.toFixed(1)} ${(y + 2 * s).toFixed(1)} L ${(x + 5 * s).toFixed(1)} ${(y + 16 * s).toFixed(1)} Z" fill="#9fb8a4" opacity="0.85"/>` +
        `<rect x="${(x - 5 * s).toFixed(1)}" y="${(y + 16 * s).toFixed(1)}" width="${(10 * s).toFixed(1)}" height="${(30 * s).toFixed(1)}" rx="${(1.6 * s).toFixed(1)}" fill="#9fb8a4" opacity="0.6"/>`;
    }
    return out;
  };
  const pagar = pagarSisi(50 * s) + pagarSisi(W - 50 * s);

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<defs>` +
    `<linearGradient id="h4Atas" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="#101b12" stop-opacity="0.99"/><stop offset="0.55" stop-color="#0a130c" stop-opacity="0.93"/><stop offset="1" stop-color="#040805" stop-opacity="0"/>` +
    `</linearGradient>` +
    `<radialGradient id="h4Lumut" cx="0.5" cy="0.5" r="0.5">` +
    `<stop offset="0" stop-color="#2f5c33" stop-opacity="0.6"/><stop offset="1" stop-color="#2f5c33" stop-opacity="0"/>` +
    `</radialGradient>` +
    `<linearGradient id="gHijau" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="#f4fff0"/><stop offset="0.45" stop-color="#cfe8c4"/><stop offset="0.75" stop-color="#8fbf83"/><stop offset="1" stop-color="#5c8a54"/>` +
    `</linearGradient>` +
    `<linearGradient id="h4Band" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="#0a130c" stop-opacity="0"/><stop offset="0.5" stop-color="#122115" stop-opacity="0.92"/><stop offset="1" stop-color="#182b1a" stop-opacity="0.97"/>` +
    `</linearGradient>` +
    `<filter id="h4Glow" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="${(10 * s).toFixed(1)}"/></filter>` +
    `<filter id="h4Kabut" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="${(24 * s).toFixed(1)}"/></filter>` +
    `</defs>` +
    `<rect x="0" y="0" width="${W}" height="${zona.toFixed(0)}" fill="url(#h4Atas)"/>` +
    `<ellipse cx="${W / 2}" cy="${(240 * s).toFixed(0)}" rx="${(W * 0.55).toFixed(0)}" ry="${(270 * s).toFixed(0)}" fill="url(#h4Lumut)"/>` +
    bingkaiTipis(W, H, s, inset, rx, "#9fb8a4", "#4c5a48") +
    kelelawar(W * 0.3, (l ? 80 : 110) * s, 1.2 * s, false, "#10160f") +
    kelelawar(W * 0.68, (l ? 60 : 90) * s, 1 * s, true, "#10160f") +
    makam +
    gundukan +
    kabut +
    hero.svg +
    pembatas(W, pembatasY4, s, "#7fa878") +
    pagar +
    pitaBawahHoror(W, H, s, l, "h4Band", "#7fa878",
      salib(92 * s, H - 84 * s, 0.55 * s, "#9fb8a4", 0.85),
      salib(W - 92 * s, H - 84 * s, 0.55 * s, "#9fb8a4", 0.85)) +
    `</svg>`
  );
}

/* ============ DESEN 5 — SARANG LABA-LABA (ungu gelap + jaring pucat) ============ */

export function svgHoror5(r: Rasio): string {
  const { W, H, l } = r;
  const s = Math.min(W, H) / 1080;
  const inset = Math.round(22 * s);
  const rx = Math.round(40 * s);
  const zona = (l ? 400 : 480) * s;

  const hero = teksAlamGaib(W, l, s, "gTulang5", "h5Glow", "#cdbfff", "#14101a");
  // v0.54.0 — nama desain dihapus; pembatas naik ke posisi semula nama desain
  const pembatasY5 = hero.baseline + (l ? 84 : 102);

  // jaring di 2 sudut atas + benang laba-laba di sudut bawah pita
  const jaring =
    jaringSudut(inset + 6 * s, inset + 6 * s, 190 * s, 2, 86, "#cfc9d6", 1.7 * s, false) +
    jaringSudut(W - inset - 6 * s, inset + 6 * s, 190 * s, 2, 86, "#cfc9d6", 1.7 * s, true) +
    jaringSudut(inset + 6 * s, H - inset - 6 * s, 120 * s, 274, 358, "#b9b3c6", 1.4 * s, false) +
    jaringSudut(W - inset - 6 * s, H - inset - 6 * s, 120 * s, 274, 358, "#b9b3c6", 1.4 * s, true);

  // laba-laba besar menggantung di benang (sisi kanan zona atas)
  const benangX = W - (l ? 430 : 265) * s;
  const labaY = (l ? 265 : 320) * s;
  const laba =
    `<line x1="${benangX}" y1="${inset + 4 * s}" x2="${benangX}" y2="${(labaY - 18 * s).toFixed(1)}" stroke="#cfc9d6" stroke-width="${(1.8 * s).toFixed(1)}"/>` +
    labaLaba(benangX, labaY, 1.7 * s) +
    // laba-laba kecil kiri bawah zona atas
    `<line x1="${(l ? 430 : 265) * s}" y1="${zona - 60 * s}" x2="${(l ? 430 : 265) * s}" y2="${(zona - 24 * s).toFixed(1)}" stroke="#cfc9d6" stroke-width="${(1.5 * s).toFixed(1)}"/>` +
    labaLaba((l ? 430 : 265) * s, zona - 6 * s, 1.05 * s);

  // benang sisi TIPIS: garis vertikal + embun
  const benangSisi = (x: number) => {
    let out = `<line x1="${x}" y1="${zona + 20 * s}" x2="${x}" y2="${H - 200 * s}" stroke="#b9b3c6" stroke-width="${(1.4 * s).toFixed(1)}" opacity="0.7"/>`;
    for (let y = zona + 60 * s; y <= H - 240 * s; y += 56 * s) {
      out += `<circle cx="${x}" cy="${y.toFixed(0)}" r="${(2.8 * s).toFixed(1)}" fill="#e8e4f0" opacity="0.8"/>`;
    }
    return out;
  };
  const sisi = benangSisi(52 * s) + benangSisi(W - 52 * s);

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<defs>` +
    `<linearGradient id="h5Atas" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="#191322" stop-opacity="0.99"/><stop offset="0.55" stop-color="#100c17" stop-opacity="0.93"/><stop offset="1" stop-color="#070510" stop-opacity="0"/>` +
    `</linearGradient>` +
    `<radialGradient id="h5Ungu" cx="0.5" cy="0.5" r="0.5">` +
    `<stop offset="0" stop-color="#4c357f" stop-opacity="0.55"/><stop offset="1" stop-color="#4c357f" stop-opacity="0"/>` +
    `</radialGradient>` +
    `<linearGradient id="gTulang5" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="#ffffff"/><stop offset="0.45" stop-color="#e8e2f2"/><stop offset="0.8" stop-color="#b4a9d0"/><stop offset="1" stop-color="#8a7aa8"/>` +
    `</linearGradient>` +
    `<linearGradient id="h5Band" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="#0e0a16" stop-opacity="0"/><stop offset="0.5" stop-color="#181226" stop-opacity="0.92"/><stop offset="1" stop-color="#221a34" stop-opacity="0.97"/>` +
    `</linearGradient>` +
    `<filter id="h5Glow" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="${(10 * s).toFixed(1)}"/></filter>` +
    `</defs>` +
    `<rect x="0" y="0" width="${W}" height="${zona.toFixed(0)}" fill="url(#h5Atas)"/>` +
    `<ellipse cx="${W / 2}" cy="${(230 * s).toFixed(0)}" rx="${(W * 0.52).toFixed(0)}" ry="${(270 * s).toFixed(0)}" fill="url(#h5Ungu)"/>` +
    bingkaiTipis(W, H, s, inset, rx, "#cfc9d6", "#5f5870") +
    jaring +
    star4(W * 0.24, (l ? 120 : 160) * s, 10 * s, 0.7, "#e8e4f0") +
    star4(W * 0.74, (l ? 70 : 100) * s, 8 * s, 0.6, "#e8e4f0") +
    laba +
    hero.svg +
    pembatas(W, pembatasY5, s, "#8a7aa8") +
    sisi +
    pitaBawahHoror(W, H, s, l, "h5Band", "#8a7aa8",
      labaLaba(96 * s, H - 78 * s, 1.1 * s, "#18161c", "#2a2730", "#e0342a"),
      labaLaba(W - 96 * s, H - 78 * s, 1.1 * s, "#18161c", "#2a2730", "#e0342a")) +
    `</svg>`
  );
}

/* ============ DESEN 6 — GUNUNG DARAH (merah crimson pekat) ============ */

export function svgHoror6(r: Rasio): string {
  const { W, H, l } = r;
  const s = Math.min(W, H) / 1080;
  const inset = Math.round(22 * s);
  const rx = Math.round(40 * s);
  const zona = (l ? 400 : 480) * s;

  const hero = teksAlamGaib(W, l, s, "gDarah6", "h6Glow", "#ff3222", "#1c0303");
  // v0.54.0 — nama desain dihapus; pembatas naik ke posisi semula nama desain
  const pembatasY = hero.baseline + (l ? 84 : 102);

  // tetesan darah deret di bawah garis pembatas (dari "tepi" pembatas)
  let tetesRow = "";
  const posisiTetes: [number, number, number][] = l
    ? [[-230, 34, 5.6], [-120, 56, 6.2], [-20, 26, 4.6], [90, 62, 6.6], [200, 40, 5.4]]
    : [[-190, 42, 5.4], [-90, 64, 6.4], [10, 30, 4.8], [110, 58, 6.2], [210, 36, 5]];
  for (const [ox, len, wd] of posisiTetes) tetesRow += tetes(W / 2 + ox * s, pembatasY, len * s, wd * s, "#b81527");

  // sungai darah: gelombang merah di dasar zona atas
  const sungai =
    `<path d="M -10 ${zona - 34 * s} Q ${W * 0.25} ${zona - 58 * s} ${W * 0.5} ${zona - 36 * s} T ${W + 10} ${zona - 34 * s} L ${W + 10} ${zona} L -10 ${zona} Z" fill="#6e0d16" opacity="0.85"/>` +
    `<path d="M -10 ${zona - 18 * s} Q ${W * 0.3} ${zona - 40 * s} ${W * 0.55} ${zona - 20 * s} T ${W + 10} ${zona - 16 * s} L ${W + 10} ${zona} L -10 ${zona} Z" fill="#8f1420" opacity="0.9"/>`;

  // aliran darah sisi TIPIS: garis merah vertikal + tetes
  const darahSisi = (x: number) => {
    let out = `<line x1="${x}" y1="${zona + 16 * s}" x2="${x}" y2="${H - 210 * s}" stroke="#8f1420" stroke-width="${(3.4 * s).toFixed(1)}" opacity="0.85"/>`;
    for (let y = zona + 50 * s; y <= H - 250 * s; y += 74 * s) {
      out += tetes(x, y, (22 + (Math.round(y / 74) % 3) * 8) * s, 5.4 * s, "#a5121e");
    }
    return out;
  };
  const sisi = darahSisi(50 * s) + darahSisi(W - 50 * s);

  // tetes menggantung dari tepi atas pita bawah
  let tetesPita = "";
  for (let x = 60 * s; x <= W - 50 * s; x += (l ? 96 : 78) * s) {
    const panjang = (Math.round(x / (l ? 96 : 78) / s) % 3 === 0 ? 34 : 18) * s;
    tetesPita += tetes(x, H - 150 * s, panjang, 5 * s, "#7e1019");
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<defs>` +
    `<linearGradient id="h6Atas" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="#23060a" stop-opacity="0.99"/><stop offset="0.55" stop-color="#160407" stop-opacity="0.94"/><stop offset="1" stop-color="#0a0203" stop-opacity="0"/>` +
    `</linearGradient>` +
    `<radialGradient id="h6Merah" cx="0.5" cy="0.5" r="0.5">` +
    `<stop offset="0" stop-color="#7a1019" stop-opacity="0.8"/><stop offset="1" stop-color="#7a1019" stop-opacity="0"/>` +
    `</radialGradient>` +
    `<linearGradient id="gDarah6" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="#ffe9e2"/><stop offset="0.38" stop-color="#ff6a4e"/><stop offset="0.66" stop-color="#c81e2c"/><stop offset="1" stop-color="#6e0d16"/>` +
    `</linearGradient>` +
    `<linearGradient id="h6Band" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="#180407" stop-opacity="0"/><stop offset="0.5" stop-color="#2a070c" stop-opacity="0.93"/><stop offset="1" stop-color="#3d0a12" stop-opacity="0.97"/>` +
    `</linearGradient>` +
    `<filter id="h6Glow" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="${(12 * s).toFixed(1)}"/></filter>` +
    `</defs>` +
    `<rect x="0" y="0" width="${W}" height="${zona.toFixed(0)}" fill="url(#h6Atas)"/>` +
    `<ellipse cx="${W / 2}" cy="${(230 * s).toFixed(0)}" rx="${(W * 0.52).toFixed(0)}" ry="${(280 * s).toFixed(0)}" fill="url(#h6Merah)"/>` +
    bingkaiTipis(W, H, s, inset, rx, "#cc3a2e", "#6e1a12") +
    kelelawar(W * 0.28, (l ? 85 : 115) * s, 1.25 * s, false, "#1c0d10") +
    kelelawar(W * 0.7, (l ? 65 : 95) * s, 1 * s, true, "#1c0d10") +
    // bulan merah pucat di sisi atas
    `<circle cx="${(l ? W * 0.82 : W * 0.8).toFixed(0)}" cy="${(l ? 120 : 130) * s}" r="${(74 * s).toFixed(0)}" fill="#c96a62" opacity="0.22" filter="url(#h6Glow)"/>` +
    `<circle cx="${(l ? W * 0.82 : W * 0.8).toFixed(0)}" cy="${(l ? 120 : 130) * s}" r="${(46 * s).toFixed(0)}" fill="#d98877" opacity="0.26"/>` +
    hero.svg +
    tetes(W / 2 - fsHero(l) * 1.5, hero.baseline - 6 * s, 44 * s, 5 * s, "#b81527") +
    tetes(W / 2 + fsHero(l) * 1.2, hero.baseline - 6 * s, 58 * s, 5.6 * s, "#b81527") +
    pembatas(W, pembatasY, s, "#b81527") +
    tetesRow +
    sungai +
    sisi +
    pitaBawahHoror(W, H, s, l, "h6Band", "#b81527", tetesPita, "") +
    `</svg>`
  );
}

/* ============ DESEN 7 — API NERAKA (jingga bara + lidah api) ============ */

export function svgHoror7(r: Rasio): string {
  const { W, H, l } = r;
  const s = Math.min(W, H) / 1080;
  const inset = Math.round(22 * s);
  const rx = Math.round(40 * s);
  const zona = (l ? 400 : 480) * s;

  const hero = teksAlamGaib(W, l, s, "gApi", "h7Glow", "#ff9d2e", "#2a0a02");
  // v0.54.0 — nama desain dihapus; pembatas naik ke posisi semula nama desain
  const pembatasY7 = hero.baseline + (l ? 84 : 102);

  // lidah api menyala di sepanjang dalam bingkai atas (zona atas saja)
  let apiAtas = "";
  for (let x = 70 * s; x <= W - 60 * s; x += (l ? 74 : 60) * s) {
    const tinggi = (26 + (Math.round(x / (l ? 74 : 60) / s) % 3) * 12) * s;
    apiAtas += api(x, inset + 14 * s, 26 * s, tinggi, "#c2410c", "#fdba74");
  }

  // bara bertaburan di zona atas
  let bara = "";
  const posisiBara: [number, number, number][] = l
    ? [[280, 210, 4], [480, 150, 3], [1300, 190, 4.5], [1560, 250, 3.4], [960, 120, 2.6]]
    : [[210, 320, 4], [350, 260, 3], [730, 300, 4.4], [880, 240, 3.2], [550, 200, 2.6], [980, 330, 3.6]];
  for (const [x, y, r] of posisiBara) {
    bara += `<circle cx="${x * s}" cy="${y * s}" r="${(r * s).toFixed(1)}" fill="#fdba74" opacity="0.75"/>` +
      `<circle cx="${x * s}" cy="${y * s}" r="${(r * 2.1 * s).toFixed(1)}" fill="#f97316" opacity="0.25"/>`;
  }

  // lidah api sisi TIPIS berjajar naik
  const apiSisi = (x: number) => {
    let out = "";
    let i = 0;
    for (let y = zona + 40 * s; y <= H - 220 * s; y += 56 * s) {
      const tinggi = (20 + (i % 3) * 8) * s;
      out += api(x, y, 17 * s, tinggi, "#9a3412", "#fdba74");
      i++;
    }
    return out;
  };
  const sisi = apiSisi(52 * s) + apiSisi(W - 52 * s);

  // barisan api di bawah zona atas (memudar) — sebagai transisi
  const apiBawahZona = (() => {
    let out = "";
    for (let x = 90 * s; x <= W - 80 * s; x += 88 * s) {
      out += api(x, zona - 4 * s, 22 * s, 30 * s, "#7c2d12", "#fb923c");
    }
    return out;
  })();

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<defs>` +
    `<linearGradient id="h7Atas" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="#1c0a04" stop-opacity="0.99"/><stop offset="0.55" stop-color="#120703" stop-opacity="0.94"/><stop offset="1" stop-color="#090302" stop-opacity="0"/>` +
    `</linearGradient>` +
    `<radialGradient id="h7Bara" cx="0.5" cy="0.5" r="0.5">` +
    `<stop offset="0" stop-color="#7c2d12" stop-opacity="0.8"/><stop offset="1" stop-color="#7c2d12" stop-opacity="0"/>` +
    `</radialGradient>` +
    `<linearGradient id="gApi" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="#fff7c2"/><stop offset="0.35" stop-color="#ffd76b"/><stop offset="0.65" stop-color="#f97316"/><stop offset="1" stop-color="#b91c0c"/>` +
    `</linearGradient>` +
    `<linearGradient id="h7Band" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="#160702" stop-opacity="0"/><stop offset="0.5" stop-color="#2a0e04" stop-opacity="0.93"/><stop offset="1" stop-color="#3d1505" stop-opacity="0.97"/>` +
    `</linearGradient>` +
    `<filter id="h7Glow" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="${(11 * s).toFixed(1)}"/></filter>` +
    `</defs>` +
    `<rect x="0" y="0" width="${W}" height="${zona.toFixed(0)}" fill="url(#h7Atas)"/>` +
    `<ellipse cx="${W / 2}" cy="${(240 * s).toFixed(0)}" rx="${(W * 0.55).toFixed(0)}" ry="${(280 * s).toFixed(0)}" fill="url(#h7Bara)"/>` +
    bingkaiTipis(W, H, s, inset, rx, "#f59e42", "#7a2d0a") +
    apiAtas +
    bara +
    hero.svg +
    pembatas(W, pembatasY7, s, "#f97316") +
    apiBawahZona +
    sisi +
    pitaBawahHoror(W, H, s, l, "h7Band", "#f97316",
      api(96 * s, H - 58 * s, 20 * s, 44 * s),
      api(W - 96 * s, H - 58 * s, 20 * s, 44 * s)) +
    `</svg>`
  );
}

/* ============ DESEN 8 — ARWAH LARUNG (biru dingin + bulan pucat) ============ */

export function svgHoror8(r: Rasio): string {
  const { W, H, l } = r;
  const s = Math.min(W, H) / 1080;
  const inset = Math.round(22 * s);
  const rx = Math.round(40 * s);
  const zona = (l ? 400 : 480) * s;

  const hero = teksAlamGaib(W, l, s, "gEs", "h8Glow", "#9ec8ff", "#050a16");
  // v0.54.0 — nama desain dihapus; pembatas naik ke posisi semula nama desain
  const pembatasY8 = hero.baseline + (l ? 84 : 102);

  // bulan purnama pucat di kanan atas zona
  const bulan =
    `<circle cx="${(l ? W * 0.8 : W * 0.78).toFixed(0)}" cy="${(l ? 130 : 140) * s}" r="${(96 * s).toFixed(0)}" fill="#cfe3ff" opacity="0.22" filter="url(#h8Lembut)"/>` +
    `<circle cx="${(l ? W * 0.8 : W * 0.78).toFixed(0)}" cy="${(l ? 130 : 140) * s}" r="${(58 * s).toFixed(0)}" fill="#dce9fb" opacity="0.5"/>`;

  // sepasang arwah mengapit zona atas + arwah kecil bertabur
  const arwahZona =
    arwah((l ? 250 : 165) * s, (l ? 235 : 290) * s, (l ? 1.15 : 1.3) * s) +
    arwah(W - (l ? 250 : 165) * s, (l ? 250 : 300) * s, (l ? 1.15 : 1.3) * s, true) +
    arwah((l ? 430 : 280) * s, (l ? 300 : 360) * s, 0.66 * s, true, "#b9c8de") +
    arwah(W - (l ? 430 : 280) * s, (l ? 310 : 365) * s, 0.66 * s, false, "#b9c8de");

  // kabut dingin
  const kabut =
    `<ellipse cx="${W * 0.3}" cy="${(zona - 30 * s).toFixed(0)}" rx="${(340 * s).toFixed(0)}" ry="${(44 * s).toFixed(0)}" fill="#aebfda" opacity="0.13" filter="url(#h8Kabut)"/>` +
    `<ellipse cx="${W * 0.7}" cy="${(zona - 14 * s).toFixed(0)}" rx="${(320 * s).toFixed(0)}" ry="${(40 * s).toFixed(0)}" fill="#aebfda" opacity="0.1" filter="url(#h8Kabut)"/>`;

  // rantai tergantung sisi (TIPIS)
  const sisi = rantai(52 * s, zona + 24 * s, H - 220 * s, 34 * s, "#8ea2c4", 2 * s) +
    rantai(W - 52 * s, zona + 24 * s, H - 220 * s, 34 * s, "#8ea2c4", 2 * s);

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<defs>` +
    `<linearGradient id="h8Atas" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="#0b1220" stop-opacity="0.99"/><stop offset="0.55" stop-color="#070d1a" stop-opacity="0.94"/><stop offset="1" stop-color="#030610" stop-opacity="0"/>` +
    `</linearGradient>` +
    `<radialGradient id="h8Bulan" cx="0.5" cy="0.5" r="0.5">` +
    `<stop offset="0" stop-color="#1d3566" stop-opacity="0.65"/><stop offset="1" stop-color="#1d3566" stop-opacity="0"/>` +
    `</radialGradient>` +
    `<linearGradient id="gEs" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="#ffffff"/><stop offset="0.42" stop-color="#dceafc"/><stop offset="0.72" stop-color="#9ec8ff"/><stop offset="1" stop-color="#5a86c2"/>` +
    `</linearGradient>` +
    `<linearGradient id="h8Band" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="#060b16" stop-opacity="0"/><stop offset="0.5" stop-color="#0d1626" stop-opacity="0.92"/><stop offset="1" stop-color="#14203a" stop-opacity="0.97"/>` +
    `</linearGradient>` +
    `<filter id="h8Glow" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="${(11 * s).toFixed(1)}"/></filter>` +
    `<filter id="h8Lembut" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="${(20 * s).toFixed(1)}"/></filter>` +
    `<filter id="h8Kabut" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="${(24 * s).toFixed(1)}"/></filter>` +
    `<filter id="agGlow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="${(10 * s).toFixed(1)}"/></filter>` +
    `</defs>` +
    `<rect x="0" y="0" width="${W}" height="${zona.toFixed(0)}" fill="url(#h8Atas)"/>` +
    `<ellipse cx="${W / 2}" cy="${(240 * s).toFixed(0)}" rx="${(W * 0.55).toFixed(0)}" ry="${(280 * s).toFixed(0)}" fill="url(#h8Bulan)"/>` +
    bingkaiTipis(W, H, s, inset, rx, "#aebfda", "#3f4d6b") +
    bulan +
    kelelawar(W * 0.26, (l ? 75 : 105) * s, 1.15 * s, false, "#0d1420") +
    kelelawar(W * 0.62, (l ? 60 : 85) * s, 0.95 * s, true, "#0d1420") +
    arwahZona +
    kabut +
    hero.svg +
    pembatas(W, pembatasY8, s, "#6f8fbf") +
    sisi +
    pitaBawahHoror(W, H, s, l, "h8Band", "#6f8fbf",
      arwah(96 * s, H - 80 * s, 0.72 * s),
      arwah(W - 96 * s, H - 80 * s, 0.72 * s, true)) +
    `</svg>`
  );
}

/* ============ DESEN 9 — RIMBA TERKUTUK (hijau racun + mata menyala) ============ */

export function svgHoror9(r: Rasio): string {
  const { W, H, l } = r;
  const s = Math.min(W, H) / 1080;
  const inset = Math.round(22 * s);
  const rx = Math.round(40 * s);
  const zona = (l ? 400 : 480) * s;

  const hero = teksAlamGaib(W, l, s, "gRacun", "h9Glow", "#a4ff4d", "#07130a");
  // v0.54.0 — nama desain dihapus; pembatas naik ke posisi semula nama desain
  const pembatasY9 = hero.baseline + (l ? 84 : 102);

  // dahan patah melintung dari sudut atas (garis + ranting + daun jarum)
  const dahan = (x0: number, flip: boolean) => {
    const dir = flip ? -1 : 1;
    let g =
      `<path d="M ${x0} ${inset + 4 * s} C ${x0 + dir * 120 * s} ${inset + 40 * s} ${x0 + dir * 200 * s} ${inset + 96 * s} ${x0 + dir * 250 * s} ${inset + 180 * s}" fill="none" stroke="#3d5226" stroke-width="${(7 * s).toFixed(1)}" stroke-linecap="round"/>` +
      `<path d="M ${x0 + dir * 130 * s} ${inset + 44 * s} C ${x0 + dir * 168 * s} ${inset + 34 * s} ${x0 + dir * 200 * s} ${inset + 42 * s} ${x0 + dir * 224 * s} ${inset + 66 * s}" fill="none" stroke="#31431d" stroke-width="${(4.4 * s).toFixed(1)}" stroke-linecap="round"/>` +
      `<path d="M ${x0 + dir * 90 * s} ${inset + 30 * s} C ${x0 + dir * 104 * s} ${inset + 10 * s} ${x0 + dir * 118 * s} ${inset + 6 * s} ${x0 + dir * 136 * s} ${inset + 10 * s}" fill="none" stroke="#31431d" stroke-width="${(3.4 * s).toFixed(1)}" stroke-linecap="round"/>`;
    // daun jarum di sepanjang dahan
    for (let i = 0; i < 6; i++) {
      const t = 0.25 + i * 0.13;
      const lx = x0 + dir * 250 * s * t;
      const ly = (inset + 4 * s) + (inset + 180 * s - inset - 4 * s) * t * 0.92;
      g += `<path d="M ${lx.toFixed(0)} ${ly.toFixed(0)} l ${dir * 14 * s} ${-10 * s} l ${-3 * s} ${11 * s} Z" fill="#4a6428" opacity="0.85"/>`;
    }
    return g;
  };
  const dahans = dahan(inset + 4 * s, false) + dahan(W - inset - 4 * s, true);

  // mata menyala di kegelapan (dua pasang, sisi zona atas)
  const mata = mataNyala((l ? 200 : 130) * s, (l ? 320 : 395) * s, (l ? 1.2 : 1.4) * s, "#a4ff4d", "h9GlowKecil") +
    mataNyala(W - (l ? 200 : 130) * s, (l ? 340 : 415) * s, (l ? 1.1 : 1.3) * s, "#ffd23e", "h9GlowKecil");

  // kunang-kunang
  let kunang = "";
  const posisiKunang: [number, number][] = l
    ? [[350, 260], [600, 200], [1350, 240], [1600, 300]]
    : [[240, 340], [420, 290], [660, 320], [860, 260], [980, 360]];
  for (const [x, y] of posisiKunang) {
    kunang += `<circle cx="${x * s}" cy="${y * s}" r="${(2.6 * s).toFixed(1)}" fill="#d9ff9e" opacity="0.9"/>` +
      `<circle cx="${x * s}" cy="${y * s}" r="${(6 * s).toFixed(1)}" fill="#a4ff4d" opacity="0.22"/>`;
  }

  // sulur berdaun sisi (TIPIS)
  const sulurSisi = (x: number, flip: boolean) => {
    let out = "";
    const amp = 7 * s;
    let i = 0;
    for (let y = zona + 30 * s; y <= H - 230 * s; y += 46 * s) {
      const dir = i % 2 === 0 ? 1 : -1;
      out += `<path d="M ${x} ${y.toFixed(0)} q ${(dir * amp * 1.6).toFixed(1)} ${(23 * s).toFixed(1)} 0 ${(46 * s).toFixed(1)}" fill="none" stroke="#4a6428" stroke-width="${(2.6 * s).toFixed(1)}" stroke-linecap="round"/>`;
      if (i % 2 === 0) {
        out += `<path transform="translate(${x + dir * amp * 2.2} ${(y + 18 * s).toFixed(0)}) rotate(${flip ? 20 : -20})" d="M0 0 C 8 -5 18 -5 24 2 C 18 8 8 8 0 0 Z" fill="#5c7a32" opacity="0.8"/>`;
      }
      i++;
    }
    return out;
  };
  const sisi = sulurSisi(52 * s, false) + sulurSisi(W - 52 * s, true);

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<defs>` +
    `<linearGradient id="h9Atas" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="#0c1509" stop-opacity="0.99"/><stop offset="0.55" stop-color="#070f06" stop-opacity="0.94"/><stop offset="1" stop-color="#040803" stop-opacity="0"/>` +
    `</linearGradient>` +
    `<radialGradient id="h9Racun" cx="0.5" cy="0.5" r="0.5">` +
    `<stop offset="0" stop-color="#2e6b1f" stop-opacity="0.6"/><stop offset="1" stop-color="#2e6b1f" stop-opacity="0"/>` +
    `</radialGradient>` +
    `<linearGradient id="gRacun" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="#f2ffdc"/><stop offset="0.4" stop-color="#c8f57e"/><stop offset="0.72" stop-color="#8ed449"/><stop offset="1" stop-color="#4c8a26"/>` +
    `</linearGradient>` +
    `<linearGradient id="h9Band" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="#080f05" stop-opacity="0"/><stop offset="0.5" stop-color="#10200b" stop-opacity="0.92"/><stop offset="1" stop-color="#182d0f" stop-opacity="0.97"/>` +
    `</linearGradient>` +
    `<filter id="h9Glow" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="${(10 * s).toFixed(1)}"/></filter>` +
    `<filter id="h9GlowKecil" x="-120%" y="-120%" width="340%" height="340%"><feGaussianBlur stdDeviation="${(5 * s).toFixed(1)}"/></filter>` +
    `</defs>` +
    `<rect x="0" y="0" width="${W}" height="${zona.toFixed(0)}" fill="url(#h9Atas)"/>` +
    `<ellipse cx="${W / 2}" cy="${(240 * s).toFixed(0)}" rx="${(W * 0.55).toFixed(0)}" ry="${(280 * s).toFixed(0)}" fill="url(#h9Racun)"/>` +
    bingkaiTipis(W, H, s, inset, rx, "#9fd66b", "#33591f") +
    dahans +
    mata +
    kunang +
    hero.svg +
    pembatas(W, pembatasY9, s, "#7bb04a") +
    sisi +
    pitaBawahHoror(W, H, s, l, "h9Band", "#7bb04a",
      mataNyala(96 * s, H - 78 * s, 0.9 * s, "#a4ff4d", "h9GlowKecil"),
      mataNyala(W - 96 * s, H - 78 * s, 0.9 * s, "#a4ff4d", "h9GlowKecil")) +
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
  ["horor-alam-gaib-3", svgHoror3],
  ["horor-alam-gaib-4", svgHoror4],
  ["horor-alam-gaib-5", svgHoror5],
  ["horor-alam-gaib-6", svgHoror6],
  ["horor-alam-gaib-7", svgHoror7],
  ["horor-alam-gaib-8", svgHoror8],
  ["horor-alam-gaib-9", svgHoror9],
];

for (const [slug, fn] of daftar) {
  await render(`${slug}-916.png`, fn(R916));
  await render(`${slug}-169.png`, fn(R169));
}
console.log("SELESAI →", OUT);
