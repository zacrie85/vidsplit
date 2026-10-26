"use client";

// VidSplit v0.51.0 — pratinjau interaktif zoom manual mode "blur lembut".
// VidSplit v2.7.0 — UPGRADE BESAR (permintaan user):
//   1. GESER BEBAS 2-ARAH (geserX/geserY −100..100) — pad panah di BagianAtur,
//      pratinjau ini ikut mengikuti & bisa diseret ke mana saja (X dan Y).
//      Rumus = PERSIS filter rantaiUtama v2.7.0:
//        kiri% = (100−wPct)/2 × (1 + gx/100) · atas% = (100−hPct)/2 × (1 + gy/100)
//   2. LATAR BLUR KANVAS (LatarBlurVideo) — dulu elemen <video> + CSS blur-xl
//      kadang gagal dirender GPU (Electron/Windows) → tampil HITAM POLOS
//      ("bagian atas bawah nya hanya berwarna hitam, tidak ada blur lembutnya").
//      Kini frame video digambar ke kanvas kecil dgn ctx.filter blur → selalu
//      ada isi (gambar dari frame asli), murah, dan tidak bergantung CSS blur.
import { useEffect, useMemo, useRef } from "react";
import { Move } from "lucide-react";

/* ============ LATAR BLUR DARI FRAME VIDEO (kanvas, anti-hitam) ============
 * sumberRef  : video LAIN yang sudah ada (mis. video pemutar pratinjau utama) —
 *              frame live-nya digambar ke kanvas; ATAU
 * src        : URL video sendiri (elemen tersembunyi, seek 1 dtk, statis) —
 *              dipakai widget kecil PratinjauBlurZoom.
 * Kanvas 90×160 dgn blur 4px lalu di-scale CSS → efektif blur besar, murah. */
export function LatarBlurVideo({
  src,
  sumberRef,
  className = "absolute inset-0 h-full w-full",
}: {
  src?: string;
  sumberRef?: React.RefObject<HTMLVideoElement | null>;
  className?: string;
}) {
  const refC = useRef<HTMLCanvasElement>(null);
  const refSendiri = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const c = refC.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    c.width = 90;
    c.height = 160;
    let hidup = true;
    const gambar = () => {
      if (!hidup) return;
      const v = sumberRef ? sumberRef.current : refSendiri.current;
      if (!v || v.readyState < 2 || !v.videoWidth) return;
      try {
        // cover: isi penuh kanvas (persis scale=increase+crop ffmpeg)
        const skala = Math.max(c.width / v.videoWidth, c.height / v.videoHeight);
        const w = v.videoWidth * skala;
        const h = v.videoHeight * skala;
        ctx.filter = "blur(4px) saturate(1.15) brightness(0.96)";
        ctx.drawImage(v, (c.width - w) / 2, (c.height - h) / 2, w, h);
        ctx.filter = "none";
      } catch {
        /* frame belum siap — coba lagi di detak berikutnya */
      }
    };
    // 10 fps cukup utk latar blur (murah); detak pertama segera
    const detak = setInterval(gambar, 100);
    gambar();
    return () => {
      hidup = false;
      clearInterval(detak);
    };
  }, [src, sumberRef]);

  // video sendiri (mode src): sekali seek ke ±1 dtk agar kanvas punya frame
  useEffect(() => {
    if (!src) return;
    const v = refSendiri.current;
    if (!v) return;
    const ke = () => {
      try {
        v.currentTime = Math.min(1, (v.duration || 2) * 0.1);
      } catch {
        /* abaikan */
      }
    };
    v.addEventListener("loadedmetadata", ke);
    return () => v.removeEventListener("loadedmetadata", ke);
  }, [src]);

  return (
    <>
      {!sumberRef && (
        <video ref={refSendiri} src={src} className="hidden" muted playsInline preload="auto" aria-hidden />
      )}
      <canvas ref={refC} className={`${className} object-cover opacity-70`} aria-hidden />
    </>
  );
}

const W_TARGET = 1080;
const H_TARGET = 1920;

