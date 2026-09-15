// VidSplit v0.12.0 — STUDIO MUSIK: tipe data, resep genre (17), resep visual (15),
// pembangun filter audio ffmpeg, subtitle ASS (judul + chord + lirik), LRC & chord sheet.
// v0.11.0: MODE TRANSFORMASI PENUH + KECEPATAN TEMPO 0.5×/1×/1.5× (atempo nyata).
// v0.12.0 "MUSIK BARU DARI CHORD": mode penuh kini MURNI musik baru — audio asli tidak
// ikut (vokal bawaan 0%), melodi DICPTAKAN dari chord dgn gaya khas genre (variasi bisa
// diganti), melodi asli jadi opsi pegangan bawaan mati. Semua 100% ffmpeg + JS murni.
// v0.15.0: (a) TINGKAT PERUBAHAN MUSIK 0–100% — campuran paralel asli↔genre (dry/wet
// dgn bobot berjumlah 1, tak mungkin bentrok karena pitch kedua cabang SAMA);
// (b) KARAOKE 3-PITA: sisi (L−R) dibatasi pita, bass mono <160 Hz + "udara" simbal
// >11 kHz dikembalikan, kompensasi loudness (kompresor makeup) — musik karaoke tidak
// lagi terpendam; (c) RESOLUSI 9:16 (1080×1920) bawaan utk video musik + ukuran teks
// overlay bisa diatur (bawaan 25); (d) TEMPO 1.1×–1.5× langkah halus.
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

/** v0.19.0 — PISAH VOKAL & MUSIK (vocal remover, DSP 100% offline):
 *  satu lagu → DUA berkas terpisah sekaligus dalam SATU lari ffmpeg:
 *  · [mout] MUSIK/INSTRUMENTAL — kanal tengah (tempat vokal) dihapus per pita,
 *    bass mono <160 Hz + "udara" simbal >11 kHz dikembalikan + kompresor makeup
 *    (resep karaoke v0.15 yang terbukti nyaring);
 *  · [vout] VOKAL — inti tengah (L+R)/2 difokus ke pita suara 150–9500 Hz +
 *    presence 3 kHz + kompensasi loudness, jadi bersih utk diputar/dinyanyikan.
 *  Metode DSP tengah/samping stereo — paling efektif utk lagu stereo komersial
 *  (vokal di tengah); pada berkas mono hasil = pita suara vs sisa band-reject. */
export function grafPisahVokalMusik(): string {
  return [
    "[0:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,asplit=4[k1][k2][k3][v1]",
    // ==== MUSIK (instrumental): kanal tengah dihapus per pita ====
    "[k1]pan=stereo|c0=0.5*c0+-0.5*c1|c1=0.5*c1+-0.5*c0,highpass=f=110,volume=2.0[side]",
    "[k2]pan=mono|c0=0.5*c0+0.5*c1,lowpass=f=160[bas0]",
    "[bas0]pan=stereo|c0=c0|c1=c0,volume=1.6[bas]",
    "[k3]pan=mono|c0=0.5*c0+0.5*c1,highpass=f=11000[air0]",
    "[air0]pan=stereo|c0=c0|c1=c0,volume=0.45[air]",
    "[bas][side][air]amix=inputs=3:duration=first:normalize=0,acompressor=threshold=-21dB:ratio=2.2:attack=10:release=200:makeup=4.5[mout]",
    // ==== VOKAL: inti tengah, fokus pita suara + presence + kompensasi ====
    "[v1]pan=mono|c0=0.5*c0+0.5*c1,highpass=f=150,lowpass=f=9500,equalizer=f=3000:t=q:w=1:g=2.5,volume=1.7,acompressor=threshold=-19dB:ratio=2.5:attack=8:release=170:makeup=3.5[vout]",
  ].join(";");
}

/** Cara pengubah genre bekerja:
 *  - "ganti"   : (v0.22.0, BAWAAN) GANTI INSTRUMEN — cover genre sejati. SEMUA
 *                instrumen asli dibuang, diganti aransemen baru khas genre
 *                (drum/bass/akor/lead — musikAransemen.ts) yang mengikuti BPM,
 *                fasa, progresi chord DAN dinamika (energi per bar) lagu asli.
 *                Vokal asli (stem AI MDX-Net) dipertahankan di atasnya — persis
 *                band cover: penyanyi tetap, band berganti genre. Musik asli
 *                jadi REFERENSI, bukan lapisan — tidak ada lagi "efek tempelan".
 *  - "remake"  : (v0.14.0) VERSI GENRE ala Suno — lagu asli tetap fondasi utuh
 *                100% (melodi, vokal, groove = bunyi rekaman asli) dan TIDAK ADA nada
 *                tambahan sama sekali (sumber bentrok irama dihapus dari jalur bawaan).
 *                Perubahan gaya dilakukan lewat transformasi yang TERKUNCI ke lagu:
 *                warna genre (EQ/karakter/ruang/lebar), gerak tremolo yang lajunya
 *                dihitung dari BPM lagu, geser nada dasar (transpos, tempo tetap).
 *                Lapisan irama sintesis masih tersedia sbg opsi eksperimental.
 *  - "lapisan": lagu asli utuh + efek karakter genre + lapisan instrumen (v0.10).
 *  - "penuh"  : MUSIK BARU DARI CHORD — audio asli TIDAK ikut (vokal bawaan 0%); chord,
 *                BPM & fasa lagu asli dijadikan REFERENSI lalu seluruh musik baru
 *                (drum/bass/akor/melodi/perkusi) diciptakan khas genre pilihan;
 *                vokal asli opsional (DSP kanal tengah) bila ingin dinyanyikan. */
export type ModeTransformasi = "remake" | "lapisan" | "penuh" | "ganti";

/** pilihan kecepatan tempo — 0.5 = perlambat 2× lebih lama; v0.15.0: langkah halus
 *  1.1×–1.5× utk percepatan (permintaan user: 1.1-1.2-1.3-1.4-1.5) */
export const PILIHAN_KECEPATAN = [0.5, 1, 1.1, 1.2, 1.3, 1.4, 1.5] as const;
export type Kecepatan = (typeof PILIHAN_KECEPATAN)[number];

// v0.18.0 — BPM MANUAL + SUMBER VIDEO
/** Ekstensi file VIDEO yang diterima Mode Musik — audionya diekstrak otomatis jadi FLAC lossless. */
export const EKSTENSI_VIDEO_MUSIK = [".mp4", ".mkv", ".webm", ".mov", ".m4v", ".avi"] as const;

/** Apakah nama file berakhiran ekstensi video tsb (case-insensitive). */
export function adalahVideoMusik(nama: string): boolean {
  const ext = (nama.split(".").pop() || "").toLowerCase();
  return ext.length > 0 && (EKSTENSI_VIDEO_MUSIK as readonly string[]).includes(`.${ext}`);
}

/** v0.18.0 — BPM manual: rapikan masukan user (30–300; di luar itu / bukan angka → bawaan deteksi).
 * Dipakai UI input BPM manual & clampStudio agar tampilan = hasil. */
export function bpmAman(nilai: unknown, bawaan: number): number {
  const n = Number(nilai);
  if (!Number.isFinite(n) || n <= 0) return bpmAman(bawaan, 120);
  return Math.min(300, Math.max(30, Math.round(n * 10) / 10));
}

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

// ============ v0.14.0 — WARNA GENRE utk mode REMAKE ("versi genre") ============

/** Resep WARNA GENRE: murni transformasi atas AUDIO ASLI (tanpa nada tambahan) —
 *  semua nilai di-skalakan dgn "tingkat rasa genre" (0–100%).
 *  eq     : pita parametrik [freq Hz, lebar oktaf, gain dB (× t)]
 *  bass   : dorongan bass dB @95 Hz (× t)
 *  treble : dorongan tinggi dB @9500 Hz (× t, boleh minus)
 *  comp   : [threshold dB, ratio, attack ms, release ms, makeup dB] — ratio/makeup × t
 *  echo   : [delay ms, decay, outGain maks (× t)] — ruang/karakter khas genre
 *  lebar  : lebar stereo ekstra (extrastereo m = 1 + lebar × t)
 *  kilau  : crystalizer (× t)
 *  pump   : depth tremolo (× t) dgn pumpMul kelipatan ketuk (2 = not ke-8) — LAJU
 *           DIHITUNG dari BPM lagu × faktor tempo, jadi geraknya selalu seirama
 *  wobble : [freq Hz, depth (× t)] vibrato khas kaset (lofi)
 *  lowpass: potong frekuensi tinggi (lofi/hiphop)
 *  phaser : kecepatan Hz (aktif di paruh atas tingkat) — raung blues */
export interface ResepWarna {
  eq?: [number, number, number][];
  bass?: number;
  treble?: number;
  comp?: [number, number, number, number, number];
  echo?: [string, string, number];
  lebar?: number;
  kilau?: number;
  pump?: number;
  pumpMul?: number;
  wobble?: [number, number];
  lowpass?: number;
  phaser?: number;
}

export const WARNA_GENRE: Record<GenreMusik, ResepWarna> = {
  pop:       { eq: [[3000, 1.2, 3]], treble: 2, comp: [-16, 2.5, 12, 180, 3], kilau: 1.8, lebar: 0.3 },
  rock:      { eq: [[120, 1, 4], [2500, 1.5, 5]], comp: [-14, 4, 8, 120, 4], kilau: 2.5, lebar: 0.2 },
  punk:      { eq: [[200, 1.2, 4], [4000, 1.5, 5]], comp: [-12, 6, 5, 90, 4], kilau: 2, lebar: 0.15 },
  metal:     { bass: 6, eq: [[3500, 1.8, 6]], comp: [-13, 8, 4, 80, 4], kilau: 3, lebar: 0.15 },
  jazz:      { eq: [[180, 1, 3]], treble: -2.5, comp: [-20, 2, 25, 350, 2], echo: ["90|180", "0.18|0.1", 0.5], lebar: 0.2 },
  blues:     { eq: [[160, 1, 3.5]], treble: -1.5, comp: [-18, 2.5, 15, 250, 2], echo: ["70", "0.15", 0.5], phaser: 0.6, lebar: 0.2 },
  reggae:    { bass: 7, eq: [[2500, 1.4, -3]], comp: [-18, 3, 15, 250, 2], echo: ["180|320", "0.22|0.12", 0.6], lebar: 0.35, pump: 0.12, pumpMul: 0.5 },
  ska:       { eq: [[800, 1.2, 3]], treble: 3, comp: [-15, 3, 10, 140, 2.5], lebar: 0.35, pump: 0.2, pumpMul: 2 },
  dangdut:   { bass: 5, eq: [[90, 0.9, 3], [1800, 1.3, 4]], treble: 2, comp: [-16, 3.5, 10, 160, 2.5], echo: ["120|240", "0.14|0.08", 0.45], lebar: 0.35 },
  edm:       { bass: 6, treble: 4, comp: [-12, 6, 6, 110, 4], kilau: 2, lebar: 0.5, pump: 0.32, pumpMul: 2 },
  hiphop:    { bass: 7, lowpass: 13500, comp: [-15, 4, 8, 140, 3], lebar: 0.2, pump: 0.14, pumpMul: 1 },
  funk:      { eq: [[400, 1.1, 4], [7000, 1.4, 2.5]], comp: [-14, 5, 5, 100, 3], kilau: 1.5, lebar: 0.3, pump: 0.16, pumpMul: 2 },
  disco:     { bass: 4, treble: 3.5, comp: [-14, 4, 8, 130, 3], kilau: 2, lebar: 0.6, pump: 0.26, pumpMul: 2 },
  keroncong: { eq: [[220, 1, 3]], treble: -1, comp: [-19, 2.2, 20, 300, 2], echo: ["120|240", "0.2|0.12", 0.55], lebar: 0.25 },
  country:   { eq: [[500, 1, 2.5]], treble: 2, comp: [-17, 2.8, 14, 200, 2], echo: ["110", "0.28", 0.6], lebar: 0.2 },
  lofi:      { bass: 4, lowpass: 7500, comp: [-18, 3, 18, 250, 2], echo: ["60|110", "0.15|0.1", 0.45], wobble: [3.5, 0.1], lebar: 0 },
  gamelan:   { eq: [[900, 1.2, 3.5]], treble: 1.5, comp: [-18, 2.5, 18, 280, 2], echo: ["160|300", "0.25|0.15", 0.65], lebar: 0.45 },
};

