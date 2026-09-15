// VidSplit v0.22.0 — MESIN GANTI INSTRUMEN ("cover genre sejati") utk Menu 2.
// Jawaban "musik aslinya tidak ada yang benar-benar berubah, hanya seperti
// ditambah layer": mode BARU "ganti" membuang SEMUA instrumen asli dan memainkan
// ulang lagunya dgn aransemen baru khas genre — pendekatan industri "style
// transfer via re-arrangement" (diadaptasi dari prinsip Suno utk offline):
//   1. ANALISIS lagu asli → BPM, fasa beat, progresi chord, jalur melodi,
//      dan ENERGI PER BAR (dari profil gelombang) — inilah "referensi".
//   2. INSTRUMEN ASLI DIGANTI TOTAL: drum-kit khas genre (dgn crash/ride/tom,
//      fill transisi, dinamika intro-nadai-klimaks), garis bass gaya genre,
//      komping akor (gitar distorsi power-chord utk rock/metal/punk, strum
//      Karplus-Strong utk country/keroncong, supersaw utk EDM, piano jazz dgn
//      nada-7, stab brass funk, kendang ganda dangdut, saron gamelan, dst.),
//      lead melodi (mengikuti MELODI ASLI sbg acuan, atau melodi baru variasi).
//   3. VOKAL ASLI (stem AI MDX-Net) diletakkan DI ATAS aransemen baru —
//      persis band cover: penyanyi tetap penyanyi itu, bandnya berganti genre.
// 100% offline, JS murni — hanya memakai primitif sintesis musikLayer.ts.
import type { GenreMusik, SegmenChord } from "./musik";
import type { CatatanMelodi } from "./musikAnalisis";
import { parseChord, buatMelodiBaru, type GayaBass } from "./musikTransformasi";
import {
  LAJU, nadaIns, sampel, tulisKeBufor, beriReverb, wavDariFloat,
  type InsNada,
} from "./musikLayer";

const FREQ_C2 = 65.406; // C2 — basis bass
const FREQ_C4 = 261.626; // C4 — basis akor/lead
const DUA_PI = 2 * Math.PI;

// ============ PRNG deterministik ============
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

// ============ SINTESIS DRUM TAMBAHAN (lokal — musikLayer tetap stabil) ============
export type DrumIns =
  | "kick" | "snare" | "hat" | "hatOpen" | "crash" | "ride" | "tom"
  | "tak" | "shaker" | "dung" | "dut" | "gong" | "tabla" | "clap";

/** Sampel drum mono — sebagian delegasi ke musikLayer.sampel, sisanya sintesis lokal. */
export function drumSampel(ins: DrumIns, gain: number, f: number): Float32Array {
  // delegasi ke bank lama bila tersedia
  if (ins === "kick") return sampel("kick", gain, 330);
  if (ins === "snare") return sampel("snare", gain, 330);
  if (ins === "hat") return sampel("hat", gain, 330);
  if (ins === "tak") return sampel("tak", gain, 330);
  if (ins === "shaker") return sampel("shaker", gain, 0);
  if (ins === "gong") return sampel("gong", gain, 0);
  if (ins === "tabla") return sampel("tabla", gain, f || 95);
  if (ins === "dung") return sampel("kendang", gain, 78);
  if (ins === "dut") return sampel("kendang", gain, 165);

  const SR = LAJU;
  const panjang = { hatOpen: 0.34, crash: 1.9, ride: 1.3, tom: 0.5, clap: 0.32 }[ins] ?? 0.3;
  const n = Math.floor(panjang * SR);
  const keluar = new Float32Array(n);
  let acak = (hashString(`${ins}:${gain.toFixed(2)}:${f.toFixed(1)}`) | 1) >>> 0;
  const rand = () => {
    acak = (acak * 1103515245 + 12345) & 0x7fffffff;
    return acak / 0x3fffffff - 1;
  };
  let fasa = 0;
  let hp = 0; // keadaan high-pass satu-titik
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let v = 0;
    switch (ins) {
      case "hatOpen": {
        // seperti hat TR-808 tapi ekor lebih panjang (terbuka)
        let jumlah = 0;
        for (const f0 of [205.3, 304.4, 369.6, 522.7, 540, 800]) {
          jumlah += Math.sign(Math.sin(DUA_PI * f0 * t + f0 * 0.7));
        }
        const metalik = jumlah / 6;
        hp += 0.68 * (metalik - hp);
        v = (metalik - hp) * 1.1 * Math.exp(-t * 11) * Math.min(1, t * 5000);
        break;
      }
      case "crash": {
        // cymbal crash: 8 osilator tak-harmonik + wash derau, luruh panjang
        let jumlah = 0;
        for (const f0 of [320, 458, 541, 636, 722, 875, 1042, 1211]) {
          jumlah += Math.sign(Math.sin(DUA_PI * f0 * t + f0 * 1.3));
        }
        const wash = (rand() - rand()) * 0.5;
        const mentah = jumlah / 8 * 0.7 + wash * 0.45;
        hp += 0.42 * (mentah - hp);
        v = (mentah - hp) * 1.4 * Math.exp(-t * 2.6) * Math.min(1, t * 800);
        break;
      }
      case "ride": {
        // ping ride: denting 2.2 kHz + wash lembut panjang
        const ping = Math.sin(DUA_PI * 2210 * t) * 0.4 + Math.sin(DUA_PI * 2210 * 2.71 * t) * 0.14;
        const wash = (rand() - rand()) * 0.16;
        hp += 0.5 * (ping + wash - hp);
        v = (ping + wash - hp) * Math.exp(-t * 3.2) * Math.min(1, t * 1200);
        break;
      }
      case "tom": {
        // tom drum: sweep pitch turun (f*1.5 → f) dgn dentum
        const fq = f * (1 + 0.5 * Math.exp(-t * 18));
        fasa += (DUA_PI * fq) / SR;
        const pukul = (rand() - rand()) * 0.1 * Math.exp(-t * 80);
        v = (Math.sin(fasa) * 0.92 + Math.sin(fasa * 1.5) * 0.1 + pukul)
          * Math.exp(-t * 7.5) * Math.min(1, t * 1500);
        break;
      }
      case "clap": {
        // handclap: 3 dentum derau beruntun + ekor (gaya ST-224)
        const dentum = (d: number) => Math.exp(-Math.max(0, t - d) * 90) * (t >= d ? 1 : 0);
        const derau = rand() - rand();
        const ekor = Math.exp(-t * 14) * Math.min(1, t * 2000) * 0.5;
        v = (dentum(0) + dentum(0.011) * 0.85 + dentum(0.023) * 0.75) * derau * 0.8 + ekor * derau;
        break;
      }
    }
    keluar[i] = Math.max(-1, Math.min(1, v * gain * 0.85));
  }
  const fade = Math.min(300, n);
  for (let i = 0; i < fade; i++) keluar[n - 1 - i] *= i / fade;
  return keluar;
}

