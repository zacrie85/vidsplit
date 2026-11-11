/* ================================================================
   VidSplit v2.9.0 — kilat/demux.ts  (MODE KILAT — WebCodecs GPU)
   ================================================================
   Transplantasi renderer/js/demux.js dari KINOSTRA v3.16.0.

   Demuxer MP4 minimalis + pipa dekode WebCodecs:
   sampel H.264 diambil LANGSUNG dari wadah MP4 (parsing box
   moov/stbl) via pembaca Range HTTP ke /api/file, didekode oleh
   VideoDecoder (GPU bila ada), tanpa memutar video sama sekali.
   Kecepatan = kecepatan dekoder + enkoder (ratusan fps).

   Cakupan aman:
   - Hanya MP4/MOV berbasis avc1/avc3 (H.264 dgn avcC).
   - Sumber ber-B-frame DIDUKUNG: penyangga pengurut kecil menjamin
     frame keluar terurut PTS — RAM tetap aman.
   - Rotasi metadata (tkhd matrix 90/180/270) dikompensasi saat blit.
   - Gagal dalam bentuk apa pun → penelepon jatuh ke jalur ffmpeg.

   Antarmuka:
     probeKilat(baca, ukuran)  → { info, decCfg } / null
     buatRenderKilat(probe, baca) → { cv, range(a,b), close() }
   ================================================================ */
"use client";

const _du8 = (b: Uint8Array, o: number) => b[o];
const _du16 = (b: Uint8Array, o: number) => (b[o] << 8) | b[o + 1];
const _du32 = (b: Uint8Array, o: number) => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
function _du64(b: Uint8Array, o: number) {
  return _du32(b, o) * 4294967296 + _du32(b, o + 4);
}
const _dtag = (b: Uint8Array, o: number) =>
  String.fromCharCode(b[o], b[o + 1], b[o + 2], b[o + 3]);
const _ds32 = (b: Uint8Array, o: number) => _du32(b, o) | 0;

/* ---------- pembaca byte Range HTTP (jendela cache 4 MB) ---------- */
export type PembacaKilat = (off: number, len: number) => Promise<Uint8Array>;

export function pembacaRangeHttp(url: string): PembacaKilat {
  const WIN = 4 * 1024 * 1024;
  let bLo = -1;
  let buf: Uint8Array | null = null;
  return async (off, len) => {
    if (buf && off >= bLo && off + len <= bLo + buf.length)
      return buf.subarray(off - bLo, off - bLo + len);
    bLo = off;
    const r = await fetch(url, {
      headers: { Range: `bytes=${off}-${off + Math.max(len, WIN) - 1}` },
      cache: "no-store",
    });
    if (!r.ok && r.status !== 206) throw new Error(`baca sumber gagal (${r.status})`);
    buf = new Uint8Array(await r.arrayBuffer());
    return buf.subarray(0, Math.min(len, buf.length));
  };
}

/* ---------- telusur box ---------- */
interface KotakK {
  off: number;
  size: number;
  tag: string;
}
async function childBoxes(rd: PembacaKilat, bx: KotakK): Promise<KotakK[]> {
  const out: KotakK[] = [];
  let off = bx.off;
  const end = bx.off + bx.size;
  while (off + 8 <= end) {
    const h = await rd(off, 16);
    let sz = _du32(h, 0);
    const tag = _dtag(h, 4);
    let hdr = 8;
    if (sz === 1) {
      sz = _du64(h, 8);
      hdr = 16;
    }
    if (sz < hdr || off + sz > end + 8) break;
    out.push({ off: off + hdr, size: sz - hdr, tag });
    off += sz;
  }
  return out;
}

/* ---------- PROBE WADAH ---------- */
export interface InfoKilat {
  kind: "avc1";
  codecStr: string;
  avcC: Uint8Array;
  timescale: number;
  durTs: number;
  codedW: number;
  codedH: number;
  dispW: number;
  dispH: number;
  rot: number;
  stbl: {
    stsd: KotakK;
    stts: KotakK;
    stsc: KotakK;
    stsz: KotakK;
    stco: KotakK;
    co64: boolean;
    ctts: KotakK | null;
    stss: KotakK | null;
  };
}

type KotakAtauNull = KotakK | null | undefined;

