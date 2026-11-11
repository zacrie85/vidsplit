/* ================================================================
   VidSplit v2.9.0 — kilat/eksporKilat.ts  (ORKESTRATOR MODE KILAT)
   ================================================================
   Port inti KINOSTRA exporter.js v3.16 (WebCodecs GPU) ke VidSplit:
   - probe dekoder (demux.ts) + probe ENCODER terukur (GPU vs CPU,
     probeEncoderFPS — encoder yang "konon didukung" tapi macet
     terdeteksi di sini, bukan saat render)
   - render paralel 2–4 part (worker + decoder + encoder + muxer
     sendiri), backpressure antrean encoder
   - audio: decodeAudioData → OfflineAudioContext per part →
     AudioEncoder AAC (48 kHz)
   - mux mp4-muxer (fastStart in-memory) → unggah part jadi ke
     /api/kilat/simpan (server menulis ke folder output job)
   - ANTI-GAGAL (port batch.js v3.15): part gagal bukan batal →
     ulang 1× dgn setelan aman (encoder software); kegagalan
     internal ≠ batal pengguna; sisa video jatuh ke jalur ffmpeg.
   - pratinjau = ekspor: komposisi canvas dgn rumus rantaiUtama.
   ================================================================ */
"use client";

import {
  dimensiOutput,
  durasiPartDipakai,
  hitungPartV2,
  rentangPart,
  rentangPartHapus,
} from "../types";
import type { Pengaturan } from "../types";
import {
  buatRenderKilat,
  pembacaRangeHttp,
  probeKilat,
  type ProbeKilat,
} from "./demux";
import { gambarKomposisi } from "./komposisi";

/* ---------- tipe ---------- */
export interface ItemKilat {
  file: string; /* path relatif work (upload/...) — server menyajikan via /api/file */
  nama: string;
  ukuran: number;
  durasi: number;
  lebar: number;
  tinggi: number;
  fps: number;
  adaAudio: boolean;
  pengaturan: Pengaturan;
}

export interface ProgresVideo {
  selesai: number;
  total: number;
  fraksi: number; /* 0..1 video aktif */
  tahap?: string;
  mesin?: string;
}

export interface OpsiKilat {
  paralel: number;
  isAborted(): boolean;
  /** progres render (satu panggilan = satu video) */
  onProgres(p: ProgresVideo): void;
}

/* ---------- gerbang KILAT (v2.9.0: 4 mode dasar tanpa elemen bakar) ----------
   null = boleh kilat; string = alasan (penelepon pakai jalur ffmpeg) */
export function gerbangKilat(p: Pengaturan, targetMb = 0): string | null {
  const T = p as Pengaturan & { targetMb?: number };
  if ((p.judul || "").trim()) return "TEKS JUDUL";
  if ((p.kataPart || "").trim()) return "TEKS PART";
  if ((p.deskripsi || "").trim()) return "DESKRIPSI";
  if (p.introAktif) return "INTRO";
  if ((p.logoId || "").trim()) return "LOGO";
  if ((p.frameId || "").trim()) return "BINGKAI";
  if (p.neonAktif) return "NEON";
  // v3.3.0 — mesin efek NOVACUT belum ada jalur WebCodecs → paksa ffmpeg
  if (p.transisiPart) return "TRANSISI";
  if (p.efekTransisi) return "TRANSISI NOVACUT";
  if (p.efekKlip && p.efekKlip.length) return "EFEK NOVACUT";
  if (Math.abs((p.kecepatanVideo || 1) - 1) > 1e-9) return "KECEPATAN";
  if (p.zoomPembicara !== "mati") return "AI PEMBICARA";
  if (p.subtitleAktif) return "SUBTITEL";
  if (p.backsoundAktif) return "BACKSOUND";
  if ((p.introSuaraFile || "").trim()) return "SUARA INTRO";
  if (p.codec !== "h264") return "KODEK H265";
  if (p.modeSplit !== "durasi") return "SPLIT ADEGAN";
  if ((targetMb || T.targetMb || 0) > 0) return "KOMPRES PINTAR";
  return null;
}

/* ---------- muat mp4-muxer vendor (sekali) ---------- */
declare global {
  interface Window {
    Mp4Muxer?: unknown;
  }
}
function ambilMuxer(): NonNullable<Window["Mp4Muxer"]> {
  const M = (window as Window).Mp4Muxer;
  if (!M) throw new Error("mp4-muxer belum termuat");
  return M;
}
function muatMuxer(): Promise<void> {
  if ((window as Window).Mp4Muxer) return Promise.resolve();
  return new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = "/kilat/mp4-muxer.min.js";
    s.onload = () => res();
    s.onerror = () => rej(new Error("mp4-muxer gagal dimuat"));
    document.head.appendChild(s);
  });
}

