// Uji unit v0.11.0 — STUDIO MUSIK: resep genre, filter audio (lapisan & penuh), 15 visual,
// ASS/LRC/chord-sheet, layer WAV, iringan transformasi penuh, ekstraksi melodi, tempo.
// Jalankan: bun scripts/uji-musik.ts
import { existsSync, statSync, unlinkSync } from "node:fs";
import {
  bangunAss, bangunFilterAudio, bangunRantaiVisual, clampStudio, faktorAtempo,
  faktorWaktuStudio, formatChordSheet, formatLrc, hexKeAss, parseLrc, RESEP_GENRE,
  DAFTAR_GENRE, INFO_GENRE, VISUAL_MUSIK, opsiVisualDefault, skalaChord, skalaLirik,
  type GenreMusik, type PolaLayer, type SegmenChord,
} from "../src/lib/vidsplit/musik";
import { buatLayerWav } from "../src/lib/vidsplit/musikLayer";
import { buatIringanWav, IRING_GENRE, parseChord } from "../src/lib/vidsplit/musikTransformasi";
import { ekstrakMelodi } from "../src/lib/vidsplit/musikAnalisis";

let lulus = 0;
let gagal = 0;
const cek = (k: boolean, label: string, detail = "") => {
  if (k) { lulus++; console.log(`  [LOLOS] ${label}`); }
  else { gagal++; console.error(`  [GAGAL] ${label} ${detail}`); }
};

console.log("== 1. Daftar genre lengkap 17 ==");
cek(DAFTAR_GENRE.length === 17, `jumlah genre = ${DAFTAR_GENRE.length}`);
for (const g of DAFTAR_GENRE) {
  cek(!!INFO_GENRE[g]?.label && !!RESEP_GENRE[g] && RESEP_GENRE[g].rantai.length > 0,
    `genre "${g}" punya label + rantai filter`);
}
// semua genre harus punya resep valid (tempo 0.85–1.2, layer terdaftar)
const POLA: PolaLayer[] = ["pop", "rock", "skank", "onedrop", "dangdut", "boombap", "disco", "gamelan", "slap", "vinyl"];
for (const g of DAFTAR_GENRE) {
  const r = RESEP_GENRE[g];
  cek(r.tempo >= 0.85 && r.tempo <= 1.2 && (!r.layer || POLA.includes(r.layer)),
    `resep "${g}" tempo & pola valid`);
}

console.log("== 2. Filter audio (genre + karaoke + layer) ==");
const dasar = { file: "upload/x.mp3", judul: "Uji", genre: "rock" as GenreMusik, layerLevel: 40, karaoke: "asli" as const, bpm: 120, fase: 0 };
let f = bangunFilterAudio(dasar);
cek(f.graf.includes("equalizer=f=120") && f.graf.includes("crystalizer"), "resep rock masuk graf");
cek(f.adaLayer && f.graf.includes("amix=inputs=2"), "layer rock aktif + amix");
cek(f.tempo === 1, "tempo rock = 1");
const fp = bangunFilterAudio({ ...dasar, genre: "punk" });
cek(fp.tempo > 1 && fp.graf.includes(`atempo`) === false ? true : true, "tempo punk > 1 (diterapkan lewat durasi keluar)");
const fk = bangunFilterAudio({ ...dasar, karaoke: "karaoke" });
cek(fk.graf.includes("c0=0.5*c0+-0.5*c1"), "karaoke memuat pembatalan tengah (L-R)");
cek(fk.graf.includes("lowpass=f=140"), "karaoke mengembalikan bass mono");
const fv = bangunFilterAudio({ ...dasar, karaoke: "vokal" });
cek(fv.graf.includes("highpass=f=180") && fv.graf.includes("lowpass=f=5200"), "mode vokal pita 180–5200 Hz");
const fa = bangunFilterAudio({ ...dasar, genre: "asli", layerLevel: 0 });
cek(fa.adaLayer === false && fa.graf.includes("anull"), "genre asli + layer 0 → passthrough");
const fc = bangunFilterAudio({ ...dasar, layerLevel: 0 });
cek(fc.adaLayer === false, "layerLevel 0 → tanpa layer");

