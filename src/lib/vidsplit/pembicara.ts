// VidSplit v2.0.0 — ZOOM PEMBICARA OTOMATIS (100% OFFLINE, seperti aplikasi potong-
// podcast AI) — kamera otomatis mem-zoom orang yang SEDANG BICARA dan pindah saat
// berganti pembicara; podcast 2 orang berhadapan → konten vertikal 9:16.
//
// TIGA SINYAL DIGABUNG (semua dihitung lokal):
//   1. AI deteksi orang — YOLOv8n ONNX ±12 MB (bundel resources/ai-models, unduh
//      sekali via workflow; runtime cadangan: work/model) via onnxruntime-node
//      (sudah jadi dependensi vokal AI sejak v0.20.0);
//   2. gerakan mulut/kepala — selisih piksel area box antar frame sampel;
//   3. kapan ada suara — RMS audio per jendela 0,5 dtk.
//
// HASIL ANALISIS = daftar keyframe [t, cx] (cx = posisi horizontal pembicara,
// fraksi lebar). Rantai ffmpeg:
//   • GESER HALUS — crop dinamis dgn ekspresi x(t) piecewise-linear (kamera
//     meluncur selama DURASI_PINDAH[laju]);
//   • LANGSUNG (CUT) — lompatan instan (ekspresi step, ala potongan kamera TV);
//   • FADE — segmen fokus statis di-rantai dgn xfade (crossfade/dissolve asli).
// MODE CADANGAN 2-BAGIAN: bila AI sulit (kartun/rekaman layar), posisi kiri/kanan
// dipilih dari ENERGI AUDIO STEREO kanal L vs R (podcast 2 orang berhadapan
// umumnya di-panning kiri/kanan).
import { balapanWaktu } from "./subtitle";
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { dirWork } from "./ffmpeg";
import {
  DURASI_FADE,
  DURASI_PINDAH,
  MAKS_SEGMEN_FADE,
  type LajuPindah,
  type ModePembicara,
} from "./types";

/* ================= tipe ================= */

/** box hasil deteksi — SEMUA fraksi dari dimensi frame (0..1) */
export interface BoxDeteksi {
  x: number;
  y: number;
  w: number;
  h: number;
  skor: number;
}

/** keyframe fokus: t = detik (relatif RENTANG TRIM, konvensi subtitle), cx =
 *  pusat horizontal yang di-zoom (fraksi 0..1). cx 0.5 = tengah frame. */
export interface Keyframe {
  t: number;
  cx: number;
}

/* ================= bagian MURNI (dites unit) ================= */

/** IoU dua box (fraksi) */
export function iou(a: BoxDeteksi, b: BoxDeteksi): number {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);
  const i = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const u = a.w * a.h + b.w * b.h - i;
  return u > 0 ? i / u : 0;
}

/** NMS klasik — maksimal maks (12) box dgn skor terurut menurun */
export function nms(boxes: BoxDeteksi[], ambangIoU = 0.5, maks = 12): BoxDeteksi[] {
  const urut = [...boxes].sort((a, b) => b.skor - a.skor);
  const hasil: BoxDeteksi[] = [];
  for (const b of urut) {
    if (hasil.every((h) => iou(h, b) < ambangIoU)) {
      hasil.push(b);
      if (hasil.length >= maks) break;
    }
  }
  return hasil;
}

/**
 * Decode keluaran YOLO ONNX (murni — dites unit). Tensor [1, dim1, dim2]:
 *   • dim1 = 5 → model PERSON-ONLY (cx,cy,w,h,score per anchor);
 *   • dim1 = 84 → model COCO (cx,cy,w,h + 80 kelas; orang = kelas 0).
 * Semua koordinat (center) dibagi dim2 → fraksi. Ambang skor bawaan 0.30.
 */
export function decodeYolo(
  out: Float32Array,
  dim1: number,
  dim2: number,
  ambang = 0.3,
): BoxDeteksi[] {
  const boxes: BoxDeteksi[] = [];
  if (!out || !out.length || dim1 < 5 || dim2 <= 0) return boxes;
  const n = Math.min(dim2, Math.floor(out.length / dim1));
  const personOnly = dim1 === 5;
  for (let i = 0; i < n; i++) {
    const cx = out[i] / dim2;
    const cy = out[dim2 + i] / dim2;
    const w = out[2 * dim2 + i] / dim2;
    const h = out[3 * dim2 + i] / dim2;
    let skor = 0;
    if (personOnly) {
      skor = out[4 * dim2 + i];
    } else {
      // kelas 0 = person — skor kelas maks dipakai apa adanya (0..1)
      skor = out[4 * dim2 + i];
    }
    if (!(skor >= ambang)) continue;
    if (!(w > 0.02 && h > 0.02 && w <= 1.5 && h <= 1.5)) continue;
    boxes.push({
      x: Math.max(0, cx - w / 2),
      y: Math.max(0, cy - h / 2),
      w: Math.min(1, w),
      h: Math.min(1, h),
      skor,
    });
  }
  return nms(boxes);
}