// ============ SINTESIS NADA TAMBAHAN (alat khas genre) ============

/** GITAR DISTORSI POWER CHORD — akar + kvint + oktaf, pasang gergaji detune
 *  ±0.7%, waveshaper tanh (krunch), low-pass satu-titik ~3.2 kHz. Inilah
 *  "genggeman gitar nge-rock" yang diminta user. */
function gitarPower(f: number, durasi: number, gain: number): Float32Array {
  const SR = LAJU;
  const d = Math.min(4, Math.max(0.05, durasi));
  const n = Math.ceil(d * SR);
  const keluar = new Float32Array(n);
  const ff = Math.min(1100, Math.max(55, f));
  const det = 1.007; // detune pasangan osilator
  const fask = [ff / det, ff * det, (ff * 1.4983) / det, ff * 1.4983 * det, ff * 2].map((x) => ({ f: x, p: 0 }));
  let lp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let jumlah = 0;
    for (const os of fask) {
      os.p += (DUA_PI * os.f) / SR;
      jumlah += Math.sin(os.p) + 0.22 * Math.sin(os.p * 2);
    }
    jumlah /= fask.length;
    const krunch = Math.tanh(jumlah * 2.6); // distorsi lembut
    lp += 0.24 * (krunch - lp); // redam tajam >3 kHz
    const env = Math.min(1, t / 0.004) * (0.62 + 0.38 * Math.exp(-t * 3.4));
    const sisa = d - t;
    keluar[i] = Math.max(-1, Math.min(1, lp * env * gain * Math.min(1, sisa / 0.03) * 0.9));
  }
  return keluar;
}

/** SUPERSAW — 7 gergaji detune lebar + saturasi; ledakan EDM klasik. */
function supersaw(f: number, durasi: number, gain: number): Float32Array {
  const SR = LAJU;
  const d = Math.min(8, Math.max(0.05, durasi));
  const n = Math.ceil(d * SR);
  const keluar = new Float32Array(n);
  const ff = Math.min(4200, Math.max(40, f));
  const det = [-0.011, -0.006, -0.002, 0, 0.002, 0.006, 0.011];
  const os = det.map((x) => ({ f: ff * (1 + x), p: (x * 1e4) % DUA_PI }));
  let lp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let jumlah = 0;
    for (const o of os) {
      o.p += (DUA_PI * o.f) / SR;
      // gergaji kasar: naik-linear antar periode
      jumlah += ((o.p / DUA_PI) % 1) * 2 - 1;
    }
    jumlah /= os.length;
    lp += 0.34 * (jumlah - lp);
    const attack = Math.min(1, t / 0.025);
    const env = attack * (0.55 + 0.45 * Math.exp(-t * 1.8));
    const sisa = d - t;
    keluar[i] = Math.max(-1, Math.min(1, Math.tanh(lp * 1.6) * env * gain * Math.min(1, sisa / 0.04) * 0.85));
  }
  return keluar;
}

/** STRINGS/PAD — 3 gergaji detune + vibrato + serangan lambat (pop/disco). */
function strings(f: number, durasi: number, gain: number): Float32Array {
  const SR = LAJU;
  const d = Math.min(8, Math.max(0.05, durasi));
  const n = Math.ceil(d * SR);
  const keluar = new Float32Array(n);
  const ff = Math.min(4200, Math.max(40, f));
  const det = [-0.008, 0, 0.009];
  const os = det.map((x) => ({ f: ff * (1 + x), p: 0 }));
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const vib = 1 + 0.0035 * Math.sin(DUA_PI * 4.6 * t);
    let jumlah = 0;
    for (const o of os) {
      o.p += (DUA_PI * o.f * vib) / SR;
      jumlah += ((o.p / DUA_PI) % 1) * 2 - 1;
    }
    jumlah /= os.length;
    const attack = Math.min(1, t / 0.16);
    const env = attack * (0.5 + 0.5 * Math.exp(-t * 0.9));
    const sisa = d - t;
    keluar[i] = Math.max(-1, Math.min(1, Math.tanh(jumlah * 1.3) * env * gain * Math.min(1, sisa / 0.08) * 0.8));
  }
  return keluar;
}

/** STRUM GITAR/PETIK — akor penuh dari senar Karplus-Strong, senar digenjot
 *  beruntun (offset 12 ms) dgn arah turun/naik bergantian — bunyi "gesekan"
 *  khas gitar akustik country/keroncong/pop. */
function strumAkor(freqs: number[], durasi: number, gain: number, arah: 1 | -1): Float32Array {
  const SR = LAJU;
  const per = Math.max(1, Math.floor(0.012 * SR));
  const n = Math.ceil(Math.max(0.12, durasi) * SR) + per * freqs.length;
  const keluar = new Float32Array(n);
  const urut = arah === 1 ? freqs : [...freqs].reverse();
  urut.forEach((f, idx) => {
    const senar = nadaIns("pluk", f, Math.max(0.35, durasi), 1);
    const awal = idx * per;
    for (let i = 0; i < senar.length && awal + i < n; i++) {
      keluar[awal + i] += senar[i] * (idx === 0 ? 1 : 0.82);
    }
  });
  for (let i = 0; i < n; i++) keluar[i] = Math.max(-1, Math.min(1, keluar[i] * gain * 0.6));
  return keluar;
}

