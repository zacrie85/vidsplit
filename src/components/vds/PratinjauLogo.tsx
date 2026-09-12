"use client";

// VidSplit v0.8.0 — pratinjau interaktif watermark/logo:
//   • seret badan logo  → pindahkan ke posisi mana pun (logoX/logoY, % frame, titik kiri-atas)
//   • seret titik pojok kanan-bawah → perbesar/perkecil (tarik ke kiri/kanan/atas/bawah/diagonal)
// Matematika identik dengan filter ffmpeg:
//   overlay x = min(max(0, W*logoX/100), W-w) · y = min(max(0, H*logoY/100), H-h)
//   lebar logo = ukuranLogo% dari lebar frame.
import { useEffect, useRef, useState } from "react";
import { Move } from "lucide-react";
import type { ModeKonversi } from "@/lib/vidsplit/types";

const BATAST = 5; // ukuran min (% lebar frame) — sama dgn slider
const BATASB = 40; // ukuran maks

export function PratinjauLogo({
  srcUrl,
  logoUrl,
  lebar,
  tinggi,
  logoX,
  logoY,
  ukuran,
  mode = "blur",
  warnaLatar = "#111827",
  onPosisi,
  onUkuran,
}: {
  srcUrl: string;
  /** URL gambar logo (watermark) */
  logoUrl: string;
  /** dimensi sumber video — dipakai mode asli agar bingkai ikut rasio sumber */
  lebar: number;
  tinggi: number;
  /** posisi logo — % lebar frame, titik kiri-atas logo (0–100) */
  logoX: number;
  /** posisi logo — % tinggi frame, titik kiri-atas logo (0–100) */
  logoY: number;
  /** lebar logo — % lebar frame (5–40) */
  ukuran: number;
  /** mode konversi — bentuk bingkai pratinjau: asli = rasio sumber, lainnya = 9:16 (output) */
  mode?: ModeKonversi;
  /** warna latar mode "warna" — untuk meniru tampilan output */
  warnaLatar?: string;
  onPosisi: (x: number, y: number) => void;
  onUkuran: (n: number) => void;
}) {
  const refKotak = useRef<HTMLDivElement>(null);
  const refV = useRef<HTMLVideoElement>(null);
  const [seret, setSeret] = useState<null | "geser" | "ubah">(null);
  const grab = useRef({ dx: 0, dy: 0 });
  // rasio asli gambar logo (tinggi/lebar) — dipakai hitam clamp bawah & posisi pegangan
  const [rasioLogo, setRasioLogo] = useState(0.5);

  // v0.8.0 — bingkai pratinjau mengikuti BENTUK OUTPUT: mode asli = rasio sumber,
  // mode lain (blur/crop/warna) = 9:16 — sama seperti bingkai Preview utama.
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

  /** clamp posisi agar logo TIDAK keluar frame — mirip min/max di filter ffmpeg.
   *  tinggi logo dlm % tinggi bingkai = ukuran% · (tinggiLogo/lebarLogo) · (lebarBingkai/tinggiBingkai)
   *  PENTING: rasio yang dipakai = rasio BINGKAI (bentuk output), bukan rasio sumber —
   *  sejak v0.8.0 bingkai editor mengikuti output (9:16 utk blur/crop/warna). */
  const tampil = (() => {
    const rasioB = modeAsli && lebar > 0 && tinggi > 0 ? lebar / tinggi : 9 / 16;
    const tinggiLogoPct = ukuran * rasioLogo * rasioB;
    return {
      kiri: Math.min(Math.max(0, logoX), 100 - ukuran),
      atas: Math.min(Math.max(0, logoY), 100 - tinggiLogoPct),
      tinggiLogoPct,
    };
  })();

  const pctDari = (clientX: number, clientY: number) => {
    const el = refKotak.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (!(r.width > 0) || !(r.height > 0)) return null;
    return { x: ((clientX - r.left) / r.width) * 100, y: ((clientY - r.top) / r.height) * 100, r };
  };

  const mulaiGeser = (e: React.PointerEvent) => {
    const p = pctDari(e.clientX, e.clientY);
    if (!p) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    e.stopPropagation();
    grab.current = { dx: p.x - logoX, dy: p.y - logoY };
    setSeret("geser");
  };

  const mulaiUbah = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    e.stopPropagation();
    setSeret("ubah");
  };

  const saatGeser = (e: React.PointerEvent) => {
    if (seret !== "geser") return;
    const p = pctDari(e.clientX, e.clientY);
    if (!p) return;
    onPosisi(
      Math.round(Math.min(100, Math.max(0, p.x - grab.current.dx)) * 10) / 10,
      Math.round(Math.min(100, Math.max(0, p.y - grab.current.dy)) * 10) / 10,
    );
  };

  /** ubah ukuran: jarak pointer dari pojok KIRI-ATAS logo (dalam px bingkai) → % lebar.
   *  arah bebas — ke kanan/bawah membesar, ke kiri/atas mengecil, diagonal mengikuti. */
  const saatUbah = (e: React.PointerEvent) => {
    if (seret !== "ubah") return;
    const el = refKotak.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const ax = r.left + (tampil.kiri / 100) * r.width; // pojok kiri-atas logo (px)
    const ay = r.top + (tampil.atas / 100) * r.height;
    const jarak = Math.hypot(e.clientX - ax, e.clientY - ay);
    onUkuran(Math.round(Math.min(BATASB, Math.max(BATAST, (jarak / r.width) * 100)) * 10) / 10);
  };

  return (
    <div>
      <div
        ref={refKotak}
        onPointerMove={seret === "geser" ? saatGeser : saatUbah}
        onPointerUp={() => setSeret(null)}
        onPointerCancel={() => setSeret(null)}
        className="relative mx-auto w-full max-w-[340px] touch-none select-none overflow-hidden rounded-xl border border-slate-700/70 bg-black"
        style={{ aspectRatio: rasioBingkai }}
        title="Seret logo untuk memindah — seret titik pojoknya untuk mengubah ukuran"
      >
        {/* latar video — meniru cara render tiap mode agar posisi logo terasa nyata */}
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
        {/* logo: posisi & ukuran = persis filter ffmpeg */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoUrl}
          alt="logo"
          draggable={false}
          onLoad={(e) => {
            const im = e.currentTarget;
            if (im.naturalWidth > 0) setRasioLogo(im.naturalHeight / im.naturalWidth);
          }}
          onPointerDown={mulaiGeser}
          onPointerMove={seret === "geser" ? saatGeser : undefined}
          onPointerUp={() => setSeret(null)}
          className={`absolute cursor-move ${seret === "geser" ? "opacity-80" : ""}`}
          style={{
            left: `${tampil.kiri}%`,
            top: `${tampil.atas}%`,
            width: `${ukuran}%`,
            outline: seret ? "2px dashed rgba(251,191,36,0.9)" : "none",
            outlineOffset: "2px",
          }}
        />
        {/* pegangan ubah ukuran — pojok kanan-bawah logo */}
        <span
          onPointerDown={mulaiUbah}
          onPointerMove={saatUbah}
          onPointerUp={() => setSeret(null)}
          className={`absolute z-10 h-4 w-4 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize rounded-full border-2 border-slate-900 bg-amber-400 shadow ${
            seret === "ubah" ? "scale-125" : ""
          }`}
          style={{
            left: `${tampil.kiri + ukuran}%`,
            top: `${tampil.atas + tampil.tinggiLogoPct}%`,
          }}
          title="Seret ke segala arah untuk memperbesar / memperkecil"
        />
        <span className="pointer-events-none absolute left-1/2 top-1 flex -translate-x-1/2 items-center gap-1 rounded-md bg-slate-900/80 px-1.5 py-0.5 text-[9px] font-medium text-slate-200">
          <Move className="h-2.5 w-2.5" /> seret logo · tarik titik utk ubah ukuran
        </span>
      </div>
      <p className="mx-auto mt-1.5 max-w-[340px] text-center text-[10px] text-slate-500">
        Posisi: <span className="font-medium text-amber-300">{logoX.toFixed(0)}% , {logoY.toFixed(0)}%</span> ·
        Ukuran: <span className="font-medium text-amber-300">{ukuran.toFixed(0)}%</span> — posisi bebas,
        tidak harus di pojok
      </p>
    </div>
  );
}
