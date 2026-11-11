// Uji unit v2.9.0 — TRANSPLANTASI MESIN KINOSTRA ke VidSplit
//   1. GERBANG KILAT (WebCodecs renderer): 4 mode dasar tanpa elemen bakar
//      lolos; teks/bingkai/intro/logo/subtitle/transisi/kecepatan/adegan/…
//      memblokir dengan alasan jelas.
//   2. KOMPOSISI CANVAS: gambarKomposisi() diuji LANGSUNG dgn shim konteks
//      2D — posisi & ukuran drawImage diverifikasi terhadap rumus ffmpeg
//      rantaiUtama (blur zoom/geser, crop cover, pad warna/asli).
//   3. RENTANG SERAGAM: hitungPartV2/rentangPart yang dipakai kilat = yang
//      dipakai server (satu sumber kebenaran).
// Jalankan: bun scripts/uji-v290.ts
import { gambarKomposisi } from "../src/lib/vidsplit/kilat/komposisi";
import { gerbangKilat } from "../src/lib/vidsplit/kilat/eksporKilat";
import {
  dimensiOutput,
  hitungPartV2,
  pengaturanDefault,
  rentangPart,
  type Pengaturan,
} from "../src/lib/vidsplit/types";

let lolos = 0;
let gagalN = 0;
function cek(nama: string, kondisi: boolean, detail?: string) {
  if (kondisi) {
    lolos++;
    console.log(`  ✓ ${nama}`);
  } else {
    gagalN++;
    console.error(`  ✗ ${nama}${detail ? ` — ${detail}` : ""}`);
  }
}

function bersih(p: Partial<Pengaturan>): Pengaturan {
  return { ...pengaturanDefault, ...p };
}

/* ---------- shim konteks 2D: catat panggilan drawImage ---------- */
interface Catatan {
  args: unknown[];
  filter: string;
}
function shimCtx() {
  const catatan: Catatan[] = [];
  const cx = {
    filter: "none",
    globalAlpha: 1,
    globalCompositeOperation: "source-over",
    fillStyle: "#000",
    fillRect: () => {},
    save: () => {},
    restore: () => {},
    drawImage: (...args: unknown[]) => {
      catatan.push({ args, filter: cx.filter });
    },
  };
  return { cx: cx as unknown as CanvasRenderingContext2D, catatan };
}
/* frame palsu dgn dimensi display (VideoFrame punya displayWidth/Height) */
function framePalsu(w: number, h: number): VideoFrame {
  return {
    displayWidth: w,
    displayHeight: h,
    width: w,
    height: h,
  } as unknown as VideoFrame;
}

