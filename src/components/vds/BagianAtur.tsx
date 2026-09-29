"use client";

// VidSplit — v0.9.0: bagian-bagian pengaturan yang DIPISAH per kartu agar bebas
// ditempatkan di layout 3 kolom (kiri: mode/judul/part, kanan: background/logo/ringkasan).
// Isi masing-masing kartu IDENTIK dengan PanelAtur lama — hanya tata letak yang berubah.
import { useEffect, useRef, useState } from "react";
import {
  AlignLeft,
  Captions,
  Copy,
  Crop,
  Droplets,
  Eye,
  Film,
  Image as ImageIcon,
  ListChecks,
  MonitorPlay,
  Palette,
  Scan,
  Scissors,
  Stamp,
  Type,
} from "lucide-react";
import {
  durasiEfektif,
  hitungPart,
  formatDurasi,
  FONT_CSS,
  FONT_DASAR,
  INFO_FONT,
  labelPosisiLogo,
  labelPosisiPotong,
  POSISI_LOGO_PRESET,
  uraiWaktu,
  type CodecVideo,
  type GayaTeks,
  type ModeKonversi,
  type NamaFont,
  type PosisiLogo,
  type PosisiTeks,
  type Pengaturan,
  type Resolusi,
} from "@/lib/vidsplit/types";
import { formatWaktuSub } from "@/lib/vidsplit/pratinjauSub";
import { BarisSlider, ChipPilihan, JatuhBerkas, Kartu, PilihWarna, fmtUkuran } from "./bits";
import { PratinjauPotong } from "./PratinjauPotong";
import { PratinjauLogo } from "./PratinjauLogo";
import { PratinjauDeskripsi } from "./PratinjauDeskripsi";

const FONT_SINEMATIK = (Object.keys(INFO_FONT) as NamaFont[]).filter(
  (f) => !FONT_DASAR.includes(f),
);

function GayaEditor({
  gaya,
  onChange,
  maxUkuran,
  onTerapkanSemua,
}: {
  gaya: GayaTeks;
  onChange: (g: GayaTeks) => void;
  maxUkuran: number;
  /** v0.42.0 — tampil bila diisi: tombol "Terapkan ukuran ke semua video"
   *  (permintaan user: "mengubah ukuran font bisa diterapkan ke semua video") */
  onTerapkanSemua?: () => void;
}) {
  return (
    <div className="mt-3 space-y-3 rounded-xl border border-slate-700/50 bg-slate-800/40 p-3">
      <div>
        <p className="mb-1 text-xs text-slate-400">Font</p>
        <select
          value={gaya.font}
          onChange={(e) => onChange({ ...gaya, font: e.target.value as NamaFont })}
          className="w-full rounded-lg border border-slate-700 bg-slate-800/70 p-2 text-sm text-slate-100 outline-none focus:border-amber-400/70"
        >
          <optgroup label="Bawaan">
            {FONT_DASAR.map((f) => (
              <option key={f} value={f} style={{ fontFamily: FONT_CSS[f] }}>
                {INFO_FONT[f]}
              </option>
            ))}
          </optgroup>
          <optgroup label="Sinematik — ala film box office">
            {FONT_SINEMATIK.map((f) => (
              <option key={f} value={f} style={{ fontFamily: FONT_CSS[f] }}>
                {INFO_FONT[f]}
              </option>
            ))}
          </optgroup>
        </select>
        <p
          className="mt-1.5 truncate rounded-lg border border-slate-700/50 bg-slate-900/70 px-3 py-2 text-center text-xl leading-snug text-slate-100"
          style={{ fontFamily: FONT_CSS[gaya.font] }}
          title="Pratinjau font — render final memakai berkas font yang sama"
        >
          Avenger 12: The Last Part
        </p>
      </div>
      <BarisSlider
        label="Ukuran"
        nilai={gaya.ukuran}
        min={20}
        max={maxUkuran}
        onChange={(n) => onChange({ ...gaya, ukuran: n })}
      />
      {onTerapkanSemua && (
        <button
          type="button"
          onClick={onTerapkanSemua}
          title="Salin angka ukuran huruf ini ke SEMUA video di antrean"
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-600 bg-slate-800/60 py-1.5 text-[11px] font-medium text-slate-300 transition hover:border-amber-400 hover:text-amber-300"
        >
          <ListChecks className="h-3.5 w-3.5" />
          Terapkan ukuran {gaya.ukuran} ke semua video
        </button>
      )}
      <BarisSlider
        label="Ketebalan outline"
        nilai={gaya.outlineLebar}
        min={0}
        max={12}
        onChange={(n) => onChange({ ...gaya, outlineLebar: n })}
      />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <PilihWarna
          label="Warna teks"
          nilai={gaya.warna}
          onChange={(v) => onChange({ ...gaya, warna: v })}
        />
        <PilihWarna
          label="Warna outline"
          nilai={gaya.outlineWarna}
          onChange={(v) => onChange({ ...gaya, outlineWarna: v })}
        />
      </div>
    </div>
  );
}

