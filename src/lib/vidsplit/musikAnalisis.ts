// VidSplit v0.10.0 — analisis musik: dekode PCM via ffmpeg, deteksi tempo (autokorelasi
// onset), fase beat, chord otomatis (chromagram → template maj/min), profil gelombang.
// Hasil di-cache ke work/tmp agar analisis ulang instan.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { dirWork, pathAman } from "./ffmpeg";
import type { SegmenChord } from "./musik";

const SR = 11025; // laju sampel dekode analisis
const MAKS_DETIK = 900; // cap 15 menit

export interface HasilAnalisis {
  durasi: number;
  bpm: number;
  /** offset pukulan pertama (detik) — agar layer instrumen sejajar beat asli */
  fase: number;
  kunci: string;
  chord: SegmenChord[];
  /** 0..1 utk gambar gelombang di UI (~800 titik) */
  gelombang: number[];
}

/** Probe khusus AUDIO — beda dgn probe() video yang menolak berkas tanpa stream video. */
export async function probeAudio(abs: string, binFfprobe?: string): Promise<{ durasi: number; adaAudio: boolean }> {
  const { spawn } = await import("node:child_process");
  let bin = binFfprobe;
  if (!bin) {
    const { cariBinary } = await import("./ffmpeg");
    bin = await cariBinary("ffprobe");
  }
  const out = await new Promise<string>((resolve, reject) => {
    const c = spawn(bin!, ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", abs], { windowsHide: true });
    let stdout = "";
    let stderr = "";
    c.stdout.on("data", (d) => (stdout += d));
    c.stderr.on("data", (d) => (stderr += d));
    c.on("error", reject);
    c.on("close", (kode) => (kode === 0 ? resolve(stdout) : reject(new Error(`ffprobe gagal: ${stderr.slice(-300)}`))));
  });
  const j = JSON.parse(out) as {
    streams?: Array<{ codec_type: string }>;
    format?: { duration?: string };
  };
  const adaAudio = (j.streams || []).some((s) => s.codec_type === "audio");
  const durasi = parseFloat(j.format?.duration ?? "0") || 0;
  return { durasi, adaAudio };
}

/** Dekode audio → PCM mono float32 [-1..1] via ffmpeg (stdout pipe s16le). */
export function decodePcm(abs: string, bin: string, onSpawn?: (c: ReturnType<typeof spawn>) => void): Promise<Float32Array> {
  return new Promise((selesai, gagal) => {
    const args = [
      "-hide_banner", "-nostdin", "-v", "error",
      "-t", String(MAKS_DETIK),
      "-i", abs, "-vn", "-ac", "1", "-ar", String(SR),
      "-f", "s16le", "pipe:1",
    ];
    const c = spawn(bin, args, { windowsHide: true });
    onSpawn?.(c);
    const potongan: Buffer[] = [];
    let total = 0;
    const cap = SR * MAKS_DETIK * 2;
    c.stdout.on("data", (b: Buffer) => {
      total += b.length;
      if (total > cap) { c.kill("SIGKILL"); gagal(new Error("Audio terlalu panjang")); return; }
      potongan.push(b);
    });
    let stderr = "";
    c.stderr.on("data", (b: Buffer) => { stderr = (stderr + b.toString()).slice(-600); });
    c.on("error", (e) => gagal(e));
    c.on("close", (kode) => {
      if (kode !== 0) { gagal(new Error(`ffmpeg gagal dekode audio (${kode}): ${stderr}`)); return; }
      const buf = Buffer.concat(potongan);
      const n = buf.length >> 1;
      const pcm = new Float32Array(n);
      for (let i = 0; i < n; i++) pcm[i] = buf.readInt16LE(i * 2) / 32768;
      selesai(pcm);
    });
  });
}

/** RMS envelope: jendela 512, lompatan 256 */
function rmsEnv(pcm: Float32Array): Float32Array {
  const hop = 256, win = 512;
  const n = Math.max(1, Math.floor((pcm.length - win) / hop));
  const env = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let jumlah = 0;
    const awal = i * hop;
    for (let j = 0; j < win; j++) { const v = pcm[awal + j]; jumlah += v * v; }
    env[i] = Math.sqrt(jumlah / win);
  }
  return env;
}

