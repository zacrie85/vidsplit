// VidSplit v0.12.0 — MESIN TRANSFORMASI GENRE PENUH + PENCIPTA MUSIK BARU DARI CHORD.
// Jawaban atas "hasilnya masih didominasi musik asli": di mode PENUH, audio asli
// TIDAK IKUT SAMA SEKALI (vokal mati secara bawaan). Yang dipakai hanya HASIL
// ANALISIS-nya sebagai referensi komposisi:
//   • CHORD  : progresi hasil chromagram → acuan akar/tangga nada
//   • BPM+fasa: kisi ketukan → semua instrumen sejajar tempo asli
//   • STRUKTUR: panjang & urutan segmen chord → kerangka lagu baru
// Lalu musik BARU DICIPTAKAN sepenuhnya:
//   • DRUM   : pola khas genre + perkusi ekstra (tabla utk dangdut) + fill tiap 8 bar
//   • BASS   : garis bass gaya genre mengikuti akar chord
//   • AKOR   : komping/pad/arpeggio mengikuti progresi
//   • MELODI : BUATAN BARU — diciptakan dari nada-nada chord dgn gaya khas genre
//              (ritme, tangga nada, ornamen, register — MELODI_GENRE) + tombol variasi
//   • DEKORASI: sitar khas India utk dangdut, dst.
// Hasil = musik benar-benar baru khas genre yang "mengikuti" lagu asli via chord-nya —
// 100% offline, JS murni, tanpa dependensi.
import type { GenreMusik, PolaLayer, SegmenChord } from "./musik";
import { LAJU, nadaIns, polaBar, sampel, tulisKeBufor, wavDariFloat, beriReverb, type InsNada, type Instrumen } from "./musikLayer";
import type { CatatanMelodi } from "./musikAnalisis";

const FREQ_C2 = 65.406; // C2 — basis frekuensi bass
const FREQ_C4 = 261.626; // C4 — basis frekuensi akor/melodi

// ============ GAYA IRINGAN PER GENRE (17) ============

export type GayaBass =
  | "delapan"   // not ke-8 di akar (pop/rock/punk/metal)
  | "rootlima"  // akar–kvint panjang (keroncong/country/gamelan)
  | "jalan"     // walking bass: akar-3-kvint-penuntun (jazz/blues/ska)
  | "reggae"    // akar panjang + dorongan di 2¾
  | "pump"      // not ke-8 beroktaf (disco/edm)
  | "dangdut"   // akar-1½-kvint-oktaf khas kendang ganda
  | "sub"       // sub-bass panjang 808 (hiphop/lofi)
  | "funk";     // sinkop ke-16 + plok oktaf

export type GayaComp =
  | "skank"     // stab off-beat (ska/reggae)
  | "strum"     // petik penuh tiap not ke-8 (keroncong/country)
  | "pad"       // akor bertahan sebar (edm/hiphop/lofi)
  | "swing"     // dentum di ketuk 2 & 4 (jazz/blues)
  | "punch"     // akor tenaga tiap ketuk (rock/punk/metal)
  | "arpeggio"  // pecah naik-turun (pop/disco/gamelan)
  | "funk16"    // sinkop rapat ke-16
  | "hentak";   // hentak 1 & 2½ (dangdut)

export interface IringGenre {
  /** pola drum utama */
  drum: PolaLayer;
  bass: GayaBass;
  comp: GayaComp;
  /** alat komping (akor) */
  compIns: InsNada;
  /** alat lead pemain MELODI BARU (buatMelodiBaru) */
  lead: InsNada;
  /** 0–0.33 keterlambatan off-beat (feel swing/jazz) */
  swing: number;
  /** geser oktaf bass (metal = lebih dalam) */
  oktBass: number;
  gDrum: number;
  gBass: number;
  gComp: number;
  gLead: number;
  /** v0.12.0 — perkusi tambahan khas genre */
  perkusi?: "tabla" | "shaker";
  /** v0.12.0 — alat dekorasi melodi (hiasan khas, mis. sitar utk dangdut) */
  dekorasi?: InsNada;
}