/** Alat komping/lead: kembalikan sampel mono utk SATU nada (atau akor utk
 *  gitardist/supersaw dipanggil per nada akar — power chord dibentuk internal). */
function nadaAlat(ins: InsNada | "gitardist" | "supersaw" | "strings", f: number, d: number, g: number): Float32Array {
  switch (ins) {
    case "gitardist": return gitarPower(f, d, g);
    case "supersaw": return supersaw(f, d, g);
    case "strings": return strings(f, d, g);
    default: return nadaIns(ins, f, d, g);
  }
}

// ============ RENCANA ARANSEMEN PER GENRE (17) ============

export type KitDrum = "rock" | "elektrik" | "akustik" | "onedrop" | "kendang";
export type GayaComp =
  | "gitardist"  // power chord distorsi (rock/punk/metal)
  | "strum"      // petik akor penuh (pop/country/keroncong)
  | "skank"      // stab off-beat (ska/reggae)
  | "pianoJazz"  // voicing nada-7 (jazz/blues)
  | "supersaw"   // pad/stab synth EDM
  | "pad"        // akor bertahan (hiphop/lofi)
  | "arpeggio"   // pecah naik-turun (disco/gamelan)
  | "funk16"     // stab brass ke-16 (funk)
  | "hentak"     // hentak orgel (dangdut)
  | "saron";     // balungan gamelan

export interface RencanaGenre {
  kit: KitDrum;
  /** varian pola elektrik: four = kick 4/4 (edm/disco/funk), boom = boom-bap (hiphop/lofi) */
  polaE?: "four" | "boom";
  bass: GayaBass;
  comp: GayaComp;
  /** alat lead pemain melodi (asli atau baru) */
  lead: InsNada | "supersaw";
  /** alat komping utk gaya strum/pad/arpeggio (pluk/piano/bell/saron/strings) */
  compIns: InsNada;
  /** 0–0.33 keterlambatan off-beat ke-8 (swing feel) */
  swing: number;
  oktBass: number;
  perkusi?: "tabla" | "shaker";
  dekorasi?: InsNada;
  gDrum: number; gBass: number; gComp: number; gLead: number;
}

export const RENCANA_GENRE: Record<GenreMusik, RencanaGenre> = {
  pop:       { kit: "elektrik", polaE: "four", bass: "delapan",  comp: "strum",     compIns: "pluk",   lead: "piano",  swing: 0,    oktBass: 0,  perkusi: "shaker", gDrum: 0.62, gBass: 0.55, gComp: 0.4,  gLead: 0.46 },
  rock:      { kit: "rock",     bass: "delapan",  comp: "gitardist", compIns: "saw",    lead: "saw",    swing: 0,    oktBass: 0,  gDrum: 0.7,  gBass: 0.6,  gComp: 0.44, gLead: 0.46 },
  punk:      { kit: "rock",     bass: "delapan",  comp: "gitardist", compIns: "saw",    lead: "saw",    swing: 0,    oktBass: 0,  gDrum: 0.72, gBass: 0.62, gComp: 0.5,  gLead: 0.5 },
  metal:     { kit: "rock",     bass: "delapan",  comp: "gitardist", compIns: "saw",    lead: "saw",    swing: 0,    oktBass: -1, gDrum: 0.72, gBass: 0.68, gComp: 0.48, gLead: 0.48 },
  jazz:      { kit: "akustik",  bass: "jalan",    comp: "pianoJazz", compIns: "piano",  lead: "piano",  swing: 0.26, oktBass: 0,  gDrum: 0.52, gBass: 0.52, gComp: 0.36, gLead: 0.42 },
  blues:     { kit: "akustik",  bass: "jalan",    comp: "pianoJazz", compIns: "piano",  lead: "orgel",  swing: 0.3,  oktBass: 0,  gDrum: 0.54, gBass: 0.54, gComp: 0.38, gLead: 0.44 },
  reggae:    { kit: "onedrop",  bass: "reggae",   comp: "skank",     compIns: "pluk",   lead: "orgel",  swing: 0.06, oktBass: 0,  gDrum: 0.62, gBass: 0.68, gComp: 0.42, gLead: 0.38 },
  ska:       { kit: "elektrik", polaE: "four", bass: "jalan",    comp: "skank",     compIns: "pluk",   lead: "brass",  swing: 0.12, oktBass: 0,  perkusi: "shaker", gDrum: 0.64, gBass: 0.56, gComp: 0.48, gLead: 0.46 },
  dangdut:   { kit: "kendang",  bass: "dangdut",  comp: "hentak",    compIns: "orgel",  lead: "flute",  swing: 0.04, oktBass: 0,  perkusi: "tabla", dekorasi: "sitar", gDrum: 0.68, gBass: 0.6, gComp: 0.38, gLead: 0.5 },
  edm:       { kit: "elektrik", polaE: "four", bass: "pump",     comp: "supersaw",  compIns: "saw",    lead: "supersaw", swing: 0,  oktBass: -1, perkusi: "shaker", gDrum: 0.74, gBass: 0.7,  gComp: 0.4,  gLead: 0.46 },
  hiphop:    { kit: "elektrik", polaE: "boom", bass: "sub",      comp: "pad",       compIns: "piano",  lead: "piano",  swing: 0.16, oktBass: 0,  gDrum: 0.66, gBass: 0.72, gComp: 0.32, gLead: 0.38 },
  funk:      { kit: "elektrik", polaE: "four", bass: "funk",     comp: "funk16",    compIns: "brass",  lead: "brass",  swing: 0.14, oktBass: 0,  gDrum: 0.64, gBass: 0.66, gComp: 0.44, gLead: 0.48 },
  disco:     { kit: "elektrik", polaE: "four", bass: "pump",     comp: "arpeggio",  compIns: "bell",   lead: "bell",   swing: 0,    oktBass: 0,  perkusi: "shaker", gDrum: 0.68, gBass: 0.62, gComp: 0.42, gLead: 0.46 },
  keroncong: { kit: "akustik",  bass: "rootlima", comp: "strum",     compIns: "pluk",   lead: "flute",  swing: 0.05, oktBass: 0,  dekorasi: "flute", gDrum: 0.44, gBass: 0.5, gComp: 0.46, gLead: 0.48 },
  country:   { kit: "akustik",  bass: "rootlima", comp: "strum",     compIns: "pluk",   lead: "pluk",   swing: 0.1,  oktBass: 0,  gDrum: 0.52, gBass: 0.52, gComp: 0.46, gLead: 0.46 },
  lofi:      { kit: "elektrik", polaE: "boom", bass: "sub",      comp: "pad",       compIns: "piano",  lead: "piano",  swing: 0.18, oktBass: 0,  gDrum: 0.52, gBass: 0.6,  gComp: 0.32, gLead: 0.36 },
  gamelan:   { kit: "kendang",  bass: "rootlima", comp: "saron",     compIns: "saron",  lead: "saron",  swing: 0,    oktBass: 0,  gDrum: 0.56, gBass: 0.42, gComp: 0.4,  gLead: 0.52 },
};

