// VidSplit v0.13.0 — MESIN SUARA STUDIO (JS murni, tanpa dependensi):
//  • PERKUSI DIPOLES: kick dgn dentum+badan sweep-fasa, snare dua-band (badan+sulingan),
//    hi-hat metalik 6-osilator gaya TR-808, GENDANG GANDA "dung"/"dut" khas dangdut
//    (dipilih lewat parameter f), gong berdenting ganda, pluck Karplus-Strong (senar
//    petik fisik), tabla dha/tin, shaker, tak, stab ska.
//  • STEREO: tiap instrumen punya posisi pan (equal-power) — bukan lagi mono kaku.
//  • REVERB studio (freeverb: 8 comb + 4 allpass per kanal) — bunyi punya "ruang",
//    tidak lagi kering mengklik.
//  • buatLayerWav menerima geser semitone (mode REMAKE: nada petik/stab ikut nada
//    dasar baru) + reverb halus di ujung.
// Dipakai /api/musik/proses utk mode LAPISAN & REMAKE (musik asli tetap fondasi —
// hasil tetap "rekaman asli", bukan synth), dan basis instrumen TRANSFORMASI PENUH.
import type { PolaLayer } from "./musik";

const SR = 44100;
export const LAJU = SR; // laju sampel semua render
const DUA_PI = 2 * Math.PI;

export type Instrumen =
  | "kick" | "snare" | "hat" | "kendang" | "tak" | "gong" | "pluck" | "stab"
  | "tabla" | "shaker"; // perkusi India (dha/tin) & shaker
interface Acara {
  /** posisi dalam bar (0..4, desimal = off-beat) */
  pos: number;
  ins: Instrumen;
  gain: number;
  /** nada utk pluck/stab/kendang/tabla (Hz) — kendang: f<130 = "dung", ≥130 = "dut" */
  f?: number;
}

