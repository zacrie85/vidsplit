// Uji unit v0.46.0 — TEMPLATE HALAMAN + FRAME HIASAN:
//   (a) TATA_TEMPLATE dalam batas 0–100, jendela video di dalam kanvas
//   (b) kotakKePx konversi benar utk 1080×1920 & 720×1280
//   (c) svgLatarTemplate: gradasi + 4 kotak; svgMaskLatarTemplate: lubang evenodd
//   (d) svgFrameNeon mode template (rect kotak)
//   (e) rapikanTemplat / terapkanFrame / urlBingkai
//   (f) bangunArgumenPart: input baru + urutan overlay + label teks template
//   (g) siapkanBingkai: bawaan/upload/tidak-ada
// Jalankan: bun scripts/uji-templat.ts
import { mkdtempSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  PRESET_GRADASI,
  TATA_TEMPLATE,
  kotakKePx,
  rapikanTemplat,
  svgLatarTemplate,
  svgMaskLatarTemplate,
} from "../src/lib/vidsplit/templatLayar";
import { siapkanLatarTemplate } from "../src/lib/vidsplit/templatRender";
import { svgFrameNeon } from "../src/lib/vidsplit/neonLayar";
import { bangunArgumenPart, dirWork, type SeqNeon } from "../src/lib/vidsplit/ffmpeg";
import {
  pengaturanDefault,
  terapkanFrame,
  urlBingkai,
  type Pengaturan,
} from "../src/lib/vidsplit/types";

let lolos = 0;
let gagal = 0;
function ok(kondisi: boolean, nama: string, detail = "") {
  if (kondisi) lolos++;
  else {
    gagal++;
    console.error(`  ✗ ${nama}${detail ? ` — ${detail}` : ""}`);
  }
}

/* (a) geometri */
const kotak = Object.values(TATA_TEMPLATE);
for (const k of kotak) {
  ok(k.x >= 0 && k.y >= 0 && k.x + k.w <= 100 && k.y + k.h <= 100, `kotak dalam kanvas (${JSON.stringify(k)})`);
}
const vj = TATA_TEMPLATE.judul;
const vv = TATA_TEMPLATE.video;
ok(vj.y + vj.h <= vv.y, "kotak judul di ATAS jendela video");
ok(vv.y + vv.h <= TATA_TEMPLATE.deskripsi.y, "jendela video di ATAS kotak deskripsi");
ok(TATA_TEMPLATE.deskripsi.y + TATA_TEMPLATE.deskripsi.h <= TATA_TEMPLATE.part.y, "deskripsi di ATAS Part");

/* (b) kotakKePx */
const px1080 = kotakKePx(vv, 1080, 1920);
ok(px1080.w === Math.round((vv.w / 100) * 1080), "lebar px 1080 benar", String(px1080.w));
ok(px1080.h === Math.round((vv.h / 100) * 1920), "tinggi px 1080 benar", String(px1080.h));
ok(px1080.x + px1080.w <= 1080 && px1080.y + px1080.h <= 1920, "jendela muat di kanvas");
const px720 = kotakKePx(vv, 720, 1280);
ok(px720.x + px720.w <= 720 && px720.y + px720.h <= 1280, "jendela muat di kanvas 720");

/* (c) SVG latar */
const svgBg = svgLatarTemplate(1080, 1920, { grad1: "#f59e0b", grad2: "#ec4899" });
ok(svgBg.includes("linearGradient"), "latar pakai gradasi");
ok(svgBg.includes("#f59e0b") && svgBg.includes("#ec4899"), "warna gradasi masuk");
ok((svgBg.match(/<rect /g) || []).length === 5, "1 latar + 4 kotak", String((svgBg.match(/<rect /g) || []).length));
const svgMask = svgMaskLatarTemplate(1080, 1920);
ok(svgMask.includes("evenodd") && svgMask.includes("Q "), "mask punya lubang membulat");

/* (d) neon rect kotak template */
const svgNeonKotak = svgFrameNeon({
  W: px1080.w,
  H: px1080.h,
  setelan: { aktif: true, warna: "magenta", tebal: 8, kecepatan: 1, duaGaris: false },
  progres: 0.5,
});
ok(!svgNeonKotak.includes("NaN") && svgNeonKotak.includes("<path"), "neon utk rect kotak valid");

