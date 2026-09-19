// VidSplit v0.26.0 — ILUSTRATOR KOMIK (AI lokal, 100% offline):
// adegan SVG prosedural bergaya panel komik — bulan/matahari, awan, pohon mati,
// rumah berhantu, pagar, nisan, kabut, sosok, gagak, petir. v0.29.0: adegan BARU
// gunung/laut/kota utk genre dongeng/motivasi/fakta/misteri + mode CERAH
// (matahari, tanpa gagak/petir, kabut tipis). Deterministik per seed, ikut palet
// tema. Ditempel ke dalam SVG halaman (teksLayar) lalu dirender resvg — tanpa
// internet, tanpa model besar, bebas hak cipta.
import type { TemaHoror } from "./hororRender";
import type { GenreId } from "./videoAi";

function prng(seed: number): () => number {
  let s = (seed || 1) >>> 0;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

export const JENIS_ADEGAN = [
  "eksterior-rumah", "pemakaman", "hutan", "kamar", "lorong", "sosok",
  "gunung", "laut", "kota",
] as const;
export type JenisAdegan = (typeof JENIS_ADEGAN)[number];

/** v0.29.0 — daftar adegan per genre (urutan mengikuti suasana) */
export const ADEGAN_GENRE: Record<GenreId, JenisAdegan[]> = {
  horor: ["eksterior-rumah", "pemakaman", "hutan", "kamar", "lorong", "sosok"],
  misteri: ["lorong", "kota", "kamar", "eksterior-rumah", "hutan", "sosok"],
  legenda: ["gunung", "hutan", "eksterior-rumah", "laut", "sosok"],
  dongeng: ["gunung", "laut", "hutan", "eksterior-rumah"],
  motivasi: ["gunung", "laut", "kota"],
  fakta: ["kota", "gunung", "laut", "lorong"],
};

interface Ctx { w: number; h: number; r: () => number; tema: TemaHoror; ambient: boolean; cerah: boolean }

// ---------- elemen ----------
function langit(c: Ctx): string {
  const [g1, g2] = c.tema.grad;
  const gelap = c.ambient ? 0.92 : 1;
  let s = `<rect width="${c.w}" height="${c.h}" fill="url(#langit${c.tema.id})" opacity="${gelap}"/>`;
  void g1; void g2; // gradient didefinisikan di defs halaman (svgAdeganDef)
  return s;
}

function bulan(c: Ctx): string {
  if (c.ambient) return "";
  const r = c.r;
  const x = c.w * (0.18 + r() * 0.5);
  const y = c.h * (0.1 + r() * 0.12);
  const R = Math.min(c.w, c.h) * (0.055 + r() * 0.035);
  if (c.cerah) {
    // v0.29.0 — matahari utk genre cerah (dongeng/motivasi/fakta)
    return `
  <circle cx="${x}" cy="${y}" r="${R * 2.8}" fill="${c.tema.aksen}" opacity="0.14"/>
  <circle cx="${x}" cy="${y}" r="${R * 1.9}" fill="${c.tema.aksen}" opacity="0.22"/>
  <circle cx="${x}" cy="${y}" r="${R}" fill="#ffe9b8" opacity="0.96"/>
  <circle cx="${x}" cy="${y}" r="${R * 0.72}" fill="#fff6df" opacity="0.85"/>`;
  }
  return `
  <circle cx="${x}" cy="${y}" r="${R * 2.6}" fill="${c.tema.aksen}" opacity="0.10"/>
  <circle cx="${x}" cy="${y}" r="${R * 1.7}" fill="${c.tema.aksen}" opacity="0.16"/>
  <circle cx="${x}" cy="${y}" r="${R}" fill="#f3efe2" opacity="0.92"/>
  <circle cx="${x - R * 0.3}" cy="${y - R * 0.2}" r="${R * 0.22}" fill="#d8d2bd" opacity="0.7"/>
  <circle cx="${x + R * 0.35}" cy="${y + R * 0.25}" r="${R * 0.16}" fill="#d8d2bd" opacity="0.6"/>`;
}

function bintang(c: Ctx): string {
  if (c.ambient) return "";
  const r = c.r;
  let s = "";
  const n = 24 + Math.floor(r() * 20);
  for (let i = 0; i < n; i++) {
    const x = r() * c.w, y = r() * c.h * 0.45;
    const rr = (0.6 + r() * 1.4) * (c.w / 1080);
    s += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${rr.toFixed(1)}" fill="#ffffff" opacity="${(0.25 + r() * 0.55).toFixed(2)}"/>`;
  }
  return s;
}

function awan(c: Ctx): string {
  const r = c.r;
  let s = "";
  const n = c.ambient ? 2 : 3 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const x = r() * c.w, y = c.h * (0.06 + r() * 0.22);
    const w = c.w * (0.25 + r() * 0.3);
    const h = w * (0.16 + r() * 0.1);
    s += `<ellipse cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" rx="${w.toFixed(0)}" ry="${h.toFixed(0)}" fill="#0b0d14" opacity="${(0.5 + r() * 0.3).toFixed(2)}"/>`;
    s += `<ellipse cx="${(x - w * 0.3).toFixed(0)}" cy="${(y + h * 0.4).toFixed(0)}" rx="${(w * 0.6).toFixed(0)}" ry="${(h * 0.7).toFixed(0)}" fill="#131722" opacity="0.5"/>`;
  }
  return s;
}