/* ---------- probe encoder terukur (port probeEncoderFPS) ---------- */
function h264CodecsFor(W: number, H: number, fps: number): string[] {
  const px = W * H;
  if (px <= 2073600) return ["avc1.640028", "avc1.4D0028", "avc1.42002A"];
  const lv = px > 3700000 && fps > 30 ? "34" : "33";
  return [`avc1.6400${lv}`, `avc1.4D00${lv}`, `avc1.4200${lv}`];
}
async function probeEncoderFPS(
  cfg: VideoEncoderConfig,
  W: number,
  H: number,
  frames = 24,
): Promise<{ ok: boolean; fps: number }> {
  let venc: VideoEncoder | null = null;
  try {
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const g = c.getContext("2d")!;
    g.fillStyle = "#1a2a3a";
    g.fillRect(0, 0, W, H);
    let chunks = 0;
    let err: string | null = null;
    let flushed = false;
    venc = new VideoEncoder({
      output: () => chunks++,
      error: (e) => {
        err = err || (e && e.message) || "encoder error";
      },
    });
    venc.configure({ ...cfg, latencyMode: "realtime" });
    const t0 = performance.now();
    for (let i = 0; i < frames; i++) {
      g.fillStyle = `hsl(${(i * 12) % 360} 60% ${18 + (i % 26)}%)`;
      g.fillRect(0, 0, W, H);
      g.fillStyle = "#fff";
      g.fillRect((i * 37) % Math.max(1, W - 130), (i * 53) % Math.max(1, H - 70), 120, 68);
      const vf = new VideoFrame(c, { timestamp: i * 41666, duration: 41666 });
      venc.encode(vf, { keyFrame: i === 0 });
      vf.close();
    }
    await denganTenggat(venc.flush().then(() => (flushed = true)), 10000, "probe flush macet");
    const ms = performance.now() - t0;
    const ok = flushed && chunks >= frames * 0.9 && !err;
    return { ok, fps: ok ? Math.round((frames / Math.max(1, ms)) * 1000) : 0 };
  } catch {
    return { ok: false, fps: 0 };
  } finally {
    try {
      if (venc && venc.state !== "closed") venc.close();
    } catch {}
  }
}
function denganTenggat<T>(p: Promise<T>, ms: number, msg: string): Promise<T> {
  return new Promise((res, rej) => {
    const tm = setTimeout(() => rej(new Error(msg)), ms);
    Promise.resolve(p).then(
      (v) => {
        clearTimeout(tm);
        res(v);
      },
      (e) => {
        clearTimeout(tm);
        rej(e);
      },
    );
  });
}

/* pilih cfg encoder: GPU terukur vs CPU — cache per setelan */
const cacheAcc = new Map<string, VideoEncoderConfig>();
let hwDidemosi = false;
async function pilihEncoderVideo(
  W: number,
  H: number,
  br: number,
  fps: number,
  pakaiGpu: boolean,
): Promise<VideoEncoderConfig | null> {
  const kunci = `${W}x${H}:${br}:${fps}`;
  const tercache = cacheAcc.get(kunci);
  if (tercache) return tercache;
  const uji = async (hw: boolean): Promise<{ cfg: VideoEncoderConfig; fps: number } | null> => {
    for (const c of h264CodecsFor(W, H, fps)) {
      try {
        const cfg: VideoEncoderConfig = {
          codec: c,
          width: W,
          height: H,
          bitrate: br,
          framerate: fps,
          ...(hw ? { hardwareAcceleration: "prefer-hardware" } : { hardwareAcceleration: "prefer-software" }),
        };
        const s = await VideoEncoder.isConfigSupported(cfg);
        if (!s.supported) continue;
        const r = await probeEncoderFPS(cfg, W, H);
        if (r.ok && r.fps > 0) return { cfg, fps: r.fps };
      } catch {}
    }
    return null;
  };
  const hw = hwDidemosi || !pakaiGpu ? null : await uji(true);
  const sw = await uji(false);
  let hasil: VideoEncoderConfig | null = null;
  if (hw && (!sw || hw.fps >= sw.fps * 1.15)) hasil = hw.cfg;
  else if (sw) hasil = sw.cfg;
  else if (hw) hasil = hw.cfg;
  if (!hw && pakaiGpu && !sw) hwDidemosi = true; /* GPU macet terus — demoisi sesi ini */
  if (hasil) cacheAcc.set(kunci, hasil);
  return hasil;
}

