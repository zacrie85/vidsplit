"use client";

// VidSplit v0.11.0 — STUDIO MUSIK: panel kolom KANAN
// 2. Pengubah genre (17 genre, mode LAPISAN / TRANSFORMASI PENUH) · 3. Tempo (0.5×/1×/1.5×)
// 4. Vokal & karaoke · 5. Visual musik (15 gaya + kustom)
import { BarisSlider, ChipPilihan, Kartu, PilihWarna } from "@/components/vds/bits";
import { Mic, Palette, SlidersHorizontal, Timer } from "lucide-react";
import {
  DAFTAR_GENRE, INFO_GENRE, RESEP_GENRE, VISUAL_MUSIK,
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
  vokalLevel: number;
  visual: IdVisual;
  resolusi: "720" | "1080";
  vis: OpsiVisual;
}

export const aturMusikDefault: AturMusik = {
  genre: "asli",
  layerLevel: 30,
  karaoke: "asli",
  mode: "penuh",
  kecepatan: 1,
  grooveLevel: 70,
  melodiLevel: 55,
  vokalLevel: 100,
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
    const bawaan = g === "asli" ? 0 : RESEP_GENRE[g].layerBawaan;
    ubah({ genre: g, layerLevel: bawaan });
  };
  return (
    <Kartu
      judul="2. Pengubah genre musik"
      deskripsi="17 genre — pilih cara mengubah: lapisan di atas lagu, atau transformasi penuh"
      ikon={<SlidersHorizontal className="h-4 w-4" />}
    >
      <ChipPilihan<ModeTransformasi>
        nilai={atur.mode}
        onChange={(v) => ubah({ mode: v })}
        pilihan={[
          { v: "penuh", label: "Transformasi penuh", hint: "Instrumen diganti total" },
          { v: "lapisan", label: "Lapisan", hint: "Lagu asli + lapisan genre" },
        ]}
      />
      {atur.mode === "penuh" ? (
        <p className="mt-2 rounded-lg border border-amber-400/30 bg-amber-400/5 p-2 text-[11px] leading-relaxed text-amber-200/90">
          <b>Transformasi penuh</b> — lagu asli dianalisis (BPM, chord, melodi), lalu
          seluruh iringannya DIRENDER ULANG dgn alat musik genre pilihan. Vokal & melodi
          asli tetap dipertahankan sebagai pegangan.
        </p>
      ) : (
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
      {atur.genre !== "asli" && (
        <div className="mt-3 space-y-2 rounded-xl border border-slate-700/60 bg-slate-800/40 p-3">
          {atur.mode === "penuh" ? (
            <>
              <BarisSlider
                label="Iringan genre (drum, bass, akor)"
                nilai={atur.grooveLevel}
                min={0}
                max={100}
                step={5}
                fmt={(n) => (n === 0 ? "Mati" : `${n}%`)}
                onChange={(n) => ubah({ grooveLevel: n })}
              />
              <BarisSlider
                label="Melodi asli (alat lead khas genre)"
                nilai={atur.melodiLevel}
                min={0}
                max={100}
                step={5}
                fmt={(n) => (n === 0 ? "Mati" : `${n}%`)}
                onChange={(n) => ubah({ melodiLevel: n })}
              />
              <BarisSlider
                label="Vokal asli (0% = instrumental)"
                nilai={atur.vokalLevel}
                min={0}
                max={100}
                step={5}
                fmt={(n) => (n === 0 ? "Instrumental" : `${n}%`)}
                onChange={(n) => ubah({ vokalLevel: n })}
              />
              <p className="text-[11px] leading-relaxed text-slate-500">
                {INFO_GENRE[atur.genre].deskripsi}. Semua iringan dirender ulang mengikuti
                chord & BPM lagu asli — vokal 0% = langsung jadi lagu instrumental.
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
        deskripsi="Dalam mode transformasi penuh, vokal dikendalikan lewat slider"
        ikon={<Mic className="h-4 w-4" />}
      >
        <p className="rounded-lg border border-slate-700/60 bg-slate-800/40 p-2.5 text-[11px] leading-relaxed text-slate-400">
          Slider <b className="text-amber-200">“Vokal asli”</b> di menu 2 yang mengatur vokal:
          <b> 0% = instrumental karaoke</b> (iringan genre saja),
          <b> 100% = vokal utuh</b> diiring band genre pilihan.
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