/** pohon mati — ranting rekursif */
function pohon(c: Ctx, x: number, y: number, tinggi: number): string {
  const r = c.r;
  const warna = "#0a0c10";
  let s = "";
  const cabang = (x1: number, y1: number, ang: number, len: number, tebal: number, d: number): void => {
    const x2 = x1 + Math.sin(ang) * len;
    const y2 = y1 - Math.cos(ang) * len;
    s += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${warna}" stroke-width="${tebal.toFixed(1)}" stroke-linecap="round"/>`;
    if (d <= 0 || len < tinggi * 0.07) return;
    const n = 2 + (r() > 0.72 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      cabang(x2, y2, ang + (r() - 0.5) * 1.4, len * (0.55 + r() * 0.25), tebal * 0.62, d - 1);
    }
  };
  cabang(x, y, (r() - 0.5) * 0.2, tinggi, Math.max(3, tinggi * 0.07), 4);
  return s;
}

function hutan(c: Ctx): string {
  const r = c.r;
  let s = "";
  const n = c.ambient ? 4 : 7 + Math.floor(r() * 4);
  for (let i = 0; i < n; i++) {
    const x = c.w * ((i + r() * 0.7) / (n + 0.4));
    const t = c.h * (0.22 + r() * 0.3);
    const y = c.h * (0.72 + r() * 0.1);
    s += pohon(c, x, y, t);
  }
  return s;
}

