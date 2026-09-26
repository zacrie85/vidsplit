"use client";

// VidSplit v0.39.0 — pratinjau interaktif TULIS DESKRIPSI:
//   • seret badan teks → pindahkan ke posisi mana pun (deskripsiX/deskripsiY, % frame)
// Matematika identik dengan filter drawtext ffmpeg (ekspresiPosisiDeskripsi):
//   x = min(max(0, W*X/100 - text_w/2), W-text_w)   ← X = TENGAH blok teks
//   y = min(max(0, H*Y/100), H-text_h)              ← Y = ATAS blok teks
import { useEffect, useRef, useState } from "react";
import { Move } from "lucide-react";
import { FONT_CSS, type ModeKonversi, type Pengaturan } from "@/lib/vidsplit/types";

export function PratinjauDeskripsi({
  srcUrl,
  lebar,
  tinggi,
  deskripsi,
  gayaDeskripsi,
  deskripsiX,
  deskripsiY,
  mode = "blur",
  warnaLatar = "#111827",
  onPosisi,
}: {
  srcUrl: string;
  /** dimensi sumber video — dipakai mode asli agar bingkai ikut rasio sumber */
  lebar: number;
  tinggi: number;
  /** isi teks deskripsi (boleh multi-baris) */
  deskripsi: string;
  gayaDeskripsi: Pengaturan["gayaDeskripsi"];
  /** posisi — % lebar frame, titik TENGAH teks (0–100) */
  deskripsiX: number;
  /** posisi — % tinggi frame, titik ATAS teks (0–100) */
  deskripsiY: number;
  /** mode konversi — bentuk bingkai pratinjau: asli = rasio sumber, lainnya = 9:16 */
  mode?: ModeKonversi;
  /** warna latar mode "warna" — untuk meniru tampilan output */
  warnaLatar?: string;
  onPosisi: (x: number, y: number) => void;
}) {
  const refKotak = useRef<HTMLDivElement>(null);
  const refV = useRef<HTMLVideoElement>(null);
  const [seret, setSeret] = useState(false);
  const grab = useRef({ dx: 0, dy: 0 });

  // bingkai pratinjau mengikuti BENTUK OUTPUT: mode asli = rasio sumber, lainnya 9:16
  const modeAsli = mode === "asli" && lebar > 0 && tinggi > 0;
  const rasioBingkai = modeAsli ? `${lebar} / ${tinggi}` : "9 / 16";

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

  const pctDari = (clientX: number, clientY: number) => {
    const el = refKotak.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (!(r.width > 0) || !(r.height > 0)) return null;
    return { x: ((clientX - r.left) / r.width) * 100, y: ((clientY - r.top) / r.height) * 100 };
  };

  const mulaiGeser = (e: React.PointerEvent) => {
    const p = pctDari(e.clientX, e.clientY);
    if (!p) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    e.stopPropagation();
    grab.current = { dx: p.x - deskripsiX, dy: p.y - deskripsiY };
    setSeret(true);
  };

  const saatGeser = (e: React.PointerEvent) => {
    if (!seret) return;
    const p = pctDari(e.clientX, e.clientY);
    if (!p) return;
    onPosisi(
      Math.round(Math.min(100, Math.max(0, p.x - grab.current.dx)) * 10) / 10,
      Math.round(Math.min(100, Math.max(0, p.y - grab.current.dy)) * 10) / 10,
    );
  };

  // ukuran font pratinjau — cqw dari lebar bingkai, rumus sama dgn Preview utama:
  // render final = ukuran × min(W,H)/1080 px → dibagi lebar frame W = ukuran/1080
  const ukuranFont = `${(gayaDeskripsi.ukuran / 1080) * 100}cqw`;
  const adaTeks = !!deskripsi.trim();

  return (
    <div>
      <div
        ref={refKotak}
        onPointerMove={seret ? saatGeser : undefined}
        onPointerUp={() => setSeret(false)}
        onPointerCancel={() => setSeret(false)}
        className="relative mx-auto w-full max-w-[340px] touch-none select-none overflow-hidden rounded-xl border border-slate-700/70 bg-black"
        style={{ containerType: "inline-size", aspectRatio: rasioBingkai }}
        title="Seret teks deskripsi untuk memindah ke posisi mana pun"
      >
        {/* latar video — meniru cara render tiap mode agar posisi terasa nyata */}
        {mode === "blur" ? (
          <>
            <video
              src={srcUrl}
              className="pointer-events-none absolute inset-0 h-full w-full scale-125 object-cover opacity-70 blur-xl"
              aria-hidden
            />
            <video
              ref={refV}
              src={srcUrl}
              className="pointer-events-none absolute inset-0 h-full w-full object-contain"
              preload="auto"
              muted
              playsInline
            />
          </>
        ) : mode === "crop" ? (
          <video
            ref={refV}
            src={srcUrl}
            className="pointer-events-none absolute inset-0 h-full w-full object-cover"
            preload="auto"
            muted
            playsInline
          />
        ) : mode === "warna" ? (
          <>
            <div className="absolute inset-0" style={{ background: warnaLatar }} />
            <video
              ref={refV}
              src={srcUrl}
              className="pointer-events-none absolute inset-0 h-full w-full object-contain"
              preload="auto"
              muted
              playsInline
            />
          </>
        ) : (
          <video
            ref={refV}
            src={srcUrl}
            className="pointer-events-none absolute inset-0 h-full w-full object-contain"
            preload="auto"
            muted
            playsInline
          />
        )}
        {/* teks deskripsi: posisi & ukuran = persis filter drawtext ffmpeg.
            Titik jangkar: kiri-atas ELEMEN = (deskripsiX, deskripsiY) lalu digeser
            setengah-lebar ke kiri (translate -50%) = persis x=W*X/100-text_w/2. */}
        {adaTeks && (
          <p
            onPointerDown={mulaiGeser}
            onPointerMove={seret ? saatGeser : undefined}
            onPointerUp={() => setSeret(false)}
            className={`teks-stroke absolute cursor-move whitespace-pre leading-snug ${seret ? "opacity-80" : ""}`}
            style={
              {
                left: `${Math.min(100, Math.max(0, deskripsiX))}%`,
                top: `${Math.min(100, Math.max(0, deskripsiY))}%`,
                transform: "translate(-50%, 0)",
                fontSize: ukuranFont,
                fontFamily: FONT_CSS[gayaDeskripsi.font],
                color: gayaDeskripsi.warna,
                "--stroke-w": `${(gayaDeskripsi.outlineLebar / 1080) * 100}cqw`,
                "--stroke-color": gayaDeskripsi.outlineWarna,
              } as React.CSSProperties
            }
          >
            {deskripsi}
          </p>
        )}
        <span className="pointer-events-none absolute left-1/2 top-1 flex -translate-x-1/2 items-center gap-1 rounded-md bg-slate-900/80 px-1.5 py-0.5 text-[9px] font-medium text-slate-200">
          <Move className="h-2.5 w-2.5" /> seret teks ke posisi mana pun
        </span>
        {!adaTeks && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center px-6 text-center text-xs text-slate-500">
            Tulis deskripsinya dulu — teks akan tampil di sini dan bisa diseret
          </span>
        )}
      </div>
      <p className="mx-auto mt-1.5 max-w-[340px] text-center text-[10px] text-slate-500">
        Posisi: <span className="font-medium text-amber-300">{deskripsiX.toFixed(0)}% , {deskripsiY.toFixed(0)}%</span> —
        bebas di mana pun, teks selalu dijaga tetap di dalam frame
      </p>
    </div>
  );
}
