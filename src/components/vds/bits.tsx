"use client";

// VidSplit — komponen kecil pemakai bersama
import { useEffect, useRef, useState, type ChangeEvent, type DragEvent, type ReactNode } from "react";
import { ChevronDown, Upload } from "lucide-react";

/* ============ v2.5.0 — KARTU LIPAT FUTURISTIK (permintaan user: layout baru
 * futuristik — "menu menunya ada tanda panah ke bawah untuk di buka dan bisa
 * di klik lagi panah ke atas agar terlihat kecil lagi", acuan KINOSTRA) ============
 * v2.6.0 — SKIN KINOSTRA PENUH sesuai gambar referensi user:
 * • Menu jadi BARIS HUD BERNOMOR: "01" oranye + judul MONOSPACES HURUF BESAR
 *   (.hud) + badge versi kecil oranye + panah chevron kanan (▼ buka / ▲ lipat).
 * • Kartu terbuka = border oranye (persis item aktif 01 di referensi).
 * • Prop baru: nomor ("00","01",...), badge ("GABUNGAN",...) — opsional.
 * • Status buka/tutup DIINGAT per kartu (localStorage, kunci dari judul kartu).
 * • Animasi lipat halus (grid-rows 0fr↔1fr).
 * Aman hidrasi: render pertama SELALU terbuka (sama dgn server), status
 * tersimpan diterapkan setelah mount — tanpa peringatan hydration. */
const KUNCI_LIPAT = "vidsplit-lipat-v1";

function bacaStatusLipat(kunci: string): boolean | null {
  try {
    const m = JSON.parse(localStorage.getItem(KUNCI_LIPAT) || "{}") as Record<string, boolean>;
    return typeof m[kunci] === "boolean" ? m[kunci] : null;
  } catch {
    return null;
  }
}

function simpanStatusLipat(kunci: string, terbuka: boolean) {
  try {
    const m = JSON.parse(localStorage.getItem(KUNCI_LIPAT) || "{}") as Record<string, boolean>;
    m[kunci] = terbuka;
    localStorage.setItem(KUNCI_LIPAT, JSON.stringify(m));
  } catch {
    /* kuota penuh / mode privat — lipatan tak diingat, tak masalah */
  }
}

