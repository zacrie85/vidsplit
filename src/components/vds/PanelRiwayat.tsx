"use client";

// VidSplit — panel riwayat ekspor: hasil split sebelumnya tetap terdaftar walau
// aplikasi sudah ditutup — unduh ulang ZIP, buka folder (desktop), atau hapus.
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Ban,
  FolderOpen,
  History,
  Loader2,
  Trash2,
  XCircle,
} from "lucide-react";
import { Kartu, fmtUkuran } from "./bits";

interface Entri {
  id: string;
  waktu: number;
  antrean: Array<{ nama: string; total: number; selesai: number; status: string }>;
  outputs: Array<{ video: string; file: string; ukuran: number }>;
  akselerasi: string;
  dibatalkan: boolean;
  adaGagal: boolean;
  adaFile: boolean;
  ukuranAda: number;
}

const KUNCI_ACARA = "vidsplit:riwayat-berubah";

export function PanelRiwayat() {
  const [daftar, setDaftar] = useState<Entri[] | null>(null);
  const [sibuk, setSibuk] = useState<string | null>(null); // id yang sedang dihapus
  const [yakin, setYakin] = useState<string | null>(null); // konfirmasi hapus 2 langkah
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const muat = useCallback(async () => {
    try {
      const r = await fetch("/api/riwayat", { cache: "no-store" });
      const j = (await r.json()) as { ok: boolean; daftar?: Entri[] };
      if (j.ok && j.daftar) setDaftar(j.daftar);
    } catch {
      /* biarkan coba lagi */
    }
  }, []);

  useEffect(() => {
    void muat();
    const acara = () => void muat();
    window.addEventListener(KUNCI_ACARA, acara);
    // segarkan tiap 15 detik — murah (baca JSON + cek file)
    timer.current = setInterval(acara, 15_000);
    return () => {
      window.removeEventListener(KUNCI_ACARA, acara);
      if (timer.current) clearInterval(timer.current);
    };
  }, [muat]);

  const bukaFolder = async (id: string) => {
    try {
      const d = window.vdsplitDesktop;
      if (!d?.bukaFolder) return;
      const r = await d.bukaFolder(`output/${id}`);
      if (r && !r.ok) toast.error(r.error || "Gagal membuka folder");
    } catch {
      toast.error("Gagal membuka folder");
    }
  };

  const hapus = async (e: Entri) => {
    if (yakin !== e.id) {
      setYakin(e.id); // langkah 1: minta konfirmasi
      setTimeout(() => setYakin((y) => (y === e.id ? null : y)), 4000);
      return;
    }
    setSibuk(e.id);
    setYakin(null);
    try {
      const r = await fetch("/api/riwayat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: e.id, aksi: "hapusFile" }),
      });
      const j = (await r.json()) as { ok: boolean; error?: string };
      if (!j.ok) throw new Error(j.error || "Gagal menghapus");
      toast.success("Riwayat & file hasilnya dihapus dari folder kerja");
      await muat();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus");
    } finally {
      setSibuk(null);
    }
  };

  const labelWaktu = (ms: number) => {
    try {
      return new Date(ms).toLocaleString("id-ID", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  };

  const desktop = typeof window !== "undefined" && !!window.vdsplitDesktop?.bukaFolder;

  return (
    <Kartu
      judul="Riwayat ekspor"
      deskripsi="Hasil split sebelumnya tetap tercatat — bisa diunduh ulang kapan saja"
      ikon={<History className="h-4 w-4" />}
    >
      {daftar === null ? (
        <p className="flex items-center gap-2 py-2 text-xs text-slate-500">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Memuat riwayat…
        </p>
      ) : daftar.length === 0 ? (
        <p className="py-2 text-xs text-slate-500">
          Belum ada riwayat — setiap ekspor yang selesai otomatis tercatat di sini.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {daftar.map((e) => (
            <li
              key={e.id}
              className="rounded-xl border border-slate-700/60 bg-slate-800/50 px-3 py-2"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-slate-200">
                    {e.antrean.map((v) => v.nama).join(", ") || "ekspor"}
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-slate-500">
                    <span>{labelWaktu(e.waktu)}</span>
                    <span>·</span>
                    <span>
                      {e.antrean.length} video · {e.outputs.length} part
                      {e.adaFile ? ` · ${fmtUkuran(e.ukuranAda)}` : ""}
                    </span>
                    {e.dibatalkan && (
                      <span className="inline-flex items-center gap-0.5 text-slate-400">
                        <Ban className="h-2.5 w-2.5" /> dibatalkan
                      </span>
                    )}
                    {e.adaGagal && (
                      <span className="inline-flex items-center gap-0.5 text-red-400/80">
                        <XCircle className="h-2.5 w-2.5" /> ada gagal
                      </span>
                    )}
                    {!e.adaFile && <span className="text-amber-400/80">file sudah tiada</span>}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {e.adaFile && (
                    <>
                      <a
                        href={`/api/zip?id=${e.id}`}
                        download={`vidsplit-${e.id}.zip`}
                        className="rounded-md border border-sky-400/50 px-2 py-1 text-[10px] font-medium text-sky-300 hover:bg-sky-400/10"
                        title="Unduh semua hasil ekspor ini (ZIP)"
                      >
                        Unduh ZIP
                      </a>
                      {desktop && (
                        <button
                          type="button"
                          onClick={() => void bukaFolder(e.id)}
                          title="Buka folder hasil di Explorer"
                          className="rounded-md border border-slate-600 p-1 text-slate-300 hover:border-amber-400 hover:text-amber-300"
                        >
                          <FolderOpen className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => void hapus(e)}
                    disabled={sibuk === e.id}
                    title="Hapus dari riwayat & buang file hasilnya"
                    className={`rounded-md border p-1 transition disabled:opacity-40 ${
                      yakin === e.id
                        ? "border-red-400 bg-red-500/20 text-red-200"
                        : "border-slate-600 text-slate-400 hover:border-red-400 hover:text-red-300"
                    }`}
                  >
                    {sibuk === e.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              </div>
              {yakin === e.id && (
                <p className="mt-1.5 rounded-lg bg-red-500/10 px-2 py-1 text-[10px] text-red-200">
                  Klik tong sampah sekali lagi untuk menghapus {e.outputs.length} file hasil
                  (&quot;{e.antrean.map((v) => v.nama).join(", ")}&quot;) permanen.
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </Kartu>
  );
}