// ---------- PRNG deterministik per sampel (beda nada → beda derau, hasil stabil) ----------
function benihDari(kunci: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < kunci.length; i++) { h ^= kunci.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function rngDari(benih: number): () => number {
  let a = benih >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- sampel instrumen (fungsi gelombang dgn envelop) ----------
export function sampel(ins: Instrumen, gain: number, f: number): Float32Array {
  const panjang = {
    kick: 0.34, snare: 0.22, hat: 0.08, kendang: 0.30, tak: 0.12,
    gong: 2.8, pluck: 0.5, stab: 0.30,
    tabla: 0.26, shaker: 0.11,
  }[ins];
  const n = Math.floor(panjang * SR);
  const keluar = new Float32Array(n);
  const rand = rngDari(benihDari(`${ins}:${gain.toFixed(2)}:${f.toFixed(1)}`));
  let fasa = 0; // akumulator fasa utk nada dgn frekuensi berubah (sweep)
  let lp = 0;   // keadaan lowpass satu-titik
  // garis Karplus-Strong utk pluck (disiapkan sekali)
  let ksGaris: Float32Array | null = null;
  let ksIdx = 0;
  if (ins === "pluck") {
    const periode = Math.max(2, Math.round(SR / Math.min(4200, Math.max(30, f))));
    ksGaris = new Float32Array(periode);
    for (let i = 0; i < periode; i++) ksGaris[i] = rand() - rand();
    for (let i = 0; i < periode - 1; i++) ksGaris[i] = (ksGaris[i] + ksGaris[i + 1]) * 0.5;
  }
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let v = 0;
    switch (ins) {
      case "kick": {
        // dentum klik + badan sweep 107→45 Hz + oktaf tipis
        const fq = 45 + 62 * Math.exp(-t * 26);
        fasa += (DUA_PI * fq) / SR;
        const klik = (rand() - rand()) * 0.45 * Math.exp(-t * 300);
        v = (Math.sin(fasa) * 0.95 + Math.sin(fasa * 2) * 0.1 + klik)
          * Math.exp(-t * 8.5) * Math.min(1, t * 900);
        break;
      }
      case "snare": {
        // badan derau-rendah + nada 186 Hz; sulingan derau-tinggi
        const derau = rand() - rand();
        lp += 0.28 * (derau - lp);
        const tinggi = derau - lp;
        v = (lp * 0.8 * Math.exp(-t * 17) + tinggi * 0.55 * Math.exp(-t * 38)
          + Math.sin(DUA_PI * 186 * t) * 0.45 * Math.exp(-t * 30))
          * Math.min(1, t * 2500);
        break;
      }
      case "hat": {
        // metalik TR-808: jumlah 6 osilator kotak lalu high-pass
        let jumlah = 0;
        for (const f0 of [205.3, 304.4, 369.6, 522.7, 540, 800]) {
          jumlah += Math.sign(Math.sin(DUA_PI * f0 * t + f0 * 0.7));
        }
        const metalik = jumlah / 6;
        lp += 0.68 * (metalik - lp);
        v = (metalik - lp) * 1.15 * Math.exp(-t * 70) * Math.min(1, t * 5000);
        break;
      }
      case "kendang": {
        if (f < 130) {
          // "DUNG" — bodi gendang besar: sweep 115→55 Hz + resonansi membran + slap tipis
          const fq = 55 + 60 * Math.exp(-t * 21);
          fasa += (DUA_PI * fq) / SR;
          const slap = (rand() - rand()) * 0.16 * Math.exp(-t * 90);
          v = (Math.sin(fasa) * 0.92 + Math.sin(fasa * 2.13) * 0.14 + slap)
            * Math.exp(-t * 9.5) * Math.min(1, t * 1200);
        } else {
          // "DUT" — tepikan terbuka: sweep 320→130 Hz + slap tegas + dengung pendek
          const fq = 130 + 190 * Math.exp(-t * 30);
          fasa += (DUA_PI * fq) / SR;
          const slap = (rand() - rand()) * 0.38 * Math.exp(-t * 65);
          v = (Math.sin(fasa) * 0.8 + Math.sin(fasa * 1.59) * 0.12 + slap)
            * Math.exp(-t * 13) * Math.min(1, t * 1500);
        }
        break;
      }
      case "tak":
        // ketukan rim: nada pendek 210 Hz + ketukan derau
        v = (Math.sin(DUA_PI * 210 * t) * 0.5 + (rand() - rand()) * 0.38)
          * Math.exp(-t * 40) * Math.min(1, t * 3000);
        break;
      case "gong": {
        // denting ganda (pasangan frekuensi berdekatan) → berdenyut alami
        const env = Math.exp(-t * 1.05);
        v = (Math.sin(DUA_PI * 130 * t) * 0.45 + Math.sin(DUA_PI * 131.2 * t) * 0.18
          + Math.sin(DUA_PI * 196.5 * t) * 0.26 + Math.sin(DUA_PI * 262.8 * t) * 0.18
          + Math.sin(DUA_PI * 391 * t) * 0.08) * env
          + (rand() - rand()) * 0.02 * env;
        break;
      }
      case "pluck": {
        // Karplus-Strong: senar petik fisik (garis tunda dgn redam)
        if (ksGaris) {
          const kuar = ksGaris[ksIdx];
          ksGaris[ksIdx] = (kuar + ksGaris[(ksIdx + 1) % ksGaris.length]) * 0.497;
          ksIdx = (ksIdx + 1) % ksGaris.length;
          v = kuar * Math.exp(-t * 4.5) * 0.95 * Math.min(1, t * 4000);
        }
        break;
      }
      case "stab": {
        // akor stab ska: akar+ters+kvint dgn harmonik-2 + envelope pendek
        const env = Math.exp(-t * 16) * Math.min(1, t * 3000);
        v = (Math.sin(DUA_PI * f * t) + Math.sin(DUA_PI * f * 1.26 * t)
          + Math.sin(DUA_PI * f * 1.5 * t) + Math.sin(DUA_PI * f * 2 * t) * 0.16) * 0.24 * env;
        break;
      }
      case "tabla": {
        // tabla India: f rendah = "dha" (dengung turun dgn cincin), tinggi = "tin" (kring)
        if (f < 200) {
          const bend = 1 + 0.45 * Math.exp(-t * 22);
          fasa += (DUA_PI * f * bend) / SR;
          const cincin = Math.sin(DUA_PI * f * 2.62 * t) * 0.1 * Math.exp(-t * 8);
          v = (Math.sin(fasa) * 0.95 + cincin + (rand() - rand()) * 0.05)
            * Math.exp(-t * 10) * Math.min(1, t * 2000);
        } else {
          v = (Math.sin(DUA_PI * f * t) * 0.55 + (rand() - rand()) * 0.3 * Math.exp(-t * 60))
            * Math.exp(-t * 22) * Math.min(1, t * 3000);
        }
        break;
      }
      case "shaker": {
        // desis band-pass dgn serangan landai
        const derau = rand() - rand();
        lp += 0.42 * (derau - lp);
        v = (derau - lp) * 0.8 * Math.exp(-t * 34) * Math.min(1, t * 90);
        break;
      }
    }
    keluar[i] = Math.max(-1, Math.min(1, v * gain * 0.85));
  }
  // fade akhir 8 ms anti klik
  const fade = Math.min(400, n);
  for (let i = 0; i < fade; i++) {
    keluar[n - 1 - i] *= i / fade;
  }
  return keluar;
}

// ---------- posisi stereo tiap instrumen (equal-power, -1 kiri .. +1 kanan) ----------
const PAN_INS: Partial<Record<Instrumen, number>> = {
  kick: 0, snare: 0.06, hat: 0.22, kendang: -0.1, tak: 0.16,
  gong: -0.05, pluck: 0.18, stab: -0.14, tabla: 0.24, shaker: 0.3,
};

// ---------- pola ritme per bar 4 ketuk ----------
const PENTATONIK = [261.6, 293.7, 329.6, 392.0, 440.0]; // ~selandro mendekati gamelan/petik

export function polaBar(pola: PolaLayer, nomorBar: number): Acara[] {
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
        { pos: 1, ins: "tak", gain: 0.35 },
        ...[0.5, 1.5, 2.5, 3.5].map((p) => ({ pos: p, ins: "hat" as const, gain: 0.5 })),
        { pos: 0, ins: "hat", gain: 0.35 },
      ];
    case "dangdut":
      // GENDANG GANDA khas: dung besar di 1 & 3, dut terbuka penutup sebelum kembali —
      // "dang…DUT!" — plus tak dan kick penanda ketuk.
      return [
        { pos: 0, ins: "kendang", gain: 1, f: 78 },      // DUNG
        { pos: 0.5, ins: "tak", gain: 0.5 },
        { pos: 1, ins: "kendang", gain: 0.6, f: 165 },   // dut kecil
        { pos: 1.5, ins: "tak", gain: 0.5 },
        { pos: 2, ins: "kendang", gain: 0.9, f: 78 },    // DUNG
        { pos: 2.5, ins: "tak", gain: 0.55 },
        { pos: 2.75, ins: "kendang", gain: 0.5, f: 160 },
        { pos: 3, ins: "tak", gain: 0.6 },
        { pos: 3.5, ins: "kendang", gain: 1, f: 150 },   // "DUT!" — penutup khas dangdut
        { pos: 0, ins: "kick", gain: 0.55 }, { pos: 2, ins: "kick", gain: 0.5 },
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
        { pos: 2, ins: "kendang", gain: 0.55, f: 78 }, { pos: 3.5, ins: "tak", gain: 0.4 },
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
 *  bpm = tempo FINAL lagu (sudah dikali pengali tempo genre); fase = offset beat pertama.
 *  v0.13.0 `geser` = transpos semitone utk nada petik/stab/kendang/tabla (mode REMAKE). */
export function buatLayerWav(pola: PolaLayer, bpm: number, durasi: number, fase = 0, geser = 0): Buffer {
  const bpmAman = Math.min(220, Math.max(50, bpm || 120));
  const spb = 60 / bpmAman; // detik per ketuk
  const totalN = Math.ceil((Math.max(1, durasi) + 0.5) * SR) * 2; // stereo
  const campur = new Float32Array(totalN);
  const nBar = Math.ceil(durasi / (spb * 4)) + 1;
  const rasioGeser = Math.pow(2, Math.min(5, Math.max(-5, Math.round(geser))) / 12);
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
      const fEfektif = ev.f ? ev.f * rasioGeser : 330;
      const s = ambil(ev.ins, ev.gain, fEfektif);
      tulisKeBufor(campur, s, t, PAN_INS[ev.ins] ?? 0);
    }
  }
  if (pola === "vinyl") {
    const rand = rngDari(benihDari("vinyl-derau"));
    let derau = 0;
    for (let i = 0; i < totalN; i += 2) {
      derau = derau * 0.98 + rand() * 0.02; // pink-ish
      const kerak = rand() > 0.9985 ? rand() * 0.35 : 0;
      const v = derau * 0.55 + kerak;
      campur[i] += v;
      campur[i + 1] += v;
    }
  }
  // reverb halus "kamar rekam" + tulis PCM16 (penulis WAV bersama — dipakai juga transformasi penuh)
  beriReverb(campur, 0.14);
  return wavDariFloat(campur);
}

