// VidSplit v2.7.0 — GENERATOR 40 FRAME KATEGORI HIBURAN/MOVIE/DRAMA/CINEMA
// Dijalankan: bun scripts/buat-bingkai-hiburan-v27.ts
//
// Permintaan user: "tambahkan 40 frame baru dengan kategori hiburan … di bagian
// atas frame nya hanya ada tulisan hiburan, movie, drama dan cinema … 10 untuk
// hiburan, 10 untuk movie, 10 untuk drama dan 10 untuk cinema dan nama tema
// nya tidak usah di tulis di frame".
//
// Mengikuti keluarga spesial v0.52–v0.57 (SVG → sharp → PNG):
//   • latar HANYA zona atas + pita bawah — TENGAH TRANSPARAN (video terlihat)
//   • teks kategori puncaknya menyentuh garis bingkai atas
//   • TANPA teks nama desain di mana pun (hanya kata kategori)
//   • bingkai dobel TIPIS + hiasan sisi ≤ ±13% lebar (strip tengah kosong)
//   • tiap rasio varian sendiri: -916.png (1080×1920) & -169.png (1920×1080)
// Keluaran 80 PNG di public/bingkai/: hiburan-1..10, movie-1..10,
// drama-1..10, cinema-1..10 (masing-masing -916 & -169).
import path from "node:path";
import sharp from "sharp";

const OUT = path.join(process.cwd(), "public", "bingkai");

interface Rasio { W: number; H: number; l: boolean; nama: string }
const R916: Rasio = { W: 1080, H: 1920, l: false, nama: "916" };
const R169: Rasio = { W: 1920, H: 1080, l: true, nama: "169" };

interface Dasar { W: number; H: number; l: boolean; s: number; inset: number; rx: number; zona: number }
function dasar(r: Rasio): Dasar {
  const { W, H, l } = r;
  const s = Math.min(W, H) / 1080;
  return { W, H, l, s, inset: Math.round(22 * s), rx: Math.round(40 * s), zona: (l ? 400 : 480) * s };
}

/* ===================== WARNA PER KATEGORI ===================== */

interface Palet {
  teks: string; // kata kategori utk filter glow
  idFill: string; warna1: string; warna2: string; // gradient isi teks
  stroke: string;
  glow: string; // warna glow teks & latar
  bingkai: string; bingkai2: string;
  pembatas: string;
  band: string; band2: string; // gradient pita bawah
  atas: string; atas2: string; // gradient zona atas
  font: string;
  kata: string;
}
const PALET: Record<string, Palet> = {
  hiburan: {
    teks: "HIBURAN", font: "Alfa Slab One",
    idFill: "gHib", warna1: "#ffb43a", warna2: "#ff4fa0", stroke: "#4a1408",
    glow: "#ffd166", bingkai: "#ffb454", bingkai2: "#8a5a20",
    pembatas: "#ff7ab8", band: "#3a1030", band2: "#7a2440", atas: "#4a1430", atas2: "#20081c",
  },
  movie: {
    teks: "MOVIE", font: "Anton",
    idFill: "gMov", warna1: "#ffe08a", warna2: "#ff9d2e", stroke: "#2b1d08",
    glow: "#ffe9a8", bingkai: "#d9b45c", bingkai2: "#6b5626",
    pembatas: "#e8c877", band: "#141824", band2: "#2a2317", atas: "#1a1f2e", atas2: "#0c0f18",
  },
  drama: {
    teks: "DRAMA", font: "Cinzel Decorative",
    idFill: "gDra", warna1: "#f7e3b0", warna2: "#c9a227", stroke: "#3a0d12",
    glow: "#ffd9c9", bingkai: "#d4af37", bingkai2: "#7a5c19",
    pembatas: "#d4af37", band: "#3a0c14", band2: "#1a0508", atas: "#4a0e16", atas2: "#20060a",
  },
  cinema: {
    teks: "CINEMA", font: "Monoton",
    idFill: "gCin", warna1: "#8df3ff", warna2: "#ff6ec7", stroke: "#062a30",
    glow: "#a5f3fc", bingkai: "#6ee7ff", bingkai2: "#155e6b",
    pembatas: "#f472b6", band: "#071a24", band2: "#0d3b4a", atas: "#0a2230", atas2: "#04101a",
  },
};

/* ===================== ELEM DASAR KELUARGA ===================== */

const CAP = 0.73; // puncak huruf ≈ em di atas baseline (rata-rata 4 font)
function fsHero(l: boolean): number { return l ? 112 : 148; }
function baselineHero(l: boolean, s: number): number { return Math.round(fsHero(l) * CAP + 34 * s); }

function teksKategori(d: Dasar, p: Palet): { svg: string; baseline: number } {
  const { W, l, s } = d;
  const fs = fsHero(l);
  const baseline = baselineHero(l, s);
  const svg =
    `<text x="${W / 2}" y="${baseline}" text-anchor="middle" font-family="${p.font}" font-size="${fs}" fill="${p.glow}" opacity="0.5" filter="url(#fGlow)">${p.teks}</text>` +
    `<text x="${W / 2}" y="${baseline}" text-anchor="middle" font-family="${p.font}" font-size="${fs}" fill="url(#${p.idFill})" stroke="${p.stroke}" stroke-width="${(1.8 * s).toFixed(1)}" letter-spacing="${(2 * s).toFixed(0)}">${p.teks}</text>`;
  return { svg, baseline };
}

function pembatas(W: number, y: number, s: number, warna: string): string {
  const panjang = 250 * s;
  return (
    `<line x1="${W / 2 - panjang}" y1="${y}" x2="${W / 2 - 34 * s}" y2="${y}" stroke="${warna}" stroke-width="${(2.2 * s).toFixed(1)}"/>` +
    `<line x1="${W / 2 + 34 * s}" y1="${y}" x2="${W / 2 + panjang}" y2="${y}" stroke="${warna}" stroke-width="${(2.2 * s).toFixed(1)}"/>` +
    `<rect x="${W / 2 - 9 * s}" y="${y - 9 * s}" width="${18 * s}" height="${18 * s}" transform="rotate(45 ${W / 2} ${y})" fill="${warna}"/>`
  );
}

function bingkaiTipis(W: number, H: number, s: number, inset: number, rx: number, u: string, dlm: string): string {
  return (
    `<rect x="${inset}" y="${inset}" width="${W - 2 * inset}" height="${H - 2 * inset}" rx="${rx}" fill="none" stroke="${u}" stroke-width="${(4.2 * s).toFixed(1)}"/>` +
    `<rect x="${inset + 13 * s}" y="${inset + 13 * s}" width="${W - 2 * inset - 26 * s}" height="${H - 2 * inset - 26 * s}" rx="${(30 * s).toFixed(0)}" fill="none" stroke="${dlm}" stroke-width="${(1.7 * s).toFixed(1)}" opacity="0.9"/>`
  );
}

