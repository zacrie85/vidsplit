// VidSplit v0.10.0 — synthesizer layer instrumen murni JS (tanpa dependensi):
// kick, snare, hi-hat, kendang (dug/tak), gong, pluck, kebisingan vinyl —
// disusun jadi pola ritme per genre, dirender ke WAV PCM16 stereo 44100 Hz.
// Dipakai /api/musik/proses untuk lapisan "tambah alat musik" pada pengubah genre.
import type { PolaLayer } from "./musik";

const SR = 44100;

type Instrumen = "kick" | "snare" | "hat" | "kendang" | "tak" | "gong" | "pluck" | "stab";
interface Acara {
  /** posisi dalam bar (0..4, desimal = off-beat) */
  pos: number;
  ins: Instrumen;
  gain: number;
  /** nada utk pluck/stab (Hz) */
  f?: number;
}

// ---------- sampel instrumen (fungsi gelombang dgn envelop) ----------
function sampel(ins: Instrumen, gain: number, f: number): Float32Array {
  const panjang = {
    kick: 0.30, snare: 0.20, hat: 0.07, kendang: 0.28, tak: 0.14,
    gong: 2.6, pluck: 0.34, stab: 0.26,
  }[ins];
  const n = Math.floor(panjang * SR);
  const keluar = new Float32Array(n);
  let acak = 12345;
  const rand = () => {
    // LCG deterministik
    acak = (acak * 1103515245 + 12345) & 0x7fffffff;
    return acak / 0x3fffffff - 1;
  };
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let v = 0;
    switch (ins) {
      case "kick": {
        const fq = 48 + 95 * Math.exp(-t * 24);
        v = Math.sin(2 * Math.PI * fq * t) * Math.exp(-t * 9);
        break;
      }
      case "snare":
        v = (rand() * 0.75 + Math.sin(2 * Math.PI * 190 * t) * 0.35) * Math.exp(-t * 24);
        break;
      case "hat": {
        // derau "terang" — selisih sampel berturut = high-pass sederhana
        const derau = rand() - rand();
        v = derau * 0.5 * Math.exp(-t * 68);
        break;
      }
      case "kendang": {
        const fq = 68 + 70 * Math.exp(-t * 20);
        v = (Math.sin(2 * Math.PI * fq * t) * 0.9 + rand() * 0.08) * Math.exp(-t * 11);
        break;
      }
      case "tak":
        v = (Math.sin(2 * Math.PI * 170 * t) * 0.6 + rand() * 0.3) * Math.exp(-t * 30);
        break;
      case "gong": {
        const env = Math.exp(-t * 1.15);
        v = (Math.sin(2 * Math.PI * 130 * t) * 0.5 + Math.sin(2 * Math.PI * 196.5 * t) * 0.3
          + Math.sin(2 * Math.PI * 262.8 * t) * 0.22 + Math.sin(2 * Math.PI * 391 * t) * 0.1) * env;
        v += rand() * 0.02 * env;
        break;
      }
      case "pluck": {
        const env = Math.exp(-t * 13);
        v = (Math.sin(2 * Math.PI * f * t) * 0.7 + Math.sin(2 * Math.PI * f * 2 * t) * 0.25
          + Math.sin(2 * Math.PI * f * 3 * t) * 0.1) * env;
        break;
      }
      case "stab": {
        // akor stab ska: tiga nada detune + envelope pendek
        const env = Math.exp(-t * 16);
        v = (Math.sin(2 * Math.PI * f * t) + Math.sin(2 * Math.PI * f * 1.26 * t)
          + Math.sin(2 * Math.PI * f * 1.5 * t)) * 0.28 * env;
        break;
      }
    }
    keluar[i] = Math.max(-1, Math.min(1, v * gain * 0.85));
  }
  return keluar;
}

// ---------- pola ritme per bar 4 ketuk ----------
const PENTATONIK = [261.6, 293.7, 329.6, 392.0, 440.0]; // ~selandro mendekati gamelan/petik