/* ---------- audio: decode seluruh sumber → AAC per part ---------- */
async function dekodeAudio(url: string): Promise<AudioBuffer | null> {
  try {
    /* OfflineAudioContext @48 kHz → decodeAudioData menghasilkan buffer 48k */
    const oc = new OfflineAudioContext(1, 1, 48000);
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) return null;
    const buf = await r.arrayBuffer();
    return await oc.decodeAudioData(buf);
  } catch {
    return null;
  }
}

/* ---------- unggah part ke server ---------- */
async function unggahPart(
  idKilat: string,
  nama: string,
  buffer: ArrayBuffer,
  meta: Record<string, unknown>,
): Promise<{ ok: boolean; file?: string; error?: string }> {
  const fd = new FormData();
  fd.append("berkas", new Blob([buffer], { type: "video/mp4" }), nama);
  fd.append("meta", JSON.stringify({ idKilat, nama, ...meta }));
  const r = await fetch("/api/kilat/simpan", { method: "POST", body: fd });
  return (await r.json()) as { ok: boolean; file?: string; error?: string };
}

/* ---------- bitrate keluaran (paritas bangunArgumenPart) ---------- */
function bitrateKilat(W: number, H: number, p: Pengaturan): number {
  /* rantaiUtama memakai crf; kilat memakai bitrate setara kualitas tinggi */
  const px = W * H;
  const dasar = px >= 2073600 ? 8e6 : px >= 921600 ? 5e6 : 2.5e6;
  const k = p.resolusi === "720" ? 0.55 : 1;
  return Math.round(dasar * k);
}

/* ================================================================
   RENDER SATU PART (worker) — decode GPU → komposisi → encode → mux
   ================================================================ */
