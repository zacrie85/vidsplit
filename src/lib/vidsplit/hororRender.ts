// VidSplit v0.25.0 — RENDER VIDEO ILUSTRASI HOROR:
// latar procedural ffmpeg (gradient gelap + grain hidup + vignette + kilat) +
// halaman teks narasi (resvg) overlay fade + audio (narasi TTS + musik horor
// volume diatur) -> chunk .ts -> concat -c copy. Semua argumen murni & teruji unit.
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Cerita } from "./hororCerita";
import { estimasiDurasi } from "./hororCerita";
import { potonganAdegan, GRADE_JUMLAH } from "./hororGaleri";
import type { VariasiPotongan } from "./hororGaleri";
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
  /** v0.33.0 — jenis suara pembaca: "wanita" (bawaan) | "pria" (nada lebih berat,
   *  diolah 100% offline dgn penurunan nada — jalan utk mesin AI maupun Windows) */
  jenisSuaraNarasi?: "wanita" | "pria";
  /** v0.29.0 — genre AI Video Generator (bawaan: ikut cerita.genre / horor) */
  genreId?: GenreId;
  /** v0.30.0 — gaya video: "komik" (bawaan: gambar atas + kolom cerita bawah,
   *  adegan berganti ±3 dtk, tanpa tulisan bab) | "halaman" (gaya lama v0.25-0.29) */
  gaya?: "komik" | "halaman";
  /** v0.37.0 — pustaka gambar: "komik" (60 ilustrasi gaya komik, bawaan) |
   *  "realistis" (41 ilustrasi gaya still film horor fotorealistis — agen
   *  pendamping menu 5). Hanya berlaku utk gaya video "komik". */
  gayaIlustrasi?: "komik" | "realistis";
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
  /** png ilustrasi adegan (lebih besar dr panel utk ruang zoom) — jatuh bila
   *  ilustrasiAbsList tak diisi (kompatibilitas jalur lama 1 gambar/adegan) */
  ilustrasiAbs: string;
  /** v0.34.0 — daftar gambar utk POTONGAN 2 DETIK dalam satu adegan (gambar
   *  berganti cepat mengikuti hantu/latar yang disebut cerita). Panjang bebas;
   *  potongan frame dibagi otomatis ±2 dtk (potonganAdegan). */
  ilustrasiAbsList?: string[];
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
  // ---- v0.31.0 — musik latar DIMASUKKAN langsung ke TIAP segmen (pola per-chunk
  // yang terbukti aman di Windows pada jalur halaman v0.25-0.29) — TIDAK lagi lewat
  // pass akhir amix/-c:v copy yang rawan di sebagian build ffmpeg Windows. ----
  /** wav musik SUDAH diloop sepanjang video (null/absen = tanpa musik) */
  musikAbs?: string | null;
  /** posisi awal adegan ini di linimasa (dtk) — titik -ss potongan musik */
  mulaiMusik?: number;
  /** volume musik 0..1.5 */
  volumeMusik?: number;
  /** true utk adegan terakhir: musik fade-out 1.2 dtk */
  fadeMusikKeluar?: boolean;
  /** v0.32.0 — preset x264 utk percobaan ulang adegan bermasalah (bawaan veryfast) */
  preset?: string;
  /** v0.33.0 — sumber musik TAK terpotong (stream_loop -1) dan dipotong lewat
   *  atrim di dalam graf — jalur CADANGAN bila berkas musik-panjang gagal dibuat */
  musikLoopSumber?: boolean;
  /** v0.35.0 — variasi visual per potongan (flip/warna/kabut/grain) SEJAJAR dgn
   *  ilustrasiAbsList — inilah yg membuat tiap potongan 2 dtk tampil unik.
   *  Absen/null → potongan polos (kompat penuh dgn jalur lama). */
  variasiList?: (VariasiPotongan | null)[];
}

/** v0.35.0 — 8 pewarnaan sinematik utk variasi potongan (eq/hue = filter ffmpeg
 *  standar, teruji di build 7.0.2 & 7.1.5). Indeks 0 = netral. */
