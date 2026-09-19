// VidSplit v0.25.0 — RENDER VIDEO ILUSTRASI HOROR:
// latar procedural ffmpeg (gradient gelap + grain hidup + vignette + kilat) +
// halaman teks narasi (resvg) overlay fade + audio (narasi TTS + musik horor
// volume diatur) -> chunk .ts -> concat -c copy. Semua argumen murni & teruji unit.
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Cerita } from "./hororCerita";
import { estimasiDurasi } from "./hororCerita";
import type { IntensitasHoror } from "./hororMusik";
import { jenisAdeganBab, type JenisAdegan } from "./hororIlustrasi";
import { ambilGenre, type GenreId } from "./videoAi";

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
  // v0.29.0 — tema visual utk genre cerah (tanpa kilat, grain halus)
  { id: "fajar", nama: "Fajar Harapan", grad: ["#1a0f0a", "#4a2413"], aksen: "#ffb454", teks: "#f7ead9", grain: 3, kilat: 0 },
  { id: "permata", nama: "Permata Dongeng", grad: ["#0d0a1a", "#241533"], aksen: "#c9a6ff", teks: "#efe6ff", grain: 3, kilat: 0 },
  { id: "lautteduh", nama: "Laut Teduh", grad: ["#06121a", "#0f2b3a"], aksen: "#5fd4c8", teks: "#dff4f2", grain: 3, kilat: 0 },
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
  /** v0.26.0 — "sintesis" (bawaan) | id MUSIK_BUNDEL | "impor" (pakai musikImporRel) */
  sumberMusik?: string;
  /** v0.26.0 — path relatif work/ utk musik impor (dipakai bila sumberMusik="impor") */
  musikImporRel?: string;
  /** v0.26.0 — ilustrasi komik prosedural pada halaman (bawaan: aktif) */
  ilustrasi?: boolean;
  /** v0.28.0 — mesin suara pembaca: "ai" (Piper neural, disarankan) | "windows" (SAPI) */
  mesinNarasi?: "ai" | "windows";
  /** v0.29.0 — genre AI Video Generator (bawaan: ikut cerita.genre / horor) */
  genreId?: GenreId;
  /** v0.30.0 — gaya video: "komik" (bawaan: gambar atas + kolom cerita bawah,
   *  adegan berganti ±3 dtk, tanpa tulisan bab) | "halaman" (gaya lama v0.25-0.29) */
  gaya?: "komik" | "halaman";
}

export interface HalamanRencana {
  besar: string;
  label?: string;
  footer?: string;
  skala: number;
  durasi: number;
  /** file wav narasi (path absolut) atau null */
  wav: string | null;
  /** v0.26.0 — jenis adegan ilustrasi halaman ini (null = tanpa ilustrasi) */
  adeganJenis?: JenisAdegan | null;
  adeganSeed?: number;
  /** bawaan halaman (judul/tamat) memakai adegan penuh; narasi ambient redup */
  adeganPenuh?: boolean;
}

/** Susun rencana halaman: judul (7s) + [bab: label (3.5s) + paragraf] + tamat (6s).
 *  v0.26.0 — tiap bab dapat adegan ilustrasi berbeda (deterministik). */
