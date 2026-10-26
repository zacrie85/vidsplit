"use client";

// VidSplit — v0.9.0: bagian-bagian pengaturan yang DIPISAH per kartu agar bebas
// ditempatkan di layout 3 kolom (kiri: mode/judul/part, kanan: background/logo/ringkasan).
// Isi masing-masing kartu IDENTIK dengan PanelAtur lama — hanya tata letak yang berubah.
import { useEffect, useRef, useState } from "react";
import {
  AlignLeft,
  Captions,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
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
  Ban,
  Sparkles,
  Frame as IkonFrame,
  Wand2,
  Zap,
  Globe,
} from "lucide-react";
import { BINGKAI_BAWAAN } from "@/lib/vidsplit/bingkaiBawaan";
import { DAFTAR_WARNA_NEON, PALET_NEON, type WarnaNeon } from "@/lib/vidsplit/neonLayar";
import { PRESET_GRADASI } from "@/lib/vidsplit/templatLayar";
import {
  durasiEfektif,
  durasiPartDipakai,
  hitungPart,
  hitungPartV2,
  formatDurasi,
  FONT_CSS,
  FONT_DASAR,
  INFO_FONT,
  labelPosisiLogo,
  labelPosisiPotong,
  labelResolusiOutput,
  labelZoomBlur,
  labelZoomPotong,
  LANGKAH_KECEPATAN,
  POSISI_LOGO_PRESET,
  potonganEfektif,
  rapikanJumlahPart,
  uraiWaktu,
  type CodecVideo,
  type GayaTeks,
  type LajuPindah,
  type ModeKonversi,
  type ModePembicara,
  type ModeSplit,
  type NamaFont,
  type OpsiThumbnail,
  type PosisiLogo,
  type Pengaturan,
  type Resolusi,
  type ResolusiOutput,
  type TransisiPart,
  type ZonaHapus,
  urlBingkai,
  urlBingkaiWarna,
} from "@/lib/vidsplit/types";
import { formatWaktuSub } from "@/lib/vidsplit/pratinjauSub";
import { bungkusTeksRender } from "@/lib/vidsplit/bungkus";
import { BarisSlider, ChipPilihan, JatuhBerkas, Kartu, PilihWarna, fmtUkuran } from "./bits";
import { PratinjauPotong } from "./PratinjauPotong";
import { PratinjauBlurZoom } from "./PratinjauBlurZoom";
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
      nomor="01"
      judul="Cara ubah ke vertikal"
      deskripsi="3 pilihan mengubah ke 9:16 — atau pilih Video original untuk rasio tetap seperti aslinya"
      ikon={<Scan className="h-4 w-4" />}
    >
      <ChipPilihan<ModeKonversi>
        pilihan={[
          { v: "blur", label: "Blur lembut", hint: "isi di tengah, latar blur" },
          { v: "crop", label: "Potong penuh", hint: "zoom bisa diatur 50–100%" },
          { v: "warna", label: "Warna solid", hint: "pilih warna samping" },
          { v: "asli", label: "Video original", hint: "tanpa ubah rasio" },
          { v: "template", label: "Template halaman", hint: "judul di atas, video di kotak tengah, deskripsi & Part di bawah" },
        ]}
        nilai={pengaturan.mode}
        onChange={(v) => set("mode", v)}
      />
      {pengaturan.mode === "template" && (
        <div className="mt-3 rounded-xl border border-fuchsia-400/30 bg-fuchsia-400/5 p-3">
          <p className="text-xs font-medium text-fuchsia-200">Warna gradasi latar halaman</p>
          <p className="mb-2 text-[11px] text-slate-400">
            Judul, video, deskripsi, dan Part tampil dalam kotak putih membulat di atas latar gradasi (persis sketsa kamu).
          </p>
          <div className="flex flex-wrap gap-2">
            {PRESET_GRADASI.map((g) => {
              const dipilih = pengaturan.templateGrad1 === g.a && pengaturan.templateGrad2 === g.b;
              return (
                <button
                  key={g.label}
                  type="button"
                  title={g.label}
                  onClick={() => {
                    set("templateGrad1", g.a);
                    set("templateGrad2", g.b);
                  }}
                  className={`h-8 w-14 rounded-lg border-2 transition ${dipilih ? "border-amber-400" : "border-slate-600 hover:border-slate-400"}`}
                  style={{ background: `linear-gradient(135deg, ${g.a}, ${g.b})` }}
                />
              );
            })}
          </div>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <PilihWarna label="Warna atas" nilai={pengaturan.templateGrad1} onChange={(v) => set("templateGrad1", v)} />
            <PilihWarna label="Warna bawah" nilai={pengaturan.templateGrad2} onChange={(v) => set("templateGrad2", v)} />
          </div>
          <p className="mt-2 text-[11px] text-slate-500">
            Tip: pakai warna huruf tebal (kartu tulisan) agar terbaca di kotak putih.
          </p>
        </div>
      )}
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
          {/* v0.50.0 — zoom manual: 100% = potong penuh (perilaku lama), di bawahnya
              video mengecil di atas latar blur — user bebas memilih besar zoom */}
          <BarisSlider
            label="Zoom video"
            nilai={pengaturan.zoomPotong}
            min={50}
            max={100}
            onChange={(n) => set("zoomPotong", n)}
            fmt={(n) => labelZoomPotong(n)}
          />
          <p className="mb-2 text-[11px] text-slate-400">
            100% = potong penuh (video mengisi penuh 9:16). Turunkan untuk memperkecil zoom —
            sisi atas &amp; bawah otomatis terisi blur lembut, dan kamu tetap bisa menggeser
            posisi kiri/kanan di bawah ini.
          </p>
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
            zoom={pengaturan.zoomPotong}
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
      {/* v0.51.0 — ZOOM MANUAL BLUR LEMBUT: 100% = perilaku lama (video pas layar);
          di atasnya video diperbesar di atas latar blur + bisa digeser kiri/kanan */}
      {pengaturan.mode === "blur" && (
        <div className="mt-3 rounded-xl border border-sky-400/30 bg-sky-400/5 p-3">
          <BarisSlider
            label="Zoom video"
            nilai={pengaturan.zoomBlur}
            min={100}
            max={300}
            onChange={(n) => set("zoomBlur", n)}
            fmt={(n) => labelZoomBlur(n)}
          />
          <p className="mb-2 text-[11px] text-slate-400">
            100% = video pas layar (perilaku lama). Naikkan untuk MEMPERBESAR video secara
            manual — bagian yang melebihi frame terpotong otomatis, latar blur lembut tetap
            terlihat di tepi atas &amp; bawah.
          </p>
          <BarisSlider
            label="Geser kiri ↔ kanan"
            nilai={pengaturan.posisiPotong}
            min={0}
            max={100}
            onChange={(n) => set("posisiPotong", n)}
            fmt={(n) => labelPosisiPotong(n)}
          />
          <PratinjauBlurZoom
            srcUrl={srcUrl}
            lebar={lebarVideo}
            tinggi={tinggiVideo}
            posisi={pengaturan.posisiPotong}
            zoom={pengaturan.zoomBlur}
            onChange={(n) => set("posisiPotong", n)}
          />
        </div>
      )}
      <div className="mt-3 border-t border-slate-700/50 pt-3">
        <p className="mb-1 text-xs text-slate-400">Resolusi output</p>
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
          <>
            {/* v2.0.0 — RESOLUSI OUTPUT: AUTO = perilaku lama (mengikuti skala 720/1080);
                pilihan lain = kunci resolusi (9:16 otomatis dibalik sesuai konvensi
                TikTok/Shorts — 4K vertikal = 2160×3840); bitrate menyesuaikan otomatis */}
            <ChipPilihan<ResolusiOutput>
              pilihan={[
                { v: "auto", label: "AUTO", hint: "ikuti skala lama (720/1080)" },
                { v: "720p", label: "720p HD", hint: "720 × 1280" },
                { v: "1080p", label: "1080p FULL HD", hint: "1080 × 1920" },
                { v: "2k", label: "2K QHD", hint: "1440 × 2560" },
                { v: "4k", label: "4K ULTRA HD", hint: "2160 × 3840 — sangat tajam, render paling lama" },
              ]}
              nilai={pengaturan.resolusiOutput}
              onChange={(v) => set("resolusiOutput", v)}
            />
            <p className="mt-1.5 text-[11px] text-slate-500">
              {pengaturan.resolusiOutput === "auto"
                ? "AUTO: mengikuti resolusi lama di bawah (1080 / 720)."
                : `${labelResolusiOutput(pengaturan.resolusiOutput)} — semua mode, semua video, EKSPOR & SPLIT, BATCH & GABUNG dikunci ke resolusi ini. Judul, subtitle, frame, watermark & zoom ikut membesar proporsional; bitrate menyesuaikan otomatis (4K ≈ 4× 1080p); H.264 level 5.1/5.2 otomatis.`}
            </p>
          </>
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
      {/* v0.57.0 — POTONG & HAPUS BAGIAN: zona merah yang dilewati saat split */}
      <div className="mt-3 border-t border-slate-700/50 pt-3">
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-400">Potong &amp; hapus bagian (opsional)</p>
          <button
            type="button"
            onClick={() =>
              set("zonaHapus", [
                ...(pengaturan.zonaHapus || []),
                { mulai: Math.min(spanEfektif / 2, Math.max(0, pengaturan.mulaiDetik + (spanEfektif || 10) / 4)), akhir: Math.min(spanEfektif, Math.max(1, pengaturan.mulaiDetik + (spanEfektif || 10) / 2)) },
              ])
            }
            className="rounded-lg border border-red-400/40 bg-red-400/10 px-2.5 py-1 text-[11px] text-red-200 transition hover:bg-red-400/20"
          >
            + Tambah zona merah
          </button>
        </div>
        {(pengaturan.zonaHapus || []).length > 0 && (
          <div className="mt-2">
            {/* pita timeline: zona merah di atas rentang yang diproses */}
            {(() => {
              const efAkhir = pengaturan.akhirDetik > 0 ? pengaturan.akhirDetik : durasiVideo || spanEfektif;
              const spanTotal = Math.max(0.5, efAkhir - pengaturan.mulaiDetik);
              return (
                <div className="relative h-4 overflow-hidden rounded-full bg-slate-800">
                  {(pengaturan.zonaHapus || []).map((z, i) => {
                    const kiri = Math.max(0, ((z.mulai - pengaturan.mulaiDetik) / spanTotal) * 100);
                    const lebar = Math.max(1, Math.min(100 - kiri, ((z.akhir - z.mulai) / spanTotal) * 100));
                    return (
                      <div
                        key={i}
                        className="absolute inset-y-0 bg-red-500/70"
                        style={{ left: `${kiri}%`, width: `${lebar}%` }}
                      />
                    );
                  })}
                </div>
              );
            })()}
            <p className="mt-1 text-[11px] text-slate-500">
              Zona merah = bagian yang DIHAPUS (tidak ikut di-split &amp; diekspor). Part tidak
              pernah memotong zona merah.
            </p>
          </div>
        )}
        <div className="mt-2 space-y-2">
          {(pengaturan.zonaHapus || []).map((z, i) => (
            <div key={i} className="rounded-xl border border-red-400/25 bg-red-400/5 p-2.5">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-medium text-red-200">Zona merah #{i + 1}</p>
                <button
                  type="button"
                  onClick={() =>
                    set("zonaHapus", (pengaturan.zonaHapus || []).filter((_, j) => j !== i) as ZonaHapus[])
                  }
                  className="rounded-lg border border-slate-600 px-2 py-0.5 text-[11px] text-slate-400 transition hover:border-red-400 hover:text-red-200"
                >
                  Hapus
                </button>
              </div>
              <div className="mt-1.5 grid grid-cols-2 gap-2">
                <InputWaktu
                  label="Mulai hapus"
                  nilaiDetik={z.mulai}
                  onSet={(d) =>
                    set(
                      "zonaHapus",
                      (pengaturan.zonaHapus || []).map((zz, j) => (j === i ? { ...zz, mulai: d } : zz)) as ZonaHapus[],
                    )
                  }
                />
                <InputWaktu
                  label="Sampai hapus"
                  nilaiDetik={z.akhir}
                  onSet={(d) =>
                    set(
                      "zonaHapus",
                      (pengaturan.zonaHapus || []).map((zz, j) => (j === i ? { ...zz, akhir: d } : zz)) as ZonaHapus[],
                    )
                  }
                />
              </div>
            </div>
          ))}
        </div>
        {(pengaturan.zonaHapus || []).length > 0 && durasiVideo > 0 && (() => {
          const pot = potonganEfektif(durasiVideo, pengaturan.mulaiDetik, pengaturan.akhirDetik, pengaturan.zonaHapus || []);
          const sisa = pot.reduce((a, p) => a + (p.akhir - p.mulai), 0);
          return (
            <p className="mt-1.5 text-[11px] text-amber-300">
              Sisa diproses: {formatDurasi(sisa)} dari {formatDurasi(spanEfektif)} — ±{hitungPart(sisa, pengaturan.durasiPart)} part
            </p>
          );
        })()}
      </div>
      {/* v0.57.0 — KECEPATAN TAYANG + TRANSISI ANTAR PART */}
      <div className="mt-3 border-t border-slate-700/50 pt-3">
        <p className="mb-1 text-xs text-slate-400">Kecepatan tayang video</p>
        <ChipPilihan<number>
          pilihan={LANGKAH_KECEPATAN.map((k) => ({
            v: k,
            label: k === 1 ? "Normal (1×)" : `${k.toString().replace(".", ",")}×`,
            hint: k < 1 ? "slow-motion" : k > 1 ? "dipercepat" : "kecepatan asli",
          }))}
          nilai={pengaturan.kecepatanVideo}
          onChange={(v) => set("kecepatanVideo", v)}
        />
        <p className="mt-1.5 text-[11px] text-slate-500">
          Suara &amp; subtitle ikut menyesuaikan otomatis. Contoh: part 60 detik dgn 2× jadi
          30 detik. 0,5× = slow-motion, 2× = dipercepat dua kali lipat.
        </p>
      </div>
      <div className="mt-3 border-t border-slate-700/50 pt-3">
        <p className="mb-1 text-xs text-slate-400">Transisi antar part (opsional)</p>
        <ChipPilihan<TransisiPart>
          pilihan={[
            { v: "", label: "Tanpa transisi", hint: "langsung nyambung (perilaku lama)" },
            { v: "fade", label: "Fade", hint: "pudar ke hitam masuk & keluar tiap part" },
            { v: "slide", label: "Slide", hint: "geser masuk dari kanan, keluar ke kiri" },
          ]}
          nilai={pengaturan.transisiPart}
          onChange={(v) => set("transisiPart", v)}
        />
        <p className="mt-1.5 text-[11px] text-slate-500">
          Diterapkan di awal &amp; akhir TIAP part (durasi 0,5 detik per sisi) — saat part