// ============ KONTEKS & DINAMIKA ============

export interface KtxAransemen {
  bpm: number;
  fase: number;
  durasi: number;
  chord: SegmenChord[];
  melodi?: CatatanMelodi[];
  /** profil gelombang asli (~800 titik 0..1) — sumber ENERGI per bar utk dinamika */
  gelombang?: number[];
}

export interface OpsiAransemen {
  /** 0..1 intensitas drum+bass+komping */
  groove: number;
  /** 0..1 level melodi utama */
  melodi: number;
  /** "asli" = ikuti jalur melodi lagu asli (referensi) | "baru" = diciptakan dari chord */
  sumberMelodi: "asli" | "baru";
  /** variasi melodi baru (0..7) — dipakai bila sumberMelodi = "baru" */
  variasi: number;
}

/** Tingkat dinamika per bar: 0 = hening/lembut (intro/bait sunyi), 1 = normal,
 *  2 = penuh/klimaks. Dihitung dari energi asli (profil gelombang). */
function tingkatBar(a: KtxAransemen, spb: number, bar: number, nBar: number): number {
  const gel = a.gelombang && a.gelombang.length > 10 ? a.gelombang : null;
  if (!gel) return bar === 0 ? 0 : bar === 1 ? 1 : 2;
  const tTengah = (bar * 4 + 2) * spb + (a.fase || 0);
  const pos = Math.floor((tTengah / Math.max(0.001, a.durasi)) * gel.length);
  const i = Math.min(gel.length - 1, Math.max(0, pos));
  // rata 5 titik sekitar — stabil
  let j = 0, c = 0;
  for (let d = -2; d <= 2; d++) {
    const k = i + d;
    if (k >= 0 && k < gel.length) { j += gel[k]; c++; }
  }
  const e = j / Math.max(1, c);
  const tingkat = e < 0.32 ? 0 : e < 0.62 ? 1 : 2;
  if (bar === 0) return Math.min(tingkat, 1); // bar pembuka tak pernah langsung klimaks
  if (bar === 1 && nBar > 4) return Math.min(tingkat, 1);
  return tingkat;
}

const SKALA_TINGKAT = [0.5, 0.78, 1]; // penguatan gain per tingkat dinamika

interface EvDrum { pos: number; ins: DrumIns; gain: number; f?: number }