function pitaBawah(d: Dasar, p: Palet, hias: string): string {
  const { W, H, s } = d;
  const garis =
    `<line x1="${W * 0.1}" y1="${H - 60 * s}" x2="${W * 0.1 + 120 * s}" y2="${H - 60 * s}" stroke="${p.bingkai}" stroke-width="${(1.8 * s).toFixed(1)}"/>` +
    `<line x1="${W * 0.9}" y1="${H - 60 * s}" x2="${W * 0.9 - 120 * s}" y2="${H - 60 * s}" stroke="${p.bingkai}" stroke-width="${(1.8 * s).toFixed(1)}"/>`;
  return (
    `<rect x="0" y="${H - 150 * s}" width="${W}" height="${150 * s}" fill="url(#gBand)"/>` + garis + hias
  );
}

function defsPalet(p: Palet): string {
  return (
    `<linearGradient id="${p.idFill}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.warna1}"/><stop offset="1" stop-color="${p.warna2}"/></linearGradient>` +
    `<linearGradient id="gBand" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.band}" stop-opacity="0.88"/><stop offset="1" stop-color="${p.band2}" stop-opacity="0.92"/></linearGradient>` +
    `<linearGradient id="gAtas" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.atas}" stop-opacity="0.9"/><stop offset="1" stop-color="${p.atas2}" stop-opacity="0.55"/></linearGradient>` +
    `<radialGradient id="gGlowLatar"><stop offset="0" stop-color="${p.glow}" stop-opacity="0.34"/><stop offset="1" stop-color="${p.glow}" stop-opacity="0"/></radialGradient>` +
    `<filter id="fGlow" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="7" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`
  );
}

/** Kerangka seragam: zona atas + glow + bingkai + isi zona + teks + pembatas + pita */
function kumpulkan(d: Dasar, p: Palet, isiZona: string, hiasPita: string): string {
  const { W, H, s, inset, rx, zona } = d;
  const hero = teksKategori(d, p);
  const pembatasY = hero.baseline + (d.l ? 84 : 102);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<defs>${defsPalet(p)}</defs>` +
    `<rect x="0" y="0" width="${W}" height="${zona.toFixed(0)}" fill="url(#gAtas)"/>` +
    `<ellipse cx="${W / 2}" cy="${(225 * s).toFixed(0)}" rx="${(W * 0.53).toFixed(0)}" ry="${(265 * s).toFixed(0)}" fill="url(#gGlowLatar)"/>` +
    bingkaiTipis(W, H, s, inset, rx, p.bingkai, p.bingkai2) +
    isiZona +
    hero.svg +
    pembatas(W, pembatasY, s, p.pembatas) +
    pitaBawah(d, p, hiasPita) +
    `</svg>`
  );
}

/* ===================== HELPER ELEMEN (semua kategori) ===================== */

function star4(x: number, y: number, r: number, op = 1, fill = "#ffe08a"): string {
  const k = (r * 0.16).toFixed(1);
  return `<path transform="translate(${x.toFixed(1)} ${y.toFixed(1)})" fill="${fill}" opacity="${op}" d="M0 ${-r} C ${k} ${-k} ${k} ${-k} ${r} 0 C ${k} ${k} ${k} ${k} 0 ${r} C ${-k} ${k} ${-k} ${k} ${-r} 0 C ${-k} ${-k} ${-k} ${-k} 0 ${-r} Z"/>`;
}
function lingk(x: number, y: number, r: number, fill: string, op = 1): string {
  return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="${fill}" opacity="${op}"/>`;
}
function kotakRot(x: number, y: number, w: number, h: number, rot: number, fill: string, op = 1, rx = 0): string {
  return `<rect x="${(-w / 2).toFixed(1)}" y="${(-h / 2).toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="${rx}" fill="${fill}" opacity="${op}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${rot.toFixed(0)})"/>`;
}
const KONFETI = ["#ff5d73", "#ffd166", "#4cc9f0", "#b5e48c", "#ff9e6d", "#f472b6", "#a78bfa"];

/* ===================== HIBURAN (10 desain) ===================== */