function polaBar(pola: PolaLayer, nomorBar: number): Acara[] {
  switch (pola) {
    case "pop":
      return [
        { pos: 0, ins: "kick", gain: 1 }, { pos: 2, ins: "kick", gain: 0.9 },
        { pos: 1, ins: "snare", gain: 0.8 }, { pos: 3, ins: "snare", gain: 0.8 },
        ...[0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5].map((p) => ({ pos: p, ins: "hat" as const, gain: 0.45 })),
      ];
    case "rock":
      return [
        { pos: 0, ins: "kick", gain: 1.1 }, { pos: 2, ins: "kick", gain: 1 },
        { pos: 2.75, ins: "kick", gain: 0.6 },
        { pos: 1, ins: "snare", gain: 1 }, { pos: 3, ins: "snare", gain: 1 },
        ...[0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5].map((p) => ({ pos: p, ins: "hat" as const, gain: 0.55 })),
      ];
    case "skank": {
      const stabF = nomorBar % 2 === 0 ? 349.2 : 329.6; // F / E bergantian
      return [
        { pos: 0, ins: "kick", gain: 1 }, { pos: 2, ins: "kick", gain: 0.9 },
        { pos: 1, ins: "snare", gain: 0.75 }, { pos: 3, ins: "snare", gain: 0.75 },
        ...[0.5, 1.5, 2.5, 3.5].map((p) => ({ pos: p, ins: "stab" as const, gain: 0.7, f: stabF })),
      ];
    }
    case "onedrop": // reggae — drop: kick+snare bersama di ketuk 3
      return [
        { pos: 2, ins: "kick", gain: 1.1 }, { pos: 2, ins: "snare", gain: 0.85 },
        { pos: 3.5, ins: "kick", gain: 0.5 },
        ...[0.5, 1.5, 2.5, 3.5].map((p) => ({ pos: p, ins: "hat" as const, gain: 0.5 })),
        { pos: 0, ins: "hat", gain: 0.35 },
      ];
    case "dangdut":
      return [
        { pos: 0, ins: "kendang", gain: 1 }, { pos: 2, ins: "kendang", gain: 0.95 },
        { pos: 0.5, ins: "tak", gain: 0.6 }, { pos: 1.5, ins: "tak", gain: 0.55 },
        { pos: 2.5, ins: "tak", gain: 0.6 }, { pos: 3.5, ins: "tak", gain: 0.65 },
        { pos: 0, ins: "kick", gain: 0.8 }, { pos: 2, ins: "kick", gain: 0.7 },
        { pos: 1, ins: "hat", gain: 0.3 }, { pos: 3, ins: "hat", gain: 0.3 },
      ];
    case "boombap":
      return [
        { pos: 0, ins: "kick", gain: 1.05 }, { pos: 1.75, ins: "kick", gain: 0.8 },
        { pos: 2.5, ins: "kick", gain: 0.85 },
        { pos: 1, ins: "snare", gain: 0.95 }, { pos: 3, ins: "snare", gain: 0.95 },
        ...[0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5].map((p) => ({ pos: p, ins: "hat" as const, gain: 0.4 })),
      ];
    case "disco":
      return [
        { pos: 0, ins: "kick", gain: 1.05 }, { pos: 1, ins: "kick", gain: 1 },
        { pos: 2, ins: "kick", gain: 1.05 }, { pos: 3, ins: "kick", gain: 1 },
        { pos: 1, ins: "snare", gain: 0.7 }, { pos: 3, ins: "snare", gain: 0.7 },
        ...[0.5, 1.5, 2.5, 3.5].map((p) => ({ pos: p, ins: "hat" as const, gain: 0.55 })),
      ];
    case "gamelan": {
      const nada = PENTATONIK[(nomorBar * 3) % PENTATONIK.length];
      const nada2 = PENTATONIK[(nomorBar * 3 + 2) % PENTATONIK.length];
      return [
        { pos: 0, ins: "gong", gain: nomorBar % 2 === 0 ? 0.95 : 0.4 },
        { pos: 0, ins: "pluck", gain: 0.55, f: nada },
        { pos: 1, ins: "pluck", gain: 0.45, f: nada2 },
        { pos: 1.5, ins: "pluck", gain: 0.4, f: nada },
        { pos: 2, ins: "pluck", gain: 0.5, f: nada2 },
        { pos: 3, ins: "pluck", gain: 0.42, f: nada },
        { pos: 2, ins: "kendang", gain: 0.55 }, { pos: 3.5, ins: "tak", gain: 0.4 },
      ];
    }
    case "slap": // jazz/country — rim tipis + kick halus
      return [
        { pos: 0, ins: "kick", gain: 0.85 }, { pos: 2.5, ins: "kick", gain: 0.6 },
        { pos: 1, ins: "snare", gain: 0.4 }, { pos: 3, ins: "snare", gain: 0.45 },
        { pos: 0.5, ins: "hat", gain: 0.35 }, { pos: 1.5, ins: "hat", gain: 0.3 },
        { pos: 2.5, ins: "hat", gain: 0.35 }, { pos: 3.5, ins: "hat", gain: 0.3 },
      ];
    case "vinyl": // lo-fi — derau vinyl jadi lapisan dasar (ditambah di bawah)
      return [
        { pos: 0, ins: "kick", gain: 0.9 }, { pos: 2, ins: "kick", gain: 0.8 },
        { pos: 1, ins: "snare", gain: 0.5 }, { pos: 3, ins: "snare", gain: 0.55 },
        ...[0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5].map((p) => ({ pos: p, ins: "hat" as const, gain: 0.3 })),
      ];
  }
}

