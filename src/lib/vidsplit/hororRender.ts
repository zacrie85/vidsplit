// VidSplit v0.25.0 — RENDER VIDEO ILUSTRASI HOROR:
// latar procedural ffmpeg (gradient gelap + grain hidup + vignette + kilat) +
// halaman teks narasi (resvg) overlay fade + audio (narasi TTS + musik horor
// volume diatur) -> chunk .ts -> concat -c copy. Semua argumen murni & teruji unit.
import type { Cerita } from "./hororCerita";
import { estimasiDurasi } from "./hororCerita";
import type { IntensitasHoror } from "./hororMusik";

export interface TemaHoror {
  id: string;
  nama: string;
  grad: [string, string];
  aksen: string;
  teks: string;
  /** kepadatan grain 1..14 */
  grain: number;
  /** jumlah kilat per 2 menit */
  kilat: number;
}

export const TEMA_HOROR: TemaHoror[] = [
  { id: "kelam", nama: "Kelam Api", grad: ["#0a0a0c", "#1d0d10"], aksen: "#c1272d", teks: "#e8e2e2", grain: 7, kilat: 3 },
  { id: "kabut", nama: "Kabut Sawah", grad: ["#0b1210", "#1c2b24"], aksen: "#8fb996", teks: "#dfe8e0", grain: 10, kilat: 2 },
  { id: "darah", nama: "Darah Lama", grad: ["#120608", "#2a0d12"], aksen: "#ff5c5c", teks: "#f2dede", grain: 8, kilat: 5 },
  { id: "purnama", nama: "Purnama Biru", grad: ["#070d1a", "#101c33"], aksen: "#7fb0ff", teks: "#dde8f7", grain: 6, kilat: 2 },
];

export type RasioHoror = "9:16" | "16:9";
export type ResolusiHoror = "720p" | "1080p";

export function ukuranHoror(rasio: RasioHoror, resolusi: ResolusiHoror): [number, number] {
  const p = resolusi === "1080p" ? 1080 : 720;
  return rasio === "9:16" ? [p, Math.round(p * 16 / 9)] : [Math.round(p * 16 / 9), p];
}

export interface OpsiRenderHoror {
  cerita: Cerita;
  judul?: string;
  narasi: boolean;
  kecepatanNarasi?: number;
  volumeNarasi?: number;
  suaraNarasi?: string;
  intensitasMusik?: IntensitasHoror;
  volumeMusik?: number; // 0..1.5
  rasio?: RasioHoror;
  resolusi?: ResolusiHoror;
  temaId?: string;
}

export interface HalamanRencana {
  besar: string;
  label?: string;
  footer?: string;
  skala: number;
  durasi: number;
  /** file wav narasi (path absolut) atau null */
  wav: string | null;
}

/** Susun rencana halaman: judul (7s) + [bab: label (3.5s) + paragraf] + tamat (6s) */
export function rencanaHoror(cerita: Cerita, opsi: OpsiRenderHoror, durasiParagraf: number[][], wavParagraf: (string | null)[][]): HalamanRencana[] {
  const halaman: HalamanRencana[] = [];
  const judul = (opsi.judul || cerita.judul).trim();
  halaman.push({ besar: judul, label: "Sebuah Cerita Horor", skala: 1.25, durasi: 7, wav: null });
  cerita.bab.forEach((bab, i) => {
    halaman.push({ besar: bab.judul, label: `BAB ${i + 1}`, skala: 1.1, durasi: 3.5, wav: null });
    bab.paragraf.forEach((p, j) => {
      const dTerukur = durasiParagraf[i]?.[j];
      halaman.push({
        besar: p,
        skala: 0.95,
        durasi: dTerukur && dTerukur > 0 ? dTerukur : estimasiDurasi(p),
        wav: wavParagraf[i]?.[j] ?? null,
      });
    });
  });
  halaman.push({ besar: "TAMAT", label: cerita.judul, skala: 1.3, durasi: 6, wav: null });
  return halaman;
}

/** pecah halaman jadi chunk: maksimal 14 halaman ATAU 150 detik per chunk */
export function pecahChunk(halaman: HalamanRencana[]): number[][] {
  const chunk: number[][] = [];
  let kini: number[] = [];
  let sisa = 150;
  halaman.forEach((h, i) => {
    if (kini.length >= 14 || h.durasi > sisa) {
      if (kini.length) chunk.push(kini);
      kini = [];
      sisa = 150;
    }
    kini.push(i);
    sisa -= h.durasi;
  });
  if (kini.length) chunk.push(kini);
  return chunk;
}

function hexFf(hex: string): string {
  return `0x${hex.replace("#", "")}`;
}

/** Argumen ffmpeg utk membuat latar PNG statis (satu per job) */
export function buatArgumenLatar(tema: TemaHoror, lebar: number, tinggi: number, keluar: string): string[] {
  return [
    "-y", "-f", "lavfi",
    "-i", `gradients=s=${lebar}x${tinggi}:c0=${hexFf(tema.grad[0])}:c1=${hexFf(tema.grad[1])}:x0=0:y0=0:x1=${lebar}:y1=${tinggi}:nb_colors=2`,
    "-frames:v", "1",
    "-update", "1",
    keluar,
  ];
}

/** Waktu kilat (dtk, relatif chunk) — deterministik per indeks chunk */
export function waktuKilat(tema: TemaHoror, durasiChunk: number, indeksChunk: number, seedCerita: number): number[] {
  const jumlah = Math.min(4, Math.max(0, Math.round((tema.kilat * durasiChunk) / 120)));
  const out: number[] = [];
  for (let i = 0; i < jumlah; i++) {
    const gabung = (seedCerita * 7919 + indeksChunk * 104729 + i * 1299709) >>> 0;
    out.push(((gabung % Math.max(1, Math.floor(durasiChunk - 1))) + 0.5));
  }
  return out.sort((a, b) => a - b);
}