export interface JendelaSinyal {
  /** waktu tengah jendela (detik relatif trim) */
  t: number;
  /** ada suara di jendela ini? */
  suara: boolean;
  /** skor gerakan per orang terlacak (0..) — gerakan mulut/kepala */
  gerak: number[];
  /** posisi tengah-x tiap orang (fraksi) — urut sama dgn gerak */
  cx: number[];
}

/**
 * Keputusan pembicara per jendela (murni — dites unit):
 *   • suara + ada orang → pembicara = orang dgn GERAKAN terbesar;
 *   • suara tanpa orang → keyframe dilerengkan (tetap di fokus terakhir);
 *   • senyap → "tetap" = tanpa keyframe (kamera diam di pembicara terakhir) /
 *     "semua" = cx di TENGAH semua orang terdeteksi (0.5 bila tak ada).
 * Keyframe hanya ditulis saat cx berubah bermakna (>0.06) — anti getar.
 */
export function pilihPembicara(
  jendela: JendelaSinyal[],
  senyap: "tetap" | "semua",
): Keyframe[] {
  const kf: Keyframe[] = [];
  let cxTerakhir = 0.5;
  let adaFokus = false;
  for (const j of jendela) {
    let cx: number | null = null;
    if (j.suara && j.cx.length) {
      let terbaik = 0;
      for (let i = 1; i < j.gerak.length; i++) if (j.gerak[i] > j.gerak[terbaik]) terbaik = i;
      cx = Math.min(1, Math.max(0, j.cx[terbaik] ?? 0.5));
    } else if (!j.suara && senyap === "semua") {
      cx = j.cx.length
        ? Math.min(1, Math.max(0, j.cx.reduce((a, b) => a + b, 0) / j.cx.length))
        : 0.5;
    }
    if (cx === null) continue;
    if (!adaFokus || Math.abs(cx - cxTerakhir) > 0.06) {
      kf.push({ t: j.t, cx });
      cxTerakhir = cx;
      adaFokus = true;
    }
  }
  if (!adaFokus) return []; // tak ada sinyal → pemanggil jatuh ke cadangan
  return kf;
}

/** Cadangan 2-BAGIAN (murni — dites unit): pilih kiri (0.25) / kanan (0.75)
 *  dari energi audio stereo per langkah. Langkah energi L>R → kiri, dst.
 *  Histeresis 1.25× agar tidak berkedip saat suara seimbang. Mono (L==R) →
 *  keyframe tunggal tengah (crop statis). */
export function cadanganDuaBagian(
  energiL: number[],
  energiR: number[],
  langkahDtk: number,
  senyap: "tetap" | "semua" = "tetap",
): Keyframe[] {
  const kf: Keyframe[] = [];
  let sisi = -1; // 0 kiri, 1 kanan
  for (let i = 0; i < energiL.length && i < energiR.length; i++) {
    const l = energiL[i];
    const r = energiR[i];
    const total = l + r;
    if (total <= 1e-6) continue; // senyap
    if (sisi < 0) {
      sisi = l >= r ? 0 : 1;
      kf.push({ t: i * langkahDtk, cx: sisi === 0 ? 0.25 : 0.75 });
      continue;
    }
    const target = l >= r ? 0 : 1;
    if (target !== sisi) {
      const aktif = sisi === 0 ? l : r;
      const lawan = sisi === 0 ? r : l;
      if (lawan > aktif * 1.25) {
        sisi = target;
        kf.push({ t: i * langkahDtk, cx: sisi === 0 ? 0.25 : 0.75 });
      }
    }
  }
  if (!kf.length) return [{ t: 0, cx: 0.5 }];
  void senyap;
  return kf;
}

/** Saring anchor: buang keyframe berurutan dgn cx sama (ambil perubahan saja) */
export function saringAnchor(kf: Keyframe[]): Keyframe[] {
  const out: Keyframe[] = [];
  for (const k of kf) {
    if (!out.length || Math.abs(k.cx - out[out.length - 1].cx) > 0.001) out.push(k);
  }
  return out;
}

const fmt = (n: number) => String(Number(n.toFixed(3)));

/** Bangun ekspresi STEP utk mode LANGSUNG: lompatan instan di tiap anchor */
export function ekspresiStep(anchors: Keyframe[], maksAnchor = 120): string | null {
  const a = saringAnchor(anchors);
  if (!a.length || a.length > maksAnchor) return null;
  let e = fmt(a[0].cx);
  for (let i = 1; i < a.length; i++) {
    e = `if(lt(t,${fmt(a[i].t)}),${e},${fmt(a[i].cx)})`;
  }
  return e;
}

