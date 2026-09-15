// VidSplit v0.20.0 — PISAH VOKAL AI (MDX-Net "Kim Vocal 2" via onnxruntime-node) — 100% OFFLINE.
// Port 1:1 dari algoritma resmi UVR / python-audio-separator (mdx_separator.py + stft.py):
//  · dim_f=3072, dim_t=256, n_fft=6144, hop=1024, chunk=hop×(segment−1)=261120 sampel,
//    segment_size=256 (=dim_t → jalur ONNX murni), overlap antar-chunk 0.25 (UVR default),
//  · STFT: hann periodic, center=True (pad reflect), frame per hop; layout model
//    [1,4,3072,256] = (L.re, L.im, R.re, R.im) — real+imag ditumpuk jadi 4 kanal;
//  · 3 bin pertama dinolkan (desain model), model mengeluarkan spektrum BERSELUBUNG
//    (mask diterapkan DI DALAM graf ONNX — keluaran = spektrum vokal terpisah);
//  · iSTFT: OLA window² (identik torch.istft), bin 3072 dipad nol → 3073;
//  · instrumental = mix − compensate(1.035) × vokal (resep Kim_Vocal_2);
//  · normalisasi puncak 0.9 masuk-keluar (spec_utils.normalize).
// FFT 6144 tidak pow-2 → mixed-radix Cooley-Tukey 3×2048 (2 kanal real dikemas jadi
// SATU FFT kompleks per frame — L di real, R di imajiner) + radix-2 utk 2048.
// Hasil stem di-cache (work/vokal-ai/<hash>-{vokal,musik}.f32) — proses genre vokal
// berikutnya pada lagu sama TIDAK menghitung ulang AI (langsung instan).
import { spawn, type ChildProcess } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, statSync, writeFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import os from "node:os";
import { dirWork, pilihFfmpeg } from "./ffmpeg";

/** Nama berkas model MDX-Net yang dibundel (assets/vokal-ai → resources/vokal-ai). */
export const NAMA_MODEL_AI = "Kim_Vocal_2.onnx";
const COMPENSATE = 1.035; // resep resmi Kim_Vocal_2 utk instrumental
const N_FFT = 6144;
const HOP = 1024;
const DIM_F = 3072; // model memakai 3072 dari 3073 bin
const DIM_T = 256;
const SEGMENT = 256;
const CHUNK = HOP * (SEGMENT - 1); // 261120
const TRIM = N_FFT >> 1; // 3072
const GEN_SIZE = CHUNK - 2 * TRIM; // 254976
const OVERLAP = 0.25;
const STEP = Math.floor((1 - OVERLAP) * CHUNK); // 195840
const PUNCAK_NORM = 0.9;
const VERSI_CACHE = "kimv2-1";

// ============ RESOLUSI MODEL + ONNXRUNTIME (offline) ============

function kandidatDirModel(): string[] {
  const res = (process as unknown as { resourcesPath?: string }).resourcesPath;
  return [
    process.env.VIDSPLIT_VOKAL_AI || "",
    path.join(process.cwd(), "assets", "vokal-ai"),
    path.join(process.cwd(), "..", "assets", "vokal-ai"),
    path.join(process.cwd(), "..", "..", "assets", "vokal-ai"),
    res ? path.join(res, "vokal-ai") : "",
    res ? path.join(res, "server", "assets", "vokal-ai") : "",
  ].filter(Boolean);
}

/** Cari berkas model di kandidat folder; null bila tak ada. */
export function cariModel(): string | null {
  for (const d of kandidatDirModel()) {
    const p = path.join(d, NAMA_MODEL_AI);
    if (existsSync(p)) return p;
  }
  return null;
}

type OrtModul = typeof import("onnxruntime-node");
let ortTercache: OrtModul | null | undefined;