function rumah(c: Ctx): string {
  if (c.ambient) return "";
  const r = c.r;
  const w = c.w * (0.34 + r() * 0.1);
  const h = w * (0.62 + r() * 0.16);
  const x = c.w * (0.12 + r() * 0.4);
  const y = c.h * 0.74 - h;
  const warna = "#080a0e";
  // badan + atap + serambi
  let s = `<rect x="${x.toFixed(0)}" y="${y.toFixed(0)}" width="${w.toFixed(0)}" height="${h.toFixed(0)}" fill="${warna}"/>`;
  s += `<polygon points="${(x - w * 0.05).toFixed(0)},${y.toFixed(0)} ${(x + w / 2).toFixed(0)},${(y - h * 0.34).toFixed(0)} ${(x + w * 1.05).toFixed(0)},${y.toFixed(0)}" fill="${warna}"/>`;
  // jendela menyala (kuning redup) & gelap
  const jn = 2 + Math.floor(r() * 2);
  for (let i = 0; i < jn; i++) {
    const jx = x + w * (0.12 + r() * 0.68);
    const jy = y + h * (0.16 + r() * 0.42);
    const jw = w * 0.1, jh = h * 0.14;
    const menyala = r() > 0.45;
    s += `<rect x="${jx.toFixed(0)}" y="${jy.toFixed(0)}" width="${jw.toFixed(0)}" height="${jh.toFixed(0)}" fill="${menyala ? c.tema.aksen : "#101318"}" opacity="${menyala ? 0.8 : 1}"/>`;
    if (menyala) s += `<rect x="${jx.toFixed(0)}" y="${jy.toFixed(0)}" width="${jw.toFixed(0)}" height="${jh.toFixed(0)}" fill="none" stroke="${c.tema.aksen}" stroke-width="1" opacity="0.35"/>`;
  }
  // pintu
  s += `<rect x="${(x + w * 0.42).toFixed(0)}" y="${(y + h * 0.62).toFixed(0)}" width="${(w * 0.16).toFixed(0)}" height="${(h * 0.38).toFixed(0)}" fill="#05060a"/>`;
  // cerobong
  s += `<rect x="${(x + w * 0.68).toFixed(0)}" y="${(y - h * 0.3).toFixed(0)}" width="${(w * 0.07).toFixed(0)}" height="${(h * 0.24).toFixed(0)}" fill="${warna}"/>`;
  // pagar
  const py = c.h * 0.76;
  for (let px = x - w * 0.5; px < x + w * 1.5; px += w * 0.09) {
    s += `<line x1="${px.toFixed(0)}" y1="${py.toFixed(0)}" x2="${px.toFixed(0)}" y2="${(py - c.h * 0.045).toFixed(0)}" stroke="#0a0c10" stroke-width="${(c.w * 0.004).toFixed(1)}"/>`;
  }
  s += `<line x1="${(x - w * 0.5).toFixed(0)}" y1="${(py - c.h * 0.02).toFixed(0)}" x2="${(x + w * 1.5).toFixed(0)}" y2="${(py - c.h * 0.02).toFixed(0)}" stroke="#0a0c10" stroke-width="${(c.w * 0.003).toFixed(1)}"/>`;
  return s;
}

function pemakaman(c: Ctx): string {
  const r = c.r;
  let s = "";
  const n = c.ambient ? 5 : 9 + Math.floor(r() * 5);
  for (let i = 0; i < n; i++) {
    const x = c.w * ((i + 0.3 + r() * 0.5) / n);
    const y = c.h * (0.7 + r() * 0.16);
    const w = c.w * (0.035 + r() * 0.025);
    const h = w * (1.5 + r());
    const miring = (r() - 0.5) * 14;
    if (r() > 0.5) {
      s += `<g transform="rotate(${miring.toFixed(1)} ${x.toFixed(0)} ${y.toFixed(0)})"><rect x="${(x - w / 2).toFixed(0)}" y="${(y - h).toFixed(0)}" width="${w.toFixed(0)}" height="${h.toFixed(0)}" rx="${(w / 2).toFixed(0)}" fill="#0b0d11"/></g>`;
    } else {
      s += `<g transform="rotate(${miring.toFixed(1)} ${x.toFixed(0)} ${y.toFixed(0)})"><path d="M ${(x - w / 2).toFixed(0)} ${(y - h * 0.75).toFixed(0)} L ${(x - w / 2).toFixed(0)} ${y.toFixed(0)} L ${(x + w / 2).toFixed(0)} ${y.toFixed(0)} L ${(x + w / 2).toFixed(0)} ${(y - h * 0.75).toFixed(0)} L ${x.toFixed(0)} ${(y - h).toFixed(0)} Z" fill="#0b0d11"/></g>`;
    }
  }
  return s;
}

