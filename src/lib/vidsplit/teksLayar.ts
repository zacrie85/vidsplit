// VidSplit v0.25.0 — RENDER HALAMAN TEKS LAYAR -> PNG transparan via @resvg/resvg-js
// (shaping & layout stabil; drawtext bundel ffmpeg tidak tersedia utk teks kompleks).
// Parser lebar glyph TTF murni JS (cmap+htmx) utk wrap baris yang akurat & deterministik.
import { readFileSync } from "node:fs";
import path from "node:path";
import { Resvg } from "@resvg/resvg-js";

// ---------- Parser TTF minimal (head, hhea, hmtx, cmap format 4/12) ----------
interface InfoTtf {
  unitsPerEm: number;
  hmetrics: number;
  advances: number[];
  cmap: Map<number, number>;
}

const cacheTtf = new Map<string, InfoTtf>();
const u16 = (b: Buffer, o: number) => b.readUInt16BE(o);
const i16 = (b: Buffer, o: number) => b.readInt16BE(o);
const u32 = (b: Buffer, o: number) => b.readUInt32BE(o);

export function bacaTtf(file: string): InfoTtf {
  const hit = cacheTtf.get(file);
  if (hit) return hit;
  const b = readFileSync(file);
  const jumlah = u16(b, 4);
  const tabel: Record<string, [number, number]> = {};
  for (let i = 0; i < jumlah; i++) {
    const o = 12 + i * 16;
    tabel[b.toString("ascii", o, o + 4)] = [u32(b, o + 8), u32(b, o + 12)];
  }
  const unitsPerEm = u16(b, tabel["head"][0] + 18);
  const hmetrics = u16(b, tabel["hhea"][0] + 34);
  const [hmOff] = tabel["hmtx"];
  const advances: number[] = [];
  for (let g = 0; g < hmetrics; g++) advances.push(u16(b, hmOff + g * 4));
  const [cmOff, cmLen] = tabel["cmap"];
  const jumlahSub = u16(b, cmOff + 2);
  // pilih subtable: format 4 (BMP) diutamakan; format 12 (penuh) sebagai cadangan
  let sub4 = -1, sub12 = -1;
  for (let i = 0; i < jumlahSub; i++) {
    const off = cmOff + u32(b, cmOff + 4 + i * 8 + 4);
    const f = u16(b, off);
    if (f === 4 && sub4 < 0) sub4 = off;
    if (f === 12 && sub12 < 0) sub12 = off;
  }
  const cmap = new Map<number, number>();
  if (sub4 >= 0 && u16(b, sub4) === 4) {
    const segX2 = u16(b, sub4 + 6);
    const seg = segX2 / 2;
    const endO = sub4 + 14, startO = endO + segX2 + 2, deltaO = startO + segX2, rangeO = deltaO + segX2;
    for (let s = 0; s < seg; s++) {
      const akhir = u16(b, endO + s * 2), mulai = u16(b, startO + s * 2);
      const delta = i16(b, deltaO + s * 2), ro = u16(b, rangeO + s * 2);
      if (mulai === 0xffff) continue;
      for (let c = mulai; c <= akhir && c <= 0xfffd; c++) {
        if (ro === 0) { cmap.set(c, (c + delta) & 0xffff); continue; }
        const gO = rangeO + s * 2 + ro + (c - mulai) * 2;
        if (gO + 1 >= cmOff + cmLen) continue;
        const g = u16(b, gO);
        if (g !== 0) cmap.set(c, (g + delta) & 0xffff);
      }
    }
  } else if (sub12 >= 0) {
    const nGroup = u32(b, sub12 + 12);
    for (let g = 0; g < nGroup; g++) {
      const go = sub12 + 16 + g * 12;
      const mulai = u32(b, go), akhir = u32(b, go + 4), gMulai = u32(b, go + 8);
      for (let c = mulai; c <= akhir && c <= 0xfffd; c++) {
        const gid = gMulai + (c - mulai);
        if (gid > 0) cmap.set(c, gid & 0x7fffffff);
      }
    }
  }
  const info: InfoTtf = { unitsPerEm, hmetrics, advances, cmap };
  cacheTtf.set(file, info);
  return info;
}

function fontDejaVu(): string {
  const d = [process.env.VIDSPLIT_FONTS, path.join(process.cwd(), "assets", "fonts"),
    path.join(process.cwd(), "..", "assets", "fonts"), path.join(process.cwd(), "..", "..", "assets", "fonts")]
    .filter(Boolean) as string[];
  for (const dd of d) {
    const p = path.join(dd, "DejaVuSans.ttf");
    try { if (readFileSync(p).length > 1000) return p; } catch { /* lanjut */ }
  }
  return "DejaVuSans.ttf";
}