/**
 * Bangun ekspresi GESER HALUS: pada tiap pergantian di tK, kamera meluncur
 * dari posisi lama ke baru selama durasiPindah dtk (linear), sisanya stabil.
 * Selang lebih pendek dari durasi+0,3 → digabung (anti lompatan).
 */
export function ekspresiGeser(anchors: Keyframe[], durasiPindah: number, maksAnchor = 120): string | null {
  let a = saringAnchor(anchors);
  if (!a.length) return null;
  // gabungkan pergantian terlalu rapat
  const gab: Keyframe[] = [a[0]];
  for (let i = 1; i < a.length; i++) {
    if (a[i].t - gab[gab.length - 1].t < durasiPindah + 0.3) {
      gab[gab.length - 1] = { t: a[i].t, cx: a[i].cx };
    } else {
      gab.push(a[i]);
    }
  }
  a = gab;
  if (a.length > maksAnchor) return null;
  const d = Math.max(0.2, durasiPindah);
  let e = fmt(a[0].cx);
  for (let i = 1; i < a.length; i++) {
    const lerp = `${fmt(a[i - 1].cx)}+(${fmt(a[i].cx - a[i - 1].cx)})*min(max((t-${fmt(a[i].t)})/${fmt(d)},0),1)`;
    e = `if(lt(t,${fmt(a[i].t)}),${e},if(lt(t,${fmt(a[i].t + d)}),${lerp},${fmt(a[i].cx)}))`;
  }
  return e;
}

export interface SegmenFade {
  mulai: number;
  akhir: number;
  cx: number;
}

/**
 * Kelompokkan keyframe → SEGMEN fokus utk FADE: [tK, tK+1) dgn cx tetap.
 * Terakhir diperpanjang hingga durasiTotal. Segmen pertama mulai 0.
 */
export function segmenFade(kf: Keyframe[], durasiTotal: number): SegmenFade[] {
  const a = saringAnchor(kf);
  if (!a.length) return [];
  const out: SegmenFade[] = [];
  for (let i = 0; i < a.length; i++) {
    out.push({
      mulai: i === 0 ? 0 : a[i].t,
      akhir: i + 1 < a.length ? a[i + 1].t : Math.max(a[i].t + 0.5, durasiTotal),
      cx: a[i].cx,
    });
  }
  return out.filter((s) => s.akhir - s.mulai > 0.05);
}

/**
 * Rantai ffmpeg ZOOM PEMBICARA (murni — dites unit): dari [0:v] → label keluaran
 * yang ditetapkan. Mengembalikan { filter, label }.
 *   • sumber vertikal (h ≥ w) → tanpa crop (pas penuh), keyframe diabaikan;
 *   • geser/langsung → crop dinamis w9×h9 dgn ekspresi x(t) → scale target;
 *   • fade → segmen statis + xfade berantai (maks MAKS_SEGMEN_FADE; lebih →
 *     jatuh ke geser otomatis).
 * crop: w9 = min(iw, round(ih×9/16)) genap, h9 = ih — kamera vertikal penuh
 * tinggi, hanya menggeser kiri/kanan. Posisi x = cx×iw − w9/2 di-clamp.
 */
