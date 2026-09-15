// v0.20.0 — UJI NYATA PISAH VOKAL AI (Kim_Vocal_2) + PERBANDINGAN vs DSP lama (v0.19)
// Membuktikan "suara vokal asli benar-benar hilang" DGN ANGKA pada lagu sintetis yang
// meniru rekaman komersial: vokal tengah + REVERB/HAAS (menyebar ke samping — cermin
// lagu asli), bass tengah, instrumen stereo lebar.
// Metrik: (A) penurunan energi pita suara 300-3400 Hz kanal TENGAH di instrumental,
//         (B) korelasi stem vokal dgn sumber vokal asli (seberapa utuh vokalnya),
//         (C) bass 40-150 Hz tetap di instrumental (musik tidak ikut rusak),
//         (D) pembanding DSP grafPisahVokalMusik v0.19 pada lagu yang sama.
// Jalankan: bun scripts/uji-vokal-ai.ts
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { pastikanStemAi, aiTersedia } from "../src/lib/vidsplit/vokalAi";
import { grafPisahVokalMusik } from "../src/lib/vidsplit/musik";

const DUR = 18.2;
const DIR = path.resolve("work/uji-vokal-ai");
const SR = 44100;
const TTS_MENTAH = path.join(DIR, "tts-mentah.wav"); // vokal MANUSIA nyata (TTS)

function jalan(args: string[], label: string): void {
  const r = spawnSync("ffmpeg", ["-y", "-hide_banner", "-v", "error", ...args], { stdio: ["ignore", "pipe", "pipe"] });
  if (r.status !== 0) {
    console.error(`GAGAL ${label}:`, r.stderr.toString().slice(-500));
    process.exit(1);
  }
}

async function dekodeF32(abs: string): Promise<{ l: Float32Array; r: Float32Array; total: number }> {
  const r = spawnSync("ffmpeg", ["-v", "error", "-i", abs, "-map", "0:a:0", "-ac", "2", "-ar", String(SR), "-f", "f32le", "pipe:1"], { maxBuffer: 1024 * 1024 * 256 });
  if (r.status !== 0 || !r.stdout.length) throw new Error(`dekode gagal: ${abs}`);
  const n = Math.floor(r.stdout.length / 8);
  const l = new Float32Array(n), rr = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    l[i] = r.stdout.readFloatLE(i * 8);
    rr[i] = r.stdout.readFloatLE(i * 8 + 4);
  }
  return { l, r: rr, total: n };
}

// ---------- DSP metrik (STFT rata energi per pita) ----------
const { stftChunk } = await import("../src/lib/vidsplit/vokalAi");
function energiPita(l: Float32Array, r: Float32Array, f1: number, f2: number): number {
  const N_FFT = 6144, HOP = 1024, DIM_F = 3072;
  const k1 = Math.max(0, Math.floor((f1 / (SR / N_FFT))));
  const k2 = Math.min(DIM_F - 1, Math.ceil((f2 / (SR / N_FFT))));
  const CL = 261120;
  let total = 0, jum = 0;
  for (let of = 0; of + CL <= l.length; of += CL) {
    const cl = l.subarray(of, of + CL), cr = r.subarray(of, of + CL);
    const spek = stftChunk(cl, cr);
    for (let t = 0; t < 256; t += 4) {
      let e = 0;
      for (let k = k1; k <= k2; k++) {
        const d = k * 256 + t;
        const re = spek[d], im = spek[DIM_F * 256 + d];
        e += re * re + im * im;
      }
      total += e;
      jum++;
    }
  }
  return jum ? total / jum : 0;
}
function tengah(x: Float32Array, y: Float32Array): Float32Array {
  const out = new Float32Array(x.length);
  for (let i = 0; i < x.length; i++) out[i] = 0.5 * (x[i] + y[i]);
  return out;
}
function korelasi(a: Float32Array, b: Float32Array): number {
  const n = Math.min(a.length, b.length);
  let sa = 0, sb = 0, sab = 0;
  for (let i = 0; i < n; i++) { sa += a[i] * a[i]; sb += b[i] * b[i]; sab += a[i] * b[i]; }
  if (sa <= 1e-20 || sb <= 1e-20) return 0;
  return sab / Math.sqrt(sa * sb);
}
/** Pecahan vokal yang MASIH tersisa di instrumental: proyeksi least-squares
 *  instrumental_tengah = instrumen + α·vokal_sumber → α = sisa vokal.
 *  "Vokal turun" = −20·log10(|α|): α=0.1 → turun 20 dB. */
function sisaVokal(instrC: Float32Array, vokSrc: Float32Array): number {
  const n = Math.min(instrC.length, vokSrc.length);
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) { num += instrC[i] * vokSrc[i]; den += vokSrc[i] * vokSrc[i]; }
  if (den <= 1e-20) return 0;
  return num / den;
}
function db(x: number): string { return `${(10 * Math.log10(Math.max(x, 1e-20))).toFixed(1)} dB`; }