export const IRING_GENRE: Record<GenreMusik, IringGenre> = {
  pop:       { drum: "pop",     bass: "delapan",  comp: "arpeggio", compIns: "piano", lead: "piano",  swing: 0,    oktBass: 0,  gDrum: 0.6,  gBass: 0.55, gComp: 0.4,  gLead: 0.42 },
  rock:      { drum: "rock",    bass: "delapan",  comp: "punch",    compIns: "saw",   lead: "saw",    swing: 0,    oktBass: 0,  gDrum: 0.68, gBass: 0.6,  gComp: 0.4,  gLead: 0.45 },
  punk:      { drum: "rock",    bass: "delapan",  comp: "punch",    compIns: "saw",   lead: "saw",    swing: 0,    oktBass: 0,  gDrum: 0.7,  gBass: 0.62, gComp: 0.46, gLead: 0.5 },
  metal:     { drum: "rock",    bass: "delapan",  comp: "punch",    compIns: "saw",   lead: "saw",    swing: 0,    oktBass: -1, gDrum: 0.7,  gBass: 0.66, gComp: 0.44, gLead: 0.48 },
  jazz:      { drum: "slap",    bass: "jalan",    comp: "swing",    compIns: "piano", lead: "orgel",  swing: 0.26, oktBass: 0,  gDrum: 0.5,  gBass: 0.5,  gComp: 0.34, gLead: 0.4 },
  blues:     { drum: "slap",    bass: "jalan",    comp: "swing",    compIns: "piano", lead: "orgel",  swing: 0.3,  oktBass: 0,  gDrum: 0.52, gBass: 0.52, gComp: 0.36, gLead: 0.42 },
  reggae:    { drum: "onedrop", bass: "reggae",   comp: "skank",    compIns: "pluk",  lead: "orgel",  swing: 0.06, oktBass: 0,  gDrum: 0.6,  gBass: 0.66, gComp: 0.4,  gLead: 0.36 },
  ska:       { drum: "skank",   bass: "jalan",    comp: "skank",    compIns: "pluk",  lead: "brass",  swing: 0.12, oktBass: 0,  gDrum: 0.62, gBass: 0.55, gComp: 0.46, gLead: 0.44, perkusi: "shaker" },
  dangdut:   { drum: "dangdut", bass: "dangdut",  comp: "hentak",   compIns: "orgel", lead: "flute",  swing: 0.04, oktBass: 0,  gDrum: 0.66, gBass: 0.6,  gComp: 0.36, gLead: 0.5,  perkusi: "tabla", dekorasi: "sitar" },
  edm:       { drum: "disco",   bass: "pump",     comp: "pad",      compIns: "saw",   lead: "saw",    swing: 0,    oktBass: -1, gDrum: 0.72, gBass: 0.68, gComp: 0.34, gLead: 0.44, perkusi: "shaker" },
  hiphop:    { drum: "boombap", bass: "sub",      comp: "pad",      compIns: "piano", lead: "piano",  swing: 0.16, oktBass: 0,  gDrum: 0.66, gBass: 0.7,  gComp: 0.3,  gLead: 0.36 },
  funk:      { drum: "pop",     bass: "funk",     comp: "funk16",   compIns: "pluk",  lead: "brass",  swing: 0.14, oktBass: 0,  gDrum: 0.62, gBass: 0.66, gComp: 0.42, gLead: 0.46 },
  disco:     { drum: "disco",   bass: "pump",     comp: "arpeggio", compIns: "piano", lead: "bell",   swing: 0,    oktBass: 0,  gDrum: 0.66, gBass: 0.62, gComp: 0.4,  gLead: 0.44, perkusi: "shaker" },
  keroncong: { drum: "slap",    bass: "rootlima", comp: "strum",    compIns: "pluk",  lead: "flute",  swing: 0.05, oktBass: 0,  gDrum: 0.42, gBass: 0.5,  gComp: 0.44, gLead: 0.46 },
  country:   { drum: "slap",    bass: "rootlima", comp: "strum",    compIns: "pluk",  lead: "pluk",   swing: 0.1,  oktBass: 0,  gDrum: 0.5,  gBass: 0.52, gComp: 0.44, gLead: 0.44 },
  lofi:      { drum: "vinyl",   bass: "sub",      comp: "pad",      compIns: "piano", lead: "piano",  swing: 0.18, oktBass: 0,  gDrum: 0.5,  gBass: 0.6,  gComp: 0.3,  gLead: 0.34 },
  gamelan:   { drum: "gamelan", bass: "rootlima", comp: "arpeggio", compIns: "saron", lead: "saron",  swing: 0,    oktBass: 0,  gDrum: 0.55, gBass: 0.42, gComp: 0.36, gLead: 0.52 },
};

