// uji-selar-bingkai.ts — verifikasi VISUAL: bingkai harus memeluk blok teks
// drawtext persis (2 baris). Gabungkan PNG bingkai + drawtext nyata di posisi
// rumus yang sama (yJ = posisiTeksBlok, x = (w-text_w)/2, line_spacing 0.3em).
// Jalankan: npx tsx scripts/uji-selar-bingkai.ts
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import * as Ty from "../src/lib/vidsplit/types";
import { bungkusTeksRender } from "../src/lib/vidsplit/bungkus";
import { tulisPngBingkaiJudul, renderSvgCoverPng } from "../src/lib/vidsplit/thumbnail";
import { fontfileNama } from "../src/lib/vidsplit/ffmpeg";
import { kotakBingkaiJudul, gayaBingkaiJudul, svgBingkaiJudulKanvas, svgBingkaiJudulKotak } from "../src/lib/vidsplit/bingkaiJudul";

void kotakBingkaiJudul; void gayaBingkaiJudul; void svgBingkaiJudulKanvas; void svgBingkaiJudulKotak;

const dirTmp = path.join(process.cwd(), "work", "tmp-pratinjau-bingkai");
mkdirSync(dirTmp, { recursive: true });

const W = 1080, H = 1920;
const p: Ty.Pengaturan = {
  ...Ty.pengaturanDefault,
  bingkaiJudul: "hud-sudut",
  judul: "JUDUL FUTURISTIK v3.5",
  gayaJudul: { ...Ty.pengaturanDefault.gayaJudul, ukuran: 80, font: "cinzeldec" },
};
const fs = Math.max(12, p.gayaJudul.ukuran); // skala = 1 (1080×1920)
const barisJ = bungkusTeksRender(p.judul, p.gayaJudul, W, H, 12);
console.log("baris terbungkus:", JSON.stringify(barisJ));
const fileTeks = path.join(dirTmp, "selar-judul.txt");
writeFileSync(fileTeks, barisJ, "utf8");

// PNG bingkai (rumus sama dgn jobs.ts — lewat tulisPngBingkaiJudul)
const pngBj = tulisPngBingkaiJudul({
  pengaturan: p, judulTxt: p.judul, partTxt: "Part 1", W, H, dirTmp, tag: "selar",
});
if (!pngBj) throw new Error("PNG bingkai gagal");

// latar gelap + bingkai + drawtext (posisi = rumus rantaiTeks)
const ffJ = fontfileNama(p.gayaJudul.font);
const yJ = H * 0.045; // judulY=-1 → margin atas; partY=-1 (part tak digambar)
execFileSync("ffmpeg", [
  "-y", "-v", "error",
  "-f", "lavfi", "-i", "color=c=0x111827:s=1080x420:d=1",
  "-i", pngBj,
  "-filter_complex",
  `[1:v]crop=${W}:420:0:0[bj];[0:v][bj]overlay=0:0,` +
  `drawtext=textfile='${fileTeks}':fontsize=${fs}:fontcolor=white:borderw=4:bordercolor=black@0.8` +
  `:x=(w-text_w)/2:y=${yJ.toFixed(1)}:line_spacing=${(fs * 0.3).toFixed(1)}${ffJ ? `:fontfile='${ffJ}'` : ""}[v]`,
  "-map", "[v]", "-frames:v", "1",
  path.join(dirTmp, "selar.jpg"),
], { stdio: "inherit" });
console.log("→", path.join(dirTmp, "selar.jpg"));
void renderSvgCoverPng;