function zonaHiburan(d: Dasar, v: number): string {
  const { W, l, s, zona } = d;
  const kiri = (l ? 96 : 118) * s;
  const kanan = W - kiri;
  let isi = "";
  if (v === 1) { // Konfeti Ceria — hujan konfeti di zona atas
    for (let i = 0; i < 26; i++) {
      const x = 60 * s + ((i * 137) % (W - 120 * s));
      const y = 26 * s + ((i * 89) % (zona - 90 * s));
      isi += kotakRot(x, y, 13 * s, 7 * s, (i * 47) % 180, KONFETI[i % 7], 0.92, 2 * s);
    }
  } else if (v === 2) { // Balon Pesta — balon mengapit
    const balon = (x: number, y: number, sc: number, c: string) =>
      `<g opacity="0.95"><ellipse cx="${x}" cy="${y}" rx="${34 * sc * s}" ry="${42 * sc * s}" fill="${c}"/>` +
      `<path d="M ${x} ${y + 42 * sc * s} q ${6 * s} ${14 * sc * s} 0 ${26 * sc * s}" stroke="#ffffff" stroke-width="${1.6 * s}" fill="none" opacity="0.7"/>` +
      `<path d="M ${x} ${y + 42 * sc * s + 26 * sc * s} l ${-5 * s} ${9 * s} l ${10 * s} 0 Z" fill="${c}"/>` +
      `<path d="M ${x} ${y + 68 * sc * s} c ${-12 * s} ${60 * s} ${12 * s} ${90 * s} ${-4 * s} ${150 * s}" stroke="#ffffff" stroke-width="${1.2 * s}" fill="none" opacity="0.55"/></g>`;
    isi =
      balon(kiri, 250 * s, 1, "#ff5d73") + balon(kiri + 66 * s, 340 * s, 0.72, "#ffd166") +
      balon(kanan, 250 * s, 1, "#4cc9f0") + balon(kanan - 66 * s, 340 * s, 0.72, "#b5e48c");
  } else if (v === 3) { // Sorot Panggung — dua sinar dari atas
    isi =
      `<polygon points="${W * 0.14},0 ${W * 0.30},0 ${W * 0.46},${zona} ${W * 0.22},${zona}" fill="#ffd166" opacity="0.20"/>` +
      `<polygon points="${W * 0.70},0 ${W * 0.86},0 ${W * 0.78},${zona} ${W * 0.54},${zona}" fill="#4cc9f0" opacity="0.18"/>` +
      star4(W * 0.22, 90 * s, 12 * s, 0.9) + star4(W * 0.78, 130 * s, 10 * s, 0.85, "#4cc9f0");
  } else if (v === 4) { // Bintang Kilau
    const pos = [[0.16, 70], [0.3, 150], [0.12, 230], [0.24, 330], [0.84, 80], [0.7, 160], [0.88, 240], [0.76, 340]];
    isi = pos.map(([fx, y], i) => star4(W * fx, y * s * (l ? 0.82 : 1), (i % 3 === 0 ? 15 : 9) * s, 0.95, KONFETI[i % 7])).join("");
  } else if (v === 5) { // Pita Warni — serpentine melengkung
    const pita = (x: number, arah: number) => {
      let u = "";
      for (let i = 0; i < 5; i++) {
        const y = (70 + i * 74) * s * (l ? 0.86 : 1);
        u += `<path d="M ${x} ${y} q ${arah * 34 * s} ${26 * s} 0 ${56 * s}" stroke="${KONFETI[i % 7]}" stroke-width="${7 * s}" fill="none" stroke-linecap="round" opacity="0.9"/>`;
      }
      return u;
    };
    isi = pita(kiri, 1) + pita(kanan, -1);
  } else if (v === 6) { // Kembang Api
    const burst = (cx: number, cy: number, r: number, c: string) => {
      let u = "";
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        u += `<line x1="${cx + Math.cos(a) * r * 0.3}" y1="${cy + Math.sin(a) * r * 0.3}" x2="${cx + Math.cos(a) * r}" y2="${cy + Math.sin(a) * r}" stroke="${c}" stroke-width="${2.4 * s}" stroke-linecap="round" opacity="0.9"/>`;
      }
      return u + lingk(cx, cy, 3.4 * s, c);
    };
    isi = burst(W * 0.2, 130 * s, 74 * s, "#ffd166") + burst(W * 0.8, 200 * s, 92 * s, "#4cc9f0") + burst(W * 0.5, 70 * s, 46 * s, "#f472b6");
  } else if (v === 7) { // Nota Musik
    const nota = (x: number, y: number, sc: number, c: string) =>
      `<g fill="${c}" opacity="0.95" transform="rotate(-8 ${x} ${y})">` +
      `<ellipse cx="${x}" cy="${y}" rx="${13 * sc * s}" ry="${9.5 * sc * s}"/>` +
      `<rect x="${x + 10 * sc * s}" y="${y - 52 * sc * s}" width="${4.4 * sc * s}" height="${54 * sc * s}" rx="${2 * s}"/>` +
      `<path d="M ${x + 10 * sc * s} ${y - 52 * sc * s} q ${20 * sc * s} ${8 * s} ${22 * sc * s} ${26 * s} q ${-8 * s} ${-10 * s} ${-22 * sc * s} ${-12 * s} Z"/></g>`;
    isi = nota(kiri, 210 * s, 1.1, "#ff5d73") + nota(kiri + 8 * s, 320 * s, 0.8, "#4cc9f0") +
      nota(kanan, 220 * s, 1.05, "#ffd166") + nota(kanan - 8 * s, 330 * s, 0.75, "#b5e48c");
  } else if (v === 8) { // Topi Pesta
    const topi = (x: number, y: number, rot: number, c: string) =>
      `<g transform="translate(${x} ${y}) rotate(${rot})">` +
      `<polygon points="0,${-74 * s} ${-34 * s},${34 * s} ${34 * s},${34 * s}" fill="${c}"/>` +
      `<circle cx="0" cy="${-78 * s}" r="${8 * s}" fill="#ffd166"/>` +
      `<line x1="${-17 * s}" y1="${-8 * s}" x2="${17 * s}" y2="${-8 * s}" stroke="#ffffff" stroke-width="${3.4 * s}" opacity="0.75"/>` +
      `<line x1="${-26 * s}" y1="${16 * s}" x2="${26 * s}" y2="${16 * s}" stroke="#ffffff" stroke-width="${3.4 * s}" opacity="0.75"/></g>`;
    isi = topi(kiri + 6 * s, 260 * s, -14, "#ff5d73") + topi(kanan - 6 * s, 280 * s, 12, "#4cc9f0") + topi(W * 0.14, 120 * s, 20, "#ffd166") + topi(W * 0.86, 120 * s, -20, "#b5e48c");
  } else if (v === 9) { // Bendera Umbul
    let u = "";
    for (const arah of [-1, 1]) {
      const x0 = W / 2 + arah * 90 * s;
      for (let i = 0; i < 5; i++) {
        const x = x0 + arah * i * 64 * s;
        const y = (34 + i * 15) * s;
        u += `<path d="M ${x} ${y} L ${x + arah * 54 * s} ${y + 7 * s} L ${x + arah * 30 * s} ${y + 52 * s} Z" fill="${KONFETI[(i + (arah > 0 ? 2 : 0)) % 7]}" opacity="0.95"/>`;
      }
      u += `<path d="M ${W / 2 + arah * 76 * s} ${28 * s} Q ${W / 2 + arah * 240 * s} ${70 * s} ${W / 2 + arah * 420 * s} ${100 * s}" stroke="#ffd166" stroke-width="${2.4 * s}" fill="none" opacity="0.8"/>`;
    }
    isi = u;
  } else { // 10 — Disco Kilau
    const bola = (cx: number, cy: number, r: number) => {
      let u = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#cfd8e3" opacity="0.9"/>`;
      for (let i = 1; i < 4; i++) u += `<line x1="${cx - r}" y1="${cy - r + (i * 2 * r) / 4}" x2="${cx + r}" y2="${cy - r + (i * 2 * r) / 4}" stroke="#8fa3b8" stroke-width="${1.6 * s}"/>`;
      for (let i = 1; i < 4; i++) u += `<line x1="${cx - r + (i * 2 * r) / 4}" y1="${cy - r}" x2="${cx - r + (i * 2 * r) / 4}" y2="${cy + r}" stroke="#8fa3b8" stroke-width="${1.6 * s}"/>`;
      return u + `<line x1="${cx}" y1="${cy - r - 26 * s}" x2="${cx}" y2="${cy - r}" stroke="#ffd166" stroke-width="${2.2 * s}"/>`;
    };
    isi = bola(kiri + 10 * s, 190 * s, 52 * s) + bola(kanan - 10 * s, 250 * s, 44 * s) +
      star4(W * 0.24, 330 * s, 11 * s, 0.9, "#4cc9f0") + star4(W * 0.76, 340 * s, 11 * s, 0.9, "#f472b6");
  }
  return isi;
}

