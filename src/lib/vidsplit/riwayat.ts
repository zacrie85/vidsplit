// VidSplit — riwayat ekspor: hasil split sebelumnya tetap tercatat & bisa diunduh ulang
// walau aplikasi sudah ditutup. Tersimpan di work/riwayat.json (folder kerja aplikasi).
import { existsSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { dirWork } from "./ffmpeg";
import type { InfoJob, KeluaranJob, StatusVideoAntrean } from "./jobs";

export interface EntriRiwayat {
  id: string;
  /** epoch ms saat ekspor selesai */
  waktu: number;
  /** status per video saat ekspor berakhir */
  antrean: StatusVideoAntrean[];
  /** daftar file hasil (nama video asal + nama file + ukuran) */
  outputs: KeluaranJob[];
  akselerasi: string;
  paralel: number;
  dibatalkan: boolean;
  adaGagal: boolean;
}

export interface EntriRiwayatCek extends EntriRiwayat {
  /** minimal satu file hasil masih ada di disk */
  adaFile: boolean;
  /** total ukuran file hasil yang masih ada (byte) */
  ukuranAda: number;
}

const MAKS_ENTRI = 60;

let cache: EntriRiwayat[] | null = null;
// tulisan berurutan — job bisa berakhir hampir bersamaan
let rantaiSimpan: Promise<void> = Promise.resolve();

function fileRiwayat(): string {
  return path.join(dirWork(""), "riwayat.json");
}

function muat(): EntriRiwayat[] {
  if (cache) return cache;
  cache = [];
  try {
    const mentah = JSON.parse(readFileSync(fileRiwayat(), "utf8")) as EntriRiwayat[];
    if (Array.isArray(mentah)) {
      cache = mentah.filter(
        (e) => e && typeof e.id === "string" && Array.isArray(e.outputs),
      );
    }
  } catch {
    /* belum ada / rusak — mulai kosong */
  }
  return cache;
}

function simpanLangsung(daftar: EntriRiwayat[]) {
  cache = daftar;
  try {
    writeFileSync(fileRiwayat(), JSON.stringify(daftar, null, 1), "utf8");
  } catch {
    /* disk penuh / tak bisa tulis — cache tetap terpakai selama sesi */
  }
}

function simpan(daftar: EntriRiwayat[]): Promise<void> {
  const tugas = rantaiSimpan.then(() => simpanLangsung(daftar));
  rantaiSimpan = tugas.catch(() => undefined);
  return tugas;
}

/** Catat job yang sudah berakhir ke riwayat — dipanggil jobs.ts saat selesaiSemua.
 *  Job tanpa hasil (semua gagal total) tidak dicatat. */
export function catatRiwayat(job: InfoJob): void {
  if (!job.outputs.length) return;
  const entri: EntriRiwayat = {
    id: job.id,
    waktu: Date.now(),
    antrean: job.antrean.map((v) => ({ ...v })),
    outputs: job.outputs.map((o) => ({ ...o })),
    akselerasi: job.akselerasi,
    paralel: job.paralel,
    dibatalkan: job.dibatalkan,
    adaGagal: job.adaGagal,
  };
  const daftar = muat().filter((e) => e.id !== entri.id);
  daftar.unshift(entri);
  void simpan(daftar.slice(0, MAKS_ENTRI));
}

function folderOutput(id: string): string {
  return path.join(dirWork("output"), id);
}

function cekFile(e: EntriRiwayat): { adaFile: boolean; ukuranAda: number } {
  let adaFile = false;
  let ukuranAda = 0;
  for (const o of e.outputs) {
    try {
      const p = path.join(folderOutput(e.id), o.file);
      if (existsSync(p)) {
        adaFile = true;
        ukuranAda += statSync(p).size;
      }
    } catch {
      /* lewati */
    }
  }
  return { adaFile, ukuranAda };
}

/** Daftar riwayat terbaru dulu + status ketersediaan file di disk */
export function daftarRiwayat(): EntriRiwayatCek[] {
  return muat().map((e) => ({ ...e, ...cekFile(e) }));
}

/** Ambil satu entri (untuk ZIP ulang dari riwayat) */
export function ambilRiwayat(id: string): EntriRiwayat | undefined {
  return muat().find((e) => e.id === id);
}

/** Hapus entri riwayat; bila buangFile=true folder hasilnya ikut dibuang.
 *  Mengembalikan false bila entri tidak ditemukan. */
export function hapusRiwayat(id: string, buangFile: boolean): boolean {
  const daftar = muat();
  const entri = daftar.find((e) => e.id === id);
  if (!entri) return false;
  const sisa = daftar.filter((e) => e.id !== id);
  void simpan(sisa);
  if (buangFile) {
    try {
      rmSync(folderOutput(id), { recursive: true, force: true });
    } catch {
      /* file mungkin sudah tiada */
    }
  }
  return true;
}
