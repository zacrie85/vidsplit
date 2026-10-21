// VidSplit v2.0.0 — SPLIT PER ADEGAN: video dianalisis 100% OFFLINE (tanpa internet,
// tanpa layanan awan). ffmpeg meng-decode frame pada 10 sampel/dtk, filter
// `select='gte(scene,0)' + metadata=print` mengeluarkan SKOR PERGANTIAN ADEGAN
// per frame (SAD histogram YUV internal ffmpeg) ke stdout; Node mengumpulkan
// skor itu lalu memilih batas adegan dgn AMBANG ADAPTIF median+MAD (statistik
// tahan outlier — musik/gambang/goyang kamera tak lagi memicu potongan palsu).
// Fungsi pemilih batas MURNI (dites unit); eksekusi ffmpeg terpisah dgn batas
// waktu keras supaya file rusak tidak menggantung ekspor.
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { dirWork } from "./ffmpeg";
import { potonganEfektif, type ZonaHapus } from "./types";

/* ================= bagian MURNI (dites unit) ================= */

/** Median dari deret angka (salinan diurutkan — input tidak diubah) */
export function median(x: number[]): number {
  if (!x.length) return 0;
  const s = [...x].sort((a, b) => a - b);
  const t = s.length;
  return t % 2 ? s[(t - 1) / 2] : (s[t / 2 - 1] + s[t / 2]) / 2;
}

/** MAD = median(|xi − median|) — ukuran sebaran tahan outlier */
export function mad(x: number[]): number {
  if (!x.length) return 0;
  const m = median(x);
  return median(x.map((v) => Math.abs(v - m)));
}

/**
 * Ambang adegan ADAPTIF (murni — dites unit): median + k×MAD dgn lantai/atsap
 * aman. k bawaan 6. Lantai 0.12: adegan ffmpeg yang benar-benar jelas biasanya
 * ≥0.3; 0.12 menangkap adegan lambat sambil menolak goyangan halus (skor
 * latar <0.05). Atsap 0.95 mencegah ambang absurd saat distribusi aneh.
 */
export function ambangAdegan(skor: number[], k = 6): number {
  if (!skor.length) return Number.POSITIVE_INFINITY;
  const m = median(skor);
  const d = mad(skor);
  return Math.min(0.95, Math.max(0.12, m + k * d));
}

/**
 * Pilih BATAS adegan (murni — dites unit): indeks frame dgn skor > ambang,
 * lalu diberi JARAK MINIMAL (bawaan 1 dtk = 10 frame pada 10 sampel/dtk) —
 * dua adegan berjarak dekat digabung (potongan < 1 dtk tak bermakna).
 * Mengembalikan PTS (detik) batas adegan, naik, unik.
 */
export function pilihBatasAdegan(pts: number[], skor: number[], jarakMin = 1.0): number[] {
  const batas: number[] = [];
  if (!pts.length || skor.length !== pts.length) return batas;
  const ambang = ambangAdegan(skor);
  for (let i = 1; i < pts.length; i++) {
    // i=0 tak boleh batas (adegan pertama selalu mulai dari awal rentang)
    if (skor[i] > ambang && skor[i] >= 0.12) {
      const t = pts[i];
      if (!batas.length || t - batas[batas.length - 1] >= jarakMin) batas.push(t);
    }
  }
  return batas;
}

export interface PotonganAdegan {
  mulai: number;
  akhir: number;
}

/**
 * Ubah batas adegan → POTONGAN part (murni — dites unit):
 *   • rentang diproses = potonganEfektif (rentang trim MINUS zona hapus) —
 *     batas adegan yang jatuh DI DALAM zona dibuang, part TIDAK PERNAH melintasi zona.
 *   • potongan < minDurasi (1 dtk) DILEBUR ke tetangganya — film pendek dgn
 *     adegan sangat cepat tidak menghasilkan ratusan file 2 dtk.
 *   • rentang tanpa batas → satu potongan penuh (perilaku aman).
 * Koordinat ABSOLUT video (persis konvensi rentangPart).
 */