function kamar(c: Ctx): string {
  const r = c.r;
  // interior: lantai, jendela besar berbulan, pintu terbuka bercahaya
  let s = `<rect x="0" y="${(c.h * 0.72).toFixed(0)}" width="${c.w}" height="${(c.h * 0.28).toFixed(0)}" fill="#08090d"/>`;
  s += `<line x1="0" y1="${(c.h * 0.72).toFixed(0)}" x2="${c.w}" y2="${(c.h * 0.72).toFixed(0)}" stroke="#1a1e26" stroke-width="2"/>`;
  // jendela
  const jw = c.w * 0.26, jh = jw * 1.35;
  const jx = c.w * (0.58 + r() * 0.1), jy = c.h * 0.16;
  s += `<rect x="${jx.toFixed(0)}" y="${jy.toFixed(0)}" width="${jw.toFixed(0)}" height="${jh.toFixed(0)}" fill="#101722" stroke="#0a0c10" stroke-width="${(c.w * 0.008).toFixed(1)}"/>`;
  s += `<circle cx="${(jx + jw * 0.5).toFixed(0)}" cy="${(jy + jh * 0.32).toFixed(0)}" r="${(jw * 0.18).toFixed(0)}" fill="#e8e4d4" opacity="0.85"/>`;
  s += `<line x1="${(jx + jw / 2).toFixed(0)}" y1="${jy.toFixed(0)}" x2="${(jx + jw / 2).toFixed(0)}" y2="${(jy + jh).toFixed(0)}" stroke="#0a0c10" stroke-width="${(c.w * 0.006).toFixed(1)}"/>`;
  // pintu terbuka + celah cahaya aksen
  const dx = c.w * 0.12, dw = c.w * 0.14;
  s += `<rect x="${dx.toFixed(0)}" y="${(c.h * 0.22).toFixed(0)}" width="${dw.toFixed(0)}" height="${(c.h * 0.5).toFixed(0)}" fill="#05060a"/>`;
  s += `<rect x="${(dx + dw).toFixed(0)}" y="${(c.h * 0.22).toFixed(0)}" width="${(dw * 0.16).toFixed(0)}" height="${(c.h * 0.5).toFixed(0)}" fill="${c.tema.aksen}" opacity="0.35"/>`;
  // tempat tidur siluet
  s += `<rect x="${(c.w * 0.36).toFixed(0)}" y="${(c.h * 0.62).toFixed(0)}" width="${(c.w * 0.2).toFixed(0)}" height="${(c.h * 0.1).toFixed(0)}" fill="#0a0c10"/>`;
  s += `<rect x="${(c.w * 0.36).toFixed(0)}" y="${(c.h * 0.56).toFixed(0)}" width="${(c.w * 0.035).toFixed(0)}" height="${(c.h * 0.07).toFixed(0)}" fill="#0a0c10"/>`;
  return s;
}

function lorong(c: Ctx): string {
  const r = c.r;
  // perspektif: dinding menuju pintu di ujung
  const vx = c.w * (0.4 + r() * 0.2), vy = c.h * 0.45;
  let s = "";
  s += `<polygon points="0,0 ${c.w},0 ${(vx + c.w * 0.09).toFixed(0)} ${(vy - c.h * 0.2).toFixed(0)} ${(vx - c.w * 0.09).toFixed(0)} ${(vy - c.h * 0.2).toFixed(0)}" fill="#0c0e14"/>`;
  s += `<polygon points="0,${c.h} ${c.w},${c.h} ${(vx + c.w * 0.09).toFixed(0)} ${(vy + c.h * 0.28).toFixed(0)} ${(vx - c.w * 0.09).toFixed(0)} ${(vy + c.h * 0.28).toFixed(0)}" fill="#05060a"/>`;
  // pintu ujung
  const dw = c.w * 0.055, dh = c.h * 0.2;
  s += `<rect x="${(vx - dw / 2).toFixed(0)}" y="${(vy - dh * 0.72).toFixed(0)}" width="${dw.toFixed(0)}" height="${dh.toFixed(0)}" fill="#040509"/>`;
  s += `<rect x="${(vx - dw / 2).toFixed(0)}" y="${(vy - dh * 0.72).toFixed(0)}" width="${dw.toFixed(0)}" height="${dh.toFixed(0)}" fill="none" stroke="${c.tema.aksen}" stroke-width="1.5" opacity="0.5"/>`;
  // lampu gantung
  s += `<line x1="${vx.toFixed(0)}" y1="0" x2="${vx.toFixed(0)}" y2="${(vy - c.h * 0.24).toFixed(0)}" stroke="#1a1e26" stroke-width="2"/>`;
  s += `<circle cx="${vx.toFixed(0)}" cy="${(vy - c.h * 0.21).toFixed(0)}" r="${(c.w * 0.012).toFixed(0)}" fill="${c.tema.aksen}" opacity="0.9"/>`;
  s += `<circle cx="${vx.toFixed(0)}" cy="${(vy - c.h * 0.21).toFixed(0)}" r="${(c.w * 0.03).toFixed(0)}" fill="${c.tema.aksen}" opacity="0.18"/>`;
  return s;
}

