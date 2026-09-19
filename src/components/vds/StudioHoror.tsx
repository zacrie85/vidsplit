"use client";

// VidSplit v0.25.0 — STUDIO HOROR: mode ketiga. AI cerita horor offline ->
// skrip bisa diedit -> pembaca skrip (TTS bawaan Windows) -> musik horor sintesis
// (volume diatur) -> video ilustrasi (kabut/grain/kilat) -> kirim ke Mode Video.
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  BookOpen, Download, Film, Ghost, Loader2, Mic, Music2, Play,
  RefreshCw, Send, Sparkles, Volume2, Wand2,
} from "lucide-react";
import { Kartu } from "@/components/vds/bits";
import type { Cerita } from "@/lib/vidsplit/hororCerita";
import type { InfoJobHoror } from "@/lib/vidsplit/hororJobs";

const KUNCI_ATUR = "vidsplit-horor-v2";

type TemaCerita = "acak" | "rumah" | "sekolah" | "kantor" | "desa";
type PanjangCerita = "pendek" | "sedang" | "panjang" | "bab10" | "bab15" | "bab20";
type Intensitas = "santai" | "menegangkan" | "menghantui";

const TEMA_CERITA: { id: TemaCerita; nama: string }[] = [
  { id: "acak", nama: "Acak" }, { id: "rumah", nama: "Rumah" },
  { id: "sekolah", nama: "Sekolah" }, { id: "kantor", nama: "Kantor" }, { id: "desa", nama: "Desa" },
];
const PANJANG: { id: PanjangCerita; nama: string; ket: string }[] = [
  { id: "pendek", nama: "Pendek", ket: "3 bab" }, { id: "sedang", nama: "Sedang", ket: "5 bab" },
  { id: "panjang", nama: "Panjang", ket: "5 bab + epilog" },
  { id: "bab10", nama: "10 Bab", ket: "cerita panjang" },
  { id: "bab15", nama: "15 Bab", ket: "saga" },
  { id: "bab20", nama: "20 Bab", ket: "super panjang" },
];
const INTENSITAS: { id: Intensitas; nama: string }[] = [
  { id: "santai", nama: "Santai" }, { id: "menegangkan", nama: "Menegangkan" }, { id: "menghantui", nama: "Menghantui" },
];
const TEMA_VISUAL: { id: string; nama: string }[] = [
  { id: "kelam", nama: "Kelam Api" }, { id: "kabut", nama: "Kabut Sawah" },
  { id: "darah", nama: "Darah Lama" }, { id: "purnama", nama: "Purnama Biru" },
];
const MUSIK_SINTELIS = { id: "sintesis", nama: "Sintesis bawaan (tanpa atribusi)" };
const MUSIK_BUNDEL_UI: { id: string; nama: string; kredit: string }[] = [
  { id: "horor-ambient", nama: "Horor Ambient", kredit: "Vinrax — CC-BY 3.0" },
  { id: "gedung", nama: "Gedung Terbengkalai", kredit: "tcarisland — CC-BY 3.0" },
  { id: "kedalaman", nama: "Kedalaman Keputusasaan", kredit: "Tsorthan Grove — CC-BY 4.0" },
];

interface SuaraTts { id: string; bahasa: string }

function Chip({ aktif, onClick, children }: { aktif: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className={`rounded-lg border px-3 py-1.5 text-sm transition ${
        aktif ? "border-amber-400/80 bg-amber-400/15 text-amber-300" : "border-slate-700 bg-slate-800/50 text-slate-300 hover:border-slate-600"
      }`}>
      {children}
    </button>
  );
}

