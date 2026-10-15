"use client";

// VidSplit v0.51.0 — pratinjau interaktif zoom manual mode "blur lembut":
// bingkai 9:16 berisi latar blur (video blur-xl) + video yang DIPERBESAR
// (contain × zoom) dan bisa DISERET kiri/kanan untuk memilih posisi.
// Matematikanya IDENTIK dgn filter rantaiUtama di ffmpeg.ts:
//   skala = min(W/iw, H/ih) × z  →  w = lebar×skala, h = tinggi×skala
//   overlay x = (W-w)×pp/100  ·  y = (H-h)/2 (tegak selalu di tengah)
// → wFrac = w/W, hFrac = h/H;  kiri% = (1-wFrac)×pp ;  atas% = (1-hFrac)/2×100.
import { useEffect, useMemo, useRef, useState } from "react";
import { MoveHorizontal } from "lucide-react";
import { labelPosisiPotong, labelZoomBlur } from "@/lib/vidsplit/types";

const W_TARGET = 1080;
const H_TARGET = 1920;

export function PratinjauBlurZoom({
  srcUrl,
  lebar,
  tinggi,
  posisi,
  zoom = 100,
  onChange,
}: {
  srcUrl: string;
  /** dimensi sumber video (px) — untuk menghitung ukuran & posisi video yang akurat */
  lebar: number;
  tinggi: number;
  /** posisi geser kiri/kanan 0–100 (sama dgn slider posisiPotong) */
  posisi: number;
  /** v0.51.0 — zoom 100–300 (100 = pas layar) */
  zoom?: number;
  onChange: (n: number) => void;
}) {
  const refV = useRef<HTMLVideoElement>(null);
  const refKotak = useRef<HTMLDivElement>(null);
  const [seret, setSeret] = useState(false);

  const z = Math.min(300, Math.max(100, Number.isFinite(zoom) ? zoom : 100)) / 100;
  const pp = Math.min(100, Math.max(0, posisi));

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

  const kiriPersen = (1 - wFrac) * pp;
  const atasPersen = ((1 - hFrac) / 2) * 100;
  /** video pas lebar bingkai → geser tidak berefek (seperti 16:9 pada zoom 100%) */
  const takBisaGeser = Math.abs(1 - wFrac) < 0.002;

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

  /** posisi baru dari posisi kursor — TENGAH video mengikuti kursor, lalu
   *  dihitung balik ke pp: kiri = fx - wFrac/2 = (1-wFrac)×pp/100 */
  const dariKursor = (clientX: number) => {
    if (takBisaGeser) return;
    const el = refKotak.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (!(r.width > 0)) return;
    const fx = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    const ppBaru = ((fx - wFrac / 2) / (1 - wFrac)) * 100;
    onChange(Math.round(Math.min(100, Math.max(0, ppBaru))));
  };

  return (
    <div className="mt-1">
      <div
        ref={refKotak}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          setSeret(true);
          dariKursor(e.clientX);
        }}
        onPointerMove={(e) => {
          if (seret) dariKursor(e.clientX);
        }}
        onPointerUp={() => setSeret(false)}
        onPointerCancel={() => setSeret(false)}
        className={`relative mx-auto w-full max-w-[180px] touch-none select-none overflow-hidden rounded-xl border border-slate-700/70 bg-black ${
          takBisaGeser ? "" : seret ? "cursor-grabbing" : "cursor-grab"
        }`}
        style={{ aspectRatio: "9 / 16" }}
        title="Klik / seret untuk menggeser posisi video yang diperbesar (kiri ↔ kanan)"
      >
        {/* latar blur — meniru boxblur cover di filter ffmpeg */}
        <video
          src={srcUrl}
          className="pointer-events-none absolute inset-0 h-full w-full scale-125 object-cover opacity-70 blur-xl"
          preload="auto"
          muted
          playsInline
          aria-hidden
        />
        {/* video diperbesar — ukuran & posisi = persis rumus overlay ffmpeg */}
        <video
          ref={refV}
          src={srcUrl}
          className="pointer-events-none absolute object-contain"
          style={{
            width: `${wFrac * 100}%`,
            height: `${hFrac * 100}%`,
            left: `${kiriPersen}%`,
            top: `${atasPersen}%`,
          }}
          preload="auto"
          muted
          playsInline
        />
        <span className="absolute left-1/2 top-1 flex -translate-x-1/2 items-center gap-1 rounded-md bg-sky-400 px-1.5 py-0.5 text-[9px] font-bold text-slate-900">
          <MoveHorizontal className="h-2.5 w-2.5" /> 9:16{z > 1.005 ? ` · Z${Math.round(z * 100)}%` : ""}
        </span>
      </div>
      <p className="mx-auto mt-1.5 max-w-[280px] text-center text-[10px] text-slate-500">
        {takBisaGeser ? (
          <>
            Naikkan <span className="font-medium text-sky-300">Zoom</span> di atas untuk
            memperbesar video — lalu video bisa digeser kiri/kanan di sini.
          </>
        ) : (
          <>
            Klik / seret gambar untuk menggeser posisi video —{" "}
            <span className="font-medium text-sky-300">{labelPosisiPotong(pp)}</span> ·{" "}
            <span className="font-medium text-sky-300">{labelZoomBlur(zoom)}</span>. Sinkron
            dengan slider di atas.
          </>
        )}
      </p>
    </div>
  );
}
