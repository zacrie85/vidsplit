// VidSplit v0.47.0 — FRAME NEON BERPUTAR (murni, aman-browser & server)
// Permintaan user: "FRAME NEON BERPUTAR — garis neon bercahaya di sekitar tepi
// video dalam bingkai membulat, terus berputar otomatis sepanjang video — efek
// komet: kepala paling terang + ekor memudar, lintasan mulus menembus keempat
// sudut. 7 warna: CYAN · AMBER · MAGENTA · HIJAU · BIRU · PUTIH · RAINBOW.
// Ketebalan (2–16) & kecepatan putar (0.2–3×) bisa diatur + opsi dua garis
// berlawanan. Berlaku 9:16 DAN 16:9 — tampil di pratinjau dan terbakar saat
// ekspor (termasuk batch)."
//
// v0.47.0 — PERBAIKAN BUG: bingkai digambar tanpa offset margin sehingga
// MENEMPEL tepi kiri-atas (garis terpotong setengah di tepi video 9:16 & 16:9).
// Kini seluruh lapisan dibungkus <g transform="translate(m m)"> + margin glow
// diperbesar sehingga bingkai simetris & glow tak terpotong di SEMUA rasio.
//
// v0.48.0 — PERBAIKAN BUG FINAL (laporan user + 2 gambar referensi: "garis hanya
// ada di sisi sebelah saja, sisi bawah dan kiri tidak ada"): cincin dasar v0.47
// (opasitas 0.26) TERLALU SAMAR — lenyap ditelan video terang, sehingga yang
// terlihat hanya segmen komet (30% keliling) → user menyangka bingkai patah.
// Terukur piksel: sisi komet alpha 255, sisi lain alpha 66/255. SOLUSI:
// CINCIN PENUH TERANG 3 lapis (glow + badan + inti, opasitas ±1) SELALU tampil
// utuh di keempat sisi pada SEMUA rasio & warna; komet tetap berputar di atasnya
// sbg sorotan (kepala putih + ekor memudar). Rainbow = gradien berputar.
//
// Modul ini dipakai DUA sisi sekaligus agar pratinjau = hasil ekspor:
//   • browser (Preview.tsx)  — SVG digambar ulang per frame via requestAnimationFrame
//   • server  (neonRender.ts)— SVG per-frame dirasterisasi sharp → urutan PNG → ffmpeg overlay
// Semua geometri dihitung dari SATU fungsi titikDi() — tidak ada duplikasi rumus.

export type WarnaNeon =
  | "cyan"
  | "amber"
  | "magenta"
  | "hijau"
  | "biru"
  | "putih"
  | "rainbow";

export interface PaletNeon {
  label: string;
  /** warna kepala komet — paling terang (mendekati putih) */
  inti: string;
  /** warna tubuh garis ("" utk rainbow = dihitung per segmen) */
  dasar: string;
  /** warna cahaya luar (glow) */
  glow: string;
}

export const PALET_NEON: Record<WarnaNeon, PaletNeon> = {
  cyan: { label: "Cyan", inti: "#eaffff", dasar: "#00e5ff", glow: "#00b8d4" },
  amber: { label: "Amber", inti: "#fff8e1", dasar: "#ffc400", glow: "#ff8f00" },
  magenta: { label: "Magenta", inti: "#ffeafb", dasar: "#ff2bd6", glow: "#c314b8" },
  hijau: { label: "Hijau", inti: "#eaffea", dasar: "#00e676", glow: "#00c853" },
  biru: { label: "Biru", inti: "#eaf3ff", dasar: "#2979ff", glow: "#1565c0" },
  putih: { label: "Putih", inti: "#ffffff", dasar: "#f4f7ff", glow: "#9fb8ff" },
  rainbow: { label: "Rainbow", inti: "#ffffff", dasar: "", glow: "" },
};

export const DAFTAR_WARNA_NEON: WarnaNeon[] = [
  "cyan",
  "amber",
  "magenta",
  "hijau",
  "biru",
  "putih",
  "rainbow",
];