function pitaHiburan(d: Dasar, v: number): string {
  const { W, H, s } = d;
  const y = H - 75 * s;
  if (v === 1 || v === 5) {
    let u = "";
    for (let i = 0; i < 16; i++) u += kotakRot(W * (0.1 + (i * 0.8) / 15), y + ((i * 29) % 40 - 20) * s, 12 * s, 6 * s, (i * 53) % 180, KONFETI[i % 7], 0.9, 2 * s);
    return u;
  }
  if (v === 6) { // kembang api kecil di pita
    return star4(W * 0.16, y, 13 * s, 0.95, "#ffd166") + star4(W * 0.84, y, 13 * s, 0.95, "#4cc9f0") + star4(W * 0.5, y - 6 * s, 10 * s, 0.9, "#f472b6");
  }
  if (v === 8) { // dua topi mini
    const topi = (x: number, rot: number, c: string) => `<g transform="translate(${x} ${y + 6 * s}) rotate(${rot})"><polygon points="0,${-30 * s} ${-14 * s},${16 * s} ${14 * s},${16 * s}" fill="${c}"/><circle cx="0" cy="${-32 * s}" r="${4 * s}" fill="#ffd166"/></g>`;
    return topi(W * 0.2, -10, "#ff5d73") + topi(W * 0.8, 10, "#4cc9f0");
  }
  if (v === 9) { // bendera mini
    let u = "";
    for (let i = 0; i < 5; i++) u += `<path d="M ${W * (0.3 + i * 0.1)} ${y - 14 * s} l ${16 * s} 0 l ${-8 * s} ${22 * s} Z" fill="${KONFETI[i % 7]}"/>`;
    return u;
  }
  return star4(W * 0.16, y, 12 * s, 0.95) + star4(W * 0.84, y, 12 * s, 0.95) + lingk(W * 0.5, y, 5 * s, "#ffd166", 0.9);
}

/* ===================== MOVIE (10 desain) ===================== */

function perforasi(W: number, y: number, s: number, warna: string): string {
  let u = "";
  const n = Math.floor(W / (46 * s));
  for (let i = 0; i <= n; i++) u += `<rect x="${(i * W) / n - 11 * s}" y="${y - 8 * s}" width="${22 * s}" height="${16 * s}" rx="${4 * s}" fill="${warna}" opacity="0.85"/>`;
  return u;
}

function zonaMovie(d: Dasar, v: number): string {
  const { W, l, s, zona } = d;
  const kiri = (l ? 96 : 118) * s;
  let isi = "";
  if (v === 1) { // Perforasi Film — baris lubang film di puncak zona
    isi = perforasi(W, 34 * s, s, "#d9b45c") + perforasi(W, zona - 16 * s, s, "#d9b45c");
  } else if (v === 2) { // Clapperboard mengapit
    const clap = (x: number, y: number, rot: number) =>
      `<g transform="translate(${x} ${y}) rotate(${rot})">` +
      `<rect x="${-44 * s}" y="${-26 * s}" width="${88 * s}" height="${58 * s}" rx="${5 * s}" fill="#1c2230" stroke="#d9b45c" stroke-width="${2.4 * s}"/>` +
      `<g transform="rotate(-14 0 ${-26 * s})"><rect x="${-46 * s}" y="${-46 * s}" width="${92 * s}" height="${20 * s}" rx="${3 * s}" fill="#d9b45c"/>` +
      [0, 1, 2, 3].map((i) => `<rect x="${-46 * s + i * 24 * s}" y="${-46 * s}" width="${11 * s}" height="${20 * s}" fill="#1c2230" transform="skewX(-14)"/>`).join("") + `</g>` +
      `<rect x="${-30 * s}" y="${-6 * s}" width="${60 * s}" height="${4 * s}" fill="#d9b45c" opacity="0.6"/></g>`;
    isi = clap(kiri + 8 * s, 230 * s, -10) + clap(W - kiri - 8 * s, 260 * s, 10);
  } else if (v === 3) { // Sorot Sinema
    isi =
      `<polygon points="${W * 0.12},0 ${W * 0.26},0 ${W * 0.5},${zona} ${W * 0.2},${zona}" fill="#ffe08a" opacity="0.16"/>` +
      `<polygon points="${W * 0.74},0 ${W * 0.88},0 ${W * 0.8},${zona} ${W * 0.5},${zona}" fill="#ffe08a" opacity="0.14"/>` +
      star4(W * 0.3, 120 * s, 8 * s, 0.7) + star4(W * 0.7, 180 * s, 8 * s, 0.7) + star4(W * 0.5, 90 * s, 6 * s, 0.6);
  } else if (v === 4) { // Gulungan Film
    const reel = (cx: number, cy: number, r: number) => {
      let u = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#141824" stroke="#d9b45c" stroke-width="${3 * s}"/>`;
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + 0.4;
        u += `<circle cx="${cx + Math.cos(a) * r * 0.55}" cy="${cy + Math.sin(a) * r * 0.55}" r="${r * 0.2}" fill="#0c0f18" stroke="#d9b45c" stroke-width="${1.6 * s}"/>`;
      }
      return u + `<circle cx="${cx}" cy="${cy}" r="${r * 0.16}" fill="#d9b45c"/>`;
    };
    isi = reel(kiri + 26 * s, 220 * s, 64 * s) + reel(W - kiri - 26 * s, 250 * s, 56 * s);
  } else if (v === 5) { // Tiket Premier di zona
    const tiket = (x: number, y: number, rot: number) =>
      `<g transform="translate(${x} ${y}) rotate(${rot})"><rect x="${-52 * s}" y="${-24 * s}" width="${104 * s}" height="${48 * s}" rx="${6 * s}" fill="#e8c877"/>` +
      `<line x1="${-30 * s}" y1="${-24 * s}" x2="${-30 * s}" y2="${24 * s}" stroke="#2b1d08" stroke-width="${2 * s}" stroke-dasharray="${5 * s} ${4 * s}"/>` +
      `<circle cx="${-52 * s}" cy="0" r="${6 * s}" fill="#1a1f2e"/><circle cx="${52 * s}" cy="0" r="${6 * s}" fill="#1a1f2e"/></g>`;
    isi = tiket(kiri + 20 * s, 240 * s, -12) + tiket(W - kiri - 20 * s, 240 * s, 12);
  } else if (v === 6) { // Kamera Klasik
    const kamera = (x: number, y: number, rot: number) =>
      `<g transform="translate(${x} ${y}) rotate(${rot})">` +
      `<rect x="${-46 * s}" y="${-30 * s}" width="${70 * s}" height="${54 * s}" rx="${6 * s}" fill="#1c2230" stroke="#d9b45c" stroke-width="${2.4 * s}"/>` +
      `<circle cx="${44 * s}" cy="0" r="${22 * s}" fill="#141824" stroke="#d9b45c" stroke-width="${2.4 * s}"/>` +
      `<circle cx="${44 * s}" cy="0" r="${10 * s}" fill="#d9b45c" opacity="0.8"/></g>`;
    isi = kamera(kiri + 14 * s, 250 * s, -8) + kamera(W - kiri - 14 * s, 250 * s, 8);
  } else if (v === 7) { // Lampu Studio di tepi
    let u = "";
    for (const fx of [0.16, 0.5, 0.84]) {
      const x = W * fx;
      u += `<polygon points="${x - 20 * s},${30 * s} ${x + 20 * s},${30 * s} ${x + 27 * s},${58 * s} ${x - 27 * s},${58 * s}" fill="#1c2230" stroke="#d9b45c" stroke-width="${2 * s}"/>` +
        `<circle cx="${x}" cy="${66 * s}" r="${9 * s}" fill="#ffe08a" filter="url(#fGlow)" opacity="0.9"/>` +
        `<polygon points="${x - 20 * s},${70 * s} ${x + 20 * s},${70 * s} ${x + 60 * s},${zona - 30 * s} ${x - 60 * s},${zona - 30 * s}" fill="#ffe08a" opacity="0.12"/>`;
    }
    isi = u;
  } else if (v === 8) { // Bintang Film
    isi = star4(W * 0.18, 110 * s, 20 * s, 0.95, "#ffe08a") + star4(W * 0.82, 150 * s, 26 * s, 0.95, "#ffe08a") +
      star4(W * 0.26, 260 * s, 12 * s, 0.8) + star4(W * 0.74, 300 * s, 10 * s, 0.8) + star4(W * 0.5, 70 * s, 8 * s, 0.7);
  } else if (v === 9) { // Strip Film Samping (vertikal)
    const strip = (x: number) => {
      let u = `<rect x="${x - 30 * s}" y="${60 * s}" width="${60 * s}" height="${zona - 90 * s}" rx="${6 * s}" fill="#141824" stroke="#d9b45c" stroke-width="${2.2 * s}" opacity="0.95"/>`;
      for (let y = 76 * s; y < zona - 50 * s; y += 40 * s) u += `<rect x="${x - 18 * s}" y="${y}" width="${36 * s}" height="${18 * s}" rx="${3 * s}" fill="#0c0f18" stroke="#d9b45c" stroke-width="${1.2 * s}"/>`;
      return u;
    };
    isi = strip(kiri + 30 * s) + strip(W - kiri - 30 * s);
  } else { // 10 — Laurels mengapit zona
    const laurel = (x: number, arah: number) => {
      let u = `<path d="M ${x} ${70 * s} q ${arah * -46 * s} ${90 * s} ${arah * -14 * s} ${210 * s}" stroke="#d9b45c" stroke-width="${3.4 * s}" fill="none"/>`;
      for (let i = 0; i < 6; i++) {
        const t = i / 5;
        const lx = x + arah * (-46 + 32 * t) * s;
        const ly = (70 + 210 * t) * s;
        u += `<ellipse cx="${lx}" cy="${ly}" rx="${16 * s}" ry="${6.5 * s}" fill="#d9b45c" opacity="0.9" transform="rotate(${arah * (-40 + 60 * t)} ${lx} ${ly})"/>`;
      }
      return u;
    };
    isi = laurel(kiri + 66 * s, 1) + laurel(W - kiri - 66 * s, -1);
  }
  return isi;
}