async function parseTrak(rd: PembacaKilat, trak: KotakK): Promise<InfoKilat | null> {
  const kids = await childBoxes(rd, trak);
  const mdia = kids.find((b) => b.tag === "mdia");
  if (!mdia) return null;
  const mk = await childBoxes(rd, mdia);
  const hdlr = mk.find((b) => b.tag === "hdlr");
  if (hdlr) {
    const h = await rd(hdlr.off, 12);
    if (_dtag(h, 8) !== "vide") return null;
  }
  const mdhd = mk.find((b) => b.tag === "mdhd");
  if (!mdhd) return null;
  const mh = await rd(mdhd.off, 32);
  const ver = _du8(mh, 0);
  const timescale = _du32(mh, ver === 1 ? 20 : 12);
  const durTs = ver === 1 ? _du64(mh, 24) : _du32(mh, 16);
  const minf = mk.find((b) => b.tag === "minf");
  if (!minf) return null;
  const stbl = (await childBoxes(rd, minf)).find((b) => b.tag === "stbl");
  if (!stbl) return null;
  const sk = await childBoxes(rd, stbl);
  const stsd = sk.find((b) => b.tag === "stsd");
  const stts = sk.find((b) => b.tag === "stts");
  const stsc = sk.find((b) => b.tag === "stsc");
  const stsz = sk.find((b) => b.tag === "stsz");
  const stco = sk.find((b) => b.tag === "stco");
  const co64 = sk.find((b) => b.tag === "co64");
  const ctts = sk.find((b) => b.tag === "ctts");
  const stss = sk.find((b) => b.tag === "stss");
  if (!stsd || !stts || !stsc || !stsz || !(stco || co64)) return null;

  /* stsd → avc1/avc3 + avcC */
  const sd = await rd(stsd.off, 8);
  if (_du32(sd, 4) < 1) return null;
  const eo = stsd.off + 8;
  const eh = await rd(eo, 8);
  const etag = _dtag(eh, 4);
  if (etag !== "avc1" && etag !== "avc3") return null;
  /* VisualSampleEntry: 78 byte sebelum box anak */
  const body = await rd(eo + 8, 78);
  const W = _du16(body, 24),
    H = _du16(body, 26);
  if (!W || !H) return null;
  const kidsOff = eo + 8 + 78;
  const scan = await rd(kidsOff, Math.min(1024, stsd.off + stsd.size - kidsOff));
  let avcC: Uint8Array | null = null;
  let o = 0;
  while (o + 8 <= scan.length) {
    const sz = _du32(scan, o),
      tg = _dtag(scan, o + 4);
    if (sz < 8) break;
    if (tg === "avcC") {
      avcC = scan.slice(o + 8, Math.min(o + sz, scan.length));
      break;
    }
    o += sz;
  }
  if (!avcC || avcC.length < 7) return null;
  const hex = (n: number) => n.toString(16).toUpperCase().padStart(2, "0");
  const codecStr = `avc1.${hex(avcC[1])}${hex(avcC[2])}${hex(avcC[3])}`;

  /* tkhd → rotasi (matrix 16.16) */
  let rot = 0;
  const tkhd = kids.find((b) => b.tag === "tkhd");
  if (tkhd) {
    const th = await rd(tkhd.off, 4);
    const tv = _du8(th, 0);
    const mOff = tv === 1 ? 52 : 36;
    const mtx = await rd(tkhd.off + mOff, 36);
    const a = _ds32(mtx, 0),
      b = _ds32(mtx, 4),
      c = _ds32(mtx, 8),
      d = _ds32(mtx, 12);
    if (b === 0x10000 && c === -0x10000) rot = 90;
    else if (b === -0x10000 && c === 0x10000) rot = 270;
    else if (a === -0x10000 && d === -0x10000) rot = 180;
  }
  const hasRot = rot === 90 || rot === 270;
  return {
    kind: "avc1",
    codecStr,
    avcC,
    timescale,
    durTs,
    codedW: W,
    codedH: H,
    dispW: hasRot ? H : W,
    dispH: hasRot ? W : H,
    rot,
    stbl: { stsd, stts, stsc, stsz, stco: (stco || co64) as KotakK, co64: !!co64, ctts: (ctts ?? null) as KotakAtauNull as KotakK | null, stss: (stss ?? null) as KotakAtauNull as KotakK | null },
  };
}

