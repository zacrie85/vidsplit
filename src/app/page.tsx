"use client";

// VidSplit — halaman utama: gerbang password → antrean multi-video (maks 100, v0.43.0) →
// atur tiap video → ekspor & split BERURUTAN dari video teratas sampai terbawah
// v0.46.0 — frame & bingkai: 7 frame hiasan bawaan + unggah PNG sendiri +
// frame neon berputar (7 warna, tebal 2-16, kecepatan 0.2-3x, dua garis) +
// mode Template halaman (judul/video/deskripsi/Part dalam kotak di atas gradasi)
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  AudioLines,
  Clapperboard,
  Wand2,
  Clock3,
  Ghost,
  Image as ImageIcon,
  ListVideo,
  Palette,
  Scissors,
  Music,
  Trash2,
  Type,
  Upload,
} from "lucide-react";
import { PanelEkspor } from "@/components/vds/PanelEkspor";
import { PanelRiwayat } from "@/components/vds/PanelRiwayat";
import {
  PanelCoverKino,
  PanelBacksound,
  PanelDeskripsi,
  PanelEfekKino,
  PanelFrame,
  PanelJudul,
  PanelMode,
  PanelPart,
  PanelPembicara,
  PanelRingkasan,
  PanelSubtitleKino,
} from "@/components/vds/BagianAtur";
import { gayaCoverValid } from "@/lib/vidsplit/types";
import { Preview } from "@/components/vds/Preview";
import { StudioMusik } from "@/components/vds/StudioMusik";
import { StudioHoror } from "@/components/vds/StudioHoror";
import { GerbangLayar, TombolGantiPassword, sudahTerbuka } from "@/components/vds/Gerbang";
import { JatuhBerkas, Kartu, fmtUkuran } from "@/components/vds/bits";
import {
  BATAS_VIDEO,
  durasiPartDipakai,
  formatDurasi,
  hitungPartV2,
  judulDariNama,
  migrasiSimpanan,
  pengaturanDefault,
  pratinjauPotret,
  rentangPartHapus,
  terapkanFrame,
  terapkanSebagian,
  terapkanUkuranHuruf,
  type BagianUkuran,
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
  logoInfo: { nama: string; ukuran: number } | null;
  /** v2.1.0 — info suara intro terpasang (nama file utk tampilan) */
  suaraInfo: { nama: string } | null;
}

interface OpsiEkspor {
  paralel: number;
  pakaiGpu: boolean;
  /** v2.1.0 — THUMBNAIL OTOMATIS (per antrean, tersimpan localStorage) */
  thumbnailAktif: boolean;
  thumbnailKata: "Part" | "Bagian" | "Episode";
  thumbnailFormat: "jpg" | "png";
  /** v2.3.0 — cakupan frame & gaya bingkai cover (v2.5.0: + "identik")
   *  v3.3.0 — gaya = id template cover (3 dasar / 100 NOVACUT) */
  thumbnailMode: "per-part" | "satu" | "identik";
  thumbnailGaya: string;
}

/* ============ v3.2.0 — GARIS WAKTU SPLIT ala KOLOSALCUT (components/kolosal/timeline.tsx)
 * Satu-satunya timeline (footer v3.1.1 dihapus): strip di bawah pratinjau ala
 * software video profesional — baris CHIP INFO (label split / jumlah part /
 * durasi / audio / judul, persis strip info Timeline KolosalCut) + bar segmen
 * proporsional durasi + kode waktu mulai–akhir. Murni tampilan — menghitung
 * ulang dgn fungsi yang SAMA dipakai ekspor (rentangPartHapus). */
function waktuHud(s: number): string {
  const t = Math.max(0, s);
  const m = Math.floor(t / 60);
  const d = Math.floor(t % 60);
  const p = Math.floor((t % 1) * 10);
  return `${String(m).padStart(2, "0")}:${String(d).padStart(2, "0")}.${p}`;
}

const MAKS_SEG_TIMELINE = 30;

