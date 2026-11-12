// VidSplit v3.5.0 — BINGKAI JUDUL FUTURISTIK (10 gaya SVG transparan)
// Permintaan user: "pada menu TEKS tambahkan/buatkan 10 frame untuk judul
// dengan tampilan futuristik dan juga transparan kawan dimana lebar dan
// tinggi frame nya mengikuti judul yang ada dan bisa di geser geser ke atas
// bawah kiri dan kanan".
// Desain:
//  · 10 gaya frame ala HUD/NOVACUT (sudut bracket, neon, hologram, siber,
//    retikel, ...) — SEMUA transparan (kaca fill-opacity 0.06–0.16, garis
//    stroke-opacity 0.4–0.95) supaya video tetap terlihat di baliknya.
//  · Kotak bingkai dihitung dari BLOK TEKS judul (baris terbungkus bungkus.ts
//    × ukuran font) → lebar & tinggi frame SELALU mengikuti judul.
//  · Posisi = judulX/judulY (jangkar sama persis dgn drawtext: X = TENGAH blok
//    teks, Y = ATAS blok teks) → menggeser judul (tombol panah atau seret di
//    pratinjau) ikut menggeser bingkainya.
//  · Render: jobs.ts mengukur lebar baris dgn TTF nyata (teksLayar.ts),
//    membangun SVG kanvas penuh → renderSvgCoverPng (resvg) → overlay ffmpeg
//    DI BAWAH drawtext (bingkai di belakang teks, teks tetap mesin drawtext).
//  · Pratinjau: SVG kotak nominal + preserveAspectRatio="none" +
//    vector-effect="non-scaling-stroke" (garis tetap rapi walau kotak
//    dibentangkan mengikuti ukuran teks).
// Murni & bebas node:* — aman diimpor komponen client maupun lib server.
// JANGAN impor types.ts di sini (types.ts mengimpor BINGKAI_JUDUL utk migrasi).

/** gaya bingkai: id + label UI + padding sekitar teks (× ukuran font/em) */
export interface GayaBingkaiJudul {
  id: string;
  nama: string;
  /** padding horizontal kiri-kanan (× ukuran font) */
  padX: number;
  /** padding vertikal atas-bawah (× ukuran font) */
  padY: number;
}

/** 10 gaya futuristik — urutan UI. "" (mati) = perilaku lama tanpa bingkai. */
export const BINGKAI_JUDUL: GayaBingkaiJudul[] = [
  { id: "hud-sudut", nama: "SUDUT HUD", padX: 0.72, padY: 0.5 },
  { id: "neon-bulat", nama: "NEON BULAT", padX: 0.66, padY: 0.46 },
  { id: "hologram", nama: "HOLOGRAM", padX: 0.8, padY: 0.55 },
  { id: "siber-hex", nama: "SIBER HEX", padX: 0.78, padY: 0.52 },
  { id: "garis-ganda", nama: "GARIS GANDA", padX: 0.58, padY: 0.42 },
  { id: "retikel", nama: "RETIKEL", padX: 0.72, padY: 0.5 },
  { id: "tepi-cahaya", nama: "TEPI CAHAYA", padX: 0.7, padY: 0.5 },
  { id: "grid-teknologi", nama: "GRID TEKNO", padX: 0.72, padY: 0.5 },
  { id: "panel-tegak", nama: "PANEL MIRING", padX: 0.92, padY: 0.52 },
  { id: "orbit-titik", nama: "ORBIT TITIK", padX: 0.72, padY: 0.5 },
];

/** v3.6.0 — jenis bingkai teks: setiap jenis punya katalog & posisi sendiri */
export type JenisBingkai = "judul" | "part" | "deskripsi";

/**
 * v3.6.0 — 10 BINGKAI KHUSUS PART/EPISODE (permintaan user: "untuk
 * part/bagian/episode buatkan frame khusus yang menarik dan bagus").
 * Tema tiket/film/badge — teks part pendek → kotak kompak & mencolok.
 * Semua id diawali "ep-" (unik lintas katalog, satu switch bentuk bersama).
 */
export const BINGKAI_PART: GayaBingkaiJudul[] = [
  { id: "ep-tiket", nama: "TIKET EPISODE", padX: 0.85, padY: 0.5 },
  { id: "ep-filmstrip", nama: "FILM STRIP", padX: 0.7, padY: 0.62 },
  { id: "ep-lencana", nama: "LENCANA HEX", padX: 0.95, padY: 0.55 },
  { id: "ep-vhs", nama: "KASET VHS", padX: 0.8, padY: 0.5 },
  { id: "ep-panel", nama: "PANEL MIRING", padX: 0.95, padY: 0.48 },
  { id: "ep-neon", nama: "NEON PILL", padX: 0.75, padY: 0.42 },
  { id: "ep-countdown", nama: "HITUNG FILM", padX: 0.9, padY: 0.55 },
  { id: "ep-pita", nama: "PITA BANNER", padX: 1.0, padY: 0.45 },
  { id: "ep-monitor", nama: "MONITOR REC", padX: 0.75, padY: 0.52 },
  { id: "ep-markah", nama: "MARKAH BAB", padX: 0.8, padY: 0.45 },
];

/**
 * v3.6.0 — 10 BINGKAI DESKRIPSI: panel untuk teks multi-baris (lebih tenang
 * daripada bingkai judul — aksen bar/garis/kaca, tetap transparan).
 * Semua id diawali "dp-" (unik lintas katalog).
 */
export const BINGKAI_DESKRIPSI: GayaBingkaiJudul[] = [
  { id: "dp-kaca", nama: "KACA SOFT", padX: 0.55, padY: 0.42 },
  { id: "dp-barkiri", nama: "BAR KIRI", padX: 0.5, padY: 0.38 },
  { id: "dp-kutip", nama: "KUTIP SUDUT", padX: 0.6, padY: 0.45 },
  { id: "dp-strip", nama: "STRIP GANDA", padX: 0.55, padY: 0.4 },
  { id: "dp-gelap", nama: "PANEL GELAP", padX: 0.6, padY: 0.45 },
  { id: "dp-senja", nama: "SUDUT SENJA", padX: 0.62, padY: 0.45 },
  { id: "dp-putus", nama: "GARIS PUTUS", padX: 0.55, padY: 0.42 },
  { id: "dp-papan", nama: "PAPAN INFO", padX: 0.6, padY: 0.48 },
  { id: "dp-kilau", nama: "KILAU TEPI", padX: 0.58, padY: 0.42 },
  { id: "dp-tick", nama: "KOLOM TICK", padX: 0.62, padY: 0.45 },
];

/** katalog per jenis (urutan = judul, part, deskripsi) */
export function katalogBingkai(jenis: JenisBingkai): GayaBingkaiJudul[] {
  return jenis === "part" ? BINGKAI_PART : jenis === "deskripsi" ? BINGKAI_DESKRIPSI : BINGKAI_JUDUL;
}

/** gaya by id (null bila tak dikenal — "" = mati) */
export function gayaBingkaiJudul(id: string): GayaBingkaiJudul | null {
  return BINGKAI_JUDUL.find((g) => g.id === id) ?? null;
}