/** Input waktu ramah — terima "90" (detik) atau "1:30" (m:ss) atau "1:02:03" */
function InputWaktu({
  label,
  nilaiDetik,
  onSet,
}: {
  label: string;
  nilaiDetik: number;
  onSet: (det: number) => void;
}) {
  const [teks, setTeks] = useState<string | null>(null);
  const tampil = teks ?? (nilaiDetik > 0 ? formatDurasi(nilaiDetik) : "0:00");
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-slate-400">{label}</span>
      <input
        value={tampil}
        onChange={(e) => setTeks(e.target.value)}
        onBlur={() => {
          if (teks === null) return;
          const d = uraiWaktu(teks);
          if (d >= 0) onSet(d);
          setTeks(null); // kembali tampil format rapi
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        inputMode="numeric"
        placeholder="0:00"
        className="w-full rounded-lg border border-slate-700 bg-slate-800/70 p-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-amber-400/70"
      />
    </label>
  );
}

/* ============ 1 — CARA UBAH KE VERTIKAL ============ */

export function PanelMode({
  pengaturan,
  onChange,
  lebarVideo,
  tinggiVideo,
  srcUrl,
  durasiVideo,
}: {
  pengaturan: Pengaturan;
  onChange: (p: Pengaturan) => void;
  lebarVideo: number;
  tinggiVideo: number;
  srcUrl: string;
  durasiVideo: number;
}) {
  const set = <K extends keyof Pengaturan>(k: K, v: Pengaturan[K]) =>
    onChange({ ...pengaturan, [k]: v });
  const spanEfektif = durasiEfektif(durasiVideo, pengaturan.mulaiDetik, pengaturan.akhirDetik);
  const adaTrim = pengaturan.mulaiDetik > 0 || pengaturan.akhirDetik > 0;

  return (
    <Kartu
      judul="1. Cara ubah ke vertikal"
      deskripsi="3 pilihan mengubah ke 9:16 — atau pilih Video original untuk rasio tetap seperti aslinya"
      ikon={<Scan className="h-4 w-4" />}
    >
      <ChipPilihan<ModeKonversi>
        pilihan={[
          { v: "blur", label: "Blur lembut", hint: "isi di tengah, latar blur" },
          { v: "crop", label: "Potong penuh", hint: "zoom sampai penuh" },
          { v: "warna", label: "Warna solid", hint: "pilih warna samping" },
          { v: "asli", label: "Video original", hint: "tanpa ubah rasio" },
        ]}
        nilai={pengaturan.mode}
        onChange={(v) => set("mode", v)}
      />
      {pengaturan.mode === "asli" && (
        <p className="mt-3 rounded-lg border border-emerald-400/30 bg-emerald-400/5 px-3 py-2 text-xs text-emerald-200">
          Video original aktif — video TIDAK diubah sama sekali: rasio &amp; resolusi tetap
          persis seperti saat diimpor ({lebarVideo > 0 ? `${lebarVideo} × ${tinggiVideo}` : "mengikuti sumber"} px).
          16:9 tetap melebar horizontal, 9:16 tetap vertikal. Yang tetap berjalan: split per
          durasi, tulisan judul/Part/deskripsi, background intro, watermark, dan pilihan codec.
        </p>
      )}
      {pengaturan.mode === "crop" && (
        <div className="mt-3 rounded-xl border border-amber-400/30 bg-amber-400/5 p-3">
          <BarisSlider
            label="Posisi area yang dipertahankan"
            nilai={pengaturan.posisiPotong}
            min={0}
            max={100}
            onChange={(n) => set("posisiPotong", n)}
            fmt={(n) => labelPosisiPotong(n)}
          />
          <PratinjauPotong
            srcUrl={srcUrl}
            lebar={lebarVideo}
            tinggi={tinggiVideo}
            posisi={pengaturan.posisiPotong}
            onChange={(n) => set("posisiPotong", n)}
          />
        </div>
      )}
      {pengaturan.mode === "warna" && (
        <div className="mt-3">
          <PilihWarna
            label="Warna latar samping"
            nilai={pengaturan.warnaLatar}
            onChange={(v) => set("warnaLatar", v)}
          />
        </div>
      )}
      <div className="mt-3 border-t border-slate-700/50 pt-3">
        <p className="mb-1 text-xs text-slate-400">Resolusi hasil</p>
        {pengaturan.mode === "asli" ? (
          <p className="rounded-lg bg-slate-800/70 px-3 py-2 text-xs text-slate-300">
            Mengikuti resolusi asli video
            {lebarVideo > 0 ? (
              <> — hasil nanti <b className="text-amber-300">{lebarVideo - (lebarVideo % 2)} × {tinggiVideo - (tinggiVideo % 2)}</b> px (tanpa di-rescale)</>
            ) : (
              " — tanpa di-rescale"
            )}
            .
          </p>
        ) : (
          <ChipPilihan<Resolusi>
            pilihan={[
              { v: "1080", label: "1080 × 1920", hint: "kualitas penuh" },
              { v: "720", label: "720 × 1280", hint: "render lebih cepat" },
            ]}
            nilai={pengaturan.resolusi}
            onChange={(v) => set("resolusi", v)}
          />
        )}
      </div>
      <div className="mt-3 border-t border-slate-700/50 pt-3">
        <p className="mb-1 text-xs text-slate-400">Format video hasil</p>
        <ChipPilihan<CodecVideo>
          pilihan={[
            { v: "h264", label: "H.264", hint: "paling kompatibel" },
            { v: "h265", label: "H.265 (HEVC)", hint: "file jauh lebih kecil" },
          ]}
          nilai={pengaturan.codec}
          onChange={(v) => set("codec", v)}
        />
        <p className="mt-1.5 text-[11px] text-slate-500">
          H.265 menghasilkan berkas ±30–50% lebih kecil di kualitas setara — cocok untuk
          menghemat penyimpanan &amp; unggahan. Dengan GPU encoder-nya sama kencangnya;
          tanpa GPU, H.265 dirender sedikit lebih lama oleh CPU.
        </p>
      </div>
      <div className="mt-3 border-t border-slate-700/50 pt-3">
        <div className="flex items-baseline justify-between">
          <p className="text-xs text-slate-400">Rentang yang diproses (opsional)</p>
          <span className="text-[11px] text-slate-500">durasi video {formatDurasi(durasiVideo)}</span>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <InputWaktu
            label="Mulai dari"
            nilaiDetik={pengaturan.mulaiDetik}
            onSet={(d) => set("mulaiDetik", d)}
          />
          <InputWaktu
            label="Sampai (kosong 0:00 = habis)"
            nilaiDetik={pengaturan.akhirDetik}
            onSet={(d) => set("akhirDetik", d)}
          />
        </div>
        <p className="mt-1.5 text-[11px] text-slate-500">
          Isi menitnya saja — contoh mulai <b>1:00</b> sampai <b>5:00</b> berarti hanya menit
          1–5 yang di-split &amp; diekspor. Format bebas: <b>90</b> atau <b>1:30</b>.
          {adaTrim && (
            <span className="text-amber-300">
              {" "}
              Aktif: {formatDurasi(pengaturan.mulaiDetik)} → {formatDurasi(pengaturan.akhirDetik)} ({formatDurasi(spanEfektif)})
            </span>
          )}
        </p>
      </div>
    </Kartu>
  );
}

/* ============ 2 — TULISAN JUDUL ============ */

export function PanelJudul({
  pengaturan,
  onChange,
  nomorVideo,
  onTerapkanUkuran,
}: {
  pengaturan: Pengaturan;
  onChange: (p: Pengaturan) => void;
  nomorVideo: number;
  /** v0.42.0 — terapkan ukuran huruf judul video aktif ke SEMUA video */
  onTerapkanUkuran: () => void;
}) {
  const set = <K extends keyof Pengaturan>(k: K, v: Pengaturan[K]) =>
    onChange({ ...pengaturan, [k]: v });
  return (
    <Kartu
      judul="2. Tulisan judul"
      deskripsi={`Terisi otomatis dari nama video saat diimpor — boleh diedit. Statis di semua potongan #${nomorVideo}`}
      ikon={<Type className="h-4 w-4" />}
    >
      <textarea
        value={pengaturan.judul}
        onChange={(e) => set("judul", e.target.value)}
        rows={2}
        maxLength={300}
        placeholder="Terisi otomatis dari nama video — ubah bila perlu…"
        className="w-full resize-y rounded-lg border border-slate-700 bg-slate-800/70 p-2.5 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-amber-400/70"
      />
      <GayaEditor
        gaya={pengaturan.gayaJudul}
        onChange={(g) => set("gayaJudul", g)}
        maxUkuran={160}
        onTerapkanSemua={onTerapkanUkuran}
      />
    </Kartu>
  );
}

/* ============ 3 — TULISAN PART OTOMATIS ============ */

export function PanelPart({
  pengaturan,
  onChange,
  nomorVideo,
  durasiVideo,
  onTerapkanUkuran,
}: {
  pengaturan: Pengaturan;
  onChange: (p: Pengaturan) => void;
  nomorVideo: number;
  durasiVideo: number;
  /** v0.42.0 — terapkan ukuran huruf Part video aktif ke SEMUA video */
  onTerapkanUkuran: () => void;
}) {
  const set = <K extends keyof Pengaturan>(k: K, v: Pengaturan[K]) =>
    onChange({ ...pengaturan, [k]: v });
  const spanEfektif = durasiEfektif(durasiVideo, pengaturan.mulaiDetik, pengaturan.akhirDetik);
  const nPart = hitungPart(spanEfektif, pengaturan.durasiPart);
  const adaTrim = pengaturan.mulaiDetik > 0 || pengaturan.akhirDetik > 0;

  return (
    <Kartu
      judul="3. Tulisan Part otomatis"
      deskripsi={`Video #${nomorVideo}: berganti sendiri tiap batas durasi set — split mengikuti batas ini`}
      ikon={<Scissors className="h-4 w-4" />}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs text-slate-400">Kata part</span>
          <input
            value={pengaturan.kataPart}
            onChange={(e) => set("kataPart", e.target.value)}
            maxLength={30}
            placeholder="Part"
            className="w-full rounded-lg border border-slate-700 bg-slate-800/70 p-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-amber-400/70"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-slate-400">Durasi tiap part (detik)</span>
          <input
            type="number"
            min={5}
            max={3600}
            value={pengaturan.durasiPart}
            onChange={(e) => set("durasiPart", Number(e.target.value) || 20)}
            className="w-full rounded-lg border border-slate-700 bg-slate-800/70 p-2 text-sm text-slate-100 outline-none focus:border-amber-400/70"
          />
        </label>
      </div>
      <div className="mt-2">
        <ChipPilihan<string>
          pilihan={[
            { v: "20", label: "20 detik" },
            { v: "30", label: "30 detik" },
            { v: "45", label: "45 detik" },
            { v: "60", label: "60 detik" },
          ]}
          nilai={String(pengaturan.durasiPart)}
          onChange={(v) => set("durasiPart", Number(v))}
        />
      </div>
      <p className="mt-2 rounded-lg bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
        {adaTrim ? (
          <>
            Rentang {formatDurasi(pengaturan.mulaiDetik)}–{formatDurasi(pengaturan.akhirDetik)} ({formatDurasi(spanEfektif)}) ÷{" "}
            {pengaturan.durasiPart} dtk = <b>{nPart} part</b>
          </>
        ) : (
          <>
            Video {formatDurasi(durasiVideo)} ÷ {pengaturan.durasiPart} dtk = <b>{nPart} part</b>
          </>
        )}{" "}
        — nanti otomatis di-split jadi {nPart} file.
      </p>
      <GayaEditor
        gaya={pengaturan.gayaPart}
        onChange={(g) => set("gayaPart", g)}
        maxUkuran={120}
        onTerapkanSemua={onTerapkanUkuran}
      />
      <div className="mt-3 border-t border-slate-700/50 pt-3">
        <p className="mb-1 text-xs text-slate-400">Posisi tulisan</p>
        <ChipPilihan<PosisiTeks>
          pilihan={[
            { v: "atas", label: "Atas" },
            { v: "tengah", label: "Tengah" },
            { v: "bawah", label: "Bawah" },
          ]}
          nilai={pengaturan.posisiTeks}
          onChange={(v) => set("posisiTeks", v)}
        />
      </div>
    </Kartu>
  );
}

/* ============ 4 — TULIS DESKRIPSI ============ */

export function PanelDeskripsi({
  pengaturan,
  onChange,
  nomorVideo,
  srcUrl,
  lebarVideo,
  tinggiVideo,
  onTerapkanUkuran,
}: {
  pengaturan: Pengaturan;
  onChange: (p: Pengaturan) => void;
  nomorVideo: number;
  srcUrl: string;
  lebarVideo: number;
  tinggiVideo: number;
  /** v0.42.0 — terapkan ukuran huruf deskripsi video aktif ke SEMUA video */
  onTerapkanUkuran: () => void;
}) {
  const set = <K extends keyof Pengaturan>(k: K, v: Pengaturan[K]) =>
    onChange({ ...pengaturan, [k]: v });
  const adaTeks = !!(pengaturan.deskripsi || "").trim();
  return (
    <Kartu
      judul="4. Tulis Deskripsi"
      deskripsi={`Teks deskripsi bebas ikut terbakar ke dalam video #${nomorVideo} — letakkan di mana saja`}
      ikon={<AlignLeft className="h-4 w-4" />}
    >
      <textarea
        value={pengaturan.deskripsi}
        onChange={(e) => set("deskripsi", e.target.value)}
        rows={3}
        maxLength={500}
        placeholder="Tulis deskripsi… boleh lebih dari satu baris — kosong = tanpa deskripsi"
        className="w-full resize-y rounded-lg border border-slate-700 bg-slate-800/70 p-2.5 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-amber-400/70"
      />
      <p className="mt-1.5 text-[11px] text-slate-500">
        {adaTeks
          ? `Deskripsi tampil di SETIAP potongan video #${nomorVideo} (${pengaturan.deskripsi.trim().length}/500 karakter, boleh multi-baris).`
          : "Kosong = tanpa deskripsi — video dirender tanpa tulisan ini."}
      </p>
      <GayaEditor
        gaya={pengaturan.gayaDeskripsi}
        onChange={(g) => set("gayaDeskripsi", g)}
        maxUkuran={120}
        onTerapkanSemua={onTerapkanUkuran}
      />
      <div className="mt-3 border-t border-slate-700/50 pt-3">
        <p className="mb-1 text-xs text-slate-400">Posisi cepat</p>
        <ChipPilihan<string>
          pilihan={[
            { v: "50-8", label: "Tengah-atas" },
            { v: "50-46", label: "Tengah" },
            { v: "50-80", label: "Tengah-bawah" },
          ]}
          nilai={`${pengaturan.deskripsiX}-${pengaturan.deskripsiY}`}
          onChange={(v) => {
            const [x, y] = v.split("-").map(Number);
            onChange({ ...pengaturan, deskripsiX: x, deskripsiY: y });
          }}
        />
      </div>
      <div className="mt-3">
        <PratinjauDeskripsi
          srcUrl={srcUrl}
          lebar={lebarVideo}
          tinggi={tinggiVideo}
          deskripsi={pengaturan.deskripsi}
          gayaDeskripsi={pengaturan.gayaDeskripsi}
          deskripsiX={pengaturan.deskripsiX}
          deskripsiY={pengaturan.deskripsiY}
          mode={pengaturan.mode}
          warnaLatar={pengaturan.warnaLatar}
          onPosisi={(x, y) =>
            onChange({ ...pengaturan, deskripsiX: x, deskripsiY: y })
          }
        />
      </div>
      <div className="mt-3 space-y-2">
        <BarisSlider
          label="Geser kiri ↔ kanan"
          nilai={pengaturan.deskripsiX}
          min={0}
          max={100}
          onChange={(n) => set("deskripsiX", n)}
          fmt={(n) => `${n.toFixed(0)}%`}
        />
        <BarisSlider
          label="Geser atas ↔ bawah"
          nilai={pengaturan.deskripsiY}
          min={0}
          max={100}
          onChange={(n) => set("deskripsiY", n)}
          fmt={(n) => `${n.toFixed(0)}%`}
        />
      </div>
    </Kartu>
  );
}

/* ============ 7 — SUBTITLE AI OTOMATIS ============ */

/** Bentuk jawaban /api/subtitle-preview (v0.45.0) — cocok dgn route.ts. */
interface HasilPratinjauSub {
  ok: boolean;
  klip?: string;
  durasiKlip?: number;
  bahasa?: string;
  diterjemahkan?: boolean;
  jumlahSegmen?: number;
  segmen?: Array<{ a: number; b: number; t: string }>;
  alasan?: string;
  pesan?: string;
}

const BATAS_TAMPIL_TEKS = 12;

export function PanelSubtitle({
  pengaturan,
  onChange,
  nomorVideo,
  onTerapkanSemua,
  fileRel,
  adaAudio,
}: {
  pengaturan: Pengaturan;
  onChange: (p: Pengaturan) => void;
  nomorVideo: number;
  /** v0.44.0 — salin setelan subtitle video aktif ke SEMUA video */
  onTerapkanSemua: () => void;
  /** v0.45.0 — path relatif video aktif di work/ ("" pada mode tertentu) */
  fileRel: string;
  /** v0.45.0 — video aktif punya trek audio? (tanpa suara tak bisa dibuatkan teks) */
  adaAudio: boolean;
}) {
  const set = <K extends keyof Pengaturan>(k: K, v: Pengaturan[K]) =>
    onChange({ ...pengaturan, [k]: v });

  // ---- v0.45.0 — PRATINJAU SUBTITLE: keping ±15 dtk dgn teks terbakar + transkrip
  const [pratinjauSibuk, setPratinjauSibuk] = useState(false);
  const [detikJalan, setDetikJalan] = useState(0);
  const [hasil, setHasil] = useState<HasilPratinjauSub | null>(null);
  const [lihatSemua, setLihatSemua] = useState(false);
  const tetapHidup = useRef(true);
  useEffect(() => {
    tetapHidup.current = true;
    return () => {
      tetapHidup.current = false;
    };
  }, []);
  // penghitung detik berjalan saat analisis AI (analisis video panjang butuh waktu)
  useEffect(() => {
    if (!pratinjauSibuk) return;
    setDetikJalan(0);
    const i = setInterval(() => setDetikJalan((d) => d + 1), 1000);
    return () => clearInterval(i);
  }, [pratinjauSibuk]);
  // setelan yang mempengaruhi tampilan subtitle berubah → hasil lama tak lagi valid
  useEffect(() => {
    setHasil(null);
    setLihatSemua(false);
  }, [pengaturan.subtitleUkuran, pengaturan.subtitleY, pengaturan.mulaiDetik, pengaturan.akhirDetik]);

  const jalankanPratinjau = async () => {
    if (pratinjauSibuk || !fileRel) return;
    setPratinjauSibuk(true);
    setHasil(null);
    try {
      const r = await fetch("/api/subtitle-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file: fileRel, pengaturan }),
      });
      const j = (await r.json()) as HasilPratinjauSub;
      if (tetapHidup.current) setHasil(j);
    } catch (e) {
      if (tetapHidup.current) {
        setHasil({
          ok: false,
          pesan: e instanceof Error ? e.message : "Koneksi ke server terputus",
        });
      }
    } finally {
      if (tetapHidup.current) setPratinjauSibuk(false);
    }
  };

  const segmenTampil = (hasil?.segmen || []).slice(0, lihatSemua ? 60 : BATAS_TAMPIL_TEKS);
  const sisa = (hasil?.segmen?.length || 0) - segmenTampil.length;

  return (
    <Kartu
      judul="7. Subtitle AI otomatis"
      deskripsi={`Suara di video #${nomorVideo} dikenali AI lokal — teks Indonesia otomatis tampil di video hasil ekspor & split`}
      ikon={<Captions className="h-4 w-4" />}
    >
      <button
        type="button"
        onClick={() => set("subtitleAktif", !pengaturan.subtitleAktif)}
        className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-xs transition ${
          pengaturan.subtitleAktif
            ? "border-emerald-400/50 bg-emerald-400/10 text-emerald-200"
            : "border-slate-700 bg-slate-800/60 text-slate-400"
        }`}
      >
        <span className="flex items-center gap-1.5">
          <Captions className="h-3.5 w-3.5" />
          Buat subtitle otomatis dari suara video
        </span>
        <span className="font-medium">{pengaturan.subtitleAktif ? "Aktif" : "Mati"}</span>
      </button>
      <p className="mt-1.5 text-[11px] text-slate-500">
        Suara <b>Indonesia</b> &amp; <b>Inggris</b> didukung — Inggris diterjemahkan otomatis ke
        Indonesia. 100% offline (AI di dalam aplikasi), tapi ekspor akan menganalisis suara dulu
        (kurang lebih <b>1–2 menit per 10 menit video</b>) — video yang sama tak dianalisis ulang.
      </p>
      {pengaturan.subtitleAktif && (
        <div className="mt-3 space-y-3">
          <BarisSlider
            label="Ukuran huruf subtitle"
            nilai={pengaturan.subtitleUkuran}
            min={10}
            max={80}
            onChange={(n) => set("subtitleUkuran", n)}
          />
          <BarisSlider
            label="Posisi vertikal (naik ↔ turun)"
            nilai={pengaturan.subtitleY}
            min={30}
            max={99}
            onChange={(n) => set("subtitleY", n)}
            fmt={(n) => `${n.toFixed(0)}%`}
          />
          <button
            type="button"
            onClick={onTerapkanSemua}
            title="Salin setelan subtitle (aktif/ukuran/posisi) video ini ke SEMUA video"
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-600 bg-slate-800/60 py-1.5 text-[11px] font-medium text-slate-300 transition hover:border-amber-400 hover:text-amber-300"
          >
            <ListChecks className="h-3.5 w-3.5" />
            Terapkan subtitle ini ke semua video
          </button>

          {/* ---- v0.45.0 PRATINJAU: bukti subtitle sebelum ekspor ---- */}
          <div className="rounded-lg border border-slate-700 bg-slate-800/40 p-2.5">
            <button
              type="button"
              onClick={jalankanPratinjau}
              disabled={pratinjauSibuk || !fileRel}
              title={
                !fileRel
                  ? "Video belum termuat"
                  : "Analisis suara + render 15 detik pertama dengan subtitle terbakar (hasil analisis di-cache — ekspor nanti tidak menghitung ulang)"
              }
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-sky-500/40 bg-sky-500/10 py-1.5 text-[11px] font-medium text-sky-300 transition enabled:hover:border-sky-400 enabled:hover:text-sky-200 disabled:opacity-50"
            >
              <Eye className="h-3.5 w-3.5" />
              {pratinjauSibuk
                ? `Pratinjau subtitle… ${detikJalan} dtk`
                : "Pratinjau subtitle (15 detik pertama)"}
            </button>
            <p className="mt-1.5 text-[10px] leading-snug text-slate-500">
              Melihat dulu hasilnya sebelum ekspor: video kecil dengan subtitle terbakar + daftar
              teksnya. Analisis AI di-cache — ekspor nanti <b>tidak menghitung ulang</b>.
              {pratinjauSibuk && " Video panjang butuh beberapa menit — biarkan terbuka."}
            </p>

            {hasil && !hasil.ok && (
              <p className="mt-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-[11px] text-amber-300">
                {hasil.pesan ||
                  (hasil.alasan === "audio"
                    ? "Video ini tidak punya suara."
                    : hasil.alasan === "model"
                      ? "Mesin AI tidak ditemukan."
                      : "Pratinjau gagal — coba lagi.")}
              </p>
            )}

            {hasil?.ok && hasil.klip && (
              <div className="mt-2 space-y-2">
                <video
                  key={hasil.klip}
                  controls
                  playsInline
                  className="max-h-96 w-full rounded-lg border border-slate-700 bg-black"
                  src={`/api/file?p=${encodeURIComponent(hasil.klip)}`}
                />
                <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                  <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 font-medium text-emerald-300">
                    Subtitle ADA ✓
                  </span>
                  <span className="rounded-full border border-slate-600 bg-slate-800 px-2 py-0.5 text-slate-300">
                    {(hasil.bahasa === "en"
                      ? hasil.diterjemahkan
                        ? "Suara Inggris → teks Indonesia"
                        : "Suara Inggris (penerjemah tidak tersedia)"
                      : "Suara Indonesia")}
                  </span>
                  <span className="rounded-full border border-slate-600 bg-slate-800 px-2 py-0.5 text-slate-400">
                    {hasil.jumlahSegmen || 0} baris teks di seluruh video
                  </span>
                </div>
                {segmenTampil.length > 0 && (
                  <div className="max-h-44 space-y-1 overflow-y-auto rounded-md border border-slate-700/60 bg-slate-900/60 p-2">
                    {segmenTampil.map((s, i) => (
                      <div key={i} className="flex gap-2 text-[11px] leading-snug">
                        <span className="shrink-0 font-mono text-[10px] text-sky-400/80">
                          {formatWaktuSub(s.a)}–{formatWaktuSub(s.b)}
                        </span>
                        <span className="text-slate-300">{s.t}</span>
                      </div>
                    ))}
                    {sisa > 0 && !lihatSemua && (
                      <button
                        type="button"
                        onClick={() => setLihatSemua(true)}
                        className="text-[10px] font-medium text-sky-400 hover:text-sky-300"
                      >
                        +{sisa} baris lainnya — tampilkan semua
                      </button>
                    )}
                  </div>
                )}
                <p className="text-[10px] text-slate-500">
                  Keping pratinjau = gaya persis hasil ekspor (ukuran {pengaturan.subtitleUkuran},
                  posisi {pengaturan.subtitleY}%). Di ekspor, teks ini terbakar ke SEMUA part
                  mengikuti suara di setiap bagian video.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </Kartu>
  );
}

/* ============ 5 — BACKGROUND INTRO ============ */
export function PanelBackground({
  pengaturan,
  onChange,
  bgInfo,
  onBgFile,
  onHapusBg,
  bgSibuk,
  nomorVideo,
  bukaDialog,
}: {
  pengaturan: Pengaturan;
  onChange: (p: Pengaturan) => void;
  bgInfo: { nama: string; ukuran: number } | null;
  onBgFile: (f: File) => void;
  onHapusBg: () => void;
  bgSibuk: boolean;
  nomorVideo: number;
  /** v0.40.0 — mode desktop: klik zona membuka dialog natif Electron (bukan input HTML) */
  bukaDialog?: () => void;
}) {
  const set = <K extends keyof Pengaturan>(k: K, v: Pengaturan[K]) =>
    onChange({ ...pengaturan, [k]: v });
  return (
    <Kartu
      judul="5. Background intro (opsional)"
      deskripsi={`Gambar PNG/JPG muncul di awal SETIAP hasil split video #${nomorVideo}`}
      ikon={<ImageIcon className="h-4 w-4" />}
    >
      {bgInfo ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-700/60 bg-slate-800/50 p-3">
          <div className="flex items-center gap-3 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/file?p=${encodeURIComponent(pengaturan.bgId)}`}
              alt="pratinjau background"
              className="h-12 w-12 rounded-lg border border-slate-600 object-cover"
            />
            <div className="min-w-0">
              <p className="truncate text-sm text-slate-200">{bgInfo.nama}</p>
              <p className="text-[11px] text-slate-500">{fmtUkuran(bgInfo.ukuran)}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onHapusBg}
            className="rounded-lg border border-red-500/40 px-2.5 py-1.5 text-xs text-red-300 hover:bg-red-500/10"
          >
            Hapus
          </button>
        </div>
      ) : (
        <JatuhBerkas
          terima="image/png,image/jpeg,image/webp"
          onFile={onBgFile}
          hint="PNG / JPG / WebP — maks 25 MB"
          sibuk={bgSibuk}
          bukaDialog={bukaDialog}
        />
      )}
      {bgInfo && (
        <div className="mt-3">
          <BarisSlider
            label="Durasi intro tiap potongan"
            nilai={pengaturan.durasiIntro}
            min={1}
            max={10}
            onChange={(n) => set("durasiIntro", n)}
            fmt={(n) => `${n} detik`}
          />
        </div>
      )}
    </Kartu>
  );
}