diputar berurutan, antar part terasa ada perpindahannya. Gunakan tombol "Terapkan
          ke SEMUA video" di bawah untuk menerapkan ke semua video yang diekspor.
        </p>
      </div>
    </Kartu>
  );
}

/* ============ 2 — TULISAN JUDUL ============ */

/* ===== v2.4.0 — PENG GESER POSISI BEBAS (permintaan user: "penentuan posisi
 * bisa bebas ditaruh dimana saja dengan cara di geser — pilihan atas tengah
 * bawah digantikan tombol geser atas bawah kiri kanan") =====
 * Posisi = persen frame: X = tengah blok teks, Y = ATAS blok teks.
 * y = -1 → OTOMATIS (perilaku lama). Tekan pertama mewujudkan posisi otomatis
 * menjadi angka (dari yOtomatis) lalu menggesernya — pratinjau live mengikuti. */
const LANGKAH_GESER_Y = 4; // % tinggi per tekan
const LANGKAH_GESER_X = 6; // % lebar per tekan

export function PenggeserPosisi({
  label,
  x,
  y,
  yOtomatis,
  onChange,
}: {
  label: string;
  x: number;
  /** Y saat ini — -1 = otomatis */
  y: number;
  /** posisi Y efektif saat otomatis (%) — jangkar mewujudkan nilai pertama kali */
  yOtomatis: number;
  onChange: (x: number, y: number) => void;
}) {
  const geser = (dx: number, dy: number) => {
    const yKini = y < 0 ? yOtomatis : y;
    const bulat = (n: number) => Math.round(n * 10) / 10;
    onChange(
      Math.min(100, Math.max(0, bulat(x + dx))),
      Math.min(100, Math.max(0, bulat(yKini + dy))),
    );
  };
  const tombol =
    "flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 bg-slate-800/70 text-slate-200 transition hover:border-amber-400/70 hover:text-amber-200 active:bg-amber-400/20";
  return (
    <div className="mt-3 border-t border-slate-700/50 pt-3">
      <p className="mb-1.5 text-xs text-slate-400">{label}</p>
      <div className="flex items-start gap-4">
        <div className="grid grid-cols-3 gap-1.5">
          <span />
          <button type="button" className={tombol} title="Geser ke atas" aria-label="Geser ke atas" onClick={() => geser(0, -LANGKAH_GESER_Y)}>
            <ChevronUp className="h-4 w-4" />
          </button>
          <span />
          <button type="button" className={tombol} title="Geser ke kiri" aria-label="Geser ke kiri" onClick={() => geser(-LANGKAH_GESER_X, 0)}>
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-800/40 text-[10px] font-medium leading-tight text-slate-400">
            {y < 0 ? "auto" : `${Math.round(x)}·${Math.round(y)}`}
          </span>
          <button type="button" className={tombol} title="Geser ke kanan" aria-label="Geser ke kanan" onClick={() => geser(LANGKAH_GESER_X, 0)}>
            <ChevronRight className="h-4 w-4" />
          </button>
          <span />
          <button type="button" className={tombol} title="Geser ke bawah" aria-label="Geser ke bawah" onClick={() => geser(0, LANGKAH_GESER_Y)}>
            <ChevronDown className="h-4 w-4" />
          </button>
          <span />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] leading-snug text-slate-500">
            {y < 0
              ? "Posisi otomatis (seperti semula). Tekan tombol geser untuk menaruh bebas di mana saja."
              : `Posisi: X ${x}% dr kiri · Y ${y}% dr atas — bebas di mana saja.`}
          </p>
          {y >= 0 && (
            <button
              type="button"
              onClick={() => onChange(50, -1)}
              className="mt-1.5 rounded-lg border border-slate-700 bg-slate-800/60 px-2.5 py-1 text-[11px] text-slate-300 transition hover:border-amber-400/70 hover:text-amber-200"
            >
              Kembalikan otomatis
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

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
      nomor="02"
      judul="Tulisan judul"
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
      {/* v2.4.0 — posisi judul BEBAS (terpisah dr Part): -1 = otomatis margin atas */}
      <PenggeserPosisi
        label="Posisi tulisan judul (geser bebas)"
        x={pengaturan.judulX}
        y={pengaturan.judulY}
        yOtomatis={4.5}
        onChange={(x, y) => onChange({ ...pengaturan, judulX: x, judulY: y })}
      />
    </Kartu>
  );
}

/* ============ 3 — TULISAN PART OTOMATIS ============ */

/** v2.4.0 — pilihan cepat kata part (request user: episode, bagian, part, eps) */
const KATA_PART_CEPAT = ["Part", "Eps", "Episode", "Bagian"];

/** v2.4.0 — posisi Y otomatis Part dalam PERSEN (basis 9:16 1080×1920, sama dgn
 *  posisiTeksBlok di render): judul otomatis → margin 4,5% + tinggi blok judul
 *  (baris terbungkus × ukuran × 1,5 + jarak 0,45×ukuran); judul konkret → dari
 *  judulY. Dipakai tombol geser utk mewujudkan posisi otomatis jadi angka. */
function yPartOtomatisPct(p: Pengaturan): number {
  const HPx = 1920;
  const uJpx = Math.max(12, p.gayaJudul.ukuran);
  const barisJ = Math.max(1, bungkusTeksRender(p.judul, p.gayaJudul, 1080, HPx, 12).split("\n").length);
  const yJudulPx = p.judulY >= 0 ? (p.judulY / 100) * HPx : HPx * 0.045;
  const yPartPx = yJudulPx + barisJ * uJpx * 1.5 + uJpx * 0.45;
  return Math.round((yPartPx / HPx) * 1000) / 10;
}

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
  // v2.0.0 — hitungan part V2: jumlah otomatis (N merata) + zona hapus + adegan
  const jumlahAktif = Math.floor(Number(pengaturan.jumlahPartOtomatis) || 0) > 0;
  const durasiPartEff = durasiPartDipakai(
    pengaturan,
    durasiVideo,
    pengaturan.mulaiDetik,
    pengaturan.akhirDetik,
    pengaturan.zonaHapus || [],
  );
  const nPart = pengaturan.modeSplit === "adegan"
    ? null // jumlah part ditentukan hasil analisis adegan (teks khusus di bawah)
    : hitungPartV2(durasiVideo, pengaturan, pengaturan.mulaiDetik, pengaturan.akhirDetik, pengaturan.zonaHapus || []);
  const nPartLama = hitungPart(spanEfektif, pengaturan.durasiPart);
  const adaTrim = pengaturan.mulaiDetik > 0 || pengaturan.akhirDetik > 0;

  return (
    <Kartu
      nomor="03"
      judul="Tulisan Part otomatis"
      deskripsi={`Video #${nomorVideo}: berganti sendiri tiap batas durasi set — split mengikuti batas ini`}
      ikon={<Scissors className="h-4 w-4" />}
    >
      {/* v2.0.0 — MODE SPLIT: per durasi (lama) / per adegan (AI offline) */}
      <div className="mb-3">
        <p className="mb-1 text-xs text-slate-400">Cara memecah part</p>
        <ChipPilihan<ModeSplit>
          pilihan={[
            { v: "durasi", label: "Per durasi", hint: "potong tepat di batas set (lama)" },
            { v: "adegan", label: "Per adegan (AI)", hint: "analisis 100% offline — potong TEPAT di pergantian adegan film" },
          ]}
          nilai={pengaturan.modeSplit}
          onChange={(v) => set("modeSplit", v)}
        />
        {pengaturan.modeSplit === "adegan" && (
          <p className="mt-1.5 rounded-lg bg-fuchsia-400/10 px-3 py-2 text-[11px] text-fuchsia-200">
            Mode per adegan: video dianalisis (piksel + histogram, ambang adaptif
            median+MAD) saat ekspor mulai — part terpecah TEPAT di pergantian adegan,
            bukan per durasi. Kolom durasi &amp; preset di bawah diabaikan di mode ini.
          </p>
        )}
      </div>
      {/* v2.0.0 — JUMLAH PART OTOMATIS: tulis N → dibagi merata */}
      <div className="mb-3 rounded-xl border border-sky-400/30 bg-sky-400/5 p-3">
        <p className="text-xs font-medium text-sky-200">JUMLAH PART OTOMATIS</p>
        <p className="mb-2 text-[11px] text-slate-400">
          Tulis saja berapa part yang kamu mau — video dibagi MERATA otomatis
          (60 menit ÷ 10 = 10 part × 6 menit). Setelan tetap aktif utk video berikutnya.
        </p>
        <input
          type="number"
          min={0}
          max={1000}
          value={pengaturan.jumlahPartOtomatis || ""}
          placeholder="kosongkan = pakai durasi manual"
          onChange={(e) => {
            const v = e.target.value === "" ? 0 : Math.floor(Number(e.target.value) || 0);
            set("jumlahPartOtomatis", rapikanJumlahPart(v, spanEfektif) || 0);
          }}
          className="w-full rounded-lg border border-slate-700 bg-slate-800/70 p-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-sky-400/70"
        />
        {jumlahAktif && pengaturan.modeSplit !== "adegan" && (
          <p className="mt-2 rounded-lg bg-sky-400/10 px-3 py-2 text-xs font-medium text-sky-200">
            SPLIT OTOMATIS {Math.floor(Number(pengaturan.jumlahPartOtomatis))} PART ×{" "}
            {durasiPartEff.toFixed(0)} DTK
          </p>
        )}
        {jumlahAktif && (pengaturan.modeSplit === "adegan" || pengaturan.durasiPart !== durasiPartEff) && (
          <p className="mt-1 text-[11px] text-slate-500">
            Kosongkan angka / isi durasi manual / klik preset 20–60 dtk → kembali ke cara lama.
          </p>
        )}
      </div>
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
          {/* v2.4.0 — pilihan cepat kata part (permintaan user: "diberi pilihan
              beberapa tulisan lain seperti episode, bagian, part dan eps") */}
          <ChipPilihan<string>
            pilihan={[
              { v: "Part", label: "Part" },
              { v: "Eps", label: "Eps" },
              { v: "Episode", label: "Episode" },
              { v: "Bagian", label: "Bagian" },
            ]}
            nilai={KATA_PART_CEPAT.includes(pengaturan.kataPart) ? pengaturan.kataPart : ""}
            onChange={(v) => set("kataPart", v)}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-slate-400">Durasi tiap part (detik){jumlahAktif ? " — otomatis" : ""}</span>
          <input
            type="number"
            min={5}
            max={3600}
            value={jumlahAktif ? Math.max(1, Math.round(durasiPartEff)) : pengaturan.durasiPart}
            onChange={(e) => {
              // mengisi durasi manual mematikan jumlah otomatis (kunci dua arah)
              const v = Number(e.target.value) || 20;
              onChange({ ...pengaturan, durasiPart: v, jumlahPartOtomatis: 0 });
            }}
            disabled={jumlahAktif}
            className="w-full rounded-lg border border-slate-700 bg-slate-800/70 p-2 text-sm text-slate-100 outline-none focus:border-amber-400/70 disabled:opacity-60"
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
          nilai={String(jumlahAktif ? Math.max(1, Math.round(durasiPartEff)) : pengaturan.durasiPart)}
          onChange={(v) => onChange({ ...pengaturan, durasiPart: Number(v), jumlahPartOtomatis: 0 })}
        />
      </div>
      <p className="mt-2 rounded-lg bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
        {pengaturan.modeSplit === "adegan" ? (
          <>
            Mode <b>per adegan</b>: jumlah part = jumlah adegan yang terdeteksi saat ekspor
            (analisis otomatis, teks &amp; batas adegan mengikuti film).
          </>
        ) : nPart !== null ? (
          <>
            {adaTrim ? (
              <>
                Rentang {formatDurasi(pengaturan.mulaiDetik)}–{formatDurasi(pengaturan.akhirDetik)} ({formatDurasi(spanEfektif)}) ÷{" "}
                {durasiPartEff.toFixed(0)} dtk = <b>{nPart} part</b>
              </>
            ) : (
              <>
                Video {formatDurasi(durasiVideo)} ÷ {durasiPartEff.toFixed(0)} dtk = <b>{nPart} part</b>
              </>
            )}{" "}
            — nanti otomatis di-split jadi {nPart} file.
          </>
        ) : (
          <>
            Video {formatDurasi(durasiVideo)} → ±{nPartLama} part (estimasi per durasi)
          </>
        )}
      </p>
      <GayaEditor
        gaya={pengaturan.gayaPart}
        onChange={(g) => set("gayaPart", g)}
        maxUkuran={120}
        onTerapkanSemua={onTerapkanUkuran}
      />
      {/* v2.4.0 — posisi Part BEBAS & TERPISAH dr judul (tombol geser menggantikan
          chip atas/tengah/bawah yang dulu menggerakkan judul + part sekaligus).
          Jangkar otomatis = tepat di bawah blok judul (perhitungan sama dgn
          posisiTeksBlok di render: judul otomatis margin 4,5% + tinggi blok judul). */}
      <PenggeserPosisi
        label="Posisi tulisan part (geser bebas — terpisah dari judul)"
        x={pengaturan.partX}
        y={pengaturan.partY}
        yOtomatis={yPartOtomatisPct(pengaturan)}
        onChange={(x, y) => onChange({ ...pengaturan, partX: x, partY: y })}
      />
    </Kartu>
  );
}