/** Render pola → buffer PCM16 stereo WAV (44100 Hz) sepanjang durasi detik.
 *  bpm = tempo FINAL lagu (sudah dikali pengali tempo genre); fase = offset beat pertama. */
export function buatLayerWav(pola: PolaLayer, bpm: number, durasi: number, fase = 0): Buffer {
  const bpmAman = Math.min(220, Math.max(50, bpm || 120));
  const spb = 60 / bpmAman; // detik per ketuk
  const totalN = Math.ceil((Math.max(1, durasi) + 0.5) * SR) * 2; // stereo
  const campur = new Float32Array(totalN);
  const nBar = Math.ceil(durasi / (spb * 4)) + 1;
  const cacheSampel = new Map<string, Float32Array>();
  const ambil = (ins: Instrumen, gain: number, f: number) => {
    const kunci = `${ins}:${gain.toFixed(2)}:${f.toFixed(1)}`;
    let s = cacheSampel.get(kunci);
    if (!s) { s = sampel(ins, gain, f); cacheSampel.set(kunci, s); }
    return s;
  };
  for (let bar = 0; bar < nBar; bar++) {
    for (const ev of polaBar(pola, bar)) {
      const t = (bar * 4 + ev.pos) * spb + fase;
      if (t < 0 || t > durasi + 0.4) continue;
      const s = ambil(ev.ins, ev.gain, ev.f || 330);
      const awal = Math.floor(t * SR) * 2;
      for (let i = 0; i < s.length; i++) {
        const idx = awal + i * 2;
        if (idx + 1 >= totalN) break;
        campur[idx] += s[i];
        campur[idx + 1] += s[i];
      }
    }
  }
  // lapisan khusus vinyl: derau pink halus + kerak acak sepanjang lagu
  if (pola === "vinyl") {
    let acak = 987654321;
    const rand = () => {
      acak = (acak * 1103515245 + 12345) & 0x7fffffff;
      return acak / 0x3fffffff - 1;
    };
    let derau = 0;
    for (let i = 0; i < totalN; i += 2) {
      derau = derau * 0.98 + rand() * 0.02; // pink-ish
      const kerak = rand() > 0.9985 ? rand() * 0.35 : 0;
      const v = derau * 0.55 + kerak;
      campur[i] += v;
      campur[i + 1] += v;
    }
  }
  // hard clip lembut + tulis PCM16
  const data = Buffer.alloc(totalN * 2);
  for (let i = 0; i < totalN; i++) {
    let v = campur[i] * 0.9;
    v = Math.tanh(v * 1.1); // saturasi lembut anti clipping
    data.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(v * 32767))), i * 2);
  }
  const kepala = Buffer.alloc(44);
  kepala.write("RIFF", 0, "ascii");
  kepala.writeUInt32LE(36 + data.length, 4);
  kepala.write("WAVEfmt ", 8, "ascii");
  kepala.writeUInt32LE(16, 16);
  kepala.writeUInt16LE(1, 20); // PCM
  kepala.writeUInt16LE(2, 22); // stereo
  kepala.writeUInt32LE(SR, 24);
  kepala.writeUInt32LE(SR * 4, 28); // byte rate = sr * kanal * 2
  kepala.writeUInt16LE(4, 32); // block align
  kepala.writeUInt16LE(16, 34); // bit
  kepala.write("data", 36, "ascii");
  kepala.writeUInt32LE(data.length, 40);
  return Buffer.concat([kepala, data]);
}