function pitaMovie(d: Dasar, v: number): string {
  const { W, H, s } = d;
  const y = H - 75 * s;
  if (v === 1) return perforasi(W, y, s, "#d9b45c");
  if (v === 5 || v === 6) {
    const tiket = (x: number, rot: number) => `<g transform="translate(${x} ${y}) rotate(${rot})"><rect x="${-30 * s}" y="${-13 * s}" width="${60 * s}" height="${26 * s}" rx="${4 * s}" fill="#e8c877"/><line x1="${-14 * s}" y1="${-13 * s}" x2="${-14 * s}" y2="${13 * s}" stroke="#2b1d08" stroke-width="${1.6 * s}" stroke-dasharray="${4 * s} ${3 * s}"/></g>`;
    return tiket(W * 0.22, -8) + tiket(W * 0.78, 8);
  }
  return star4(W * 0.18, y, 11 * s, 0.9, "#ffe08a") + star4(W * 0.82, y, 11 * s, 0.9, "#ffe08a") + `<circle cx="${W / 2}" cy="${y}" r="${4.5 * s}" fill="#d9b45c" opacity="0.9"/>`;
}

/* ===================== DRAMA (10 desain) ===================== */

function zonaDrama(d: Dasar, v: number): string {
  const { W, l, s, zona } = d;
  const kiri = (l ? 96 : 118) * s;
  let isi = "";
  if (v === 1) { // Tirai Panggung
    const tirai = (x: number, arah: number) => {
      let u = `<path d="M ${x} 0 L ${x + arah * 54 * s} 0 Q ${x + arah * 40 * s} ${zona * 0.55} ${x + arah * 8 * s} ${zona}" fill="#7a1220" stroke="#d4af37" stroke-width="${1.8 * s}" opacity="0.95"/>`;
      for (let i = 1; i <= 3; i++) u += `<path d="M ${x + arah * i * 16 * s} 0 Q ${x + arah * (i * 16 - 4) * s} ${zona * 0.5} ${x + arah * (i * 16 - 6) * s} ${zona * 0.82}" stroke="#d4af37" stroke-width="${1.2 * s}" fill="none" opacity="0.5"/>`;
      return u;
    };
    isi = tirai(kiri, 1) + tirai(W - kiri, -1) + `<path d="M ${W * 0.14} 0 Q ${W / 2} ${86 * s} ${W * 0.86} 0 L ${W * 0.86} ${40 * s} Q ${W / 2} ${130 * s} ${W * 0.14} ${40 * s} Z" fill="#7a1220" stroke="#d4af37" stroke-width="${1.8 * s}" opacity="0.96"/>`;
  } else if (v === 2) { // Mawar Merah
    const mawar = (x: number, y: number, r: number) => {
      let u = `<circle cx="${x}" cy="${y}" r="${r}" fill="#8e1b2c"/>`;
      for (let i = 0; i < 3; i++) u += `<path d="M ${x - r * (0.7 - i * 0.18)} ${y} a ${r * (0.7 - i * 0.18)} ${r * (0.7 - i * 0.18)} 0 1 1 ${r * (1.4 - i * 0.36)} 0" stroke="#d4af37" stroke-width="${1.8 * s}" fill="none" opacity="0.8"/>`;
      return u + `<path d="M ${x} ${y + r} q ${-14 * s} ${16 * s} 0 ${30 * s}" stroke="#4a7a3a" stroke-width="${2.6 * s}" fill="none"/>`;
    };
    isi = mawar(kiri + 30 * s, 200 * s, 34 * s) + mawar(kiri + 10 * s, 320 * s, 24 * s) + mawar(W - kiri - 30 * s, 220 * s, 34 * s) + mawar(W - kiri - 10 * s, 340 * s, 24 * s);
  } else if (v === 3) { // Topeng Teater
    const topeng = (x: number, y: number, senyum: boolean) =>
      `<g transform="translate(${x} ${y})"><ellipse cx="0" cy="0" rx="${34 * s}" ry="${42 * s}" fill="#e8c877" stroke="#3a0d12" stroke-width="${2 * s}"/>` +
      `<ellipse cx="${-12 * s}" cy="${-10 * s}" rx="${5 * s}" ry="${8 * s}" fill="#3a0d12"/><ellipse cx="${12 * s}" cy="${-10 * s}" rx="${5 * s}" ry="${8 * s}" fill="#3a0d12"/>` +
      (senyum ? `<path d="M ${-14 * s} ${14 * s} q ${14 * s} ${16 * s} ${28 * s} 0" stroke="#3a0d12" stroke-width="${2.4 * s}" fill="none"/>` : `<path d="M ${-14 * s} ${26 * s} q ${14 * s} ${-14 * s} ${28 * s} 0" stroke="#3a0d12" stroke-width="${2.4 * s}" fill="none"/>`) + `</g>`;
    isi = topeng(kiri + 40 * s, 250 * s, true) + topeng(W - kiri - 40 * s, 250 * s, false);
  } else if (v === 4) { // Ornamen Barok — scroll sudut
    const barok = (x: number, y: number, arah: number) =>
      `<g stroke="#d4af37" fill="none" opacity="0.95"><path d="M ${x} ${y} q ${arah * 60 * s} ${-10 * s} ${arah * 74 * s} ${40 * s} q ${arah * 10 * s} ${36 * s} ${arah * -22 * s} ${44 * s} q ${arah * -24 * s} ${6 * s} ${arah * -28 * s} ${-16 * s}" stroke-width="${3 * s}"/>` +
      `<path d="M ${x + arah * 20 * s} ${y + 8 * s} q ${arah * 40 * s} ${6 * s} ${arah * 44 * s} ${30 * s}" stroke-width="${1.6 * s}"/>` +
      `<circle cx="${x + arah * 52 * s}" cy="${y + 22 * s}" r="${5 * s}" fill="#d4af37"/></g>`;
    isi = barok(kiri, 96 * s, 1) + barok(W - kiri, 96 * s, -1) + barok(kiri, 340 * s, 1) + barok(W - kiri, 340 * s, -1);
  } else if (v === 5) { // Lilin Emas
    const lilin = (x: number, y: number) =>
      `<g><rect x="${x - 11 * s}" y="${y - 44 * s}" width="${22 * s}" height="${88 * s}" rx="${4 * s}" fill="#e8c877" stroke="#7a5c19" stroke-width="${1.6 * s}"/>` +
      `<path d="M ${x} ${y - 74 * s} q ${9 * s} ${14 * s} 0 ${26 * s} q ${-9 * s} ${-12 * s} 0 ${-26 * s}" fill="#ffb43a" filter="url(#fGlow)"/>` +
      `<line x1="${x}" y1="${y - 78 * s}" x2="${x}" y2="${y - 70 * s}" stroke="#7a5c19" stroke-width="${2 * s}"/></g>`;
    isi = lilin(kiri + 26 * s, 280 * s) + lilin(W - kiri - 26 * s, 280 * s);
  } else if (v === 6) { // Kipas Zaman
    const kipas = (x: number, y: number, arah: number) => {
      let u = `<g transform="translate(${x} ${y}) rotate(${arah * -18})">`;
      for (let i = -3; i <= 3; i++) u += `<line x1="0" y1="0" x2="${i * 13 * s}" y2="${-72 * s}" stroke="#d4af37" stroke-width="${2.6 * s}"/>`;
      return u + `<path d="M ${-48 * s} ${-74 * s} Q 0 ${-96 * s} ${48 * s} ${-74 * s} Q 0 ${-60 * s} ${-48 * s} ${-74 * s} Z" fill="#8e1b2c" opacity="0.9"/><circle cx="0" cy="0" r="${6 * s}" fill="#d4af37"/></g>`;
    };
    isi = kipas(kiri + 44 * s, 300 * s, 1) + kipas(W - kiri - 44 * s, 300 * s, -1);
  } else if (v === 7) { // Swag Emas (drapery lengkung)
    isi =
      `<path d="M ${W * 0.13} ${70 * s} Q ${W / 2} ${170 * s} ${W * 0.87} ${70 * s}" stroke="#d4af37" stroke-width="${3.4 * s}" fill="none" opacity="0.95"/>` +
      `<path d="M ${W * 0.13} ${70 * s} Q ${W / 2} ${210 * s} ${W * 0.87} ${70 * s}" stroke="#d4af37" stroke-width="${1.8 * s}" fill="none" opacity="0.7"/>` +
      [0.13, 0.5, 0.87].map((fx) => `<circle cx="${W * fx}" cy="${(fx === 0.5 ? 168 : 72) * s}" r="${7 * s}" fill="#d4af37"/>`).join("");
  } else if (v === 8) { // Lampu Gantung mini
    const gantung = (x: number) =>
      `<g><line x1="${x}" y1="0" x2="${x}" y2="${64 * s}" stroke="#d4af37" stroke-width="${2.2 * s}"/>` +
      `<path d="M ${x - 30 * s} ${96 * s} Q ${x} ${56 * s} ${x + 30 * s} ${96 * s}" stroke="#d4af37" stroke-width="${2.6 * s}" fill="none"/>` +
      `<circle cx="${x}" cy="${96 * s}" r="${8 * s}" fill="#ffd9c9" filter="url(#fGlow)" opacity="0.95"/>` +
      `<circle cx="${x - 22 * s}" cy="${84 * s}" r="${5 * s}" fill="#ffd9c9" opacity="0.8"/><circle cx="${x + 22 * s}" cy="${84 * s}" r="${5 * s}" fill="#ffd9c9" opacity="0.8"/></g>`;
    isi = gantung(kiri + 40 * s) + gantung(W - kiri - 40 * s);
  } else if (v === 9) { // Sulur Klasik
    const sulur = (x: number, arah: number) =>
      `<g stroke="#d4af37" fill="none" opacity="0.9">` +
      `<path d="M ${x} ${zona * 0.16} q ${arah * 54 * s} ${26 * s} ${arah * 40 * s} ${84 * s} q ${arah * -14 * s} ${52 * s} ${arah * -52 * s} ${70 * s}" stroke-width="${2.8 * s}"/>` +
      `<path d="M ${x + arah * 30 * s} ${zona * 0.34} q ${arah * 26 * s} ${10 * s} ${arah * 30 * s} ${-14 * s} q ${arah * 4 * s} ${-20 * s} ${arah * -18 * s} ${-18 * s}" stroke-width="${1.8 * s}"/>` +
      `<circle cx="${x + arah * 12 * s}" cy="${zona * 0.62}" r="${4.5 * s}" fill="#d4af37"/></g>`;
    isi = sulur(kiri, 1) + sulur(W - kiri, -1);
  } else { // 10 — Lampu Panggung (footlight) di dasar zona
    let u = "";
    for (let i = 0; i < 7; i++) {
      const x = W * (0.18 + (i * 0.64) / 6);
      u += `<path d="M ${x - 14 * s} ${(l ? 356 : 430) * s} a ${14 * s} ${14 * s} 0 0 1 ${28 * s} 0 Z" fill="#ffd9c9" filter="url(#fGlow)" opacity="0.9"/>`;
    }
    isi = u;
  }
  return isi;
}

