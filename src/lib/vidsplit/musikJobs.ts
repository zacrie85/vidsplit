// VidSplit v0.12.0 — manajer job STUDIO MUSIK: proses audio (mode lapisan ATAU
// MUSIK BARU DARI CHORD v0.12 + tempo 0.5×/1×/1.5×) → render video visualizer (15 gaya,
// ffmpeg filter graf) → berkas chord/lirik (di-skala mengikuti tempo) → salin otomatis
// ke folder tujuan → catat ke riwayat ekspor yang sudah ada.
// Dukungan batal memakai registry batal.ts yang sama dgn ekspor video.
import { randomBytes } from "node:crypto";
import { existsSync, readdirSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { apakahBatal, bersihkanBatal, daftarkanProses, mintaBatal } from "./batal";
import { dirWork, jalankanFfmpeg, pathAman, pilihFfmpeg } from "./ffmpeg";
import { probeAudio } from "./musikAnalisis";
import { catatRiwayat } from "./riwayat";
import { buangSalinanKerja, muatSetelanTujuan, salinHasilKeTujuan } from "./tujuan";
import type { InfoJob, KeluaranJob } from "./jobs";
import { slugify } from "./types";
import {
  bangunAss, bangunFilterAudio, bangunRantaiVisual, clampStudio, faktorWaktuStudio,
  formatChordSheet, formatLrc, grafPisahVokalMusik, skalaChord, skalaLirik, transposDgnPerubahan,
  RESEP_GENRE, transposeAuto, type BarisLirik, type IdVisual, type OpsiVisual,
  type OpsiStudioMusik, type SegmenChord,
} from "./musik";
import { buatLayerWav } from "./musikLayer";
import { buatHarmoniWav, buatIringanWav } from "./musikTransformasi";
import { analisisMusik } from "./musikAnalisis";

export interface InfoJobMusik {
  id: string;
  jenis: "proses" | "render" | "pisah";
  tahap: "menyiapkan" | "audio" | "video" | "berkas" | "salin" | "selesai";
  progres: number; // 0..100
  pesan: string;
  judul: string;
  /** hasil render (mp4/mp3/txt/lrc) — hanya job render */
  outputs: KeluaranJob[];
  /** hasil proses audio utk didengar di UI */
  fileProses: string | null;
  fileMp3: string | null;
  error: string | null;
  selesai: boolean;
  batalDiminta: boolean;
  dibatalkan: boolean;
  dibuat: number;
}

const jobs = new Map<string, InfoJobMusik>();

export function ambilJobMusik(id: string): InfoJobMusik | undefined {
  return jobs.get(id);
}

export function batalkanJobMusik(id: string): boolean {
  const job = jobs.get(id);
  if (!job || job.selesai) return false;
  job.batalDiminta = true;
  mintaBatal(id);
  return true;
}

// ---------- util ----------

/** Escape path utk nilai filter ffmpeg (subtitles=...) — aman utk drive Windows. */
function escapePathFilter(p: string): string {
  return p.replaceAll("\\", "/").replaceAll(":", "\\:").replaceAll("'", "\\'");
}

function dirFonts(): string {
  const kandidat = [
    process.env.VIDSPLIT_FONTS,
    path.join(process.cwd(), "assets", "fonts"),
    path.join(process.cwd(), "..", "assets", "fonts"),
    path.join(process.cwd(), "..", "..", "assets", "fonts"),
  ].filter(Boolean) as string[];
  for (const d of kandidat) if (existsSync(d)) return d;
  return "/usr/share/fonts/truetype/dejavu";
}

function rapikanJobLama() {
  const batas = Date.now() - 6 * 3600 * 1000;
  for (const [id, j] of jobs) {
    if (j.selesai && j.dibuat < batas) jobs.delete(id);
  }
}

/** Buang berkas pratinjau lama — simpan maks 8 terbaru. */
function pangkasPratinjau() {
  try {
    const d = dirWork("musik");
    const daftar = readdirSync(d)
      .filter((f) => f.startsWith("pratinjau-") && f.endsWith(".mp4"))
      .map((f) => ({ f, t: statSync(path.join(d, f)).mtimeMs }))
      .sort((a, b) => b.t - a.t);
    for (const x of daftar.slice(8)) unlinkSync(path.join(d, x.f));
  } catch { /* abaikan */ }
}

interface KtxRahasia {
  jobId: string;
  onProgres: (f: number) => void;
}

/** Proses audio: genre + karaoke + layer instrumen (lapisan) ATAU transformasi penuh
 *  (iringan asli diganti total) + tempo 0.5×/1×/1.5× → proses.wav & proses.mp3 (320k).
 *  Mengembalikan path relatif keduanya. */
async function prosesAudio(
  o: OpsiStudioMusik,
  folderOut: string,
  ktx: KtxRahasia,
): Promise<{ wavRel: string; mp3Rel: string; durasi: number }> {
  const ff = await pilihFfmpeg();
  const srcAbs = pathAman(o.file);
  if (!srcAbs || !existsSync(srcAbs)) throw new Error("Berkas sumber tidak ditemukan");
  const info = await probeAudio(srcAbs);
  if (!info.adaAudio) throw new Error("Berkas tidak punya jalur audio");
  // v0.13.0 — REMAKE: transpos dasar (null = otomatis dari tingkat kemiripan + nama berkas);
  // v0.15.0 — transpos efektif = dasar × tingkat perubahan musik (0% → nada tetap,
  // benar-benar lagu asli) — dipakai juga oleh graf filter & tampilan UI agar konsisten.
  const transposeDasar =
    o.mode === "remake" ? (o.transpose ?? transposeAuto(o.kemiripan, o.file)) : 0;
  const transposeEfe =
    o.mode === "remake" ? transposDgnPerubahan(transposeDasar, o.tingkatMusik ?? 65) : 0;
  const { graf, adaLayer, tempo, adaNada } = bangunFilterAudio(
    { ...o, transpose: transposeEfe },
    info.sr || 44100,
  );
  const durasiKeluar = info.durasi / tempo;
  const args: string[] = ["-y", "-hide_banner", "-i", srcAbs];
  let layerAbs: string | null = null;
  let harmoniAbs: string | null = null;
  // v0.16.0 — LAPISAN HARMONI TERKUNCI-AKOR: nada tambahan khas genre dari chord
  // lagu sendiri (pad+bass+arp mengikuti BPM/fase hasil analisis). Input 1;
  // lapisan ritme eksperimental (bila aktif) menjadi input 2 — urutan ini HARUS
  // sama dgn indeks yang dipakai bangunFilterAudio di graf.
  if (adaNada) {
    const anH = await analisisMusik(o.file, ff.bin);
    const harmoniWav = buatHarmoniWav(
      { bpm: anH.bpm, fase: anH.fase, durasi: info.durasi, chord: anH.chord },
      o.genre === "asli" ? "pop" : o.genre,
      Math.min(1, Math.max(0, (o.nadaLevel ?? 30) / 100)),
    );
    harmoniAbs = path.join(dirWork("tmp"), `harmoni-${ktx.jobId}.wav`);
    writeFileSync(harmoniAbs, harmoniWav);
    args.push("-i", harmoniAbs);
  }
  if (adaLayer) {
    if (o.mode === "penuh") {
      // ==== MUSIK BARU DARI CHORD: seluruh musik disintesis dari hasil analisis ====
      const an = await analisisMusik(o.file, ff.bin);
      const iringWav = buatIringanWav(
        { bpm: an.bpm, fase: an.fase, durasi: info.durasi, chord: an.chord, melodi: an.melodi },
        o.genre === "asli" ? "pop" : o.genre,
        {
          groove: o.grooveLevel / 100,
          melodi: o.melodiLevel / 100,          // melodi BARU dari chord
          melodiAsli: o.melodiAsliLevel / 100,  // pegangan (bawaan 0)
          variasi: o.variasi,                   // tombol "Variasikan melodi"
        },
      );
      layerAbs = path.join(dirWork("tmp"), `iringan-${ktx.jobId}.wav`);
      writeFileSync(layerAbs, iringWav);
      args.push("-i", layerAbs);
    } else {
      // ==== MODE LAPISAN (v0.10): layer ritme di atas lagu utuh ====
      const resep = o.genre === "asli" ? null : RESEP_GENRE[o.genre];
      const pola = resep?.layer;
      if (pola) {
        // layer hidup di linimasa ASLI (atempo dipakai di ujung rantai graf);
        // v0.13.0: lapisan mengikuti transpos remake — nada petik/stab ikut digeser
        const layerWav = buatLayerWav(pola, o.bpm, info.durasi + 0.5, o.fase, transposeEfe);
        layerAbs = path.join(dirWork("tmp"), `layer-${ktx.jobId}.wav`);
        writeFileSync(layerAbs, layerWav);
        args.push("-i", layerAbs);
      }
    }
  }
  const grafAkhir = `${graf};[aout]asplit=2[awav][amp3]`;
  // -t pada ffmpeg hanya berlaku utk SATU berkas keluaran berikutnya —
  // karena ada 2 keluaran (wav + mp3), -t wajib diulang di tiap kelompok map.
  args.push(
    "-filter_complex", grafAkhir,
    // potong tepat ke durasi hasil (iringan punya ekor 1,2 dtk — jangan terbawa)
    "-t", durasiKeluar.toFixed(3),
    "-map", "[awav]", "-c:a", "pcm_s16le", path.join(folderOut, "proses.wav"),
    "-t", durasiKeluar.toFixed(3),
    "-map", "[amp3]", "-c:a", "libmp3lame", "-b:a", "320k",
    "-metadata", `title=${o.judul}`, path.join(folderOut, "proses.mp3"),
  );
  await jalankanFfmpeg(args, info.durasi, ktx.onProgres, ff.bin, (c) => daftarkanProses(ktx.jobId, c));
  if (layerAbs) { try { unlinkSync(layerAbs); } catch { /* abaikan */ } }
  if (harmoniAbs) { try { unlinkSync(harmoniAbs); } catch { /* abaikan */ } }
  const wavRel = `${path.basename(folderOut)}/proses.wav`;
  const mp3Rel = `${path.basename(folderOut)}/proses.mp3`;
  return { wavRel: `musik/${wavRel}`, mp3Rel: `musik/${mp3Rel}`, durasi: durasiKeluar };
}

/** Render MP4 visualizer dari audio terproses + overlay ASS (judul/chord/lirik). */
async function renderVid(
  o: OpsiStudioMusik,
  wavRel: string,
  folderOut: string,
  vis: { id: IdVisual; opsi: OpsiVisual; resolusi: "916" | "720" | "1080"; lirik: BarisLirik[]; chord: SegmenChord[] },
  durasi: number,
  ktx: KtxRahasia,
): Promise<string> {
  const ff = await pilihFfmpeg();
  const wavAbs = pathAman(wavRel);
  if (!wavAbs || !existsSync(wavAbs)) throw new Error("Audio terproses hilang — proses ulang dulu");
  // v0.15.0 — "916" = 9:16 vertikal 1080×1920 (BAWAAN — Reels/TikTok/Shorts);
  // "1080" = 16:9 1920×1080; "720" = 16:9 1280×720.
  const [H, W] = vis.resolusi === "916"
    ? [1920, 1080]
    : vis.resolusi === "1080" ? [1080, 1920] : [720, 1280];
  const fps = 30;
  const sensDb = ((vis.opsi.sensitivitas - 5) * 1.6).toFixed(1);
  const grafVisual = bangunRantaiVisual(vis.id, {
    w: W, h: H, fps, durasi, o: vis.opsi,
  }).replace("[av]", "[av2]");
  const baris: string[] = [`[0:a]asplit=2[ae][av]`, `[av]volume=${sensDb}dB[av2]`, grafVisual];
  const fileAss = path.join(dirWork("tmp"), `musik-${ktx.jobId}.ass`);
  const ass = bangunAss({
    w: W, h: H, durasi, vis: vis.opsi, lirik: vis.lirik, chord: vis.chord,
  });
  if (ass) {
    writeFileSync(fileAss, ass, "utf8");
    baris.push(`[viz]format=yuv420p,subtitles=filename='${escapePathFilter(fileAss)}':fontsdir='${escapePathFilter(dirFonts())}'[vfin]`);
  } else {
    baris.push(`[viz]format=yuv420p[vfin]`);
  }
  const namaMp4 = `${slugify(o.judul) || "musik"}-studio.mp4`;
  const args = [
    "-y", "-hide_banner",
    "-i", wavAbs,
    "-filter_complex", baris.join(";"),
    "-map", "[vfin]", "-map", "[ae]",
    "-t", durasi.toFixed(3),
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "192k",
    "-movflags", "+faststart", "-shortest",
    path.join(folderOut, namaMp4),
  ];
  await jalankanFfmpeg(args, durasi, ktx.onProgres, ff.bin, (c) => daftarkanProses(ktx.jobId, c));
  try { if (existsSync(fileAss)) unlinkSync(fileAss); } catch { /* abaikan */ }
  return namaMp4;
}

function ukuran(abs: string): number {
  try { return statSync(abs).size; } catch { return 0; }
}

// ---------- pekerja utama ----------

interface OpsiRenderLengkap extends OpsiStudioMusik {
  visual: IdVisual;
  opsiVisual: OpsiVisual;
  resolusi: "916" | "720" | "1080";
  lirik: BarisLirik[];
  chord: SegmenChord[];
  /** true bila sumber = proses.wav hasil job proses sebelumnya */
  audioSudahProses: boolean;
  /** bila audioSudahProses: wav rel hasil proses sebelumnya */
  wavSiap: string | null;
  /** bila audioSudahProses: mp3 rel hasil proses sebelumnya (utk disalin sbg hasil) */
  fileMp3Siap: string | null;
}

async function jalankanRender(id: string, o: OpsiRenderLengkap, folderOut: string) {
  const job = jobs.get(id)!;
  const ktx: KtxRahasia = {
    jobId: id,
    onProgres: (f) => {
      // pemetaan progres: tahap audio 0–35, video 35–95
      if (job.tahap === "audio") job.progres = Math.min(34, Math.round(f * 35));
      else if (job.tahap === "video") job.progres = 35 + Math.min(59, Math.round(f * 60));
    },
  };
  try {
    // tahap 1: audio
    let wavRel = o.wavSiap;
    let mp3Sumber: string | null = null;
    if (!o.audioSudahProses || !wavRel) {
      job.tahap = "audio";
      job.pesan = o.mode === "penuh"
        ? "Menganalisis chord & menciptakan musik baru (musik baru dari chord)…"
        : "Memproses audio (genre, karaoke, layer instrumen)…";
      const folderProses = dirWork(`musik/${id}`);
      const hasil = await prosesAudio(clampStudio(o), folderProses, ktx);
      wavRel = hasil.wavRel;
      mp3Sumber = hasil.mp3Rel;
      job.fileProses = wavRel;
      job.fileMp3 = mp3Sumber;
    } else {
      job.fileProses = wavRel;
    }
    if (apakahBatal(id)) throw new Error("DIBATALKAN");
    // tahap 2: video
    job.tahap = "video";
    job.pesan = "Merender visualizer (CPU, efek realtime)…";
    const durasi = (await probeAudio(pathAman(wavRel)!)).durasi;
    // lirik & chord hidup di linimasa ASLI — skala mengikuti faktor tempo hasil
    const faktor = faktorWaktuStudio(o);
    const lirikSkala = skalaLirik(o.lirik, faktor);
    const chordSkala = skalaChord(o.chord, faktor);
    const namaMp4 = await renderVid(o, wavRel, folderOut, {
      id: o.visual, opsi: o.opsiVisual, resolusi: o.resolusi,
      lirik: lirikSkala, chord: chordSkala,
    }, durasi, ktx);
    if (apakahBatal(id)) throw new Error("DIBATALKAN");
    // tahap 3: berkas pendamping
    job.tahap = "berkas";
    job.pesan = "Menulis berkas chord & lirik…";
    const slug = slugify(o.judul) || "musik";
    const meta = `Genre: ${o.genre === "asli" ? "asli" : o.genre} · Mode: ${o.mode === "penuh" ? "transformasi penuh" : "lapisan"} · Tempo: ${o.kecepatan}× · BPM hasil ≈ ${Math.round(o.bpm * faktorWaktuStudio(o))} · Visual: ${o.visual}`
      + (o.mode === "remake" && (o.nadaLevel ?? 0) > 0 && o.genre !== "asli" ? ` · nada akor ${o.nadaLevel}%` : "")
      + (o.genreVokal !== "mati" ? ` · vokal ${o.genreVokal}${o.refVokal ? ` (${o.refVokal})` : ""} ${o.tingkatVokal}%` : "");
    const txtAbs = path.join(folderOut, `${slug}-chord-lirik.txt`);
    writeFileSync(txtAbs, formatChordSheet(o.judul, meta, chordSkala, lirikSkala), "utf8");
    if (o.lirik.length) {
      writeFileSync(path.join(folderOut, `${slug}.lrc`), formatLrc(lirikSkala), "utf8");
    }
    // mp3 320k: ambil dari proses tadi (sudah 320k) atau hasil proses sebelumnya
    const mp3Rel = mp3Sumber ?? o.fileMp3Siap;
    const outputs: KeluaranJob[] = [];
    const daftarFile: { file: string; abs: string }[] = [];
    const mp4Abs = path.join(folderOut, namaMp4);
    if (existsSync(mp4Abs)) daftarFile.push({ file: namaMp4, abs: mp4Abs });
    if (mp3Rel) {
      const mp3Abs = pathAman(mp3Rel);
      if (mp3Abs && existsSync(mp3Abs)) {
        const mp3Out = path.join(folderOut, `${slug}-audio.mp3`);
        if (mp3Abs !== mp3Out) {
          const { copyFileSync } = await import("node:fs");
          copyFileSync(mp3Abs, mp3Out);
        }
        daftarFile.push({ file: `${slug}-audio.mp3`, abs: mp3Out });
      }
    }
    if (existsSync(txtAbs)) daftarFile.push({ file: `${slug}-chord-lirik.txt`, abs: txtAbs });
    const lrcAbs = path.join(folderOut, `${slug}.lrc`);
    if (o.lirik.length && existsSync(lrcAbs)) daftarFile.push({ file: `${slug}.lrc`, abs: lrcAbs });
    for (const f of daftarFile) outputs.push({ video: o.judul, file: f.file, ukuran: ukuran(f.abs) });
    if (!outputs.length) throw new Error("Tidak ada hasil yang berhasil dirender");
    job.outputs = outputs;
    // tahap 4: salin otomatis + riwayat (integrasi penuh dgn sistem video)
    const setelan = muatSetelanTujuan();
    let folderTersimpan: string | null = null;
    if (setelan.otomatis && setelan.folder) {
      job.tahap = "salin";
      job.pesan = `Menyalin hasil ke folder tujuan…`;
      job.progres = 96;
      const salin = await salinHasilKeTujuan(
        { id, outputs, antrean: [{ nama: o.judul, total: 1, selesai: 1, status: "selesai" }] },
        setelan.folder,
      );
      folderTersimpan = salin.folder;
      if (salin.gagal.length) {
        job.pesan = `Selesai — ${salin.gagal.length} berkas gagal tersalin ke folder tujuan`;
      }
      if (setelan.bersihkanKerja && !salin.gagal.length) buangSalinanKerja({ id, outputs });
    }
    catatRiwayat({
      id,
      antrean: [{ nama: o.judul, total: 1, selesai: 1, status: "selesai" }],
      outputs,
      videoAktif: -1,
      partAktif: 0,
      progresPart: 100,
      progresTotal: 100,
      error: null,
      adaGagal: false,
      selesaiSemua: true,
      batalDiminta: false,
      dibatalkan: false,
      dibuat: job.dibuat,
      akselerasi: "ffmpeg (efek visual CPU)",
      paralel: 1,
      folderTersimpan,
      menyalin: false,
      peringatanSalin: null,
    } satisfies InfoJob);
    job.tahap = "selesai";
    job.pesan = folderTersimpan
      ? `Selesai — hasil tersalin ke ${folderTersimpan}`
      : "Selesai — hasil siap diunduh";
    job.progres = 100;
    job.selesai = true;
  } catch (e) {
    const dibatalkan = apakahBatal(id) || (e instanceof Error && e.message === "DIBATALKAN");
    job.dibatalkan = dibatalkan;
    job.selesai = true;
    job.tahap = "selesai";
    job.error = dibatalkan
      ? "Dibatalkan — hasil parsial dibuang"
      : e instanceof Error ? e.message : String(e);
    if (dibatalkan) {
      // buang file parsial di folder output
      try {
        const { rmSync } = await import("node:fs");
        rmSync(folderOut, { recursive: true, force: true });
      } catch { /* abaikan */ }
      job.outputs = [];
    }
  } finally {
    bersihkanBatal(id);
  }
}

// ---------- API publik ----------

export interface OpsiProsesMasuk extends OpsiStudioMusik {}

/** Job proses audio saja (pratinjau suara genre/karaoke/layer). */
export function mulaiProsesMusik(opsi: OpsiProsesMasuk): string {
  rapikanJobLama();
  const id = randomBytes(4).toString("hex");
  const folderOut = dirWork(`musik/${id}`);
  jobs.set(id, {
    id, jenis: "proses", tahap: "menyiapkan", progres: 0,
    pesan: "Menyiapkan…", judul: opsi.judul, outputs: [],
    fileProses: null, fileMp3: null, error: null,
    selesai: false, batalDiminta: false, dibatalkan: false, dibuat: Date.now(),
  });
  void (async () => {
    const job = jobs.get(id)!;
    const ktx: KtxRahasia = {
      jobId: id,
      onProgres: (f) => {
        if (job.tahap === "audio") job.progres = Math.min(99, Math.round(f * 100));
      },
    };
    try {
      job.tahap = "audio";
      job.pesan = "Memproses audio (genre, karaoke, layer)…";
      const hasil = await prosesAudio(clampStudio(opsi), folderOut, ktx);
      if (apakahBatal(id)) throw new Error("DIBATALKAN");
      job.fileProses = hasil.wavRel;
      job.fileMp3 = hasil.mp3Rel;
      job.tahap = "selesai";
      job.pesan = "Audio siap — dengarkan di pratinjau";
      job.progres = 100;
      job.selesai = true;
    } catch (e) {
      const dibatalkan = apakahBatal(id) || (e instanceof Error && e.message === "DIBATALKAN");
      job.dibatalkan = dibatalkan;
      job.selesai = true;
      job.tahap = "selesai";
      job.error = dibatalkan ? "Dibatalkan" : e instanceof Error ? e.message : String(e);
    } finally {
      bersihkanBatal(id);
    }
  })();
  return id;
}

export interface OpsiRenderMasuk extends OpsiRenderLengkap {}

export interface OpsiPisahMasuk {
  file: string;
  judul: string;
}

/** v0.19.0 — job PISAH VOKAL & MUSIK (vocal remover): SATU lari ffmpeg →
 *  dua berkas MP3 320k — <judul>-musik.mp3 (instrumental, karaoke nyaring)
 *  & <judul>-vokal.mp3 (inti suara tengah). Hasil masuk daftar outputs
 *  (bisa diunduh/disalin otomatis) + dicatat ke riwayat. */
export function mulaiPisahMusik(opsi: OpsiPisahMasuk): string {
  rapikanJobLama();
  const id = randomBytes(4).toString("hex");
  const folderOut = dirWork(`output/${id}`);
  jobs.set(id, {
    id, jenis: "pisah", tahap: "audio", progres: 0,
    pesan: "Memisahkan vokal & musik…", judul: opsi.judul, outputs: [],
    fileProses: null, fileMp3: null, error: null,
    selesai: false, batalDiminta: false, dibatalkan: false, dibuat: Date.now(),
  });
  void (async () => {
    const job = jobs.get(id)!;
    const ktx: KtxRahasia = {
      jobId: id,
      onProgres: (f) => {
        if (job.tahap === "audio") job.progres = Math.min(99, Math.round(f * 100));
      },
    };
    try {
      const ff = await pilihFfmpeg();
      const srcAbs = pathAman(opsi.file);
      if (!srcAbs || !existsSync(srcAbs)) throw new Error("Berkas sumber tidak ditemukan");
      const info = await probeAudio(srcAbs);
      if (!info.adaAudio) throw new Error("Berkas tidak punya jalur audio");
      const slug = slugify(opsi.judul) || "lagu";
      const fMus = path.join(folderOut, `${slug}-musik.mp3`);
      const fVok = path.join(folderOut, `${slug}-vokal.mp3`);
      const args = [
        "-y", "-hide_banner",
        "-i", srcAbs,
        "-filter_complex", grafPisahVokalMusik(),
        "-map", "[mout]", "-c:a", "libmp3lame", "-b:a", "320k",
        "-metadata", `title=${opsi.judul} (musik)`, fMus,
        "-map", "[vout]", "-c:a", "libmp3lame", "-b:a", "320k",
        "-metadata", `title=${opsi.judul} (vokal)`, fVok,
      ];
      await jalankanFfmpeg(args, info.durasi, ktx.onProgres, ff.bin, (c) => daftarkanProses(id, c));
      if (apakahBatal(id)) throw new Error("DIBATALKAN");
      if (!existsSync(fMus) || !existsSync(fVok)) throw new Error("Pemisahan gagal — hasil tidak lengkap");
      job.outputs = [
        { video: opsi.judul, file: path.basename(fMus), ukuran: ukuran(fMus) },
        { video: opsi.judul, file: path.basename(fVok), ukuran: ukuran(fVok) },
      ];
      // salin otomatis ke folder tujuan + riwayat (pola sama dgn ekspor)
      const setelan = muatSetelanTujuan();
      let folderTersimpan: string | null = null;
      if (setelan.otomatis && setelan.folder) {
        job.tahap = "salin";
        job.pesan = "Menyalin hasil ke folder tujuan…";
        job.progres = 96;
        const salin = await salinHasilKeTujuan(
          { id, outputs: job.outputs, antrean: [{ nama: opsi.judul, total: 1, selesai: 1, status: "selesai" }] },
          setelan.folder,
        );
        folderTersimpan = salin.folder;
        if (setelan.bersihkanKerja && !salin.gagal.length) buangSalinanKerja({ id, outputs: job.outputs });
      }
      catatRiwayat({
        id,
        antrean: [{ nama: opsi.judul, total: 1, selesai: 1, status: "selesai" }],
        outputs: job.outputs,
        videoAktif: -1,
        partAktif: 0,
        progresPart: 100,
        progresTotal: 100,
        error: null,
        adaGagal: false,
        selesaiSemua: true,
        batalDiminta: false,
        dibatalkan: false,
        dibuat: job.dibuat,
        akselerasi: "ffmpeg (pisah vokal DSP)",
        paralel: 1,
        folderTersimpan,
        menyalin: false,
        peringatanSalin: null,
      } satisfies InfoJob);
      job.tahap = "selesai";
      job.pesan = folderTersimpan
        ? `Selesai — vokal & musik tersalin ke ${folderTersimpan}`
        : "Selesai — vokal & musik siap diunduh";
      job.progres = 100;
      job.selesai = true;
    } catch (e) {
      const dibatalkan = apakahBatal(id) || (e instanceof Error && e.message === "DIBATALKAN");
      job.dibatalkan = dibatalkan;
      job.selesai = true;
      job.tahap = "selesai";
      job.error = dibatalkan
        ? "Dibatalkan — hasil parsial dibuang"
        : e instanceof Error ? e.message : String(e);
      if (dibatalkan) {
        try {
          const { rmSync } = await import("node:fs");
          rmSync(folderOut, { recursive: true, force: true });
        } catch { /* abaikan */ }
        job.outputs = [];
      }
    } finally {
      bersihkanBatal(id);
    }
  })();
  return id;
}

/** Job render penuh: audio (bila perlu) + video visualizer + berkas + riwayat. */
export function mulaiRenderMusik(opsi: OpsiRenderMasuk): string {
  rapikanJobLama();
  const id = randomBytes(4).toString("hex");
  const folderOut = dirWork(`output/${id}`);
  jobs.set(id, {
    id, jenis: "render", tahap: "menyiapkan", progres: 0,
    pesan: "Menyiapkan…", judul: opsi.judul, outputs: [],
    fileProses: null, fileMp3: null, error: null,
    selesai: false, batalDiminta: false, dibatalkan: false, dibuat: Date.now(),
  });
  void jalankanRender(id, opsi, folderOut);
  return id;
}

/** Pratinjau visual 10 detik — 640×360 (16:9) atau 360×640 (9:16, resolusi "916")
 *  — berjalan SERENTAK (await) di route.
 *  faktor = faktor waktu proses (resep genre × kecepatan) — lirik/chord di-skala
 *  dari linimasa asli ke linimasa HASIL agar sejajar dgn audio terproses. */
export async function pratinjauVisual(opsi: {
  wavRel: string; judul: string;
  visual: IdVisual; opsiVisual: OpsiVisual;
  mulai: number; lirik: BarisLirik[]; chord: SegmenChord[]; faktor?: number;
  resolusi?: "916" | "720" | "1080";
}): Promise<string> {
  pangkasPratinjau();
  const id = randomBytes(4).toString("hex");
  const folderOut = dirWork("musik");
  const ktx: KtxRahasia = { jobId: id, onProgres: () => {} };
  const faktor = opsi.faktor && opsi.faktor > 0 ? opsi.faktor : 1;
  const lirikSkala = skalaLirik(opsi.lirik, faktor);
  const chordSkala = skalaChord(opsi.chord, faktor);
  const potongLirik: BarisLirik[] = [];
  const akhir = opsi.mulai + 10;
  for (const b of lirikSkala) {
    if (b.mulai >= opsi.mulai - 0.2 && b.mulai < akhir) potongLirik.push({ ...b, mulai: b.mulai - opsi.mulai });
  }
  const potongChord: SegmenChord[] = [];
  for (const c of chordSkala) {
    const akhirC = c.mulai + c.durasi;
    if (akhirC > opsi.mulai && c.mulai < akhir) {
      potongChord.push({ ...c, mulai: Math.max(0, c.mulai - opsi.mulai), durasi: Math.min(akhirC, akhir) - Math.max(opsi.mulai, c.mulai) });
    }
  }
  const filePratinjau = path.join(folderOut, `pratinjau-${id}.mp4`);
  // render manual singkat: 10 dtk — 640×360 landscape / 360×640 vertikal (9:16)
  const [pw, ph] = opsi.resolusi === "916" ? [360, 640] : [640, 360];
  const ff = await pilihFfmpeg();
  const wavAbs = pathAman(opsi.wavRel);
  if (!wavAbs || !existsSync(wavAbs)) throw new Error("Audio terproses tidak ada — proses dulu");
  const sensDb = ((opsi.opsiVisual.sensitivitas - 5) * 1.6).toFixed(1);
  const grafVisual = bangunRantaiVisual(opsi.visual, {
    w: pw, h: ph, fps: 30, durasi: 10, o: opsi.opsiVisual,
  }).replace("[av]", "[av2]");
  const baris: string[] = [`[0:a]asplit=2[ae][av]`, `[av]volume=${sensDb}dB[av2]`, grafVisual];
  const ass = bangunAss({
    w: pw, h: ph, durasi: 10, vis: opsi.opsiVisual, lirik: potongLirik, chord: potongChord,
  });
  const fileAss = path.join(dirWork("tmp"), `pratinjau-${id}.ass`);
  if (ass) {
    writeFileSync(fileAss, ass, "utf8");
    baris.push(`[viz]format=yuv420p,subtitles=filename='${escapePathFilter(fileAss)}':fontsdir='${escapePathFilter(dirFonts())}'[vfin]`);
  } else {
    baris.push(`[viz]format=yuv420p[vfin]`);
  }
  const args = [
    "-y", "-hide_banner",
    "-ss", Math.max(0, opsi.mulai).toFixed(2),
    "-i", wavAbs,
    "-filter_complex", baris.join(";"),
    "-map", "[vfin]", "-map", "[ae]",
    "-t", "10",
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "24", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "128k",
    "-movflags", "+faststart", "-shortest",
    filePratinjau,
  ];
  await jalankanFfmpeg(args, 10, ktx.onProgres, ff.bin);
  try { if (existsSync(fileAss)) unlinkSync(fileAss); } catch { /* abaikan */ }
  return `musik/pratinjau-${id}.mp4`;
}


