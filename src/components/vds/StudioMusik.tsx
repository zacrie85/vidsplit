"use client";

// VidSplit v0.15.0 — STUDIO MUSIK: mode aplikasi kedua (selain Mode Video).
// Kolom KIRI  = 1. Impor musik + info lagu (BPM/kunci/chord + BPM & durasi HASIL) + gelombang
// Kolom TENGAH= Pratinjau audio & visual + 6. Lirik & chord + 7. Ekspor (MP4/MP3/chord/lirik)
// Kolom KANAN= 2. Genre (lapisan/penuh) · 3. Tempo · 4. Karaoke · 5. Visual (di StudioMusikKanan.tsx)
// v0.15.0: slider PERUBAHAN MUSIK (asli ↔ genre), resolusi 9:16 bawaan, tombol kirim
// hasil MP4 ke Mode Video (edit judul/part/split), ukuran teks overlay bisa diatur.
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Download, FileMusic, ListMusic, Loader2, MonitorPlay, Music, Play, RefreshCw, Square, Trash2,
} from "lucide-react";
import { BarisSlider, JatuhBerkas, Kartu, ChipPilihan, fmtUkuran } from "@/components/vds/bits";
import { PanelGenre, PanelKaraoke, PanelTempo, PanelVisual, aturMusikDefault, type AturMusik } from "@/components/vds/StudioMusikKanan";
import { faktorWaktuStudio, bpmAman, parseLrc, formatWaktuLrc, transposeAuto, transposDgnPerubahan, geserVokalSemi, INFO_GENRE } from "@/lib/vidsplit/musik";
import type { BarisLirik, SegmenChord } from "@/lib/vidsplit/musik";

// v8 (v0.23.0): naikkan kunci — preferensi lama di-reset agar semua pengguna langsung
// mendapat SATU mode menu 2 "Versi genre" (Ganti instrumen/Musik baru/Lapisan dihapus)
// + register suara wanita baru (+4–5,5 st).
const KUNCI_ATUR = "vidsplit-musik-v8";

interface InfoLagu {
  file: string;
  nama: string;
  ukuran: number;
  durasi: number;
  bpm: number;
  fase: number;
  kunci: string;
  chord: SegmenChord[];
  gelombang: number[];
  /** v0.18.0 — true bila audio diekstrak dari file video (mp4/mkv) */
  ekstrak?: boolean;
}

interface InfoJobMusikUI {
  id: string;
  jenis: "proses" | "render" | "pisah";
  tahap: string;
  progres: number;
  pesan: string;
  judul: string;
  outputs: { video: string; file: string; ukuran: number }[];
  fileProses: string | null;
  fileMp3: string | null;
  error: string | null;
  selesai: boolean;
  batalDiminta: boolean;
  dibatalkan: boolean;
}

function urlMedia(rel: string, unduh = false): string {
  return `/api/file?p=${encodeURIComponent(rel)}${unduh ? "&dl=1" : ""}`;
}

