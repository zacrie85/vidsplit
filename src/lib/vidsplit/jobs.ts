// VidSplit — manajer job ekspor (sekuensial per part, progres dipolling API)
import { randomBytes } from "node:crypto";
import { statSync, unlinkSync } from "node:fs";
import path from "node:path";
import { bangunArgumenPart, dirWork, jalankanFfmpeg, type InfoVideo } from "./ffmpeg";
import { hitungPart, rentangPart, slugify, type Pengaturan } from "./types";

export interface KeluaranJob {
  file: string;
  ukuran: number;
}

export interface InfoJob {
  id: string;
  total: number;
  selesai: number;
  partAktif: number;
  /** 0..100 untuk part yang sedang dirender */
  progresPart: number;
  outputs: KeluaranJob[];
  error: string | null;
  selesaiSemua: boolean;
  dibuat: number;
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

  const job: InfoJob = {
    id,
    total: nTotal,
    selesai: 0,
    partAktif: 1,
    progresPart: 0,
    outputs: [],
    error: null,
    selesaiSemua: false,
    dibuat: Date.now(),
  };
  jobs.set(id, job);

  (async () => {
    for (let n = 1; n <= nTotal; n++) {
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
        preset,
        crf,
        keluar,
      });
      await jalankanFfmpeg(args, total, (f) => {
        job.progresPart = Math.round(f * 100);
      });
      // bersihkan file teks sementara part ini
      for (const akhiran of ["judul", "part"]) {
        try {
          unlinkSync(path.join(dirTmp, `${tag}-${akhiran}.txt`));
        } catch {
          /* abaikan */
        }
      }
      job.selesai = n;
      job.progresPart = 0;
      job.partAktif = Math.min(n + 1, nTotal);
      job.outputs.push({ file: nama, ukuran: statSync(keluar).size });
    }
    job.selesaiSemua = true;
  })().catch((e) => {
    job.error = e instanceof Error ? e.message : String(e);
  });

  return id;
}