const GRADE_TABEL: string[] = [
  "", // 0 netral
  "eq=brightness=-0.04:saturation=0.82:contrast=1.08,hue=h=-14", // malam biru
  "eq=brightness=-0.02:saturation=0.72:contrast=1.06,hue=h=28:s=0.92", // hijau sakit
  "eq=brightness=0.02:saturation=0.5:contrast=1.02,hue=h=9:s=0.55", // sepia tua
  "hue=s=0,eq=contrast=1.2:brightness=-0.03", // noir
  "eq=brightness=-0.05:saturation=1.25:contrast=1.12,hue=h=-24", // merah bara
  "eq=brightness=0.05:saturation=0.95:gamma=0.94,hue=h=16", // lilin hangat
  "eq=brightness=0.06:saturation=0.55:contrast=0.97", // pucat lemam
];

/** rantai filter variasi SEBELUM zoompan utk satu potongan (bisa kosong). */
function rantaiVariasi(vr: VariasiPotongan | null | undefined): string {
  if (!vr) return "";
  const s: string[] = [];
  if (vr.hflip) s.push("hflip");
  const g = GRADE_TABEL[Math.max(0, Math.min(GRADE_JUMLAH - 1, vr.grade | 0))];
  if (g) s.push(g);
  if (vr.kabut) s.push("boxblur=luma_radius=3:luma_power=1,eq=brightness=0.04:saturation=0.85");
  return s.length ? s.join(",") + "," : "";
}

/** Argumen ffmpeg SATU SEGMEN ADEGAN KOMIK (mp4, siap concat -c copy).
 *  Indeks input: 0 = ilustrasi (1 frame, di-zoompan), 1 = panel teks (loop
 *  TERBATAS -t durasi — v0.32.0), 2 = narasi wav ATAU anullsrc, 3 = musik
 *  latar (v0.31.0, opsional).
 *  Video D frame @30fps, audio di-pad persis sepanjang adegan → sinkron
 *  sempurna saat concat. Musik DISISIPKAN langsung di sini (amix dgn narasi)
 *  — pola per-chunk yang terbukti di Windows — bukan lewat pass akhir.
 *  v0.30.0: segmen MP4 (bukan mpegts) — stream-copy mp4 jalan di SEMUA build
 *  ffmpeg (static 7.0.x Windows/sistem baru); mpegts-copy bermasalah di sebagian
 *  build dan ber-offset PTS 1.4 dtk.
 *  v0.32.0 ANTI-HANG 3 lapis (laporan user: adegan 2 beku selamanya di Windows):
 *  (a) input panel teks diberi -t durasi — input loop tak lagi tak berujung;
 *  (b) apad=whole_len=N — padding audio BERBATAS sampel, tak bergantung atrim;
 *  (c) -t durasi di OUTPUT — muxer WAJIB berhenti di durasi adegan walau satu
 *  cabang filter tak pernah EOF. Dgn 3 lapis ini segmen mustahil berjalan
 *  lebih lama dr durasinya, apa pun build ffmpeg-nya. */
const KAMERA_POTONGAN = ["geser-kanan", "dalam", "geser-kiri", "keluar"] as const;

/** v0.34.0 — kamera per potongan: potongan 0 memakai kamera adegan, sisanya
 *  diputar lewat daftar variasi (gerak kamera AI berganti tiap potongan). */
function kameraPotongan(kamera: string, p: number): string {
  return p === 0 ? kamera : KAMERA_POTONGAN[(p - 1) % KAMERA_POTONGAN.length];
}

