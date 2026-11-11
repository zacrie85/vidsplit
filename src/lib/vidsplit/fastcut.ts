/* ================================================================
   VidSplit v2.9.0 — fastcut.ts  (MESIN POTONG LANGSUNG KINOSTRA)
   ================================================================
   Transplantasi renderer/js/fastcut.js dari KINOSTRA v3.16.0
   (repo zacrie85/kinostra-desktop) ke mesin server VidSplit.

   Ekspor & split TANPA re-encode: video sumber dibaca level kotak
   (box) MP4, tabel sampel (stts/stsc/stsz/stco/stss/ctts/sdtp)
   dipangkas per rentang part, byte sampel DISALIN UTUH ke file
   baru — kualitas piksel = 100% sumber (encoder tidak disentuh).

   Kecepatan: sebatas kecepatan disk (±10–60× lebih cepat dari
   render ffmpeg) karena TIDAK ada decode/encode — hanya salin
   byte + tulis header moov baru (fastStart: moov di depan).

   Aturan main agar hasil 100% bisa diputar:
   - Batas awal part digeser MUNDUR ke keyframe terdekat (H.264).
   - Batas akhir part = keyframe pertama SETELAH batas → part utuh.
   - Audio AAC ikut rentang waktu video NYATA (anti desinkron A/V).
   - HANYA dipakai bila SEMUA efek mati — bila ada yang aktif,
     penelepon jatuh ke jalur ffmpeg lama (burn teks butuh re-encode).

   Struktur file hasil: [ftyp][moov baru][mdat(salinan byte)].
   ================================================================ */
import { open, mkdir, stat } from "node:fs/promises";
import type { FileHandle } from "node:fs/promises";
import path from "node:path";
import type { InfoVideo } from "./ffmpeg";
import type { Pengaturan } from "./types";

/* ---------- galat khusus: penelepon wajib jatuh ke ffmpeg ---------- */
export class FastCutTidakDidukung extends Error {
  constructor(pesan: string) {
    super(pesan);
    this.name = "FastCutTidakDidukung";
  }
}

/* ---------- util byte (port fc* fastcut.js) ---------- */
const fcClamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
function fcView(buf: Uint8Array): DataView {
  return new DataView(buf.buffer as ArrayBuffer, buf.byteOffset, buf.byteLength);
}
function fcType(dv: DataView, o: number): string {
  return String.fromCharCode(dv.getUint8(o), dv.getUint8(o + 1), dv.getUint8(o + 2), dv.getUint8(o + 3));
}
function fcBox(type: string, ...parts: Uint8Array[]): Uint8Array {
  let len = 8;
  for (const p of parts) len += p.length;
  const b = new Uint8Array(len);
  const dv = fcView(b);
  dv.setUint32(0, len);
  for (let i = 0; i < 4; i++) b[4 + i] = type.charCodeAt(i);
  let o = 8;
  for (const p of parts) {
    b.set(p, o);
    o += p.length;
  }
  return b;
}
function fcFull(type: string, version: number, flags: number, ...parts: Uint8Array[]): Uint8Array {
  const vf = new Uint8Array(4);
  vf[0] = version;
  vf[1] = (flags >> 16) & 255;
  vf[2] = (flags >> 8) & 255;
  vf[3] = flags & 255;
  return fcBox(type, vf, ...parts);
}
const fcU16 = (v: number) => {
  const b = new Uint8Array(2);
  fcView(b).setUint16(0, v);
  return b;
};
const fcU32 = (v: number) => {
  const b = new Uint8Array(4);
  fcView(b).setUint32(0, v >>> 0);
  return b;
};
function fcU64(v: number): Uint8Array {
  const b = new Uint8Array(8);
  const dv = fcView(b);
  dv.setUint32(0, Math.floor(v / 4294967296));
  dv.setUint32(4, v >>> 0);
  return b;
}
const fcCat = (...arrs: Uint8Array[]): Uint8Array => {
  let n = 0;
  for (const a of arrs) n += a.length;
  const out = new Uint8Array(n);
  let o = 0;
  for (const a of arrs) {
    out.set(a, o);
    o += a.length;
  }
  return out;
};
/* RLE pasangan (count, value) — memampatkan tabel durasi/offset sampel */
function fcRle(arr: number[], pick: (x: number) => number): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < arr.length; ) {
    let j = i + 1;
    while (j < arr.length && pick(arr[j]) === pick(arr[i])) j++;
    out.push([j - i, pick(arr[i])]);
    i = j;
  }
  return out;
}

