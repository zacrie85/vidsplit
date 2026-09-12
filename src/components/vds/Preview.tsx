"use client";

// VidSplit — pratinjau live: video 9:16 + overlay judul & Part berganti otomatis
import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, SkipBack, SkipForward, Volume2, VolumeX } from "lucide-react";
import { formatDurasi, FONT_CSS, type Pengaturan } from "@/lib/vidsplit/types";

export function Preview({
  srcUrl,
  pengaturan,
  durasi,
  totalPart,
  lebar = 0,
  tinggi = 0,
}: {
  srcUrl: string;
  pengaturan: Pengaturan;
  durasi: number;
  totalPart: number;
  /** dimensi sumber — dipakai mode "asli" agar pratinjau ikut rasio aslinya */
  lebar?: number;
  tinggi?: number;
}) {
  const refV = useRef<HTMLVideoElement>(null);
  const [t, setT] = useState(0);
  const [jeda, setJeda] = useState(true);
  const [bisu, setBisu] = useState(false);

  // nomor part saat ini — 0–20 dtk = Part 1, 21–40 = Part 2, dst
  const partKini = useMemo(() => {
    if (totalPart <= 0) return 1;
    return Math.min(totalPart, Math.max(1, Math.floor(t / pengaturan.durasiPart) + 1));
  }, [t, totalPart, pengaturan.durasiPart]);

  // sinkronkan play/pause/bisu
  useEffect(() => {
    const v = refV.current;
    if (!v) return;
    if (jeda) v.pause();
    else v.play().catch(() => setJeda(true));
  }, [jeda]);

  useEffect(() => {
    const v = refV.current;
    if (v) v.muted = bisu;
  }, [bisu]);

  const lompat = (det: number) => {
    const v = refV.current;
    if (!v) return;
    v.currentTime = Math.min(Math.max(0, det), durasi);
    setT(v.currentTime);
  };

  const ukuranJudul = `${(pengaturan.gayaJudul.ukuran / 1080) * 100}cqw`;
  const ukuranPart = `${(pengaturan.gayaPart.ukuran / 1080) * 100}cqw`;
  const posisi = pengaturan.posisiTeks;
  // mode "asli": bingkai pratinjau mengikuti rasio sumber, bukan 9:16
  // v0.8.0 — pratinjau 3× lebih lebar (280→840) + tinggi proporsional ke bawah;
  // landscape/square ikut lebih lega
  const modeAsli = pengaturan.mode === "asli" && lebar > 0 && tinggi > 0;
  const rasioBingkai = modeAsli ? `${lebar} / ${tinggi}` : "9 / 16";
  // v0.9.0 — pratinjau tinggal di KOLOM TENGAH layout 3 kolom (50%):
  // · potret (9:16 / sumber vertikal) dibatasi TINGGI layar (76vh) agar dashboard
  //   tetap proporsional & Ekspor tak tenggelam — lebar mengikuti rasio;
  // · lanskap/persegi tetap selebar kolom (lebar-mengatur) seperti sebelumnya.
  const potret = modeAsli ? tinggi > lebar : true;
  const kelasBungkusan = potret ? "mx-auto w-fit" : "mx-auto w-full max-w-[1100px]";

  const susunTeks = (
    <div
      className={`pointer-events-none absolute inset-x-0 z-10 flex flex-col items-center gap-[1.2cqw] px-[4cqw] text-center ${
        posisi === "atas"
          ? "top-[4.5%]"
          : posisi === "tengah"
            ? "top-1/2 -translate-y-1/2"
            : "bottom-[4.5%]"
      }`}
    >
      {pengaturan.judul.trim() && (
        <p
          className="teks-stroke whitespace-pre-line font-bold leading-tight"
          style={
            {
              fontSize: ukuranJudul,
              fontFamily: FONT_CSS[pengaturan.gayaJudul.font],
              color: pengaturan.gayaJudul.warna,
              "--stroke-w": `${(pengaturan.gayaJudul.outlineLebar / 1080) * 100}cqw`,
              "--stroke-color": pengaturan.gayaJudul.outlineWarna,
            } as React.CSSProperties
          }
        >
          {pengaturan.judul}
        </p>
      )}
      {pengaturan.kataPart.trim() && (
        <p
          className="teks-stroke font-bold leading-tight"
          style={
            {
              fontSize: ukuranPart,
              fontFamily: FONT_CSS[pengaturan.gayaPart.font],
              color: pengaturan.gayaPart.warna,
              "--stroke-w": `${(pengaturan.gayaPart.outlineLebar / 1080) * 100}cqw`,
              "--stroke-color": pengaturan.gayaPart.outlineWarna,
            } as React.CSSProperties
          }
        >
          {pengaturan.kataPart} {partKini}
        </p>
      )}
    </div>
  );

  return (
    <div>
      <div className={kelasBungkusan}>
        <div
          className="relative overflow-hidden rounded-xl border border-slate-700/70 bg-black shadow-2xl shadow-black/50"
          style={
            potret
              ? { containerType: "inline-size", aspectRatio: rasioBingkai, height: "min(76vh, 1500px)" }
              : { containerType: "inline-size", aspectRatio: rasioBingkai }
          }
        >
          {pengaturan.mode === "asli" ? (
            <video
              ref={refV}
              src={srcUrl}
              className="absolute inset-0 h-full w-full object-contain"
              muted={bisu}
              onTimeUpdate={(e) => setT(e.currentTarget.currentTime)}
              onPlay={() => setJeda(false)}
              onPause={() => setJeda(true)}
              playsInline
            />
          ) : pengaturan.mode === "blur" ? (
            <>
              <video
                src={srcUrl}
                className="absolute inset-0 h-full w-full scale-125 object-cover opacity-70 blur-xl"
                aria-hidden
              />
              <video
                ref={refV}
                src={srcUrl}
                className="absolute inset-0 h-full w-full object-contain"
                muted={bisu}
                onTimeUpdate={(e) => setT(e.currentTarget.currentTime)}
                onPlay={() => setJeda(false)}
                onPause={() => setJeda(true)}
                playsInline
              />
            </>
          ) : pengaturan.mode === "crop" ? (
            <video
              ref={refV}
              src={srcUrl}
              className="absolute inset-0 h-full w-full object-cover"
              style={{ objectPosition: `${Math.min(100, Math.max(0, pengaturan.posisiPotong))}% 50%` }}
              muted={bisu}
              onTimeUpdate={(e) => setT(e.currentTarget.currentTime)}
              onPlay={() => setJeda(false)}
              onPause={() => setJeda(true)}
              playsInline
            />
          ) : (
            <>
              <div className="absolute inset-0" style={{ background: pengaturan.warnaLatar }} />
              <video
                ref={refV}
                src={srcUrl}
                className="absolute inset-0 h-full w-full object-contain"
                muted={bisu}
                onTimeUpdate={(e) => setT(e.currentTarget.currentTime)}
                onPlay={() => setJeda(false)}
                onPause={() => setJeda(true)}
                playsInline
              />
            </>
          )}
          {susunTeks}
          <span className="absolute left-2 top-2 z-10 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-slate-200">
            pratinjau — tanpa intro bg
          </span>
        </div>

        {/* kontrol */}
        <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => lompat(Math.floor(t / pengaturan.durasiPart) * pengaturan.durasiPart - 0.01)}
          className="rounded-lg border border-slate-700 p-1.5 text-slate-300 hover:border-slate-500"
          title="Part sebelumnya"
        >
          <SkipBack className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setJeda((j) => !j)}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-400 text-slate-900 hover:bg-amber-300"
        >
          {jeda ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
        </button>
        <button
          type="button"
          onClick={() => lompat((partKini) * pengaturan.durasiPart + 0.01)}
          className="rounded-lg border border-slate-700 p-1.5 text-slate-300 hover:border-slate-500"
          title="Part berikutnya"
        >
          <SkipForward className="h-4 w-4" />
        </button>
        <input
          type="range"
          min={0}
          max={Math.max(0.1, durasi)}
          step={0.1}
          value={Math.min(t, durasi)}
          onChange={(e) => lompat(Number(e.target.value))}
          className="min-w-0 flex-1"
          aria-label="Geser posisi"
        />
        <button
          type="button"
          onClick={() => setBisu((b) => !b)}
          className="rounded-lg border border-slate-700 p-1.5 text-slate-300 hover:border-slate-500"
          title={bisu ? "Bunyikan" : "Bisukan"}
        >
          {bisu ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>
      </div>
        <p className="mt-1 text-center text-[10px] text-slate-500">
          {formatDurasi(t)} / {formatDurasi(durasi)}
          {modeAsli && <span className="ml-1 text-emerald-300">· rasio asli {lebar}×{tinggi}</span>}
        </p>

        {/* peta part — klik untuk lompat */}
        <div className="mt-3 flex flex-wrap justify-center gap-1.5">
          {Array.from({ length: totalPart }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => lompat((n - 1) * pengaturan.durasiPart + 0.01)}
              className={`rounded-md border px-2 py-1 text-[10px] transition ${
                n === partKini
                  ? "border-amber-400/80 bg-amber-400/20 text-amber-200"
                  : "border-slate-700 bg-slate-800/60 text-slate-400 hover:border-slate-500"
              }`}
            >
              {pengaturan.kataPart || "Part"} {n}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
