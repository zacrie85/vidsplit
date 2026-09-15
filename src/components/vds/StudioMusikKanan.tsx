"use client";

// VidSplit v0.24.0 — STUDIO MUSIK: panel kolom KANAN
// 2. Pengubah genre (17 genre, SATU mode: VERSI GENRE ala Suno) · 3. Tempo (0.5×–1.5×)
// 4. Vokal & karaoke (mesin AI Gender Realistis — pitch & formant dipisah) · 5. Visual musik (15 gaya)
import { BarisSlider, ChipPilihan, Kartu, PilihWarna, fmtUkuran } from "@/components/vds/bits";
import { Mic, Palette, Scissors, SlidersHorizontal, Timer } from "lucide-react";
import {
  DAFTAR_GENRE, INFO_GENRE, REFERENSI_VOKAL, VISUAL_MUSIK, adalahWanita, transposeAuto, transposDgnPerubahan,
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
  /** v0.15.0 (remake) 0–100 tingkat perubahan musik — campuran asli ↔ genre:
   *  0% = lagu asli apa adanya, 100% = versi genre penuh */
  tingkatMusik: number;
  /** v0.16.0 (remake) 0–100 lapisan harmoni terkunci-akor — nada tambahan dari
   *  chord lagu sendiri (pad+bass+arp). 0 = mati. Bawaan 30 */
  nadaLevel: number;
  /** v0.16.0 genre utk VOKAL (terpisah dari genre musik); "mati" = tanpa sentuhan */
  genreVokal: GenreMusik | "mati";
  /** v0.16.0 id referensi penyanyi (mis. "dangdut-p1" = Rhoma Irama) */
  refVokal: string;
  /** v0.16.0 0–100 tingkat rasa vokal (bawaan 55) */
  tingkatVokal: number;
  /** v0.24.0 mesin vokal/karaoke: "aigen" = AI GENDER REALISTIS (BAWAAN — pitch &
   *  formant dipisah, target F0 adaptif). "ai" = VOKALGEN-5 lawas; "dsp" = v0.19
   *  lawas (fallback internal — chip Cepat-DSP sudah DIHAPUS dr UI) */
  mesinVokal: "aigen" | "ai" | "dsp";
  visual: IdVisual;
  resolusi: "916" | "720" | "1080";
  vis: OpsiVisual;
}

export const aturMusikDefault: AturMusik = {
  genre: "asli",
  // v0.14.0 — lapisan sintesis bawaan MATI (sumber bentrok irama); warna genre 55%
  layerLevel: 0,
  tingkatGenre: 55,
  // v0.15.0 — perubahan musik bawaan 65% (35% tetap bunyi asli)
  tingkatMusik: 65,
  // v0.16.0 — harmoni terkunci-akor bawaan 30% (nada dari chord lagu sendiri);
  // genre vokal terpisah bawaan mati, tingkat rasa vokal 55%
  nadaLevel: 30,
  genreVokal: "mati",
  refVokal: "",
  tingkatVokal: 55,
  // v0.24.0 — satu mesin: AI Gender Realistis (chip Cepat-DSP v0.19 & AI-stem
  // v0.20 dihapus dr UI; "ai"/"dsp" tinggal fallback internal API)
  mesinVokal: "aigen",
  karaoke: "asli",
  // v0.23.0 — SATU mode menu 2: Versi genre (remake). Ganti instrumen, Musik baru
  // dari chord, dan Lapisan dihapus dr menu (hasil kurang memuaskan).
  mode: "remake",
  kecepatan: 1,
  grooveLevel: 75,
  melodiLevel: 60,
  melodiAsliLevel: 0,
  vokalLevel: 100, // v0.22.0: vokal asli = penyanyi asli dipertahankan (stem AI)
  variasi: 0,
  kemiripan: 80,
  transpose: null,
  visual: "cqt-klasik",
  // v0.15.0 — 9:16 1080×1920 jadi bawaan (Reels/TikTok/Shorts)
  resolusi: "916",
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
    ukuranTeks: 25,
  },
};