/* ---------- pejalan kotak MP4 ---------- */
interface Kotak {
  type: string;
  off: number;
  hdr: number;
  size: number;
}
function fcChildren(dv: DataView, off: number, end: number): Kotak[] {
  const out: Kotak[] = [];
  let o = off;
  while (o + 8 <= end) {
    let size = dv.getUint32(o);
    let hdr = 8;
    if (size === 1) {
      if (o + 16 > end) break;
      size = Number(dv.getBigUint64(o + 8));
      hdr = 16;
    } else if (size === 0) size = end - o;
    if (size < hdr || o + size > end) break;
    out.push({ type: fcType(dv, o + 4), off: o, hdr, size });
    o += size;
  }
  return out;
}
function fcChild(dv: DataView, off: number, end: number, type: string): Kotak | null {
  return fcChildren(dv, off, end).find((b) => b.type === type) || null;
}
/* cari anak LANGSUNG dari kotak kontainer (mulai +8 — lewati header kontainer) */
function fcKid(dv: DataView, b: Kotak | null, type: string): Kotak | null {
  return b ? fcChild(dv, b.off + 8, b.off + b.size, type) : null;
}

/* ---------- tabel track hasil parse ---------- */
interface TrackFc {
  kind: "vide" | "soun";
  ts: number;
  nSamp: number;
  deltas: Float64Array;
  sizes: Float64Array | null;
  unif: number;
  offs: Float64Array;
  syncArr: number[] | null;
  ctts: Int32Array | null;
  cttsV1: boolean;
  sdtp: Uint8Array | null;
  fmt: string;
  stsd: Uint8Array;
  hdlr: Uint8Array;
  mdhd: { bytes: Uint8Array; ver: number };
  tkhd: { bytes: Uint8Array; ver: number };
  elst: Uint8Array | null;
  dinf: Uint8Array | null;
  mediaHdr: Uint8Array | null;
  width: number;
  height: number;
  /* diisi belakangan */
  dts?: Float64Array;
  dur?: number;
}
interface ParseFc {
  ftyp: Uint8Array | null;
  fileSize: number;
  mvTs: number;
  mvVer: number;
  mvhdBytes: Uint8Array;
  video: TrackFc;
  audio: TrackFc | null;
  moovOff: number;
  moovSize: number;
}

/* ---------- PARSER MP4 ----------
   read(start, len) → Promise<Uint8Array>; fileSize = ukuran berkas.
   Mengembalikan tabel sampel lengkap track video & audio pertama. */
