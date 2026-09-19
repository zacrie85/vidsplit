// VidSplit v0.25.0 — JOB RENDER CERITA HOROR: narasi TTS -> musik -> halaman PNG ->
// chunk video (x264+mpegts) -> concat copy. Progres dipolling API, batal aman.
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { apakahBatal, bersihkanBatal, daftarkanProses, mintaBatal } from "./batal";
import { dirWork, jalankanFfmpeg, pilihFfmpeg } from "./ffmpeg";
import type { KeluaranJob } from "./jobs";
import { buatCerita, estimasiDurasi, type Cerita } from "./hororCerita";
import { sintesisMusikGenre } from "./hororMusik";
import { buatNarasiWav, durasiWav } from "./hororTts";
import { renderHalamanPng, renderIlustrasiPng, renderTeksPanelPng } from "./teksLayar";
import {
  TEMA_HOROR, rencanaHoror, pecahChunk, waktuKilat, buatArgumenLatar,
  buatArgumenChunk, buatArgumenConcat, isiListConcat, ukuranHoror,
  MUSIK_BUNDEL, pathMusikBundel,
  tataLetakKomik, durasiAdeganKomik, buatArgumenSegmenKomik,
  buatArgumenMusikPanjang,
  type OpsiRenderHoror,
} from "./hororRender";
import { svgAdegan, defsAdegan, type JenisAdegan } from "./hororIlustrasi";
import { ambilGenre } from "./videoAi";
import { bangunPromptVideo, type PromptVideoKomik } from "./videoPrompt";
import { slugify } from "./types";

/** v0.30.0 — satuan render komik: kartu judul/adegan/kartu tamat */
interface UnitKomik {
  teks: string;
  label?: string;
  kamera: string;
  durasi: number;
  wav: string | null;
  jenis: JenisAdegan;
  seedAdegan: number;
  /** kartu judul/tamat: ilustrasi penuh tanpa teks overlay dlm gambar */
  kartu?: boolean;
  skala?: number;
}

export interface InfoJobHoror {
  id: string;
  tahap: "narasi" | "musik" | "halaman" | "video" | "gabung" | "selesai";
  progres: number; // 0..100
  pesan: string;
  judul: string;
  outputs: KeluaranJob[];
  error: string | null;
  selesai: boolean;
  batalDiminta: boolean;
  dibatalkan: boolean;
  dibuat: number;
  peringatan?: string[]; // diagnosa non-fatal (mis. TTS gagal -> musik saja)
}

const jobs = new Map<string, InfoJobHoror>();

export function ambilJobHoror(id: string): InfoJobHoror | undefined {
  return jobs.get(id);
}

export function batalkanJobHoror(id: string): boolean {
  const job = jobs.get(id);
  if (!job || job.selesai) return false;
  job.batalDiminta = true;
  mintaBatal(id);
  return true;
}

export type OpsiHororMasuk = OpsiRenderHoror & { judul?: string };

/** Mulai job render video horor. Kembalikan id job. */
export function mulaiRenderHoror(opsi: OpsiHororMasuk): string {
  const id = randomBytes(5).toString("hex");
  const cerita = opsi.cerita ?? buatCerita({ seed: undefined });
  const judul = (opsi.judul || cerita.judul).trim();
  const genre = ambilGenre(opsi.genreId ?? cerita.genre);
  const job: InfoJobHoror = {
    id, tahap: "narasi", progres: 0, pesan: "Menyiapkan…", judul, outputs: [],
    error: null, selesai: false, batalDiminta: false, dibatalkan: false, dibuat: Date.now(),
  };
  jobs.set(id, job);
  // v0.30.0 — bawaan: AI Text-to-Video Generator versi komik (gambar atas +
  // kolom cerita bawah, adegan berganti ±3 dtk, tersinkron dgn narasi).
  // gaya "halaman" = jalur lama v0.25–0.29 (masih bisa dipanggil via API).
  if (opsi.gaya === "halaman") void jalankanRenderHoror(id, opsi, cerita, judul, genre);
  else void jalankanRenderKomik(id, opsi, cerita, judul, genre);
  return id;
}

