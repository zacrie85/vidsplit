"use client";

// VidSplit — halaman utama: impor video → atur → pratinjau → ekspor & split
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Clapperboard, Film, Info, MonitorPlay } from "lucide-react";
import { PanelAtur } from "@/components/vds/PanelAtur";
import { PanelEkspor } from "@/components/vds/PanelEkspor";
import { Preview } from "@/components/vds/Preview";
import { JatuhBerkas, Kartu, fmtUkuran } from "@/components/vds/bits";
import { formatDurasi, pengaturanDefault, type Pengaturan } from "@/lib/vidsplit/types";

const KUNCI_SIMPAN = "vidsplit-pengaturan-v1";

interface VideoInfo {
  file: string;
  nama: string;
  ukuran: number;
  durasi: number;
  lebar: number;
  tinggi: number;
  fps: number;
  adaAudio: boolean;
}

interface BgInfo {
  file: string;
  nama: string;
  ukuran: number;
}

export default function Halaman() {
  const [pengaturan, setPengaturan] = useState<Pengaturan>(pengaturanDefault);
  const [video, setVideo] = useState<VideoInfo | null>(null);
  const [bg, setBg] = useState<BgInfo | null>(null);
  const [sibukVideo, setSibukVideo] = useState(false);
  const [sibukBg, setSibukBg] = useState(false);

  // muat pengaturan tersimpan
  useEffect(() => {
    try {
      const mentah = localStorage.getItem(KUNCI_SIMPAN);
      if (mentah) {
        const simpanan = JSON.parse(mentah) as Partial<Pengaturan>;
        // sinkron pasca-hidrasi dgn preferensi tersimpan — pola memuat localStorage
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setPengaturan((p) => ({ ...p, ...simpanan, bgId: "" }));
      }
    } catch {
      /* abaikan */
    }
  }, []);

  // simpan pengaturan (bgId tidak ikut — file sesi lokal)
  useEffect(() => {
    try {
      const sisanya = { ...pengaturan, bgId: "" };
      localStorage.setItem(KUNCI_SIMPAN, JSON.stringify(sisanya));
    } catch {
      /* abaikan */
    }
  }, [pengaturan]);

  const unggahVideo = async (f: File) => {
    setSibukVideo(true);
    try {
      // mode desktop: file langsung dari dialog Electron, tak perlu unggah
      if (typeof window !== "undefined" && window.vdsplitDesktop) {
        const dipilih = await window.vdsplitDesktop.pilih("video");
        if (!dipilih) return;
        await pasangVideo(dipilih.path, dipilih.nama, dipilih.ukuran);
        return;
      }
      const r = await fetch(
        `/api/upload?kind=video&nama=${encodeURIComponent(f.name)}`,
        { method: "POST", body: f, headers: { "Content-Type": "application/octet-stream" } },
      );
      const j = (await r.json()) as { ok: boolean; file?: string; ukuran?: number; error?: string };
      if (!j.ok || !j.file) throw new Error(j.error || "Unggah gagal");
      await pasangVideo(j.file, f.name, j.ukuran || f.size);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal impor video");
    } finally {
      setSibukVideo(false);
    }
  };

  const pasangVideo = async (file: string, nama: string, ukuran: number) => {
    const r = await fetch("/api/probe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file }),
    });
    const j = (await r.json()) as {
      ok: boolean;
      durasi?: number;
      lebar?: number;
      tinggi?: number;
      fps?: number;
      adaAudio?: boolean;
      error?: string;
    };
    if (!j.ok) throw new Error(j.error || "Video tidak bisa dibaca");
    setVideo({
      file,
      nama,
      ukuran,
      durasi: j.durasi || 0,
      lebar: j.lebar || 0,
      tinggi: j.tinggi || 0,
      fps: j.fps || 30,
      adaAudio: !!j.adaAudio,
    });
    toast.success(`"${nama}" siap diolah — ${formatDurasi(j.durasi || 0)}`);
  };

  const unggahBg = async (f: File) => {
    setSibukBg(true);
    try {
      if (typeof window !== "undefined" && window.vdsplitDesktop) {
        const dipilih = await window.vdsplitDesktop.pilih("bg");
        if (!dipilih) return;
        setBg({ file: dipilih.path, nama: dipilih.nama, ukuran: dipilih.ukuran });
        setPengaturan((p) => ({ ...p, bgId: dipilih.path }));
        toast.success(`Background "${dipilih.nama}" dipasang`);
        return;
      }
      const r = await fetch(`/api/upload?kind=bg&nama=${encodeURIComponent(f.name)}`, {
        method: "POST",
        body: f,
        headers: { "Content-Type": "application/octet-stream" },
      });
      const j = (await r.json()) as { ok: boolean; file?: string; ukuran?: number; error?: string };
      if (!j.ok || !j.file) throw new Error(j.error || "Unggah background gagal");
      setBg({ file: j.file, nama: f.name, ukuran: j.ukuran || f.size });
      setPengaturan((p) => ({ ...p, bgId: j.file as string }));
      toast.success(`Background "${f.name}" dipasang`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal pasang background");
    } finally {
      setSibukBg(false);
    }
  };

  const hapusBg = () => {
    setBg(null);
    setPengaturan((p) => ({ ...p, bgId: "" }));
  };

  const urlVideo = video ? `/api/file?p=${encodeURIComponent(video.file)}` : "";

  return (
    <main className="mx-auto max-w-6xl px-4 pb-16 pt-8 sm:px-6">
      {/* kepala */}
      <header className="mb-8 flex flex-col items-center text-center">
        <div className="flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-400/15 text-amber-400">
            <Clapperboard className="h-5 w-5" />
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-slate-50 sm:text-3xl">
            Vid<span className="text-amber-400">Split</span>
          </h1>
          <span className="rounded-md border border-slate-700 px-1.5 py-0.5 text-[10px] text-slate-400">
            v0.3.0
          </span>
        </div>
        <p className="mt-2 max-w-xl text-sm text-slate-400">
          Video horizontal → vertikal 9:16, judul statis + tulisan <b>Part</b> berganti otomatis
          sesuai durasi set, split tepat di batas part, dan background intro di awal tiap potongan.
        </p>
      </header>

      {/* alur */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          {!video ? (
            <Kartu
              judul="Mulai — impor video-mu"
              deskripsi="MP4, MOV, MKV, AVI, WebM — maksimal 20 GB"
              ikon={<Film className="h-4 w-4" />}
            >
              <JatuhBerkas
                terima="video/*"
                onFile={unggahVideo}
                hint="Klik atau seret file video ke sini"
                sibuk={sibukVideo}
              />
              <p className="mt-3 flex items-start gap-1.5 text-[11px] text-slate-500">
                <Info className="mt-0.5 h-3 w-3 shrink-0" />
                Semua diproses lokal di komputermu — tidak ada yang diunggah ke internet.
              </p>
            </Kartu>
          ) : (
            <PanelAtur
              pengaturan={pengaturan}
              onChange={setPengaturan}
              bgInfo={bg ? { nama: bg.nama, ukuran: bg.ukuran } : null}
              onBgFile={unggahBg}
              onHapusBg={hapusBg}
              bgSibuk={sibukBg}
              durasiVideo={video.durasi}
              ukuranVideo={`${video.lebar}×${video.tinggi} · ${fmtUkuran(video.ukuran)}`}
            />
          )}
        </div>

        {video && (
          <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
            <Kartu
              judul="Pratinjau live"
              deskripsi={`${video.nama}`}
              ikon={<MonitorPlay className="h-4 w-4" />}
            >
              <Preview
                srcUrl={urlVideo}
                pengaturan={pengaturan}
                durasi={video.durasi}
                totalPart={Math.max(1, Math.ceil(video.durasi / Math.max(1, pengaturan.durasiPart)))}
              />
            </Kartu>
            <PanelEkspor
              videoInfo={{ file: video.file, nama: video.nama, durasi: video.durasi }}
              pengaturan={pengaturan}
              onChange={setPengaturan}
            />
            <button
              type="button"
              onClick={() => {
                setVideo(null);
                setBg(null);
                setPengaturan((p) => ({ ...p, bgId: "" }));
              }}
              className="w-full rounded-xl border border-slate-700 py-2 text-xs text-slate-400 hover:border-slate-500 hover:text-slate-200"
            >
              Ganti video sumber
            </button>
          </div>
        )}
      </div>

      <footer className="mt-12 text-center text-[11px] text-slate-600">
        VidSplit — dibuat untuk kreator konten. Diproses penuh di perangkatmu dengan ffmpeg.
      </footer>
    </main>
  );
}