function main() {
  /* ================= 1. GERBANG KILAT ================= */
  console.log("\n[1] GERBANG KILAT (WebCodecs renderer)");
  const bersihBlur = bersih({
    mode: "blur",
    judul: "",
    kataPart: "",
    deskripsi: "",
    introAktif: false,
    logoId: "",
    frameId: "",
    neonAktif: false,
    transisiPart: "",
    kecepatanVideo: 1,
    zoomPembicara: "mati",
    subtitleAktif: false,
    backsoundAktif: false,
    introSuaraFile: "",
    codec: "h264",
    modeSplit: "durasi",
  });
  for (const mode of ["blur", "crop", "warna", "asli"] as const) {
    cek(`mode ${mode} bersih → LOLOS kilat`, gerbangKilat({ ...bersihBlur, mode }) === null);
  }
  const kasusBlok: [string, Partial<Pengaturan>, string][] = [
    ["judul", { judul: "Judul" }, "TEKS JUDUL"],
    ["kata part", { kataPart: "Part" }, "TEKS PART"],
    ["deskripsi", { deskripsi: "hai" }, "DESKRIPSI"],
    ["intro", { introAktif: true }, "INTRO"],
    ["logo", { logoId: "l.png" }, "LOGO"],
    ["bingkai", { frameId: "hiburan-1-916" }, "BINGKAI"],
    ["neon", { neonAktif: true }, "NEON"],
    ["transisi", { transisiPart: "fade" }, "TRANSISI"],
    ["kecepatan", { kecepatanVideo: 1.5 }, "KECEPATAN"],
    ["pembicara", { zoomPembicara: "geser" }, "AI PEMBICARA"],
    ["subtitle", { subtitleAktif: true }, "SUBTITEL"],
    ["backsound", { backsoundAktif: true }, "BACKSOUND"],
    ["suara intro", { introSuaraFile: "s.mp3" }, "SUARA INTRO"],
    ["h265", { codec: "h265" }, "KODEK H265"],
    ["split adegan", { modeSplit: "adegan" }, "SPLIT ADEGAN"],
  ];
  for (const [nm, p, alasan] of kasusBlok) {
    const r = gerbangKilat({ ...bersihBlur, ...p });
    cek(`${nm} → BLOK ${alasan}`, r === alasan, `dapat: ${r}`);
  }
  cek("kompres pintar → BLOK", gerbangKilat(bersihBlur, 45) === "KOMPRES PINTAR");

  /* ================= 2. KOMPOSISI CANVAS ================= */
  console.log("\n[2] KOMPOSISI CANVAS — paritas rumus rantaiUtama");
  const W = 320,
    H = 568; /* 9:16 mini */
  const SW = 160,
    SH = 90; /* sumber 16:9 */

  /* mode blur z=100 gx=gy=0: latar blur + isi contain di tengah
     sumber 16:9 di kanvas 9:16 → contain = isi LEBAR penuh (s = W/SW) */
  {
    const { cx, catatan } = shimCtx();
    gambarKomposisi(cx, framePalsu(SW, SH), W, H, bersih({ mode: "blur" }));
    const isi = catatan[catatan.length - 1];
    const [x, y, w, h] = isi.args.slice(1) as number[];
    const s = Math.min(W / SW, H / SH);
    cek("blur: latar digambar dgn filter blur+eq", isi.filter.includes("blur") && isi.filter.includes("saturate(1.15)"), isi.filter);
    cek(
      "blur z=100: isi contain tepat tengah",
      Math.abs(w - SW * s) < 1e-6 && Math.abs(h - SH * s) < 1e-6 && Math.abs(x - (W - w) / 2) < 1e-6 && Math.abs(y - (H - h) / 2) < 1e-6,
      `x=${x} y=${y} w=${w} h=${h}`,
    );
  }
  /* mode blur zoom 200 geser +100/-100: rumus (W−w)/2×(1+gx/100) */
  {
    const { cx, catatan } = shimCtx();
    gambarKomposisi(cx, framePalsu(SW, SH), W, H, bersih({ mode: "blur", zoomBlur: 200, geserBlurX: 100, geserBlurY: -100 }));
    const isi = catatan[catatan.length - 1];
    const [x, y, w, h] = isi.args.slice(1) as number[];
    const s = Math.min(W / SW, H / SH) * 2;
    cek("blur z=200: ukuran 2× contain", Math.abs(w - SW * s) < 1e-6 && Math.abs(h - SH * s) < 1e-6, `w=${w} h=${h}`);
    cek("blur gx=+100: menempel kanan", Math.abs(x - (W - w)) < 1e-6, `x=${x}`);
    cek("blur gy=−100: menempel atas", Math.abs(y) < 1e-6, `y=${y}`);
  }
  /* mode crop z=100 pp=0: cover penuh, jendela kiri */
  {
    const { cx, catatan } = shimCtx();
    gambarKomposisi(cx, framePalsu(SW, SH), W, H, bersih({ mode: "crop", posisiPotong: 0 }));
    const isi = catatan[catatan.length - 1];
    const [x, , w, h] = isi.args.slice(1) as number[];
    const s = Math.max(W / SW, H / SH);
    cek("crop pp=0: cover penuh tinggi & menempel kiri", Math.abs(h - H) < 1e-6 && Math.abs(x) < 1e-6 && Math.abs(w - SW * s) < 1e-6, `x=${x} w=${w}`);
  }
  /* mode crop zoomPotong 50: latar blur + isi cover×0,5 di pp=50 */
  {
    const { cx, catatan } = shimCtx();
    gambarKomposisi(cx, framePalsu(SW, SH), W, H, bersih({ mode: "crop", zoomPotong: 50, posisiPotong: 50 }));
    cek("crop z<100: 2 drawImage (latar blur + isi)", catatan.length === 2, `${catatan.length}`);
    const isi = catatan[catatan.length - 1];
    const [x, y, w, h] = isi.args.slice(1) as number[];
    const s = Math.max(W / SW, H / SH) * 0.5;
    cek("crop z=50 pp=50: isi cover×0,5 tengah", Math.abs(w - SW * s) < 1e-6 && Math.abs(x - (W - w) * 0.5) < 1e-6 && Math.abs(y - (H - h) / 2) < 1e-6, `x=${x} y=${y}`);
    const latar = catatan[0];
    cek("crop z<100: latar berfilter blur", latar.filter.includes("blur"));
  }
  /* mode warna: pad warna + contain */
  {
    const { cx, catatan } = shimCtx();
    gambarKomposisi(cx, framePalsu(SW, SH), W, H, bersih({ mode: "warna", warnaLatar: "#112233" }));
    const isi = catatan[catatan.length - 1];
    const [, , w, h] = isi.args.slice(1) as number[];
    const s = Math.min(W / SW, H / SH);
    cek("warna: isi contain, filter nonaktif", Math.abs(w - SW * s) < 1e-6 && Math.abs(h - SH * s) < 1e-6 && isi.filter === "none", `filter=${isi.filter} w=${w}`);
  }
  /* mode asli: contain + pad hitam (tanpa filter) */
  {
    const { cx, catatan } = shimCtx();
    gambarKomposisi(cx, framePalsu(SW, SH), W, H, bersih({ mode: "asli" }));
    const isi = catatan[catatan.length - 1];
    const [, , w, h] = isi.args.slice(1) as number[];
    const s = Math.min(W / SW, H / SH);
    cek("asli: contain (skala seragam, tanpa filter)", Math.abs(w - SW * s) < 1e-6 && Math.abs(h - SH * s) < 1e-6 && isi.filter === "none");
  }

  /* dimensiOutput */
  const dAsli = dimensiOutput("asli", "1080", "auto", 640, 360);
  cek("dimensiOutput asli auto = sumber", dAsli.W === 640 && dAsli.H === 360, `${dAsli.W}x${dAsli.H}`);
  const dBlur = dimensiOutput("blur", "1080", "auto", 640, 360);
  cek("dimensiOutput blur = 9:16 1080", dBlur.W === 1080 && dBlur.H === 1920, `${dBlur.W}x${dBlur.H}`);

  /* ================= 3. RENTANG SERAGAM ================= */
  console.log("\n[3] RENTANG PART — satu sumber kebenaran");
  const dur = 25;
  const dp = 10;
  const n = hitungPartV2(dur, bersih({ durasiPart: dp }), 0, 0, []);
  cek("25 dtk ÷ 10 = 3 part", n === 3, `dapat ${n}`);
  const r1 = rentangPart(1, dur, dp, 0, 0);
  const r3 = rentangPart(3, dur, dp, 0, 0);
  cek("part 1 mulai 0", r1[0] === 0);
  cek("part 3 durasi sisa ≤ dp", r3[1] > 0 && r3[1] <= dp, `${r3[1]}`);

  console.log(`\n═══ HASIL: ${lolos} LOLOS, ${gagalN} GAGAL ═══`);
  if (gagalN > 0) process.exit(1);
}

main();
