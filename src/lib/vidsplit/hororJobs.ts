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
import { renderHalamanPng } from "./teksLayar";
import {
  TEMA_HOROR, rencanaHoror, pecahChunk, waktuKilat, buatArgumenLatar,
  buatArgumenChunk, buatArgumenConcat, isiListConcat, ukuranHoror,
  MUSIK_BUNDEL, pathMusikBundel,
  type OpsiRenderHoror,
} from "./hororRender";
import { svgAdegan, defsAdegan } from "./hororIlustrasi";
import { ambilGenre } from "./videoAi";
import { slugify } from "./types";

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
  void jalankanRenderHoror(id, opsi, cerita, judul, genre);
  return id;
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
          const hasil = await buatNarasiWav(teks, { kecepatan: opsi.kecepatanNarasi, volume: opsi.volumeNarasi, suara: opsi.suaraNarasi }, wavAbs, opsi.mesinNarasi ?? "ai");
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
    ktx.maju("musik", 29, `Menyiapkan musik ${genre.nama.toLowerCase()}…`);
    const musikAbs = path.join(folderTmp, "musik.wav");
    const bundel = MUSIK_BUNDEL.find((m) => m.id === opsi.sumberMusik);
    let musikSiap = false;
    if (bundel) {
      try {
        const src = pathMusikBundel(bundel.file);
        // cek berkas terbaca lalu konversi ke wav 44.1k stereo dgn volume awal netral (vol diterapkan saat mix)
        await jalankanFfmpeg(["-y", "-i", src, "-ar", "44100", "-ac", "2", musikAbs], 0, undefined, ff.bin);
        musikSiap = true;
        ktx.maju("musik", 33, `Musik: ${bundel.nama} (${bundel.kredit})`);
      } catch { musikSiap = false; }
    } else if (opsi.sumberMusik === "impor" && opsi.musikImporRel) {
      try {
        const pathAman = (await import("./ffmpeg")).pathAman;
        const src = pathAman(opsi.musikImporRel);
        await jalankanFfmpeg(["-y", "-i", src, "-ar", "44100", "-ac", "2", musikAbs], 0, undefined, ff.bin);
        musikSiap = true;
        ktx.maju("musik", 33, "Musik: impor sendiri");
      } catch { musikSiap = false; }
    }
    if (!musikSiap) {
      await writeFile(musikAbs, sintesisMusikGenre({
        intensitas: opsi.intensitasMusik ?? genre.intensitasMusik,
        polaDetik: 60,
        seed: cerita.seed,
        mood: genre.moodMusik, // v0.29.0: hangat utk dongeng/motivasi/fakta
      }));
    }

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