// ---------- 1. bangun lagu sintetis: vokal MANUSIA (TTS) + reverb + spread + instrumen ----------
mkdirSync(DIR, { recursive: true });
if (!existsSync(TTS_MENTAH)) {
  console.error(`Vokal TTS tidak ada: ${TTS_MENTAH} — jalankan z-ai tts dulu`);
  process.exit(1);
}
const lagu = path.join(DIR, "lagu.mp3");
const vokalAsli = path.join(DIR, "vokal-asli.wav");
const efekVokal = "aresample=44100,aecho=0.85:0.35:29|58:0.3|0.15,apad,atrim=duration=" + DUR;
jalan(["-i", TTS_MENTAH, "-af", efekVokal, vokalAsli], "vokal asli (manusia)");
const vokalSpread = path.join(DIR, "vokal-spread.wav");
jalan(["-i", vokalAsli, "-af", "pan=stereo|c0=c0|c1=c0,adelay=0|11", vokalSpread], "vokal spread");
jalan([
  "-i", vokalSpread,
  "-f", "lavfi", "-t", String(DUR), "-i", `sine=frequency=55:sample_rate=${SR}`,
  "-f", "lavfi", "-t", String(DUR), "-i", `anoisesrc=d=${DUR}:c=pink:r=${SR}:a=0.6:seed=11`,
  "-f", "lavfi", "-t", String(DUR), "-i", `anoisesrc=d=${DUR}:c=pink:r=${SR}:a=0.6:seed=77`,
  "-f", "lavfi", "-t", String(DUR), "-i", `sine=frequency=1174:sample_rate=${SR}`,
  "-f", "lavfi", "-t", String(DUR), "-i", `sine=frequency=830:sample_rate=${SR}`,
  "-filter_complex",
  [
    "[0:a]volume=0.9[vok]", // vokal manusia tengah + haas 11ms + reverb (seperti rekaman asli)
    "[1:a]tremolo=f=2:d=0.55,volume=0.55,pan=stereo|c0=c0|c1=c0[bas]",
    "[2:a]volume=0.16,highpass=f=300,pan=stereo|c0=c0|c1=0*c0[noiL]",
    "[3:a]volume=0.16,highpass=f=300,pan=stereo|c0=0*c0|c1=c0[noiR]",
    "[4:a]tremolo=f=6.8:d=0.9,volume=0.06,pan=stereo|c0=c0|c1=0*c0[belL]",
    "[5:a]tremolo=f=5.2:d=0.9,volume=0.06,pan=stereo|c0=0*c0|c1=c0[belR]",
    "[noiL][belL]amix=inputs=2:normalize=0[cL]",
    "[noiR][belR]amix=inputs=2:normalize=0[cR]",
    "[vok][bas][cL][cR]amix=inputs=4:normalize=0,volume=0.85[out]",
  ].join(";"),
  "-map", "[out]", "-b:a", "192k", lagu,
], "lagu sintetis");

// ---------- 2. jalankan AI ----------
if (!(await aiTersedia())) {
  console.error("Mesin AI tidak tersedia (model/runtime tidak ditemukan)");
  process.exit(1);
}
console.log("Memisahkan dengan AI Kim_Vocal_2 (±20-30 dtk di sandbox)…");
const t0 = Date.now();
const stem = await pastikanStemAi(lagu, (f) => {
  process.stdout.write(`\r  AI progres: ${Math.round(f * 100)}%  `);
});
process.stdout.write(`\n  selesai dalam ${((Date.now() - t0) / 1000).toFixed(1)} dtk (cache: ${stem.dariCache})\n`);

// baca stem dari cache f32
function bacaF32(abs: string): { l: Float32Array; r: Float32Array } {
  const buf = readFileSync(abs);
  const n = buf.length >> 3;
  const l = new Float32Array(n), r = new Float32Array(n);
  for (let i = 0; i < n; i++) { l[i] = buf.readFloatLE(i * 8); r[i] = buf.readFloatLE(i * 8 + 4); }
  return { l, r };
}
const aiV = bacaF32(stem.vokalF32);
const aiM = bacaF32(stem.musikF32);

// ---------- 3. jalankan DSP lama (v0.19) utk pembanding ----------
const dspMusik = path.join(DIR, "dsp-musik.mp3");
const dspVokal = path.join(DIR, "dsp-vokal.mp3");
jalan(["-i", lagu, "-filter_complex", grafPisahVokalMusik(),
  "-map", "[mout]", "-b:a", "320k", dspMusik,
  "-map", "[vout]", "-b:a", "320k", dspVokal], "pisah DSP");

// ---------- 4. metrik ----------
const asli = await dekodeF32(lagu);
const vok = await dekodeF32(vokalAsli);
const dspM = await dekodeF32(dspMusik);
const dspV = await dekodeF32(dspVokal);

const tengahAsli = tengah(asli.l, asli.r);
const vokS = await dekodeF32(vokalSpread);
const vokSumber = tengah(vokS.l, vokS.r); // sumber vokal dgn efek + spread (yang "masuk" ke lagu)