const dua = (n: number) => Math.round(n * 100) / 100;

/** v0.14.0 — bangun rantai filter WARNA GENRE utk mode remake ("versi genre").
 *  tingkat 0–100 (0 = apa adanya). bpmEfektif = BPM lagu × faktor tempo hasil —
 *  dipakai tremolo "pump" agar laju geraknya TERKUNCI ke tempo lagu sendiri.
 *  Karena tidak ada nada/ritme baru yang ditambahkan, hasil MUSTAHIL saling
 *  bertentangan dgn irama asli — semua perubahan lahir dari audio asli itu sendiri. */
export function rantaiWarna(genre: GenreMusik, tingkat: number, bpmEfektif: number): string[] {
  const w = WARNA_GENRE[genre];
  if (!w) return [];
  const t = Math.min(1, Math.max(0, tingkat / 100));
  if (t <= 0.005) return [];
  const out: string[] = [];
  if (w.lowpass) out.push(`lowpass=f=${Math.round(w.lowpass)}`);
  if (w.bass) out.push(`bass=g=${dua(w.bass * t)}:f=95`);
  if (w.treble) out.push(`treble=g=${dua(w.treble * t)}:f=9500`);
  for (const [f, wd, g] of w.eq ?? []) {
    if (Math.abs(g * t) < 0.4) continue; // pita nyaris nol tidak perlu
    out.push(`equalizer=f=${f}:t=q:w=${wd}:g=${dua(g * t)}`);
  }
  if (w.comp) {
    const [th, rasio, atk, rel, mk] = w.comp;
    out.push(`acompressor=threshold=${th}dB:ratio=${dua(1 + (rasio - 1) * t)}:attack=${atk}:release=${rel}:makeup=${dua(mk * t)}`);
  }
  if (w.echo) {
    const [d, dc, g] = w.echo;
    out.push(`aecho=0.8:${dua(0.3 + Math.abs(g) * t)}:${d}:${dc}`);
  }
  if (w.kilau && t > 0.05) out.push(`crystalizer=i=${dua(w.kilau * t)}`);
  if (w.pump && w.pumpMul) {
    const f = Math.min(20, Math.max(0.1, (Math.max(50, Math.min(220, bpmEfektif)) / 60) * w.pumpMul));
    out.push(`tremolo=f=${dua(f)}:d=${dua(Math.max(0.01, w.pump * t))}`);
  }
  if (w.wobble && w.wobble[1] * t >= 0.015) {
    out.push(`vibrato=f=${w.wobble[0]}:d=${dua(w.wobble[1] * t)}`);
  }
  if (w.phaser && t >= 0.35) out.push(`aphaser=0.6:0.6:3:0.6:${dua(w.phaser)}:t`);
  if (w.lebar && t > 0.05) out.push(`extrastereo=m=${dua(1 + w.lebar * t)}`);
  return out;
}

// ==== v0.19.0 — VOKALGEN-3: SUBSTITUSI KANAL TENGAH (vokal terisolasi) ====
// Jawaban "masih belum terlihat perubahan suara vokal": pengukuran objektif
// (scripts/uji-analisis-vokal.ts) membuktikan VOKALGEN-2 (v0.17) hanya mengubah
// timbre vokal ±2–3% (sisa 31 dB) karena rantai karakter diterapkan ke SELURUH
// pita tengah campuran (vokal + gitar + snare semuanya ikut, perubahan vokal
// tertutup instrumen). VOKALGEN-3 memecah pita tengah 180–3800 Hz jadi
// TENGAH/SAMPING: TENGAH (L+R)/2 = inti suara penyanyi → DIGANTI TOTAL dgn
// versi berkarakter genre+referensi; SAMPING (L−R) = instrumen stereo → ASLI.
// Rekonstruksi sempurna: tengah' + samping = pita tengah baru; pita bawah (<180)
// & atas (>3800) tak tersentuh → musik utuh, karakter vokal berubah JELAS
// (terukur: sisa <8 dB = perubahan dominan), tetap sinkron 100% dgn lagu.

/** Resep DSP vokal per genre — diterapkan PENUH pada pita suara (180–3800 Hz)
 *  hasil crossover (bukan tumpangan → nilai EQ boleh & memang BESAR). Semua
 *  nilai di-skalakan dgn "Tingkat rasa vokal" (0–100%). Karakter timbre murni
 *  DSP offline (bukan AI). */
export interface ResepVokalGenre {
  /** EQ timbre inti: [freq Hz, lebar oktaf, gain dB (× t)] — nilai besar krn
   *  pita diganti utuh */
  eq: [number, number, number][];
  /** kehangatan dada (bass low-shelf @160 Hz, dB × t) */
  hangat?: number;
  /** kecerahan (treble @6000 Hz pita tengah + @8000 Hz pita atas, dB × t) */
  terang?: number;
  /** v0.17 — lapisan karakter pitch bawaan genre [semitone, gain @t=1]:
   *  minus = dada dalam, plus = kepala terang. Override bila penyanyi punya
   *  dada/tinggi. */
  geser?: [number, number];
  /** getar khas (vibrato: [f Hz, depth × t]) — mis. hio dangdut */
  vibrato?: [number, number];
  /** getar amplitudo halus */
  tremolo?: [number, number];
  /** ruang/gema khas genre [delay, decay, gain maks (× t)] */
  echo?: [string, string, number];
  /** kompresor [threshold, ratio, attack, release, makeup] — ratio/makeup × t */
  comp?: [number, number, number, number, number];
  /** serak/grit 0..1 (acrusher) — rock/metal/punk/blues/funk */
  grit?: number;
  /** v0.17 — redam UDARA pita atas >3800 Hz (hiphop/lofi) */
  lowpass?: number;
  /** v0.17 — penghalus sibilan (deesser 0..1) */
  deess?: number;
}

export const RESEP_VOKAL_GENRE: Record<GenreMusik, ResepVokalGenre> = {
  pop:       { eq: [[3200, 1.1, 4]], terang: 2.5, geser: [1, 0.26], deess: 0.25, comp: [-18, 3, 10, 160, 4.5] },
  rock:      { eq: [[2600, 1.3, 4.5], [800, 1, 2.5]], hangat: 2.5, grit: 0.45, geser: [-1, 0.24], comp: [-15, 4, 8, 130, 5] },
  punk:      { eq: [[2300, 1.4, 5], [1200, 1, 2.5]], terang: 1.5, grit: 0.6, comp: [-13, 5, 6, 100, 5.5] },
  metal:     { eq: [[3100, 1.6, 5], [200, 1, 2.5]], hangat: 2, grit: 0.65, geser: [-1.5, 0.26], comp: [-12, 6, 5, 90, 6] },
  jazz:      { eq: [[260, 1, 3.5]], hangat: 4, terang: -1.5, geser: [-1, 0.2], echo: ["90|180", "0.18|0.1", 0.5], comp: [-19, 2.5, 16, 280, 4], deess: 0.3 },
  blues:     { eq: [[240, 1, 4], [2000, 1.2, 2]], hangat: 3.5, grit: 0.4, tremolo: [4.8, 0.18], geser: [-1, 0.24], comp: [-17, 3, 12, 220, 4.5] },
  reggae:    { eq: [[380, 1, 3.5], [1500, 1.1, 2]], hangat: 3, vibrato: [5, 0.26], echo: ["170|340", "0.22|0.12", 0.5], comp: [-17, 3.5, 10, 200, 4.5] },
  ska:       { eq: [[1700, 1.2, 4], [2800, 1.2, 2.5]], terang: 2.5, vibrato: [5.5, 0.22], comp: [-15, 3.5, 8, 140, 4.5] },
  dangdut:   { eq: [[2000, 1.2, 4], [3200, 1.1, 3], [700, 1, 1.5]], hangat: 3, vibrato: [5.5, 0.4], echo: ["110|220", "0.16|0.09", 0.45], comp: [-16, 3.5, 9, 150, 4.5] },
  edm:       { eq: [[3200, 1.3, 4.5]], terang: 3, geser: [1, 0.24], deess: 0.2, comp: [-15, 4.5, 7, 130, 5] },
  hiphop:    { eq: [[480, 1, 4]], hangat: 4, lowpass: 9500, geser: [-1.5, 0.28], comp: [-15, 4.5, 7, 140, 5] },
  funk:      { eq: [[950, 1.2, 3], [3600, 1.3, 3]], grit: 0.3, comp: [-14, 4.5, 6, 110, 5] },
  disco:     { eq: [[2900, 1.2, 4]], terang: 3, geser: [1, 0.24], echo: ["90|180", "0.16|0.09", 0.45], comp: [-14, 4, 7, 120, 5] },
  keroncong: { eq: [[220, 1, 3.5], [1800, 1.1, 2]], hangat: 3.5, vibrato: [5, 0.28], geser: [-1, 0.2], echo: ["130|260", "0.2|0.11", 0.5], comp: [-18, 2.6, 14, 260, 4], deess: 0.25 },
  country:   { eq: [[750, 1, 3], [2600, 1.2, 2.5]], terang: 2, hangat: 2, echo: ["110", "0.26", 0.5], comp: [-16, 3, 10, 180, 4.5] },
  lofi:      { eq: [[1500, 1.1, 2]], hangat: 2.5, lowpass: 6800, vibrato: [3.2, 0.22], geser: [-1, 0.24], comp: [-17, 3, 12, 220, 4] },
  gamelan:   { eq: [[1100, 1.2, 2.5], [2400, 1.2, 2]], terang: 1.5, vibrato: [4.6, 0.2], echo: ["160|320", "0.24|0.13", 0.55], comp: [-17, 2.8, 12, 240, 4] },
};

/** Satu REFERENSI PENYANYI — preset karakter gaya (EQ, getar, serak, ruang)
 *  yang terinspirasi ciri khas penyanyi itu. Jujur di UI: ini karakter gaya
 *  DSP 100% offline, BUKAN tiruan suara asli (itu butuh AI server GPU). */
export interface ReferensiPenyanyi {
  id: string;
  nama: string;
  ket: string;
  /** EQ pribadi tambahan [freq, oktaf, gain dB × t] */
  eq?: [number, number, number][];
  /** pengali depth vibrato genre (1 = standar) */
  vibMul?: number;
  /** pengali serak (1 = standar) */
  gritMul?: number;
  /** dB kecerahan tambahan (× t) */
  terang?: number;
  /** dB kehangatan tambahan (× t) */
  hangat?: number;
  /** v0.17 — karakter DADA DALAM: register suara diturunkan −N semitone (0,5–3)
   *  → lebih berat/berwibawa (khas penyanyi pria) */
  dada?: number;
  /** v0.23 — REGISTER WANITA SEJATI: register suara dinaikkan +N semitone
   *  (4–5,5 = jarak register pria→wanita yang nyata; dulu hanya 1–2,5 → suara
   *  wanita masih terdengar seperti pria). Nada dasar lagu ikut bergeser agar
   *  vokal selaras dgn instrumen. */
  tinggi?: number;
}

/** 17 genre × (2 penyanyi pria + 2 penyanyi wanita) = 68 referensi —
 *  dipilih user sebagai acuan KARAKTER suara vokal hasil. */