export function PratinjauBlurZoom({
  srcUrl,
  lebar,
  tinggi,
  geserX = 0,
  geserY = 0,
  zoom = 100,
  onChange,
}: {
  srcUrl: string;
  /** dimensi sumber video (px) — untuk menghitung ukuran & posisi video yang akurat */
  lebar: number;
  tinggi: number;
  /** v2.7.0 — geser bebas −100..100 (0 = tengah; sama dgn geserBlurX/Y) */
  geserX?: number;
  geserY?: number;
  /** zoom 100–300 (100 = pas layar; auto-naik 125 saat pad ← / → ditekan) */
  zoom?: number;
  /** laporan geser baru dari seretan kursor (x & y, −100..100) */
  onChange: (x: number, y: number) => void;
}) {
  const refV = useRef<HTMLVideoElement>(null);
  const refKotak = useRef<HTMLDivElement>(null);

  const z = Math.min(300, Math.max(100, Number.isFinite(zoom) ? zoom : 100)) / 100;
  const gx = Math.min(100, Math.max(-100, Number.isFinite(geserX) ? geserX : 0)) / 100;
  const gy = Math.min(100, Math.max(-100, Number.isFinite(geserY) ? geserY : 0)) / 100;

  /** fraksi ukuran video terhadap bingkai 9:16 (identik dgn filter: contain × z) */
  const { wFrac, hFrac } = useMemo(() => {
    if (!(lebar > 0) || !(tinggi > 0)) {
      // dimensi belum diketahui — anggap 16:9 landscape
      const skala = Math.min(W_TARGET / 1920, H_TARGET / 1080) * z;
      return { wFrac: (1920 * skala) / W_TARGET, hFrac: (1080 * skala) / H_TARGET };
    }
    const skala = Math.min(W_TARGET / lebar, H_TARGET / tinggi) * z;
    return { wFrac: (lebar * skala) / W_TARGET, hFrac: (tinggi * skala) / H_TARGET };
  }, [lebar, tinggi, z]);

  // v2.7.0 — rumus geser bebas = PERSIS filter ffmpeg:
  //   x = (W−w)/2 × (1+gx) · y = (H−h)/2 × (1+gy) → persen kiri/atas
  const kiriPersen = ((1 - wFrac) / 2) * (1 + gx) * 100;
  const atasPersen = ((1 - hFrac) / 2) * (1 + gy) * 100;
  /** video pas lebar bingkai → geser horizontal tidak berefek (16:9 pada zoom 100%) */
  const takBisaGeserX = Math.abs(1 - wFrac) < 0.002;

  // pindah ke frame awal yang terlihat (t=1 dtk) agar tidak menampilkan frame hitam
  useEffect(() => {
    const v = refV.current;
    if (!v) return;
    const ke = () => {
      try {
        v.currentTime = Math.min(1, (v.duration || 2) * 0.1);
      } catch {
        /* abaikan */
      }
    };
    v.addEventListener("loadedmetadata", ke);
    return () => v.removeEventListener("loadedmetadata", ke);
  }, [srcUrl]);

  /** posisi baru dari kursor — TENGAH video mengikuti kursor (2 arah):
   *  kiri% = (1−wFrac)/2×(1+gx)×100 → gx = 2×fx/(1−wFrac) − 1 (clamp −1..1) */
  const dariKursor = (clientX: number, clientY: number) => {
    const el = refKotak.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (!(r.width > 0) || !(r.height > 0)) return;
    const fx = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    const fy = Math.min(1, Math.max(0, (clientY - r.top) / r.height));
    const gxBaru = takBisaGeserX ? 0 : Math.min(1, Math.max(-1, (2 * fx) / (1 - wFrac) - 1));
    const gyBaru = Math.min(1, Math.max(-1, (2 * fy) / (1 - hFrac) - 1));
    onChange(Math.round(gxBaru * 100), Math.round(gyBaru * 100));
  };

  return (
    <div className="mt-3">
      <div
        ref={refKotak}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          dariKursor(e.clientX, e.clientY);
        }}
        className="relative mx-auto w-full max-w-[180px] cursor-grab touch-none select-none overflow-hidden rounded-xl border border-slate-700/70 bg-black active:cursor-grabbing"
        style={{ aspectRatio: "9 / 16" }}
        title="Klik / seret untuk menggeser posisi video (bebas: atas, bawah, kiri, kanan)"
      >
        {/* v2.7.0 — latar blur KANVAS (frame asli diburamkan) — tidak lagi
            bergantung CSS blur pada <video> yang bisa gagal render (hitam) */}
        <LatarBlurVideo src={srcUrl} />
        {/* video diperbesar — ukuran & posisi = persis rumus overlay ffmpeg v2.7.0 */}
        <video
          ref={refV}
          src={srcUrl}
          className="pointer-events-none absolute object-contain"
          style={{
            width: `${wFrac * 100}%`,
            height: `${hFrac * 100}%`,
            left: `${kiriPersen}%`,
            top: `${atasPersen}%`,
            // WAJIB: Tailwind Preflight `video { max-width:100% }` meng-clamp
            // zoom >100% (bug v0.51.0) — none = ukuran zoom bebas.
            maxWidth: "none",
          }}
          preload="auto"
          muted
          playsInline
        />
        <span className="absolute left-1/2 top-1 flex -translate-x-1/2 items-center gap-1 rounded-md bg-sky-400 px-1.5 py-0.5 text-[9px] font-bold text-slate-900">
          <Move className="h-2.5 w-2.5" /> 9:16{z > 1.005 ? ` · Z${Math.round(z * 100)}%` : ""}
        </span>
      </div>
      <p className="mx-auto mt-1.5 max-w-[280px] text-center text-[10px] text-slate-500">
        Klik / seret kotak untuk menggeser video bebas — posisi{" "}
        <span className="font-medium text-sky-300">
          X {Math.round(gx * 100)}% · Y {Math.round(gy * 100)}%
        </span>
        {takBisaGeserX ? " (geser kiri/kanan butuh zoom >100% — tekan panah ← / →)" : ""}. Sinkron
        dengan tombol panah di atas.
      </p>
    </div>
  );
}
