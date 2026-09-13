// VidSplit v0.12.0 — STUDIO MUSIK: tipe data, resep genre (17), resep visual (15),
// pembangun filter audio ffmpeg, subtitle ASS (judul + chord + lirik), LRC & chord sheet.
// v0.11.0: MODE TRANSFORMASI PENUH + KECEPATAN TEMPO 0.5×/1×/1.5× (atempo nyata).
// v0.12.0 "MUSIK BARU DARI CHORD": mode penuh kini MURNI musik baru — audio asli tidak
// ikut (vokal bawaan 0%), melodi DICPTAKAN dari chord dgn gaya khas genre (variasi bisa
// diganti), melodi asli jadi opsi pegangan bawaan mati. Semua 100% ffmpeg + JS murni.
import type { NamaFont } from "./types";

// ============ TIPE DASAR ============

/** 17 genre pengubah musik — masing-masing punya resep filter + layer instrumen */
export type GenreMusik =
  | "pop" | "rock" | "punk" | "metal" | "jazz" | "blues" | "reggae" | "ska"
  | "dangdut" | "edm" | "hiphop" | "funk" | "disco" | "keroncong" | "country"
  | "lofi" | "gamelan";

/** Mode pemisahan vokal: asli (tanpa ubah) | karaoke (buang vokal, sisakan instrumen)
 *  | vokal (tonjolkan vokal, kurangi instrumen) — metode DSP tengah/samping stereo. */
export type KaraokeMode = "asli" | "karaoke" | "vokal";

/** v0.12.0 — cara pengubah genre bekerja:
 *  - "lapisan": lagu asli utuh + efek karakter genre + lapisan instrumen di atasnya (v0.10).
 *  - "penuh"  : MUSIK BARU DARI CHORD — audio asli TIDAK ikut (vokal bawaan 0%); chord,
 *                BPM & fasa lagu asli dijadikan REFERENSI lalu seluruh musik baru
 *                (drum/bass/akor/melodi/perkusi) diciptakan khas genre pilihan;
 *                vokal asli opsional (DSP kanal tengah) bila ingin dinyanyikan. */
export type ModeTransformasi = "lapisan" | "penuh";

/** pilihan kecepatan tempo — 0.5 = perlambat 2× lebih lama, 1.5 = percepat ⅓ lebih cepat */
export const PILIHAN_KECEPATAN = [0.5, 1, 1.5] as const;
export type Kecepatan = (typeof PILIHAN_KECEPATAN)[number];

/** Pola layer instrumen tersintesis (dibuat di musikLayer.ts) */
export type PolaLayer =
  | "pop" | "rock" | "skank" | "onedrop" | "dangdut" | "boombap" | "disco"
  | "gamelan" | "slap" | "vinyl";

export interface BarisLirik {
  /** detik mulai baris lirik */
  mulai: number;
  teks: string;
}

export interface SegmenChord {
  /** detik mulai segmen */
  mulai: number;
  /** panjang segmen (detik) */
  durasi: number;
  /** nama chord, mis. "C", "Am", "F#" */
  chord: string;
}

// ============ DAFTAR GENRE (17) ============

export const INFO_GENRE: Record<GenreMusik, { label: string; deskripsi: string }> = {
  pop: { label: "Pop", deskripsi: "Bersih mengkilap, vokal maju, dinamika rapat" },
  rock: { label: "Rock", deskripsi: "Gitar dorong-tengah, drive agresif, dentum penuh" },
  punk: { label: "Punk", deskripsi: "Tempo didorong cepat, kasar, bertenaga liar" },
  metal: { label: "Metal", deskripsi: "Bass dalam + gerinda tinggi, kompresi berat" },
  jazz: { label: "Jazz", deskripsi: "Hangat lembut, ruang reverb, dinamika longgar" },
  blues: { label: "Blues", deskripsi: "Hangat raung, tremolo halus, tempo santai" },
  reggae: { label: "Reggae", deskripsi: "Bass tebal, echo dingin, pukulan off-beat" },
  ska: { label: "Ska", deskripsi: "Tembaga cerah, stab off-beat khas upstroke" },
  dangdut: { label: "Dangdut", deskripsi: "Kendang ganda, seruling, tabla-sitar rasa India" },
  edm: { label: "EDM", deskripsi: "Kick 4/4 menghantam, tinggi berkilau, tekanan besar" },
  hiphop: { label: "Hip-Hop", deskripsi: "Tempo turun, boom-bap berat, hangat lo-fi" },
  funk: { label: "Funk", deskripsi: "Punch rapat, mid melengket, groove kencang" },
  disco: { label: "Disco", deskripsi: "Kick 4/4 + hi-hat off, stereo lebar, gemerlap" },
  keroncong: { label: "Keroncong", deskripsi: "Petik lembut, hangat khas, ruang luas" },
  country: { label: "Country", deskripsi: "Slapback echo, mid jernih, akustik terbuka" },
  lofi: { label: "Lo-Fi", deskripsi: "Rendah hangat, debu vinyl, wobble kaset" },
  gamelan: { label: "Gamelan", deskripsi: "Lapisan gong/perunggu, reverb luas, megah" },
};