function pitaDrama(d: Dasar, v: number): string {
  const { W, H, s } = d;
  const y = H - 75 * s;
  const mawarKecil = (x: number) => `<circle cx="${x}" cy="${y}" r="${10 * s}" fill="#8e1b2c"/><circle cx="${x}" cy="${y}" r="${5 * s}" fill="none" stroke="#d4af37" stroke-width="${1.4 * s}"/>`;
  if (v === 2) return mawarKecil(W * 0.16) + mawarKecil(W * 0.84) + `<circle cx="${W / 2}" cy="${y}" r="${4 * s}" fill="#d4af37"/>`;
  if (v === 5) {
    const lilin = (x: number) => `<rect x="${x - 6 * s}" y="${y - 16 * s}" width="${12 * s}" height="${30 * s}" rx="${2 * s}" fill="#e8c877"/><circle cx="${x}" cy="${y - 22 * s}" r="${4 * s}" fill="#ffb43a" filter="url(#fGlow)"/>`;
    return lilin(W * 0.2) + lilin(W * 0.8);
  }
  if (v === 10) {
    let u = "";
    for (let i = 0; i < 5; i++) u += `<path d="M ${W * (0.28 + i * 0.11) - 8 * s} ${y + 8 * s} a ${8 * s} ${8 * s} 0 0 1 ${16 * s} 0 Z" fill="#ffd9c9" opacity="0.9"/>`;
    return u;
  }
  return star4(W * 0.16, y, 11 * s, 0.9, "#d4af37") + star4(W * 0.84, y, 11 * s, 0.9, "#d4af37") + `<circle cx="${W / 2}" cy="${y}" r="${4 * s}" fill="#d4af37" opacity="0.9"/>`;
}