/* ============ 6 — WATERMARK / LOGO ============ */

export function PanelWatermark({
  pengaturan,
  onChange,
  logoInfo,
  onLogoFile,
  onHapusLogo,
  logoSibuk,
  lebarVideo,
  tinggiVideo,
  srcUrl,
  nomorVideo,
  bukaDialog,
}: {
  pengaturan: Pengaturan;
  onChange: (p: Pengaturan) => void;
  logoInfo: { nama: string; ukuran: number } | null;
  onLogoFile: (f: File) => void;
  onHapusLogo: () => void;
  logoSibuk: boolean;
  lebarVideo: number;
  tinggiVideo: number;
  srcUrl: string;
  nomorVideo: number;
  /** v0.40.0 — mode desktop: klik zona membuka dialog natif Electron (bukan input HTML) */
  bukaDialog?: () => void;
}) {
  const set = <K extends keyof Pengaturan>(k: K, v: Pengaturan[K]) =>
    onChange({ ...pengaturan, [k]: v });
  return (
    <Kartu
      judul="6. Watermark / logo (opsional)"
      deskripsi={`Gambar logo menempel di SETIAP potongan video #${nomorVideo} — pilih posisi & ukuran`}
      ikon={<Stamp className="h-4 w-4" />}
    >
      {logoInfo ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-700/60 bg-slate-800/50 p-3">
          <div className="flex items-center gap-3 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/file?p=${encodeURIComponent(pengaturan.logoId)}`}
              alt="pratinjau logo"
              className="h-12 w-12 rounded-lg border border-slate-600 object-contain"
            />
            <div className="min-w-0">
              <p className="truncate text-sm text-slate-200">{logoInfo.nama}</p>
              <p className="text-[11px] text-slate-500">{fmtUkuran(logoInfo.ukuran)}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onHapusLogo}
            className="rounded-lg border border-red-500/40 px-2.5 py-1.5 text-xs text-red-300 hover:bg-red-500/10"
          >
            Hapus
          </button>
        </div>
      ) : (
        <JatuhBerkas
          terima="image/png,image/jpeg,image/webp"
          onFile={onLogoFile}
          hint="PNG transparan paling cocok untuk watermark — maks 25 MB"
          sibuk={logoSibuk}
          bukaDialog={bukaDialog}
        />
      )}
      {logoInfo && (
        <div className="mt-3 space-y-3">
          <div>
            <p className="mb-1 text-xs text-slate-400">Posisi cepat (pojok)</p>
            <ChipPilihan<PosisiLogo>
              pilihan={([
                "kiri-atas",
                "kanan-atas",
                "kiri-bawah",
                "kanan-bawah",
              ] as PosisiLogo[]).map((v) => ({ v, label: labelPosisiLogo(v) }))}
              nilai={pengaturan.posisiLogo}
              onChange={(v) => {
                // v0.8.0 — chip pojok = preset cepat: isi langsung logoX/logoY
                const pre = POSISI_LOGO_PRESET[v];
                onChange({ ...pengaturan, posisiLogo: v, logoX: pre.x, logoY: pre.y });
              }}
            />
          </div>
          {/* v0.8.0 — pratinjau interaktif: seret logo utk posisi bebas, tarik titik utk ubas ukuran */}
          <PratinjauLogo
            srcUrl={srcUrl}
            logoUrl={`/api/file?p=${encodeURIComponent(pengaturan.logoId)}`}
            lebar={lebarVideo}
            tinggi={tinggiVideo}
            logoX={pengaturan.logoX}
            logoY={pengaturan.logoY}
            ukuran={pengaturan.ukuranLogo}
            mode={pengaturan.mode}
            warnaLatar={pengaturan.warnaLatar}
            onPosisi={(x, y) =>
              onChange({ ...pengaturan, logoX: x, logoY: y })
            }
            onUkuran={(n) => set("ukuranLogo", n)}
          />
          <BarisSlider
            label="Ukuran logo (lebar terhadap frame)"
            nilai={pengaturan.ukuranLogo}
            min={5}
            max={40}
            onChange={(n) => set("ukuranLogo", n)}
            fmt={(n) => `${n}%`}
          />
        </div>
      )}
    </Kartu>
  );
}