export const DAFTAR_GENRE: GenreMusik[] = [
  "pop", "rock", "punk", "metal", "jazz", "blues", "reggae", "ska", "dangdut",
  "edm", "hiphop", "funk", "disco", "keroncong", "country", "lofi", "gamelan",
];

/** Resep tiap genre: rantai filter ffmpeg (dipakai berurutan), pengali tempo,
 *  pola layer instrumen, dan level layer bawaan (%). */
export interface ResepGenre {
  rantai: string[];
  tempo: number;
  layer: PolaLayer | null;
  layerBawaan: number;
}

export const RESEP_GENRE: Record<GenreMusik, ResepGenre> = {
  pop: {
    rantai: ["equalizer=f=60:t=q:w=0.8:g=2", "equalizer=f=3000:t=q:w=1.2:g=2",
      "acompressor=threshold=-16dB:ratio=2.5:attack=12:release=180:makeup=2", "extrastereo=m=1.15"],
    tempo: 1, layer: "pop", layerBawaan: 25,
  },
  rock: {
    rantai: ["equalizer=f=120:t=q:w=1:g=3", "equalizer=f=2500:t=q:w=1.5:g=5",
      "acompressor=threshold=-14dB:ratio=4:attack=8:release=120:makeup=3",
      "crystalizer=i=2.2", "alimiter=limit=0.92"],
    tempo: 1, layer: "rock", layerBawaan: 35,
  },
  punk: {
    rantai: ["equalizer=f=200:t=q:w=1.2:g=4", "equalizer=f=4000:t=q:w=1.5:g=5",
      "acompressor=threshold=-12dB:ratio=6:attack=5:release=90:makeup=4", "alimiter=limit=0.88"],
    tempo: 1.12, layer: "rock", layerBawaan: 40,
  },
  metal: {
    rantai: ["bass=g=6:f=110", "equalizer=f=3500:t=q:w=1.8:g=6",
      "acompressor=threshold=-13dB:ratio=8:attack=4:release=80:makeup=4",
      "crystalizer=i=3", "alimiter=limit=0.85"],
    tempo: 1.05, layer: "rock", layerBawaan: 45,
  },
  jazz: {
    rantai: ["equalizer=f=180:t=q:w=1:g=3", "treble=g=-2.5:f=8000",
      "acompressor=threshold=-20dB:ratio=2:attack=25:release=350:makeup=1.5",
      "aecho=0.7:0.6:90|180:0.18|0.1"],
    tempo: 0.98, layer: "slap", layerBawaan: 20,
  },
  blues: {
    rantai: ["equalizer=f=160:t=q:w=1:g=3.5", "treble=g=-1.5:f=9000",
      "tremolo=f=4.5:d=0.25", "aecho=0.75:0.55:70:0.15"],
    tempo: 0.97, layer: "slap", layerBawaan: 25,
  },
  reggae: {
    rantai: ["bass=g=7:f=100", "equalizer=f=2500:t=q:w=1.4:g=-3",
      "aecho=0.8:0.6:180|320:0.22|0.12", "acompressor=threshold=-18dB:ratio=3:attack=15:release=250:makeup=2"],
    tempo: 0.96, layer: "onedrop", layerBawaan: 35,
  },
  ska: {
    rantai: ["equalizer=f=800:t=q:w=1.2:g=3", "treble=g=3:f=8000",
      "acompressor=threshold=-15dB:ratio=3:attack=10:release=140:makeup=2.5"],
    tempo: 1.1, layer: "skank", layerBawaan: 35,
  },
  dangdut: {
    rantai: ["bass=g=5:f=120", "equalizer=f=1800:t=q:w=1.3:g=4",
      "treble=g=2:f=9000", "acompressor=threshold=-16dB:ratio=3.5:attack=10:release=160:makeup=2.5"],
    tempo: 1.02, layer: "dangdut", layerBawaan: 40,
  },
  edm: {
    rantai: ["bass=g=6:f=90", "treble=g=4:f=10000",
      "tremolo=f=2:d=0.5:h=0.35", "acompressor=threshold=-12dB:ratio=6:attack=6:release=110:makeup=4",
      "alimiter=limit=0.9"],
    tempo: 1.06, layer: "disco", layerBawaan: 45,
  },
  hiphop: {
    rantai: ["bass=g=7:f=95", "lowpass=f=13000", "acompressor=threshold=-15dB:ratio=4:attack=8:release=140:makeup=3"],
    tempo: 0.9, layer: "boombap", layerBawaan: 40,
  },
  funk: {
    rantai: ["equalizer=f=400:t=q:w=1.1:g=4", "equalizer=f=7000:t=q:w=1.4:g=2.5",
      "acompressor=threshold=-14dB:ratio=5:attack=5:release=100:makeup=3"],
    tempo: 1.03, layer: "pop", layerBawaan: 30,
  },
  disco: {
    rantai: ["bass=g=4:f=105", "treble=g=3.5:f=9500", "extrastereo=m=1.5",
      "acompressor=threshold=-14dB:ratio=4:attack=8:release=130:makeup=3"],
    tempo: 1.05, layer: "disco", layerBawaan: 40,
  },
  keroncong: {
    rantai: ["equalizer=f=220:t=q:w=1:g=3", "treble=g=-1:f=8500",
      "aecho=0.75:0.6:120|240:0.2|0.12", "acompressor=threshold=-19dB:ratio=2.2:attack=20:release=300:makeup=2"],
    tempo: 0.99, layer: "skank", layerBawaan: 25,
  },
  country: {
    rantai: ["equalizer=f=500:t=q:w=1:g=2.5", "treble=g=2:f=8500",
      "aecho=0.6:0.45:110:0.28", "acompressor=threshold=-17dB:ratio=2.8:attack=14:release=200:makeup=2"],
    tempo: 1, layer: "slap", layerBawaan: 30,
  },
  lofi: {
    rantai: ["lowpass=f=7500", "bass=g=4:f=120", "vibrato=f=3.5:d=0.12",
      "aecho=0.7:0.5:60|110:0.15|0.1", "acompressor=threshold=-18dB:ratio=3:attack=18:release=250:makeup=2"],
    tempo: 0.94, layer: "vinyl", layerBawaan: 35,
  },
  gamelan: {
    rantai: ["equalizer=f=900:t=q:w=1.2:g=3.5", "treble=g=1.5:f=9500",
      "aecho=0.8:0.65:160|300:0.25|0.15", "acompressor=threshold=-18dB:ratio=2.5:attack=18:release=280:makeup=2"],
    tempo: 0.97, layer: "gamelan", layerBawaan: 40,
  },
};