async function fcParseMp4(read: (start: number, len: number) => Promise<Uint8Array>, fileSize: number): Promise<ParseFc> {
  /* 1) pindai kotak level atas (window bergeser, indeks absolut aman) */
  let moov: { off: number; size: number } | null = null;
  let ftyp: { off: number; size: number } | null = null;
  {
    let pos = 0;
    let win: Uint8Array | null = null;
    let base = 0;
    for (let guard = 0; guard < 4096 && pos + 8 <= fileSize; guard++) {
      if (!win || pos < base || pos + 16 > base + win.length) {
        base = pos;
        win = await read(pos, Math.min(262144, fileSize - pos));
        if (win.length < 8) break;
      }
      const dv = fcView(win);
      const w = pos - base;
      let size = dv.getUint32(w);
      let hdr = 8;
      if (size === 1) {
        if (w + 16 > win.length) {
          base = pos;
          win = await read(pos, Math.min(262144, fileSize - pos));
          continue;
        }
        size = Number(dv.getBigUint64(w + 8));
        hdr = 16;
      } else if (size === 0) size = fileSize - pos;
      if (size < hdr || pos + size > fileSize) throw new FastCutTidakDidukung("struktur MP4 tidak sah");
      const type = fcType(dv, w + 4);
      if (type === "ftyp") ftyp = { off: pos, size };
      else if (type === "moov") {
        moov = { off: pos, size };
        break;
      }
      pos += size;
    }
  }
  if (!moov) throw new FastCutTidakDidukung("moov tidak ditemukan (bukan MP4 utuh)");
  if (moov.size > 160 * 1048576) throw new FastCutTidakDidukung("moov terlalu besar");
  /* 2) baca seluruh moov */
  const moovBuf = await read(moov.off, moov.size);
  const mdv = fcView(moovBuf);
  const mEnd = moovBuf.length;
  const mvhdB = fcChild(mdv, 8, mEnd, "mvhd"); /* anak moov mulai di +8 */
  if (!mvhdB) throw new FastCutTidakDidukung("mvhd tidak ada");
  const mvVer = mdv.getUint8(mvhdB.off + 8);
  const mvTs = mdv.getUint32(mvhdB.off + (mvVer === 0 ? 20 : 28)) || 1000;
  const traks: TrackFc[] = [];
  for (const trak of fcChildren(mdv, 8, mEnd).filter((b) => b.type === "trak")) {
    const tkhdB = fcKid(mdv, trak, "tkhd");
    const mdiaB = fcKid(mdv, trak, "mdia");
    if (!tkhdB || !mdiaB) continue;
    const hdlrB = fcKid(mdv, mdiaB, "hdlr");
    const kind = hdlrB ? (fcType(mdv, hdlrB.off + 8 + 8) as "vide" | "soun") : ("?" as unknown as "vide");
    if (kind !== "vide" && kind !== "soun") continue;
    const mdhdB = fcKid(mdv, mdiaB, "mdhd");
    if (!mdhdB) continue;
    const mdVer = mdv.getUint8(mdhdB.off + 8);
    const ts = mdv.getUint32(mdhdB.off + (mdVer === 0 ? 20 : 28));
    if (!ts) continue;
    const minfB = fcKid(mdv, mdiaB, "minf");
    const stblB = fcKid(mdv, minfB, "stbl");
    if (!stblB) continue;
    const S = (t: string) => fcKid(mdv, stblB, t);
    const stsdB = S("stsd"),
      sttsB = S("stts"),
      stscB = S("stsc"),
      stszB = S("stsz");
    const stcoB = S("stco"),
      co64B = S("co64");
    if (!stsdB || !sttsB || !stscB || !stszB || (!stcoB && !co64B))
      throw new FastCutTidakDidukung("tabel sampel tidak lengkap");
    if (mdv.getUint32(stsdB.off + 8 + 4) < 1) throw new FastCutTidakDidukung("stsd kosong");
    const fmt = fcType(mdv, stsdB.off + 20);
    /* stts → delta dts per sampel */
    const nStts = mdv.getUint32(sttsB.off + 12);
    let deltas = new Float64Array(1 << 16);
    let nSamp = 0;
    for (let e = 0; e < nStts; e++) {
      const cnt = mdv.getUint32(sttsB.off + 16 + e * 8);
      const del = mdv.getUint32(sttsB.off + 16 + e * 8 + 4);
      if (nSamp + cnt > deltas.length) {
        const grown = new Float64Array(Math.max(deltas.length * 2, nSamp + cnt));
        grown.set(deltas);
        deltas = grown;
      }
      for (let k = 0; k < cnt; k++) deltas[nSamp++] = del;
      if (nSamp > 4e8) throw new FastCutTidakDidukung("jumlah sampel tidak wajar");
    }
    if (!nSamp) throw new FastCutTidakDidukung("stts kosong");
    const deltasF = deltas.subarray(0, nSamp);
    /* stsz → ukuran per sampel */
    const unif = mdv.getUint32(stszB.off + 12);
    const nStsz = mdv.getUint32(stszB.off + 16);
    if (nStsz && nStsz !== nSamp) throw new FastCutTidakDidukung("stsz/stts tidak cocok");
    const sizes = unif === 0 ? new Float64Array(nSamp) : null;
    if (sizes) {
      for (let i = 0; i < nSamp; i++) sizes[i] = mdv.getUint32(stszB.off + 20 + i * 4);
    }
    /* stsc + stco → offset byte per sampel */
    const nStsc = mdv.getUint32(stscB.off + 12);
    const rows: number[][] = [];
    for (let e = 0; e < nStsc; e++)
      rows.push([
        mdv.getUint32(stscB.off + 16 + e * 12),
        mdv.getUint32(stscB.off + 16 + e * 12 + 4),
        mdv.getUint32(stscB.off + 16 + e * 12 + 8),
      ]);
    if (rows.some((r) => r[2] !== 1)) throw new FastCutTidakDidukung("stsd ganda per chunk — tidak didukung");
    const nChunks = mdv.getUint32((stcoB || co64B)!.off + 12);
    const chunkOff = new Float64Array(nChunks);
    for (let c = 0; c < nChunks; c++) {
      chunkOff[c] = stcoB
        ? mdv.getUint32(stcoB.off + 16 + c * 4)
        : Number(mdv.getBigUint64(co64B!.off + 16 + c * 8));
    }
    const offs = new Float64Array(nSamp);
    {
      let s = 0;
      for (let c = 0; c < nChunks && s < nSamp; c++) {
        let row = rows[0];
        for (const r of rows) {
          if (r[0] <= c + 1) row = r;
          else break;
        }
        const spc = row[1];
        let bo = chunkOff[c];
        for (let k = 0; k < spc && s < nSamp; k++, s++) {
          offs[s] = bo;
          bo += unif === 0 ? sizes![s] : unif;
        }
      }
      if (s < nSamp) throw new FastCutTidakDidukung("tabel chunk tidak mencakup semua sampel");
    }
    /* stss (video) → indeks sampel kunci (basis-0) */
    let syncArr: number[] | null = null;
    const stssB = S("stss");
    if (stssB) {
      const n = mdv.getUint32(stssB.off + 12);
      const arr = Array.from({ length: n }, (_, i) => mdv.getUint32(stssB.off + 16 + i * 4) - 1).filter(
        (x) => x >= 0 && x < nSamp,
      );
      if (arr.length) syncArr = arr;
    }
    /* ctts → offset komposisi (B-frame). PENTING: ctts juga RLE —
       kembangkan jadi per-sampel sebelum dipakai (PTS tak monoton kalau tidak). */
    let ctts: Int32Array | null = null;
    let cttsV1 = false;
    const cttsB = S("ctts");
    if (cttsB) {
      const v = mdv.getUint8(cttsB.off + 8);
      const nE = mdv.getUint32(cttsB.off + 12);
      if (nE * 8 + 16 <= cttsB.off + cttsB.size && nE < 1e7) {
        const arr: number[] = [];
        let bad = false;
        for (let e = 0; e < nE && !bad; e++) {
          const cnt = mdv.getUint32(cttsB.off + 16 + e * 8);
          const off = v === 1 ? mdv.getInt32(cttsB.off + 16 + e * 8 + 4) : mdv.getUint32(cttsB.off + 16 + e * 8 + 4) | 0;
          for (let k = 0; k < cnt; k++) {
            arr.push(off);
            if (arr.length > nSamp) {
              bad = true;
              break;
            }
          }
        }
        if (!bad && arr.length === nSamp) {
          ctts = Int32Array.from(arr);
          cttsV1 = v === 1 || arr.some((x) => x < 0);
        }
      }
    }
    /* sdtp → tipe sampel (opsional; wajib panjangnya pas) */
    let sdtp: Uint8Array | null = null;
    const sdtpB = S("sdtp");
    if (sdtpB && mdv.getUint32(sdtpB.off) === nSamp + 12)
      sdtp = moovBuf.slice(sdtpB.off + 12, sdtpB.off + 12 + nSamp);
    /* kotak yang disalin utuh ke file hasil */
    const sliceOf = (b: Kotak) => moovBuf.slice(b.off, b.off + b.size);
    const vmSm = S(kind === "vide" ? "vmhd" : "smhd");
    const dinfB = fcKid(mdv, minfB!, "dinf");
    const elstB = fcKid(mdv, fcKid(mdv, trak, "edts"), "elst");
    const tkVer = mdv.getUint8(tkhdB.off + 8);
    const wOff = tkVer === 0 ? 84 : 92;
    const hOff = tkVer === 0 ? 88 : 96; /* setelah matrix 36B */
    traks.push({
      kind,
      ts,
      nSamp,
      deltas: deltasF,
      sizes,
      unif,
      offs,
      syncArr,
      ctts,
      cttsV1,
      sdtp,
      fmt,
      stsd: sliceOf(stsdB),
      hdlr: hdlrB ? sliceOf(hdlrB) : new Uint8Array(0),
      mdhd: { bytes: sliceOf(mdhdB), ver: mdVer },
      tkhd: { bytes: sliceOf(tkhdB), ver: tkVer },
      elst: elstB ? sliceOf(elstB) : null,
      dinf: dinfB ? sliceOf(dinfB) : null,
      mediaHdr: vmSm ? sliceOf(vmSm) : null,
      width: hOff + 4 <= tkhdB.size ? mdv.getUint32(tkhdB.off + wOff) / 65536 : 0,
      height: hOff + 4 <= tkhdB.size ? mdv.getUint32(tkhdB.off + hOff) / 65536 : 0,
    });
  }
  const video = traks.find((t) => t.kind === "vide");
  const audio = traks.find((t) => t.kind === "soun") || null;
  if (!video) throw new FastCutTidakDidukung("tidak ada track video");
  /* dts kumulatif per track */
  for (const t of [video, audio]) {
    if (!t) continue;
    const dts = new Float64Array(t.nSamp);
    let acc = 0;
    for (let i = 0; i < t.nSamp; i++) {
      dts[i] = acc;
      acc += t.deltas[i];
    }
    t.dts = dts;
    t.dur = acc;
  }
  return {
    ftyp: ftyp ? await read(ftyp.off, ftyp.size) : null,
    fileSize,
    mvTs,
    mvVer,
    mvhdBytes: moovBuf.slice(mvhdB.off, mvhdB.off + mvhdB.size),
    video,
    audio,
    moovOff: moov.off,
    moovSize: moov.size,
  };
}