// ============ PARSER CHORD ============

const SEMITONE: Record<string, number> = {
  C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5, "F#": 6,
  Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11,
};

/** "Am" → { root: 9, minor: true }; "F#" → { root: 6, minor: false }; null bila tak dikenal */
export function parseChord(nama: string): { root: number; minor: boolean } | null {
  const m = /^([A-G](?:#|b)?)(m?)$/.exec((nama || "").trim());
  if (!m || !(m[1] in SEMITONE)) return null;
  return { root: SEMITONE[m[1]], minor: m[2] === "m" };
}

// ============ v0.12.0 — GAYA MELODI PER GENRE (pencipta musik baru) ============

export interface GayaMelodi {
  /** geser oktaf register lead (1 = sekitar C5, cocok seruling/tembaga) */
  okt: number;
  /** tangga nada — semitone dari AKAR CHORD (nadanya berpindah mengikuti chord) */
  tangga: number[];
  /** pola ritme 1 bar: [posisi ketuk, panjang ketuk] — dikombinasikan dgn motif 4 bar */
  ritme: [number, number][];
  /** ornamen grace-note khas (dangdut/blues/keroncong) */
  ornamen: boolean;
  /** 0..1 — kecenderungan lompatan nada (0 = melata selangkah, 1 = liar) */
  lompat: number;
}

export const MELODI_GENRE: Record<GenreMusik, GayaMelodi> = {
  pop:       { okt: 1, tangga: [0, 2, 4, 7, 9],      ritme: [[0, 1], [1, 0.5], [2, 1], [3, 0.5], [3.5, 0.5]], ornamen: false, lompat: 0.25 },
  rock:      { okt: 1, tangga: [0, 3, 5, 7, 10],     ritme: [[0, 0.5], [1, 0.5], [2, 0.5], [2.5, 0.5], [3, 1]], ornamen: false, lompat: 0.35 },
  punk:      { okt: 1, tangga: [0, 3, 5, 7, 10],     ritme: [[0, 0.5], [0.5, 0.5], [1, 0.5], [1.5, 0.5], [2, 0.5], [2.5, 0.5], [3, 0.5], [3.5, 0.5]], ornamen: false, lompat: 0.3 },
  metal:     { okt: 0, tangga: [0, 2, 3, 5, 7, 8, 10], ritme: [[0, 0.5], [0.5, 0.5], [1, 0.5], [2, 0.5], [2.5, 0.5], [3, 0.5], [3.5, 0.5]], ornamen: false, lompat: 0.3 },
  jazz:      { okt: 1, tangga: [0, 2, 4, 5, 7, 9, 11], ritme: [[0, 0.5], [1, 0.5], [1.5, 0.5], [2, 0.5], [3, 0.5], [3.5, 0.5]], ornamen: false, lompat: 0.5 },
  blues:     { okt: 1, tangga: [0, 3, 5, 6, 7, 10],  ritme: [[0, 0.75], [1, 0.25], [1.5, 0.5], [2, 0.75], [3, 0.5], [3.5, 0.5]], ornamen: true, lompat: 0.4 },
  reggae:    { okt: 1, tangga: [0, 3, 5, 7, 10],     ritme: [[0.5, 0.5], [1.5, 0.5], [2.75, 0.25], [3.5, 0.75]], ornamen: false, lompat: 0.3 },
  ska:       { okt: 1, tangga: [0, 2, 4, 7, 9],      ritme: [[0, 0.25], [0.5, 0.25], [1, 0.5], [1.5, 0.5], [2, 0.25], [2.5, 0.25], [3, 0.25], [3.5, 0.5]], ornamen: false, lompat: 0.45 },
  dangdut:   { okt: 1, tangga: [0, 2, 4, 7, 9],      ritme: [[0, 0.5], [0.5, 0.25], [0.75, 0.25], [1, 0.5], [1.5, 0.5], [2, 0.5], [2.5, 0.25], [2.75, 0.25], [3, 0.5], [3.5, 0.5]], ornamen: true, lompat: 0.35 },
  edm:       { okt: 1, tangga: [0, 3, 5, 7, 10],     ritme: [[0, 0.25], [0.25, 0.25], [0.5, 0.25], [0.75, 0.25], [2, 0.25], [2.25, 0.25], [2.5, 0.25], [2.75, 0.25]], ornamen: false, lompat: 0.4 },
  hiphop:    { okt: 0, tangga: [0, 3, 5, 7, 10],     ritme: [[0, 0.75], [1.5, 0.5], [2, 0.5], [3.25, 0.25], [3.5, 0.5]], ornamen: false, lompat: 0.4 },
  funk:      { okt: 1, tangga: [0, 3, 5, 7, 10],     ritme: [[0, 0.25], [0.375, 0.25], [0.75, 0.25], [1.5, 0.25], [2, 0.25], [2.375, 0.25], [3, 0.5], [3.5, 0.5]], ornamen: false, lompat: 0.45 },
  disco:     { okt: 1, tangga: [0, 2, 4, 7, 9],      ritme: [[0, 0.5], [1, 0.5], [1.5, 0.5], [2, 0.5], [2.5, 0.5], [3, 0.5], [3.5, 0.5]], ornamen: false, lompat: 0.5 },
  keroncong: { okt: 1, tangga: [0, 2, 4, 5, 7, 9, 11], ritme: [[0, 0.5], [1, 1], [2, 0.5], [3, 1]], ornamen: true, lompat: 0.3 },
  country:   { okt: 1, tangga: [0, 2, 4, 7, 9],      ritme: [[0, 0.5], [0.5, 0.5], [1, 0.5], [2, 0.5], [2.5, 0.5], [3, 0.5], [3.5, 0.5]], ornamen: false, lompat: 0.35 },
  lofi:      { okt: 0, tangga: [0, 3, 5, 7, 10],     ritme: [[0, 1], [2, 1], [3, 1]], ornamen: false, lompat: 0.25 },
  gamelan:   { okt: 0, tangga: [0, 2, 5, 7, 9],      ritme: [[0, 1], [1, 1], [2, 1], [3, 1]], ornamen: false, lompat: 0.2 },
};

// PRNG deterministik (mulberry32) — melodi sama utk lagu sama, berganti dgn "variasi"
function mulberry32(benih: number): () => number {
  let a = benih >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

const bulat = (n: number, k = 3) => Math.round(n * 10 ** k) / 10 ** k;

/**
 * CIPTAKAN MELODI BARU dari progresi chord lagu asli (v0.12.0).
 * Bukan menyalin melodi asli — nada diambil dari nada-nada CHORD (akar/ters/kvint/oktaf)
 * + tangga nada khas genre, dijalin motif 4 ketuk yang berulang-berubah, ritme khas
 * genre, ornamen grace-note, dan register lead. Deterministik: lagu sama + variasi
 * sama = melodi sama; tombol "Variasikan" mengganti benih → melodi baru.
 */
export function buatMelodiBaru(a: KtxIring, genre: GenreMusik, variasi = 0): CatatanMelodi[] {
  const gaya = MELODI_GENRE[genre];
  const iring = IRING_GENRE[genre];
  const bpm = Math.min(220, Math.max(50, a.bpm || 120));
  const spb = 60 / bpm;
  const durasi = Math.max(1, a.durasi);
  const rng = mulberry32(hashString(
    `${a.bpm}|${a.fase}|${a.durasi}|${a.chord.map((c) => c.chord).join(",")}|${genre}|v${variasi}`,
  ));
  const base = FREQ_C4 * Math.pow(2, gaya.okt);
  const tPos = (bar: number, pos: number): number => {
    const fraksi = pos - Math.floor(pos);
    const off = Math.abs(fraksi - 0.5) < 1e-6;
    return (bar * 4 + pos) * spb + (a.fase || 0) + (off ? iring.swing * 0.5 * spb : 0);
  };
  const chordPada = (t: number): { root: number; minor: boolean } => {
    const seg =
      a.chord.find((c) => t >= c.mulai - 0.02 && t < c.mulai + c.durasi) ||
      a.chord[a.chord.length - 1];
    return parseChord(seg?.chord || "C") || { root: 0, minor: false };
  };
  // nada akor utk derajat 0..4: akar, ters, kvint, oktaf, oktaf+kvint
  const nadaDerajat = (minor: boolean, deg: number): number =>
    (minor ? [0, 3, 7, 12, 19] : [0, 4, 7, 12, 19])[Math.max(0, Math.min(4, deg))];

  const nBar = Math.ceil(durasi / (spb * 4)) + 1;
  const catatan: CatatanMelodi[] = [];
  let nadaPrev = 0; // semitone offset dari akar chord saat ini

  for (let bar = 0; bar < nBar; bar++) {
    const tBar = bar * 4 * spb + (a.fase || 0);
    if (tBar > durasi + 0.2) break;
    const c = chordPada(tBar);
    // motif 4 bar: derajat nada per slot (regenerated tiap siklus — variasi dalam kesatuan)
    const motif = gaya.ritme.map(([pos]) => {
      const kuat = Number.isInteger(pos); // ketukan penuh = wajib nada akor
      if (kuat) return { kuat, deg: Math.floor(rng() * 5) };
      // nada sambung dari tangga nada (indeks disimpan; dipilih dekat nada sebelumnya)
      return { kuat, deg: Math.floor(rng() * gaya.tangga.length * 2) };
    });
    for (let i = 0; i < gaya.ritme.length; i++) {
      const [pos, len] = gaya.ritme[i];
      const t = tPos(bar, pos);
      if (t < -0.05 || t > durasi + 0.2) continue;
      let semit: number;
      if (motif[i].kuat) {
        semit = nadaDerajat(c.minor, motif[i].deg);
        nadaPrev = semit;
      } else {
        // sambungan: nada tangga terdekat dari nada sebelumnya (arah acak, jarang lompat)
        const kandidat = gaya.tangga.concat(gaya.tangga.map((s) => s + 12));
        const arah = rng() < 0.5 ? -1 : 1;
        const lompatMaks = 2 + Math.round(gaya.lompat * 5 * rng());
        let terbaik = kandidat[0];
        let jarakTerbaik = 1e9;
        for (const k of kandidat) {
          const jarak = Math.abs(k - nadaPrev);
          if (jarak <= lompatMaks && jarak < jarakTerbaik) { jarakTerbaik = jarak; terbaik = k; }
        }
        semit = terbaik;
        nadaPrev = semit;
      }
      semit = Math.max(-4, Math.min(16, semit)); // jaga register
      const f0 = base * Math.pow(2, c.root / 12) * Math.pow(2, semit / 12);
      const f = Math.min(1975, Math.max(130, f0));
      const d = Math.min(8, Math.max(0.06, len * spb * 0.92));
      const g = Math.min(1, 0.52 + 0.22 * rng() + (motif[i].kuat ? 0.14 : 0));
      catatan.push({ t: bulat(t), d: bulat(d), f: bulat(f, 2), g: bulat(g, 2) });
      // ornamen: grace note khas genre — turun 2 semitone, nyaris bersamaan
      if (gaya.ornamen && motif[i].kuat && pos % 2 === 0 && rng() < 0.55 && t > 0.08) {
        catatan.push({
          t: bulat(t - 0.07), d: 0.06,
          f: bulat(f * Math.pow(2, -2 / 12), 2), g: bulat(g * 0.5, 2),
        });
      }
    }
  }
  return catatan.slice(0, 6000);
}

// ============ RENDER IRINGAN PENUH ============

export interface KtxIring {
  bpm: number;
  /** fase beat pertama (detik) dari analisis */
  fase: number;
  durasi: number;
  chord: SegmenChord[];
  melodi?: CatatanMelodi[];
}

export interface OpsiIring {
  /** 0..1 intensitas drum+bass+akor */
  groove: number;
  /** 0..1 level MELODI BARU (diciptakan dari chord — bukan melodi asli) */
  melodi: number;
  /** 0..1 (v0.12.0, opsional) melodi ASLI lagu dipakai sbg pegangan — bawaan 0 */
  melodiAsli?: number;
  /** v0.12.0 — angka variasi utk melodi baru (tombol "Variasikan") */
  variasi?: number;
}

/** Render MUSIK BARU khas genre → WAV PCM16 stereo 44100 Hz sepanjang durasi+ekor.
 *  Semua instrumen mengikuti BPM, fasa, dan progresi chord lagu asli; melodinya
 *  DICPTAKAN dari chord (buatMelodiBaru). Audio asli TIDAK ikut sama sekali. */
export function buatIringanWav(a: KtxIring, genre: GenreMusik, opsi: OpsiIring): Buffer {
  const iring = IRING_GENRE[genre];
  const bpm = Math.min(220, Math.max(50, a.bpm || 120));
  const spb = 60 / bpm; // detik per ketuk
  const durasi = Math.max(1, a.durasi);
  const totalN = Math.ceil((durasi + 1.2) * LAJU) * 2; // stereo interleaved
  const campur = new Float32Array(totalN);
  const groove = Math.min(1, Math.max(0, opsi.groove));
  const melodiLv = Math.min(1, Math.max(0, opsi.melodi));
  const melodiAsliLv = Math.min(1, Math.max(0, opsi.melodiAsli ?? 0));

  // posisi waktu dgn swing: off-beat ke-8 digeser utk feel jazz/blues/hiphop
  const tPos = (bar: number, pos: number): number => {
    const fraksi = pos - Math.floor(pos);
    const off = Math.abs(fraksi - 0.5) < 1e-6;
    return (bar * 4 + pos) * spb + (a.fase || 0) + (off ? iring.swing * 0.5 * spb : 0);
  };

  // chord aktif pada detik t (fallback ke chord terakhir / C)
  const chordPada = (t: number): { root: number; minor: boolean; f: number } => {
    const seg =
      a.chord.find((c) => t >= c.mulai - 0.02 && t < c.mulai + c.durasi) ||
      a.chord[a.chord.length - 1];
    const p = parseChord(seg?.chord || "C") || { root: 0, minor: false };
    return {
      root: p.root,
      minor: p.minor,
      f: FREQ_C2 * Math.pow(2, p.root / 12) * Math.pow(2, iring.oktBass),
    };
  };
  // nada-nada akor (akar/ters/kvint/oktaf) di oktaf 4
  const nadaChord = (c: { root: number; minor: boolean }, okt = 0): number[] => {
    const off = c.minor ? [0, 3, 7, 12] : [0, 4, 7, 12];
    const f0 = FREQ_C4 * Math.pow(2, c.root / 12) * Math.pow(2, okt);
    return off.map((o) => f0 * Math.pow(2, o / 12));
  };

  // cache sampel biar cepat (kunci: jenis + freq + durasi + gain)
  const cache = new Map<string, Float32Array>();
  const ambilNada = (ins: InsNada, f: number, d: number, g: number): Float32Array => {
    const kunci = `n:${ins}:${f.toFixed(1)}:${d.toFixed(2)}:${g.toFixed(2)}`;
    let s = cache.get(kunci);
    if (!s) { s = nadaIns(ins, f, d, g); cache.set(kunci, s); }
    return s;
  };
  const ambilDrum = (ins: Instrumen, g: number, f: number): Float32Array => {
    const kunci = `d:${ins}:${g.toFixed(2)}:${f.toFixed(1)}`;
    let s = cache.get(kunci);
    if (!s) { s = sampel(ins, g, f); cache.set(kunci, s); }
    return s;
  };

  const nBar = Math.ceil(durasi / (spb * 4)) + 1;

  // ===== 1) DRUM — pola khas genre, sejajar beat asli + fill tiap 8 bar =====
  for (let bar = 0; bar < nBar; bar++) {
    const intro = bar < 2 ? 0.72 : 1; // pembukaan sedikit lebih lembut
    for (const ev of polaBar(iring.drum, bar)) {
      const t = tPos(bar, ev.pos);
      if (t < 0 || t > durasi + 0.4) continue;
      tulisKeBufor(campur, ambilDrum(ev.ins, ev.gain * iring.gDrum * groove * intro, ev.f || 330), t);
    }
    // v0.12.0 — FILL: rentetan 16 dtk di akhir tiap bar ke-8 (transisi antarbagian)
    if (nBar > 8 && bar % 8 === 7) {
      const insFill: Instrumen =
        iring.drum === "dangdut" || iring.drum === "gamelan" ? "tak" : "snare";
      [3, 3.25, 3.5, 3.75].forEach((p, i) => {
        const t = tPos(bar, p);
        if (t < 0 || t > durasi + 0.4) return;
        tulisKeBufor(campur, ambilDrum(insFill, (0.42 + i * 0.11) * iring.gDrum * groove, 330), t);
      });
    }
  }

  // ===== 2) BASS — mengikuti akar chord asli, gaya khas genre =====
  const nadaBass = (t: number, f: number, d: number, g: number) => {
    if (t < 0 || t > durasi + 0.3) return;
    const ins: InsNada = iring.bass === "sub" ? "sub" : "bass";
    tulisKeBufor(campur, ambilNada(ins, f, d, g * iring.gBass * groove), t);
  };
  for (let bar = 0; bar < nBar; bar++) {
    const tBar = bar * 4 * spb + (a.fase || 0);
    const c = chordPada(tBar);
    const root = c.f;
    const kvint = c.f * Math.pow(2, 7 / 12);
    const okt = c.f * 2;
    switch (iring.bass) {
      case "delapan":
        for (let i = 0; i < 8; i++) {
          nadaBass(tPos(bar, i * 0.5), i === 7 ? okt : root, spb * 0.42, 1);
        }
        break;
      case "rootlima":
        nadaBass(tBar, root, spb * 1.8, 1);
        nadaBass(tBar + spb * 2, kvint, spb * 1.8, 0.9);
        break;
      case "jalan": {
        const ters = root * Math.pow(2, (c.minor ? 3 : 4) / 12);
        nadaBass(tBar, root, spb * 0.9, 1);
        nadaBass(tBar + spb, ters, spb * 0.9, 0.8);
        nadaBass(tBar + spb * 2, kvint, spb * 0.9, 0.9);
        // nada penuntun menuju akar chord bar berikutnya
        const c2 = chordPada(tBar + spb * 4);
        const dekat = c2.f > root
          ? c2.f * Math.pow(2, -1 / 12)
          : c2.f * Math.pow(2, 1 / 12);
        nadaBass(tBar + spb * 3, dekat, spb * 0.9, 0.85);
        break;
      }
      case "reggae":
        nadaBass(tBar, root, spb * 2.6, 1);
        nadaBass(tBar + spb * 2.75, root, spb * 0.9, 0.8);
        break;
      case "pump":
        for (let i = 0; i < 8; i++) {
          nadaBass(tPos(bar, i * 0.5), i === 5 ? okt : root, spb * 0.4, i % 2 === 0 ? 1 : 0.75);
        }
        break;
      case "dangdut":
        nadaBass(tBar, root, spb * 1.2, 1);
        nadaBass(tBar + spb * 1.5, root, spb * 0.4, 0.8);
        nadaBass(tBar + spb * 2, kvint, spb * 1.2, 0.95);
        nadaBass(tBar + spb * 3.5, okt, spb * 0.4, 0.85);
        break;
      case "sub":
        nadaBass(tBar, root, spb * 3.8, 1);
        break;
      case "funk":
        nadaBass(tBar, root, spb * 0.35, 1);
        nadaBass(tBar + spb * 0.75, root, spb * 0.3, 0.7);
        nadaBass(tBar + spb * 1.5, okt, spb * 0.3, 0.8);
        nadaBass(tBar + spb * 2.5, root, spb * 0.35, 0.95);
        nadaBass(tBar + spb * 3.25, kvint, spb * 0.3, 0.75);
        break;
    }
  }

  // ===== 3) AKOR / KOMPING — mengikuti progresi chord asli =====
  const akor = (t: number, freqs: number[], d: number, g: number) => {
    if (t < 0 || t > durasi + 0.3) return;
    for (const f of freqs) {
      tulisKeBufor(campur, ambilNada(iring.compIns, f, d, g / Math.sqrt(freqs.length) * iring.gComp * groove), t);
    }
  };
  for (let bar = 0; bar < nBar; bar++) {
    const tBar = bar * 4 * spb + (a.fase || 0);
    const c = chordPada(tBar);
    const freqs = nadaChord(c);
    switch (iring.comp) {
      case "skank":
        for (const p of [0.5, 1.5, 2.5, 3.5]) akor(tPos(bar, p), freqs.slice(0, 3), spb * 0.16, 1);
        break;
      case "strum":
        for (let i = 0; i < 8; i++) {
          akor(tPos(bar, i * 0.5), freqs.slice(0, 3), spb * 0.34, i % 2 === 0 ? 0.9 : 0.6);
        }
        break;
      case "pad":
        akor(tBar, freqs, Math.min(spb * 4, 8), 0.8);
        break;
      case "swing":
        akor(tPos(bar, 1), freqs.slice(0, 3), spb * 0.5, 0.9);
        akor(tPos(bar, 3), freqs.slice(0, 3), spb * 0.5, 0.9);
        break;
      case "punch": // akor tenaga: akar + kvint saja
        for (const p of [0, 1, 2, 3]) akor(tPos(bar, p), [freqs[0], freqs[2]], spb * 0.2, 1);
        break;
      case "arpeggio": {
        const urut = [freqs[0], freqs[1], freqs[2], freqs[3], freqs[2], freqs[1]];
        for (let i = 0; i < 8; i++) akor(tPos(bar, i * 0.5), [urut[i % 6]], spb * 0.4, 0.85);
        break;
      }
      case "funk16":
        for (const p of [0, 0.375, 0.75, 1.5, 2, 2.375, 2.75, 3.5]) {
          akor(tPos(bar, p), freqs.slice(0, 3), spb * 0.14, 0.9);
        }
        break;
      case "hentak":
        akor(tBar, freqs.slice(0, 3), spb * 0.5, 0.95);
        akor(tPos(bar, 2.5), freqs.slice(0, 3), spb * 0.5, 0.8);
        break;
    }
  }

  // ===== 4) MELODI BARU — DICPTAKAN dari chord lagu asli (bukan disalin) =====
  if (melodiLv > 0) {
    const baru = buatMelodiBaru(a, genre, opsi.variasi ?? 0);
    for (const n of baru) {
      tulisKeBufor(campur, ambilNada(iring.lead, n.f, n.d, n.g * iring.gLead * melodiLv * 1.15), n.t);
    }
  }

  // ===== 4b) MELODI ASLI (opsional) — jalur pitch lagu asli sbg pegangan =====
  if (melodiAsliLv > 0 && Array.isArray(a.melodi)) {
    for (const n of a.melodi) {
      const d = Math.min(4, Math.max(0.08, n.d));
      const g = n.g * iring.gLead * melodiAsliLv * 1.15;
      if (g <= 0.01) continue;
      tulisKeBufor(campur, ambilNada(iring.lead, n.f, d, g), n.t);
    }
  }

  // ===== 5) PERKUSI EKSTRA khas genre (v0.12.0 — rasa genre makin kental) =====
  if (iring.perkusi) {
    for (let bar = 0; bar < nBar; bar++) {
      if (iring.perkusi === "tabla") {
        // teka-teki dadra India — dengung dha & kringan tin: rasa Bollywood-dangdut
        const polaTabla: [number, number, number][] = [
          [0, 95, 1], [0.5, 520, 0.55], [1, 520, 0.65], [1.5, 95, 0.85],
          [2, 95, 1], [2.5, 520, 0.55], [3, 520, 0.65], [3.5, 95, 0.7],
        ];
        for (const [p, f, g] of polaTabla) {
          const t = tPos(bar, p);
          if (t < 0 || t > durasi + 0.4) continue;
          tulisKeBufor(campur, ambilDrum("tabla", g * 0.5 * iring.gDrum * groove, f), t);
        }
      } else {
        // shaker: desis 8 dtk lembut (ska/edm/disco)
        for (let i = 0; i < 8; i++) {
          const t = tPos(bar, i * 0.5);
          if (t < 0 || t > durasi + 0.4) continue;
          tulisKeBufor(campur, ambilDrum("shaker", (i % 2 ? 0.32 : 0.22) * iring.gDrum * groove, 0), t);
        }
      }
    }
  }

  // ===== 6) DEKORASI MELODI khas genre (v0.12.0 — mis. sitar India utk dangdut) =====
  if (iring.dekorasi) {
    for (let bar = 0; bar < nBar; bar++) {
      const tBar = bar * 4 * spb + (a.fase || 0);
      const c = chordPada(tBar);
      const fRoot = FREQ_C4 * Math.pow(2, c.root / 12) * 2; // oktaf atas wilayah akor
      const fKvint = fRoot * Math.pow(2, 7 / 12);
      const hias: [number, number, number][] = [
        [0.75, fRoot, 0.3], [1.75, fKvint, 0.24], [2.75, fRoot, 0.26], [3.5, fKvint, 0.2],
      ];
      for (const [p, f, g] of hias) {
        const t = tPos(bar, p);
        if (t < 0 || t > durasi + 0.3) continue;
        tulisKeBufor(campur, ambilNada(iring.dekorasi, f, spb * 0.6, g * iring.gComp * groove), t);
      }
    }
  }

  // v0.13.0 — reverb studio halus: tidak lagi kering mengklik (bunyi "nut-nut" berkurang)
  beriReverb(campur, 0.16);
  return wavDariFloat(campur);
}