// ============ FILTER AUDIO (genre + karaoke + layer) ============

export interface OpsiStudioMusik {
  /** path relatif sumber audio di folder kerja */
  file: string;
  judul: string;
  genre: GenreMusik | "asli";
  /** 0–100 % level layer instrumen (mode lapisan) */
  layerLevel: number;
  karaoke: KaraokeMode;
  /** BPM hasil analisis — dipakai menyusun layer/iringan instrumen */
  bpm: number;
  /** offset fasa beat (detik) dari analisis — agar instrumen sejajar pukulan asli */
  fase: number;
  /** v0.11.0 — "lapisan" | "penuh" (lihat ModeTransformasi) */
  mode: ModeTransformasi;
  /** v0.11.0 — kecepatan tempo hasil: 0.5 | 1 | 1.5 */
  kecepatan: number;
  /** (mode penuh) 0–100 intensitas iringan genre (drum+bass+akor) */
  grooveLevel: number;
  /** (mode penuh) 0–100 level MELODI BARU diciptakan dari chord — gaya khas genre */
  melodiLevel: number;
  /** v0.12.0 (mode penuh) 0–100 melodi ASLI sbg pegangan — bawaan 0 (mati) */
  melodiAsliLevel: number;
  /** (mode penuh) 0–100 vokal asli ikut diaduk — bawaan 0 = murni musik baru */
  vokalLevel: number;
  /** v0.12.0 — angka variasi melodi baru (tombol "Variasikan melodi") */
  variasi: number;
}

export function clampStudio(o: Partial<OpsiStudioMusik>): OpsiStudioMusik {
  const genre = o.genre && (o.genre === "asli" || DAFTAR_GENRE.includes(o.genre)) ? o.genre : "asli";
  const kec = Number(o.kecepatan ?? 1);
  return {
    file: String(o.file || ""),
    judul: String(o.judul || "Lagu Tanpa Nama").slice(0, 200),
    genre,
    layerLevel: Math.min(100, Math.max(0, Math.round(Number(o.layerLevel ?? 0)))),
    karaoke: o.karaoke === "karaoke" || o.karaoke === "vokal" ? o.karaoke : "asli",
    bpm: Math.min(220, Math.max(50, Number(o.bpm) || 120)),
    fase: Math.max(0, Number(o.fase) || 0),
    mode: o.mode === "penuh" ? "penuh" : "lapisan",
    kecepatan: (PILIHAN_KECEPATAN as readonly number[]).includes(kec) ? kec : 1,
    grooveLevel: Math.min(100, Math.max(0, Math.round(Number(o.grooveLevel ?? 70)))),
    melodiLevel: Math.min(100, Math.max(0, Math.round(Number(o.melodiLevel ?? 65)))),
    melodiAsliLevel: Math.min(100, Math.max(0, Math.round(Number(o.melodiAsliLevel ?? 0)))),
    vokalLevel: Math.min(100, Math.max(0, Math.round(Number(o.vokalLevel ?? 0)))),
    variasi: Math.min(999, Math.max(0, Math.round(Number(o.variasi ?? 0)))),
  };
}

/** Faktor percepatan TOTAL: resep tempo genre × kecepatan pilihan user.
 *  1.2 = hasil 1.2× lebih cepat (durasi dibagi 1.2). */
