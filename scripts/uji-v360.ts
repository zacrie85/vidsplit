// uji-v360.ts — Uji unit v3.6.0: BINGKAI PART (10 gaya khusus episode) +
// BINGKAI DESKRIPSI (10 panel) + SKALA MANUAL lebar/tinggi ketiga bingkai
// (katalog, SVG, kotak berskala, rapikan/migrasi, terapkanSebagian, PNG server
// resvg, rantai ffmpeg nol-regresi + overlay [bp]/[bd]).
// Jalankan: npx tsx scripts/uji-v360.ts
import { mkdirSync, readFileSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import * as Bj from "../src/lib/vidsplit/bingkaiJudul";
import * as Ty from "../src/lib/vidsplit/types";
import { tulisPngBingkaiTeks, tulisPngBingkaiJudul } from "../src/lib/vidsplit/thumbnail";
import { bangunArgumenPart } from "../src/lib/vidsplit/ffmpeg";

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

const dirTmp = path.join(process.cwd(), "work", "tmp-uji-v360");
mkdirSync(dirTmp, { recursive: true });

console.log("== A · Katalog 10+10 gaya baru (part & deskripsi) ==");
uji("BINGKAI_PART & BINGKAI_DESKRIPSI masing-masing 10 gaya", () => {
  sama(Bj.BINGKAI_PART.length === 10, `part = ${Bj.BINGKAI_PART.length}`);
  sama(Bj.BINGKAI_DESKRIPSI.length === 10, `deskripsi = ${Bj.BINGKAI_DESKRIPSI.length}`);
});
uji("id unik lintas katalog (30 total, prefix ep-/dp-)", () => {
  const semua = [...Bj.BINGKAI_JUDUL, ...Bj.BINGKAI_PART, ...Bj.BINGKAI_DESKRIPSI].map((g) => g.id);
  sama(new Set(semua).size === 30, `id bentrok: ${semua.length - new Set(semua).size} ganda`);
  for (const g of Bj.BINGKAI_PART) sama(g.id.startsWith("ep-"), `${g.id} tanpa prefix ep-`);
  for (const g of Bj.BINGKAI_DESKRIPSI) sama(g.id.startsWith("dp-"), `${g.id} tanpa prefix dp-`);
  for (const g of [...Bj.BINGKAI_PART, ...Bj.BINGKAI_DESKRIPSI]) {
    sama(g.nama.length > 2 && g.nama.length <= 14, `label aneh: ${g.nama}`);
    sama(g.padX > 0.2 && g.padX < 1.3 && g.padY > 0.2 && g.padY < 1.0, `pad aneh: ${g.id}`);
  }
});
uji("gayaBingkaiJenis: salah katalog → null, katalog sendiri → gaya", () => {
  sama(Bj.gayaBingkaiJenis("part", "hud-sudut") === null, "judul bocor ke part");
  sama(Bj.gayaBingkaiJenis("deskripsi", "ep-tiket") === null, "part bocor ke deskripsi");
  sama(Bj.gayaBingkaiJenis("part", "ep-tiket") !== null, "ep-tiket tak dikenal di part");
  sama(Bj.gayaBingkaiJenis("deskripsi", "dp-kaca") !== null, "dp-kaca tak dikenal");
  sama(Bj.gayaBingkaiJenis("judul", "ep-tiket") === null, "part bocor ke judul");
  sama(Bj.gayaBingkaiPart("ep-vhs") !== null && Bj.gayaBingkaiDeskripsi("dp-papan") !== null, "helper jenis rusak");
});

console.log("== B · Geometri kotak berskala (kotakBingkaiTeks) ==");
uji("skala 100 = rumus otomatis (teks + 2×pad gaya)", () => {
  const g = Bj.gayaBingkaiPart("ep-tiket")!;
  const k = Bj.kotakBingkaiTeks("part", "ep-tiket", 50, 100, 300, 50, 40, 1080, 1920)!;
  sama(Math.abs(k.w - (300 + 2 * g.padX * 40)) < 1, `w ${k.w}`);
  sama(Math.abs(k.h - (50 + 2 * g.padY * 40)) < 1, `h ${k.h}`);
});
uji("skala lebar 200 → padding X berlipat dua, Y tetap", () => {
  const g = Bj.gayaBingkaiPart("ep-tiket")!;
  const k = Bj.kotakBingkaiTeks("part", "ep-tiket", 50, 100, 300, 50, 40, 1080, 1920, 200, 100)!;
  sama(Math.abs(k.w - (300 + 2 * g.padX * 40 * 2)) < 1, `w skala ${k.w}`);
  sama(Math.abs(k.h - (50 + 2 * g.padY * 40)) < 1, `h ikut berubah: ${k.h}`);
});
uji("skala tinggi 50 → kotak memendek, lebar tetap", () => {
  const g = Bj.gayaBingkaiDeskripsi("dp-kaca")!;
  const k = Bj.kotakBingkaiTeks("deskripsi", "dp-kaca", 50, 900, 500, 120, 30, 1080, 1920, 100, 50)!;
  sama(Math.abs(k.h - (120 + 2 * g.padY * 30 * 0.5)) < 1, `h ${k.h}`);
  sama(Math.abs(k.w - (500 + 2 * g.padX * 30)) < 1, `w ikut berubah: ${k.w}`);
});
uji("teks tetap di TENGAH kotak saat skala (jangkar X tengah, Y atas−pad)", () => {
  const g = Bj.gayaBingkaiPart("ep-neon")!;
  const k = Bj.kotakBingkaiTeks("part", "ep-neon", 40, 800, 200, 40, 36, 1080, 1920, 180, 220)!;
  sama(Math.abs(k.x + k.w / 2 - (1080 * 40) / 100) < 1.5, `tengah X ${k.x + k.w / 2}`);
  sama(Math.abs(k.y - (800 - g.padY * 36 * 2.2)) < 1, `y ${k.y}`);
});
uji("kotak berskala tidak pernah keluar kanvas (semua gaya, ekstrem)", () => {
  for (const jenis of ["judul", "part", "deskripsi"] as Bj.JenisBingkai[]) {
    for (const g of Bj.katalogBingkai(jenis)) {
      const k = Bj.kotakBingkaiTeks(jenis, g.id, 5, 5, 900, 400, 120, 1080, 1920, 250, 250)!;
      sama(k.x >= 0 && k.y >= 0 && k.x + k.w <= 1080 && k.y + k.h <= 1920, `${g.id} keluar: ${JSON.stringify(k)}`);
    }
  }
});

console.log("== C · SVG 30 gaya valid & unik ==");
uji("tiap gaya part & deskripsi → SVG valid, transparan, unik", () => {
  const k = Bj.kotakBingkaiTeks("part", "ep-tiket", 50, 100, 300, 50, 40, 1080, 1920)!;
  const kumpulan = new Set<string>();
  for (const jenis of ["judul", "part", "deskripsi"] as Bj.JenisBingkai[]) {
    for (const g of Bj.katalogBingkai(jenis)) {
      const svg = Bj.svgBingkaiKotak(jenis, g.id);
      sama(svg.startsWith("<svg") && svg.endsWith("</svg>"), `${g.id}: bentuk svg`);
      sama(!svg.includes("NaN") && !svg.includes("undefined"), `${g.id}: angka rusak`);
      sama(/<(rect|path|polygon|line|circle)/.test(svg), `${g.id}: tanpa bentuk`);
      sama(
        svg.includes("fill-opacity") || svg.includes("stroke-opacity") || svg.includes("stop-opacity"),
        `${g.id}: tanpa transparansi`,
      );
      kumpulan.add(svg);
    }
  }
  sama(kumpulan.size === 30, `svg bentrok: ${kumpulan.size}/30 unik`);
});
uji("SVG kanvas server menerima id part & deskripsi", () => {
  const k = Bj.kotakBingkaiTeks("part", "ep-filmstrip", 50, 100, 300, 50, 40, 1080, 1920)!;
  const svg = Bj.svgBingkaiJudulKanvas("ep-filmstrip", k, 1080, 1920);
  sama(svg.includes('width="1080"') && svg.includes("ep-filmstrip" === "" ? "" : "<rect"), "svg kanvas part rusak");
});

console.log("== D · Setelan: default, migrasi, terapkanSebagian ==");
uji("bawaan bingkaiPart/bingkaiDeskripsi = '' & skala = 100", () => {
  const d = Ty.pengaturanDefault;
  sama(d.bingkaiPart === "" && d.bingkaiDeskripsi === "", "bawaan bingkai bukan kosong");
  for (const k of ["bingkaiJudulLebar", "bingkaiJudulTinggi", "bingkaiPartLebar", "bingkaiPartTinggi", "bingkaiDeskripsiLebar", "bingkaiDeskripsiTinggi"] as const) {
    sama((d[k] as number) === 100, `${k} bawaan ${d[k]}`);
  }
});
uji("migrasiSimpanan: id aneh → ''; skala clamp 40–250; NaN → 100", () => {
  const a = Ty.migrasiSimpanan({ bingkaiPart: "hud-sudut", bingkaiDeskripsi: "hantu" });
  sama(a.bingkaiPart === "", "id judul lolos ke part");
  sama(a.bingkaiDeskripsi === "", "id aneh lolos ke deskripsi");
  const b = Ty.migrasiSimpanan({ bingkaiPart: "ep-tiket", bingkaiDeskripsiLebar: 300, bingkaiPartTinggi: 10, bingkaiJudulLebar: Number.NaN });
  sama(b.bingkaiPart === "ep-tiket", "id sah part harus tetap");
  sama(b.bingkaiDeskripsiLebar === 250, `clamp atas ${b.bingkaiDeskripsiLebar}`);
  sama(b.bingkaiPartTinggi === 40, `clamp bawah ${b.bingkaiPartTinggi}`);
  sama(b.bingkaiJudulLebar === 100, `NaN → 100, dapat ${b.bingkaiJudulLebar}`);
  const c = Ty.migrasiSimpanan({});
  sama(c.bingkaiPartLebar === 100 && c.bingkaiDeskripsiTinggi === 100, "tanpa field → 100");
});
uji("terapkanSebagian membawa bingkai part/deskripsi + skala ke semua", () => {
  const sumber: Ty.Pengaturan = {
    ...Ty.pengaturanDefault,
    bingkaiPart: "ep-pita",
    bingkaiPartLebar: 150,
    bingkaiDeskripsi: "dp-gelap",
    bingkaiDeskripsiTinggi: 180,
  };
  const hasil = Ty.terapkanSebagian(sumber, { ...Ty.pengaturanDefault });
  sama(hasil.bingkaiPart === "ep-pita", "bingkai part tak tersalin");
  sama(hasil.bingkaiPartLebar === 150, "skala part tak tersalin");
  sama(hasil.bingkaiDeskripsi === "dp-gelap", "bingkai deskripsi tak tersalin");
  sama(hasil.bingkaiDeskripsiTinggi === 180, "skala deskripsi tak tersalin");
});

console.log("== E · PNG server (resvg) utk part & deskripsi ==");
uji("10 gaya part → PNG nyata non-trivial", () => {
  for (const g of Bj.BINGKAI_PART) {
    const p: Ty.Pengaturan = {
      ...Ty.pengaturanDefault,
      bingkaiPart: g.id,
      kataPart: "Episode",
      judul: "UJI PART v3.6",
      gayaPart: { ...Ty.pengaturanDefault.gayaPart, ukuran: 30 },
    };
    const f = tulisPngBingkaiTeks("part", { pengaturan: p, judulTxt: p.judul, partTxt: "Episode 3", deskripsiTxt: "", W: 1080, H: 1920, dirTmp, tag: `p-${g.id}` });
    sama(!!f, `${g.id}: path null`);
    const ada = existsSync(f as string);
    sama(ada, `${g.id}: PNG tak ada`);
    const ukuran = statSync(f as string).size;
    sama(ukuran > 500, `${g.id}: PNG terlalu kecil (${ukuran} B)`);
    const magic = readFileSync(f as string).subarray(1, 4).toString("ascii");
    sama(magic === "PNG", `${g.id}: bukan PNG`);
  }
});
uji("10 gaya deskripsi → PNG nyata non-trivial (multi-baris)", () => {
  for (const g of Bj.BINGKAI_DESKRIPSI) {
    const p: Ty.Pengaturan = {
      ...Ty.pengaturanDefault,
      bingkaiDeskripsi: g.id,
      deskripsi: "DESKRIPSI PANJANG UNTUK UJI WRAP DUA ATAU LEBIH BARIS PADA KANVAS VERTIKAL",
      gayaDeskripsi: { ...Ty.pengaturanDefault.gayaDeskripsi, ukuran: 28 },
    };
    const f = tulisPngBingkaiTeks("deskripsi", { pengaturan: p, judulTxt: "", partTxt: "", deskripsiTxt: p.deskripsi, W: 1080, H: 1920, dirTmp, tag: `d-${g.id}` });
    sama(!!f && existsSync(f as string) && statSync(f as string).size > 500, `${g.id}: PNG rusak`);
  }
});
uji("skala manual terasa di PNG server (200% > 100% byte & kotak)", () => {
  const dasar: Ty.Pengaturan = {
    ...Ty.pengaturanDefault,
    bingkaiPart: "ep-tiket",
    kataPart: "Part",
    gayaPart: { ...Ty.pengaturanDefault.gayaPart, ukuran: 30 },
  };
  const f100 = tulisPngBingkaiTeks("part", { pengaturan: dasar, judulTxt: "", partTxt: "Part 1", W: 1080, H: 1920, dirTmp, tag: "s100" });
  const f200 = tulisPngBingkaiTeks("part", { pengaturan: { ...dasar, bingkaiPartLebar: 200 }, judulTxt: "", partTxt: "Part 1", W: 1080, H: 1920, dirTmp, tag: "s200" });
  sama(!!f100 && !!f200, "PNG skala gagal");
  const u100 = statSync(f100 as string).size;
  const u200 = statSync(f200 as string).size;
  sama(u200 > u100, `PNG 200% (${u200}) harus > 100% (${u100})`);
});
uji("teks sasaran kosong / mode salah → null (aman)", () => {
  const p = { ...Ty.pengaturanDefault, bingkaiPart: "ep-tiket" };
  sama(tulisPngBingkaiTeks("part", { pengaturan: p, judulTxt: "X", partTxt: "  ", W: 1080, H: 1920, dirTmp, tag: "k1" }) === null, "part kosong harus null");
  const q = { ...Ty.pengaturanDefault, bingkaiDeskripsi: "dp-kaca" };
  sama(tulisPngBingkaiTeks("deskripsi", { pengaturan: q, judulTxt: "", partTxt: "", W: 1080, H: 1920, dirTmp, tag: "k2" }) === null, "deskripsi kosong harus null");
  sama(tulisPngBingkaiJudul({ pengaturan: { ...Ty.pengaturanDefault, bingkaiJudul: "ep-tiket" }, judulTxt: "X", partTxt: "", W: 1080, H: 1920, dirTmp, tag: "k3" }) === null, "id part di judul harus null");
});

console.log("== F · Rantai ffmpeg: overlay [bp]/[bd] + nol regresi ==");
const dasarArg = {
  src: "/tmp/tidak-ada.mp4",
  bg: null,
  logo: null,
  pengaturan: {
    ...Ty.pengaturanDefault,
    judul: "UJI",
    kataPart: "Part",
    deskripsi: "deskripsi uji",
  } as Ty.Pengaturan,
  n: 1,
  mulai: 0,
  durasi: 5,
  W: 1080,
  H: 1920,
  fps: 30,
  adaAudio: false,
  judulTxt: "UJI",
  partTxt: "Part 1",
  deskripsiTxt: "deskripsi uji",
  dirTmp,
  tag: "arg360",
  codecArgs: ["-c:v", "libx264"],
  keluar: path.join(dirTmp, "keluar.mp4"),
};
const pngPart = path.join(dirTmp, "p-ep-tiket-bingkai-part.png");
const pngDesk = path.join(dirTmp, "d-dp-kaca-bingkai-deskripsi.png");
uji("tanpa file bingkai → nol overlay [bj]/[bp]/[bd]", () => {
  const { args } = bangunArgumenPart(dasarArg);
  const fc = args[args.indexOf("-filter_complex") + 1];
  sama(!fc.includes("[bjf]") && !fc.includes("[bp") && !fc.includes("[bd"), "overlay bocor tanpa file");
});
uji("dgn file part & deskripsi → input + overlay SEBELUM drawtext", () => {
  sama(existsSync(pngPart), "PNG part dari uji E harus ada");
  sama(existsSync(pngDesk), "PNG deskripsi dari uji E harus ada");
  const { args } = bangunArgumenPart({ ...dasarArg, fileBingkaiPart: pngPart, fileBingkaiDeskripsi: pngDesk });
  sama(args.includes(pngPart) && args.includes(pngDesk), "input PNG tidak masuk");
  const fc = args[args.indexOf("-filter_complex") + 1];
  sama(fc.includes("[bpf]") && fc.includes("[bpk]"), "overlay part tak ada");
  sama(fc.includes("[bdf]") && fc.includes("[bdk]"), "overlay deskripsi tak ada");
  const iBp = fc.indexOf("[bpk]");
  const iBd = fc.indexOf("[bdk]");
  const iTeks = fc.indexOf("drawtext=");
  sama(iBp >= 0 && iBd > iBp && iTeks > iBd, `urutan salah (bp ${iBp}, bd ${iBd}, teks ${iTeks})`);
});
uji("animasi naik → overlay part ikut ekspresi y + eval=frame", () => {
  const { args } = bangunArgumenPart({
    ...dasarArg,
    pengaturan: { ...dasarArg.pengaturan, animasiTeks: "naik" },
    fileBingkaiPart: pngPart,
  });
  const fc = args[args.indexOf("-filter_complex") + 1];
  // [bpf] muncul 2× (output format + input overlay) — pola overlay penuh:
  sama(/\[bpf\]overlay=x=0:y='[^']*':eval=frame\[bpk\]/.test(fc), "ekspresi animasi tak ada di overlay part");
});
uji("bingkai deskripsi TANPA animasi (statis — sama dgn drawtext deskripsi)", () => {
  const { args } = bangunArgumenPart({
    ...dasarArg,
    pengaturan: { ...dasarArg.pengaturan, animasiTeks: "fade" },
    fileBingkaiDeskripsi: pngDesk,
  });
  const fc = args[args.indexOf("-filter_complex") + 1];
  sama(fc.includes("[bdf]overlay=0:0[bdk]"), "bingkai deskripsi harus statis overlay=0:0");
  sama(!/format=rgba,fade=t=in[^;]*\[bdf\]/.test(fc), "bingkai deskripsi tak boleh beranimasi");
});

console.log(`\nHASIL: ${lolos} lolos, ${gagal} gagal`);
process.exit(gagal > 0 ? 1 : 0);