/* ============ 3b — ZOOM PEMBICARA OTOMATIS (v2.0.0) ============ */

export function PanelPembicara({
  pengaturan,
  onChange,
  nomorVideo,
}: {
  pengaturan: Pengaturan;
  onChange: (p: Pengaturan) => void;
  nomorVideo: number;
}) {
  const set = <K extends keyof Pengaturan>(k: K, v: Pengaturan[K]) =>
    onChange({ ...pengaturan, [k]: v });
  const aktif = pengaturan.zoomPembicara !== "mati";
  const [model, setModel] = useState<{ ada: boolean; ukuranMb: number } | null>(null);
  const [mengunduh, setMengunduh] = useState(false);
  const [pesan, setPesan] = useState("");

  useEffect(() => {
    let hidup = true;
    fetch("/api/model-pembicara", { cache: "no-store" })
      .then((r) => r.json())
      .then((j: { ok: boolean; ada?: boolean; ukuranMb?: number }) => {
        if (hidup && j.ok) setModel({ ada: !!j.ada, ukuranMb: j.ukuranMb || 0 });
      })
      .catch(() => null);
    return () => {
      hidup = false;
    };
  }, []);

  const unduh = async () => {
    setMengunduh(true);
    setPesan("");
    try {
      const r = await fetch("/api/model-pembicara", { method: "POST" });
      const j = (await r.json()) as { ok: boolean; ada?: boolean; ukuranMb?: number; error?: string };
      if (!j.ok) throw new Error(j.error || "Unduhan gagal");
      setModel({ ada: !!j.ada, ukuranMb: j.ukuranMb || 0 });
      setPesan("Model siap — kini 100% offline permanen");
    } catch (e) {
      setPesan(e instanceof Error ? e.message : "Unduhan gagal");
    } finally {
      setMengunduh(false);
    }
  };

  return (
    <Kartu
      nomor="03B"
      judul="Zoom pembicara otomatis (AI)"
      badge="AI"
      deskripsi={`Video #${nomorVideo}: kamera otomatis meng-zoom orang yang sedang bicara — podcast jadi konten vertikal`}
      ikon={<MonitorPlay className="h-4 w-4" />}
    >
      <ChipPilihan<ModePembicara>
        pilihan={[
          { v: "mati", label: "Mati", hint: "tanpa zoom (lama)" },
          { v: "geser", label: "GESER HALUS", hint: "kamera meluncur ke pembicara baru" },
          { v: "fade", label: "FADE", hint: "gambar lama melebur (dissolve) ke baru" },
          { v: "langsung", label: "LANGSUNG (CUT)", hint: "pindah instan ala potongan kamera TV" },
        ]}
        nilai={pengaturan.zoomPembicara}
        onChange={(v) => set("zoomPembicara", v)}
      />
      {aktif && (
        <>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <p className="mb-1 text-xs text-slate-400">Kecepatan pindah fokus</p>
              <ChipPilihan<LajuPindah>
                pilihan={[
                  { v: "cepat", label: "CEPAT" },
                  { v: "normal", label: "NORMAL" },
                  { v: "lambat", label: "LAMBAT" },
                ]}
                nilai={pengaturan.lajuPindah}
                onChange={(v) => set("lajuPindah", v)}
              />
            </div>
            <div>
              <p className="mb-1 text-xs text-slate-400">Saat senyap</p>
              <ChipPilihan<"tetap" | "semua">
                pilihan={[
                  { v: "tetap", label: "Tetap di pembicara" },
                  { v: "semua", label: "Tampilkan semua" },
                ]}
                nilai={pengaturan.senyapPembicara}
                onChange={(v) => set("senyapPembicara", v)}
              />
            </div>
          </div>
          <p className="mt-2 rounded-lg bg-emerald-400/10 px-3 py-2 text-[11px] text-emerald-200">
            Tiga sinyal digabung 100% OFFLINE: AI deteksi orang (model ±12 MB, unduh
            sekali) + gerakan mulut/wajah + kapan ada suara. Hasil vertikal 9:16 siap
            Reels/TikTok/Shorts — resolusi mengikuti Resolusi output (kartu 1). Mode
            cadangan 2-bagian (kiri/kanan) otomatis bila AI sulit mengenali (kartun /
            rekaman layar). Berlaku juga di BATCH &amp; GABUNG VIDEO.
          </p>
          <div className="mt-2 flex items-center gap-2">
            {model?.ada ? (
              <span className="rounded-lg bg-emerald-400/10 px-2.5 py-1 text-[11px] text-emerald-200">
                ✓ Model terpasang ({model.ukuranMb} MB) — offline permanen
              </span>
            ) : (
              <button
                type="button"
                onClick={unduh}
                disabled={mengunduh}
                className="rounded-lg border border-sky-400/50 bg-sky-400/10 px-3 py-1.5 text-xs text-sky-200 hover:bg-sky-400/20 disabled:opacity-60"
              >
                {mengunduh ? "Mengunduh model…" : "⬇ Unduh model AI deteksi orang (±12 MB, sekali ini saja)"}
              </button>
            )}
            {pesan && <span className="text-[11px] text-slate-400">{pesan}</span>}
          </div>
        </>
      )}
    </Kartu>
  );
}