/* ---------- pencarian sampel (binary search pada dts) ---------- */
function fcFloor(trk: TrackFc, tSec: number): number {
  const t = tSec * trk.ts;
  let lo = 0,
    hi = trk.nSamp - 1,
    r = -1;
  while (lo <= hi) {
    const m = (lo + hi) >> 1;
    if (trk.dts![m] <= t + 1e-6) {
      r = m;
      lo = m + 1;
    } else hi = m - 1;
  }
  return r;
}
function fcCeil(trk: TrackFc, tSec: number): number {
  const t = tSec * trk.ts;
  let lo = 0,
    hi = trk.nSamp - 1,
    r = trk.nSamp;
  while (lo <= hi) {
    const m = (lo + hi) >> 1;
    if (trk.dts![m] >= t - 1e-6) {
      r = m;
      hi = m - 1;
    } else lo = m + 1;
  }
  return r;
}
/* keyframe terakhir pada/sebelum idx (video tanpa stss = semua kunci) */
function fcSyncBefore(trk: TrackFc, idx: number): number {
  if (!trk.syncArr) return Math.max(0, idx);
  const sa = trk.syncArr;
  let lo = 0,
    hi = sa.length - 1,
    r = sa[0];
  while (lo <= hi) {
    const m = (lo + hi) >> 1;
    if (sa[m] <= idx) {
      r = sa[m];
      lo = m + 1;
    } else hi = m - 1;
  }
  return r;
}

