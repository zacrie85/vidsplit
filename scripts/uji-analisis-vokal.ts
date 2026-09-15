// ANALISIS VOKALGEN v3 — ukur seberapa besar KARAKTER VOKAL benar-benar berubah
// oleh genre vokal. Jawaban utk "coba kamu analisa dan lansung coba vokal genre
// nya apakah terjadi perubahan pada suara asli yang masuk".
// METODE A/B (jujur thd pipeline): dua hasil dari GRAF SAMA —
//   out_A = genreVokal aktif (mis. dangdut 100) · out_B = genreVokal "mati".
// Semua tahap akhir (volume/limiter + delay lookahead) identik → selisihnya
// murni efek genre vokal. Metrik = korelasi Pearson-lag0 per pita:
//   perubahan % = (1 − corr)×100 : 0% = identik · 100% = terganti total.
//   · pita VOKAL = tengah (L+R)/2 180–3800 Hz → ingin BESAR
//   · pita INSTRUMEN = sisi (L−R) 180–3800 Hz → ingin KECIL (utuh)
// Uji-diri: salinan → 0%, derau → ~100%, gain murni → 0%.
// Jalankan: bun scripts/uji-analisis-vokal.ts [--bersih]
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { bangunFilterAudio } from "../src/lib/vidsplit/musik";

const D = 14;
const DIR = "work/analisis-vokal";
mkdirSync(DIR, { recursive: true });

function rmsD(sinyal: string): number {
  const out = execSync(
    `ffmpeg -hide_banner -i "${sinyal}" -af "astats" -f null - 2>&1 | grep "RMS level dB" || true`,
  ).toString().trim().split("\n");
  const m = /RMS level dB:\s*(-?[\d.]+)/.exec(out[out.length - 1] ?? "");
  return m ? Number(m[1]) : -160;
}

/** perubahan % antara dua berkas pada pita hasil `ekstraksi` (mono keluaran). */
function perubahanPct(a: string, b: string, ekstraksi: string): number {
  const ba = `${DIR}/band-a.wav`;
  const bb = `${DIR}/band-b.wav`;
  execSync(`ffmpeg -y -hide_banner -loglevel error -i "${a}" -af "${ekstraksi}" -c:a pcm_s16le "${ba}"`);
  execSync(`ffmpeg -y -hide_banner -loglevel error -i "${b}" -af "${ekstraksi}" -c:a pcm_s16le "${bb}"`);
  const ra = rmsD(ba);
  const rb = rmsD(bb);
  execSync(
    `ffmpeg -y -hide_banner -loglevel error -i "${ba}" -i "${bb}" ` +
    `-filter_complex "[0:a][1:a]amerge=inputs=2,pan=mono|c0=0.5*c0+-0.5*c1" -c:a pcm_s16le "${DIR}/diff.wav"`,
  );
  const rd = rmsD(`${DIR}/diff.wav`);
  if (rd <= -159 || ra <= -159 || rb <= -159) return 0; // pita bisu → identik
  const A = Math.pow(10, ra / 20), B = Math.pow(10, rb / 20), C = Math.pow(10, rd / 20) * 2; // pan membagi 2
  const corr = Math.max(-1, Math.min(1, (A * A + B * B - C * C) / (2 * A * B)));
  return (1 - corr) * 100;
}

const EKSTRAKSI_VOKAL = "aformat=channel_layouts=stereo,pan=mono|c0=0.5*c0+0.5*c1,highpass=f=180,lowpass=f=3800";
const EKSTRAKSI_SISI = "aformat=channel_layouts=stereo,pan=mono|c0=0.5*c0+-0.5*c1,highpass=f=180,lowpass=f=3800";

/** Lagu sintetis: vokal+bass TENGAH, melodi kiri, akor kanan, perkusi tengah. */
function buatLaguUji(): string {
  const f = `${DIR}/lagu.wav`;
  if (existsSync(f)) return f;
  const vok = `sine=frequency=440:duration=${D},tremolo=f=5.5:d=0.35,volume=0.20`;
  const vok2 = `sine=frequency=880:duration=${D},tremolo=f=5.5:d=0.3,volume=0.065`;
  const vok3 = `sine=frequency=1320:duration=${D},volume=0.03`;
  const bass = `sine=frequency=110:duration=${D},volume=0.18`;
  const mel = `sine=frequency=880:duration=${D},volume=0.14`;
  const akor = `sine=frequency=660:duration=${D},volume=0.14`;
  const perk = `anoisesrc=d=${D}:c=pink:r=44100:a=0.06,highpass=f=3000,lowpass=f=9000`;
  execSync(
    `ffmpeg -y -hide_banner -loglevel error ` +
    [vok, vok2, vok3, bass, mel, akor].map((s) => `-f lavfi -i "${s}"`).join(" ") +
    ` -f lavfi -i "${perk}" ` +
    `-filter_complex "[0:a][1:a][2:a]amix=3:normalize=0[vt];` +
    `[vt][3:a]amerge=inputs=2,pan=stereo|c0=0.6*c0+0.6*c1|c1=0.6*c0+0.6*c1[vc];` +
    `[4:a][5:a]amerge=inputs=2,pan=stereo|c0=c0|c1=c1[vi];` +
    `[vc][vi][6:a]amix=3:normalize=0,aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo" ` +
    `-c:a pcm_s16le "${f}"`,
  );
  return f;
}