/** Pola drum SATU BAR per kit & tingkat dinamika — inti identitas ritme genre. */
function polaDrumBar(kit: KitDrum, polaE: "four" | "boom", tingkat: number, bar: number): EvDrum[] {
  const off = [0.5, 1.5, 2.5, 3.5];
  const delapan = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5];
  if (kit === "rock") {
    if (tingkat === 0) return [
      ...delapan.map((p) => ({ pos: p, ins: "hat" as const, gain: 0.3 })),
      { pos: 0, ins: "kick", gain: 0.5 }, { pos: 2, ins: "kick", gain: 0.45 },
    ];
    if (tingkat === 1) return [
      { pos: 0, ins: "kick", gain: 0.95 }, { pos: 2, ins: "kick", gain: 0.85 },
      { pos: 1, ins: "snare", gain: 0.85 }, { pos: 3, ins: "snare", gain: 0.85 },
      ...delapan.map((p) => ({ pos: p, ins: "hat" as const, gain: 0.5 })),
    ];
    const ev: EvDrum[] = [
      { pos: 0, ins: "kick", gain: 1.1 }, { pos: 2, ins: "kick", gain: 1 },
      { pos: 1, ins: "snare", gain: 1 }, { pos: 3, ins: "snare", gain: 1 },
      ...delapan.map((p) => ({ pos: p, ins: "hat" as const, gain: 0.55 })),
    ];
    if (bar % 2 === 1) ev.push({ pos: 3.5, ins: "hatOpen", gain: 0.55 });
    if (bar % 4 === 3) ev.push({ pos: 2.75, ins: "kick", gain: 0.6 });
    return ev;
  }
  if (kit === "elektrik") {
    if (polaE === "boom") {
      if (tingkat === 0) return [
        { pos: 0, ins: "kick", gain: 0.5 }, { pos: 2, ins: "kick", gain: 0.45 },
        ...off.map((p) => ({ pos: p, ins: "hat" as const, gain: 0.26 })),
      ];
      const ev: EvDrum[] = [
        { pos: 0, ins: "kick", gain: 1 }, { pos: 1.75, ins: "kick", gain: 0.75 },
        { pos: 2.5, ins: "kick", gain: 0.8 },
        { pos: 1, ins: "snare", gain: 0.9 }, { pos: 3, ins: "snare", gain: 0.9 },
        ...delapan.map((p) => ({ pos: p, ins: "hat" as const, gain: 0.38 })),
      ];
      if (tingkat >= 2) ev.push({ pos: 3.5, ins: "hatOpen", gain: 0.4 });
      return ev;
    }
    // "four" — four-on-the-floor
    if (tingkat === 0) return [
      { pos: 0, ins: "kick", gain: 0.55 }, { pos: 1, ins: "kick", gain: 0.45 },
      { pos: 2, ins: "kick", gain: 0.55 }, { pos: 3, ins: "kick", gain: 0.45 },
      ...off.map((p) => ({ pos: p, ins: "hat" as const, gain: 0.28 })),
    ];
    const ev: EvDrum[] = [
      { pos: 0, ins: "kick", gain: 1 }, { pos: 1, ins: "kick", gain: 0.95 },
      { pos: 2, ins: "kick", gain: 1 }, { pos: 3, ins: "kick", gain: 0.95 },
      { pos: 1, ins: "clap", gain: 0.75 }, { pos: 3, ins: "clap", gain: 0.75 },
      ...off.map((p) => ({ pos: p, ins: "hat" as const, gain: 0.5 })),
    ];
    if (tingkat >= 2) {
      ev.push({ pos: 1.75, ins: "hatOpen", gain: 0.5 }, { pos: 3.75, ins: "hatOpen", gain: 0.5 });
      if (bar % 4 === 2) ev.push({ pos: 0.75, ins: "tom", gain: 0.5, f: 160 }, { pos: 1, ins: "tom", gain: 0.55, f: 120 });
    }
    return ev;
  }
  if (kit === "akustik") {
    if (tingkat === 0) return [
      ...delapan.map((p) => ({ pos: p, ins: "shaker" as const, gain: 0.32 })),
      { pos: 0, ins: "kick", gain: 0.4 },
    ];
    if (tingkat === 1) return [
      { pos: 0, ins: "kick", gain: 0.6 }, { pos: 2.5, ins: "kick", gain: 0.5 },
      { pos: 1, ins: "tak", gain: 0.5 }, { pos: 3, ins: "tak", gain: 0.5 },
      ...del8Ride(),
      ...delapan.map((p) => ({ pos: p, ins: "shaker" as const, gain: 0.3 })),
    ];
    return [
      { pos: 0, ins: "kick", gain: 0.72 }, { pos: 2.5, ins: "kick", gain: 0.6 },
      { pos: 1, ins: "snare", gain: 0.55 }, { pos: 3, ins: "snare", gain: 0.6 },
      ...del8Ride(),
      { pos: 3.5, ins: "hatOpen", gain: 0.3 },
    ];
  }
  if (kit === "onedrop") { // reggae
    const dasar: EvDrum[] = [
      ...delapan.map((p) => ({ pos: p, ins: "hat" as const, gain: tingkat === 0 ? 0.3 : 0.46 })),
      { pos: 1, ins: "tak", gain: 0.36 },
    ];
    if (tingkat === 0) return dasar;
    dasar.push({ pos: 2, ins: "kick", gain: 1.05 }, { pos: 2, ins: "snare", gain: 0.85 });
    if (tingkat >= 2) {
      dasar.push({ pos: 3.5, ins: "kick", gain: 0.5 }, { pos: 2.75, ins: "hatOpen", gain: 0.45 });
    }
    return dasar;
  }
  // kendang (dangdut & gamelan) — gendang ganda dung/dut + tak + gong gamelan
  const dasar: EvDrum[] = [
    { pos: 0, ins: "dung", gain: 1 }, { pos: 0.5, ins: "tak", gain: 0.5 },
    { pos: 1, ins: "dut", gain: 0.6 }, { pos: 1.5, ins: "tak", gain: 0.5 },
    { pos: 2, ins: "dung", gain: 0.9 }, { pos: 2.5, ins: "tak", gain: 0.55 },
    { pos: 2.75, ins: "dut", gain: 0.5 }, { pos: 3, ins: "tak", gain: 0.6 },
    { pos: 3.5, ins: "dut", gain: 1 },
  ];
  if (tingkat === 0) return dasar.filter((e) => e.pos % 1 === 0).map((e) => ({ ...e, gain: e.gain * 0.55 }));
  if (kit === "kendang" && bar % 2 === 0 && tingkat >= 1) {
    // gong gamelan tiap bar genap (dangdut: jarang, gamelan: khas)
    dasar.push({ pos: 0, ins: "gong", gain: 0.5 });
  }
  if (tingkat >= 2) dasar.push({ pos: 0, ins: "kick", gain: 0.5 }, { pos: 2, ins: "kick", gain: 0.45 });
  return dasar;
}
function del8Ride(): EvDrum[] {
  return [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5].map((p) => ({ pos: p, ins: "ride" as const, gain: p % 1 === 0 ? 0.42 : 0.26 }));
}

/** Posisi & bentuk komping akor per gaya — [posisi dalam bar, panjang fraksi ketuk]. */
function polaCompBar(gaya: GayaComp, tingkat: number): [number, number][] {
  switch (gaya) {
    case "gitardist":
      if (tingkat === 0) return [[0, 1.2]];
      if (tingkat === 1) return [[0, 0.6], [1.5, 0.5], [2.5, 0.5]];
      return [[0, 0.4], [0.5, 0.4], [1, 0.4], [1.5, 0.4], [2, 0.4], [2.5, 0.4], [3, 0.4], [3.5, 0.4]];
    case "strum":
      if (tingkat === 0) return [[0, 1.6]];
      return [[0, 0.5], [0.5, 0.5], [1, 0.5], [1.5, 0.5], [2, 0.5], [2.5, 0.5], [3, 0.5], [3.5, 0.5]];
    case "skank":
      return tingkat === 0 ? [[1.5, 0.25]] : [[0.5, 0.22], [1.5, 0.22], [2.5, 0.22], [3.5, 0.22]];
    case "pianoJazz":
      return tingkat === 0 ? [[0, 1.8]] : [[0, 1], [1.5, 0.7], [2.5, 1]];
    case "supersaw":
      return tingkat === 0 ? [[0, 3.8]] : [[0, 1.4], [1.5, 0.6], [2, 1.4], [3.5, 0.6]];
    case "pad":
      return [[0, 3.8]];
    case "arpeggio":
      return [[0, 0.5], [0.5, 0.5], [1, 0.5], [1.5, 0.5], [2, 0.5], [2.5, 0.5], [3, 0.5], [3.5, 0.5]];
    case "funk16":
      return tingkat === 0 ? [[0, 0.3]] : [[0, 0.25], [0.375, 0.25], [0.75, 0.25], [1.5, 0.25], [2, 0.25], [2.375, 0.25], [2.75, 0.25], [3.5, 0.25]];
    case "hentak":
      return tingkat === 0 ? [[0, 0.8]] : [[0, 0.5], [2.5, 0.5]];
    case "saron":
      return [[0, 1], [1, 1], [2, 1], [3, 1]];
  }
}