export const REFERENSI_VOKAL: Record<GenreMusik, { pria: ReferensiPenyanyi[]; wanita: ReferensiPenyanyi[] }> = {
  pop: {
    pria: [
      { id: "pop-p1", nama: "Tulus", ket: "Bersih lembut, dada penuh", hangat: 1.5, vibMul: 0.9, dada: 1.5 },
      { id: "pop-p2", nama: "Glenn Fredly", ket: "Hangat soul, teduh", eq: [[600, 1, 1.5]], hangat: 1, dada: 1 },
    ],
    wanita: [
      { id: "pop-w1", nama: "Rossa", ket: "Mengkilap, presisi", terang: 1.5, vibMul: 1.1, tinggi: 5 },
      { id: "pop-w2", nama: "Andien", ket: "Mengalir lembut, soul", hangat: 1.5, vibMul: 0.85, tinggi: 4.5 },
    ],
  },
  rock: {
    pria: [
      { id: "rock-p1", nama: "Ahmad Albar", ket: "Serak garang, legenda", gritMul: 1.3, hangat: 1, dada: 2 },
      { id: "rock-p2", nama: "Ari Lasso", ket: "Melankolis, jerit tinggi", terang: 1.5, gritMul: 0.85, tinggi: 1.5 },
    ],
    wanita: [
      { id: "rock-w1", nama: "Nicky Astria", ket: "Berwibawa, rock lawas", hangat: 1.5, gritMul: 1.1, tinggi: 4.5 },
      { id: "rock-w2", nama: "Anggun", ket: "Bulat kuat, era 90-an", terang: 1, gritMul: 0.8, tinggi: 4.5 },
    ],
  },
  punk: {
    pria: [
      { id: "punk-p1", nama: "Joey Ramone", ket: "Nasal lurus khas Ramones", eq: [[1200, 1.2, 2]], gritMul: 1.2, tinggi: 1.5 },
      { id: "punk-p2", nama: "Billie Joe Armstrong", ket: "Nasal cepat Green Day", eq: [[1400, 1.2, 1.5]], gritMul: 1, tinggi: 1 },
    ],
    wanita: [
      { id: "punk-w1", nama: "Hayley Williams", ket: "Pop-punk lincah", terang: 1.5, gritMul: 0.9, tinggi: 5 },
      { id: "punk-w2", nama: "Kathleen Hanna", ket: "Riot grrrl tajam", eq: [[1800, 1.2, 2]], gritMul: 1.25, tinggi: 5.5 },
    ],
  },
  metal: {
    pria: [
      { id: "metal-p1", nama: "Bruce Dickinson", ket: "Operik tinggi Iron Maiden", terang: 1.5, gritMul: 0.7, vibMul: 1.2, tinggi: 2.5 },
      { id: "metal-p2", nama: "Rob Halford", ket: "Jerit baja Judas Priest", terang: 2, gritMul: 0.9, tinggi: 2.5 },
    ],
    wanita: [
      { id: "metal-w1", nama: "Angela Gossow", ket: "Geraman death Arch Enemy", gritMul: 1.5, hangat: 1.5, tinggi: 4 },
      { id: "metal-w2", nama: "Doro Pesch", ket: "Metal kuat eropa", terang: 1, gritMul: 1.05, tinggi: 4.5 },
    ],
  },
  jazz: {
    pria: [
      { id: "jazz-p1", nama: "Frank Sinatra", ket: "Frasa santai, dada hangat", hangat: 1.5, vibMul: 0.8, dada: 2 },
      { id: "jazz-p2", nama: "Michael Bublé", ket: "Swing modern mengkilap", terang: 1, vibMul: 0.9, dada: 1.5 },
    ],
    wanita: [
      { id: "jazz-w1", nama: "Ella Fitzgerald", ket: "Gesit, swing murni", terang: 1.5, vibMul: 0.85, tinggi: 5 },
      { id: "jazz-w2", nama: "Norah Jones", ket: "Berbisik hangat intim", hangat: 2, terang: -0.5, tinggi: 4 },
    ],
  },
  blues: {
    pria: [
      { id: "blues-p1", nama: "B.B. King", ket: "Raung hangat penuh cerita", hangat: 2, gritMul: 1.15, vibMul: 1.2, dada: 2 },
      { id: "blues-p2", nama: "Eric Clapton", ket: "Serak kalem, dada dalam", hangat: 1.5, gritMul: 0.95, dada: 1.5 },
    ],
    wanita: [
      { id: "blues-w1", nama: "Etta James", ket: "Kuat bergetar penuh rasa", hangat: 2, vibMul: 1.3, tinggi: 4.5 },
      { id: "blues-w2", nama: "Bonnie Raitt", ket: "Berdebu hangat", hangat: 1.5, gritMul: 1.1, tinggi: 4 },
    ],
  },
  reggae: {
    pria: [
      { id: "reggae-p1", nama: "Bob Marley", ket: "Tenang berayun khas one drop", vibMul: 1.1, hangat: 1, dada: 1 },
      { id: "reggae-p2", nama: "Peter Tosh", ket: "Tegas bertaut", eq: [[800, 1.2, 1.5]], gritMul: 1.1, dada: 1.5 },
    ],
    wanita: [
      { id: "reggae-w1", nama: "Marcia Griffiths", ket: "Lembut ayun I-Threes", terang: 1, vibMul: 0.95, tinggi: 4.5 },
      { id: "reggae-w2", nama: "Rita Marley", ket: "Hangat bersahutan", hangat: 1.5, tinggi: 4 },
    ],
  },
  ska: {
    pria: [
      { id: "ska-p1", nama: "Desmond Dekker", ket: "Ceria melompat era rocksteady", terang: 1.5, vibMul: 1.15, tinggi: 1 },
      { id: "ska-p2", nama: "Prince Buster", ket: "Teriak seruan sound system", eq: [[1000, 1.2, 1.5]], gritMul: 1.1, dada: 1.5 },
    ],
    wanita: [
      { id: "ska-w1", nama: "Dawn Penn", ket: "Dingin khas rocksteady", hangat: 1, vibMul: 0.9, tinggi: 4.5 },
      { id: "ska-w2", nama: "Pauline Black", ket: "Tegas cerdas The Selecter", terang: 1.5, tinggi: 5 },
    ],
  },
  dangdut: {
    pria: [
      { id: "dangdut-p1", nama: "Rhoma Irama", ket: "Berhio hidup, raja dangdut", vibMul: 1.25, eq: [[1200, 1.2, 1.5]], hangat: 1, dada: 2 },
      { id: "dangdut-p2", nama: "Mansyur S", ket: "Dalam merdu khas Melayu", hangat: 2, terang: -0.5, vibMul: 0.8, dada: 2 },
    ],
    wanita: [
      { id: "dangdut-w1", nama: "Elvi Sukaesih", ket: "Penuh rasa, ratu dangdut", vibMul: 1.2, eq: [[2000, 1.2, 1.5]], tinggi: 4.5 },
      { id: "dangdut-w2", nama: "Inul Daratista", ket: "Lincah khas ngebor", terang: 1.5, vibMul: 1.1, tinggi: 5 },
    ],
  },
  edm: {
    pria: [
      { id: "edm-p1", nama: "The Weeknd", ket: "Falsetto gelap synth-pop", terang: 1.5, vibMul: 1.1, tinggi: 1.5 },
      { id: "edm-p2", nama: "Daft Punk", ket: "Vocoder robot khas house", eq: [[2000, 1.5, 2.5]], gritMul: 1.3, tinggi: 1 },
    ],
    wanita: [
      { id: "edm-w1", nama: "Dua Lipa", ket: "Rendah dingin dance-pop", hangat: 1.5, terang: 1, tinggi: 4.5 },
      { id: "edm-w2", nama: "Ava Max", ket: "Terang menembus beat", terang: 2, tinggi: 5.5 },
    ],
  },
  hiphop: {
    pria: [
      { id: "hiphop-p1", nama: "Eminem", ket: "Rapat cepat penuh serangan", eq: [[2500, 1.4, 2]], gritMul: 1.15, dada: 1 },
      { id: "hiphop-p2", nama: "Jay-Z", ket: "Santai tenang boss", hangat: 1.5, gritMul: 0.9, dada: 1.5 },
    ],
    wanita: [
      { id: "hiphop-w1", nama: "Lauryn Hill", ket: "Soul rap mengalir", hangat: 2, vibMul: 1.05, tinggi: 4.5 },
      { id: "hiphop-w2", nama: "Nicki Minaj", ket: "Lincah berkarakter", eq: [[1800, 1.2, 1.5]], terang: 1.5, tinggi: 5.5 },
    ],
  },
  funk: {
    pria: [
      { id: "funk-p1", nama: "James Brown", ket: "Teriak energi bapak funk", gritMul: 1.3, eq: [[1200, 1.2, 1.5]], tinggi: 1.5 },
      { id: "funk-p2", nama: "Stevie Wonder", ket: "Melenting bergetar soul", vibMul: 1.35, terang: 1, tinggi: 2 },
    ],
    wanita: [
      { id: "funk-w1", nama: "Chaka Khan", ket: "Kuat meledak-leledak", terang: 1.5, vibMul: 1.2, tinggi: 5 },
      { id: "funk-w2", nama: "Aretha Franklin", ket: "Ratu soul berwibawa", hangat: 2, vibMul: 1.1, tinggi: 4.5 },
    ],
  },
  disco: {
    pria: [
      { id: "disco-p1", nama: "Bee Gees", ket: "Falsetto tinggi mengambang", terang: 2, vibMul: 1.15, tinggi: 2.5 },
      { id: "disco-p2", nama: "Michael Jackson", ket: "Ringan bertaut era Off the Wall", eq: [[1500, 1.2, 1.5]], terang: 1.5, tinggi: 1.5 },
    ],
    wanita: [
      { id: "disco-w1", nama: "Donna Summer", ket: "Berpulsar ratu disko", terang: 1.5, vibMul: 1.1, tinggi: 5 },
      { id: "disco-w2", nama: "Gloria Gaynor", ket: "Kuat perkasa", hangat: 1.5, tinggi: 4.5 },
    ],
  },
  keroncong: {
    pria: [
      { id: "keroncong-p1", nama: "Gesang", ket: "Langgam tenang maestro", hangat: 2, vibMul: 0.85, dada: 1.5 },
      { id: "keroncong-p2", nama: "Manthous", ket: "Langgam Jawa campursari", hangat: 1.5, eq: [[600, 1, 1.5]], dada: 1 },
    ],
    wanita: [
      { id: "keroncong-w1", nama: "Waldjinah", ket: "Ratu Keroncong langgam Jawa", vibMul: 1.15, hangat: 1.5, tinggi: 4.5 },
      { id: "keroncong-w2", nama: "Sundari Sukoco", ket: "Langgam halus Solo", terang: 1, vibMul: 0.9, tinggi: 4.5 },
    ],
  },
  country: {
    pria: [
      { id: "country-p1", nama: "Johnny Cash", ket: "Berdebu dalam man in black", hangat: 2.5, gritMul: 1.2, dada: 2.5 },
      { id: "country-p2", nama: "Kenny Rogers", ket: "Hangat bercerita", hangat: 1.5, vibMul: 0.9, dada: 1.5 },
    ],
    wanita: [
      { id: "country-w1", nama: "Dolly Parton", ket: "Terang bulat country", terang: 2, vibMul: 1.1, tinggi: 5.5 },
      { id: "country-w2", nama: "Patsy Cline", ket: "Sedih klasik Nashville", hangat: 1.5, vibMul: 1.2, tinggi: 4.5 },
    ],
  },
  lofi: {
    pria: [
      { id: "lofi-p1", nama: "Joji", ket: "Berbisik pilu bedroom", hangat: 2, terang: -1, vibMul: 0.8, dada: 2 },
      { id: "lofi-p2", nama: "Keshi", ket: "Falsetto tipis malam", terang: 1, vibMul: 0.85, tinggi: 1.5 },
    ],
    wanita: [
      { id: "lofi-w1", nama: "Clairo", ket: "Kalem berdebu bedroom pop", hangat: 1.5, terang: -0.5, tinggi: 4 },
      { id: "lofi-w2", nama: "Beabadoobee", ket: "Manis indie mengantuk", eq: [[1500, 1.2, 1.5]], terang: 0.5, tinggi: 4.5 },
    ],
  },
  gamelan: {
    pria: [
      { id: "gamelan-p1", nama: "Didi Kempot", ket: "Panicinta lawas langgam Jawa", hangat: 2, vibMul: 0.95, dada: 1.5 },
      { id: "gamelan-p2", nama: "Ki Nartosabdo", ket: "Sindhen pria wayang berwibawa", hangat: 1.5, vibMul: 1.1, dada: 1 },
    ],
    wanita: [
      { id: "gamelan-w1", nama: "Peni Candra Rini", ket: "Sindhen berkelas", terang: 1, vibMul: 1.2, tinggi: 5 },
      { id: "gamelan-w2", nama: "Endah Laras", ket: "Sindhen hangat gaya Yogya", hangat: 1.5, vibMul: 1, tinggi: 4.5 },
    ],
  },
};