/* ===================== CINEMA (10 desain) ===================== */

function bohlam(x: number, y: number, s: number, op = 0.95): string {
  return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(9 * s).toFixed(1)}" fill="#ffe08a" stroke="#6ee7ff" stroke-width="${(1.6 * s).toFixed(1)}" filter="url(#fGlow)" opacity="${op}"/>`;
}

function zonaCinema(d: Dasar, v: number): string {
  const { W, l, s, zona } = d;
  const kiri = (l ? 96 : 118) * s;
  let isi = "";
  if (v === 1) { // Bohlam Marquee — baris bohlam di tepi atas & dasar zona
    let u = "";
    const n = Math.floor(W / (86 * s));
    for (let i = 0; i <= n; i++) {
      u += bohlam((i * W) / n, 30 * s, s);
      u += bohlam((i * W) / n, (l ? 368 : 448) * s, s, 0.8);
    }
    isi = u;
  } else if (v === 2) { // Popcorn
    const pop = (x: number, y: number) =>
      `<g transform="translate(${x} ${y})"><path d="M ${-30 * s} ${-6 * s} L ${-22 * s} ${52 * s} L ${22 * s} ${52 * s} L ${30 * s} ${-6 * s} Z" fill="#e8c877" stroke="#155e6b" stroke-width="${2 * s}"/>` +
      `<path d="M ${-30 * s} ${-6 * s} L ${30 * s} ${-6 * s}" stroke="#155e6b" stroke-width="${2.4 * s}"/>` +
      lingk(-14 * s, -18 * s, 11 * s, "#fff7e6") + lingk(2 * s, -26 * s, 12 * s, "#ffffff") + lingk(16 * s, -16 * s, 10 * s, "#fff7e6") +
      `<path d="M ${-20 * s} ${4 * s} L ${-16 * s} ${44 * s} M ${0} ${4 * s} L ${0} ${44 * s} M ${20 * s} ${4 * s} L ${16 * s} ${44 * s}" stroke="#c9a227" stroke-width="${2 * s}"/></g>`;
    isi = pop(kiri + 40 * s, 280 * s) + pop(W - kiri - 40 * s, 280 * s);
  } else if (v === 3) { // Kacamata 3D
    const kaca = (x: number, y: number) =>
      `<g transform="translate(${x} ${y})"><rect x="${-58 * s}" y="${-22 * s}" width="${116 * s}" height="${44 * s}" rx="${8 * s}" fill="#0a2230" stroke="#6ee7ff" stroke-width="${2.2 * s}"/>` +
      `<rect x="${-48 * s}" y="${-14 * s}" width="${44 * s}" height="${28 * s}" rx="${4 * s}" fill="#ff3b5c" opacity="0.85"/>` +
      `<rect x="${4 * s}" y="${-14 * s}" width="${44 * s}" height="${28 * s}" rx="${4 * s}" fill="#3bd1ff" opacity="0.85"/></g>`;
    isi = kaca(kiri + 60 * s, 270 * s) + kaca(W - kiri - 60 * s, 270 * s);
  } else if (v === 4) { // Proyektor + beam
    isi =
      `<g transform="translate(${W - kiri - 70 * s} ${170 * s}) rotate(18)"><rect x="${-44 * s}" y="${-26 * s}" width="${88 * s}" height="${48 * s}" rx="${8 * s}" fill="#0a2230" stroke="#6ee7ff" stroke-width="${2.4 * s}"/>` +
      `<circle cx="${30 * s}" cy="0" r="${12 * s}" fill="#8df3ff" filter="url(#fGlow)"/><circle cx="${-26 * s}" cy="${-10 * s}" r="${7 * s}" fill="#ff6ec7" opacity="0.9"/></g>` +
      `<polygon points="${W - kiri - 60 * s},${200 * s} ${W - kiri - 20 * s},${210 * s} ${W * 0.62},${zona} ${W * 0.86},${zona}" fill="#8df3ff" opacity="0.13"/>`;
  } else if (v === 5) { // Gelas Minum
    const gelas = (x: number, y: number, c: string) =>
      `<g transform="translate(${x} ${y})"><path d="M ${-24 * s} ${-34 * s} L ${-18 * s} ${44 * s} L ${18 * s} ${44 * s} L ${24 * s} ${-34 * s} Z" fill="${c}" opacity="0.85" stroke="#6ee7ff" stroke-width="${2 * s}"/>` +
      `<line x1="${6 * s}" y1="${-34 * s}" x2="${26 * s}" y2="${-74 * s}" stroke="#ff6ec7" stroke-width="${4 * s}"/>` +
      `<circle cx="${-6 * s}" cy="${-44 * s}" r="${6 * s}" fill="#fff7e6"/><circle cx="${8 * s}" cy="${-50 * s}" r="${5 * s}" fill="#fff7e6"/></g>`;
    isi = gelas(kiri + 40 * s, 280 * s, "#ff6ec7") + gelas(W - kiri - 40 * s, 280 * s, "#3bd1ff");
  } else if (v === 6) { // Tiket Bioskop
    const tiket = (x: number, y: number, rot: number) =>
      `<g transform="translate(${x} ${y}) rotate(${rot})"><rect x="${-56 * s}" y="${-26 * s}" width="${112 * s}" height="${52 * s}" rx="${6 * s}" fill="#0a2230" stroke="#6ee7ff" stroke-width="${2.2 * s}"/>` +
      `<line x1="${-32 * s}" y1="${-26 * s}" x2="${-32 * s}" y2="${26 * s}" stroke="#6ee7ff" stroke-width="${1.8 * s}" stroke-dasharray="${5 * s} ${4 * s}"/>` +
      `<circle cx="${-56 * s}" cy="0" r="${6 * s}" fill="#071a24"/><circle cx="${56 * s}" cy="0" r="${6 * s}" fill="#071a24"/>` +
      `<rect x="${-20 * s}" y="${-8 * s}" width="${28 * s}" height="${5 * s}" fill="#8df3ff" opacity="0.8"/><rect x="${-20 * s}" y="${2 * s}" width="${20 * s}" height="${5 * s}" fill="#ff6ec7" opacity="0.8"/></g>`;
    isi = tiket(kiri + 30 * s, 250 * s, -10) + tiket(W - kiri - 30 * s, 250 * s, 10);
  } else if (v === 7) { // Neon zigzag
    const neon = (x: number, arah: number) => {
      let u = `<path d="M ${x} ${90 * s}`;
      for (let i = 0; i < 5; i++) u += ` L ${x + arah * (i % 2 === 0 ? 34 : 6) * s} ${(120 + i * 56) * s}`;
      return u + `" stroke="#ff6ec7" stroke-width="${3.4 * s}" fill="none" filter="url(#fGlow)" opacity="0.95"/>`;
    };
    isi = neon(kiri + 10 * s, 1) + neon(W - kiri - 10 * s, -1);
  } else if (v === 8) { // Reel Ganda
    const reel = (cx: number, cy: number, r: number) => {
      let u = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#071a24" stroke="#6ee7ff" stroke-width="${2.6 * s}"/>`;
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        u += `<circle cx="${cx + Math.cos(a) * r * 0.5}" cy="${cy + Math.sin(a) * r * 0.5}" r="${r * 0.18}" fill="#0a2230" stroke="#6ee7ff" stroke-width="${1.4 * s}"/>`;
      }
      return u + `<circle cx="${cx}" cy="${cy}" r="${r * 0.14}" fill="#8df3ff"/>`;
    };
    isi = reel(kiri + 30 * s, 200 * s, 52 * s) + reel(kiri + 30 * s, 320 * s, 52 * s) + reel(W - kiri - 30 * s, 260 * s, 52 * s);
  } else if (v === 9) { // Bintang Walk
    const bintang = (x: number, y: number) =>
      `<g transform="translate(${x} ${y})"><rect x="${-40 * s}" y="${-24 * s}" width="${80 * s}" height="${48 * s}" rx="${4 * s}" fill="#1c2230" stroke="#6ee7ff" stroke-width="${1.6 * s}" opacity="0.9"/>` +
      star4(0, 0, 15 * s, 1, "#ffd166") + star4(-18 * s, 6 * s, 5 * s, 0.9, "#ffd166") + star4(18 * s, 6 * s, 5 * s, 0.9, "#ffd166") + `</g>`;
    isi = bintang(kiri + 42 * s, 220 * s) + bintang(W - kiri - 42 * s, 280 * s);
  } else { // 10 — Layar Megah
    isi =
      `<rect x="${W * 0.2}" y="${(l ? 300 : 380) * s}" width="${W * 0.6}" height="${8 * s}" fill="#6ee7ff" opacity="0.8" filter="url(#fGlow)"/>` +
      `<polygon points="${W * 0.46},${(l ? 240 : 300) * s} ${W * 0.54},${(l ? 240 : 300) * s} ${W * 0.58},${(l ? 300 : 380) * s} ${W * 0.42},${(l ? 300 : 380) * s}" fill="#8df3ff" opacity="0.16"/>` +
      star4(W * 0.16, 100 * s, 12 * s, 0.9, "#8df3ff") + star4(W * 0.84, 140 * s, 12 * s, 0.9, "#ff6ec7");
  }
  return isi;
}