const bulat = (n: number, k = 3) => Math.round(n * 10 ** k) / 10 ** k;

// ============ RENDER ARANSEMEN LENGKAP ============

/**
 * GANTI INSTRUMEN: render MUSIK BARU khas genre → WAV PCM16 stereo 44100 Hz.
 * Semua instrumen asli TIDAK dipakai; aransemen baru dibangun dari:
 *  · BPM + fasa beat lagu asli (semua hit sejajar tempo asli — pakai BPM manual
 *    bila user mengubahnya)
 *  · progresi chord asli (bass & akor mengikuti akar chord terdeteksi)
 *  · ENERGI per bar asli (profil gelombang) → dinamika: intro lembut, bait
 *    normal, klimaks penuh, fill + crash di transisi bagian
 *  · MELODI ASLI sbg referensi lead (sumberMelodi "asli") atau melodi baru
 *    dari chord (sumberMelodi "baru" dgn variasi)
 * Deterministik: input sama → hasil identik.
 */
export function buatAransemenWav(a: KtxAransemen, genre: GenreMusik, opsi: OpsiAransemen): Buffer {
  const r = RENCANA_GENRE[genre] ?? RENCANA_GENRE.pop;
  const bpm = Math.min(240, Math.max(40, a.bpm || 120));
  const spb = 60 / bpm;
  const durasi = Math.max(1, a.durasi);
  const groove = Math.min(1, Math.max(0, opsi.groove));
  const melodiLv = Math.min(1, Math.max(0, opsi.melodi));
  const totalN = Math.ceil((durasi + 1.6) * LAJU) * 2;
  const campur = new Float32Array(totalN);
  const rng = mulberry32(hashString(
    `ar:${a.bpm}|${a.fase}|${a.durasi}|${a.chord.map((c) => c.chord).join(",")}|${genre}|${opsi.sumberMelodi}|${opsi.variasi}`,
  ));

  const tPos = (bar: number, pos: number): number => {
    const fraksi = pos - Math.floor(pos);
    const off = Math.abs(fraksi - 0.5) < 1e-6;
    return (bar * 4 + pos) * spb + (a.fase || 0) + (off ? r.swing * 0.5 * spb : 0);
  };
  const chordPada = (t: number): { root: number; minor: boolean; f: number } => {
    const seg =
      a.chord.find((c) => t >= c.mulai - 0.02 && t < c.mulai + c.durasi) ||
      a.chord[a.chord.length - 1];
    const p = parseChord(seg?.chord || "C") || { root: 0, minor: false };
    return { root: p.root, minor: p.minor, f: FREQ_C2 * Math.pow(2, p.root / 12) * Math.pow(2, r.oktBass) };
  };
  const nadaChord = (c: { root: number; minor: boolean }, okt = 0, dgn7 = false): number[] => {
    const off = c.minor ? [0, 3, 7, 12] : [0, 4, 7, 12];
    if (dgn7) off.push(c.minor ? 10 : 11);
    const f0 = FREQ_C4 * Math.pow(2, c.root / 12) * Math.pow(2, okt);
    return off.map((o) => f0 * Math.pow(2, o / 12));
  };

  const nBar = Math.ceil(durasi / (spb * 4)) + 1;
  const tingkat: number[] = [];
  for (let bar = 0; bar < nBar; bar++) tingkat.push(tingkatBar(a, spb, bar, nBar));

  // cache sampel — kunci dgn jenis+param
  const cache = new Map<string, Float32Array>();
  const ambilDrum = (ins: DrumIns, g: number, f: number): Float32Array => {
    const kunci = `d:${ins}:${g.toFixed(2)}:${f.toFixed(1)}`;
    let s = cache.get(kunci);
    if (!s) { s = drumSampel(ins, g, f); cache.set(kunci, s); }
    return s;
  };
  const ambilNada = (ins: InsNada | "gitardist" | "supersaw" | "strings", f: number, d: number, g: number): Float32Array => {
    const kunci = `n:${ins}:${f.toFixed(1)}:${d.toFixed(2)}:${g.toFixed(2)}`;
    let s = cache.get(kunci);
    if (!s) { s = nadaAlat(ins, f, d, g); cache.set(kunci, s); }
    return s;
  };
  const ambilStrum = (freqs: number[], d: number, g: number, arah: 1 | -1): Float32Array => {
    const kunci = `s:${freqs.map((x) => x.toFixed(1)).join("_")}:${d.toFixed(2)}:${g.toFixed(2)}:${arah}`;
    let s = cache.get(kunci);
    if (!s) { s = strumAkor(freqs, d, g, arah); cache.set(kunci, s); }
    return s;
  };

  // posisi pan per kelompok instrumen (lebar stereo)
  const PAN = { drum: 0.04, bass: -0.12, comp: 0.22, lead: -0.2, perkusi: 0.3, dekor: -0.28 };

  // ===== 1) DRUM — dinamika + fill transisi + crash naik-bagian =====
  for (let bar = 0; bar < nBar; bar++) {
    const t = tingkat[bar];
    const skala = SKALA_TINGKAT[t] * groove;
    if (skala <= 0.001) continue;
    // fill 16th di akhir bar SEBELUM bagian naik
    const naik = bar + 1 < nBar && tingkat[bar + 1] > t;
    for (const ev of polaDrumBar(r.kit, r.polaE ?? "four", t, bar)) {
      const tt = tPos(bar, ev.pos);
      if (tt < 0 || tt > durasi + 0.6) continue;
      const hum = ev.ins === "hat" || ev.ins === "shaker" || ev.ins === "ride" ? (rng() - 0.5) * 0.006 : 0;
      tulisKeBufor(campur, ambilDrum(ev.ins, ev.gain * r.gDrum * skala, ev.f || 330), tt + hum, PAN.drum);
    }
    if (naik && bar >= 2) {
      const insFill: DrumIns = r.kit === "kendang" ? "tak" : r.kit === "akustik" ? "tak" : "snare";
      [3, 3.25, 3.5, 3.75].forEach((p, i) => {
        const tt = tPos(bar, p);
        if (tt < 0 || tt > durasi + 0.6) return;
        tulisKeBufor(campur, ambilDrum(insFill, (0.3 + i * 0.1) * r.gDrum * groove, 330), tt, PAN.drum);
      });
      // crash / gong menyambut bagian baru
      const ttN = tPos(bar + 1, 0);
      if (ttN >= 0 && ttN <= durasi + 0.6) {
        tulisKeBufor(campur, ambilDrum(r.kit === "kendang" ? "gong" : "crash", 0.62 * r.gDrum * groove, 330), ttN, PAN.drum);
      }
    } else if (t === 2 && bar % 8 === 0 && bar > 0) {
      // penanda siklus 8 bar dgn crash tipis juga (rock/elektrik)
      if (r.kit === "rock" || r.kit === "elektrik") {
        const tt = tPos(bar, 0);
        if (tt >= 0 && tt <= durasi + 0.6) tulisKeBufor(campur, ambilDrum("crash", 0.4 * r.gDrum * groove, 330), tt, PAN.drum);
      }
    }
  }

  // ===== 2) BASS — mengikuti akar chord asli, gaya khas genre =====
  const nadaBass = (t: number, f: number, d: number, g: number, tBar: number) => {
    if (t < 0 || t > durasi + 0.5) return;
    const skala = SKALA_TINGKAT[tingkat[Math.max(0, Math.min(nBar - 1, tBar))]] * groove;
    if (skala <= 0.001) return;
    const ins: InsNada = r.bass === "sub" ? "sub" : "bass";
    tulisKeBufor(campur, ambilNada(ins, f, d, g * r.gBass * skala), t, PAN.bass);
  };
  for (let bar = 0; bar < nBar; bar++) {
    const tBar = bar * 4 * spb + (a.fase || 0);
    const c = chordPada(tBar);
    const root = c.f, kvint = c.f * Math.pow(2, 7 / 12), okt = c.f * 2;
    switch (r.bass) {
      case "delapan":
        for (let i = 0; i < 8; i++) nadaBass(tPos(bar, i * 0.5), i === 7 ? okt : root, spb * 0.42, i % 2 === 0 ? 1 : 0.72, bar);
        break;
      case "rootlima":
        nadaBass(tBar, root, spb * 1.8, 1, bar);
        nadaBass(tBar + spb * 2, kvint, spb * 1.8, 0.9, bar);
        break;
      case "jalan": {
        const ters = root * Math.pow(2, (c.minor ? 3 : 4) / 12);
        nadaBass(tPos(bar, 0), root, spb * 0.85, 1, bar);
        nadaBass(tPos(bar, 1), ters, spb * 0.85, 0.78, bar);
        nadaBass(tPos(bar, 2), kvint, spb * 0.85, 0.9, bar);
        const c2 = chordPada(tBar + spb * 4);
        const dekat = c2.f > root ? c2.f * Math.pow(2, -1 / 12) : c2.f * Math.pow(2, 1 / 12);
        nadaBass(tPos(bar, 3), dekat, spb * 0.85, 0.84, bar);
        break;
      }
      case "reggae":
        nadaBass(tBar, root, spb * 2.6, 1, bar);
        nadaBass(tPos(bar, 2.75), root, spb * 0.9, 0.8, bar);
        break;
      case "pump":
        for (let i = 0; i < 8; i++) nadaBass(tPos(bar, i * 0.5), i === 5 ? okt : root, spb * 0.4, i % 2 === 0 ? 1 : 0.72, bar);
        break;
      case "dangdut":
        nadaBass(tBar, root, spb * 1.2, 1, bar);
        nadaBass(tPos(bar, 1.5), root, spb * 0.4, 0.8, bar);
        nadaBass(tPos(bar, 2), kvint, spb * 1.2, 0.95, bar);
        nadaBass(tPos(bar, 3.5), okt, spb * 0.4, 0.85, bar);
        break;
      case "sub":
        nadaBass(tBar, root, spb * 3.8, 1, bar);
        break;
      case "funk":
        nadaBass(tBar, root, spb * 0.35, 1, bar);
        nadaBass(tPos(bar, 0.75), root, spb * 0.3, 0.7, bar);
        nadaBass(tPos(bar, 1.5), okt, spb * 0.3, 0.8, bar);
        nadaBass(tPos(bar, 2.5), root, spb * 0.35, 0.95, bar);
        nadaBass(tPos(bar, 3.25), kvint, spb * 0.3, 0.75, bar);
        break;
    }
  }

  // ===== 3) KOMPING AKOR — gaya khas genre =====
  for (let bar = 0; bar < nBar; bar++) {
    const tBar = bar * 4 * spb + (a.fase || 0);
    const t = tingkat[bar];
    const skala = SKALA_TINGKAT[t] * groove;
    if (skala <= 0.001) continue;
    const c = chordPada(tBar);
    const freqs4 = nadaChord(c, 0); // oktaf 4
    const freqs3 = nadaChord(c, -1); // oktaf 3 (gitar/voicing jazz)
    const hit = (pos: number, panjang: number, g: number, freqList: number[], viaStrum = false) => {
      const tt = tPos(bar, pos);
      if (tt < 0 || tt > durasi + 0.5) return;
      if (viaStrum) {
        tulisKeBufor(campur, ambilStrum(freqList, Math.max(0.22, panjang * spb), g * r.gComp * skala, bar % 2 === 0 ? 1 : -1), tt, PAN.comp);
      } else {
        for (const f of freqList) {
          tulisKeBufor(campur, ambilNada(r.comp === "gitardist" ? "gitardist" : r.comp === "supersaw" ? "supersaw" : r.compIns, f, Math.max(0.08, panjang * spb), g * r.gComp * skala / Math.sqrt(freqList.length)), tt, PAN.comp);
        }
      }
    };
    switch (r.comp) {
      case "gitardist": {
        // power chord = akar di oktaf 3 (gitarPower bentuk akar+kvint+okt internal)
        const [root3] = freqs3;
        for (const [p, len] of polaCompBar("gitardist", t)) {
          const tt = tPos(bar, p);
          if (tt < 0 || tt > durasi + 0.5) continue;
          tulisKeBufor(campur, ambilNada("gitardist", root3, Math.max(0.1, len * spb), 1 * r.gComp * skala), tt, PAN.comp);
        }
        break;
      }
      case "strum":
        for (const [p, len] of polaCompBar("strum", t)) hit(p, len, p % 1 === 0 ? 0.95 : 0.62, [...freqs3.slice(0, 3), freqs4[3]], true);
        break;
      case "skank":
        for (const [p, len] of polaCompBar("skank", t)) hit(p, len, 1, freqs4.slice(0, 3));
        break;
      case "pianoJazz":
        for (const [p, len] of polaCompBar("pianoJazz", t)) hit(p, len, 0.9, nadaChord(c, -1, true).slice(0, 4));
        break;
      case "supersaw":
        for (const [p, len] of polaCompBar("supersaw", t)) {
          const tt = tPos(bar, p);
          if (tt < 0 || tt > durasi + 0.5) continue;
          for (const f of freqs4.slice(0, 3)) {
            tulisKeBufor(campur, ambilNada("supersaw", f, Math.max(0.2, len * spb), 0.85 * r.gComp * skala / 1.7), tt, PAN.comp);
          }
        }
        break;
      case "pad":
        for (const [p, len] of polaCompBar("pad", t)) hit(p, len, 0.8, freqs4);
        break;
      case "arpeggio": {
        const urut = [freqs4[0], freqs4[1], freqs4[2], freqs4[3], freqs4[2], freqs4[1]];
        polaCompBar("arpeggio", t).forEach(([p, len], i) => hit(p, len, 0.85, [urut[i % 6]]));
        break;
      }
      case "funk16":
        for (const [p, len] of polaCompBar("funk16", t)) hit(p, len, 0.9, freqs4.slice(0, 3));
        break;
      case "hentak":
        for (const [p, len] of polaCompBar("hentak", t)) hit(p, len, 0.95, freqs4.slice(0, 3));
        break;
      case "saron": {
        const bal = [freqs4[0], freqs4[1], freqs4[2], freqs4[1]];
        polaCompBar("saron", t).forEach(([p, len], i) => hit(p, len, i === 0 ? 1 : 0.7, [bal[i % 4]]));
        break;
      }
    }
  }

  // ===== 4) MELODI UTAMA (lead) — asli sbg referensi / baru dari chord =====
  if (melodiLv > 0.005) {
    const catatan: CatatanMelodi[] =
      opsi.sumberMelodi === "asli" && Array.isArray(a.melodi) && a.melodi.length > 0
        ? a.melodi
        : buatMelodiBaru({ bpm: a.bpm, fase: a.fase, durasi: a.durasi, chord: a.chord }, genre, opsi.variasi ?? 0);
    for (const n of catatan) {
      if (n.t < 0 || n.t > durasi + 0.4) continue;
      const d = Math.min(4, Math.max(0.08, n.d));
      tulisKeBufor(campur, ambilNada(r.lead, n.f, d, n.g * r.gLead * melodiLv * 1.2), n.t, PAN.lead);
    }
  }

  // ===== 5) PERKUSI EKSTRA khas genre =====
  if (r.perkusi && groove > 0.005) {
    for (let bar = 0; bar < nBar; bar++) {
      const skala = SKALA_TINGKAT[tingkat[bar]] * groove;
      if (skala <= 0.001) continue;
      if (r.perkusi === "tabla") {
        const polaTabla: [number, number, number][] = [
          [0, 95, 1], [0.5, 520, 0.55], [1, 520, 0.65], [1.5, 95, 0.85],
          [2, 95, 1], [2.5, 520, 0.55], [3, 520, 0.65], [3.5, 95, 0.7],
        ];
        for (const [p, f, g] of polaTabla) {
          const tt = tPos(bar, p);
          if (tt < 0 || tt > durasi + 0.5) continue;
          tulisKeBufor(campur, ambilDrum("tabla", g * 0.5 * r.gDrum * skala, f), tt, PAN.perkusi);
        }
      } else {
        for (let i = 0; i < 8; i++) {
          const tt = tPos(bar, i * 0.5);
          if (tt < 0 || tt > durasi + 0.5) continue;
          tulisKeBufor(campur, ambilDrum("shaker", (i % 2 ? 0.3 : 0.2) * r.gDrum * skala, 0), tt + (rng() - 0.5) * 0.005, PAN.perkusi);
        }
      }
    }
  }

  // ===== 6) DEKORASI MELODI khas genre =====
  if (r.dekorasi && groove > 0.005) {
    for (let bar = 0; bar < nBar; bar++) {
      const skala = SKALA_TINGKAT[tingkat[bar]] * groove;
      if (skala <= 0.001) continue;
      const tBar = bar * 4 * spb + (a.fase || 0);
      const c = chordPada(tBar);
      const fRoot = FREQ_C4 * Math.pow(2, c.root / 12) * 2;
      const fKvint = fRoot * Math.pow(2, 7 / 12);
      const hias: [number, number, number][] = [
        [0.75, fRoot, 0.3], [1.75, fKvint, 0.24], [2.75, fRoot, 0.26], [3.5, fKvint, 0.2],
      ];
      for (const [p, f, g] of hias) {
        const tt = tPos(bar, p);
        if (tt < 0 || tt > durasi + 0.5) continue;
        tulisKeBufor(campur, ambilNada(r.dekorasi, f, spb * 0.6, g * r.gComp * skala), tt, PAN.dekor);
      }
    }
  }

  beriReverb(campur, 0.14);
  return wavDariFloat(campur);
}

/** Label ramah utk info "Hasil ≈" — dipakai UI agar tampilan = hasil. */
export function deskripsiAransemen(genre: GenreMusik): string {
  const r = RENCANA_GENRE[genre] ?? RENCANA_GENRE.pop;
  const kitLabel: Record<KitDrum, string> = {
    rock: "drum rock", elektrik: "drum elektrik", akustik: "drum akustik",
    onedrop: "one-drop", kendang: "kendang",
  };
  return `${kitLabel[r.kit]} + ${r.comp}`;
}