export function potonganAdegan(
  batas: number[],
  durasiVideo: number,
  mulaiDetik: number,
  akhirDetik: number,
  zonas: ZonaHapus[],
  minDurasi = 1.0,
): PotonganAdegan[] {
  const efAkhir = akhirDetik > 0 ? Math.min(Math.max(akhirDetik, mulaiDetik + 0.5), durasiVideo) : durasiVideo;
  const efMulai = Math.max(0, Math.min(mulaiDetik, efAkhir - 0.5));
  const pot = potonganEfektif(durasiVideo, mulaiDetik, akhirDetik, zonas);
  if (!pot.length) return [];
  // batas yang sah: di dalam salah satu potongan efektif
  const sah = batas
    .filter((t) => t > efMulai + 0.2 && t < efAkhir - 0.2)
    .filter((t) => pot.some((p) => t > p.mulai + 0.2 && t < p.akhir - 0.2))
    .sort((a, b) => a - b);
  // kumpulkan SEMUA segmen (tiap batas adegan = pemisah SAH — TIDAK disambung:
  // potongan efektif antar zona tak bersebelahan, dan batas adegan sah wajib dipakai)
  const segmen: PotonganAdegan[] = [];
  for (const p of pot) {
    const titik = [p.mulai, ...sah.filter((t) => t > p.mulai + 0.2 && t < p.akhir - 0.2), p.akhir];
    for (let i = 0; i < titik.length - 1; i++) {
      segmen.push({ mulai: titik[i], akhir: titik[i + 1] });
    }
  }
  // lebur segmen < minDurasi ke tetangga dgn potongan SEBELAHNYA (bukan melintasi zona:
  // segmen antar potongan efektif dipisah zona → tak pernah bersebelahan <0,001)
  const lebur = (daftar: PotonganAdegan[]): PotonganAdegan[] => {
    const kecil = daftar.filter((s) => s.akhir - s.mulai < minDurasi - 0.001);
    if (!kecil.length) return daftar;
    const hasil2 = daftar.map((s) => ({ ...s }));
    for (const k of kecil) {
      const idx = hasil2.findIndex((s) => s.mulai === k.mulai && s.akhir === k.akhir);
      if (idx < 0) continue;
      const sebelum = hasil2[idx - 1];
      const sesudah = hasil2[idx + 1];
      // lebur ke yang LEBIH PENDEK di antara tetangga (keseimbangan panjang)
      const panjangSebelum = sebelum ? sebelum.akhir - sebelum.mulai : Infinity;
      const panjangSesudah = sesudah ? sesudah.akhir - sesudah.mulai : Infinity;
      if (sebelum && panjangSebelum <= panjangSesudah && panjangSebelum < 3600) {
        sebelum.akhir = k.akhir;
        hasil2.splice(idx, 1);
      } else if (sesudah && panjangSesudah < Infinity && panjangSesudah < 3600) {
        sesudah.mulai = k.mulai;
        hasil2.splice(idx, 1);
      }
      // tak ada tetangga → biarkan (potongan tunggal pendek tetap ada)
    }
    return hasil2;
  };
  const final = lebur(segmen);
  return final.length ? final : pot.map((p) => ({ ...p }));
}

/* ================= eksekusi ffmpeg ================= */

export interface SkorAdegan {
  pts: number[];
  skor: number[];
}

/**
 * Parse keluaran `metadata=print` — pola baris bergantian:
 *   [Parsed_metadata_0 @ 0x…] frame:12   pts:120      pts_time:1.2
 *   [Parsed_metadata_0 @ 0x…] lavfi.scene_score=0.123456
 * Fungsi MURNI — dites unit (termasuk keluaran kacau/salah urut).
 * NOTE: baris kedua TANPA prefix [Parsed...] pada -v error & beberapa build —
 * prefix dibuat OPSIONAL (ditemukan via debug uji v2.0.0: metadata=print file=-
 * menulis polos "frame:0 pts:0 pts_time:0\nlavfi.scene_score=...").
 */
export function parseMetadataPrint(stdout: string): SkorAdegan {
  const pts: number[] = [];
  const skor: number[] = [];
  const re = /pts_time:(\d+(?:\.\d+)?)\s*\n\s*(?:\[[^\]]*\]\s*)?lavfi\.scene_score=(\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(stdout))) {
    pts.push(Number(m[1]));
    skor.push(Number(m[2]));
  }
  return { pts, skor };
}

/**
 * Jalankan analisis adegan ffmpeg (streaming stdout — RAM datar):
 *   ffmpeg -ss M -t D -i src -an -vf "fps=10,scale=320:-2,
 *          select='gte(scene,0)',metadata=print:key=lavfi.scene_score:file=-"
 *          -frames:v V -f null -
 * 10 sampel/dtk + 320px cukup utk skor histogram, decode ±5–15× realtime CPU.
 * Batas keras: max(180 dtk, durasi×3) — file rusak tidak boleh menggantung.
 */