function GarisWaktuSplit({
  pengaturan,
  durasiVideo,
  totalPart,
  adaAudio,
  judul,
}: {
  pengaturan: Pengaturan;
  durasiVideo: number;
  totalPart: number;
  adaAudio: boolean;
  judul?: string;
}) {
  const n = Math.min(totalPart, MAKS_SEG_TIMELINE);
  if (n < 1) return null;
  // v3.1.1 — teks adaptif: timecode & label hanya tampil bila segmen cukup lebar.
  // Dulu 189 part × timecode "00:00.0–00:20.0" dempet jadi satu deret huruf tak
  // terbaca ("berantakan") — kini bar tetap rapi, detail tetap ada lewat tooltip.
  const tampilWaktu = n <= 12;
  const tampilLabel = n <= 20;
  const dp = durasiPartDipakai(
    pengaturan,
    durasiVideo,
    pengaturan.mulaiDetik,
    pengaturan.akhirDetik,
    pengaturan.zonaHapus || [],
  );
  const segs = Array.from({ length: n }, (_, i) => {
    const [mulai, lamanya] = rentangPartHapus(
      i + 1,
      durasiVideo,
      dp,
      pengaturan.mulaiDetik,
      pengaturan.akhirDetik,
      pengaturan.zonaHapus || [],
    );
    return { i, mulai, lamanya: Math.max(0.1, lamanya) };
  });
  const total = segs.reduce((a, s) => a + s.lamanya, 0);
  const chip =
    "hud inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-sm border px-2 py-1 text-[9px] tracking-[0.12em]";
  return (
    <div className="flex flex-col gap-1.5">
      {/* ---- strip chip info ala Timeline KolosalCut (GAYA/N BAGIAN/durasi/AUDIO) ---- */}
      <div className="flex min-w-0 items-center gap-1.5 overflow-hidden">
        <span className={`${chip} border-amber-500/40 bg-amber-500/10 text-amber-400`}>
          <Scissors className="h-3 w-3" aria-hidden /> TIMELINE SPLIT
        </span>
        <span className={`${chip} border-slate-700 bg-slate-900/60 text-slate-300`}>
          {totalPart} part
          {totalPart > MAKS_SEG_TIMELINE ? ` (${MAKS_SEG_TIMELINE} pertama)` : ""}
        </span>
        <span className={`${chip} border-slate-700 bg-slate-900/60 text-slate-300`}>
          <Clock3 className="h-3 w-3" aria-hidden /> {waktuHud(total)}
        </span>
        <span
          className={`${chip} ${
            adaAudio
              ? "border-violet-500/40 bg-violet-500/10 text-violet-300"
              : "border-slate-700 bg-slate-900/40 text-slate-500"
          }`}
        >
          <AudioLines className="h-3 w-3" aria-hidden /> {adaAudio ? "AUDIO" : "TANPA AUDIO"}
        </span>
        {judul && (
          <span className="hud ml-auto hidden max-w-[34%] truncate text-[10px] text-slate-500 md:block">
            &ldquo;{judul}&rdquo;
          </span>
        )}
      </div>
      {/* ---- bar segmen proporsional — anti-luber (flexGrow + min-w-0 + gap-px) ---- */}
      <div className="flex h-14 w-full gap-px overflow-hidden rounded-sm border border-slate-800 bg-slate-950/60">
        {segs.map((s) => (
          <div
            key={s.i}
            style={{ flexGrow: s.lamanya, flexBasis: 0 }}
            title={`Part ${String(s.i + 1).padStart(2, "0")} · ${waktuHud(s.mulai)}–${waktuHud(s.mulai + s.lamanya)}`}
            className={`relative flex min-w-0 flex-col justify-between overflow-hidden px-1.5 py-1 ${
              s.i % 2 === 0 ? "bg-slate-900/70" : "bg-slate-900/35"
            } ${s.i === 0 ? "border-l-2 border-amber-500" : "border-l border-slate-800"}`}
          >
            {tampilLabel && (
              <span className="hud truncate text-[9px] font-bold text-slate-300">
                PART {String(s.i + 1).padStart(2, "0")}
              </span>
            )}
            {tampilWaktu && (
              <span className="hud truncate text-[8px] text-slate-500">
                {waktuHud(s.mulai)}–{waktuHud(s.mulai + s.lamanya)}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Halaman() {
  // gerbang password — "muat" dulu agar tidak berkedip, lalu terkunci/terbuka
  const [gerbang, setGerbang] = useState<"muat" | "terkunci" | "terbuka">("muat");
  const [dasar, setDasar] = useState<Pengaturan>(pengaturanDefault);
  const [daftar, setDaftar] = useState<VideoKerja[]>([]);
  const [aktif, setAktif] = useState(0);
  const [sibukVideo, setSibukVideo] = useState(false);
  // v0.46.0 — unggah frame hiasan
  const [sibukFrame, setSibukFrame] = useState(false);
  const [sibukLogo, setSibukLogo] = useState(false);
  const [opsiEkspor, setOpsiEkspor] = useState<OpsiEkspor>({
    paralel: 2,
    pakaiGpu: true,
    // v2.1.0 — thumbnail otomatis bawaan MATI
    thumbnailAktif: false,
    thumbnailKata: "Part",
    thumbnailFormat: "jpg",
    // v2.3.0 — bawaan: perilaku lama (tiap part beda frame) + gaya modern
    thumbnailMode: "per-part",
    thumbnailGaya: "modern",
  });
  // v0.58.0 — simpanan localStorage hanya boleh ditulis SETELAH preferensi lama
  // selesai dimuat: dulu efek simpan jalan di commit yang sama dgn state default
  // → simpanan lama sempat DITIMPA default (hilang bila aplikasi tutup mendadak)
  const termuatSimpan = useRef(false);
  // v0.58.0 — peringatan kuota penuh cukup SEKALI per sesi (dulu ditelan diam)
  const kuotaPeringatan = useRef(false);
  // v0.10.0 — sakelar Mode Video / Mode Musik (Studio Musik)
  // v0.25.0 — mode ketiga: Studio Horor (AI Cerita Horor)
  const [mode, setMode] = useState<"video" | "musik" | "horor">("video");
  // v3.2.0 — tab pengaturan ala KolosalCut (Video / Teks / Gaya / Cover)
  const [tabAtur, setTabAtur] = useState<"video" | "teks" | "gaya" | "efek" | "cover">("video");
  // v2.6.0 — tombol IMPOR MEDIA di topbar (input file tersembunyi; di desktop
  // memakai dialog natif Electron yang sama dgn JatuhBerkas)
  const refImpor = useRef<HTMLInputElement>(null);
  const klikImporMedia = () => {
    if (diDesktop) {
      void pilihVideoDesktop();
      return;
    }
    refImpor.current?.click();
  };
  useEffect(() => {
    try {
      const m = localStorage.getItem("vidsplit-mode-v1");
      if (m === "musik" || m === "video" || m === "horor") setMode(m);
    } catch { /* abaikan */ }
  }, []);
  const gantiMode = (m: "video" | "musik" | "horor") => {
    setMode(m);
    try { localStorage.setItem("vidsplit-mode-v1", m); } catch { /* abaikan */ }
  };

  // status gerbang dibaca dari sessionStorage (satu kali per sesi browser)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGerbang(sudahTerbuka() ? "terbuka" : "terkunci");
  }, []);

  // muat preferensi tersimpan (pengaturan dasar video baru + opsi ekspor)
  useEffect(() => {
    try {
      const mentah = localStorage.getItem(KUNCI_SIMPAN);
      if (mentah) {
        // v0.40.0 — migrasi font (v0.9.2) + ukuran bawaan lama→baru lewat fungsi murni
        // migrasiSimpanan() di types.ts (dites di uji-logo-bebas.ts)
        const simpanan = migrasiSimpanan(JSON.parse(mentah) as Partial<Pengaturan>);
        // sinkron pasca-hidrasi dgn preferensi tersimpan — pola memuat localStorage
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setDasar((p) => ({ ...p, ...simpanan }));
      }
      const eksporMentah = localStorage.getItem(KUNCI_EKSPOR);
      if (eksporMentah) {
        const o = JSON.parse(eksporMentah) as Partial<OpsiEkspor>;
        setOpsiEkspor({
          paralel: Math.min(10, Math.max(1, Math.round(Number(o.paralel) || 2))),
          pakaiGpu: o.pakaiGpu !== false,
          // v2.1.0 — thumbnail: nilai lama tanpa field → bawaan
          thumbnailAktif: o.thumbnailAktif === true,
          thumbnailKata: o.thumbnailKata === "Bagian" || o.thumbnailKata === "Episode" ? o.thumbnailKata : "Part",
          thumbnailFormat: o.thumbnailFormat === "png" ? "png" : "jpg",
          // v2.3.0 — cakupan & gaya: nilai lama tanpa field → bawaan (per-part/modern)
          // v2.5.0 — + "identik" (cover 100% sama semua, tanpa nomor part)
          thumbnailMode:
            o.thumbnailMode === "satu" || o.thumbnailMode === "identik" ? o.thumbnailMode : "per-part",
          // v3.3.0 — gaya kini id template: dasar lama ATAU "layout--palet"
          thumbnailGaya:
            typeof o.thumbnailGaya === "string" && gayaCoverValid(o.thumbnailGaya)
              ? o.thumbnailGaya
              : "modern",
        });
      }
    } catch {
      /* simpanan rusak — mulai dari default, JANGAN menimpa berkasnya di sini */
    } finally {
      termuatSimpan.current = true; // v0.58.0 — buka gerbang penyimpanan
    }
  }, []);

  // simpan preferensi (file sesi lokal — suara intro & logo — tidak ikut)
  useEffect(() => {
    if (!termuatSimpan.current) return;
    // v0.58.0 — DEBOUNCE 400 ms: dulu setiap gerakan slider menulis JSON penuh
    // serempak (puluhan×/dtk, kerja sinkron main-thread — jank di mesin lemah)
    const t = setTimeout(() => {
      try {
        localStorage.setItem(KUNCI_SIMPAN, JSON.stringify(dasar));
        localStorage.setItem(KUNCI_EKSPOR, JSON.stringify(opsiEkspor));
      } catch {
        if (!kuotaPeringatan.current) {
          kuotaPeringatan.current = true;
          toast.error("Penyimpanan preferensi penuh — setelan terakhir mungkin tidak tersimpan");
        }
      }
    }, 400);
    return () => clearTimeout(t);
  }, [dasar, opsiEkspor]);

  const videoAktif = daftar[aktif] ?? null;

  // v0.40.0 — mode desktop (Electron)? hanya dipakai utk memilih handler klik zona
  // unggah (dialog natif vs input HTML) — tidak memengaruhi render, aman dari hidrasi
  const diDesktop = typeof window !== "undefined" && !!window.vdsplitDesktop;

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
          // pengaturan baru mulai dari preferensi tersimpan; judul diisi OTOMATIS
          // dari nama file video — user tinggal ganti font bila perlu
          pengaturan: {
            ...(pengaturanTersimpan ? { ...pengaturanDefault } : dasar),
            judul: judulDariNama(nama),
          },
          logoInfo: null,
          suaraInfo: null,
        },
      ];
    });
    if (!masuk) {
      toast.error(`Antrean penuh — maksimal ${BATAS_VIDEO} video. "${nama}" dilewati.`);
      return;
    }
    const judulAuto = judulDariNama(nama);
    const potonganJudul = judulAuto
      ? judulAuto.length > 28
        ? judulAuto.slice(0, 28) + "…"
        : judulAuto
      : null;
    toast.success(
      `"${nama}" masuk antrean — ${formatDurasi(info.durasi)}` +
        (potonganJudul ? ` · judul otomatis: "${potonganJudul}"` : ""),
    );
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

  // v0.40.0 — perbaikan "impor harus 2x": mode desktop TIDAK lagi membuka dialog
  // Electron dari dalam handler unggah. Dulu: klik zona → dialog HTML terbuka →
  // user memilih file → handler melihat jembatan desktop → membuka dialog NATIF
  // kedua → user terpaksa memilih file sekali lagi sebelum video masuk. Kini alur
  // dipisah rapi:
  //   klik zona (desktop)    → pilihVideoDesktop() — SATU dialog natif, path langsung
  //   klik zona (web)        → input file HTML biasa
  //   seret-lepas (keduanya) → unggah HTTP lokal via unggahSatu()
  // v0.43.0 — antrean kini muat 100 video: unggahan banyak file (drop/klik-multi)
  // DISERIALKAN lewat rantai promise supaya urutan masuk antrean = urutan file
  // saat dipilih. Dulu tiap file balapan sendiri (unggah+probe paralel) → urutan
  // antrean bisa campur aduk; padahal urutan antrean = urutan proses ekspor.
  // Mode desktop sudah berurut sejak v0.40 (loop await satu-per-satu).
  const rantaiUnggah = useRef<Promise<void>>(Promise.resolve());
  const sibukUnggah = useRef(0);
  const unggahVideo = (f: File) => {
    sibukUnggah.current += 1;
    setSibukVideo(true);
    rantaiUnggah.current = rantaiUnggah.current
      .then(() => unggahSatu(f, BATAS_VIDEO - daftar.length))
      .catch((e: unknown) => {
        toast.error(e instanceof Error ? e.message : "Gagal impor video");
      })
      .finally(() => {
        sibukUnggah.current -= 1;
        if (sibukUnggah.current <= 0) setSibukVideo(false);
      });
  };

  /** mode desktop: dialog natif Electron utk antrean video — boleh pilih banyak */
  const pilihVideoDesktop = async () => {
    if (typeof window === "undefined" || !window.vdsplitDesktop) return;
    setSibukVideo(true);
    try {
      const dipilih = await window.vdsplitDesktop.pilih("video");
      if (!dipilih || !dipilih.length) return;
      let kuota = BATAS_VIDEO - daftar.length;
      for (const it of dipilih) {
        if (kuota <= 0) {
          toast.error(`Antrean penuh — maksimal ${BATAS_VIDEO} video. Sisanya dilewati.`);
          break;
        }
        await pasangVideo(it.path, it.nama, it.ukuran);
        kuota -= 1;
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal impor video");
    } finally {
      setSibukVideo(false);
    }
  };

  // v2.2.0 — handler BACKGROUND (unggahBg/pilihBgDesktop/hapusBg) DIHAPUS:
  // background intro kini frame otomatis dari video (PanelBackground hanya
  // mengatur introAktif/introPosisi lewat onChange biasa).

  // v0.40.0 — alur desktop & web dipisah (sama dgn unggahVideo): handler unggah murni
  // HTTP, dialog natif Elektron kini lewat pilihLogoDesktop() dari klik zona langsung
  const unggahLogo = async (f: File) => {
    if (!videoAktif) return;
    setSibukLogo(true);
    try {
      const r = await fetch(`/api/upload?kind=logo&nama=${encodeURIComponent(f.name)}`, {
        method: "POST",
        body: f,
        headers: { "Content-Type": "application/octet-stream" },
      });
      const j = (await r.json()) as { ok: boolean; file?: string; ukuran?: number; error?: string };
      if (!j.ok || !j.file) throw new Error(j.error || "Unggah logo gagal");
      perbaruiAktif((p) => ({ ...p, logoId: j.file as string }));
      setDaftar((d) =>
        d.map((v, i) =>
          i === aktif ? { ...v, logoInfo: { nama: f.name, ukuran: j.ukuran || f.size } } : v,
        ),
      );
      toast.success(`Logo "${f.name}" dipasang ke video #${aktif + 1}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal pasang logo");
    } finally {
      setSibukLogo(false);
    }
  };

  /** mode desktop: dialog natif Electron utk watermark video aktif */
  const pilihLogoDesktop = async () => {
    if (typeof window === "undefined" || !window.vdsplitDesktop || !videoAktif) return;
    setSibukLogo(true);
    try {
      const dipilih = await window.vdsplitDesktop.pilih("logo");
      if (!dipilih.length) return;
      const lg = dipilih[0];
      perbaruiAktif((p) => ({ ...p, logoId: lg.path }));
      setDaftar((d) =>
        d.map((v, i) =>
          i === aktif ? { ...v, logoInfo: { nama: lg.nama, ukuran: lg.ukuran } } : v,
        ),
      );
      toast.success(`Logo "${lg.nama}" dipasang ke video #${aktif + 1}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal pasang logo");
    } finally {
      setSibukLogo(false);
    }
  };

  const hapusLogo = () => {
    if (!videoAktif) return;
    perbaruiAktif((p) => ({ ...p, logoId: "" }));
    setDaftar((d) => d.map((v, i) => (i === aktif ? { ...v, logoInfo: null } : v)));
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

  // v0.15.0 — terima hasil MP4 dari Studio Musik → masuk antrean video → lompat ke Mode
  // Video dgn video tsb terpilih, siap diedit (judul/part/split/ekspor) seperti biasa.
  const kirimKeVideo = async (file: string, nama: string, ukuran: number) => {
    if (daftar.length >= BATAS_VIDEO) {
      toast.error(`Antrean penuh — maksimal ${BATAS_VIDEO} video. Bersihkan dulu antreannya.`);
      return;
    }
    try {
      await pasangVideo(file, nama, ukuran);
      setAktif(daftar.length);
      gantiMode("video");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal memindahkan video musik");
    }
  };

  // v0.38.0 — TERAPKAN SELEKTIF: yang mengikuti video sumber hanya kartu 1 (Cara
  // ubah ke vertikal), kartu 3 (Tulisan Part otomatis) & kartu 5 (Watermark/logo).
  // Tulisan judul (kartu 2) & background intro (kartu 4) TETAP milik tiap video.
  // v0.41.0 — ukuran huruf juga TETAP milik tiap video: gaya huruf Part ikut
  // sumber tapi ukurannya tidak (permintaan: "hanya ukuran videonya ya kawan
  // bukan judul dan part nya").
  // Metadata logo (logoInfo) ikut disalin agar kartu watermark tiap video langsung
  // menampilkan logo yang sama — cukup unggah SEKALI, tidak perlu ulang per video
  // (semua video berbagi berkas logo yang sama lewat logoId yang identik).
  const terapkanKeSemua = () => {
    if (!videoAktif) return;
    const s = videoAktif.pengaturan;
    const infoLogo = s.logoId ? videoAktif.logoInfo : null;
    setDaftar((d) =>
      d.map((v) => ({
        ...v,
        pengaturan: terapkanSebagian(s, v.pengaturan),
        logoInfo: infoLogo,
      })),
    );
    toast.success(
      s.logoId
        ? "Vertikal + Part otomatis + watermark diterapkan ke SEMUA video — judul & ukuran huruf tiap video tetap"
        : "Vertikal + Part otomatis diterapkan ke SEMUA video — judul & ukuran huruf tiap video tetap",
    );
  };

  // v0.42.0 — TERAPKAN UKURAN HURUF satu bagian (judul/Part/deskripsi) dari video
  // aktif ke SEMUA video — permintaan user: "saya ingin mengubah ukuran font bisa
  // diterapkan ke semua video". HANYA angka ukurannya yang disalin (font/warna/
  // outline tiap video tetap), dan preferensi video baru (dasar) ikut disamakan
  // agar impor berikutnya langsung seragam.
  const terapkanUkuranSemua = (bagian: BagianUkuran) => {
    if (!videoAktif) return;
    const s = videoAktif.pengaturan;
    const nilai =
      bagian === "judul"
        ? s.gayaJudul.ukuran
        : bagian === "part"
          ? s.gayaPart.ukuran
          : s.gayaDeskripsi.ukuran;
    setDaftar((d) =>
      d.map((v) => ({ ...v, pengaturan: terapkanUkuranHuruf(s, v.pengaturan, bagian) })),
    );
    setDasar((p) => terapkanUkuranHuruf(s, p, bagian));
    const label = bagian === "judul" ? "judul" : bagian === "part" ? "Part" : "deskripsi";
    toast.success(
      `Ukuran huruf ${label} ${nilai} diterapkan ke SEMUA video (${daftar.length}) — font & warna tiap video tetap`,
    );
  };

  // v0.44.0 — TERAPKAN SUBTITLE AI (aktif/ukuran/posisi) video aktif ke SEMUA video.
  // v0.46.0 — unggah frame hiasan PNG (jendela transparan) — jalur kind=bg
  // (gambar 25 MB ke work/upload, validasi sama dgn background)
  const unggahFrame = async (f: File) => {
    if (!videoAktif) return;
    setSibukFrame(true);
    try {
      const r = await fetch(`/api/upload?kind=bg&nama=${encodeURIComponent(f.name)}`, {
        method: "POST",
        body: f,
        headers: { "Content-Type": "application/octet-stream" },
      });
      const j = (await r.json()) as { ok: boolean; file?: string; ukuran?: number; error?: string };
      if (!j.ok || !j.file) throw new Error(j.error || "Unggah frame gagal");
      perbaruiAktif((p) => ({ ...p, frameId: j.file as string }));
      toast.success(`Frame "${f.name}" dipasang ke video #${aktif + 1} — video tampil lewat jendela transparannya`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Unggah frame gagal");
    } finally {
      setSibukFrame(false);
    }
  };

  // v0.46.0 — terapkan seluruh setelan frame & bingkai video aktif ke SEMUA video
  const terapkanFrameKeSemua = () => {
    if (!videoAktif) return;
    const s = videoAktif.pengaturan;
    setDaftar((d) => d.map((v) => ({ ...v, pengaturan: terapkanFrame(s, v.pengaturan) })));
    toast.success("Frame & bingkai diterapkan ke semua video dalam antrean");
  };

  // v2.5.0 — TERAPKAN SETELAN INTRO (+ suara intro) video aktif ke SEMUA video
  // (permintaan user: "buatkan pilihan di terapkan kesemua video untuk settingannya
  // yang telah di pilih" di menu 6. Cover & Intro). Preferensi video baru (dasar)
  // ikut disamakan agar impor berikutnya langsung seragam.
  const terapkanIntroKeSemua = () => {
    if (!videoAktif) return;
    const s = videoAktif.pengaturan;
    const inti = {
      introAktif: s.introAktif,
      introPosisi: s.introPosisi,
      durasiIntro: s.durasiIntro,
      introAnimasi: s.introAnimasi,
      introFade: s.introFade,
      introTampil: s.introTampil,
      introTeksFont: s.introTeksFont,
      introTeksUkuran: s.introTeksUkuran,
      introTeksWarna: s.introTeksWarna,
      introSuaraFile: s.introSuaraFile,
      introSuaraVolume: s.introSuaraVolume,
      introTemplate: s.introTemplate, // v3.3.0 — jaga-jaga simpanan lama
      // v3.4.0 — MENU COVER KINOSTRA ikut utuh
      coverSumber: s.coverSumber,
      coverFile: s.coverFile,
      coverJudul: s.coverJudul,
      coverLayout: s.coverLayout,
      coverPalet: s.coverPalet,
      coverLatar: s.coverLatar,
      coverBingkai: s.coverBingkai,
      coverKataPart: s.coverKataPart,
      coverSkalaPart: s.coverSkalaPart,
      coverAnimJudul: s.coverAnimJudul,
      coverAnimPart: s.coverAnimPart,
      coverTrans: s.coverTrans,
      coverTransDurasi: s.coverTransDurasi,
    } as const;
    // info suara ikut tampil di semua kartu bila video aktif punya suara intro
    const infoSuara = s.introSuaraFile ? videoAktif.suaraInfo : null;
    setDaftar((d) =>
      d.map((v) => ({ ...v, pengaturan: { ...v.pengaturan, ...inti }, suaraInfo: infoSuara })),
    );
    setDasar((p) => ({ ...p, ...inti }));
    toast.success(
      `Setelan COVER KINOSTRA (${s.introAktif ? "AKTIF" : "MATI"}, ${s.coverLayout}${s.coverPalet ? "--" + s.coverPalet : ""}, ${s.durasiIntro} dtk, transisi ${s.coverTrans || "tanpa"}) diterapkan ke SEMUA video (${daftar.length}) — thumbnail cover memang global`,
    );
  };

  const terapkanSubtitleSemua = () => {
    if (!videoAktif) return;
    const s = videoAktif.pengaturan;
    setDaftar((d) =>
      d.map((v) => ({
        ...v,
        pengaturan: {
          ...v.pengaturan,
          subtitleAktif: s.subtitleAktif,
          subtitleUkuran: s.subtitleUkuran,
          subtitleY: s.subtitleY,
          subtitleDeteksiBahasa: s.subtitleDeteksiBahasa,
          subtitleCepat: s.subtitleCepat,
          // v3.3.0 — model whisper.cpp + bahasa suara ikut diterapkan
          subtitleModel: s.subtitleModel,
          subtitleBahasa: s.subtitleBahasa,
          // v3.4.0 — VOCALIS v4 (mod 06 KINOSTRA) ikut utuh
          subtitleLagu: s.subtitleLagu,
          subtitleLewatiSunyi: s.subtitleLewatiSunyi,
          subtitleBakar: s.subtitleBakar,
          subtitleGeser: s.subtitleGeser,
          // v0.54.0 — warna subtitle ikut diterapkan ke semua video
          subtitleWarna: s.subtitleWarna,
          subtitleOutlineWarna: s.subtitleOutlineWarna,
        },
      })),
    );
    setDasar((p) => ({
      ...p,
      subtitleAktif: s.subtitleAktif,
      subtitleUkuran: s.subtitleUkuran,
      subtitleY: s.subtitleY,
      subtitleDeteksiBahasa: s.subtitleDeteksiBahasa,
      subtitleCepat: s.subtitleCepat,
      subtitleModel: s.subtitleModel,
      subtitleBahasa: s.subtitleBahasa,
      subtitleLagu: s.subtitleLagu,
      subtitleLewatiSunyi: s.subtitleLewatiSunyi,
      subtitleBakar: s.subtitleBakar,
      subtitleGeser: s.subtitleGeser,
      // v0.54.0 — warna subtitle ikut diterapkan ke semua video
      subtitleWarna: s.subtitleWarna,
      subtitleOutlineWarna: s.subtitleOutlineWarna,
    }));
    toast.success(
      `Subtitle AI ${s.subtitleAktif ? "AKTIF" : "MATI"} (${
        s.subtitleDeteksiBahasa ? "deteksi ID/EN" : "fokus Indonesia"
      }${s.subtitleCepat ? ", AI Cepat" : ""}, ukuran ${s.subtitleUkuran}, posisi ${s.subtitleY}%, warna ${s.subtitleWarna || "putih"}) diterapkan ke SEMUA video (${daftar.length})`,
    );
  };

  // v2.0.0 — UNGGAH BACKSOUND (web): POST /api/upload?kind=backsound → path relatif
  const [sibukBacksound, setSibukBacksound] = useState(false);
  const unggahBacksound = async (f: File) => {
    if (!videoAktif) return;
    setSibukBacksound(true);
    try {
      const r = await fetch(`/api/upload?kind=backsound&nama=${encodeURIComponent(f.name)}`, {
        method: "POST",
        body: f,
        headers: { "Content-Type": "application/octet-stream" },
      });
      const j = (await r.json()) as { ok: boolean; file?: string; ukuran?: number; error?: string };
      if (!j.ok || !j.file) throw new Error(j.error || "Unggah backsound gagal");
      perbaruiAktif((p) => ({ ...p, backsoundFile: j.file as string, backsoundAktif: true }));
      toast.success(`Backsound "${f.name}" dipasang ke video #${aktif + 1} — jangan lupa PAKAI`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Unggah backsound gagal");
    } finally {
      setSibukBacksound(false);
    }
  };
  // v2.0.0 — mode desktop: dialog natif Electron pilih MP3 (path absolut, tanpa unggah)
  const pilihAudioDesktop = async () => {
    if (typeof window === "undefined" || !window.vdsplitDesktop || !videoAktif) return;
    try {
      const dipilih = await window.vdsplitDesktop.pilih("audio");
      if (!dipilih || !dipilih.length) return;
      const it = dipilih[0];
      perbaruiAktif((p) => ({ ...p, backsoundFile: it.path, backsoundAktif: true }));
      toast.success(`Backsound "${it.nama}" dipasang ke video #${aktif + 1}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal memilih backsound");
    }
  };

  // v2.1.0 — SUARA INTRO (web): POST /api/upload?kind=backsound (nama unik per file)
  const [sibukSuaraIntro, setSibukSuaraIntro] = useState(false);
  const unggahSuaraIntro = async (f: File) => {
    if (!videoAktif) return;
    setSibukSuaraIntro(true);
    try {
      const r = await fetch(`/api/upload?kind=backsound&nama=${encodeURIComponent(f.name)}`, {
        method: "POST",
        body: f,
        headers: { "Content-Type": "application/octet-stream" },
      });
      const j = (await r.json()) as { ok: boolean; file?: string; ukuran?: number; error?: string };
      if (!j.ok || !j.file) throw new Error(j.error || "Unggah suara intro gagal");
      perbaruiAktif((p) => ({ ...p, introSuaraFile: j.file as string }));
      setDaftar((d) =>
        d.map((v, i) => (i === aktif ? { ...v, suaraInfo: { nama: f.name } } : v)),
      );
      toast.success(`Suara intro "${f.name}" dipasang ke video #${aktif + 1}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Unggah suara intro gagal");
    } finally {
      setSibukSuaraIntro(false);
    }
  };
  // v2.1.0 — mode desktop: dialog natif utk suara intro
  const pilihSuaraIntroDesktop = async () => {
    if (typeof window === "undefined" || !window.vdsplitDesktop || !videoAktif) return;
    setSibukSuaraIntro(true);
    try {
      const dipilih = await window.vdsplitDesktop.pilih("audio");
      if (!dipilih || !dipilih.length) return;
      const it = dipilih[0];
      perbaruiAktif((p) => ({ ...p, introSuaraFile: it.path }));
      setDaftar((d) =>
        d.map((v, i) => (i === aktif ? { ...v, suaraInfo: { nama: it.nama } } : v)),
      );
      toast.success(`Suara intro "${it.nama}" dipasang ke video #${aktif + 1}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal memilih suara intro");
    } finally {
      setSibukSuaraIntro(false);
    }
  };
  const hapusSuaraIntro = () => {
    if (!videoAktif) return;
    perbaruiAktif((p) => ({ ...p, introSuaraFile: "" }));
    setDaftar((d) => d.map((v, i) => (i === aktif ? { ...v, suaraInfo: null } : v)));
  };

  // ================= v3.4.0 — MENU KINOSTRA =================
  // sumber cover MANUAL (mod 13): unggah gambar → work/upload (kind=logo store
  // gambar dgn nama unik) → coverFile path relatif
  const [sibukCover, setSibukCover] = useState(false);
  const unggahCover = async (f: File) => {
    setSibukCover(true);
    try {
      const r = await fetch(`/api/upload?kind=logo&nama=${encodeURIComponent(f.name)}`, {
        method: "POST",
        body: f,
        headers: { "Content-Type": "application/octet-stream" },
      });
      const j = (await r.json()) as { ok: boolean; file?: string; error?: string };
      if (!j.ok || !j.file) throw new Error(j.error || "Unggah cover gagal");
      perbaruiAktif((p) => ({ ...p, coverSumber: "manual", coverFile: j.file as string }));
      toast.success(`Cover "${f.name}" dipasang — sumber MANUAL aktif`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Unggah cover gagal");
    } finally {
      setSibukCover(false);
    }
  };
  // v3.4.0 — BUAT SUBTITEL / IMPOR SRT (mod 06): segmen per video → payload
  // ekspor sbg override (ekspor TIDAK menghitung ulang AI)
  const [subsSedia, setSubsSedia] = useState<Record<string, Array<{ a: number; b: number; t: string }>>>({});

  const totalDurasi = daftar.reduce((a, v) => a + v.info.durasi, 0);
  // v2.0.0 — hitungan part MENGHORMATI jumlah otomatis & zona hapus (mode adegan
  // = 1 sementara, dipastikan saat ekspor oleh analisis adegan)
  const totalPart = daftar.reduce(
    (a, v) =>
      a +
      (v.pengaturan.modeSplit === "adegan"
        ? 1
        : hitungPartV2(
            v.info.durasi,
            v.pengaturan,
            v.pengaturan.mulaiDetik,
            v.pengaturan.akhirDetik,
            v.pengaturan.zonaHapus || [],
          )),
    0,
  );

  // gerbang: selama sesi belum dibuka, aplikasi tidak dirender sama sekali
  if (gerbang === "muat") {
    return <div className="min-h-screen" />;
  }
  if (gerbang === "terkunci") {
    return <GerbangLayar onBuka={() => setGerbang("terbuka")} />;
  }

  return (
    <main className="mx-auto max-w-[1720px] px-4 pb-16 pt-4 sm:px-6">
      {/* ===== v2.6.0 — TOPBAR KINOSTRA (referensi user): logo + subjudul mono,
           chip status 100% OFFLINE / FFMPEG AKTIF, sakelar mode, IMPOR MEDIA ===== */}
      <header className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2">
        {/* logo: marka kurung oranye + nama + subjudul */}
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="hud text-2xl font-black leading-none text-amber-500">▮▮</span>
          <span className="min-w-0">
            <span className="flex items-center gap-2">
              <h1 className="hud text-lg font-black leading-6 tracking-[0.18em] text-slate-50">
                VID<span className="text-amber-500">SPLIT</span>
              </h1>
              <span className="hud rounded-sm border border-slate-700 px-1 py-px text-[9px] text-slate-400">
                v3.6.0
              </span>
            </span>
            <span className="hud block text-[9px] leading-3 text-slate-500">
              Suite video otomatis · Desktop v3.6.0
            </span>
          </span>
        </div>

        {/* chip status gaya KINOSTRA */}
        <span className="hud ml-auto hidden items-center gap-1.5 rounded-sm border border-slate-700 px-2 py-1 text-[9px] text-slate-400 md:inline-flex">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> 100% offline
        </span>
        <span className="hud hidden items-center gap-1.5 rounded-sm border border-slate-700 px-2 py-1 text-[9px] text-slate-400 md:inline-flex">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> ffmpeg aktif
        </span>

        {/* sakelar mode — gaya HUD */}
        <div className="hud inline-flex rounded-sm border border-slate-700 bg-[#0b0d10]/80 p-0.5 text-[10px]">
          <button
            type="button"
            onClick={() => gantiMode("video")}
            className={`flex items-center gap-1.5 rounded-sm px-3 py-1.5 font-bold transition ${
              mode === "video" ? "bg-amber-500 text-slate-950" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Clapperboard className="h-3.5 w-3.5" /> Video
          </button>
          <button
            type="button"
            onClick={() => gantiMode("musik")}
            className={`flex items-center gap-1.5 rounded-sm px-3 py-1.5 font-bold transition ${
              mode === "musik" ? "bg-amber-500 text-slate-950" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Music className="h-3.5 w-3.5" /> Musik
          </button>
          <button
            type="button"
            onClick={() => gantiMode("horor")}
            className={`flex items-center gap-1.5 rounded-sm px-3 py-1.5 font-bold transition ${
              mode === "horor" ? "bg-amber-500 text-slate-950" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Ghost className="h-3.5 w-3.5" /> Cerita
          </button>
        </div>

        <TombolGantiPassword />

        {/* v2.6.0 — IMPOR MEDIA (persis tombol oranye di pojok kanan referensi) */}
        <button
          type="button"
          onClick={klikImporMedia}
          disabled={mode !== "video" || sibukVideo || daftar.length >= BATAS_VIDEO}
          title={
            daftar.length >= BATAS_VIDEO
              ? `Antrean penuh (maks ${BATAS_VIDEO})`
              : "Masukkan video ke antrean"
          }
          className="hud flex items-center gap-2 rounded-sm bg-amber-500 px-3.5 py-2 text-[11px] font-black text-slate-950 shadow-[0_0_18px_rgba(245,158,11,0.25)] transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Upload className="h-3.5 w-3.5" /> Impor media
        </button>
        <input
          ref={refImpor}
          type="file"
          accept="video/*,.ts"
          multiple
          className="hidden"
          onChange={(e) => {
            const fs = Array.from(e.target.files ?? []);
            for (const f of fs) unggahVideo(f);
            e.target.value = "";
          }}
        />
      </header>
      <p className="mb-4 text-xs text-slate-500">
        Kotak video (maks {BATAS_VIDEO}) = kartu atas panel kanan → klik baris video → atur lewat
        tab <b className="text-slate-400">Video / Teks / Gaya / Efek / Cover</b> (v3.3.0: 28
        transisi + 20 efek NOVACUT di tab EFEK, cover 100 template di COVER, teks otomatis
        whisper.cpp di TEKS) → ekspor &amp; split dari panel EKSPOR —{" "}
        <b className="text-slate-400">timeline split di kiri bawah pratinjau</b>. &quot;Terapkan
        ke semua&quot; kini SATU PUSAT di kartu RK Ringkasan. Klik judul modul untuk membuka/melipat.
      </p>

      {/* v0.10.0 — Mode Musik: Studio Musik menggantikan dasbor video seluruhnya */}
      {mode === "musik" && <StudioMusik onKirimKeVideo={kirimKeVideo} />}

      {/* v0.25.0 — Mode Cerita: Studio Horor (AI cerita + narasi + musik + video) */}
      {mode === "horor" && <StudioHoror onKirimKeVideo={kirimKeVideo} />}

      {/* v3.2.0 — LAYOUT KOLOSALCUT — permintaan user ('bisakah kamu baca aplikasi ini
          fokus pada layout aplikasinya aja... aku ingin merubah layout nya menggunakan
          layout dari aplikasi yang ini... pada aplikasi ini susunan menu nya terlihat
          lebih rapi dan terstruktus'). Struktur DIJIPLAK dari KolosalCut v1.4.9
          src/app/page.tsx + components/kolosal (repo zacrie85/KolosalCut dibedah langsung):
          · MAIN 2 KOLOM grid-cols-[minmax(0,1fr)_minmax(0,400px)] — KIRI = stage + TIMELINE
            di bawah pratinjau (persis KolosalCut: stage flex-1, timeline strip chip info +
            bar segmen proporsional), KANAN = aside 400px scroll sendiri (ANTREAN → TAB → EKSPOR)
          · TIMELINE GANDA DIHAPUS — footer timeline v3.1.1 dibuang; timeline kini SATU dan
            menempel di bawah stage (ala software video profesional)
          · PENGATURAN BERBASIS TAB ala tab 5 KolosalCut (Video/Teks/Gaya/Efek/Cover) —
            VidSplit 4 tab (tab Efek menyusul saat mesin efek v3.3): VIDEO = 01 Cara ubah ke
            vertikal + Zoom pembicara · TEKS = 02 Judul · 03 Part · 04 Deskripsi · 08 Subtitle
            AI · GAYA = 05 Frame 77 · 07 Watermark · Backsound · COVER = 06 Cover & intro —
            pemetaan disetujui user ('lanjutkan')
          · PANEL EKSPOR TERPISAH di bawah tab — ala kartu ExportPanel KolosalCut:
            09 Ekspor & split → RK Ringkasan → Riwayat
          · KARTU ANTREAN di atas sidebar = kolom ANTREAN KolosalCut (modul 00 Kotak video)
          · anti-luber: semua kolom minmax(0,·), stage scroll sendiri, timeline shrink-0 tak
            bisa didorong isi stage (pelajaran bug lebar melebar v3.1.0)
          Isi tiap modul = fungsi asli VidSplit (nama menu dipertahankan). Gaya warna amber
          VidSplit tetap — struktur KolosalCut, rasa VidSplit. Mode Musik & Cerita dan mesin
          (POTONG LANGSUNG / KILAT GPU / ffmpeg) tidak disentuh sama sekali. */}
      {mode === "video" && (
      <div className="grid xl:h-[calc(100vh-148px)] xl:grid-cols-[minmax(0,1fr)_minmax(0,400px)] xl:min-h-0">
        {/* ============ KOLOM KIRI — STAGE + TIMELINE (persis KolosalCut) ============ */}
        <div className="flex min-h-0 min-w-0 flex-col">
          {/* stage — latarkisi 38px KINOSTRA + bracket; scroll sendiri anti-dorong timeline */}
          <section
            className="h-[62vh] min-h-[440px] flex-1 overflow-y-auto p-4 pb-3 xl:h-auto xl:min-h-0"
            style={{
              backgroundImage:
                "linear-gradient(#1c2128 1px,transparent 1px),linear-gradient(90deg,#1c2128 1px,transparent 1px)",
              backgroundSize: "38px 38px",
            }}
          >
            {videoAktif ? (
              // v3.5.1 — wadah bracket IKUT bentuk pratinjau (fungsi bersama
              // pratinjauPotret): potret = w-fit (bracket menempel bingkai),
              // lanskap = w-full max-w-[1280px] — kalau w-fit, lebar bingkai
              // kolaps ke baris kontrol (±285px) → Video Original kecil banget
              // (bug laporan user, ada sejak v3.1.0).
              <div
                className={`relative mx-auto ${
                  pratinjauPotret(videoAktif.pengaturan.mode, videoAktif.info.lebar, videoAktif.info.tinggi)
                    ? "w-fit"
                    : "w-full max-w-[1280px]"
                }`}
              >
                <span aria-hidden className="bracket bracket-tl" />
                <span aria-hidden className="bracket bracket-br" />
                <Preview
                  srcUrl={`/api/file?p=${encodeURIComponent(videoAktif.info.file)}`}
                  pengaturan={videoAktif.pengaturan}
                  durasi={videoAktif.info.durasi}
                  lebar={videoAktif.info.lebar}
                  tinggi={videoAktif.info.tinggi}
                  // v3.2.0 — bingkai potret muat antara topbar & timeline di kolom kiri
                  // v3.5.0 — PERBESAR (permintaan user: "Video Original gambar nya
                  //  jadi kecil banget... preview videonya agak lebih besar sebesar
                  //  frame yang sudah di buat sesuai layoutnya, dan untuk video
                  //  vertikal kalau bisa untuk preview nya juga sedikit di perbesar"):
                  //  cadangan ruang 420→300px & batas 720→1080px — pratinjau
                  //  potret (9:16 & sumber vertikal) jadi jauh lebih besar; stage
                  //  tetap scroll-sendiri bila melebihi layar (anti-luber).
                  tinggiPotret="min(calc(100vh - 300px), 1080px)"
                  // v3.5.0 — seret judul (+ bingkai futuristik) langsung di pratinjau
                  onGeserJudul={(x, y) =>
                    gantiPengaturanAktif({ ...videoAktif.pengaturan, judulX: x, judulY: y })
                  }
                  totalPart={
                    videoAktif.pengaturan.modeSplit === "adegan"
                      ? 0 // jumlah adegan dipastikan saat ekspor (analisis AI)
                      : Math.max(
                          1,
                          hitungPartV2(
                            videoAktif.info.durasi,
                            videoAktif.pengaturan,
                            videoAktif.pengaturan.mulaiDetik,
                            videoAktif.pengaturan.akhirDetik,
                            videoAktif.pengaturan.zonaHapus || [],
                          ),
                        )
                  }
                />
              </div>
            ) : (
              <div className="relative m-auto flex aspect-video w-full max-w-[880px] flex-col items-center justify-center gap-3 border border-[#28303a] bg-black px-6">
                <span aria-hidden className="bracket bracket-tl" />
                <span aria-hidden className="bracket bracket-br" />
                <span className="hud text-[12px] tracking-[0.24em] text-slate-600">
                  Menunggu media
                </span>
                <span className="hud text-[11px] tracking-[0.22em] text-slate-700">
                  Impor MP4 · MKV · TS · WebM
                </span>
                <JatuhBerkas
                  terima="video/*,.ts"
                  onFile={unggahVideo}
                  hint={`Klik atau seret file ke sini — maks ${BATAS_VIDEO} video, maks 20 GB per video`}
                  sibuk={sibukVideo}
                  multiple
                  bukaDialog={diDesktop ? pilihVideoDesktop : undefined}
                />
              </div>
            )}
          </section>

          {/* ============ TIMELINE — SATU-SATUNYA, di bawah stage (ala KolosalCut) ============ */}
          <div className="shrink-0 border-t border-[#1c2128] bg-[#0c0e11] px-4 py-2.5">
            {videoAktif && videoAktif.pengaturan.modeSplit !== "adegan" ? (
              <GarisWaktuSplit
                pengaturan={videoAktif.pengaturan}
                durasiVideo={videoAktif.info.durasi}
                totalPart={Math.max(
                  1,
                  hitungPartV2(
                    videoAktif.info.durasi,
                    videoAktif.pengaturan,
                    videoAktif.pengaturan.mulaiDetik,
                    videoAktif.pengaturan.akhirDetik,
                    videoAktif.pengaturan.zonaHapus || [],
                  ),
                )}
                adaAudio={videoAktif.info.adaAudio}
                judul={videoAktif.pengaturan.judul}
              />
            ) : (
              <div className="flex h-[52px] items-center justify-center border border-dashed border-[#28303a] bg-[#08090c]">
                <span className="hud text-[10px] tracking-[0.2em] text-slate-600">
                  {videoAktif
                    ? "Timeline tidak dipakai pada mode adegan"
                    : "Timeline tampil setelah video diimpor"}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ============ SIDEBAR KANAN 400px — ANTREAN → TAB PENGATURAN → EKSPOR ============ */}
        <aside className="panel-kino min-h-0 min-w-0 overflow-y-auto border-l border-[#1c2128] bg-[#0c0e11]">
          {/* ---- KARTU ANTREAN (modul 00) — ala kolom ANTREAN KolosalCut ---- */}
          <Kartu
            nomor="00"
            judul="Kotak video · urutan"
            deskripsi="Semua video yang diimpor masuk ke sini — urutan atas → bawah = urutan proses. Klik baris untuk menonton & mengatur."
            ikon={<ListVideo className="h-4 w-4" />}
          >
            {daftar.length === 0 ? (
              <JatuhBerkas
                terima="video/*,.ts"
                onFile={unggahVideo}
                hint={`MP4, MOV, MKV, AVI, WebM, TS — maks ${BATAS_VIDEO} video, maks 20 GB per video`}
                sibuk={sibukVideo}
                multiple
                bukaDialog={diDesktop ? pilihVideoDesktop : undefined}
              />
            ) : (
              <div className="space-y-2">
                {/* daftar vertikal persis .qlist KINOSTRA (maks-h 296, scroll) */}
                <ul className="max-h-[296px] space-y-1 overflow-y-auto pr-0.5">
                  {daftar.map((v, i) => (
                    <li
                      key={`${v.info.file}-${i}`}
                      className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 transition ${
                        i === aktif
                          ? "border-amber-500/60 bg-amber-500/10 shadow-[inset_2px_0_0_#f59e0b]"
                          : "border-[#1c2128] bg-[#08090c] hover:border-[#28303a]"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setAktif(i)}
                        className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                      >
                        <span
                          className={`hud w-5 shrink-0 text-right text-[10px] font-bold ${
                            i === aktif ? "text-amber-500" : "text-slate-500"
                          }`}
                        >
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-[12px] text-slate-100">
                            {v.info.nama}
                          </span>
                          <span
                            className="hud block truncate text-[9px] tracking-[0.06em] text-slate-500"
                            title={`${formatDurasi(v.info.durasi)} · ${v.info.lebar}×${v.info.tinggi} · ${Math.max(1, Math.ceil(v.info.durasi / Math.max(1, v.pengaturan.durasiPart)))} part${v.pengaturan.judul ? ` · "${v.pengaturan.judul}"` : ""}${v.pengaturan.introAktif ? " · intro frame video" : ""}${v.logoInfo ? " · dgn logo" : ""}`}
                          >
                            {formatDurasi(v.info.durasi)} · {v.info.lebar}×{v.info.tinggi} ·{" "}
                            {Math.max(1, Math.ceil(v.info.durasi / Math.max(1, v.pengaturan.durasiPart)))}{" "}
                            part
                            {v.pengaturan.judul ? ` · "${v.pengaturan.judul.slice(0, 24)}"` : ""}
                            {v.pengaturan.introAktif ? " · intro" : ""}
                            {v.logoInfo ? " · logo" : ""}
                          </span>
                        </span>
                      </button>
                      <span className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => pindahVideo(i, -1)}
                          disabled={i === 0}
                          title="Naikkan urutan"
                          className="rounded border border-[#28303a] bg-[#101318] p-1 text-slate-400 transition hover:border-amber-500 hover:text-amber-400 disabled:opacity-30"
                        >
                          <ArrowUp className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => pindahVideo(i, 1)}
                          disabled={i === daftar.length - 1}
                          title="Turunkan urutan"
                          className="rounded border border-[#28303a] bg-[#101318] p-1 text-slate-400 transition hover:border-amber-500 hover:text-amber-400 disabled:opacity-30"
                        >
                          <ArrowDown className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => hapusVideo(i)}
                          title="Hapus dari kotak"
                          className="rounded border border-[#28303a] bg-[#101318] p-1 text-slate-400 transition hover:border-red-500 hover:text-red-400"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="flex items-center gap-2">
                  {daftar.length < BATAS_VIDEO && (
                    <div className="min-w-0 flex-1">
                      <JatuhBerkas
                        terima="video/*,.ts"
                        onFile={unggahVideo}
                        hint={`TAMBAH VIDEO… — sisa ${BATAS_VIDEO - daftar.length} slot`}
                        sibuk={sibukVideo}
                        multiple
                        bukaDialog={diDesktop ? pilihVideoDesktop : undefined}
                      />
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setDaftar([]);
                      setAktif(0);
                    }}
                    title="Kosongkan kotak"
                    className="flex-none rounded border border-[#28303a] bg-[#101318] p-2 text-slate-400 transition hover:border-red-500 hover:text-red-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <p className="hud text-[9px] tracking-[0.1em] text-slate-500">
                  {daftar.length} video dalam kotak · {totalPart} part ·{" "}
                  {formatDurasi(totalDurasi)}
                </p>
              </div>
            )}
          </Kartu>

          {/* ---- TAB PENGATURAN — 5 tab PERSIS KolosalCut: Video/Teks/Gaya/Efek/Cover ---- */}
          <div className="border-b border-[#1c2128] bg-[#0a0c0f] p-3 pb-2.5">
            <div
              role="tablist"
              aria-label="Kelompok pengaturan"
              className="grid grid-cols-5 gap-1 rounded-sm border border-[#28303a] bg-[#0b0d10]/80 p-1"
            >
              {(
                [
                  { kunci: "video", label: "Video", ikon: <Clapperboard className="h-3.5 w-3.5" /> },
                  { kunci: "teks", label: "Teks", ikon: <Type className="h-3.5 w-3.5" /> },
                  { kunci: "gaya", label: "Gaya", ikon: <Palette className="h-3.5 w-3.5" /> },
                  { kunci: "efek", label: "Efek", ikon: <Wand2 className="h-3.5 w-3.5" /> },
                  { kunci: "cover", label: "Cover", ikon: <ImageIcon className="h-3.5 w-3.5" /> },
                ] as const
              ).map((t) => (
                <button
                  key={t.kunci}
                  type="button"
                  role="tab"
                  aria-selected={tabAtur === t.kunci}
                  onClick={() => setTabAtur(t.kunci)}
                  className={`hud flex h-8 items-center justify-center gap-1.5 rounded-sm text-[10px] font-bold tracking-[0.12em] transition ${
                    tabAtur === t.kunci
                      ? "bg-amber-500 text-slate-950 shadow-[0_0_14px_rgba(245,158,11,0.35)]"
                      : "text-slate-400 hover:bg-amber-500/10 hover:text-amber-300"
                  }`}
                >
                  {t.ikon}
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* ---- ISI TAB — hanya modul milik tab aktif (layar selalu lega) ---- */}
          <div className="min-w-0">
            {videoAktif ? (
              <>
                {tabAtur === "video" && (
                  <>
                    <PanelMode
                      pengaturan={videoAktif.pengaturan}
                      onChange={gantiPengaturanAktif}
                      lebarVideo={videoAktif.info.lebar}
                      tinggiVideo={videoAktif.info.tinggi}
                      srcUrl={`/api/file?p=${encodeURIComponent(videoAktif.info.file)}`}
                      durasiVideo={videoAktif.info.durasi}
                    />
                    {/* v2.0.0 — ZOOM PEMBICARA OTOMATIS (sekunci dgn tab Video) */}
                    <PanelPembicara
                      pengaturan={videoAktif.pengaturan}
                      onChange={gantiPengaturanAktif}
                      nomorVideo={aktif + 1}
                    />
                  </>
                )}
                {tabAtur === "teks" && (
                  <>
                    <PanelJudul
                      pengaturan={videoAktif.pengaturan}
                      onChange={gantiPengaturanAktif}
                      nomorVideo={aktif + 1}
                      onTerapkanUkuran={() => terapkanUkuranSemua("judul")}
                    />
                    <PanelPart
                      pengaturan={videoAktif.pengaturan}
                      onChange={gantiPengaturanAktif}
                      nomorVideo={aktif + 1}
                      durasiVideo={videoAktif.info.durasi}
                      onTerapkanUkuran={() => terapkanUkuranSemua("part")}
                    />
                    <PanelDeskripsi
                      pengaturan={videoAktif.pengaturan}
                      onChange={gantiPengaturanAktif}
                      nomorVideo={aktif + 1}
                      srcUrl={`/api/file?p=${encodeURIComponent(videoAktif.info.file)}`}
                      lebarVideo={videoAktif.info.lebar}
                      tinggiVideo={videoAktif.info.tinggi}
                      onTerapkanUkuran={() => terapkanUkuranSemua("deskripsi")}
                    />
                    {/* v3.4.0 — mod 06 KINOSTRA: VOCALIS v4 (ganti total) */}
                    <PanelSubtitleKino
                      pengaturan={videoAktif.pengaturan}
                      onChange={gantiPengaturanAktif}
                      nomorVideo={aktif + 1}
                      fileRel={videoAktif.info.file}
                      adaAudio={videoAktif.info.adaAudio}
                      onSubsSedia={(fileRel, segmen) =>
                        setSubsSedia((m) => {
                          const m2 = { ...m };
                          if (segmen && segmen.length) m2[fileRel] = segmen;
                          else delete m2[fileRel];
                          return m2;
                        })
                      }
                    />
                  </>
                )}
                {tabAtur === "gaya" && (
                  <>
                    <PanelFrame
                      pengaturan={videoAktif.pengaturan}
                      onChange={gantiPengaturanAktif}
                      onFrameFile={unggahFrame}
                      frameSibuk={sibukFrame}
                      onTerapkanSemua={terapkanFrameKeSemua}
                      nomorVideo={aktif + 1}
                    />
                    {/* v3.4.0 — PanelWatermark DIHAPUS: watermark pindah ke menu
                        EFEK VISUAL & WATERMARK (mod 08 KINOSTRA) — satu tempat */}
                    {/* v2.0.0 — BACKSOUND MUSIK SENDIRI */}
                    <PanelBacksound
                      pengaturan={videoAktif.pengaturan}
                      onChange={gantiPengaturanAktif}
                      nomorVideo={aktif + 1}
                      onUnggahAudio={(f) => void unggahBacksound(f)}
                      onPilihAudioDesktop={diDesktop ? pilihAudioDesktop : undefined}
                      unggahSibuk={sibukBacksound}
                    />
                  </>
                )}
                {tabAtur === "efek" && (
                  /* v3.4.0 — mod 08+09 KINOSTRA: efek visual & watermark + gerak & transisi */
                  <PanelEfekKino
                    pengaturan={videoAktif.pengaturan}
                    onChange={gantiPengaturanAktif}
                    nomorVideo={aktif + 1}
                    logoInfo={videoAktif.logoInfo}
                    onLogoFile={unggahLogo}
                    onHapusLogo={hapusLogo}
                    logoSibuk={sibukLogo}
                    bukaDialogLogo={diDesktop ? pilihLogoDesktop : undefined}
                  />
                )}
                {tabAtur === "cover" && (
                  <>
                    {/* v3.4.0 — mod 13 KINOSTRA: COVER VIDEO PEMBUKA · NOVACUT
                        (menu cover lama DIHAPUS SEMUA — PemilihCover & PanelCoverIntro) */}
                    <PanelCoverKino
                      pengaturan={videoAktif.pengaturan}
                      onChange={gantiPengaturanAktif}
                      nomorVideo={aktif + 1}
                      onImporCover={unggahCover}
                      coverSibuk={sibukCover}
                      // v2.1.0 — suara intro (fitur VidSplit tetap)
                      suaraInfo={videoAktif.suaraInfo}
                      onSuaraFile={unggahSuaraIntro}
                      onHapusSuara={hapusSuaraIntro}
                      suaraSibuk={sibukSuaraIntro}
                      bukaDialogAudio={diDesktop ? pilihSuaraIntroDesktop : undefined}
                      // v2.5.0 — thumbnail global (desain ikut setelan cover di atas)
                      opsiThumb={{
                        aktif: opsiEkspor.thumbnailAktif,
                        kata: opsiEkspor.thumbnailKata,
                        format: opsiEkspor.thumbnailFormat,
                        mode: opsiEkspor.thumbnailMode,
                        gaya: opsiEkspor.thumbnailGaya,
                      }}
                      onOpsiThumb={(
                        o: {
                          aktif: boolean;
                          format: "jpg" | "png";
                          mode: "per-part" | "satu" | "identik";
                          kata: string;
                          gaya: string;
                        },
                      ) =>
                        setOpsiEkspor({
                          ...opsiEkspor,
                          thumbnailAktif: o.aktif,
                          thumbnailKata: o.kata as "Part" | "Bagian" | "Episode",
                          thumbnailFormat: o.format,
                          thumbnailMode: o.mode,
                          thumbnailGaya: o.gaya,
                        })
                      }
                    />
                  </>
                )}
              </>
            ) : (
              <div className="px-4 py-6">
                <p className="hud text-center text-[10px] leading-5 tracking-[0.14em] text-slate-500">
                  Menu pengaturan aktif setelah ada video di KOTAK VIDEO —
                  <br />
                  impor lewat tombol IMPOR MEDIA (kanan atas) atau seret ke layar.
                </p>
              </div>
            )}
          </div>

          {/* ---- PANEL EKSPOR — terpisah ala ExportPanel KolosalCut (v1.3.5) ---- */}
          {videoAktif && (
            <>
              <PanelEkspor
                daftar={daftar.map((v) => ({
                  file: v.info.file,
                  nama: v.info.nama,
                  durasi: v.info.durasi,
                  pengaturan: v.pengaturan,
                  // v2.9.0 — info sumber utk MESIN KILAT (WebCodecs renderer)
                  ukuran: v.info.ukuran,
                  lebar: v.info.lebar,
                  tinggi: v.info.tinggi,
                  fps: v.info.fps,
                  adaAudio: v.info.adaAudio,
                  // v3.4.0 — teks BUAT SUBTITEL/IMPOR SRT (override ekspor)
                  ...(subsSedia[v.info.file] ? { subs: subsSedia[v.info.file] } : {}),
                }))}
                opsiEkspor={opsiEkspor}
                onOpsiEkspor={setOpsiEkspor}
              />
              <PanelRingkasan
                pengaturan={videoAktif.pengaturan}
                durasiVideo={videoAktif.info.durasi}
                ukuranVideo={`${videoAktif.info.lebar}×${videoAktif.info.tinggi} · ${fmtUkuran(videoAktif.info.ukuran)}`}
                lebarVideo={videoAktif.info.lebar}
                tinggiVideo={videoAktif.info.tinggi}
                logoInfo={videoAktif.logoInfo}
                nomorVideo={aktif + 1}
                totalVideo={daftar.length}
                onTerapkanKeSemua={terapkanKeSemua}
                // v3.3.0 — PUSAT TUNGGAL "Terapkan ke SEMUA" (dulu tersebar di 5 modul)
                aksiTerapkan={[
                  {
                    kunci: "ukuran-judul",
                    label: "Ukuran huruf judul (02)",
                    hint: "Salin angka ukuran huruf judul video aktif ke semua video",
                    onKlik: () => terapkanUkuranSemua("judul"),
                  },
                  {
                    kunci: "ukuran-part",
                    label: "Ukuran huruf Part (03)",
                    hint: "Salin angka ukuran huruf Part video aktif ke semua video",
                    onKlik: () => terapkanUkuranSemua("part"),
                  },
                  {
                    kunci: "ukuran-deskripsi",
                    label: "Ukuran huruf deskripsi (04)",
                    hint: "Salin angka ukuran huruf deskripsi video aktif ke semua video",
                    onKlik: () => terapkanUkuranSemua("deskripsi"),
                  },
                  {
                    kunci: "frame",
                    label: "Frame & bingkai (05)",
                    hint: "Salin frame, neon, dan gradasi template ke semua video",
                    onKlik: terapkanFrameKeSemua,
                  },
                  {
                    kunci: "subtitle",
                    label: "Subtitle AI · VOCALIS v4 (06)",
                    hint: "Salin setelan VOCALIS v4 (aktif/bahasa/model/lagu/sunyi/burn-in/geser/ukuran/posisi/warna) ke semua video",
                    onKlik: terapkanSubtitleSemua,
                  },
                  {
                    kunci: "intro",
                    label: "Cover Video Pembuka (13)",
                    hint: "Salin setelan cover KINOSTRA (sumber/layout/palet/latar/bingkai/animasi/transisi) ke semua video",
                    onKlik: terapkanIntroKeSemua,
                  },
                ]}
              />
              <PanelRiwayat />
            </>
          )}
        </aside>
      </div>
      )}

      <footer className="mt-12 text-center text-[11px] text-slate-600">
        VidSplit — dibuat untuk kreator konten. Diproses penuh di perangkatmu dengan ffmpeg.
      </footer>
    </main>
  );
}