const eAsliVok = energiPita(asli.l, asli.r, 300, 3400);
const eAiM = energiPita(aiM.l, aiM.r, 300, 3400);
const eDspM = energiPita(dspM.l, dspM.r, 300, 3400);
const eAiV = energiPita(aiV.l, aiV.r, 300, 3400);
const eDspV = energiPita(dspV.l, dspV.r, 300, 3400);

const eBassAsli = energiPita(asli.l, asli.r, 40, 150);
const eBassAiM = energiPita(aiM.l, aiM.r, 40, 150);
const eBassDspM = energiPita(dspM.l, dspM.r, 40, 150);

// korelasi stem vokal vs sumber vokal (timbulan sama dgn yang ditanam)
const nMin = Math.min(vokSumber.length, aiV.l.length);
const aiVT = tengah(aiV.l.subarray(0, nMin), aiV.r.subarray(0, nMin));
const dspVT = tengah(dspV.l.subarray(0, nMin), dspV.r.subarray(0, nMin));
const kAi = korelasi(aiVT, vokSumber.subarray(0, nMin));
const kDsp = korelasi(dspVT, vokSumber.subarray(0, nMin));

const turunAi = 10 * Math.log10(eAsliVok / Math.max(eAiM, 1e-20));
const turunDsp = 10 * Math.log10(eAsliVok / Math.max(eDspM, 1e-20));
// sisa vokal langsung (proyeksi) — bebas dari kontribusi instrumen lain di pita
const sisaAi = sisaVokal(tengah(aiM.l, aiM.r), vokSumber);
const sisaDsp = sisaVokal(tengah(dspM.l, dspM.r), vokSumber);
const turunVokalAi = -20 * Math.log10(Math.min(1, Math.max(Math.abs(sisaAi), 1e-6)));
const turunVokalDsp = -20 * Math.log10(Math.min(1, Math.max(Math.abs(sisaDsp), 1e-6)));

console.log("\n===== HASIL TERUKUR =====");
console.log(`Energi pita SUARA 300-3400 Hz (kanal tengah):`);
console.log(`  lagu asli            : ${db(eAsliVok)}`);
console.log(`  musik AI (instrumental): ${db(eAiM)}  → vokal TURUN ${turunAi.toFixed(1)} dB`);
console.log(`  musik DSP v0.19        : ${db(eDspM)}  → vokal turun hanya ${turunDsp.toFixed(1)} dB`);
console.log(`\nEnergi BASS 40-150 Hz di instrumental:`);
console.log(`  AI : ${(100 * eBassAiM / eBassAsli).toFixed(0)}% dari asli  |  DSP: ${(100 * eBassDspM / eBassAsli).toFixed(0)}%`);
console.log(`Korelasi stem vokal vs sumber vokal asli:`);
console.log(`  AI : ${(kAi * 100).toFixed(0)}%  |  DSP: ${(kDsp * 100).toFixed(0)}%`);
console.log(`SISA vokal asli di instrumental (proyeksi langsung):`);
console.log(`  AI : ${(Math.abs(sisaAi) * 100).toFixed(1)}% (turun ${turunVokalAi.toFixed(1)} dB)  |  DSP: ${(Math.abs(sisaDsp) * 100).toFixed(1)}% (${turunVokalDsp > 0 ? "turun" : "BERTAMBAH"} ${Math.abs(turunVokalDsp).toFixed(1)} dB)`);

let gagal = 0;
function cek(nama: string, ok: boolean, detail: string) {
  console.log(`${ok ? "LOLOS" : "GAGAL"} — ${nama} (${detail})`);
  if (!ok) gagal++;
}
console.log("\n===== KESIMPULAN =====");
cek("AI: vokal utuh di stem vokal (korelasi ≥ 85%)", kAi >= 0.85, `${(kAi * 100).toFixed(0)}%`);
cek("AI: sisa vokal di instrumental ≤ 10% (turun ≥ 20 dB)", Math.abs(sisaAi) <= 0.1, `${(Math.abs(sisaAi) * 100).toFixed(1)}% = ${turunVokalAi.toFixed(1)} dB`);
cek("AI lebih baik dari DSP v0.19 (sisa vokal)", Math.abs(sisaAi) < Math.abs(sisaDsp) / 2, `AI ${(Math.abs(sisaAi) * 100).toFixed(1)}% vs DSP ${(Math.abs(sisaDsp) * 100).toFixed(1)}%`);
cek("AI: bass musik utuh di instrumental (≥ 55%)", eBassAiM / eBassAsli >= 0.55, `${(100 * eBassAiM / eBassAsli).toFixed(0)}%`);
cek("AI: vokal lebih bersih dari DSP", kAi > kDsp, `AI ${(kAi * 100).toFixed(0)}% vs DSP ${(kDsp * 100).toFixed(0)}%`);

console.log(gagal === 0 ? "\nPISAH VOKAL AI TERBUKTI BEKERJA ✓" : `\n${gagal} kriteria gagal`);
process.exit(gagal === 0 ? 0 : 1);