/* ============ 3c — BACKSOUND MUSIK SENDIRI (v2.0.0) ============ */

export function PanelBacksound({
  pengaturan,
  onChange,
  nomorVideo,
  onUnggahAudio,
  onPilihAudioDesktop,
  unggahSibuk,
}: {
  pengaturan: Pengaturan;
  onChange: (p: Pengaturan) => void;
  nomorVideo: number;
  /** unggah file audio via HTTP (web) → path relatif work/upload */
  onUnggahAudio: (f: File) => void;
  /** mode desktop: dialog natif Electron → path absolut */
  onPilihAudioDesktop?: () => void;
  unggahSibuk?: boolean;
}) {
  const set = <K extends keyof Pengaturan>(k: K, v: Pengaturan[K]) =>
    onChange({ ...pengaturan, [k]: v });
  const nama = (pengaturan.backsoundFile || "").split(/[\\/]/).pop() || "";
  return (
    <Kartu
      nomor="03C"
      judul="Backsound musik sendiri"
      deskripsi={`Video #${nomorVideo}: pakai MP3/WAV/M4A pilihanmu sebagai musik latar — bukan cuma skor AI`}
      ikon={<Sparkles className="h-4 w-4" />}
    >
      <button
        type="button"
        onClick={() => set("backsoundAktif", !pengaturan.backsoundAktif)}
        disabled={!pengaturan.backsoundFile}
        className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-xs transition ${
          pengaturan.backsoundAktif && pengaturan.backsoundFile
            ? "border-emerald-400/50 bg-emerald-400/10 text-emerald-200"
            : "border-slate-700 bg-slate-800/60 text-slate-400"
        } disabled:cursor-not-allowed`}
      >
        <span className="flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5" /> PAKAI backsound ini
        </span>
        <span className="font-medium">
          {pengaturan.backsoundFile ? (pengaturan.backsoundAktif ? "Aktif" : "Mati") : "pilih file dulu"}
        </span>
      </button>
      <div className="mt-2">
        <JatuhBerkas
          terima="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac"
          hint="Taruh MP3/WAV/M4A di sini atau klik untuk memilih"
          sibuk={unggahSibuk}
          onFile={onUnggahAudio}
          bukaDialog={onPilihAudioDesktop}
        />
      </div>
      {pengaturan.backsoundFile && (
        <div className="mt-2 rounded-lg bg-slate-800/60 px-3 py-2">
          <p className="truncate text-xs text-slate-200">🎵 {nama}</p>
          <div className="mt-1.5">
            <BarisSlider
              label="VOLUME BACKSOUND"
              nilai={pengaturan.backsoundVolume}
              min={0}
              max={150}
              onChange={(n) => set("backsoundVolume", n)}
              fmt={(n) => `${n}%`}
            />
          </div>
          <audio
            controls
            loop
            src={`/api/file?p=${encodeURIComponent(pengaturan.backsoundFile)}`}
            className="mt-2 h-8 w-full"
          />
          <div className="mt-2 flex items-center justify-between">
            <p className="text-[11px] text-slate-500">
              Diputar berulang otomatis bila lagu lebih pendek; posisi lagu kontinu antar part. Ikut EKSPOR &amp; SPLIT, BATCH, GABUNG. Video tanpa suara asli tetap punya audio.
            </p>
            <button
              type="button"
              onClick={() => set("backsoundFile", "")}
              className="shrink-0 rounded-md border border-red-400/40 px-2 py-0.5 text-[10px] text-red-300 hover:bg-red-400/10"
            >
              Hapus
            </button>
          </div>
        </div>
      )}
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
      nomor="04"
      judul="Tulis Deskripsi"
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
  // v0.58.0 — GANTI VIDEO (fileRel) + warna + mode bahasa + model juga ikut:
  // dulu pindah pilih video lain membuat klip & transkrip video LAMA tetap tampil
  useEffect(() => {
    setHasil(null);
    setLihatSemua(false);
  }, [
    fileRel,
    pengaturan.subtitleUkuran,
    pengaturan.subtitleY,
    pengaturan.mulaiDetik,
    pengaturan.akhirDetik,
    pengaturan.subtitleWarna,
    pengaturan.subtitleOutlineWarna,
    pengaturan.subtitleDeteksiBahasa,
    pengaturan.subtitleCepat,
  ]);

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
      nomor="08"
      judul="Subtitle AI otomatis"
      badge="AI"
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
        100% offline (AI di dalam aplikasi). <b>Mode Fokus Indonesia</b> dianalisis sekali jalan —
        jauh lebih cepat dari dulu, kurang lebih <b>±1 menit per 10 menit video</b> (tergantung
        kekuatan komputer). Video yang sama tak dianalisis ulang.
      </p>
      {pengaturan.subtitleAktif && (
        <div className="mt-3 space-y-3">
          {/* ---- v0.47.0 MODE BAHASA: fokus Indonesia (cepat) vs deteksi ID/EN ---- */}
          <div>
            <p className="mb-1.5 text-[11px] font-medium text-slate-400">Mode bahasa</p>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => set("subtitleDeteksiBahasa", false)}
                title="Langsung transkrip bahasa Indonesia sekali jalan — paling cepat"
                className={`rounded-lg border px-2.5 py-2 text-left text-[11px] transition ${
                  !pengaturan.subtitleDeteksiBahasa
                    ? "border-emerald-400/50 bg-emerald-400/10 text-emerald-200"
                    : "border-slate-700 bg-slate-800/60 text-slate-400 hover:border-slate-500"
                }`}
              >
                <span className="flex items-center gap-1.5 font-medium">
                  <Zap className="h-3.5 w-3.5" />
                  Fokus Indonesia
                </span>
                <span className="mt-0.5 block text-[10px] opacity-70">Paling cepat</span>
              </button>
              <button
                type="button"
                onClick={() => set("subtitleDeteksiBahasa", true)}
                title="Uji bahasa dulu (Indonesia vs Inggris) + terjemah EN→ID — untuk video bersuara Inggris"
                className={`rounded-lg border px-2.5 py-2 text-left text-[11px] transition ${
                  pengaturan.subtitleDeteksiBahasa
                    ? "border-sky-400/50 bg-sky-400/10 text-sky-200"
                    : "border-slate-700 bg-slate-800/60 text-slate-400 hover:border-slate-500"
                }`}
              >
                <span className="flex items-center gap-1.5 font-medium">
                  <Globe className="h-3.5 w-3.5" />
                  Deteksi ID/EN
                </span>
                <span className="mt-0.5 block text-[10px] opacity-70">Lama + terjemahan</span>
              </button>
            </div>
            <p className="mt-1 text-[10px] leading-snug text-slate-500">
              {pengaturan.subtitleDeteksiBahasa
                ? "Mode deteksi: bahasa diuji dulu (suara di-transkrip 2x) lalu Inggris diterjemahkan ke Indonesia — hasil paling lengkap tapi lebih lambat. Pakai bila video ada suara Inggris."
                : "Mode fokus: suara langsung dibaca sebagai bahasa Indonesia sekali jalan — tanpa deteksi & tanpa terjemahan, jadi paling cepat."}
            </p>
          </div>
          {/* ---- v0.51.0 MODE KECOPATAN AI: Whisper Small (tepat) vs Base (cepat) ---- */}
          <div>
            <p className="mb-1.5 text-[11px] font-medium text-slate-400">Kecepatan AI</p>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => set("subtitleCepat", false)}
                title="Whisper Small — ejaan & kata paling tepat (bawaan)"
                className={`rounded-lg border px-2.5 py-2 text-left text-[11px] transition ${
                  !pengaturan.subtitleCepat
                    ? "border-emerald-400/50 bg-emerald-400/10 text-emerald-200"
                    : "border-slate-700 bg-slate-800/60 text-slate-400 hover:border-slate-500"
                }`}
              >
                <span className="flex items-center gap-1.5 font-medium">
                  <Sparkles className="h-3.5 w-3.5" />
                  Tepat (Small)
                </span>
                <span className="mt-0.5 block text-[10px] opacity-70">Hasil paling akurat — kini lebih ngebut</span>
              </button>
              <button
                type="button"
                onClick={() => set("subtitleCepat", true)}
                title="Whisper Base — ±2–3× lebih cepat, ketepatan sedikit turun (video panjang)"
                className={`rounded-lg border px-2.5 py-2 text-left text-[11px] transition ${
                  pengaturan.subtitleCepat
                    ? "border-sky-400/50 bg-sky-400/10 text-sky-200"
                    : "border-slate-700 bg-slate-800/60 text-slate-400 hover:border-slate-500"
                }`}
              >
                <span className="flex items-center gap-1.5 font-medium">
                  <Zap className="h-3.5 w-3.5" />
                  Cepat (Base)
                </span>
                <span className="mt-0.5 block text-[10px] opacity-70">±2–4× lebih cepat · lebih pas</span>
              </button>
            </div>
            <p className="mt-1 text-[10px] leading-snug text-slate-500">
              {pengaturan.subtitleCepat
                ? "Mode cepat: model Whisper Base + benang CPU diatur otomatis (tidak saling rebutan), pemblokir kata berulang (anti halusinasi loop), dan perapian ejaan (-nya/-lah digabung otomatis) — transkrip JAUH lebih cepat dan lebih pas dari dulu."
                : "Mode tepat: model Whisper Small — ejaan & istilah paling akurat, kini lebih responsif karena benang CPU tiap sesi diatur otomatis (tidak oversubscribe saat paralel)."}
            </p>
          </div>
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
          {/* ---- v0.54.0 WARNA SUBTITLE (permintaan user: warna teks di semua menu teks) ---- */}
          <div className="space-y-1.5 rounded-lg border border-slate-700/70 bg-slate-800/30 p-2.5">
            <p className="text-[11px] font-medium text-slate-400">Warna subtitle</p>
            <PilihWarna
              label="Warna teks"
              nilai={pengaturan.subtitleWarna || "#ffffff"}
              onChange={(v) => set("subtitleWarna", v)}
            />
            <PilihWarna
              label="Warna outline"
              nilai={pengaturan.subtitleOutlineWarna || "#000000"}
              onChange={(v) => set("subtitleOutlineWarna", v)}
            />
          </div>
          <button
            type="button"
            onClick={onTerapkanSemua}
            title="Salin setelan subtitle (aktif/ukuran/posisi/warna) video ini ke SEMUA video"
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

/* ============ 5 — FRAME & BINGKAI (v0.46.0) ============ */

export function PanelFrame({
  pengaturan,
  onChange,
  onFrameFile,
  frameSibuk,
  onTerapkanSemua,
  nomorVideo,
  bukaDialog,
}: {
  pengaturan: Pengaturan;
  onChange: (p: Pengaturan) => void;
  onFrameFile: (f: File) => void;
  frameSibuk: boolean;
  onTerapkanSemua: () => void;
  nomorVideo: number;
  /** mode desktop: klik zona membuka dialog natif Electron */
  bukaDialog?: () => void;
}) {
  const set = <K extends keyof Pengaturan>(k: K, v: Pengaturan[K]) =>
    onChange({ ...pengaturan, [k]: v });
  const pakaiFrameBawaan = pengaturan.frameId.startsWith("bawaan:");
  const slugBawaan = pakaiFrameBawaan ? pengaturan.frameId.slice(7) : "";

  return (
    <Kartu
      nomor="05"
      judul="Frame & bingkai (opsional)"
      deskripsi="Frame hiasan + frame neon berputar — berlaku ke semua video lewat satu tombol"
      ikon={<IkonFrame className="h-4 w-4" />}
    >
      {/* ---- frame hiasan ---- */}
      <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-slate-300">
        <ImageIcon className="h-3.5 w-3.5" /> Frame hiasan
      </p>
      <div className="grid max-h-72 grid-cols-3 gap-2 overflow-y-auto rounded-xl border border-slate-800 bg-slate-900/40 p-2 sm:grid-cols-4">
        <button
          type="button"
          onClick={() => set("frameId", "")}
          className={`flex flex-col items-center justify-center rounded-lg border p-2 text-[10px] transition ${
            !pengaturan.frameId
              ? "border-amber-400/80 bg-amber-400/15 text-amber-200"
              : "border-slate-700 bg-slate-800/60 text-slate-400 hover:border-slate-500"
          }`}
        >
          <Ban className="mb-1 h-5 w-5" />
          Tanpa frame
        </button>
        {BINGKAI_BAWAAN.map((b) => (
          <button
            key={b.slug}
            type="button"
            title={b.label}
            onClick={() => set("frameId", `bawaan:${b.slug}`)}
            className={`overflow-hidden rounded-lg border transition ${
              slugBawaan === b.slug
                ? "border-amber-400/80 ring-2 ring-amber-400/40"
                : "border-slate-700 hover:border-slate-500"
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/bingkai/${b.slug}-916.png`}
              alt={b.label}
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
              }}
              className="h-24 w-full object-cover"
            />
            <span className="block truncate bg-slate-900/80 px-1 py-0.5 text-[9px] text-slate-300">
              {b.label}
            </span>
          </button>
        ))}
      </div>
      {/* frame unggahan aktif */}
      {pengaturan.frameId.startsWith("upload/") && (
        <div className="mt-2 flex items-center justify-between gap-3 rounded-xl border border-emerald-400/30 bg-emerald-400/5 p-2.5">
          <div className="flex items-center gap-2 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={urlBingkai(pengaturan.frameId)}
              alt="frame unggahan"
              className="h-10 w-10 rounded-lg border border-slate-600 object-cover"
            />
            <p className="truncate text-xs text-emerald-200">Frame unggahan kamu terpasang ✓</p>
          </div>
          <button
            type="button"
            onClick={() => set("frameId", "")}
            className="rounded-lg border border-red-500/40 px-2 py-1 text-xs text-red-300 hover:bg-red-500/10"
          >
            Hapus
          </button>
        </div>
      )}
      <div className="mt-2">
        <JatuhBerkas
          terima="image/png,image/webp"
          onFile={onFrameFile}
          hint="Unggah frame PNG SENDIRI (bagian jendela harus transparan) — maks 25 MB"
          sibuk={frameSibuk}
          bukaDialog={bukaDialog}
        />
      </div>

      {/* ---- v0.54.0 WARNA BINGKAI: ganti warna frame TANPA mengubah bentuk ---- */}
      {pengaturan.frameId && pengaturan.mode !== "template" && (
        <div className="mt-4 space-y-2.5 rounded-xl border border-fuchsia-400/25 bg-fuchsia-400/5 p-3">
          <p className="flex items-center gap-1.5 text-[11px] font-medium text-fuchsia-200">
            <Palette className="h-3.5 w-3.5" /> Warna bingkai — bentuk frame tetap persis
          </p>
          <ChipPilihan<"asli" | "warna" | "gradasi">
            pilihan={[
              { v: "asli", label: "Warna asli" },
              { v: "warna", label: "Satu warna" },
              { v: "gradasi", label: "Gradasi" },
            ]}
            nilai={
              !pengaturan.frameWarna
                ? "asli"
                : pengaturan.frameWarna2
                  ? "gradasi"
                  : "warna"
            }
            onChange={(v) => {
              // SATU onChange — dua set() berurutan saling menimpa (stale closure)
              const w1 = pengaturan.frameWarna;
              const w2 = pengaturan.frameWarna2;
              if (v === "warna")
                onChange({ ...pengaturan, frameWarna: w1 || "#fbbf24", frameWarna2: "" });
              else if (v === "gradasi")
                onChange({ ...pengaturan, frameWarna: w1 || "#f59e0b", frameWarna2: w2 || "#ec4899" });
              else onChange({ ...pengaturan, frameWarna: "", frameWarna2: "" });
            }}
          />
          {pengaturan.frameWarna ? (
            <>
              <PilihWarna
                label={pengaturan.frameWarna2 ? "Warna atas" : "Warna bingkai"}
                nilai={pengaturan.frameWarna}
                onChange={(v) => set("frameWarna", v)}
              />
              {pengaturan.frameWarna2 && (
                <PilihWarna
                  label="Warna bawah (gradasi)"
                  nilai={pengaturan.frameWarna2}
                  onChange={(v) => set("frameWarna2", v)}
                />
              )}
              <div
                className="h-3 w-full rounded-full border border-slate-600"
                style={{
                  background: pengaturan.frameWarna2
                    ? `linear-gradient(to bottom, ${pengaturan.frameWarna}, ${pengaturan.frameWarna2})`
                    : pengaturan.frameWarna,
                }}
              />
              <div className="flex items-start gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  key={`${pengaturan.frameId}|${pengaturan.frameWarna}|${pengaturan.frameWarna2}`}
                  src={urlBingkaiWarna(
                    {
                      frameId: pengaturan.frameId,
                      frameWarna: pengaturan.frameWarna,
                      frameWarna2: pengaturan.frameWarna2,
                    },
                    false,
                  )}
                  alt="pratinjau frame berwarna"
                  className="h-32 w-auto rounded-lg border border-slate-700 bg-slate-900 object-contain"
                />
                <p className="text-[10px] leading-snug text-slate-400">
                  Bentuk &amp; lubang frame TIDAK berubah — hanya warnanya yang diwarnai ulang
                  (mengikuti terang-gelap desain asli). Pratinjau live &amp; hasil ekspor memakai
                  pewarnaan yang sama.
                </p>
              </div>
            </>
          ) : (
            <p className="text-[10px] text-slate-500">
              Pilih <b>Satu warna</b> untuk mengganti warna seluruh hiasan frame, atau{" "}
              <b>Gradasi</b> untuk campuran dua warna dari atas ke bawah.
            </p>
          )}
        </div>
      )}

      {pengaturan.mode === "template" && pengaturan.frameId && (
        <p className="mt-2 rounded-lg border border-amber-400/30 bg-amber-400/5 px-3 py-2 text-[11px] text-amber-200">
          Frame hiasan diistirahatkan sementara — mode Template sudah punya halaman desain sendiri
          (kotak putih di atas gradasi). Pilih mode lain bila ingin memakai frame hiasan.
        </p>
      )}

      {/* ---- frame neon berputar ---- */}
      <p className="mb-2 mt-5 flex items-center gap-1.5 text-xs font-medium text-slate-300">
        <Sparkles className="h-3.5 w-3.5" /> Frame neon berputar
      </p>
      <ChipPilihan<"mati" | "aktif">
        pilihan={[
          { v: "mati", label: "Mati" },
          { v: "aktif", label: "Aktif — komet bercahaya mengelilingi tepi video" },
        ]}
        nilai={pengaturan.neonAktif ? "aktif" : "mati"}
        onChange={(v) => set("neonAktif", v === "aktif")}
      />
      {pengaturan.neonAktif && (
        <div className="mt-3 space-y-3 rounded-xl border border-cyan-400/30 bg-cyan-400/5 p-3">
          <div>
            <p className="mb-1.5 text-[11px] text-slate-400">7 pilihan warna</p>
            <div className="flex flex-wrap gap-1.5">
              {DAFTAR_WARNA_NEON.map((w) => {
                const palet = PALET_NEON[w as WarnaNeon];
                const dipilih = pengaturan.neonWarna === w;
                return (
                  <button
                    key={w}
                    type="button"
                    title={palet.label}
                    onClick={() => set("neonWarna", w)}
                    className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] transition ${
                      dipilih
                        ? "border-amber-400/80 bg-amber-400/15 text-amber-200"
                        : "border-slate-700 bg-slate-800/60 text-slate-300 hover:border-slate-500"
                    }`}
                  >
                    <span
                      className="h-3.5 w-3.5 rounded-full"
                      style={
                        w === "rainbow"
                          ? {
                              background:
                                "linear-gradient(90deg,#ff004c,#ff8a00,#ffe600,#4dff00,#00e5ff,#2b6bff,#b400ff)",
                            }
                          : { background: palet.dasar || palet.inti, boxShadow: `0 0 6px ${palet.glow || palet.inti}` }
                      }
                    />
                    {palet.label}
                  </button>
                );
              })}
            </div>
          </div>
          <BarisSlider
            label="Ketebalan garis"
            nilai={pengaturan.neonTebal}
            min={2}
            max={16}
            onChange={(n) => set("neonTebal", n)}
            fmt={(n) => `${n} px`}
          />
          <BarisSlider
            label="Kecepatan putar"
            nilai={pengaturan.neonKecepatan}
            min={0.2}
            max={3}
            step={0.1}
            onChange={(n) => set("neonKecepatan", Math.round(n * 10) / 10)}
            fmt={(n) => `${n.toFixed(1)}× (${(6 / Math.max(0.2, n)).toFixed(1)} dtk/putaran)`}
          />
          <ChipPilihan<"satu" | "dua">
            pilihan={[
              { v: "satu", label: "Satu garis" },
              { v: "dua", label: "Dua garis berlawanan" },
            ]}
            nilai={pengaturan.neonDuaGaris ? "dua" : "satu"}
            onChange={(v) => set("neonDuaGaris", v === "dua")}
          />
          <p className="text-[11px] text-slate-500">
            Komet: kepala paling terang + ekor memudar, melintasi keempat sudut bingkai membulat.
            Berlaku untuk 9:16 &amp; 16:9, ikut terbakar ke video saat ekspor.
          </p>
        </div>
      )}

      {/* ---- terapkan ke semua ---- */}
      <button
        type="button"
        onClick={onTerapkanSemua}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-amber-400/40 bg-amber-400/10 px-3 py-2.5 text-xs font-medium text-amber-200 transition hover:bg-amber-400/20"
      >
        <Wand2 className="h-4 w-4" />
        Terapkan frame &amp; bingkai ini ke SEMUA video (dari setelan video #{nomorVideo})
      </button>
      <p className="mt-1.5 text-center text-[11px] text-slate-500">
        Menyalin pilihan frame, seluruh setelan neon, dan warna gradasi template ke semua video dalam antrean.
      </p>
    </Kartu>
  );
}