/** v0.13.0 — REVERB freeverb (8 comb + 4 allpass per kanal, kanal kanan +23 sampel
 *  → lebar stereo alami). Memproses buf stereo-interleaved DI TEMPAT. wet = 0..1. */
export function beriReverb(buf: Float32Array, wet = 0.18): void {
  const COMB = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617];
  const ALLP = [556, 441, 341, 225];
  const umpanBalik = 0.84;
  const redam = 0.2;
  const n = buf.length >> 1; // jumlah bingkai stereo
  const combs = COMB.map((d) => [
    { b: new Float32Array(d), idx: 0, s: 0 },
    { b: new Float32Array(d + 23), idx: 0, s: 0 },
  ]);
  const allps = ALLP.map((d) => [
    { b: new Float32Array(d), idx: 0 },
    { b: new Float32Array(d + 23), idx: 0 },
  ]);
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < 2; c++) {
      const masuk = buf[i * 2 + c];
      let y = 0;
      for (let k = 0; k < 8; k++) {
        const cb = combs[k][c];
        const keluar = cb.b[cb.idx];
        cb.s = keluar * (1 - redam) + cb.s * redam;
        cb.b[cb.idx] = masuk + cb.s * umpanBalik;
        cb.idx = (cb.idx + 1) % cb.b.length;
        y += keluar;
      }
      y *= 0.125; // rata 8 comb
      for (let k = 0; k < 4; k++) {
        const ap = allps[k][c];
        const bufKeluar = ap.b[ap.idx];
        const keluaran = -y + bufKeluar;
        ap.b[ap.idx] = y + bufKeluar * 0.5;
        y = keluaran;
        ap.idx = (ap.idx + 1) % ap.b.length;
      }
      buf[i * 2 + c] = masuk + wet * y * 1.7;
    }
  }
}