/** Siapkan berkas musik latar (bundel CC-BY / impor / sintesis genre).
 *  v0.33.0 — SETELAH sumber siap, musik DIPERKUAT & DISETEL loudnorm I=-18 LUFS
 *  (musik-kuat.wav): mood hangat (dongeng/motivasi/fakta) dulu mean −23 dB —
 *  nyaris tak terdengar di speaker laptop → laporan user "backsound tidak
 *  muncul". Setelah disetel, SEMUA sumber (sintesis gelap/hangat, CC-BY, impor)
 *  sama jelas terdengar di bawah narasi. Gagal penguat → musik asli tetap dipakai. */
async function siapkanMusik(
  folderTmp: string, opsi: OpsiHororMasuk, cerita: Cerita,
  genre: ReturnType<typeof ambilGenre>, ff: { bin: string },
  ktx: { maju: (t: InfoJobHoror["tahap"], p: number, m: string) => void },
): Promise<string> {
  ktx.maju("musik", 31, `Menyiapkan musik ${genre.nama.toLowerCase()}…`);
  const musikAbs = path.join(folderTmp, "musik.wav");
  const bundel = MUSIK_BUNDEL.find((m) => m.id === opsi.sumberMusik);
  let musikSiap = false;
  if (bundel) {
    try {
      const src = pathMusikBundel(bundel.file);
      await jalankanFfmpeg(["-y", "-i", src, "-ar", "44100", "-ac", "2", musikAbs], 0, undefined, ff.bin);
      musikSiap = true;
      ktx.maju("musik", 35, `Musik: ${bundel.nama} (${bundel.kredit})`);
    } catch { musikSiap = false; }
  } else if (opsi.sumberMusik === "impor" && opsi.musikImporRel) {
    try {
      const pathAman = (await import("./ffmpeg")).pathAman;
      const src = pathAman(opsi.musikImporRel);
      await jalankanFfmpeg(["-y", "-i", src, "-ar", "44100", "-ac", "2", musikAbs], 0, undefined, ff.bin);
      musikSiap = true;
      ktx.maju("musik", 35, "Musik: impor sendiri");
    } catch { musikSiap = false; }
  }
  if (!musikSiap) {
    await writeFile(musikAbs, sintesisMusikGenre({
      intensitas: opsi.intensitasMusik ?? genre.intensitasMusik,
      polaDetik: 60,
      seed: cerita.seed,
      mood: genre.moodMusik,
    }));
  }
  // v0.33.0 — penguat loudness: target −18 LUFS dgn verifikasi berkas hasil
  try {
    const kuatAbs = path.join(folderTmp, "musik-kuat.wav");
    await jalankanFfmpeg(
      ["-y", "-i", musikAbs, "-af", "loudnorm=I=-18:TP=-2:LRA=11", "-ar", "44100", "-ac", "2", kuatAbs],
      0, undefined, ff.bin,
    );
    const d = await durasiWav(kuatAbs);
    if (d > 1) return kuatAbs; // penguat berhasil → sumber musik jadi musik-kuat.wav
  } catch { /* gagal → musik asli tetap dipakai */ }
  return musikAbs;
}

/** v0.30.0 — PIPELINE AI TEXT-TO-VIDEO GENERATOR (versi komik, tersinkron).
 *  Alur (permintaan user): AI Story Generator -> teks cerita -> (TTS + prompt
 *  video komik) -> tiap adegan = gambar atas (berganti ±3 dtk) + kolom cerita
 *  bawah + narasi di-pad persis sepanjang adegan -> concat -> musik di bawah.
 *  v0.31.0 PERBAIKAN laporan user ("Merender adegan stak di 2/13" + "backsound
 *  tidak muncul"): (1) pesan adegan diumumkan di AWAL tiap ffmpeg — counter
 *  pasti maju per adegan, tak lagi bergantung pada statistik time= ffmpeg yang
 *  di sebagian ffmpeg Windows tak terkirim utk adegan cepat; (2) musik latar
 *  DIMASUKKAN langsung ke tiap segmen (amix per adegan — pola per-chunk jalur
 *  halaman v0.25-0.29 yang terbukti di Windows user) — pass akhir amix +
 *  stream_loop + -c:v copy dihapus, concat langsung hasilkan MP4 final. */
