"use client";

// VidSplit — komponen kecil pemakai bersama
import { useRef, useState, type ChangeEvent, type DragEvent, type ReactNode } from "react";
import { Upload } from "lucide-react";

export function Kartu({
  judul,
  deskripsi,
  ikon,
  kanan,
  children,
  className = "",
}: {
  judul?: string;
  deskripsi?: string;
  ikon?: ReactNode;
  kanan?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-slate-700/60 bg-slate-900/60 p-4 shadow-lg shadow-black/20 backdrop-blur sm:p-5 ${className}`}
    >
      {(judul || kanan) && (
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            {ikon && <span className="mt-0.5 text-amber-400">{ikon}</span>}
            <div>
              {judul && <h2 className="font-semibold tracking-tight text-slate-100">{judul}</h2>}
              {deskripsi && <p className="mt-0.5 text-xs text-slate-400">{deskripsi}</p>}
            </div>
          </div>
          {kanan}
        </div>
      )}
      {children}
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

export function ChipPilihan<T extends string>({
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
}: {
  terima: string;
  onFile: (f: File) => void;
  hint: string;
  sibuk?: boolean;
}) {
  const [diAtas, setDiatas] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  const lepas = (e: DragEvent) => {
    e.preventDefault();
    setDiatas(false);
    const f = e.dataTransfer.files?.[0];
    if (f) onFile(f);
  };

  const ubah = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) onFile(f);
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
      onClick={() => ref.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && ref.current?.click()}
      className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center transition ${
        diAtas
          ? "border-amber-400 bg-amber-400/10"
          : "border-slate-600/70 bg-slate-800/40 hover:border-slate-500"
      }`}
    >
      <input ref={ref} type="file" accept={terima} className="hidden" onChange={ubah} />
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