export function faktorWaktuStudio(o: Pick<OpsiStudioMusik, "genre" | "kecepatan">): number {
  const resep = o.genre === "asli" ? null : RESEP_GENRE[o.genre];
  return (resep ? resep.tempo : 1) * o.kecepatan;
}

/** Rantai pengali atempo — ffmpeg butuh tiap atempo di 0.5–2.0.
 *  0.425 → [0.5, 0.85]; 3.4 → [2, 1.7]; 1 → []. */
export function faktorAtempo(f: number): number[] {
  const hasil: number[] = [];
  let t = f;
  while (t < 0.5 - 1e-9) { hasil.push(0.5); t /= 0.5; }
  while (t > 2 + 1e-9) { hasil.push(2); t /= 2; }
  if (hasil.length || Math.abs(t - 1) > 0.004) hasil.push(Math.round(t * 1000) / 1000);
  return hasil;
}

/** Skala waktu lirik/chord saat tempo diubah: hasil = asal / faktor.
 *  tempo 1.5 → semua tanda waktu dikali 2/3; tempo 0.5 → dikali 2. */
export function skalaLirik(l: BarisLirik[], faktor: number): BarisLirik[] {
  const f = faktor > 0 ? faktor : 1;
  return l.map((b) => ({ ...b, mulai: Math.round((b.mulai / f) * 1000) / 1000 }));
}

export function skalaChord(c: SegmenChord[], faktor: number): SegmenChord[] {
  const f = faktor > 0 ? faktor : 1;
  return c.map((s) => ({
    ...s,
    mulai: Math.round((s.mulai / f) * 1000) / 1000,
    durasi: Math.round((s.durasi / f) * 1000) / 1000,
  }));
}

/** Bangun graf filter_complex pemrosesan audio.
 *  Input 0 = sumber; input 1 (opsional) = wav layer (mode lapisan) ATAU iringan genre
 *  tersintesis (mode penuh). Label keluar [aout].
 *  tempo = faktor percepatan total (resep genre × kecepatan) — diterapkan NYATA via
 *  atempo di ujung rantai, sehingga durasi keluar = durasi sumber / tempo. */
export function bangunFilterAudio(o: OpsiStudioMusik): {
  graf: string; adaLayer: boolean; tempo: number; adaVokal: boolean;
} {
  const resep = o.genre === "asli" ? null : RESEP_GENRE[o.genre];
  const tempoResep = resep ? resep.tempo : 1;
  const kecepatan = o.kecepatan || 1; // defensif bila dipanggil tanpa clamp
  const tempo = tempoResep * kecepatan;
  const penuh = o.mode === "penuh";
  const baris: string[] = [];
  const rantai = resep ? resep.rantai.join(",") : "anull";
  // input 0 hanya dimasukkan ke graf bila benar-benar dipakai (lapisan selalu;
  // penuh hanya bila vokal ikut atau iringan mati) — output graf tak boleh menggantung.
  // v0.12.0: bawaan vokal 0 → audio asli TIDAK masuk graf sama sekali (musik baru murni).
  const pakaiSumber = !penuh || (o.vokalLevel ?? 0) > 0 || (o.grooveLevel ?? 0) <= 0;
  if (pakaiSumber) {
    baris.push("[0:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo[base]");
  }

  let adaLayer: boolean;
  let adaVokal = false;
  let labelAkhir = "mix"; // label bebas di ujung cabang (dikonsumsi atempo/limiter)
  if (!penuh) {
    // ========== MODE LAPISAN (perilaku v0.10 + atempo nyata) ==========
    // pemisahan vokal (DSP tengah/samping) SEBELUM efek genre
    if (o.karaoke === "karaoke") {
      baris.push(
        "[base]asplit=2[k1][k2]",
        "[k1]pan=stereo|c0=0.5*c0+-0.5*c1|c1=0.5*c1+-0.5*c0[side]",
        "[k2]pan=mono|c0=0.5*c0+0.5*c1,lowpass=f=140[bass0]",
        "[bass0]pan=stereo|c0=c0|c1=c0[bass]",
        "[side][bass]amix=inputs=2:duration=first[ksrc]",
      );
    } else if (o.karaoke === "vokal") {
      baris.push(
        "[base]pan=mono|c0=0.5*c0+0.5*c1,highpass=f=180,lowpass=f=5200[voc0]",
        "[voc0]pan=stereo|c0=c0|c1=c0[ksrc]",
      );
    } else {
      baris.push("[base]anull[ksrc]");
    }
    baris.push(`[ksrc]${rantai}[g]`);
    adaLayer = !!resep && o.layerLevel > 0 && !!resep.layer;
    if (adaLayer) {
      const lv = (o.layerLevel / 100) * 2;
      baris.push("[g]volume=2.0[g2]");
      baris.push(`[1:a]volume=${lv.toFixed(3)}[lay]`);
      baris.push("[g2][lay]amix=inputs=2:duration=first[mix]");
    } else {
      baris.push("[g]volume=1.9[mix]");
    }
  } else {
    // ========== MODE PENUH v0.12.0 — MUSIK BARU DARI CHORD ==========
    // Audio asli TIDAK dipakai (vokal bawaan 0%). Bila vokalLevel > 0, vokal asli
    // diambil lewat DSP kanal tengah (band 160–6500 Hz) utk dinyanyikan di atas
    // musik baru. Seluruh musik baru dari input 1 (disintesis musikTransformasi.ts:
    // drum+bass+akor+melodi buatan dari chord+perkusi+dekorasi khas genre).
    const vokalOn = (o.vokalLevel ?? 0) > 0;
    adaLayer = (o.grooveLevel ?? 0) > 0;
    adaVokal = vokalOn;
    const gVokal = ((o.vokalLevel ?? 0) / 100) * 1.55;
    const gIring = ((o.grooveLevel ?? 70) / 100) * 1.9;
    if (vokalOn && adaLayer) {
      baris.push(
        `[base]pan=mono|c0=0.5*c0+0.5*c1,highpass=f=160,lowpass=f=6500[voc0]`,
        `[voc0]volume=${gVokal.toFixed(3)}[voc]`,
        `[1:a]volume=${gIring.toFixed(3)}[ir]`,
        "[voc][ir]amix=inputs=2:duration=first[mix]",
      );
    } else if (adaLayer) {
      baris.push(`[1:a]volume=${gIring.toFixed(3)}[mix]`);
    } else if (vokalOn) {
      baris.push(
        "[base]pan=mono|c0=0.5*c0+0.5*c1,highpass=f=160,lowpass=f=6500[voc0]",
        `[voc0]volume=${gVokal.toFixed(3)}[mix]`,
      );
    } else {
      baris.push("[base]anull[mix]"); // tak ada iringan & vokal — apa adanya
    }
    // karakter genre menyatu di ATAS campuran (ringan — instrumen sudah khas genre)
    baris.push(`[mix]${rantai}[g]`);
    labelAkhir = "g";
  }
  // atempo nyata: resep tempo genre × kecepatan user (rantai bila di luar 0.5–2)
  const at = faktorAtempo(tempo);
  if (at.length) {
    baris.push(`[${labelAkhir}]${at.map((f) => `atempo=${f}`).join(",")}[at]`);
    baris.push("[at]alimiter=limit=0.95[aout]");
  } else {
    baris.push(`[${labelAkhir}]alimiter=limit=0.95[aout]`);
  }
  return { graf: baris.join(";"), adaLayer, tempo, adaVokal };
}

