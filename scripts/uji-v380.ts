// uji-v380.ts — v3.8.0: PEMILIH FONT COVER (judul & part) + FOLDER HASIL WAJIB
// (tanpa penumpukan di folder output) + layout 3 kolom.
// Jalankan: npx tsx scripts/uji-v380.ts
import { existsSync, mkdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import * as Ty from "../src/lib/vidsplit/types";
import {
  FONT_COVER,
  PILIHAN_FONT_COVER,
  svgCover,
  svgCoverLapis,
} from "../src/lib/vidsplit/coverNovacut";
import { renderSvgCoverPng, pengukurTeksServer } from "../src/lib/vidsplit/thumbnail";
import {
  setelanTujuanDefault,
  muatSetelanTujuan,
  salinHasilKeTujuan,
  buangSalinanKerja,
  validasiFolderTujuan,
} from "../src/lib/vidsplit/tujuan";
import { dirWork } from "../src/lib/vidsplit/ffmpeg";
import { FAMILI_KINO, aturFontKino, ncFontStackJudul, ncFontStackPart } from "../src/lib/vidsplit/coverKinostraGambar";
import { dirFontKandidat } from "../src/lib/vidsplit/ffmpeg";

let lolos = 0;
let gagal = 0;
const antre: (() => Promise<void>)[] = [];
const uji = (nama: string, fn: () => void | Promise<void>) => {
  antre.push(async () => {
    try {
      await fn();
      lolos++;
      console.log(`  LOLOS  ${nama}`);
    } catch (e) {
      gagal++;
      console.log(`  GAGAL  ${nama}: ${e instanceof Error ? e.message : e}`);
    }
  });
};
const sama = (kondisi: boolean, pesan: string) => {
  if (!kondisi) throw new Error(pesan);
};

const W = 720;
const H = 1280;
const ukur = pengukurTeksServer();
const dirTmp = path.join(process.cwd(), "work", "tmp-uji-v380");
mkdirSync(dirTmp, { recursive: true });

const opsiDasar = {
  template: "impact--cyber",
  W,
  H,
  judul: "JUDUL UJI FONT",
  labelPart: "PART 01",
  latar: "hitam" as const,
  skalaPart: 1,
  bingkai: "none" as const,
};

console.log("== A · PEMILIH FONT COVER (server: SVG + resvg) ==");
uji("PILIHAN_FONT_COVER 16 font & semua TTF bundel ada", () => {
  sama(PILIHAN_FONT_COVER.length === 16, `dapat ${PILIHAN_FONT_COVER.length} (harus 16)`);
  for (const { k } of PILIHAN_FONT_COVER) {
    const fam = FONT_COVER[k];
    sama(!!fam?.family, `kunci ${k} tak punya family`);
    for (const ttf of fam.ttf) {
      const ada = dirFontKandidat().some((d) => existsSync(path.join(d, ttf)));
      sama(ada, `TTF ${ttf} (${k}) tidak ada di assets/fonts`);
    }
  }
});
uji('fontJudul="playfair" → SVG judul memakai "Playfair Display"', () => {
  const svg = svgCover({ ...opsiDasar, fontJudul: "playfair", fontPart: "" }, ukur);
  sama(svg.includes('font-family="Playfair Display"'), "family Playfair absen di SVG judul");
  const bawaan = svgCover({ ...opsiDasar, fontJudul: "", fontPart: "" }, ukur);
  sama(bawaan.includes('font-family="Anton"'), "bawaan layout (Anton) hilang saat fontJudul \"\"");
  sama(!bawaan.includes('font-family="Playfair Display"'), "bawaan bocor font pilihan");
});
uji('fontPart="sixcaps" → badge part memakai "Six Caps" (ukur + SVG)', () => {
  const svg = svgCover({ ...opsiDasar, fontJudul: "", fontPart: "sixcaps" }, ukur);
  sama(svg.includes('font-family="Six Caps"'), "family Six Caps absen di SVG part");
  const lapis = svgCoverLapis({ ...opsiDasar, fontJudul: "oswald", fontPart: "teko" }, ukur);
  sama(lapis.judul.includes('font-family="Oswald"'), "lapis judul tak ikut fontJudul");
  sama(lapis.part.includes('font-family="Teko"'), "lapis part tak ikut fontPart");
  sama(!lapis.bg.includes('font-family="Oswald"'), "lapis bg tercemar font judul");
});
uji("resvg render dgn font pilihan → PNG beda dgn bawaan (terverifikasi piksel)", () => {
  const pngA = renderSvgCoverPng(svgCover({ ...opsiDasar, fontJudul: "monoton" }, ukur), W, H);
  const pngB = renderSvgCoverPng(svgCover({ ...opsiDasar, fontJudul: "impact" }, ukur), W, H);
  sama(pngA.length > 1000 && pngB.length > 1000, "PNG gagal dirender");
  sama(!pngA.equals(pngB), "PNG font monoton == bawaan (font tak terpakai?)");
});

console.log("== B · CLIENT — stack pratinjau ikut pilihan ==");
uji("aturFontKino → ncFontStackJudul/Part memakai famili VDS pilihan", () => {
  sama(!!FAMILI_KINO.playfair && FAMILI_KINO.playfair.includes("VDS Playfair Display"), "FAMILI_KINO playfair salah");
  aturFontKino("playfair", "oswald");
  sama(ncFontStackJudul("impact").includes("VDS Playfair Display"), "judul tak ikut pilihan");
  sama(ncFontStackPart("condensed").includes("VDS Oswald"), "part tak ikut pilihan");
  aturFontKino("", "");
  sama(ncFontStackJudul("impact").includes("VDS Anton"), "bawaan layout hilang saat reset");
  sama(ncFontStackPart("condensed").includes("VDS Bebas Neue"), "bawaan part hilang saat reset");
});

console.log("== C · FOLDER HASIL WAJIB (P1) ==");
uji("bawaan bersihkanKerja AKTIF + default folder null", () => {
  // v3.8.0 — field bersihkanKerja kini INERT: jobs SELALU membuang salinan kerja
  // setelah terverifikasi; bawaan ditandai true utk instalasi baru.
  sama(setelanTujuanDefault.bersihkanKerja === true, "bersihkanKerja bawaan harus true");
  sama(setelanTujuanDefault.folder === null, "folder bawaan harus null (wajib dipilih)");
});
uji("validasiFolderTujuan: absolut + uji tulis nyata", () => {
  const ok = validasiFolderTujuan(path.join(dirTmp, "tujuan-a"));
  sama(ok.ok && existsSync(path.join(dirTmp, "tujuan-a")), "folder sah gagal dibuat");
  const rel = validasiFolderTujuan("hasil-split");
  sama(!rel.ok, "path relatif harus ditolak");
});
uji("salinHasilKeTujuan + buangSalinanKerja: hasil pindah, output aplikasi bersih", async () => {
  const id = "uji-v380-job";
  const outKerja = path.join(dirWork("output"), id);
  rmSync(outKerja, { recursive: true, force: true });
  mkdirSync(outKerja, { recursive: true });
  writeFileSync(path.join(outKerja, "part-01.mp4"), "KONTEN-01".repeat(100));
  writeFileSync(path.join(outKerja, "part-02.mp4"), "KONTEN-02".repeat(100));
  const tujuan = path.join(dirTmp, "tujuan-b");
  rmSync(tujuan, { recursive: true, force: true });
  const hasil = await salinHasilKeTujuan({ id, outputs: [{ file: "part-01.mp4" }, { file: "part-02.mp4" }], antrean: [] } as never, tujuan);
  sama(hasil.gagal.length === 0, `salin gagal: ${hasil.gagal.join(",")}`);
  const folderJob = hasil.folder;
  sama(existsSync(path.join(folderJob, "part-01.mp4")), "hasil tidak ada di folder tujuan");
  buangSalinanKerja({ id, outputs: [{ file: "part-01.mp4" }, { file: "part-02.mp4" }] });
  sama(!existsSync(path.join(outKerja, "part-01.mp4")) && !existsSync(path.join(outKerja, "part-02.mp4")), "salinan kerja tak terbuang");
  sama(statSync(path.join(folderJob, "part-01.mp4")).size > 0, "file tujuan kosong");
  rmSync(outKerja, { recursive: true, force: true });
  rmSync(folderJob, { recursive: true, force: true });
});

console.log("== D · PENGATURAN & LAYOUT ==");
uji("Pengaturan default: coverFontJudul/Part \"\" & field ada", () => {
  sama(Ty.pengaturanDefault.coverFontJudul === "", "coverFontJudul default salah");
  sama(Ty.pengaturanDefault.coverFontPart === "", "coverFontPart default salah");
});

(async () => {
  for (const t of antre) await t();
  console.log(`\nHASIL: ${lolos} lolos, ${gagal} gagal`);
  process.exit(gagal > 0 ? 1 : 0);
})();
