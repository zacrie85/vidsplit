// VidSplit v0.24.0 — VOKALGEN-6 "AI GENDER REALISTIS" — utilitas audio 100% offline:
//  · f0MedianPcm  — pengukur NADA DASAR (F0) suara: autokorelasi FFT per bingkai
//    (Wiener–Khintchin) + jaga-oktaf + ambang bersuara → median F0 bingkai bersuara.
//    Mesin pakai ini untuk menghitung geseran register ADAPTIF per lagu (suara pria
//    yang tinggal diberi target sesuai jaraknya — bukan geseran tetap).
//  · selaraskanLag — mengukur lag (sampel) antara stem hasil rubberband vs asal
//    lewat korelasi silang AMPLOP (bentuk gelombang sengaja tidak dipakai karena
//    pitch-shift mengubah fasanya) — presisi <1 ms.
//  · terapkanLag   — memangkas/menambah kepala berkas f32 agar lag = 0.
//  · baca/tulisStereoF32 — format stem f32 interleave stereo 44.1k (sama dgn vokalAi).
import { readFileSync, writeFileSync } from "node:fs";
import { fftRadix2 } from "./vokalAi";

export interface StemF32 {
  l: Float32Array;
  r: Float32Array;
}

/** Baca berkas f32 interleave stereo (stem AI) → dua kanal planar. null = rusak. */
export function bacaStereoF32(sumber: string): StemF32 | null {
  try {
    const buf = readFileSync(sumber);
    const total = buf.length >> 3; // 8 byte per bingkai stereo (L float + R float)
    if (total < 16) return null;
    const l = new Float32Array(total);
    const r = new Float32Array(total);
    for (let i = 0; i < total; i++) {
      l[i] = buf.readFloatLE(i * 8);
      r[i] = buf.readFloatLE(i * 8 + 4);
    }
    return { l, r };
  } catch {
    return null;
  }
}

/** Tulis dua kanal planar → f32 interleave stereo. */
export function tulisStereoF32(tujuan: string, l: Float32Array, r: Float32Array): void {
  const buf = Buffer.alloc(l.length * 8);
  for (let i = 0; i < l.length; i++) {
    buf.writeFloatLE(l[i], i * 8);
    buf.writeFloatLE(r[i], i * 8 + 4);
  }
  writeFileSync(tujuan, buf);
}

// ============ F0 MEDIAN (autokorelasi FFT) ============

const F0_JENDELA = 2048;
const F0_LOMPATAN = 1024;

/** Median F0 (Hz) dari PCM stereo 44.1k. null = tidak ada cukup bagian bersuara
 *  (musik murni / senyap / sinyal rusak). Deterministik — input sama, hasil sama. */