// ============ 15 VISUALISER ============

export interface OpsiVisual {
  warna1: string;
  warna2: string;
  /** 1–10 — penguatan audio sebelum masuk visual */
  sensitivitas: number;
  /** latar utk visual semi-frame: "gelap" | "gradien" | "hitam" */
  bgMode: "gelap" | "gradien" | "hitam";
  fontJudul: NamaFont;
  teksJudul: string;
  tampilJudul: boolean;
  tampilChord: boolean;
  tampilLirik: boolean;
}

export const opsiVisualDefault: OpsiVisual = {
  warna1: "#22d3ee",
  warna2: "#fbbf24",
  sensitivitas: 5,
  bgMode: "gelap",
  fontJudul: "bebas",
  teksJudul: "",
  tampilJudul: true,
  tampilChord: true,
  tampilLirik: true,
};

export type IdVisual =
  | "spektrum-api" | "spektrum-pelangi" | "spektrum-magnet" | "gelombang-neon"
  | "gelombang-cermin" | "vektor-radar" | "vektor-neon" | "frekuensi-balok"
  | "frekuensi-garis" | "cqt-klasik" | "cqt-gelombang" | "spektrum-vektor"
  | "radar-berdenyut" | "spatial-stereo" | "kolase-konser";

export const VISUAL_MUSIK: { id: IdVisual; label: string; deskripsi: string }[] = [
  { id: "spektrum-api", label: "Spektrum Api", deskripsi: "Panas gurun merambat seiring nada" },
  { id: "spektrum-pelangi", label: "Spektrum Pelangi", deskripsi: "7 warna spektrogram melingkar waktu" },
  { id: "spektrum-magnet", label: "Spektrum Magnet", deskripsi: "Pendar biru elektrik menembus gelap" },
  { id: "gelombang-neon", label: "Gelombang Neon", deskripsi: "Dua garis neon berayun penuh layar" },
  { id: "gelombang-cermin", label: "Gelombang Cermin", deskripsi: "Gelombang kembar bertemu di tengah" },
  { id: "vektor-radar", label: "Vektor Radar", deskripsi: "Radar fosfor hijau gaya console analog" },
  { id: "vektor-neon", label: "Vektor Neon", deskripsi: "Lissajous terisi, magenta bertemu cyan" },
  { id: "frekuensi-balok", label: "Frekuensi Balok", deskripsi: "Balok EQ log-skala berdempet" },
  { id: "frekuensi-garis", label: "Frekuensi Garis", deskripsi: "Kurva frekuensi halus analitis" },
  { id: "cqt-klasik", label: "CQT Klasik", deskripsi: "Balok konser warna-warni penuh layar" },
  { id: "cqt-gelombang", label: "CQT + Gelombang", deskripsi: "Balok di atas, gelombang di bawah" },
  { id: "spektrum-vektor", label: "Spektrum | Vektor", deskripsi: "Dua layar berdamping: api & radar" },
  { id: "radar-berdenyut", label: "Radar Berdenyut", deskripsi: "Lingkar rapat berdenyut mengikuti beat" },
  { id: "spatial-stereo", label: "Spatial Stereo", deskripsi: "Peta posisi stereo mengambang" },
  { id: "kolase-konser", label: "Kolase Konser", deskripsi: "Latar gradien + balok + strip gelombang" },
];

