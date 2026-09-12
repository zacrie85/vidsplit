"use client";

// VidSplit — panel ekspor ANTREAN: semua video dirender berurutan dari atas ke bawah,
// progres per video, unduh per file / ZIP tersusun folder per video
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Ban,
  CheckCircle2,
  Cpu,
  Download,
  FileArchive,
  Loader2,
  Rocket,
  Square,
  Timer,
  XCircle,
  Zap,
} from "lucide-react";
import type { InfoJob } from "@/lib/vidsplit/jobs";
import type { SetelanTujuan } from "@/lib/vidsplit/tujuan";
import { durasiEfektif, slugify, type Pengaturan } from "@/lib/vidsplit/types";
import { BarisSlider, Kartu, fmtUkuran } from "./bits";
import { PanelTujuan } from "./PanelTujuan";

interface ItemVideo {
  file: string;
  nama: string;
  durasi: number;
  pengaturan: Pengaturan;
}

const LABEL_STATUS: Record<string, string> = {
  menunggu: "menunggu",
  proses: "merender…",
  selesai: "selesai",
  gagal: "gagal",
  dibatalkan: "dibatalkan",
};

export function PanelEkspor({
  daftar,
  opsiEkspor,
  onOpsiEkspor,
}: {
  daftar: ItemVideo[];
  opsiEkspor: { paralel: number; pakaiGpu: boolean };
  onOpsiEkspor: (o: { paralel: number; pakaiGpu: boolean }) => void;
}) {
  const [modeEkspor, setModeEkspor] = useState<"presisi" | "cepat">("presisi");
  const [job, setJob] = useState<InfoJob | null>(null);
  const [mulai, setMulai] = useState(false);
  const [batalKirim, setBatalKirim] = useState(false);
  const [setelanTujuan, setSetelanTujuan] = useState<SetelanTujuan | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  // polling status job
  useEffect(() => {
    if (!job || job.selesaiSemua || job.error) {
      if (timer.current) {
        clearInterval(timer.current);
        timer.current = null;
      }
      if (job?.selesaiSemua) {
        // beri tahu panel Riwayat agar menyegarkan daftarnya
        try {
          window.dispatchEvent(new Event("vidsplit:riwayat-berubah"));
        } catch {
          /* abaikan */
        }
        if (job.dibatalkan) {
          toast.warning(
            `Ekspor dibatalkan — ${job.outputs.length} part yang sudah jadi tetap bisa diunduh`,
          );
        } else {
          const gagal = job.antrean.filter((v) => v.status === "gagal").length;
          if (gagal > 0) {
            toast.warning(`Ekspor selesai — ${job.antrean.length - gagal} video jadi, ${gagal} gagal`);
          } else {
            toast.success(`Ekspor selesai — ${job.outputs.length} file siap unduh`);
          }
        }
        // v0.6.4 — kabari hasil penyalinan otomatis ke folder tujuan
        if (job.folderTersimpan && !job.peringatanSalin) {
          toast.success("Hasil tersalin ke folder tujuan — tinggal pakai, tanpa unduh ulang");
        }
        if (job.peringatanSalin) {
          toast.warning(job.peringatanSalin);
        }
      }
      if (job?.error && !job.selesaiSemua) toast.error(`Ekspor gagal: ${job.error}`);
      return;
    }
    if (!timer.current) {
      timer.current = setInterval(async () => {
        try {
          const r = await fetch(`/api/job?id=${job.id}`, { cache: "no-store" });
          const j = (await r.json()) as { ok: boolean; job?: InfoJob };
          if (j.ok && j.job) setJob(j.job);
        } catch {
          /* biarkan dicoba lagi */
        }
      }, 800);
    }
    return () => {
      if (timer.current) {
        clearInterval(timer.current);
        timer.current = null;
      }
    };
  }, [job]);

  const ekspor = async () => {
    // v0.6.4 — ingatkan bila simpan otomatis aktif tapi folder tujuan belum dipilih
    if (setelanTujuan?.otomatis && !setelanTujuan?.folder) {
      toast.warning(
        "Simpan otomatis aktif tapi folder tujuan belum dipilih — hasil hanya bisa diunduh dari aplikasi",
      );
    }
    setMulai(true);
    setBatalKirim(false);
    try {
      const r = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // daftar video diproses BERURUTAN dari atas; tiap video bawa pengaturannya sendiri
        body: JSON.stringify({
          daftar: daftar.map((v) => ({
            file: v.file,
            nama: v.nama,
            bg: v.pengaturan.bgId || undefined,
            logo: v.pengaturan.logoId || undefined,
            pengaturan: v.pengaturan,
          })),
          modeEkspor,
        }),
      });
      const j = (await r.json()) as { ok: boolean; id?: string; error?: string };
      if (!j.ok || !j.id) throw new Error(j.error || "Ekspor gagal dimulai");
      setJob({
        id: j.id,
        antrean: daftar.map((v) => ({
          nama: v.nama,
          total: Math.max(
            1,
            Math.ceil(
              durasiEfektif(v.durasi, v.pengaturan.mulaiDetik, v.pengaturan.akhirDetik) /
                Math.max(1, v.pengaturan.durasiPart),
            ),
          ),
          selesai: 0,
          status: "menunggu",
        })),
        videoAktif: 0,
        partAktif: 0,
        progresPart: 0,
        progresTotal: 0,
        outputs: [],
        error: null,
        adaGagal: false,
        selesaiSemua: false,
        batalDiminta: false,
        dibatalkan: false,
        dibuat: Date.now(),
        akselerasi: "mendeteksi…",
        paralel: opsiEkspor.paralel,
      });
      toast.info("Ekspor dimulai — video diproses berurutan dari atas");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ekspor gagal");
    } finally {
      setMulai(false);
    }
  };

  const totalProgres = job ? job.progresTotal : 0;
  const berjalan = !!job && !job.selesaiSemua;

  /** tombol Batalkan: minta server membunuh ffmpeg yang sedang merender */
  const batalkan = async () => {
    if (!job || job.selesaiSemua || batalKirim) return;
    setBatalKirim(true);
    try {
      const r = await fetch("/api/job", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: job.id, aksi: "batal" }),
      });
      const j = (await r.json()) as { ok: boolean; error?: string };
      if (!j.ok) throw new Error(j.error || "Gagal membatalkan");
      toast.info("Menghentikan proses… part yang sudah jadi tetap bisa diunduh");
    } catch (e) {
      setBatalKirim(false);
      toast.error(e instanceof Error ? e.message : "Gagal membatalkan");
    }
  };

  /** unduh ZIP (server-side streaming) — seluruh antrean atau satu video saja (v0.8.0) */
  const unduhZip = (video?: string) => {
    if (!job?.outputs.length) return;
    // ZIP dirakit DI SERVER secara streaming — memori browser tidak terbebani
    // (fix "Array buffer allocation failed" saat unduh semua video)
    const a = document.createElement("a");
    a.href = video
      ? `/api/zip?id=${job.id}&video=${encodeURIComponent(video)}`
      : `/api/zip?id=${job.id}`;
    a.download = video
      ? `vidsplit-${video.replace(/\.[^.]+$/, "")}.zip`
      : `vidsplit-antrean-${job.antrean.length}video.zip`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast.info(
      video
        ? `ZIP "${video}" mulai diunduh — berisi part video itu yang sudah selesai`
        : "ZIP mulai diunduh — dirakit di server, tinggal tunggu selesai",
    );
  };

  const ikonStatus = (status: string) => {
    if (status === "selesai") return <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />;
    if (status === "gagal") return <XCircle className="h-4 w-4 shrink-0 text-red-400" />;
    if (status === "dibatalkan") return <Ban className="h-4 w-4 shrink-0 text-slate-500" />;
    if (status === "proses") return <Loader2 className="h-4 w-4 shrink-0 animate-spin text-amber-400" />;
    return <span className="h-4 w-4 shrink-0 rounded-full border-2 border-slate-600" />;
  };

  return (
    <Kartu
      judul="6. Ekspor & split antrean"
      deskripsi="Semua video dirender berurutan dari atas ke bawah"
      ikon={<Rocket className="h-4 w-4" />}
    >
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setModeEkspor("presisi")}
          className={`rounded-xl border p-3 text-left transition ${
            modeEkspor === "presisi"
              ? "border-amber-400/80 bg-amber-400/15"
              : "border-slate-700 bg-slate-800/60 hover:border-slate-500"
          }`}
        >
          <span className="flex items-center gap-1.5 text-sm font-medium text-slate-100">
            <Timer className="h-4 w-4 text-amber-400" /> Presisi
          </span>
          <span className="mt-1 block text-[11px] text-slate-400">
            Potongan tepat di batas part, kualitas terbaik (agak lama)
          </span>
        </button>
        <button
          type="button"
          onClick={() => setModeEkspor("cepat")}
          className={`rounded-xl border p-3 text-left transition ${
            modeEkspor === "cepat"
              ? "border-amber-400/80 bg-amber-400/15"
              : "border-slate-700 bg-slate-800/60 hover:border-slate-500"
          }`}
        >
          <span className="flex items-center gap-1.5 text-sm font-medium text-slate-100">
            <Rocket className="h-4 w-4 text-amber-400" /> Cepat
          </span>
          <span className="mt-1 block text-[11px] text-slate-400">
            Render kilat untuk uji coba, kualitas standar
          </span>
        </button>
      </div>

      {/* kecepatan render */}
      <div className="mt-3 rounded-xl border border-slate-700/50 bg-slate-800/40 p-3">
        <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-slate-300">
          <Zap className="h-3.5 w-3.5 text-amber-400" /> Kecepatan render
        </p>
        <BarisSlider
          label="Proses paralel (part dalam satu video)"
          nilai={opsiEkspor.paralel}
          min={1}
          max={4}
          onChange={(n) => onOpsiEkspor({ ...opsiEkspor, paralel: n })}
          fmt={(n) => `${n} video kecil sekaligus`}
        />
        <button
          type="button"
          onClick={() => onOpsiEkspor({ ...opsiEkspor, pakaiGpu: !opsiEkspor.pakaiGpu })}
          className={`mt-2 flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-xs transition ${
            opsiEkspor.pakaiGpu
              ? "border-emerald-400/50 bg-emerald-400/10 text-emerald-200"
              : "border-slate-700 bg-slate-800/60 text-slate-400"
          }`}
        >
          <span className="flex items-center gap-1.5">
            <Cpu className="h-3.5 w-3.5" />
            Akselerasi GPU (NVIDIA / Intel / AMD)
          </span>
          <span className="font-medium">{opsiEkspor.pakaiGpu ? "Aktif" : "Mati"}</span>
        </button>
        <p className="mt-1.5 text-[11px] text-slate-500">
          Video diproses satu per satu sesuai urutan antrean; di dalam tiap video, part
          dirender {opsiEkspor.paralel} sekaligus. Video yang gagal dilewati, antrean lanjut.
        </p>
      </div>

      {/* v0.6.4 — folder tujuan hasil ekspor: pilih dulu, hasil otomatis tersalin */}
      <PanelTujuan job={job} setelan={setelanTujuan} onSetelan={setSetelanTujuan} />

      <button
        type="button"
        onClick={ekspor}
        disabled={berjalan || mulai || daftar.length === 0}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-amber-400 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {berjalan ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
        {berjalan
          ? "Sedang merender…"
          : `Mulai ekspor & split (${daftar.length} video berurutan)`}
      </button>

      {berjalan && (
        <button
          type="button"
          onClick={batalkan}
          disabled={batalKirim}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/60 bg-red-500/10 py-2.5 text-sm font-semibold text-red-300 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {batalKirim ? <Loader2 className="h-4 w-4 animate-spin" /> : <Square className="h-4 w-4" />}
          {batalKirim ? "Menghentikan proses…" : "Batalkan proses"}
        </button>
      )}

      {job && (
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>
              {job.antrean.filter((v) => v.status === "selesai").length}/{job.antrean.length}{" "}
              video · {job.partAktif > 0 ? `${job.partAktif} part serentak · ` : ""}
              selesai {job.outputs.length} file
            </span>
            <span className="font-medium text-slate-200">{totalProgres.toFixed(0)}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-300 transition-all"
              style={{ width: `${totalProgres}%` }}
            />
          </div>

          {/* status antrean per video */}
          <ul className="space-y-1">
            {job.antrean.map((v, i) => (
              <li
                key={`${v.nama}-${i}`}
                className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs ${
                  v.status === "gagal"
                    ? "border-red-500/40 bg-red-500/10 text-red-200"
                    : v.status === "proses"
                      ? "border-amber-400/50 bg-amber-400/10 text-amber-100"
                      : v.status === "dibatalkan"
                        ? "border-slate-700/60 bg-slate-800/50 text-slate-500"
                        : "border-slate-700/60 bg-slate-800/50 text-slate-300"
                }`}
              >
                {ikonStatus(v.status)}
                <span className="min-w-0 flex-1 truncate">
                  {i + 1}. {v.nama}
                </span>
                {/* v0.8.0 — video selesai → langsung bisa diunduh ZIP-nya tanpa nunggu antrean tuntas */}
                {v.status === "selesai" && (
                  <button
                    type="button"
                    onClick={() => unduhZip(v.nama)}
                    title={`Unduh ZIP ${v.selesai} part video ini`}
                    className="flex shrink-0 items-center gap-1 rounded-md border border-sky-400/50 px-1.5 py-0.5 text-[10px] text-sky-300 hover:bg-sky-400/10"
                  >
                    <FileArchive className="h-3 w-3" /> ZIP
                  </button>
                )}
                <span className="shrink-0 text-[10px] opacity-80">
                  {v.status === "proses"
                    ? `${v.selesai}/${v.total} part`
                    : LABEL_STATUS[v.status] ?? v.status}
                </span>
              </li>
            ))}
          </ul>

          {job.akselerasi && (
            <p className="flex items-center gap-1.5 text-[11px] text-slate-500">
              <Cpu className="h-3 w-3" /> Encoder: {job.akselerasi}
            </p>
          )}
          {job.error && (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300">{job.error}</p>
          )}
          {job.batalDiminta && !job.selesaiSemua && (
            <p className="flex items-center gap-1.5 rounded-lg bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
              <Ban className="h-3 w-3 shrink-0" /> Pembatalan diminta — menghentikan semua part…
            </p>
          )}
          {job.dibatalkan && job.selesaiSemua && (
            <p className="rounded-lg bg-slate-700/40 px-3 py-2 text-xs text-slate-300">
              Ekspor dibatalkan. {job.outputs.length} part yang sudah selesai tetap bisa diunduh di
              bawah.
            </p>
          )}
          {job.outputs.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between pt-1">
                <p className="text-xs text-slate-400">
                  Hasil ({job.outputs.length})
                  {!job.selesaiSemua && (
                    <span className="ml-1 text-[10px] text-emerald-300">· muncul otomatis begitu part selesai</span>
                  )}
                </p>
                {job.outputs.length > 1 && (
                  <button
                    type="button"
                    onClick={() => unduhZip()}
                    className="flex items-center gap-1.5 rounded-lg border border-sky-400/50 px-2.5 py-1.5 text-xs text-sky-300 hover:bg-sky-400/10"
                  >
                    <FileArchive className="h-3.5 w-3.5" />{" "}
                    {job.selesaiSemua ? "Unduh semua (ZIP per video)" : "Unduh hasil sejauh ini (ZIP)"}
                  </button>
                )}
              </div>
              <ul className="max-h-52 space-y-1 overflow-auto pr-1">
                {job.outputs.map((o, i) => (
                  <li
                    key={`${o.video}-${o.file}-${i}`}
                    className="flex items-center justify-between gap-2 rounded-lg border border-slate-700/60 bg-slate-800/50 px-2.5 py-1.5"
                  >
                    <span className="min-w-0 truncate text-xs text-slate-200">
                      <span className="text-slate-500">{slugify(o.video).slice(0, 18)}›</span>{" "}
                      {o.file}
                    </span>
                    <span className="shrink-0 text-[10px] text-slate-500">
                      {fmtUkuran(o.ukuran)}
                    </span>
                    <a
                      href={`/api/file?p=${encodeURIComponent(`output/${job.id}/${o.file}`)}&dl=1`}
                      download={o.file}
                      className="shrink-0 rounded-md border border-slate-600 p-1 text-slate-300 hover:border-amber-400 hover:text-amber-300"
                      title="Unduh file ini"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Kartu>
  );
}