export function f0MedianPcm(l: Float32Array, r: Float32Array, sr = 44100): number | null {
  const n = Math.min(l.length, r.length);
  if (n < F0_JENDELA * 4) return null;
  const mono = new Float64Array(n);
  for (let i = 0; i < n; i++) mono[i] = (l[i] + r[i]) * 0.5;
  // ambil paling banyak 240 bingkai tersebar merata (lagu 5 menit tetap cepat)
  const jmlBingkai = Math.floor((n - F0_JENDELA) / F0_LOMPATAN);
  if (jmlBingkai < 3) return null;
  const langkah = Math.max(1, Math.ceil(jmlBingkai / 240));
  // tingkat energi global utk ambang bersuara
  let energi = 0;
  for (let i = 0; i < n; i++) energi += mono[i] * mono[i];
  const rmsGlobal = Math.sqrt(energi / n);
  const ambangRms = Math.max(rmsGlobal * 0.18, 2e-4);
  const lagMin = Math.floor(sr / 600); // 600 Hz
  const lagMaks = Math.ceil(sr / 60); // 60 Hz
  const jendela = new Float64Array(F0_JENDELA);
  const imF = new Float64Array(F0_JENDELA);
  const spektur = new Float64Array(F0_JENDELA); // daya → untuk ifft (autokorelasi)
  const imA = new Float64Array(F0_JENDELA);
  const f0s: number[] = [];
  for (let b = 0; b + F0_JENDELA <= n; b += F0_LOMPATAN * langkah) {
    // buang DC + Hann
    let rata = 0;
    for (let i = 0; i < F0_JENDELA; i++) rata += mono[b + i];
    rata /= F0_JENDELA;
    let rms = 0;
    for (let i = 0; i < F0_JENDELA; i++) {
      const v = mono[b + i] - rata;
      jendela[i] = v * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / F0_JENDELA));
      rms += v * v;
    }
    rms = Math.sqrt(rms / F0_JENDELA);
    if (rms < ambangRms) continue; // senyap / bukan suara
    // FFT maju → daya → IFFT = autokorelasi (Wiener–Khintchin)
    imF.fill(0);
    fftRadix2(jendela, imF, false);
    for (let i = 0; i < F0_JENDELA; i++) spektur[i] = jendela[i] * jendela[i] + imF[i] * imF[i];
    const reA = spektur.slice();
    imA.fill(0);
    fftRadix2(reA, imA, true);
    const r0 = reA[0];
    if (r0 <= 1e-12) continue;
    // cari puncak ACF di rentang lag (normalisasi r[0])
    let lagTerbaik = -1;
    let valTerbaik = 0;
    for (let lag = lagMin; lag <= lagMaks && lag < F0_JENDELA; lag++) {
      const v = reA[lag] / r0;
      if (v > valTerbaik) {
        valTerbaik = v;
        lagTerbaik = lag;
      }
    }
    if (lagTerbaik < 0 || valTerbaik < 0.3) continue; // tak bersuara
    // jaga-oktaf: bila setengah lag juga kuat → suara lebih tinggi yang benar
    const setengah = lagTerbaik >> 1;
    if (setengah >= lagMin && reA[setengah] / r0 > valTerbaik * 0.9) {
      lagTerbaik = setengah;
      valTerbaik = reA[setengah] / r0;
    }
    // parabolik halus
    const a = reA[Math.max(0, lagTerbaik - 1)] / r0;
    const bb = valTerbaik;
    const c = reA[Math.min(F0_JENDELA - 1, lagTerbaik + 1)] / r0;
    const pembagi = a - 2 * bb + c;
    const delta = pembagi !== 0 ? (0.5 * (a - c)) / pembagi : 0;
    const lagHalus = lagTerbaik + Math.max(-1, Math.min(1, delta));
    const f0 = sr / lagHalus;
    if (f0 >= 50 && f0 <= 700) f0s.push(f0);
  }
  if (f0s.length < 3) return null;
  f0s.sort((x, y) => x - y);
  return f0s[f0s.length >> 1];
}

// ============ PENYELARASAN (korelasi silang amplop) ============

const AMPLOP_BINGKAI = 441; // 10 ms @44.1k

function amplop(x: Float64Array, bingkai = AMPLOP_BINGKAI): Float64Array {
  const jml = Math.max(1, Math.floor(x.length / bingkai));
  const e = new Float64Array(jml);
  for (let b = 0; b < jml; b++) {
    let s = 0;
    const a = b * bingkai;
    const ujung = Math.min(a + bingkai, x.length);
    for (let i = a; i < ujung; i++) s += x[i] * x[i];
    e[b] = Math.sqrt(s / bingkai);
  }
  return e;
}

function haluskan(e: Float64Array, jendela = 5): Float64Array {
  const y = new Float64Array(e.length);
  const setengah = jendela >> 1;
  for (let i = 0; i < e.length; i++) {
    let s = 0;
    let n = 0;
    for (let j = Math.max(0, i - setengah); j <= Math.min(e.length - 1, i + setengah); j++) {
      s += e[j];
      n++;
    }
    y[i] = s / n;
  }
  return y;
}

/** Lag (sampel) b terhadap a: POSITIF = b TELAT (perlu dipangkas di kepala),
 *  negatif = b lebih awal (perlu diisi senyap). Rentang ±0,5 detik. Presisi
 *  <1 ms (bingkai 10 ms + penyaringan 2,5 ms + parabolik). 0 bila tak yakin. */