/** Deteksi tempo: autokorelasi onset envelope 60–190 BPM + fasa pukulan. */
export function deteksiTempo(pcm: Float32Array): { bpm: number; fase: number } {
  const env = rmsEnv(pcm);
  const fsEnv = SR / 256; // ≈43 Hz
  // onset = kenaikan energi (setengah gelombang negatif dibuang)
  const onset = new Float32Array(env.length);
  for (let i = 1; i < env.length; i++) onset[i] = Math.max(0, env[i] - env[i - 1]);
  let maks = 1e-9;
  for (let i = 0; i < onset.length; i++) maks = Math.max(maks, onset[i]);
  for (let i = 0; i < onset.length; i++) onset[i] /= maks;
  // normalisasi DC
  let rata = 0;
  for (let i = 0; i < onset.length; i++) rata += onset[i];
  rata /= Math.max(1, onset.length);
  for (let i = 0; i < onset.length; i++) onset[i] = Math.max(0, onset[i] - rata);

  const lagMin = Math.floor((60 / 190) * fsEnv);
  const lagMaks = Math.ceil((60 / 60) * fsEnv);
  let bpmTerbaik = 120, skorTerbaik = -1;
  for (let lag = lagMin; lag <= lagMaks; lag++) {
    let skor = 0;
    for (let i = 0; i + lag * 2 < onset.length; i++) {
      skor += onset[i] * onset[i + lag] + 0.5 * onset[i] * onset[i + 2 * lag];
    }
    // penalti halus dekat batas agar tak terjebak oktaf tempo
    skor *= 1 - 0.15 * Math.abs(lag - (lagMin + lagMaks) / 2) / ((lagMaks - lagMin) / 2);
    if (skor > skorTerbaik) { skorTerbaik = skor; bpmTerbaik = (60 * fsEnv) / lag; }
  }
  // fasa: geser kisi beat 0..periode, ambil yang paling sejajar onset
  const periode = 60 / bpmTerbaik;
  const durasi = pcm.length / SR;
  let faseTerbaik = 0, skorFase = -1;
  for (let f = 0; f < 24; f++) {
    const fase = (f / 24) * periode;
    let skor = 0;
    for (let t = fase; t < durasi; t += periode) {
      const idx = Math.round(t * fsEnv);
      for (let d = -1; d <= 1; d++) {
        const k = idx + d;
        if (k >= 0 && k < onset.length) skor += onset[k] * (d === 0 ? 1 : 0.5);
      }
    }
    if (skor > skorFase) { skorFase = skor; faseTerbaik = fase; }
  }
  return { bpm: Math.round(bpmTerbaik * 10) / 10, fase: Math.round(faseTerbaik * 100) / 100 };
}

const NAMA_NOT = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const TPL_MAJ = [1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0];
const TPL_MIN = [1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0];