/** v0.23.0 — apakah referensi penyanyi ini WANITA? Dipakai utk register besar
 *  (+4–5,5 st) & feminisasi timbre (pangkas resonansi dada, ring 3,4 kHz). */
export function adalahWanita(refId: string): boolean {
  for (const g of DAFTAR_GENRE) {
    if (REFERENSI_VOKAL[g].wanita.some((r) => r.id === refId)) return true;
  }
  return false;
}

/** Cari referensi penyanyi dari id di SELURUH genre (fallback bila id tak dikenal). */
export function cariReferensiVokal(id: string): ReferensiPenyanyi | null {
  for (const g of DAFTAR_GENRE) {
    for (const r of [...REFERENSI_VOKAL[g].pria, ...REFERENSI_VOKAL[g].wanita]) {
      if (r.id === id) return r;
    }
  }
  return null;
}

/** v0.17 — bangun rantai filter KARAKTER VOKAL (diterapkan PENUH pada pita suara
 *  180–3800 Hz hasil crossover — pita diganti utuh, bukan tumpangan tipis).
 *  Resep genre + sentuhan pribadi referensi penyanyi, semua di-skalakan dgn
 *  tingkat 0–100 (0 = apa adanya). Murni DSP offline. */
/** v0.19 — faktor penguatan rantai karakter: rantai kini bekerja pada vokal
 *  TERISOLASI (kanal tengah), bukan campuran penuh → nilai EQ/efek boleh dan
 *  memang harus jauh lebih besar agar terdengar jelas. */
const KUAT_VOKALGEN = 1.8;

export function rantaiVokal(genre: GenreMusik, refId: string, tingkat: number): string[] {
  const base = RESEP_VOKAL_GENRE[genre];
  if (!base) return [];
  const ref = cariReferensiVokal(refId) ?? REFERENSI_VOKAL[genre].pria[0];
  const t = Math.min(1, Math.max(0, tingkat / 100));
  if (t <= 0.005) return [];
  const out: string[] = [];
  // v0.23.0 — FEMINISASI TIMBRE utk referensi WANITA: suara wanita dibedakan
  // pria bukan cuma pitch, tapi juga resonansi. Resep: (1) pangkas resonansi
  // DADA pria di sekitar 320 Hz (peaking — dasar nada 100-200 Hz tetap utuh,
  // tidak seperti low-shelf yang menipiskan nada dasar), (2) tambah RING khas
  // vokal wanita di 3,4 kHz, (3) penghalus sibilan cadangan — hasil lebih cerah
  // + ringan, bukan sekadar "pria yang dinaikkan pitch"-nya saja.
  const wanita = adalahWanita(ref.id);
  if (wanita) {
    out.push(`equalizer=f=320:t=q:w=1.4:g=${dua(-4.5 * t)}`);
    out.push(`equalizer=f=3400:t=q:w=1.5:g=${dua(2.6 * t * 1.5)}`);
    if (!base.deess) out.push(`deesser=i=${dua(0.2 * t)}`);
  }
  const hangat = (base.hangat ?? 0) + (ref.hangat ?? 0);
  const terang = (base.terang ?? 0) + (ref.terang ?? 0);
  // v0.23 — kehangatan dada (low-shelf 160 Hz) = ciri pria → tidak diterapkan
  // utk referensi wanita (sudah diganti pangkas-dada di atas)
  if (hangat && !wanita) out.push(`bass=g=${dua(hangat * t * 1.5)}:f=160`);
  for (const [f, wd, g] of [...base.eq, ...(ref.eq ?? [])]) {
    if (Math.abs(g * t * KUAT_VOKALGEN) < 0.4) continue;
    out.push(`equalizer=f=${f}:t=q:w=${wd}:g=${dua(g * t * KUAT_VOKALGEN)}`);
  }
  if (terang) out.push(`treble=g=${dua(terang * t * 1.5)}:f=6000`);
  if (base.comp) {
    const [th, rasio, atk, rel, mk] = base.comp;
    out.push(`acompressor=threshold=${th}dB:ratio=${dua(1 + (rasio - 1) * t)}:attack=${atk}:release=${rel}:makeup=${dua(mk * t)}`);
  }
  if (base.deess) out.push(`deesser=i=${dua(base.deess * t)}`);
  const grit = (base.grit ?? 0) * (ref.gritMul ?? 1);
  if (grit > 0.02) out.push(`acrusher=bits=${dua(9 - 3 * grit)}:mix=${dua(0.25 + 0.45 * grit)}:mode=log:aa=0.3`);
  if (base.vibrato) {
    const d = base.vibrato[1] * (ref.vibMul ?? 1);
    if (d * t >= 0.015) out.push(`vibrato=f=${base.vibrato[0]}:d=${dua(Math.min(1, d * t))}`);
  }
  if (base.tremolo) {
    const d = base.tremolo[1] * t;
    if (d >= 0.01) out.push(`tremolo=f=${base.tremolo[0]}:d=${dua(d)}`);
  }
  if (base.echo) {
    const [d, dc, g] = base.echo;
    out.push(`aecho=0.8:${dua(0.3 + Math.abs(g) * t)}:${d}:${dc}`);
  }
  return out;
}

/** v0.17 — hitung LAPISAN KARAKTER PITCH "dada dalam / kepala terang": salinan
 *  pita suara digeser ±N semitone lalu dicampur balik (fokus 260–3200 Hz) — inilah
 *  sumber perubahan "suara" yang JELAS terdengar. Kompensasi atempo membuat
 *  lapisan tetap SEJAJAR WAKTU dgn lagu (tidak bisa melenceng/singkron rusak).
 *  Bila penyanyi punya dada/tinggi → override resep geser genre. null = tanpa
 *  lapisan (tingkat 0 / karakter nol). */
export function geserVokal(genre: GenreMusik, refId: string, tingkat: number): { st: number; gain: number } | null {
  const base = RESEP_VOKAL_GENRE[genre];
  if (!base) return null;
  const t = Math.min(1, Math.max(0, tingkat / 100));
  if (t <= 0.005) return null;
  const ref = cariReferensiVokal(refId) ?? REFERENSI_VOKAL[genre]?.pria[0] ?? null;
  let st = 0;
  let g = 0;
  if (ref && (ref.dada || ref.tinggi)) {
    st = ref.tinggi ? ref.tinggi : -(ref.dada ?? 0);
    g = 0.26 + 0.09 * Math.abs(st);
  } else if (base.geser) {
    [st, g] = base.geser;
  }
  st = Math.max(-3, Math.min(3, Math.round(st * 2) / 2));
  if (Math.abs(st) < 0.25 || g <= 0.01) return null;
  // v0.19 — lapisan pitch kini pd vokal terisolasi → penguatan 1,45× agar dada
  // dalam/kepala terang benar-benar terdengar (dulu 0,26–0,44 = tenggelam).
  return { st, gain: Math.min(0.65, g * (0.4 + 0.6 * t) * 1.45) };
}

/** v0.21.0 — GANTI-SUARA SATU SUARA (jalur AI): lapisan pitch PARALEL (salinan
 *  digeser lalu dicampur balik dgn suara utama) TERBUKTI terdengar sebagai
 *  PENYANYI KEDUA — keluhan user "suara penyanyinya ada 2" saat genre vokal +
 *  mode Asli dipakai. Solusinya persis usulan user: karaoke dulu (stem vokal
 *  asli dibuang dari campuran), lalu suara genre dimasukkan sbg PENGGANTI penuh.
 *  Register referensi (dada-dalam/kepala-terang) kini menggeser register suara:
 *  seluruh stem vokal digeser ±N semitone DAN seluruh stem musik digeser sama
 *  besarnya (prep di bangunFilterAudioAi) → nada dasar lagu ikut pindah agar
 *  vokal tetap selaras dgn instrumen = seperti penyanyi lain dgn register beda
 *  mencover lagu. Kuantitas = st referensi × tingkat (0–100%, 0% = apa adanya),
 *  langkah ¼ semitone, clamp ±3. Dipakai juga utk lapisan ritme & tampilan UI.
 *  (Jalur DSP v0.19 tetap memakai geserVokal/lapisan — fallback lawas.)
 *  v0.23.0 — SUARA WANITA SEJATI: referensi wanita kini bernilai +4–5,5 st
 *  (jarak register pria→wanita yang nyata; dulu 1–2,5 st = nyaris tak terdengar)
 *  dgn clamp khusus ±6, DAN skala dgn LANTAI 0,6 (skala = 0,6 + 0,4×t) — walau
 *  slider "Kekuatan" masih 55% bawaan, geseran wanita tetap terasa (×0,82),
 *  tidak lagi tenggelam. Referensi pria tak berubah (clamp ±3, skala ×t). */
export function geserVokalSemi(genre: GenreMusik, refId: string, tingkat: number): number {
  const base = RESEP_VOKAL_GENRE[genre];
  if (!base) return 0;
  const t = Math.min(1, Math.max(0, tingkat / 100));
  if (t <= 0.005) return 0;
  const ref = cariReferensiVokal(refId) ?? REFERENSI_VOKAL[genre]?.pria[0] ?? null;
  let st = 0;
  if (ref && (ref.dada || ref.tinggi)) st = ref.tinggi ? ref.tinggi : -(ref.dada ?? 0);
  else if (base.geser) [st] = base.geser;
  if (ref && adalahWanita(ref.id)) {
    st = Math.max(3, Math.min(6, Math.round(st * 2) / 2));
    return Math.max(-6, Math.min(6, Math.round(st * (0.6 + 0.4 * t) * 4) / 4));
  }
  st = Math.max(-3, Math.min(3, Math.round(st * 2) / 2));
  if (Math.abs(st) < 0.25) return 0;
  return Math.max(-3, Math.min(3, Math.round(st * t * 4) / 4));
}

/** v0.24.0 — VOKALGEN-6 "AI GENDER REALISTIS": TARGET GENDER ADAPTIF.
 *  Dulu (v0.23) register wanita = geseran TETAP +4–5,5 st dgn asetrate — pitch DAN
 *  resonansi (formant) ikut naik sama besar → terdengar "pria falsetto". Kini:
 *  (1) MESIN MENGUKUR F0 suara asli (f0MedianPcm — autokorelasi FFT) lalu
 *      menghitung geseran yang PAS menuju target register gender (wanita ≈196–205
 *      Hz — jarak pria 110–150 Hz → wanita memang ±7–10 st, BUKAN 4–5,5;
 *      pria dada ≈112–118 Hz, pria kepala-terang 123–133 Hz);
 *  (2) PITCH digeser dgn rubberband FORMANT-PRESERVED (resonansi pita suara TIDAK
 *      ikut naik → tidak ada suara kerucut/falsetto);
 *  (3) FORMANT digeser TERPISAH (diler % kecil: wanita +8–15%, pria −3–5% = rongga
 *      mulut lebih kecil/besar) — ciri timbre gender yang dulu tak mungkin diatur.
 *  f0Sumber null (musik murni/senyap/tak yakin) → kembali ke geserVokalSemi
 *  statik v0.23 (sumber "bawaan"). Deterministik penuh. */