/** Muat onnxruntime-node dari lokasi paling mungkin (dev / standalone / installer). */
export async function muatOrt(): Promise<OrtModul | null> {
  if (ortTercache !== undefined) return ortTercache;
  const res = (process as unknown as { resourcesPath?: string }).resourcesPath;
  const dirs = [
    process.env.VIDSPLIT_ORT || "",
    process.cwd(),
    path.join(process.cwd(), ".."),
    path.join(process.cwd(), "..", ".."),
    res ? path.join(res, "server") : "",
  ].filter(Boolean);
  const reqRoot = createRequire(path.join(process.cwd(), "index.js"));
  for (const d of dirs) {
    try {
      const m = createRequire(path.join(d, "index.js"))("onnxruntime-node") as OrtModul;
      if (m?.InferenceSession) {
        ortTercache = m;
        return m;
      }
    } catch {
      /* lanjut kandidat berikutnya */
    }
  }
  try {
    const m = reqRoot("onnxruntime-node") as OrtModul;
    ortTercache = m?.InferenceSession ? m : null;
  } catch {
    ortTercache = null;
  }
  return ortTercache;
}

/** Benarkah mesin AI siap dipakai (model + runtime ditemukan)? Hasil di-cache. */
export async function aiTersedia(): Promise<boolean> {
  if (!cariModel()) return false;
  return (await muatOrt()) !== null;
}

let sesiPromise: Promise<unknown> | null = null;

async function muatSesi(m: OrtModul, modelPath: string): Promise<unknown> {
  if (!sesiPromise) {
    sesiPromise = m.InferenceSession.create(modelPath, {
      executionProviders: ["cpu"],
      // arena memori ORT menumpuk antar-inferensi (RSS bisa membengkak GB pada
      // lagu panjang) — matikan arena & pattern agar pemakaian memori terkendali
      enableCpuMemArena: false,
      enableMemPattern: false,
      graphOptimizationLevel: "all",
      intraOpNumThreads: Math.max(2, Math.min(4, os.cpus().length || 4)),
    } as never);
  }
  return sesiPromise;
}

// ============ FFT (radix-2 2048 + mixed-radix 6144) ============

/** FFT kompleks radix-2 in-place (n harus pow-2). inverse=true → IFFT dgn skala 1/n. */
export function fftRadix2(re: Float64Array, im: Float64Array, inverse = false): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const tr = re[i]; re[i] = re[j]; re[j] = tr;
      const ti = im[i]; im[i] = im[j]; im[j] = ti;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = ((inverse ? 2 : -2) * Math.PI) / len;
    const wr = Math.cos(ang), wi = Math.sin(ang);
    const setengah = len >> 1;
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < setengah; k++) {
        const ur = re[i + k], ui = im[i + k];
        const xr = re[i + k + setengah], xi = im[i + k + setengah];
        const vr = xr * cr - xi * ci;
        const vi = xr * ci + xi * cr;
        re[i + k] = ur + vr; im[i + k] = ui + vi;
        re[i + k + setengah] = ur - vr; im[i + k + setengah] = ui - vi;
        const nr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = nr;
      }
    }
  }
  if (inverse) {
    for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
  }
}

// tabel twiddle utk kombinasi 3×2048 → 6144
let tw6144: { w1r: Float64Array; w1i: Float64Array; w2r: Float64Array; w2i: Float64Array } | null = null;
const KONST3 = Math.sqrt(3) / 2; // bagian imajiner W_3

function tabel6144() {
  if (tw6144) return tw6144;
  const n = 2048;
  const w1r = new Float64Array(n), w1i = new Float64Array(n);
  const w2r = new Float64Array(n), w2i = new Float64Array(n);
  for (let k = 0; k < n; k++) {
    const a = (-2 * Math.PI * k) / 6144;
    w1r[k] = Math.cos(a); w1i[k] = Math.sin(a);
    w2r[k] = Math.cos(2 * a); w2i[k] = Math.sin(2 * a);
  }
  tw6144 = { w1r, w1i, w2r, w2i };
  return tw6144;
}

function bufer2048(): { re: Float64Array; im: Float64Array } {
  return { re: new Float64Array(2048), im: new Float64Array(2048) };
}