interface TugasPart {
  mulai: number;
  akhir: number;
  n: number;
}
async function renderPartKilat(
  probe: ProbeKilat,
  url: string,
  tugas: TugasPart,
  W: number,
  H: number,
  fps: number,
  p: Pengaturan,
  audioBuffer: AudioBuffer | null,
  cfgEnc: VideoEncoderConfig,
  pakaiHw: boolean,
  isAborted: () => boolean,
  onFraksi: (f: number) => void,
): Promise<ArrayBuffer> {
  const dur = tugas.akhir - tugas.mulai;
  const M = ambilMuxer() as {
    Muxer: new (o: unknown) => {
      addVideoChunk(c: EncodedVideoChunk, m?: EncodedVideoChunkMetadata): void;
      addAudioChunk(c: EncodedAudioChunk, m?: EncodedAudioChunkMetadata): void;
      finalize(): void;
      target: { buffer: ArrayBuffer };
    };
    ArrayBufferTarget: new () => unknown;
  };
  const adaAudio = !!audioBuffer && audioBuffer.duration > 0.01 && tugas.mulai < audioBuffer.duration - 0.01;
  const muxer = new M.Muxer({
    target: new M.ArrayBufferTarget(),
    video: { codec: "avc", width: W, height: H, frameRate: fps },
    ...(adaAudio
      ? { audio: { codec: "aac", sampleRate: 48000, numberOfChannels: 2 } }
      : {}),
    fastStart: "in-memory",
    firstTimestampBehavior: "offset",
  });

  /* --- video: decoder per worker (GPU), komposisi canvas, encode --- */
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const cx = cv.getContext("2d", { alpha: false })!;
  let encErr: string | null = null;
  const venc = new VideoEncoder({
    output: (c, m) => muxer.addVideoChunk(c, m),
    error: (e) => {
      encErr = encErr || (e && e.message) || "encoder error";
    },
  });
  venc.configure({ ...cfgEnc, latencyMode: "realtime" });
  const rd = pembacaRangeHttp(url);
  const rk = await buatRenderKilat(probe, rd, isAborted);
  let nFrame = 0;
  const durUsec = Math.round(1e6 / fps);
  try {
    for await (const { pts, frame } of rk.range(tugas.mulai, tugas.akhir)) {
      if (isAborted()) throw new Error("DIBATALKAN");
      if (encErr) throw new Error("encoder: " + encErr);
      gambarKomposisi(cx, frame, W, H, p);
      try {
        frame.close();
      } catch {}
      const vf = new VideoFrame(cv, {
        timestamp: Math.max(0, Math.round((pts - tugas.mulai) * 1e6)),
        duration: durUsec,
      });
      venc.encode(vf, { keyFrame: nFrame === 0 });
      vf.close();
      nFrame++;
      if (nFrame % 6 === 0) {
        /* backpressure: tahan bila antrean encoder penuh */
        while (venc.encodeQueueSize > 8) {
          await new Promise((r) => setTimeout(r, 2));
          if (isAborted()) throw new Error("DIBATALKAN");
          if (encErr) throw new Error("encoder: " + encErr);
        }
        const t = (pts - tugas.mulai) / Math.max(0.05, dur);
        onFraksi(Math.min(1, t * 0.92)); /* 92% video, 8% audio+finalize */
      }
    }
    await denganTenggat(venc.flush(), 30000, "flush encoder video macet");
    /* --- audio: OfflineAudioContext potongan → AudioEncoder AAC --- */
    if (adaAudio && audioBuffer) {
      const sr = 48000;
      const len = Math.max(1, Math.ceil(dur * sr));
      const oc = new OfflineAudioContext(2, len, sr);
      const src = oc.createBufferSource();
      src.buffer = audioBuffer;
      src.connect(oc.destination);
      const dari = Math.min(tugas.mulai, Math.max(0, audioBuffer.duration - 0.01));
      src.start(0, dari, Math.max(0.01, Math.min(dur, audioBuffer.duration - dari)));
      const mix = await denganTenggat(oc.startRendering(), 30000, "render audio macet");
      const aenc = new AudioEncoder({
        output: (c, m) => muxer.addAudioChunk(c, m),
        error: (e) => console.warn("aenc", e),
      });
      aenc.configure({ codec: "mp4a.40.2", sampleRate: sr, numberOfChannels: 2, bitrate: 160000 });
      const L = mix.getChannelData(0);
      const R = mix.numberOfChannels > 1 ? mix.getChannelData(1) : L;
      const fbuf = new Float32Array(sr * 2);
      for (let off = 0; off < mix.length; off += sr) {
        if (isAborted()) throw new Error("DIBATALKAN");
        const n = Math.min(sr, mix.length - off);
        fbuf.set(L.subarray(off, off + n), 0);
        fbuf.set(R.subarray(off, off + n), n);
        const ad = new AudioData({
          format: "f32-planar",
          sampleRate: sr,
          numberOfFrames: n,
          numberOfChannels: 2,
          timestamp: Math.round((off / sr) * 1e6),
          data: fbuf,
        });
        aenc.encode(ad);
        ad.close();
        while (aenc.encodeQueueSize > 10) await new Promise((r) => setTimeout(r, 2));
      }
      await denganTenggat(aenc.flush(), 15000, "flush encoder audio macet");
      try {
        aenc.close();
      } catch {}
    }
    onFraksi(1);
    muxer.finalize();
    return muxer.target.buffer;
  } finally {
    try {
      if (venc.state !== "closed") venc.close();
    } catch {}
    await rk.close();
  }
}

/* ================================================================
   EKSPOR KILAT — satu video penuh (semua part) → folder output job
   ================================================================ */
