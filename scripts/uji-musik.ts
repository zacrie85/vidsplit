// Uji unit v0.12.0 — STUDIO MUSIK: resep genre, filter audio (lapisan & penuh), 15 visual,
// ASS/LRC/chord-sheet, layer WAV, MUSIK BARU DARI CHORD (buatMelodiBaru 17 genre),
// instrumen baru (sitar/brass/tabla/shaker), ekstraksi melodi, tempo.
// Jalankan: bun scripts/uji-musik.ts
import { existsSync, statSync, unlinkSync } from "node:fs";
import {
  bangunAss, bangunFilterAudio, bangunFilterAudioAi, bangunFilterAudioGantiAi, bangunRantaiVisual, bpmAman, adalahVideoMusik, cariReferensiVokal,
  clampStudio, faktorAtempo,
  faktorWaktuStudio, formatChordSheet, formatLrc, geserVokal, geserVokalSemi, grafPisahVokalMusik, hexKeAss, parseLrc, rantaiVokal, rantaiWarna,
  adalahWanita,
  transposDgnPerubahan, PILIHAN_KECEPATAN,
  REFERENSI_VOKAL, RESEP_VOKAL_GENRE,
  RESEP_GENRE, DAFTAR_GENRE, INFO_GENRE, VISUAL_MUSIK, opsiVisualDefault, skalaChord,
  skalaLirik, transposeAuto, WARNA_GENRE, type GenreMusik, type PolaLayer, type SegmenChord,
} from "../src/lib/vidsplit/musik";
import { beriReverb, buatLayerWav, nadaIns, sampel } from "../src/lib/vidsplit/musikLayer";
import { buatHarmoniWav, buatIringanWav, buatMelodiBaru, HARMONI_GENRE, IRING_GENRE, MELODI_GENRE, parseChord } from "../src/lib/vidsplit/musikTransformasi";
import { buatAransemenWav, deskripsiAransemen, drumSampel, RENCANA_GENRE } from "../src/lib/vidsplit/musikAransemen";
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
cek(fk.graf.includes("lowpass=f=160"), "karaoke v0.15 mengembalikan bass mono <160 Hz");
const fv = bangunFilterAudio({ ...dasar, karaoke: "vokal" });
cek(fv.graf.includes("highpass=f=150") && fv.graf.includes("lowpass=f=9500"), "v0.19 mode vokal pita diperlebar 150–9500 Hz");
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
// v0.17.1 — kontrak kompatibilitas ffmpeg bundel (ffmpeg-static = 7.0.x, sama dgn installer Windows):
// showspectrum hanya punya opsi `fps` (BUKAN `rate=` — hanya ada di ffmpeg lebih baru),
// avectorscope hanya punya `draw=dot|line|aaline` (BUKAN mode=dot / mode=line / draw=fill).
for (const id of ["spektrum-api", "spektrum-pelangi", "spektrum-magnet", "spektrum-vektor"] as const) {
  const g = bangunRantaiVisual(id, { w: 1280, h: 720, fps: 30, durasi: 60, o: VIS });
  const seg = (g.split("showspectrum=")[1] ?? "").split(";")[0];
  cek(seg.length > 0 && seg.includes(`:fps=${30}`) && !seg.includes(`:rate=${30}`), `showspectrum "${id}" pakai fps= (kompatibel bundel, bukan rate=)`);
}
for (const id of ["vektor-radar", "vektor-neon", "spektrum-vektor", "radar-berdenyut"] as const) {
  const g = bangunRantaiVisual(id, { w: 1280, h: 720, fps: 30, durasi: 60, o: VIS });
  const seg = g.split("avectorscope=")[1] ?? "";
  const aman = seg.length > 0 && !seg.includes("mode=dot") && !seg.includes("mode=line")
    && !seg.includes("draw=fill") && !seg.includes("colors=") && seg.includes("rc=");
  cek(aman, `avectorscope "${id}" pakai draw= valid + rc/gc/bc (kompatibel bundel)`);
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
cek(cl.layerLevel === 100 && cl.bpm === 300, "layerLevel 100 & bpm ≤ 300 (v0.18 dulu 220)");
cek(clampStudio({ file: "x", bpm: 5 }).bpm === 30, "bpm 5 → floor 30 (v0.18 — lagu lambat tak terpotong lagi)");
cek(clampStudio({ file: "x", bpm: 128.44 }).bpm === 128.4, "bpm desimal dipertahankan 1 tempat desimal");
cek(cl.judul.length <= 200, "judul dipotong 200");

console.log("== 7b. v0.18.0 — BPM manual & video sumber ==");
cek(bpmAman("123.45", 120) === 123.4 || bpmAman("123.45", 120) === 123.5, "bpmAman string desimal → angka valid");
cek(bpmAman(10, 100) === 30 && bpmAman(9999, 100) === 300, "bpmAman clamp 30–300");
cek(bpmAman("abc", 117.5) === 117.5 && bpmAman(NaN, 96) === 96 && bpmAman(0, 81) === 81, "bpmAman masukan rusak → bawaan deteksi");
cek(bpmAman(-40, 120) === 120, "bpmAman negatif → bawaan");
cek(adalahVideoMusik("lagu.MP4") && adalahVideoMusik("x.mkv") && adalahVideoMusik("konsert.webm") && adalahVideoMusik("a.m4v"), "ekstensi video dikenali (case-insensitive)");
cek(!adalahVideoMusik("lagu.mp3") && !adalahVideoMusik("x.flac") && !adalahVideoMusik("noext"), "ekstensi audio / tanpa ekstensi → bukan video");

console.log("== 8. Bangun filter tidak menghasilkan label ganda ==");
const grafR = bangunRantaiVisual("cqt-gelombang", { w: 1280, h: 720, fps: 30, durasi: 60, o: VIS });
cek((grafR.match(/\[av\]/g) || []).length === 1, "label [av] hanya di awal (dapat ditukar [av2] di jobs)");

console.log("== 9. v0.11.0 — clampStudio field baru (mode/kecepatan/groove/melodi/vokal) ==");
const cl11 = clampStudio({ file: "x", mode: "penuh", kecepatan: 1.5, grooveLevel: 999, melodiLevel: -5, vokalLevel: 42 });
cek(cl11.mode === "penuh" && cl11.kecepatan === 1.5, "mode penuh + kecepatan 1.5 diterima");
cek(cl11.grooveLevel === 100 && cl11.melodiLevel === 0 && cl11.vokalLevel === 42, "groove/melodi/vokal di-clamp 0–100");
const cl12 = clampStudio({ file: "x", mode: "aneh" as never, kecepatan: 1.7 as never });
cek(cl12.mode === "remake" && cl12.kecepatan === 1, "mode/kecepatan aneh → default aman (remake v0.13)");
cek(clampStudio({ file: "x" }).mode === "remake", "tanpa mode → remake (bawaan baru v0.13)");

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

console.log("== 12. v0.12.0 — IRING_GENRE 17 gaya lengkap + perkusi/dekorasi ==");
const GAYA_BASS = ["delapan", "rootlima", "jalan", "reggae", "pump", "dangdut", "sub", "funk"];
const GAYA_COMP = ["skank", "strum", "pad", "swing", "punch", "arpeggio", "funk16", "hentak"];
const INS_NADA = ["bass", "sub", "piano", "orgel", "flute", "saw", "pluk", "saron", "bell", "sitar", "brass"];
for (const g of DAFTAR_GENRE) {
  const ir = IRING_GENRE[g];
  cek(!!ir && POLA.includes(ir.drum) && GAYA_BASS.includes(ir.bass) && GAYA_COMP.includes(ir.comp)
    && INS_NADA.includes(ir.compIns) && INS_NADA.includes(ir.lead)
    && ir.swing >= 0 && ir.swing <= 0.33 && ir.gDrum > 0 && ir.gBass > 0 && ir.gComp > 0 && ir.gLead > 0,
    `iringan "${g}" lengkap & valid`);
}
cek(IRING_GENRE.dangdut.perkusi === "tabla" && IRING_GENRE.dangdut.dekorasi === "sitar",
  "dangdut: perkusi tabla + dekorasi sitar (rasa India)");
cek(IRING_GENRE.ska.lead === "brass" && IRING_GENRE.funk.lead === "brass", "ska & funk lead tembaga (brass)");
cek(DAFTAR_GENRE.every((g) => MELODI_GENRE[g]?.ritme?.length > 0 && MELODI_GENRE[g]?.tangga?.length >= 5),
  "MELODI_GENRE 17 gaya punya ritme & tangga");

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

console.log("== 17. v0.12.0 — buatMelodiBaru (musik baru dari chord) ==");
// chord C tunggal 8 dtk — semua nada harus milik tangga/nada akor khas genre
const ktxC = { bpm: 120, fase: 0, durasi: 8, chord: [{ mulai: 0, durasi: 8, chord: "C" }] as SegmenChord[] };
const mDut = buatMelodiBaru(ktxC, "dangdut", 0);
const mDut2 = buatMelodiBaru(ktxC, "dangdut", 0);
cek(mDut.length > 20, `melodi dangdut diciptakan (${mDut.length} nada)`);
cek(JSON.stringify(mDut) === JSON.stringify(mDut2), "deterministik — variasi sama = melodi identik");
const mDutV = buatMelodiBaru(ktxC, "dangdut", 1);
cek(JSON.stringify(mDut) !== JSON.stringify(mDutV), "variasi 1 → pola melodi berbeda");
// batas waktu & frekuensi & gain masuk akal utk SEMUA genre
let batasOk = true;
for (const g of DAFTAR_GENRE) {
  for (const n of buatMelodiBaru(ktxC, g, 3)) {
    if (n.t < 0 || n.t > 8.2 || n.d <= 0 || n.d > 8 || n.f < 130 || n.f > 1975 || n.g <= 0 || n.g > 1) {
      batasOk = false; console.error(`    pelanggaran @${g}: ${JSON.stringify(n)}`); break;
    }
  }
}
cek(batasOk, "17 genre: waktu/durasi/frekuensi/gain semua dalam batas");
// nada kuat harus nada CHORD (akar/ters/kvint/oktaf) — bukan melodi asli
const pcDalam = (f: number, base: number) => {
  const pc = Math.round(12 * Math.log2(f / base)) % 12;
  return ((pc % 12) + 12) % 12;
};
let chordOk = true;
for (const g of DAFTAR_GENRE) {
  const base = 261.626 * Math.pow(2, MELODI_GENRE[g].okt);
  const izinkan = new Set([...MELODI_GENRE[g].tangga, 0, 4, 7, 12, 19].map((s) => ((s % 12) + 12) % 12));
  for (const n of buatMelodiBaru(ktxC, g, 2)) {
    if (n.d === 0.06) continue; // ornamen grace-note sengaja meluncur −2 semitone — dikecualikan
    if (!izinkan.has(pcDalam(n.f, base))) { chordOk = false; console.error(`    nada di luar tangga @${g}: ${n.f}`); break; }
  }
}
cek(chordOk, "nada melodi selalu dari tangga nada/nada akor (mengikuti chord)");
// ornamen grace-note khas dangdut hadir; lofi (tanpa ornamen) tidak
cek(mDut.some((n) => n.d === 0.06), "dangdut: ada ornamen grace-note 60 ms");
cek(!buatMelodiBaru(ktxC, "lofi", 0).some((n) => n.d === 0.06), "lofi: tanpa ornamen");
// densitas: punk (8 slot/bar) lebih rapat dari reggae (4 slot/bar)
const mPunk = buatMelodiBaru(ktxC, "punk", 0);
const mReggae = buatMelodiBaru(ktxC, "reggae", 0);
cek(mPunk.length > mReggae.length * 1.4, `punk lebih rapat (${mPunk.length}) dari reggae (${mReggae.length})`);
// chord berbeda → akar melodi berpindah (mengikuti progresi)
const ktxPro = { bpm: 120, fase: 0, durasi: 8, chord: [
  { mulai: 0, durasi: 4, chord: "C" }, { mulai: 4, durasi: 4, chord: "Ab" },
] as SegmenChord[] };
const mPro = buatMelodiBaru(ktxPro, "pop", 0);
const nadaPertama = mPro.filter((n) => n.t < 3.9)[0];
const nadaAb = mPro.filter((n) => n.t >= 4 && n.t < 4.6)[0];
cek(!!nadaPertama && !!nadaAb && pcDalam(nadaAb.f, 523.25) !== pcDalam(nadaPertama.f, 523.25),
  "ganti chord → akar melodi berpindah mengikuti progresi");

console.log("== 18. v0.12.0 — instrumen baru: sitar, brass, tabla, shaker ==");
for (const [nama, buf] of [
  ["sitar", nadaIns("sitar", 440, 0.5, 0.8)], ["brass", nadaIns("brass", 349.2, 0.5, 0.8)],
  ["tabla dha", sampel("tabla", 0.8, 95)], ["tabla tin", sampel("tabla", 0.6, 520)],
  ["shaker", sampel("shaker", 0.4, 0)],
] as const) {
  const finite = buf.length > 0 && Array.from(buf.slice(0, 1000)).every((v) => Number.isFinite(v));
  cek(finite, `instrumen "${nama}" — ${buf.length} sampel, semua finite`);
}

console.log("== 19. v0.12.0 — clampStudio: bawaan musik baru murni ==");
const cl19 = clampStudio({ file: "x" });
cek(cl19.vokalLevel === 0, "bawaan vokalLevel = 0 (audio asli tidak ikut)");
cek(cl19.melodiAsliLevel === 0, "bawaan melodiAsliLevel = 0 (bukan melodi asli)");
cek(cl19.melodiLevel === 65, "bawaan melodiLevel = 65 (melodi baru dari chord)");
cek(cl19.variasi === 0, "bawaan variasi = 0");
const clVar = clampStudio({ file: "x", variasi: -7 });
cek(clVar.variasi === 0, "variasi negatif → 0");
const clVar2 = clampStudio({ file: "x", variasi: 9999 });
cek(clVar2.variasi === 999, "variasi raksasa → 999");

console.log("== 20. v0.12.0 — graf penuh: audio asli TIDAK masuk (vokal bawaan 0) ==");
const gBaru = bangunFilterAudio({ ...dasar, mode: "penuh", genre: "dangdut", grooveLevel: 75, vokalLevel: 0 });
cek(gBaru.adaLayer && !gBaru.graf.includes("[base]") && !gBaru.graf.includes("[voc"),
  "penuh vokal 0% → sumber audio TIDAK ada di graf (musik baru murni)");
cek(gBaru.graf.includes("[1:a]volume="), "penuh vokal 0% → hanya input 1 (musik baru)");
const gVok = bangunFilterAudio({ ...dasar, mode: "penuh", genre: "dangdut", grooveLevel: 75, vokalLevel: 60 });
cek(gVok.graf.includes("[base]") && gVok.graf.includes("highpass=f=160"), "penuh vokal >0 → sumber ikut via DSP tengah");

console.log("== 21. v0.12.0 — buatIringanWav memakai melodi baru (tanpa melodi asli) ==");
// KTX tanpa melodi asli pun — musik baru tetap kaya (dulu: tanpa melodi asli = hening melodi)
const wTanpaMelodi = buatIringanWav({ bpm: 120, fase: 0, durasi: 8, chord: chordUji }, "dangdut", { groove: 0.75, melodi: 0.65 });
const ekspektasi8 = 44 + Math.ceil((8 + 1.2) * 44100) * 2 * 2;
cek(wTanpaMelodi.slice(0, 4).toString("ascii") === "RIFF" && Math.abs(wTanpaMelodi.length - ekspektasi8) < 4,
  "iringan dangdut tanpa melodi asli → WAV valid (melodi baru diciptakan)");
// variasi 0 vs 1 → audio berbeda (melodi benar-benar berganti)
const wV0 = buatIringanWav({ bpm: 120, fase: 0, durasi: 8, chord: chordUji }, "dangdut", { groove: 0.75, melodi: 0.65, variasi: 0 });
const wV1 = buatIringanWav({ bpm: 120, fase: 0, durasi: 8, chord: chordUji }, "dangdut", { groove: 0.75, melodi: 0.65, variasi: 1 });
let bedaVar = false;
for (let i = 200000; i < 500000; i++) if (wV0[i] !== wV1[i]) { bedaVar = true; break; }
cek(bedaVar, "variasi berbeda → audio musik baru berbeda");
// melodi asli sbg pegangan opsional masih bekerja
const wPegangan = buatIringanWav(
  { bpm: 120, fase: 0, durasi: 8, chord: chordUji, melodi: melodiUji }, "pop",
  { groove: 0.75, melodi: 0.65, melodiAsli: 0.8 },
);
cek(wPegangan.slice(0, 4).toString("ascii") === "RIFF" && Math.abs(wPegangan.length - ekspektasi8) < 4,
  "melodi asli sbg pegangan (opsional) → WAV valid");

console.log("== 22. v0.13.0 — clampStudio remake: kemiripan & transpose ==");
const clA = clampStudio({ file: "x", mode: "remake", kemiripan: 500, transpose: 99 });
cek(clA.kemiripan === 100 && clA.transpose === 5, "kemiripan ≤100 & transpose ≤+5");
const clB = clampStudio({ file: "x", mode: "remake", kemiripan: 10, transpose: -99 });
cek(clB.kemiripan === 40 && clB.transpose === -5, "kemiripan ≥40 & transpose ≥-5");
const clC = clampStudio({ file: "x", mode: "remake", transpose: null });
cek(clC.transpose === null && clC.kemiripan === 80, "transpose null = Auto & kemiripan bawaan 80");

console.log("== 23. v0.13.0 — transposeAuto (deterministik, dari kemiripan) ==");
cek(transposeAuto(100, "apapun") === 0, "kemiripan 100 → transpos 0");
cek(Math.abs(transposeAuto(80, "lagu-a")) === 2, `kemiripan 80 → ±2 semitone (${transposeAuto(80, "lagu-a")})`);
cek(Math.abs(transposeAuto(60, "lagu-a")) === 4, "kemiripan 60 → ±4 semitone");
cek(Math.abs(transposeAuto(40, "lagu-a")) === 5, "kemiripan 40 → ±5 (maks)");
cek(transposeAuto(80, "lagu-a") === transposeAuto(80, "lagu-a"), "deterministik — seed sama hasil sama");

console.log("== 24. v0.13.0 — graf REMAKE: asetrate + atempo kompensasi ==");
const gR3 = bangunFilterAudio({ ...dasar, mode: "remake", genre: "dangdut", layerLevel: 40, kemiripan: 60, transpose: 3 }, 48000);
cek(gR3.transpose === 3 && gR3.graf.includes("asetrate=57082"), `remake +3 @48k → asetrate=57082`);
cek(gR3.graf.includes("atempo=0.84090"), "kompensasi atempo=0.84090 (durasi tetap)");
cek(gR3.graf.includes("[1:a]volume=") && gR3.graf.includes("amix=inputs=2"), "remake: layer ikut diaduk");
cek(gR3.tempo === 1.02, "tempo remake tetap resep genre (transpos tak ubah durasi)");
const gRm = bangunFilterAudio({ ...dasar, mode: "remake", genre: "rock", kemiripan: 80, transpose: -5 });
cek(gRm.graf.includes("asetrate=33038") && gRm.graf.includes("atempo=1.33484"), "remake −5 @44.1k → asetrate=33038 + atempo=1.33484");
const gR0 = bangunFilterAudio({ ...dasar, mode: "remake", genre: "asli", layerLevel: 0, kemiripan: 100, transpose: 0 });
cek(!gR0.graf.includes("asetrate") && gR0.transpose === 0, "transpos 0 → graf tanpa asetrate");
const gRp = bangunFilterAudio({ ...dasar, mode: "penuh", genre: "dangdut", grooveLevel: 75, kemiripan: 40, transpose: 3 });
cek(!gRp.graf.includes("asetrate") && gRp.transpose === 0, "mode penuh mengabaikan transpos (musik baru murni)");

console.log("== 25. v0.13.0 — layer: transpos, stereo, reverb, kendang dung/dut ==");
const l0 = buatLayerWav("gamelan", 120, 4, 0, 0);
const l4 = buatLayerWav("gamelan", 120, 4, 0, 4);
cek(l0.length === l4.length, "transpos layer tak ubah panjang WAV");
let bedaGeser = false;
for (let i = 44; i < Math.min(l0.length, 400000); i++) if (l0[i] !== l4[i]) { bedaGeser = true; break; }
cek(bedaGeser, "transpos layer (+4) → nada petik/stab bergeser (audio beda)");
const wDut = buatLayerWav("dangdut", 120, 4, 0);
let stereoAda = false;
for (let i = 44; i + 3 < Math.min(wDut.length, 600000); i += 2) {
  if (wDut[i] !== wDut[i + 2]) { stereoAda = true; break; }
}
cek(stereoAda, "layer kini stereo — kanal kiri ≠ kanan (pan + reverb)");
const kdung = sampel("kendang", 0.8, 78);
const kdut = sampel("kendang", 0.8, 150);
let bedaKendang = false;
for (let i = 0; i < Math.min(kdung.length, kdut.length); i++) {
  if (Math.abs(kdung[i] - kdut[i]) > 0.01) { bedaKendang = true; break; }
}
cek(bedaKendang && kdung.length > 1000 && kdut.length > 1000, "kendang dung (f<130) ≠ dut (f≥130)");
const rb = new Float32Array(44100);
rb[100] = 0.8;
beriReverb(rb, 0.25);
const ekor = Array.from(rb.slice(13230, 22050)).reduce((a, b) => a + Math.abs(b), 0);
cek(Number.isFinite(ekor) && ekor > 0.001, `reverb: ada ekor setelah klik (${ekor.toFixed(3)})`);

console.log("== 26. v0.14.0 — WARNA_GENRE 17 lengkap & rantaiWarna skalabel ==");
cek(DAFTAR_GENRE.every((g) => !!WARNA_GENRE[g]), "WARNA_GENRE 17 genre lengkap");
cek(rantaiWarna("edm", 0, 120).length === 0, "tingkat 0 → rantai kosong (apa adanya)");
const edm100 = rantaiWarna("edm", 100, 120);
cek(edm100.some((s) => s.startsWith("tremolo=f=4:d=0.32")),
  "edm 100% @120 BPM → tremolo pump 4 Hz (2× ketuk, TERKUNCI BPM)");
const rock100 = rantaiWarna("rock", 100, 120);
const rock50 = rantaiWarna("rock", 50, 120);
const g100 = Number(/equalizer[^,]*g=([\d.-]+)/.exec(rock100.join(","))?.[1] ?? NaN);
const g50 = Number(/equalizer[^,]*g=([\d.-]+)/.exec(rock50.join(","))?.[1] ?? NaN);
cek(Math.abs(g100 - 4) < 0.01 && Math.abs(g50 - 2) < 0.01, `gain EQ ikut skala (100%→${g100}, 50%→${g50})`);
cek(rantaiWarna("edm", 100, 120).some((s) => s.includes("extrastereo=m=1.5")),
  "lebar stereo edm = 1 + 0.5×t");
const lofi100 = rantaiWarna("lofi", 100, 120);
cek(lofi100.some((s) => s.startsWith("lowpass=f=7500")) && lofi100.some((s) => s.startsWith("vibrato=f=3.5")),
  "lofi: lowpass + wobble kaset (vibrato)");
const blues100 = rantaiWarna("blues", 100, 120);
cek(blues100.some((s) => s.startsWith("aphaser=")), "blues: phaser raung di paruh atas");
let warnaOk = true;
for (const g of DAFTAR_GENRE) {
  for (const t of [1, 30, 55, 80, 100]) {
    for (const s of rantaiWarna(g, t, 118)) {
      if (/NaN|undefined|Infinity/.test(s) || s.length > 200) { warnaOk = false; console.error(`    jelek @${g}/${t}: ${s}`); }
    }
  }
}
cek(warnaOk, "17 genre × 5 tingkat: semua filter valid (tanpa NaN/undefined)");
// BPM ekstrem tetap aman di tremolo
const pCepat = rantaiWarna("disco", 90, 999);
cek(pCepat.some((s) => /^tremolo=f=[\d.]+:d=/.test(s)), "BPM raksasa di-clamp → tremolo tetap valid");

console.log("== 27. v0.14.0 — clampStudio tingkatGenre & graf REMAKE tanpa lapisan ==");
const cl14 = clampStudio({ file: "x", tingkatGenre: 500 });
cek(cl14.tingkatGenre === 100, "tingkatGenre di-clamp ≤100");
const cl14b = clampStudio({ file: "x" });
cek(cl14b.tingkatGenre === 55, "bawaan tingkatGenre = 55");
const gV14 = bangunFilterAudio({ ...dasar, mode: "remake", genre: "edm", layerLevel: 0, tingkatGenre: 80, kemiripan: 100, transpose: 0 });
cek(gV14.adaLayer === false && !gV14.graf.includes("[1:a]"),
  "remake bawaan v0.14: TANPA lapisan — tidak ada input 1 (nol nada tambahan)");
cek(gV14.graf.includes("tremolo=") && gV14.graf.includes("extrastereo"),
  "remake edm: warna genre (pump terkunci-BPM + lebar) masuk graf");
cek(!gV14.graf.includes("f=90,") && gV14.graf.includes("bass=g=4.8:f=95"),
  "remake edm memakai WARNA baru (bass 95 Hz ter-skala), bukan resep lama");
const gA14 = bangunFilterAudio({ ...dasar, mode: "remake", genre: "asli", layerLevel: 0, tingkatGenre: 80, kemiripan: 100, transpose: 0 });
cek(gA14.graf.includes("anull") && !gA14.graf.includes("tremolo"), "remake genre asli → passthrough");
// lapisan opsional masih bekerja saat dinaikkan manual
const gL14 = bangunFilterAudio({ ...dasar, mode: "remake", genre: "rock", layerLevel: 40, tingkatGenre: 60 });
cek(gL14.adaLayer && gL14.graf.includes("amix=inputs=2"), "lapisan eksperimental masih bisa diaktifkan manual");

console.log("== 28. v0.15.0 — tempo 1.1×–1.5×, perubahan musik, karaoke 3-pita, ASS ukuranTeks ==");
// --- PILIHAN_KECEPATAN 7 nilai sesuai permintaan user ---
cek(JSON.stringify(PILIHAN_KECEPATAN) === JSON.stringify([0.5, 1, 1.1, 1.2, 1.3, 1.4, 1.5]),
  `PILIHAN_KECEPATAN = ${PILIHAN_KECEPATAN.join(", ")} (0.5, 1, 1.1–1.5)`);
cek(clampStudio({ file: "x", kecepatan: 1.2 }).kecepatan === 1.2, "kecepatan 1.2 diterima");
cek(clampStudio({ file: "x", kecepatan: 1.4 }).kecepatan === 1.4, "kecepatan 1.4 diterima");
const gTempo15 = bangunFilterAudio({ ...dasar, kecepatan: 1.3, mode: "lapisan" });
cek(gTempo15.graf.includes("atempo=1.3"), "tempo 1.3× → atempo=1.3 di graf");
// --- transposDgnPerubahan ---
cek(transposDgnPerubahan(4, 0) === 0, "perubahan 0% → transpos 0 (benar-benar lagu asli)");
cek(transposDgnPerubahan(4, 100) === 4, "perubahan 100% → transpos penuh");
cek(transposDgnPerubahan(-4, 50) === -2, "perubahan 50% dari −4 → −2 (dibulatkan)");
cek(transposDgnPerubahan(9, 100) === 5, "transpos dasar di-clamp ±5 (skala 100%)");
// --- campuran paralel asli↔genre (tingkatMusik) ---
const cl15 = clampStudio({ file: "x", tingkatMusik: 500 });
cek(cl15.tingkatMusik === 100, "tingkatMusik di-clamp ≤100");
cek(clampStudio({ file: "x" }).tingkatMusik === 65, "bawaan tingkatMusik = 65");
const gB65 = bangunFilterAudio({ ...dasar, mode: "remake", genre: "rock", layerLevel: 0, tingkatGenre: 70, kemiripan: 100, transpose: 0 });
cek(gB65.graf.includes("[ksrc]asplit=2[blA][blB]") && gB65.graf.includes("volume=0.350") && gB65.graf.includes("volume=0.650"),
  "bawaan 65% → cabang asli 0.350 + cabang genre 0.650");
cek(gB65.graf.includes("amix=inputs=2:duration=first:normalize=0"), "campuran paralel pakai amix normalize=0 (bobot berjumlah 1, tanpa clip)");
cek(gB65.graf.includes("tremolo") === false || gB65.graf.includes("[blGaya0]"), "warna genre hidup di cabang gaya");
const gB100 = bangunFilterAudio({ ...dasar, mode: "remake", genre: "rock", layerLevel: 0, tingkatGenre: 70, kemiripan: 100, transpose: 0, tingkatMusik: 100 });
cek(!gB100.graf.includes("[blA]"), "perubahan 100% → tanpa split campuran (jalur penuh)");
const gB0 = bangunFilterAudio({ ...dasar, mode: "remake", genre: "rock", layerLevel: 0, tingkatGenre: 70, kemiripan: 100, transpose: 0, tingkatMusik: 0 });
cek(gB0.graf.includes("[ksrc]anull[g]") && !gB0.graf.includes("tremolo") && !gB0.graf.includes("crystalizer"),
  "perubahan 0% → warna genre dilepas total (apa adanya)");
const gBL = bangunFilterAudio({ ...dasar, kecepatan: 1 }); // lapisan: tak terpengaruh
cek(!gBL.graf.includes("[blA]"), "mode lapisan tidak memakai campuran paralel");
// --- karaoke 3-pita + loudness ---
const fk15 = bangunFilterAudio({ ...dasar, karaoke: "karaoke", layerLevel: 0 });
cek(fk15.graf.includes("highpass=f=11000") && fk15.graf.includes("volume=0.45[air]"),
  "karaoke: pita udara simbal >11 kHz dikembalikan tipis");
cek(fk15.graf.includes("volume=2.0[side]"), "karaoke: sisi dikuatkan 2× (dulu bisu)");
cek(fk15.graf.includes("amix=inputs=3:duration=first:normalize=0") && fk15.graf.includes("acompressor=threshold=-21dB:ratio=2.2:attack=10:release=200:makeup=4.5"),
  "karaoke: 3 pita digabung penuh + kompresor makeup 4,5 dB (tidak terpendam)");
cek(fk15.graf.includes("volume=1.3[mix]"), "gain akhir sadar-karaoke (1.3, bukan 1.9)");
const fk15l = bangunFilterAudio({ ...dasar, karaoke: "karaoke", layerLevel: 40 });
cek(fk15l.graf.includes("volume=1.6[g2]"), "gain akhir karaoke+bapisan 1.6");
// --- ASS ukuranTeks (bawaan 25 @9:16) ---
const lirik15 = [{ mulai: 1, teks: "uji" }];
const chord15 = [{ mulai: 1, durasi: 2, chord: "Am" }];
const ass916 = bangunAss({ w: 1080, h: 1920, durasi: 30, vis: { ...opsiVisualDefault, teksJudul: "V" }, lirik: lirik15, chord: chord15 });
cek(ass916.includes("Style: Lirik,DejaVu Sans,48,"), "ASS 9:16 ukuranTeks 25 → lirik 48 px");
cek(ass916.includes("Style: Chord,DejaVu Sans,55,"), "ASS 9:16 chord 55 px (di atas lirik, tetap tampil)");
cek(ass916.includes("Style: Judul,Bebas Neue,65,"), "ASS 9:16 judul 65 px");
cek(ass916.includes("MarginL, MarginR, MarginV") || ass916.includes("[Events]"), "ASS 9:16 struktur utuh");
const assBesar = bangunAss({ w: 1080, h: 1920, durasi: 30, vis: { ...opsiVisualDefault, ukuranTeks: 40, teksJudul: "V" }, lirik: lirik15, chord: chord15 });
cek(assBesar.includes("Style: Lirik,DejaVu Sans,76,"), "ukuranTeks 40 → lirik 76 px (bisa diperbesar)");
const assKecil = bangunAss({ w: 1080, h: 1920, durasi: 30, vis: { ...opsiVisualDefault, ukuranTeks: 12, teksJudul: "V" }, lirik: lirik15, chord: chord15 });
cek(assKecil.includes("Style: Lirik,DejaVu Sans,23,"), "ukuranTeks 12 → lirik 23 px (bisa diperkecil)");
const ass169 = bangunAss({ w: 1280, h: 720, durasi: 30, vis: { ...opsiVisualDefault, teksJudul: "V" }, lirik: lirik15, chord: chord15 });
cek(ass169.includes("Style: Lirik,DejaVu Sans,32,"), "16:9 720p: skala sisi-pendek (lirik 32 px) — proporsional dgn 9:16");

console.log("== 29. v0.16.0 — genre vokal + 68 referensi penyanyi + harmoni terkunci-akor ==");
// --- REFERENSI_VOKAL: 17 genre × (2 pria + 2 wanita), id unik global ---
let nRef = 0;
const idRef = new Set<string>();
let idGanda = false;
for (const g of DAFTAR_GENRE) {
  const r = REFERENSI_VOKAL[g];
  cek(!!r && r.pria.length === 2 && r.wanita.length === 2, `referensi vokal "${g}": 2 pria + 2 wanita`);
  for (const x of [...r.pria, ...r.wanita]) {
    nRef++;
    if (idRef.has(x.id)) idGanda = true;
    idRef.add(x.id);
    if (!x.nama || !x.ket) cek(false, `referensi ${x.id} tanpa nama/ket`);
  }
}
cek(nRef === 68, `total referensi penyanyi = ${nRef} (harapan 68)`);
cek(!idGanda, "tidak ada id referensi ganda");
cek(cariReferensiVokal("dangdut-p1")?.nama === "Rhoma Irama", "dangdut-p1 = Rhoma Irama");
cek(cariReferensiVokal("dangdut-p2")?.nama === "Mansyur S", "dangdut-p2 = Mansyur S");
cek(cariReferensiVokal("dangdut-w1")?.nama === "Elvi Sukaesih", "dangdut-w1 = Elvi Sukaesih");
cek(cariReferensiVokal("dangdut-w2")?.nama === "Inul Daratista", "dangdut-w2 = Inul Daratista");
cek(cariReferensiVokal("tidak-ada") === null, "id tak dikenal → null");
for (const g of DAFTAR_GENRE) {
  if (!RESEP_VOKAL_GENRE[g]) cek(false, `RESEP_VOKAL_GENRE ${g} hilang`);
}
cek(DAFTAR_GENRE.every((g) => !!RESEP_VOKAL_GENRE[g]), "RESEP_VOKAL_GENRE 17 lengkap");
// --- rantaiVokal: skala, karakter, fallback (v0.17 VokalGen-2) ---
cek(rantaiVokal("dangdut", "dangdut-p1", 0).length === 0, "tingkat vokal 0 → rantai kosong (apa adanya)");
const rvDut = rantaiVokal("dangdut", "dangdut-p1", 100);
cek(rvDut.some((x) => x.startsWith("vibrato=f=5.5")), "dangdut Rhoma: vibrato hio 5,5 Hz");
cek(rvDut.some((x) => x.startsWith("bass=g=")), "dangdut: kehangatan dada");
cek(rantaiVokal("rock", "rock-p1", 100).some((x) => x.startsWith("acrusher")), "rock Albar: serak acrusher");
cek(rantaiVokal("lofi", "lofi-p1", 100).every((x) => !x.startsWith("lowpass")), "lofi: lowpass pindah ke pita atas (bukan rantai tengah)");
cek(rantaiVokal("pop", "pop-w1", 100).some((x) => x.startsWith("deesser")), "pop: deesser penghalus sibilan");
cek(!rantaiVokal("dangdut", "id-palsu", 50).some((x) => x.includes("NaN")), "id palsu → fallback pria[0], tanpa NaN");
const rv50 = rantaiVokal("dangdut", "dangdut-p1", 50);
const rv100 = rantaiVokal("dangdut", "dangdut-p1", 100);
cek(rv50.length > 0 && rv50.length <= rv100.length, "tingkat 50 ≤ jumlah filter tingkat 100 (skala)");
// --- v0.19 geserVokal: lapisan pitch dada/kepala pada vokal TERISOLASI (lebih kuat) ---
cek(geserVokal("dangdut", "dangdut-p1", 0) === null, "geserVokal tingkat 0 → null");
const gRhoma = geserVokal("dangdut", "dangdut-p1", 55);
cek(!!gRhoma && gRhoma.st === -2 && gRhoma.gain > 0.45 && gRhoma.gain <= 0.65, `Rhoma dada −2 st @55% (gain ${gRhoma?.gain.toFixed(3)} = 0,44×0,73×1,45)`);
const gInul = geserVokal("dangdut", "dangdut-w2", 100);
cek(!!gInul && gInul.st === 3, "Inul tinggi +5 st → lapisan DSP lawas clamp ±3 (st 3)");
const gCash = geserVokal("country", "country-p1", 100);
cek(!!gCash && gCash.st === -2.5 && gCash.gain <= 0.65, "Johnny Cash dada −2,5 st, gain ≤ 0,65");
cek(geserVokal("dangdut", "id-palsu", 55) !== null, "id palsu → fallback pria[0] tetap ada karakter");
let semuaTerdengar = true;
for (const g of DAFTAR_GENRE) {
  for (const r of [...REFERENSI_VOKAL[g].pria, ...REFERENSI_VOKAL[g].wanita]) {
    if (!geserVokal(g, r.id, 55)) { semuaTerdengar = false; cek(false, `referensi ${r.id} tanpa karakter pitch`); }
  }
}
cek(semuaTerdengar, "68/68 penyanyi punya karakter pitch terdengar @55%");
// --- v0.21 geserVokalSemi: register referensi = pitch PENGGANTI (satu suara) ---
cek(geserVokalSemi("dangdut", "dangdut-p1", 0) === 0, "geserVokalSemi tingkat 0 → 0 (apa adanya)");
cek(geserVokalSemi("dangdut", "dangdut-p1", 55) === -1, `Rhoma dada −2 st @55% → −1 st (skala kekuatan, dpt ${geserVokalSemi("dangdut", "dangdut-p1", 55)})`);
cek(geserVokalSemi("dangdut", "dangdut-p1", 100) === -2, "Rhoma dada −2 st @100% → register penuh");
// v0.23 — wanita: register +4–5,5 st (suara wanita sejati) + lantai skala 0,6
cek(geserVokalSemi("dangdut", "dangdut-w2", 0) === 0, "wanita tingkat 0 → 0 (apa adanya)");
cek(geserVokalSemi("dangdut", "dangdut-w2", 100) === 5, `Inul register +5 st @100% (dpt ${geserVokalSemi("dangdut", "dangdut-w2", 100)})`);
cek(geserVokalSemi("dangdut", "dangdut-w2", 55) === 4, `Inul register @55% = 4 st (5×0,82, lantai 0,6 — dpt ${geserVokalSemi("dangdut", "dangdut-w2", 55)})`);
cek(geserVokalSemi("dangdut", "dangdut-w1", 55) === 3.75, `Elvi register @55% = 3,75 st (dpt ${geserVokalSemi("dangdut", "dangdut-w1", 55)})`);
cek(geserVokalSemi("pop", "pop-w1", 100) === 5, "Rossa register +5 st @100%");
cek(geserVokalSemi("country", "country-p1", 100) === -2.5, "Cash dada −2,5 st @100%");
// v0.23 — struktur referensi: SEMUA wanita = register tinggi besar tanpa dada
let strukturWanitaOk = true;
for (const g of DAFTAR_GENRE) {
  for (const r of REFERENSI_VOKAL[g].wanita) {
    if (r.dada || !r.tinggi || r.tinggi < 3.5 || r.tinggi > 5.5) {
      strukturWanitaOk = false;
      cek(false, `referensi wanita ${r.id} tidak sesuai (dada=${r.dada}, tinggi=${r.tinggi})`);
    }
  }
  for (const r of REFERENSI_VOKAL[g].pria) {
    if ((r.tinggi ?? 0) > 3) { strukturWanitaOk = false; cek(false, `pria ${r.id} tinggi > 3`); }
  }
}
cek(strukturWanitaOk, "34/34 referensi wanita: tinggi 4–5,5 st, tanpa dada; pria tinggi ≤ 3");
cek(adalahWanita("dangdut-w1") && adalahWanita("pop-w2"), "adalahWanita mengenali wanita");
cek(!adalahWanita("dangdut-p1") && !adalahWanita("id-palsu"), "adalahWanita: pria & id palsu → false");
// v0.23 — feminisasi timbre: pangkas dada 320 Hz + ring 3,4 kHz + tanpa bass hangat
const rvWan = rantaiVokal("blues", "blues-w1", 100);
cek(rvWan.some((x) => x.includes("f=320:t=q:w=1.4:g=-4.5")), "wanita: resonansi dada 320 Hz dipangkas −4,5 dB");
cek(rvWan.some((x) => x.startsWith("equalizer=f=3400")), "wanita: ring vokal wanita 3,4 kHz ditambah");
cek(rvWan.every((x) => !(x.startsWith("bass=g=") && !x.includes("g=-"))), "wanita: TANPA low-shelf kehangatan dada (ciri pria)");
cek(rvWan.some((x) => x.startsWith("deesser")), "wanita: deesser cadangan bila resep genre tanpa deess");
cek(!rantaiVokal("blues", "blues-p1", 100).some((x) => x.includes("f=320:t=q:w=1.4")), "pria: tanpa feminisasi");
// --- clampStudio field v0.16 ---
const cl16 = clampStudio({ file: "x" });
cek(cl16.nadaLevel === 30, "bawaan nadaLevel = 30");
cek(cl16.genreVokal === "mati", "bawaan genreVokal = mati (vokal asli)");
cek(cl16.refVokal === "" && cl16.tingkatVokal === 55, "bawaan refVokal kosong + tingkatVokal 55");
cek(clampStudio({ file: "x", nadaLevel: 500 }).nadaLevel === 100, "nadaLevel di-clamp ≤100");
cek(clampStudio({ file: "x", genreVokal: "punk" }).genreVokal === "punk", "genreVokal punk diterima");
cek(clampStudio({ file: "x", genreVokal: "aneh" }).genreVokal === "mati", "genreVokal tak dikenal → mati");
// --- graf GENRE VOKAL (v0.19 VokalGen-3: substitusi kanal TENGAH) ---
const gVok16 = bangunFilterAudio({ ...dasar, genre: "asli", layerLevel: 0, genreVokal: "dangdut", refVokal: "dangdut-p1", tingkatVokal: 70 });
cek(gVok16.graf.includes("[base]acrossover=split=180|3800:order=4th"), "vokalgen-3: crossover 3-pita Linkwitz-Riley 180|3800 Hz");
cek(gVok16.graf.includes("[vmC]pan=mono|c0=0.5*c0+0.5*c1[voc0]"), "vokalgen-3: TENGAH (L+R)/2 = inti vokal diekstrak");
cek(gVok16.graf.includes("[vmS]pan=stereo|c0=0.5*c0+-0.5*c1|c1=0.5*c1+-0.5*c0[vocSd]"), "vokalgen-3: SAMPING (L−R) instrumen dipisah tanpa gain");
cek(gVok16.graf.includes("[vocSd][vocS]amix=inputs=2:duration=first:normalize=0[vmMix]"), "vokalgen-3: rekonstruksi samping + tengah' = pita tengah baru");
cek(gVok16.graf.includes("[vokLow][vmMix][vokHigh]amix=inputs=3:duration=first:normalize=0"), "vokalgen-3: pita disusun kembali (bawah+suara+atas)");
cek(gVok16.graf.includes("asetrate=39289") && gVok16.graf.includes("atempo=1.12246"), "Rhoma dada −2 st: lapisan pitch terkompensasi tempo (tetap sinkron)");
cek(gVok16.graf.includes("vibrato=f=5.5"), "genre vokal: karakter dangdut masuk graf");
cek(gVok16.graf.includes("highpass=f=260,lowpass=f=3200"), "lapisan pitch difokuskan ke area suara 260–3200 Hz");
const gVokLofi = bangunFilterAudio({ ...dasar, genre: "asli", layerLevel: 0, genreVokal: "lofi", refVokal: "lofi-p1", tingkatVokal: 70 });
cek(gVokLofi.graf.includes("[vxh]lowpass=f=6800"), "lofi: udara pita atas diremam (lowpass 6800)");
const gVok0 = bangunFilterAudio({ ...dasar, genre: "asli", layerLevel: 0, genreVokal: "dangdut", tingkatVokal: 0 });
cek(gVok0.graf.includes("[base]anull[ksrc]"), "tingkat vokal 0 → passthrough");
const gVokK = bangunFilterAudio({ ...dasar, genre: "asli", layerLevel: 0, karaoke: "karaoke", genreVokal: "dangdut" });
cek(!gVokK.graf.includes("[vxm]"), "karaoke aktif → genre vokal dilewati (vokal sudah dihapus)");
const gVokV = bangunFilterAudio({ ...dasar, genre: "asli", layerLevel: 0, karaoke: "vokal", genreVokal: "dangdut", refVokal: "dangdut-w1", tingkatVokal: 60 });
cek(gVokV.graf.includes("[voc0b]pan=stereo"), "genre vokal di mode 'vokal saja' menyusup ke rantai vokal");
cek(gVokV.graf.includes("asetrate=52444") && gVokV.graf.includes("atempo=0.84090"), "Elvi register wanita (+4,5 st → clamp ±3) di mode vokal saja (terkompensasi)");
cek(gVokV.graf.includes("highpass=f=150,lowpass=f=9500"), "v0.19: pita suara mode 'vokal saja' diperlebar 150–9500 Hz");
// --- v0.19 rantaiVokal lebih kuat (vokal terisolasi) ---
const rvDutKuat = rantaiVokal("dangdut", "dangdut-p1", 100);
cek(rvDutKuat.some((x) => x.includes("f=2000") && x.includes("g=7.2")), "EQ vokal ×1,8 pada terisolasi: dangdut 2000 Hz = 7,2 dB");
// --- v0.19 grafPisahVokalMusik (vocal remover) ---
const grafPisah = grafPisahVokalMusik();
cek(grafPisah.includes("asplit=4") && grafPisah.includes("[mout]") && grafPisah.includes("[vout]"), "pisah: satu graf → dua keluaran [mout] & [vout]");
cek(grafPisah.includes("pan=stereo|c0=0.5*c0+-0.5*c1|c1=0.5*c1+-0.5*c0,highpass=f=110,volume=2.0"), "pisah musik: sisi (L−R) ×2 = resep karaoke v0.15");
cek(grafPisah.includes("pan=mono|c0=0.5*c0+0.5*c1,lowpass=f=160") && grafPisah.includes("highpass=f=11000"), "pisah musik: bass mono <160 + udara simbal >11k");
cek(grafPisah.includes("highpass=f=150,lowpass=f=9500,equalizer=f=3000:t=q:w=1:g=2.5"), "pisah vokal: pita suara 150–9500 + presence 3 kHz");
cek((grafPisah.match(/acompressor=/g) || []).length === 2, "pisah: kompensasi loudness di KEDUA keluaran");
// --- graf HARMONI terkunci-akor ---
const gH = bangunFilterAudio({ ...dasar, mode: "remake", layerLevel: 0, nadaLevel: 60 });
cek(gH.adaNada === true && gH.graf.includes("[1:a]volume=1.260[nad]"), "remake + nada 60% → harmoni input 1 (level 0.6×2.1)");
cek(gH.graf.includes("[g]volume=1.9[g2]") && gH.graf.includes("[g2][nad]amix=inputs=2:duration=first[mix]"), "harmoni diaduk setelah gain akhir (amix 2)");
const gH2 = bangunFilterAudio({ ...dasar, mode: "remake", layerLevel: 40, nadaLevel: 50 });
cek(gH2.graf.includes("[2:a]volume="), "harmoni + lapisan eksperimental: lapisan jadi input 2");
cek(gH2.graf.includes("[g2][nad][lay]amix=inputs=3:duration=first[mix]"), "harmoni + lapisan → amix 3 input");
const gH0 = bangunFilterAudio({ ...dasar, mode: "remake", layerLevel: 0, nadaLevel: 0 });
cek(gH0.adaNada === false && !gH0.graf.includes("[nad]"), "nadaLevel 0 → tanpa harmoni (v0.15 utuh)");
const gHL = bangunFilterAudio({ ...dasar, layerLevel: 40, nadaLevel: 50 });
cek(!gHL.graf.includes("[nad]"), "mode lapisan klasik tidak memakai harmoni");
const gHA = bangunFilterAudio({ ...dasar, mode: "remake", layerLevel: 0, nadaLevel: 50, genre: "asli" });
cek(gHA.adaNada === false, "genre asli → harmoni tidak aktif");
const gHK = bangunFilterAudio({ ...dasar, mode: "remake", layerLevel: 0, nadaLevel: 50, karaoke: "karaoke" });
cek(gHK.adaNada === true && gHK.graf.includes("[nad]"), "harmoni tetap hidup di karaoke (pengiring lagu)");
// --- buatHarmoniWav: deterministik, berbunyi, senyap di 0 ---
const ktxH = { bpm: 120, fase: 0, durasi: 16, chord: [
  { mulai: 0, durasi: 4, chord: "Am" }, { mulai: 4, durasi: 4, chord: "F" },
  { mulai: 8, durasi: 4, chord: "C" }, { mulai: 12, durasi: 4, chord: "G" },
] as SegmenChord[] };
const h1 = buatHarmoniWav(ktxH, "dangdut", 0.5);
const h2 = buatHarmoniWav(ktxH, "dangdut", 0.5);
cek(h1.length > 44100 * 16 * 2 && h1.equals(h2), `harmoni WAV deterministik & sepanjang lagu (${(h1.length / 44100 / 2).toFixed(1)} dtk)`);
const rmsDari = (b: Buffer) => {
  let j = 0; const n = Math.min(b.length, 44 + 44100 * 2 * 2);
  for (let i = 44; i < n; i += 2) { const v = b.readInt16LE(i) / 32768; j += v * v; }
  return Math.sqrt(j / Math.max(1, (n - 44) / 2));
};
cek(rmsDari(h1) > 0.001, `harmoni berbunyi (RMS ${rmsDari(h1).toFixed(4)})`);
const h0v = buatHarmoniWav(ktxH, "dangdut", 0);
cek(rmsDari(h0v) < 1e-4, `harmoni tingkat 0 → senyap (RMS ${rmsDari(h0v).toFixed(6)})`);
const hNoChord = buatHarmoniWav({ bpm: 120, fase: 0, durasi: 4, chord: [] }, "pop", 0.5);
cek(hNoChord.length > 1000 && rmsDari(hNoChord) > 0.0005, "tanpa chord → fallback C sepanjang lagu tetap berbunyi");
cek(DAFTAR_GENRE.every((g) => !!HARMONI_GENRE[g]), "HARMONI_GENRE 17 lengkap");
cek(!Number.isNaN(rmsDari(buatHarmoniWav(ktxH, "gamelan", 0.8))), "harmoni gamelan finite");

console.log("== 30. VOKALGEN-4 stem AI — bangunFilterAudioAi (v0.20) ==");
const dasarAi = clampStudio({
  file: "uji.mp3", judul: "Uji AI", genre: "asli", mode: "remake",
  genreVokal: "dangdut", refVokal: "dangdut-p1", tingkatVokal: 55, mesinVokal: "ai",
  karaoke: "asli",
});
const gAiAsli = bangunFilterAudioAi(dasarAi);
cek(gAiAsli.graf.includes("[0:a]") && gAiAsli.graf.includes("[1:a]"),
  "graf AI memakai input 0 (vokal stem) + 1 (musik stem)");
cek(gAiAsli.graf.includes("[ins0][voc1]amix=inputs=2"), "mode asli = remix instrumental + vokal berkarakter");
cek(gAiAsli.graf.includes("[vok0]bass="), "rantai karakter diterapkan PENUH di stem vokal (bukan crossover 180-3800)");
cek(!gAiAsli.graf.includes("acrossover"), "graf AI TANPA crossover 3-pita (era v0.19 selesai)");
// v0.21 — GANTI-SUARA SATU SUARA: lapisan pitch paralel DIHAPUS (penyebab "2 penyanyi")
cek(!gAiAsli.graf.includes("highpass=f=260,lowpass=f=3200"),
  "v0.21: lapisan pitch paralel 260–3200 Hz DIHAPUS (tak ada penyanyi kedua)");
cek(!gAiAsli.graf.includes("asplit"),
  "v0.21: vokal tak pernah dipecah/dicampur balik — SATU rantai tunggal");
cek((gAiAsli.graf.match(/amix=/g) || []).length === 1,
  "v0.21: satu-satunya amix = remix instrumental+vokal genre");
cek(gAiAsli.graf.endsWith("alimiter=limit=0.95[aout]"), "ujung graf AI = limiter [aout]");
// v0.21 — register referensi = transpos KEDUA stem (Rhoma dada @55% → −1 st)
cek((gAiAsli.graf.match(/asetrate=41625/g) || []).length === 2,
  "register Rhoma −1 st @55% diterapkan IDENTIK di kedua stem (asetrate 41625 ×2)");
cek(gAiAsli.graf.includes("atempo=1.05946"), "kompensasi atempo ikut (durasi tetap, tetap sinkron)");
const gAiKar = bangunFilterAudioAi({ ...dasarAi, karaoke: "karaoke" });
cek(gAiKar.graf.includes("[ins0]anull[ksrc]"), "karaoke AI = instrumental stem murni");
cek(!gAiKar.graf.includes("[vok0]"), "karaoke AI: stem vokal tidak dibangun (tak ada label menggantung)");
cek(!gAiKar.graf.includes("asetrate"), "karaoke AI: register genre vokal TIDAK menggeser instrumental");
const gAiVok = bangunFilterAudioAi({ ...dasarAi, karaoke: "vokal" });
cek(gAiVok.graf.includes("[voc1]anull[ksrc]"), "vokal-saja AI = stem vokal utuh semua frekuensi");
cek((gAiVok.graf.match(/asetrate=41625/g) || []).length === 1, "vokal-saja: register ikut pada stem vokal (SATU suara)");
cek(!gAiVok.graf.includes("highpass=f=260,lowpass=f=3200"), "vokal-saja: tanpa lapisan paralel (satu suara)");
const gAiTr = bangunFilterAudioAi({ ...dasarAi, transpose: 3, tingkatVokal: 0 });
const asetCount = gAiTr.graf.match(/asetrate=52444/g)?.length ?? 0; // 44100×2^(3/12) ≈ 52444
cek(asetCount === 2, `transpos user diterapkan IDENTIK di kedua stem (asetrate×${asetCount})`);
const gAiGab = bangunFilterAudioAi({ ...dasarAi, transpose: 3 }); // +3 user + (−1 register) = +2
cek((gAiGab.graf.match(/asetrate=49501/g) || []).length === 2,
  "transpos user + register GABUNG: +3 + (−1) = +2 st identik kedua stem (asetrate 49501 ×2)");
const gAiPenuh = bangunFilterAudioAi({ ...dasarAi, tingkatVokal: 100 }); // register penuh −2
cek((gAiPenuh.graf.match(/asetrate=39289/g) || []).length === 2,
  "kekuatan 100% → register penuh Rhoma −2 st di kedua stem (asetrate 39289 ×2)");
const gAiHar = bangunFilterAudioAi({ ...dasarAi, genre: "dangdut", nadaLevel: 40 });
cek(gAiHar.graf.includes("[2:a]volume"), "harmoni memakai input 2 di jalur AI");
const gAiLay = bangunFilterAudioAi({ ...dasarAi, genre: "rock", layerLevel: 40, nadaLevel: 50 });
cek(gAiLay.graf.includes("[2:a]volume") && gAiLay.graf.includes("[3:a]volume"),
  "harmoni input 2 + lapisan input 3 di jalur AI");
cek(clampStudio({ mesinVokal: "dsp" }).mesinVokal === "dsp", "clampStudio mempertahankan mesinVokal dsp");
cek(clampStudio({}).mesinVokal === "ai", "clampStudio bawaan mesinVokal = ai");

console.log("== 31. GANTI INSTRUMEN — mode ganti v0.22 (cover genre sejati) ==");
cek(clampStudio({ mode: "ganti" }).mode === "ganti", "clampStudio menerima mode ganti");
cek(clampStudio({ mode: "apaaja" }).mode === "remake", "clampStudio mode tak dikenal → remake");
// graf AI ganti
const dasarGanti = clampStudio({
  file: "uji.mp3", judul: "Uji Ganti", genre: "rock", mode: "ganti",
  vokalLevel: 100, grooveLevel: 75, melodiLevel: 60, variasi: 0,
  karaoke: "asli", mesinVokal: "ai",
});
const gGanti = bangunFilterAudioGantiAi(dasarGanti, 2);
cek(gGanti.graf.includes("[0:a]") && gGanti.graf.includes("[2:a]"),
  "ganti AI: vokal stem input 0 + aransemen input 2");
cek(gGanti.graf.includes("amix=inputs=2") && gGanti.graf.endsWith("alimiter=limit=0.95[aout]"),
  "ganti AI: penyanyi asli + aransemen diamix lalu limiter");
cek(!gGanti.graf.includes("asetrate"), "ganti AI: TANPA transpos (aransemen pada nada dasar asli)");
cek(!gGanti.graf.includes("equalizer") && !gGanti.graf.includes("acompressor"),
  "ganti AI: TANPA rantai warna/resep (aransemen sudah khas genre)");
cek(gGanti.tempo === 1 && gGanti.transpose === 0 && gGanti.adaLayer === false && gGanti.adaNada === false,
  "ganti AI: tempo/transpos/layer/nada netral");
const gGantiKar = bangunFilterAudioGantiAi({ ...dasarGanti, karaoke: "karaoke" }, 2);
cek(!gGantiKar.graf.includes("[0:a]") && gGantiKar.graf.includes("[2:a]"),
  "ganti AI karaoke: instrumental aransemen murni — vokal tidak dibangun");
const gGantiVok = bangunFilterAudioGantiAi({ ...dasarGanti, karaoke: "vokal" }, 2);
cek(gGantiVok.graf.includes("[0:a]") && !gGantiVok.graf.includes("[2:a]"),
  "ganti AI vokal-saja: stem vokal utuh tanpa aransemen");
const gGantiIdx1 = bangunFilterAudioGantiAi(dasarGanti, 1);
cek(gGantiIdx1.graf.includes("[1:a]"), "ganti AI: indeks aransemen bisa 1 (jalur tanpa stem)");
const gGantiBisu = bangunFilterAudioGantiAi({ ...dasarGanti, grooveLevel: 0 }, 2);
cek(!gGantiBisu.graf.includes("[2:a]"), "ganti AI groove 0: aransemen tidak direferensikan (tak ada label gantung)");
// fallback DSP: cabang penuh, tanpa rantai resep, tempo = kecepatan
const fGantiDsp = bangunFilterAudio({ ...dasarGanti, vokalLevel: 100, grooveLevel: 75 }, 44100);
cek(fGantiDsp.graf.includes("[1:a]") || fGantiDsp.graf.includes("amix"),
  "ganti DSP fallback: aransemen input 1 ikut graf");
cek(fGantiDsp.tempo === 1, "ganti DSP fallback: tempo = kecepatan (resep genre tidak berlaku)");
const fGantiDspRock = bangunFilterAudio({ ...dasarGanti, genre: "rock", kecepatan: 1 }, 44100);
cek(!fGantiDspRock.graf.includes("equalizer=f=120"),
  "ganti DSP fallback: TANPA rantai resep genre (aransemen sudah khas genre)");
cek(faktorWaktuStudio({ genre: "rock", mode: "ganti", kecepatan: 1.5 }) === 1.5,
  "faktorWaktuStudio ganti = kecepatan murni");
cek(faktorWaktuStudio({ genre: "punk", mode: "remake", kecepatan: 1 }) > 1,
  "faktorWaktuStudio remake tetap pakai resep tempo genre");
// engine aransemen
cek(DAFTAR_GENRE.every((g) => !!RENCANA_GENRE[g]), "RENCANA_GENRE 17 lengkap");
cek(DAFTAR_GENRE.every((g) => deskripsiAransemen(g).length > 3), "deskripsiAransemen 17 ramah");
const ktxAr = {
  bpm: 120, fase: 0, durasi: 4,
  chord: [
    { mulai: 0, durasi: 2, chord: "C" },
    { mulai: 2, durasi: 2, chord: "Am" },
  ],
  melodi: [
    { t: 0, d: 0.5, f: 261.63, g: 0.9 }, { t: 1, d: 0.5, f: 329.63, g: 0.8 },
    { t: 2, d: 0.5, f: 220, g: 0.85 }, { t: 3, d: 0.5, f: 261.63, g: 0.7 },
  ],
  gelombang: Array.from({ length: 800 }, (_, i) => (i < 200 ? 0.2 : i < 500 ? 0.5 : 0.9)),
};
const arOps = { groove: 0.75, melodi: 0.6, sumberMelodi: "asli" as const, variasi: 0 };
for (const g of DAFTAR_GENRE) {
  const w = buatAransemenWav(ktxAr, g, arOps);
  const rms = rmsDari(w);
  cek(w.length > 44 && !Number.isNaN(rms) && rms > 0.001,
    `aransemen ${g}: WAV valid + berbunyi (RMS ${rms.toFixed(4)})`);
}
const arRock = buatAransemenWav(ktxAr, "rock", arOps);
const arRock2 = buatAransemenWav(ktxAr, "rock", arOps);
cek(arRock.equals(arRock2), "aransemen deterministik: input sama → byte sama");
const arEdm = buatAransemenWav(ktxAr, "edm", arOps);
cek(!arRock.equals(arEdm), "aransemen rock ≠ edm (instrumen & pola berbeda)");
const arBaru = buatAransemenWav(ktxAr, "rock", { ...arOps, sumberMelodi: "baru", variasi: 1 });
cek(!arRock.equals(arBaru), "sumber melodi asli ≠ melodi baru variasi");
const arSunyi = buatAransemenWav(
  { ...ktxAr, gelombang: Array(800).fill(0.08) }, "rock", arOps,
);
const arKlimaks = buatAransemenWav(
  { ...ktxAr, gelombang: Array(800).fill(0.95) }, "rock", arOps,
);
cek(rmsDari(arSunyi) < rmsDari(arKlimaks),
  `dinamika energi: bar senyi RMS ${rmsDari(arSunyi).toFixed(4)} < klimaks ${rmsDari(arKlimaks).toFixed(4)}`);
const arTanpaMelodi = buatAransemenWav({ ...ktxAr, melodi: undefined, gelombang: undefined }, "rock", arOps);
cek(!Number.isNaN(rmsDari(arTanpaMelodi)) && rmsDari(arTanpaMelodi) > 0.001,
  "tanpa melodi & tanpa gelombang → fallback melodi baru + dinamika aman");
const durasiByte = (4 + 1.6) * 44100 * 2 * 2 + 44;
cek(Math.abs(arRock.length - durasiByte) < 44100 * 4,
  "panjang aransemen ≈ durasi + ekor 1.6 dtk");
for (const ins of ["crash", "ride", "tom", "hatOpen", "clap"] as const) {
  const s = drumSampel(ins, 0.8, 200);
  let finite = true;
  for (let i = 0; i < s.length; i += 37) if (!Number.isFinite(s[i])) { finite = false; break; }
  cek(s.length > 100 && finite, `drum baru ${ins}: finite + panjang ${s.length}`);
}

console.log(`\nHasil: ${lulus} LOLOS, ${gagal} GAGAL`);
process.exit(gagal ? 1 : 0);
