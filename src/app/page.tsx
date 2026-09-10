"use client";

// VidSplit — halaman utama: antrean multi-video (maks 15) → atur tiap video →
// ekspor & split BERURUTAN dari video teratas sampai terbawah
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  Clapperboard,
  Info,
  ListVideo,
  MonitorPlay,
  Trash2,
} from "lucide-react";
import { PanelAtur } from "@/components/vds/PanelAtur";
import { PanelEkspor } from "@/components/vds/PanelEkspor";
import { Preview } from "@/components/vds/Preview";
import { JatuhBerkas, Kartu, fmtUkuran } from "@/components/vds/bits";
import {
  BATAS_VIDEO,
  formatDurasi,
  pengaturanDefault,
  type Pengaturan,
} from "@/lib/vidsplit/types";

const KUNCI_SIMPAN = "vidsplit-pengaturan-v1";
const KUNCI_EKSPOR = "vidsplit-ekspor-v1";

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

interface VideoKerja {
  info: VideoInfo;
  pengaturan: Pengaturan;
  bgInfo: { nama: string; ukuran: number } | null;
}

interface OpsiEkspor {
  paralel: number;
  pakaiGpu: boolean;
}

export default function Halaman() {
  const [dasar, setDasar] = useState<Pengaturan>(pengaturanDefault);
  const [daftar, setDaftar] = useState<VideoKerja[]>([]);
  const [aktif, setAktif] = useState(0);
  const [sibukVideo, setSibukVideo] = useState(false);
  const [sibukBg, setSibukBg] = useState(false);
  const [opsiEkspor, setOpsiEkspor] = useState<OpsiEkspor>({ paralel: 2, pakaiGpu: true });

  // muat preferensi tersimpan (pengaturan dasar video baru + opsi ekspor)
  useEffect(() => {
    try {
      const mentah = localStorage.getItem(KUNCI_SIMPAN);
      if (mentah) {
        const simpanan = JSON.parse(mentah) as Partial<Pengaturan>;
        // sinkron pasca-hidrasi dgn preferensi tersimpan — pola memuat localStorage
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setDasar((p) => ({ ...p, ...simpanan, bgId: "" }));
      }
      const eksporMentah = localStorage.getItem(KUNCI_EKSPOR);
      if (eksporMentah) {
        const o = JSON.parse(eksporMentah) as Partial<OpsiEkspor>;
        setOpsiEkspor({
          paralel: Math.min(4, Math.max(1, Math.round(Number(o.paralel) || 2))),
          pakaiGpu: o.pakaiGpu !== false,
        });
      }
    } catch {
      /* abaikan */
    }
  }, []);

  // simpan preferensi (bgId tidak ikut — file sesi lokal)
  useEffect(() => {
    try {
      localStorage.setItem(KUNCI_SIMPAN, JSON.stringify({ ...dasar, bgId: "" }));
      localStorage.setItem(KUNCI_EKSPOR, JSON.stringify(opsiEkspor));
    } catch {
      /* abaikan */
    }
  }, [dasar, opsiEkspor]);

  const videoAktif = daftar[aktif] ?? null;

  /** pasang satu video (hasil unggah web / pilihan dialog Electron) ke antrean */
  const pasangVideo = async (
    file: string,
    nama: string,
    ukuran: number,
    pengaturanTersimpan?: boolean,
  ) => {
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
    const info: VideoInfo = {
      file,
      nama,
      ukuran,
      durasi: j.durasi || 0,
      lebar: j.lebar || 0,
      tinggi: j.tinggi || 0,
      fps: j.fps || 30,
      adaAudio: !!j.adaAudio,
    };
    let masuk = false;
    setDaftar((d) => {
      if (d.length >= BATAS_VIDEO) return d;
      masuk = true;
      return [
        ...d,
        {
          info,
          // pengaturan baru mulai dari preferensi tersimpan, judul dikosongkan agar
          // tiap video diset manual (nama file jadi petunjuk)
          pengaturan: pengaturanTersimpan
            ? { ...pengaturanDefault }
            : { ...dasar, judul: "" },
          bgInfo: null,
        },
      ];
    });
    if (!masuk) {
      toast.error(`Antrean penuh — maksimal ${BATAS_VIDEO} video. "${nama}" dilewati.`);
      return;
    }
    toast.success(`"${nama}" masuk antrean — ${formatDurasi(info.durasi)}`);
  };

  const unggahSatu = async (f: File, sisaKuota: number) => {
    if (sisaKuota <= 0) {
      toast.error(`Antrean penuh — maksimal ${BATAS_VIDEO} video. "${f.name}" dilewati.`);
      return;
    }
    const r = await fetch(
      `/api/upload?kind=video&nama=${encodeURIComponent(f.name)}`,
      { method: "POST", body: f, headers: { "Content-Type": "application/octet-stream" } },
    );
    const j = (await r.json()) as { ok: boolean; file?: string; ukuran?: number; error?: string };
    if (!j.ok || !j.file) throw new Error(j.error || "Unggah gagal");
    await pasangVideo(j.file, f.name, j.ukuran || f.size);
  };

  const unggahVideo = async (f: File) => {
    setSibukVideo(true);
    try {
      // mode desktop: file langsung dari dialog Electron, tak perlu unggah
      if (typeof window !== "undefined" && window.vdsplitDesktop) {
        const dipilih = await window.vdsplitDesktop.pilih("video");
        if (!dipilih) return;
        let kuota = BATAS_VIDEO - daftar.length;
        for (const it of dipilih) {
          if (kuota <= 0) {
            toast.error(`Antrean penuh — maksimal ${BATAS_VIDEO} video. Sisanya dilewati.`);
            break;
          }
          await pasangVideo(it.path, it.nama, it.ukuran);
          kuota -= 1;
        }
        return;
      }
      await unggahSatu(f, BATAS_VIDEO - daftar.length);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal impor video");
    } finally {
      setSibukVideo(false);
    }
  };

  const unggahBg = async (f: File) => {
    if (!videoAktif) return;
    setSibukBg(true);
    try {
      if (typeof window !== "undefined" && window.vdsplitDesktop) {
        const dipilih = await window.vdsplitDesktop.pilih("bg");
        if (!dipilih.length) return;
        const bg = dipilih[0];
        perbaruiAktif((p) => ({ ...p, bgId: bg.path }));
        setDaftar((d) =>
          d.map((v, i) =>
            i === aktif ? { ...v, bgInfo: { nama: bg.nama, ukuran: bg.ukuran } } : v,
          ),
        );
        toast.success(`Background "${bg.nama}" dipasang ke video #${aktif + 1}`);
        return;
      }
      const r = await fetch(`/api/upload?kind=bg&nama=${encodeURIComponent(f.name)}`, {
        method: "POST",
        body: f,
        headers: { "Content-Type": "application/octet-stream" },
      });
      const j = (await r.json()) as { ok: boolean; file?: string; ukuran?: number; error?: string };
      if (!j.ok || !j.file) throw new Error(j.error || "Unggah background gagal");
      perbaruiAktif((p) => ({ ...p, bgId: j.file as string }));
      setDaftar((d) =>
        d.map((v, i) =>
          i === aktif ? { ...v, bgInfo: { nama: f.name, ukuran: j.ukuran || f.size } } : v,
        ),
      );
      toast.success(`Background "${f.name}" dipasang ke video #${aktif + 1}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal pasang background");
    } finally {
      setSibukBg(false);
    }
  };

  const hapusBg = () => {
    if (!videoAktif) return;
    perbaruiAktif((p) => ({ ...p, bgId: "" }));
    setDaftar((d) => d.map((v, i) => (i === aktif ? { ...v, bgInfo: null } : v)));
  };

  /** ubah pengaturan video yang sedang dipilih */
  const perbaruiAktif = (ubah: (p: Pengaturan) => Pengaturan) => {
    setDaftar((d) =>
      d.map((v, i) => (i === aktif ? { ...v, pengaturan: ubah(v.pengaturan) } : v)),
    );
  };

  const gantiPengaturanAktif = (p: Pengaturan) => perbaruiAktif(() => p);

  const pindahVideo = (i: number, arah: -1 | 1) => {
    const j = i + arah;
    if (j < 0 || j >= daftar.length) return;
    setDaftar((d) => {
      const salinan = [...d];
      [salinan[i], salinan[j]] = [salinan[j], salinan[i]];
      return salinan;
    });
    setAktif(j);
  };

  const hapusVideo = (i: number) => {
    setDaftar((d) => d.filter((_, k) => k !== i));
    // penunjuk aktif: item sebelum i tetap; item yang menggantikan posisi i tetap dipilih;
    // item sesudah i bergeser turun satu
    setAktif((a) =>
      a > i ? a - 1 : a === i ? Math.max(0, Math.min(i, daftar.length - 2)) : a,
    );
  };

  const terapkanKeSemua = () => {
    if (!videoAktif) return;
    setDaftar((d) => d.map((v) => ({ ...v, pengaturan: { ...videoAktif.pengaturan } })));
    toast.success("Pengaturan video ini diterapkan ke SEMUA video di antrean");
  };

  const totalDurasi = daftar.reduce((a, v) => a + v.info.durasi, 0);
  const totalPart = daftar.reduce(
    (a, v) => a + Math.max(1, Math.ceil(v.info.durasi / Math.max(1, v.pengaturan.durasiPart))),
    0,
  );

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
            v0.4.1
          </span>
        </div>
        <p className="mt-2 max-w-xl text-sm text-slate-400">
          Antrean video (maks {BATAS_VIDEO}) → atur tiap video sendiri → ekspor & split
          <b> berurutan dari atas ke bawah</b>, tiap potongan vertikal 9:16 + judul + Part
          + background intro.
        </p>
      </header>

      {/* alur */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          {/* ANTREAN VIDEO */}
          <Kartu
            judul="Antrean video"
            deskripsi="Urutan di sini = urutan proses ekspor (atas → bawah). Klik video untuk mengaturnya."
            ikon={<ListVideo className="h-4 w-4" />}
          >
            {daftar.length === 0 ? (
              <JatuhBerkas
                terima="video/*"
                onFile={unggahVideo}
                hint={`MP4, MOV, MKV, AVI, WebM — maks ${BATAS_VIDEO} video, maks 20 GB per video`}
                sibuk={sibukVideo}
                multiple
              />
            ) : (
              <div className="space-y-2">
                <ul className="space-y-1.5">
                  {daftar.map((v, i) => (
                    <li
                      key={`${v.info.file}-${i}`}
                      className={`flex items-center gap-2 rounded-xl border px-3 py-2 transition ${
                        i === aktif
                          ? "border-amber-400/70 bg-amber-400/10"
                          : "border-slate-700/60 bg-slate-800/50 hover:border-slate-500"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setAktif(i)}
                        className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                      >
                        <span
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                            i === aktif
                              ? "bg-amber-400 text-slate-900"
                              : "bg-slate-700 text-slate-300"
                          }`}
                        >
                          {i + 1}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm text-slate-100">
                            {v.info.nama}
                          </span>
                          <span className="block text-[11px] text-slate-400">
                            {formatDurasi(v.info.durasi)} · {v.info.lebar}×{v.info.tinggi} ·{" "}
                            {Math.max(1, Math.ceil(v.info.durasi / Math.max(1, v.pengaturan.durasiPart)))}{" "}
                            part
                            {v.pengaturan.judul ? ` · "${v.pengaturan.judul.slice(0, 24)}"` : ""}
                            {v.bgInfo ? " · dgn background" : ""}
                          </span>
                        </span>
                      </button>
                      <span className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => pindahVideo(i, -1)}
                          disabled={i === 0}
                          title="Naikkan urutan"
                          className="rounded-md border border-slate-600 p-1 text-slate-400 transition hover:border-amber-400 hover:text-amber-300 disabled:opacity-30"
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => pindahVideo(i, 1)}
                          disabled={i === daftar.length - 1}
                          title="Turunkan urutan"
                          className="rounded-md border border-slate-600 p-1 text-slate-400 transition hover:border-amber-400 hover:text-amber-300 disabled:opacity-30"
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => hapusVideo(i)}
                          title="Hapus dari antrean"
                          className="rounded-md border border-slate-600 p-1 text-slate-400 transition hover:border-red-400 hover:text-red-300"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
                {daftar.length < BATAS_VIDEO && (
                  <JatuhBerkas
                    terima="video/*"
                    onFile={unggahVideo}
                    hint={`Tambah lagi — sisa ${BATAS_VIDEO - daftar.length} slot`}
                    sibuk={sibukVideo}
                    multiple
                  />
                )}
                <p className="flex items-center gap-1.5 text-[11px] text-slate-500">
                  <Info className="h-3 w-3 shrink-0" />
                  Total {daftar.length} video · {totalPart} part ·{" "}
                  {formatDurasi(totalDurasi)} video sumber. Klik video lalu atur di bawah.
                </p>
              </div>
            )}
          </Kartu>

          {videoAktif && (
            <PanelAtur
              pengaturan={videoAktif.pengaturan}
              onChange={gantiPengaturanAktif}
              bgInfo={videoAktif.bgInfo}
              onBgFile={unggahBg}
              onHapusBg={hapusBg}
              bgSibuk={sibukBg}
              durasiVideo={videoAktif.info.durasi}
              ukuranVideo={`${videoAktif.info.lebar}×${videoAktif.info.tinggi} · ${fmtUkuran(videoAktif.info.ukuran)}`}
              nomorVideo={aktif + 1}
              totalVideo={daftar.length}
              onTerapkanKeSemua={terapkanKeSemua}
            />
          )}
        </div>

        {videoAktif && (
          <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
            <Kartu
              judul="Pratinjau live"
              deskripsi={`Video #${aktif + 1} — ${videoAktif.info.nama}`}
              ikon={<MonitorPlay className="h-4 w-4" />}
            >
              <Preview
                srcUrl={`/api/file?p=${encodeURIComponent(videoAktif.info.file)}`}
                pengaturan={videoAktif.pengaturan}
                durasi={videoAktif.info.durasi}
                totalPart={Math.max(
                  1,
                  Math.ceil(
                    videoAktif.info.durasi / Math.max(1, videoAktif.pengaturan.durasiPart),
                  ),
                )}
              />
            </Kartu>
            <PanelEkspor
              daftar={daftar.map((v) => ({
                file: v.info.file,
                nama: v.info.nama,
                durasi: v.info.durasi,
                pengaturan: v.pengaturan,
              }))}
              opsiEkspor={opsiEkspor}
              onOpsiEkspor={setOpsiEkspor}
            />
            <button
              type="button"
              onClick={() => {
                setDaftar([]);
                setAktif(0);
              }}
              className="w-full rounded-xl border border-slate-700 py-2 text-xs text-slate-400 hover:border-slate-500 hover:text-slate-200"
            >
              Bersihkan antrean
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