export interface HasilKilatVideo {
  file: string; /* rel path output/<idKilat>/... di server */
  nama: string;
  ukuran: number;
}
export async function eksporVideoKilat(
  it: ItemKilat,
  idKilat: string,
  ops: OpsiKilat,
): Promise<HasilKilatVideo[]> {
  await muatMuxer();
  const p = it.pengaturan;
  const url = `/api/file?p=${encodeURIComponent(it.file)}`;
  /* 1) probe dekoder GPU */
  const probe = await probeKilat(url, it.ukuran || 0);
  if (!probe) throw new Error("sumber tidak layak mode kilat (bukan MP4 H.264 / dekoder tak siap)");
  /* 2) dimensi + rentang part — fungsi ekspor YANG SAMA dgn server */
  const { W, H } = dimensiOutput(p.mode, p.resolusi, p.resolusiOutput, it.lebar, it.tinggi);
  const fps = Math.min(60, Math.max(15, Math.round(it.fps || 30)));
  const durEff = hitungPartV2(it.durasi, p, p.mulaiDetik, p.akhirDetik, p.zonaHapus || []);
  const durPart = durasiPartDipakai(p, it.durasi, p.mulaiDetik, p.akhirDetik, p.zonaHapus || []);
  const nPart = Math.max(1, durEff);
  const tugasList: TugasPart[] = [];
  for (let n = 1; n <= nPart; n++) {
    const [m, d] =
      p.zonaHapus && p.zonaHapus.length
        ? rentangPartHapus(n, it.durasi, durPart, p.mulaiDetik, p.akhirDetik, p.zonaHapus)
        : rentangPart(n, it.durasi, durPart, p.mulaiDetik, p.akhirDetik);
    tugasList.push({ mulai: m, akhir: m + d, n });
  }
  /* 3) audio sumber (sekali) */
  ops.onProgres({ selesai: 0, total: nPart, fraksi: 0, tahap: "Menyiapkan audio…", mesin: "KILAT GPU" });
  const audioBuffer = it.adaAudio ? await dekodeAudio(url) : null;
  /* 4) pilih encoder terukur */
  const br = bitrateKilat(W, H, p);
  const cfgEnc = await pilihEncoderVideo(W, H, br, fps, p.pakaiGpu !== false);
  if (!cfgEnc) throw new Error("tidak ada encoder H.264 yang siap (GPU/CPU)");
  const pakaiHw = /prefer-hardware/.test(String((cfgEnc as VideoEncoderConfig).hardwareAcceleration || ""));
  /* 5) render paralel 2–4 part + ANTI-GAGAL (ulang aman 1×) */
  const hasil: HasilKilatVideo[] = [];
  const fraksiPart = new Map<number, number>();
  const segarkan = () => {
    let f = 0;
    for (const v of fraksiPart.values()) f += v;
    ops.onProgres({
      selesai: hasil.length,
      total: nPart,
      fraksi: Math.min(0.999, f / nPart),
      mesin: "KILAT GPU",
    });
  };
  const diulang = new Set<number>();
  let gagalFatal: Error | null = null;
  const berikut = { n: 0 };
  const pekerja = Array.from({ length: Math.max(1, Math.min(ops.paralel || 2, nPart)) }, async () => {
    while (true) {
      if (ops.isAborted()) return;
      if (gagalFatal) return;
      const idx = berikut.n;
      berikut.n += 1;
      if (idx >= tugasList.length) return;
      const tugas = tugasList[idx];
      fraksiPart.set(tugas.n, 0);
      segarkan();
      try {
        let buf: ArrayBuffer;
        try {
          buf = await renderPartKilat(
            probe, url, tugas, W, H, fps, p, audioBuffer, cfgEnc, pakaiHw,
            ops.isAborted,
            (f) => {
              fraksiPart.set(tugas.n, f);
              segarkan();
            },
          );
        } catch (ePertama) {
          if (ops.isAborted() || /DIBATALKAN/i.test(String((ePertama as Error)?.message))) throw ePertama;
          /* ANTI-GAGAL: ulang SEKALI dgn setelan aman (encoder software) */
          if (diulang.has(tugas.n)) throw ePertama;
          diulang.add(tugas.n);
          const cfgAman = (await pilihEncoderVideo(W, H, br, fps, false)) || cfgEnc;
          buf = await renderPartKilat(
            probe, url, tugas, W, H, fps, p, audioBuffer, cfgAman, false,
            ops.isAborted,
            (f) => {
              fraksiPart.set(tugas.n, f);
              segarkan();
            },
          );
        }
        /* 6) unggah part jadi */
        const nama = `part-${String(tugas.n).padStart(2, "0")}.mp4`;
        const up = await unggahPart(idKilat, nama, buf, {
          sumber: it.file,
          judul: p.judul || "",
        });
        if (!up.ok || !up.file) throw new Error(up.error || "unggah part gagal");
        hasil.push({ file: up.file, nama, ukuran: buf.byteLength });
        fraksiPart.delete(tugas.n);
        segarkan();
      } catch (e) {
        const m = String((e as Error)?.message || e);
        if (ops.isAborted() || /DIBATALKAN/i.test(m)) {
          gagalFatal = new Error("DIBATALKAN");
          return;
        }
        if (!gagalFatal) gagalFatal = e instanceof Error ? e : new Error(m);
        return;
      }
    }
  });
  await Promise.all(pekerja);
  if (ops.isAborted()) throw new Error("DIBATALKAN");
  if (gagalFatal) throw gagalFatal;
  if (!hasil.length) throw new Error("tidak ada part yang selesai");
  return hasil.sort((a, b) => a.nama.localeCompare(b.nama));
}
