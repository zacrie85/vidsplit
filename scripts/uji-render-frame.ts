// Uji render NYATA v0.46.0 — frame hiasan + neon + template dgn ffmpeg asli.
// Jalankan: bun scripts/uji-render-frame.ts
import { mkdirSync, writeFileSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import { bangunArgumenPart, dirWork, jalankanFfmpeg, pilihFfmpeg } from "../src/lib/vidsplit/ffmpeg";
import { siapkanSequenceNeon } from "../src/lib/vidsplit/neonRender";
import { siapkanLatarTemplate } from "../src/lib/vidsplit/templatRender";
import { pengaturanDefault, neonDari, type Pengaturan } from "../src/lib/vidsplit/types";

const tmp = dirWork("uji-frame");
const sumber = path.join(tmp, "sumber.mp4");

let lolos = 0, gagal = 0;
function ok(k: boolean, nama: string, d = "") {
  if (k) { lolos++; console.log(`  ✓ ${nama}`); }
  else { gagal++; console.error(`  ✗ ${nama}${d ? ` — ${d}` : ""}`); }
}

async function utama() {
  // 1) video sumber 4 dtk 9:16 — kartun warna + audio senyap
  const ff = await pilihFfmpeg();
  if (!existsSync(sumber)) {
    await jalankanFfmpeg([
      "-y", "-hide_banner", "-v", "error",
      "-f", "lavfi", "-i", "testsrc2=size=720x1280:rate=30:duration=4",
      "-f", "lavfi", "-i", "sine=frequency=440:duration=4",
      "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest",
      sumber,
    ], 5, undefined, ff.bin);
  }
  ok(existsSync(sumber), "video sumber siap");

  mkdirSync(tmp, { recursive: true });
  const dirTmp = tmp;

  async function render(nama: string, p: Pengaturan, ekstra: Partial<Parameters<typeof bangunArgumenPart>[0]>) {
    const keluar = path.join(tmp, `${nama}.mp4`);
    const { args, total } = bangunArgumenPart({
      src: sumber, bg: null, logo: null, pengaturan: p,
      n: 1, mulai: 0, durasi: 4, W: 1080, H: 1920, fps: 30, adaAudio: true,
      judulTxt: p.judul, partTxt: "Part 1", deskripsiTxt: p.deskripsi,
      dirTmp, tag: `uji-${nama}`, codecArgs: ["-c:v", "libx264", "-preset", "veryfast", "-crf", "26"],
      keluar,
      ...ekstra,
    });
    const t0 = Date.now();
    await jalankanFfmpeg(args, total, undefined, ff.bin);
    const detik = ((Date.now() - t0) / 1000).toFixed(1);
    const ada = existsSync(keluar) && statSync(keluar).size > 50_000;
    ok(ada, `render ${nama} (${detik} dtk)`, `${statSync(keluar)?.size}`);
    return keluar;
  }

  // 2) A — blur + frame arkara + neon rainbow dua garis
  const neonA = neonDari({ neonAktif: true, neonWarna: "rainbow", neonTebal: 8, neonKecepatan: 1.5, neonDuaGaris: true });
  const seqA = await siapkanSequenceNeon(1080, 1920, neonA);
  console.log(`  sequence A: ${seqA.jumlah} frame @${seqA.fps}fps`);
  const pA: Pengaturan = {
    ...pengaturanDefault,
    judul: "Kopi Pagi",
    frameId: "bawaan:arkara-muda",
    neonAktif: true, neonWarna: "rainbow", neonTebal: 8, neonKecepatan: 1.5, neonDuaGaris: true,
  };
  const outA = await render("a-frame-neon", pA, {
    frameAbs: path.join(process.cwd(), "public", "bingkai", "arkara-muda.png"),
    neon: { ...seqA, x: 0, y: 0, w: 1080, h: 1920 },
  });

  // 3) B — template halaman + neon cyan mengelilingi kotak video
  const templatBg = await siapkanLatarTemplate(1080, 1920, { grad1: "#f59e0b", grad2: "#ec4899" });
  const kotak = { x: Math.round((4 / 100) * 1080), y: Math.round((15.5 / 100) * 1920), w: Math.round((92 / 100) * 1080), h: Math.round((55 / 100) * 1920) };
  const neonB = neonDari({ neonAktif: true, neonWarna: "cyan", neonTebal: 6, neonKecepatan: 1, neonDuaGaris: false });
  const seqB = await siapkanSequenceNeon(kotak.w, kotak.h, neonB);
  const pB: Pengaturan = {
    ...pengaturanDefault,
    mode: "template",
    judul: "Live Report Arkara",
    deskripsi: "Laporan langsung dari lokasi kejadian hari ini",
    neonAktif: true, neonWarna: "cyan", neonTebal: 6, neonKecepatan: 1, neonDuaGaris: false,
  };
  const outB = await render("b-template", pB, {
    templatBg,
    neon: { ...seqB, x: kotak.x, y: kotak.y, w: kotak.w, h: kotak.h },
  });

  // 4) C — mode asli 16:9 + frame pemilu + neon magenta
  const sumber169 = path.join(tmp, "sumber-16x9.mp4");
  if (!existsSync(sumber169)) {
    await jalankanFfmpeg([
      "-y", "-hide_banner", "-v", "error",
      "-f", "lavfi", "-i", "testsrc2=size=1280x720:rate=30:duration=4",
      "-c:v", "libx264", "-pix_fmt", "yuv420p", sumber169,
    ], 5, undefined, ff.bin);
  }
  const neonC = neonDari({ neonAktif: true, neonWarna: "magenta", neonTebal: 10, neonKecepatan: 2, neonDuaGaris: false });
  const seqC = await siapkanSequenceNeon(1280, 720, neonC);
  const pC: Pengaturan = {
    ...pengaturanDefault,
    mode: "asli",
    frameId: "bawaan:pemilu-raya",
    neonAktif: true, neonWarna: "magenta", neonTebal: 10, neonKecepatan: 2, neonDuaGaris: false,
  };
  const keluarC = path.join(tmp, "c-asli.mp4");
  const argsC = bangunArgumenPart({
    src: sumber169, bg: null, logo: null, pengaturan: pC,
    n: 1, mulai: 0, durasi: 4, W: 1280, H: 720, fps: 30, adaAudio: false,
    judulTxt: "Pemilu Raya", partTxt: "Part 1", deskripsiTxt: "",
    dirTmp, tag: "uji-c", codecArgs: ["-c:v", "libx264", "-preset", "veryfast", "-crf", "26"],
    keluar: keluarC,
    frameAbs: path.join(process.cwd(), "public", "bingkai", "pemilu-raya.png"),
    neon: { ...seqC, x: 0, y: 0, w: 1280, h: 720 },
  });
  await jalankanFfmpeg(argsC.args, argsC.total, undefined, ff.bin);
  ok(existsSync(keluarC) && statSync(keluarC).size > 50_000, "render c-asli (16:9)");

  // 5) ekstrak frame PNG utk dilihat
  const sharp = (await import("sharp")).default;
  const keping: Array<[string, string, number]> = [
    ["a-frame-neon", outA, 1.2],
    ["b-template", outB, 1.2],
    ["c-asli", keluarC, 1.2],
    ["a-neon-akhir", outA, 3.6],
  ];
  for (const [nama, file, det] of keping) {
    const png = path.join(tmp, `${nama}.png`);
    await jalankanFfmpeg(["-y", "-hide_banner", "-v", "error", "-ss", String(det), "-i", file, "-frames:v", "1", png], 5, undefined, ff.bin);
    await sharp(png).resize(360, 640, { fit: "inside" }).png().toFile(path.join(tmp, `${nama}-kecil.png`));
  }
  console.log(`\n=== uji-render-frame: ${lolos} LOLOS, ${gagal} GAGAL ===`);
  console.log("keping di", tmp);
  if (gagal) process.exit(1);
}

utama().catch((e) => { console.error("FATAL:", e); process.exit(1); });