export function StudioHoror({ onKirimKeVideo }: { onKirimKeVideo?: (file: string, nama: string, ukuran: number) => void }) {
  const [temaCerita, setTemaCerita] = useState<TemaCerita>("acak");
  const [panjang, setPanjang] = useState<PanjangCerita>("sedang");
  const [ide, setIde] = useState("");
  const [cerita, setCerita] = useState<Cerita | null>(null);
  const [membuatCerita, setMembuatCerita] = useState(false);

  const [narasi, setNarasi] = useState(true);
  const [suara, setSuara] = useState("");
  const [daftarSuara, setDaftarSuara] = useState<SuaraTts[]>([]);
  const [kecepatan, setKecepatan] = useState(1);
  const [volumeNarasi, setVolumeNarasi] = useState(1);

  const [intensitas, setIntensitas] = useState<Intensitas>("menegangkan");
  const [volumeMusik, setVolumeMusik] = useState(80); // persen
  const [sumberMusik, setSumberMusik] = useState("sintesis");
  const [musikImporRel, setMusikImporRel] = useState<string | null>(null);
  const [unggahMusik, setUnggahMusik] = useState(false);

  const [temaVisual, setTemaVisual] = useState("kelam");
  const [ilustrasi, setIlustrasi] = useState(true);
  const [rasio, setRasio] = useState<"9:16" | "16:9">("9:16");
  const [resolusi, setResolusi] = useState<"720p" | "1080p">("1080p");

  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<InfoJobHoror | null>(null);
  const [batalDiminta, setBatalDiminta] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // muat preferensi
  useEffect(() => {
    try {
      const m = localStorage.getItem(KUNCI_ATUR);
      if (m) {
        const a = JSON.parse(m) as Partial<{
          narasi: boolean; kecepatan: number; volumeNarasi: number; intensitas: Intensitas;
          volumeMusik: number; temaVisual: string; rasio: string; resolusi: string;
          sumberMusik: string; ilustrasi: boolean;
        }>;
        if (typeof a.narasi === "boolean") setNarasi(a.narasi);
        if (a.kecepatan) setKecepatan(Math.min(1.5, Math.max(0.6, a.kecepatan)));
        if (typeof a.volumeNarasi === "number") setVolumeNarasi(a.volumeNarasi);
        if (a.intensitas) setIntensitas(a.intensitas);
        if (typeof a.volumeMusik === "number") setVolumeMusik(a.volumeMusik);
        if (a.temaVisual) setTemaVisual(a.temaVisual);
        if (a.sumberMusik) setSumberMusik(a.sumberMusik);
        if (typeof a.ilustrasi === "boolean") setIlustrasi(a.ilustrasi);
        if (a.rasio === "16:9") setRasio("16:9");
        if (a.resolusi === "720p") setResolusi("720p");
      }
    } catch { /* abaikan */ }
  }, []);

  const simpanAtur = useCallback((ubah: Record<string, unknown>) => {
    try {
      const lama = JSON.parse(localStorage.getItem(KUNCI_ATUR) || "{}");
      localStorage.setItem(KUNCI_ATUR, JSON.stringify({ ...lama, ...ubah }));
    } catch { /* abaikan */ }
  }, []);

  // daftar suara TTS
  useEffect(() => {
    fetch("/api/horor/suara").then((r) => r.json()).then((j) => {
      if (j.ok && Array.isArray(j.suara)) {
        setDaftarSuara(j.suara);
        if (!j.adaTts) setNarasi(false);
      }
    }).catch(() => setDaftarSuara([]));
  }, []);

  const buatCerita = async (seedBaru?: number) => {
    setMembuatCerita(true);
    try {
      const r = await fetch("/api/horor/cerita", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tema: temaCerita, panjang, seed: seedBaru, ide: ide.trim() || undefined }),
      });
      const j = (await r.json()) as { ok: boolean; cerita?: Cerita; error?: string };
      if (j.ok && j.cerita) {
        setCerita(j.cerita);
        toast.success(`Cerita "${j.cerita.judul}" siap — silakan sunting skripnya`);
      } else toast.error(j.error || "Gagal membuat cerita");
    } catch { toast.error("Gagal menghubungi server lokal"); }
    finally { setMembuatCerita(false); }
  };

  const suntingParagraf = (i: number, j: number, teks: string) => {
    setCerita((c) => {
      if (!c) return c;
      const bab = [...c.bab];
      const paragraf = [...bab[i].paragraf];
      paragraf[j] = teks;
      bab[i] = { ...bab[i], paragraf };
      return { ...c, bab };
    });
  };

  // polling job
  useEffect(() => {
    if (!jobId) return;
    const poll = async () => {
      try {
        const r = await fetch(`/api/horor/job?id=${jobId}`);
        const j = (await r.json()) as { ok: boolean; job?: InfoJobHoror };
        if (j.ok && j.job) {
          setJob(j.job);
          if (j.job.selesai) {
            if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
            setBatalDiminta(false);
            if (j.job.error) toast.error(`Render gagal: ${j.job.error}`);
            else if (j.job.dibatalkan) toast.info("Render dibatalkan");
            else toast.success("Video horor selesai dibuat!");
          }
        }
      } catch { /* jaringan lokal — coba lagi */ }
    };
    poll();
    pollRef.current = setInterval(poll, 900);
    return () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
  }, [jobId]);

  const unggahMusikPilihan = async (f: File | undefined) => {
    if (!f) return;
    setUnggahMusik(true);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const r = await fetch("/api/upload?kind=audio&nama=" + encodeURIComponent(f.name), { method: "POST", body: fd });
      const j = (await r.json()) as { ok: boolean; file?: string; error?: string };
      if (j.ok && j.file) {
        setMusikImporRel(j.file);
        setSumberMusik("impor");
        toast.success("Musik impormu siap dipakai");
      } else toast.error(j.error || "Gagal mengunggah musik");
    } catch { toast.error("Gagal menghubungi server lokal"); }
    finally { setUnggahMusik(false); }
  };

  const buatVideo = async () => {
    if (!cerita || jobId && !job?.selesai) return;
    if (cerita.bab.some((b) => b.paragraf.every((p) => !p.trim()))) {
      toast.error("Ada bab yang semua paragrafnya kosong — isi atau hapus dulu");
      return;
    }
    try {
      const r = await fetch("/api/horor/render", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cerita, judul: cerita.judul, narasi,
          kecepatanNarasi: kecepatan, volumeNarasi,
          suaraNarasi: suara || undefined,
          intensitasMusik: intensitas,
          volumeMusik: volumeMusik / 100,
          rasio, resolusi, temaId: temaVisual,
          sumberMusik, musikImporRel: musikImporRel ?? undefined,
          ilustrasi,
        }),
      });
      const j = (await r.json()) as { ok: boolean; id?: string; error?: string };
      if (j.ok && j.id) { setJob(null); setJobId(j.id); toast.info("Render dimulai…"); }
      else toast.error(j.error || "Gagal mulai render");
    } catch { toast.error("Gagal menghubungi server lokal"); }
  };

  const batalkan = async () => {
    if (!jobId || job?.selesai) return;
    setBatalDiminta(true);
    try { await fetch(`/api/horor/job?id=${jobId}`, { method: "DELETE" }); } catch { /* abaikan */ }
  };

  const mp4 = job?.outputs?.[0] ?? null;
  const pathMp4 = mp4 && jobId ? `output/${jobId}/${mp4.file}` : null;

  return (
    <div className="space-y-4">
      {/* KOP */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-100">
            <Ghost className="h-5 w-5 text-rose-400" /> Studio Cerita Horor
            <span className="rounded-full border border-rose-400/40 bg-rose-400/10 px-2 py-0.5 text-[10px] font-semibold text-rose-300">AI v0.25.0</span>
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            100% offline: cerita dibuat mesin AI lokal, dibacakan suara bawaan perangkat, musik horor disintesis sendiri — bebas hak cipta.
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
        {/* ============ KIRI: CERITA & SKRIP ============ */}
        <div className="space-y-4">
          <Kartu
            judul="1. Buat Cerita (AI offline)"
            deskripsi="Tulis ide ceritamu (opsional) — kata kuncinya diikuti AI: lokasi, benda, penampakan, tema. Lalu biarkan mesin cerita menulis."
            ikon={<Sparkles className="h-4 w-4" />}
          >
            <textarea
              value={ide}
              rows={2}
              onChange={(e) => setIde(e.target.value)}
              placeholder="Contoh: anak yang pindah ke rumah dekat sumur tua, ada boneka misterius…"
              className="w-full resize-y rounded-xl border border-slate-700 bg-slate-800/70 px-3 py-2 text-sm text-slate-200 outline-none placeholder:text-slate-500 focus:border-amber-400/70"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              {TEMA_CERITA.map((t) => (
                <Chip key={t.id} aktif={temaCerita === t.id} onClick={() => setTemaCerita(t.id)}>{t.nama}</Chip>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {PANJANG.map((p) => (
                <Chip key={p.id} aktif={panjang === p.id} onClick={() => setPanjang(p.id)}>{p.nama} <span className="text-xs opacity-70">({p.ket})</span></Chip>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <button type="button" disabled={membuatCerita} onClick={() => buatCerita()}
                className="flex items-center gap-2 rounded-xl bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-amber-300 disabled:opacity-50">
                {membuatCerita ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />} Tulis Cerita
              </button>
              {cerita && (
                <button type="button" disabled={membuatCerita} onClick={() => buatCerita(Math.floor(Math.random() * 2 ** 31))}
                  className="flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300 transition hover:border-slate-500 disabled:opacity-50">
                  <RefreshCw className="h-4 w-4" /> Cerita Lain
                </button>
              )}
            </div>
          </Kartu>

          {cerita && (
            <Kartu
              judul="2. Skrip — bisa kamu sunting"
              deskripsi="Ubah judul, nama tokoh, atau detail kejadian. Yang tertulis di sini yang dibacakan & tampil di video."
              ikon={<BookOpen className="h-4 w-4" />}
            >
              <input value={cerita.judul} onChange={(e) => setCerita({ ...cerita, judul: e.target.value })}
                className="w-full rounded-xl border border-slate-700 bg-slate-800/70 px-4 py-2.5 text-base font-semibold text-slate-100 outline-none focus:border-amber-400/70"
                placeholder="Judul cerita" />
              <div className="mt-3 max-h-[420px] space-y-4 overflow-y-auto pr-1">
                {cerita.bab.map((bab, i) => (
                  <div key={i} className="rounded-xl border border-slate-800 bg-slate-900/40 p-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-rose-300/80">BAB {i + 1} — {bab.judul}</p>
                    {bab.paragraf.map((p, j) => (
                      <textarea key={j} value={p} rows={3} onChange={(e) => suntingParagraf(i, j, e.target.value)}
                        className="mb-2 w-full resize-y rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm leading-relaxed text-slate-200 outline-none focus:border-amber-400/60" />
                    ))}
                  </div>
                ))}
              </div>
            </Kartu>
          )}
        </div>

        {/* ============ KANAN: NARASI, MUSIK, VIDEO, HASIL ============ */}
        <div className="space-y-4">
          <Kartu
            judul="3. Pembaca Skrip"
            deskripsi={daftarSuara.length ? `${daftarSuara.length} suara bawaan perangkat ditemukan` : "Suara bawaan perangkat tidak tersedia — video tetap dibuat dengan musik saja"}
            ikon={<Mic className="h-4 w-4" />}
          >
            <label className="flex items-center justify-between">
              <span className="text-sm text-slate-300">Narasi (suara pembaca)</span>
              <button type="button" onClick={() => { setNarasi(!narasi); simpanAtur({ narasi: !narasi }); }}
                className={`h-6 w-11 rounded-full transition ${narasi ? "bg-amber-400" : "bg-slate-700"}`}>
                <span className={`block h-4 w-4 translate-y-1 rounded-full bg-white transition ${narasi ? "translate-x-6" : "translate-x-1"}`} />
              </button>
            </label>
            {narasi && (
              <div className="mt-3 space-y-3">
                {daftarSuara.length > 0 && (
                  <select value={suara} onChange={(e) => setSuara(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800/70 px-3 py-2 text-sm text-slate-200">
                    <option value="">Suara terbaik otomatis (Indonesia bila ada)</option>
                    {daftarSuara.map((s) => <option key={s.id} value={s.id}>{s.id} ({s.bahasa})</option>)}
                  </select>
                )}
                <label className="block text-xs text-slate-400">
                  Kecepatan baca: <b className="text-slate-200">{kecepatan.toFixed(2)}×</b>
                  <input type="range" min={60} max={150} value={Math.round(kecepatan * 100)}
                    onChange={(e) => { const v = Number(e.target.value) / 100; setKecepatan(v); simpanAtur({ kecepatan: v }); }}
                    className="mt-1 w-full accent-amber-400" />
                </label>
                <label className="block text-xs text-slate-400">
                  Volume suara: <b className="text-slate-200">{Math.round(volumeNarasi * 100)}%</b>
                  <input type="range" min={10} max={150} value={Math.round(volumeNarasi * 100)}
                    onChange={(e) => { const v = Number(e.target.value) / 100; setVolumeNarasi(v); simpanAtur({ volumeNarasi: v }); }}
                    className="mt-1 w-full accent-amber-400" />
                </label>
              </div>
            )}
          </Kartu>

          <Kartu
            judul="4. Musik Horor (backsound)"
            deskripsi="Sintesis bawaan dibuat sendiri (bebas total). Trek MP3 bebas-dipakai CC-BY (kredit tampil otomatis). Bisa juga impormu sendiri."
            ikon={<Music2 className="h-4 w-4" />}
          >
            <div className="flex flex-wrap gap-2">
              <Chip aktif={sumberMusik === "sintesis"} onClick={() => { setSumberMusik("sintesis"); simpanAtur({ sumberMusik: "sintesis" }); }}>{MUSIK_SINTELIS.nama}</Chip>
              {MUSIK_BUNDEL_UI.map((m) => (
                <Chip key={m.id} aktif={sumberMusik === m.id} onClick={() => { setSumberMusik(m.id); simpanAtur({ sumberMusik: m.id }); }}>{m.nama}</Chip>
              ))}
              <Chip aktif={sumberMusik === "impor"} onClick={() => { if (!musikImporRel) { document.getElementById("unggah-musik-horor")?.click(); return; } setSumberMusik("impor"); }}>Impor MP3 sendiri</Chip>
            </div>
            <input id="unggah-musik-horor" type="file" accept="audio/*" className="hidden"
              onChange={(e) => { void unggahMusikPilihan(e.target.files?.[0]); e.currentTarget.value = ""; }} />
            <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
              {sumberMusik === "sintesis" && "Musik disintesis langsung di aplikasi — drone, detak jantung, bisikan, stinger. 100% bebas hak cipta."}
              {sumberMusik === "horor-ambient" && "Kredit: \u201CHorror Ambient\u201D oleh Vinrax — CC-BY 3.0 (opengameart.org)."}
              {sumberMusik === "gedung" && "Kredit: \u201CAbandoned Building Ambience\u201D oleh tcarisland — CC-BY 3.0 (opengameart.org)."}
              {sumberMusik === "kedalaman" && "Kredit: \u201CDepth of Despair\u201D oleh Tsorthan Grove — CC-BY 4.0 (opengameart.org)."}
              {sumberMusik === "impor" && (musikImporRel ? "Memakai musik impormu sendiri." : "Pilih berkas MP3/WAV dari perangkatmu dulu.")}
            </p>
            <label className="mt-3 block text-xs text-slate-400">
              Volume musik: <b className="text-slate-200">{volumeMusik}%</b>
              <input type="range" min={0} max={150} value={volumeMusik}
                onChange={(e) => { const v = Number(e.target.value); setVolumeMusik(v); simpanAtur({ volumeMusik: v }); }}
                className="mt-1 w-full accent-amber-400" />
            </label>
            <label className="mt-2 block text-xs text-slate-400">
              Intensitas musik sintesis:
              <div className="mt-1 flex flex-wrap gap-2">
                {INTENSITAS.map((i) => (
                  <Chip key={i.id} aktif={intensitas === i.id} onClick={() => { setIntensitas(i.id); simpanAtur({ intensitas: i.id }); }}>{i.nama}</Chip>
                ))}
              </div>
            </label>
          </Kartu>

          <Kartu
            judul="5. Video Ilustrasi"
            deskripsi="Ilustrasi komik prosedural (rumah berhantu, pemakaman, hutan, sosok) + kabut digital + kilat + teks narasi."
            ikon={<Film className="h-4 w-4" />}
          >
            <label className="flex items-center justify-between">
              <span className="text-sm text-slate-300">Ilustrasi komik pada halaman</span>
              <button type="button" onClick={() => { setIlustrasi(!ilustrasi); simpanAtur({ ilustrasi: !ilustrasi }); }}
                className={`h-6 w-11 rounded-full transition ${ilustrasi ? "bg-amber-400" : "bg-slate-700"}`}>
                <span className={`block h-4 w-4 translate-y-1 rounded-full bg-white transition ${ilustrasi ? "translate-x-6" : "translate-x-1"}`} />
              </button>
            </label>
            <div className="mt-3 flex flex-wrap gap-2">
              {TEMA_VISUAL.map((t) => (
                <Chip key={t.id} aktif={temaVisual === t.id} onClick={() => { setTemaVisual(t.id); simpanAtur({ temaVisual: t.id }); }}>{t.nama}</Chip>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Chip aktif={rasio === "9:16"} onClick={() => { setRasio("9:16"); simpanAtur({ rasio: "9:16" }); }}>9:16 (Reels/Shorts)</Chip>
              <Chip aktif={rasio === "16:9"} onClick={() => { setRasio("16:9"); simpanAtur({ rasio: "16:9" }); }}>16:9 (YouTube)</Chip>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <Chip aktif={resolusi === "720p"} onClick={() => { setResolusi("720p"); simpanAtur({ resolusi: "720p" }); }}>720p</Chip>
              <Chip aktif={resolusi === "1080p"} onClick={() => { setResolusi("1080p"); simpanAtur({ resolusi: "1080p" }); }}>1080p</Chip>
            </div>

            <button type="button" disabled={!cerita || (!!jobId && !job?.selesai)} onClick={buatVideo}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-rose-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-400 disabled:opacity-50">
              <Ghost className="h-4 w-4" /> {jobId && !job?.selesai ? "Sedang merender…" : "Buat Video Horor"}
            </button>

            {job && !job.selesai && (
              <div className="mt-3">
                <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                  <div className="h-full rounded-full bg-rose-500 transition-all" style={{ width: `${job.progres}%` }} />
                </div>
                <p className="mt-1 flex items-center justify-between text-xs text-slate-400">
                  <span>{job.pesan}</span>
                  <button type="button" disabled={batalDiminta} onClick={batalkan}
                    className="text-rose-300 hover:text-rose-200 disabled:opacity-40">{batalDiminta ? "Menghentikan…" : "Batalkan"}</button>
                </p>
              </div>
            )}

            {job?.selesai && mp4 && pathMp4 && !job.error && (
              <div className="mt-3 space-y-2">
                <video controls className="w-full rounded-xl border border-slate-700" src={`/api/file?p=${encodeURIComponent(pathMp4)}`} />
                <div className="flex gap-2">
                  <a href={`/api/file?p=${encodeURIComponent(pathMp4)}&dl=1`} download={mp4.file}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:border-slate-500">
                    <Download className="h-4 w-4" /> Unduh MP4
                  </a>
                  {onKirimKeVideo && (
                    <button type="button"
                      onClick={() => onKirimKeVideo(pathMp4, mp4.file, mp4.ukuran)}
                      className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-amber-400 px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-300">
                      <Send className="h-4 w-4" /> Kirim ke Mode Video
                    </button>
                  )}
                </div>
              </div>
            )}
            {job?.selesai && job.error && (
              <p className="mt-2 rounded-lg border border-rose-500/40 bg-rose-500/10 p-2 text-xs text-rose-200">{job.error}</p>
            )}
          </Kartu>
        </div>
      </div>
    </div>
  );
}