export type UbahMusik = (u: Partial<AturMusik>) => void;

// ============ 2. PENGUBAH GENRE (17) — LAPISAN / PENUH ============

export function PanelGenre({ atur, ubah }: { atur: AturMusik; ubah: UbahMusik }) {
  const pilihGenre = (g: GenreMusik | "asli") => {
    // v0.23.0 — lapisan sintesis selalu mati (sumber konflik irama); mode tunggal remake
    ubah({ genre: g, layerLevel: 0 });
  };
  const transposeEfe = transposDgnPerubahan(
    atur.transpose ?? transposeAuto(atur.kemiripan, "pratinjau"), atur.tingkatMusik,
  );
  return (
    <Kartu
      judul="2. Pengubah genre musik"
      deskripsi="17 genre — versi genre mirip asli (prinsip Suno, offline): lagu tetap lagu itu, gayanya diganti"
      ikon={<SlidersHorizontal className="h-4 w-4" />}
    >
      {/* v0.23.0 — Ganti instrumen, Musik baru dari chord, dan Lapisan dihapus
          dari menu (hasilnya kurang memuaskan). Kini SATU mode: Versi genre. */}
      <ChipPilihan<ModeTransformasi>
        nilai={atur.mode}
        onChange={(v) => ubah({ mode: v })}
        pilihan={[
          { v: "remake", label: "Versi genre — mirip asli", hint: "Lagu asli 100% + gaya genre terkunci" },
        ]}
      />
      <p className="mt-2 rounded-lg border border-emerald-400/30 bg-emerald-400/5 p-2 text-[11px] leading-relaxed text-emerald-200/90">
          <b>Versi genre (prinsip Suno, offline)</b> — lagu asli dipertahankan 100%:
          melodi, vokal dan groove persis rekaman asli. Gaya diubah lewat transformasi
          yang <b>terkunci ke lagu</b>: warna genre (EQ/karakter/ruang/lebar stereo),
          gerak yang lajunya dihitung dari BPM lagu sendiri, dan geser nada dasar —
          hasilnya mustahil saling bertentangan dgn irama asli. <b>Baru v0.16:</b> bila
          ingin lagu diberi <b>nada tambahan</b>, naikkan slider "Nada tambahan ikut
          akor" — nada-nadanya diambil dari chord lagu sendiri (akor/bass/arpeggio di
          kisi ketukan hasil analisis) sehingga tetap seirama.
        </p>
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
      {/* v0.23.0 — panel slider khusus mode Ganti instrumen dihapus (mode dihapus) */}
      <div className="mt-3 space-y-2 rounded-xl border border-emerald-400/25 bg-slate-800/40 p-3">
          {atur.genre !== "asli" && (
            <BarisSlider
              label="Perubahan musik (asli ↔ genre)"
              nilai={atur.tingkatMusik}
              min={0}
              max={100}
              step={5}
              fmt={(n) => (n === 0 ? "100% asli" : n === 100 ? "100% genre" : `${n}% genre · ${100 - n}% asli`)}
              onChange={(n) => ubah({ tingkatMusik: n })}
            />
          )}
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
              label="Nada tambahan ikut akor (harmoni)"
              nilai={atur.nadaLevel}
              min={0}
              max={100}
              step={5}
              fmt={(n) => (n === 0 ? "Mati (tanpa nada tambahan)" : `${n}% — nada dari chord lagu sendiri`)}
              onChange={(n) => ubah({ nadaLevel: n })}
            />
          )}
          <p className="text-[11px] leading-relaxed text-slate-500">
            {atur.transpose === null
              ? `Auto: nada dasar ${transposeEfe === 0 ? "tetap" : `digeser ${transposeEfe > 0 ? "+" : ""}${transposeEfe} semitone`}`
              : `Nada dasar digeser ${transposeEfe > 0 ? "+" : ""}${transposeEfe} semitone (manual)`}
            {atur.genre !== "asli"
              ? `, warna ${INFO_GENRE[atur.genre].label} ${atur.tingkatGenre}% dari perubahan musik ${atur.tingkatMusik}%`
              : ""}
            . Durasi dan tempo lagu tetap sama.
          </p>
      </div>
    </Kartu>
  );
}