/* (e) rapikan/terapkan/url */
ok(rapikanTemplat({ grad1: "merah" as never }).grad1 === "#f59e0b", "grad1 tak valid → bawaan");
ok(rapikanTemplat({ grad1: "#123ABC" }).grad1 === "#123abc", "grad1 valid → lowercase");
const sumber: Pengaturan = {
  ...pengaturanDefault,
  frameId: "bawaan:pemilu-raya",
  neonAktif: true,
  neonWarna: "amber",
  neonTebal: 9,
  neonKecepatan: 1.5,
  neonDuaGaris: true,
  templateGrad1: "#123456",
  templateGrad2: "#654321",
};
const target = terapkanFrame(sumber, { ...pengaturanDefault });
ok(target.frameId === "bawaan:pemilu-raya" && target.neonAktif === true, "terapkanFrame menyalin frame+neon");
ok(target.neonTebal === 9 && target.neonKecepatan === 1.5 && target.neonDuaGaris, "terapkanFrame menyalin angka neon");
ok(target.templateGrad1 === "#123456" && target.templateGrad2 === "#654321", "terapkanFrame menyalin gradasi");
ok(target.judul === pengaturanDefault.judul, "terapkanFrame TIDAK menyentuh judul");
ok(urlBingkai("bawaan:metamorfosis") === "/bingkai/metamorfosis.png", "urlBingkai bawaan");
ok(urlBingkai("upload/abc-frame.png").includes("/api/file?p=upload%2Fabc-frame.png"), "urlBingkai unggahan");
ok(urlBingkai("") === "" && urlBingkai("aneh") === "", "urlBingkai id aneh → kosong");

/* (f) bangunArgumenPart dgn frame+neon+templat */
const tmp = mkdtempSync(path.join(os.tmpdir(), "uji-templat-"));
mkdirSync(path.join(tmp, "neonseq"), { recursive: true });
const pngPalsu = path.join(tmp, "frame.png");
writeFileSync(pngPalsu, "PNG");
const pngTemplat = path.join(tmp, "latar.png");
writeFileSync(pngTemplat, "PNG");
for (let i = 1; i <= 3; i++) writeFileSync(path.join(tmp, "neonseq", `f${String(i).padStart(4, "0")}.png`), "PNG");
const neon: SeqNeon = { dir: path.join(tmp, "neonseq"), fps: 20, jumlah: 3, x: 0, y: 0, w: 1080, h: 1920 };

const dasar: Omit<Parameters<typeof bangunArgumenPart>[0], "pengaturan"> = {
  src: path.join(tmp, "src.mp4"),
  bg: null,
  logo: null,
  n: 1,
  mulai: 0,
  durasi: 10,
  W: 1080,
  H: 1920,
  fps: 30,
  adaAudio: false,
  judulTxt: "Judul",
  partTxt: "Part 1",
  deskripsiTxt: "",
  dirTmp: tmp,
  tag: "t1",
  codecArgs: ["-c:v", "libx264"],
  keluar: path.join(tmp, "out.mp4"),
};

// tanpa apa pun — tidak ada input tambahan
const a0 = bangunArgumenPart({ ...dasar, pengaturan: { ...pengaturanDefault } });
ok(a0.args.filter((x) => x === "-i").length === 2, "bawaan: 2 input (src+anullsrc)", String(a0.args.filter((x) => x === "-i").length));

// frame + neon
const pFrame: Pengaturan = { ...pengaturanDefault, frameId: "bawaan:x", neonAktif: true, neonWarna: "cyan", neonTebal: 6, neonKecepatan: 1, neonDuaGaris: false };
const a1 = bangunArgumenPart({ ...dasar, pengaturan: pFrame, frameAbs: pngPalsu, neon });
const teksFilter1 = a1.args[a1.args.indexOf("-filter_complex") + 1];
ok(a1.args.filter((x) => x === "-i").length === 4, "frame+neon: 4 input (src+audio+frame+neon)", String(a1.args.filter((x) => x === "-i").length));
ok(a1.args.some((x) => x === "-stream_loop"), "neon pakai -stream_loop");
ok(teksFilter1.includes("[cc][fm]overlay=0:0[vfr]"), "frame overlay setelah [cc]");
ok(teksFilter1.includes("[vfr][nfs]overlay=0:0[vne]"), "neon overlay setelah frame");
ok(
  teksFilter1.includes("[vne]drawtext=") || teksFilter1.includes(";[vne]") || teksFilter1.includes("[vne]null"),
  "teks mengambil [vne] sebagai masukan",
);