/* ---------- rencana potong per rentang waktu ---------- */
export interface RentangFc {
  start: number;
  end: number;
}
interface PlanFc extends RentangFc {
  vi0: number;
  vi1: number;
  ai0: number;
  ai1: number;
  dur: number;
}
function fcPlanRanges(P: ParseFc, ranges: RentangFc[]): PlanFc[] {
  const V = P.video,
    A = P.audio;
  const vMax = V.dur! / V.ts;
  return ranges.map((r) => {
    const t0 = fcClamp(Math.min(r.start, vMax), 0, vMax);
    const t1 = fcClamp(Math.max(r.end, t0 + 0.05), t0 + 0.05, vMax);
    let vi0 = fcFloor(V, t0);
    if (vi0 < 0) vi0 = 0;
    vi0 = fcSyncBefore(V, vi0);
    let vi1 = fcCeil(V, t1);
    if (vi1 <= vi0) vi1 = Math.min(V.nSamp, vi0 + 1);
    /* AUDIO selalu mengikuti rentang video NYATA (mulai keyframe, akhir
       sampel video terakhir) — potong di batas mentah bisa membuat part
       mulai beberapa detik tanpa suara (desinkron A/V di awal part). */
    const vStartSec = V.dts![vi0] / V.ts;
    const vEndSec = (V.dts![vi1 - 1] + V.deltas[vi1 - 1]) / V.ts;
    let ai0 = A ? Math.max(0, fcFloor(A, vStartSec)) : 0;
    let ai1 = A ? Math.max(ai0 + 1, fcCeil(A, vEndSec)) : 0;
    if (A && ai1 > A.nSamp) ai1 = A.nSamp;
    const durV = (V.dts![vi1 - 1] + V.deltas[vi1 - 1] - V.dts![vi0]) / V.ts;
    return { start: r.start, end: r.end, vi0, vi1, ai0, ai1, dur: durV };
  });
}

