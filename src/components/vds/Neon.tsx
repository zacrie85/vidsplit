"use client";

// VidSplit v0.46.0 — lapisan pratinjau FRAME NEON BERPUTAR
// Menggambar ulang SVG komet ±30fps via requestAnimationFrame memakai fungsi
// svgFrameNeon() yang SAMA dgn render ekspor → pratinjau = hasil akhir.
import { useEffect, useRef, useState } from "react";
import {
  DETIK_LINGKARAN_DASAR,
  svgFrameNeon,
  type SetelanNeon,
} from "@/lib/vidsplit/neonLayar";

export function LapisanNeon({
  setelan,
  W,
  H,
  gayaPosisi,
}: {
  setelan: SetelanNeon;
  /** ukuran viewBox SVG — kanvas penuh (1080×1920) atau kotak video (template) */
  W: number;
  H: number;
  /** CSS penempatan lapisan (inset-0 utk kanvas penuh, % utk kotak template) */
  gayaPosisi: React.CSSProperties;
}) {
  const [svg, setSvg] = useState("");
  const mulai = useRef<number>(0);
  const renderTerakhir = useRef<number>(0);

  useEffect(() => {
    if (!setelan.aktif) return;
    mulai.current = performance.now();
    let hidup = true;
    let id = 0;
    const lapMs = (DETIK_LINGKARAN_DASAR / Math.max(0.2, setelan.kecepatan)) * 1000;
    const tik = (kini: number) => {
      if (!hidup) return;
      // batasi ±30fps — cukup halus utk komet, hemat CPU
      if (kini - renderTerakhir.current >= 33) {
        renderTerakhir.current = kini;
        const progres = (((kini - mulai.current) % lapMs) + lapMs) % lapMs / lapMs;
        setSvg(svgFrameNeon({ W, H, setelan, progres }));
      }
      id = requestAnimationFrame(tik);
    };
    id = requestAnimationFrame(tik);
    return () => {
      hidup = false;
      cancelAnimationFrame(id);
    };
  }, [setelan, W, H]);

  if (!setelan.aktif) return null;
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute"
      style={gayaPosisi}
      // SVG generator internal — bukan input user
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