export function genderGen(
  genre: GenreMusik,
  refId: string,
  tingkat: number,
  f0Sumber: number | null,
): { st: number; formant: number; sumber: "ukur" | "bawaan"; f0Target: number } {
  const t = Math.min(1, Math.max(0, tingkat / 100));
  const ref = cariReferensiVokal(refId) ?? REFERENSI_VOKAL[genre]?.pria[0] ?? null;
  const wanita = ref ? adalahWanita(ref.id) : false;
  // target F0 register per referensi (Hz) — rentang menyanyi realistis
  const f0Target = wanita
    ? 196 + ((ref?.tinggi ?? 4.5) - 4) * 6 // 196–205 Hz (tinggi 4–5,5)
    : ref?.dada
      ? 118 - (ref.dada - 1) * 6 // dada dalam: 112–118 Hz
      : 118 + ((ref?.tinggi ?? 1) - 1) * 10; // pria kepala-terang: 118–133 Hz
  const skala = 0.6 + 0.4 * t; // lantai 0,6 (slider 55% tetap terasa) — konsep v0.23
  let st: number;
  let sumber: "ukur" | "bawaan";
  if (f0Sumber !== null && f0Sumber >= 50 && f0Sumber <= 700) {
    const raw = 12 * Math.log2(f0Target / f0Sumber) * skala;
    // jaga hasil tetap di rentang gender: cap f0 hasil 160–420 Hz (wanita) /
    // 70–160 Hz (pria) — suara yang SUDAH di register benar tak dipaksa pindah
    const batasAtas = wanita ? 12 * Math.log2(420 / f0Sumber) : 12 * Math.log2(160 / f0Sumber);
    const batasBawah = wanita ? 12 * Math.log2(160 / f0Sumber) : 12 * Math.log2(70 / f0Sumber);
    let terjaga = Math.min(raw, batasAtas);
    terjaga = Math.max(terjaga, batasBawah);
    st = Math.min(11, Math.max(-11, terjaga));
    sumber = "ukur";
  } else {
    st = geserVokalSemi(genre, refId, tingkat); // fallback statik v0.23
    sumber = "bawaan";
  }
  st = Math.round(st * 4) / 4;
  if (Math.abs(st) < 0.25) st = 0;
  // geseran formant terpisah (rasio frekuensi resonansi): wanita rongga lebih kecil
  const formant = wanita ? 1 + 0.15 * (0.4 + 0.6 * t) : 1 - 0.05 * (0.4 + 0.6 * t);
  return {
    st,
    formant: Math.round(formant * 10000) / 10000,
    sumber,
    f0Target: Math.round(f0Target),
  };
}

/** v0.24.0 — rantai rubberband VOKAL (jalan di stem terpisah SEBELUM graf campur):
 *  (1) pitch register (st+transposeEkstra) dgn FORMANT PRESERVED — resonansi tak
 *  ikut; (2) pitch +F formant-shifted; (3) pitch −F formant-preserved → pitch
 *  balik, formant NET +F. Durasi kekal (pitch-only), sinkron dijaga fungsi
 *  selaraskanLag. transposeEkstra = transpos remake (kemiripan). */
export function rantaiGenderVokal(st: number, formant: number, transposeEkstra = 0): string {
  const p = Math.pow(2, (st + transposeEkstra) / 12);
  const f = Math.max(0.5, Math.min(2, formant));
  const enam = (x: number) => x.toFixed(6);
  if (Math.abs(f - 1) < 0.0005) {
    // tanpa geseran formant — cukup satu tahap
    return `rubberband=pitch=${enam(p)}:transients=mixed:formant=preserved`;
  }
  return [
    `rubberband=pitch=${enam(p)}:transients=mixed:formant=preserved`,
    `rubberband=pitch=${enam(f)}:formant=shifted`,
    `rubberband=pitch=${enam(1 / f)}:formant=preserved`,
  ].join(",");
}

/** v0.24.0 — rantai rubberband MUSIK: pitch ikut register baru dgn formant
 *  preserved → instrumen tetap natural (bukan nightcore asetrate), durasi kekal. */
export function rantaiGenderMusik(st: number, transposeEkstra = 0): string {
  const p = Math.pow(2, (st + transposeEkstra) / 12);
  return `rubberband=pitch=${p.toFixed(6)}:formant=preserved`;
}
/** v0.17 — baris graf utk pita berkarakter + lapisan pitch (dipakai jalur "asli"
 *  & "vokal saja"): [inL] → rantai karakter (volume gain) → split → salinan
 *  asetrate/atempo (highpass 260 + lowpass 3200 utk fokus area suara) → amix
 *  → [outL]. Bila gv null → hanya karakter. */
function barisVokalKarakter(inL: string, outL: string, fxV: string, gv: { st: number; gain: number } | null, gain: number): string[] {
  const mid = `${inL}x`;
  const lines = [`[${inL}]${fxV},volume=${gain.toFixed(2)}[${mid}]`];
  if (!gv) {
    lines.push(`[${mid}]anull[${outL}]`);
    return lines;
  }
  const aset = Math.round(44100 * Math.pow(2, gv.st / 12));
  const at = Math.pow(2, -gv.st / 12).toFixed(5);
  lines.push(`[${mid}]asplit=2[${mid}1][${mid}2]`);
  lines.push(`[${mid}2]asetrate=${aset},aresample=44100,atempo=${at},highpass=f=260,lowpass=f=3200,volume=${gv.gain.toFixed(3)}[${mid}p]`);
  lines.push(`[${mid}1][${mid}p]amix=inputs=2:duration=first:normalize=0[${outL}]`);
  return lines;
}

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
  /** "remake" | "lapisan" | "penuh" (lihat ModeTransformasi) */
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
  /** v0.13.0 (mode remake) 40–100 % — tingkat kemiripan dgn lagu asli. Sisanya =
   *  "perubahan": nada dasar digeser otomatis ±N semitone (1 N per 10%). Bawaan 80. */
  kemiripan: number;
  /** v0.13.0 (mode remake) transpos manual -5..+5 semitone; null = OTOMATIS
   *  (dihitung dari kemiripan + arah deterministik dari nama berkas). */
  transpose: number | null;
  /** v0.14.0 (mode remake) 0–100 — tingkat RASA GENRE: seberapa kuat warna genre
   *  (EQ/karakter/ruang/lebar/gerak terkunci-BPM) diterapkan ke lagu asli. Bawaan 55. */
  tingkatGenre: number;
  /** v0.15.0 (mode remake) 0–100 — TINGKAT PERUBAHAN MUSIK: campuran paralel
   *  asli↔genre. 0 = lagu asli apa adanya (transpos pun ikut 0); 100 = versi genre
   *  penuh. Kedua cabang punya pitch TEMPO SAMA (transpos diterapkan sebelum split)
   *  → campuran tak mungkin saling bertentangan. Bawaan 65. */
  tingkatMusik: number;
  /** v0.16.0 (mode remake) 0–100 — LAPISAN HARMONI TERKUNCI-AKOR: nada tambahan
   *  khas genre yang dimainkan dari chord lagu sendiri (akor/ters/kvint) + akar
   *  bass + arpeggio di kisi ketukan hasil analisis → seirama by construction.
   *  0 = mati (tanpa nada tambahan sama sekali). Bawaan 30. */
  nadaLevel: number;
  /** v0.16.0 — genre utk VOKAL (terpisah dari genre musik!): "mati" = vokal
   *  asli tanpa sentuhan; selain itu = warna vokal khas genre tsb. */
  genreVokal: GenreMusik | "mati";
  /** v0.16.0 — id referensi penyanyi (mis. "dangdut-p1" = Rhoma Irama); "" = pria pertama */
  refVokal: string;
  /** v0.16.0 0–100 — tingkat rasa vokal (kekuatan warna genre vokal). Bawaan 55. */
  tingkatVokal: number;
  /** v0.20.0 — mesin vokal/karaoke. v0.24.0: "aigen" = AI GENDER REALISTIS
   *  (BAWAAN): stem AI + pitch & formant digeser TERPISAH (rubberband) + target
   *  F0 adaptif per lagu → suara pria/wanita terdengar nyata. "ai" = VOKALGEN-5
   *  lawas (asetrate). "dsp" = DSP tengah/samping cepat (v0.19, fallback lawas). */
  mesinVokal?: "aigen" | "ai" | "dsp";
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
    bpm: bpmAman(o.bpm, 120), // v0.18.0: clamp 30–300 (dulu 50–220 — lagu lambat < 50 BPM terpotong)
    fase: Math.max(0, Number(o.fase) || 0),
    mode: o.mode === "penuh" || o.mode === "lapisan" || o.mode === "ganti" ? o.mode : "remake",
    kecepatan: (PILIHAN_KECEPATAN as readonly number[]).includes(kec) ? kec : 1,
    grooveLevel: Math.min(100, Math.max(0, Math.round(Number(o.grooveLevel ?? 70)))),
    melodiLevel: Math.min(100, Math.max(0, Math.round(Number(o.melodiLevel ?? 65)))),
    melodiAsliLevel: Math.min(100, Math.max(0, Math.round(Number(o.melodiAsliLevel ?? 0)))),
    vokalLevel: Math.min(100, Math.max(0, Math.round(Number(o.vokalLevel ?? 0)))),
    variasi: Math.min(999, Math.max(0, Math.round(Number(o.variasi ?? 0)))),
    kemiripan: Math.min(100, Math.max(40, Math.round(Number(o.kemiripan ?? 80)))),
    transpose:
      o.transpose === null || o.transpose === undefined
        ? null
        : Math.min(5, Math.max(-5, Math.round(Number(o.transpose)))),
    tingkatGenre: Math.min(100, Math.max(0, Math.round(Number(o.tingkatGenre ?? 55)))),
    tingkatMusik: Math.min(100, Math.max(0, Math.round(Number(o.tingkatMusik ?? 65)))),
    nadaLevel: Math.min(100, Math.max(0, Math.round(Number(o.nadaLevel ?? 30)))),
    genreVokal:
      o.genreVokal && (o.genreVokal === "mati" || DAFTAR_GENRE.includes(o.genreVokal))
        ? o.genreVokal
        : "mati",
    refVokal: String(o.refVokal || "").slice(0, 40),
    tingkatVokal: Math.min(100, Math.max(0, Math.round(Number(o.tingkatVokal ?? 55)))),
    mesinVokal: o.mesinVokal === "dsp" ? "dsp" : o.mesinVokal === "ai" ? "ai" : "aigen",
  };
}

/** v0.15.0 — transpos efektif remake = transpos dasar × tingkat perubahan musik.
 *  perubahan 0 → 0 semitone (benar-benar lagu asli); 100 → transpos penuh.
 *  Dipakai bersama oleh musikJobs (render) & UI agar tampilan = hasil. */
export function transposDgnPerubahan(transposDasar: number, tingkatMusik: number): number {
  const p = Math.min(100, Math.max(0, Number(tingkatMusik) || 0)) / 100;
  return Math.round(Math.min(5, Math.max(-5, Number(transposDasar) || 0)) * p);
}

/** v0.13.0 — geser nada dasar OTOMATIS utk mode REMAKE, dari tingkat kemiripan.
 *  kemiripan 100 → 0 semitone; 80 → ±2; 60 → ±4; 40 → ±5 (dibulatkan, maks ±5).
 *  Arah (naik/turun) dipilih deterministik dari seed — lagu sama selalu sama,
 *  lagu beda dapat arah beda biar variasi antarlagu terasa. */
export function transposeAuto(kemiripan: number, seed: string): number {
  const k = Math.min(100, Math.max(40, Number(kemiripan) || 80));
  const perubahan = Math.min(60, Math.max(0, 100 - k));
  const st = Math.min(5, Math.round(perubahan / 10));
  if (st <= 0) return 0;
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h % 2 === 0 ? st : -st;
}

/** Faktor percepatan TOTAL: resep tempo genre × kecepatan pilihan user.
 *  1.2 = hasil 1.2× lebih cepat (durasi dibagi 1.2).
 *  v0.22.0 mode "ganti": aransemen sudah khas genre — hanya kecepatan user. */