export function Kartu({
  judul,
  deskripsi,
  ikon,
  kanan,
  nomor,
  badge,
  children,
  className = "",
}: {
  judul?: string;
  deskripsi?: string;
  ikon?: ReactNode;
  kanan?: ReactNode;
  /** v2.6.0 — nomor HUD KINOSTRA ("00","01","3B",...) — oranye di kiri judul */
  nomor?: string;
  /** v2.6.0 — chip kecil oranye di kanan judul (contoh "GABUNGAN","BARU") */
  badge?: string;
  children: ReactNode;
  className?: string;
}) {
  const bisaLipat = !!(judul || kanan);
  // kunci penyimpanan dari judul (unik per kartu di seluruh aplikasi)
  const kunciLipat = judul ? `${KUNCI_LIPAT}:${judul}` : null;
  const [terbuka, setTerbuka] = useState(true);
  useEffect(() => {
    if (!kunciLipat) return;
    const t = bacaStatusLipat(kunciLipat);
    if (t !== null && t !== true) setTerbuka(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kunciLipat]);
  const togle = () => {
    setTerbuka((t) => {
      const n = !t;
      if (kunciLipat) simpanStatusLipat(kunciLipat, n);
      return n;
    });
  };

  if (!bisaLipat) {
    // kartu tanpa judul/kanan — tampil polos seperti dulu (tidak perlu dilipat)
    return (
      <section
        className={`rounded-md border border-slate-800/80 bg-[#0b0d10]/85 p-4 shadow-lg shadow-black/30 backdrop-blur sm:p-5 ${className}`}
      >
        {children}
      </section>
    );
  }

  return (
    <section
      className={`group relative overflow-hidden rounded-md border bg-[#0b0d10]/90 shadow-lg shadow-black/40 backdrop-blur transition-[border-color,box-shadow] duration-300 ${
        terbuka
          ? "border-amber-500/50 shadow-[0_0_24px_rgba(245,158,11,0.07)]"
          : "border-slate-800 hover:border-slate-600"
      } ${className}`}
    >
      {/* v2.6.0 — garis aksen oranye di tepi atas (pengganti neon cyan lama) */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-500/50 to-transparent"
      />
      {/* HEADER = tombol lipat utuh (panah ▼ buka / ▲ lipat) */}
      <button
        type="button"
        onClick={togle}
        aria-expanded={terbuka}
        title={terbuka ? "Klik untuk melipat kecil" : "Klik untuk membuka"}
        className="flex w-full items-start justify-between gap-3 p-4 text-left sm:p-5"
      >
        <span className="flex min-w-0 items-start gap-2.5">
          {nomor !== undefined && (
            <span className="hud mt-0.5 shrink-0 text-xs font-bold text-amber-500">
              {nomor}
            </span>
          )}
          {ikon && (
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded border border-amber-500/30 bg-amber-500/10 text-amber-400">
              {ikon}
            </span>
          )}
          <span className="min-w-0">
            {judul && (
              <span className="flex flex-wrap items-center gap-2">
                <h2 className="hud text-[13px] font-bold leading-5 text-slate-100">{judul}</h2>
                {badge && (
                  <span className="hud rounded-sm border border-amber-500/50 bg-amber-500/10 px-1.5 py-px text-[9px] font-bold text-amber-400">
                    {badge}
                  </span>
                )}
              </span>
            )}
            {deskripsi && (
              <span className={`mt-0.5 block text-xs text-slate-400 transition-opacity duration-200 ${terbuka ? "" : "opacity-70"}`}>
                {deskripsi}
              </span>
            )}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {kanan}
          <span
            className={`flex h-7 w-7 items-center justify-center rounded border transition-all duration-300 ${
              terbuka
                ? "border-amber-500/60 bg-amber-500/10 text-amber-400"
                : "border-slate-700 bg-slate-900/60 text-slate-400 group-hover:border-amber-500/60 group-hover:text-amber-400"
            }`}
          >
            <ChevronDown
              className={`h-4 w-4 transition-transform duration-300 ${terbuka ? "rotate-180" : ""}`}
            />
          </span>
        </span>
      </button>
      {/* ISI — lipat halus dgn grid-rows (tanpa ukuran JS) */}
      <div
        className={`grid transition-all duration-300 ease-out ${
          terbuka ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <div className="px-4 pb-4 sm:px-5 sm:pb-5">{children}</div>
        </div>
      </div>
    </section>
  );
}

export function BarisSlider({
  label,
  nilai,
  min,
  max,
  step = 1,
  onChange,
  fmt,
}: {
  label: string;
  nilai: number;
  min: number;
  max: number;
  step?: number;
  onChange: (n: number) => void;
  fmt?: (n: number) => string;
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center justify-between text-xs text-slate-400">
        <span>{label}</span>
        <span className="font-medium text-slate-200">{fmt ? fmt(nilai) : nilai}</span>
      </span>
      <input
        type="range"
        className="w-full"
        min={min}
        max={max}
        step={step}
        value={nilai}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

export function PilihWarna({
  label,
  nilai,
  onChange,
}: {
  label: string;
  nilai: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-2 text-xs text-slate-400">
      <span>{label}</span>
      <span className="flex items-center gap-2">
        <span className="font-mono text-[10px] uppercase text-slate-500">{nilai}</span>
        <input
          type="color"
          className="h-7 w-9 rounded border border-slate-600/70"
          value={nilai.slice(0, 7)}
          onChange={(e) => onChange(e.target.value)}
        />
      </span>
    </label>
  );
}

export function ChipPilihan<T extends string | number>({
  pilihan,
  nilai,
  onChange,
  kolom = false,
}: {
  pilihan: { v: T; label: string; hint?: string }[];
  nilai: T;
  onChange: (v: T) => void;
  kolom?: boolean;
}) {
  return (
    <div className={`gap-2 ${kolom ? "grid" : "flex flex-wrap"}`}>
      {pilihan.map((p) => (
        <button
          key={p.v}
          type="button"
          onClick={() => onChange(p.v)}
          className={`rounded-lg border px-3 py-1.5 text-left text-xs transition ${
            nilai === p.v
              ? "border-amber-400/80 bg-amber-400/15 text-amber-200"
              : "border-slate-700 bg-slate-800/60 text-slate-300 hover:border-slate-500"
          }`}
        >
          <span className="block font-medium">{p.label}</span>
          {p.hint && <span className="block text-[10px] opacity-70">{p.hint}</span>}
        </button>
      ))}
    </div>
  );
}

export function JatuhBerkas({
  terima,
  onFile,
  hint,
  sibuk = false,
  multiple = false,
  bukaDialog,
}: {
  terima: string;
  onFile: (f: File) => void;
  hint: string;
  sibuk?: boolean;
  /** true = input file & drop menerima BANYAK file (onFile dipanggil satu per satu, urut) */
  multiple?: boolean;
  /** v0.40.0 — mode desktop: klik zona memanggil ini (dialog natif Electron) alih-alih
   * membuka input file HTML; boleh async (picker jembatan mengembalikan Promise) */
  bukaDialog?: () => void | Promise<void>;
}) {
  const [diAtas, setDiatas] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  // v0.40.0 — mode desktop (Electron): klik zona langsung membuka dialog NATIF lewat
  // jembatan vdsplitDesktop.pilih() — input file HTML DILEWATI. Dulu kedua dialog
  // terbuka berurutan (klik → dialog HTML → handler → dialog Electron lagi) sehingga
  // user terpaksa memilih file 2x sebelum video masuk antrean. Dgn bukaDialog, satu
  // klik = satu dialog. Seret-lepas tetap lewat onFile (unggah HTTP lokal).
  const klik = () => {
    if (bukaDialog) {
      void bukaDialog();
      return;
    }
    ref.current?.click();
  };

  const lepas = (e: DragEvent) => {
    e.preventDefault();
    setDiatas(false);
    const fs = Array.from(e.dataTransfer.files ?? []);
    if (!fs.length) return;
    // video folder bisa tak terurut — biarkan urutan OS; caller memakai sisa kapasitas
    for (const f of fs) onFile(f);
  };

  const ubah = (e: ChangeEvent<HTMLInputElement>) => {
    const fs = Array.from(e.target.files ?? []);
    for (const f of fs) onFile(f);
    e.target.value = "";
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDiatas(true);
      }}
      onDragLeave={() => setDiatas(false)}
      onDrop={lepas}
      onClick={klik}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && klik()}
      className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center transition ${
        diAtas
          ? "border-amber-400 bg-amber-400/10"
          : "border-slate-600/70 bg-slate-800/40 hover:border-slate-500"
      }`}
    >
      <input
        ref={ref}
        type="file"
        accept={terima}
        multiple={multiple}
        className="hidden"
        onChange={ubah}
      />
      <Upload className="h-6 w-6 text-slate-400" />
      <p className="text-sm text-slate-300">
        {sibuk ? "Memproses…" : "Klik atau seret file ke sini"}
      </p>
      <p className="text-[11px] text-slate-500">{hint}</p>
    </div>
  );
}

export function fmtUkuran(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0 B";
  const satuan = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < satuan.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v < 10 && i > 0 ? v.toFixed(1) : Math.round(v)} ${satuan[i]}`;
}