/** "#rrggbb" → "0xrrggbb" utk filter ffmpeg */
export function hexFf(hex: string): string {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  return `0x${m ? m[1] : "22d3ee"}`;
}

interface KtxVisual {
  w: number; h: number; fps: number; durasi: number; o: OpsiVisual;
}

/** Bangun sub-graf visual: konsumsi [av] (audio terproses), hasilkan [viz] (video W×H). */
export function bangunRantaiVisual(id: IdVisual, k: KtxVisual): string {
  const { w, h, fps, durasi, o } = k;
  const w1 = hexFf(o.warna1);
  const w2 = hexFf(o.warna2);
  const genap = (n: number) => Math.max(2, Math.floor(n / 2) * 2);
  const W = genap(w), H = genap(h);
  const bgSolid = (hex: string) => `color=c=${hex}:s=${W}x${H}:d=${durasi.toFixed(3)}:r=${fps}[bg0]`;
  const bgGradien = () =>
    `gradients=s=${W}x${H}:c0=${w1}:c1=${w2}:x0=0:y0=0:x1=${W}:y1=${H}:d=${durasi.toFixed(3)}:r=${fps}:seed=11[bg0]`;
  /** latar sesuai pilihan user (gradien = warna 1-2, gelap/hitam = solid) */
  const bgPilih = () =>
    o.bgMode === "gradien" ? bgGradien() : bgSolid(o.bgMode === "hitam" ? "0x000000" : "0x05070d");
  const pusat = (labelVis: string) =>
    `[bg0][${labelVis}]overlay=(W-w)/2:(H-h)/2:shortest=1[viz]`;
  switch (id) {
    case "spektrum-api":
      return `[av]showspectrum=s=${W}x${H}:mode=combined:slide=scroll:color=fire:scale=log:win_func=hann:rate=${fps}[viz]`;
    case "spektrum-pelangi":
      return `[av]showspectrum=s=${W}x${H}:mode=combined:slide=scroll:color=rainbow:scale=sqrt:win_func=hann:rate=${fps}[viz]`;
    case "spektrum-magnet":
      return `[av]showspectrum=s=${W}x${H}:mode=combined:slide=scroll:color=intensity:scale=cbrt:win_func=hann:rate=${fps},hue=h=195:s=1.9[viz]`;
    case "gelombang-neon":
      return `[av]showwaves=s=${W}x${H}:mode=cline:colors=${w1}|${w2}:rate=${fps}[viz]`;
    case "gelombang-cermin": {
      const st = genap(H / 2);
      return [
        `[av]showwaves=s=${W}x${st}:mode=cline:colors=${w1}|${w2}:rate=${fps}[w0]`,
        "[w0]split[w1l][w2l]",
        "[w2l]vflip[wf]",
        "[w1l][wf]vstack=inputs=2[viz]",
      ].join(";");
    }
    case "vektor-radar": {
      const s = genap(Math.min(W, H) * 0.92);
      return [bgPilih(),
        `[av]avectorscope=s=${s}x${s}:zoom=1.6:mode=dot:scale=cbrt:colors=${w1}|${w2}:rate=${fps}[sc]`,
        pusat("sc")].join(";");
    }
    case "vektor-neon": {
      const s = genap(Math.min(W, H) * 0.92);
      return [bgPilih(),
        `[av]avectorscope=s=${s}x${s}:zoom=2.1:mode=dot:draw=fill:scale=log:colors=${w2}|${w1}:rate=${fps}[sc]`,
        pusat("sc")].join(";");
    }
    case "frekuensi-balok":
      return `[av]showfreqs=s=${W}x${H}:mode=bar:ascale=cbrt:fscale=log:win_size=2048:colors=${w1}|${w2}:rate=${fps}[viz]`;
    case "frekuensi-garis":
      return `[av]showfreqs=s=${W}x${H}:mode=line:ascale=log:fscale=log:win_size=4096:colors=${w1}|${w2}:rate=${fps}[viz]`;
    case "cqt-klasik":
      return `[av]showcqt=s=${W}x${H}:rate=${fps}:axis=0[viz]`;
    case "cqt-gelombang": {
      const h1 = genap(H * 0.62);
      const h2 = genap(H - h1);
      return [
        `[av]asplit=2[cqta][wa]`,
        `[cqta]showcqt=s=${W}x${h1}:rate=${fps}:axis=0[cq]`,
        `[wa]showwaves=s=${W}x${h2}:mode=cline:colors=${w1}|${w2}:rate=${fps}[wv]`,
        "[cq][wv]vstack=inputs=2[viz]",
      ].join(";");
    }
    case "spektrum-vektor": {
      const hw = genap(W / 2);
      return [
        "[av]asplit=2[sa][va2]",
        `[sa]showspectrum=s=${hw}x${H}:mode=combined:slide=scroll:color=fire:scale=log:win_func=hann:rate=${fps}[sp]`,
        `[va2]avectorscope=s=${hw}x${H}:zoom=1.5:mode=dot:scale=cbrt:colors=${w1}|${w2}:rate=${fps}[vec]`,
        "[sp][vec]hstack=inputs=2[viz]",
      ].join(";");
    }
    case "radar-berdenyut": {
      const s = genap(Math.min(W, H) * 0.94);
      return [bgPilih(),
        `[av]avectorscope=s=${s}x${s}:zoom=3.1:mode=line:draw=fill:scale=log:colors=${w2}|${w1}:rate=${fps},hue=s=1.4[sc]`,
        pusat("sc")].join(";");
    }
    case "spatial-stereo": {
      const s = genap(Math.min(W, H) * 0.86);
      return [
        bgPilih(),
        `[av]showspatial=s=${s}x${s}:rate=${fps}[sc]`,
        pusat("sc"),
      ].join(";");
    }
    case "kolase-konser": {
      const ch = genap(H * 0.56);
      const bar = genap(H * 0.14);
      return [
        o.bgMode === "gradien" ? bgGradien() : bgSolid(o.bgMode === "hitam" ? "0x000000" : "0x070b16"),
        "[av]asplit=2[ka][wa]",
        `[ka]showcqt=s=${genap(W * 0.8)}x${ch}:rate=${fps}:axis=0[cqv]`,
        "[bg0][cqv]overlay=(W-w)/2:(H-h)/3:shortest=1[cmp]",
        `[wa]showwaves=s=${W}x${bar}:mode=cline:colors=0xffffff|${w1}:rate=${fps}[wvs]`,
        "[cmp][wvs]overlay=0:H-h[viz]",
      ].join(";");
    }
  }
}