export interface OpsiChunk {
  tema: TemaHoror;
  lebar: number;
  tinggi: number;
  /** png latar gradient (absolut) */
  pngLatar: string;
  /** halaman milik chunk ini (sudah beroffset waktu) */
  halaman: { pngAbs: string; t0: number; t1: number }[];
  /** wav narasi milik chunk ini, urut */
  wav: string[];
  /** wav musik pola (absolut) */
  musikAbs: string;
  volumeMusik: number;
  volumeNarasi: number;
  durasi: number;
  kilat: number[];
  keluar: string;
}

/** Argumen ffmpeg SATU CHUNK: latar+grain+vignette+kilat+halaman overlay+fades + audio mix.
 *  INDUKS INPUT: 0 = dasar hitam lavfi, 1 = png latar, 2..2+n-1 = halaman,
 *  lalu wav narasi, terakhir musik. */
export function buatArgumenChunk(o: OpsiChunk): string[] {
  const masuk: string[] = ["-y", "-f", "lavfi", "-i", `color=c=black:s=${o.lebar}x${o.tinggi}:r=30`];
  let idx = 1; // input berikutnya
  const idxLatar = 0;
  masuk.push("-loop", "1", "-i", o.pngLatar);
  const idxLatarGrad = idx++;
  const idxHalaman: number[] = [];
  for (const h of o.halaman) { masuk.push("-loop", "1", "-i", h.pngAbs); idxHalaman.push(idx++); }
  const idxWav: number[] = [];
  for (const w of o.wav) { masuk.push("-i", w); idxWav.push(idx++); }
  masuk.push("-stream_loop", "-1", "-i", o.musikAbs);
  const idxMusik = idx++;

  const fc: string[] = [];
  fc.push(`[${idxLatar}:v]format=yuv420p[blk]`);
  fc.push(`[${idxLatarGrad}:v]noise=alls=${o.tema.grain}:allf=t,vignette=PI/4.5[bg]`);
  fc.push(`[blk][bg]overlay=0:0[bgx]`);
  let vini = "bgx";
  o.halaman.forEach((h, i) => {
    const idx = idxHalaman[i];
    fc.push(`[${idx}:v]format=rgba,fade=t=in:st=${h.t0.toFixed(2)}:d=0.55:alpha=1,fade=t=out:st=${Math.max(0, h.t1 - 0.55).toFixed(2)}:d=0.55:alpha=1[pg${i}]`);
    fc.push(`[${vini}][pg${i}]overlay=0:0:enable='between(t,${h.t0.toFixed(2)},${h.t1.toFixed(2)})'[ov${i}]`);
    vini = `ov${i}`;
  });
  // kilat: overlay putih singkat
  o.kilat.forEach((t, i) => {
    const durasiKilat = 0.16;
    fc.push(`color=c=white:s=${o.lebar}x${o.tinggi}:d=${durasiKilat}:r=30,fade=t=in:st=0:d=0.05,fade=t=out:st=${(durasiKilat - 0.05).toFixed(2)}:d=0.05,setpts=PTS-STARTPTS+${t.toFixed(2)}/TB[kl${i}]`);
    fc.push(`[${vini}][kl${i}]overlay=0:0:enable='between(t,${t.toFixed(2)},${(t + durasiKilat).toFixed(2)})'[klv${i}]`);
    vini = `klv${i}`;
  });
  fc.push(`[${vini}]format=yuv420p[vout]`);

  if (o.wav.length) {
    fc.push(`${o.wav.map((_, i) => `[${idxWav[i]}:a]aresample=44100,aformat=channel_layouts=stereo,volume=${o.volumeNarasi.toFixed(2)}[na${i}]`).join(";")}`);
    fc.push(`${o.wav.map((_, i) => `[na${i}]`).join("")}concat=n=${o.wav.length}:v=0:a=1[bad]`);
    fc.push(`[${idxMusik}:a]atrim=0:${o.durasi.toFixed(2)},asetpts=PTS-STARTPTS,aresample=44100,aformat=channel_layouts=stereo,volume=${o.volumeMusik.toFixed(2)},afade=t=out:st=${Math.max(0, o.durasi - 1.2).toFixed(2)}:d=1.2[mus]`);
    fc.push(`[bad][mus]amix=inputs=2:duration=first:normalize=0[aout]`);
  } else {
    fc.push(`[${idxMusik}:a]atrim=0:${o.durasi.toFixed(2)},asetpts=PTS-STARTPTS,aresample=44100,aformat=channel_layouts=stereo,volume=${o.volumeMusik.toFixed(2)},afade=out:st=${Math.max(0, o.durasi - 1.2).toFixed(2)}:d=1.2[aout]`);
  }

  return [
    ...masuk,
    "-filter_complex", fc.join(";"),
    "-map", "[vout]", "-map", "[aout]",
    "-t", o.durasi.toFixed(2),
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
    "-c:a", "aac", "-b:a", "192k",
    "-r", "30", "-pix_fmt", "yuv420p",
    "-f", "mpegts", o.keluar,
  ];
}

/** Argumen concat chunk .ts -> mp4 final (list file ditulis terpisah via isiListConcat) */
export function buatArgumenConcat(listAbs: string, keluar: string): string[] {
  return ["-y", "-f", "concat", "-safe", "0", "-i", listAbs, "-c", "copy", "-movflags", "+faststart", keluar];
}

/** isi file list concat (dipakai jobs) */
export function isiListConcat(daftarTs: string[]): string {
  return daftarTs.map((f) => `file '${f.replace(/'/g, "'\\''")}'`).join("\n") + "\n";
}