function sosok(c: Ctx): string {
  if (c.ambient) return "";
  const r = c.r;
  const x = c.w * (0.3 + r() * 0.4);
  const y = c.h * 0.78;
  const t = c.h * (0.16 + r() * 0.06);
  // siluet: kepala + badan + jubah
  let s = `<g opacity="0.94">`;
  s += `<circle cx="${x.toFixed(0)}" cy="${(y - t).toFixed(0)}" r="${(t * 0.14).toFixed(0)}" fill="#04050a"/>`;
  s += `<path d="M ${(x - t * 0.2).toFixed(0)} ${y.toFixed(0)} C ${(x - t * 0.26).toFixed(0)} ${(y - t * 0.62).toFixed(0)} ${(x - t * 0.1).toFixed(0)} ${(y - t * 0.8).toFixed(0)} ${x.toFixed(0)} ${(y - t * 0.82).toFixed(0)} C ${(x + t * 0.1).toFixed(0)} ${(y - t * 0.8).toFixed(0)} ${(x + t * 0.26).toFixed(0)} ${(y - t * 0.62).toFixed(0)} ${(x + t * 0.2).toFixed(0)} ${y.toFixed(0)} Z" fill="#04050a"/>`;
  s += `</g>`;
  // mata titik aksen
  s += `<circle cx="${(x - t * 0.05).toFixed(0)}" cy="${(y - t * 1.01).toFixed(0)}" r="${(t * 0.016).toFixed(1)}" fill="${c.tema.aksen}"/>`;
  s += `<circle cx="${(x + t * 0.05).toFixed(0)}" cy="${(y - t * 1.01).toFixed(0)}" r="${(t * 0.016).toFixed(1)}" fill="${c.tema.aksen}"/>`;
  return s;
}

function gagak(c: Ctx): string {
  if (c.ambient || c.cerah) return ""; // v0.29.0: genre cerah tanpa gagak
  const r = c.r;
  let s = "";
  const n = 1 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const x = r() * c.w, y = c.h * (0.12 + r() * 0.3);
    const w = c.w * (0.012 + r() * 0.01);
    s += `<path d="M ${(x - w).toFixed(0)} ${y.toFixed(0)} Q ${x.toFixed(0)} ${(y - w * 0.7).toFixed(0)} ${(x + w).toFixed(0)} ${y.toFixed(0)} Q ${x.toFixed(0)} ${(y - w * 0.3).toFixed(0)} ${(x - w).toFixed(0)} ${y.toFixed(0)} Z" fill="#04050a"/>`;
  }
  return s;
}