/** FFT kompleks 6144 = mixed-radix Cooley-Tukey 3×2048 (in-place).
 *  @internal diekspor utk uji unit. */
export function fft6144(re: Float64Array, im: Float64Array): void {
  const { w1r, w1i, w2r, w2i } = tabel6144();
  const F0 = bufer2048(), F1 = bufer2048(), F2 = bufer2048();
  // 1) tiga DFT-2048 pada sub-barisan lewati-3
  const bufs = [F0, F1, F2];
  for (let n2 = 0; n2 < 3; n2++) {
    const b = bufs[n2];
    for (let n1 = 0; n1 < 2048; n1++) {
      const idx = 3 * n1 + n2;
      b.re[n1] = re[idx];
      b.im[n1] = im[idx];
    }
    fftRadix2(b.re, b.im, false);
  }
  // 2) gabung: X[2048*k2 + k1] = Σ_n2 W6144^(n2·k1) · W3^(n2·k2) · F_n2[k1]
  for (let k1 = 0; k1 < 2048; k1++) {
    const wr = w1r[k1], wi = w1i[k1];
    const ur = w2r[k1], ui = w2i[k1];
    const t1r = F1.re[k1] * wr - F1.im[k1] * wi;
    const t1i = F1.re[k1] * wi + F1.im[k1] * wr;
    const t2r = F2.re[k1] * ur - F2.im[k1] * ui;
    const t2i = F2.re[k1] * ui + F2.im[k1] * ur;
    const a0r = F0.re[k1], a0i = F0.im[k1];
    const s1r = a0r + t1r + t2r, s1i = a0i + t1i + t2i;                    // k2=0
    // k2=1: W3 = −0.5 − i·(√3/2); k2=2: W3² = −0.5 + i·(√3/2)
    const s2r = a0r - 0.5 * (t1r + t2r) + KONST3 * (t1i - t2i);
    const s2i = a0i - 0.5 * (t1i + t2i) - KONST3 * (t1r - t2r);
    const s3r = a0r - 0.5 * (t1r + t2r) - KONST3 * (t1i - t2i);
    const s3i = a0i - 0.5 * (t1i + t2i) + KONST3 * (t1r - t2r);
    re[k1] = s1r; im[k1] = s1i;
    re[2048 + k1] = s2r; im[2048 + k1] = s2i;
    re[4096 + k1] = s3r; im[4096 + k1] = s3i;
  }
}

/** IFFT kompleks 6144 via trik konjugat (in-place). */
export function ifft6144(re: Float64Array, im: Float64Array): void {
  for (let i = 0; i < 6144; i++) im[i] = -im[i];
  fft6144(re, im);
  for (let i = 0; i < 6144; i++) {
    im[i] = -im[i] / 6144;
    re[i] = re[i] / 6144;
  }
}

// ============ STFT / iSTFT (identik torch.stft/istft center=True) ============

let jendelaHann: Float64Array | null = null;
function hannPeriodic(): Float64Array {
  if (jendelaHann) return jendelaHann;
  const w = new Float64Array(N_FFT);
  for (let i = 0; i < N_FFT; i++) w[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / N_FFT));
  jendelaHann = w;
  return w;
}

/** Hann SIMETRIS ala np.hanning — dipakai UVR utk blend antar-chunk demix. */
function hanningSimetris(m: number): Float64Array {
  const w = new Float64Array(m);
  if (m <= 1) { w.fill(1); return w; }
  for (let i = 0; i < m; i++) w[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (m - 1)));
  return w;
}

/** Pad reflect ukuran P di kiri+kanan (identik F.pad(mode="reflect") utk n > P). */
function padReflect(x: Float32Array, p: number): Float64Array {
  const n = x.length;
  const out = new Float64Array(n + 2 * p);
  for (let i = 0; i < n; i++) out[p + i] = x[i];
  for (let i = 0; i < p; i++) {
    out[p - 1 - i] = x[(i + 1) % n];
    out[p + n + i] = x[n - 2 - (i % Math.max(1, n - 1))];
  }
  return out;
}

