// Uji unit v2.9.0 — MESIN POTONG LANGSUNG (fastcut, transplantasi KINOSTRA)
//   1. gerbangFastcut: semua fitur VidSplit yang "membakar" wajib memblokir;
//      setelan bersih (mode asli tanpa efek) harus LOLOS.
//   2. potongLangsung: potong MP4 nyata jadi 3 part di level byte — hasil
//      wajib valid (ffprobe: durasi pas, h264+aac) & bisa didekode penuh
//      (ffmpeg -v error tanpa keluhan) — bukti moov baru + salinan byte benar.
//   3. Anti-gagal: rentang di luar durasi tidak melempar; sumber bukan-MP4
//      melempar FastCutTidakDidukung (penelepon jatuh ke ffmpeg).
// Jalankan: bun scripts/uji-fastcut.ts
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, statSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { FastCutTidakDidukung, gerbangFastcut, potongLangsung } from "../src/lib/vidsplit/fastcut";
import { pengaturanDefault, type Pengaturan } from "../src/lib/vidsplit/types";

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

const SRC = "/tmp/uji-fastcut-src.mp4";
const DUR = 30;
const dirTmp = mkdtempSync(path.join(os.tmpdir(), "uji-fastcut-"));

function ffprobe(args: string[]): string {
  return execFileSync("ffprobe", ["-v", "error", ...args], { encoding: "utf8" });
}