function kabut(c: Ctx): string {
  const r = c.r;
  let s = "";
  const n = c.ambient ? 3 : c.cerah ? 2 : 4 + Math.floor(r() * 3);
  const opsiDasar = c.cerah ? 0.04 : 0.05;
  for (let i = 0; i < n; i++) {
    const y = c.h * (0.6 + i * 0.07 + r() * 0.03);
    const w = c.w * (0.5 + r() * 0.6);
    const x = r() * c.w;
    s += `<ellipse cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" rx="${w.toFixed(0)}" ry="${(c.h * (0.028 + r() * 0.03)).toFixed(0)}" fill="#aeb6c4" opacity="${(opsiDasar + r() * (c.cerah ? 0.05 : 0.09)).toFixed(2)}"/>`;
  }
  return s;
}

function petir(c: Ctx): string {
  if (c.ambient || c.cerah || c.r() > 0.5) return ""; // v0.29.0: genre cerah tanpa petir
  const r = c.r;
  const x0 = c.w * (0.2 + r() * 0.6);
  let x = x0, y = 0;
  let s = `<polyline points="${x.toFixed(0)},${y} `;
  const langkah = 6 + Math.floor(r() * 4);
  for (let i = 0; i < langkah; i++) {
    x += (r() - 0.5) * c.w * 0.09;
    y += (c.h * 0.4) / langkah;
    s += `${x.toFixed(0)},${y.toFixed(0)} `;
  }
  s += `" fill="none" stroke="#e8ecff" stroke-width="${(c.w * 0.004).toFixed(1)}" opacity="0.85"/>`;
  return s;
}

/** SVG <defs> global halaman (gradient langit per tema) */
export function defsAdegan(tema: TemaHoror): string {
  return `<defs><linearGradient id="langit${tema.id}" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="${tema.grad[1]}"/><stop offset="1" stop-color="${tema.grad[0]}"/></linearGradient></defs>`;
}

export interface OpsiAdegan {
  jenis: JenisAdegan;
  lebar: number;
  tinggi: number;
  seed: number;
  tema: TemaHoror;
  /** ambient = variasi redup utk halaman narasi (teks tetap terbaca) */
  ambient?: boolean;
  /** v0.29.0 — genre cerah: matahari, tanpa gagak/petir, kabut tipis */
  cerah?: boolean;
}

/** Markup SVG adegan (TANPA wrapper <svg>) — ditempel di dalam SVG halaman */
export function svgAdegan(o: OpsiAdegan): string {
  const c: Ctx = { w: o.lebar, h: o.tinggi, r: prng(o.seed >>> 0), tema: o.tema, ambient: !!o.ambient, cerah: !!o.cerah };
  const bagian: string[] = [langit(c), bintang(c), bulan(c), awan(c)];
  switch (o.jenis) {
    case "eksterior-rumah": bagian.push(hutan(c), rumah(c)); break;
    case "pemakaman": bagian.push(hutan(c), pemakaman(c)); break;
    case "hutan": bagian.push(hutan(c)); break;
    case "kamar": bagian.push(kamar(c)); break;
    case "lorong": bagian.push(lorong(c)); break;
    case "sosok": bagian.push(hutan(c), sosok(c)); break;
    case "gunung": bagian.push(gunung(c)); break;
    case "laut": bagian.push(laut(c)); break;
    case "kota": bagian.push(kota(c)); break;
  }
  bagian.push(gagak(c), kabut(c), petir(c));
  return bagian.join("");
}

// ---------- v0.29.0 — adegan baru utk genre non-horor ----------