export function faktorWaktuStudio(o: Pick<OpsiStudioMusik, "genre" | "kecepatan" | "mode">): number {
  if (o.mode === "ganti") return o.kecepatan;
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
 *  Input 0 = sumber; input 1 (opsional) = wav layer (mode lapisan/remake) ATAU iringan
 *  genre tersintesis (mode penuh). Label keluar [aout].
 *  tempo = faktor percepatan total (resep genre × kecepatan) — diterapkan NYATA via
 *  atempo di ujung rantai, sehingga durasi keluar = durasi sumber / tempo.
 *  v0.13.0 mode remake: `o.transpose` (± semitone) menggeser nada dasar sumber via
 *  asetrate + atempo kompensasi (durasi TETAP — seperti varispeed pita lalu dikembalikan).
 *  `srSumber` = laju sampel asli berkas (untuk asetrate; bawaan 44100).
 *  v0.14.0 mode remake: karakter genre memakai rantaiWarna() (WARNA GENRE) — tanpa
 *  nada tambahan; lapisan sintesis hanya bila layerLevel > 0 (opsi eksperimental). */
export function bangunFilterAudio(o: OpsiStudioMusik, srSumber = 44100): {
  graf: string; adaLayer: boolean; tempo: number; adaVokal: boolean; transpose: number; adaNada: boolean;
} {
  const resep = o.genre === "asli" ? null : RESEP_GENRE[o.genre];
  const tempoResep = resep ? resep.tempo : 1;
  const kecepatan = o.kecepatan || 1; // defensif bila dipanggil tanpa clamp
  // v0.22.0 mode "ganti": aransemen sudah khas genre — resep tempo genre tidak berlaku
  const tempo = o.mode === "ganti" ? kecepatan : tempoResep * kecepatan;
  const penuh = o.mode === "penuh" || o.mode === "ganti";
  const remake = o.mode === "remake";
  const baris: string[] = [];
  // v0.14.0 — mode REMAKE memakai WARNA GENRE (rantaiWarna): seluruh karakter lahir
  // dari transformasi AUDIO ASLI (EQ/kompresor/echo/lebar/kilau) + tremolo "pump"
  // yang lajunya DIHITUNG dari BPM lagu × faktor tempo (terkunci tempo) — TANPA
  // nada tambahan → tidak mungkin saling bertentangan dgn irama asli.
  // Lapisan sintesis hanya masuk bila user menaikkan slider "Lapisan (eksperimental)".
  const warna = remake && o.genre !== "asli"
    ? rantaiWarna(o.genre, o.tingkatGenre ?? 55, (o.bpm || 120) * tempo)
    : [];
  const rantai = remake
    ? (warna.join(",") || "anull")
    // v0.22.0 mode ganti (fallback DSP): aransemen sudah khas genre — TANPA rantai
    // resep tambahan (dulu jadi dobel proses)
    : o.mode === "ganti" ? "anull"
    : resep ? resep.rantai.join(",") : "anull";
  // input 0 hanya dimasukkan ke graf bila benar-benar dipakai (lapisan selalu;
  // penuh hanya bila vokal ikut atau iringan mati) — output graf tak boleh menggantung.
  // v0.12.0: bawaan vokal 0 → audio asli TIDAK masuk graf sama sekali (musik baru murni).
  const pakaiSumber = !penuh || (o.vokalLevel ?? 0) > 0 || (o.grooveLevel ?? 0) <= 0;
  // v0.13.0 — transpos remake: hanya utk mode lapisan/remake (penuh = musik baru murni)
  const transpose = penuh ? 0 : Math.min(5, Math.max(-5, Math.round(o.transpose ?? 0)));
  if (pakaiSumber) {
    if (transpose !== 0) {
      // varispeed pita: asetrate menggeser nada (dan sementara mempercepat),
      // aresample kembalikan laju sampel, atempo kompensasi mengembalikan DURASI —
      // hasil: nada dasar naik/turun N semitone, tempo & panjang lagu tetap.
      const rasio = Math.pow(2, transpose / 12);
      const aset = Math.round(srSumber * rasio);
      const kompensasi = Math.pow(2, -transpose / 12).toFixed(5);
      baris.push(
        `[0:a]asetrate=${aset},aresample=44100,aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,atempo=${kompensasi}[base]`,
      );
    } else {
      baris.push("[0:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo[base]");
    }
  }

  let adaLayer: boolean;
  let adaVokal = false;
  let adaNada = false; // v0.16.0 — lapisan harmoni terkunci-akor aktif
  // v0.17.0 — GENRE VOKAL (mode remake & lapisan): SUBSTITUSI PITA SUARA lewat
  // crossover 3-pita — pita tengah (inti suara penyanyi) DIGANTI dgn versi
  // berkarakter genre + referensi penyanyi, pita bawah/atas tetap asli. Nonaktif
  // saat karaoke (vokalnya sudah dihapus — tak ada yang diwarnai).
  const fxVokalAktif =
    !penuh && !!o.genreVokal && o.genreVokal !== "mati" && DAFTAR_GENRE.includes(o.genreVokal)
    && (o.tingkatVokal ?? 55) > 0 && o.karaoke !== "karaoke";
  let labelAkhir = "mix"; // label bebas di ujung cabang (dikonsumsi atempo/limiter)
  if (!penuh) {
    // ========== MODE REMAKE ("versi genre" v0.14) & LAPISAN (perilaku v0.10) ==========
    // remake: rantai = warna genre (tanpa nada tambahan) + lapisan OPSIONAL (eksper.)
    // lapisan: rantai = resep genre klasik + lapisan bawaan aktif
    // pemisahan vokal (DSP tengah/samping) SEBELUM efek genre
    if (o.karaoke === "karaoke") {
      // v0.15.0 — KARAOKE 3-PITA + KOMPENSASI LOUDNESS:
      //  · pita sisi (L−R) = vokal tengah DIHAPUS, dibatasi highpass 110 Hz & dikuatkan
      //    2× (sisi alami setengah amplitudo → dulu hasilnya bisu/terpendam);
      //  · bass mono <160 Hz dikembalikan penuh (dentum kick/bass tak ikut hilang);
      //  · "udara" simbal >11 kHz dari kanal tengah dikembalikan tipis (kilau musik);
      //  · acompressor makeup menaikkan kepadatan → hasil NYARING, bukan terpendam.
      baris.push(
        "[base]asplit=3[k1][k2][k3]",
        "[k1]pan=stereo|c0=0.5*c0+-0.5*c1|c1=0.5*c1+-0.5*c0,highpass=f=110,volume=2.0[side]",
        "[k2]pan=mono|c0=0.5*c0+0.5*c1,lowpass=f=160[bass0]",
        "[bass0]pan=stereo|c0=c0|c1=c0,volume=1.6[bass]",
        "[k3]pan=mono|c0=0.5*c0+0.5*c1,highpass=f=11000[air0]",
        "[air0]pan=stereo|c0=c0|c1=c0,volume=0.45[air]",
        "[bass][side][air]amix=inputs=3:duration=first:normalize=0[ksrcRaw]",
        "[ksrcRaw]acompressor=threshold=-21dB:ratio=2.2:attack=10:release=200:makeup=4.5[ksrc]",
      );
    } else if (o.karaoke === "vokal") {
      const fxV = fxVokalAktif && o.genreVokal !== "mati"
        ? rantaiVokal(o.genreVokal, o.refVokal, o.tingkatVokal ?? 55).join(",")
        : "";
      const gvV = fxVokalAktif && o.genreVokal !== "mati"
        ? geserVokal(o.genreVokal, o.refVokal, o.tingkatVokal ?? 55)
        : null;
      if (fxV) {
        // v0.19 — pita suara diperlebar 150–9500 Hz (konsonan & udara suara ikut)
        baris.push("[base]pan=mono|c0=0.5*c0+0.5*c1,highpass=f=150,lowpass=f=9500[voc0]");
        baris.push(...barisVokalKarakter("voc0", "voc0b", fxV, gvV, 1.45));
        baris.push("[voc0b]pan=stereo|c0=c0|c1=c0[ksrc]");
      } else {
        baris.push(
          "[base]pan=mono|c0=0.5*c0+0.5*c1,highpass=f=150,lowpass=f=9500,volume=1.45[voc0]",
          "[voc0]pan=stereo|c0=c0|c1=c0[ksrc]",
        );
      }
    } else if (fxVokalAktif && o.genreVokal !== "mati") {
      // v0.19.0 — VOKALGEN-3 SUBSTITUSI KANAL TENGAH (mode "asli"): pita tengah
      // 180–3800 Hz DIPECAH tengah/samping. TENGAH (L+R)/2 = inti suara penyanyi
      // → DIGANTI dgn versi berkarakter genre+referensi (EQ besar, kompresor,
      // getar, ruang, serak, deesser) + LAPISAN PITCH dada/kepala. SAMPING (L−R)
      // = instrumen stereo → tetap ASLI. Rekonstruksi: tengah' + samping = pita
      // tengah baru → perubahan vokal JELAS (vokal terisolasi, tak tertutup
      // instrumen) & musik tetap utuh; sinkron 100%. Berkas mono → samping 0 →
      // seluruh pita tengah menjadi "vokal" (fallback yang benar).
      const fxV = rantaiVokal(o.genreVokal, o.refVokal, o.tingkatVokal ?? 55).join(",");
      const gv = geserVokal(o.genreVokal, o.refVokal, o.tingkatVokal ?? 55);
      const resV = RESEP_VOKAL_GENRE[o.genreVokal];
      const tV = Math.min(1, Math.max(0, (o.tingkatVokal ?? 55) / 100));
      const hi: string[] = [];
      if (resV?.lowpass) hi.push(`lowpass=f=${Math.round(resV.lowpass)}`);
      if (resV?.terang) hi.push(`treble=g=${dua(resV.terang * tV)}:f=8000`);
      baris.push("[base]acrossover=split=180|3800:order=4th[vxl][vxm][vxh]");
      baris.push("[vxl]anull[vokLow]");
      baris.push("[vxm]asplit=2[vmC][vmS]");
      baris.push("[vmC]pan=mono|c0=0.5*c0+0.5*c1[voc0]"); // TENGAH = inti vokal
      baris.push("[vmS]pan=stereo|c0=0.5*c0+-0.5*c1|c1=0.5*c1+-0.5*c0[vocSd]"); // SAMPING = instrumen (amplitudo pas)
      baris.push(...barisVokalKarakter("voc0", "voc1", fxV, gv, 0.8));
      baris.push("[voc1]pan=stereo|c0=c0|c1=c0[vocS]");
      baris.push("[vocSd][vocS]amix=inputs=2:duration=first:normalize=0[vmMix]");
      baris.push(hi.length ? `[vxh]${hi.join(",")}[vokHigh]` : "[vxh]anull[vokHigh]");
      baris.push("[vokLow][vmMix][vokHigh]amix=inputs=3:duration=first:normalize=0[ksrc]");
    } else {
      baris.push("[base]anull[ksrc]");
    }
    // v0.15.0 — TINGKAT PERUBAHAN MUSIK (remake + genre): campuran paralel asli↔genre.
    // Transpos diterapkan di [base] SEBELUM split → kedua cabang pitch & tempo SAMA,
    // bobot volume berjumlah 1 → campuran tak mungkin bentrok/lain-kunci; slider hanya
    // menentukan "seberapa jauh warna genre masuk". 0% = apa adanya, 100% = penuh.
    const perubahan = remake && o.genre !== "asli"
      ? Math.min(100, Math.max(0, Number(o.tingkatMusik ?? 65))) / 100
      : 1;
    if (remake && warna.length && perubahan <= 0.005) {
      baris.push("[ksrc]anull[g]");
    } else if (remake && warna.length && perubahan < 0.995) {
      const wAsli = (1 - perubahan).toFixed(3);
      const wGaya = perubahan.toFixed(3);
      baris.push(
        "[ksrc]asplit=2[blA][blB]",
        `[blA]volume=${wAsli}[blAsli]`,
        `[blB]volume=${wGaya}[blGaya0]`,
        `[blGaya0]${rantai}[blGaya]`,
        "[blAsli][blGaya]amix=inputs=2:duration=first:normalize=0[g]",
      );
    } else {
      baris.push(`[ksrc]${rantai}[g]`);
    }
    adaLayer = !!resep && o.layerLevel > 0 && !!resep.layer;
    // v0.16.0 — LAPISAN HARMONI TERKUNCI-AKOR (remake + genre, bukan "asli"):
    // nada tambahan khas genre yang SEMUA nada-nya diambil dari chord lagu sendiri
    // (pad akor + akar bass + arpeggio di kisi ketukan hasil analisis) → seirama
    // by construction. Input 1 (atau 2 bila lapisan eksperimental ikut aktif).
    adaNada = remake && o.genre !== "asli" && (o.nadaLevel ?? 0) > 0;
    // v0.15.0 — gain akhir sadar-karaoke: jalur karaoke sudah membawa kompensasi
    // loudness sendiri (makeup 4,5 dB) → penguatan akhir diturunkan agar limiter
    // tidak bekerja terus-menerus (dulu: karaoke terpendam lalu dipaksa 1.9×).
    const gAkhir = o.karaoke === "asli" ? "1.9" : "1.3";
    const gLayer = o.karaoke === "asli" ? "2.0" : "1.6";
    if (adaLayer) {
      const lv = (o.layerLevel / 100) * 2;
      baris.push(`[g]volume=${gLayer}[g2]`);
      if (adaNada) {
        const lvN = ((o.nadaLevel ?? 0) / 100) * 2.1;
        baris.push(`[1:a]volume=${lvN.toFixed(3)}[nad]`);
        baris.push(`[2:a]volume=${lv.toFixed(3)}[lay]`);
        baris.push("[g2][nad][lay]amix=inputs=3:duration=first[mix]");
      } else {
        baris.push(`[1:a]volume=${lv.toFixed(3)}[lay]`);
        baris.push("[g2][lay]amix=inputs=2:duration=first[mix]");
      }
    } else if (adaNada) {
      const lvN = ((o.nadaLevel ?? 0) / 100) * 2.1;
      baris.push(`[g]volume=${gAkhir}[g2]`);
      baris.push(`[1:a]volume=${lvN.toFixed(3)}[nad]`);
      baris.push("[g2][nad]amix=inputs=2:duration=first[mix]");
    } else {
      baris.push(`[g]volume=${gAkhir}[mix]`);
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
  return { graf: baris.join(";"), adaLayer, tempo, adaVokal, transpose, adaNada };
}

/** v0.22.0 — GANTI INSTRUMEN (mode "ganti"): graf jalur STEM AI.
 *  Input 0 = vokal stem MDX-Net (penyanyi asli — TIDAK diubah sama sekali),
 *  input 1 = musik stem (tidak dipakai — instrumen asli dibuang), input
 *  `idxAransemen` = WAV aransemen baru khas genre (musikAransemen.ts).
 *  Hasil = penyanyi asli menyanyi di atas band genre baru — cover sejati:
 *  musik asli benar-benar DIGANTI, bukan dilayer. Tanpa transpos/asetrate
 *  (aransemen dibangun pada nada dasar asli — pasti selaras). Karaoke =
 *  aransemen murni (instrumental); vokal-saja = stem vokal utuh. */
export function bangunFilterAudioGantiAi(o: OpsiStudioMusik, idxAransemen = 2): {
  graf: string; adaLayer: boolean; tempo: number; adaVokal: boolean; transpose: number; adaNada: boolean;
} {
  const tempo = o.kecepatan || 1;
  const baris: string[] = [];
  const fmt = (label: string) =>
    `[${label}]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo`;
  const gVokal = ((o.vokalLevel ?? 100) / 100) * 1.35;
  const gIring = ((o.grooveLevel ?? 75) / 100) * 1.9;
  const adaIring = (o.grooveLevel ?? 75) > 0 && o.karaoke !== "vokal";
  const pakaiVokal = o.karaoke !== "karaoke" && (o.vokalLevel ?? 100) > 0;
  const cabangIring = adaIring
    ? `${fmt(`${idxAransemen}:a`)},volume=${gIring.toFixed(3)}[ir]`
    : "";
  if (pakaiVokal && adaIring) {
    baris.push(`${fmt("0:a")},volume=${gVokal.toFixed(3)}[vok]`);
    baris.push(cabangIring);
    baris.push("[vok][ir]amix=inputs=2:duration=first:normalize=0[mix]");
  } else if (adaIring) {
    baris.push(`${cabangIring.replace("[ir]", "[mix]")}`);
  } else {
    // vokal saja (atau semua slider mati — vokal tetap diturunkan)
    baris.push(`${fmt("0:a")},volume=${gVokal.toFixed(3)}[mix]`);
  }
  const at = faktorAtempo(tempo);
  if (at.length) {
    baris.push(`[mix]${at.map((f) => `atempo=${f}`).join(",")}[at]`);
    baris.push("[at]alimiter=limit=0.95[aout]");
  } else {
    baris.push("[mix]alimiter=limit=0.95[aout]");
  }
  return { graf: baris.join(";"), adaLayer: false, tempo, adaVokal: o.karaoke !== "karaoke", transpose: 0, adaNada: false };
}

/** v0.21.0 — VOKALGEN-5 "GANTI-SUARA SATU SUARA": graf pemrosesan di atas STEM AI
 *  (input 0 = vokal stem, input 1 = instrumental stem, keduanya f32 interleave
 *  stereo 44.1k dari mesin MDX-Net Kim Vocal 2). Alur PERSIS usulan user:
 *  karaoke dulu (vokal asli dibuang dari campuran) → suara genre dimasukkan
 *  sebagai PENGGANTI penuh. Bedanya dgn bangunFilterAudio:
 *  · pita suara TIDAK dipotong crossover — stem vokal = vokal MURNI SEMUA
 *    frekuensi → rantai karakter genre mengganti suara PENUH;
 *  · v0.21: LAPISAN PITCH PARALEL DIHAPUS — salinan digeser pitch yang dicampur
 *    balik (v0.20 barisVokalKarakter gv) terdengar sebagai PENYANYI KEDUA
 *    (keluhan "suara penyanyinya ada 2"). Kini hanya ada SATU suara: rantai
 *    karakter tunggal di atas seluruh stem;
 *  · register referensi (dada-dalam/kepala-terang) = geserVokalSemi → digabung
 *    ke transpos yang diterapkan IDENTIK pada kedua stem (asetrate+atempo) →
 *    nada dasar lagu ikut bergeser agar vokal tetap selaras dgn instrumen;
 *  · karaoke = instrumental stem murni (benar-benar tanpa vokal, tanpa geser
 *    register);
 *  · mode "vokal" = stem vokal utuh dgn satu suara baru.
 *  Input harmoni/lapisan memakai indeks 2/3 (atau 2 bila lapisan saja).
 *  Label keluar [aout]. */
export function bangunFilterAudioAi(o: OpsiStudioMusik): {
  graf: string; adaLayer: boolean; tempo: number; adaVokal: boolean; transpose: number; adaNada: boolean;
} {
  const resep = o.genre === "asli" ? null : RESEP_GENRE[o.genre];
  const tempoResep = resep ? resep.tempo : 1;
  const tempo = tempoResep * (o.kecepatan || 1);
  const remake = o.mode === "remake";
  const baris: string[] = [];
  // v0.21.0 — register referensi genre vokal (dada-dalam/kepala-terang) digabung
  // ke transpos: KEDUA stem bergeser sama → satu nada dasar baru yg selaras.
  // Karaoke tidak membangun vokal → register tidak ikut (instrumental apa adanya).
  const fxVokalAktif0 =
    !!o.genreVokal && o.genreVokal !== "mati" && DAFTAR_GENRE.includes(o.genreVokal)
    && (o.tingkatVokal ?? 55) > 0;
  const geserRegister = o.karaoke !== "karaoke" && fxVokalAktif0
    && !!o.genreVokal && o.genreVokal !== "mati"
    ? geserVokalSemi(o.genreVokal, o.refVokal, o.tingkatVokal ?? 55)
    : 0;
  const transpose = Math.min(7, Math.max(-7, Math.round(o.transpose ?? 0) + geserRegister));
  // siapkan stem — transpos identik supaya pitch vokal & musik tak mungkin beda
  const prep = (inL: string, outL: string): string => {
    if (transpose !== 0) {
      const rasio = Math.pow(2, transpose / 12);
      return `[${inL}]asetrate=${Math.round(44100 * rasio)},aresample=44100,aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,atempo=${Math.pow(2, -transpose / 12).toFixed(5)}[${outL}]`;
    }
    return `[${inL}]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo[${outL}]`;
  };
  const fxVokalAktif = fxVokalAktif0;
  const rantaiVokalAi = (): string[] => {
    // v0.21.0 — stem vokal utuh → SATU rantai karakter genre (TANPA lapisan pitch
    // paralel — itulah penyebab "2 penyanyi"; register kini lewat transpos prep).
    // Gain 0.9: stem bersih, kompensasi hilangnya lapisan (dulu 0.85 + lapisan).
    if (fxVokalAktif && o.genreVokal !== "mati") {
      const fxV = rantaiVokal(o.genreVokal, o.refVokal, o.tingkatVokal ?? 55).join(",");
      if (fxV) return [`[vok0]${fxV},volume=0.9[voc1]`];
    }
    return ["[vok0]anull[voc1]"];
  };
  if (o.karaoke === "karaoke") {
    // KARAOKE: hanya instrumental — vokal stem tidak dibangun sama sekali
    // (semua label filter wajib terpakai; input tak terpakai pun tak di-dekode)
    baris.push(prep("1:a", "ins0"));
    baris.push("[ins0]anull[ksrc]");
  } else if (o.karaoke === "vokal") {
    // VOKAL SAJA: stem vokal utuh semua frekuensi, instrumental tak dibangun
    baris.push(prep("0:a", "vok0"));
    baris.push(...rantaiVokalAi());
    baris.push("[voc1]anull[ksrc]");
  } else {
    // ASLI: remix instrumental + vokal berkarakter
    baris.push(prep("0:a", "vok0"), prep("1:a", "ins0"));
    baris.push(...rantaiVokalAi());
    baris.push("[ins0][voc1]amix=inputs=2:duration=first:normalize=0[ksrc]");
  }
  // ---- ujung rantai IDENTIK dgn jalur lama: warna genre + remix perubahan ----
  const warna = remake && o.genre !== "asli"
    ? rantaiWarna(o.genre, o.tingkatGenre ?? 55, (o.bpm || 120) * tempo)
    : [];
  const rantai = remake
    ? (warna.join(",") || "anull")
    : resep ? resep.rantai.join(",") : "anull";
  const perubahan = remake && o.genre !== "asli"
    ? Math.min(100, Math.max(0, Number(o.tingkatMusik ?? 65))) / 100
    : 1;
  if (remake && warna.length && perubahan <= 0.005) {
    baris.push("[ksrc]anull[g]");
  } else if (remake && warna.length && perubahan < 0.995) {
    const wAsli = (1 - perubahan).toFixed(3);
    const wGaya = perubahan.toFixed(3);
    baris.push(
      "[ksrc]asplit=2[blA][blB]",
      `[blA]volume=${wAsli}[blAsli]`,
      `[blB]volume=${wGaya}[blGaya0]`,
      `[blGaya0]${rantai}[blGaya]`,
      "[blAsli][blGaya]amix=inputs=2:duration=first:normalize=0[g]",
    );
  } else {
    baris.push(`[ksrc]${rantai}[g]`);
  }
  const adaLayer = !!resep && o.layerLevel > 0 && !!resep.layer;
  const adaNada = remake && o.genre !== "asli" && (o.nadaLevel ?? 0) > 0;
  const idxNad = 2; // input harmoni selalu 2 (0=vokal, 1=musik)
  const idxLay = adaNada ? 3 : 2; // lapisan ritme menyusul harmoni bila ada
  const gAkhir = o.karaoke === "asli" ? "1.9" : "1.3";
  const gLayer = o.karaoke === "asli" ? "2.0" : "1.6";
  if (adaLayer) {
    const lv = (o.layerLevel / 100) * 2;
    baris.push(`[g]volume=${gLayer}[g2]`);
    if (adaNada) {
      const lvN = ((o.nadaLevel ?? 30) / 100) * 2.1;
      baris.push(`[${idxNad}:a]volume=${lvN.toFixed(3)}[nad]`);
      baris.push(`[${idxLay}:a]volume=${lv.toFixed(3)}[lay]`);
      baris.push("[g2][nad][lay]amix=inputs=3:duration=first[mix]");
    } else {
      baris.push(`[${idxLay}:a]volume=${lv.toFixed(3)}[lay]`);
      baris.push("[g2][lay]amix=inputs=2:duration=first[mix]");
    }
  } else if (adaNada) {
    const lvN = ((o.nadaLevel ?? 30) / 100) * 2.1;
    baris.push(`[g]volume=${gAkhir}[g2]`);
    baris.push(`[${idxNad}:a]volume=${lvN.toFixed(3)}[nad]`);
    baris.push("[g2][nad]amix=inputs=2:duration=first[mix]");
  } else {
    baris.push(`[g]volume=${gAkhir}[mix]`);
  }
  const at = faktorAtempo(tempo);
  if (at.length) {
    baris.push(`[mix]${at.map((f) => `atempo=${f}`).join(",")}[at]`);
    baris.push("[at]alimiter=limit=0.95[aout]");
  } else {
    baris.push("[mix]alimiter=limit=0.95[aout]");
  }
  return { graf: baris.join(";"), adaLayer, tempo, adaVokal: o.karaoke !== "karaoke", transpose, adaNada };
}

/** v0.24.0 — VOKALGEN-6 "AI GENDER REALISTIS": graf campuran di atas stem yang
 *  SUDAH diproses rubberband terpisah (musikJobs menjalankan rantaiGenderVokal/
 *  rantaiGenderMusik pada berkas f32 stem sebelum graf ini). Karena pitch & formant
 *  sudah terbakar di stem:
 *  · TIDAK ada asetrate/atempo transpos di kedua stem (input 0 = vokal gender,
 *    input 1 = musik gender) — durasi & sinkron dijaga di tahap stem;
 *  · input 2 (harmoni/nada akor — dibangun di nada dasar ASLI) DITRANSPOS di graf
 *    via asetrate+atempo rasio P_total agar ikut nada dasar baru;
 *  · rantai karakter genre (rantaiVokal) tetap jalan di atas vokal gender
 *    (feminisasi timbre v0.23 dsb.);
 *  · karaoke = instrumental apa adanya (tanpa geser register — instrumen murni);
 *  · lapisan ritme (input 3) sudah di-generate mengikuti nada dasar baru.
 *  geser = hasil genderGen; pTotal = geser.st + transposEfe (untuk nada akor). */
export function bangunFilterAudioAiGen(
  o: OpsiStudioMusik,
  geser: { st: number; formant: number },
  pTotal = 0,
): { graf: string; adaLayer: boolean; tempo: number; adaVokal: boolean; transpose: number; adaNada: boolean } {
  const resep = o.genre === "asli" ? null : RESEP_GENRE[o.genre];
  const tempoResep = resep ? resep.tempo : 1;
  const tempo = tempoResep * (o.kecepatan || 1);
  const remake = o.mode === "remake";
  const baris: string[] = [];
  const fmt = (inL: string, outL: string) =>
    `[${inL}]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo[${outL}]`;
  const fxVokalAktif =
    !!o.genreVokal && o.genreVokal !== "mati" && DAFTAR_GENRE.includes(o.genreVokal)
    && (o.tingkatVokal ?? 55) > 0;
  const rantaiVokalGen = (): string[] => {
    if (fxVokalAktif && o.genreVokal !== "mati") {
      const fxV = rantaiVokal(o.genreVokal, o.refVokal, o.tingkatVokal ?? 55).join(",");
      if (fxV) return [`[vok0]${fxV},volume=0.9[voc1]`];
    }
    return ["[vok0]anull[voc1]"];
  };
  if (o.karaoke === "karaoke") {
    // KARAOKE: instrumental murni — stem gender tidak dibangun
    baris.push(fmt("1:a", "ksrc"));
  } else if (o.karaoke === "vokal") {
    // VOKAL SAJA: stem vokal gender + karakter genre
    baris.push(fmt("0:a", "vok0"));
    baris.push(...rantaiVokalGen());
    baris.push("[voc1]anull[ksrc]");
  } else {
    // ASLI: remix instrumental gender + vokal gender berkarakter
    baris.push(fmt("0:a", "vok0"), fmt("1:a", "ins0"));
    baris.push(...rantaiVokalGen());
    baris.push("[ins0][voc1]amix=inputs=2:duration=first:normalize=0[ksrc]");
  }
  // ---- ujung rantai identik dgn jalur AI lawas: warna genre + remix perubahan ----
  const warna = remake && o.genre !== "asli"
    ? rantaiWarna(o.genre, o.tingkatGenre ?? 55, (o.bpm || 120) * tempo)
    : [];
  const rantai = remake
    ? (warna.join(",") || "anull")
    : resep ? resep.rantai.join(",") : "anull";
  const perubahan = remake && o.genre !== "asli"
    ? Math.min(100, Math.max(0, Number(o.tingkatMusik ?? 65))) / 100
    : 1;
  if (remake && warna.length && perubahan <= 0.005) {
    baris.push("[ksrc]anull[g]");
  } else if (remake && warna.length && perubahan < 0.995) {
    const wAsli = (1 - perubahan).toFixed(3);
    const wGaya = perubahan.toFixed(3);
    baris.push(
      "[ksrc]asplit=2[blA][blB]",
      `[blA]volume=${wAsli}[blAsli]`,
      `[blB]volume=${wGaya}[blGaya0]`,
      `[blGaya0]${rantai}[blGaya]`,
      "[blAsli][blGaya]amix=inputs=2:duration=first:normalize=0[g]",
    );
  } else {
    baris.push(`[ksrc]${rantai}[g]`);
  }
  const adaLayer = !!resep && o.layerLevel > 0 && !!resep.layer;
  const adaNada = remake && o.genre !== "asli" && (o.nadaLevel ?? 0) > 0;
  const idxNad = 2; // 0 = vokal gender, 1 = musik gender
  const idxLay = adaNada ? 3 : 2;
  const gAkhir = o.karaoke === "asli" ? "1.9" : "1.3";
  const gLayer = o.karaoke === "asli" ? "2.0" : "1.6";
  if (adaLayer) {
    const lv = (o.layerLevel / 100) * 2;
    baris.push(`[g]volume=${gLayer}[g2]`);
    if (adaNada) {
      const lvN = ((o.nadaLevel ?? 30) / 100) * 2.1;
      // harmoni dibangun di nada dasar ASLI → ikut transpos di graf (asetrate+atempo)
      if (Math.abs(pTotal) > 0.001) {
        const rasio = Math.pow(2, pTotal / 12);
        baris.push(`[${idxNad}:a]asetrate=${Math.round(44100 * rasio)},aresample=44100,atempo=${Math.pow(2, -pTotal / 12).toFixed(5)},volume=${lvN.toFixed(3)}[nad]`);
      } else {
        baris.push(`[${idxNad}:a]volume=${lvN.toFixed(3)}[nad]`);
      }
      baris.push(`[${idxLay}:a]volume=${lv.toFixed(3)}[lay]`);
      baris.push("[g2][nad][lay]amix=inputs=3:duration=first[mix]");
    } else {
      baris.push(`[${idxLay}:a]volume=${lv.toFixed(3)}[lay]`);
      baris.push("[g2][lay]amix=inputs=2:duration=first[mix]");
    }
  } else if (adaNada) {
    const lvN = ((o.nadaLevel ?? 30) / 100) * 2.1;
    baris.push(`[g]volume=${gAkhir}[g2]`);
    if (Math.abs(pTotal) > 0.001) {
      const rasio = Math.pow(2, pTotal / 12);
      baris.push(`[${idxNad}:a]asetrate=${Math.round(44100 * rasio)},aresample=44100,atempo=${Math.pow(2, -pTotal / 12).toFixed(5)},volume=${lvN.toFixed(3)}[nad]`);
    } else {
      baris.push(`[${idxNad}:a]volume=${lvN.toFixed(3)}[nad]`);
    }
    baris.push("[g2][nad]amix=inputs=2:duration=first[mix]");
  } else {
    baris.push(`[g]volume=${gAkhir}[mix]`);
  }
  const at = faktorAtempo(tempo);
  if (at.length) {
    baris.push(`[mix]${at.map((f) => `atempo=${f}`).join(",")}[at]`);
    baris.push("[at]alimiter=limit=0.95[aout]");
  } else {
    baris.push("[mix]alimiter=limit=0.95[aout]");
  }
  return { graf: baris.join(";"), adaLayer, tempo, adaVokal: o.karaoke !== "karaoke", transpose: 0, adaNada };
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
  /** v0.15.0 — ukuran teks overlay (judul/chord/lirik), skala 12–60, bawaan 25.
   *  Di-referensikan ke sisi-pendek 1080 px: cocok utk 9:16 maupun 16:9. */
  ukuranTeks: number;
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
  ukuranTeks: 25,
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

/** v0.17.1 — "0xrrggbb" → opsi warna avectorscope (rc/gc/bc kontras per-kanal + fade netral).
 * avectorscope TIDAK punya opsi `colors` (itu milik showwaves/showfreqs) — pakai rc/gc/bc. */
export function vektorWarna(hex: string): string {
  const m = /^0x([0-9a-fA-F]{6})$/.exec(hex.trim());
  const n = m ? parseInt(m[1], 16) : 0x22d3ee;
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return `rc=${r}:gc=${g}:bc=${b}:rf=5:gf=5:bf=5`;
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
      return `[av]showspectrum=s=${W}x${H}:mode=combined:slide=scroll:color=fire:scale=log:win_func=hann:fps=${fps}[viz]`;
    case "spektrum-pelangi":
      return `[av]showspectrum=s=${W}x${H}:mode=combined:slide=scroll:color=rainbow:scale=sqrt:win_func=hann:fps=${fps}[viz]`;
    case "spektrum-magnet":
      return `[av]showspectrum=s=${W}x${H}:mode=combined:slide=scroll:color=intensity:scale=cbrt:win_func=hann:fps=${fps},hue=h=195:s=1.9[viz]`;
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
        `[av]avectorscope=s=${s}x${s}:zoom=1.6:draw=dot:scale=cbrt:${vektorWarna(w1)}:rate=${fps}[sc]`,
        pusat("sc")].join(";");
    }
    case "vektor-neon": {
      const s = genap(Math.min(W, H) * 0.92);
      return [bgPilih(),
        `[av]avectorscope=s=${s}x${s}:zoom=2.1:draw=dot:scale=log:${vektorWarna(w2)}:rate=${fps}[sc]`,
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
        `[sa]showspectrum=s=${hw}x${H}:mode=combined:slide=scroll:color=fire:scale=log:win_func=hann:fps=${fps}[sp]`,
        `[va2]avectorscope=s=${hw}x${H}:zoom=1.5:scale=cbrt:${vektorWarna(w1)}:rate=${fps}[vec]`,
        "[sp][vec]hstack=inputs=2[viz]",
      ].join(";");
    }
    case "radar-berdenyut": {
      const s = genap(Math.min(W, H) * 0.94);
      return [bgPilih(),
        `[av]avectorscope=s=${s}x${s}:zoom=3.1:draw=line:scale=log:${vektorWarna(w2)}:rate=${fps},hue=s=1.4[sc]`,
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

/** Bangun isi berkas .ass overlay: judul (atas), chord (di atas lirik), lirik (bawah).
 *  v0.15.0 — ukuran teks dikendalikan vis.ukuranTeks (bawaan 25, 12–60), di-referensikan
 *  ke sisi PENDEK frame = 1080 px, sehingga 9:16 (1080×1920) dan 16:9 sama proporsinya;
 *  margin vertikal mengikuti tinggi frame → chord & lirik tetap rapi di video vertikal. */
export function bangunAss(opsi: {
  w: number; h: number; durasi: number; vis: OpsiVisual;
  lirik: BarisLirik[]; chord: SegmenChord[];
}): string {
  const { w, h, durasi, vis, lirik, chord } = opsi;
  const skala = Math.min(w, h) / 1080;
  const ut = Math.min(60, Math.max(12, Math.round(Number(vis.ukuranTeks) || 25)));
  const fsJudul = Math.max(20, Math.round(ut * 2.6 * skala));
  const fsChord = Math.max(16, Math.round(ut * 2.2 * skala));
  const fsLirik = Math.max(14, Math.round(ut * 1.9 * skala));
  const fam = FONT_ASS[vis.fontJudul] || "DejaVu Sans";
  const mvLirik = Math.round(h * 0.055);
  const mvChord = Math.round(h * 0.13);
  const mvJudul = Math.round(h * 0.045);
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