function pitaCinema(d: Dasar, v: number): string {
  const { W, H, s } = d;
  const y = H - 75 * s;
  if (v === 1) {
    let u = "";
    for (let i = 0; i < 7; i++) u += bohlam(W * (0.2 + i * 0.1), y, s, 0.9);
    return u;
  }
  if (v === 3) {
    return `<g transform="translate(${W * 0.22} ${y})"><rect x="${-28 * s}" y="${-10 * s}" width="${56 * s}" height="${20 * s}" rx="${4 * s}" fill="#0a2230" stroke="#6ee7ff" stroke-width="${1.6 * s}"/><rect x="${-22 * s}" y="${-6 * s}" width="${18 * s}" height="${12 * s}" fill="#ff3b5c" opacity="0.85"/><rect x="${4 * s}" y="${-6 * s}" width="${18 * s}" height="${12 * s}" fill="#3bd1ff" opacity="0.85"/></g>`;
  }
  return star4(W * 0.18, y, 10 * s, 0.9, "#8df3ff") + star4(W * 0.82, y, 10 * s, 0.9, "#ff6ec7") + bohlam(W / 2, y, s, 0.85);
}

/* ===================== RAKIT SEMUA (80 PNG) ===================== */

const KATEGORI: { nama: string; palet: Palet; zona: (d: Dasar, v: number) => string; pita: (d: Dasar, v: number) => string }[] = [
  { nama: "hiburan", palet: PALET.hiburan, zona: zonaHiburan, pita: pitaHiburan },
  { nama: "movie", palet: PALET.movie, zona: zonaMovie, pita: pitaMovie },
  { nama: "drama", palet: PALET.drama, zona: zonaDrama, pita: pitaDrama },
  { nama: "cinema", palet: PALET.cinema, zona: zonaCinema, pita: pitaCinema },
];

async function render(nama: string, svg: string) {
  await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(path.join(OUT, nama));
  console.log("✓", nama);
}

for (const kat of KATEGORI) {
  for (let v = 1; v <= 10; v++) {
    const slug = `${kat.nama}-${v}`;
    await render(`${slug}-916.png`, kumpulkan(dasar(R916), kat.palet, kat.zona(dasar(R916), v), kat.pita(dasar(R916), v)));
    await render(`${slug}-169.png`, kumpulkan(dasar(R169), kat.palet, kat.zona(dasar(R169), v), kat.pita(dasar(R169), v)));
  }
}
console.log("SELESAI 80 PNG →", OUT);