// ============ SUBTITLE ASS (judul + chord + lirik) ============

/** Nama family font internal TTF — dipakai libass via fontsdir */
export const FONT_ASS: Record<NamaFont, string> = {
  tebal: "DejaVu Sans", bersih: "DejaVu Sans", klasik: "DejaVu Serif",
  bebas: "Bebas Neue", anton: "Anton", cinzel: "Cinzel", cinzeldec: "Cinzel Decorative",
  playfair: "Playfair Display", marcellus: "Marcellus", julius: "Julius Sans One",
  oswald: "Oswald", sixcaps: "Six Caps", teko: "Teko", alfaslab: "Alfa Slab One",
  abril: "Abril Fatface", blackops: "Black Ops One", creepster: "Creepster",
  monoton: "Monoton",
};

/** "#rrggbb" → warna ASS &H00BBGGRR (BGR + alpha nol) */
export function hexKeAss(hex: string): string {
  const m = /^#?([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/.exec(hex.trim());
  if (!m) return "&H00FFFFFF";
  return `&H00${m[3]}${m[2]}${m[1]}`.toUpperCase();
}

function kebabAss(t: number): string {
  const j = Math.max(0, t);
  const jam = Math.floor(j / 3600);
  const menit = Math.floor((j % 3600) / 60);
  const detik = j % 60;
  return `${jam}:${String(menit).padStart(2, "0")}:${detik.toFixed(2).padStart(5, "0")}`;
}

function bersihTeksAss(t: string): string {
  return (t || "").replace(/[{}]/g, "").replace(/\\/g, " ").replace(/\r?\n/g, " ").trim();
}