/** Lebar teks px pada fontSize (jumlah maju glyph — utk Latin cukup akurat) */
export function lebarTeks(teks: string, ttf: InfoTtf, fontSize: number): number {
  let unit = 0;
  for (const c of teks) {
    const g = ttf.cmap.get(c.codePointAt(0) ?? 0);
    if (g !== undefined) unit += g < ttf.hmetrics ? ttf.advances[g] : (ttf.advances[ttf.hmetrics - 1] ?? 500);
    else unit += ttf.unitsPerEm * 0.5;
  }
  return (unit / ttf.unitsPerEm) * fontSize;
}

/** Bungkus teks jadi baris dgn lebar maksimum px */
export function bungkusTeks(teks: string, ttf: InfoTtf, fontSize: number, lebarMaks: number): string[] {
  const kata = teks.split(/\s+/).filter(Boolean);
  const baris: string[] = [];
  let kini = "";
  for (const w of kata) {
    const coba = kini ? kini + " " + w : w;
    if (lebarTeks(coba, ttf, fontSize) <= lebarMaks || !kini) kini = coba;
    else { baris.push(kini); kini = w; }
  }
  if (kini) baris.push(kini);
  return baris;
}

export interface OpsiHalaman {
  lebar: number;
  tinggi: number;
  /** teks utama besar (narasi / judul bab) */
  besar?: string;
  /** label kecil di atas teks utama (mis. "BAB 2") */
  label?: string;
  footer?: string;
  warnaTeks?: string;
  warnaAksen?: string;
  /** posisi vertikal: tengah (bawaan) atau bawah (gaya subjudul) */
  posisi?: "tengah" | "bawah";
  /** skala font 0.7..1.4 */
  skala?: number;
  /** v0.26.0 — markup SVG adegan ilustrasi (tanpa wrapper <svg>) ditempel di belakang teks */
  adeganSvg?: string;
  /** v0.26.0 — defs global (gradient) milik adegan */
  defsSvg?: string;
  /** v0.26.0 — redupkan adegan agar teks tetap dominan */
  adeganRedup?: number; // 0..1 opacity
}

const ESC: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" };
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ESC[c]);

/** Render satu halaman overlay PNG RGBA. */
export function renderHalamanPng(o: OpsiHalaman): Buffer {
  const skala = o.skala ?? 1;
  const W = o.lebar, H = o.tinggi;
  const ttf = bacaTtf(fontDejaVu());
  const fsBesar = Math.round(Math.min(W * 0.062, H * 0.048) * skala);
  const fsLabel = Math.round(fsBesar * 0.52);
  const fsFooter = Math.round(fsBesar * 0.42);
  const lebarMaks = W * 0.86;
  const teks = o.warnaTeks ?? "#e8e8f0";
  const aksen = o.warnaAksen ?? "#c1272d";

  const barisBesar = o.besar ? bungkusTeks(o.besar, ttf, fsBesar, lebarMaks) : [];
  const tinggiIsi = barisBesar.length * fsBesar * 1.5 + (o.label ? fsLabel * 2.4 : 0);
  const yLabel = o.posisi === "bawah" ? H - tinggiIsi - fsFooter * 2.6 : Math.max(fsBesar, (H - tinggiIsi) / 2);

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">`;
  if (o.defsSvg) svg += o.defsSvg;
  svg += `<rect width="${W}" height="${H}" fill="none"/>`;
  // v0.26.0 — adegan ilustrasi di belakang teks
  if (o.adeganSvg) {
    const op = Math.min(1, Math.max(0.15, o.adeganRedup ?? 1));
    svg += `<g opacity="${op}">${o.adeganSvg}</g>`;
    // lapisan gelap tengah agar teks terbaca
    svg += `<rect width="${W}" height="${H}" fill="black" opacity="0.28"/>`;
  }
  let y = yLabel;
  if (o.label) {
    svg += `<text x="${W / 2}" y="${y + fsLabel}" font-family="DejaVu" font-size="${fsLabel}" fill="${aksen}" text-anchor="middle" letter-spacing="${Math.round(fsLabel * 0.3)}">${esc(o.label.toUpperCase())}</text>`;
    y += fsLabel * 2.4;
  }
  for (const b of barisBesar) {
    svg += `<text x="${W / 2}" y="${y + fsBesar}" font-family="DejaVu" font-size="${fsBesar}" fill="${teks}" text-anchor="middle">${esc(b)}</text>`;
    y += fsBesar * 1.5;
  }
  if (o.footer) {
    svg += `<text x="${W / 2}" y="${H - fsFooter * 1.2}" font-family="DejaVu" font-size="${fsFooter}" fill="${teks}" opacity="0.55" text-anchor="middle">${esc(o.footer)}</text>`;
  }
  svg += "</svg>";

  const r = new Resvg(svg, {
    fitTo: { mode: "original" },
    font: { fontFiles: [fontDejaVu()], loadSystemFonts: false, defaultFontFamily: "DejaVu" },
    background: "rgba(0,0,0,0)",
  });
  return r.render().asPng() as Buffer;
}