export function rantaiPembicara(
  kf: Keyframe[],
  sumber: { w: number; h: number },
  target: { W: number; H: number },
  mode: Exclude<ModePembicara, "mati">,
  laju: LajuPindah,
  fps: number,
  durasi: number,
): { filter: string; label: string } | null {
  if (!kf.length) return null;
  const dasar = `fps=${fps},trim=duration=${Math.max(0.5, durasi).toFixed(3)},setpts=PTS-STARTPTS,setsar=1`;
  const skala = `scale=${target.W}:${target.H}:flags=bicubic`;
  // sumber SUDAH vertikal → hasil pas penuh, tak ada yang di-zoom
  if (sumber.h >= sumber.w) {
    return { filter: `[0:v]${dasar},${skala}[vz]`, label: "vz" };
  }
  const w9 = Math.min(sumber.w, Math.round((sumber.h * 9) / 16 / 2) * 2);
  const posisi = (cx: number) => `min(max(0,(iw-ow)*${fmt(cx)}),iw-ow)`;

  if (mode === "fade") {
    const seg = segmenFade(kf, durasi);
    if (seg.length >= 2 && seg.length <= MAKS_SEGMEN_FADE) {
      // cabang per segmen: trim → crop statis → scale → fps sudah sama
      const cabang: string[] = [`[0:v]split=${seg.length}${seg.map((_, i) => `[sf${i}]`).join("")}`];
      seg.forEach((s, i) => {
        cabang.push(
          `[sf${i}]fps=${fps},trim=start=${fmt(s.mulai)}:end=${fmt(s.akhir)},setpts=PTS-STARTPTS,setsar=1,` +
            `crop=${w9}:${sumber.h}:x='${posisi(s.cx)}':y=0,${skala}[sg${i}]`,
        );
      });
      // xfade berantai: offset = akhir segmen gabungan sebelumnya − DURASI_FADE
      let label = "sg0";
      let lebar = seg[0].akhir - seg[0].mulai;
      for (let i = 1; i < seg.length; i++) {
        const offset = Math.max(0, lebar - DURASI_FADE);
        const keluar = i === seg.length - 1 ? "vz" : `xf${i}`;
        cabang.push(
          `[${label}][sg${i}]xfade=transition=fade:duration=${DURASI_FADE}:offset=${fmt(offset)}[${keluar}]`,
        );
        lebar = offset + seg[i].akhir - seg[i].mulai;
        label = keluar;
      }
      return { filter: cabang.join(";"), label: "vz" };
    }
    // terlalu banyak segmen → jatuh ke geser
  }

  const durasiPindah = DURASI_PINDAH[laju] ?? 0.8;
  const eks = mode === "langsung" ? ekspresiStep(kf) : ekspresiGeser(kf, durasiPindah);
  if (!eks) {
    // anchor terlalu banyak → sederhanakan: satu crop statis tengah
    return {
      filter: `[0:v]${dasar},crop=${w9}:${sumber.h}:x='(iw-ow)/2':y=0,${skala}[vz]`,
      label: "vz",
    };
  }
  return {
    filter: `[0:v]${dasar},crop=${w9}:${sumber.h}:x='${posisiTengahEkspresi(eks)}':y=0,${skala}[vz]`,
    label: "vz",
  };
}

/** posisi x: ekspresi cx (fraksi) → piksel: cx*(iw-ow) (clamp di dalam posisi) */
function posisiTengahEkspresi(eksCxFraksi: string): string {
  // ekspresi menghasilkan cx 0..1 → kali (iw-ow)
  return `(${eksCxFraksi})*(iw-ow)`;
}

/* ================= model & eksekusi ================= */

const NAMA_MODEL = "yolo-pembicara.onnx";
const URL_MODEL =
  "https://huggingface.co/deepghs/yolo-person/resolve/main/yolov8n-person/model.onnx";
const URL_MODEL_CADANGAN =
  "https://huggingface.co/SpotLab/YOLOv8Detection/resolve/3005c6751fb19cdeb6b10c066185908faf66a097/yolov8n.onnx";

/** Kandidat lokasi model (bundel → unduhan runtime) */
export function kandidatModel(): string[] {
  const res = (process as unknown as { resourcesPath?: string }).resourcesPath;
  const kandidat = [
    process.env.VIDSPLIT_YOLO || "",
    path.join(process.cwd(), "assets", "ai-models", NAMA_MODEL),
    path.join(process.cwd(), "..", "assets", "ai-models", NAMA_MODEL),
    path.join(process.cwd(), "..", "..", "assets", "ai-models", NAMA_MODEL),
    res ? path.join(res, "ai-models", NAMA_MODEL) : "",
    path.join(dirWork("model"), NAMA_MODEL),
  ].filter(Boolean) as string[];
  return kandidat;
}

/** Path model yang benar-benar ada (null = belum tersedia → unduh dulu) */
export function cariModel(): string | null {
  for (const k of kandidatModel()) if (existsSync(k) && statSync(k).size > 5_000_000) return k;
  return null;
}

/** status model utk UI: { ada: boolean; path: string | null; ukuranMb: number } */
export function statusModel(): { ada: boolean; path: string | null; ukuranMb: number } {
  const p = cariModel();
  if (!p) return { ada: false, path: null, ukuranMb: 0 };
  return { ada: true, path: p, ukuranMb: Math.round((statSync(p).size / 1e6) * 10) / 10 };
}

