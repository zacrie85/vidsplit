"use client";

// VidSplit — panel pengaturan: mode konversi, format hasil, rentang waktu, judul, Part,
// background intro, watermark/logo, ringkasan
import { useState } from "react";
import { toast } from "sonner";
import {
  Copy,
  Crop,
  Droplets,
  Film,
  Image as ImageIcon,
  MonitorPlay,
  Palette,
  Scan,
  Scissors,
  Stamp,
  Type,
  Zap,
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
  PRESET_CEPAT,
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
import { BarisSlider, ChipPilihan, JatuhBerkas, Kartu, PilihWarna, fmtUkuran } from "./bits";
import { PratinjauPotong } from "./PratinjauPotong";
import { PratinjauLogo } from "./PratinjauLogo";

const FONT_SINEMATIK = (Object.keys(INFO_FONT) as NamaFont[]).filter(
  (f) => !FONT_DASAR.includes(f),
);

function GayaEditor({
  gaya,
  onChange,
  maxUkuran,
}: {
  gaya: GayaTeks;
  onChange: (g: GayaTeks) => void;
  maxUkuran: number;
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

export function PanelAtur({
  pengaturan,
  onChange,
  bgInfo,
  onBgFile,
  onHapusBg,
  bgSibuk,
  logoInfo,
  onLogoFile,
  onHapusLogo,
  logoSibuk,
  durasiVideo,
  ukuranVideo,
  lebarVideo,
  tinggiVideo,
  srcUrl,
  nomorVideo,
  totalVideo,
  onTerapkanKeSemua,
}: {
  pengaturan: Pengaturan;
  onChange: (p: Pengaturan) => void;
  bgInfo: { nama: string; ukuran: number } | null;
  onBgFile: (f: File) => void;
  onHapusBg: () => void;
  bgSibuk: boolean;
  logoInfo: { nama: string; ukuran: number } | null;
  onLogoFile: (f: File) => void;
  onHapusLogo: () => void;
  logoSibuk: boolean;
  durasiVideo: number;
  ukuranVideo: string;
  /** lebar & tinggi sumber video (px) — untuk pratinjau potong yang akurat */
  lebarVideo: number;
  tinggiVideo: number;
  /** URL untuk menampilkan frame video (pratinjau potong) */
  srcUrl: string;
  /** nomor video yang sedang diedit (1-based) */
  nomorVideo: number;
  totalVideo: number;
  onTerapkanKeSemua: () => void;
}) {
  const set = <K extends keyof Pengaturan>(k: K, v: Pengaturan[K]) =>
    onChange({ ...pengaturan, [k]: v });
  const spanEfektif = durasiEfektif(durasiVideo, pengaturan.mulaiDetik, pengaturan.akhirDetik);
  const nPart = hitungPart(spanEfektif, pengaturan.durasiPart);
  const durasiOutput = spanEfektif + nPart * pengaturan.durasiIntro;
  const adaTrim = pengaturan.mulaiDetik > 0 || pengaturan.akhirDetik > 0;

  return (
    <div className="space-y-4">
      {/* 0 — Preset cepat satu klik */}
      <Kartu
        judul="Preset cepat"
        deskripsi={`Satu klik mengisi rekomendasi platform untuk video #${nomorVideo}`}
        ikon={<Zap className="h-4 w-4" />}
      >
        <div className="grid grid-cols-3 gap-2">
          {PRESET_CEPAT.map((pr) => (
            <button
              key={pr.id}
              type="button"
              onClick={() => {
                onChange({ ...pengaturan, ...pr.ubah });
                toast.success(`Preset ${pr.nama} diterapkan — ${pr.catatan}`);
              }}
              className="rounded-xl border border-slate-700 bg-slate-800/60 p-2.5 text-left transition hover:border-amber-400/70 hover:bg-amber-400/5"
            >
              <span className="block text-sm font-semibold text-slate-100">{pr.nama}</span>
              <span className="mt-0.5 block text-[10px] leading-snug text-slate-400">
                {pr.catatan}
              </span>
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-slate-500">
          Yang diubah: cara konversi, durasi part, resolusi 1080p, codec H.264. Judul, font,
          logo, background, dan rentang trim TIDAK diubah — tetap milikmu.
        </p>
      </Kartu>

      {/* A — Mode konversi & resolusi */}
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
            durasi, tulisan judul/Part, background intro, watermark, dan pilihan codec.
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

      {/* B — Judul */}
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
        />
      </Kartu>

      {/* C — Part */}
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

      {/* D — Background intro */}
      <Kartu
        judul="4. Background intro (opsional)"
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

      {/* E — Watermark / logo */}
      <Kartu
        judul="5. Watermark / logo (opsional)"
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

      {/* F — Ringkasan */}
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
          <button
            type="button"
            onClick={onTerapkanKeSemua}
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-sky-400/50 bg-sky-400/10 py-2 text-xs font-medium text-sky-200 transition hover:bg-sky-400/20"
          >
            <Copy className="h-3.5 w-3.5" />
            Terapkan pengaturan video #{nomorVideo} ke SEMUA video ({totalVideo})
          </button>
        )}
      </Kartu>
    </div>
  );
}