/** STFT satu chunk (CHUNK sampel per kanal) → tensor model [1,4,3072,256].
 *  @internal diekspor utk uji unit. */
export function stftChunk(chL: Float32Array, chR: Float32Array): Float32Array {
  const w = hannPeriodic();
  const pL = padReflect(chL, TRIM);
  const pR = padReflect(chR, TRIM);
  const zre = new Float64Array(N_FFT);
  const zim = new Float64Array(N_FFT);
  const out = new Float32Array(4 * DIM_F * DIM_T);
  for (let t = 0; t < DIM_T; t++) {
    const of = t * HOP;
    for (let i = 0; i < N_FFT; i++) {
      zre[i] = pL[of + i] * w[i]; // L di bagian riil
      zim[i] = pR[of + i] * w[i]; // R di bagian imajiner (packing 2-real-dalam-1-kompleks)
    }
    fft6144(zre, zim);
    // bin 0..3071 SAJA — bin Nyquist ke-3073 DIBUANG (identik stft.py [..., :dim_f, :])
    for (let k = 0; k < DIM_F; k++) {
      const kc = (N_FFT - k) % N_FFT;
      const ar = zre[k], ai = zim[k];
      const br = zre[kc], bi = zim[kc];
      // L̂ = (Z[k] + conj(Z[N−k]))/2 ; R̂ = (Z[k] − conj(Z[N−k]))/(2i)
      const dasar = k * DIM_T + t;
      out[dasar] = 0.5 * (ar + br);
      out[DIM_F * DIM_T + dasar] = 0.5 * (ai - bi);
      out[2 * DIM_F * DIM_T + dasar] = 0.5 * (ai + bi);
      out[3 * DIM_F * DIM_T + dasar] = -0.5 * (ar - br);
    }
  }
  return out;
}

/** iSTFT tensor model [1,4,3072,256] → dua kanal waktu sepanjang CHUNK (OLA window²).
 *  @internal diekspor utk uji unit. */
export function istftChunk(spec: Float32Array): { l: Float32Array; r: Float32Array } {
  const w = hannPeriodic();
  const span = (DIM_T - 1) * HOP + N_FFT; // 267264 = luas area padded
  const olaL = new Float64Array(span);
  const olaR = new Float64Array(span);
  const env = new Float64Array(span);
  const XLre = new Float64Array(N_FFT), XLim = new Float64Array(N_FFT);
  const XRre = new Float64Array(N_FFT), XRim = new Float64Array(N_FFT);
  const zre = new Float64Array(N_FFT), zim = new Float64Array(N_FFT);
  for (let t = 0; t < DIM_T; t++) {
    // bin 0..3071 dari model; bin 3072 (Nyquist) dipad NOL (identik pad_frequency_dimension)
    for (let k = 0; k < DIM_F; k++) {
      const dasar = k * DIM_T + t;
      XLre[k] = spec[dasar];
      XLim[k] = spec[DIM_F * DIM_T + dasar];
      XRre[k] = spec[2 * DIM_F * DIM_T + dasar];
      XRim[k] = spec[3 * DIM_F * DIM_T + dasar];
    }
    XLre[DIM_F] = 0; XLim[DIM_F] = 0; XRre[DIM_F] = 0; XRim[DIM_F] = 0;
    // bentang Hermitian: X[N−k] = conj(X[k]) → bin 3073..6143 dari konjugat 1..3071
    for (let k = 1; k < DIM_F; k++) {
      const km = N_FFT - k;
      XLre[km] = XLre[k]; XLim[km] = -XLim[k];
      XRre[km] = XRre[k]; XRim[km] = -XRim[k];
    }
    // kemas: z = X_L + i·X_R → IFFT(z) = yL + i·yR (yL,yR riil — hemat 2× FFT)
    for (let k = 0; k < N_FFT; k++) {
      zre[k] = XLre[k] - XRim[k];
      zim[k] = XLim[k] + XRre[k];
    }
    ifft6144(zre, zim);
    const pos = t * HOP;
    for (let i = 0; i < N_FFT; i++) {
      olaL[pos + i] += zre[i] * w[i];
      olaR[pos + i] += zim[i] * w[i];
      env[pos + i] += w[i] * w[i];
    }
  }
  const l = new Float32Array(CHUNK);
  const r = new Float32Array(CHUNK);
  for (let i = 0; i < CHUNK; i++) {
    const e = env[TRIM + i] > 1e-9 ? env[TRIM + i] : 1;
    l[i] = olaL[TRIM + i] / e;
    r[i] = olaR[TRIM + i] / e;
  }
  return { l, r };
}