async function jalankanRenderKomik(id: string, opsi: OpsiHororMasuk, cerita: Cerita, judul: string, genre: ReturnType<typeof ambilGenre>): Promise<void> {
  const job = jobs.get(id)!;
  const folderTmp = dirWork(`horor/${id}`);
  const folderOut = dirWork(`output/${id}`);
  const ktx = {
    maju: (tahap: InfoJobHoror["tahap"], progres: number, pesan: string) => {
      if (job.selesai) return;
      job.tahap = tahap; job.progres = Math.round(progres); job.pesan = pesan;
    },
    gagal: (e: unknown) => {
      if (apakahBatal(id)) {
        job.dibatalkan = true; job.pesan = "Dibatalkan";
      } else {
        job.error = e instanceof Error ? e.message : String(e);
        job.pesan = "Gagal";
      }
      job.selesai = true; bersihkanBatal(id);
    },
  };
  try {
    await mkdir(folderTmp, { recursive: true });
    await mkdir(folderOut, { recursive: true });
    const tema = TEMA_HOROR.find((t) => t.id === opsi.temaId) ?? TEMA_HOROR[0];
    const [lebar, tinggi] = ukuranHoror(opsi.rasio ?? "9:16", opsi.resolusi ?? "1080p");
    const ff = await pilihFfmpeg();

    // ---- 1) PROMPT VIDEO AI (0..3) — cerita -> adegan komik ----
    ktx.maju("narasi", 1, "Membangun prompt video AI…");
    const prompt: PromptVideoKomik = bangunPromptVideo(cerita, genre.id);
    const tata = tataLetakKomik(lebar, tinggi);
    const unit: UnitKomik[] = [];
    // kartu judul (bukan bab — hanya judul cerita + label genre)
    unit.push({
      teks: judul, label: prompt.labelJudul, kamera: "dalam", durasi: 3.5,
      wav: null, jenis: prompt.adegan[0]?.jenisAdegan ?? "eksterior-rumah",
      seedAdegan: cerita.seed, kartu: true, skala: 1.2,
    });
    for (const a of prompt.adegan) {
      unit.push({ teks: a.teks, kamera: a.kamera, durasi: 3, wav: null, jenis: a.jenisAdegan, seedAdegan: a.seedAdegan });
    }
    unit.push({
      teks: "Tamat", kamera: "keluar", durasi: 3, wav: null,
      jenis: prompt.adegan[prompt.adegan.length - 1]?.jenisAdegan ?? "hutan",
      seedAdegan: (cerita.seed ^ 0xabcdef) >>> 0, kartu: true, skala: 1.1,
    });
    const nAdegan = prompt.adegan.length;
    ktx.maju("narasi", 3, `Prompt video AI: ${nAdegan} adegan komik — gambar berganti ±${prompt.lajuAdeganDetik} dtk`);

    // ---- 2) NARASI TTS PER ADEGAN (3..30) — audio mengunci durasi adegan ----
    let narasiJadi = 0;
    let galatNarasiPertama: string | null = null;
    let metodeNarasi: string | null = null;
    let gagalBerturut = 0;
    let cepatHabis = false;
    for (let i = 1; i <= nAdegan; i++) {
      if (apakahBatal(id)) throw new Error("dibatalkan");
      const u = unit[i];
      const wavAbs = path.join(folderTmp, `narasi-${String(i).padStart(3, "0")}.wav`);
      // v0.31.0 — umumkan SEBELUM mencoba: counter maju walau TTS lambat/hang
      ktx.maju("narasi", 3 + 27 * ((i - 1) / Math.max(1, nAdegan)), `Merekam narasi adegan ${i}/${nAdegan}…`);
      let ok = false;
      if (opsi.narasi && !cepatHabis) {
        const hasil = await buatNarasiWav(u.teks, { kecepatan: opsi.kecepatanNarasi, volume: opsi.volumeNarasi, suara: opsi.suaraNarasi, pria: opsi.jenisSuaraNarasi === "pria" }, wavAbs, opsi.mesinNarasi ?? "ai");
        ok = hasil.ok;
        if (hasil.metode) metodeNarasi = hasil.metode;
        if (!ok && !galatNarasiPertama && hasil.galat) galatNarasiPertama = hasil.galat;
      }
      if (ok) {
        let durasi = 0;
        let ukuranWav = 0;
        try { durasi = await durasiWav(wavAbs); } catch { /* header aneh — estimasi */ }
        try { ukuranWav = (await import("node:fs")).statSync(wavAbs).size; } catch { /* tak ada berkas */ }
        if (ukuranWav > 1000) {
          // v0.32.0 — NORMALISASI wav narasi via ffmpeg ke 44100/stereo/s16 PCM:
          // keluaran Piper/SAPI apa pun (22050 mono, float, header aneh) diubah
          // ke format SERAGAM sebelum masuk filter segmen — membuang kelas bug
          // "adegan pertama dgn narasi hang di ffmpeg Windows" + wav divalidasi ulang.
          const wavFix = path.join(folderTmp, `narasi-fix-${String(i).padStart(3, "0")}.wav`);
          let ternormalisasi = false;
          try {
            await jalankanFfmpeg(
              ["-y", "-i", wavAbs, "-ar", "44100", "-ac", "2", "-c:a", "pcm_s16le", wavFix],
              0, undefined, ff.bin, (ch) => daftarkanProses(id, ch),
            );
            const { statSync: stat } = await import("node:fs");
            if (stat(wavFix).size > 1000) {
              const d2 = await durasiWav(wavFix).catch(() => durasi);
              if (d2 > 0.3) { durasi = d2; }
              ternormalisasi = true;
            }
          } catch { /* gagal normalisasi -> pakai wav asli apa adanya */ }
          u.wav = ternormalisasi ? wavFix : wavAbs;
          u.durasi = durasiAdeganKomik(durasi, u.teks);
          narasiJadi++;
          gagalBerturut = 0;
        } else {
          ok = false;
          if (!galatNarasiPertama) galatNarasiPertama = "berkas narasi kosong/tak lengkap";
        }
      }
      if (!ok) {
        u.wav = null;
        u.durasi = durasiAdeganKomik(0, u.teks); // estimasi baca
        gagalBerturut++;
        // TTS memang tidak jalan di perangkat ini -> hentikan percobaan, lanjut musik saja
        if (narasiJadi === 0 && gagalBerturut >= 3) cepatHabis = true;
      }
      ktx.maju("narasi", 3 + 27 * (i / Math.max(1, nAdegan)), `Merekam narasi adegan ${i}/${nAdegan}…`);
    }
    const pakaiNarasi = narasiJadi > 0;
    if (opsi.narasi && !pakaiNarasi) {
      const p = `Pembaca skrip tidak menghasilkan suara: ${galatNarasiPertama ?? "TTS tidak tersedia"}. ` +
        `Video tetap dibuat dengan musik saja. Coba tombol "Uji Suara" di panel Pembaca Skrip untuk melihat penyebabnya.`;
      job.peringatan = [p];
      ktx.maju("narasi", 30, p);
    }

    // ---- 3) MUSIK (30..38) ----
    const musikAbs = await siapkanMusik(folderTmp, opsi, cerita, genre, ff, ktx);
    const totalDetik = unit.reduce((s, u) => s + u.durasi, 0);
    // v0.31.0 — loop musik ke PANJANG penuh video SEKALI di awal (berkas WAV
    // tunggal); tiap segmen lalu ambil potongannya dgn -ss input-seek instan.
    // v0.33.0 — hasil DIVERIFIKASI dgn durasiWav; bila gagal → dicoba ulang
    // sekali; bila tetap gagal → segmen memakai sumber musik langsung dgn
    // -stream_loop + atrim (musikLoopSumber) — musik TIDAK mungkin hilang lagi
    // hanya karena satu berkas persiapan gagal di mesin user.
    let musikPanjangAbs: string | null = null;
    if (totalDetik > 0) {
      ktx.maju("musik", 35, "Menyelaraskan panjang musik latar…");
      const panjangAbs = path.join(folderTmp, "musik-panjang.wav");
      for (let coba = 0; coba < 2 && !musikPanjangAbs; coba++) {
        try {
          await jalankanFfmpeg(
            buatArgumenMusikPanjang(musikAbs, totalDetik + 1, panjangAbs, coba === 0),
            0, undefined, ff.bin, (ch) => daftarkanProses(id, ch),
          );
          const d = await durasiWav(panjangAbs).catch(() => 0);
          if (d > 1) musikPanjangAbs = panjangAbs;
        } catch { /* coba lagi tanpa penguat, lalu jalur cadangan */ }
      }
      if (!musikPanjangAbs) {
        const p = "Musik latar gagal disiapkan panjang penuh — dipakai jalur cadangan per-adegan.";
        job.peringatan = [...(job.peringatan ?? []), p];
        ktx.maju("musik", 36, p);
      }
    }
    // jalur cadangan: potong dgn atrim dari sumber yang diloop — perlu panjang pola
    let polaMusikDetik = 60;
    if (!musikPanjangAbs && totalDetik > 0) {
      polaMusikDetik = Math.max(3, await durasiWav(musikAbs).catch(() => 60));
    }

    // ---- 4) PANEL KOMIK (36..52): ilustrasi atas + kolom teks bawah ----
    ktx.maju("halaman", 37, "Menggambar panel komik…");
    const skalaIlus = 1.35; // ruang zoom kamera
    const wIlus = Math.round(lebar * skalaIlus);
    const hIlus = Math.round(tata.panelTinggi * skalaIlus);
    const ilus: string[] = [];
    const panel: string[] = [];
    for (let i = 0; i < unit.length; i++) {
      if (apakahBatal(id)) throw new Error("dibatalkan");
      const u = unit[i];
      const ilusAbs = path.join(folderTmp, `ilus-${String(i).padStart(3, "0")}.png`);
      const panelAbs = path.join(folderTmp, `panel-${String(i).padStart(3, "0")}.png`);
      const markup = opsi.ilustrasi === false ? undefined : svgAdegan({
        jenis: u.jenis, lebar: wIlus, tinggi: hIlus, seed: u.seedAdegan,
        tema, ambient: false, cerah: genre.cerah,
      });
      await writeFile(ilusAbs, renderIlustrasiPng({
        lebar: wIlus, tinggi: hIlus, adeganSvg: markup,
        defsSvg: markup ? defsAdegan(tema) : undefined,
        warnaDasar: tema.grad[1],
      }));
      await writeFile(panelAbs, renderTeksPanelPng({
        lebar, tinggi, areaY: tata.panelTinggi,
        teks: u.teks, label: u.label,
        warnaTeks: tema.teks, warnaAksen: tema.aksen,
        skala: u.skala ?? 1,
      }));
      ilus.push(ilusAbs);
      panel.push(panelAbs);
      ktx.maju("halaman", 37 + 15 * ((i + 1) / unit.length), `Menggambar panel adegan ${i + 1}/${unit.length}…`);
    }

    // ---- 5) SEGMEN VIDEO PER ADEGAN (52..90) — sinkron by construction ----
    // v0.32.0: tiap adegan (1) diawasi batas ABSOLUT wall-clock — ffmpeg beku
    // dibunuh otomatis, job TIDAK PERNAH menggantung selamanya lagi; (2) pesan
    // menampilkan detik berjalan (UI terlihat hidup walau time= tak mengalir);
    // (3) adegan yang gagal dicoba SEKALI lagi dgn preset ultrafast.
    const daftarTs: string[] = [];
    let t0Musik = 0;
    for (let i = 0; i < unit.length; i++) {
      if (apakahBatal(id)) throw new Error("dibatalkan");
      const u = unit[i];
      const segAbs = path.join(folderTmp, `seg-${String(i).padStart(3, "0")}.mp4`);
      // umumkan adegan SEBELUM ffmpeg jalan: counter pasti maju per adegan
      ktx.maju("video", 52 + 38 * (i / unit.length), `Merender adegan ${i + 1}/${unit.length}…`);
      const dasar = {
        tema, lebar, tinggi, panelTinggi: tata.panelTinggi,
        ilustrasiAbs: ilus[i], panelTeksAbs: panel[i],
        kamera: u.kamera, durasi: u.durasi, wavAbs: u.wav,
        volumeNarasi: Math.min(1.5, Math.max(0, opsi.volumeNarasi ?? 1)),
        musikAbs: musikPanjangAbs ?? musikAbs,
        musikLoopSumber: !musikPanjangAbs,
        mulaiMusik: musikPanjangAbs ? t0Musik : t0Musik % polaMusikDetik,
        volumeMusik: Math.min(1.5, Math.max(0, opsi.volumeMusik ?? 0.8)),
        fadeMusikKeluar: i === unit.length - 1,
        fadeKeluar: i === unit.length - 1,
        keluar: segAbs,
      };
      const opsiFfmpegAdegan = {
        absolutMs: Math.max(150_000, Math.ceil(u.durasi) * 15_000),
        onDetik: (d: number) => {
          if (d >= 5) ktx.maju("video", 52 + 38 * ((i + 1) / unit.length), `Merender adegan ${i + 1}/${unit.length} — ${d} dtk…`);
        },
      };
      try {
        await jalankanFfmpeg(buatArgumenSegmenKomik(dasar), u.durasi, (f) => {
          ktx.maju("video", 52 + 38 * ((i + f) / unit.length), `Merender adegan ${i + 1}/${unit.length}…`);
        }, ff.bin, (ch) => daftarkanProses(id, ch), opsiFfmpegAdegan);
      } catch (ePertama) {
        if (apakahBatal(id)) throw new Error("dibatalkan");
        // percobaan kedua: preset tercepat — bila tetap gagal, galat asli dilempar
        try {
          ktx.maju("video", 52 + 38 * (i / unit.length), `Mencoba ulang adegan ${i + 1}/${unit.length}…`);
          await jalankanFfmpeg(
            buatArgumenSegmenKomik({ ...dasar, preset: "ultrafast" }),
            u.durasi, undefined, ff.bin, (ch) => daftarkanProses(id, ch),
            { ...opsiFfmpegAdegan, onDetik: undefined },
          );
          job.peringatan = [...(job.peringatan ?? []), `Adegan ${i + 1} dirender dgn mode cepat (percobaan pertama gagal: ${ePertama instanceof Error ? ePertama.message.slice(0, 120) : String(ePertama).slice(0, 120)})`];
        } catch {
          throw ePertama instanceof Error ? ePertama : new Error(String(ePertama));
        }
      }
      t0Musik += u.durasi;
      daftarTs.push(segAbs);
    }

    // ---- 6) CONCAT LANGSUNG -> MP4 FINAL (90..100) — musik sudah di dalam ----
    ktx.maju("gabung", 92, "Menggabungkan adegan…");
    const listAbs = path.join(folderTmp, "concat.txt");
    await writeFile(listAbs, isiListConcat(daftarTs), "utf8");
    const namaMp4 = `${slugify(`video-ai-${judul}`)}.mp4`;
    const mp4Abs = path.join(folderOut, namaMp4);
    await jalankanFfmpeg(buatArgumenConcat(listAbs, mp4Abs), daftarTs.length, undefined, ff.bin, (ch) => daftarkanProses(id, ch));
    const { statSync } = await import("node:fs");
    job.outputs = [{ video: judul, file: namaMp4, ukuran: statSync(mp4Abs).size }];
    const suaraMusik = musikPanjangAbs ? " + musik" : " (tanpa musik)";
    const ikhtisar = pakaiNarasi
      ? `Selesai — video komik ${unit.length} adegan + narasi${metodeNarasi ? ` (${metodeNarasi})` : ""}${suaraMusik} siap`
      : `Selesai — video komik ${unit.length} adegan${suaraMusik} siap`;
    ktx.maju("selesai", 100, ikhtisar);
    job.selesai = true;
    bersihkanBatal(id);
  } catch (e) {
    ktx.gagal(e);
  }
}