export interface SetelanNeon {
  aktif: boolean;
  warna: WarnaNeon;
  /** 2–16 px pada sisi terpendek 1080 */
  tebal: number;
  /** 0.2–3 × — 1 = satu putaran 6 detik */
  kecepatan: number;
  /** garis kedua berlawanan arah (selisih 50% lintasan) */
  duaGaris: boolean;
}

export const NEON_BAWAAN: SetelanNeon = {
  aktif: false,
  warna: "cyan",
  tebal: 6,
  kecepatan: 1,
  duaGaris: false,
};

/** Clamp aman setelan neon dari localStorage/body — nilai salah → bawaan */
export function rapikanNeon(n: Partial<SetelanNeon> | undefined): SetelanNeon {
  const s = { ...NEON_BAWAAN, ...(n || {}) };
  const warna = DAFTAR_WARNA_NEON.includes(s.warna as WarnaNeon)
    ? (s.warna as WarnaNeon)
    : "cyan";
  return {
    aktif: !!s.aktif,
    warna,
    tebal: Number.isFinite(s.tebal) ? Math.min(16, Math.max(2, Math.round(s.tebal))) : 6,
    kecepatan: Number.isFinite(s.kecepatan)
      ? Math.min(3, Math.max(0.2, Math.round(s.kecepatan * 10) / 10))
      : 1,
    duaGaris: !!s.duaGaris,
  };
}

/* ============ GEOMETRI BINGKAI MEBULAT ============ */

export interface PathBulat {
  w: number;
  h: number;
  r: number;
  /** panjang keliling total — parameter lintasan s ∈ [0, perim) */
  perim: number;
}

/** Bingkai membulat pada rect w×h — path SVG mulai dari TENGAH-ATAS, searah
 *  jarum jam. Pemanggil memasukkan w/h yang sudah dikurangi margin glow. */
export function buatPathBulat(w: number, h: number): PathBulat {
  const r = Math.max(18, Math.min(w, h) * 0.085);
  const perim = 2 * (w + h) - 8 * r + 2 * Math.PI * r;
  return { w, h, r, perim };
}

/** Posisi titik pada keliling bingkai — s ∈ [0, perim). Urutan segmen (searah
 *  jarum jam dari tengah-atas): atas→kanan, sudut TR, kanan→bawah, sudut BR,
 *  bawah→kiri, sudut BL, kiri→atas, sudut TL, tutup ke tengah-atas. */
export function titikDi(p: PathBulat, s: number): { x: number; y: number } {
  const { w, h, r } = p;
  const perim = p.perim;
  let u = ((s % perim) + perim) % perim;
  const lAtas = w / 2 - r; // tengah-atas → sudut TR
  const q = (Math.PI * r) / 2;
  const lKanan = h - 2 * r;
  const lBawah = w - 2 * r;
  const lKiri = h - 2 * r;

  const pusatTR = { x: w - r, y: r };
  const pusatBR = { x: w - r, y: h - r };
  const pusatBL = { x: r, y: h - r };
  const pusatTL = { x: r, y: r };

  if (u < lAtas) return { x: w / 2 + u, y: 0 };
  u -= lAtas;
  if (u < q) {
    // sudut TR — titik awal (w-r, 0), rotasi CW di sekitar pusat TR
    const a = (u / q) * (Math.PI / 2);
    return {
      x: pusatTR.x + (w - r - pusatTR.x) * Math.cos(a) - (0 - pusatTR.y) * Math.sin(a),
      y: pusatTR.y + (w - r - pusatTR.x) * Math.sin(a) + (0 - pusatTR.y) * Math.cos(a),
    };
  }
  u -= q;
  if (u < lKanan) return { x: w, y: r + u };
  u -= lKanan;
  if (u < q) {
    const a = (u / q) * (Math.PI / 2);
    return {
      x: pusatBR.x + (w - pusatBR.x) * Math.cos(a) - (h - r - pusatBR.y) * Math.sin(a),
      y: pusatBR.y + (w - pusatBR.x) * Math.sin(a) + (h - r - pusatBR.y) * Math.cos(a),
    };
  }
  u -= q;
  if (u < lBawah) return { x: w - r - u, y: h };
  u -= lBawah;
  if (u < q) {
    const a = (u / q) * (Math.PI / 2);
    return {
      x: pusatBL.x + (r - pusatBL.x) * Math.cos(a) - (h - pusatBL.y) * Math.sin(a),
      y: pusatBL.y + (r - pusatBL.x) * Math.sin(a) + (h - pusatBL.y) * Math.cos(a),
    };
  }
  u -= q;
  if (u < lKiri) return { x: 0, y: h - r - u };
  u -= lKiri;
  if (u < q) {
    const a = (u / q) * (Math.PI / 2);
    return {
      x: pusatTL.x + (0 - pusatTL.x) * Math.cos(a) - (r - pusatTL.y) * Math.sin(a),
      y: pusatTL.y + (0 - pusatTL.x) * Math.sin(a) + (r - pusatTL.y) * Math.cos(a),
    };
  }
  u -= q;
  return { x: r + u, y: 0 };
}

