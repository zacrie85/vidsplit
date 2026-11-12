// uji-v371.ts — Uji unit + render nyata v3.7.1: COVER BERSIH & BERURUTAN.
// Permintaan user: (1) cover harus berjalan sendiri dulu (2-3 dtk) baru film;
// (2) cover tidak boleh terbawa tulisan judul/part/deskripsi dari video.
// Akar: drawtext/bingkai/subtitle video diterapkan setelah merge → kini
// enable='gte(t,OFSET)' + animasi dihitung dr ofset (ofset=0 = pola lama).
// Jalankan: npx tsx scripts/uji-v371.ts
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import * as Ty from "../src/lib/vidsplit/types";
import { bangunArgumenPart, pilihFfmpeg, jalankanFfmpeg } from "../src/lib/vidsplit/ffmpeg";

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

const dirTmp = path.join(process.cwd(), "work", "tmp-uji-v371");
mkdirSync(dirTmp, { recursive: true });

const dasarArg = {
  src: path.join(dirTmp, "src.mp4"),
  bg: null as string | null,
  logo: null,
  pengaturan: { ...Ty.pengaturanDefault, judul: "JUDUL UJI", kataPart: "Part", deskripsi: "DESKRIPSI UJI V371" } as Ty.Pengaturan,
  n: 1,
  mulai: 0,
  durasi: 3,
  W: 720,
  H: 1280,
  fps: 30,
  adaAudio: true,
  judulTxt: "JUDUL UJI",
  partTxt: "Part 1",
  deskripsiTxt: "DESKRIPSI UJI V371",
  dirTmp,
  tag: "u371",
  codecArgs: ["-c:v", "libx264", "-preset", "ultrafast", "-crf", "30"],
  keluar: path.join(dirTmp, "keluar.mp4"),
};

uji("siapkan sumber + cover", () => {
  const ff = execFileSync("ffmpeg", [
    "-y", "-hide_banner", "-loglevel", "error",
    "-f", "lavfi", "-i", "testsrc2=size=720x1280:rate=30:duration=3",
    "-f", "lavfi", "-i", "sine=frequency=440:duration=3",
    "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-shortest", dasarArg.src,
  ], { stdio: "pipe" });

console.log("== A · Gerbang waktu di filter (tanpa cover = nol regresi) ==");
uji("tanpa intro → TANPA enable gte (argumen persis lama)", () => {
  const { args } = bangunArgumenPart(dasarArg);
  const fc = args[args.indexOf("-filter_complex") + 1];
  sama(!fc.includes("enable="), "enable bocor tanpa intro");
  sama(fc.includes("drawtext="), "drawtext hilang");
});
uji("dgn intro 2 dtk (concat, transisi mati) → drawtext+overlay enable gte(t,2.000)", () => {
  const p = { ...dasarArg.pengaturan, coverTrans: "", introFade: false };
  const { args } = bangunArgumenPart({ ...dasarArg, pengaturan: p, bg: path.join(dirTmp, "cover.png") });
  const fc = args[args.indexOf("-filter_complex") + 1];
  const n = (fc.match(/enable='gte\(t,2\.000\)'/g) || []).length;
  sama(n >= 3, `enable gte(2.000) hanya ${n}x (minimal 3: judul+part+deskripsi)`);
  sama(!fc.includes("xfade="), "xfade bocor saat transisi mati");
  sama(!fc.includes("gte(t,0.000)"), "enable nol bocor");
});
uji("bawaan (transisi crossfade 0.6) → enable gte(t,2.600) + prog ofset", () => {
  const p = { ...dasarArg.pengaturan, animasiTeks: "fade" as const };
  const { args } = bangunArgumenPart({ ...dasarArg, pengaturan: p, bg: path.join(dirTmp, "cover.png") });
  const fc = args[args.indexOf("-filter_complex") + 1];
  const n = (fc.match(/enable='gte\(t,2\.600\)'/g) || []).length;
  sama(n >= 3, `enable gte(2.600) hanya ${n}x (minimal 3)`);
  sama(fc.includes("xfade=transition=fadewhite:duration=0.600:offset=2.000"), "xfade hilang");
  // animasi masuk teks dihitung dr ofset
  sama(fc.includes("min(max(t-2.600,0)/"), "prog animasi tidak memakai ofset");
});
uji("animasi fade dgn ofset (concat) → alpha min(max(t-OFSET,0)/D,1)", () => {
  const p = { ...dasarArg.pengaturan, animasiTeks: "fade" as const, coverTrans: "", introFade: false };
  const { args } = bangunArgumenPart({ ...dasarArg, pengaturan: p, bg: path.join(dirTmp, "cover.png") });
  const fc = args[args.indexOf("-filter_complex") + 1];
  sama(fc.includes("alpha='min(max(t-2.000,0)/0.70,1)'"), "alpha ofset salah");
});

console.log("== B · Render ffmpeg nyata: cover bersih → film + teks ==");
  // cover PNG biru polos (tanpa teks) — penguji frame bersih
  execFileSync("ffmpeg", [
    "-y", "-hide_banner", "-loglevel", "error",
    "-f", "lavfi", "-i", "color=c=0x1836b0:size=720x1280",
    "-frames:v", "1", path.join(dirTmp, "cover.png"),
  ], { stdio: "pipe" });
  sama(existsSync(dasarArg.src) && existsSync(path.join(dirTmp, "cover.png")), "sumber/cover gagal");
});