// ============ DEMIX (port mdx_separator.demix) ============

/** Jalankan model utk satu chunk; kembalikan data keluaran [1,4,3072,256]. */
type LariModel = (spek: Float32Array) => Promise<Float32Array>;

async function demixAi(
  lari: LariModel,
  planarL: Float32Array,
  planarR: Float32Array,
  total: number,
  onChunk: (f: number) => void,
  isBatal?: () => boolean,
): Promise<{ l: Float32Array; r: Float32Array }> {
  const pad = GEN_SIZE + TRIM - (total % GEN_SIZE);
  const padded = TRIM + total + pad;
  const resL = new Float32Array(padded);
  const resR = new Float32Array(padded);
  const div = new Float32Array(padded);
  const winPenuh = hanningSimetris(CHUNK);
  const chunkL = new Float32Array(CHUNK);
  const chunkR = new Float32Array(CHUNK);
  const totalChunk = Math.max(1, Math.ceil(padded / STEP));
  let nomor = 0;
  for (let i = 0; i < padded; i += STEP) {
    if (isBatal?.()) throw new Error("DIBATALKAN");
    const end = Math.min(i + CHUNK, padded);
    const actual = end - i;
    chunkL.fill(0);
    chunkR.fill(0);
    // mixture = [zeros TRIM | mix | zeros pad] — ambil jendela [i, i+CHUNK)
    for (let j = 0; j < actual; j++) {
      const idx = i + j - TRIM;
      if (idx >= 0 && idx < total) {
        chunkL[j] = planarL[idx];
        chunkR[j] = planarR[idx];
      }
    }
    const spek = stftChunk(chunkL, chunkR);
    // 3 bin pertama dinolkan (desain model — bin 0-2 = 0-16 Hz)
    for (let c = 0; c < 4; c++) {
      const dasar = c * DIM_F * DIM_T;
      for (let b = 0; b < 3; b++) {
        for (let t = 0; t < DIM_T; t++) spek[dasar + b * DIM_T + t] = 0;
      }
    }
    const keluar = await lari(spek);
    const { l, r } = istftChunk(keluar);
    const win = actual === CHUNK ? winPenuh : hanningSimetris(actual);
    for (let j = 0; j < actual; j++) {
      resL[i + j] += l[j] * win[j];
      resR[i + j] += r[j] * win[j];
      div[i + j] += win[j];
    }
    nomor++;
    onChunk(Math.min(1, nomor / totalChunk));
  }
  const outL = new Float32Array(total);
  const outR = new Float32Array(total);
  for (let i = 0; i < total; i++) {
    const d = div[TRIM + i] > 1e-8 ? div[TRIM + i] : 1;
    outL[i] = resL[TRIM + i] / d;
    outR[i] = resR[TRIM + i] / d;
  }
  return { l: outL, r: outR };
}

// ============ DEKODE AUDIO (ffmpeg → f32 stereo 44.1k) ============

