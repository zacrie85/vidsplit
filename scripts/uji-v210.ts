// VidSplit v2.1.0 — uji unit + integrasi UPGRADE BACKGROUND INTRO + THUMBNAIL OTOMATIS:
//   (1) pilihBgPart (gating introTampil), (2) offsetBacksound dgn introUntuk,
//   (3) rantaiIntroBg (Ken Burns zoompan + teks intro + panjang fade),
//   (4) bangunArgumenPart 8 kombinasi bg×suara×logo (indeks input + afade + xfade),
//   (5) thumbnail (bersihkanNamaJudul/label/detik/args), (6) migrasiSimpanan V2.1,
//   (7) render NYATA: intro animasi+fade+teks+suara, thumbnail, + regresi jalur lama.
// Jalankan: npx tsx scripts/uji-v210.ts
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import {
  migrasiSimpanan,
  offsetBacksound,
  pilihBgPart,
  pengaturanDefault,
  rapikanThumbnail,
  type OpsiThumbnail,
  type Pengaturan,
} from "../src/lib/vidsplit/types";
import { bangunArgumenPart, dirWork, rantaiIntroBg } from "../src/lib/vidsplit/ffmpeg";
import {
  bangunArgumenThumbnail,
  bersihkanNamaJudul,
  detikFrameThumbnail,
  labelThumbnail,
} from "../src/lib/vidsplit/thumbnail";

let lulus = 0;
let gagal = 0;
const cek = (k: boolean, label: string, detail = "") => {
  if (k) {
    lulus++;
    console.log(`  [LOLOS] ${label}`);
  } else {
    gagal++;
    console.error(`  [GAGAL] ${label} ${detail}`);
  }
};
const DIR = dirWork("tmp");

const aturDasar = (extra: Partial<Pengaturan> = {}): Pengaturan => ({
  ...pengaturanDefault,
  ...extra,
});

/* ================= (1) PILIH BG PART (introTampil) ================= */
console.log("\n== (1) GATING INTRO — pilihBgPart ==");
cek(pilihBgPart("semua", 1, 5) && pilihBgPart("semua", 3, 5) && pilihBgPart("semua", 5, 5), "semua → semua part true");
cek(pilihBgPart("pertama", 1, 10) && !pilihBgPart("pertama", 2, 10) && !pilihBgPart("pertama", 10, 10), "pertama → hanya part 1");
cek(pilihBgPart("pertama-terakhir", 1, 5) && !pilihBgPart("pertama-terakhir", 3, 5) && pilihBgPart("pertama-terakhir", 5, 5), "pertama-terakhir → 1 & 5");
cek(pilihBgPart("pertama-terakhir", 1, 1), "total 1 → part 1 tetap dapat intro");
cek(pilihBgPart(undefined, 3, 5), "undefined (simpanan lama) = semua (perilaku lama)");
cek(pilihBgPart("aneh" as never, 3, 5), "nilai tak dikenal = semua (aman)");

/* ================= (2) OFFSET BACKSOUND + introUntuk ================= */
console.log("\n== (2) OFFSET BACKSOUND dgn GATING ==");
// part 60 dtk, intro 3: part1 ber-intro, part2 TIDAK ("pertama")
const pertama = (k: number) => k <= 1;
cek(
  Math.abs(offsetBacksound(2, 600, 60, 0, 0, [], true, 3, 1, pertama) - 63) < 1e-9,
  `part 2 (pertama) → 60+3 = 63 (${offsetBacksound(2, 600, 60, 0, 0, [], true, 3, 1, pertama)})`,
);
cek(
  Math.abs(offsetBacksound(3, 600, 60, 0, 0, [], true, 3, 1, pertama) - 123) < 1e-9,
  `part 3 (pertama) → 60+3+60 = 123 (part 2 tanpa intro)`,
);
cek(
  Math.abs(offsetBacksound(3, 600, 60, 0, 0, [], true, 3, 1) - 126) < 1e-9,
  "tanpa predikat → perilaku lama 126 (semua part ber-intro)",
);
cek(
  Math.abs(offsetBacksound(2, 600, 60, 0, 0, [], false, 3, 1, pertama) - 60) < 1e-9,
  "pakaiIntro false → intro tak dihitung",
);

