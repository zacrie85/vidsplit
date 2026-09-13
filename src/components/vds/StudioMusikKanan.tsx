"use client";

// VidSplit v0.14.0 — STUDIO MUSIK: panel kolom KANAN
// 2. Pengubah genre (17 genre, mode VERSI GENRE ala Suno / MUSIK BARU DARI CHORD / LAPISAN)
// 3. Tempo (0.5×/1×/1.5×) · 4. Vokal & karaoke · 5. Visual musik (15 gaya + kustom)
import { BarisSlider, ChipPilihan, Kartu, PilihWarna } from "@/components/vds/bits";
import { Mic, Palette, SlidersHorizontal, Sparkles, Timer } from "lucide-react";
import {
  DAFTAR_GENRE, INFO_GENRE, RESEP_GENRE, VISUAL_MUSIK, transposeAuto,
  type GenreMusik, type IdVisual, type KaraokeMode, type ModeTransformasi, type OpsiVisual,
} from "@/lib/vidsplit/musik";
import { INFO_FONT, type NamaFont } from "@/lib/vidsplit/types";

export interface AturMusik {
  genre: GenreMusik | "asli";
  layerLevel: number;
  karaoke: KaraokeMode;
  mode: ModeTransformasi;
  kecepatan: number;
  grooveLevel: number;
  melodiLevel: number;
  melodiAsliLevel: number;
  vokalLevel: number;
  variasi: number;
  /** v0.13.0 (remake) 40–100 % kemiripan dgn asli — sisanya = perubahan */
  kemiripan: number;
  /** v0.13.0 (remake) transpos -5..+5 semitone; null = otomatis dari kemiripan */
  transpose: number | null;
  /** v0.14.0 (remake) 0–100 tingkat rasa genre — warna suara tanpa nada tambahan */
  tingkatGenre: number;
  visual: IdVisual;
  resolusi: "720" | "1080";
  vis: OpsiVisual;
}

export const aturMusikDefault: AturMusik = {
  genre: "asli",
  // v0.14.0 — lapisan sintesis bawaan MATI (sumber bentrok irama); warna genre 55%
  layerLevel: 0,
  tingkatGenre: 55,
  karaoke: "asli",
  mode: "remake",
  kecepatan: 1,
  grooveLevel: 75,
  melodiLevel: 65,
  melodiAsliLevel: 0,
  vokalLevel: 0,
  variasi: 0,
  kemiripan: 80,
  transpose: null,
  visual: "cqt-klasik",
  resolusi: "720",
  vis: {
    warna1: "#22d3ee",
    warna2: "#fbbf24",
    sensitivitas: 5,
    bgMode: "gelap",
    fontJudul: "bebas",
    teksJudul: "",
    tampilJudul: true,
    tampilChord: true,
    tampilLirik: true,
  },
};

export type UbahMusik = (u: Partial<AturMusik>) => void;

// ============ 2. PENGUBAH GENRE (17) — LAPISAN / PENUH ============