/** gunung: beberapa punggungan berlapis + jalur puncak + burung kecil */
function gunung(c: Ctx): string {
  const r = c.r;
  let s = "";
  const warna = ["#161a24", "#10131c", "#0a0c12"];
  const nPunggung = 3;
  for (let l = 0; l < nPunggung; l++) {
    const yDasar = c.h * (0.66 + l * 0.09);
    const tinggi = c.h * (0.3 - l * 0.06) * (0.85 + r() * 0.3);
    let d = `M -10 ${c.h + 10} L -10 ${yDasar.toFixed(0)} `;
    const puncakX = c.w * (0.2 + r() * 0.6);
    d += `L ${puncakX.toFixed(0)} ${(yDasar - tinggi).toFixed(0)} `;
    d += `L ${c.w + 10} ${yDasar.toFixed(0)} L ${c.w + 10} ${c.h + 10} Z`;
    s += `<path d="${d}" fill="${warna[l]}" opacity="${(0.9 - l * 0.12).toFixed(2)}"/>`;
    // salju/cahaya di puncak punggung terdepan
    if (l === nPunggung - 1) {
      s += `<polygon points="${(puncakX - c.w * 0.03).toFixed(0)},${(yDasar - tinggi * 0.82).toFixed(0)} ${puncakX.toFixed(0)},${(yDasar - tinggi).toFixed(0)} ${(puncakX + c.w * 0.03).toFixed(0)},${(yDasar - tinggi * 0.82).toFixed(0)}" fill="${c.tema.aksen}" opacity="0.35"/>`;
    }
  }
  // jalur pendakian halus
  s += `<path d="M ${(c.w * 0.48).toFixed(0)} ${c.h * 0.95} Q ${(c.w * 0.52).toFixed(0)} ${(c.h * 0.8).toFixed(0)} ${(c.w * 0.56).toFixed(0)} ${(c.h * 0.68).toFixed(0)}" fill="none" stroke="${c.tema.aksen}" stroke-width="2" opacity="0.25"/>`;
  // burung kecil
  if (!c.ambient) {
    const n = 2 + Math.floor(r() * 3);
    for (let i = 0; i < n; i++) {
      const bx = r() * c.w, by = c.h * (0.18 + r() * 0.18), bw = c.w * 0.011;
      s += `<path d="M ${(bx - bw).toFixed(0)} ${by.toFixed(0)} Q ${bx.toFixed(0)} ${(by - bw * 0.8).toFixed(0)} ${(bx + bw).toFixed(0)} ${by.toFixed(0)}" fill="none" stroke="#0b0d12" stroke-width="2"/>`;
    }
  }
  return s;
}

/** laut: horizon, pantulan matahari/bulan, ombak, perahu kecil */
function laut(c: Ctx): string {
  const r = c.r;
  const yHor = c.h * (0.58 + r() * 0.05);
  let s = `<rect x="0" y="${yHor.toFixed(0)}" width="${c.w}" height="${(c.h - yHor).toFixed(0)}" fill="#0a0f16"/>`;
  s += `<line x1="0" y1="${yHor.toFixed(0)}" x2="${c.w}" y2="${yHor.toFixed(0)}" stroke="#1c2531" stroke-width="2"/>`;
  // pantulan cahaya vertikal
  const cx = c.w * (0.3 + r() * 0.4);
  const warnaPantul = c.cerah ? c.tema.aksen : "#e8e4d4";
  for (let i = 0; i < 7; i++) {
    const wy = yHor + c.h * (0.03 + i * 0.045);
    const ww = c.w * (0.1 + r() * 0.08) * (1 - i * 0.07);
    s += `<rect x="${(cx - ww / 2).toFixed(0)}" y="${wy.toFixed(0)}" width="${ww.toFixed(0)}" height="${(c.h * 0.012).toFixed(0)}" rx="${(c.h * 0.006).toFixed(0)}" fill="${warnaPantul}" opacity="${(0.3 - i * 0.03).toFixed(2)}"/>`;
  }
  // ombak
  const nOmbak = c.ambient ? 5 : 9;
  for (let i = 0; i < nOmbak; i++) {
    const ox = r() * c.w, oy = yHor + c.h * (0.05 + r() * 0.3), ow = c.w * (0.1 + r() * 0.2);
    s += `<path d="M ${(ox - ow).toFixed(0)} ${oy.toFixed(0)} Q ${ox.toFixed(0)} ${(oy - c.h * 0.012).toFixed(0)} ${(ox + ow).toFixed(0)} ${oy.toFixed(0)}" fill="none" stroke="#18212e" stroke-width="${(c.w * 0.003).toFixed(1)}" opacity="0.7"/>`;
  }
  // perahu kecil (bukan saat ambient)
  if (!c.ambient) {
    const px = c.w * (0.24 + r() * 0.5), py = yHor + c.h * 0.12;
    const pw = c.w * 0.07;
    s += `<path d="M ${(px - pw).toFixed(0)} ${py.toFixed(0)} L ${(px + pw).toFixed(0)} ${py.toFixed(0)} L ${(px + pw * 0.55).toFixed(0)} ${(py + pw * 0.3).toFixed(0)} L ${(px - pw * 0.55).toFixed(0)} ${(py + pw * 0.3).toFixed(0)} Z" fill="#06080c"/>`;
    s += `<line x1="${px.toFixed(0)}" y1="${py.toFixed(0)}" x2="${px.toFixed(0)}" y2="${(py - pw * 0.9).toFixed(0)}" stroke="#06080c" stroke-width="3"/>`;
    s += `<polygon points="${px.toFixed(0)},${(py - pw * 0.9).toFixed(0)} ${(px + pw * 0.7).toFixed(0)},${(py - pw * 0.1).toFixed(0)} ${px.toFixed(0)},${(py - pw * 0.1).toFixed(0)}" fill="${c.tema.aksen}" opacity="0.5"/>`;
  }
  return s;
}