/** Deret titik halus dari s1 → s2 (untuk potongan lintasan komet) */
export function jalurTitik(p: PathBulat, s1: number, s2: number, n = 4): { x: number; y: number }[] {
  const titik: { x: number; y: number }[] = [];
  for (let i = 0; i <= n; i++) titik.push(titikDi(p, s1 + ((s2 - s1) * i) / n));
  return titik;
}

/* ============ PARAMETER ANIMASI ============ */

/** Satu putaran penuh pada kecepatan 1× = 6 detik (bawaan nyaman utk 9:16 & 16:9) */
export const DETIK_LINGKARAN_DASAR = 6;

export function lapDetik(kecepatan: number): number {
  const k = Number.isFinite(kecepatan) ? Math.min(3, Math.max(0.2, kecepatan)) : 1;
  return DETIK_LINGKARAN_DASAR / k;
}

/** FPS sequence utk ekspor — cukup halus tapi hemat: dibatasi 15–25, jumlah
 *  frame dibatasi 24–400 (loop 30 dtk @0.2× tetap ≤ 400 berkas PNG). */
export function rencanaSequence(kecepatan: number): { lap: number; fps: number; jumlah: number } {
  const lap = lapDetik(kecepatan);
  const fps = Math.min(25, Math.max(15, Math.round(400 / lap)));
  const jumlah = Math.max(24, Math.min(400, Math.round(lap * fps)));
  return { lap, fps, jumlah };
}

/** Panjang ekor komet = 30% keliling (kepala + ekor memudar) */
export const EKOR_POROSI = 0.3;
/** Jumlah potongan lintasan per komet — makin banyak makin mulus gradasinya */
export const SEGMEN_KOMET = 24;

/* ============ WARNA RAINBOW ============ */