/* ================= (3) RANTAI INTRO BG (Ken Burns + teks + fade) ================= */
console.log("\n== (3) rantaiIntroBg ==");
const RANTAI_LAMA =
  "[1:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30,setsar=1,trim=duration=3.000,setpts=PTS-STARTPTS[bgv]";
const pDiam = aturDasar({ introAnimasi: "mati", introFade: false, introTeks: "" });
cek(rantaiIntroBg(pDiam, 1080, 1920, 30, 3, null, "") === RANTAI_LAMA, "animasi mati + tanpa fade = rantai lama PERSIS (nol regresi)");

const pZoomMasuk = aturDasar({ introAnimasi: "zoom-masuk", introFade: false });
const rZm = rantaiIntroBg(pZoomMasuk, 1080, 1920, 30, 3, null, "");
cek(rZm.includes("zoompan=z='min(1+0.12*on/"), "zoom-masuk: z menaik halus");
cek(rZm.includes("fps=30:s=1080x1920"), "zoom-masuk: fps & s=W×H");
cek(rZm.includes("scale=2160:3840"), "zoom-masuk: upscale 2× (anti-jitter)");
cek(rZm.includes("trim=duration=3.000"), "tanpa fade → panjang tetap N");

const pZoomKeluar = aturDasar({ introAnimasi: "zoom-keluar", introFade: false });
const rZk = rantaiIntroBg(pZoomKeluar, 1080, 1920, 30, 3, null, "");
cek(rZk.includes("zoompan=z='max(1+0.12-0.12*on/"), "zoom-keluar: z menurun halus");

const pGeser = aturDasar({ introAnimasi: "geser-kiri", introFade: false });
const rGk = rantaiIntroBg(pGeser, 1080, 1920, 30, 3, null, "");
cek(rGk.includes("z='1.08'") && rGk.includes("(iw-iw/zoom)*min(on/"), "geser-kiri: zoom 8% + meluncur");
cek(rGk.includes("y='ih/2-(ih/zoom/2)'"), "geser: y tetap tengah (ih, bukan iw)");
const pGeser2 = aturDasar({ introAnimasi: "geser-kanan", introFade: false });
cek(rantaiIntroBg(pGeser2, 1080, 1920, 30, 3, null, "").includes("(iw-iw/zoom)-"), "geser-kanan: arah berlawanan");

const pFade = aturDasar({ introAnimasi: "mati", introFade: true });
const rF = rantaiIntroBg(pFade, 1080, 1920, 30, 3, null, "");
cek(rF.includes("trim=duration=3.500"), "fade → gambar diperpanjang N+0.5 (xfade tak kehabisan input)");

const fileTeks = path.join(DIR, "uji-v210-intro.txt");
const pTeks = aturDasar({ introAnimasi: "mati", introFade: false, introTeks: "ALAM GAIB", introTeksFont: "anton", introTeksUkuran: 64, introTeksWarna: "#ff0000" });
const rT = rantaiIntroBg(pTeks, 1080, 1920, 30, 3, fileTeks, "ALAM GAIB");
cek(rT.includes("drawtext=textfile="), "teks intro: drawtext textfile");
cek(rT.includes("fontsize=64.0"), "teks intro: ukuran 64 @ skala 1");
cek(rT.includes("fontcolor=0xff0000"), "teks intro: warna dari pengaturan (format ffmpeg 0x)");
cek(rT.includes("expansion=none"), "teks intro: expansion=none (teks %{ aman)");
cek(rT.includes("borderw=4") && rT.includes("bordercolor=black"), "teks intro: outline hitam otomatis");
cek(rT.includes("y=H*0.42"), "teks intro: posisi 42% tinggi");