/** v3.6.0 — gaya bingkai part / deskripsi by id */
export function gayaBingkaiPart(id: string): GayaBingkaiJudul | null {
  return BINGKAI_PART.find((g) => g.id === id) ?? null;
}
export function gayaBingkaiDeskripsi(id: string): GayaBingkaiJudul | null {
  return BINGKAI_DESKRIPSI.find((g) => g.id === id) ?? null;
}
/** gaya dari katalog sesuai jenis — id tak dikenal / salah katalog → null */
export function gayaBingkaiJenis(jenis: JenisBingkai, id: string): GayaBingkaiJudul | null {
  return katalogBingkai(jenis).find((g) => g.id === id) ?? null;
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const fm = (n: number) => String(r2(n));

/** kotak bingkai yang dihitung: x/y kiri-atas + w/h + fs render */
export interface KotakBj {
  x: number;
  y: number;
  w: number;
  h: number;
  fs: number;
}

/**
 * Hitung kotak bingkai sekitar blok judul — MURNI.
 *  xPersen   = judulX (persen lebar; 50 = tengah — sama dgn drawtext)
 *  yAtasPx   = atas blok teks px (posisiTeksBlok().yJ — rumus render yang sama)
 *  lebarTeks = lebar blok teks terukur px (TTF nyata di server)
 *  tinggiTeks= tinggi blok teks px (baris × fs × 1.5 — rumus tJ rantaiTeks)
 *  fs        = ukuran font render px (max(12, ukuran × skala))
 *  W/H       = kanvas output
 * Jangkar = TENGAH blok teks (X) & ATAS blok teks (Y) — persis drawtext;
 * kotak dipadding per gaya lalu di-clamp agar tak keluar kanvas.
 */
export function kotakBingkaiJudul(
  id: string,
  xPersen: number,
  yAtasPx: number,
  lebarTeks: number,
  tinggiTeks: number,
  fs: number,
  W: number,
  H: number,
  skalaL = 100,
  skalaT = 100,
): KotakBj | null {
  const g = gayaBingkaiJudul(id);
  if (!g || !(W > 1) || !(H > 1) || !(fs > 0)) return null;
  // v3.6.0 — skala manual (40–250 %, 100 = otomatis): mengalikan PADDING di
  // sekeliling teks → bingkai melebar/menyempit & meninggi/menurun, teks tetap
  // di tengah kotak (simetris di kedua sisi).
  const padX = Math.max(6, g.padX * fs * (skalaL / 100));
  const padY = Math.max(5, g.padY * fs * (skalaT / 100));
  const w = Math.min(W, Math.max(24, lebarTeks + padX * 2));
  const h = Math.min(H, Math.max(18, tinggiTeks + padY * 2));
  // jangkar X = tengah blok teks (drawtext: 50 → (w-text_w)/2, lain → W*x/100)
  const cx = (Math.min(100, Math.max(0, xPersen)) / 100) * W;
  const x = Math.min(Math.max(0, cx - w / 2), Math.max(0, W - w));
  const y = Math.min(Math.max(0, yAtasPx - padY), Math.max(0, H - h));
  return { x: r2(x), y: r2(y), w: r2(w), h: r2(h), fs: r2(fs) };
}

/**
 * v3.6.0 — kotak bingkai UNTUK SEMUA JENIS (judul/part/deskripsi) — aturan sama
 * dengan kotakBingkaiJudul, gaya diambil dari katalog jenis masing-masing.
 * yAtasPx = ATAS blok teks px (judul/part: posisiTeksBlok().yJ/.yP — deskripsi:
 * H × deskripsiY/100), jangkar X = TENGAH blok teks (persis drawtext).
 */
export function kotakBingkaiTeks(
  jenis: JenisBingkai,
  id: string,
  xPersen: number,
  yAtasPx: number,
  lebarTeks: number,
  tinggiTeks: number,
  fs: number,
  W: number,
  H: number,
  skalaL = 100,
  skalaT = 100,
): KotakBj | null {
  const g = gayaBingkaiJenis(jenis, id);
  if (!g || !(W > 1) || !(H > 1) || !(fs > 0)) return null;
  const padX = Math.max(6, g.padX * fs * (skalaL / 100));
  const padY = Math.max(5, g.padY * fs * (skalaT / 100));
  const w = Math.min(W, Math.max(24, lebarTeks + padX * 2));
  const h = Math.min(H, Math.max(18, tinggiTeks + padY * 2));
  const cx = (Math.min(100, Math.max(0, xPersen)) / 100) * W;
  const x = Math.min(Math.max(0, cx - w / 2), Math.max(0, W - w));
  const y = Math.min(Math.max(0, yAtasPx - padY), Math.max(0, H - h));
  return { x: r2(x), y: r2(y), w: r2(w), h: r2(h), fs: r2(fs) };
}

/** pembatas teks SVG (tak dipakai teks — bingkai murni bentuk) */
const VE = ` vector-effect="non-scaling-stroke"`;

/** lebar garis dasar per gaya (px render; proporsional ukuran font) */
function stDasar(fs: number): number {
  return Math.max(1.6, fs * 0.07);
}

/** bentuk SVG SATU gaya bingkai di dalam kotak k (tanpa <svg> pembungkus) */
function bentukBingkai(id: string, k: KotakBj): string {
  const { x, y, w, h, fs } = k;
  const st = stDasar(fs);
  const kanan = x + w;
  const bawah = y + h;
  const tengahX = x + w / 2;
  const tengahY = y + h / 2;
  switch (id) {
    case "hud-sudut": {
      // 4 bracket sudut L + garis tepi tipis + tick tengah — cyan
      const L = Math.min(w, h, fs * 0.95);
      const c = "#22d3ee";
      const tickW = Math.min(w * 0.14, fs * 0.6);
      return (
        `<rect x="${fm(x)}" y="${fm(y)}" width="${fm(w)}" height="${fm(h)}" fill="${c}" fill-opacity="0.06"/>` +
        `<rect x="${fm(x)}" y="${fm(y)}" width="${fm(w)}" height="${fm(h)}" fill="none" stroke="#ffffff" stroke-opacity="0.3" stroke-width="${fm(st * 0.6)}"${VE}/>` +
        `<path d="M ${fm(x)} ${fm(y + L)} L ${fm(x)} ${fm(y)} L ${fm(x + L)} ${fm(y)}" fill="none" stroke="${c}" stroke-opacity="0.95" stroke-width="${fm(st * 1.5)}"${VE}/>` +
        `<path d="M ${fm(kanan - L)} ${fm(y)} L ${fm(kanan)} ${fm(y)} L ${fm(kanan)} ${fm(y + L)}" fill="none" stroke="${c}" stroke-opacity="0.95" stroke-width="${fm(st * 1.5)}"${VE}/>` +
        `<path d="M ${fm(x)} ${fm(bawah - L)} L ${fm(x)} ${fm(bawah)} L ${fm(x + L)} ${fm(bawah)}" fill="none" stroke="${c}" stroke-opacity="0.95" stroke-width="${fm(st * 1.5)}"${VE}/>` +
        `<path d="M ${fm(kanan - L)} ${fm(bawah)} L ${fm(kanan)} ${fm(bawah)} L ${fm(kanan)} ${fm(bawah - L)}" fill="none" stroke="${c}" stroke-opacity="0.95" stroke-width="${fm(st * 1.5)}"${VE}/>` +
        `<line x1="${fm(tengahX - tickW)}" y1="${fm(y)}" x2="${fm(tengahX + tickW)}" y2="${fm(y)}" stroke="${c}" stroke-opacity="0.9" stroke-width="${fm(st * 1.2)}"${VE}/>` +
        `<line x1="${fm(tengahX - tickW)}" y1="${fm(bawah)}" x2="${fm(tengahX + tickW)}" y2="${fm(bawah)}" stroke="${c}" stroke-opacity="0.9" stroke-width="${fm(st * 1.2)}"${VE}/>`
      );
    }
    case "neon-bulat": {
      // rounded rect neon ganda (garis + glow lebar) + garis putih dalam — ungu
      const rx = Math.min(fs * 0.42, h / 2 - 1);
      const inset = Math.max(3, fs * 0.2);
      const c = "#a78bfa";
      return (
        `<rect x="${fm(x)}" y="${fm(y)}" width="${fm(w)}" height="${fm(h)}" rx="${fm(rx)}" fill="${c}" fill-opacity="0.1"/>` +
        `<rect x="${fm(x)}" y="${fm(y)}" width="${fm(w)}" height="${fm(h)}" rx="${fm(rx)}" fill="none" stroke="${c}" stroke-opacity="0.2" stroke-width="${fm(st * 3.4)}"${VE}/>` +
        `<rect x="${fm(x)}" y="${fm(y)}" width="${fm(w)}" height="${fm(h)}" rx="${fm(rx)}" fill="none" stroke="${c}" stroke-opacity="0.95" stroke-width="${fm(st * 1.6)}"${VE}/>` +
        `<rect x="${fm(x + inset)}" y="${fm(y + inset)}" width="${fm(w - inset * 2)}" height="${fm(h - inset * 2)}" rx="${fm(Math.max(2, rx - inset))}" fill="none" stroke="#ffffff" stroke-opacity="0.5" stroke-width="${fm(st * 0.6)}"${VE}/>`
      );
    }
    case "hologram": {
      // panel kaca + garis pindai + bar atas-bawah — biru langit
      const c = "#38bdf8";
      const bar = Math.max(2, fs * 0.09);
      const garis = [0.3, 0.5, 0.7]
        .map((f) => `<line x1="${fm(x + fs * 0.3)}" y1="${fm(y + h * f)}" x2="${fm(kanan - fs * 0.3)}" y2="${fm(y + h * f)}" stroke="${c}" stroke-opacity="0.18" stroke-width="${fm(st * 0.8)}"${VE}/>`)
        .join("");
      return (
        `<rect x="${fm(x)}" y="${fm(y)}" width="${fm(w)}" height="${fm(h)}" fill="#ffffff" fill-opacity="0.08"/>` +
        garis +
        `<rect x="${fm(x)}" y="${fm(y)}" width="${fm(w)}" height="${fm(bar)}" fill="${c}" fill-opacity="0.85"/>` +
        `<rect x="${fm(x)}" y="${fm(bawah - bar)}" width="${fm(w)}" height="${fm(bar)}" fill="${c}" fill-opacity="0.85"/>` +
        `<line x1="${fm(x)}" y1="${fm(y)}" x2="${fm(x)}" y2="${fm(bawah)}" stroke="#ffffff" stroke-opacity="0.5" stroke-width="${fm(st * 0.7)}"${VE}/>` +
        `<line x1="${fm(kanan)}" y1="${fm(y)}" x2="${fm(kanan)}" y2="${fm(bawah)}" stroke="#ffffff" stroke-opacity="0.5" stroke-width="${fm(st * 0.7)}"${VE}/>` +
        `<circle cx="${fm(x + fs * 0.28)}" cy="${fm(y + bar / 2)}" r="${fm(Math.max(1.5, fs * 0.07))}" fill="#ffffff" fill-opacity="0.9"/>` +
        `<circle cx="${fm(kanan - fs * 0.28)}" cy="${fm(bawah - bar / 2)}" r="${fm(Math.max(1.5, fs * 0.07))}" fill="#ffffff" fill-opacity="0.9"/>`
      );
    }
    case "siber-hex": {
      // oktagon sudut terpotong + segitiga kecil sudut — emerald
      const c = "#34d399";
      const pot = Math.min(fs * 0.55, w / 3, h / 3);
      const poto = Math.max(3, pot * 0.8);
      const inset = Math.max(3, fs * 0.18);
      const okt =
        `${fm(x + pot)},${fm(y)} ${fm(kanan - pot)},${fm(y)} ${fm(kanan)},${fm(y + pot)} ` +
        `${fm(kanan)},${fm(bawah - pot)} ${fm(kanan - pot)},${fm(bawah)} ${fm(x + pot)},${fm(bawah)} ` +
        `${fm(x)},${fm(bawah - pot)} ${fm(x)},${fm(y + pot)}`;
      const oktDalam =
        `${fm(x + pot + inset)},${fm(y + inset)} ${fm(kanan - pot - inset)},${fm(y + inset)} ${fm(kanan - inset)},${fm(y + poto + inset)} ` +
        `${fm(kanan - inset)},${fm(bawah - poto - inset)} ${fm(kanan - pot - inset)},${fm(bawah - inset)} ${fm(x + pot + inset)},${fm(bawah - inset)} ` +
        `${fm(x + inset)},${fm(bawah - poto - inset)} ${fm(x + inset)},${fm(y + poto + inset)}`;
      const tri = (px: number, py: number, dx: number, dy: number) =>
        `<polygon points="${fm(px)},${fm(py)} ${fm(px + dx)},${fm(py)} ${fm(px)},${fm(py + dy)}" fill="${c}" fill-opacity="0.8"/>`;
      return (
        `<polygon points="${okt}" fill="${c}" fill-opacity="0.1"/>` +
        `<polygon points="${okt}" fill="none" stroke="${c}" stroke-opacity="0.95" stroke-width="${fm(st * 1.3)}"${VE}/>` +
        `<polygon points="${oktDalam}" fill="none" stroke="#ffffff" stroke-opacity="0.35" stroke-width="${fm(st * 0.6)}"${VE}/>` +
        tri(x + pot * 0.12, y + pot * 0.12, pot * 0.5, pot * 0.5) +
        tri(kanan - pot * 0.62, y + pot * 0.12, pot * 0.5, pot * 0.5) +
        tri(x + pot * 0.12, bawah - pot * 0.62, pot * 0.5, pot * 0.5) +
        tri(kanan - pot * 0.62, bawah - pot * 0.62, pot * 0.5, pot * 0.5)
      );
    }
    case "garis-ganda": {
      // dua kotak bersarang + titik sudut — amber
      const c = "#fbbf24";
      const inset = Math.max(3, fs * 0.2);
      const titik = Math.max(1.8, fs * 0.1);
      const dots =
        [[x, y], [kanan, y], [x, bawah], [kanan, bawah]]
          .map(([px, py]) => `<circle cx="${fm(px)}" cy="${fm(py)}" r="${fm(titik)}" fill="${c}" fill-opacity="0.95"/>`)
          .join("");
      return (
        `<rect x="${fm(x)}" y="${fm(y)}" width="${fm(w)}" height="${fm(h)}" fill="${c}" fill-opacity="0.06"/>` +
        `<rect x="${fm(x)}" y="${fm(y)}" width="${fm(w)}" height="${fm(h)}" fill="none" stroke="#ffffff" stroke-opacity="0.6" stroke-width="${fm(st)}"${VE}/>` +
        `<rect x="${fm(x + inset)}" y="${fm(y + inset)}" width="${fm(w - inset * 2)}" height="${fm(h - inset * 2)}" fill="none" stroke="${c}" stroke-opacity="0.85" stroke-width="${fm(st * 0.8)}"${VE}/>` +
        dots
      );
    }
    case "retikel": {
      // bracket sudut + tick target tengah tiap sisi — rose (tanpa isi)
      const c = "#fb7185";
      const L = Math.min(w, h, fs * 0.9);
      const tick = Math.min(w * 0.1, fs * 0.45);
      return (
        `<path d="M ${fm(x)} ${fm(y + L)} L ${fm(x)} ${fm(y)} L ${fm(x + L)} ${fm(y)}" fill="none" stroke="${c}" stroke-opacity="0.95" stroke-width="${fm(st * 1.4)}"${VE}/>` +
        `<path d="M ${fm(kanan - L)} ${fm(y)} L ${fm(kanan)} ${fm(y)} L ${fm(kanan)} ${fm(y + L)}" fill="none" stroke="${c}" stroke-opacity="0.95" stroke-width="${fm(st * 1.4)}"${VE}/>` +
        `<path d="M ${fm(x)} ${fm(bawah - L)} L ${fm(x)} ${fm(bawah)} L ${fm(x + L)} ${fm(bawah)}" fill="none" stroke="${c}" stroke-opacity="0.95" stroke-width="${fm(st * 1.4)}"${VE}/>` +
        `<path d="M ${fm(kanan - L)} ${fm(bawah)} L ${fm(kanan)} ${fm(bawah)} L ${fm(kanan)} ${fm(bawah - L)}" fill="none" stroke="${c}" stroke-opacity="0.95" stroke-width="${fm(st * 1.4)}"${VE}/>` +
        `<line x1="${fm(tengahX - tick)}" y1="${fm(y)}" x2="${fm(tengahX + tick)}" y2="${fm(y)}" stroke="#ffffff" stroke-opacity="0.75" stroke-width="${fm(st)}"${VE}/>` +
        `<line x1="${fm(tengahX - tick)}" y1="${fm(bawah)}" x2="${fm(tengahX + tick)}" y2="${fm(bawah)}" stroke="#ffffff" stroke-opacity="0.75" stroke-width="${fm(st)}"${VE}/>` +
        `<line x1="${fm(x)}" y1="${fm(tengahY - tick)}" x2="${fm(x)}" y2="${fm(tengahY + tick)}" stroke="#ffffff" stroke-opacity="0.75" stroke-width="${fm(st)}"${VE}/>` +
        `<line x1="${fm(kanan)}" y1="${fm(tengahY - tick)}" x2="${fm(kanan)}" y2="${fm(tengahY + tick)}" stroke="#ffffff" stroke-opacity="0.75" stroke-width="${fm(st)}"${VE}/>`
      );
    }
    case "tepi-cahaya": {
      // tepi gradasi atas→bawah + glow lembut — fuchsia
      const c = "#e879f9";
      const gid = "bjgrad-cahaya";
      return (
        `<defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0" stop-color="${c}" stop-opacity="0.95"/>` +
        `<stop offset="1" stop-color="#38bdf8" stop-opacity="0.4"/></linearGradient>` +
        `<linearGradient id="${gid}f" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0" stop-color="${c}" stop-opacity="0.12"/>` +
        `<stop offset="1" stop-color="#38bdf8" stop-opacity="0.03"/></linearGradient></defs>` +
        `<rect x="${fm(x)}" y="${fm(y)}" width="${fm(w)}" height="${fm(h)}" fill="url(#${gid}f)"/>` +
        `<rect x="${fm(x)}" y="${fm(y)}" width="${fm(w)}" height="${fm(h)}" fill="none" stroke="${c}" stroke-opacity="0.15" stroke-width="${fm(st * 4)}"${VE}/>` +
        `<rect x="${fm(x)}" y="${fm(y)}" width="${fm(w)}" height="${fm(h)}" fill="none" stroke="url(#${gid})" stroke-width="${fm(st * 1.7)}"${VE}/>`
      );
    }
    case "grid-teknologi": {
      // panel + kotak kecil grid 3×3 di 4 sudut + notch tengah — teal
      const c = "#2dd4bf";
      const s = Math.max(2, fs * 0.14);
      const jarak = Math.max(3, fs * 0.22);
      const grid = (px: number, py: number) =>
        [0, 1, 2]
          .map((i) =>
            [0, 1, 2]
              .map((j) => `<rect x="${fm(px + j * (s + 1.5))}" y="${fm(py + i * (s + 1.5))}" width="${fm(s)}" height="${fm(s)}" fill="${c}" fill-opacity="${fm(0.85 - (i + j) * 0.18)}"/>`)
              .join(""),
          )
          .join("");
      const notchW = Math.min(w * 0.12, fs * 0.8);
      return (
        `<rect x="${fm(x)}" y="${fm(y)}" width="${fm(w)}" height="${fm(h)}" fill="${c}" fill-opacity="0.08"/>` +
        `<rect x="${fm(x)}" y="${fm(y)}" width="${fm(w)}" height="${fm(h)}" fill="none" stroke="#ffffff" stroke-opacity="0.45" stroke-width="${fm(st * 0.7)}"${VE}/>` +
        grid(x + jarak, y + jarak) +
        grid(kanan - jarak - s * 3 - 3, y + jarak) +
        grid(x + jarak, bawah - jarak - s * 3 - 3) +
        grid(kanan - jarak - s * 3 - 3, bawah - jarak - s * 3 - 3) +
        `<rect x="${fm(tengahX - notchW / 2)}" y="${fm(y)}" width="${fm(notchW)}" height="${fm(Math.max(2, st * 1.2))}" fill="${c}" fill-opacity="0.95"/>` +
        `<rect x="${fm(tengahX - notchW / 2)}" y="${fm(bawah - Math.max(2, st * 1.2))}" width="${fm(notchW)}" height="${fm(Math.max(2, st * 1.2))}" fill="${c}" fill-opacity="0.95"/>`
      );
    }
    case "panel-tegak": {
      // panel miring dinamis + bar aksen kiri — lime
      const c = "#a3e635";
      const s = Math.min(w / 4, fs * 0.6);
      const poly = `${fm(x + s)},${fm(y)} ${fm(kanan)},${fm(y)} ${fm(kanan)},${fm(bawah)} ${fm(x)},${fm(bawah)}`;
      return (
        `<polygon points="${poly}" fill="#ffffff" fill-opacity="0.1"/>` +
        `<polygon points="${poly}" fill="none" stroke="#ffffff" stroke-opacity="0.55" stroke-width="${fm(st)}"${VE}/>` +
        `<line x1="${fm(x + s)}" y1="${fm(y)}" x2="${fm(x)}" y2="${fm(bawah)}" stroke="${c}" stroke-opacity="0.95" stroke-width="${fm(st * 1.9)}"${VE}/>` +
        `<line x1="${fm(kanan - fs * 0.35)}" y1="${fm(y + fs * 0.2)}" x2="${fm(kanan - fs * 0.35)}" y2="${fm(bawah - fs * 0.2)}" stroke="${c}" stroke-opacity="0.5" stroke-width="${fm(st * 0.8)}"${VE}/>`
      );
    }
    case "orbit-titik": {
      // bingkai bulat + 4 titik orbit + garis aksen sisi — oranye
      const c = "#fb923c";
      const rx = Math.min(fs * 0.3, h / 2 - 1);
      const r = Math.max(2, fs * 0.14);
      return (
        `<rect x="${fm(x)}" y="${fm(y)}" width="${fm(w)}" height="${fm(h)}" rx="${fm(rx)}" fill="${c}" fill-opacity="0.07"/>` +
        `<rect x="${fm(x)}" y="${fm(y)}" width="${fm(w)}" height="${fm(h)}" rx="${fm(rx)}" fill="none" stroke="#ffffff" stroke-opacity="0.55" stroke-width="${fm(st * 0.8)}"${VE}/>` +
        `<circle cx="${fm(tengahX)}" cy="${fm(y)}" r="${fm(r)}" fill="${c}" fill-opacity="0.95"/>` +
        `<circle cx="${fm(tengahX)}" cy="${fm(bawah)}" r="${fm(r)}" fill="${c}" fill-opacity="0.95"/>` +
        `<circle cx="${fm(x)}" cy="${fm(tengahY)}" r="${fm(r * 0.8)}" fill="#ffffff" fill-opacity="0.9"/>` +
        `<circle cx="${fm(kanan)}" cy="${fm(tengahY)}" r="${fm(r * 0.8)}" fill="#ffffff" fill-opacity="0.9"/>` +
        `<line x1="${fm(x + r + 2)}" y1="${fm(tengahY)}" x2="${fm(x + r + 2 + fs * 0.3)}" y2="${fm(tengahY)}" stroke="${c}" stroke-opacity="0.7" stroke-width="${fm(st * 0.9)}"${VE}/>` +
        `<line x1="${fm(kanan - r - 2 - fs * 0.3)}" y1="${fm(tengahY)}" x2="${fm(kanan - r - 2)}" y2="${fm(tengahY)}" stroke="${c}" stroke-opacity="0.7" stroke-width="${fm(st * 0.9)}"${VE}/>`
      );
    }
    // ============ v3.6.0 — BINGKAI KHUSUS PART/EPISODE (10 gaya) ============
    case "ep-tiket": {
      // tiket bioskop: kaca + lubang robek kiri-kanan + garis putus vertikal
      const c = "#22d3ee";
      const rx = Math.min(fs * 0.28, h / 2 - 1);
      const lx = x + w * 0.78; // garis robek
      const lubang = Math.max(2.5, fs * 0.16);
      const dash = `${fm(Math.max(3, fs * 0.22))} ${fm(Math.max(2.5, fs * 0.18))}`;
      return (
        `<rect x="${fm(x)}" y="${fm(y)}" width="${fm(w)}" height="${fm(h)}" rx="${fm(rx)}" fill="${c}" fill-opacity="0.12"/>` +
        `<rect x="${fm(x)}" y="${fm(y)}" width="${fm(w)}" height="${fm(h)}" rx="${fm(rx)}" fill="none" stroke="${c}" stroke-opacity="0.95" stroke-width="${fm(st * 1.3)}"${VE}/>` +
        `<rect x="${fm(x + Math.max(3, fs * 0.14))}" y="${fm(y + Math.max(3, fs * 0.14))}" width="${fm(w - Math.max(6, fs * 0.28))}" height="${fm(h - Math.max(6, fs * 0.28))}" rx="${fm(Math.max(2, rx - fs * 0.1))}" fill="none" stroke="#ffffff" stroke-opacity="0.4" stroke-width="${fm(st * 0.6)}"${VE}/>` +
        `<line x1="${fm(lx)}" y1="${fm(y + 2)}" x2="${fm(lx)}" y2="${fm(bawah - 2)}" stroke="#ffffff" stroke-opacity="0.75" stroke-width="${fm(st * 0.9)}" stroke-dasharray="${dash}"/>` +
        `<circle cx="${fm(lx)}" cy="${fm(y)}" r="${fm(lubang)}" fill="#000000" fill-opacity="0.55" stroke="${c}" stroke-opacity="0.9" stroke-width="${fm(st * 0.7)}"/>` +
        `<circle cx="${fm(lx)}" cy="${fm(bawah)}" r="${fm(lubang)}" fill="#000000" fill-opacity="0.55" stroke="${c}" stroke-opacity="0.9" stroke-width="${fm(st * 0.7)}"/>` +
        `<circle cx="${fm(x + fs * 0.4)}" cy="${fm(tengahY)}" r="${fm(Math.max(1.8, fs * 0.1))}" fill="${c}" fill-opacity="0.95"/>`
      );
    }
    case "ep-filmstrip": {
      // strip film: lubang geligi (deret kotak) atas & bawah — sepia
      const c = "#fcd34d";
      const tinggiLubang = Math.max(3, fs * 0.2);
      const sisi = Math.max(4, fs * 0.22);
      const n = Math.max(3, Math.floor((w - sisi * 2) / (tinggiLubang * 2.2)));
      const jarak = (w - sisi * 2) / n;
      const lubang = (py: number) =>
        Array.from({ length: n }, (_, i) =>
          `<rect x="${fm(x + sisi + i * jarak + jarak * 0.18)}" y="${fm(py)}" width="${fm(tinggiLubang * 1.25)}" height="${fm(tinggiLubang)}" rx="${fm(tinggiLubang * 0.3)}" fill="#000000" fill-opacity="0.6"/>`,
        ).join("");
      return (
        `<rect x="${fm(x)}" y="${fm(y)}" width="${fm(w)}" height="${fm(h)}" fill="${c}" fill-opacity="0.1"/>` +
        `<rect x="${fm(x)}" y="${fm(y)}" width="${fm(w)}" height="${fm(h)}" fill="none" stroke="${c}" stroke-opacity="0.95" stroke-width="${fm(st * 1.2)}"${VE}/>` +
        `<rect x="${fm(x)}" y="${fm(y)}" width="${fm(w)}" height="${fm(tinggiLubang + 4)}" fill="${c}" fill-opacity="0.32"/>` +
        `<rect x="${fm(x)}" y="${fm(bawah - tinggiLubang - 4)}" width="${fm(w)}" height="${fm(tinggiLubang + 4)}" fill="${c}" fill-opacity="0.32"/>` +
        lubang(y + 2) +
        lubang(bawah - tinggiLubang - 2)
      );
    }
    case "ep-lencana": {
      // lencana heksagonal lebar (badge episode) + heksagon dalam + sayap garis
      const c = "#c084fc";
      const pot = Math.min(h * 0.5, w * 0.14);
      const hex =
        `${fm(x + pot)},${fm(y)} ${fm(kanan - pot)},${fm(y)} ${fm(kanan)},${fm(tengahY)} ` +
        `${fm(kanan - pot)},${fm(bawah)} ${fm(x + pot)},${fm(bawah)} ${fm(x)},${fm(tengahY)}`;
      const inset = Math.max(3, fs * 0.18);
      const potD = Math.max(3, pot - inset * 0.8);
      const hexD =
        `${fm(x + potD + inset * 0.4)},${fm(y + inset)} ${fm(kanan - potD - inset * 0.4)},${fm(y + inset)} ${fm(kanan - inset)},${fm(tengahY)} ` +
        `${fm(kanan - potD - inset * 0.4)},${fm(bawah - inset)} ${fm(x + potD + inset * 0.4)},${fm(bawah - inset)} ${fm(x + inset)},${fm(tengahY)}`;
      return (
        `<polygon points="${hex}" fill="${c}" fill-opacity="0.12"/>` +
        `<polygon points="${hex}" fill="none" stroke="${c}" stroke-opacity="0.95" stroke-width="${fm(st * 1.4)}"${VE}/>` +
        `<polygon points="${hexD}" fill="none" stroke="#ffffff" stroke-opacity="0.45" stroke-width="${fm(st * 0.6)}"${VE}/>` +
        `<line x1="${fm(x - fs * 0.5)}" y1="${fm(tengahY)}" x2="${fm(x - fs * 0.1)}" y2="${fm(tengahY)}" stroke="${c}" stroke-opacity="0.85" stroke-width="${fm(st * 1.2)}"${VE}/>` +
        `<line x1="${fm(kanan + fs * 0.1)}" y1="${fm(tengahY)}" x2="${fm(kanan + fs * 0.5)}" y2="${fm(tengahY)}" stroke="${c}" stroke-opacity="0.85" stroke-width="${fm(st * 1.2)}"${VE}/>` +
        `<circle cx="${fm(tengahX)}" cy="${fm(y + 1)}" r="${fm(Math.max(1.6, fs * 0.08))}" fill="#ffffff" fill-opacity="0.9"/>`
      );
    }
    case "ep-vhs": {
      // kaset VHS: badan + sudut terpotong kanan-atas + titik REC merah
      const c = "#f87171";
      const pot = Math.min(w / 4, fs * 0.7);
      const badan =
        `${fm(x)},${fm(y)} ${fm(kanan - pot)},${fm(y)} ${fm(kanan)},${fm(y + pot)} ` +
        `${fm(kanan)},${fm(bawah)} ${fm(x)},${fm(bawah)}`;
      return (
        `<polygon points="${badan}" fill="#ffffff" fill-opacity="0.1"/>` +
        `<polygon points="${badan}" fill="none" stroke="#e2e8f0" stroke-opacity="0.7" stroke-width="${fm(st * 1.1)}"${VE}/>` +
        `<line x1="${fm(kanan - pot)}" y1="${fm(y)}" x2="${fm(kanan)}" y2="${fm(y + pot)}" stroke="${c}" stroke-opacity="0.95" stroke-width="${fm(st * 1.6)}"${VE}/>` +
        `<circle cx="${fm(x + fs * 0.35)}" cy="${fm(y + h / 2)}" r="${fm(Math.max(2.2, fs * 0.13))}" fill="${c}" fill-opacity="0.95"/>` +
        `<circle cx="${fm(x + fs * 0.35)}" cy="${fm(y + h / 2)}" r="${fm(Math.max(4, fs * 0.24))}" fill="none" stroke="${c}" stroke-opacity="0.4" stroke-width="${fm(st * 0.7)}"${VE}/>` +
        `<line x1="${fm(x + fs * 0.75)}" y1="${fm(bawah - fs * 0.28)}" x2="${fm(kanan - fs * 0.25)}" y2="${fm(bawah - fs * 0.28)}" stroke="${c}" stroke-opacity="0.6" stroke-width="${fm(st * 0.8)}"${VE}/>`
      );
    }
    case "ep-panel": {
      // panel miring ganda (chevron) + bar kiri tebal — biru
      const c = "#60a5fa";
      const s = Math.min(w / 5, fs * 0.55);
      const poly =
        `${fm(x + s)},${fm(y)} ${fm(kanan)},${fm(y)} ${fm(kanan - s)},${fm(bawah)} ${fm(x)},${fm(bawah)}`;
      return (
        `<polygon points="${poly}" fill="${c}" fill-opacity="0.12"/>` +
        `<polygon points="${poly}" fill="none" stroke="${c}" stroke-opacity="0.95" stroke-width="${fm(st * 1.3)}"${VE}/>` +
        `<polygon points="${fm(x + s)},${fm(y)} ${fm(x + s * 2)},${fm(y)} ${fm(x + s)},${fm(bawah)} ${fm(x)},${fm(bawah)}" fill="${c}" fill-opacity="0.85"/>` +
        `<line x1="${fm(kanan - s * 1.4)}" y1="${fm(y + fs * 0.18)}" x2="${fm(kanan - s * 2.4)}" y2="${fm(bawah - fs * 0.18)}" stroke="#ffffff" stroke-opacity="0.5" stroke-width="${fm(st * 0.7)}"${VE}/>`
      );
    }
    case "ep-neon": {
      // pill neon penuh (rx = h/2) + glow ganda + titik sisi — pink
      const c = "#f472b6";
      const r = h / 2 - 1;
      return (
        `<rect x="${fm(x)}" y="${fm(y)}" width="${fm(w)}" height="${fm(h)}" rx="${fm(r)}" fill="${c}" fill-opacity="0.12"/>` +
        `<rect x="${fm(x)}" y="${fm(y)}" width="${fm(w)}" height="${fm(h)}" rx="${fm(r)}" fill="none" stroke="${c}" stroke-opacity="0.25" stroke-width="${fm(st * 3.6)}"${VE}/>` +
        `<rect x="${fm(x)}" y="${fm(y)}" width="${fm(w)}" height="${fm(h)}" rx="${fm(r)}" fill="none" stroke="${c}" stroke-opacity="0.95" stroke-width="${fm(st * 1.6)}"${VE}/>` +
        `<circle cx="${fm(x + r * 0.6)}" cy="${fm(tengahY)}" r="${fm(Math.max(1.8, fs * 0.09))}" fill="#ffffff" fill-opacity="0.95"/>` +
        `<circle cx="${fm(kanan - r * 0.6)}" cy="${fm(tengahY)}" r="${fm(Math.max(1.8, fs * 0.09))}" fill="#ffffff" fill-opacity="0.95"/>`
      );
    }
    case "ep-countdown": {
      // pemimpin hitung film: lingkaran bidik + tick 12/3/6/9 — putih-cyan
      const c = "#67e8f9";
      const r = Math.min(h / 2 - 1, fs * 0.85);
      const tick = Math.max(3, fs * 0.2);
      return (
        `<circle cx="${fm(tengahX)}" cy="${fm(tengahY)}" r="${fm(r)}" fill="none" stroke="#ffffff" stroke-opacity="0.4" stroke-width="${fm(st * 0.7)}"${VE}/>` +
        `<circle cx="${fm(tengahX)}" cy="${fm(tengahY)}" r="${fm(r * 0.55)}" fill="${c}" fill-opacity="0.08"/>` +
        `<line x1="${fm(tengahX - tick)}" y1="${fm(y)}" x2="${fm(tengahX + tick)}" y2="${fm(y)}" stroke="${c}" stroke-opacity="0.95" stroke-width="${fm(st * 1.3)}"${VE}/>` +
        `<line x1="${fm(tengahX - tick)}" y1="${fm(bawah)}" x2="${fm(tengahX + tick)}" y2="${fm(bawah)}" stroke="${c}" stroke-opacity="0.95" stroke-width="${fm(st * 1.3)}"${VE}/>` +
        `<line x1="${fm(x)}" y1="${fm(tengahY - tick)}" x2="${fm(x)}" y2="${fm(tengahY + tick)}" stroke="${c}" stroke-opacity="0.95" stroke-width="${fm(st * 1.3)}"${VE}/>` +
        `<line x1="${fm(kanan)}" y1="${fm(tengahY - tick)}" x2="${fm(kanan)}" y2="${fm(tengahY + tick)}" stroke="${c}" stroke-opacity="0.95" stroke-width="${fm(st * 1.3)}"${VE}/>` +
        `<line x1="${fm(x + fs * 0.15)}" y1="${fm(y + fs * 0.15)}" x2="${fm(x + fs * 0.5)}" y2="${fm(y + fs * 0.15)}" stroke="#ffffff" stroke-opacity="0.55" stroke-width="${fm(st * 0.7)}"${VE}/>` +
        `<line x1="${fm(x + fs * 0.15)}" y1="${fm(y + fs * 0.15)}" x2="${fm(x + fs * 0.15)}" y2="${fm(bawah - fs * 0.15)}" stroke="#ffffff" stroke-opacity="0.55" stroke-width="${fm(st * 0.7)}"${VE}/>` +
        `<line x1="${fm(kanan - fs * 0.15)}" y1="${fm(bawah - fs * 0.15)}" x2="${fm(kanan - fs * 0.5)}" y2="${fm(bawah - fs * 0.15)}" stroke="#ffffff" stroke-opacity="0.55" stroke-width="${fm(st * 0.7)}"${VE}/>` +
        `<line x1="${fm(kanan - fs * 0.15)}" y1="${fm(bawah - fs * 0.15)}" x2="${fm(kanan - fs * 0.15)}" y2="${fm(y + fs * 0.15)}" stroke="#ffffff" stroke-opacity="0.55" stroke-width="${fm(st * 0.7)}"${VE}/>`
      );
    }
    case "ep-pita": {
      // pita banner: ekor segitiga kiri-kanan + band tengah lebih tinggi
      const c = "#fdba74";
      const ekor = Math.min(w * 0.14, fs * 0.6);
      const tKecil = h * 0.72;
      const yKecil = y + (h - tKecil) / 2;
      return (
        `<polygon points="${fm(x)},${fm(yKecil)} ${fm(x + ekor)},${fm(yKecil)} ${fm(x + ekor * 0.45)},${fm(tengahY)} ${fm(x + ekor)},${fm(yKecil + tKecil)} ${fm(x)},${fm(yKecil + tKecil)}" fill="${c}" fill-opacity="0.4"/>` +
        `<polygon points="${fm(kanan)},${fm(yKecil)} ${fm(kanan - ekor)},${fm(yKecil)} ${fm(kanan - ekor * 0.45)},${fm(tengahY)} ${fm(kanan - ekor)},${fm(yKecil + tKecil)} ${fm(kanan)},${fm(yKecil + tKecil)}" fill="${c}" fill-opacity="0.4"/>` +
        `<rect x="${fm(x + ekor)}" y="${fm(y)}" width="${fm(w - ekor * 2)}" height="${fm(h)}" fill="${c}" fill-opacity="0.12"/>` +
        `<rect x="${fm(x + ekor)}" y="${fm(y)}" width="${fm(w - ekor * 2)}" height="${fm(h)}" fill="none" stroke="${c}" stroke-opacity="0.95" stroke-width="${fm(st * 1.3)}"${VE}/>` +
        `<line x1="${fm(x + ekor)}" y1="${fm(y)}" x2="${fm(x)}" y2="${fm(yKecil)}" stroke="${c}" stroke-opacity="0.85" stroke-width="${fm(st)}"${VE}/>` +
        `<line x1="${fm(x + ekor)}" y1="${fm(bawah)}" x2="${fm(x)}" y2="${fm(yKecil + tKecil)}" stroke="${c}" stroke-opacity="0.85" stroke-width="${fm(st)}"${VE}/>` +
        `<line x1="${fm(kanan - ekor)}" y1="${fm(y)}" x2="${fm(kanan)}" y2="${fm(yKecil)}" stroke="${c}" stroke-opacity="0.85" stroke-width="${fm(st)}"${VE}/>` +
        `<line x1="${fm(kanan - ekor)}" y1="${fm(bawah)}" x2="${fm(kanan)}" y2="${fm(yKecil + tKecil)}" stroke="${c}" stroke-opacity="0.85" stroke-width="${fm(st)}"${VE}/>`
      );
    }
    case "ep-monitor": {
      // monitor studio: layar + bezel bawah + garis pindai + REC hijau
      const c = "#4ade80";
      const bezel = Math.max(3, fs * 0.2);
      const garis = [0.32, 0.52, 0.72]
        .map((f) => `<line x1="${fm(x + fs * 0.25)}" y1="${fm(y + h * f)}" x2="${fm(kanan - fs * 0.25)}" y2="${fm(y + h * f)}" stroke="${c}" stroke-opacity="0.16" stroke-width="${fm(st * 0.7)}"${VE}/>`)
        .join("");
      return (
        `<rect x="${fm(x)}" y="${fm(y)}" width="${fm(w)}" height="${fm(h)}" fill="#000000" fill-opacity="0.38"/>` +
        `<rect x="${fm(x)}" y="${fm(y)}" width="${fm(w)}" height="${fm(h)}" fill="none" stroke="${c}" stroke-opacity="0.95" stroke-width="${fm(st * 1.2)}"${VE}/>` +
        garis +
        `<rect x="${fm(x)}" y="${fm(bawah - bezel)}" width="${fm(w)}" height="${fm(bezel)}" fill="${c}" fill-opacity="0.85"/>` +
        `<circle cx="${fm(kanan - fs * 0.3)}" cy="${fm(y + fs * 0.28)}" r="${fm(Math.max(2, fs * 0.11))}" fill="#ef4444" fill-opacity="0.95"/>` +
        `<line x1="${fm(x + fs * 0.25)}" y1="${fm(y + fs * 0.28)}" x2="${fm(x + fs * 0.8)}" y2="${fm(y + fs * 0.28)}" stroke="#ffffff" stroke-opacity="0.6" stroke-width="${fm(st * 0.8)}"${VE}/>`
      );
    }
    case "ep-markah": {
      // markah bab: bar kiri tebal + outline + 3 titik kanan — kuning
      const c = "#facc15";
      const bar = Math.max(4, fs * 0.22);
      const r = Math.max(1.8, fs * 0.1);
      return (
        `<rect x="${fm(x)}" y="${fm(y)}" width="${fm(w)}" height="${fm(h)}" fill="${c}" fill-opacity="0.07"/>` +
        `<rect x="${fm(x)}" y="${fm(y)}" width="${fm(w)}" height="${fm(h)}" fill="none" stroke="#ffffff" stroke-opacity="0.55" stroke-width="${fm(st * 0.8)}"${VE}/>` +
        `<rect x="${fm(x)}" y="${fm(y)}" width="${fm(bar)}" height="${fm(h)}" fill="${c}" fill-opacity="0.95"/>` +
        `<circle cx="${fm(kanan - fs * 0.28)}" cy="${fm(y + h * 0.3)}" r="${fm(r)}" fill="${c}" fill-opacity="0.95"/>` +
        `<circle cx="${fm(kanan - fs * 0.28)}" cy="${fm(tengahY)}" r="${fm(r)}" fill="${c}" fill-opacity="0.95"/>` +
        `<circle cx="${fm(kanan - fs * 0.28)}" cy="${fm(y + h * 0.7)}" r="${fm(r)}" fill="${c}" fill-opacity="0.95"/>`
      );
    }
    // ============ v3.6.0 — BINGKAI DESKRIPSI (10 gaya panel) ============
    case "dp-kaca": {
      // panel kaca lembut: fill + kilau atas + outline tipis
      const c = "#93c5fd";
      const gid = "dpkaca";
      return (
        `<defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0" stop-color="#ffffff" stop-opacity="0.16"/>` +
        `<stop offset="0.35" stop-color="#ffffff" stop-opacity="0.05"/>` +
        `<stop offset="1" stop-color="${c}" stop-opacity="0.08"/></linearGradient></defs>` +
        `<rect x="${fm(x)}" y="${fm(y)}" width="${fm(w)}" height="${fm(h)}" rx="${fm(Math.min(fs * 0.22, h / 2 - 1))}" fill="url(#${gid})"/>` +
        `<rect x="${fm(x)}" y="${fm(y)}" width="${fm(w)}" height="${fm(h)}" rx="${fm(Math.min(fs * 0.22, h / 2 - 1))}" fill="none" stroke="#ffffff" stroke-opacity="0.4" stroke-width="${fm(st * 0.7)}"${VE}/>` +
        `<line x1="${fm(x + fs * 0.3)}" y1="${fm(y + 1)}" x2="${fm(kanan - fs * 0.3)}" y2="${fm(y + 1)}" stroke="#ffffff" stroke-opacity="0.5" stroke-width="${fm(st * 0.6)}"${VE}/>`
      );
    }
    case "dp-barkiri": {
      // bar aksen kiri + fill samar + garis bawah tipis
      const c = "#a78bfa";
      const bar = Math.max(3.5, fs * 0.16);
      return (
        `<rect x="${fm(x)}" y="${fm(y)}" width="${fm(w)}" height="${fm(h)}" fill="${c}" fill-opacity="0.07"/>` +
        `<rect x="${fm(x)}" y="${fm(y)}" width="${fm(bar)}" height="${fm(h)}" fill="${c}" fill-opacity="0.9"/>` +
        `<line x1="${fm(x + bar + fs * 0.2)}" y1="${fm(bawah - 1)}" x2="${fm(kanan)}" y2="${fm(bawah - 1)}" stroke="${c}" stroke-opacity="0.5" stroke-width="${fm(st * 0.6)}"${VE}/>`
      );
    }
    case "dp-kutip": {
      // kutipan: 4 bracket sudut kecil + garis kiri vertikal pendek
      const c = "#67e8f9";
      const L = Math.min(w, h, fs * 0.7);
      return (
        `<path d="M ${fm(x)} ${fm(y + L)} L ${fm(x)} ${fm(y)} L ${fm(x + L)} ${fm(y)}" fill="none" stroke="${c}" stroke-opacity="0.9" stroke-width="${fm(st * 1.2)}"${VE}/>` +
        `<path d="M ${fm(kanan - L)} ${fm(y)} L ${fm(kanan)} ${fm(y)} L ${fm(kanan)} ${fm(y + L)}" fill="none" stroke="${c}" stroke-opacity="0.9" stroke-width="${fm(st * 1.2)}"${VE}/>` +
        `<path d="M ${fm(x)} ${fm(bawah - L)} L ${fm(x)} ${fm(bawah)} L ${fm(x + L)} ${fm(bawah)}" fill="none" stroke="${c}" stroke-opacity="0.9" stroke-width="${fm(st * 1.2)}"${VE}/>` +
        `<path d="M ${fm(kanan - L)} ${fm(bawah)} L ${fm(kanan)} ${fm(bawah)} L ${fm(kanan)} ${fm(bawah - L)}" fill="none" stroke="${c}" stroke-opacity="0.9" stroke-width="${fm(st * 1.2)}"${VE}/>` +
        `<line x1="${fm(x + fs * 0.18)}" y1="${fm(y + fs * 0.25)}" x2="${fm(x + fs * 0.18)}" y2="${fm(bawah - fs * 0.25)}" stroke="${c}" stroke-opacity="0.55" stroke-width="${fm(st * 0.7)}"${VE}/>`
      );
    }
    case "dp-strip": {
      // strip ganda: dua garis tebal atas-bawah + tick tengah sisi
      const c = "#fbbf24";
      const garis = Math.max(2, fs * 0.09);
      const tick = Math.min(w * 0.1, fs * 0.4);
      return (
        `<rect x="${fm(x)}" y="${fm(y)}" width="${fm(w)}" height="${fm(garis)}" fill="${c}" fill-opacity="0.85"/>` +
        `<rect x="${fm(x)}" y="${fm(bawah - garis)}" width="${fm(w)}" height="${fm(garis)}" fill="${c}" fill-opacity="0.85"/>` +
        `<line x1="${fm(tengahX - tick)}" y1="${fm(y + garis / 2)}" x2="${fm(tengahX + tick)}" y2="${fm(y + garis / 2)}" stroke="#ffffff" stroke-opacity="0.8" stroke-width="${fm(st * 0.6)}"${VE}/>` +
        `<line x1="${fm(tengahX - tick)}" y1="${fm(bawah - garis / 2)}" x2="${fm(tengahX + tick)}" y2="${fm(bawah - garis / 2)}" stroke="#ffffff" stroke-opacity="0.8" stroke-width="${fm(st * 0.6)}"${VE}/>`
      );
    }
    case "dp-gelap": {
      // panel gelap legible: scrim hitam + outline + aksen atas
      const c = "#38bdf8";
      return (
        `<rect x="${fm(x)}" y="${fm(y)}" width="${fm(w)}" height="${fm(h)}" rx="${fm(Math.min(fs * 0.18, h / 2 - 1))}" fill="#000000" fill-opacity="0.42"/>` +
        `<rect x="${fm(x)}" y="${fm(y)}" width="${fm(w)}" height="${fm(h)}" rx="${fm(Math.min(fs * 0.18, h / 2 - 1))}" fill="none" stroke="#ffffff" stroke-opacity="0.45" stroke-width="${fm(st * 0.7)}"${VE}/>` +
        `<rect x="${fm(x)}" y="${fm(y)}" width="${fm(w)}" height="${fm(Math.max(2, fs * 0.07))}" rx="${fm(Math.max(1, fs * 0.05))}" fill="${c}" fill-opacity="0.8"/>`
      );
    }
    case "dp-senja": {
      // panel sudut terpotong (oktagon lembut) + garis dalam
      const c = "#fb7185";
      const pot = Math.min(fs * 0.45, w / 4, h / 3);
      const oct =
        `${fm(x + pot)},${fm(y)} ${fm(kanan - pot)},${fm(y)} ${fm(kanan)},${fm(y + pot)} ` +
        `${fm(kanan)},${fm(bawah - pot)} ${fm(kanan - pot)},${fm(bawah)} ${fm(x + pot)},${fm(bawah)} ` +
        `${fm(x)},${fm(bawah - pot)} ${fm(x)},${fm(y + pot)}`;
      return (
        `<polygon points="${oct}" fill="${c}" fill-opacity="0.08"/>` +
        `<polygon points="${oct}" fill="none" stroke="${c}" stroke-opacity="0.9" stroke-width="${fm(st * 1.1)}"${VE}/>` +
        `<line x1="${fm(x + pot * 0.6)}" y1="${fm(y + pot * 0.6)}" x2="${fm(x + pot * 1.2)}" y2="${fm(y + pot * 0.6)}" stroke="#ffffff" stroke-opacity="0.4" stroke-width="${fm(st * 0.5)}"${VE}/>`
      );
    }
    case "dp-putus": {
      // garis putus-putus + 4 titik sudut
      const c = "#38bdf8";
      const dash = `${fm(Math.max(4, fs * 0.3))} ${fm(Math.max(3, fs * 0.22))}`;
      const titik = Math.max(1.8, fs * 0.09);
      const dots =
        [[x, y], [kanan, y], [x, bawah], [kanan, bawah]]
          .map(([px, py]) => `<circle cx="${fm(px)}" cy="${fm(py)}" r="${fm(titik)}" fill="${c}" fill-opacity="0.95"/>`)
          .join("");
      return (
        `<rect x="${fm(x)}" y="${fm(y)}" width="${fm(w)}" height="${fm(h)}" fill="${c}" fill-opacity="0.04"/>` +
        `<rect x="${fm(x)}" y="${fm(y)}" width="${fm(w)}" height="${fm(h)}" fill="none" stroke="${c}" stroke-opacity="0.8" stroke-width="${fm(st * 0.9)}" stroke-dasharray="${dash}"/>` +
        dots
      );
    }
    case "dp-papan": {
      // papan info: strip kepala atas + badan kaca + outline
      const c = "#2dd4bf";
      const kepala = Math.max(4, fs * 0.3);
      return (
        `<rect x="${fm(x)}" y="${fm(y)}" width="${fm(w)}" height="${fm(h)}" fill="#ffffff" fill-opacity="0.07"/>` +
        `<rect x="${fm(x)}" y="${fm(y)}" width="${fm(w)}" height="${fm(h)}" fill="none" stroke="${c}" stroke-opacity="0.9" stroke-width="${fm(st * 1.1)}"${VE}/>` +
        `<rect x="${fm(x)}" y="${fm(y)}" width="${fm(w)}" height="${fm(kepala)}" fill="${c}" fill-opacity="0.55"/>` +
        `<circle cx="${fm(x + fs * 0.28)}" cy="${fm(y + kepala / 2)}" r="${fm(Math.max(1.5, fs * 0.07))}" fill="#000000" fill-opacity="0.6"/>` +
        `<circle cx="${fm(x + fs * 0.52)}" cy="${fm(y + kepala / 2)}" r="${fm(Math.max(1.5, fs * 0.07))}" fill="#000000" fill-opacity="0.6"/>`
      );
    }
    case "dp-kilau": {
      // kilau tepi: gradasi horizontal kiri→kanan + fill samar
      const gid = "dpkilau";
      return (
        `<defs><linearGradient id="${gid}" x1="0" y1="0" x2="1" y2="0">` +
        `<stop offset="0" stop-color="#e879f9" stop-opacity="0.9"/>` +
        `<stop offset="0.5" stop-color="#c084fc" stop-opacity="0.45"/>` +
        `<stop offset="1" stop-color="#38bdf8" stop-opacity="0.9"/></linearGradient>` +
        `<linearGradient id="${gid}f" x1="0" y1="0" x2="1" y2="0">` +
        `<stop offset="0" stop-color="#e879f9" stop-opacity="0.1"/>` +
        `<stop offset="1" stop-color="#38bdf8" stop-opacity="0.05"/></linearGradient></defs>` +
        `<rect x="${fm(x)}" y="${fm(y)}" width="${fm(w)}" height="${fm(h)}" rx="${fm(Math.min(fs * 0.16, h / 2 - 1))}" fill="url(#${gid}f)"/>` +
        `<rect x="${fm(x)}" y="${fm(y)}" width="${fm(w)}" height="${fm(h)}" rx="${fm(Math.min(fs * 0.16, h / 2 - 1))}" fill="none" stroke="url(#${gid})" stroke-width="${fm(st * 1.4)}"${VE}/>`
      );
    }
    case "dp-tick": {
      // kolom tick: 3 bar kecil tiap sisi + outline tipis
      const c = "#bef264";
      const barW = Math.max(2.5, fs * 0.12);
      const barH = Math.max(4, fs * 0.3);
      const jarak = fs * 0.16;
      const kolom = (px: number) =>
        [0, 1, 2]
          .map((i) => `<rect x="${fm(px)}" y="${fm(tengahY - barH / 2 + (i - 1) * (barH + jarak))}" width="${fm(barW)}" height="${fm(barH)}" fill="${c}" fill-opacity="${fm(0.95 - i * 0.18)}"/>`)
          .join("");
      return (
        `<rect x="${fm(x)}" y="${fm(y)}" width="${fm(w)}" height="${fm(h)}" fill="#ffffff" fill-opacity="0.05"/>` +
        `<rect x="${fm(x)}" y="${fm(y)}" width="${fm(w)}" height="${fm(h)}" fill="none" stroke="${c}" stroke-opacity="0.55" stroke-width="${fm(st * 0.7)}"${VE}/>` +
        kolom(x + fs * 0.22) +
        kolom(kanan - fs * 0.22 - barW)
      );
    }
    default:
      return "";
  }
}

/** SVG KANAS PENUH (server → renderSvgCoverPng): bingkai gaya id di posisi kotak k */
export function svgBingkaiJudulKanvas(id: string, k: KotakBj, W: number, H: number): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    bentukBingkai(id, k) +
    `</svg>`
  );
}

/**
 * SVG KOTAK utk PRATINJAU (data URL): kotak nominal 340×132 @fs 40 — CSS
 * membentangkannya (backgroundSize 100% 100%) mengikuti ukuran teks; garis
 * tetap rapi berkat vector-effect="non-scaling-stroke".
 * v3.6.0 — mendukung SEMUA jenis (judul/part/deskripsi — id unik lintas katalog).
 */
export function svgBingkaiKotak(jenis: JenisBingkai, id: string): string {
  const kotak: KotakBj = { x: 2, y: 2, w: 336, h: 128, fs: 40 };
  const isi = bentukBingkai(id, kotak);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="340" height="132" viewBox="0 0 340 132" preserveAspectRatio="none">` +
    isi +
    `</svg>`
  );
}

/** v3.5.0 — kompatibilitas lama: bingkai judul (jenis "judul") */
export function svgBingkaiJudulKotak(id: string): string {
  return svgBingkaiKotak("judul", id);
}