// ============ 3. TEMPO (0.5×–1.5×, v0.15: 1.1/1.2/1.3/1.4/1.5) ============

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
          { v: "1.1", label: "1.1×", hint: "halus" },
          { v: "1.2", label: "1.2×", hint: "ringan" },
          { v: "1.3", label: "1.3×", hint: "ceria" },
          { v: "1.4", label: "1.4×", hint: "cepat" },
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

// ============ 4. VOKAL & KARAOKE + GENRE VOKAL (v0.16.0) ============

/** URL unduh berkas hasil job (folder output/<id>/…). */
function urlMediaUnduh(rel: string): string {
  return `/api/file?p=${encodeURIComponent(rel)}&dl=1`;
}

/** v0.19.0 — data tombol PISAH VOKAL & MUSIK (dikirim dari StudioMusik). */
export interface PisahUI {
  job: {
    id: string; selesai: boolean; error: string | null; dibatalkan: boolean;
    progres: number; pesan: string; batalDiminta: boolean;
    outputs: { video: string; file: string; ukuran: number }[];
  } | null;
  bisaMulai: boolean;
  mulai: () => void;
  batal: (id: string) => void;
}

export function PanelKaraoke({ atur, ubah, pisah }: { atur: AturMusik; ubah: UbahMusik; pisah?: PisahUI }) {
  // v0.23.0 — cabang awal mode "penuh" & "ganti" dihapus (mode tsb tidak ada lagi
  // di menu 2); menu 4 selalu menampilkan fitur lengkap genre vokal & karaoke.
  const gv = atur.genreVokal;
  const pilihGenreVokal = (g: GenreMusik | "mati") => {
    if (g === "mati") ubah({ genreVokal: "mati", refVokal: "" });
    else ubah({ genreVokal: g, refVokal: REFERENSI_VOKAL[g].pria[0].id });
  };
  const refAktif = gv !== "mati"
    ? [...REFERENSI_VOKAL[gv].pria, ...REFERENSI_VOKAL[gv].wanita].find((r) => r.id === atur.refVokal) ?? null
    : null;
  const tombolPenyanyi = (r: (typeof REFERENSI_VOKAL)[GenreMusik]["pria"][number]) => (
    <button
      key={r.id}
      type="button"
      onClick={() => ubah({ refVokal: r.id })}
      title={r.ket}
      className={`rounded-lg border px-2 py-1.5 text-left text-xs transition ${
        atur.refVokal === r.id
          ? "border-violet-400/80 bg-violet-400/15 text-violet-200"
          : "border-slate-700 bg-slate-800/60 text-slate-300 hover:border-slate-500"
      }`}
    >
      <span className="block font-medium">{r.nama}</span>
      <span className="block truncate text-[10px] opacity-70">
        {r.ket}{r.dada ? ` · target ~${Math.round(118 - (r.dada - 1) * 6)} Hz` : r.tinggi ? ` · target ~${Math.round(adalahWanita(r.id) ? 196 + (r.tinggi - 4) * 6 : 118 + (r.tinggi - 1) * 10)} Hz` : ""}
      </span>
    </button>
  );
  return (
    <Kartu
      judul="4. Vokal, genre vokal & karaoke"
      deskripsi="AI Gender Realistis v0.24 — suara pria/wanita dari ukur nada dasar + pitch & resonansi dipisah"
      ikon={<Mic className="h-4 w-4" />}
    >
      {/* ===== v0.24.0 — VOKALGEN-6 AI GENDER REALISTIS ===== */}
      <div className="rounded-xl border border-violet-400/25 bg-slate-800/40 p-3">
        <p className="text-xs font-semibold text-violet-200">Genre vokal — mesin v0.24 (AI gender realistis)</p>
        <p className="mt-0.5 text-[11px] leading-relaxed text-slate-400">
          Terpisah dari genre musik: <b>musiknya</b> diubah lewat menu 2, <b>suara
          vokalnya</b> diganti sesuai genre ini. Alurnya: lagu dipisah AI dulu →
          <b> vokal asli dibuang</b> (dijadikan karaoke) → suara baru dimasukkan
          sebagai pengganti penuh — di hasil hanya ada <b>SATU suara</b>.
          <b> Baru v0.24 — suara jauh lebih nyata:</b> mesin kini <b>mengukur nada
          dasar suara asli</b> dulu (analisis AI), lalu menggeser pitch dengan
          teknologi studio <b>rubberband</b> yang <b>menahan resonansi (formant)
          tetap di tempatnya</b> — tidak lagi seperti pria falsetto — lalu
          merenggangkan resonansi khas gender <b>terpisah</b> (wanita = rongga suara
          lebih kecil, pria = lebih besar). Register target menyesuaikan jarak suara
          asli: wanita ±196–205 Hz, pria dada 112–118 Hz.
        </p>
        <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          <button
            type="button"
            onClick={() => pilihGenreVokal("mati")}
            className={`rounded-lg border px-2 py-1.5 text-left text-xs transition ${
              gv === "mati"
                ? "border-amber-400/80 bg-amber-400/15 text-amber-200"
                : "border-slate-700 bg-slate-800/60 text-slate-300 hover:border-slate-500"
            }`}
          >
            <span className="block font-medium">Mati</span>
            <span className="block text-[10px] opacity-70">Vokal asli tanpa ubah</span>
          </button>
          {DAFTAR_GENRE.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => pilihGenreVokal(g)}
              title={`Warna vokal khas ${INFO_GENRE[g].label}`}
              className={`rounded-lg border px-2 py-1.5 text-left text-xs transition ${
                gv === g
                  ? "border-violet-400/80 bg-violet-400/15 text-violet-200"
                  : "border-slate-700 bg-slate-800/60 text-slate-300 hover:border-slate-500"
              }`}
            >
              <span className="block font-medium">{INFO_GENRE[g].label}</span>
              <span className="block truncate text-[10px] opacity-70">vokal khas genre</span>
            </button>
          ))}
        </div>
        {gv !== "mati" && atur.karaoke !== "karaoke" && (
          <div className="mt-2.5 space-y-2">
            <p className="text-[11px] font-medium text-slate-300">
              Referensi penyanyi — karakter suara (2 pria + 2 wanita khas {INFO_GENRE[gv].label}):
            </p>
            <div>
              <p className="mb-1 text-[10px] uppercase tracking-wide text-slate-500">Pria</p>
              <div className="grid grid-cols-2 gap-1.5">{REFERENSI_VOKAL[gv].pria.map(tombolPenyanyi)}</div>
            </div>
            <div>
              <p className="mb-1 text-[10px] uppercase tracking-wide text-slate-500">Wanita</p>
              <div className="grid grid-cols-2 gap-1.5">{REFERENSI_VOKAL[gv].wanita.map(tombolPenyanyi)}</div>
            </div>
            <BarisSlider
              label={`Kekuatan ganti suara ${INFO_GENRE[gv].label}${refAktif ? ` — ${refAktif.nama}` : ""}`}
              nilai={atur.tingkatVokal}
              min={0}
              max={100}
              step={5}
              fmt={(n) => (n === 0 ? "Apa adanya" : `${n}%`)}
              onChange={(n) => ubah({ tingkatVokal: n })}
            />
            <p className="text-[10px] text-slate-500">
              Kekuatan menakar seberapa jauh digeser menuju register target:
              bawaan 55% sudah terasa, 100% = target penuh. Mesin mengukur nada
              dasar suara asli dulu, menggeser pitch dengan <b>resonansi ditahan</b>
              (rubberband), lalu merenggangkan resonansi gender <b>terpisah</b>
              (wanita +8–15%, pria −3–5%). Vokal &amp; musik bergeser bersama agar
              selalu selaras — dan sinkron dijaga otomatis (&lt;2 ms).
            </p>
            {/* v0.24.0 — Cepat-DSP (v0.19) DIHAPUS dr UI & digantikan AI Gender
                Realistis; hanya SATU mesin (fallback internal otomatis) */}
            <p className="text-[11px] font-medium text-slate-300">Mesin pengubah suara:</p>
            <div className="rounded-lg border border-emerald-400/80 bg-emerald-400/15 px-2 py-1.5">
              <span className="block text-xs font-medium text-emerald-200">AI Gender Realistis (v0.24) — disarankan</span>
              <span className="block text-[10px] leading-relaxed opacity-90">
                Chip “Cepat-DSP (v0.19)” dihapus &amp; digantikan mesin ini: stem AI
                MDX-Net + ukur nada dasar suara + pitch &amp; resonansi dipisah
                (rubberband studio, 100% offline) + timbre difeminisasi/maskulinisasi.
              </span>
            </div>
            <p className="rounded-lg border border-slate-700/50 bg-slate-900/40 p-2 text-[10px] leading-relaxed text-slate-500">
              Jujur &amp; transparan: referensi penyanyi = <b>karakter gaya</b> yang
              terinspirasi ciri khas penyanyi itu (warna timbre, register
              dada-dalam/kepala-terang, getar, ruang, serak) — <b>bukan tiruan suara
              aslinya</b>. Mengganti menjadi suara penyanyi tertentu butuh AI raksasa
              di server GPU. Mesin v0.24 menggabungkan: stem AI MDX-Net (±65 MB
              dibundel) + pengukur nada dasar + pitch-shift rubberband dgn resonansi
              dipertahankan + feminisasi/maskulinisasi timbre — semuanya <b>100%
              offline di PC-mu</b>, satu suara di hasil, selalu seirama dgn lagunya.
            </p>
          </div>
        )}
        {gv !== "mati" && atur.karaoke === "karaoke" && (
          <p className="mt-2 rounded-lg border border-amber-400/30 bg-amber-400/5 p-2 text-[11px] text-amber-200/90">
            Mode <b>Karaoke</b> aktif — vokalnya dihapus, jadi genre vokal sementara tidak
            dipakai. Pilih mode <b>Asli</b> atau <b>Vokal saja</b> untuk memakai genre vokal.
          </p>
        )}
      </div>

      <div className="mt-3">
        <ChipPilihan<KaraokeMode>
          nilai={atur.karaoke}
          onChange={(v) => ubah({ karaoke: v })}
          pilihan={[
            { v: "asli", label: "Asli", hint: "Tanpa dipisah" },
            { v: "karaoke", label: "Karaoke", hint: "Vokal dihapus, instrumen tersisa" },
            { v: "vokal", label: "Vokal saja", hint: "Stem vokal utuh, instrumen dibuang" },
          ]}
        />
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
        <b className="text-slate-400">Karaoke v0.20 (mesin AI):</b> stem instrumental
        AI — vokal asli <b>benar-benar dihilangkan</b> (bukan cuma kanal tengah),
        bass &amp; instrumen tetap utuh. Bila mesin AI tak tersedia, otomatis pakai
        DSP tengah/samping v0.15 (sisa gema vokal mungkin masih samar).
      </p>

      {/* ===== v0.20.0 — PISAH VOKAL & MUSIK (AI vocal remover ala HitPaw) ===== */}
      {pisah && (
        <div className="mt-3 rounded-xl border border-cyan-400/25 bg-slate-800/40 p-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-cyan-200">
            <Scissors className="h-3.5 w-3.5" /> Pisah Vokal &amp; Musik — vocal remover AI
          </p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-slate-400">
            Satu lagu diproses menjadi <b>dua berkas MP3 320k terpisah</b>:
            <b> …-musik.mp3</b> (instrumental TANPA vokal — siap karaoke) dan
            <b> …-vokal.mp3</b> (suara penyanyi utuh). Memakai <b>AI MDX-Net</b>
            (model Kim Vocal 2 dibundel, jalan 100% offline di PC-mu — teknologi
            yang sama dgn aplikasi vocal remover berbayar). Hasil dgn mesin DSP lama
            masih menyisakan vokal besar; mesin AI menghilangkannya sampai
            <b> benar-benar hilang</b>. Proses pertama beberapa menit tergantung panjang
            lagu — hasilnya di-cache, proses berikutnya instan.
          </p>
          <button
            type="button"
            onClick={pisah.mulai}
            disabled={!pisah.bisaMulai || (!!pisah.job && !pisah.job.selesai)}
            className="mt-2 w-full rounded-lg bg-gradient-to-r from-cyan-500 to-sky-500 px-3 py-2 text-xs font-semibold text-white transition hover:from-cyan-400 hover:to-sky-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {pisah.job && !pisah.job.selesai ? "Memisahkan dengan AI…" : "Pisah Vokal & Musik (AI) sekarang"}
          </button>
          {!pisah.bisaMulai && (
            <p className="mt-1 text-[10px] text-slate-500">Impor lagu dulu di kartu 1.</p>
          )}
          {pisah.job && !pisah.job.selesai && (
            <div className="mt-2">
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-700">
                <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-sky-400 transition-all" style={{ width: `${pisah.job.progres}%` }} />
              </div>
              <p className="mt-1 text-[10px] text-slate-400">
                {pisah.job.pesan} ({pisah.job.progres}%)
              </p>
              {!pisah.job.batalDiminta && (
                <button
                  type="button"
                  onClick={() => pisah.batal(pisah.job!.id)}
                  className="mt-1 text-[10px] text-red-300 underline-offset-2 hover:underline"
                >
                  Batalkan
                </button>
              )}
            </div>
          )}
          {pisah.job?.error && (
            <p className="mt-2 rounded-lg border border-red-500/40 bg-red-500/10 p-2 text-xs text-red-300">{pisah.job.error}</p>
          )}
          {pisah.job?.dibatalkan && !pisah.job.error && (
            <p className="mt-2 text-xs text-amber-200/90">Dibatalkan.</p>
          )}
          {pisah.job?.selesai && !pisah.job.error && pisah.job.outputs.length > 0 && (
            <div className="mt-2 space-y-1">
              {pisah.job.outputs.map((o) => (
                <a
                  key={o.file}
                  href={urlMediaUnduh(`output/${pisah.job!.id}/${o.file}`)}
                  className="flex items-center justify-between gap-2 rounded-lg border border-slate-700 bg-slate-900/50 px-2 py-1.5 text-xs text-slate-200 transition hover:border-cyan-400/60"
                >
                  <span className="truncate">{o.file}</span>
                  <span className="shrink-0 text-[10px] text-slate-500">{fmtUkuran(o.ukuran)}</span>
                </a>
              ))}
              <p className="text-[10px] text-slate-500">
                Karaoke? Pakai <b>-musik.mp3</b>. Ingin video lirik dgn musik ini? Salin berkasnya
                ke Mode Musik (impor ulang) atau langsung putar di pemutar mana pun — 100% offline.
              </p>
            </div>
          )}
        </div>
      )}
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
        <BarisSlider
          label="Ukuran teks judul/chord/lirik (bawaan 25)"
          nilai={vis.ukuranTeks}
          min={12}
          max={60}
          onChange={(n) => setVis({ ukuranTeks: n })}
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
