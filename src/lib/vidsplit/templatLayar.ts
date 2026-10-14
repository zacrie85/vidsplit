// VidSplit v0.46.0 — MODE TEMPLATE HALAMAN (murni, aman-browser & server)
// Permintaan user lewat sketsa: "TEMPAT NAMA VIDEO / TEMPAT VIDEO / TEMPAT
// DESKRIPSI / TEMPAT PART" di atas latar gradasi — kanvas 9:16 penuh desain:
// judul di kotak atas, video tampil DI DALAM kotak tengah (jendela membulat),
// deskripsi di kotak bawah, Part di kotak kecil kiri-bawah.
//
// Geometri kotak dinyatakan dalah PERSEN (0–100) agar pratinjau CSS dan render
// ffmpeg memakai SATU sumber kebenaran yang sama.

export interface Kotak {
  /** persen dari LEBAR kanvas (titik kiri) */
  x: number;
  /** persen dari TINGGI kanvas (titik atas) */
  y: number;
  /** persen lebar */
  w: number;
  /** persen tinggi */
  h: number;
  /** radius sudut dalam px pada kanvas 1080-lebar (diskalakan pemakai) */
  radius: number;
}

/** Tata letak bawaan — mengikuti sketsa user */
export const TATA_TEMPLATE = {
  /** kotak judul — atas penuh */
  judul: { x: 4, y: 2.6, w: 92, h: 10.5, radius: 26 } as Kotak,
  /** jendela video — kotak besar tengah (interior transparan) */
  video: { x: 4, y: 15.5, w: 92, h: 55, radius: 30 } as Kotak,
  /** kotak deskripsi */
  deskripsi: { x: 4, y: 73, w: 92, h: 10.5, radius: 26 } as Kotak,
  /** kotak Part — kecil, kiri bawah (sketsa: bottom-left) */
  part: { x: 4, y: 86, w: 34, h: 10, radius: 24 } as Kotak,
};

/** px → px aktual: persen dikali dimensi kanvas */
export function kotakKePx(k: Kotak, W: number, H: number) {
  const skala = Math.min(W, H) / 1080;
  return {
    x: Math.round((k.x / 100) * W),
    y: Math.round((k.y / 100) * H),
    w: Math.round((k.w / 100) * W),
    h: Math.round((k.h / 100) * H),
    r: Math.round(k.radius * skala),
  };
}

/** Preset gradasi latar — pasangan warna (atas-kiri → bawah-kanan) */
export const PRESET_GRADASI: { label: string; a: string; b: string }[] = [
  { label: "Senja oranye", a: "#f59e0b", b: "#ec4899" }, // persis sketsa user
  { label: "Laut dalam", a: "#0ea5e9", b: "#1e3a8a" },
  { label: "Hutan", a: "#34d399", b: "#065f46" },
  { label: "Ungu magis", a: "#a78bfa", b: "#7c3aed" },
  { label: "Merah naga", a: "#ef4444", b: "#7f1d1d" },
  { label: "Malam hitam", a: "#334155", b: "#0f172a" },
];

export interface SetelanTemplat {
  grad1: string;
  grad2: string;
}

export const TEMPLAT_BAWAAN: SetelanTemplat = {
  grad1: PRESET_GRADASI[0].a,
  grad2: PRESET_GRADASI[0].b,
};

/** Clamp warna hex — bukan #rrggbb → bawaan */
export function rapikanWarnaHex(v: string | undefined, bawaan: string): string {
  return typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v) ? v.toLowerCase() : bawaan;
}

export function rapikanTemplat(t: Partial<SetelanTemplat> | undefined): SetelanTemplat {
  return {
    grad1: rapikanWarnaHex(t?.grad1, TEMPLAT_BAWAAN.grad1),
    grad2: rapikanWarnaHex(t?.grad2, TEMPLAT_BAWAAN.grad2),
  };
}

/* ============ SVG LATAR (server → sharp → PNG) ============ */

/**
 * SVG latar halaman template: gradasi penuh + kotak putih membulat.
 * INTERIOR jendela video = TRANSPARAN (lubang rounded-rect dgn fill-rule
 * evenodd) — video ditempatkan DI BALIK latar ini, tampil lewat jendela.
 */
export function svgLatarTemplate(W: number, H: number, t: SetelanTemplat): string {
  const kotak = (k: Kotak, isi: string) => {
    const px = kotakKePx(k, W, H);
    return `<rect x="${px.x}" y="${px.y}" width="${px.w}" height="${px.h}" rx="${px.r}" ${isi}/>`;
  };

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="${t.grad1}"/><stop offset="1" stop-color="${t.grad2}"/>` +
    `</linearGradient></defs>` +
    `<rect width="${W}" height="${H}" fill="url(#g)"/>` +
    // kotak judul / deskripsi / part — putih solid
    kotak(TATA_TEMPLATE.judul, `fill="#ffffff" opacity="0.96"`) +
    kotak(TATA_TEMPLATE.deskripsi, `fill="#ffffff" opacity="0.96"`) +
    kotak(TATA_TEMPLATE.part, `fill="#ffffff" opacity="0.96"`) +
    // jendela video: kotak putih LEBAR (bingkai) — interior-nya dipotong
    // TRANSPARAN belakangan oleh svgMaskLatarTemplate (komposit dest-in),
    // jadi di sini TIDAK digambar lubang apa pun.
    kotak(TATA_TEMPLATE.video, `fill="#ffffff" opacity="0.96"`) +
    `</svg>`
  );
}

/**
 * SVG MASK utk memotong interior jendela video jadi benar-benar transparan:
 * path putih penuh kanvas dgn lubang jendela (evenodd) — dipakai composite
 * "dest-in" setelah svgLatarTemplate dirasterisasi.
 */
export function svgMaskLatarTemplate(W: number, H: number): string {
  const v = kotakKePx(TATA_TEMPLATE.video, W, H);
  const jendela =
    `M ${v.x + v.r} ${v.y} L ${v.x + v.w - v.r} ${v.y} Q ${v.x + v.w} ${v.y} ${v.x + v.w} ${v.y + v.r}` +
    ` L ${v.x + v.w} ${v.y + v.h - v.r} Q ${v.x + v.w} ${v.y + v.h} ${v.x + v.w - v.r} ${v.y + v.h}` +
    ` L ${v.x + v.r} ${v.y + v.h} Q ${v.x} ${v.y + v.h} ${v.x} ${v.y + v.h - v.r}` +
    ` L ${v.x} ${v.y + v.r} Q ${v.x} ${v.y} ${v.x + v.r} ${v.y} Z`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">` +
    `<path fill="#fff" fill-rule="evenodd" d="M0 0 H${W} V${H} H0 Z ${jendela}"/></svg>`
  );
}
