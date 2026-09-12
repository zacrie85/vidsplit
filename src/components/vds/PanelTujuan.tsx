"use client";

// VidSplit — blok "Folder hasil ekspor" (v0.6.4): user memilih drive/folder tempat
// hasil ekspor & split otomatis disimpan SEBELUM proses dimulai, jadi tidak perlu
// lagi mengunduh hasil satu per satu dari aplikasi.
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  FolderOpen,
  Loader2,
  Folder,
} from "lucide-react";
import type { InfoJob } from "@/lib/vidsplit/jobs";
import type { SetelanTujuan } from "@/lib/vidsplit/tujuan";
import { DialogPilihFolder } from "./DialogPilihFolder";

export function PanelTujuan({
  job,
  setelan,
  onSetelan,
}: {
  job: InfoJob | null;
  setelan: SetelanTujuan | null;
  onSetelan: (s: SetelanTujuan) => void;
}) {
  const [modal, setModal] = useState(false);
  const [simpanSibuk, setSimpanSibuk] = useState(false);

  // muat setelan tersimpan dari server (folder data aplikasi) — persisten antar sesi
  useEffect(() => {
    let hidup = true;
    (async () => {
      try {
        const r = await fetch("/api/tujuan", { cache: "no-store" });
        const j = (await r.json()) as { ok: boolean; setelan?: SetelanTujuan };
        if (hidup && j.ok && j.setelan) onSetelan(j.setelan);
      } catch {
        /* biarkan default */
      }
    })();
    return () => {
      hidup = false;
    };
  }, [onSetelan]);

  const simpan = async (ubah: Partial<SetelanTujuan>) => {
    setSimpanSibuk(true);
    try {
      const r = await fetch("/api/tujuan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ubah),
      });
      const j = (await r.json()) as { ok: boolean; setelan?: SetelanTujuan; error?: string };
      if (!j.ok || !j.setelan) throw new Error(j.error || "Gagal menyimpan setelan");
      onSetelan(j.setelan);
      return j.setelan;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menyimpan setelan");
      return null;
    } finally {
      setSimpanSibuk(false);
    }
  };

  const pilihFolder = async () => {
    // mode desktop: pakai dialog Windows asli — paling natural
    if (typeof window !== "undefined" && window.vdsplitDesktop?.pilihFolder) {
      try {
        const r = await window.vdsplitDesktop.pilihFolder();
        if (r && r.ok && r.path) {
          const s = await simpan({ folder: r.path });
          if (s) toast.success(`Hasil ekspor akan tersimpan di ${r.path}`);
          return;
        }
        if (r && r.ok === false && !r.batal) {
          toast.error(r.error || "Gagal memilih folder");
        }
        if (r && r.batal) return; // user menutup dialog — biarkan
      } catch {
        /* jatuh ke modal web */
      }
    }
    setModal(true);
  };

  const terimaDariModal = async (path: string) => {
    setModal(false);
    const s = await simpan({ folder: path });
    if (s) toast.success(`Hasil ekspor akan tersimpan di ${path}`);
  };

  const bukaFolder = async () => {
    if (!setelan?.folder) return;
    try {
      const d = window.vdsplitDesktop;
      if (d?.bukaFolderAbs) {
        const r = await d.bukaFolderAbs(setelan.folder);
        if (r && !r.ok) toast.error(r.error || "Gagal membuka folder");
      } else {
        await navigator.clipboard.writeText(setelan.folder);
        toast.info("Path folder disalin — tempel di File Explorer");
      }
    } catch {
      toast.error("Gagal membuka folder");
    }
  };

  const aktif = !!setelan?.otomatis;
  const adaFolder = !!setelan?.folder;

  return (
    <div className="mt-3 rounded-xl border border-slate-700/50 bg-slate-800/40 p-3">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-slate-300">
        <Folder className="h-3.5 w-3.5 text-amber-400" /> Folder hasil ekspor
      </p>

      <button
        type="button"
        onClick={() => void simpan({ otomatis: !aktif })}
        disabled={simpanSibuk}
        className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-xs transition disabled:opacity-60 ${
          aktif
            ? "border-emerald-400/50 bg-emerald-400/10 text-emerald-200"
            : "border-slate-700 bg-slate-800/60 text-slate-400"
        }`}
      >
        <span className="flex items-center gap-1.5">
          <FolderOpen className="h-3.5 w-3.5" />
          Simpan otomatis hasil ke folder pilihan
        </span>
        <span className="font-medium">{aktif ? "Aktif" : "Mati"}</span>
      </button>

      {aktif && (
        <>
          <div className="mt-2 flex items-center gap-2">
            <span
              className="min-w-0 flex-1 truncate rounded-lg border border-slate-700/70 bg-slate-900/60 px-2.5 py-1.5 font-mono text-[10px] text-slate-300"
              title={setelan?.folder ?? ""}
            >
              {setelan?.folder ?? "Belum ada folder — pilih dulu di tombol kanan"}
            </span>
            <button
              type="button"
              onClick={() => void pilihFolder()}
              disabled={simpanSibuk}
              className="shrink-0 rounded-lg border border-amber-400/60 bg-amber-400/10 px-2.5 py-1.5 text-xs font-medium text-amber-300 hover:bg-amber-400/20 disabled:opacity-50"
            >
              {simpanSibuk ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Pilih…"}
            </button>
            {adaFolder && (
              <button
                type="button"
                onClick={() => void bukaFolder()}
                title="Buka folder tujuan"
                className="shrink-0 rounded-lg border border-slate-600 p-1.5 text-slate-300 hover:border-amber-400 hover:text-amber-300"
              >
                <FolderOpen className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => void simpan({ bersihkanKerja: !setelan?.bersihkanKerja })}
            disabled={simpanSibuk || !adaFolder}
            className={`mt-2 flex w-full items-center justify-between rounded-lg border px-3 py-1.5 text-left text-[11px] transition disabled:opacity-50 ${
              setelan?.bersihkanKerja
                ? "border-sky-400/50 bg-sky-400/10 text-sky-200"
                : "border-slate-700 bg-slate-800/60 text-slate-400"
            }`}
          >
            <span>Buang salinan di aplikasi setelah tersalin (hemat ruang)</span>
            <span className="font-medium">{setelan?.bersihkanKerja ? "Ya" : "Tidak"}</span>
          </button>

          {!adaFolder && (
            <p className="mt-1.5 flex items-start gap-1.5 text-[11px] text-amber-300/80">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
              Ekspor tetap bisa jalan tanpa folder — hasil hanya bisa diunduh dari aplikasi.
            </p>
          )}
          {setelan?.bersihkanKerja && (
            <p className="mt-1.5 text-[11px] text-slate-500">
              Salinan di aplikasi dibuang setelah tersalin & terverifikasi — tombol unduh per file
              untuk ekspor berikutnya mengambil dari folder tujuan (ZIP) atau kosong.
            </p>
          )}
        </>
      )}

      {/* status penyalinan job yang sedang/terakhir berjalan */}
      {job?.menyalin && (
        <p className="mt-2 flex items-center gap-1.5 rounded-lg bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" /> Menyalin hasil ke folder
          tujuan…
        </p>
      )}
      {!job?.menyalin && job?.folderTersimpan && (
        <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-emerald-400/10 px-3 py-2 text-xs text-emerald-200">
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span className="min-w-0">
            Hasil tersimpan di:
            <span className="mt-0.5 block break-all font-mono text-[10px] text-emerald-300/90">
              {job.folderTersimpan}
            </span>
          </span>
        </p>
      )}
      {job?.peringatanSalin && (
        <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {job.peringatanSalin}
        </p>
      )}

      <DialogPilihFolder
        buka={modal}
        onTutup={() => setModal(false)}
        onPilih={(p) => void terimaDariModal(p)}
      />
    </div>
  );
}
