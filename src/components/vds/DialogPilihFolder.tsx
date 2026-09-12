"use client";

// VidSplit — dialog pilih folder tujuan hasil ekspor (v0.6.4).
// Browser folder SERVER-SIDE: daftar drive → navigasi subfolder → buat folder baru →
// "Pilih folder ini". Dipakai bila dialog Windows asli (Electron) tidak tersedia.
import { useCallback, useEffect, useState } from "react";
import {
  ChevronRight,
  Folder,
  FolderPlus,
  HardDrive,
  Loader2,
  X,
} from "lucide-react";
import { fmtUkuran } from "./bits";

interface EntriDrive {
  nama: string;
  path: string;
  bebas?: number;
}
interface EntriFolder {
  nama: string;
  path: string;
}

/** Uraikan path absolut jadi urutan breadcrumb {label, path} — aman untuk "C:\a\b" & "/a/b". */
function segmen(p: string): { label: string; path: string }[] {
  const hasil: { label: string; path: string }[] = [];
  const drive = p.match(/^([A-Za-z]:)([\\/].*)?$/);
  if (drive) {
    hasil.push({ label: `${drive[1]}\\`, path: `${drive[1]}\\` });
  } else if (p.startsWith("/")) {
    hasil.push({ label: "/", path: "/" });
  }
  const awal = drive ? drive[1].length + (drive[2] ? 1 : 0) : p.startsWith("/") ? 1 : 0;
  for (const b of p.slice(awal).split(/[\\/]+/)) {
    if (!b) continue;
    const prev = hasil[hasil.length - 1]?.path ?? "";
    const gayaBackslash = !!drive;
    const sep = /[\\/]$/.test(prev) ? "" : gayaBackslash ? "\\" : "/";
    hasil.push({ label: b, path: prev + sep + b });
  }
  return hasil;
}