/** Chroma frame (12) via DFT titik (Goertzel) — jendela 8192, lompatan 4096 */
function chromagram(pcm: Float32Array): Float32Array[] {
  const win = 8192, hop = 4096;
  const nFrame = Math.max(1, Math.floor((pcm.length - win) / hop));
  // frekuensi pitch kelas per oktaf (C2..B6, bobol oktaf 3-5 lebih berat)
  const freq: { f: number; kelas: number; bobot: number }[] = [];
  for (let okt = 2; okt <= 6; okt++) {
    for (let k = 0; k < 12; k++) {
      const f = 65.406 * Math.pow(2, okt - 2) * Math.pow(2, k / 12);
      if (f > SR / 2 - 200) continue;
      freq.push({ f, kelas: k, bobot: okt >= 3 && okt <= 5 ? 1 : 0.45 });
    }
  }
  const cosT: Float32Array[] = freq.map((q) => {
    const w = (2 * Math.PI * q.f) / SR;
    const a = new Float32Array(win);
    for (let i = 0; i < win; i++) a[i] = Math.cos(w * i);
    return a;
  });
  const sinT: Float32Array[] = freq.map((q) => {
    const w = (2 * Math.PI * q.f) / SR;
    const a = new Float32Array(win);
    for (let i = 0; i < win; i++) a[i] = Math.sin(w * i);
    return a;
  });
  const frames: Float32Array[] = [];
  for (let fr = 0; fr < nFrame; fr++) {
    const awal = fr * hop;
    const chroma = new Float32Array(12);
    for (let qi = 0; qi < freq.length; qi++) {
      const q = freq[qi];
      let re = 0, im = 0;
      const c = cosT[qi], s = sinT[qi];
      for (let i = 0; i < win; i++) {
        const v = pcm[awal + i];
        re += v * c[i];
        im += v * s[i];
      }
      chroma[q.kelas] += Math.sqrt(re * re + im * im) * q.bobot;
    }
    // normalisasi vektor
    let jumlah = 0;
    for (let k = 0; k < 12; k++) jumlah += chroma[k];
    if (jumlah > 1e-9) for (let k = 0; k < 12; k++) chroma[k] /= jumlah;
    frames.push(chroma);
  }
  return frames;
}

/** Deteksi chord: template maj/min per frame → smoothing → segmen. */
export function deteksiChord(pcm: Float32Array, bpm: number): { chord: SegmenChord[]; kunci: string } {
  const frames = chromagram(pcm);
  const hopDetik = 4096 / SR;
  const jenis = (fr: Float32Array): { kelas: number; min: boolean; skor: number } => {
    let terbaik = { kelas: 0, min: false, skor: -1 };
    for (let k = 0; k < 12; k++) {
      // mayor: mulai kelas k
      let sm = 0, sn = 0;
      for (let i = 0; i < 12; i++) {
        sm += fr[(k + i) % 12] * TPL_MAJ[i];
        sn += fr[(k + i) % 12] * TPL_MIN[i];
      }
      if (sm > terbaik.skor) terbaik = { kelas: k, min: false, skor: sm };
      if (sn > terbaik.skor) terbaik = { kelas: k, min: true, skor: sn };
    }
    return terbaik;
  };
  const perFrame = frames.map(jenis);
  // majority smoothing 5 frame
  const halus = perFrame.map((_, i) => {
    const hitung = new Map<string, number>();
    for (let d = -2; d <= 2; d++) {
      const j = Math.min(perFrame.length - 1, Math.max(0, i + d));
      const k = `${perFrame[j].kelas}:${perFrame[j].min ? "m" : "M"}`;
      hitung.set(k, (hitung.get(k) || 0) + 1);
    }
    let terbaik = "", suara = 0;
    for (const [k, v] of hitung) if (v > suara) { suara = v; terbaik = k; }
    const [kelas, min] = terbaik.split(":");
    return { kelas: parseInt(kelas, 10), min: min === "m" };
  });
  // gabung frame berurutan sama → segmen
  const mentah: SegmenChord[] = [];
  let awal = 0;
  for (let i = 1; i <= halus.length; i++) {
    if (i === halus.length || halus[i].kelas !== halus[awal].kelas || halus[i].min !== halus[awal].min) {
      mentah.push({
        mulai: awal * hopDetik,
        durasi: (i - awal) * hopDetik,
        chord: `${NAMA_NOT[halus[awal].kelas]}${halus[awal].min ? "m" : ""}`,
      });
      awal = i;
    }
  }
  // hapus segmen pendek (<1.4 dtk) — serap ke tetangga terpanjang
  const segmen: SegmenChord[] = [];
  for (const s of mentah) {
    const terakhir = segmen[segmen.length - 1];
    if (s.durasi < 1.4 && terakhir) { terakhir.durasi += s.durasi; continue; }
    if (terakhir && terakhir.chord === s.chord) { terakhir.durasi += s.durasi; continue; }
    segmen.push({ ...s });
  }
  if (segmen.length > 1 && segmen[0].durasi < 1.0) {
    segmen[1].mulai = segmen[0].mulai;
    segmen[1].durasi += segmen[0].durasi;
    segmen.shift();
  }
  // kunci: chord yang paling lama dimainkan
  const bobot = new Map<string, number>();
  for (const s of segmen) bobot.set(s.chord, (bobot.get(s.chord) || 0) + s.durasi);
  let kunci = "C";
  let maksBobot = 0;
  for (const [k, v] of bobot) if (v > maksBobot) { maksBobot = v; kunci = k; }
  const bpmStabil = bpm >= 50 && bpm <= 220 ? bpm : 120;
  // batasi jumlah segmen utk overlay (rasio ≈ 1 chord per 2 beat maks)
  const batas = Math.max(40, Math.min(600, Math.round((pcm.length / SR) * (bpmStabil / 60) / 4)));
  return { chord: segmen.slice(0, batas), kunci };
}

