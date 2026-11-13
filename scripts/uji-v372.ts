// uji-v372.ts — v3.7.2: COVER TIDAK DOBEL & IKUT ANIMASI + POSISI SESUAI LAYOUT.
// Laporan user (video): "tulisan nya sudah nempel duluan tidak mengikuti
// transisi efek nya dan tempat letak tulisan judul nya tidak sesuai dengan
// LAYOUT COVER yang di pilih — cek semua LAYOUT COVER".
// Akar: jalur lapis animasi memakai bg KOMPOSIT ber-teks-terbakar → teks
// tampil statis dari frame 0 + salinan beranimasi di atasnya (dobel).
// Fix: dasar = frame + lapis.bg (TANPA teks); lapis tanpa animasi = overlay
// statis; lapis judul/part selalu digambar saat mode lapis aktif.
// Jalankan: npx tsx scripts/uji-v372.ts
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import * as Ty from "../src/lib/vidsplit/types";
import { NOVACUT_LAYOUTS, svgCover, svgCoverLapis } from "../src/lib/vidsplit/coverNovacut";
import { renderSvgCoverPng, pengukurTeksServer } from "../src/lib/vidsplit/thumbnail";
import { bangunArgumenPart, jalankanFfmpeg, pilihFfmpeg } from "../src/lib/vidsplit/ffmpeg";

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
const dirTmp = path.join(process.cwd(), "work", "tmp-uji-v372");
mkdirSync(dirTmp, { recursive: true });
const ukur = pengukurTeksServer();
const JUDUL = "JUDUL UJI LAYOUT KINOSTRA";
const PART = "PART 01";

/** baca piksel PNG → RGB buffer (720×1280×3) */
const piksel = (file: string): Buffer =>
  execFileSync("ffmpeg", ["-i", file, "-vf", "format=rgb24", "-f", "rawvideo", "-"], {
    stdio: ["pipe", "pipe", "ignore"],
    maxBuffer: 64 * 1024 * 1024,
  }) as unknown as Buffer;

/** fraksi piksel dlm mask yg berubah signifikan (|Δ|>45 salah satu kanal) */
const berubah = (a: Buffer, b: Buffer, mask: Uint8Array): number => {
  let n = 0;
  let d = 0;
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue;
    n++;
    const j = i * 3;
    if (
      Math.abs(a[j] - b[j]) > 45 ||
      Math.abs(a[j + 1] - b[j + 1]) > 45 ||
      Math.abs(a[j + 2] - b[j + 2]) > 45
    )
      d++;
  }
  return n ? d / n : 0;
};

/** mask = piksel yang beda signifikan antara desain penuh & dasar bersih */
const maskDari = (ref: Buffer, dasar: Buffer): { mask: Uint8Array; n: number } => {
  const mask = new Uint8Array(W * H);
  let n = 0;
  for (let i = 0; i < W * H; i++) {
    const j = i * 3;
    if (
      Math.abs(ref[j] - dasar[j]) > 45 ||
      Math.abs(ref[j + 1] - dasar[j + 1]) > 45 ||
      Math.abs(ref[j + 2] - dasar[j + 2]) > 45
    ) {
      mask[i] = 1;
      n++;
    }
  }
  return { mask, n };
};

const buatSrc = async (): Promise<string> => {
  const src = path.join(dirTmp, "src.mp4");
  if (!existsSync(src))
    execFileSync(
      "ffmpeg",
      ["-y", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc2=size=720x1280:rate=30:duration=3",
       "-f", "lavfi", "-i", "sine=frequency=440:duration=3", "-c:v", "libx264", "-preset", "ultrafast",
       "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", src],
      { stdio: "pipe" },
    );
  return src;
};

const dasarArg = (src: string, over: Partial<Parameters<typeof bangunArgumenPart>[0]>) => ({
  src,
  bg: null as string | null,
  logo: null,
  pengaturan: { ...Ty.pengaturanDefault } as Ty.Pengaturan,
  n: 1,
  mulai: 0,
  durasi: 3,
  W,
  H,
  fps: 30,
  adaAudio: true,
  judulTxt: "",
  partTxt: "",
  deskripsiTxt: "",
  dirTmp,
  tag: "u372",
  codecArgs: ["-c:v", "libx264", "-preset", "ultrafast", "-crf", "30"],
  keluar: path.join(dirTmp, "keluar.mp4"),
  ...over,
});