/* ============ RINGKASAN ============ */

export function PanelRingkasan({
  pengaturan,
  durasiVideo,
  ukuranVideo,
  lebarVideo,
  tinggiVideo,
  bgInfo,
  logoInfo,
  nomorVideo,
  totalVideo,
  onTerapkanKeSemua,
}: {
  pengaturan: Pengaturan;
  durasiVideo: number;
  ukuranVideo: string;
  lebarVideo: number;
  tinggiVideo: number;
  bgInfo: { nama: string; ukuran: number } | null;
  logoInfo: { nama: string; ukuran: number } | null;
  nomorVideo: number;
  totalVideo: number;
  onTerapkanKeSemua: () => void;
}) {
  const spanEfektif = durasiEfektif(durasiVideo, pengaturan.mulaiDetik, pengaturan.akhirDetik);
  const nPart = hitungPart(spanEfektif, pengaturan.durasiPart);
  const durasiOutput = spanEfektif + nPart * pengaturan.durasiIntro;
  const adaTrim = pengaturan.mulaiDetik > 0 || pengaturan.akhirDetik > 0;

  return (
    <Kartu judul="Ringkasan" ikon={<Film className="h-4 w-4" />}>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        <dt className="text-slate-500">Video sumber</dt>
        <dd className="text-right text-slate-200">
          {formatDurasi(durasiVideo)} · {ukuranVideo}
        </dd>
        <dt className="text-slate-500">Rentang diproses</dt>
        <dd className="text-right text-slate-200">
          {adaTrim
            ? `${formatDurasi(pengaturan.mulaiDetik)} → ${formatDurasi(pengaturan.akhirDetik || durasiVideo)}`
            : "seluruh video"}
        </dd>
        <dt className="text-slate-500">Mode konversi</dt>
        <dd className="text-right text-slate-200">
          {pengaturan.mode === "blur"
            ? "Blur lembut"
            : pengaturan.mode === "crop"
              ? `Potong penuh · ${labelPosisiPotong(pengaturan.posisiPotong)}`
              : pengaturan.mode === "warna"
                ? "Warna solid"
                : `Video original · ${lebarVideo > 0 ? `${lebarVideo}×${tinggiVideo}` : "rasio asli"}`}
        </dd>
        <dt className="text-slate-500">Format hasil</dt>
        <dd className="text-right text-slate-200">
          {pengaturan.codec === "h265" ? "H.265 (file kecil)" : "H.264 (kompatibel)"}
        </dd>
        <dt className="text-slate-500">Watermark</dt>
        <dd className="text-right text-slate-200">
          {logoInfo
            ? `${pengaturan.logoX.toFixed(0)}%,${pengaturan.logoY.toFixed(0)}% · ${pengaturan.ukuranLogo}%`
            : "tanpa logo"}
        </dd>
        {/* v0.39.0 — status deskripsi */}
        <dt className="text-slate-500">Deskripsi</dt>
        <dd className="text-right text-slate-200">
          {(pengaturan.deskripsi || "").trim()
            ? `"${pengaturan.deskripsi.trim().slice(0, 16)}${pengaturan.deskripsi.trim().length > 16 ? "…" : ""}" @ ${pengaturan.deskripsiX.toFixed(0)}%,${pengaturan.deskripsiY.toFixed(0)}%`
            : "tanpa deskripsi"}
        </dd>
        <dt className="text-slate-500">Hasil split</dt>
        <dd className="text-right text-slate-200">
          {nPart} file × ≤{pengaturan.durasiPart} dtk
        </dd>
        <dt className="text-slate-500">Intro background</dt>
        <dd className="text-right text-slate-200">
          {bgInfo ? `${pengaturan.durasiIntro} dtk / potongan` : "tanpa background"}
        </dd>
        <dt className="text-slate-500">Total durasi output</dt>
        <dd className="text-right text-slate-200">{formatDurasi(durasiOutput)}</dd>
      </dl>
      <p className="mt-3 flex items-center gap-1.5 text-[11px] text-slate-500">
        {pengaturan.mode === "blur" ? (
          <Droplets className="h-3 w-3" />
        ) : pengaturan.mode === "crop" ? (
          <Crop className="h-3 w-3" />
        ) : pengaturan.mode === "warna" ? (
          <Palette className="h-3 w-3" />
        ) : (
          <MonitorPlay className="h-3 w-3" />
        )}
        Audio asli dipertahankan; intro diisi hening agar tetap sinkron.
      </p>
      {totalVideo > 1 && (
        <>
          <button
            type="button"
            onClick={onTerapkanKeSemua}
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-sky-400/50 bg-sky-400/10 py-2 text-xs font-medium text-sky-200 transition hover:bg-sky-400/20"
          >
            <Copy className="h-3.5 w-3.5" />
            Terapkan pengaturan video #{nomorVideo} ke SEMUA video ({totalVideo})
          </button>
          {/* v0.38.0 — jelaskan BATASAN terapkan: judul & background tidak ikut.
              v0.39.0 — nomor kartu menyusut (deskripsi = kartu 4) + deskripsi tidak ikut
              v0.41.0 — ukuran huruf tiap video juga tidak ikut */}
          <p className="mt-1.5 text-[11px] leading-snug text-slate-500">
            Yang ikut: <b className="text-slate-400">1. Cara ubah ke vertikal</b> ·{" "}
            <b className="text-slate-400">3. Tulisan Part otomatis</b> ·{" "}
            <b className="text-slate-400">6. Watermark/logo</b> — logo cukup diunggah{" "}
            <b className="text-slate-400">sekali</b>, langsung terpasang di semua video.{" "}
            <b className="text-amber-300/80">Tulisan judul</b>,{" "}
            <b className="text-amber-300/80">Tulis Deskripsi</b> tiap video &{" "}
            <b className="text-amber-300/80">background intro</b> tidak diubah —
            tapi ukuran huruf bisa diterapkan ke semua lewat tombol{" "}
            <b className="text-amber-300/80">“Terapkan ukuran … ke semua video”</b> di tiap panel tulisan.
          </p>
        </>
      )}
    </Kartu>
  );
}
