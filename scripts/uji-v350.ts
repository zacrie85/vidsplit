// uji-v350.ts — Uji unit v3.5.0: BINGKAI JUDUL FUTURISTIK (10 gaya transparan,
// kotak mengikuti judul, posisi ikut judulX/judulY) + render nyata ffmpeg
// 2 gaya bingkai. Jalankan: npx tsx scripts/uji-v350.ts
import { mkdirSync, readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import { execFileSync, execSync } from "node:child_process";
import * as Bj from "../src/lib/vidsplit/bingkaiJudul";
import * as Ty from "../src/lib/vidsplit/types";
import * as Bg from "../src/lib/vidsplit/bungkus";
import { tulisPngBingkaiJudul } from "../src/lib/vidsplit/thumbnail";
import { bangunArgumenPart, fontfileNama } from "../src/lib/vidsplit/ffmpeg";

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

const dirTmp = path.join(process.cwd(), "work", "tmp-uji-v350");
mkdirSync(dirTmp, { recursive: true });

console.log("== A · Daftar 10 gaya bingkai judul ==");
uji("BINGKAI_JUDUL berisi tepat 10 gaya", () => {
  sama(Bj.BINGKAI_JUDUL.length === 10, `jumlah = ${Bj.BINGKAI_JUDUL.length}`);
});
uji("id unik + label terisi + pad wajar", () => {
  const ids = Bj.BINGKAI_JUDUL.map((g) => g.id);
  sama(new Set(ids).size === 10, "id duplikat");
  for (const g of Bj.BINGKAI_JUDUL) {
    sama(g.nama.length > 2 && g.nama.length <= 14, `label aneh: ${g.nama}`);
    sama(g.padX > 0.3 && g.padX < 1.2 && g.padY > 0.3 && g.padY < 1.0, `pad aneh: ${g.id}`);
  }
});
uji("gayaBingkaiJudul: dikenal / tak dikenal / kosong", () => {
  sama(Bj.gayaBingkaiJudul("hud-sudut") !== null, "hud-sudut tak dikenal");
  sama(Bj.gayaBingkaiJudul("tidak-ada") === null, "id aneh lolos");
  sama(Bj.gayaBingkaiJudul("") === null, "kosong harus null (mati)");
});

console.log("== B · Geometri kotak (mengikuti judul + jangkar drawtext) ==");
uji("kotak = teks + padding per gaya", () => {
  const k = Bj.kotakBingkaiJudul("hud-sudut", 50, 100, 400, 60, 40, 1080, 1920)!;
  const g = Bj.gayaBingkaiJudul("hud-sudut")!;
  sama(Math.abs(k.w - (400 + 2 * g.padX * 40)) < 1, `w ${k.w}`);
  sama(Math.abs(k.h - (60 + 2 * g.padY * 40)) < 1, `h ${k.h}`);
});
uji("X=50 → kotak tengah kanvas (jangkar = tengah blok teks)", () => {
  const k = Bj.kotakBingkaiJudul("retikel", 50, 100, 400, 60, 40, 1080, 1920)!;
  sama(Math.abs(k.x + k.w / 2 - 540) < 1, `tengah ${k.x + k.w / 2}`);
});
uji("X selain 50 → tengah kotak di W×X%", () => {
  const k = Bj.kotakBingkaiJudul("retikel", 30, 100, 400, 60, 40, 1080, 1920)!;
  sama(Math.abs(k.x + k.w / 2 - 324) < 1.5, `tengah ${k.x + k.w / 2} vs 324`);
});
uji("Y = atas blok teks − padY (clamp ke 0 bila mentok)", () => {
  const g = Bj.gayaBingkaiJudul("retikel")!;
  const k1 = Bj.kotakBingkaiJudul("retikel", 50, 100, 400, 60, 40, 1080, 1920)!;
  sama(Math.abs(k1.y - (100 - g.padY * 40)) < 1, `y ${k1.y}`);
  const k2 = Bj.kotakBingkaiJudul("retikel", 50, 2, 400, 60, 40, 1080, 1920)!;
  sama(k2.y === 0, `clamp atas: y ${k2.y}`);
});
uji("kotak tidak pernah keluar kanvas (4 sudut)", () => {
  for (const g of Bj.BINGKAI_JUDUL) {
    const k = Bj.kotakBingkaiJudul(g.id, 0, 0, 900, 300, 90, 1080, 1920)!;
    sama(k.x >= 0 && k.y >= 0 && k.x + k.w <= 1080 && k.y + k.h <= 1920, `${g.id} keluar: ${JSON.stringify(k)}`);
  }
});
uji("id kosong/tak dikenal → null (mati)", () => {
  sama(Bj.kotakBingkaiJudul("", 50, 100, 400, 60, 40, 1080, 1920) === null, "kosong");
  sama(Bj.kotakBingkaiJudul("aneh", 50, 100, 400, 60, 40, 1080, 1920) === null, "aneh");
});

console.log("== C · SVG bingkai (kanvas & kotak pratinjau) ==");
uji("tiap gaya menghasilkan SVG kanvas valid & unik", () => {
  const k = Bj.kotakBingkaiJudul("hud-sudut", 50, 100, 400, 60, 40, 1080, 1920)!;
  const kumpulan = new Set<string>();
  for (const g of Bj.BINGKAI_JUDUL) {
    const svg = Bj.svgBingkaiJudulKanvas(g.id, k, 1080, 1920);
    sama(svg.startsWith("<svg") && svg.endsWith("</svg>"), `${g.id}: bentuk svg`);
    sama(svg.includes('width="1080"') && svg.includes('height="1920"'), `${g.id}: kanvas`);
    sama(/<(rect|path|polygon|line|circle)/.test(svg), `${g.id}: tanpa bentuk`);
    sama(svg.includes("fill-opacity") || svg.includes("stroke-opacity"), `${g.id}: tanpa transparansi`);
    kumpulan.add(svg);
  }
  sama(kumpulan.size === 10, `svg bentrok: ${kumpulan.size}/10 unik`);
});
uji("svg kotak pratinjau: preserveAspectRatio=none + non-scaling-stroke", () => {
  const svg = Bj.svgBingkaiJudulKotak("neon-bulat");
  sama(svg.includes('preserveAspectRatio="none"'), "tanpa pAR none");
  sama(svg.includes("non-scaling-stroke"), "tanpa non-scaling-stroke");
  sama(svg.includes('viewBox="0 0 340 132"'), "viewBox nominal");
});

console.log("== D · Setelan: default, migrasi, salin ==");
uji("bawaan bingkaiJudul = '' (nol regresi)", () => {
  sama((Ty.pengaturanDefault as { bingkaiJudul: string }).bingkaiJudul === "", "bawaan bukan kosong");
});
uji("migrasiSimpanan: tanpa field → ''; id aneh → ''; id sah tetap", () => {
  const a = Ty.migrasiSimpanan({ bingkaiJudul: undefined });
  sama(a.bingkaiJudul === "", `tanpa field → ${a.bingkaiJudul}`);
  const b = Ty.migrasiSimpanan({ bingkaiJudul: "gaya-hantu" });
  sama(b.bingkaiJudul === "", `id aneh → ${b.bingkaiJudul}`);
  const c = Ty.migrasiSimpanan({ bingkaiJudul: "siber-hex" });
  sama(c.bingkaiJudul === "siber-hex", `id sah → ${c.bingkaiJudul}`);
});
uji("terapkanSebagian membawa bingkaiJudul ke semua video", () => {
  const target: Ty.Pengaturan = { ...Ty.pengaturanDefault, bingkaiJudul: "" };
  const sumber: Ty.Pengaturan = { ...Ty.pengaturanDefault, bingkaiJudul: "hud-sudut" };
  const hasil = Ty.terapkanSebagian(sumber, target);
  sama(hasil.bingkaiJudul === "hud-sudut", "bingkai ikut tersalin");
});

console.log("== E · Ukur blok judul + PNG server (resvg) ==");
uji("estimator lebar baris publik bekerja", () => {
  // "JUDUL UJI" = 9 karakter × 40px × 0,78em (cinzeldec) × pengaman 1,06 ≈ 297
  const w = Bg.lebarBarisPerkiraan("JUDUL UJI", 40, "cinzeldec");
  sama(w > 40 * 5 && w < 40 * 9, `w ${w} di luar perkiraan wajar`);
});
uji("fontfileNama memberi TTF nyata (ukur TTF jalan)", () => {
  const p = fontfileNama("cinzeldec");
  sama(!!p && existsSync(p), `font cinzeldec tak ketemu: ${p}`);
});
uji("tulisPngBingkaiJudul: bingkai '' → null", () => {
  const p = { ...Ty.pengaturanDefault, bingkaiJudul: "" };
  sama(tulisPngBingkaiJudul({ pengaturan: p, judulTxt: "X", partTxt: "", W: 1080, H: 1920, dirTmp, tag: "t0" }) === null, "harus null");
});
uji("tulisPngBingkaiJudul: judul kosong → null", () => {
  const p = { ...Ty.pengaturanDefault, bingkaiJudul: "hud-sudut" };
  sama(tulisPngBingkaiJudul({ pengaturan: p, judulTxt: "  ", partTxt: "", W: 1080, H: 1920, dirTmp, tag: "t1" }) === null, "harus null");
});
uji("tulisPngBingkaiJudul: 10 gaya → PNG nyata non-trivial", () => {
  for (const g of Bj.BINGKAI_JUDUL) {
    const p: Ty.Pengaturan = {
      ...Ty.pengaturanDefault,
      bingkaiJudul: g.id,
      judul: "UJI BINGKAI JUDUL v3.5",
      gayaJudul: { ...Ty.pengaturanDefault.gayaJudul, ukuran: 30 },
    };
    const f = tulisPngBingkaiJudul({ pengaturan: p, judulTxt: p.judul, partTxt: "Part 1", W: 1080, H: 1920, dirTmp, tag: `t-${g.id}` });
    sama(!!f, `${g.id}: path null`);
    const ada = existsSync(f as string);
    sama(ada, `${g.id}: PNG tak ada`);
    const ukuran = statSync(f as string).size;
    sama(ukuran > 500, `${g.id}: PNG terlalu kecil (${ukuran} B)`);
    const magic = readFileSync(f as string).subarray(1, 4).toString("ascii");
    sama(magic === "PNG", `${g.id}: bukan PNG (${magic})`);
  }
});
uji("judul panjang 2 baris → PNG tetap terbentuk", () => {
  const p: Ty.Pengaturan = {
    ...Ty.pengaturanDefault,
    bingkaiJudul: "grid-teknologi",
    judul: "JUDUL PANJANG SEKALI HINGGA TERLIPAT MENJADI BANYAK BARIS OKE",
    gayaJudul: { ...Ty.pengaturanDefault.gayaJudul, ukuran: 64 },
  };
  const f = tulisPngBingkaiJudul({ pengaturan: p, judulTxt: p.judul, partTxt: "", W: 1080, H: 1920, dirTmp, tag: "t-2baris" });
  sama(!!f && existsSync(f as string), "PNG 2 baris gagal");
});

console.log("== F · Rantai ffmpeg (input + overlay di bawah drawtext) ==");
const dasarArg = {
  src: "/tmp/tidak-ada.mp4",
  bg: null,
  logo: null,
  pengaturan: { ...Ty.pengaturanDefault, bingkaiJudul: "hud-sudut", judul: "UJI" } as Ty.Pengaturan,
  n: 1,
  mulai: 0,
  durasi: 5,
  W: 1080,
  H: 1920,
  fps: 30,
  adaAudio: false,
  judulTxt: "UJI",
  partTxt: "",
  deskripsiTxt: "",
  dirTmp,
  tag: "arg",
  codecArgs: ["-c:v", "libx264"],
  keluar: path.join(dirTmp, "keluar.mp4"),
};
uji("tanpa fileBingkaiJudul → tanpa overlay bingkai (nol regresi)", () => {
  const { args } = bangunArgumenPart(dasarArg);
  const fc = args[args.indexOf("-filter_complex") + 1];
  sama(!fc.includes("[bjf]") && !fc.includes("[bjk]"), "overlay bocor tanpa file");
});
uji("dgn fileBingkaiJudul → input + overlay [bjf]→[bjk] SEBELUM drawtext", () => {
  const png = path.join(dirTmp, "t-hud-sudut-bingkai-judul.png");
  sama(existsSync(png), "PNG dari uji E harus ada");
  const { args } = bangunArgumenPart({ ...dasarArg, fileBingkaiJudul: png });
  sama(args.includes(png), "input PNG tidak masuk");
  const fc = args[args.indexOf("-filter_complex") + 1];
  sama(fc.includes("[bjf]"), "filter [bjf] tak ada");
  sama(fc.includes("[bjk]"), "label [bjk] tak ada");
  const iBj = fc.indexOf("[bjk]");
  const iTeks = fc.indexOf("drawtext=");
  sama(iBj >= 0 && iTeks > iBj, `urutan salah (bjk ${iBj} vs drawtext ${iTeks})`);
});
uji("animasi naik → overlay y ekspresi + eval=frame", () => {
  const png = path.join(dirTmp, "t-hud-sudut-bingkai-judul.png");
  const { args } = bangunArgumenPart({
    ...dasarArg,
    pengaturan: { ...Ty.pengaturanDefault, bingkaiJudul: "hud-sudut", judul: "UJI", animasiTeks: "naik" } as Ty.Pengaturan,
    fileBingkaiJudul: png,
  });
  const fc = args[args.indexOf("-filter_complex") + 1];
  sama(fc.includes("overlay=x=0:y='(1-min(t/"), "ekspresi y naik salah");
  sama(fc.includes("eval=frame"), "eval=frame hilang");
});
uji("animasi fade → fade alpha pada PNG bingkai", () => {
  const png = path.join(dirTmp, "t-hud-sudut-bingkai-judul.png");
  const { args } = bangunArgumenPart({
    ...dasarArg,
    pengaturan: { ...Ty.pengaturanDefault, bingkaiJudul: "hud-sudut", judul: "UJI", animasiTeks: "fade" } as Ty.Pengaturan,
    fileBingkaiJudul: png,
  });
  const fc = args[args.indexOf("-filter_complex") + 1];
  sama(fc.includes("fade=t=in:st=0:d=0.70:alpha=1"), "fade alpha salah");
});
uji("mode template → bingkai TIDAK dipasang (kotak desain sendiri)", () => {
  const png = path.join(dirTmp, "t-hud-sudut-bingkai-judul.png");
  const { args } = bangunArgumenPart({
    ...dasarArg,
    pengaturan: { ...Ty.pengaturanDefault, mode: "template", bingkaiJudul: "hud-sudut", judul: "UJI" } as Ty.Pengaturan,
    fileBingkaiJudul: png,
  });
  const fc = args[args.indexOf("-filter_complex") + 1];
  sama(!fc.includes("[bjf]"), "bingkai bocor di mode template");
});

console.log("== G · Render nyata ffmpeg (2 gaya) ==");
const ffBin = process.env.VIDSPLIT_FFMPEG || "ffmpeg";
const adaFf = (() => {
  try {
    execSync(`${ffBin} -version`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();
if (!adaFf) {
  console.log("  [LEWAT] render nyata — ffmpeg tidak tersedia di sandbox");
} else {
  uji("render nyata: overlay bingkai hud-sudut + drawtext (5 dtk)", () => {
    const png = path.join(dirTmp, "t-hud-sudut-bingkai-judul.png");
    const ffJ = fontfileNama("cinzeldec");
    const args = [
      "-y", "-hide_banner", "-v", "error",
      "-f", "lavfi", "-i", "color=c=black:s=1080x1920:d=2:r=30",
      "-loop", "1", "-i", png,
      "-filter_complex",
      `[1:v]format=rgba[bjf];[0:v][bjf]overlay=0:0[bjk];[bjk]drawtext=text='UJI BINGKAI':fontcolor=white:fontsize=40:x=(w-text_w)/2:y=110${ffJ ? `:fontfile='${ffJ}'` : ""}[vout]`,
      "-map", "[vout]", "-frames:v", "30", "-c:v", "libx264", "-preset", "ultrafast",
      path.join(dirTmp, "render-hud.mp4"),
    ];
    execFileSync(ffBin, args, { stdio: "ignore", timeout: 90_000 });
    const out = path.join(dirTmp, "render-hud.mp4");
    sama(existsSync(out), "video render gagal dibuat");
    sama(statSync(out).size > 10_000, "video render terlalu kecil");
  });
  uji("render nyata: bingkai siber-hex + animasi naik (overlay ekspresi)", () => {
    const png = path.join(dirTmp, "t-siber-hex-bingkai-judul.png");
    const args = [
      "-y", "-hide_banner", "-v", "error",
      "-f", "lavfi", "-i", "color=c=black:s=720x1280:d=1.5:r=25",
      "-loop", "1", "-i", png,
      "-filter_complex",
      "[1:v]format=rgba,fade=t=in:st=0:d=0.70:alpha=1[bjf];[0:v][bjf]overlay=x=0:y='(1-min(t/0.70,1))*115.2':eval=frame[bjk]",
      "-map", "[bjk]", "-frames:v", "30", "-c:v", "libx264", "-preset", "ultrafast",
      path.join(dirTmp, "render-hex.mp4"),
    ];
    execFileSync(ffBin, args, { stdio: "ignore", timeout: 90_000 });
    sama(existsSync(path.join(dirTmp, "render-hex.mp4")), "video hex gagal");
  });
}

console.log(`\nHasil: ${lolos} LOLOS, ${gagal} GAGAL`);
if (gagal > 0) process.exit(1);