export function buatArgumenSegmenKomik(o: OpsiSegmenKomik): string[] {
  const D = Math.max(1, Math.round(o.durasi * 30));
  const durasi = D / 30;
  const [pw, ph] = [o.lebar, o.panelTinggi];
  const adaMusik = !!o.musikAbs && (o.volumeMusik ?? 0) > 0;
  // v0.34.0 — POTONGAN 2 DETIK: satu adegan = beberapa gambar yang berganti
  // tiap ±2 dtk (zoompan + concat di dalam satu ffmpeg). Kalau pemanggil tak
  // mengirim daftar → jalur lama 1 gambar utk seluruh adegan (kompat penuh).
  const daftarGambar = (o.ilustrasiAbsList?.length ? o.ilustrasiAbsList : [o.ilustrasiAbs]).slice();
  const nGambar = Math.max(1, daftarGambar.length);
  const splits0 = potonganAdegan(durasi, 2);
  let splits: number[];
  if (nGambar === 1) splits = [durasi];
  else if (daftarGambar.length === splits0.length) splits = splits0;
  else if (daftarGambar.length < splits0.length) {
    // lebih sedikit gambar dr potongan → gabung ekor (ritme 2 dtk awal tetap)
    splits = splits0.slice(0, nGambar - 1);
    splits.push(+splits0.slice(nGambar - 1).reduce((a, b) => a + b, 0).toFixed(4));
  } else {
    // lebih banyak gambar dr potongan → bagi merata
    const f = Math.floor(D / nGambar);
    let sisa = D;
    splits = [];
    for (let i = 0; i < nGambar; i++) { const fi = i === nGambar - 1 ? sisa : Math.max(1, f); splits.push(fi / 30); sisa -= fi; }
  }
  // v0.33.0 — jalur cadangan: sumber musik diloop DEMUXER (-stream_loop -1) dan
  // potongan diambil lewat atrim di dalam graf (tanpa -ss demuxer yang berperilaku
  // beda antar build Windows saat dipadukan stream_loop).
  const musikLoop = !!adaMusik && !!o.musikLoopSumber;

  const masuk: string[] = ["-y"];
  for (const g of daftarGambar) masuk.push("-i", g); // input 0..nGambar-1: potongan gambar
  const idxPanel = nGambar; // input panel teks (loop TERBATAS -t durasi)
  masuk.push("-loop", "1", "-t", durasi.toFixed(3), "-i", o.panelTeksAbs);
  const idxNarasi = idxPanel + 1;
  if (o.wavAbs) masuk.push("-i", o.wavAbs);
  else masuk.push("-f", "lavfi", "-t", durasi.toFixed(3), "-i", "anullsrc=r=44100:cl=stereo");
  let idxMusik = -1;
  if (adaMusik) {
    idxMusik = idxNarasi + 1;
    if (musikLoop) {
      // input musik (cadangan): diloop terus-menerus; potongan via atrim di graf
      masuk.push("-stream_loop", "-1", "-i", o.musikAbs!);
    } else {
      // input musik: potongan mulai posisi adegan ini (-ss input-seek, instan utk WAV)
      masuk.push("-ss", Math.max(0, o.mulaiMusik ?? 0).toFixed(3), "-t", (durasi + 0.25).toFixed(3), "-i", o.musikAbs!);
    }
  }

  const fc: string[] = [];
  // v0.34.0 — tiap potongan: pra-skala ke 1.2× panel (ruang zoom, aman utk
  // gambar galeri 1024²  maupun SVG 1.35×) lalu zoompan Ken Burns dgn kamera
  // yang BERGANTI antar-potongan, lalu concat → ilustrasi berganti tiap ±2 dtk.
  const wPre = Math.round(pw * 1.2);
  const hPre = Math.round(ph * 1.2);
  const cabang: string[] = [];
  daftarGambar.forEach((_, p) => {
    const Dp = Math.max(1, Math.round((splits[p] ?? durasi) * 30));
    const zp = ekspresiZoompan(kameraPotongan(o.kamera, p), Dp);
    // v0.35.0 — variasi visual per potongan: hflip + pewarnaan + kabut SEBELUM
    // zoompan; grain (noise) SESUDAH zoompan agar tak ikut membesar.
    const vr = o.variasiList?.[p] ?? null;
    const derau = vr?.derau ? ",noise=alls=6:allf=t" : "";
    fc.push(
      `[${p}:v]scale=${wPre}:${hPre}:force_original_aspect_ratio=increase,crop=${wPre}:${hPre},${rantaiVariasi(vr)}zoompan=z='${zp.z}':x='${zp.x}':y='${zp.y}':d=${Dp}:s=${pw}x${ph}:fps=30${derau}[zp${p}]`,
    );
    cabang.push(`[zp${p}]`);
  });
  fc.push(nGambar > 1 ? `${cabang.join("")}concat=n=${nGambar}:v=1:a=0[seq]` : `${cabang.join("")}null[seq]`);
  fc.push(`[seq]fade=t=in:st=0:d=0.35[kb]`);
  fc.push(`[kb]pad=${o.lebar}:${o.tinggi}:0:0:color=${hexFf(o.tema.grad[0])}[pad]`);
  fc.push(`[pad][${idxPanel}:v]overlay=0:0[vo]`);
  const fadeOut = o.fadeKeluar ? `,fade=t=out:st=${Math.max(0, durasi - 0.7).toFixed(2)}:d=0.7` : "";
  fc.push(`[vo]format=yuv420p${fadeOut}[vout]`);
  const aFade = o.fadeKeluar ? `,afade=t=out:st=${Math.max(0, durasi - 0.7).toFixed(2)}:d=0.7` : "";
  // narasi (atau hening) di-pad PERSIS sepanjang adegan — input PERTAMA amix.
  // v0.32.0: apad=whole_len — padding sampel BERBATAS (44100 × durasi), bukan
  // apak tak berujung; atrim tetap ada sbg lapis kedua.
  const sampelPad = Math.round(durasi * 44100);
  fc.push(
    `[${idxNarasi}:a]aresample=44100,aformat=sample_fmts=s16:channel_layouts=stereo,volume=${o.volumeNarasi.toFixed(2)},adelay=150|150,apad=whole_len=${sampelPad},atrim=0:${durasi.toFixed(4)},asetpts=N/SR/TB${aFade}[nar]`,
  );
  if (adaMusik) {
    const mFade = o.fadeMusikKeluar ? `,afade=t=out:st=${Math.max(0, durasi - 1.2).toFixed(2)}:d=1.2` : "";
    const potong = musikLoop
      ? `atrim=start=${Math.max(0, o.mulaiMusik ?? 0).toFixed(3)}:end=${(Math.max(0, o.mulaiMusik ?? 0) + durasi + 0.25).toFixed(3)},asetpts=PTS-STARTPTS,`
      : "";
    fc.push(`[${idxMusik}:a]${potong}aresample=44100,aformat=sample_fmts=s16:channel_layouts=stereo,volume=${(o.volumeMusik ?? 0.8).toFixed(2)}${mFade}[ms]`);
    fc.push(`[nar][ms]amix=inputs=2:duration=first:normalize=0[aout]`);
  } else {
    fc.push(`[nar]anull[aout]`);
  }

  return [
    ...masuk,
    "-filter_complex", fc.join(";"),
    "-map", "[vout]", "-map", "[aout]",
    "-frames:v", String(D),
    "-t", durasi.toFixed(3), // v0.32.0: rem kemudi ABSOLUT di sisi output
    "-c:v", "libx264", "-preset", o.preset ?? "veryfast", "-crf", "23",
    "-c:a", "aac", "-b:a", "192k", "-ar", "44100", "-ac", "2",
    "-r", "30", "-pix_fmt", "yuv420p",
    "-f", "mp4", o.keluar,
  ];
}

