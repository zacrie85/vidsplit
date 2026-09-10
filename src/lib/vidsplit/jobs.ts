// VidSplit — manajer job ekspor: pool paralel per part, progres dipolling API
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
import { hitungPart, rentangPart, slugify, type Pengaturan } from "./types";

export interface KeluaranJob {
  file: string;
  ukuran: number;
}

export interface InfoJob {
  id: string;
  total: number;
  selesai: number;
  /** jumlah part yang sedang dirender serentak */
  partAktif: number;
  /** 0..100 rata-rata part yang sedang berjalan (kompatibilitas lama) */
  progresPart: number;
  /** 0..100 progres keseluruhan (semua part digabung) */
  progresTotal: number;
  outputs: KeluaranJob[];
  error: string | null;
  selesaiSemua: boolean;
  dibuat: number;
  /** encoder yang dipakai, mis. "NVIDIA NVENC (GPU)" / "CPU (libx264)" */
  akselerasi: string;
  /** jumlah proses serentak */
  paralel: number;
}

const jobs = new Map<string, InfoJob>();

export function ambilJob(id: string): InfoJob | undefined {
  return jobs.get(id);
}

export function daftarJob(): InfoJob[] {
  return [...jobs.values()].sort((a, b) => b.dibuat - a.dibuat);
}

export interface OpsiEkspor {
  srcAbs: string;
  bgAbs: string | null;
  pengaturan: Pengaturan;
  info: InfoVideo;
  modeEkspor: "presisi" | "cepat";
}

export function mulaiEkspor(o: OpsiEkspor): string {
  const id = randomBytes(4).toString("hex");
  const folder = dirWork(`output/${id}`);
  const dirTmp = dirWork("tmp");
  const p = o.pengaturan;
  const nTotal = hitungPart(o.info.durasi, p.durasiPart);
  const W = p.resolusi === "720" ? 720 : 1080;
  const H = p.resolusi === "720" ? 1280 : 1920;
  const fps = Math.min(60, Math.max(15, Math.round(o.info.fps)));
  const preset = o.modeEkspor === "cepat" ? "ultrafast" : "medium";
  const crf = o.modeEkspor === "cepat" ? 23 : 20;
  const slug = slugify(p.judul);
  const paralel = Math.min(4, Math.max(1, Math.round(p.prosesParalel || 2)));

  const job: InfoJob = {
    id,
    total: nTotal,
    selesai: 0,
    partAktif: 0,
    progresPart: 0,
    progresTotal: 0,
    outputs: [],
    error: null,
    selesaiSemua: false,
    dibuat: Date.now(),
    akselerasi: "mendeteksi…",
    paralel,
  };
  jobs.set(id, job);

  (async () => {
    // pilih ffmpeg terbaik (yang punya drawtext utk tulisan) + encoder sekali untuk seluruh job
    const ff = await pilihFfmpeg();
    const butuhTeks = !!(p.judul || "").trim() || !!(p.kataPart || "").trim();
    if (butuhTeks && !ff.drawtext) {
      throw new Error(
        `ffmpeg yang terpilih (${ff.bin}) tidak mendukung filter drawtext (libfreetype), padahal ada tulisan judul/Part. Pasang ffmpeg lengkap atau arahkan VIDSPLIT_FFMPEG ke ffmpeg yang punya libfreetype.`,
      );
    }
    const enc = await pilihEncoder(p.pakaiGpu !== false, preset, crf, ff.bin);
    job.akselerasi = enc.nama;

    const slot: (KeluaranJob | null)[] = Array.from({ length: nTotal }, () => null);
    const fraksi = new Map<number, number>(); // progres per part 0..1
    let berikut = 1;
    let mati = false;

    const perbaruiProgres = () => {
      let jumlah = job.selesai;
      for (const f of fraksi.values()) jumlah += f;
      job.progresTotal = Math.min(100, Math.round((jumlah / Math.max(1, nTotal)) * 100));
      let rata = 0;
      if (fraksi.size) {
        for (const f of fraksi.values()) rata += f;
        rata /= fraksi.size;
      }
      job.progresPart = Math.round(rata * 100);
      job.partAktif = fraksi.size;
    };

    const renderSatu = async (n: number) => {
      if (mati) return;
      const [mulai, durasi] = rentangPart(n, o.info.durasi, p.durasiPart);
      const nama = `${slug}-part-${String(n).padStart(2, "0")}.mp4`;
      const keluar = path.join(folder, nama);
      const tag = `${id}-${n}`;
      const { args, total } = bangunArgumenPart({
        src: o.srcAbs,
        bg: o.bgAbs,
        pengaturan: p,
        n,
        mulai,
        durasi,
        W,
        H,
        fps,
        adaAudio: o.info.adaAudio,
        judulTxt: p.judul || "",
        partTxt: `${p.kataPart || "Part"} ${n}`,
        dirTmp,
        tag,
        codecArgs: enc.codecArgs,
        keluar,
      });
      try {
        await jalankanFfmpeg(args, total, (f) => {
          fraksi.set(n, f);
          perbaruiProgres();
        }, ff.bin);
      } finally {
        fraksi.delete(n);
      }
      for (const akhiran of ["judul", "part"]) {
        try {
          unlinkSync(path.join(dirTmp, `${tag}-${akhiran}.txt`));
        } catch {
          /* abaikan */
        }
      }
      slot[n - 1] = { file: nama, ukuran: statSync(keluar).size };
      job.selesai += 1;
      job.outputs = slot.filter((s): s is KeluaranJob => !!s);
      perbaruiProgres();
    };

    // pool pekerja: `paralel` ffmpeg serentak, antre part berikutnya saat ada yang selesai
    const pekerja = Array.from({ length: Math.min(paralel, nTotal) }, async () => {
      while (true) {
        const n = berikut;
        berikut += 1;
        if (n > nTotal || mati) return;
        try {
          await renderSatu(n);
        } catch (e) {
          mati = true; // hentikan pengambilan part baru; part berjalan biarkan selesai
          throw e;
        }
      }
    });
    await Promise.all(pekerja);
    job.partAktif = 0;
    job.progresTotal = 100;
    job.selesaiSemua = true;
  })().catch((e) => {
    job.error = e instanceof Error ? e.message : String(e);
  });

  return id;
}