/* ---------- pembangun trak baru utk rentang sampel [i0,i1) ---------- */
function fcBuildTrack(P: ParseFc, trk: TrackFc, i0: number, i1: number, dataOff: number) {
  const n = i1 - i0;
  const durSec = (trk.dts![i1 - 1] + trk.deltas[i1 - 1] - trk.dts![i0]) / trk.ts;
  const durMv = Math.max(0, Math.round(durSec * P.mvTs));
  /* stts: pasangan (count, delta) */
  const dSlice = Array.from(trk.deltas.slice(i0, i1));
  const sttsE = fcRle(dSlice, (x) => x);
  const stts = fcFull(
    "stts",
    0,
    0,
    fcU32(sttsE.length),
    fcCat(...sttsE.map((e) => fcCat(fcU32(e[0]), fcU32(e[1])))),
  );
  /* stss: nomor sampel kunci (basis-1, digeser ke rentang baru) */
  let stss: Uint8Array | null = null;
  if (trk.syncArr) {
    const ks = trk.syncArr.filter((s) => s >= i0 && s < i1).map((s) => s - i0 + 1);
    if (ks.length === n) stss = null; /* semua kunci → kotak tidak perlu */
    else if (ks.length)
      stss = fcFull("stss", 0, 0, fcU32(ks.length), fcCat(...ks.map(fcU32)));
  }
  /* ctts (B-frame) */
  let ctts: Uint8Array | null = null;
  if (trk.ctts) {
    const cSlice = Array.from(trk.ctts.slice(i0, i1));
    const cE = fcRle(cSlice, (x) => x);
    ctts = fcFull(
      "ctts",
      trk.cttsV1 ? 1 : 0,
      0,
      fcU32(cE.length),
      fcCat(...cE.map((e) => fcCat(fcU32(e[0]), fcU32(e[1] >>> 0)))),
    );
  }
  /* stsz */
  let stsz: Uint8Array;
  if (trk.unif) stsz = fcFull("stsz", 0, 0, fcU32(trk.unif), fcU32(n));
  else {
    const tb = new Uint8Array(n * 4);
    const tdv = fcView(tb);
    for (let i = i0; i < i1; i++) tdv.setUint32((i - i0) * 4, trk.sizes![i] >>> 0);
    stsz = fcFull("stsz", 0, 0, fcU32(0), fcU32(n), tb);
  }
  /* stsc: SATU chunk berisi seluruh sampel rentang */
  const stsc = fcFull("stsc", 0, 0, fcU32(1), fcCat(fcU32(1), fcU32(n), fcU32(1)));
  const stco = fcFull("stco", 0, 0, fcU32(1), fcU32(dataOff >>> 0));
  /* sdtp dipangkas */
  const sdtp = trk.sdtp ? fcFull("sdtp", 0, 0, trk.sdtp.slice(i0, i1)) : null;
  /* mdhd: durasi baru (timescale media) */
  const mdhdB = new Uint8Array(trk.mdhd.bytes);
  {
    const dv = fcView(mdhdB);
    let durTs = 0;
    for (let i = i0; i < i1; i++) durTs += trk.deltas[i];
    if (trk.mdhd.ver === 0) dv.setUint32(24, durTs >>> 0);
    else dv.setBigUint64(32, BigInt(Math.round(durTs)));
  }
  /* tkhd: durasi baru (timescale movie) */
  const tkhdB = new Uint8Array(trk.tkhd.bytes);
  {
    const dv = fcView(tkhdB);
    if (trk.tkhd.ver === 0) dv.setUint32(28, durMv >>> 0);
    else dv.setBigUint64(36, BigInt(durMv));
  }
  /* edts/elst: dipertahankan HANYA bila rentang mulai dari sampel 0
     dan media_time tidak negatif (edit kosong) */
  let edts: Uint8Array | null = null;
  if (trk.elst && i0 === 0) {
    const el = new Uint8Array(trk.elst);
    const dv = fcView(el);
    const ver = dv.getUint8(8);
    const ok = ver === 0 ? dv.getInt32(20) >= 0 : dv.getBigInt64(24) >= 0n;
    if (ok) {
      if (ver === 0) dv.setUint32(16, durMv >>> 0);
      else dv.setBigUint64(16, BigInt(durMv));
      edts = fcBox("edts", el);
    }
  }
  const stbl = fcBox(
    "stbl",
    trk.stsd,
    stts,
    ...(ctts ? [ctts] : []),
    stsc,
    stsz,
    stco,
    ...(stss ? [stss] : []),
    ...(sdtp ? [sdtp] : []),
  );
  const minf = fcBox("minf", ...(trk.mediaHdr ? [trk.mediaHdr] : []), ...(trk.dinf ? [trk.dinf] : []), stbl);
  const mdia = fcBox("mdia", mdhdB, trk.hdlr, minf);
  const trak = fcBox("trak", tkhdB, ...(edts ? [edts] : []), mdia);
  return { trak, durMv, n };
}

/* ---------- byte mdat: run-run kontinu utk rentang sampel ---------- */
function fcRuns(trk: TrackFc, i0: number, i1: number): [number, number][] {
  const runs: [number, number][] = [];
  let rs = -1,
    re = -1;
  for (let i = i0; i < i1; i++) {
    const sz = trk.unif ? trk.unif : trk.sizes![i];
    const a = trk.offs[i],
      b = a + sz;
    if (rs < 0) {
      rs = a;
      re = b;
    } else if (a === re) re = b;
    else {
      runs.push([rs, re]);
      rs = a;
      re = b;
    }
  }
  if (rs >= 0) runs.push([rs, re]);
  return runs;
}
function fcRunsBytes(trk: TrackFc, i0: number, i1: number): number {
  return fcRuns(trk, i0, i1).reduce((a, r) => a + r[1] - r[0], 0);
}

