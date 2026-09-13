// VidSplit v0.11.0 — MESIN TRANSFORMASI GENRE PENUH.
// Inilah jawaban atas "musik asli masih belum berubah, hanya ditambah layer":
// di mode PENUH, iringan asli DITINGGALKAN SEPENUHNYA. Seluruh iringan baru
// disintesis di sini dari hasil ANALISIS lagu asli sebagai referensi:
//   • DRUM   : pola ritme khas genre mengikuti BPM & fase beat asli
//   • BASS   : garis bass mengikuti AKAR CHORD hasil deteksi chromagram
//   • AKOR   : komping/pad/arpeggio mengikuti progresi chord asli
//   • MELODI : jalur melodi utama lagu asli (ekstraksi pitch) dimainkan ulang
//              oleh alat lead khas genre (flute dangdut, saron gamelan, saw rock, dst.)
// Hasil = lagu yang "sama" (melodi, chord, tempo, struktur) tetapi SELURUH
// instrumennya diganti karakter genre pilihan — 100% offline, JS murni.
import type { GenreMusik, PolaLayer, SegmenChord } from "./musik";
import { LAJU, nadaIns, polaBar, sampel, tulisKeBufor, wavDariFloat, type InsNada, type Instrumen } from "./musikLayer";
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
  /** alat lead pemain melodi asli */
  lead: InsNada;
  /** 0–0.33 keterlambatan off-beat (feel swing/jazz) */
  swing: number;
  /** geser oktaf bass (metal = lebih dalam) */
  oktBass: number;
  gDrum: number;
  gBass: number;
  gComp: number;
  gLead: number;
}

export const IRING_GENRE: Record<GenreMusik, IringGenre> = {
  pop:       { drum: "pop",     bass: "delapan",  comp: "arpeggio", compIns: "piano", lead: "piano",  swing: 0,    oktBass: 0,  gDrum: 0.6,  gBass: 0.55, gComp: 0.4,  gLead: 0.42 },
  rock:      { drum: "rock",    bass: "delapan",  comp: "punch",    compIns: "saw",   lead: "saw",    swing: 0,    oktBass: 0,  gDrum: 0.68, gBass: 0.6,  gComp: 0.4,  gLead: 0.45 },
  punk:      { drum: "rock",    bass: "delapan",  comp: "punch",    compIns: "saw",   lead: "saw",    swing: 0,    oktBass: 0,  gDrum: 0.7,  gBass: 0.62, gComp: 0.46, gLead: 0.5 },
  metal:     { drum: "rock",    bass: "delapan",  comp: "punch",    compIns: "saw",   lead: "saw",    swing: 0,    oktBass: -1, gDrum: 0.7,  gBass: 0.66, gComp: 0.44, gLead: 0.48 },
  jazz:      { drum: "slap",    bass: "jalan",    comp: "swing",    compIns: "piano", lead: "orgel",  swing: 0.26, oktBass: 0,  gDrum: 0.5,  gBass: 0.5,  gComp: 0.34, gLead: 0.4 },
  blues:     { drum: "slap",    bass: "jalan",    comp: "swing",    compIns: "piano", lead: "orgel",  swing: 0.3,  oktBass: 0,  gDrum: 0.52, gBass: 0.52, gComp: 0.36, gLead: 0.42 },
  reggae:    { drum: "onedrop", bass: "reggae",   comp: "skank",    compIns: "pluk",  lead: "orgel",  swing: 0.06, oktBass: 0,  gDrum: 0.6,  gBass: 0.66, gComp: 0.4,  gLead: 0.36 },
  ska:       { drum: "skank",   bass: "jalan",    comp: "skank",    compIns: "pluk",  lead: "orgel",  swing: 0.12, oktBass: 0,  gDrum: 0.62, gBass: 0.55, gComp: 0.46, gLead: 0.4 },
  dangdut:   { drum: "dangdut", bass: "dangdut",  comp: "hentak",   compIns: "orgel", lead: "flute",  swing: 0.04, oktBass: 0,  gDrum: 0.66, gBass: 0.6,  gComp: 0.36, gLead: 0.5 },
  edm:       { drum: "disco",   bass: "pump",     comp: "pad",      compIns: "saw",   lead: "saw",    swing: 0,    oktBass: -1, gDrum: 0.72, gBass: 0.68, gComp: 0.34, gLead: 0.44 },
  hiphop:    { drum: "boombap", bass: "sub",      comp: "pad",      compIns: "piano", lead: "piano",  swing: 0.16, oktBass: 0,  gDrum: 0.66, gBass: 0.7,  gComp: 0.3,  gLead: 0.36 },
  funk:      { drum: "pop",     bass: "funk",     comp: "funk16",   compIns: "pluk",  lead: "pluk",   swing: 0.14, oktBass: 0,  gDrum: 0.62, gBass: 0.66, gComp: 0.42, gLead: 0.46 },
  disco:     { drum: "disco",   bass: "pump",     comp: "arpeggio", compIns: "piano", lead: "bell",   swing: 0,    oktBass: 0,  gDrum: 0.66, gBass: 0.62, gComp: 0.4,  gLead: 0.44 },
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
  /** 0..1 level melodi asli dgn alat lead */
  melodi: number;
}

/** Render iringan genre PENUH → WAV PCM16 stereo 44100 Hz sepanjang durasi+ekor.
 *  Semua instrumen mengikuti BPM, fase, progresi chord, dan melodi lagu asli. */
export function buatIringanWav(a: KtxIring, genre: GenreMusik, opsi: OpsiIring): Buffer {
  const iring = IRING_GENRE[genre];
  const bpm = Math.min(220, Math.max(50, a.bpm || 120));
  const spb = 60 / bpm; // detik per ketuk
  const durasi = Math.max(1, a.durasi);
  const totalN = Math.ceil((durasi + 1.2) * LAJU) * 2; // stereo interleaved
  const campur = new Float32Array(totalN);
  const groove = Math.min(1, Math.max(0, opsi.groove));
  const melodiLv = Math.min(1, Math.max(0, opsi.melodi));

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

  // ===== 1) DRUM — pola khas genre, sejajar beat asli =====
  for (let bar = 0; bar < nBar; bar++) {
    for (const ev of polaBar(iring.drum, bar)) {
      const t = tPos(bar, ev.pos);
      if (t < 0 || t > durasi + 0.4) continue;
      tulisKeBufor(campur, ambilDrum(ev.ins, ev.gain * iring.gDrum * groove, ev.f || 330), t);
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

  // ===== 4) MELODI ASLI — dimainkan ulang alat lead khas genre =====
  if (melodiLv > 0 && Array.isArray(a.melodi)) {
    for (const n of a.melodi) {
      const d = Math.min(4, Math.max(0.08, n.d));
      const g = n.g * iring.gLead * melodiLv * 1.15;
      if (g <= 0.01) continue;
      tulisKeBufor(campur, ambilNada(iring.lead, n.f, d, g), n.t);
    }
  }

  return wavDariFloat(campur);
}
