"use client";

// VidSplit — pratinjau interaktif posisi potong: tampilkan bingkai video penuh
// dengan jendela 9:16 yang bisa DISERET — matematikanya identik dengan filter
// ffmpeg (scale force_original_aspect_ratio=increase + crop x=(iw-ow)*pp/100).
import { useEffect, useMemo, useRef, useState } from "react";
import { MoveHorizontal } from "lucide-react";
import { labelPosisiPotong } from "@/lib/vidsplit/types";

const W_TARGET = 1080;
const H_TARGET = 1920;

export function PratinjauPotong({
  srcUrl,
  lebar,
  tinggi,
  posisi,
  onChange,
}: {
  srcUrl: string;
  /** dimensi sumber video (px) — untuk menghitung lebar jendela yang akurat */
  lebar: number;
  tinggi: number;
  /** posisi potong 0–100 (sama dgn slider) */
  posisi: number;
  onChange: (n: number) => void;
}) {
  const refV = useRef<HTMLVideoElement>(null);
  const refKotak = useRef<HTMLDivElement>(null);
  const [seret, setSeret] = useState(false);

  /** fraksi lebar jendela 9:16 terhadap lebar frame terskala (scale-to-fill).
   *  Video horizontal 16:9 → jendela ±31.6% lebar; video vertikal → 100%. */
  const fraksi = useMemo(() => {
    if (!(lebar > 0) || !(tinggi > 0)) return W_TARGET / ((H_TARGET * 16) / 9);
    const skala = Math.max(W_TARGET / lebar, H_TARGET / tinggi);
    const lebarTerskala = lebar * skala;
    return Math.min(1, Math.max(0.05, W_TARGET / lebarTerskala));
  }, [lebar, tinggi]);

  const kiriPersen = (1 - fraksi) * Math.min(100, Math.max(0, posisi));

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

  /** posisi potong baru dari posisi kursor — jendela mengikuti kursor (pusat) */
  const dariKursor = (clientX: number) => {
    const el = refKotak.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (!(r.width > 0)) return;
    const fx = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    const kiri = fx - fraksi / 2;
    const rentang = Math.max(0.0001, 1 - fraksi);
    onChange(Math.round(Math.min(1, Math.max(0, kiri / rentang)) * 100));
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
        className={`relative mx-auto w-full max-w-[300px] touch-none select-none overflow-hidden rounded-xl border border-slate-700/70 bg-black ${
          seret ? "cursor-grabbing" : "cursor-grab"
        }`}
        style={{ aspectRatio: lebar > 0 && tinggi > 0 ? `${lebar} / ${tinggi}` : "16 / 9" }}
        title="Klik / seret untuk memilih bagian yang dijadikan vertikal 9:16"
      >
        <video
          ref={refV}
          src={srcUrl}
          className="pointer-events-none absolute inset-0 h-full w-full object-contain"
          preload="auto"
          muted
          playsInline
        />
        {/* peredup di luar jendela + garis jendela */}
        <div
          className="pointer-events-none absolute top-0 h-full border-x-2 border-amber-400 shadow-[0_0_0_9999px_rgba(0,0,0,0.62)]"
          style={{
            left: `${kiriPersen}%`,
            width: `${fraksi * 100}%`,
          }}
        >
          <span className="absolute left-1/2 top-1 flex -translate-x-1/2 items-center gap-1 rounded-md bg-amber-400 px-1.5 py-0.5 text-[9px] font-bold text-slate-900">
            <MoveHorizontal className="h-2.5 w-2.5" /> 9:16
          </span>
        </div>
      </div>
      <p className="mx-auto mt-1.5 max-w-[300px] text-center text-[10px] text-slate-500">
        Klik / seret di gambar untuk memilih bagian yang jadi vertikal —{" "}
        <span className="font-medium text-amber-300">{labelPosisiPotong(posisi)}</span>. Sinkron
        dengan slider di atas.
      </p>
    </div>
  );
}