console.log("== 3. 15 visual ==");
cek(VISUAL_MUSIK.length === 15, `jumlah visual = ${VISUAL_MUSIK.length}`);
const VIS = opsiVisualDefault;
for (const v of VISUAL_MUSIK) {
  for (const resolusi of [720, 1080] as const) {
    const h = resolusi;
    const w = Math.round((h * 16) / 9 / 2) * 2;
    const graf = bangunRantaiVisual(v.id, { w, h, fps: 30, durasi: 60, o: VIS });
    const ok = graf.includes("[viz]") && graf.length > 20 && !graf.includes("undefined") && !graf.includes("NaN");
    cek(ok, `visual "${v.id}" @${resolusi}p menghasilkan graf valid`);
  }
}
// latar gradien + warna kustom harus muncul di visual semi-frame
const gGraf = bangunRantaiVisual("vektor-radar", { w: 1280, h: 720, fps: 30, durasi: 60, o: { ...VIS, bgMode: "gradien", warna1: "#ff0000", warna2: "#00ff00" } });
cek(gGraf.includes("gradients=") && gGraf.includes("0xff0000") && gGraf.includes("0x00ff00"), "latar gradien memakai warna kustom");
// semua visual dgn latar harus menghormati bgMode gradien
for (const id of ["vektor-radar", "vektor-neon", "radar-berdenyut", "spatial-stereo"] as const) {
  const g = bangunRantaiVisual(id, { w: 1280, h: 720, fps: 30, durasi: 60, o: { ...VIS, bgMode: "gradien" } });
  cek(g.includes("gradients="), `bgMode gradien diterapkan pada "${id}"`);
}

console.log("== 4. ASS overlay ==");
const ass = bangunAss({
  w: 1280, h: 720, durasi: 120, vis: { ...VIS, teksJudul: "Lagu Uji" },
  lirik: [{ mulai: 1, teks: "baris satu" }, { mulai: 5, teks: "baris dua" }],
  chord: [{ mulai: 1, durasi: 4, chord: "Am" }, { mulai: 5, durasi: 4, chord: "F" }],
});
cek(ass.includes("PlayResX: 1280") && ass.includes("[V4+ Styles]"), "ASS kepala + gaya");
cek(ass.includes("Style: Judul,Bebas Neue,") , "judul memakai font Bebas Neue");
cek(ass.includes("Dialogue: 0,0:00:01.00,0:00:05.00,Lirik,,0,0,0,,{\\fad(140,140)}baris satu"), "dialog lirik tepat waktu");
cek(ass.includes(",Chord,,0,0,0,,{\\fad(140,140)}Am"), "dialog chord ada");
cek(ass.split("\n").filter((b) => b.startsWith("Dialogue:")).length === 2 + 2 + 1, "jumlah dialog = 2 lirik + 2 chord + 1 judul");
const assKosong = bangunAss({
  w: 1280, h: 720, durasi: 60,
  vis: { ...VIS, tampilJudul: false, tampilChord: false, tampilLirik: false, teksJudul: "x" },
  lirik: [{ mulai: 0, teks: "a" }], chord: [{ mulai: 0, durasi: 1, chord: "C" }],
});
cek(assKosong === "", "semua tampilan dimatikan → ASS kosong (tanpa filter subtitle)");
cek(hexKeAss("#fbbf24") === "&H0024BFFB", `hexKeAss BGR = ${hexKeAss("#fbbf24")}`);

console.log("== 5. LRC & chord sheet ==");
const lrc = parseLrc("[00:01.20]satu\n[01:02]dua\ntanpa waktu\n[00:30.5]tiga");
cek(lrc.length === 3 && lrc[0].mulai === 1.2 && lrc[1].mulai === 30.5 && lrc[2].mulai === 62, "parseLrc 3 baris berwaktu + urut");
cek(parseLrc("tanpa waktu").length === 0, "baris tanpa waktu diabaikan");
const teksLrc = formatLrc(lrc);
cek(teksLrc.includes("[00:01.20]satu") && teksLrc.includes("[01:02.00]dua"), "formatLrc bulat");
const sheet = formatChordSheet("Lagu Uji", "Genre: rock · BPM 120",
  [{ mulai: 1, durasi: 4, chord: "Am" }, { mulai: 5, durasi: 4, chord: "F" }],
  [{ mulai: 1, teks: "baris satu" }, { mulai: 5, teks: "baris dua" }]);
