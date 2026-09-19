// VidSplit v0.25.0 — MESIN MUSIK HOROR (sintesis PCM murni, deterministik, 100% bebas
// hak cipta & offline): drone rendah detune + sub, detak jantung, lapisan bisikan,
// stinger disonan terjadwal + riser. Pola 60 dtk di-loop ffmpeg (aloop) saat render.
// v0.29.0 — MOOD HANGAT utk AI Video Generator genre dongeng/motivasi/fakta:
// pad akor mayor C-G-Am-F + arpeggio pentatonik + bass lembut + shaker halus.
export const SR_MUSIK = 44100;

export type IntensitasHoror = "santai" | "menegangkan" | "menghantui";
/** v0.29.0 — suasana musik: gelap (horor/misteri/legenda) | hangat (dongeng/motivasi/fakta) */
export type MoodMusik = "gelap" | "hangat";

export interface OpsiMusikHoror {
  intensitas?: IntensitasHoror;
  /** panjang pola dtk (10..60, bawaan 60) */
  polaDetik?: number;
  seed?: number;
}

function buatPrng(seed: number): () => number {
  let s = (seed || 1) >>> 0;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

/** Satu stinger: pad disonan (nada minor-2 + triton) dgn attack tajam & decay panjang */
function stinger(kiri: Float32Array, kanan: Float32Array, t: number, gain: number): void {
  const n = Math.floor(2.2 * SR_MUSIK);
  const nada = [110, 116.54, 155.56, 233.08]; // A2, Bb2, Eb3, Bb3 — disonan
  for (let i = 0; i < n && t + i < kiri.length; i++) {
    const d = i / SR_MUSIK;
    const env = Math.min(1, d / 0.008) * Math.exp(-d * 2.2) * gain;
    const getar = 1 + 0.004 * Math.sin(2 * Math.PI * 6.3 * d);
    let v = 0;
    for (let k = 0; k < nada.length; k++) v += Math.sin(2 * Math.PI * nada[k] * getar * d) * (1 / (k + 1));
    v += Math.sin(2 * Math.PI * 55 * d) * env * 0.6; // sub
    kiri[t + i] += v * env * 0.55;
    kanan[t + i] += v * env * 0.5;
  }
}

/** Riser pendek sebelum stinger: noise naik + gelombang naik nada */
function riser(kiri: Float32Array, kanan: Float32Array, t: number, gain: number, noise: () => number): void {
  const n = Math.floor(1.4 * SR_MUSIK);
  let lp = 0;
  for (let i = 0; i < n && t + i < kiri.length; i++) {
    const d = i / SR_MUSIK;
    const m = d / 1.4;
    const f = 180 + 1800 * m * m;
    lp += (noise() - lp) * (0.02 + 0.2 * m);
    const v = lp * m * gain * 0.8 + Math.sin(2 * Math.PI * f * d) * m * m * gain * 0.35;
    kiri[t + i] += v * 0.6;
    kanan[t + i] += v * 0.6;
  }
}

/** Detak jantung: dua pukulan sub (dum-dum) dgn jeda */
function detakJantung(kiri: Float32Array, kanan: Float32Array, t: number, gain: number): void {
  const pukul = (offset: number, g: number) => {
    const n = Math.floor(0.22 * SR_MUSIK);
    for (let i = 0; i < n && t + offset + i < kiri.length; i++) {
      const d = i / SR_MUSIK;
      const f = 58 * (1 - 0.3 * d);
      const env = Math.exp(-d * 26) * g;
      const v = Math.sin(2 * Math.PI * f * d) * env;
      kiri[t + offset + i] += v;
      kanan[t + offset + i] += v;
    }
  };
  pukul(0, gain);
  pukul(Math.floor(0.26 * SR_MUSIK), gain * 0.75);
}

/** Sintesis pola musik horor -> WAV PCM16 stereo. */
export function sintesisMusikHoror(opsi: OpsiMusikHoror = {}): Buffer {
  const intensitas = opsi.intensitas ?? "menegangkan";
  const total = Math.min(60, Math.max(10, opsi.polaDetik ?? 60));
  const sampel = Math.floor(total * SR_MUSIK);
  const kiri = new Float32Array(sampel);
  const kanan = new Float32Array(sampel);
  const noise = buatPrng((opsi.seed ?? 666) >>> 0);
  const r = buatPrng(((opsi.seed ?? 666) ^ 0x5f3759df) >>> 0);

  const konf = {
    santai: { drone: 0.30, jantung: 0.20, bpm: 52, jedaStinger: [18, 30] },
    menegangkan: { drone: 0.40, jantung: 0.30, bpm: 60, jedaStinger: [10, 20] },
    menghantui: { drone: 0.50, jantung: 0.38, bpm: 68, jedaStinger: [6, 13] },
  }[intensitas];

  // --- drone: dua sinus detune rendah + kvint gelap + LFO amplitudo sangat lambat
  const f1 = 55, f2 = 55.35, f3 = 82.4; // A1 detune + E2
  for (let i = 0; i < sampel; i++) {
    const d = i / SR_MUSIK;
    const lfo = 0.72 + 0.28 * Math.sin(2 * Math.PI * 0.05 * d) * Math.sin(2 * Math.PI * 0.013 * d + 1.3);
    const v = Math.sin(2 * Math.PI * f1 * d) + Math.sin(2 * Math.PI * f2 * d) * 0.8 +
      Math.sin(2 * Math.PI * f3 * d) * 0.45;
    const vok = v * konf.drone * lfo * 0.5;
    kiri[i] += vok;
    kanan[i] += vok * (0.94 + 0.12 * Math.sin(2 * Math.PI * 0.07 * d));
  }
  // --- lapisan bisikan: noise sangat ter-lowpass dgn amplop lambat acak
  let lp = 0, lp2 = 0;
  let amplop = 0.4, tujuan = 0.4;
  for (let i = 0; i < sampel; i++) {
    if (i % Math.floor(SR_MUSIK * 0.4) === 0) tujuan = 0.12 + r() * 0.5;
    amplop += (tujuan - amplop) * 0.02;
    const d = i / SR_MUSIK;
    lp += (noise() - lp) * 0.012;
    lp2 += (lp - lp2) * 0.05;
    const pan = 0.5 + 0.5 * Math.sin(2 * Math.PI * 0.021 * d);
    kiri[i] += lp2 * amplop * 0.5 * (1 - pan) * 1.4;
    kanan[i] += lp2 * amplop * 0.5 * pan * 1.4;
  }
  // --- detak jantung periodik
  const jedaJantung = Math.round((60 / konf.bpm) * SR_MUSIK);
  for (let t = 0; t < sampel; t += jedaJantung) detakJantung(kiri, kanan, t, konf.jantung);
  // --- stinger + riser terjadwal
  let t = Math.floor((4 + r() * 4) * SR_MUSIK);
  while (t < sampel) {
    riser(kiri, kanan, Math.max(0, t - Math.floor(1.4 * SR_MUSIK)), 0.5, noise);
    stinger(kiri, kanan, t, 0.75 + r() * 0.25);
    const [a, b] = konf.jedaStinger;
    t += Math.floor((a + r() * (b - a)) * SR_MUSIK);
  }
  // --- fade in/out pola supaya loop mulus
  const fade = Math.floor(0.6 * SR_MUSIK);
  for (let i = 0; i < fade; i++) {
    const g = i / fade;
    kiri[i] *= g; kanan[i] *= g;
    kiri[sampel - 1 - i] *= g; kanan[sampel - 1 - i] *= g;
  }

  const pcm = Buffer.alloc(sampel * 4);
  for (let i = 0; i < sampel; i++) {
    const l = Math.min(0.97, Math.max(-0.97, kiri[i] * 0.6));
    const r2 = Math.min(0.97, Math.max(-0.97, kanan[i] * 0.6));
    pcm.writeInt16LE(Math.round(l * 32767), i * 4);
    pcm.writeInt16LE(Math.round(r2 * 32767), i * 4 + 2);
  }
  const h = Buffer.alloc(44);
  h.write("RIFF", 0);
  h.writeUInt32LE(36 + pcm.length, 4);
  h.write("WAVEfmt ", 8);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(2, 22);
  h.writeUInt32LE(SR_MUSIK, 24);
  h.writeUInt32LE(SR_MUSIK * 4, 28);
  h.writeUInt16LE(4, 32);
  h.writeUInt16LE(16, 34);
  h.write("data", 36);
  h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

// ---------- v0.29.0 — MOOD HANGAT (dongeng/motivasi/fakta) ----------
// pad akor C–G–Am–F (4 dtk/akor) + bass akar + arpeggio pentatonik C mayor +
// shaker halus. Tidak ada stinger/detak jantung — terasa hangat & penuh harap.

const AKOR_HANGAT: number[][] = [
  [261.63, 329.63, 392.0],   // C: C4 E4 G4
  [196.0, 246.94, 293.66],   // G: G3 B3 D4
  [220.0, 261.63, 329.63],   // Am: A3 C4 E4
  [174.61, 220.0, 261.63],   // F: F3 A3 C4
];
const AKAR_HANGAT = [65.41, 49.0, 55.0, 43.65]; // C2 G1 A1 F1
const PENTA = [523.25, 587.33, 659.26, 783.99, 880.0]; // C5 D5 E5 G5 A5
const DTK_AKOR = 4;

function pluckHangat(kiri: Float32Array, kanan: Float32Array, t: number, nada: number, gain: number, kananLebih: boolean): void {
  const n = Math.floor(0.5 * SR_MUSIK);
  for (let i = 0; i < n && t + i < kiri.length; i++) {
    const d = i / SR_MUSIK;
    const env = Math.min(1, d / 0.004) * Math.exp(-d * 7.5) * gain;
    const v = Math.sin(2 * Math.PI * nada * d) * env;
    if (kananLebih) {
      kiri[t + i] += v * 0.7;
      kanan[t + i] += v;
    } else {
      kiri[t + i] += v;
      kanan[t + i] += v * 0.7;
    }
  }
}

function shakerHangat(kiri: Float32Array, kanan: Float32Array, t: number, gain: number, noise: () => number): void {
  const n = Math.floor(0.05 * SR_MUSIK);
  let hp = 0, hp2 = 0;
  for (let i = 0; i < n && t + i < kiri.length; i++) {
    const d = i / SR_MUSIK;
    const env = Math.exp(-d * 90) * gain;
    hp2 += (noise() - hp2) * 0.6;
    hp = hp2 - hp * 0.4; // high-pass sederhana
    const v = hp * env;
    kiri[t + i] += v * 0.6;
    kanan[t + i] += v * 0.6;
  }
}

/** Sintesis musik hangat -> WAV PCM16 stereo (deterministik). */
export function sintesisMusikHangat(opsi: OpsiMusikHoror = {}): Buffer {
  const total = Math.min(60, Math.max(10, opsi.polaDetik ?? 60));
  const sampel = Math.floor(total * SR_MUSIK);
  const kiri = new Float32Array(sampel);
  const kanan = new Float32Array(sampel);
  const noise = buatPrng((opsi.seed ?? 77) >>> 0);
  const r = buatPrng(((opsi.seed ?? 77) ^ 0x2f1a3d5b) >>> 0);
  // intensitas mengatur kepadatan arpeggio (agar slider tetap berfungsi utk mood hangat)
  const dens = { santai: 0.5, menegangkan: 0.68, menghantui: 0.85 }[opsi.intensitas ?? "santai"];
  const gainArp = { santai: 0.085, menegangkan: 0.105, menghantui: 0.125 }[opsi.intensitas ?? "santai"];

  const dtkPer8 = 60 / 92 / 2; // 92 BPM not per-8
  // --- pad akor + bass ---
  for (let c = 0; c * DTK_AKOR < total; c++) {
    const akor = AKOR_HANGAT[c % AKOR_HANGAT.length];
    const akar = AKAR_HANGAT[c % AKAR_HANGAT.length];
    const t0 = c * DTK_AKOR * SR_MUSIK;
    const nAkor = Math.floor(DTK_AKOR * SR_MUSIK);
    for (let i = 0; i < nAkor && t0 + i < sampel; i++) {
      const d = i / SR_MUSIK;
      // amplop: naik 1.1 dtk, turun 0.9 dtk terakhir
      const env = Math.min(1, d / 1.1) * Math.min(1, (DTK_AKOR - d) / 0.9);
      let v = 0;
      for (let k = 0; k < akor.length; k++) {
        v += Math.sin(2 * Math.PI * akor[k] * d) * 0.5;
        v += Math.sin(2 * Math.PI * akor[k] * 1.0015 * d) * 0.18; // detune hangat
      }
      const bass = Math.sin(2 * Math.PI * akar * d) * 0.55;
      const vok = (v * 0.16 + bass * 0.22) * env;
      const sway = 0.94 + 0.06 * Math.sin(2 * Math.PI * 0.09 * d + c);
      kiri[Math.floor(t0) + i] += vok * sway;
      kanan[Math.floor(t0) + i] += vok * (2 - sway);
    }
    // --- arpeggio pentatonik di atas akor ---
    const mulai8 = Math.round((c * DTK_AKOR) / dtkPer8);
    const banyak8 = Math.round(DTK_AKOR / dtkPer8);
    for (let e = 0; e < banyak8; e++) {
      if (r() > dens) continue;
      const t = Math.floor((mulai8 + e) * dtkPer8 * SR_MUSIK);
      const nada = PENTA[Math.floor(r() * PENTA.length) % PENTA.length];
      pluckHangat(kiri, kanan, t, nada, gainArp * (0.8 + r() * 0.4), e % 2 === 1);
    }
    // --- shaker tiap ketukan ---
    for (let b = 0; b < Math.round(DTK_AKOR * 92 / 60); b++) {
      const t = Math.floor((c * DTK_AKOR + (b * 60) / 92) * SR_MUSIK);
      shakerHangat(kiri, kanan, t, 0.028 + r() * 0.014, noise);
    }
  }
  // --- fade in/out supaya loop mulus ---
  const fade = Math.floor(0.8 * SR_MUSIK);
  for (let i = 0; i < fade; i++) {
    const g = i / fade;
    kiri[i] *= g; kanan[i] *= g;
    kiri[sampel - 1 - i] *= g; kanan[sampel - 1 - i] *= g;
  }
  const pcm = Buffer.alloc(sampel * 4);
  for (let i = 0; i < sampel; i++) {
    const l = Math.min(0.97, Math.max(-0.97, kiri[i] * 0.62));
    const r2 = Math.min(0.97, Math.max(-0.97, kanan[i] * 0.62));
    pcm.writeInt16LE(Math.round(l * 32767), i * 4);
    pcm.writeInt16LE(Math.round(r2 * 32767), i * 4 + 2);
  }
  const h = Buffer.alloc(44);
  h.write("RIFF", 0);
  h.writeUInt32LE(36 + pcm.length, 4);
  h.write("WAVEfmt ", 8);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(2, 22);
  h.writeUInt32LE(SR_MUSIK, 24);
  h.writeUInt32LE(SR_MUSIK * 4, 28);
  h.writeUInt16LE(4, 32);
  h.writeUInt16LE(16, 34);
  h.write("data", 36);
  h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

/** v0.29.0 — dispatcher mood: hangat -> sintesisMusikHangat, gelap -> sintesisMusikHoror */
export function sintesisMusikGenre(opsi: OpsiMusikHoror & { mood?: MoodMusik } = {}): Buffer {
  return opsi.mood === "hangat" ? sintesisMusikHangat(opsi) : sintesisMusikHoror(opsi);
}