/* ================= (4) BANGUN ARGUMEN PART — kombinasi ================= */
console.log("\n== (4) bangunArgumenPart — bg × suara × logo ==");
// berkas NYATA (render nyata membutuhkan PNG/suara valid; uji args cuma butuh existsSync)
const fBg = path.join(DIR, "uji-v210-bg.png");
const fSuara = path.join(DIR, "uji-v210-suara.mp3");
const fLogo = path.join(DIR, "uji-v210-logo.png");
if (!existsSync(fBg))
  execFileSync("ffmpeg", ["-y", "-v", "error", "-f", "lavfi", "-i", "gradients=s=540x960:c0=#0b1210:c1=#243b32:d=1", "-frames:v", "1", fBg]);
if (!existsSync(fSuara))
  execFileSync("ffmpeg", ["-y", "-v", "error", "-f", "lavfi", "-i", "sine=frequency=440:duration=4", "-ar", "44100", "-ac", "2", fSuara]);
if (!existsSync(fLogo))
  execFileSync("ffmpeg", ["-y", "-v", "error", "-f", "lavfi", "-i", "color=c=white:s=120x40:d=1", "-frames:v", "1", fLogo]);
const VID = "/tmp/uji-v210-vid.mp4";
if (!existsSync(VID)) {
  execFileSync("ffmpeg", ["-y", "-v", "error", "-f", "lavfi", "-i", "testsrc=s=320x240:d=6:r=25", "-f", "lavfi", "-i", "sine=frequency=440:duration=6", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", VID]);
}
const codec = ["-c:v", "libx264", "-preset", "ultrafast", "-crf", "30"];

const pLengkap = aturDasar({ introAnimasi: "zoom-masuk", introFade: true, introTeks: "ALAM GAIB", introSuaraVolume: 100 });
const { args: a1, total: t1 } = bangunArgumenPart({
  src: VID, bg: fBg, logo: fLogo, pengaturan: pLengkap, n: 1, mulai: 0, durasi: 4,
  W: 1080, H: 1920, fps: 25, adaAudio: true,
  judulTxt: "Judul", partTxt: "Part 1", deskripsiTxt: "",
  fileSuaraIntro: fSuara,
  dirTmp: DIR, tag: "uji-v210-a", codecArgs: codec, keluar: "/tmp/uji-v210-a.mp4",
});
cek(Math.abs(t1 - 7) < 1e-9, `total = intro 3 + durasi 4 = 7 (${t1})`);
const idxBg1 = a1.indexOf(fBg);
const idxSuara1 = a1.indexOf(fSuara);
// struktur input bg animasi: [..., "-framerate","25","-loop","1","-t","3.500","-i",fBg]
cek(a1[idxBg1 - 7] === "-framerate" && a1[idxBg1 - 6] === "25", "animasi → input bg diberi -framerate fps");
cek(a1[idxBg1 - 2] === "3.500", "fade → -t bg = 3.500 (N + D)");
cek(a1[idxSuara1 + 1] === "-filter_complex", "suara intro = input TERAKHIR (tepat sebelum -filter_complex)");
const fl1 = a1[a1.indexOf("-filter_complex") + 1];
cek(fl1.includes("[4:a]aformat") && fl1.includes("atrim=duration=3.000"), "suara idx 4 + atrim N (bg+audio+logo → suara ke-4)");
cek(fl1.includes("[sia][ma]concat=n=2:v=0:a=1"), "suara + audio asli → concat 2 segmen");
cek(fl1.includes("afade=t=out:st=2.500:d=0.500"), "suara intro fade-out saat fade aktif");
cek(fl1.includes("afade=t=in:st=0:d=0.500"), "audio sumber fade-in saat fade aktif");
cek(fl1.includes("volume=1.000"), "volume 100% → 1.000");
cek(fl1.includes("xfade=transition=fade:duration=0.500:offset=3.000"), "video: xfade fade lembut offset=N");
cek(fl1.includes("[bgx][ccx]xfade"), "video: kedua cabang lewat format=yuv420p (kompatibel xfade)");
cek(!fl1.includes("concat=n=2:v=1:a=0"), "fade aktif → concat video TIDAK dipakai");

// kombinasi: TANPA fade (semua fitur baru mati kecuali bg) — struktur lama
const pLama = aturDasar({ introAnimasi: "mati", introFade: false, introTeks: "", introSuaraFile: "" });
const { args: a2 } = bangunArgumenPart({
  src: VID, bg: fBg, logo: null, pengaturan: pLama, n: 1, mulai: 0, durasi: 4,
  W: 1080, H: 1920, fps: 25, adaAudio: true,
  judulTxt: "", partTxt: "", deskripsiTxt: "",
  dirTmp: DIR, tag: "uji-v210-b", codecArgs: codec, keluar: "/tmp/uji-v210-b.mp4",
});
const fl2 = a2[a2.indexOf("-filter_complex") + 1];
cek(!a2.includes("-framerate"), "tanpa animasi → TANPA -framerate (argumen input lama)");
cek(a2.includes("-loop") && a2.includes("3.000"), "tanpa fade → -t bg = 3.000 persis lama");
cek(fl2.includes("[2:a][ma]concat=n=2:v=0:a=1") && !fl2.includes("afade"), "audio lama: concat hening+sumber, tanpa afade");
cek(fl2.includes("[bgv][mv]concat=n=2:v=1:a=0[cc]"), "video lama: concat bg+utama persis");
cek(fl2.includes("[1:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=25,setsar=1,trim=duration=3.000"), "rantai bg statis = lama");

// kombinasi: video TANPA audio + suara intro → hening setelah intro
const { args: a3 } = bangunArgumenPart({
  src: VID, bg: fBg, logo: null, pengaturan: pLengkap, n: 1, mulai: 0, durasi: 4,
  W: 1080, H: 1920, fps: 25, adaAudio: false,
  judulTxt: "", partTxt: "", deskripsiTxt: "",
  fileSuaraIntro: fSuara,
  dirTmp: DIR, tag: "uji-v210-c", codecArgs: codec, keluar: "/tmp/uji-v210-c.mp4",
});
const fl3 = a3[a3.indexOf("-filter_complex") + 1];
cek(fl3.includes("[2:a]atrim=start=3.000") && fl3.includes("[sia][seN]concat=n=2:v=0:a=1"), "tanpa audio asli: suara intro + hening sisanya");
const maps3 = a3.map((x, i) => (a3[i - 1] === "-map" ? x : null)).filter(Boolean) as string[];
cek(maps3.includes("[aout]"), "tanpa audio asli + suara → map [aout]");

// kombinasi: TANPA bg — suara intro & fade harus DIABAIKAN (tidak crash, indeks utuh)
const { args: a4 } = bangunArgumenPart({
  src: VID, bg: null, logo: fLogo, pengaturan: pLengkap, n: 1, mulai: 0, durasi: 4,
  W: 1080, H: 1920, fps: 25, adaAudio: false,
  judulTxt: "", partTxt: "", deskripsiTxt: "",
  fileSuaraIntro: fSuara,
  dirTmp: DIR, tag: "uji-v210-d", codecArgs: codec, keluar: "/tmp/uji-v210-d.mp4",
});
const fl4 = a4[a4.indexOf("-filter_complex") + 1];
cek(!fl4.includes("[sia]"), "tanpa bg → suara intro diabaikan");
cek(!fl4.includes("xfade"), "tanpa bg → tanpa xfade");
cek(a4.indexOf(fLogo) === a4.indexOf(fSuara) + 1 || a4.indexOf(fSuara) === -1, "tanpa bg → input suara tak dimasukkan");

/* ================= (5) THUMBNAIL OTOMATIS ================= */
console.log("\n== (5) THUMBNAIL ==");
cek(bersihkanNamaJudul("Horror_Nights-EP4.mp4") === "Horror Nights", `EP di ujung dibuang (${bersihkanNamaJudul("Horror_Nights-EP4.mp4")})`);
cek(bersihkanNamaJudul("Hutan_Mistis_Episode_12.mp4") === "Hutan Mistis", `episode di ujung dibuang (${bersihkanNamaJudul("Hutan_Mistis_Episode_12.mp4")})`);
cek(bersihkanNamaJudul("ALAM GAIB Part 03.mp4") === "ALAM GAIB", `part di ujung dibuang`);
cek(bersihkanNamaJudul("Dokumenter_Laut_1080p.mp4") === "Dokumenter Laut", `kualitas di ujung dibuang`);
cek(bersihkanNamaJudul("vlog-pantai.mp4") === "vlog pantai", `pisah garis jadi spasi (${bersihkanNamaJudul("vlog-pantai.mp4")})`);
cek(bersihkanNamaJudul("___-.mp4") === "Video", "kosong → fallback 'Video'");
cek(labelThumbnail({ kata: "Episode" } as OpsiThumbnail, 7) === "Episode 07", "label Episode 07 (2 digit)");
cek(labelThumbnail({ kata: "Part" } as OpsiThumbnail, 3) === "Part 03", "label Part 03");
cek(labelThumbnail({ kata: "Bagian" } as OpsiThumbnail, 12) === "Bagian 12", "label Bagian 12");
cek(detikFrameThumbnail(10, 20) === 17, "35% dari part → detik 17");
cek(detikFrameThumbnail(0, 0) === 0, "durasi 0 → detik 0 (aman)");
const fJ = path.join(DIR, "uji-v210-thumb-j.txt");
const fL = path.join(DIR, "uji-v210-thumb-l.txt");
const { writeFileSync } = require("node:fs") as typeof import("node:fs");
writeFileSync(fJ, "Horror Nights", "utf8");
writeFileSync(fL, "Part 01", "utf8");
const atJpg = bangunArgumenThumbnail({
  src: VID, detik: 2.1, judulTxt: "Horror Nights", labelTxt: "Part 01",
  W: 1080, H: 1920, fileJudul: fJ, fileLabel: fL,
  ukuranJudul: 52, ukuranLabel: 74, fontfile: "", keluar: "/tmp/uji-v210-thumb.jpg", format: "jpg",
});
const iFc = atJpg.indexOf("-filter_complex");
cek(atJpg[iFc - 5] === "2.100", `-ss detik tepat (${atJpg[iFc - 5]})`);
cek(atJpg.includes("-frames:v") && atJpg.includes("1"), "cuma 1 frame");
cek(atJpg[iFc + 1].includes("drawtext=textfile=") && atJpg[iFc + 1].includes("expansion=none"), "drawtext textfile + expansion=none");
cek(atJpg[iFc + 1].includes("drawbox"), "kotak gelap di belakang teks");
cek(atJpg.includes("-q:v") && atJpg.includes("2"), "JPG → -q:v 2");
cek(atJpg[atJpg.length - 1] === "/tmp/uji-v210-thumb.jpg", "argumen terakhir = keluaran");
const atPng = bangunArgumenThumbnail({
  src: VID, detik: 0, judulTxt: "X", labelTxt: "",
  W: 1081, H: 1921, fileJudul: fJ, fileLabel: fL,
  ukuranJudul: 52, ukuranLabel: 74, fontfile: "", keluar: "/tmp/uji-v210-thumb.png", format: "png",
});
cek(atPng.includes("-pred") && atPng.includes("mixed"), "PNG → -pred mixed");
cek(atPng[iFc + 1].includes("scale=1082:1922"), "dimensi digenapkan (1081→1082, 1921→1922)");
cek(!atPng[iFc + 1].includes("drawbox=x=0:y=" + Math.round(1922 * 0.76)), "label kosong → tanpa kotak label");
cek(rapikanThumbnail({ aktif: true, kata: "Episode", format: "png" }).aktif, "rapikanThumbnail lolos");
cek(rapikanThumbnail({ kata: "aneh" }).kata === "Part" && rapikanThumbnail({ format: "gif" }).format === "jpg", "rapikanThumbnail nilai aneh → bawaan");
cek(rapikanThumbnail(null).aktif === false, "rapikanThumbnail null → mati");

/* ================= (6) MIGRASI SIMPANAN V2.1 ================= */
console.log("\n== (6) migrasiSimpanan V2.1.0 ==");
const m1 = migrasiSimpanan({});
cek(m1.introAnimasi === "mati" && m1.introTampil === "semua", "simpanan lama → animasi mati, tampil semua (perilaku lama)");
cek(m1.introFade === true, "simpanan lama → fade lembut AKTIF (pengalaman baru)");
cek(m1.introTeks === "" && m1.introSuaraFile === "", "teks & suara kosong");
cek(m1.introTeksUkuran === 64 && m1.introSuaraVolume === 100, "ukuran 64 & volume 100");
const m2 = migrasiSimpanan({ introTeksUkuran: 9999, introSuaraVolume: 5000 } as Partial<Pengaturan>);
cek(m2.introTeksUkuran === 160 && m2.introSuaraVolume === 150, "nilai ekstrem di-clamp");

/* ================= (7) RENDER NYATA ================= */
console.log("\n== (7) RENDER NYATA ffmpeg ==");
// suara intro 1.5 dtk (lebih pendek dr intro 3 dtk → uji LOOP)
const fSuaraPendek = path.join(DIR, "uji-v210-suara-pendek.mp3");
execFileSync("ffmpeg", ["-y", "-v", "error", "-f", "lavfi", "-i", "sine=frequency=660:duration=1.5", "-ar", "44100", "-ac", "2", fSuaraPendek]);
// (A) intro animasi + fade + teks + suara + audio asli → satu render utk semua fitur
const keluarA = "/tmp/uji-v210-render-a.mp4";
const { args: argsA, total: totalA } = bangunArgumenPart({
  src: VID, bg: fBg, logo: null, pengaturan: pLengkap, n: 1, mulai: 0, durasi: 4,
  W: 720, H: 1280, fps: 25, adaAudio: true,
  judulTxt: "", partTxt: "", deskripsiTxt: "",
  fileSuaraIntro: fSuaraPendek,
  dirTmp: DIR, tag: "uji-v210-ra", codecArgs: ["-c:v", "libx264", "-preset", "ultrafast", "-crf", "30"], keluar: keluarA,
});
execFileSync("ffmpeg", argsA, { stdio: ["ignore", "ignore", "pipe"] });
const prA = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", keluarA]).toString());
const durA = Number(prA.format.duration);
cek(Math.abs(durA - totalA) < 0.35, `render lengkap: durasi ${durA.toFixed(2)} ≈ ${totalA} (intro+fade+video)`);
cek((prA.streams as Array<{ codec_type: string }>).some((s) => s.codec_type === "audio"), "hasil punya trek audio (suara intro + sumber)");
// (B) thumbnail nyata
const keluarT = "/tmp/uji-v210-thumb-nyata.jpg";
const argsT2 = bangunArgumenThumbnail({
  src: VID, detik: detikFrameThumbnail(0, 4), judulTxt: "Horror Nights", labelTxt: "Part 01",
  W: 1080, H: 1920, fileJudul: fJ, fileLabel: fL,
  ukuranJudul: 52, ukuranLabel: 74, fontfile: "", keluar: keluarT, format: "jpg",
});
execFileSync("ffmpeg", argsT2, { stdio: ["ignore", "ignore", "pipe"] });
cek(existsSync(keluarT) && statSync(keluarT).size > 10_000, `thumbnail nyata dibuat (${statSync(keluarT).size} B)`);
const prT = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-print_format", "json", "-show_streams", keluarT]).toString());
const vT = (prT.streams as Array<{ codec_type: string; width: number; height: number }>).find((s) => s.codec_type === "video");
cek(!!vT && vT.width === 1080 && vT.height === 1920, `thumbnail 1080×1920 (${vT?.width}×${vT?.height})`);
// (C) regresi jalur lama: bg statis + tanpa fade/suara → render sukses, durasi N+M
const keluarC = "/tmp/uji-v210-b.mp4"; // a2 sudah memakai keluar ini
execFileSync("ffmpeg", a2, { stdio: ["ignore", "ignore", "pipe"] });
const prC = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-print_format", "json", "-show_format", keluarC]).toString());
cek(Math.abs(Number(prC.format.duration) - 7) < 0.35, `jalur lama tetap jalan: durasi ${Number(prC.format.duration).toFixed(2)} ≈ 7`);

console.log(`\n===== HASIL: ${lulus} LOLOS, ${gagal} GAGAL =====`);
if (gagal > 0) process.exit(1);