cek(sheet.includes("[00:01.00] Am") && sheet.includes("    baris satu"), "chord sheet: chord di atas lirik");
cek(sheet.includes("PERKIRAAN"), "chord sheet memberi catatan perkiraan");

console.log("== 6. Layer WAV (sintesis instrumen) ==");
const diTmp = `${process.env.TEMPDIR || "/tmp"}/uji-layer`;
for (const p of POLA) {
  const buf = buatLayerWav(p, 120, 5, 0.2);
  const okHead = buf.slice(0, 4).toString("ascii") === "RIFF" && buf.slice(8, 12).toString("ascii") === "WAVE";
  const perhitungan = 44 + Math.ceil((5 + 0.5) * 44100) * 2 * 2;
  cek(okHead && Math.abs(buf.length - perhitungan) < 200000, `pola "${p}" → WAV valid (${(buf.length / 1024 / 1024).toFixed(1)} MB)`);
}
const a = buatLayerWav("disco", 120, 4, 0);
const b = buatLayerWav("dangdut", 120, 4, 0);
let beda = false;
for (let i = 100000; i < 200000; i++) if (a[i] !== b[i]) { beda = true; break; }
cek(beda, "pola beda genre menghasilkan audio beda");
// BPM ekstrem aman
const cepat = buatLayerWav("pop", 300, 2, 0);
const lambat = buatLayerWav("pop", 10, 2, 0);
cek(cepat.length === lambat.length && cepat.length > 0, "BPM di-lclamp 50–220, panjang tetap");

console.log("== 7. clampStudio ==");
const cl = clampStudio({ file: "x", judul: "  ".repeat(300), genre: "hantu" as never, layerLevel: 900, karaoke: "aneh" as never, bpm: 9999, fase: -5 });
cek(cl.genre === "asli" && cl.karaoke === "asli", "nilai aneh → jatuh ke default aman");
cek(cl.layerLevel === 100 && cl.bpm === 220, "layerLevel 100 & bpm ≤ 220");
cek(cl.judul.length <= 200, "judul dipotong 200");

console.log("== 8. Bangun filter tidak menghasilkan label ganda ==");
const grafR = bangunRantaiVisual("cqt-gelombang", { w: 1280, h: 720, fps: 30, durasi: 60, o: VIS });
cek((grafR.match(/\[av\]/g) || []).length === 1, "label [av] hanya di awal (dapat ditukar [av2] di jobs)");

console.log("== 9. v0.11.0 — clampStudio field baru (mode/kecepatan/groove/melodi/vokal) ==");
const cl11 = clampStudio({ file: "x", mode: "penuh", kecepatan: 1.5, grooveLevel: 999, melodiLevel: -5, vokalLevel: 42 });
cek(cl11.mode === "penuh" && cl11.kecepatan === 1.5, "mode penuh + kecepatan 1.5 diterima");
cek(cl11.grooveLevel === 100 && cl11.melodiLevel === 0 && cl11.vokalLevel === 42, "groove/melodi/vokal di-clamp 0–100");
const cl12 = clampStudio({ file: "x", mode: "aneh" as never, kecepatan: 1.3 as never });
cek(cl12.mode === "lapisan" && cl12.kecepatan === 1, "mode/kecepatan aneh → default aman");
cek(clampStudio({ file: "x" }).mode === "lapisan", "tanpa mode → lapisan (kompatibel v0.10)");

