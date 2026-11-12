// uji-v370.ts — Uji unit v3.7.0: TRANSPLANT COVER KINOSTRA (engine port
// coverKinostraGambar.ts) + PERCEPAT RENDER (bawaan mode cepat veryfast +
// paralel 4) + migrasi coverLayout gaya-lama → layout KINOSTRA.
// Jalankan: npx tsx scripts/uji-v370.ts
import { readFileSync } from "node:fs";
import * as Kk from "../src/lib/vidsplit/coverKinostraGambar";
import * as Cv from "../src/lib/vidsplit/coverNovacut";
import * as Ty from "../src/lib/vidsplit/types";

let lolos = 0;
let gagal = 0;
const uji = (nama: string, fn: () => void) => {
  try {
    fn();
    lolos++;
    console.log(`  LOLOS  ${nama}`);
  } catch (e) {
    gagal++;
    console.log(`  GAGAL  ${nama}: ${e instanceof Error ? e.message : e}`);
  }
};
const sama = (kondisi: boolean, pesan: string) => {
  if (!kondisi) throw new Error(pesan);
};

console.log("== A · Katalog engine KINOSTRA (port nccover.js) ==");
uji("10 layout × 10 palet × 4 bingkai × 9 animasi", () => {
  sama(Kk.KINO_LAYOUTS.length === 10, `layout ${Kk.KINO_LAYOUTS.length}`);
  sama(Kk.KINO_PALETTES.length === 10, `palet ${Kk.KINO_PALETTES.length}`);
  sama(Kk.KINO_BINGKAI.length === 4, `bingkai ${Kk.KINO_BINGKAI.length}`);
  sama(Kk.KINO_ANIMASI.length === 9, `animasi ${Kk.KINO_ANIMASI.length}`);
});
uji("28 transisi dalam 4 kategori", () => {
  sama(Kk.KINO_TRANSISI.length === 28, `transisi ${Kk.KINO_TRANSISI.length}`);
  const g = new Set(Kk.KINO_TRANSISI.map((t) => t.g));
  sama(g.size === 4, `kategori ${g.size} (harus 4)`);
  for (const t of Kk.KINO_TRANSISI) sama(Kk.ncTransById(t.k) !== null, `${t.k} tak dikenal`);
});
uji("KUNCI katalog engine === katalog server (paritas UI ↔ ekspor)", () => {
  const uiLay = Kk.KINO_LAYOUTS.map((l) => l.k).sort().join(",");
  const srvLay = Cv.NOVACUT_LAYOUTS.map((l) => l.k).sort().join(",");
  sama(uiLay === srvLay, `layout beda: UI[${uiLay}] vs server[${srvLay}]`);
  const uiPal = Kk.KINO_PALETTES.map((p) => p.k).sort().join(",");
  const srvPal = Cv.NOVACUT_PALETTES.map((p) => p.k).sort().join(",");
  sama(uiPal === srvPal, `palet beda: UI[${uiPal}] vs server[${srvPal}]`);
});

console.log("== B · Fungsi murni engine (deterministik) ==");
uji("ncSeeded deterministik & rentang 0..1", () => {
  const a = Kk.ncSeeded(42), b = Kk.ncSeeded(42);
  for (let i = 0; i < 50; i++) {
    const x = a(), y = b();
    sama(x === y, `beda di iterasi ${i}`);
    sama(x >= 0 && x < 1, `di luar rentang: ${x}`);
  }
});
uji("ncKenburnsRect: zoom in membesar, out mengecil, pan bergeser", () => {
  const s = Kk.ncKenburnsRect(0, 360, 640, "in");
  const e = Kk.ncKenburnsRect(1, 360, 640, "in");
  sama(e.w > s.w && e.h > s.h, `in tidak membesar: ${s.w}→${e.w}`);
  const o = Kk.ncKenburnsRect(1, 360, 640, "out");
  sama(o.w < e.w, "out harus lebih kecil dari in di p=1");
  const px0 = Kk.ncKenburnsRect(0, 360, 640, "panx");
  const px1 = Kk.ncKenburnsRect(1, 360, 640, "panx");
  sama(px1.x > px0.x, "panx harus bergeser kanan");
  const diam = Kk.ncKenburnsRect(0.5, 360, 640, "off");
  sama(diam.w === 360 && diam.h === 640 && diam.x === 0, "off harus diam penuh");
});
uji("ncTextState: off statis, fade naik, typewriter & glitch ber-kind", () => {
  const off = Kk.ncTextState("off", 0.3);
  sama(off.alpha === 1 && off.kind === null, "off harus statis penuh");
  const awal = Kk.ncTextState("fade", 0.05, 2).alpha;
  const akhir = Kk.ncTextState("fade", 1.2, 2).alpha;
  sama(akhir > awal, `fade tidak naik: ${awal}→${akhir}`);
  sama(Kk.ncTextState("typewriter", 0.2, 2).kind === "typewriter", "typewriter tanpa kind");
  sama(Kk.ncTextState("glitch", 0.2, 2).kind === "glitch", "glitch tanpa kind");
  sama(Kk.ncTextState("rise", 0.5, 2).dy >= 0, "rise dy harus ≥ 0");
});
uji("ncTextState slam: jitter kecil (fraksi tinggi, bukan piksel liar)", () => {
  const s = Kk.ncTextState("slam", 0.1, 2, 11);
  sama(Math.abs(s.dy) < 0.02, `dy liar: ${s.dy}`);
});