(async () => {
  const ff = await pilihFfmpeg();
  const src = await buatSrc();
  console.log("== A · SEMUA 10 LAYOUT: dasar bersih, teks masuk beranimasi, posisi = desain ==");
  for (const lay of NOVACUT_LAYOUTS) {
    await uji(`layout ${lay.k} (${lay.n})`, async () => {
      const opsi = {
        template: `${lay.k}--cyber`,
        W,
        H,
        judul: JUDUL,
        labelPart: PART,
        latar: "hitam" as const,
        skalaPart: 1,
        bingkai: "none" as const,
      };
      const lapis = svgCoverLapis(opsi, ukur);
      const fDasar = path.join(dirTmp, `dasar-${lay.k}.png`);
      const fJudul = path.join(dirTmp, `judul-${lay.k}.png`);
      const fPart = path.join(dirTmp, `part-${lay.k}.png`);
      const fRef = path.join(dirTmp, `ref-${lay.k}.png`);
      writeFileSync(fDasar, renderSvgCoverPng(lapis.bg, W, H));
      writeFileSync(fJudul, renderSvgCoverPng(lapis.judul, W, H));
      writeFileSync(fPart, renderSvgCoverPng(lapis.part, W, H));
      writeFileSync(fRef, renderSvgCoverPng(svgCover(opsi, ukur), W, H));
      // (1) lapis judul & part BENAR-BENAR menggambar (bukan dokumen kosong)
      const pJudul = piksel(fJudul);
      const pRef = piksel(fRef);
      const pDasar = piksel(fDasar);
      let nonHitamJ = 0;
      for (let i = 0; i < pJudul.length; i += 3)
        if (pJudul[i] + pJudul[i + 1] + pJudul[i + 2] > 45) nonHitamJ++;
      sama(nonHitamJ > 300, `lapis judul hampir kosong (${nonHitamJ} px non-hitam)`);
      // (2) dasar TANPA teks: piksel desain di ref TIDAK ada di dasar
      const { mask, n } = maskDari(pRef, pDasar);
      sama(n > 250, `desain tak terdeteksi di ref (mask ${n} px)`);
      // dasar = ref di LUAR mask (tanpa teks liar di tempat lain)
      const inv = new Uint8Array(W * H);
      for (let i = 0; i < inv.length; i++) inv[i] = mask[i] ? 0 : 1;
      const luar = berubah(pRef, pDasar, inv);
      sama(luar < 0.02, `dasar beda dgn desain di luar area teks (${(luar * 100).toFixed(2)}%)`);
      // (3) render ffmpeg nyata: judul RISE + part FADE (mode lapis)
      const keluar = path.join(dirTmp, `out-${lay.k}.mp4`);
      const { args, total } = bangunArgumenPart(
        dasarArg(src, {
          bg: fDasar,
          bgJudul: fJudul,
          bgPartLapis: fPart,
          pengaturan: {
            ...Ty.pengaturanDefault,
            coverAnimJudul: "rise",
            coverAnimPart: "fade",
            coverTrans: "",
            introFade: false,
          } as Ty.Pengaturan,
          keluar: keluar,
          tag: `u372-${lay.k}`,
        }),
      );
      await jalankanFfmpeg(args, total, undefined, ff.bin);
      sama(existsSync(keluar), "render gagal");
      const ambil = async (t: string): Promise<Buffer> => {
        const f = path.join(dirTmp, `fr-${lay.k}-${t}.png`);
        execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-ss", t, "-i", keluar, "-frames:v", "1", f], { stdio: "pipe" });
        return piksel(f);
      };
      const f0 = await ambil("0.067");
      const f1 = await ambil("1.8");
      // (4) t awal: teks BELUM ada (tidak nempel duluan) — beda dgn ref besar
      const awal = berubah(f0, pRef, mask);
      sama(awal > 0.55, `teks sudah nempel di awal (berubah ${ (awal * 100).toFixed(1)}%)`);
      // (5) t akhir: komposisi = desain layout (posisi & bentuk cocok)
      const akhir = berubah(f1, pRef, mask);
      const tol = lay.k === "outline" || lay.k === "sticker" || lay.k === "band" ? 0.32 : 0.18;
      sama(akhir < tol, `posisi/teks akhir beda dgn desain ${lay.k} (berubah ${(akhir * 100).toFixed(1)}%)`);
    });
  }
  console.log("== B · Gerbang teks video (v3.7.1) tetap jalan bersama mode lapis ==");
  await uji("drawtext+bingkai video enable gte OFSET; subtitle ikut", async () => {
    const sub = path.join(dirTmp, "u.ass");
    writeFileSync(sub, "[Script Info]\nPlayResX:720\nPlayResY:1280\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Def,Arial,40,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,0,2,10,10,40,1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\nDialogue: 0,0:00:00.00,0:00:03.00,Def,,0,0,0,,Uji\n", "utf8");
    const bj = path.join(dirTmp, "bj.png");
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "lavfi", "-i", "color=c=black@0.0:size=720x1280,format=rgba", "-frames:v", "1", bj], { stdio: "pipe" });
    const { args } = bangunArgumenPart(
      dasarArg(src, {
        bg: path.join(dirTmp, "dasar-impact.png"),
        bgJudul: path.join(dirTmp, "judul-impact.png"),
        bgPartLapis: path.join(dirTmp, "part-impact.png"),
        fileSub: sub,
        fileBingkaiJudul: bj,
        pengaturan: { ...Ty.pengaturanDefault, coverTrans: "", introFade: false } as Ty.Pengaturan,
        judulTxt: "JUDUL VIDEO",
        partTxt: "Part 1",
        deskripsiTxt: "DESKRIPSI VIDEO",
        tag: "u372-gate",
      }),
    );
    const fc = args[args.indexOf("-filter_complex") + 1];
    const n = (fc.match(/enable='gte\(t,2\.000\)'/g) || []).length;
    sama(n >= 4, `enable gte hanya ${n}x (minimal 4: 3 drawtext + bingkai)`);
    const segSub = fc.split(";").find((x) => x.includes("subtitles=")) ?? "";
    sama(segSub.includes("enable='gte(t,2.000)'"), "subtitle tak digerbangi");
    // overlay bingkai video dgn enable
    sama(/overlay=0:0:enable='gte\(t,2\.000\)'/.test(fc) || /overlay=[^;]*:enable='gte\(t,2\.000\)'/.test(fc), "bingkai video tak digerbangi");
  });

  for (const t of antre) await t();
  console.log(`\nHASIL: ${lolos} lolos, ${gagal} gagal`);
  process.exit(gagal > 0 ? 1 : 0);
})();