/** v0.34.0 — cari berkas gambar galeri hantu (env VIDSPLIT_HANTU / cwd/assets)
 *  — pola sama dgn pathMusikBundel: mencari kandidat folder sampai berkas ada.
 *  v0.37.0 — pustaka "realistis" mencari di env VIDSPLIT_HANTU_REAL /
 *  assets/hantu-real. */
export function pathGambarGaleri(file: string, pustaka: "komik" | "realistis" = "komik"): string {
  const folder = pustaka === "realistis" ? "hantu-real" : "hantu";
  const env = pustaka === "realistis" ? process.env.VIDSPLIT_HANTU_REAL : process.env.VIDSPLIT_HANTU;
  const kandidat = [
    env,
    path.join(process.cwd(), "assets", folder),
    path.join(process.cwd(), "..", "assets", folder),
    path.join(process.cwd(), "..", "..", "assets", folder),
  ].filter(Boolean) as string[];
  for (const d of kandidat) {
    const p = path.join(d, file);
    try { if (readFileSync(p).length > 1000) return p; } catch { /* lanjut */ }
  }
  return path.join(process.cwd(), "assets", folder, file);
}

/** v0.33.0 — Argumen MENYIAPKAN musik sepanjang video (musik-panjang.wav).
 *  dgnPenguat=true → loudnorm I=-18 LUFS: musik gelap maupun hangat jadi sama
 *  jelas terdengar (mood hangat dulu mean −23 dB = nyaris tak terdengar —
 *  laporan user "backsound tidak muncul"). dgnPenguat=false → pola lama
 *  (percobaan ulang bila loudnorm gagal di build ffmpeg tertentu). */
export function buatArgumenMusikPanjang(musikAbs: string, totalDetik: number, keluar: string, dgnPenguat = true): string[] {
  const af = dgnPenguat ? ["-af", "loudnorm=I=-18:TP=-2:LRA=11"] : [];
  return [
    "-y", "-stream_loop", "-1", "-i", musikAbs,
    ...af,
    "-t", Math.max(1, totalDetik).toFixed(2),
    "-ar", "44100", "-ac", "2",
    keluar,
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
