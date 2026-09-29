// VidSplit — manajer job ekspor ANTREAN: video diproses berurutan dari atas ke bawah,
// di dalam tiap video part dirender paralel (pool 1-4 ffmpeg), progres dipolling API
import { randomBytes } from "node:crypto";
import { readdirSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { apakahBatal, bersihkanBatal, daftarkanProses, mintaBatal } from "./batal";
import {
  bangunArgumenPart,
  dirWork,
  jalankanFfmpeg,
  pilihEncoder,
  pilihFfmpeg,
  type InfoVideo,
  type PilihanEncoder,
} from "./ffmpeg";
import { catatRiwayat } from "./riwayat";
import {
  bangunAssSubtitle,
  siapkanSegmenSubtitle,
  type SegmenSub,
} from "./subtitle";
import { buangSalinanKerja, muatSetelanTujuan, salinHasilKeTujuan } from "./tujuan";
import { durasiEfektif, hitungPart, rentangPart, slugify, type CodecVideo, type Pengaturan } from "./types";

export interface KeluaranJob {
  /** nama video asal (nama file sumber) */
  video: string;
  file: string;
  ukuran: number;
}

export type StatusVideo = "menunggu" | "proses" | "selesai" | "gagal" | "dibatalkan";

export interface StatusVideoAntrean {
  nama: string;
  /** jumlah part video ini */
  total: number;
  selesai: number;
  status: StatusVideo;
  /** v0.44.0 — teks tahap khusus (mis. "Analisis suara AI… 12 dtk") saat status proses */
  tahap?: string;
}

export interface InfoJob {
  id: string;
  /** status tiap video dalam antrean, urut dari atas */
  antrean: StatusVideoAntrean[];
  /** index video yang sedang dirender (-1 = sudah tidak ada) */
  videoAktif: number;
  /** jumlah part yang sedang dirender serentak */
  partAktif: number;
  /** 0..100 rata-rata part yang sedang berjalan (kompatibilitas lama) */
  progresPart: number;
  /** 0..100 progres keseluruhan lintas semua video */
  progresTotal: number;
  outputs: KeluaranJob[];
  error: string | null;
  /** true bila ada video yang gagal (antrean tetap lanjut) */
  adaGagal: boolean;
  selesaiSemua: boolean;
  /** true bila tombol Batalkan sudah ditekan dan proses sedang dihentikan */
  batalDiminta: boolean;
  /** true bila ekspor diakhiri oleh tombol Batalkan — hasil parsial tetap bisa diunduh */
  dibatalkan: boolean;
  dibuat: number;
  /** encoder yang dipakai, mis. "NVIDIA NVENC (GPU)" / "CPU (libx264)" */
  akselerasi: string;
  /** jumlah proses serentak per video */
  paralel: number;
  /** v0.6.4 — true saat hasil sedang disalin ke folder tujuan */
  menyalin?: boolean;
  /** v0.6.4 — path absolut folder tempat hasil tersalin (bila simpan otomatis aktif) */
  folderTersimpan?: string | null;
  /** v0.6.4 — pesan peringatan bila penyalinan sebagian/total gagal */
  peringatanSalin?: string | null;
  /** v0.44.0 — pesan peringatan subtitle AI (mis. penerjemah tidak tersedia) */
  peringatanSubtitle?: string | null;
}

const jobs = new Map<string, InfoJob>();

export function ambilJob(id: string): InfoJob | undefined {
  return jobs.get(id);
}

export function daftarJob(): InfoJob[] {
  return [...jobs.values()].sort((a, b) => b.dibuat - a.dibuat);
}

/** Batalkan job yang sedang berjalan: pasang flag + bunuh ffmpeg aktif.
 *  Worker pool berhenti mengambil part baru; hasil parsial tetap bisa diunduh. */
export function batalkanJob(id: string): boolean {
  const job = jobs.get(id);
  if (!job || job.selesaiSemua) return false;
  job.batalDiminta = true;
  mintaBatal(id);
  return true;
}

export interface ItemEkspor {
  /** nama tampilan (nama file sumber) */
  nama: string;
  srcAbs: string;
  bgAbs: string | null;
  /** logo watermark (path absolut) atau null */
  logoAbs: string | null;
  pengaturan: Pengaturan;
  info: InfoVideo;
}

export function mulaiEksporAntrean(
  daftar: ItemEkspor[],
  modeEkspor: "presisi" | "cepat",
): string {
  const id = randomBytes(4).toString("hex");
  const folder = dirWork(`output/${id}`);
  const dirTmp = dirWork("tmp");
  const paralel = Math.min(4, Math.max(1, Math.round(daftar[0]?.pengaturan.prosesParalel || 2)));

  const nTotalPerVideo = daftar.map((it) =>
    hitungPart(
      durasiEfektif(it.info.durasi, it.pengaturan.mulaiDetik, it.pengaturan.akhirDetik),
      it.pengaturan.durasiPart,
    ),
  );
  const totalPartSemua = nTotalPerVideo.reduce((a, b) => a + b, 0);

  const job: InfoJob = {
    id,
    antrean: daftar.map((it, i) => ({
      nama: it.nama,
      total: nTotalPerVideo[i],
      selesai: 0,
      status: "menunggu" as StatusVideo,
    })),
    videoAktif: 0,
    partAktif: 0,
    progresPart: 0,
    progresTotal: 0,
    outputs: [],
    error: null,
    adaGagal: false,
    selesaiSemua: false,
    batalDiminta: false,
    dibatalkan: false,
    dibuat: Date.now(),
    akselerasi: "mendeteksi…",
    paralel,
  };
  jobs.set(id, job);

  (async () => {
    const ff = await pilihFfmpeg();
    // ffmpeg tanpa drawtext hanya fatal kalau memang ada video yang butuh tulisan
    // v0.39.0 — deskripsi ikut dihitung tulisan
    const butuhTeks = daftar.some(
      (it) =>
        !!(it.pengaturan.judul || "").trim() ||
        !!(it.pengaturan.kataPart || "").trim() ||
        !!(it.pengaturan.deskripsi || "").trim(),
    );
    if (butuhTeks && !ff.drawtext) {
      throw new Error(
        `ffmpeg yang terpilih (${ff.bin}) tidak mendukung filter drawtext (libfreetype), padahal ada tulisan judul/Part. Pasang ffmpeg lengkap atau arahkan VIDSPLIT_FFMPEG ke ffmpeg yang punya libfreetype.`,
      );
    }
    const preset = modeEkspor === "cepat" ? "ultrafast" : "medium";
    const crf = modeEkspor === "cepat" ? 23 : 20;
    // encoder per codec (H.264/H.265): hasil uji GPU di-cache per codec, jadi murah
    // dipanggil ulang — video dengan codec berbeda tetap memakai encoder masing-masing
    const cacheEnc = new Map<CodecVideo, PilihanEncoder>();
    const ambilEnc = async (p: Pengaturan): Promise<PilihanEncoder> => {
      const codec: CodecVideo = p.codec === "h265" ? "h265" : "h264";
      let e = cacheEnc.get(codec);
      if (!e) {
        e = await pilihEncoder(p.pakaiGpu !== false, preset, crf, ff.bin, codec);
        cacheEnc.set(codec, e);
      }
      return e;
    };
    job.akselerasi = (await ambilEnc(daftar[0].pengaturan)).nama;

    // v0.8.0 — outputs diisi LANGSUNG saat tiap part selesai (bukan menunggu SEMUA
    // video tuntas): slot menyimpan urutan antrean, segarkanOutput() menyalin isi slot
    // ke job.outputs sehingga UI bisa menampilkan & mengunduh hasil sedini mungkin.
    const slot: (KeluaranJob | null)[] = [];
    let pengisi = 0;
    const segarkanOutput = () => {
      job.outputs = slot.filter((s): s is KeluaranJob => !!s);
    };
    const fraksi = new Map<string, number>(); // "vi:part" → 0..1

    const perbaruiProgres = () => {
      let jumlah = 0;
      for (const f of fraksi.values()) jumlah += f;
      job.progresTotal = Math.min(100, Math.round((jumlah / Math.max(1, totalPartSemua)) * 100));
      let rata = 0;
      if (fraksi.size) {
        for (const f of fraksi.values()) rata += f;
        rata /= fraksi.size;
      }
      job.progresPart = Math.round(rata * 100);
      job.partAktif = fraksi.size;
    };

    /** render SATU part dari video ke-vi */
    const renderSatu = async (
      vi: number,
      it: ItemEkspor,
      n: number,
      segmenSub: SegmenSub[] | null,
    ) => {
      if (apakahBatal(id)) throw new Error("DIBATALKAN");
      const p = it.pengaturan;
      const enc = await ambilEnc(p);
      if (!job.akselerasi.includes(enc.nama)) {
        job.akselerasi = `${job.akselerasi} + ${enc.nama}`;
      }
      const [mulai, durasi] = rentangPart(
        n,
        it.info.durasi,
        p.durasiPart,
        p.mulaiDetik,
        p.akhirDetik,
      );
      // v0.7.0 mode "asli": pertahankan ukuran ASLI video — hanya digenapkan agar
      // valid utk yuv420p (libx264 menolak dimensi ganjil); mode lain tetap 9:16
      const W =
        p.mode === "asli"
          ? Math.max(2, it.info.lebar - (it.info.lebar % 2))
          : p.resolusi === "720"
            ? 720
            : 1080;
      const H =
        p.mode === "asli"
          ? Math.max(2, it.info.tinggi - (it.info.tinggi % 2))
          : p.resolusi === "720"
            ? 1280
            : 1920;
      const fps = Math.min(60, Math.max(15, Math.round(it.info.fps)));
      const slug = slugify(p.judul);
      const nama = `${slug}-part-${String(n).padStart(2, "0")}.mp4`;
      const keluar = path.join(folder, nama);
      const tag = `${id}-${vi}-${n}`;
      // v0.44.0 — bangun berkas .ass subtitle utk part ini (bila subtitle aktif
      // dan hasil analisis suara tersedia); waktu segmen RELATIF RENTANG TRIM
      const pakaiBg = !!it.bgAbs;
      let fileSub: string | null = null;
      if (segmenSub && segmenSub.length) {
        const ass = bangunAssSubtitle({
          segmen: segmenSub,
          // rentangPart: mulai ABSOLUT video → relatif trim = mulai - p.mulaiDetik
          mulaiPartRel: mulai - p.mulaiDetik,
          durasiPart: durasi,
          offsetIntro: pakaiBg ? p.durasiIntro : 0,
          W,
          H,
          ukuran: p.subtitleUkuran,
          yPersen: p.subtitleY,
        });
        if (ass) {
          fileSub = path.join(dirTmp, `${tag}-sub.ass`);
          try {
            writeFileSync(fileSub, ass, "utf8");
          } catch {
            fileSub = null;
          }
        }
      }
      const { args, total } = bangunArgumenPart({
        src: it.srcAbs,
        bg: it.bgAbs,
        logo: it.logoAbs,
        pengaturan: p,
        n,
        mulai,
        durasi,
        W,
        H,
        fps,
        adaAudio: it.info.adaAudio,
        judulTxt: p.judul || "",
        partTxt: `${p.kataPart || "Part"} ${n}`,
        deskripsiTxt: p.deskripsi || "",
        fileSub,
        dirTmp,
        tag,
        codecArgs: enc.codecArgs,
        keluar,
      });
      const slotIdx = pengisi++;
      return jalankanFfmpeg(args, total, (f) => {
        fraksi.set(`${vi}:${n}`, f);
        perbaruiProgres();
      }, ff.bin, (c) => daftarkanProses(id, c))
        .then(() => {
          for (const akhiran of ["judul", "part", "deskripsi", "sub"]) {
            try {
              unlinkSync(path.join(dirTmp, `${tag}-${akhiran}.txt`));
            } catch {
              /* abaikan */
            }
            try {
              unlinkSync(path.join(dirTmp, `${tag}-${akhiran}.ass`));
            } catch {
              /* abaikan */
            }
          }
          slot[slotIdx] = { video: it.nama, file: nama, ukuran: statSync(keluar).size };
          job.antrean[vi].selesai += 1;
          segarkanOutput(); // v0.8.0 — part baru selesai → langsung tampak di UI
        })
        .finally(() => {
          fraksi.delete(`${vi}:${n}`);
          perbaruiProgres();
        });
    };

    /** render semua part satu video — pool paralel; antrean video BERURUTAN.
     *  Bila video ini gagal, tandai gagal lalu antrean LANJUT ke video berikutnya. */
    const renderVideo = async (vi: number, it: ItemEkspor, segmenSub: SegmenSub[] | null) => {
      job.videoAktif = vi;
      job.antrean[vi].status = "proses";
      const nTotal = nTotalPerVideo[vi];
      let berikut = 1;
      let gagal = false;
      const pekerja = Array.from({ length: Math.min(paralel, nTotal) }, async () => {
        while (true) {
          if (apakahBatal(id)) return;
          const n = berikut;
          berikut += 1;
          if (n > nTotal || gagal) return;
          try {
            await renderSatu(vi, it, n, segmenSub);
          } catch (e) {
            // dibatalkan ≠ gagal — keluar senyap, status dibatalkan diset di luar
            if (apakahBatal(id)) return;
            // hentikan pengambilan part baru video INI; part berjalan biar selesai
            if (!gagal) {
              gagal = true;
              job.error = `${it.nama}: ${e instanceof Error ? e.message : String(e)}`;
            }
          }
        }
      });
      await Promise.all(pekerja);
      if (apakahBatal(id)) {
        job.antrean[vi].status = "dibatalkan";
        return;
      }
      if (gagal) {
        job.antrean[vi].status = "gagal";
        job.adaGagal = true;
      } else {
        job.antrean[vi].status = "selesai";
      }
    };

    for (let vi = 0; vi < daftar.length; vi++) {
      if (apakahBatal(id)) break;
      const it = daftar[vi];
      // v0.44.0 — SUBTITLE AI OTOMATIS: analisis suara SEKALI per video (dgn cache)
      // sebelum render part. Gagal AI TIDAK menggagalkan ekspor — lanjut tanpa subtitle.
      let segmenSub: SegmenSub[] | null = null;
      if (it.pengaturan.subtitleAktif && it.info.adaAudio) {
        const mulaiAi = Date.now();
        const pemantau = setInterval(() => {
          job.antrean[vi].tahap = `AI: analisis suara… ${Math.round((Date.now() - mulaiAi) / 1000)} dtk`;
        }, 1000);
        try {
          const hasil = await siapkanSegmenSubtitle(
            it.srcAbs,
            it.pengaturan.mulaiDetik,
            it.pengaturan.akhirDetik,
            it.info.durasi,
            ff.bin,
            { onTahap: (t) => { job.antrean[vi].tahap = `AI: ${t}`; } },
          );
          if (hasil) {
            segmenSub = hasil.segmen;
            if (hasil.bahasa === "en" && !hasil.diterjemahkan && !job.peringatanSubtitle) {
              job.peringatanSubtitle =
                "Penerjemah EN→ID tidak tersedia — subtitle dipakai dalam bahasa Inggris asli";
            }
          } else if (!job.peringatanSubtitle) {
            job.peringatanSubtitle =
              "Mesin subtitle AI tidak tersedia (model tidak ditemukan) — video dirender tanpa subtitle";
          }
        } catch (e) {
          if (!job.peringatanSubtitle) {
            job.peringatanSubtitle = `Subtitle AI dilewati: ${
              e instanceof Error ? e.message : String(e)
            }`;
          }
        } finally {
          clearInterval(pemantau);
          delete job.antrean[vi].tahap;
        }
      } else if (it.pengaturan.subtitleAktif && !it.info.adaAudio) {
        job.antrean[vi].tahap = undefined;
        if (!job.peringatanSubtitle) {
          job.peringatanSubtitle = `${it.nama}: tanpa track audio — subtitle AI dilewati`;
        }
      }
      await renderVideo(vi, it, segmenSub);
    }

    // rapikan urutan akhir — slot menjaga posisi meski ada video yang gagal di tengah
    segarkanOutput();

    if (apakahBatal(id)) {
      // pembatalan: tandai status, buang file parsial yang tak jadi, jaga hasil utuh
      for (const v of job.antrean) {
        if (v.status === "menunggu" || v.status === "proses") v.status = "dibatalkan";
      }
      job.error = null;
      job.dibatalkan = true;
      try {
        const utuh = new Set(job.outputs.map((o) => o.file));
        for (const f of readdirSync(folder)) {
          if (f.endsWith(".mp4") && !utuh.has(f)) {
            try {
              unlinkSync(path.join(folder, f));
            } catch {
              /* abaikan */
            }
          }
        }
      } catch {
        /* folder mungkin belum ada */
      }
    }

    // v0.6.4 — simpan otomatis: salin hasil ke folder tujuan yang dipilih user
    // SEBELUM proses dimulai. Hasil tetap tersedia di aplikasi; salinan ini untuk
    // langsung dipakai di folder pilihan user tanpa mengunduh satu per satu.
    const setelan = muatSetelanTujuan();
    if (setelan.otomatis && setelan.folder && job.outputs.length) {
      job.menyalin = true;
      try {
        const hasil = await salinHasilKeTujuan(job, setelan.folder);
        job.folderTersimpan = hasil.folder;
        if (hasil.gagal.length) {
          job.peringatanSalin = `${hasil.gagal.length} dari ${job.outputs.length} file gagal disalin ke folder tujuan — salinan tetap ada di aplikasi`;
        } else if (setelan.bersihkanKerja) {
          buangSalinanKerja(job); // hemat ruang: hanya bila SEMUA file terverifikasi tersalin
        }
      } catch (e) {
        job.peringatanSalin = `Gagal menyalin ke folder tujuan: ${
          e instanceof Error ? e.message : String(e)
        }`;
      } finally {
        job.menyalin = false;
      }
    }

    job.videoAktif = -1;
    job.partAktif = 0;
    job.selesaiSemua = true;
    catatRiwayat(job); // hasil tetap bisa diunduh ulang dari panel Riwayat
    bersihkanBatal(id);
  })().catch((e) => {
    job.error = e instanceof Error ? e.message : String(e);
    job.selesaiSemua = true;
    for (const v of job.antrean) {
      if (v.status === "menunggu" || v.status === "proses") v.status = "gagal";
    }
    job.adaGagal = true;
    catatRiwayat(job); // part yang sempat jadi sebelum gagal tetap tercatat
    bersihkanBatal(id);
  });

  return id;
}