async function dekodeStereo44100(
  abs: string,
  onSpawn?: (c: ChildProcess) => void,
): Promise<{ planarL: Float32Array; planarR: Float32Array; total: number }> {
  const ff = await pilihFfmpeg();
  const args = [
    "-v", "error", "-i", abs, "-map", "0:a:0",
    "-ac", "2", "-ar", "44100", "-f", "f32le", "pipe:1",
  ];
  const bufer: Buffer[] = [];
  await new Promise<void>((resolve, reject) => {
    const c = spawn(ff.bin, args, { windowsHide: true });
    onSpawn?.(c);
    c.stdout.on("data", (d: Buffer) => bufer.push(d));
    c.stderr.on("data", () => { /* diam — stderr cuma peringatan */ });
    c.on("error", reject);
    c.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`ffmpeg gagal membaca audio (kode ${code})`)),
    );
  });
  const gabung = Buffer.concat(bufer);
  const total = gabung.length >> 3; // per kanal (stereo f32 = 8 byte / bingkai)
  const planarL = new Float32Array(total);
  const planarR = new Float32Array(total);
  if (gabung.byteOffset % 4 === 0 && gabung.length % 4 === 0) {
    const v = new Float32Array(gabung.buffer, gabung.byteOffset, gabung.length >> 2);
    for (let i = 0; i < total; i++) {
      planarL[i] = v[2 * i];
      planarR[i] = v[2 * i + 1];
    }
  } else {
    for (let i = 0; i < total; i++) {
      planarL[i] = gabung.readFloatLE(i * 8);
      planarR[i] = gabung.readFloatLE(i * 8 + 4);
    }
  }
  return { planarL, planarR, total };
}

// ============ CACHE STEM ============

function kunciCache(abs: string): string {
  const st = statSync(abs);
  return createHash("sha1")
    .update(`${path.basename(abs)}|${st.size}|${Math.floor(st.mtimeMs)}|${VERSI_CACHE}`)
    .digest("hex")
    .slice(0, 20);
}

function dirCache(): string {
  return dirWork("vokal-ai");
}

function tulisStemF32(tujuan: string, a: Float32Array, b: Float32Array): void {
  const buf = Buffer.alloc(a.length * 8);
  for (let i = 0; i < a.length; i++) {
    buf.writeFloatLE(a[i], i * 8);
    buf.writeFloatLE(b[i], i * 8 + 4);
  }
  writeFileSync(tujuan, buf);
}

function bacaStemF32(sumber: string): { a: Float32Array; b: Float32Array } | null {
  try {
    const buf = readFileSync(sumber);
    const total = buf.length >> 3;
    const a = new Float32Array(total);
    const b = new Float32Array(total);
    for (let i = 0; i < total; i++) {
      a[i] = buf.readFloatLE(i * 8);
      b[i] = buf.readFloatLE(i * 8 + 4);
    }
    return { a, b };
  } catch {
    return null;
  }
}

function tulisInterleave(tujuan: string, data: Float32Array): void {
  const buf = Buffer.alloc(data.length * 4);
  for (let i = 0; i < data.length; i++) buf.writeFloatLE(data[i], i * 4);
  writeFileSync(tujuan, buf);
}

// ============ API PUBLIK ============

export interface HasilStemAi {
  /** f32 interleave stereo 44.1k — vokal (primary Kim_Vocal_2) */
  vokalF32: string;
  /** f32 interleave stereo 44.1k — musik/instrumental (mix − 1.035×vokal) */
  musikF32: string;
  dariCache: boolean;
  sampel: number;
}

/**
 * Pastikan stem AI (vokal & musik) tersedia utk lagu — dari cache atau dihitung
 * dengan model MDX-Net. onProgres: 0..1. isBatal: cek antar-chunk (throw DIBATALKAN).
 */