export function StudioMusik({
  onKirimKeVideo,
}: {
  /** v0.15.0 — kirim hasil MP4 ekspor musik ke antrean Mode Video (judul/part/split) */
  onKirimKeVideo?: (file: string, nama: string, ukuran: number) => void;
}) {
  const [atur, setAtur] = useState<AturMusik>(aturMusikDefault);
  const [lagu, setLagu] = useState<InfoLagu | null>(null);
  const [sibukImpor, setSibukImpor] = useState(false);
  const [sibukAnalisis, setSibukAnalisis] = useState(false);
  const [jobP, setJobP] = useState<InfoJobMusikUI | null>(null); // job proses audio
  const [jobR, setJobR] = useState<InfoJobMusikUI | null>(null); // job render
  const [jobS, setJobS] = useState<InfoJobMusikUI | null>(null); // v0.19 — job pisah vokal & musik
  const [hasilProses, setHasilProses] = useState<{ wav: string; mp3: string } | null>(null);
  const [pratinjau, setPratinjau] = useState<string | null>(null);
  const [sibukPratinjau, setSibukPratinjau] = useState(false);
  const [pratinjauMulai, setPratinjauMulai] = useState(0);
  const [lirikTeks, setLirikTeks] = useState("");
  const [waktuBaris, setWaktuBaris] = useState<(number | null)[]>([]);
  const [sinkronAktif, setSinkronAktif] = useState(false);
  const [barisTandai, setBarisTandai] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // v0.18.0 — BPM manual: null = pakai deteksi otomatis; teks utk input bebas saat mengetik
  const [bpmManual, setBpmManual] = useState<number | null>(null);
  const [bpmTeks, setBpmTeks] = useState("");

  // ---------- persistensi pengaturan ----------
  useEffect(() => {
    try {
      const mentah = localStorage.getItem(KUNCI_ATUR);
      if (mentah) {
        const s = JSON.parse(mentah) as Partial<AturMusik>;
        setAtur((p) => ({ ...p, ...s, vis: { ...p.vis, ...(s.vis || {}) } }));
      }
    } catch { /* abaikan */ }
  }, []);
  useEffect(() => {
    try { localStorage.setItem(KUNCI_ATUR, JSON.stringify(atur)); } catch { /* abaikan */ }
  }, [atur]);

  const ubah = useCallback((u: Partial<AturMusik>) => setAtur((p) => ({ ...p, ...u })), []);

  // ---------- polling job ----------
  const pollJob = (id: string, selesai: (j: InfoJobMusikUI) => void) => {
    const timer = setInterval(async () => {
      try {
        const r = await fetch(`/api/musik/job?id=${id}`, { cache: "no-store" });
        const j = (await r.json()) as { ok: boolean; job?: InfoJobMusikUI };
        if (j.ok && j.job) {
          if (j.job.jenis === "proses") setJobP(j.job);
          else if (j.job.jenis === "pisah") setJobS(j.job); // v0.19 — pisah vokal & musik
          else setJobR(j.job);
          if (j.job.selesai || j.job.error) {
            clearInterval(timer);
            selesai(j.job);
          }
        }
      } catch { /* jaringan — coba lagi di tick berikutnya */ }
    }, 800);
  };

  // ---------- impor & analisis ----------
  const analisis = async (fileRel: string, nama: string, ukuran: number, ekstrak = false) => {
    setSibukAnalisis(true);
    try {
      const r = await fetch("/api/musik/analisis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file: fileRel }),
      });
      const j = (await r.json()) as {
        ok: boolean; error?: string; durasi?: number; bpm?: number; fase?: number;
        kunci?: string; chord?: SegmenChord[]; gelombang?: number[];
      };
      if (!j.ok) throw new Error(j.error || "Analisis gagal");
      setLagu({
        file: fileRel, nama, ukuran,
        durasi: j.durasi || 0, bpm: j.bpm || 120, fase: j.fase || 0,
        kunci: j.kunci || "-", chord: j.chord || [], gelombang: j.gelombang || [],
        ekstrak,
      });
      setHasilProses(null);
      setPratinjau(null);
      setBpmManual(null); // lagu baru → BPM kembali ke deteksi otomatis
      setBpmTeks("");
    } catch (e) {
      alert(`Analisis gagal: ${e instanceof Error ? e.message : e}`);
    } finally {
      setSibukAnalisis(false);
    }
  };

  const imporLagu = async (f: File) => {
    if (sibukImpor) return;
    setSibukImpor(true);
    try {
      const r = await fetch(`/api/upload?kind=audio&nama=${encodeURIComponent(f.name)}`, {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: f,
      });
      const j = (await r.json()) as { ok: boolean; file?: string; error?: string; ukuran?: number; ekstrakDariVideo?: boolean };
      if (!j.ok || !j.file) throw new Error(j.error || "Unggah gagal");
      await analisis(j.file, f.name, j.ukuran || f.size, !!j.ekstrakDariVideo);
    } catch (e) {
      alert(`Impor gagal: ${e instanceof Error ? e.message : e}`);
    } finally {
      setSibukImpor(false);
    }
  };

  // ---------- proses audio ----------
  const mulaiProses = () => {
    if (!lagu || jobP && !jobP.selesai) return;
    setHasilProses(null);
    fetch("/api/musik/proses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file: lagu.file, judul: lagu.nama.replace(/\.[^.]+$/, ""),
        genre: atur.genre, layerLevel: atur.layerLevel, karaoke: atur.karaoke,
        bpm: bpmEfe, fase: lagu.fase,
        mode: atur.mode, kecepatan: atur.kecepatan,
        grooveLevel: atur.grooveLevel, melodiLevel: atur.melodiLevel,
        melodiAsliLevel: atur.melodiAsliLevel, vokalLevel: atur.vokalLevel,
        variasi: atur.variasi,
        kemiripan: atur.kemiripan, transpose: atur.transpose,
        tingkatGenre: atur.tingkatGenre, tingkatMusik: atur.tingkatMusik,
        nadaLevel: atur.nadaLevel,
        genreVokal: atur.genreVokal, refVokal: atur.refVokal, tingkatVokal: atur.tingkatVokal, mesinVokal: atur.mesinVokal,
      }),
    })
      .then((r) => r.json())
      .then((j: { ok: boolean; id?: string; error?: string }) => {
        if (!j.ok || !j.id) throw new Error(j.error || "Gagal");
        pollJob(j.id, (job) => {
          if (job.fileProses && job.fileMp3 && !job.error) {
            setHasilProses({ wav: job.fileProses, mp3: job.fileMp3 });
          }
        });
      })
      .catch((e) => alert(e instanceof Error ? e.message : String(e)));
  };

  // ---------- pratinjau visual 10 dtk ----------
  const mulaiPratinjau = async () => {
    if (!hasilProses || sibukPratinjau) return;
    setSibukPratinjau(true);
    setPratinjau(null);
    try {
      const lirik = kumpulkanLirik();
      const r = await fetch("/api/musik/pratinjau", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wavRel: hasilProses.wav, judul: judulOverlay(), visual: atur.visual,
          opsiVisual: atur.vis, mulai: pratinjauMulai, lirik,
          chord: lagu?.chord || [], resolusi: atur.resolusi,
          faktor: faktorWaktuStudio({ genre: atur.genre, mode: atur.mode, kecepatan: atur.kecepatan }),
        }),
      });
      const j = (await r.json()) as { ok: boolean; file?: string; error?: string };
      if (!j.ok || !j.file) throw new Error(j.error || "Pratinjau gagal");
      setPratinjau(j.file);
    } catch (e) {
      alert(`Pratinjau gagal: ${e instanceof Error ? e.message : e}`);
    } finally {
      setSibukPratinjau(false);
    }
  };

  // ---------- lirik ----------
  const barisLirikTeks = lirikTeks.split(/\r?\n/).filter((b, i, a) => b.trim() || i < a.length - 1);
  const judulOverlay = () =>
    (atur.vis.teksJudul || "").trim() || (lagu?.nama.replace(/\.[^.]+$/, "") || "");

  const kumpulkanLirik = (): BarisLirik[] => {
    const hasil: BarisLirik[] = [];
    barisLirikTeks.forEach((teks, i) => {
      const t = waktuBaris[i];
      if (teks.trim() && typeof t === "number" && t >= 0) hasil.push({ mulai: t, teks: teks.trim() });
    });
    return hasil.sort((a, b) => a.mulai - b.mulai);
  };

  const tandaiWaktu = () => {
    const a = audioRef.current;
    if (!a || !sinkronAktif) return;
    const t = Math.round(a.currentTime * 100) / 100;
    setWaktuBaris((lama) => {
      const baru = [...lama];
      while (baru.length < barisLirikTeks.length) baru.push(null);
      baru[barisTandai] = t;
      return baru;
    });
    setBarisTandai((n) => Math.min(barisLirikTeks.length - 1, n + 1));
  };

  const imporLrc = async (f: File) => {
    const teks = await f.text();
    const baris = parseLrc(teks);
    if (!baris.length) {
      alert("Tidak ada baris berwaktu di .lrc itu — format: [00:12.34] teks lirik");
      return;
    }
    setLirikTeks(baris.map((b) => b.teks).join("\n"));
    setWaktuBaris(baris.map((b) => b.mulai));
    setBarisTandai(baris.length);
  };

  const jumlahBerwaktu = waktuBaris.filter((t) => typeof t === "number").length;

  // ---------- ekspor ----------
  const mulaiEkspor = () => {
    if (!lagu || (jobR && !jobR.selesai)) return;
    const lirik = kumpulkanLirik();
    fetch("/api/musik/render", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file: lagu.file, judul: judulOverlay(),
        genre: atur.genre, layerLevel: atur.layerLevel, karaoke: atur.karaoke,
        bpm: bpmEfe, fase: lagu.fase,
        mode: atur.mode, kecepatan: atur.kecepatan,
        grooveLevel: atur.grooveLevel, melodiLevel: atur.melodiLevel,
        melodiAsliLevel: atur.melodiAsliLevel, vokalLevel: atur.vokalLevel,
        variasi: atur.variasi,
        kemiripan: atur.kemiripan, transpose: atur.transpose,
        tingkatGenre: atur.tingkatGenre, tingkatMusik: atur.tingkatMusik,
        nadaLevel: atur.nadaLevel,
        genreVokal: atur.genreVokal, refVokal: atur.refVokal, tingkatVokal: atur.tingkatVokal, mesinVokal: atur.mesinVokal,
        visual: atur.visual, opsiVisual: atur.vis, resolusi: atur.resolusi,
        lirik, chord: lagu?.chord || [],
        audioSudahProses: !!hasilProses,
        wavSiap: hasilProses?.wav ?? null,
        fileMp3Siap: hasilProses?.mp3 ?? null,
      }),
    })
      .then((r) => r.json())
      .then((j: { ok: boolean; id?: string; error?: string }) => {
        if (!j.ok || !j.id) throw new Error(j.error || "Gagal");
        setJobR({
          id: j.id, jenis: "render", tahap: "menyiapkan", progres: 0, pesan: "Menyiapkan…",
          judul: "", outputs: [], fileProses: null, fileMp3: null, error: null,
          selesai: false, batalDiminta: false, dibatalkan: false,
        });
        pollJob(j.id, () => { /* status akhir sudah di-set pollJob */ });
      })
      .catch((e) => alert(e instanceof Error ? e.message : String(e)));
  };

  // ---------- pisah vokal & musik (v0.19.0 — vocal remover) ----------
  const mulaiPisah = () => {
    if (!lagu || (jobS && !jobS.selesai)) return;
    fetch("/api/musik/pisah", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file: lagu.file, judul: lagu.nama.replace(/\.[^.]+$/, "") }),
    })
      .then((r) => r.json())
      .then((j: { ok: boolean; id?: string; error?: string }) => {
        if (!j.ok || !j.id) throw new Error(j.error || "Gagal");
        pollJob(j.id, () => { /* status akhir sudah di-set pollJob */ });
      })
      .catch((e) => alert(e instanceof Error ? e.message : String(e)));
  };

  const batalJob = async (id: string) => {
    await fetch("/api/musik/job", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, aksi: "batal" }),
    });
  };

  const sibukProses = !!jobP && !jobP.selesai;
  const sibukRender = !!jobR && !jobR.selesai;
  // v0.18.0 — BPM efektif: manual (input user) kalau diisi, kalau tidak hasil deteksi
  const bpmEfe = bpmManual ?? (lagu ? lagu.bpm : 120);
  // BPM & durasi HASIL — mengikuti resep tempo genre × kecepatan pilihan user
  const faktorWaktu = lagu ? faktorWaktuStudio({ genre: atur.genre, mode: atur.mode, kecepatan: atur.kecepatan }) : 1;
  const bpmHasil = lagu ? Math.round(bpmEfe * faktorWaktu) : 0;
  const durasiHasil = lagu ? lagu.durasi / faktorWaktu : 0;
  // v0.13.0 — transpos efektif mode remake (null = otomatis dari kemiripan + nama berkas);
  // v0.15.0 — dikalikan tingkat perubahan musik (0% → nada tetap, benar-benar asli)
  const transposeEfe = atur.mode === "remake"
    ? transposDgnPerubahan(
        atur.transpose ?? transposeAuto(atur.kemiripan, lagu?.file || ""), atur.tingkatMusik,
      )
    : 0;
  // v0.21.0 — register referensi genre vokal (dada-dalam/kepala-terang) ikut
  // menggeser nada dasar lagu (vokal + musik bergeser sama) — tampil di info.
  const geserRegister = atur.mode !== "penuh" && atur.mode !== "ganti" && atur.karaoke !== "karaoke"
    && atur.genreVokal !== "mati" && (atur.tingkatVokal ?? 55) > 0 && atur.mesinVokal !== "dsp"
    ? geserVokalSemi(atur.genreVokal, atur.refVokal, atur.tingkatVokal ?? 55)
    : 0;
  const fmtMenit = (d: number) => `${Math.floor(d / 60)}:${String(Math.max(0, Math.round(d % 60))).padStart(2, "0")}`;

  // ---------- render ----------
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,1fr)]">
      {/* ============ KOLOM KIRI ============ */}
      <div className="space-y-4">
        <Kartu
          judul="1. Impor musik"
          deskripsi="MP3 / WAV / M4A / OGG / FLAC · MP4 / MKV — audio maks 500 MB · video maks 2 GB"
          ikon={<Music className="h-4 w-4" />}
        >
          <JatuhBerkas
            terima="audio/*,.mp3,.wav,.m4a,.ogg,.flac,.mp4,.mkv,.webm,.mov,.m4v,.avi"
            hint="Klik / seret lagu ATAU video (MP4/MKV) — audio diekstrak otomatis lalu dianalisis (BPM, kunci, chord)"
            sibuk={sibukImpor || sibukAnalisis}
            onFile={imporLagu}
          />
          {sibukAnalisis && (
            <p className="mt-2 flex items-center gap-2 text-xs text-amber-300">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Menganalisis lagu…
            </p>
          )}
          {sibukImpor && (
            <p className="mt-2 flex items-center gap-2 text-xs text-cyan-300">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Mengunggah (video sedang diekstrak audionya — bisa agak lama)…
            </p>
          )}
          {lagu && (
            <div className="mt-3 space-y-2">
              <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-3">
                <p className="truncate text-sm font-medium text-slate-100" title={lagu.nama}>{lagu.nama}</p>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-400">
                  <span>{fmtUkuran(lagu.ukuran)}</span>
                  <span>{fmtMenit(lagu.durasi)}</span>
                  {lagu.ekstrak && (
                    <span className="rounded bg-cyan-400/10 px-1.5 py-0.5 text-cyan-300">audio dari video</span>
                  )}
                  <span>Kunci ≈ {lagu.kunci}</span>
                  <span>{lagu.chord.length} chord terdeteksi</span>
                </div>
                {/* v0.18.0 — BPM bisa diubah manual: angka deteksi dipakai sebagai titik awal */}
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                  <label className="flex items-center gap-1.5 text-slate-400">
                    BPM
                    <input
                      type="number"
                      inputMode="decimal"
                      min={30}
                      max={300}
                      step={0.1}
                      value={bpmTeks !== "" ? bpmTeks : Math.round(bpmEfe * 10) / 10}
                      onChange={(e) => setBpmTeks(e.target.value)}
                      onBlur={() => {
                        if (bpmTeks.trim() === "") { setBpmTeks(""); return; }
                        const n = bpmAman(bpmTeks, lagu.bpm);
                        setBpmManual(n);
                        setBpmTeks(""); // kosongkan → input kembali menampilkan nilai efektif
                      }}
                      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                      className="w-20 rounded-lg border border-slate-600 bg-slate-900 px-2 py-1 text-sm font-semibold text-amber-300 outline-none focus:border-amber-400"
                      title="Ketik BPM lalu Enter — 30 sampai 300, boleh desimal"
                    />
                  </label>
                  {bpmManual !== null && Math.abs(bpmManual - lagu.bpm) > 0.05 ? (
                    <span className="rounded bg-amber-400/10 px-1.5 py-0.5 text-amber-300">
                      manual (deteksi {Math.round(lagu.bpm * 10) / 10})
                    </span>
                  ) : (
                    <span className="text-slate-500">deteksi otomatis</span>
                  )}
                  <button
                    type="button"
                    onClick={() => { setBpmManual(null); setBpmTeks(""); }}
                    disabled={bpmManual === null}
                    className="rounded-lg border border-slate-700 px-2 py-1 text-[11px] text-slate-300 transition hover:border-cyan-400/60 hover:text-cyan-300 disabled:opacity-40"
                  >
                    Pakai deteksi otomatis
                  </button>
                </div>
                {(faktorWaktu !== 1 || atur.mode === "penuh" || atur.mode === "ganti" || (atur.mode === "remake" && transposeEfe !== 0) || geserRegister !== 0) && (
                  <p className="mt-1 text-[11px] text-cyan-300/90">
                    Hasil ≈ <b>{bpmHasil} BPM</b> · {fmtMenit(durasiHasil)}
                    {atur.mode === "remake" && transposeEfe !== 0
                      ? ` · versi genre: nada dasar ${transposeEfe > 0 ? "+" : ""}${transposeEfe} semitone`
                      : ""}
                    {geserRegister !== 0
                      ? ` · suara baru: nada dasar ikut ${geserRegister > 0 ? "+" : ""}${geserRegister} semitone (register referensi)`
                      : ""}
                    {atur.mode === "remake" && atur.genre !== "asli"
                      ? ` · perubahan musik ${atur.tingkatMusik}% / asli ${100 - atur.tingkatMusik}% · rasa genre ${atur.tingkatGenre}%`
                      : ""}
                    {atur.mode === "remake" && atur.genre !== "asli" && atur.nadaLevel > 0
                      ? ` · nada tambahan ikut akor ${atur.nadaLevel}%`
                      : ""}
                    {atur.genreVokal !== "mati" ? " · vokal " : ""}
                    {atur.genreVokal !== "mati" ? `${atur.genreVokal} ${atur.tingkatVokal}%` : ""}
                    {atur.mode === "penuh" && atur.genre !== "asli" ? " · musik baru dari chord" : ""}
                    {atur.mode === "ganti" && atur.genre !== "asli"
                      ? ` · musik diganti instrumen ${INFO_GENRE[atur.genre].label}${atur.vokalLevel > 0 ? " + penyanyi asli" : " (instrumental)"}`
                      : ""}
                    {faktorWaktu !== 1 ? ` · tempo ${atur.kecepatan}×` : ""}
                  </p>
                )}
              </div>
              {/* gelombang mini */}
              <div className="flex h-12 items-center gap-[1.5px] overflow-hidden rounded-lg bg-slate-950/60 px-1.5">
                {lagu.gelombang.filter((_, i) => i % 12 === 0).slice(0, 64).map((v, i) => (
                  <span
                    key={i}
                    className="w-[3px] shrink-0 rounded-sm bg-cyan-400/70"
                    style={{ height: `${Math.max(6, v * 100)}%` }}
                  />
                ))}
              </div>
              <audio
                ref={audioRef}
                controls
                src={urlMedia(lagu.file)}
                className="w-full"
                preload="metadata"
              />
              <button
                type="button"
                onClick={() => {
                  setLagu(null);
                  setHasilProses(null);
                  setPratinjau(null);
                  setJobP(null);
                }}
                className="w-full rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-400 transition hover:border-red-400/60 hover:text-red-300"
              >
                Ganti lagu
              </button>
            </div>
          )}
        </Kartu>
        <div className="rounded-2xl border border-slate-700/60 bg-slate-900/40 p-4 text-[11px] leading-relaxed text-slate-500">
          <p className="mb-1 font-medium text-slate-400">Alur Studio Musik</p>
          Impor lagu → pilih <b className="text-slate-400">Remake (mirip asli)</b> atau genre lain
          & tempo → <b className="text-slate-400">Proses audio</b> dulu (dengarkan hasilnya) → intip
          visual → tulis lirik + sinkron → <b className="text-slate-400">Ekspor</b> untuk MP4 + MP3 + chord + lirik.
        </div>
      </div>

      {/* ============ KOLOM TENGAH ============ */}
      <div className="space-y-4">
        {/* pratinjau */}
        <Kartu
          judul="Pratinjau audio & visual"
          deskripsi="Proses dulu audio (genre/karaoke/layer), lalu intip gaya visualnya 10 detik"
          ikon={<FileMusic className="h-4 w-4" />}
        >
          {!lagu ? (
            <p className="rounded-xl border border-dashed border-slate-700 p-6 text-center text-sm text-slate-500">
              Impor lagu dulu di kolom kiri.
            </p>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={mulaiProses}
                  disabled={sibukProses || sibukRender}
                  className="flex items-center gap-2 rounded-lg bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {sibukProses ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                  {sibukProses ? "Memproses audio…" : "Proses audio (dengarkan hasil)"}
                </button>
                {sibukProses && jobP && (
                  <button
                    type="button"
                    onClick={() => batalJob(jobP.id)}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:border-red-400/60 hover:text-red-300"
                  >
                    <Square className="h-3.5 w-3.5" /> Batal
                  </button>
                )}
                {hasilProses && !sibukProses && (
                  <button
                    type="button"
                    onClick={mulaiPratinjau}
                    disabled={sibukPratinjau || sibukRender}
                    className="flex items-center gap-2 rounded-lg border border-amber-400/70 bg-amber-400/10 px-4 py-2 text-sm font-medium text-amber-200 transition hover:bg-amber-400/20 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {sibukPratinjau ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                    Intip visual 10 dtk
                  </button>
                )}
              </div>
              {jobP && !jobP.selesai && (
                <div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                    <div className="h-full rounded-full bg-amber-400 transition-all" style={{ width: `${jobP.progres}%` }} />
                  </div>
                  <p className="mt-1 text-[11px] text-slate-400">{jobP.pesan} ({jobP.progres}%)</p>
                </div>
              )}
              {jobP?.error && (
                <p className="rounded-lg border border-red-500/40 bg-red-500/10 p-2 text-xs text-red-300">{jobP.error}</p>
              )}
              {hasilProses && (
                <div className="space-y-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3">
                  <p className="text-xs font-medium text-emerald-300">Audio hasil proses — siap didengar:</p>
                  <audio controls src={urlMedia(hasilProses.mp3)} className="w-full" preload="metadata" />
                  <a
                    href={urlMedia(hasilProses.mp3, true)}
                    className="inline-flex items-center gap-1.5 text-xs text-emerald-300 underline-offset-2 hover:underline"
                  >
                    <Download className="h-3.5 w-3.5" /> Unduh MP3 320 kbps
                  </a>
                </div>
              )}
              {hasilProses && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">Intip dari menit</span>
                  <input
                    type="number"
                    min={0}
                    max={Math.max(0, Math.floor(durasiHasil - 10))}
                    value={Math.floor(pratinjauMulai / 60)}
                    onChange={(e) => setPratinjauMulai(Math.max(0, Number(e.target.value) * 60))}
                    className="w-16 rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-100"
                  />
                  <span className="text-[11px] text-slate-500">(10 detik, gunakan utk cek lirik/chord di tengah lagu)</span>
                </div>
              )}
              {(sibukPratinjau || pratinjau) && (
                <div className="overflow-hidden rounded-xl border border-slate-700/60 bg-black">
                  {sibukPratinjau ? (
                    <div className="flex h-48 items-center justify-center text-sm text-slate-400">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Merender pratinjau visual…
                    </div>
                  ) : pratinjau ? (
                    <video controls src={urlMedia(pratinjau)} className="w-full" preload="metadata" />
                  ) : null}
                </div>
              )}
              {pratinjau && (
                <button
                  type="button"
                  onClick={() => setPratinjau(null)}
                  className="text-[11px] text-slate-500 hover:text-slate-300"
                >
                  Tutup pratinjau visual
                </button>
              )}
            </div>
          )}
        </Kartu>

        {/* 6. lirik & chord */}
        <Kartu
          judul="6. Lirik & chord"
          deskripsi="Tulis lirik (1 baris = 1 layar). Chord terdeteksi otomatis — tampil di atas lirik saat ekspor."
          ikon={<ListMusic className="h-4 w-4" />}
        >
          <div className="space-y-2.5">
            <textarea
              value={lirikTeks}
              onChange={(e) => {
                setLirikTeks(e.target.value);
              }}
              rows={6}
              placeholder={"Baris pertama lirik…\nBaris kedua…\n(kosongkan bila tak perlu lirik)"}
              className="w-full resize-y rounded-lg border border-slate-700 bg-slate-800/70 px-3 py-2 text-sm text-slate-100 outline-none focus:border-amber-400/70"
            />
            <div className="flex flex-wrap items-center gap-2">
              <label className="cursor-pointer rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:border-slate-500">
                Impor .lrc
                <input
                  type="file"
                  accept=".lrc,.txt"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void imporLrc(f);
                    e.target.value = "";
                  }}
                />
              </label>
              {!sinkronAktif ? (
                <button
                  type="button"
                  onClick={() => {
                    setSinkronAktif(true);
                    setBarisTandai(waktuBaris.findIndex((t) => t === null) < 0 ? barisLirikTeks.length - 1 : waktuBaris.findIndex((t) => t === null));
                    audioRef.current?.play().catch(() => undefined);
                  }}
                  disabled={!lagu || !lirikTeks.trim()}
                  className="flex items-center gap-1.5 rounded-lg border border-amber-400/70 bg-amber-400/10 px-3 py-1.5 text-xs text-amber-200 hover:bg-amber-400/20 disabled:opacity-50"
                >
                  <Play className="h-3.5 w-3.5" /> Sinkron lirik (ketuk sambil diputar)
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={tandaiWaktu}
                    className="rounded-lg bg-amber-400 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-amber-300"
                  >
                    Tandai baris #{barisTandai + 1} pada detik ini
                  </button>
                  <button
                    type="button"
                    onClick={() => { setSinkronAktif(false); audioRef.current?.pause(); }}
                    className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:border-slate-500"
                  >
                    Selesai sinkron
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => { setWaktuBaris([]); setBarisTandai(0); setSinkronAktif(false); }}
                className="flex items-center gap-1 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs text-slate-500 hover:border-red-400/60 hover:text-red-300"
              >
                <Trash2 className="h-3.5 w-3.5" /> Hapus waktu
              </button>
              <span className="text-[11px] text-slate-500">
                {barisLirikTeks.filter((b) => b.trim()).length} baris · {jumlahBerwaktu} sudah berwaktu
              </span>
            </div>
            {barisLirikTeks.length > 0 && (
              <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950/50 p-2 text-xs">
                {barisLirikTeks.map((b, i) => (
                  <div key={i} className={`flex gap-2 py-0.5 ${i === barisTandai && sinkronAktif ? "text-amber-300" : b.trim() ? "text-slate-300" : "text-slate-600"}`}>
                    <span className="w-14 shrink-0 font-mono text-[10px] text-slate-500">
                      {typeof waktuBaris[i] === "number" ? formatWaktuLrc(waktuBaris[i]!) : "—"}
                    </span>
                    <span className="truncate">{b || "(kosong)"}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Kartu>

        {/* 7. ekspor */}
        <Kartu
          judul="7. Ekspor video musik"
          deskripsi="MP4 visualizer + MP3 320 kbps + berkas chord & lirik — hasil juga masuk Riwayat ekspor"
          ikon={<Download className="h-4 w-4" />}
        >
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <p className="mb-1 text-xs text-slate-400">Resolusi &amp; rasio</p>
                <ChipPilihan<"916" | "720" | "1080">
                  nilai={atur.resolusi}
                  onChange={(v) => ubah({ resolusi: v })}
                  pilihan={[
                    { v: "916", label: "9:16 · 1080×1920", hint: "Reels/TikTok/Shorts (bawaan)" },
                    { v: "720", label: "16:9 · 720p", hint: "YouTube cepat" },
                    { v: "1080", label: "16:9 · 1080p", hint: "YouTube tajam" },
                  ]}
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={mulaiEkspor}
                disabled={!lagu || sibukRender || sibukProses}
                className="flex items-center gap-2 rounded-lg bg-amber-400 px-5 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sibukRender ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                {sibukRender ? "Merender…" : "Mulai ekspor (MP4 + MP3 + chord)"}
              </button>
              {sibukRender && jobR && (
                <button
                  type="button"
                  onClick={() => batalJob(jobR.id)}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:border-red-400/60 hover:text-red-300"
                >
                  <Square className="h-3.5 w-3.5" /> Batalkan
                </button>
              )}
            </div>
            {jobR && !jobR.selesai && (
              <div>
                <div className="h-2.5 overflow-hidden rounded-full bg-slate-800">
                  <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-amber-400 transition-all" style={{ width: `${jobR.progres}%` }} />
                </div>
                <p className="mt-1 text-[11px] text-slate-400">
                  {jobR.pesan} ({jobR.progres}%) — render visual CPU murni, sekecap 1-3× durasi lagu
                </p>
              </div>
            )}
            {jobR?.error && (
              <p className="rounded-lg border border-red-500/40 bg-red-500/10 p-2 text-xs text-red-300">{jobR.error}</p>
            )}
            {jobR?.selesai && !jobR.error && jobR.outputs.length > 0 && (
              <div className="space-y-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3">
                <p className="text-xs font-semibold text-emerald-300">Hasil ekspor siap:</p>
                {jobR.outputs.map((o) => (
                  <div key={o.file} className="flex items-center justify-between gap-2 text-xs">
                    <a href={urlMedia(`output/${jobR.id}/${o.file}`, true)} className="truncate text-slate-200 underline-offset-2 hover:text-amber-300 hover:underline">
                      {o.file}
                    </a>
                    <span className="shrink-0 text-slate-500">{fmtUkuran(o.ukuran)}</span>
                  </div>
                ))}
                <a
                  href={`/api/zip?id=${jobR.id}`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500/10"
                >
                  <Download className="h-3.5 w-3.5" /> Unduh semua (ZIP)
                </a>
                {(() => {
                  const mp4 = jobR.outputs.find((o) => o.file.toLowerCase().endsWith(".mp4"));
                  if (!mp4 || !onKirimKeVideo) return null;
                  return (
                    <button
                      type="button"
                      onClick={() =>
                        onKirimKeVideo(`output/${jobR.id}/${mp4.file}`, mp4.file, mp4.ukuran)
                      }
                      className="inline-flex items-center gap-1.5 rounded-lg bg-amber-400 px-3 py-1.5 text-xs font-semibold text-slate-950 transition hover:bg-amber-300"
                    >
                      <MonitorPlay className="h-3.5 w-3.5" />
                      Buka di Mode Video — edit judul, part, split &amp; ekspor
                    </button>
                  );
                })()}
              </div>
            )}
            {jobR?.dibatalkan && (
              <p className="rounded-lg border border-slate-600/40 bg-slate-800/40 p-2 text-xs text-slate-400">
                Ekspor dibatalkan — hasil parsial dibuang.
              </p>
            )}
          </div>
        </Kartu>
      </div>

      {/* ============ KOLOM KANAN ============ */}
      <div className="space-y-4">
        <PanelGenre atur={atur} ubah={ubah} />
        <PanelTempo atur={atur} ubah={ubah} />
        <PanelKaraoke
          atur={atur}
          ubah={ubah}
          pisah={{
            job: jobS,
            bisaMulai: !!lagu,
            mulai: mulaiPisah,
            batal: batalJob,
          }}
        />
        <PanelVisual atur={atur} ubah={ubah} judulLagu={lagu?.nama.replace(/\.[^.]+$/, "") || ""} />
      </div>
    </div>
  );
}