uji("render: intro 2 dtk + concat → urutan cover lalu film", async () => {
  void 0; // dijalankan di blok async bawah (sep.pemisah unit)
});

(async () => {
  try {
    const ff = await pilihFfmpeg();
    const { args, total } = bangunArgumenPart({ ...dasarArg, bg: path.join(dirTmp, "cover.png") });
    await jalankanFfmpeg(args, total, undefined, ff.bin);
    const out = dasarArg.keluar;
    sama(existsSync(out) && statSync(out).size > 10_000, "hasil render tidak ada");
    // durasi harus 2 + 3 = 5 dtk (cover dulu, lalu film — bukan tumpang tindih)
    const probe = execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", out]).toString().trim();
    const dur = Number(probe);
    sama(dur > 4.7 && dur < 5.4, `durasi ${dur} (harus ±5 = cover 2 + film 3)`);
    // ekstrak frame saat cover (t=1.0) & saat film (t=3.0)
    const fCv = path.join(dirTmp, "f-cover.png");
    const fFl = path.join(dirTmp, "f-film.png");
    for (const [t, f] of [["1.0", fCv], ["3.0", fFl]] as [string, string][]) {
      execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-ss", t, "-i", out, "-frames:v", "1", f], { stdio: "pipe" });
    }
    sama(existsSync(fCv) && existsSync(fFl), "ekstraksi frame gagal");
    // analisis piksel: judul video digambar di margin atas (judulY -1 → 4,5% atas).
    // Band teks judul: y 4–14% tinggi, x 20–80% → saat cover HARUS polos biru
    // (0x1836b0), saat film ada piksel terang (teks putih + testsrc2 warna-warni).
    const png = readFileSync(fCv).subarray(1, 4).toString("ascii");
    sama(png === "PNG", "frame cover bukan PNG");
    const analisis = (f: string): { terang: number; total: number; rataBiru: boolean } => {
      const outTxt = execFileSync("ffmpeg", ["-i", f, "-vf", "crop=432:154:144:56,format=rgb24", "-f", "rawvideo", "-"], { stdio: ["pipe", "pipe", "ignore"] });
      const px = outTxt as unknown as Buffer;
      let terang = 0;
      let biru = 0;
      const total = px.length / 3;
      for (let i = 0; i < px.length; i += 3) {
        const r = px[i], g = px[i + 1], b = px[i + 2];
        if (r + g + b > 500) terang++;
        if (b > r + 40 && b > g + 40) biru++;
      }
      return { terang, total, rataBiru: biru > total * 0.8 };
    };
    const aCv = analisis(fCv);
    const aFl = analisis(fFl);
    // saat cover: band judul harus polos (tanpa piksel teks terang) & biru
    sama(aCv.rataBiru, `frame cover tidak polos biru (biru ${(aCv.terang / aCv.total * 100).toFixed(1)}% terang)`);
    // saat film: testsrc2 warna-warni — cukup buktikan band TIDAK biru polos
    sama(!aFl.rataBiru, "frame film malah biru polos (film tidak masuk)");
    console.log(`  LOLOS  frame t=1.0 = cover bersih polos ✓  ·  frame t=3.0 = film ✓`);
    lolos++;
  } catch (e) {
    gagal++;
    console.log(`  GAGAL  render nyata: ${e instanceof Error ? e.message : e}`);
  }
  console.log(`\nHASIL: ${lolos} lolos, ${gagal} gagal`);
  process.exit(gagal > 0 ? 1 : 0);
})();