/** kota: siluet gedung + jendela menyala + antena + bulan/matahari di atas */
function kota(c: Ctx): string {
  const r = c.r;
  let s = "";
  let x = 0;
  while (x < c.w) {
    const bw = c.w * (0.06 + r() * 0.08);
    const bh = c.h * (0.14 + r() * 0.3);
    const by = c.h * 0.82 - bh;
    s += `<rect x="${x.toFixed(0)}" y="${by.toFixed(0)}" width="${bw.toFixed(0)}" height="${(bh + c.h * 0.2).toFixed(0)}" fill="#0a0c11"/>`;
    // antena di gedung tinggi
    if (bh > c.h * 0.3 && r() > 0.5) {
      s += `<line x1="${(x + bw / 2).toFixed(0)}" y1="${by.toFixed(0)}" x2="${(x + bw / 2).toFixed(0)}" y2="${(by - c.h * 0.04).toFixed(0)}" stroke="#0a0c11" stroke-width="2"/>`;
      s += `<circle cx="${(x + bw / 2).toFixed(0)}" cy="${(by - c.h * 0.04).toFixed(0)}" r="2.5" fill="${c.tema.aksen}" opacity="0.8"/>`;
    }
    // jendela
    const nJ = Math.floor(bw / (c.w * 0.018));
    for (let j = 0; j < nJ; j++) {
      for (let k = 0; k < Math.floor(bh / (c.h * 0.045)); k++) {
        if (r() > 0.72) {
          s += `<rect x="${(x + c.w * 0.008 + j * c.w * 0.018).toFixed(0)}" y="${(by + c.h * 0.018 + k * c.h * 0.045).toFixed(0)}" width="${(c.w * 0.008).toFixed(0)}" height="${(c.h * 0.018).toFixed(0)}" fill="${c.tema.aksen}" opacity="${(0.25 + r() * 0.5).toFixed(2)}"/>`;
        }
      }
    }
    x += bw + c.w * 0.008;
  }
  return s;
}

/** petik jenis adegan utk bab ke-i (berulang dgn urutan beragam) — v0.29.0: ikut genre */
export function jenisAdeganBab(i: number, seed: number, genre?: GenreId | null): JenisAdegan {
  const daftar = (genre && ADEGAN_GENRE[genre]) || ADEGAN_GENRE.horor;
  const r = prng((seed ^ (i * 2654435761)) >>> 0);
  return daftar[Math.floor(r() * daftar.length) % daftar.length];
}