// ============ UJI-DIRI METRIK ============
const src = buatLaguUji();
{
  const salin = `${DIR}/salin.wav`;
  const derau = `${DIR}/derau.wav`;
  const gainP = `${DIR}/gain.wav`;
  if (!existsSync(salin)) execSync(`ffmpeg -y -hide_banner -loglevel error -i "${src}" -c:a pcm_s16le "${salin}"`);
  if (!existsSync(derau)) execSync(`ffmpeg -y -hide_banner -loglevel error -f lavfi -i "anoisesrc=d=${D}:c=white:r=44100:a=0.08" -c:a pcm_s16le "${derau}"`);
  if (!existsSync(gainP)) execSync(`ffmpeg -y -hide_banner -loglevel error -i "${src}" -af "volume=6dB" -c:a pcm_s16le "${gainP}"`);
  const pSalin = perubahanPct(src, salin, EKSTRAKSI_VOKAL);
  const pDerau = perubahanPct(src, derau, EKSTRAKSI_VOKAL);
  const pGain = perubahanPct(src, gainP, EKSTRAKSI_VOKAL);
  console.log(`Uji-diri metrik: salinan=${pSalin.toFixed(1)}% (≈0) · derau=${pDerau.toFixed(1)}% (≈100) · gain murni=${pGain.toFixed(1)}% (≈0)`);
  if (pSalin > 5 || pDerau < 80 || pGain > 5) {
    console.error("METRIK TIDAK VALID — hentikan");
    process.exit(1);
  }
}

// ============ KASUS A/B (graf sama, genreVokal aktif vs mati) ============
const dasar = {
  file: src, judul: "Analisis", genre: "asli" as const,
  layerLevel: 0, karaoke: "asli" as const, bpm: 120, fase: 0, mode: "remake" as const,
};
const kasus = [
  { nama: "dangdut+Elvi 55 (bawaan)", opsi: { ...dasar, genreVokal: "dangdut" as const, refVokal: "dangdut-w1", tingkatVokal: 55 } },
  { nama: "dangdut+Elvi 100", opsi: { ...dasar, genreVokal: "dangdut" as const, refVokal: "dangdut-w1", tingkatVokal: 100 } },
  { nama: "rock+Albar 80", opsi: { ...dasar, genreVokal: "rock" as const, refVokal: "rock-p1", tingkatVokal: 80 } },
];

const outMati = `${DIR}/out-mati.wav`;
{
  const g = bangunFilterAudio({ ...dasar, genreVokal: "mati" } as never);
  execSync(`ffmpeg -y -hide_banner -loglevel error -i "${src}" -filter_complex "${g.graf.replace(/"/g, '\\"')}" -map "[aout]" -c:a pcm_s16le "${outMati}"`);
}

let gagal = 0;
for (const k of kasus) {
  const g = bangunFilterAudio(k.opsi as never);
  const out = `${DIR}/out-${k.nama.replace(/[^a-z0-9]+/gi, "-")}.wav`;
  try {
    execSync(
      `ffmpeg -y -hide_banner -loglevel error -i "${src}" -filter_complex "${g.graf.replace(/"/g, '\\"')}" -map "[aout]" -c:a pcm_s16le "${out}"`,
    );
    const vok = perubahanPct(out, outMati, EKSTRAKSI_VOKAL);
    const sis = perubahanPct(out, outMati, EKSTRAKSI_SISI);
    console.log(
      `== ${k.nama}\n` +
      `   perubahan KARAKTER VOKAL (tengah 180–3800): ${vok.toFixed(0)}% ${vok > 45 ? "<<< DIGANTI JELAS" : vok > 20 ? "terdengar" : "!! nyaris tak berubah"}\n` +
      `   perubahan INSTRUMEN (sisi):                 ${sis.toFixed(0)}% ${sis < 25 ? "(instrumen tetap utuh)" : "(instrumen ikut berubah)"}\n`,
    );
  } catch (e) {
    console.error(`== ${k.nama}: GAGAL-ffmpeg\n${String(e).slice(0, 400)}`);
    gagal++;
  }
}
if (process.argv.includes("--bersih")) rmSync(DIR, { recursive: true, force: true });
console.log(gagal === 0 ? "ANALISIS SELESAI" : `${gagal} KASUS GAGAL`);
process.exit(gagal === 0 ? 0 : 1);