export function selaraskanLag(a: StemF32, b: StemF32, sr = 44100): number {
  const n = Math.min(a.l.length, b.l.length);
  if (n < sr) return 0; // <1 dtk — terlalu pendek utk diselaraskan dgn yakin
  const monoA = new Float64Array(n);
  const monoB = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    monoA[i] = (a.l[i] + a.r[i]) * 0.5;
    monoB[i] = (b.l[i] + b.r[i]) * 0.5;
  }
  const ea = haluskan(amplop(monoA.subarray(0, Math.floor(n / AMPLOP_BINGKAI) * AMPLOP_BINGKAI)));
  const eb = haluskan(amplop(monoB.subarray(0, Math.floor(n / AMPLOP_BINGKAI) * AMPLOP_BINGKAI)));
  const jml = Math.min(ea.length, eb.length);
  if (jml < 40) return 0;
  // energi utk deteksi "terlalu senyap" (korelasi tidak bermakna)
  let eaTot = 0;
  let ebTot = 0;
  for (let i = 0; i < jml; i++) {
    eaTot += ea[i] * ea[i];
    ebTot += eb[i] * eb[i];
  }
  if (eaTot < 1e-9 || ebTot < 1e-9) return 0;
  const batas = Math.min(50, Math.floor(jml / 4)); // ±50 bingkai = ±0,5 s
  const maksLag = Math.round(0.5 * sr);
  let skorTerbaik = -Infinity;
  let lagTerbaik = 0;
  for (let l = -batas; l <= batas; l++) {
    let s = 0;
    for (let i = batas; i < jml - batas; i++) {
      const j = i + l;
      if (j < 0 || j >= jml) continue;
      s += eb[j] * ea[i];
    }
    if (s > skorTerbaik) {
      skorTerbaik = s;
      lagTerbaik = l;
    }
  }
  // parabolik sub-bingkai pada korelasi kasar (bingkai 10 ms) — kandidat awal
  const skorKasar = (l: number): number => {
    let s = 0;
    for (let i = batas; i < jml - batas; i++) {
      const j = i + l;
      if (j < 0 || j >= jml) continue;
      s += eb[j] * ea[i];
    }
    return s;
  };
  const k0 = skorKasar(lagTerbaik - 1);
  const k1 = skorKasar(lagTerbaik);
  const k2 = skorKasar(lagTerbaik + 1);
  const pk = k0 - 2 * k1 + k2;
  const deltaK = pk !== 0 ? (0.5 * (k0 - k2)) / pk : 0;
  let lagSampel = (lagTerbaik + Math.max(-1, Math.min(1, deltaK))) * AMPLOP_BINGKAI;
  // penyaringan halus 2,5 ms — TETAP pakai AMPLOP (bentuk gelombang mentah sudah
  // terdekorelasi oleh pitch-shift; amplop kekal di bawah pergeseran pitch).
  // Jendela sempit ±10 ms — kasar sudah akurat ±half-bingkai.
  const halus = 110; // 2,5 ms
  const ea2 = haluskan(amplop(monoA, halus), 3);
  const eb2 = haluskan(amplop(monoB, halus), 3);
  const jml2 = Math.min(ea2.length, eb2.length);
  let skorHalus = -Infinity;
  let lagHalus = Math.round(lagSampel / halus) * halus;
  for (let l = lagHalus - AMPLOP_BINGKAI; l <= lagHalus + AMPLOP_BINGKAI; l += halus) {
    if (Math.abs(l) > maksLag) continue;
    let s = 0;
    let jmlh = 0;
    for (let i = batas; i < jml2 - batas; i++) {
      const j = i + Math.round(l / halus);
      if (j < 0 || j >= jml2) continue;
      s += eb2[j] * ea2[i];
      jmlh++;
    }
    if (jmlh === 0) continue;
    if (s / jmlh > skorHalus) {
      skorHalus = s / jmlh;
      lagHalus = l;
    }
  }
  // parabolik sub-bingkai halus
  const bing = Math.round(lagHalus / halus);
  const skor = (l: number): number => {
    let s = 0;
    let jmlh = 0;
    for (let i = batas; i < jml2 - batas; i++) {
      const j = i + l;
      if (j < 0 || j >= jml2) continue;
      s += eb2[j] * ea2[i];
      jmlh++;
    }
    return jmlh ? s / jmlh : 0;
  };
  const sk0 = skor(bing - 1);
  const sk1 = skor(bing);
  const sk2 = skor(bing + 1);
  const pembagi = sk0 - 2 * sk1 + sk2;
  const delta = pembagi !== 0 ? (0.5 * (sk0 - sk2)) / pembagi : 0;
  lagSampel += Math.max(-1, Math.min(1, delta)) * halus;
  return Math.max(-maksLag, Math.min(maksLag, Math.round(lagSampel)));
}

/** Terapkan koreksi lag: lag>0 → buang `lag` sampel pertama; lag<0 → tambah
 *  senyap −lag sampel di kepala. Panjang hasil mengikuti sumber (bila memangkas). */
export function terapkanLag(src: StemF32, lag: number): StemF32 {
  if (lag === 0) return src;
  const maks = 44100; // pengaman: jangan pernah koreksi > 1 detik
  if (lag > 0) {
    const m = Math.min(lag, maks, src.l.length - 1);
    return { l: src.l.slice(m), r: src.r.slice(m) };
  }
  const m = Math.min(-lag, maks);
  const l = new Float32Array(src.l.length + m);
  const r = new Float32Array(src.r.length + m);
  l.set(src.l, m);
  r.set(src.r, m);
  return { l, r };
}
