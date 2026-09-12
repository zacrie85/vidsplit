// VidSplit — folder tujuan hasil ekspor (v0.6.4): user memilih drive/folder SEBELUM
// ekspor & split dijalankan; begitu render berakhir hasil otomatis DISALIN ke sana —
// tidak perlu lagi mengunduh satu per satu dari aplikasi.
// Setelan persisten di work/folder-tujuan.json (ikut folder data aplikasi).
import { mkdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { copyFile } from "node:fs/promises";
import path from "node:path";
import { dirWork } from "./ffmpeg";
import type { KeluaranJob, StatusVideoAntrean } from "./jobs";

export interface SetelanTujuan {
  /** path absolut folder tujuan; null = belum dipilih */
  folder: string | null;
  /** salin otomatis hasil ke folder tujuan saat ekspor berakhir (default aktif) */
  otomatis: boolean;
  /** buang salinan di folder kerja setelah tersalin & terverifikasi (hemat ruang) */
  bersihkanKerja: boolean;
}

export const setelanTujuanDefault: SetelanTujuan = {
  folder: null,
  otomatis: true,
  bersihkanKerja: false,
};

function fileSetelan(): string {
  return path.join(dirWork(""), "folder-tujuan.json");
}

let cache: SetelanTujuan | null = null;
// tulisan berurutan — perubahan setelan bisa datang hampir bersamaan
let rantaiSimpan: Promise<void> = Promise.resolve();

export function muatSetelanTujuan(): SetelanTujuan {
  if (cache) return cache;
  cache = { ...setelanTujuanDefault };
  try {
    const mentah = JSON.parse(readFileSync(fileSetelan(), "utf8")) as Partial<SetelanTujuan>;
    if (mentah && typeof mentah === "object") {
      if (typeof mentah.folder === "string" && mentah.folder.trim()) {
        cache.folder = mentah.folder.trim();
      }
      if (typeof mentah.otomatis === "boolean") cache.otomatis = mentah.otomatis;
      if (typeof mentah.bersihkanKerja === "boolean") {
        cache.bersihkanKerja = mentah.bersihkanKerja;
      }
    }
  } catch {
    /* belum ada / rusak — pakai default */
  }
  return cache;
}

function simpanLangsung(s: SetelanTujuan) {
  cache = s;
  try {
    writeFileSync(fileSetelan(), JSON.stringify(s, null, 1), "utf8");
  } catch {
    /* disk penuh / tak bisa tulis — cache tetap terpakai selama sesi */
  }
}

export function simpanSetelanTujuan(s: SetelanTujuan): Promise<void> {
  const tugas = rantaiSimpan.then(() => simpanLangsung(s));
  rantaiSimpan = tugas.catch(() => undefined);
  return tugas;
}

/** Gabungkan sebagian field ke setelan tersimpan (dipakai API POST). */
export async function perbaruiSetelanTujuan(ubah: Partial<SetelanTujuan>): Promise<SetelanTujuan> {
  const kini = muatSetelanTujuan();
  const baru: SetelanTujuan = {
    folder: ubah.folder !== undefined ? ubah.folder : kini.folder,
    otomatis: ubah.otomatis !== undefined ? ubah.otomatis : kini.otomatis,
    bersihkanKerja:
      ubah.bersihkanKerja !== undefined ? ubah.bersihkanKerja : kini.bersihkanKerja,
  };
  await simpanSetelanTujuan(baru);
  return baru;
}

/** Validasi & siapkan folder tujuan: harus absolut, dibuat bila belum ada,
 *  dan lolos uji tulis sungguhan (tangkap kasus Program Files / drive baca-saja). */
export function validasiFolderTujuan(
  mentah: string,
): { ok: true; folder: string } | { ok: false; error: string } {
  const t = (mentah || "").trim();
  if (!t) return { ok: false, error: "Folder belum diisi" };
  if (t.length > 200) return { ok: false, error: "Path terlalu panjang (maks 200 karakter)" };
  if (!path.isAbsolute(t)) {
    return {
      ok: false,
      error: "Path harus absolut — contoh: D:\\Hasil Split atau C:\\Users\\Nama\\Videos",
    };
  }
  let bersih = path.normalize(t);
  try {
    mkdirSync(bersih, { recursive: true });
    const probe = path.join(bersih, ".uji-tulis-vidsplit");
    writeFileSync(probe, "ok");
    unlinkSync(probe);
  } catch (e) {
    return {
      ok: false,
      error: `Folder tidak bisa dibuat atau ditulis: ${e instanceof Error ? e.message : e}`,
    };
  }
  // hilangkan pemisah di ujung (kecuali root drive seperti "C:\")
  while (bersih.length > 3 && /[\\/]$/.test(bersih)) bersih = bersih.slice(0, -1);
  return { ok: true, folder: bersih };
}

/** Bersihkan nama jadi aman utk nama folder/berkas Windows (tanpa <>:"/\|?* dsb). */
export function bersihkanNama(nama: string): string {
  const b = (nama || "")
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/[.\s]+$/g, "")
    .slice(0, 60)
    .trim();
  return b || "Hasil VidSplit";
}

/** Path subfolder unik di dalam folder tujuan: "Nama", "Nama (2)", "Nama (3)", … */
function folderUnik(dasar: string, induk: string): string {
  let kandidat = path.join(induk, dasar);
  if (!existsDir(kandidat)) return kandidat;
  for (let i = 2; i < 1000; i++) {
    kandidat = path.join(induk, `${dasar} (${i})`);
    if (!existsDir(kandidat)) return kandidat;
  }
  return path.join(induk, `${dasar}-${Date.now()}`);
}

function existsDir(p: string): boolean {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
}

export interface HasilSalin {
  /** path absolut folder tempat hasil tersalin */
  folder: string;
  /** nama file yang gagal disalin (kosong = semua berhasil) */
  gagal: string[];
}

/** Salin semua hasil job ke folder tujuan, dalam subfolder bernama dari video pertama.
 *  Ukuran diverifikasi setelah tiap penyalinan — file gagal dilaporkan, bukan diam-diam. */
export async function salinHasilKeTujuan(
  job: { id: string; outputs: KeluaranJob[]; antrean: StatusVideoAntrean[] },
  folderTujuan: string,
): Promise<HasilSalin> {
  const sumberFolder = path.join(dirWork("output"), job.id);
  const dasar = bersihkanNama(
    (job.antrean[0]?.nama || "Hasil VidSplit").replace(/\.[^.]+$/, ""),
  );
  const folderJob = folderUnik(dasar, folderTujuan);
  mkdirSync(folderJob, { recursive: true });
  const gagal: string[] = [];
  for (const o of job.outputs) {
    const src = path.join(sumberFolder, o.file);
    const dst = path.join(folderJob, o.file);
    try {
      await copyFile(src, dst);
      if (statSync(src).size !== statSync(dst).size) {
        throw new Error("ukuran tidak sama setelah disalin");
      }
    } catch {
      gagal.push(o.file);
    }
  }
  return { folder: folderJob, gagal };
}

/** Buang salinan hasil di folder kerja (hanya yang sudah terverifikasi tersalin). */
export function buangSalinanKerja(job: { id: string; outputs: KeluaranJob[] }): void {
  const sumberFolder = path.join(dirWork("output"), job.id);
  for (const o of job.outputs) {
    try {
      unlinkSync(path.join(sumberFolder, o.file));
    } catch {
      /* file mungkin sudah tiada — abaikan */
    }
  }
}