console.log("== C · Migrasi coverLayout gaya-lama → layout KINOSTRA ==");
uji("modern→boxed, klasik→impact, futuristik→neon, ''→impact", () => {
  const m = Ty.migrasiSimpanan({ coverLayout: "modern", coverPalet: "cyber" });
  sama(m.coverLayout === "boxed", `modern → ${m.coverLayout}`);
  const k = Ty.migrasiSimpanan({ coverLayout: "klasik", coverPalet: "gold" });
  sama(k.coverLayout === "impact", `klasik → ${k.coverLayout}`);
  const f = Ty.migrasiSimpanan({ coverLayout: "futuristik", coverPalet: "ice" });
  sama(f.coverLayout === "neon", `futuristik → ${f.coverLayout}`);
  const p = Ty.migrasiSimpanan({ coverLayout: "", coverPalet: "cyber" });
  sama(p.coverLayout === "impact", `'' → ${p.coverLayout}`);
});
uji("layout KINOSTRA sah tidak diubah; id hantu → impact", () => {
  const s = Ty.migrasiSimpanan({ coverLayout: "sticker", coverPalet: "toxic" });
  sama(s.coverLayout === "sticker", "sticker berubah");
  const h = Ty.migrasiSimpanan({ coverLayout: "gaya-hantu", coverPalet: "cyber" });
  sama(h.coverLayout === "impact", `hantu → ${h.coverLayout}`);
});
uji("template gabungan lama impact--cyber tetap terpetakan", () => {
  const t = Ty.migrasiSimpanan({ introTemplate: "band--sunset" });
  sama(t.coverLayout === "band" && t.coverPalet === "sunset", `→ ${t.coverLayout}/${t.coverPalet}`);
});

console.log("== D · Percepat render (bawaan cepat + paralel) ==");
uji("bawaan prosesParalel = 4", () => {
  sama(Ty.pengaturanDefault.prosesParalel === 4, `paralel ${Ty.pengaturanDefault.prosesParalel}`);
});
uji("jobs.ts: mode cepat = preset veryfast (dua jalur), presisi = medium", () => {
  const s = readFileSync("src/lib/vidsplit/jobs.ts", "utf8");
  const n = (s.match(/modeEkspor === "cepat" \? "veryfast" : "medium"/g) || []).length;
  sama(n === 2, `pola veryfast ketemu ${n}x (harus 2: split + gabung)`);
  sama(!s.includes('"ultrafast"'), "ultrafast masih tersisa (kualitas jelek)");
});
uji("PanelEkspor: bawaan modeEkspor = 'cepat'", () => {
  const s = readFileSync("src/components/vds/PanelEkspor.tsx", "utf8");
  sama(/useState<"presisi" \| "cepat">\("cepat"\)/.test(s), "bawaan bukan cepat");
});

console.log("== E · UI transplant: panel baru tanpa menu lama ==");
uji("PanelCoverKinostra ada; PanelCoverKino & thumbnail GLOBAL dihapus", () => {
  const s = readFileSync("src/components/vds/BagianAtur.tsx", "utf8");
  sama(s.includes("PanelCoverKinostra"), "panel baru tidak ada");
  sama(!s.includes("export function PanelCoverKino("), "panel lama masih ada");
  sama(!s.includes("Gambar thumbnail — cover statis tiap potongan"), "thumbnail GLOBAL masih ada");
  sama(!s.includes("GAYA LAMA (DASAR)"), "seg GAYA LAMA masih ada");
  sama(s.includes("MAINKAN PRATINJAU COVER + TRANSISI"), "tombol mainkan tidak ada");
  sama(s.includes("COVER VIDEO PEMBUKA · KINOSTRA"), "judul kartu KINOSTRA tidak ada");
});
uji("page.tsx memakai PanelCoverKinostra tanpa opsiThumb", () => {
  const s = readFileSync("src/app/page.tsx", "utf8");
  sama(s.includes("PanelCoverKinostra"), "mount baru tidak ada");
  sama(!s.includes("PanelCoverKino\n"), "mount lama masih ada");
  sama(!s.includes("opsiThumb={{"), "props thumbnail masih dikirim");
});

console.log(`\nHASIL: ${lolos} lolos, ${gagal} gagal`);
process.exit(gagal > 0 ? 1 : 0);