export function rencanaHoror(cerita: Cerita, opsi: OpsiRenderHoror, durasiParagraf: number[][], wavParagraf: (string | null)[][]): HalamanRencana[] {
  const halaman: HalamanRencana[] = [];
  const judul = (opsi.judul || cerita.judul).trim();
  const pakaiIlustrasi = opsi.ilustrasi !== false;
  // v0.29.0 — genre: opsi eksplisit > cerita.genre > horor; adegan & label ikut genre
  const genreAdegan = (opsi.genreId ?? (cerita.genre as GenreId | undefined) ?? "horor") as GenreId;
  const gInfo = ambilGenre(genreAdegan);
  const adegan = (i: number, penuh: boolean): { adeganJenis?: JenisAdegan | null; adeganSeed?: number; adeganPenuh?: boolean } =>
    pakaiIlustrasi
      ? { adeganJenis: jenisAdeganBab(i, cerita.seed, genreAdegan), adeganSeed: (cerita.seed ^ (i * 2246822519)) >>> 0, adeganPenuh: penuh }
      : {};
  halaman.push({ besar: judul, label: gInfo.labelJudul, skala: 1.25, durasi: 7, wav: null, ...adegan(0, true) });
  cerita.bab.forEach((bab, i) => {
    halaman.push({ besar: bab.judul, label: `BAB ${i + 1}`, skala: 1.1, durasi: 3.5, wav: null, ...adegan(i + 1, true) });
    bab.paragraf.forEach((p, j) => {
      const dTerukur = durasiParagraf[i]?.[j];
      halaman.push({
        besar: p,
        skala: 0.95,
        durasi: dTerukur && dTerukur > 0 ? dTerukur : estimasiDurasi(p),
        wav: wavParagraf[i]?.[j] ?? null,
        ...adegan(i + 1, false),
      });
    });
  });
  halaman.push({ besar: "TAMAT", label: cerita.judul, skala: 1.3, durasi: 6, wav: null, ...adegan(cerita.bab.length + 1, true) });
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

// ==================== v0.30.0 — AI TEXT-TO-VIDEO GENERATOR (VERSI KOMIK) ====================
// Satu adegan = satu segmen video: ilustrasi komik di ATAS dgn gerak kamera AI
// (zoompan / Ken Burns), kolom teks cerita di BAWAH, audio narasi TTS adegan itu
// di-pad persis sepanjang adegan → video & suara SINKRON by construction
// (durasi adegan ditentukan durasi narasinya). Semua segmen di-concat -c copy,
// musik disisipkan di pos akhir tanpa menyentuh jalur video (-c:v copy).

/** Tata letak panel komik: gambar atas (panelTinggi), kolom cerita di bawahnya. */
export function tataLetakKomik(lebar: number, tinggi: number): { panelY: number; panelTinggi: number } {
  const porsi = tinggi > lebar ? 0.62 : 0.6; // 9:16 → 62% gambar; 16:9 → 60% gambar
  const panelTinggi = Math.max(120, Math.round(tinggi * porsi));
  return { panelY: 0, panelTinggi };
}

/** Durasi adegan: mengikuti durasi narasi TTS (+jeda napas), minimum ~3 detik
 *  supaya gambar berganti ±3 dtk mengikuti alur cerita. Kelipatan 1/30 dtk. */
export function durasiAdeganKomik(durasiTts: number, teks: string): number {
  const kata = teks.split(/\s+/).filter(Boolean).length;
  const target = durasiTts > 0.3 ? durasiTts + 0.55 : Math.max(3.2, kata / 2.6 + 1.6);
  const frames = Math.max(90, Math.ceil(target * 30)); // minimum 3.0 dtk
  return frames / 30;
}

/** Ekspresi zoompan (Ken Burns) per gaya kamera. D = jumlah frame adegan. */
export function ekspresiZoompan(kamera: string, D: number): { z: string; x: string; y: string } {
  const cx = "iw/2-(iw/zoom/2)", cy = "ih/2-(ih/zoom/2)";
  const maju = `min(1,on/${D})`;
  switch (kamera) {
    case "keluar":
      return { z: `max(1.001,1.10-0.10*on/${D})`, x: cx, y: cy };
    case "geser-kanan":
      return { z: "1.08", x: `(iw-iw/zoom)*${maju}`, y: `(ih-ih/zoom)/2` };
    case "geser-kiri":
      return { z: "1.08", x: `(iw-iw/zoom)*(1-${maju})`, y: `(ih-ih/zoom)/2` };
    case "dalam":
    default:
      return { z: `min(1.10,1+0.10*on/${D})`, x: cx, y: cy };
  }
}

export interface OpsiSegmenKomik {
  tema: TemaHoror;
  lebar: number;
  tinggi: number;
  /** tinggi panel ilustrasi atas (tataLetakKomik) */
  panelTinggi: number;
  /** png ilustrasi adegan (lebih besar dr panel utk ruang zoom) */
  ilustrasiAbs: string;
  /** png overlay kanvas penuh: kolom teks cerita bawah */
  panelTeksAbs: string;
  kamera: string;
  /** durasi adegan (dtk, kelipatan 1/30) */
  durasi: number;
  /** wav narasi adegan (null = hening) */
  wavAbs: string | null;
  volumeNarasi: number;
  /** true utk adegan terakhir: fade keluar */
  fadeKeluar?: boolean;
  keluar: string;
}

/** Argumen ffmpeg SATU SEGMEN ADEGAN KOMIK (mp4, siap concat -c copy).
 *  Indeks input: 0 = ilustrasi (1 frame, di-zoompan), 1 = panel teks (loop),
 *  2 = narasi wav ATAU anullsrc. Video D frame @30fps, audio di-pad persis
 *  sepanjang adegan → sinkron sempurna saat concat.
 *  v0.30.0: segmen MP4 (bukan mpegts) — stream-copy mp4 jalan di SEMUA build
 *  ffmpeg (static 7.0.x Windows/sistem baru); mpegts-copy bermasalah di sebagian
 *  build dan ber-offset PTS 1.4 dtk. */
export function buatArgumenSegmenKomik(o: OpsiSegmenKomik): string[] {
  const D = Math.max(1, Math.round(o.durasi * 30));
  const durasi = D / 30;
  const [pw, ph] = [o.lebar, o.panelTinggi];
  const zp = ekspresiZoompan(o.kamera, D);

  const masuk: string[] = [
    "-y",
    "-i", o.ilustrasiAbs, // input 0: satu frame → zoompan memperpanjang
    "-loop", "1", "-i", o.panelTeksAbs, // input 1
  ];
  if (o.wavAbs) masuk.push("-i", o.wavAbs); // input 2
  else masuk.push("-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo");

  const fc: string[] = [];
  fc.push(
    `[0:v]zoompan=z='${zp.z}':x='${zp.x}':y='${zp.y}':d=${D}:s=${pw}x${ph}:fps=30[zb]`,
  );
  fc.push(`[zb]fade=t=in:st=0:d=0.35[kb]`);
  fc.push(`[kb]pad=${o.lebar}:${o.tinggi}:0:0:color=${hexFf(o.tema.grad[0])}[pad]`);
  fc.push(`[pad][1:v]overlay=0:0[vo]`);
  const fadeOut = o.fadeKeluar ? `,fade=t=out:st=${Math.max(0, durasi - 0.7).toFixed(2)}:d=0.7` : "";
  fc.push(`[vo]format=yuv420p${fadeOut}[vout]`);
  const aFade = o.fadeKeluar ? `,afade=t=out:st=${Math.max(0, durasi - 0.7).toFixed(2)}:d=0.7` : "";
  fc.push(
    `[2:a]aresample=44100,aformat=sample_fmts=s16:channel_layouts=stereo,volume=${o.volumeNarasi.toFixed(2)},adelay=150|150,apad,atrim=0:${durasi.toFixed(4)},asetpts=N/SR/TB${aFade}[aout]`,
  );

  return [
    ...masuk,
    "-filter_complex", fc.join(";"),
    "-map", "[vout]", "-map", "[aout]",
    "-frames:v", String(D),
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
    "-c:a", "aac", "-b:a", "192k", "-ar", "44100", "-ac", "2",
    "-r", "30", "-pix_fmt", "yuv420p",
    "-f", "mp4", o.keluar,
  ];
}

/** Argumen pos akhir: sisipkan musik DI BAWAH narasi tanpa menyentuh video
 *  (-c:v copy → sinkron & cepat). */
export function buatArgumenCampurMusik(videoAbs: string, musikAbs: string, durasi: number, volumeMusik: number, keluar: string): string[] {
  const fc =
    `[1:a]atrim=0:${durasi.toFixed(2)},asetpts=PTS-STARTPTS,aresample=44100,aformat=channel_layouts=stereo,` +
    `volume=${volumeMusik.toFixed(2)},afade=t=out:st=${Math.max(0, durasi - 1.2).toFixed(2)}:d=1.2[m];` +
    `[0:a][m]amix=inputs=2:duration=first:normalize=0[aout]`;
  return [
    "-y", "-i", videoAbs, "-stream_loop", "-1", "-i", musikAbs,
    "-filter_complex", fc,
    "-map", "0:v", "-map", "[aout]",
    "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
    "-movflags", "+faststart",
    keluar,
  ];
}

// ---------- v0.26.0 — musik horor bundel (CC-BY, kredit wajib di assets/musik-horor/KREDIT.txt) ----------
export const MUSIK_BUNDEL: { id: string; nama: string; file: string; kredit: string }[] = [
  { id: "horor-ambient", nama: "Horor Ambient", file: "horor-ambient.mp3", kredit: "Vinrax — CC-BY 3.0" },
  { id: "gedung", nama: "Gedung Terbengkalai", file: "gedung-terbengkalai.mp3", kredit: "tcarisland — CC-BY 3.0" },
  { id: "kedalaman", nama: "Kedalaman Keputusasaan", file: "kedalaman-keputusasaan.mp3", kredit: "Tsorthan Grove — CC-BY 4.0" },
];

/** Cari berkas musik bundel di kandidat folder (env VIDSPLIT_MUSIK / cwd/assets) */
export function pathMusikBundel(file: string): string {
  const kandidat = [
    process.env.VIDSPLIT_MUSIK,
    path.join(process.cwd(), "assets", "musik-horor"),
    path.join(process.cwd(), "..", "assets", "musik-horor"),
    path.join(process.cwd(), "..", "..", "assets", "musik-horor"),
  ].filter(Boolean) as string[];
  for (const d of kandidat) {
    const p = path.join(d, file);
    try { if (readFileSync(p).length > 1000) return p; } catch { /* lanjut */ }
  }
  return path.join(process.cwd(), "assets", "musik-horor", file);
}