export async function mp4Probe(rd: PembacaKilat, fileSize: number): Promise<InfoKilat | null> {
  try {
    if (!fileSize || fileSize < 2048) return null;
    const tops = await childBoxes(rd, { off: 0, size: fileSize, tag: "root" });
    const moov = tops.find((b) => b.tag === "moov");
    if (!moov) return null;
    const moovKids = await childBoxes(rd, moov);
    for (const trak of moovKids.filter((b) => b.tag === "trak")) {
      const info = await parseTrak(rd, trak);
      if (info) return info;
    }
    return null;
  } catch {
    return null;
  }
}

/* ---------- TABEL SAMPEL ---------- */
export interface TabelSampel {
  n: number;
  sizes: Uint32Array;
  off: Float64Array;
  dts: Float64Array;
  pts: Float64Array;
  key: Uint8Array;
  hasB: boolean;
  minOff: number;
  timescale: number;
  dur: number;
  ptsShift: number;
}

async function buildSampleTable(rd: PembacaKilat, info: InfoKilat): Promise<TabelSampel> {
  const S = info.stbl,
    nT = info.timescale;
  const GAGAL = (m: string): never => {
    throw new Error("tabel sampel: " + m);
  };
  const zs = await rd(S.stsz.off, 12);
  if ((_du32(zs, 0) >>> 24) !== 0) GAGAL("stsz versi tidak didukung");
  const zDef = _du32(zs, 4),
    n = _du32(zs, 8);
  if (zDef !== 0 || n < 1) GAGAL(`stsz aneh (def=${zDef}, n=${n})`);
  const sizes = new Uint32Array(n);
  {
    let have = 0,
      off = S.stsz.off + 12;
    while (have < n) {
      const want = Math.min(n - have, 1 << 20);
      const b = await rd(off, want * 4);
      for (let i = 0; i < want; i++) sizes[have + i] = _du32(b, i * 4);
      have += want;
      off += want * 4;
    }
  }
  const cs = await rd(S.stco.off, 8);
  const nChk = _du32(cs, 4);
  if (nChk < 1) GAGAL("stco kosong");
  const chunks = new Float64Array(nChk);
  {
    const is64 = !!S.co64;
    let have = 0,
      off = S.stco.off + 8;
    while (have < nChk) {
      const want = Math.min(nChk - have, 1 << 19);
      const b = await rd(off, want * (is64 ? 8 : 4));
      for (let i = 0; i < want; i++) chunks[have + i] = is64 ? _du64(b, i * 8) : _du32(b, i * 4);
      have += want;
      off += want * (is64 ? 8 : 4);
    }
  }
  const sc = await rd(S.stsc.off, 8);
  const nSc = _du32(sc, 4);
  const runs: number[][] = [];
  for (let i = 0; i < nSc; i++) {
    const b = await rd(S.stsc.off + 8 + i * 12, 12);
    runs.push([_du32(b, 0), _du32(b, 4), _du32(b, 8)]);
  }
  if (!runs.length) GAGAL("stsc kosong");
  const tt = await rd(S.stts.off, 8);
  const nTt = _du32(tt, 4);
  const dts = new Float64Array(n);
  {
    let si = 0,
      t = 0;
    for (let i = 0; i < nTt && si < n; i++) {
      const b = await rd(S.stts.off + 8 + i * 8, 8);
      const cnt = _du32(b, 0),
        dt = _du32(b, 4);
      for (let k = 0; k < cnt && si < n; k++) {
        dts[si++] = t;
        t += dt;
      }
    }
    if (si < n) GAGAL(`stts kurang (${si}/${n})`);
  }
  let hasB = false,
    minOff = 0;
  const pts = new Float64Array(n);
  if (S.ctts) {
    const ct = await rd(S.ctts.off, 8);
    const cv = _du8(ct, 0),
      nCt = _du32(ct, 4);
    let si = 0;
    for (let i = 0; i < nCt && si < n; i++) {
      const b = await rd(S.ctts.off + 8 + i * 8, 8);
      const cnt = _du32(b, 0);
      const d = cv === 0 ? _ds32(b, 4) : _du32(b, 4) | 0;
      if (d !== 0) hasB = true;
      if (d < minOff) minOff = d;
      for (let k = 0; k < cnt && si < n; k++) {
        pts[si] = dts[si] + d;
        si++;
      }
    }
    for (; si < n; si++) pts[si] = dts[si];
  } else pts.set(dts);
  const key = new Uint8Array(n);
  key.fill(1);
  if (S.stss) {
    key.fill(0);
    const ss = await rd(S.stss.off, 8);
    const nSs = _du32(ss, 4);
    for (let i = 0; i < nSs; i++) {
      const b = await rd(S.stss.off + 8 + i * 4, 4);
      const k = _du32(b, 0);
      if (k >= 1 && k <= n) key[k - 1] = 1;
    }
  }
  const off = new Float64Array(n);
  {
    let s = 0;
    for (let c = 0; c < nChk && s < n; c++) {
      while (runs.length > 1 && c + 1 >= runs[1][0]) runs.shift();
      const spc = runs[0][1];
      let p = chunks[c];
      for (let k = 0; k < spc && s < n; k++) {
        off[s] = p;
        p += sizes[s];
        s++;
      }
    }
    if (s < n) GAGAL(`offset kurang (${s}/${n} — stsc/stco tak konsisten)`);
  }
  /* NORMALISASI PTS — x264 dgn B-frame bisa menulis pts NEGATIF di awal. */
  let shift = 0;
  for (let i = 0; i < Math.min(n, 64); i++) if (pts[i] < shift) shift = pts[i];
  if (shift < 0) for (let i = 0; i < n; i++) pts[i] -= shift;
  const lastDt = n > 1 ? dts[n - 1] - dts[n - 2] : 1;
  const dur = n ? (dts[n - 1] + lastDt) / nT : 0;
  return { n, sizes, off, dts, pts, key, hasB, minOff, timescale: nT, dur, ptsShift: -shift };
}

