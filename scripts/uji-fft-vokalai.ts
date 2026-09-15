// Uji sanity FFT 6144 + STFT/iSTFT roundtrip (v0.20.0)
// Jalankan: bun scripts/uji-fft-vokalai.ts
import { fft6144, ifft6144, stftChunk, istftChunk } from "../src/lib/vidsplit/vokalAi";

let gagal = 0;
function cek(nama: string, ok: boolean, detail = "") {
  console.log(`${ok ? "LOLOS" : "GAGAL"} — ${nama}${detail ? ` (${detail})` : ""}`);
  if (!ok) gagal++;
}

// ===== 1. FFT 6144: sinus murni di bin 100 → puncak di bin 100 & 6044 =====
{
  const n = 6144;
  const re = new Float64Array(n), im = new Float64Array(n);
  const amp = 2.0, bin = 100;
  for (let i = 0; i < n; i++) re[i] = amp * Math.cos((2 * Math.PI * bin * i) / n);
  fft6144(re, im);
  const mag = (k: number) => Math.hypot(re[k], im[k]);
  const puncak = mag(bin), tetangga = mag(bin + 1), jauh = mag(3000);
  cek("fft6144 ton 100: puncak ≈ n×amp/2", Math.abs(puncak - (n * amp) / 2) < 1e-6, `${puncak.toFixed(4)} vs ${(n * amp / 2).toFixed(4)}`);
  cek("fft6144 ton 100: tetangga ≈ 0", tetangga < 1e-6, `${tetangga.toExponential(3)}`);
  cek("fft6144 ton 100: bin jauh ≈ 0", jauh < 1e-6, `${jauh.toExponential(3)}`);
  // Hermitian
  cek("fft6144 hermitian X[n−k]=conj(X[k])", Math.abs(re[n - bin] - re[bin]) < 1e-9 && Math.abs(im[n - bin] + im[bin]) < 1e-9);
}

// ===== 2. IFFT roundtrip: sinyal acak → fft → ifft = asli =====
{
  const n = 6144;
  const re = new Float64Array(n), im = new Float64Array(n);
  const asli = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    asli[i] = Math.sin(i * 0.037) + 0.5 * Math.cos(i * 0.11);
    re[i] = asli[i];
    im[i] = 0;
  }
  fft6144(re, im);
  ifft6144(re, im);
  let err = 0;
  for (let i = 0; i < n; i++) err = Math.max(err, Math.abs(re[i] - asli[i]));
  cek("ifft6144 roundtrip err < 1e-10", err < 1e-10, `err=${err.toExponential(3)}`);
}

// ===== 3. STFT → iSTFT (tanpa model) = rekonstruksi sempurna =====
{
  const CHUNK = 261120;
  const L = new Float32Array(CHUNK), R = new Float32Array(CHUNK);
  for (let i = 0; i < CHUNK; i++) {
    L[i] = 0.4 * Math.sin(2 * Math.PI * 220 * (i / 44100)) * Math.exp(-((i - 130000) ** 2) / 2e8);
    R[i] = 0.3 * Math.sin(2 * Math.PI * 330 * (i / 44100) + 1.1) + 0.1 * (Math.random() - 0.5);
  }
  const asliL = Float32Array.from(L), asliR = Float32Array.from(R);
  const spek = stftChunk(L, R);
  const hasil = istftChunk(spek);
  let errL = 0, errR = 0;
  for (let i = 0; i < CHUNK; i++) {
    errL = Math.max(errL, Math.abs(hasil.l[i] - asliL[i]));
    errR = Math.max(errR, Math.abs(hasil.r[i] - asliR[i]));
  }
  cek("stft→istft rekonstruksi L err < 1e-3", errL < 1e-3, `errL=${errL.toExponential(3)}`);
  cek("stft→istft rekonstruksi R err < 1e-3", errR < 1e-3, `errR=${errR.toExponential(3)}`);
}

// ===== 4. Ton di bin fraksional → energi bin tepat (leakage wajar) =====
{
  const CHUNK = 261120;
  const L = new Float32Array(CHUNK), R = new Float32Array(CHUNK);
  for (let i = 0; i < CHUNK; i++) L[i] = Math.sin(2 * Math.PI * 440 * (i / 44100));
  const spek = stftChunk(L, R);
  // bin terdekat utk 440 Hz: 440 / (44100/6144) ≈ 61.3
  const mag = (k: number, t = 128) => Math.hypot(spek[k * 256 + t], spek[3072 * 256 + k * 256 + t]);
  const p61 = mag(61), p62 = mag(62), p30 = mag(30);
  cek("stft ton 440Hz → bin 61/62 dominan", p61 > 0.5 && p62 > 0.5 && p30 < 1, `p61=${p61.toFixed(2)} p62=${p62.toFixed(2)} p30=${p30.toExponential(2)}`);
}

console.log(gagal === 0 ? "\nSEMUA SANITY FFT LOLOS" : `\n${gagal} UJI GAGAL`);
process.exit(gagal === 0 ? 0 : 1);