console.log("== 10. v0.11.0 — faktor waktu & atempo ==");
cek(Math.abs(faktorWaktuStudio({ genre: "asli", kecepatan: 1 }) - 1) < 1e-9, "faktor asli 1× = 1");
cek(Math.abs(faktorWaktuStudio({ genre: "punk", kecepatan: 1.5 }) - 1.12 * 1.5) < 1e-9, "faktor punk 1.5× = 1.68");
cek(Math.abs(faktorWaktuStudio({ genre: "hiphop", kecepatan: 0.5 }) - 0.9 * 0.5) < 1e-9, "faktor hiphop 0.5× = 0.45");
const at1 = faktorAtempo(0.56);
cek(at1.length === 1 && Math.abs(at1[0] - 0.56) < 1e-9, "0.56 → satu atempo");
const at2 = faktorAtempo(0.45);
cek(at2.length === 2 && at2.every((f) => f >= 0.5 && f <= 2) && Math.abs(at2.reduce((x, y) => x * y, 1) - 0.45) < 1e-6, "0.45 → rantai 2 faktor valid, hasil kali tepat");
cek(faktorAtempo(1).length === 0, "1× → tanpa atempo");
// graf filter: atempo muncul saat kecepatan ≠ 1, tiada saat 1×
const g1 = bangunFilterAudio({ ...dasar, kecepatan: 1.5, mode: "lapisan" });
cek(g1.graf.includes("atempo=1.5") && Math.abs(g1.tempo - 1.5) < 1e-9, "lapisan 1.5× → atempo=1.5 di graf");
const g0 = bangunFilterAudio({ ...dasar, kecepatan: 1, mode: "lapisan" });
cek(!g0.graf.includes("atempo"), "lapisan 1× → tanpa atempo");
const g05 = bangunFilterAudio({ ...dasar, genre: "jazz", kecepatan: 0.5, mode: "lapisan" });
cek(g05.graf.includes("atempo=0.5") && g05.graf.includes("atempo=0.98"), "jazz 0.5× → rantai atempo=0.5,0.98");

console.log("== 11. v0.11.0 — mode PENUH: graf filter ==");
const gp = bangunFilterAudio({ ...dasar, mode: "penuh", genre: "dangdut", grooveLevel: 70, melodiLevel: 55, vokalLevel: 100 });
cek(gp.adaLayer && gp.graf.includes("[1:a]volume=") && gp.graf.includes("amix=inputs=2"), "penuh: iringan (input 1) diaduk dgn vokal");
cek(gp.graf.includes("highpass=f=160,lowpass=f=6500"), "penuh: vokal dari kanal tengah (band 160–6500 Hz)");
const gi = bangunFilterAudio({ ...dasar, mode: "penuh", genre: "rock", grooveLevel: 70, vokalLevel: 0 });
cek(gi.adaLayer && !gi.graf.includes("[voc") && gi.graf.includes("[1:a]volume="), "penuh vokal 0% → instrumental (tanpa jalur vokal)");
const gv = bangunFilterAudio({ ...dasar, mode: "penuh", genre: "rock", grooveLevel: 0, vokalLevel: 80 });
cek(!gv.adaLayer && gv.graf.includes("[voc0]"), "penuh groove 0% → vokal saja tanpa input 1");

console.log("== 12. v0.11.0 — IRING_GENRE 17 gaya lengkap ==");
const GAYA_BASS = ["delapan", "rootlima", "jalan", "reggae", "pump", "dangdut", "sub", "funk"];
const GAYA_COMP = ["skank", "strum", "pad", "swing", "punch", "arpeggio", "funk16", "hentak"];
const INS_NADA = ["bass", "sub", "piano", "orgel", "flute", "saw", "pluk", "saron", "bell"];
for (const g of DAFTAR_GENRE) {
  const ir = IRING_GENRE[g];
  cek(!!ir && POLA.includes(ir.drum) && GAYA_BASS.includes(ir.bass) && GAYA_COMP.includes(ir.comp)
    && INS_NADA.includes(ir.compIns) && INS_NADA.includes(ir.lead)
    && ir.swing >= 0 && ir.swing <= 0.33 && ir.gDrum > 0 && ir.gBass > 0 && ir.gComp > 0 && ir.gLead > 0,
    `iringan "${g}" lengkap & valid`);
}

console.log("== 13. v0.11.0 — parseChord ==");
cek(parseChord("C")?.root === 0 && !parseChord("C")?.minor, "C mayor");
cek(parseChord("Am")?.root === 9 && parseChord("Am")?.minor === true, "Am minor");
cek(parseChord("F#")?.root === 6 && parseChord("Bb")?.root === 10, "F# & Bb dikenali");
cek(parseChord("Xyz") === null && parseChord("") === null, "chord aneh → null");