export function DialogPilihFolder({
  buka,
  onTutup,
  onPilih,
}: {
  buka: boolean;
  onTutup: () => void;
  onPilih: (path: string) => void;
}) {
  const [path, setPath] = useState<string | null>(null);
  const [akar, setAkar] = useState(true);
  const [daftar, setDaftar] = useState<EntriDrive[] | EntriFolder[]>([]);
  const [muat, setMuat] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  const [namaBaru, setNamaBaru] = useState("");
  const [buatSibuk, setBuatSibuk] = useState(false);

  const navigasi = useCallback(async (tujuan: string | null) => {
    setMuat(true);
    setGalat(null);
    try {
      const r = await fetch(
        tujuan ? `/api/tujuan/explorer?path=${encodeURIComponent(tujuan)}` : "/api/tujuan/explorer",
        { cache: "no-store" },
      );
      const j = (await r.json()) as
        | {
            ok: true;
            akar: boolean;
            /** respons akar: daftar drive */
            daftar?: EntriDrive[];
            /** respons folder: daftar subfolder */
            entri?: EntriFolder[];
            path?: string;
            induk?: string | null;
          }
        | { ok: false; error: string };
      if (!j.ok) {
        setGalat(j.error);
        return;
      }
      setAkar(j.akar);
      setDaftar((j.daftar ?? j.entri ?? []) as EntriDrive[] | EntriFolder[]);
      setPath(j.akar ? null : (j.path ?? tujuan));
    } catch {
      setGalat("Gagal membaca isi folder");
    } finally {
      setMuat(false);
    }
  }, []);

  useEffect(() => {
    if (buka) {
      setPath(null);
      setAkar(true);
      setNamaBaru("");
      setGalat(null);
      void navigasi(null);
    }
  }, [buka, navigasi]);

  useEffect(() => {
    if (!buka) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onTutup();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [buka, onTutup]);

  const buatFolder = async () => {
    const nama = namaBaru.trim();
    if (!nama || !path || buatSibuk) return;
    setBuatSibuk(true);
    setGalat(null);
    try {
      const r = await fetch("/api/tujuan/explorer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path, nama }),
      });
      const j = (await r.json()) as { ok: boolean; path?: string; error?: string };
      if (!j.ok || !j.path) {
        setGalat(j.error || "Gagal membuat folder");
        return;
      }
      setNamaBaru("");
      await navigasi(j.path);
    } catch {
      setGalat("Gagal membuat folder");
    } finally {
      setBuatSibuk(false);
    }
  };

  if (!buka) return null;
  const labelBebas = (b?: number) =>
    typeof b === "number" && Number.isFinite(b) && b > 0 ? ` · bebas ${fmtUkuran(b)}` : "";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onTutup}
    >
      <div
        className="flex max-h-[82vh] w-full max-w-lg flex-col rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <p className="text-sm font-semibold text-slate-100">Pilih folder tujuan hasil</p>
          <button
            type="button"
            onClick={onTutup}
            className="rounded-md border border-slate-700 p-1 text-slate-400 hover:border-slate-500 hover:text-slate-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* breadcrumb */}
        <div className="flex items-center gap-0.5 overflow-x-auto border-b border-slate-800 px-4 py-2 text-xs">
          <button
            type="button"
            onClick={() => void navigasi(null)}
            className="shrink-0 rounded px-1.5 py-0.5 text-slate-400 hover:bg-slate-800 hover:text-amber-300"
          >
            Komputer ini
          </button>
          {(path ? segmen(path) : []).map((s, i) => (
            <span key={s.path + i} className="flex shrink-0 items-center">
              <ChevronRight className="h-3 w-3 text-slate-600" />
              <button
                type="button"
                onClick={() => void navigasi(s.path)}
                className={`rounded px-1.5 py-0.5 hover:bg-slate-800 hover:text-amber-300 ${
                  i === (path ? segmen(path).length : 0) - 1
                    ? "font-medium text-slate-100"
                    : "text-slate-400"
                }`}
              >
                {s.label}
              </button>
            </span>
          ))}
        </div>

        {/* isi */}
        <div className="min-h-[180px] flex-1 overflow-auto px-2 py-2">
          {muat ? (
            <p className="flex items-center gap-2 px-3 py-6 text-xs text-slate-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Membaca folder…
            </p>
          ) : galat ? (
            <p className="px-3 py-4 text-xs text-red-300">{galat}</p>
          ) : daftar.length === 0 ? (
            <p className="px-3 py-6 text-xs text-slate-500">
              {akar ? "Tidak ada drive yang terbaca." : "Tidak ada subfolder di sini."}
            </p>
          ) : (
            <ul className="space-y-0.5">
              {akar
                ? (daftar as EntriDrive[]).map((d) => (
                    <li key={d.path}>
                      <button
                        type="button"
                        onClick={() => void navigasi(d.path)}
                        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs text-slate-200 hover:bg-slate-800"
                      >
                        <HardDrive className="h-4 w-4 shrink-0 text-sky-400" />
                        <span className="min-w-0 flex-1 truncate">{d.nama}</span>
                        <span className="shrink-0 text-[10px] text-slate-500">
                          {labelBebas(d.bebas)}
                        </span>
                      </button>
                    </li>
                  ))
                : (daftar as EntriFolder[]).map((f) => (
                    <li key={f.path}>
                      <button
                        type="button"
                        onClick={() => void navigasi(f.path)}
                        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs text-slate-200 hover:bg-slate-800"
                      >
                        <Folder className="h-4 w-4 shrink-0 text-amber-400" />
                        <span className="min-w-0 flex-1 truncate">{f.nama}</span>
                      </button>
                    </li>
                  ))}
            </ul>
          )}
        </div>

        {/* buat folder baru + footer */}
        <div className="space-y-2 border-t border-slate-800 px-4 py-3">
          {!akar && (
            <div className="flex gap-2">
              <input
                value={namaBaru}
                onChange={(e) => setNamaBaru(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void buatFolder()}
                placeholder="Nama folder baru…"
                className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-800/60 px-2.5 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-amber-400/70 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => void buatFolder()}
                disabled={!namaBaru.trim() || buatSibuk}
                className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-600 px-2.5 py-1.5 text-xs text-slate-200 hover:border-amber-400 hover:text-amber-300 disabled:opacity-40"
              >
                {buatSibuk ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <FolderPlus className="h-3.5 w-3.5" />
                )}
                Buat
              </button>
            </div>
          )}
          <p className="truncate font-mono text-[10px] text-slate-500" title={path ?? ""}>
            {path ?? "Pilih salah satu drive di atas"}
          </p>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onTutup}
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:border-slate-500"
            >
              Batal
            </button>
            <button
              type="button"
              disabled={!path}
              onClick={() => path && onPilih(path)}
              className="rounded-lg bg-amber-400 px-3 py-1.5 text-xs font-semibold text-slate-900 hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Pilih folder ini
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