export function PanelGenre({ atur, ubah }: { atur: AturMusik; ubah: UbahMusik }) {
  const pilihGenre = (g: GenreMusik | "asli") => {
    // v0.14.0 — remake/penuh: lapisan TETAP mati (sumber konflik irama); hanya mode
    // lapisan klasik yang tetap memakai bawaan lama
    const bawaan = atur.mode === "lapisan" && g !== "asli" ? RESEP_GENRE[g].layerBawaan : 0;
    ubah({ genre: g, layerLevel: bawaan });
  };
  const transposeEfe = atur.transpose ?? transposeAuto(atur.kemiripan, "pratinjau");
  return (
    <Kartu
      judul="2. Pengubah genre musik"
      deskripsi="17 genre — Versi genre mirip asli (disarankan), musik baru dari chord, atau lapisan"
      ikon={<SlidersHorizontal className="h-4 w-4" />}
    >
      <ChipPilihan<ModeTransformasi>
        nilai={atur.mode}
        onChange={(v) => ubah({ mode: v })}
        pilihan={[
          { v: "remake", label: "Versi genre — mirip asli", hint: "Lagu asli 100% + gaya genre terkunci" },
          { v: "penuh", label: "Musik baru dari chord", hint: "Musik diciptakan ulang total" },
          { v: "lapisan", label: "Lapisan", hint: "Lagu asli + lapisan genre (v0.10)" },
        ]}
      />
      {atur.mode === "remake" && (
        <p className="mt-2 rounded-lg border border-emerald-400/30 bg-emerald-400/5 p-2 text-[11px] leading-relaxed text-emerald-200/90">
          <b>Versi genre (prinsip Suno, offline)</b> — lagu asli dipertahankan 100%:
          melodi, vokal dan groove persis rekaman asli, <b>tanpa satu pun nada tambahan</b>
          (sumber bentrok irama dihapus). Gaya diubah lewat transformasi yang
          <b> terkunci ke lagu</b>: warna genre (EQ/karakter/ruang/lebar stereo), gerak
          yang lajunya dihitung dari BPM lagu sendiri, dan geser nada dasar. Karena itu
          hasilnya <b>mustahil saling bertentangan</b> dgn irama asli — tinggal atur
          seberapa kuat rasa genrenya.
        </p>
      )}
      {atur.mode === "penuh" && (
        <p className="mt-2 rounded-lg border border-amber-400/30 bg-amber-400/5 p-2 text-[11px] leading-relaxed text-amber-200/90">
          <b>Musik baru dari chord</b> — chord lagu asli diekstrak sebagai referensi, lalu
          musik yang BENAR-BENAR BARU diciptakan dgn alat musik khas genre: pilih
          <b> Dangdut</b> → kendang ganda, seruling, tabla dan sitar rasa India; pilih genre
          lain → dominasi berubah total. Catatan: alat musik sintesis offline tidak akan
          sebagus rekaman asli — utk hasil paling natural gunakan <b>Remake</b>.
        </p>
      )}
      {atur.mode === "lapisan" && (
        <p className="mt-2 rounded-lg border border-slate-700/60 bg-slate-800/40 p-2 text-[11px] leading-relaxed text-slate-400">
          <b>Lapisan</b> — lagu asli utuh + efek karakter genre + lapisan alat musik baru
          di atasnya (cara v0.10).
        </p>
      )}
      <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
        <button
          type="button"
          onClick={() => pilihGenre("asli")}
          className={`rounded-lg border px-2 py-1.5 text-left text-xs transition ${
            atur.genre === "asli"
              ? "border-amber-400/80 bg-amber-400/15 text-amber-200"
              : "border-slate-700 bg-slate-800/60 text-slate-300 hover:border-slate-500"
          }`}
        >
          <span className="block font-medium">Asli</span>
          <span className="block text-[10px] opacity-70">Tanpa ubah genre</span>
        </button>
        {DAFTAR_GENRE.map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => pilihGenre(g)}
            title={INFO_GENRE[g].deskripsi}
            className={`rounded-lg border px-2 py-1.5 text-left text-xs transition ${
              atur.genre === g
                ? "border-amber-400/80 bg-amber-400/15 text-amber-200"
                : "border-slate-700 bg-slate-800/60 text-slate-300 hover:border-slate-500"
            }`}
          >
            <span className="block font-medium">{INFO_GENRE[g].label}</span>
            <span className="block truncate text-[10px] opacity-70">{INFO_GENRE[g].deskripsi}</span>
          </button>
        ))}
      </div>
      {atur.mode === "remake" ? (
        <div className="mt-3 space-y-2 rounded-xl border border-emerald-400/25 bg-slate-800/40 p-3">
          <BarisSlider
            label="Tingkat kemiripan dengan lagu asli"
            nilai={atur.kemiripan}
            min={40}
            max={100}
            step={5}
            fmt={(n) => `${n}% mirip`}
            onChange={(n) => ubah({ kemiripan: n, transpose: null })}
          />
          <div>
            <p className="mb-1 text-xs text-slate-400">Geser nada dasar (transpos)</p>
            <ChipPilihan<string>
              nilai={atur.transpose === null ? "auto" : String(atur.transpose)}
              onChange={(v) => ubah({ transpose: v === "auto" ? null : Number(v) })}
              pilihan={[
                { v: "auto", label: "Auto", hint: "ikuti tingkat kemiripan" },
                { v: "0", label: "0", hint: "tetap" },
                { v: "1", label: "+1", hint: "semitone naik" },
                { v: "2", label: "+2", hint: "2 semitone naik" },
                { v: "3", label: "+3", hint: "3 semitone naik" },
                { v: "-1", label: "−1", hint: "semitone turun" },
                { v: "-2", label: "−2", hint: "2 semitone turun" },
                { v: "-3", label: "−3", hint: "3 semitone turun" },
              ]}
            />
          </div>
          {atur.genre !== "asli" && (
            <BarisSlider
              label={`Tingkat rasa genre ${INFO_GENRE[atur.genre].label} (warna suara)`}
              nilai={atur.tingkatGenre}
              min={0}
              max={100}
              step={5}
              fmt={(n) => (n === 0 ? "Apa adanya" : `${n}%`)}
              onChange={(n) => ubah({ tingkatGenre: n })}
            />
          )}
          {atur.genre !== "asli" && (
            <BarisSlider
              label={`Lapisan irama sintesis (EKSPERIMENTAL — bisa tidak sinkron)`}
              nilai={atur.layerLevel}
              min={0}
              max={100}
              step={5}
              fmt={(n) => (n === 0 ? "Mati (disarankan)" : `${n}%`)}
              onChange={(n) => ubah({ layerLevel: n })}
            />
          )}
          <p className="text-[11px] leading-relaxed text-slate-500">
            {atur.transpose === null
              ? `Auto: nada dasar ${transposeEfe === 0 ? "tetap (100% mirip)" : `digeser ${transposeEfe > 0 ? "+" : ""}${transposeEfe} semitone`}`
              : `Nada dasar digeser ${transposeEfe > 0 ? "+" : ""}${transposeEfe} semitone (manual)`}
            {atur.genre !== "asli"
              ? `, warna ${INFO_GENRE[atur.genre].label} ${atur.tingkatGenre}% (tanpa nada tambahan — dijamin seirama)`
              : ""}
            {atur.layerLevel > 0 && atur.genre !== "asli"
              ? ` + lapisan eksperimental ${atur.layerLevel}%`
              : ""}
            . Durasi dan tempo lagu tetap sama.
          </p>
        </div>
      ) : atur.genre !== "asli" && (
        <div className="mt-3 space-y-2 rounded-xl border border-slate-700/60 bg-slate-800/40 p-3">
          {atur.mode === "penuh" ? (
            <>
              <BarisSlider
                label="Iringan genre (drum, bass, akor, perkusi)"
                nilai={atur.grooveLevel}
                min={0}
                max={100}
                step={5}
                fmt={(n) => (n === 0 ? "Mati" : `${n}%`)}
                onChange={(n) => ubah({ grooveLevel: n })}
              />
              <BarisSlider
                label="Melodi baru — diciptakan dari chord"
                nilai={atur.melodiLevel}
                min={0}
                max={100}
                step={5}
                fmt={(n) => (n === 0 ? "Mati" : `${n}%`)}
                onChange={(n) => ubah({ melodiLevel: n })}
              />
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <BarisSlider
                    label={`Variasi melodi (pola #${atur.variasi + 1} dari 8)`}
                    nilai={atur.variasi}
                    min={0}
                    max={7}
                    step={1}
                    fmt={(n) => `#${n + 1}`}
                    onChange={(n) => ubah({ variasi: n })}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => ubah({ variasi: (atur.variasi + 1) % 8 })}
                  className="mb-0.5 inline-flex shrink-0 items-center gap-1 rounded-lg border border-amber-400/50 bg-amber-400/10 px-2.5 py-1.5 text-xs font-medium text-amber-200 transition hover:bg-amber-400/20"
                  title="Ganti pola melodi baru dgn variasi lain"
                >
                  <Sparkles className="h-3.5 w-3.5" /> Variasikan
                </button>
              </div>
              <div className="rounded-lg border border-slate-700/50 bg-slate-900/40 p-2">
                <p className="text-[11px] font-medium text-slate-400">Lanjutan (opsional)</p>
                <div className="mt-1.5 space-y-2">
                  <BarisSlider
                    label="Melodi asli sebagai pegangan"
                    nilai={atur.melodiAsliLevel}
                    min={0}
                    max={100}
                    step={5}
                    fmt={(n) => (n === 0 ? "Mati (disarankan)" : `${n}%`)}
                    onChange={(n) => ubah({ melodiAsliLevel: n })}
                  />
                  <BarisSlider
                    label="Vokal asli (0% = musik baru murni)"
                    nilai={atur.vokalLevel}
                    min={0}
                    max={100}
                    step={5}
                    fmt={(n) => (n === 0 ? "Tanpa vokal" : `${n}%`)}
                    onChange={(n) => ubah({ vokalLevel: n })}
                  />
                </div>
              </div>
              <p className="text-[11px] leading-relaxed text-slate-500">
                {INFO_GENRE[atur.genre].deskripsi}. Musik baru diciptakan mengikuti chord
                & tempo lagu asli, tanpa audio asli ikut — coba tombol <b>Variasikan</b>
                {" "}utk pola melodi berbeda.
              </p>
            </>
          ) : (
            <>
              <BarisSlider
                label={`Lapisan ${INFO_GENRE[atur.genre].label} (drum/bass/khas genre)`}
                nilai={atur.layerLevel}
                min={0}
                max={100}
                step={5}
                fmt={(n) => (n === 0 ? "Mati" : `${n}%`)}
                onChange={(n) => ubah({ layerLevel: n })}
              />
              <p className="text-[11px] leading-relaxed text-slate-500">
                {INFO_GENRE[atur.genre].deskripsi}. Lapisan disintesis mengikuti BPM lagu —
                atur 0% untuk mematikan.
              </p>
            </>
          )}
        </div>
      )}
    </Kartu>
  );
}