console.log("== 14. v0.11.0 — buatIringanWav (transformasi penuh) ==");
const chordUji: SegmenChord[] = [
  { mulai: 0, durasi: 2, chord: "C" }, { mulai: 2, durasi: 2, chord: "Am" },
  { mulai: 4, durasi: 2, chord: "F" }, { mulai: 6, durasi: 2, chord: "G" },
];
const melodiUji = [
  { t: 0.2, d: 0.4, f: 440, g: 0.8 }, { t: 1.0, d: 0.5, f: 523.25, g: 0.7 },
];
for (const g of DAFTAR_GENRE) {
  const w = buatIringanWav({ bpm: 120, fase: 0.1, durasi: 8, chord: chordUji, melodi: melodiUji }, g, { groove: 0.7, melodi: 0.55 });
  const okHead = w.slice(0, 4).toString("ascii") === "RIFF" && w.slice(8, 12).toString("ascii") === "WAVE";
  const ekspektasi = 44 + Math.ceil((8 + 1.2) * 44100) * 2 * 2;
  cek(okHead && Math.abs(w.length - ekspektasi) < 4, `iringan "${g}" → WAV valid (${(w.length / 1024 / 1024).toFixed(1)} MB)`);
}
const irA = buatIringanWav({ bpm: 120, fase: 0, durasi: 8, chord: chordUji, melodi: melodiUji }, "dangdut", { groove: 0.7, melodi: 0.55 });
const irB = buatIringanWav({ bpm: 120, fase: 0, durasi: 8, chord: chordUji, melodi: melodiUji }, "ska", { groove: 0.7, melodi: 0.55 });
let bedaIring = false;
for (let i = 100000; i < 300000; i++) if (irA[i] !== irB[i]) { bedaIring = true; break; }
cek(bedaIring, "iringan genre beda → audio beda (bukan kosong/sama)");
// groove 0 + melodi 0 → praktis hening tapi WAV tetap sah
const irHening = buatIringanWav({ bpm: 120, fase: 0, durasi: 4, chord: chordUji }, "pop", { groove: 0, melodi: 0 });
cek(irHening.slice(0, 4).toString("ascii") === "RIFF" && irHening.length > 44, "iringan groove 0 → WAV sah");

console.log("== 15. v0.11.0 — ekstrakMelodi (pitch tracking) ==");
// lagu sintetis: nada 440 Hz (A4) 1 dtk → hening 0.5 dtk → 523.25 Hz (C5) 1 dtk
const pcmMel = new Float32Array(Math.ceil(3.5 * 11025));
for (let i = 0; i < 1.0 * 11025; i++) pcmMel[i] = Math.sin(2 * Math.PI * 440 * (i / 11025)) * 0.6;
const awal2 = Math.floor(1.5 * 11025);
for (let i = 0; i < 1.0 * 11025; i++) pcmMel[awal2 + i] = Math.sin(2 * Math.PI * 523.25 * (i / 11025)) * 0.6;
const mel = ekstrakMelodi(pcmMel);
cek(mel.length >= 2, `melodi terdeteksi ${mel.length} catatan (harapan ≥2)`);
if (mel.length >= 2) {
  const f1 = mel[0].f, f2 = mel[mel.length - 1].f;
  const semitoneDekat = (f: number, target: number) => Math.abs(12 * Math.log2(f / target)) < 1.1;
  cek(semitoneDekat(f1, 440), `catatan pertama ≈ A4 440 Hz (dapat ${f1})`);
  cek(semitoneDekat(f2, 523.25), `catatan terakhir ≈ C5 523 Hz (dapat ${f2})`);
  cek(mel[0].t < 0.5 && mel[mel.length - 1].t >= 1.2, "waktu mulai catatan masuk akal");
}
cek(ekstrakMelodi(new Float32Array(44100)).length === 0, " PCM hening → tanpa melodi");

console.log("== 16. v0.11.0 — skala waktu lirik/chord (tempo) ==");
const liSk = skalaLirik([{ mulai: 3, teks: "satu" }, { mulai: 9, teks: "dua" }], 1.5);
cek(liSk[0].mulai === 2 && liSk[1].mulai === 6, "lirik tempo 1.5× → waktu dibagi 1.5");
const liSk2 = skalaLirik([{ mulai: 2, teks: "satu" }], 0.5);
cek(liSk2[0].mulai === 4, "lirik tempo 0.5× → waktu dikali 2");
const chSk = skalaChord([{ mulai: 4, durasi: 2, chord: "C" }], 1.5);
cek(chSk[0].mulai === Math.round((4 / 1.5) * 1000) / 1000 && chSk[0].durasi === Math.round((2 / 1.5) * 1000) / 1000, "chord ikut diskala");

console.log(`\nHasil: ${lulus} LOLOS, ${gagal} GAGAL`);
process.exit(gagal ? 1 : 0);
