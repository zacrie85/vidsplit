// VidSplit — v0.58.0 KEBERSIHAN DISK: folder kerja dulu TUMBUH TANPA BATAS
// (temuan audit menyeluruh): work/tmp menyimpan berkas antar-part yang bocor
// saat render gagal, cache aset neon/templat/bingkai-warna hanya bertambah,
// stem vokal AI ±200 MB/lagu tak pernah dibuang, folder temp horor tidak
// pernah dihapus, dan unggahan video (sampai 20 GB/file) menumpuk selamanya.
// Modul ini memangkas berkas lama berbasis UMUR — semua aman diregenerasi
// atau sudah lewat masa pakainya. Dijalankan throttled (maks 1×/jam) saat
// job baru dimulai + bisa dipanggil manual.
import { readdirSync, rmSync, statSync } from "node:fs";
import path from "node:path";
import { ROOT_WORK } from "./ffmpeg";
import { muatIdRiwayat } from "./riwayat";

const UMUR_TMP = 24 * 3_600_000; // work/tmp — berkas .txt/.ass antar-part
const UMUR_CACHE_ASET = 24 * 3_600_000; // neon/templat/bingkai-warna — regenerable
const UMUR_PRATINJAU = 7 * 24 * 3_600_000; // pratinjau-sub/*.mp4
const UMUR_VOKAL_AI = 7 * 24 * 3_600_000; // vokal-ai/*.f32 (±200 MB/lagu)
const UMUR_SUBTITLE = 30 * 24 * 3_600_000; // subtitle-ai/*.json (kecil & berharga)
const UMUR_HOROR = 7 * 24 * 3_600_000; // horor/<id> — temp render horor
const UMUR_UPLOAD = 14 * 24 * 3_600_000; // upload/<berkas> — sumber video antrean
const UMUR_OUTPUT_YATIM = 7 * 24 * 3_600_000; // output/<id> tanpa catatan riwayat

let terakhirJalan = 0;
/** jeda minimum antar pangkasan (1 jam) */
export const JEDA_PANGKAS_MS = 3_600_000;

/** id job yang masih tercatat di riwayat (output-nya wajib dijaga) */
function idRiwayatTerjaga(): Set<string> {
  try {
    return muatIdRiwayat();
  } catch {
    /* riwayat tak terbaca — JANGAN pangkas output (aman > sorry) */
    return new Set();
  }
}

/**
 * Pangkas folder kerja — kembalikan jumlah berkas/folder yang dihapus.
 * `root` & `sekarang` bisa disuntik utk uji unit; bawaan = folder kerja nyata.
 */
export function pangkasWork(root: string = ROOT_WORK, sekarang = Date.now()): number {
  let hapus = 0;

  /** hapus berkas flat berumur > umur dalam satu folder */
  const pangkasFlat = (rel: string, umur: number) => {
    const d = path.join(root, rel);
    let isi: string[];
    try {
      isi = readdirSync(d);
    } catch {
      return; // folder belum ada — bukan masalah
    }
    for (const f of isi) {
      try {
        const p = path.join(d, f);
        const st = statSync(p);
        if (!st.isFile()) continue;
        if (sekarang - st.mtimeMs > umur) {
          rmSync(p, { force: true });
          hapus += 1;
        }
      } catch {
        /* berkas terpakai/hilang di tengah jalan — lanjut */
      }
    }
  };

  /** hapus SUBFOLDER berumur > umur dalam satu folder induk */
  const pangkasFolder = (rel: string, umur: number, lindungi?: Set<string>) => {
    const d = path.join(root, rel);
    let isi: string[];
    try {
      isi = readdirSync(d);
    } catch {
      return;
    }
    for (const f of isi) {
      try {
        const p = path.join(d, f);
        const st = statSync(p);
        if (!st.isDirectory()) continue;
        if (lindungi?.has(f)) continue;
        if (sekarang - st.mtimeMs > umur) {
          rmSync(p, { recursive: true, force: true });
          hapus += 1;
        }
      } catch {
        /* lanjut */
      }
    }
  };

  // berkas antar-part yang bocor (render gagal/batal dulu tak membersihkan)
  pangkasFlat("tmp", UMUR_TMP);
  // cache aset yang bisa diregenerasi otomatis
  pangkasFolder("neon", UMUR_CACHE_ASET);
  pangkasFolder("templat", UMUR_CACHE_ASET);
  pangkasFolder("bingkai-warna", UMUR_CACHE_ASET);
  // keping pratinjau subtitle & stem vokal AI (besar)
  pangkasFlat("pratinjau-sub", UMUR_PRATINJAU);
  pangkasFlat("vokal-ai", UMUR_VOKAL_AI);
  // hasil transkrip AI — kecil, dipangkas sangat santai
  pangkasFlat("subtitle-ai", UMUR_SUBTITLE);
  // temp render horor (job sukses kini sudah membersihkan sendiri; ini utk yatim)
  pangkasFolder("horor", UMUR_HOROR);
  // unggahan sumber — antrean tak bertahan lintas restart, 14 hari jauh aman
  pangkasFlat("upload", UMUR_UPLOAD);
  // output yatim: folder hasil yang TIDAK tercatat di riwayat (job crash server)
  try {
    const jaga = idRiwayatTerjaga();
    if (jaga.size > 0) pangkasFolder("output", UMUR_OUTPUT_YATIM, jaga);
  } catch {
    /* jaga-jaga */
  }
  return hapus;
}

/** Pangkas throttled — aman dipanggil di awal SETIAP job (maks 1×/jam). */
export function jadwalkanPangkas(sekarang = Date.now()): boolean {
  if (sekarang - terakhirJalan < JEDA_PANGKAS_MS) return false;
  terakhirJalan = sekarang;
  try {
    pangkasWork();
  } catch {
    /* kebersihan tak boleh menggagalkan job */
  }
  return true;
}

/** Reset throttle (khusus uji). */
export function resetThrottlePangkas(): void {
  terakhirJalan = 0;
}