/** hsl → hex (untuk rainbow) */
export function hslKeHex(h: number, s: number, l: number): string {
  const hh = ((h % 360) + 360) % 360;
  const ss = Math.min(1, Math.max(0, s));
  const ll = Math.min(1, Math.max(0, l));
  const c = (1 - Math.abs(2 * ll - 1)) * ss;
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
  const m = ll - c / 2;
  let r = 0, g = 0, b = 0;
  if (hh < 60) [r, g, b] = [c, x, 0];
  else if (hh < 120) [r, g, b] = [x, c, 0];
  else if (hh < 180) [r, g, b] = [0, c, x];
  else if (hh < 240) [r, g, b] = [0, x, c];
  else if (hh < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const ke = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${ke(r)}${ke(g)}${ke(b)}`;
}

/* ============ GENERATOR SVG PER-FRAME ============ */

export interface OpsiSvgNeon {
  /** ukuran kanvas overlay (px viewBox) — cocokkan dgn frame video */
  W: number;
  H: number;
  setelan: SetelanNeon;
  /** progres putaran ∈ [0,1) — 0 = kepala di tengah-atas */
  progres: number;
}

interface LapisanPotongan {
  d: string;
  lebar: number;
  warna: string;
  opasitas: number;
}

function potonganKomet(
  p: PathBulat,
  kepala: number,
  setelan: SetelanNeon,
  palet: PaletNeon,
  progres: number,
  skalaTebal: number,
): LapisanPotongan[] {
  const hasil: LapisanPotongan[] = [];
  const tebal = setelan.tebal * skalaTebal;
  const ekor = p.perim * EKOR_POROSI;
  const N = SEGMEN_KOMET;
  for (let k = 0; k < N; k++) {
    const s1 = kepala - (ekor * (k + 1)) / N;
    const s2 = kepala - (ekor * k) / N;
    const titik = jalurTitik(p, s1, s2 + 0.001, 3);
    if (titik.length < 2) continue;
    const d =
      `M ${titik[0].x.toFixed(2)} ${titik[0].y.toFixed(2)} ` +
      titik
        .slice(1)
        .map((t) => `L ${t.x.toFixed(2)} ${t.y.toFixed(2)}`)
        .join(" ");
    const u = 1 - k / N; // 1 = kepala, 0 = ujung ekor
    // kepala putih-terang, tubuh warna dasar, ekor memudar
    let warna: string;
    if (setelan.warna === "rainbow") {
      // pelangi: rona bergeser sepanjang ekor DAN ikut waktu (progres)
      warna = hslKeHex(360 * progres - (k / N) * 130 + 90, 0.95, 0.5 + 0.12 * u);
    } else {
      warna = k === 0 ? palet.inti : palet.dasar;
    }
    const opasitas = k === 0 ? 1 : Math.pow(u, 1.7) * 0.92;
    const lebar = tebal * (0.55 + 1.25 * Math.pow(u, 1.35));
    hasil.push({ d, lebar, warna, opasitas });
  }
  return hasil;
}

/** Path SVG bingkai membulat penuh (M/L/A … Z) pada koordinat lokal path */
export function dPathBulat(p: PathBulat): string {
  const { w, h, r } = p;
  return (
    `M ${(w / 2).toFixed(2)} 0 L ${(w - r).toFixed(2)} 0 ` +
    `A ${r.toFixed(2)} ${r.toFixed(2)} 0 0 1 ${w.toFixed(2)} ${r.toFixed(2)} ` +
    `L ${w.toFixed(2)} ${(h - r).toFixed(2)} ` +
    `A ${r.toFixed(2)} ${r.toFixed(2)} 0 0 1 ${(w - r).toFixed(2)} ${h.toFixed(2)} ` +
    `L ${r.toFixed(2)} ${h.toFixed(2)} ` +
    `A ${r.toFixed(2)} ${r.toFixed(2)} 0 0 1 0 ${(h - r).toFixed(2)} ` +
    `L 0 ${r.toFixed(2)} ` +
    `A ${r.toFixed(2)} ${r.toFixed(2)} 0 0 1 ${r.toFixed(2)} 0 Z`
  );
}

/** SVG string satu frame neon — dipakai browser (pratinjau) & server (ekspor) */
export function svgFrameNeon(opsi: OpsiSvgNeon): string {
  const { W, H, setelan } = opsi;
  const progres = ((opsi.progres % 1) + 1) % 1;
  const skalaTebal = Math.min(W, H) / 1080;
  // v0.47.0 — margin cukup utk glow (setengah lebar komet × 2.5 + sebaran blur
  // 2σ) sehingga TIDAK ADA bagian bingkai/glow yang terpotong tepi kanvas.
  const m = setelan.tebal * skalaTebal * 3.6 + 12;
  const p = buatPathBulat(W - m * 2, H - m * 2);
  const palet = PALET_NEON[setelan.warna] || PALET_NEON.cyan;
  const tebalPx = setelan.tebal * skalaTebal;

  const kepala1 = progres * p.perim;
  const komet1 = potonganKomet(p, kepala1, setelan, palet, progres, skalaTebal);
  const komet2 = setelan.duaGaris
    ? potonganKomet(p, kepala1 + p.perim / 2, setelan, palet, (progres + 0.5) % 1, skalaTebal)
    : [];

  const renderLapisan = (daftar: LapisanPotongan[], faktorLebar: number, opasitas: number) =>
    daftar
      .map(
        (t) =>
          `<path d="${t.d}" fill="none" stroke="${t.warna}" stroke-width="${(t.lebar * faktorLebar).toFixed(2)}" stroke-linecap="round" opacity="${(t.opasitas * opasitas).toFixed(3)}"/>`,
      )
      .join("");

  // v0.48.0 — CINCIN PENUH TERANG (3 lapis, tampil UTUH di keempat sisi):
  //   1. glow  — blur lebar warna glow, menyalakan tepi bingkai
  //   2. badan — warna dasar setebal tebal (garis neon utama)
  //   3. inti  — garis hampir-putih tipis di tengah badan (kesan tabung neon)
  // Keluhan user terjawab: bingkai TIDAK AKAN pernah "hanya satu sisi" lagi.
  const cincinGlow =
    setelan.warna === "rainbow"
      ? `<path d="${dPathBulat(p)}" fill="none" stroke="url(#rb)" stroke-width="${(tebalPx * 2.6).toFixed(2)}" opacity="0.55" filter="url(#g1)"/>`
      : `<path d="${dPathBulat(p)}" fill="none" stroke="${palet.glow}" stroke-width="${(tebalPx * 2.6).toFixed(2)}" opacity="0.62" filter="url(#g1)"/>`;
  const cincinBadan =
    setelan.warna === "rainbow"
      ? `<path d="${dPathBulat(p)}" fill="none" stroke="url(#rb)" stroke-width="${tebalPx.toFixed(2)}" opacity="0.98" filter="url(#g2)"/>`
      : `<path d="${dPathBulat(p)}" fill="none" stroke="${palet.dasar}" stroke-width="${tebalPx.toFixed(2)}" opacity="1" filter="url(#g2)"/>`;
  const cincinInti = `<path d="${dPathBulat(p)}" fill="none" stroke="${setelan.warna === "rainbow" ? "#ffffff" : palet.inti}" stroke-width="${(tebalPx * 0.42).toFixed(2)}" opacity="0.85"/>`;

  // 3 lapis komet di atas cincin: cahaya luar (blur lebar), tubuh (blur tipis),
  // inti tajam — kepala putih-terang + ekor memudar sebagai SOROTAN berputar.
  // v0.47.0 — SEMUA digambar dalam <g translate(m m)>: koordinat path mulai
  // (0,0) → tanpa offset dulu bingkai menempel tepi kiri-atas (BUG TERPOTONG).
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<defs>` +
    `<filter id="g1" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="${(tebalPx * 1.1).toFixed(2)}"/></filter>` +
    `<filter id="g2" x="-15%" y="-15%" width="130%" height="130%"><feGaussianBlur stdDeviation="${(tebalPx * 0.28).toFixed(2)}"/></filter>` +
    `<linearGradient id="rb" x1="0" y1="0" x2="1" y2="1" gradientTransform="rotate(${(progres * 360).toFixed(1)} 0.5 0.5)">` +
    [0, 60, 120, 180, 240, 300]
      .map((h) => `<stop offset="${((h / 360) * 100).toFixed(0)}%" stop-color="${hslKeHex(h, 0.95, 0.6)}"/>`)
      .join("") +
    `</linearGradient>` +
    `</defs>` +
    `<g transform="translate(${m.toFixed(2)} ${m.toFixed(2)})">` +
    cincinGlow +
    cincinBadan +
    cincinInti +
    // glow memakai warna glow solid; rainbow glow = potongan dgn blur besar
    (setelan.warna === "rainbow"
      ? `<g filter="url(#g1)">${renderLapisan(komet1, 2.5, 0.5)}${renderLapisan(komet2, 2.5, 0.5)}</g>`
      : `<g filter="url(#g1)" stroke="${palet.glow}">${renderLapisan(komet1, 2.5, 0.55)}${renderLapisan(komet2, 2.5, 0.55)}</g>`) +
    `<g filter="url(#g2)">${renderLapisan(komet1, 1.35, 0.85)}${renderLapisan(komet2, 1.35, 0.85)}</g>` +
    `${renderLapisan(komet1, 1, 1)}${renderLapisan(komet2, 1, 1)}` +
    `</g>` +
    `</svg>`;
  return svg;
}

/** Kunci cache sequence neon — semua parameter yang mengubah gambar */
export function kunciCacheNeon(W: number, H: number, setelan: SetelanNeon): string {
  return [W, H, setelan.warna, setelan.tebal, setelan.kecepatan, setelan.duaGaris ? 1 : 0, "v48"].join("-");
}