/** Bangun isi berkas .ass overlay: judul (atas), chord (di atas lirik), lirik (bawah). */
export function bangunAss(opsi: {
  w: number; h: number; durasi: number; vis: OpsiVisual;
  lirik: BarisLirik[]; chord: SegmenChord[];
}): string {
  const { w, h, durasi, vis, lirik, chord } = opsi;
  const skala = h / 720;
  const fsJudul = Math.max(20, Math.round(48 * skala));
  const fsChord = Math.max(18, Math.round(42 * skala));
  const fsLirik = Math.max(16, Math.round(36 * skala));
  const fam = FONT_ASS[vis.fontJudul] || "DejaVu Sans";
  const mvLirik = Math.round(54 * skala);
  const mvChord = Math.round(126 * skala);
  const mvJudul = Math.round(40 * skala);
  const kepala = [
    "[Script Info]",
    "; VidSplit Studio Musik v0.11.0",
    "ScriptType: v4.00+",
    `PlayResX: ${w}`,
    `PlayResY: ${h}`,
    "WrapStyle: 0",
    "ScaledBorderAndShadow: yes",
    "",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    `Style: Judul,${fam},${fsJudul},&H00FFFFFF,&H000000FF,&H90000000,&H78000000,1,0,0,0,100,100,0,0,1,2,1,8,30,30,${mvJudul},1`,
    `Style: Chord,DejaVu Sans,${fsChord},${hexKeAss(vis.warna2)},&H000000FF,&H90000000,&H78000000,1,0,0,0,100,100,0,0,1,2,1,2,30,30,${mvChord},1`,
    `Style: Lirik,DejaVu Sans,${fsLirik},&H00FFFFFF,&H000000FF,&HA0000000,&H78000000,0,0,0,0,100,100,0,0,1,2,1,2,40,40,${mvLirik},1`,
    "",
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
  ];
  const dialog: string[] = [];
  const dlg = (gaya: string, a: number, b: number, teks: string) => {
    if (b <= a) b = a + 0.1;
    dialog.push(`Dialogue: 0,${kebabAss(a)},${kebabAss(b)},${gaya},,0,0,0,,{\\fad(140,140)}${bersihTeksAss(teks)}`);
  };
  if (vis.tampilJudul && vis.teksJudul.trim()) {
    dlg("Judul", 0, Math.max(durasi, 1), vis.teksJudul.trim().slice(0, 120));
  }
  if (vis.tampilChord) {
    for (const s of chord.slice(0, 900)) {
      if (!s.chord || s.durasi <= 0) continue;
      dlg("Chord", s.mulai, s.mulai + Math.min(s.durasi, 12), s.chord);
    }
  }
  if (vis.tampilLirik) {
    for (let i = 0; i < Math.min(lirik.length, 900); i++) {
      if (!lirik[i].teks.trim()) continue;
      const akhir = i + 1 < lirik.length ? lirik[i + 1].mulai : lirik[i].mulai + 5;
      dlg("Lirik", lirik[i].mulai, Math.min(akhir, lirik[i].mulai + 10), lirik[i].teks);
    }
  }
  if (!dialog.length) return "";
  return [...kepala, ...dialog, ""].join("\n");
}

// ============ LRC & CHORD SHEET ============

/** Parse teks .lrc → baris lirik bertanda waktu; baris tanpa waktu diabaikan. */
export function parseLrc(teks: string): BarisLirik[] {
  const hasil: BarisLirik[] = [];
  const re = /\[(\d{1,2}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g;
  for ( const baris of (teks || "").split(/\r?\n/)) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    let terakhir = 0;
    let waktu = -1;
    while ((m = re.exec(baris))) {
      const menit = parseInt(m[1], 10);
      const detik = parseInt(m[2], 10);
      const pecahan = m[3] ? parseInt(m[3].padEnd(3, "0").slice(0, 3), 10) / 1000 : 0;
      waktu = menit * 60 + detik + pecahan;
      terakhir = re.lastIndex;
    }
    const isi = baris.slice(terakhir).trim();
    if (waktu >= 0 && isi) hasil.push({ mulai: waktu, teks: isi });
  }
  return hasil.sort((a, b) => a.mulai - b.mulai);
}

export function formatWaktuLrc(t: number): string {
  const menit = Math.floor(Math.max(0, t) / 60);
  const detik = Math.max(0, t) - menit * 60;
  return `${String(menit).padStart(2, "0")}:${detik.toFixed(2).padStart(5, "0")}`;
}

export function formatLrc(lirik: BarisLirik[]): string {
  return lirik.map((b) => `[${formatWaktuLrc(b.mulai)}]${b.teks}`).join("\n") + "\n";
}

/** Chord sheet teks: chord di atas tiap baris lirik (selaras waktu) */
export function formatChordSheet(judul: string, meta: string, chord: SegmenChord[], lirik: BarisLirik[]): string {
  const baris: string[] = [judul, meta, "=".repeat(Math.min(60, Math.max(24, judul.length + 4))), ""];
  if (lirik.length) {
    for (let i = 0; i < lirik.length; i++) {
      const mulai = lirik[i].mulai;
      const akhir = i + 1 < lirik.length ? lirik[i + 1].mulai : mulai + 6;
      const aktif = chord.filter((c) => c.mulai < akhir && c.mulai + c.durasi > mulai);
      baris.push(`[${formatWaktuLrc(mulai)}] ${aktif.map((c) => c.chord).join("  ")}`);
      baris.push(`    ${lirik[i].teks}`);
    }
  } else {
    baris.push("GARIS WAKTU CHORD:");
    baris.push("");
    for (const c of chord) {
      baris.push(`[${formatWaktuLrc(c.mulai)}]  ${c.chord.padEnd(6)} (${Math.round(c.durasi)} dtk)`);
    }
  }
  baris.push("");
  baris.push("Dibuat otomatis oleh VidSplit Studio Musik — chord adalah PERKIRAAN, silakan disesuaikan.");
  return baris.join("\n") + "\n";
}
