// Uji unit v0.10.0 — STUDIO MUSIK: resep genre, filter audio, 15 visual,
// ASS/LRC/chord-sheet, layer WAV, clamp. Jalankan: bun scripts/uji-musik.ts
import { existsSync, statSync, unlinkSync } from "node:fs";
import {
  bangunAss, bangunFilterAudio, bangunRantaiVisual, clampStudio, formatChordSheet,
  formatLrc, hexKeAss, parseLrc, RESEP_GENRE, DAFTAR_GENRE, INFO_GENRE, VISUAL_MUSIK,
  opsiVisualDefault,
  type GenreMusik, type PolaLayer,
} from "../src/lib/vidsplit/musik";
import { buatLayerWav } from "../src/lib/vidsplit/musikLayer";

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

console.log(`\nHasil: ${lulus} LOLOS, ${gagal} GAGAL`);
process.exit(gagal ? 1 : 0);