/* ---------- TULIS SATU PART POTONGAN (writer Node fs) ---------- */
interface IoFc {
  CHUNK: number;
  isAborted(): boolean;
  prog?: (doneBytes: number, partBytes: number, plan: PlanFc) => void;
}
async function fcWritePart(
  P: ParseFc,
  read: (start: number, len: number) => Promise<Uint8Array>,
  plan: PlanFc,
  keluar: FileHandle,
  io: IoFc,
): Promise<{ size: number; dur: number }> {
  const V = P.video, A = P.audio;
  const runsV = fcRuns(V, plan.vi0, plan.vi1);
  const runsA = A ? fcRuns(A, plan.ai0, plan.ai1) : [];
  const bytesV = fcRunsBytes(V, plan.vi0, plan.vi1);
  const bytesA = A ? fcRunsBytes(A, plan.ai0, plan.ai1) : 0;
  const totalData = bytesV + bytesA;
  const baca = read;
  if (totalData + 64 > 4294967290)
    throw new FastCutTidakDidukung("part melebihi batas 4 GB stco — pakai RENDER ffmpeg");
  /* moov dibangun 2×: ukurannya tidak tergantung NILAI offset →
     percobaan (offset 0) hanya untuk menghitung ukuran header */
  const buildMoov = (offV: number, offA: number) => {
    const tv = fcBuildTrack(P, V, plan.vi0, plan.vi1, offV);
    const ta = A ? fcBuildTrack(P, A, plan.ai0, plan.ai1, offA) : null;
    const mv = new Uint8Array(P.mvhdBytes);
    const mdv = fcView(mv);
    const durMv = Math.max(tv.durMv, ta ? ta.durMv : 0);
    if (P.mvVer === 0) mdv.setUint32(24, durMv >>> 0);
    else mdv.setBigUint64(32, BigInt(durMv));
    return { moov: fcBox("moov", mv, tv.trak, ...(ta ? [ta.trak] : [])) };
  };
  const trial = buildMoov(0, 0);
  const ftypLen = P.ftyp ? P.ftyp.length : 0;
  const offV = ftypLen + trial.moov.length + 8;
  const offA = offV + bytesV;
  const fin = buildMoov(offV, offA); /* offset nyata langsung benar */
  const head = fcCat(
    P.ftyp || new Uint8Array(0),
    fin.moov,
    fcCat(fcU32(8 + totalData), new Uint8Array([0x6d, 0x64, 0x61, 0x74])),
  );
  try {
    await keluar.write(head);
    let done = head.length;
    const copyRuns = async (runs: [number, number][]) => {
      for (const [a, b] of runs) {
        let pos = a;
        while (pos < b) {
          if (io.isAborted()) throw new Error("DIBATALKAN");
          const L = Math.min(io.CHUNK, b - pos);
          const d = await baca(pos, L);
          await keluar.write(d);
          pos += L;
          done += L;
          if (io.prog) io.prog(done - head.length, totalData, plan);
        }
      }
    };
    await copyRuns(runsV);
    await copyRuns(runsA);
    return { size: done, dur: plan.dur };
  } catch (e) {
    throw e;
  }
}

/* ================================================================
   GERBANG — boleh potong langsung? (null = boleh; string = alasan blok)
   Port fastcutBlockedReason() KINOSTRA, disesuaikan Pengaturan VidSplit.
   ================================================================ */
export function gerbangFastcut(
  p: Pengaturan,
  info: InfoVideo,
  targetMb = 0,
): string | null {
  const T = p as Pengaturan & { targetMb?: number };
  const mb = targetMb || T.targetMb || 0;
  if (p.mode !== "asli") return "MODE KONVERSI";
  if ((p.judul || "").trim()) return "JUDUL DI VIDEO";
  if ((p.kataPart || "").trim()) return "LABEL PART";
  if ((p.deskripsi || "").trim()) return "DESKRIPSI";
  if (p.introAktif) return "INTRO PEMBUKA";
  if ((p.logoId || "").trim()) return "LOGO";
  if ((p.frameId || "").trim()) return "BINGKAI";
  if (p.neonAktif) return "FRAME NEON";
  // v3.3.0 — mesin efek NOVACUT memaksa render ffmpeg (xfade/rantai filter);
  // transisiPart lama tetap dicek utk jaga-jaga simpanan yang belum dimigrasi
  if (p.transisiPart) return "TRANSISI PART";
  if (p.efekTransisi) return "TRANSISI NOVACUT";
  if (p.efekKlip && p.efekKlip.length) return "EFEK NOVACUT";
  if (Math.abs((p.kecepatanVideo || 1) - 1) > 1e-9) return "KECEPATAN VIDEO";
  if (p.resolusiOutput !== "auto") return "RESOLUSI TETAP";
  if (p.zoomPembicara !== "mati") return "ZOOM PEMBICARA";
  if (p.subtitleAktif) return "SUBTITEL";
  if (p.backsoundAktif) return "BACKSOUND";
  if ((p.introSuaraFile || "").trim()) return "SUARA INTRO";
  if (p.codec !== "h264") return "KODEK H265";
  if (mb > 0) return "KOMPRES PINTAR";
  /* dimensi ganjil tidak lolos yuv420p kalau nanti diproses ulang —
     salinan byte tetap sah, tapi jaga konsistensi dgn jalur ffmpeg */
  if (info.lebar % 2 !== 0 || info.tinggi % 2 !== 0) return "DIMENSI GANJIL";
  return null;
}

