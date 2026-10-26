"use client";

// VidSplit — pratinjau live: video 9:16 + overlay judul & Part berganti otomatis
import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, SkipBack, SkipForward, Volume2, VolumeX } from "lucide-react";
import { formatDurasi, FONT_CSS, neonDari, posisiTeksBlok, urlBingkaiWarna, type Pengaturan } from "@/lib/vidsplit/types";
import { bungkusTeksRender } from "@/lib/vidsplit/bungkus";
import { TATA_TEMPLATE, kotakKePx } from "@/lib/vidsplit/templatLayar";
import { LapisanNeon } from "@/components/vds/Neon";

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

  // v0.58.0 — ganti video / mode: kembalikan posisi ke 0 & putar ulang.
  // Dulu: slider & hitungan Part masih menunjuk posisi video LAMA, dan karena
  // tiap mode merender elemen <video> di cabang JSX berbeda, elemen baru TIDAK
  // pernah diperintah play (effect [jeda] tak jalan krn nilainya tak berubah)
  // → video beku tapi ikon menampilkan "Pause".
  useEffect(() => {
    setT(0);
    const id = setTimeout(() => {
      refV.current?.play().catch(() => {
        /* autoplay ditolak browser — user tekan play manual */
      });
    }, 0);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [srcUrl, pengaturan.mode]);

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
  const ukuranDeskripsi = `${(pengaturan.gayaDeskripsi.ukuran / 1080) * 100}cqw`;
  // v0.46.0 — mode template + setelan neon & frame
  const modeTemplate = pengaturan.mode === "template";
  const neon = neonDari(pengaturan);
  // mode "asli": bingkai pratinjau mengikuti rasio sumber, bukan 9:16
  // v0.8.0 — pratinjau 3× lebih lebar (280→840) + tinggi proporsional ke bawah;
  // landscape/square ikut lebih lega
  const modeAsli = !modeTemplate && pengaturan.mode === "asli" && lebar > 0 && tinggi > 0;
  const rasioBingkai = modeAsli ? `${lebar} / ${tinggi}` : "9 / 16";
  // v0.51.0 — zoom manual blur: ukuran & posisi video di pratinjau live = persis
  // rumus overlay rantaiUtama: skala contain × z → width/height/left/top persen.
  const blurZoom = useMemo(() => {
    if (modeTemplate || pengaturan.mode !== "blur") return null;
    const z = Math.min(300, Math.max(100, Number.isFinite(pengaturan.zoomBlur) ? pengaturan.zoomBlur : 100)) / 100;
    if (!(lebar > 0) || !(tinggi > 0) || z <= 1.005) return null;
    const skala = Math.min(1080 / lebar, 1920 / tinggi) * z;
    return {
      wPct: ((lebar * skala) / 1080) * 100,
      hPct: ((tinggi * skala) / 1920) * 100,
      pp: Math.min(100, Math.max(0, pengaturan.posisiPotong)),
    };
  }, [modeTemplate, pengaturan.mode, pengaturan.zoomBlur, pengaturan.posisiPotong, lebar, tinggi]);
  // v0.9.0 — pratinjau tinggal di KOLOM TENGAH layout 3 kolom (50%):
  // · potret (9:16 / sumber vertikal) dibatasi TINGGI layar (76vh) agar dashboard
  //   tetap proporsional & Ekspor tak tenggelam — lebar mengikuti rasio;
  // · lanskap/persegi tetap selebar kolom (lebar-mengatur) seperti sebelumnya.
  const potret = modeAsli ? tinggi > lebar : true;
  const kelasBungkusan = potret ? "mx-auto w-fit" : "mx-auto w-full max-w-[1100px]";

  // v0.42.0 — teks DIBUNGKUS dgn aturan yang SAMA dgn render drawtext (bungkus.ts):
  // dulu pratinjau melipat via CSS (teks bergeser ke bawah) tapi hasil ekspor tetap
  // 1 baris lurus → terpotong kiri-kanan. Kini kedua sisi memakai baris yang identik
  // (whitespace-pre = CSS tidak melipat ulang), jadi pratinjau = hasil ekspor.
  const wWrap = modeAsli ? lebar : modeTemplate ? Math.round((1080 * TATA_TEMPLATE.judul.w) / 100) : 1080;
  const hWrap = modeAsli ? tinggi : 1920;
  // px viewBox neon: kanvas penuh / kotak video (template) / rasio asli
  const neonKotak = kotakKePx(TATA_TEMPLATE.video, 1080, 1920);
  const neonW = modeTemplate ? neonKotak.w : modeAsli ? lebar : 1080;
  const neonH = modeTemplate ? neonKotak.h : modeAsli ? tinggi : 1920;
  const gayaNeon: React.CSSProperties = modeTemplate
    ? {
        left: `${TATA_TEMPLATE.video.x}%`,
        top: `${TATA_TEMPLATE.video.y}%`,
        width: `${TATA_TEMPLATE.video.w}%`,
        height: `${TATA_TEMPLATE.video.h}%`,
        zIndex: 15,
      }
    : { inset: 0, zIndex: 15 };
  const judulB = bungkusTeksRender(pengaturan.judul, pengaturan.gayaJudul, wWrap, hWrap, 12);
  const partB = bungkusTeksRender(
    `${pengaturan.kataPart} ${partKini}`.trim(),
    pengaturan.gayaPart,
    wWrap,
    hWrap,
    10,
  );
  const deskripsiB = bungkusTeksRender(
    pengaturan.deskripsi,
    pengaturan.gayaDeskripsi,
    wWrap,
    hWrap,
    10,
  );

  // v2.4.0 — posisi judul & part TERPISAH (judulX/Y & partX/Y; -1 = otomatis).
  // Keduanya otomatis → kotak flex lama (pratinjau PERSIS semula). Salah satu
  // konkret → tiap teks jadi lapisan absolut sendiri: X = TENGAH blok, Y = ATAS
  // blok (jangkar sama dgn drawtext; Y otomatis Part dihitung dari blok judul
  // lewat posisiTeksBlok — rumus render yang sama persis).
  const Hpx = modeAsli && tinggi > 0 ? tinggi : 1920;
  const skalaPx = modeAsli && lebar > 0 ? Math.min(lebar, tinggi) / 1080 : 1;
  const uJpx = Math.max(12, pengaturan.gayaJudul.ukuran * skalaPx);
  const uPpx = Math.max(10, pengaturan.gayaPart.ukuran * skalaPx);
  const tJpx = Math.max(1, judulB.split("\n").length) * uJpx * 1.5;
  const tPpx = Math.max(1, partB.split("\n").length) * uPpx * 1.5;
  const posEfektif = posisiTeksBlok(
    pengaturan.judulY,
    pengaturan.partY,
    Hpx,
    Hpx * 0.045,
    tJpx,
    tPpx,
    uJpx * 0.45,
  );
  const keduaOtomatis = pengaturan.judulY < 0 && pengaturan.partY < 0;
  const pctJudul = (posEfektif.yJ / Hpx) * 100;
  const pctPart = (posEfektif.yP / Hpx) * 100;
  const clampPct = (n: number) => Math.min(100, Math.max(0, n));

  const gayaHurufJudul = {
    fontSize: ukuranJudul,
    fontFamily: FONT_CSS[pengaturan.gayaJudul.font],
    color: pengaturan.gayaJudul.warna,
    "--stroke-w": `${(pengaturan.gayaJudul.outlineLebar / 1080) * 100}cqw`,
    "--stroke-color": pengaturan.gayaJudul.outlineWarna,
  } as React.CSSProperties;
  const gayaHurufPart = {
    fontSize: ukuranPart,
    fontFamily: FONT_CSS[pengaturan.gayaPart.font],
    color: pengaturan.gayaPart.warna,
    "--stroke-w": `${(pengaturan.gayaPart.outlineLebar / 1080) * 100}cqw`,
    "--stroke-color": pengaturan.gayaPart.outlineWarna,
  } as React.CSSProperties;

  const susunTeks = keduaOtomatis ? (
    <div className="pointer-events-none absolute inset-x-0 top-[4.5%] z-10 flex flex-col items-center gap-[1.2cqw] px-[4cqw] text-center">
      {pengaturan.judul.trim() && (
        <p className="teks-stroke whitespace-pre font-bold leading-tight" style={gayaHurufJudul}>
          {judulB}
        </p>
      )}
      {pengaturan.kataPart.trim() && (
        <p className="teks-stroke whitespace-pre font-bold leading-tight" style={gayaHurufPart}>
          {partB}
        </p>
      )}
    </div>
  ) : (
    <>
      {pengaturan.judul.trim() && (
        <p
          className="teks-stroke pointer-events-none absolute z-10 whitespace-pre font-bold leading-tight"
          style={{
            left: `${clampPct(pengaturan.judulX)}%`,
            top: `${pctJudul}%`,
            transform: "translate(-50%, 0)",
            ...gayaHurufJudul,
          }}
        >
          {judulB}
        </p>
      )}
      {pengaturan.kataPart.trim() && (
        <p
          className="teks-stroke pointer-events-none absolute z-10 whitespace-pre font-bold leading-tight"
          style={{
            left: `${clampPct(pengaturan.partX)}%`,
            top: `${pctPart}%`,
            transform: "translate(-50%, 0)",
            ...gayaHurufPart,
          }}
        >
          {partB}
        </p>
      )}
    </>
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
          {modeTemplate ? (
            <>
              <div
                aria-hidden
                className="absolute inset-0"
                style={{ background: `linear-gradient(135deg, ${pengaturan.templateGrad1}, ${pengaturan.templateGrad2})` }}
              />
              {/* kotak judul — teks judul di dalamnya */}
              <div
                className="absolute flex items-center justify-center overflow-hidden bg-white/95 px-[3cqw] text-center"
                style={{
                  left: `${TATA_TEMPLATE.judul.x}%`,
                  top: `${TATA_TEMPLATE.judul.y}%`,
                  width: `${TATA_TEMPLATE.judul.w}%`,
                  height: `${TATA_TEMPLATE.judul.h}%`,
                  borderRadius: `${(TATA_TEMPLATE.judul.radius / 1080) * 100}cqw`,
                }}
              >
                {pengaturan.judul.trim() && (
                  <p
                    className="teks-stroke whitespace-pre font-bold leading-tight"
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
                    {judulB}
                  </p>
                )}
              </div>
              {/* jendela video — video tampil DI DALAM kotak tengah */}
              <div
                className="absolute overflow-hidden bg-white/95"
                style={{
                  left: `${TATA_TEMPLATE.video.x}%`,
                  top: `${TATA_TEMPLATE.video.y}%`,
                  width: `${TATA_TEMPLATE.video.w}%`,
                  height: `${TATA_TEMPLATE.video.h}%`,
                  borderRadius: `${(TATA_TEMPLATE.video.radius / 1080) * 100}cqw`,
                }}
              >
                <video
                  ref={refV}
                  src={srcUrl}
                  className="h-full w-full object-contain"
                  muted={bisu}
                  onTimeUpdate={(e) => setT(e.currentTarget.currentTime)}
                  onPlay={() => setJeda(false)}
                  onPause={() => setJeda(true)}
                  playsInline
                />
              </div>
              {/* kotak deskripsi */}
              <div
                className="absolute flex items-center justify-center overflow-hidden bg-white/95 px-[3cqw] text-center"
                style={{
                  left: `${TATA_TEMPLATE.deskripsi.x}%`,
                  top: `${TATA_TEMPLATE.deskripsi.y}%`,
                  width: `${TATA_TEMPLATE.deskripsi.w}%`,
                  height: `${TATA_TEMPLATE.deskripsi.h}%`,
                  borderRadius: `${(TATA_TEMPLATE.deskripsi.radius / 1080) * 100}cqw`,
                }}
              >
                {pengaturan.deskripsi.trim() && (
                  <p
                    className="teks-stroke whitespace-pre font-bold leading-snug"
                    style={
                      {
                        fontSize: ukuranDeskripsi,
                        fontFamily: FONT_CSS[pengaturan.gayaDeskripsi.font],
                        color: pengaturan.gayaDeskripsi.warna,
                        "--stroke-w": `${(pengaturan.gayaDeskripsi.outlineLebar / 1080) * 100}cqw`,
                        "--stroke-color": pengaturan.gayaDeskripsi.outlineWarna,
                      } as React.CSSProperties
                    }
                  >
                    {deskripsiB}
                  </p>
                )}
              </div>
              {/* kotak Part — kecil kiri bawah (sketsa user) */}
              <div
                className="absolute flex items-center justify-center overflow-hidden bg-white/95 text-center"
                style={{
                  left: `${TATA_TEMPLATE.part.x}%`,
                  top: `${TATA_TEMPLATE.part.y}%`,
                  width: `${TATA_TEMPLATE.part.w}%`,
                  height: `${TATA_TEMPLATE.part.h}%`,
                  borderRadius: `${(TATA_TEMPLATE.part.radius / 1080) * 100}cqw`,
                }}
              >
                {pengaturan.kataPart.trim() && (
                  <p
                    className="teks-stroke whitespace-pre font-bold leading-tight"
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
                    {partB}
                  </p>
                )}
              </div>
            </>
          ) : pengaturan.mode === "asli" ? (
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
              {/* v0.51.0 — zoom >100%: video diperbesar + digeser persis filter ffmpeg
                  (skala contain × z, overlay x=(W-w)×pp/100, y=(H-h)/2); tanpa zoom
                  jalur lama: contain penuh di tengah */}
              <video
                ref={refV}
                src={srcUrl}
                className={blurZoom ? "absolute object-contain" : "absolute inset-0 h-full w-full object-contain"}
                style={
                  blurZoom
                    ? {
                        width: `${blurZoom.wPct}%`,
                        height: `${blurZoom.hPct}%`,
                        left: `${((100 - blurZoom.wPct) * blurZoom.pp) / 100}%`,
                        top: `${(100 - blurZoom.hPct) / 2}%`,
                        // v0.51.1 — WAJIB: Tailwind Preflight pasang `video { max-width:100% }`
                        // yang meng-clamp width>100% → video tidak pernah membesar, hanya
                        // bergeser mengikuti left (bug laporan user v0.51.0). max-width:none
                        // membebaskan ukuran zoom persis rumus filter ffmpeg.
                        maxWidth: "none",
                      }
                    : undefined
                }
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
          {/* v0.47.0 — frame hiasan: varian rasio mengikuti bingkai pratinjau
              (potret 916 / lanskap 169) agar tampil penuh; frame lama yang sudah
              dihapus dari setelan tersimpan cukup disembunyikan tanpa ikon rusak
              (mode template memakai halaman desainnya sendiri — frame dilewati) */}
          {pengaturan.frameId && !modeTemplate && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={`${pengaturan.frameId}|${pengaturan.frameWarna || ""}|${pengaturan.frameWarna2 || ""}`}
              src={urlBingkaiWarna(
                {
                  frameId: pengaturan.frameId,
                  frameWarna: pengaturan.frameWarna,
                  frameWarna2: pengaturan.frameWarna2,
                },
                modeAsli && lebar > tinggi,
              )}
              alt=""
              aria-hidden
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
              onLoad={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "";
              }}
              className="pointer-events-none absolute inset-0 h-full w-full object-cover"
              style={{ zIndex: 14 }}
            />
          )}
          {/* v0.46.0 — frame neon berputar (komet bercahaya) */}
          <LapisanNeon setelan={neon} W={neonW} H={neonH} gayaPosisi={gayaNeon} />
          {!modeTemplate && susunTeks}
          {/* v0.39.0 — deskripsi posisi bebas di pratinjau live (non-interaktif;
              seret lewat kartu 4. Tulis Deskripsi). Titik jangkar sama dgn render:
              X = tengah blok teks, Y = atas blok teks. v0.42.0 — teks terbungkus
              sama dgn render (whitespace-pre, tanpa lipat CSS ulang). */}
          {!modeTemplate && pengaturan.deskripsi.trim() && (
            <p
              className="teks-stroke pointer-events-none absolute z-10 whitespace-pre leading-snug"
              style={
                {
                  left: `${Math.min(100, Math.max(0, pengaturan.deskripsiX))}%`,
                  top: `${Math.min(100, Math.max(0, pengaturan.deskripsiY))}%`,
                  transform: "translate(-50%, 0)",
                  fontSize: ukuranDeskripsi,
                  fontFamily: FONT_CSS[pengaturan.gayaDeskripsi.font],
                  color: pengaturan.gayaDeskripsi.warna,
                  "--stroke-w": `${(pengaturan.gayaDeskripsi.outlineLebar / 1080) * 100}cqw`,
                  "--stroke-color": pengaturan.gayaDeskripsi.outlineWarna,
                } as React.CSSProperties
              }
            >
              {deskripsiB}
            </p>
          )}
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