/** Float32 stereo interleaved → berkas WAV PCM16 (44100 Hz) dgn DC-blocker +
 * saturasi tanh lembut. */
export function wavDariFloat(campur: Float32Array): Buffer {
  const totalN = campur.length;
  const data = Buffer.alloc(totalN * 2);
  const prevIn = [0, 0];
  const prevOut = [0, 0];
  for (let i = 0; i < totalN; i++) {
    const c = i & 1;
    const x = campur[i];
    const y = x - prevIn[c] + 0.995 * prevOut[c]; // buang DC/offset
    prevIn[c] = x;
    prevOut[c] = y;
    let v = y * 0.9;
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

// ============ v0.11.0 — SINTESIS NADA utk TRANSFORMASI PENUH ============
// Alat musik bernada (bukan sekadar perkusi): bass, sub, piano, orgel, flute,
// saw (lead gitar/synth), pluk (petik), saron (perunggu gamelan), bell (lonceng
// disco). Tiap nada digambar sesuai frekuensi & durasi dari hasil analisis lagu.

export type InsNada =
  | "bass" | "sub" | "piano" | "orgel" | "flute" | "saw" | "pluk" | "saron" | "bell"
  | "sitar" | "brass"; // sitar India (dangdut) & tembaga (ska/funk)

/** Gambar SATU nada alat musik `ins` pada frekuensi `f` (Hz) selama `durasi` detik.
 *  Mengembalikan buffer mono Float32 (panjang = durasi × 44100). */
export function nadaIns(ins: InsNada, f: number, durasi: number, gain: number): Float32Array {
  const d = Math.min(8, Math.max(0.05, durasi));
  const n = Math.ceil(d * SR);
  const keluar = new Float32Array(n);
  const ff = Math.min(4200, Math.max(27.5, f || 220));
  const duaPi = 2 * Math.PI;
  let acak = 24681357;
  const rand = () => {
    acak = (acak * 1103515245 + 12345) & 0x7fffffff;
    return acak / 0x3fffffff - 1;
  };
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const sisa = d - t; // menuju akhir nota (utk fade-out anti klik)
    let v = 0;
    switch (ins) {
      case "bass": {
        // bass tegas: gelombang dasar + oktaf + kvint atas, decay pelan
        const env = Math.min(1, t / 0.006) * Math.exp(-t * 2.4) + (t > 0.05 ? 0.1 : 0);
        v = (Math.sin(duaPi * ff * t) + Math.sin(duaPi * ff * 2 * t) * 0.45
          + Math.sin(duaPi * ff * 3 * t) * 0.12) * env;
        break;
      }
      case "sub": {
        // sub-bass 808-an: panjang, hangat, sedikit harmonik ke-2
        const env = Math.min(1, t / 0.02) * (0.35 + 0.65 * Math.exp(-t * 1.4));
        v = (Math.sin(duaPi * ff * t) + Math.sin(duaPi * ff * 2 * t) * 0.25) * env;
        break;
      }
      case "piano": {
        const env = Math.min(1, t / 0.003) * Math.exp(-t * 2.8);
        v = (Math.sin(duaPi * ff * t) + Math.sin(duaPi * ff * 2 * t) * 0.5
          + Math.sin(duaPi * ff * 3 * t) * 0.22 + Math.sin(duaPi * ff * 4 * t) * 0.1) * env;
        break;
      }
      case "orgel": {
        const fVib = ff * (1 + 0.004 * Math.sin(duaPi * 5.2 * t));
        const env = Math.min(1, t / 0.02) * (0.55 + 0.45 * Math.exp(-t * 0.9));
        v = (Math.sin(duaPi * fVib * t) + Math.sin(duaPi * fVib * 2 * t) * 0.55
          + Math.sin(duaPi * fVib * 3 * t) * 0.3) * env;
        break;
      }
      case "flute": {
        const fVib = ff * (1 + 0.005 * Math.sin(duaPi * 5.5 * t));
        const nafas = (rand() - rand()) * 0.04 * Math.min(1, t * 8);
        const env = Math.min(1, t / 0.06) * (0.6 + 0.4 * Math.exp(-t * 0.5));
        v = (Math.sin(duaPi * fVib * t) + nafas) * env;
        break;
      }
      case "saw": {
        // gitar/synth lead "bergerigi": jumlah harmonik + saturasi
        let jumlah = 0;
        for (let k = 1; k <= 10; k++) jumlah += Math.sin(duaPi * ff * k * t) / k;
        const env = Math.min(1, t / 0.002) * (0.3 + 0.7 * Math.exp(-t * 5.5));
        v = Math.tanh(jumlah * 1.15) * env * 0.8;
        break;
      }
      case "pluk": {
        const env = Math.min(1, t / 0.001) * Math.exp(-t * 8);
        v = (Math.sin(duaPi * ff * t) + Math.sin(duaPi * ff * 2 * t) * 0.4
          + Math.sin(duaPi * ff * 3 * t) * 0.2 + Math.sin(duaPi * ff * 5 * t) * 0.08) * env;
        break;
      }
      case "saron": {
        // bilah perunggu gamelan: partial tak harmonik + dentum palu
        const env = Math.min(1, t / 0.001) * Math.exp(-t * 3.5);
        const pukul = rand() * 0.05 * Math.exp(-t * 60);
        v = (Math.sin(duaPi * ff * t) + Math.sin(duaPi * ff * 2.76 * t) * 0.4
          + Math.sin(duaPi * ff * 5.4 * t) * 0.18 + Math.sin(duaPi * ff * 8.93 * t) * 0.09
          + pukul) * env;
        break;
      }
      case "bell": {
        const env = Math.min(1, t / 0.002) * Math.exp(-t * 1.6);
        v = (Math.sin(duaPi * ff * t) + Math.sin(duaPi * ff * 2.4 * t) * 0.5
          + Math.sin(duaPi * ff * 3.9 * t) * 0.25 + Math.sin(duaPi * ff * 5.1 * t) * 0.1) * env;
        break;
      }
      case "sitar": {
        // sitar India: dengung inharmonik (buzz jembatan) + wobble halus,
        // dentum awal tajam lalu meluruh — rasa Bollywood khas dangdut lawas.
        const wob = 1 + 0.005 * Math.sin(duaPi * 6.3 * t);
        const buzz = Math.sin(duaPi * ff * 4.02 * t) * 0.14 + Math.sin(duaPi * ff * 6.98 * t) * 0.07;
        const env = Math.min(1, t / 0.0015) * Math.exp(-t * 5.2);
        v = (Math.sin(duaPi * ff * wob * t) + Math.sin(duaPi * ff * 2 * t) * 0.4
          + Math.sin(duaPi * ff * 3.01 * t) * 0.22 + buzz) * env;
        break;
      }
      case "brass": {
        // seksi tembaga: serak saw harmonik + serangan tiup (swell awal)
        let jumlah = 0;
        for (let k = 1; k <= 8; k++) jumlah += Math.sin(duaPi * ff * k * t + Math.sin(duaPi * k * 0.9)) / k;
        const tiup = (rand() - rand()) * 0.02 * Math.min(1, t * 30);
        const env = Math.min(1, t / 0.035) * (0.45 + 0.55 * Math.exp(-t * 7));
        v = (Math.tanh(jumlah * 1.05) * 0.85 + tiup) * env;
        break;
      }
    }
    const fade = Math.min(1, sisa / 0.025);
    keluar[i] = Math.max(-1, Math.min(1, v * gain * 0.8 * fade));
  }
  return keluar;
}

/** Tambahkan sampel mono ke bufer campur stereo (interleaved L,R) pada detik `t`.
 *  v0.13.0: `pan` -1 (kiri) .. +1 (kanan), equal-power; 0 = tengah. */
export function tulisKeBufor(campur: Float32Array, s: Float32Array, t: number, pan = 0): void {
  const p = Math.min(1, Math.max(-1, pan));
  const gl = Math.cos(((p + 1) * Math.PI) / 4);
  const gr = Math.sin(((p + 1) * Math.PI) / 4);
  const awal = Math.floor(t * SR) * 2;
  if (awal < 0) return;
  for (let i = 0; i < s.length; i++) {
    const idx = awal + i * 2;
    if (idx + 1 >= campur.length) break;
    campur[idx] += s[i] * gl;
    campur[idx + 1] += s[i] * gr;
  }
}