/* ================================================================
   EKSPOR POTONG LANGSUNG (dipanggil jobs.ts renderVideo)
   ------------------------------------------------------------
   rentang     : daftar {start,end} detik per part (dihitung dgn fungsi
                 ekspor YANG SAMA — rentangPart/rentangPartHapus/adegan)
   namaKeluar  : (n, i) → path absolut file part ke-n
   Penelepon menangkap FastCutTidakDidukung → jatuh ke jalur ffmpeg.
   ================================================================ */
export interface HasilPotong {
  n: number;
  path: string;
  size: number;
  dur: number;
}
export async function potongLangsung(
  srcAbs: string,
  rentang: RentangFc[],
  namaKeluar: (n: number) => string,
  ops: {
    isAborted: () => boolean;
    prog?: (partKe: number, progres01: number, sub?: string) => void;
    chunkBytes?: number;
  },
): Promise<HasilPotong[]> {
  let fh: FileHandle | null = null;
  try {
    fh = await open(srcAbs, "r");
    const st = await stat(srcAbs);
    if (!st.isFile()) throw new FastCutTidakDidukung("sumber bukan file biasa");
    const read = async (start: number, len: number): Promise<Uint8Array> => {
      const buf = new Uint8Array(len);
      let terbaca = 0;
      while (terbaca < len) {
        const { bytesRead } = await fh!.read(buf, terbaca, len - terbaca, start + terbaca);
        if (bytesRead <= 0) throw new FastCutTidakDidukung(`gagal membaca sumber @${start + terbaca}`);
        terbaca += bytesRead;
      }
      return buf;
    };
    const P = await fcParseMp4(read, st.size);
    const plans = fcPlanRanges(P, rentang);
    const totals = plans.map(
      (pl) =>
        fcRunsBytes(P.video, pl.vi0, pl.vi1) + (P.audio ? fcRunsBytes(P.audio, pl.ai0, pl.ai1) : 0),
    );
    const grand = Math.max(1, totals.reduce((a, b) => a + b, 0));
    const io: IoFc = { CHUNK: ops.chunkBytes || 8 * 1048576, isAborted: ops.isAborted };
    const t0 = Date.now();
    let doneBytes = 0;
    let doneDur = 0;
    const hasil: HasilPotong[] = [];
    await mkdir(path.dirname(namaKeluar(1)), { recursive: true });
    for (let k = 0; k < plans.length; k++) {
      if (ops.isAborted()) throw new Error("DIBATALKAN");
      const plan = plans[k];
      const keluarPath = namaKeluar(k + 1);
      let fk: FileHandle | null = null;
      try {
        fk = await open(keluarPath, "w");
        io.prog = (done, partBytes, pl) => {
          if (ops.prog)
            ops.prog(
              k + 1,
              fcClamp((doneBytes + done) / grand, 0, 1),
              `POTONG LANGSUNG part ${k + 1}/${plans.length} ${Math.round((100 * done) / Math.max(1, partBytes))}%` +
                (doneDur + (done / Math.max(1, partBytes)) * pl.dur > 0.2 && Date.now() - t0 > 200
                  ? ` · ${((doneDur + (done / Math.max(1, partBytes)) * pl.dur) / ((Date.now() - t0) / 1000)).toFixed(0)}× realtime`
                  : ""),
            );
        };
        const r = await fcWritePart(P, read, plan, fk, io);
        hasil.push({ n: k + 1, path: keluarPath, size: r.size, dur: r.dur });
        doneBytes += totals[k];
        doneDur += plan.dur;
      } catch (e) {
        /* anti-gagal: buang file setengah jadi agar tidak dianggap part valid */
        try {
          await fk?.close();
        } catch {}
        try {
          await (await import("node:fs/promises")).rm(keluarPath, { force: true });
        } catch {}
        throw e;
      } finally {
        try {
          await fk?.close();
        } catch {}
      }
    }
    return hasil;
  } finally {
    try {
      await fh?.close();
    } catch {}
  }
}
