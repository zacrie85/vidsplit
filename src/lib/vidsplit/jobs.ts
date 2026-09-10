// VidSplit — manajer job ekspor ANTREAN: video diproses berurutan dari atas ke bawah,
// di dalam tiap video part dirender paralel (pool 1-4 ffmpeg), progres dipolling API
import { randomBytes } from "node:crypto";
import { statSync, unlinkSync } from "node:fs";
import path from "node:path";
import {
  bangunArgumenPart,
  dirWork,
  jalankanFfmpeg,
  pilihEncoder,
  pilihFfmpeg,
  type InfoVideo,
} from "./ffmpeg";
import { durasiEfektif, hitungPart, rentangPart, slugify, type Pengaturan } from "./types";

export interface KeluaranJob {
  /** nama video asal (nama file sumber) */
  video: string;
  file: string;
  ukuran: number;
}

export type StatusVideo = "menunggu" | "proses" | "selesai" | "gagal";

export interface StatusVideoAntrean {
  nama: string;
  /** jumlah part video ini */
  total: number;
  selesai: number;
  status: StatusVideo;
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
  dibuat: number;
  /** encoder yang dipakai, mis. "NVIDIA NVENC (GPU)" / "CPU (libx264)" */
  akselerasi: string;
  /** jumlah proses serentak per video */
  paralel: number;
}

const jobs = new Map<string, InfoJob>();

export function ambilJob(id: string): InfoJob | undefined {
  return jobs.get(id);
}

export function daftarJob(): InfoJob[] {
  return [...jobs.values()].sort((a, b) => b.dibuat - a.dibuat);
}

export interface ItemEkspor {
  /** nama tampilan (nama file sumber) */
  nama: string;
  srcAbs: string;
  bgAbs: string | null;
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
    dibuat: Date.now(),
    akselerasi: "mendeteksi…",
    paralel,
  };
  jobs.set(id, job);

  (async () => {
    const ff = await pilihFfmpeg();
    // ffmpeg tanpa drawtext hanya fatal kalau memang ada video yang butuh tulisan
    const butuhTeks = daftar.some(
      (it) => !!(it.pengaturan.judul || "").trim() || !!(it.pengaturan.kataPart || "").trim(),
    );
    if (butuhTeks && !ff.drawtext) {
      throw new Error(
        `ffmpeg yang terpilih (${ff.bin}) tidak mendukung filter drawtext (libfreetype), padahal ada tulisan judul/Part. Pasang ffmpeg lengkap atau arahkan VIDSPLIT_FFMPEG ke ffmpeg yang punya libfreetype.`,
      );
    }
    // encoder dipilih sekali dari video pertama (paralel/GPU memang global)
    const p0 = daftar[0].pengaturan;
    const preset = modeEkspor === "cepat" ? "ultrafast" : "medium";
    const crf = modeEkspor === "cepat" ? 23 : 20;
    const enc = await pilihEncoder(p0.pakaiGpu !== false, preset, crf, ff.bin);
    job.akselerasi = enc.nama;

    const slot: (KeluaranJob | null)[] = Array.from({ length: totalPartSemua }, () => null);
    let pengisi = 0; // index slot berikutnya (urut: video berurutan, part paralel dalam video)
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
    const renderSatu = (vi: number, it: ItemEkspor, n: number) => {
      const p = it.pengaturan;
      const [mulai, durasi] = rentangPart(
        n,
        it.info.durasi,
        p.durasiPart,
        p.mulaiDetik,
        p.akhirDetik,
      );
      const W = p.resolusi === "720" ? 720 : 1080;
      const H = p.resolusi === "720" ? 1280 : 1920;
      const fps = Math.min(60, Math.max(15, Math.round(it.info.fps)));
      const slug = slugify(p.judul);
      const nama = `${slug}-part-${String(n).padStart(2, "0")}.mp4`;
      const keluar = path.join(folder, nama);
      const tag = `${id}-${vi}-${n}`;
      const { args, total } = bangunArgumenPart({
        src: it.srcAbs,
        bg: it.bgAbs,
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
        dirTmp,
        tag,
        codecArgs: enc.codecArgs,
        keluar,
      });
      const slotIdx = pengisi++;
      return jalankanFfmpeg(args, total, (f) => {
        fraksi.set(`${vi}:${n}`, f);
        perbaruiProgres();
      }, ff.bin)
        .then(() => {
          for (const akhiran of ["judul", "part"]) {
            try {
              unlinkSync(path.join(dirTmp, `${tag}-${akhiran}.txt`));
            } catch {
              /* abaikan */
            }
          }
          slot[slotIdx] = { video: it.nama, file: nama, ukuran: statSync(keluar).size };
          job.antrean[vi].selesai += 1;
        })
        .finally(() => {
          fraksi.delete(`${vi}:${n}`);
          perbaruiProgres();
        });
    };

    /** render semua part satu video — pool paralel; antrean video BERURUTAN.
     *  Bila video ini gagal, tandai gagal lalu antrean LANJUT ke video berikutnya. */
    const renderVideo = async (vi: number, it: ItemEkspor) => {
      job.videoAktif = vi;
      job.antrean[vi].status = "proses";
      const nTotal = nTotalPerVideo[vi];
      let berikut = 1;
      let gagal = false;
      const pekerja = Array.from({ length: Math.min(paralel, nTotal) }, async () => {
        while (true) {
          const n = berikut;
          berikut += 1;
          if (n > nTotal || gagal) return;
          try {
            await renderSatu(vi, it, n);
          } catch (e) {
            // hentikan pengambilan part baru video INI; part berjalan biar selesai
            if (!gagal) {
              gagal = true;
              job.error = `${it.nama}: ${e instanceof Error ? e.message : String(e)}`;
            }
          }
        }
      });
      await Promise.all(pekerja);
      if (gagal) {
        job.antrean[vi].status = "gagal";
        job.adaGagal = true;
      } else {
        job.antrean[vi].status = "selesai";
      }
    };

    for (let vi = 0; vi < daftar.length; vi++) {
      await renderVideo(vi, daftar[vi]);
    }

    // bila ada video gagal, tukar urutan slot supaya outputs yang terisi rapat
    job.outputs = slot.filter((s): s is KeluaranJob => !!s);
    job.videoAktif = -1;
    job.partAktif = 0;
    job.selesaiSemua = true;
  })().catch((e) => {
    job.error = e instanceof Error ? e.message : String(e);
    job.selesaiSemua = true;
    for (const v of job.antrean) {
      if (v.status === "menunggu" || v.status === "proses") v.status = "gagal";
    }
    job.adaGagal = true;
  });

  return id;
}