// ============ 3. TEMPO (0.5× / 1× / 1.5×) ============

export function PanelTempo({ atur, ubah }: { atur: AturMusik; ubah: UbahMusik }) {
  return (
    <Kartu
      judul="3. Tempo lagu"
      deskripsi="Percepat atau perlambat tempo — nada tidak melenceng (pitch tetap)"
      ikon={<Timer className="h-4 w-4" />}
    >
      <ChipPilihan<string>
        nilai={String(atur.kecepatan)}
        onChange={(v) => ubah({ kecepatan: Number(v) })}
        pilihan={[
          { v: "0.5", label: "Perlambat 0.5×", hint: "2× lebih lama" },
          { v: "1", label: "Normal 1×", hint: "tempo asli" },
          { v: "1.5", label: "Percepat 1.5×", hint: "⅓ lebih cepat" },
        ]}
      />
      <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
        Kecepatan diterapkan nyata ke audio hasil (atempo) — vokal, iringan, lirik, dan
        chord ikut bergeser otomatis, nada tetap pada kuncinya.
      </p>
    </Kartu>
  );
}

// ============ 4. VOKAL & KARAOKE ============

export function PanelKaraoke({ atur, ubah }: { atur: AturMusik; ubah: UbahMusik }) {
  if (atur.mode === "penuh") {
    return (
      <Kartu
        judul="4. Vokal & karaoke"
        deskripsi="Dalam mode musik baru dari chord, vokal dikendalikan lewat slider"
        ikon={<Mic className="h-4 w-4" />}
      >
        <p className="rounded-lg border border-slate-700/60 bg-slate-800/40 p-2.5 text-[11px] leading-relaxed text-slate-400">
          Slider <b className="text-amber-200">“Vokal asli”</b> di menu 2 yang mengatur vokal:
          <b> 0% (bawaan) = musik baru murni tanpa suara asli</b> — ideal utk instrumental
          genre; naikkan bila ingin menyanyi sendiri di atas musik baru dgn vokal asli
          sbg panduan.
        </p>
      </Kartu>
    );
  }
  return (
    <Kartu
      judul="4. Vokal & karaoke"
      deskripsi="Pisahkan vokal dari musik — buat lagu karaoke atau batu vokal"
      ikon={<Mic className="h-4 w-4" />}
    >
      <ChipPilihan<KaraokeMode>
        nilai={atur.karaoke}
        onChange={(v) => ubah({ karaoke: v })}
        pilihan={[
          { v: "asli", label: "Asli", hint: "Tanpa dipisah" },
          { v: "karaoke", label: "Karaoke", hint: "Vokal dihapus, instrumen tersisa" },
          { v: "vokal", label: "Vokal saja", hint: "Instrumen diturunkan, vokal menonjol" },
        ]}
      />
      <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
        Metode DSP kanal-tengah/samping: paling efektif untuk MP3 <b>stereo</b> dgn vokal
        di tengah (umum di lagu komersial). Hasilnya langsung terdengar di pratinjau audio.
      </p>
    </Kartu>
  );
}