/** Profil gelombang utk UI: n titik 0..1 */
export function profilGelombang(pcm: Float32Array, n = 800): number[] {
  const per = Math.max(1, Math.floor(pcm.length / n));
  const hasil: number[] = [];
  let maks = 1e-9;
  for (let i = 0; i < n; i++) {
    let jumlah = 0;
    const awal = i * per;
    for (let j = 0; j < per; j += 4) jumlah += pcm[awal + j] * pcm[awal + j];
    const v = Math.sqrt(jumlah / Math.max(1, per / 4));
    maks = Math.max(maks, v);
    hasil.push(v);
  }
  return hasil.map((v) => Math.round((v / maks) * 100) / 100);
}

/** Analisis lengkap + cache disk (kunci: path + mtime + ukuran). */
export async function analisisMusik(
  fileRel: string, bin: string,
): Promise<HasilAnalisis> {
  const abs = pathAman(fileRel);
  if (!abs || !existsSync(abs)) throw new Error("Berkas audio tidak ditemukan");
  const st = statAm(abs);
  const kunciCache = createHash("sha1")
    .update(`${abs}|${st.mtimeMs}|${st.size}`).digest("hex").slice(0, 20);
  const fileCache = dirWork(`tmp/analisis-${kunciCache}.json`);
  try {
    const cache = JSON.parse(readFileSync(fileCache, "utf8")) as HasilAnalisis;
    if (cache && typeof cache.durasi === "number" && Array.isArray(cache.chord)) return cache;
  } catch { /* cache tiada — analisis sungguhan */ }

  const pcm = await decodePcm(abs, bin);
  const durasi = pcm.length / SR;
  const { bpm, fase } = deteksiTempo(pcm);
  const { chord, kunci } = deteksiChord(pcm, bpm);
  const hasil: HasilAnalisis = {
    durasi: Math.round(durasi * 100) / 100,
    bpm, fase, kunci,
    chord: chord.map((c) => ({ ...c, mulai: Math.round(c.mulai * 100) / 100, durasi: Math.round(c.durasi * 100) / 100 })),
    gelombang: profilGelombang(pcm),
  };
  try { writeFileSync(fileCache, JSON.stringify(hasil), "utf8"); } catch { /* abaikan */ }
  return hasil;
}

import { statSync } from "node:fs";
function statAm(abs: string): { mtimeMs: number; size: number } {
  try {
    const st = statSync(abs);
    return { mtimeMs: st.mtimeMs, size: st.size };
  } catch {
    return { mtimeMs: 0, size: 0 };
  }
}