/* ============ 6 — COVER & INTRO (v2.5.0 — DUA MENU DIGABUNG) ============
 * Permintaan user: "bisakah ke dua menu ini kamu gabungkan dalam 1 menu (di
 * dalam tempat yang sama)" → Thumbnail otomatis (dulu di panel Ekspor) kini
 * BERTEMPAT SATU KARTU dgn Background intro (menu 6), plus pilihan cakupan
 * cover SAMA PERSIS SEMUA (cover identik tanpa nomor part) dan tombol
 * "Terapkan setelan intro ke SEMUA video". */
export function PanelCoverIntro({
  pengaturan,
  onChange,
  nomorVideo,
  // v2.1.0 — suara intro (file sendiri + volume)
  suaraInfo,
  onSuaraFile,
  onHapusSuara,
  suaraSibuk,
  bukaDialogAudio,
  // v2.5.0 — thumbnail otomatis (opsi GLOBAL antrean) + terapkan intro ke semua
  opsiThumb,
  onOpsiThumb,
  totalVideo,
  onTerapkanIntroSemua,
}: {
  pengaturan: Pengaturan;
  onChange: (p: Pengaturan) => void;
  nomorVideo: number;
  /** v2.1.0 — info suara intro terpasang */
  suaraInfo: { nama: string } | null;
  onSuaraFile: (f: File) => void;
  onHapusSuara: () => void;
  suaraSibuk: boolean;
  /** v2.1.0 — mode desktop: dialog natif utk audio */
  bukaDialogAudio?: () => void;
  /** v2.5.0 — opsi thumbnail GLOBAL (berlaku semua video otomatis) */
  opsiThumb: OpsiThumbnail;
  onOpsiThumb: (o: OpsiThumbnail) => void;
  totalVideo: number;
  /** v2.5.0 — terapkan setelan intro video aktif ke SEMUA video */
  onTerapkanIntroSemua: () => void;
}) {
  const set = <K extends keyof Pengaturan>(k: K, v: Pengaturan[K]) =>
    onChange({ ...pengaturan, [k]: v });
  const aktif = pengaturan.introAktif === true;
  return (
    <Kartu
      nomor="06"
      judul="Cover & Intro — frame dari video"
      badge="Gabungan"
      deskripsi={`Thumbnail otomatis semua part + pembuka intro — video #${nomorVideo}`}
      ikon={<ImageIcon className="h-4 w-4" />}
    >
      {/* ===== BAGIAN A — THUMBNAIL OTOMATIS (cover tiap part — GLOBAL, semua video) ===== */}
      <div className="rounded-xl border border-cyan-400/25 bg-cyan-400/5 p-3">
        <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-cyan-200">
          <ImageIcon className="h-3.5 w-3.5" /> Thumbnail otomatis — cover tiap potongan
        </p>
        <button
          type="button"
          onClick={() => onOpsiThumb({ ...opsiThumb, aktif: !opsiThumb.aktif })}
          className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-xs transition ${
            opsiThumb.aktif
              ? "border-emerald-400/50 bg-emerald-400/10 text-emerald-200"
              : "border-slate-700 bg-slate-800/60 text-slate-400"
          }`}
        >
          <span className="flex items-center gap-1.5">
            <ImageIcon className="h-3.5 w-3.5" /> PAKAI — buat gambar cover tiap potongan
          </span>
          <span className="font-medium">{opsiThumb.aktif ? "Aktif" : "Mati"}</span>
        </button>
        {opsiThumb.aktif && (
          <div className="mt-2 space-y-2">
            <div>
              <p className="mb-1 text-[11px] text-slate-400">Kata label di cover</p>
              <ChipPilihan
                nilai={opsiThumb.kata}
                onChange={(v) => onOpsiThumb({ ...opsiThumb, kata: v })}
                pilihan={[
                  { v: "Part", label: "Part" },
                  { v: "Bagian", label: "Bagian" },
                  { v: "Episode", label: "Episode" },
                ]}
              />
            </div>
            <div>
              <p className="mb-1 text-[11px] text-slate-400">Format gambar</p>
              <ChipPilihan
                nilai={opsiThumb.format}
                onChange={(v) => onOpsiThumb({ ...opsiThumb, format: v })}
                pilihan={[
                  { v: "jpg", label: "JPG", hint: "ringan, cocok upload" },
                  { v: "png", label: "PNG", hint: "tajam, agak besar" },
                ]}
              />
            </div>
            {/* v2.3.0 + v2.5.0 — cakupan frame: tiap part beda / satu utk semua /
                SAMA PERSIS SEMUA (cover identik tanpa nomor part) */}
            <div>
              <p className="mb-1 text-[11px] text-slate-400">Cakupan cover</p>
              <ChipPilihan
                nilai={opsiThumb.mode}
                onChange={(v) => onOpsiThumb({ ...opsiThumb, mode: v })}
                pilihan={[
                  { v: "per-part", label: "Tiap part beda", hint: "tiap potongan frame sendiri" },
                  { v: "satu", label: "Satu untuk semua", hint: "1 frame video + nomor part tiap cover" },
                  { v: "identik", label: "Sama persis semua", hint: "cover IDENTIK tanpa nomor part — paling seragam" },
                ]}
              />
            </div>
            {/* v2.3.0 — gaya bingkai cover: klasik / modern / futuristik */}
            <div>
              <p className="mb-1 text-[11px] text-slate-400">Gaya cover</p>
              <ChipPilihan
                nilai={opsiThumb.gaya}
                onChange={(v) => onOpsiThumb({ ...opsiThumb, gaya: v })}
                pilihan={[
                  { v: "klasik", label: "Klasik", hint: "bingkai emas, huruf fantasi" },
                  { v: "modern", label: "Modern", hint: "kotak gelap bersih (bawaan)" },
                  { v: "futuristik", label: "Futuristik", hint: "neon cyan, sudut bracket" },
                ]}
              />
            </div>
            <p className="text-[11px] leading-relaxed text-slate-500">
              Tiap potongan diberi gambar cover: frame dari video + JUDUL (dari nama
              file) + label {opsiThumb.kata} + nomor part — tersimpan di samping hasil
              split, ikut unduhan &amp; ZIP. GABUNG VIDEO juga dapat 1 cover. Pilihan di
              bagian ini berlaku otomatis untuk SEMUA video di antrean.
              {opsiThumb.mode === "satu"
                ? " Cakupan SATU UNTUK SEMUA: satu frame video (menit 1–3) dipakai semua part — ekstraksi cuma 1×, ekspor lebih cepat, frame seragam."
                : opsiThumb.mode === "identik"
                  ? " Cakupan SAMA PERSIS SEMUA: satu frame video (menit 1–3) dipakai SEMUA part dan TANPA nomor part → file cover 100% IDENTIK satu sama lain (persis sama semua)."
                  : " Cakupan TIAP PART BEDA: tiap potongan punya frame-nya sendiri (dari menit 1–3 video)."}
            </p>
          </div>
        )}
      </div>

      {/* ===== BAGIAN B — BACKGROUND INTRO (pembuka — per video) ===== */}
      <div className="mt-3 rounded-xl border border-amber-400/25 bg-amber-400/5 p-3">
        <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-amber-200">
          <Sparkles className="h-3.5 w-3.5" /> Background intro — pembuka otomatis
        </p>
        {/* ---- v2.2.0 — SAKELAR UTAMA ---- */}
        <ChipPilihan
          nilai={aktif ? "on" : "off"}
          onChange={(v) => set("introAktif", v === "on")}
          pilihan={[
            { v: "off", label: "Mati", hint: "tanpa intro (bawaan)" },
            { v: "on", label: "Aktif", hint: "frame video jadi pembuka" },
          ]}
        />
        {aktif && (
          <div className="mt-3 space-y-3">
            {/* ---- v2.2.0 — INFO SUMBER FRAME (v2.2.1: menit 1–3 utk kecepatan) ---- */}
            <div className="rounded-xl border border-amber-400/30 bg-amber-400/5 p-3">
              <p className="text-xs leading-relaxed text-amber-200/90">
                Background diambil OTOMATIS dari video ini — frame diambil di antara
                MENIT 1–3 video (permintaan: lebih cepat), lalu diberi animasi, judul,
                dan label Part.
              </p>
            </div>
            {/* ---- v2.2.0 — POSISI FRAME (SLIDER BEBAS 0–100%) ---- */}
            <BarisSlider
              label="Posisi frame (antara menit 1–3)"
              nilai={pengaturan.introPosisi}
              min={0}
              max={100}
              onChange={(n) => set("introPosisi", n)}
              fmt={(n) => `${n}%`}
            />
            <p className="-mt-2 text-[11px] text-slate-500">
              0% = menit 1 · 35% = rekomendasi · 100% = menit 3 — dipetakan dari posisi potongan
              (video &lt; 1¼ menit: frame diambil persis di potongan)
            </p>
            <BarisSlider
              label="Durasi intro tiap potongan"
              nilai={pengaturan.durasiIntro}
              min={1}
              max={10}
              onChange={(n) => set("durasiIntro", n)}
              fmt={(n) => `${n} detik`}
            />
            {/* ---- v2.1.0 — ANIMASI KEN BURNS ---- */}
            <div>
              <p className="mb-1 text-xs font-medium text-slate-300">Animasi gambar (Ken Burns)</p>
              <ChipPilihan
                nilai={pengaturan.introAnimasi}
                onChange={(v) => set("introAnimasi", v)}
                pilihan={[
                  { v: "mati", label: "Diam", hint: "tanpa gerak" },
                  { v: "zoom-masuk", label: "Zoom masuk", hint: "perlahan membesar" },
                  { v: "zoom-keluar", label: "Zoom keluar", hint: "besar → normal" },
                  { v: "geser-kiri", label: "Geser kiri", hint: "kamera meluncur" },
                  { v: "geser-kanan", label: "Geser kanan", hint: "kamera meluncur" },
                ]}
              />
            </div>
            {/* ---- v2.1.0 — TRANSISI KE VIDEO ---- */}
            <div>
              <p className="mb-1 text-xs font-medium text-slate-300">Pergantian ke video utama</p>
              <ChipPilihan
                nilai={pengaturan.introFade ? "fade" : "langsung"}
                onChange={(v) => set("introFade", v === "fade")}
                pilihan={[
                  { v: "fade", label: "Fade lembut", hint: "melebur 0,5 dtk (disarankan)" },
                  { v: "langsung", label: "Langsung", hint: "potong kering" },
                ]}
              />
            </div>
            {/* ---- v2.1.0 — MUNCUL DI POTONGAN MANA ---- */}
            <div>
              <p className="mb-1 text-xs font-medium text-slate-300">Muncul di potongan</p>
              <ChipPilihan
                nilai={pengaturan.introTampil}
                onChange={(v) => set("introTampil", v)}
                pilihan={[
                  { v: "semua", label: "Semua potongan" },
                  { v: "pertama", label: "Hanya potongan 1" },
                  { v: "pertama-terakhir", label: "Potongan 1 & terakhir" },
                ]}
              />
            </div>
            {/* ---- v2.2.0 — TEKS OTOMATIS DI ATAS INTRO ---- */}
            <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 p-3">
              <p className="mb-1 text-xs font-medium text-slate-300">Teks otomatis di atas intro</p>
              <p className="mb-2 text-[11px] leading-relaxed text-slate-500">
                Judul diambil dari NAMA FILE video + label {pengaturan.kataPart || "Part"} 01, 02, …
                (kata ikut setelan menu 3 Tulisan Part).
              </p>
              <div className="space-y-2">
                <div>
                  <p className="mb-1 text-[11px] text-slate-400">Font teks intro</p>
                  <select
                    value={pengaturan.introTeksFont}
                    onChange={(e) => set("introTeksFont", e.target.value as NamaFont)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800/70 p-2 text-sm text-slate-100 outline-none focus:border-amber-400/70"
                  >
                    {(Object.keys(INFO_FONT) as NamaFont[]).map((f) => (
                      <option key={f} value={f} style={{ fontFamily: FONT_CSS[f] }}>
                        {INFO_FONT[f]}
                      </option>
                    ))}
                  </select>
                </div>
                <BarisSlider
                  label="Ukuran teks intro"
                  nilai={pengaturan.introTeksUkuran}
                  min={20}
                  max={160}
                  onChange={(n) => set("introTeksUkuran", n)}
                  fmt={(n) => `${n} px`}
                />
                <PilihWarna
                  label="Warna teks intro"
                  nilai={pengaturan.introTeksWarna}
                  onChange={(v) => set("introTeksWarna", v)}
                />
                <p className="text-[11px] text-slate-500">
                  Label Part tampil kuning di bawah judul; outline hitam otomatis agar selalu terbaca;
                  teks hanya tampil selama intro.
                </p>
              </div>
            </div>
            {/* ---- v2.1.0 — SUARA INTRO ---- */}
            <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 p-3">
              <p className="mb-1.5 text-xs font-medium text-slate-300">Suara intro (opsional)</p>
              {suaraInfo ? (
                <div className="rounded-lg bg-slate-800/60 px-3 py-2">
                  <p className="truncate text-xs text-slate-200">🎵 {suaraInfo.nama}</p>
                  <div className="mt-1.5">
                    <BarisSlider
                      label="Volume suara intro"
                      nilai={pengaturan.introSuaraVolume}
                      min={0}
                      max={150}
                      onChange={(n) => set("introSuaraVolume", n)}
                      fmt={(n) => `${n}%`}
                    />
                  </div>
                  <audio
                    controls
                    loop
                    src={`/api/file?p=${encodeURIComponent(pengaturan.introSuaraFile)}`}
                    className="mt-2 h-8 w-full"
                  />
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <p className="text-[11px] text-slate-500">
                      Diputar selama intro (berulang bila lebih pendek); memudar keluar saat fade.
                    </p>
                    <button
                      type="button"
                      onClick={onHapusSuara}
                      className="shrink-0 rounded-md border border-red-400/40 px-2 py-0.5 text-[10px] text-red-300 hover:bg-red-400/10"
                    >
                      Hapus
                    </button>
                  </div>
                </div>
              ) : (
                <JatuhBerkas
                  terima="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac"
                  hint="Taruh MP3/WAV di sini — musik pembuka"
                  sibuk={suaraSibuk}
                  onFile={onSuaraFile}
                  bukaDialog={bukaDialogAudio}
                />
              )}
            </div>
          </div>
        )}
      </div>

      {/* ===== v2.5.0 — TERAPKAN SETELAN INTRO KE SEMUA VIDEO (permintaan user:
          "buatkan pilihan di terapkan kesemua video untuk settingannya yang telah
          di pilih") — cover (Bagian A) memang global; yang disalin = Bagian B ===== */}
      {totalVideo > 1 && (
        <>
          <button
            type="button"
            onClick={onTerapkanIntroSemua}
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-cyan-400/50 bg-cyan-400/10 py-2 text-xs font-medium text-cyan-200 transition hover:bg-cyan-400/20"
          >
            <Copy className="h-3.5 w-3.5" />
            Terapkan setelan intro video #{nomorVideo} ke SEMUA video ({totalVideo})
          </button>
          <p className="mt-1.5 text-[11px] leading-snug text-slate-500">
            Yang disalin: intro aktif/mati, posisi frame, durasi, animasi, fade, muncul di
            potongan, teks intro, suara intro &amp; volume. Pilihan thumbnail di Bagian A
            memang sudah berlaku otomatis untuk semua video.
          </p>
        </>
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
      nomor="07"
      judul="Watermark / logo (opsional)"
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
    <Kartu nomor="RK" judul="Ringkasan" ikon={<Film className="h-4 w-4" />}>
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
            ? `Blur lembut · ${labelZoomBlur(pengaturan.zoomBlur)}${
                pengaturan.zoomBlur > 100 ? ` · ${labelPosisiPotong(pengaturan.posisiPotong)}` : ""
              }`
            : pengaturan.mode === "crop"
              ? `Potong penuh · ${labelPosisiPotong(pengaturan.posisiPotong)}`
              : pengaturan.mode === "warna"
                ? "Warna solid"
                : pengaturan.mode === "template"
                  ? "Template halaman"
                  : `Video original · ${lebarVideo > 0 ? `${lebarVideo}×${tinggiVideo}` : "rasio asli"}`}
        </dd>
        {/* v0.46.0 — status frame & bingkai */}
        <dt className="text-slate-500">Frame &amp; bingkai</dt>
        <dd className="text-right text-slate-200">
          {[
            pengaturan.frameId
              ? `frame ${pengaturan.frameId.startsWith("bawaan:") ? pengaturan.frameId.slice(7) : "unggahan"}`
              : null,
            pengaturan.neonAktif
              ? `neon ${pengaturan.neonWarna} · ${pengaturan.neonTebal}px · ${pengaturan.neonKecepatan.toFixed(1)}×${pengaturan.neonDuaGaris ? " · 2 garis" : ""}`
              : null,
          ]
            .filter(Boolean)
            .join(" + ") || "tanpa frame"}
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
          {/* v2.2.0 — intro frame dari video: status dari introAktif (bukan lagi
              gambar unggahan) */}
          {pengaturan.introAktif
            ? `frame video menit 1–3 (${pengaturan.introPosisi}%) · ${pengaturan.durasiIntro} dtk / potongan`
            : "tanpa background"}
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
            Yang ikut: <b className="text-slate-400">01 Cara ubah ke vertikal</b> ·{" "}
            <b className="text-slate-400">03 Tulisan Part otomatis</b> ·{" "}
            <b className="text-slate-400">07 Watermark/logo</b> — logo cukup diunggah{" "}
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