// ============ 5. VISUAL MUSIK (15) ============

const URUT_FONT: NamaFont[] = [
  "tebal", "bersih", "klasik", "bebas", "anton", "cinzel", "cinzeldec", "playfair",
  "marcellus", "julius", "oswald", "sixcaps", "teko", "alfaslab", "abril",
  "blackops", "creepster", "monoton",
];

export function PanelVisual({
  atur, ubah, judulLagu,
}: {
  atur: AturMusik; ubah: UbahMusik; judulLagu: string;
}) {
  const vis = atur.vis;
  const setVis = (u: Partial<OpsiVisual>) => ubah({ vis: { ...vis, ...u } });
  return (
    <Kartu
      judul="5. Visual musik"
      deskripsi="15 gaya visual yang bergerak mengikuti musik — bisa dikustom warna & sensitivitas"
      ikon={<Palette className="h-4 w-4" />}
    >
      <div className="grid grid-cols-2 gap-1.5">
        {VISUAL_MUSIK.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => ubah({ visual: v.id })}
            title={v.deskripsi}
            className={`rounded-lg border px-2 py-1.5 text-left text-xs transition ${
              atur.visual === v.id
                ? "border-amber-400/80 bg-amber-400/15 text-amber-200"
                : "border-slate-700 bg-slate-800/60 text-slate-300 hover:border-slate-500"
            }`}
          >
            <span className="block font-medium">{v.label}</span>
            <span className="block truncate text-[10px] opacity-70">{v.deskripsi}</span>
          </button>
        ))}
      </div>

      <div className="mt-3 space-y-2.5 rounded-xl border border-slate-700/60 bg-slate-800/40 p-3">
        <div className="flex flex-wrap items-center gap-3">
          <PilihWarna label="Warna 1" nilai={vis.warna1} onChange={(v) => setVis({ warna1: v })} />
          <PilihWarna label="Warna 2" nilai={vis.warna2} onChange={(v) => setVis({ warna2: v })} />
        </div>
        <BarisSlider
          label="Sensitivitas (gerakan mengikuti musik)"
          nilai={vis.sensitivitas}
          min={1}
          max={10}
          onChange={(n) => setVis({ sensitivitas: n })}
        />
        <div>
          <p className="mb-1 text-xs text-slate-400">Latar belakang</p>
          <ChipPilihan<OpsiVisual["bgMode"]>
            nilai={vis.bgMode}
            onChange={(v) => setVis({ bgMode: v })}
            pilihan={[
              { v: "gelap", label: "Gelap" },
              { v: "gradien", label: "Gradien warna 1-2" },
              { v: "hitam", label: "Hitam" },
            ]}
          />
        </div>
        <label className="block">
          <span className="mb-1 block text-xs text-slate-400">Teks judul di layar</span>
          <input
            type="text"
            value={vis.teksJudul}
            placeholder={judulLagu || "Judul lagu"}
            onChange={(e) => setVis({ teksJudul: e.target.value })}
            maxLength={120}
            className="w-full rounded-lg border border-slate-700 bg-slate-800/70 px-2.5 py-1.5 text-sm text-slate-100 outline-none focus:border-amber-400/70"
          />
        </label>
        <label className="flex items-center justify-between gap-2 text-xs text-slate-400">
          <span>Font judul</span>
          <select
            value={vis.fontJudul}
            onChange={(e) => setVis({ fontJudul: e.target.value as NamaFont })}
            className="rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-100"
          >
            {URUT_FONT.map((f) => (
              <option key={f} value={f}>{INFO_FONT[f]}</option>
            ))}
          </select>
        </label>
        <div className="flex flex-wrap gap-3 pt-0.5 text-xs text-slate-300">
          {(
            [
              ["tampilJudul", "Judul"],
              ["tampilChord", "Chord"],
              ["tampilLirik", "Lirik"],
            ] as const
          ).map(([k, label]) => (
            <label key={k} className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={vis[k]}
                onChange={(e) => setVis({ [k]: e.target.checked } as Partial<OpsiVisual>)}
                className="h-3.5 w-3.5 accent-amber-400"
              />
              {label}
            </label>
          ))}
        </div>
      </div>
    </Kartu>
  );
}