export async function pastikanStemAi(
  srcAbs: string,
  onProgres: (f: number) => void,
  isBatal?: () => boolean,
  onSpawn?: (c: ChildProcess) => void,
): Promise<HasilStemAi> {
  const kunci = kunciCache(srcAbs);
  const dir = dirCache();
  const vokalF32 = path.join(dir, `${kunci}-vokal.f32`);
  const musikF32 = path.join(dir, `${kunci}-musik.f32`);
  const metaF = path.join(dir, `${kunci}.json`);
  if (existsSync(vokalF32) && existsSync(musikF32) && existsSync(metaF)) {
    try {
      const meta = JSON.parse(readFileSync(metaF, "utf8")) as { sampel: number; versi: string };
      if (meta.versi === VERSI_CACHE && meta.sampel > 0) {
        onProgres(1);
        return { vokalF32, musikF32, dariCache: true, sampel: meta.sampel };
      }
    } catch { /* cache rusak → hitung ulang */ }
  }
  const ort = await muatOrt();
  const modelPath = cariModel();
  if (!ort || !modelPath) throw new Error("Mesin AI vokal tidak tersedia");
  onProgres(0.01);
  const { planarL, planarR, total } = await dekodeStereo44100(srcAbs, onSpawn);
  if (isBatal?.()) throw new Error("DIBATALKAN");
  if (total < 4096) throw new Error("Audio terlalu pendek untuk dipisah");
  onProgres(0.04);
  // normalisasi puncak (spec_utils.normalize) — pulihkan di akhir
  let puncak = 0;
  for (let i = 0; i < total; i++) {
    const a = Math.abs(planarL[i]);
    if (a > puncak) puncak = a;
    const b = Math.abs(planarR[i]);
    if (b > puncak) puncak = b;
  }
  let skala = 1;
  if (puncak > PUNCAK_NORM) {
    skala = PUNCAK_NORM / puncak;
    for (let i = 0; i < total; i++) {
      planarL[i] *= skala;
      planarR[i] *= skala;
    }
  }
  const sesi = (await muatSesi(ort, modelPath)) as {
    run: (feeds: Record<string, unknown>) => Promise<Record<string, { data: Float32Array }>>;
  };
  const lari: LariModel = async (spek) => {
    if (isBatal?.()) throw new Error("DIBATALKAN");
    const tensor = new ort.Tensor("float32", spek, [1, 4, DIM_F, DIM_T]);
    const hasil = await sesi.run({ input: tensor });
    const kunciKeluar = Object.keys(hasil)[0];
    return hasil[kunciKeluar].data as Float32Array;
  };
  const vokal = await demixAi(lari, planarL, planarR, total, (f) => {
    onProgres(0.04 + f * 0.88);
  }, isBatal);
  if (isBatal?.()) throw new Error("DIBATALKAN");
  // instrumental = mix − 1.035 × vokal (domain ternormalisasi — unit konsisten)
  const musikL = new Float32Array(total);
  const musikR = new Float32Array(total);
  for (let i = 0; i < total; i++) {
    musikL[i] = planarL[i] - COMPENSATE * vokal.l[i];
    musikR[i] = planarR[i] - COMPENSATE * vokal.r[i];
  }
  // pulihkan puncak asli (denormalisasi) pada kedua stem
  const denorm = skala !== 1 ? 1 / skala : 1;
  if (denorm !== 1) {
    for (let i = 0; i < total; i++) {
      vokal.l[i] *= denorm;
      vokal.r[i] *= denorm;
      musikL[i] *= denorm;
      musikR[i] *= denorm;
    }
  }
  mkdirSync(dir, { recursive: true });
  tulisStemF32(vokalF32, vokal.l, vokal.r);
  tulisStemF32(musikF32, musikL, musikR);
  writeFileSync(metaF, JSON.stringify({ sampel: total, sr: 44100, ch: 2, versi: VERSI_CACHE }), "utf8");
  onProgres(1);
  return { vokalF32, musikF32, dariCache: false, sampel: total };
}

/** Tulis Float32Array ke berkas f32 interleave (util uji). */
export { tulisInterleave };

/** Simpan dua Float32Array planar → satu berkas f32 interleave stereo. */
export function tulisStemF32Publik(tujuan: string, a: Float32Array, b: Float32Array): void {
  tulisStemF32(tujuan, a, b);
}
