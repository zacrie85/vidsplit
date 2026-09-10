"use client";

// VidSplit — panel ekspor: mode presisi/cepat, progres per part, unduh per file / ZIP
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Cpu, Download, FileArchive, Loader2, Rocket, Timer, Zap } from "lucide-react";
import { zipSync } from "fflate";
import type { InfoJob } from "@/lib/vidsplit/jobs";
import { slugify, type Pengaturan } from "@/lib/vidsplit/types";
import { BarisSlider, Kartu, fmtUkuran } from "./bits";

interface InfoVideoClient {
  file: string;
  nama?: string;
  durasi: number;
}

export function PanelEkspor({
  videoInfo,
  pengaturan,
  onChange,
}: {
  videoInfo: InfoVideoClient;
  pengaturan: Pengaturan;
  onChange: (p: Pengaturan) => void;
}) {
  const [modeEkspor, setModeEkspor] = useState<"presisi" | "cepat">("presisi");
  const [job, setJob] = useState<InfoJob | null>(null);
  const [mulai, setMulai] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  // polling status job
  useEffect(() => {
    if (!job || job.selesaiSemua || job.error) {
      if (timer.current) {
        clearInterval(timer.current);
        timer.current = null;
      }
      if (job?.selesaiSemua) toast.success(`Ekspor selesai — ${job.outputs.length} file siap unduh`);
      if (job?.error) toast.error(`Ekspor gagal: ${job.error}`);
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
    setMulai(true);
    try {
      const r = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // bg = path background terpilih (relatif work utk web, absolut utk Electron) —
        // tanpa ini, intro background tidak pernah ikut ke hasil split
        body: JSON.stringify({
          file: videoInfo.file,
          bg: pengaturan.bgId || undefined,
          pengaturan,
          modeEkspor,
        }),
      });
      const j = (await r.json()) as { ok: boolean; id?: string; error?: string };
      if (!j.ok || !j.id) throw new Error(j.error || "Ekspor gagal dimulai");
      setJob({
        id: j.id,
        total: 0,
        selesai: 0,
        partAktif: 0,
        progresPart: 0,
        progresTotal: 0,
        outputs: [],
        error: null,
        selesaiSemua: false,
        dibuat: Date.now(),
        akselerasi: "mendeteksi…",
        paralel: pengaturan.prosesParalel || 2,
      });
      toast.info("Ekspor dimulai — duduk manis ya");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ekspor gagal");
    } finally {
      setMulai(false);
    }
  };

  const totalProgres = job
    ? Math.min(100, typeof job.progresTotal === "number"
        ? job.progresTotal
        : ((job.selesai + job.progresPart / 100) / Math.max(1, job.total)) * 100)
    : 0;

  const unduhZip = async () => {
    if (!job?.outputs.length) return;
    try {
      toast.info("Menyiapkan ZIP…");
      const fileBersih: Record<string, Uint8Array> = {};
      for (const o of job.outputs) {
        const r = await fetch(`/api/file?p=${encodeURIComponent(`output/${job.id}/${o.file}`)}&dl=1`);
        if (!r.ok) throw new Error(`Gagal ambil ${o.file}`);
        fileBersih[o.file] = new Uint8Array(await r.arrayBuffer());
      }
      fileBersih["BACA-SAYA.txt"] = new TextEncoder().encode(
        [
          "VidSplit — hasil split",
          `Judul: ${pengaturan.judul || "(tanpa judul)"}`,
          `Part: tiap ${pengaturan.durasiPart} detik, kata "${pengaturan.kataPart}"`,
          `Mode konversi: ${pengaturan.mode}, resolusi ${pengaturan.resolusi === "720" ? "720×1280" : "1080×1920"}`,
          `Intro background: ${pengaturan.bgId ? `${pengaturan.durasiIntro} detik tiap potongan` : "tidak dipakai"}`,
          "",
          `Isi (${job.outputs.length} file):`,
          ...job.outputs.map((o) => `- ${o.file} (${fmtUkuran(o.ukuran)})`),
        ].join("\n"),
      );
      const zip = zipSync(fileBersih, { level: 0 });
      const blob = new Blob([zip.buffer as ArrayBuffer], { type: "application/zip" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `vidsplit-${slugify(pengaturan.judul)}.zip`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast.success("ZIP siap, cek folder unduhan");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal bikin ZIP");
    }
  };

  const berjalan = !!job && !job.selesaiSemua && !job.error;

  return (
    <Kartu
      judul="5. Ekspor & split"
      deskripsi="Render tiap potongan + intro background di awalnya"
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
          label="Proses paralel"
          nilai={pengaturan.prosesParalel ?? 2}
          min={1}
          max={4}
          onChange={(n) => onChange({ ...pengaturan, prosesParalel: n })}
          fmt={(n) => `${n} video sekaligus`}
        />
        <button
          type="button"
          onClick={() => onChange({ ...pengaturan, pakaiGpu: !(pengaturan.pakaiGpu !== false) })}
          className={`mt-2 flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-xs transition ${
            pengaturan.pakaiGpu !== false
              ? "border-emerald-400/50 bg-emerald-400/10 text-emerald-200"
              : "border-slate-700 bg-slate-800/60 text-slate-400"
          }`}
        >
          <span className="flex items-center gap-1.5">
            <Cpu className="h-3.5 w-3.5" />
            Akselerasi GPU (NVIDIA / Intel / AMD)
          </span>
          <span className="font-medium">{pengaturan.pakaiGpu !== false ? "Aktif" : "Mati"}</span>
        </button>
        <p className="mt-1.5 text-[11px] text-slate-500">
          GPU dipakai otomatis kalau tersedia — kalau tidak, render tetap jalan di CPU.
          Paralel lebih tinggi = lebih cepat, tapi pakai lebih banyak CPU/RAM.
        </p>
      </div>

      <button
        type="button"
        onClick={ekspor}
        disabled={berjalan || mulai}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-amber-400 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {berjalan ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
        {berjalan ? "Sedang merender…" : "Mulai ekspor & split"}
      </button>

      {job && (
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>
              {job.paralel > 1 ? `${job.partAktif} part serentak · ` : ""}selesai {job.selesai}/{job.total}
            </span>
            <span className="font-medium text-slate-200">{totalProgres.toFixed(0)}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-300 transition-all"
              style={{ width: `${totalProgres}%` }}
            />
          </div>
          {job.akselerasi && (
            <p className="flex items-center gap-1.5 text-[11px] text-slate-500">
              <Cpu className="h-3 w-3" /> Encoder: {job.akselerasi}
            </p>
          )}
          {job.error && (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300">{job.error}</p>
          )}
          {job.outputs.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between pt-1">
                <p className="text-xs text-slate-400">Hasil ({job.outputs.length})</p>
                {job.selesaiSemua && job.outputs.length > 1 && (
                  <button
                    type="button"
                    onClick={unduhZip}
                    className="flex items-center gap-1.5 rounded-lg border border-sky-400/50 px-2.5 py-1.5 text-xs text-sky-300 hover:bg-sky-400/10"
                  >
                    <FileArchive className="h-3.5 w-3.5" /> Unduh semua (ZIP)
                  </button>
                )}
              </div>
              <ul className="max-h-52 space-y-1 overflow-auto pr-1">
                {job.outputs.map((o) => (
                  <li
                    key={o.file}
                    className="flex items-center justify-between gap-2 rounded-lg border border-slate-700/60 bg-slate-800/50 px-2.5 py-1.5"
                  >
                    <span className="min-w-0 truncate text-xs text-slate-200">{o.file}</span>
                    <span className="shrink-0 text-[10px] text-slate-500">{fmtUkuran(o.ukuran)}</span>
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