export async function skorAdeganFfmpeg(
  src: string,
  ffbin: string,
  mulai: number,
  durasi: number,
  onDetik?: (detik: number) => void,
): Promise<SkorAdegan> {
  const batasMs = Math.max(180_000, Math.ceil(durasi) * 3_000);
  const sampel = 10;
  const frames = Math.ceil(durasi * sampel);
  const vf = `fps=${sampel},scale=320:-2,select='gte(scene,0)',metadata=print:key=lavfi.scene_score:file=-`;
  const args = [
    "-nostdin",
    "-hide_banner",
    "-v",
    "info",
    ...(mulai > 0 ? ["-ss", mulai.toFixed(3)] : []),
    "-t",
    Math.max(0.5, durasi).toFixed(3),
    "-i",
    src,
    "-an",
    "-vf",
    vf,
    "-frames:v",
    String(frames),
    "-f",
    "null",
    "-",
  ];
  return new Promise<SkorAdegan>((resolve, reject) => {
    const c = spawn(ffbin, args, { windowsHide: true, stdio: ["ignore", "pipe", "ignore"] });
    const mulaiMs = Date.now();
    let stdout = "";
    const pemantau = setInterval(() => {
      onDetik?.(Math.round((Date.now() - mulaiMs) / 1000));
      if (Date.now() - mulaiMs > batasMs) {
        clearInterval(pemantau);
        try { c.kill("SIGKILL"); } catch { /* sudah mati */ }
        reject(new Error(`analisis adegan melewati batas ${Math.round(batasMs / 1000)} dtk`));
      }
    }, 2000);
    c.stdout.on("data", (b: Buffer) => {
      stdout += b.toString("latin1");
      // jaga RAM: cukup menyimpan pasangan pts/skor — buang baris non-metadata
      if (stdout.length > 2_000_000) {
        const p = parseMetadataPrint(stdout);
        stdout = "";
        (c as unknown as { _hasil?: SkorAdegan })._hasil = p;
      }
    });
    c.on("error", (e) => {
      clearInterval(pemantau);
      reject(new Error(`ffmpeg analisis adegan gagal: ${e.message}`));
    });
    c.on("close", (code) => {
      clearInterval(pemantau);
      if (code !== 0 && code !== null) {
        reject(new Error(`ffmpeg analisis adegan keluar kode ${code}`));
        return;
      }
      try {
        const partial = (c as unknown as { _hasil?: SkorAdegan })._hasil;
        if (partial) {
          const lagi = parseMetadataPrint(stdout);
          resolve({ pts: [...partial.pts, ...lagi.pts], skor: [...partial.skor, ...lagi.skor] });
        } else {
          resolve(parseMetadataPrint(stdout));
        }
      } catch (e) {
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    });
  });
}

/* ================= cache hasil analisis ================= */

function kunciCache(src: string, mulai: number, akhir: number, zonas: ZonaHapus[]): string {
  const h = createHash("sha1");
  h.update(`${src}|${mulai.toFixed(3)}|${akhir.toFixed(3)}|${zonas.map((z) => `${z.mulai}-${z.akhir}`).join(",")}`);
  return h.digest("hex").slice(0, 16);
}

/**
 * Analisis adegan dgn CACHE JSON di work/tmp (hash path+rentang+zona) —
 * Batch Ekspor / pengulangan ekspor tidak menganalisis ulang file yang sama.
 * Bila cache ada → parse instan; tidak → jalankan ffmpeg lalu simpan.
 */
export async function analisisAdegan(
  src: string,
  ffbin: string,
  durasiVideo: number,
  mulaiDetik: number,
  akhirDetik: number,
  zonas: ZonaHapus[],
): Promise<number[]> {
  const efAkhir = akhirDetik > 0 ? Math.min(akhirDetik, durasiVideo) : durasiVideo;
  const kunci = kunciCache(src, mulaiDetik, efAkhir, zonas);
  const dirTmp = dirWork("tmp");
  const fileCache = path.join(dirTmp, `adegan-${kunci}.json`);
  if (existsSync(fileCache)) {
    try {
      const j = JSON.parse(readFileSync(fileCache, "utf8")) as { batas?: number[] };
      if (Array.isArray(j.batas)) return j.batas;
    } catch {
      try { unlinkSync(fileCache); } catch { /* abaikan */ }
    }
  }
  const mulaiAnalisis = Date.now();
  const { pts, skor } = await skorAdeganFfmpeg(src, ffbin, mulaiDetik, Math.max(0.5, efAkhir - mulaiDetik));
  const batas = pilihBatasAdegan(pts, skor);
  try {
    writeFileSync(
      fileCache,
      JSON.stringify({
        batas,
        sampel: pts.length,
        analisisMs: Date.now() - mulaiAnalisis,
        dibuat: Date.now(),
      }),
      "utf8",
    );
  } catch {
    /* cache wajib — gagal tulis bukan fatal */
  }
  return batas;
}

/**
 * ADEGAN DI LATAR (pola TranskripLatar): analisis dimulai SEKETIKA saat video
 * mulai diproses; part menunggu hasil via tunggu() — render tetap respons batal.
 */
export class AdeganLatar {
  janji: Promise<number[]>;
  private tuntas = false;
  private hasil: number[] | null = null;

  constructor(
    src: string,
    ffbin: string,
    durasiVideo: number,
    mulaiDetik: number,
    akhirDetik: number,
    zonas: ZonaHapus[],
  ) {
    this.janji = analisisAdegan(src, ffbin, durasiVideo, mulaiDetik, akhirDetik, zonas)
      .then((b) => {
        this.hasil = b;
        this.tuntas = true;
        return b;
      })
      .catch((e) => {
        this.hasil = [];
        this.tuntas = true; // gagal analisis ≠ gagal ekspor → jatuh ke 1 part penuh
        throw e;
      });
  }

  apakahTuntas(): boolean {
    return this.tuntas;
  }

  /** Menunggu daftar batas; isBatal dipolling agar pembatalan tetap respons */
  async tunggu(isBatal?: () => boolean): Promise<number[]> {
    while (!this.tuntas) {
      if (isBatal && isBatal()) throw new Error("DIBATALKAN");
      await new Promise<void>((ok) => setTimeout(ok, 400));
    }
    return this.hasil || (await this.janji.catch(() => []));
  }
}