// template + bg + logo → urutan lengkap
const pTemplat: Pengaturan = { ...pengaturanDefault, mode: "template", frameId: "bawaan:x", neonAktif: true, neonWarna: "cyan", neonTebal: 6, neonKecepatan: 1, neonDuaGaris: false };
const bgPalsu = path.join(tmp, "bg.png");
writeFileSync(bgPalsu, "PNG");
const logoPalsu = path.join(tmp, "logo.png");
writeFileSync(logoPalsu, "PNG");
const neonKotak: SeqNeon = { dir: path.join(tmp, "neonseq"), fps: 20, jumlah: 3, x: px1080.x, y: px1080.y, w: px1080.w, h: px1080.h };
const a2 = bangunArgumenPart({
  ...dasar,
  pengaturan: pTemplat,
  bg: bgPalsu,
  logo: logoPalsu,
  frameAbs: pngPalsu,
  neon: neonKotak,
  templatBg: pngTemplat,
});
const teksFilter2 = a2.args[a2.args.indexOf("-filter_complex") + 1];
ok(a2.args.filter((x) => x === "-i").length === 6, "template+bg+logo+neon: 6 input (frame DIABAIKAN di template)", String(a2.args.filter((x) => x === "-i").length));
ok(teksFilter2.includes("force_original_aspect_ratio=decrease,pad="), "template: video contain ke kotak");
ok(teksFilter2.includes(`pad=1080:1920:${px1080.x}:${px1080.y}`), "template: kotak ditempatkan pada posisi jendela");
ok(teksFilter2.includes("[vidbox][tbgx]overlay=0:0[tv1]"), "template: latar PNG di atas video");
ok(teksFilter2.includes("[bgv][tv1]concat=n=2:v=1:a=0[cc]"), "template: intro bg masih concat");
ok(teksFilter2.includes("drawtext=textfile="), "template: drawtext ada");
ok(teksFilter2.includes("-text_h/2"), "template: teks tengah kotak (text_h/2)");
ok(/\[\d+:v\]scale=1080:1920\[tbgx\]/.test(teksFilter2), "template: input templat di index 4", "");
ok(!/\[\d+:v\]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920\[fm\]/.test(teksFilter2), "TIDAK ada overlay frame di rantai template (saling menutupi)");
ok(teksFilter1.includes("force_original_aspect_ratio=increase,crop=1080:1920[fm]"), "frame cover tetap ada di mode non-template");

/* (g) siapkanBingkai */
const { siapkanBingkai } = await import("../src/lib/vidsplit/bingkai");
ok(siapkanBingkai("") === null, "frameId kosong → null");
ok(siapkanBingkai("aneh") === null, "frameId tak dikenal → null");
ok(siapkanBingkai("upload/tidak-ada-xyz.png") === null, "unggahan tak ada → null");
const bawaanPath = siapkanBingkai("bawaan:metamorfosis");
ok(!!bawaanPath && existsSync(bawaanPath), "bawaan:metamorfosis → file ada", String(bawaanPath));
ok(!!bawaanPath && bawaanPath.includes("bawaan-metamorfosis.png"), "bawaan dicopy ke work/upload");
ok(dirWork("upload").length > 0, "dirWork jalan");

/* (h) render latar template nyata (sharp) — server-side */
const latat = await siapkanLatarTemplate(1080, 1920, { grad1: "#0ea5e9", grad2: "#1e3a8a" });
ok(existsSync(latat), "latar template tersimpan");

// verifikasi piksel alpha: interior jendela transparan, kotak judul opak
const sharp = (await import("sharp")).default;
const { data, info } = await sharp(latat).raw().toBuffer({ resolveWithObject: true });
const alpha = (x: number, y: number) => data[(y * info.width + x) * info.channels + 3];
ok(alpha(540, 960) < 10, "jendela template TRANSPARAN di tengah", String(alpha(540, 960)));
ok(alpha(540, Math.round((vj.y + vj.h / 2) / 100 * 1920)) > 200, "kotak judul OPAK");
ok(alpha(30, 30) > 200, "sudut atas kiri = gradasi OPAK");

console.log(`\n=== uji-templat: ${lolos} LOLOS, ${gagal} GAGAL ===`);
if (gagal > 0) process.exit(1);