async function jalankanRenderHoror(id: string, opsi: OpsiHororMasuk, cerita: Cerita, judul: string, genre: ReturnType<typeof ambilGenre>): Promise<void> {
  const job = jobs.get(id)!;
  const folderTmp = dirWork(`horor/${id}`);
  const folderOut = dirWork(`output/${id}`);
  const ktx = {
    maju: (tahap: InfoJobHoror["tahap"], progres: number, pesan: string) => {
      if (job.selesai) return;
      job.tahap = tahap; job.progres = Math.round(progres); job.pesan = pesan;
    },
    gagal: (e: unknown) => {
      if (apakahBatal(id)) {
        job.dibatalkan = true; job.pesan = "Dibatalkan";
      } else {
        job.error = e instanceof Error ? e.message : String(e);
        job.pesan = "Gagal";
      }
      job.selesai = true; bersihkanBatal(id);
    },
  };
  try {
    await mkdir(folderTmp, { recursive: true });
    await mkdir(folderOut, { recursive: true });
    const tema = TEMA_HOROR.find((t) => t.id === opsi.temaId) ?? TEMA_HOROR[0];
    const [lebar, tinggi] = ukuranHoror(opsi.rasio ?? "9:16", opsi.resolusi ?? "1080p");
    const ff = await pilihFfmpeg();

    // ---- 1) NARASI TTS (0..28) ----
    ktx.maju("narasi", 2, "Membaca skrip…");
    const wavParagraf: (string | null)[][] = [];
    const durasiParagraf: number[][] = [];
    let narasiJadi = 0;
    let galatNarasiPertama: string | null = null;
    let metodeNarasi: string | null = null;
    let gagalBerturut = 0;
    let cepatHabis = false;
    const totalParagraf = cerita.bab.reduce((s, b) => s + b.paragraf.length, 0);
    for (let i = 0; i < cerita.bab.length; i++) {
      wavParagraf.push([]);
      durasiParagraf.push([]);
      for (let j = 0; j < cerita.bab[i].paragraf.length; j++) {
        if (apakahBatal(id)) throw new Error("dibatalkan");
        const teks = cerita.bab[i].paragraf[j];
        const wavAbs = path.join(folderTmp, `narasi-${i}-${j}.wav`);
        let ok = false;
        if (opsi.narasi) {
          const hasil = await buatNarasiWav(teks, { kecepatan: opsi.kecepatanNarasi, volume: opsi.volumeNarasi, suara: opsi.suaraNarasi, pria: opsi.jenisSuaraNarasi === "pria" }, wavAbs, opsi.mesinNarasi ?? "ai");
          ok = hasil.ok;
          if (hasil.metode) metodeNarasi = hasil.metode;
          if (!ok && !galatNarasiPertama && hasil.galat) galatNarasiPertama = hasil.galat;
        }
        if (ok) {
          // v0.28.0 FIX: durasi dibaca dari header RIFF (durasiWav) — BUKAN probe(),
          // yang menuntut stream video sehingga WAV narasi selalu "gagal dibaca"
          // dan suara yang sudah jadi dibuang.
          let durasi = 0;
          let ukuranWav = 0;
          try { durasi = await durasiWav(wavAbs); } catch { /* header aneh — pakai estimasi */ }
          try { ukuranWav = (await import("node:fs")).statSync(wavAbs).size; } catch { /* tak ada berkas */ }
          if (ukuranWav > 1000) {
            durasiParagraf[i][j] = Math.max(3, durasi > 0.3 ? durasi + 0.6 : estimasiDurasi(teks) + 1.5);
            wavParagraf[i][j] = wavAbs;
            narasiJadi++;
          } else {
            ok = false;
            if (!galatNarasiPertama) galatNarasiPertama = "berkas narasi kosong/tak lengkap";
          }
        }
        if (!ok) {
          durasiParagraf[i][j] = 0; // dihitung ulang oleh rencanaHoror (estimasi)
          wavParagraf[i][j] = null;
          gagalBerturut++;
          // TTS memang rusak di perangkat ini -> jangan buang waktu mencoba semua paragraf
          if (narasiJadi === 0 && gagalBerturut >= 3) { cepatHabis = true; break; }
        } else gagalBerturut = 0;
        ktx.maju("narasi", 2 + (28 * (wavParagraf.flat().filter(Boolean).length)) / Math.max(1, totalParagraf),
          `Merekam narasi ${Math.min(totalParagraf, wavParagraf.flat().filter(Boolean).length + 1)}/${totalParagraf}…`);
      }
    if (cepatHabis && i < cerita.bab.length - 1) break;
    }
    const pakaiNarasi = narasiJadi > 0;
    if (opsi.narasi && !pakaiNarasi) {
      const p = `Pembaca skrip tidak menghasilkan suara: ${galatNarasiPertama ?? "TTS tidak tersedia"}. ` +
        `Video tetap dibuat dengan musik saja. Coba tombol "Uji Suara" di panel Pembaca Skrip untuk melihat penyebabnya.`;
      job.peringatan = [p];
      ktx.maju("narasi", 28, p);
    }

    // ---- 2) MUSIK (28..34) — ikut genre: sintesis / MP3 bundel CC-BY / impor sendiri ----
    const musikAbs = await siapkanMusik(folderTmp, opsi, cerita, genre, ff, ktx);

    // ---- 3) HALAMAN + LATAR (34..46) ----
    ktx.maju("halaman", 35, "Menggambar halaman cerita…");
    const rencana = rencanaHoror(cerita, opsi, durasiParagraf, wavParagraf);
    // durasi 0 dari narasi gagal sudah ditangani rencanaHoror (fallback estimasi)
    const pngHalaman: string[] = [];
    for (let i = 0; i < rencana.length; i++) {
      if (apakahBatal(id)) throw new Error("dibatalkan");
      const h = rencana[i];
      const pngAbs = path.join(folderTmp, `halaman-${String(i).padStart(3, "0")}.png`);
      const adeganMarkup = h.adeganJenis && h.adeganSeed !== undefined
        ? svgAdegan({ jenis: h.adeganJenis, lebar, tinggi, seed: h.adeganSeed, tema, ambient: !h.adeganPenuh, cerah: genre.cerah })
        : undefined;
      await writeFile(pngAbs, renderHalamanPng({
        lebar, tinggi,
        besar: h.besar,
        label: h.label,
        footer: h.footer,
        skala: h.skala,
        warnaTeks: tema.teks,
        warnaAksen: tema.aksen,
        adeganSvg: adeganMarkup,
        defsSvg: adeganMarkup ? defsAdegan(tema) : undefined,
        adeganRedup: h.adeganPenuh ? 1 : 0.75,
      }));
      pngHalaman.push(pngAbs);
      ktx.maju("halaman", 35 + (11 * (i + 1)) / rencana.length, `Menggambar halaman ${i + 1}/${rencana.length}…`);
    }
    const pngLatar = path.join(folderTmp, "latar.png");
    await jalankanFfmpeg(buatArgumenLatar(tema, lebar, tinggi, pngLatar), 0, undefined, ff.bin);

    // ---- 4) CHUNK VIDEO (46..90) ----
    const chunks = pecahChunk(rencana);
    const daftarTs: string[] = [];
    for (let c = 0; c < chunks.length; c++) {
      if (apakahBatal(id)) throw new Error("dibatalkan");
      const indeksHal = chunks[c];
      // offset waktu dalam chunk
      let t = 0;
      const halamanChunk = indeksHal.map((i) => {
        const h = rencana[i];
        const seg = { pngAbs: pngHalaman[i], t0: t, t1: t + h.durasi };
        t += h.durasi;
        return seg;
      });
      const durasiChunk = t;
      const wavChunk = indeksHal.map((i) => rencana[i].wav).filter((x): x is string => !!x);
      const tsAbs = path.join(folderTmp, `chunk-${String(c).padStart(3, "0")}.ts`);
      const args = buatArgumenChunk({
        tema, lebar, tinggi, pngLatar,
        halaman: halamanChunk,
        wav: wavChunk,
        musikAbs,
        volumeMusik: Math.min(1.5, Math.max(0, opsi.volumeMusik ?? 0.8)),
        volumeNarasi: Math.min(1.5, Math.max(0, opsi.volumeNarasi ?? 1)),
        durasi: durasiChunk,
        kilat: waktuKilat(tema, durasiChunk, c, cerita.seed),
        keluar: tsAbs,
      });
      await jalankanFfmpeg(args, durasiChunk, (f) => {
        ktx.maju("video", 46 + (44 * (c + f)) / chunks.length, `Merender video bagian ${c + 1}/${chunks.length}…`);
      }, ff.bin, (ch) => daftarkanProses(id, ch));
      daftarTs.push(tsAbs);
    }

    // ---- 5) GABUNG (90..100) ----
    ktx.maju("gabung", 92, "Menggabungkan bagian video…");
    const listAbs = path.join(folderTmp, "concat.txt");
    await writeFile(listAbs, isiListConcat(daftarTs), "utf8");
    const namaMp4 = `${slugify(`video-ai-${judul}`)}.mp4`;
    const mp4Abs = path.join(folderOut, namaMp4);
    await jalankanFfmpeg(buatArgumenConcat(listAbs, mp4Abs), daftarTs.length, undefined, ff.bin, (ch) => daftarkanProses(id, ch));
    const { statSync } = await import("node:fs");
    job.outputs = [{ video: judul, file: namaMp4, ukuran: statSync(mp4Abs).size }];
    const ikhtisar = pakaiNarasi
      ? `Selesai — video + narasi${metodeNarasi ? ` (${metodeNarasi})` : ""} + musik siap`
      : "Selesai — video + musik siap";
    ktx.maju("selesai", 100, ikhtisar);
    job.selesai = true;
    bersihkanBatal(id);
  } catch (e) {
    ktx.gagal(e);
  }
}