/** Unduh model sekali (±12 MB) → work/model/yolo-pembicara.onnx. Idempotent. */
export async function unduhModel(
  onTahap?: (t: string) => void,
): Promise<string> {
  const ada = cariModel();
  if (ada) return ada;
  const dir = dirWork("model");
  const tujuan = path.join(dir, NAMA_MODEL);
  if (existsSync(tujuan) && statSync(tujuan).size > 5_000_000) return tujuan;
  const tmp = `${tujuan}.part`;
  mkdirSync(dir, { recursive: true });
  const { writeFileSync, unlinkSync } = await import("node:fs");
  for (const url of [URL_MODEL, URL_MODEL_CADANGAN]) {
    try {
      onTahap?.("mengunduh model deteksi orang (±12 MB, sekali ini saja)…");
      const res = await fetch(url, { redirect: "follow" });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 5_000_000) throw new Error(`model terlalu kecil (${buf.length} B)`);
      writeFileSync(tmp, buf);
      try { unlinkSync(tujuan); } catch { /* belum ada */ }
      renameSync(tmp, tujuan);
      onTahap?.("model deteksi orang siap — kini 100% offline permanen");
      return tujuan;
    } catch (e) {
      try { unlinkSync(tmp); } catch { /* abaikan */ }
      if (url === URL_MODEL_CADANGAN) {
        throw new Error(
          `gagal mengunduh model deteksi orang: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }
  }
  throw new Error("gagal mengunduh model deteksi orang");
}

type OrtModul = typeof import("onnxruntime-node");
let sesiYolo: import("onnxruntime-node").InferenceSession | null = null;
let muatSesiJanji: Promise<import("onnxruntime-node").InferenceSession | null> | null = null;

/** Muat onnxruntime-node dari lokasi paling mungkin (dev / standalone / installer) */
function muatOrtSinkron(): OrtModul | null {
  const coba = (dasar: string): OrtModul | null => {
    try {
      return createRequire(path.join(dasar, "index.js"))("onnxruntime-node") as OrtModul;
    } catch {
      return null;
    }
  };
  const res = (process as unknown as { resourcesPath?: string }).resourcesPath;
  const kandidat = [process.cwd(), path.join(process.cwd(), ".."), path.join(process.cwd(), "..", ".."), res || ""].filter(Boolean) as string[];
  for (const k of kandidat) {
    const m = coba(k);
    if (m) return m;
  }
  try {
    return require("onnxruntime-node") as OrtModul;
  } catch {
    return null;
  }
}

export async function muatSesiYolo(onTahap?: (t: string) => void) {
  if (sesiYolo) return sesiYolo;
  if (muatSesiJanji) return muatSesiJanji;
  muatSesiJanji = (async () => {
    const model = cariModel();
    if (!model) return null;
    const ort = muatOrtSinkron();
    if (!ort) return null;
    onTahap?.("memuat model deteksi orang…");
    // kegagalan muat TIDAK di-cache permanen (pola v0.58) — reset janji
    try {
      const sesi = await balapanWaktu(
        ort.InferenceSession.create(model, { executionProviders: ["cpu"], graphOptimizationLevel: "all" }),
        120_000,
      );
      sesiYolo = sesi;
      return sesi;
    } catch {
      return null;
    } finally {
      muatSesiJanji = null;
    }
  })();
  return muatSesiJanji;
}

/** Reset sesi (uji / kegagalan runtime) */
export function resetSesiYolo(): void {
  sesiYolo = null;
  muatSesiJanji = null;
}

/**
 * Ekstrak frame sampel (fpsSampel/dtk, lebar 320) → inference YOLO streaming —
 * HANYA box yang disimpan (RAM datar walau video berjam-jam).
 * onFrame(t, boxes) dipanggil per frame; nilai balik = buffer frame terakhir
 * (dipakai penelepon utk sinyal gerakan? TIDAK — gerakan dihitung di sini via
 * onGerak agar buffer tidak bocor keluar).
 */
async function deteksiFrame(
  src: string,
  ffbin: string,
  mulai: number,
  durasi: number,
  lebarSumber: number,
  tinggiSumber: number,
  fpsSampel: number,
  sesi: import("onnxruntime-node").InferenceSession,
  ort: OrtModul,
  onFrame: (t: number, boxes: BoxDeteksi[], gerak: number) => void,
): Promise<void> {
  const lebarS = 320;
  const tinggiS = Math.max(2, Math.round((lebarS * tinggiSumber) / lebarSumber / 2) * 2);
  const ukuran = lebarS * tinggiS * 3;
  const args = [
    "-nostdin",
    "-v",
    "error",
    ...(mulai > 0 ? ["-ss", mulai.toFixed(3)] : []),
    "-t",
    Math.max(0.5, durasi).toFixed(3),
    "-i",
    src,
    "-an",
    "-vf",
    `fps=${fpsSampel},scale=${lebarS}:${tinggiS}`,
    "-f",
    "rawvideo",
    "-pix_fmt",
    "rgb24",
    "pipe:1",
  ];
  const c = spawn(ffbin, args, { windowsHide: true, stdio: ["ignore", "pipe", "ignore"] });
  let buf: Buffer<ArrayBufferLike> = Buffer.alloc(0);
  let prev: Buffer<ArrayBufferLike> | null = null;
  let t = 0;
  const langkah = 1 / fpsSampel;
  const ukuranMasuk = sesi.inputNames.length ? 640 : 640;
  const mulaiMs = Date.now();
  const batasMs = Math.max(240_000, Math.ceil(durasi) * 4_000);
  let gagal: Error | null = null;
  c.on("error", (e) => (gagal = new Error(`ffmpeg frame sampel gagal: ${e.message}`)));

  const inferensi = async (frame: Buffer): Promise<BoxDeteksi[]> => {
    // preprocess: resize nearest 640×640, RGB→CHW, /255
    const S = ukuranMasuk;
    const input = new Float32Array(3 * S * S);
    for (let y = 0; y < S; y++) {
      const sy = Math.min(tinggiS - 1, ((y * tinggiS) / S) | 0);
      for (let x = 0; x < S; x++) {
        const sx = Math.min(lebarS - 1, ((x * lebarS) / S) | 0);
        const i = (sy * lebarS + sx) * 3;
        const o = y * S + x;
        input[o] = frame[i] / 255;
        input[S * S + o] = frame[i + 1] / 255;
        input[2 * S * S + o] = frame[i + 2] / 255;
      }
    }
    const tensor = new ort.Tensor("float32", input, [1, 3, S, S]);
    const hasil = await sesi.run({ [sesi.inputNames[0]]: tensor });
    const keluar = hasil[sesi.outputNames[0]];
    const dim = keluar.dims as number[];
    // [1, dim1, dim2] atau [dim1, dim2]
    let d1 = dim.length === 3 ? dim[1] : dim[0];
    let d2 = dim.length === 3 ? dim[2] : dim[1];
    let data = keluar.data as Float32Array;
    if (dim.length === 3 && dim[1] > dim[2]) {
      // beberapa ekspor menghasilkan [1, N, dim1] — transpos
      const t2 = new Float32Array(data.length);
      for (let a = 0; a < dim[1]; a++) for (let b = 0; b < dim[2]; b++) t2[b * dim[1] + a] = data[a * dim[2] + b];
      data = t2;
      d1 = dim[2];
      d2 = dim[1];
    }
    void d1;
    return decodeYolo(data, d1, d2);
  };

  await new Promise<void>((resolve, reject) => {
    c.stdout.on("data", (b: Buffer<ArrayBufferLike>) => {
      buf = buf.length ? Buffer.concat([buf, b as Buffer]) : Buffer.from(b);
      while (buf.length >= ukuran) {
        const frame = Buffer.from(buf.subarray(0, ukuran));
        buf = buf.subarray(ukuran) as Buffer<ArrayBufferLike>;
        const tn = t;
        t += langkah;
        // sinyal gerakan: selisih absolut rata-rata vs frame sebelumnya (stride 8)
        let gerak = 0;
        if (prev) {
          let jumlah = 0;
          let n = 0;
          for (let i = 0; i < ukuran; i += 8) {
            jumlah += Math.abs(frame[i] - prev[i]);
            n++;
          }
          gerak = n ? jumlah / n : 0;
        }
        prev = Buffer.from(frame);
        void (async () => {
          try {
            const boxes = await inferensi(frame as Buffer);
            onFrame(tn, boxes, gerak);
          } catch (e) {
            gagal = e instanceof Error ? e : new Error(String(e));
            try { c.kill("SIGKILL"); } catch { /* abaikan */ }
          }
        })();
      }
      if (Date.now() - mulaiMs > batasMs) {
        try { c.kill("SIGKILL"); } catch { /* abaikan */ }
      }
    });
    c.on("close", () => {
      if (gagal) reject(gagal);
      else if (Date.now() - mulaiMs > batasMs) reject(new Error("analisis pembicara melewati batas waktu"));
      else resolve();
    });
  });
}

/** RMS per jendela dari audio mono Float32 (murni — dites unit) */
export function rmsJendela(audio: Float32Array, rate: number, jendelaDtk: number): { t: number; rms: number }[] {
  const per = Math.max(1, Math.round(rate * jendelaDtk));
  const out: { t: number; rms: number }[] = [];
  for (let i = 0; i < audio.length; i += per) {
    let jumlah = 0;
    const akhir = Math.min(audio.length, i + per);
    for (let k = i; k < akhir; k++) jumlah += audio[k] * audio[k];
    out.push({ t: (i / rate), rms: Math.sqrt(jumlah / Math.max(1, akhir - i)) });
  }
  return out;
}

/**
 * Ekstrak ENERGI STEREO per langkah (mode cadangan 2-bagian): ffmpeg decode
 * audio stereo 16 kHz f32le interleave → pisah kanal L/R → RMS per langkah.
 * RAM datar (streaming buffer). Mono → L == R (cadangan memilih kiri dulu,
 * jobs menyadari L===R → kamera tengah).
 */
export async function ekstrakStereoEnergi(
  src: string,
  ffbin: string,
  mulai: number,
  durasi: number,
  langkahDtk = 0.5,
): Promise<{ L: number[]; R: number[]; langkahDtk: number }> {
  const rate = 16000;
  const args = [
    "-nostdin", "-v", "error",
    ...(mulai > 0 ? ["-ss", mulai.toFixed(3)] : []),
    "-i", src, "-t", Math.max(0.5, durasi).toFixed(3),
    "-vn", "-ac", "2", "-ar", String(rate), "-f", "f32le", "pipe:1",
  ];
  const c = spawn(ffbin, args, { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  const potongan: Buffer[] = [];
  let stderr = "";
  c.stdout?.on("data", (b: Buffer) => potongan.push(b));
  c.stderr?.on("data", (b: Buffer) => (stderr += b.toString()));
  await new Promise<void>((ok, gagal) => {
    c.on("error", gagal);
    c.on("close", (code) => (code === 0 ? ok() : gagal(new Error(`ffmpeg audio stereo gagal: ${stderr.slice(-300)}`))));
  });
  const buf = Buffer.concat(potongan);
  const per = Math.max(1, Math.round(rate * langkahDtk)); // sampel PER KANAL
  const L: number[] = [];
  const R: number[] = [];
  let i = 0; // sampel interleave
  while (i < Math.floor(buf.length / 8)) {
    const sampel = Math.min(per, Math.floor(buf.length / 8) - i);
    let l = 0;
    let r = 0;
    for (let k = 0; k < sampel; k++) {
      const idx = (i + k) * 8;
      const lv = buf.readFloatLE(idx);
      const rv = buf.readFloatLE(idx + 4);
      l += lv * lv;
      r += rv * rv;
    }
    L.push(Math.sqrt(l / sampel));
    R.push(Math.sqrt(r / sampel));
    i += sampel;
  }
  return { L, R, langkahDtk };
}

export interface OpsiAnalisisPembicara {
  mulai: number;
  durasi: number;
  lebarSumber: number;
  tinggiSumber: number;
  senyap: "tetap" | "semua";
  onTahap?: (t: string) => void;
  /** true → paksa mode cadangan (uji) */
  paksaCadangan?: boolean;
}

/**
 * Analisis pembicara lengkap utk satu video (cache JSON work/tmp/pembicara-*.json):
 *   1. audio RMS (16 kHz mono) → jendela 0,5 dtk → suara/senyap;
 *   2. frame sampel 2 fps + YOLO → box orang + gerakan;
 *   3. pilihPembicara → keyframe.
 * Model tak tersedia / inference gagal / tak ada orang terdeteksi → LEMPAR
 * Error "PEMBICARA_CADANGAN" — pemanggil jatuh ke cadangan 2-bagian (stereo).
 */
export async function analisisPembicara(
  src: string,
  ffbin: string,
  opsi: OpsiAnalisisPembicara,
): Promise<Keyframe[]> {
  const { ekstrakAudioF32 } = await import("./subtitle");
  opsi.onTahap?.("analisis suara (energi per jendela)…");
  const audio = await ekstrakAudioF32(src, opsi.mulai, Math.max(0.5, opsi.durasi), ffbin);
  const rms = rmsJendela(audio, 16000, 0.5);
  const ambangSuara = Math.max(0.008, medianDari(rms.map((r) => r.rms)) * 0.55);

  const ort = muatOrtSinkron();
  let sesi: import("onnxruntime-node").InferenceSession | null = null;
  if (!opsi.paksaCadangan) {
    if (!cariModel()) {
      try {
        await unduhModel(opsi.onTahap);
      } catch (e) {
        throw new Error(
          `PEMBICARA_CADANGAN: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }
    sesi = ort ? await muatSesiYolo(opsi.onTahap) : null;
  }
  if (!sesi) throw new Error("PEMBICARA_CADANGAN: model deteksi orang tidak tersedia");

  opsi.onTahap?.("AI deteksi orang (2 frame/detik)…");
  const fpsSampel = 2;
  // kumpulkan deteksi per frame → jendela 0,5 dtk
  const jendela: JendelaSinyal[] = [];
  let frameKini: { boxes: BoxDeteksi[]; gerak: number; t: number }[] = [];
  const segel = () => {
    if (!frameKini.length) return;
    const t = frameKini[0].t;
    // pelacakan sederhana: gabungkan box antar frame dgn IoU → jalur orang
    const jalur: { cx: number; gerak: number }[] = [];
    for (const f of frameKini) {
      for (const b of f.boxes) {
        const cx = b.x + b.w / 2;
        const terdekat = jalur.reduce(
          (ter, j, idx) => (Math.abs(j.cx - cx) < Math.abs(jalur[ter].cx - cx) ? idx : ter),
          0,
        );
        const jarak = jalur.length ? Math.abs(jalur[terdekat].cx - cx) : 1;
        if (jarak < 0.12) jalur[terdekat].gerak += f.gerak;
        else jalur.push({ cx, gerak: f.gerak });
      }
    }
    const rmsDiT = rms.find((r) => r.t >= t - 0.5 && r.t < t + 0.5);
    jendela.push({
      t,
      suara: !!rmsDiT && rmsDiT.rms >= ambangSuara,
      gerak: jalur.map((j) => j.gerak),
      cx: jalur.map((j) => j.cx),
    });
    frameKini = [];
  };
  await deteksiFrame(
    src,
    ffbin,
    opsi.mulai,
    opsi.durasi,
    opsi.lebarSumber,
    opsi.tinggiSumber,
    fpsSampel,
    sesi,
    ort as OrtModul,
    (t, boxes, gerak) => {
      frameKini.push({ t, boxes, gerak });
      if (frameKini.length >= 1) segel(); // 2 fps → tiap frame = jendela 0,5 dtk
    },
  );
  const kf = pilihPembicara(jendela, opsi.senyap);
  if (!kf.length) {
    throw new Error("PEMBICARA_CADANGAN: tak ada orang yang bisa difokuskan");
  }
  return kf;
}

function medianDari(x: number[]): number {
  if (!x.length) return 0;
  const s = [...x].sort((a, b) => a - b);
  const t = s.length;
  return t % 2 ? s[(t - 1) / 2] : (s[t / 2 - 1] + s[t / 2]) / 2;
}

/* ================= latar + cache ================= */

function kunciPembicara(src: string, mulai: number, durasi: number, senyap: string): string {
  const h = createHash("sha1");
  h.update(`${src}|${mulai.toFixed(3)}|${durasi.toFixed(3)}|${senyap}`);
  return h.digest("hex").slice(0, 16);
}

/** Analisis dgn cache JSON (hash path+rentang+senyap) — batch ekspor tak mengulang */
export async function analisisPembicaraCache(
  src: string,
  ffbin: string,
  opsi: OpsiAnalisisPembicara,
): Promise<Keyframe[]> {
  const kunci = kunciPembicara(src, opsi.mulai, opsi.durasi, opsi.senyap);
  const fileCache = path.join(dirWork("tmp"), `pembicara-${kunci}.json`);
  if (existsSync(fileCache)) {
    try {
      const j = JSON.parse(readFileSync(fileCache, "utf8")) as { kf?: Keyframe[]; cadangan?: boolean };
      if (Array.isArray(j.kf)) return j.kf;
      if (j.cadangan) throw new Error("PEMBICARA_CADANGAN: hasil cache (cadangan)");
    } catch (e) {
      if (e instanceof Error && e.message.startsWith("PEMBICARA_CADANGAN")) throw e;
      try { unlinkSync(fileCache); } catch { /* abaikan */ }
    }
  }
  let hasil: Keyframe[];
  let cadangan = false;
  try {
    hasil = await analisisPembicara(src, ffbin, opsi);
  } catch (e) {
    if (!(e instanceof Error && e.message.startsWith("PEMBICARA_CADANGAN"))) throw e;
    cadangan = true;
    hasil = [];
  }
  try {
    writeFileSync(fileCache, JSON.stringify({ kf: hasil, cadangan }), "utf8");
  } catch {
    /* cache wajib — gagal tulis bukan fatal */
  }
  if (cadangan) throw new Error("PEMBICARA_CADANGAN: dianalisis, jatuh ke cadangan");
  return hasil;
}

/** PEMBICARA DI LATAR (pola AdeganLatar): analisis berjalan bareng render part */
export class PembicaraLatar {
  janji: Promise<Keyframe[]>;
  private tuntas = false;
  private hasil: Keyframe[] | null = null;
  /** true = AI gagal → gunakan cadangan 2-bagian */
  cadangan = false;

  constructor(
    src: string,
    ffbin: string,
    opsi: OpsiAnalisisPembicara & { pakaiCadanganStereo?: boolean },
  ) {
    this.janji = analisisPembicaraCache(src, ffbin, opsi)
      .then((k) => {
        this.hasil = k;
        this.tuntas = true;
        return k;
      })
      .catch((e) => {
        this.hasil = [];
        this.tuntas = true;
        // model gagal + cadangan stereo diizinkan → TIDAK melempar (cadangan jalan)
        if (opsi.pakaiCadanganStereo && e instanceof Error && e.message.startsWith("PEMBICARA_CADANGAN")) {
          this.cadangan = true;
          return [];
        }
        throw e;
      });
  }

  apakahTuntas(): boolean {
    return this.tuntas;
  }

  async tunggu(isBatal?: () => boolean): Promise<Keyframe[]> {
    while (!this.tuntas) {
      if (isBatal && isBatal()) throw new Error("DIBATALKAN");
      await new Promise<void>((ok) => setTimeout(ok, 400));
    }
    return this.hasil || (await this.janji.catch(() => []));
  }
}