/* ---------- RENDER KILAT ---------- */
export interface RenderKilat {
  cv: HTMLCanvasElement;
  nTotal: number;
  dur: number;
  range(a: number, b: number): AsyncGenerator<{ pts: number; frame: VideoFrame }>;
  close(): void;
}

export interface ProbeKilat {
  info: InfoKilat;
  decCfg: VideoDecoderConfig;
}

export async function buatRenderKilat(
  probe: ProbeKilat,
  rd: PembacaKilat,
  isAborted: () => boolean,
): Promise<RenderKilat> {
  const tbl = await buildSampleTable(rd, probe.info);
  let decErr: string | null = null;
  /* Chromium mengikat callback output PADA SAAT KONSTRUKSI — satu callback
     stabil dipasang sejak awal, meneruskan frame ke sink yang bisa diganti. */
  let sink: ((fr: VideoFrame) => void) | null = null;
  const dec = new VideoDecoder({
    output: (fr) => {
      if (sink) sink(fr);
      else {
        try {
          fr.close();
        } catch {}
      }
    },
    error: (e) => {
      decErr = decErr || (e && e.message) || String(e);
    },
  });
  dec.configure(probe.decCfg);
  const dispW = probe.info.dispW,
    dispH = probe.info.dispH;
  const cv = document.createElement("canvas");
  cv.width = dispW;
  cv.height = dispH;
  const cx = cv.getContext("2d", { alpha: false })!;
  /* ekspando — serasi drawImage frame (paritas demux.js KINOSTRA) */
  (cv as HTMLCanvasElement & { videoWidth: number; videoHeight: number }).videoWidth = dispW;
  (cv as HTMLCanvasElement & { videoWidth: number; videoHeight: number }).videoHeight = dispH;
  const rot = probe.info.rot || 0;
  function blit(fr: VideoFrame) {
    const w = fr.displayWidth || probe.info.codedW,
      h = fr.displayHeight || probe.info.codedH;
    if (rot === 90 || rot === 270) {
      cx.save();
      cx.translate(cv.width / 2, cv.height / 2);
      cx.rotate((rot * Math.PI) / 180);
      cx.drawImage(fr, -w / 2, -h / 2, w, h);
      cx.restore();
    } else if (rot === 180) {
      cx.save();
      cx.translate(cv.width / 2, cv.height / 2);
      cx.rotate(Math.PI);
      cx.drawImage(fr, -w / 2, -h / 2, w, h);
      cx.restore();
    } else cx.drawImage(fr, 0, 0, cv.width, cv.height);
  }
  function idxAt(t: number): number {
    const ts = t * tbl.timescale + (tbl.minOff || 0);
    let lo = 0,
      hi = tbl.n;
    while (lo < hi) {
      const m = (lo + hi) >> 1;
      if (tbl.dts[m] < ts) lo = m + 1;
      else hi = m;
    }
    if (lo > 0 && lo < tbl.n && tbl.dts[lo] - ts > ts - tbl.dts[lo - 1]) lo--;
    while (lo > 0 && !tbl.key[lo]) lo--;
    return lo;
  }
  return {
    cv,
    nTotal: tbl.n,
    dur: tbl.dur,
    /* iterator async frame terurut PTS ↑ dalam rentang [a, b) detik.
       Sumber ber-B-frame: penyangga kecil menahan frame sampai pasti tak
       ada pendahulu yang belum didekode, lalu keluar terurut pts. */
    async *range(a, b) {
      const pool: VideoFrame[] = [];
      let lastFedDts = -Infinity;
      const minOff = tbl.minOff || 0;
      sink = (fr) => {
        pool.push(fr);
      };
      const idxOf = (fr: VideoFrame) => Math.round(fr.timestamp / 1000);
      function* drain(): Generator<{ pts: number; frame: VideoFrame }> {
        if (!pool.length) return;
        const limit = lastFedDts + minOff;
        const ready: VideoFrame[] = [];
        for (let k = pool.length - 1; k >= 0; k--) {
          if (tbl.pts[idxOf(pool[k])] <= limit) ready.push(pool.splice(k, 1)[0]);
        }
        if (!ready.length) return;
        ready.sort((x, y) => tbl.pts[idxOf(x)] - tbl.pts[idxOf(y)]);
        for (const fr of ready) {
          const t = tbl.pts[idxOf(fr)] / tbl.timescale;
          /* toleransi ketat 5 ms: frame SEBELUM awal part milik part sebelumnya */
          if (t >= a - 0.005 && t < b - 0.004) yield { pts: t, frame: fr };
          else {
            try {
              fr.close();
            } catch {}
          }
        }
      }
      try {
        let i = idxAt(a);
        while (true) {
          if (isAborted()) throw new Error("DIBATALKAN");
          if (decErr) throw new Error("decoder: " + decErr);
          if (i < tbl.n) {
            while (dec.decodeQueueSize > 24) {
              await new Promise((r) => setTimeout(r, 2));
              if (decErr) throw new Error("decoder: " + decErr);
              if (isAborted()) throw new Error("DIBATALKAN");
            }
            const k = i++;
            const data = await rd(tbl.off[k], tbl.sizes[k]);
            dec.decode(
              new EncodedVideoChunk({
                type: tbl.key[k] ? "key" : "delta",
                timestamp: k * 1000,
                data,
              }),
            );
            lastFedDts = tbl.dts[k];
          } else {
            await dec.flush().catch(() => {});
            lastFedDts = Infinity;
          }
          yield* drain();
          if (i >= tbl.n && pool.length === 0) break;
        }
      } finally {
        try {
          if (dec.state !== "closed") dec.close();
        } catch {}
      }
    },
    async close() {
      sink = null;
      try {
        if (dec.state !== "closed") dec.close();
      } catch {}
    },
  };
}

/* ---------- PROBE dari URL media ---------- */
export async function probeKilat(url: string, ukuran: number): Promise<ProbeKilat | null> {
  try {
    if (typeof window === "undefined" || !("VideoDecoder" in window)) return null;
    if (!ukuran) return null;
    const rd = pembacaRangeHttp(url);
    const info = await mp4Probe(rd, ukuran);
    if (!info) return null;
    const desc = new Uint8Array(info.avcC);
    let decCfg: VideoDecoderConfig | null = null;
    for (const acc of ["prefer-hardware", "no-preference"] as const) {
      try {
        const cfg: VideoDecoderConfig = {
          codec: info.codecStr,
          codedWidth: info.codedW,
          codedHeight: info.codedH,
          description: desc,
          hardwareAcceleration: acc,
        };
        const s = await VideoDecoder.isConfigSupported(cfg);
        if (s.supported) {
          decCfg = cfg;
          break;
        }
      } catch {}
    }
    if (!decCfg) return null;
    return { info, decCfg };
  } catch {
    return null;
  }
}