async function main() {
  if (!existsSync(SRC)) {
    console.error("Sumber uji tidak ada — jalankan pembuatan dulu");
    process.exit(1);
  }

  /* ================= 1. GERBANG ================= */
  console.log("\n[1] GERBANG POTONG LANGSUNG");
  const info = { lebar: 640, tinggi: 360, durasi: DUR, fps: 30, adaAudio: true };
  const bersih: Pengaturan = {
    ...pengaturanDefault,
    mode: "asli",
    judul: "",
    kataPart: "",
    deskripsi: "",
    introAktif: false,
    logoId: "",
    frameId: "",
    neonAktif: false,
    transisiPart: "",
    kecepatanVideo: 1,
    resolusiOutput: "auto",
    zoomPembicara: "mati",
    subtitleAktif: false,
    backsoundAktif: false,
    introSuaraFile: "",
    codec: "h264",
  };
  cek("setelan bersih (mode asli, tanpa efek) LOLOS", gerbangFastcut(bersih, info) === null);
  const kasus: [string, Partial<Pengaturan>, string][] = [
    ["mode blur", { mode: "blur" }, "MODE KONVERSI"],
    ["mode crop", { mode: "crop" }, "MODE KONVERSI"],
    ["mode warna", { mode: "warna" }, "MODE KONVERSI"],
    ["mode template", { mode: "template" }, "MODE KONVERSI"],
    ["judul ada", { judul: "Judul Video" }, "JUDUL DI VIDEO"],
    ["label part ada", { kataPart: "Part" }, "LABEL PART"],
    ["deskripsi ada", { deskripsi: "hai" }, "DESKRIPSI"],
    ["intro aktif", { introAktif: true }, "INTRO PEMBUKA"],
    ["logo terpasang", { logoId: "logo-x.png" }, "LOGO"],
    ["bingkai terpasang", { frameId: "hiburan-3-916" }, "BINGKAI"],
    ["neon aktif", { neonAktif: true }, "FRAME NEON"],
    ["transisi fade", { transisiPart: "fade" }, "TRANSISI PART"],
    ["kecepatan 1.5x", { kecepatanVideo: 1.5 }, "KECEPATAN VIDEO"],
    ["resolusi terkunci 1080p", { resolusiOutput: "1080p" }, "RESOLUSI TETAP"],
    ["zoom pembicara", { zoomPembicara: "geser" }, "ZOOM PEMBICARA"],
    ["subtitle aktif", { subtitleAktif: true }, "SUBTITEL"],
    ["backsound aktif", { backsoundAktif: true }, "BACKSOUND"],
    ["suara intro", { introSuaraFile: "a.mp3" }, "SUARA INTRO"],
    ["codec h265", { codec: "h265" }, "KODEK H265"],
  ];
  for (const [nm, parsial, alasan] of kasus) {
    const r = gerbangFastcut({ ...bersih, ...parsial }, info);
    cek(`${nm} → BLOK ${alasan}`, r === alasan, `dapat: ${r}`);
  }
  cek("kompres pintar targetMb → BLOK", gerbangFastcut(bersih, info, 50) === "KOMPRES PINTAR");
  cek(
    "dimensi ganjil → BLOK",
    gerbangFastcut(bersih, { ...info, lebar: 641 }) === "DIMENSI GANJIL",
  );

  /* ================= 2. POTONG NYATA ================= */
  console.log("\n[2] POTONG LANGSUNG 3 PART (byte-level)");
  const rentang = [
    { start: 0, end: 10 },
    { start: 10, end: 20 },
    { start: 20, end: 30 },
  ];
  const laporan: string[] = [];
  const hasil = await potongLangsung(SRC, rentang, (n) => path.join(dirTmp, `part-${String(n).padStart(2, "0")}.mp4`), {
    isAborted: () => false,
    prog: (partKe, p, sub) => {
      if (sub) laporan.push(`p${partKe} ${Math.round(p * 100)}% ${sub}`);
    },
  });
  cek("3 part selesai", hasil.length === 3, `dapat ${hasil.length}`);
  for (const h of hasil) {
    const ada = existsSync(h.path) && statSync(h.path).size > 51200;
    cek(`part ${h.n} ada & >50 KB (${Math.round(h.size / 1024)} KB)`, ada);
    const dur = parseFloat(
      ffprobe(["-show_entries", "format=duration", "-of", "csv=p=0", h.path]),
    );
    cek(`part ${h.n} durasi ≈ 10 dtk (${dur.toFixed(2)})`, Math.abs(dur - 10) < 1.5, `${dur}`);
    const kodek = ffprobe([
      "-show_entries",
      "stream=codec_name,codec_type",
      "-of",
      "csv=p=0",
      h.path,
    ]);
    cek(`part ${h.n} berisi h264+aac`, kodek.includes("h264") && kodek.includes("aac"), kodek.trim());
    /* didekode PENUH tanpa galat = moov baru + offset byte benar */
    const dec = execFileSync(
      "ffmpeg",
      ["-v", "error", "-i", h.path, "-f", "null", "-"],
      { encoding: "utf8" },
    );
    cek(`part ${h.n} didekode penuh tanpa galat`, dec.trim() === "", dec.trim().slice(0, 120));
    /* moov di depan (fastStart) — ffprobe trace menulis ke stderr */
    const tr = spawnSync("ffprobe", ["-v", "trace", "-i", h.path], {
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
    });
    const fd = (tr.stderr || "") + (tr.stdout || "");
    const posMoov = fd.indexOf("type:'moov'");
    const posMdat = fd.indexOf("type:'mdat'");
    cek(`part ${h.n} moov sebelum mdat (fastStart)`, posMoov > -1 && posMdat > -1 && posMoov < posMdat);
  }
  /* progres terlapor */
  cek("progres terlapor mencapai ~100%", laporan.some((s) => s.includes("100%")), laporan.slice(-1)[0] || "-");

  /* ================= 3. KETAHANAN ================= */
  console.log("\n[3] KETAHANAN (anti-gagal)");
  /* rentang melebihi durasi → clamp, tidak melempar */
  const h2 = await potongLangsung(SRC, [{ start: 28, end: 60 }], (n) => path.join(dirTmp, `ekor-${n}.mp4`), {
    isAborted: () => false,
  });
  cek("rentang lewat durasi di-clamp (1 part kecil)", h2.length === 1 && h2[0].dur > 0.5);
  /* sumber bukan MP4 → FastCutTidakDidukung (penelepon jatuh ke ffmpeg) */
  const palsu = path.join(dirTmp, "palsu.mp4");
  writeFileSync(palsu, "INI BUKAN MP4 — teks polos saja".repeat(100), "utf8");
  let tertangkap = false;
  try {
    await potongLangsung(palsu, [{ start: 0, end: 5 }], (n) => path.join(dirTmp, `x-${n}.mp4`), {
      isAborted: () => false,
    });
  } catch (e) {
    tertangkap = e instanceof FastCutTidakDidukung;
  }
  cek("sumber bukan-MP4 → FastCutTidakDidukung (fallback ffmpeg)", tertangkap);
  /* batal di tengah → galat DIBATALKAN, file setengah jadi dibuang */
  const panjang = await potongLangsung(SRC, [{ start: 0, end: 30 }], (n) => path.join(dirTmp, `batal-${n}.mp4`), {
    isAborted: () => true,
    chunkBytes: 65536,
  }).catch((e: Error) => e);
  cek("isAborted → galat DIBATALKAN", panjang instanceof Error && /DIBATALKAN/.test(panjang.message));
  cek("file setengah jadi dibuang (tidak ada sisa)", !existsSync(path.join(dirTmp, "batal-1.mp4")));

  /* ================= HASIL ================= */
  console.log(`\n═══ HASIL: ${lolos} LOLOS, ${gagalN} GAGAL ═══`);
  if (gagalN > 0) process.exit(1);
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
