/**
 * UJI v3.9.0 — MESIN EKSPOR & SPLIT ALA KINOSTRA (laporan user: Kinostra 10
 * menit vs VidSplit 70 menit untuk video yang sama).
 * 1. LATAR BLUR SEPARUH-EMPAT RESOLUSI: boxblur=24:2 di 1080×1920 (32% waktu
 *    part) → 1/4 resolusi radius 6 + naik skala fast_bilinear — di SEMUA
 *    cabang (mode blur, zoomBlur>100, mode crop dengan zoom<100%).
 * 2. DEKODE GPU (NVDEC/QSV) ala KINOSTRA: pilihHwaccel probe DEKODE NYATA
 *    1 frame — GPU tak ada/gagal → [] (CPU); cocok → ["-hwaccel", mode].
 * 3. bangunArgumenPart menancapkan -hwaccel SEBELUM -i sumber (per-input).
 * 4. RENDER E2E nyata dgn argumen part baru (mode blur bawaan) → keluaran
 *    valid, durasi benar, codec h264.
 */
import { bangunArgumenPart, pilihHwaccel, rantaiUtama } from "../src/lib/vidsplit/ffmpeg";
import { pengaturanDefault } from "../src/lib/vidsplit/types";
import { mkdtempSync, writeFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

let lolos = 0, gagal = 0;
function cek(nama: string, syarat: boolean, konteks?: unknown) {
  if (syarat) { lolos++; console.log(`  LOLOS  ${nama} ✓`); }
  else { gagal++; console.error(`  GAGAL  ${nama}${konteks !== undefined ? " :: " + JSON.stringify(konteks).slice(0, 300) : ""}`); }
}

const dirTmp = mkdtempSync(path.join(tmpdir(), "uji-v390-"));
const SRC = "/tmp/bench/src.mp4";
const adaSrc = (() => { try { return statSync(SRC).size > 0; } catch { return false; } })();

async function main() {
console.log("— 1. rantaiUtama: blur separuh-empat resolusi —");
const fBlur = rantaiUtama("blur", 1080, 1920, "#000", 30, 45, 50, 100, 100, 0, 0);
cek("tidak ada boxblur=24:2 resolusi penuh", !/boxblur=24:2/.test(fBlur), fBlur);
cek("blur di 1/4 resolusi (270x480)", /scale=270:480:force_original_aspect_ratio=increase,crop=270:480/.test(fBlur), fBlur);
cek("radius setara 24/4 = 6", /boxblur=6:2/.test(fBlur), fBlur);
cek("naik skala fast_bilinear ke 1080x1920", /scale=1080:1920:flags=fast_bilinear\[blurf\]/.test(fBlur), fBlur);
cek("isi tetap contain + overlay tengah", /scale=1080:1920:force_original_aspect_ratio=decrease\[isif\]/.test(fBlur), fBlur);
cek("eq tetap (brightness/saturation)", /eq=brightness=-0.04:saturation=1\.15/.test(fBlur), fBlur);

const fZoom = rantaiUtama("blur", 1080, 1920, "#000", 30, 45, 50, 100, 150, 0, 0);
cek("zoomBlur>100: blur juga 1/4 resolusi", /boxblur=6:2/.test(fZoom) && !/boxblur=24:2/.test(fZoom), fZoom);

const fCrop = rantaiUtama("crop", 1080, 1920, "#000", 30, 45, 30, 80, 100, 0, 0);
cek("mode crop zoom<100: latar blur 1/4 resolusi", /boxblur=6:2/.test(fCrop) && !/boxblur=24:2/.test(fCrop), fCrop);

const fAsli = rantaiUtama("asli", 1920, 1080, "#000", 30, 45, 50, 100, 100, 0, 0);
cek("mode asli tak tersentuh blur", !/boxblur/.test(fAsli), fAsli);

console.log("— 2. pilihHwaccel: probe dekode nyata (sandbox tanpa GPU) —");
const bin = process.env.VIDSPLIT_FFMPEG || "ffmpeg";
const hwCpu = await pilihHwaccel("CPU (libx264)", bin, adaSrc ? SRC : bin);
cek("encoder CPU → [] tanpa spawn", hwCpu.length === 0, hwCpu);
const hwGagal = await pilihHwaccel("NVIDIA NVENC H.264 (GPU)", bin, adaSrc ? SRC : bin);
cek("nvenc di mesin tanpa GPU → probe gagal → [] (fallback CPU)", Array.isArray(hwGagal) && hwGagal.length === 0, hwGagal);
const hwCache = await pilihHwaccel("NVIDIA NVENC H.264 (GPU)", bin, adaSrc ? SRC : bin);
cek("cache konsisten (dua panggilan sama)", JSON.stringify(hwCache) === JSON.stringify(hwGagal));

console.log("— 3. bangunArgumenPart menancapkan -hwaccel sebelum -i sumber —");
const dasar = {
  src: adaSrc ? SRC : bin,
  pengaturan: { ...pengaturanDefault, mode: "blur" as const, judul: "", pakaiGpu: true, modeEkspor: "cepat" as const },
  n: 1, mulai: 0, durasi: 2, W: 1080, H: 1920, fps: 30, adaAudio: false,
  judulTxt: "", partTxt: "", deskripsiTxt: "",
  dirTmp, tag: "uji390",
  codecArgs: ["-c:v", "libx264", "-preset", "veryfast", "-crf", "22"],
  hwaccel: ["-hwaccel", "cuda"],
  keluar: path.join(dirTmp, "part.mp4"),
};
const { args } = bangunArgumenPart(dasar as Parameters<typeof bangunArgumenPart>[0]);
const iHw = args.indexOf("-hwaccel");
const iSrc = args.indexOf("-i");
cek("-hwaccel hadir", iHw >= 0, args.slice(0, 8));
cek("-hwaccel SEBELUM -i sumber (per-input option)", iHw >= 0 && iHw < iSrc, { iHw, iSrc });
cek("pasangan mode utuh (cuda)", args[iHw + 1] === "cuda");
const tanpaHw = bangunArgumenPart({ ...dasar, hwaccel: [] }).args;
cek("tanpa hwaccel → tak ada -hwaccel (jalur CPU/retry)", !tanpaHw.includes("-hwaccel"));
const sisatHw = args.filter((_, i) => i !== iHw && i !== iHw + 1);
cek("dgn vs tanpa hwaccel → argumen lain identik persis",
  JSON.stringify(sisatHw) === JSON.stringify(tanpaHw));

console.log("— 4. render E2E nyata dgn argumen part baru —");
if (adaSrc) {
  // E2E memakai HASIL PROBE ([] di mesin tanpa GPU = jalur CPU; dgn GPU =
  // ["-hwaccel","cuda"]) — persis perilaku jobs.ts, bukan paksaan.
  const hwE2e = await pilihHwaccel("NVIDIA NVENC H.264 (GPU)", bin, SRC);
  const argumenE2e = bangunArgumenPart({ ...dasar, hwaccel: hwE2e }).args;
  writeFileSync(path.join(dirTmp, "uji390-judul.txt"), "", "utf8");
  writeFileSync(path.join(dirTmp, "uji390-part.txt"), "", "utf8");
  writeFileSync(path.join(dirTmp, "uji390-deskripsi.txt"), "", "utf8");
  const r = spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", ...argumenE2e], { timeout: 120_000, encoding: "utf8" });
  cek("ffmpeg selesai kode 0", r.status === 0, (r.stderr || "").slice(-400));
  cek("E2E konsisten dgn probe (sandbox tanpa GPU → tanpa -hwaccel)", hwE2e.length === 0 && !argumenE2e.includes("-hwaccel"));
  let dur = 0, codec = "";
  if (r.status === 0) {
    const pr = spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-show_entries", "stream=codec_name", "-of", "json", path.join(dirTmp, "part.mp4")], { encoding: "utf8" });
    const j = JSON.parse(pr.stdout || "{}");
    dur = Number(j.format?.duration || 0);
    codec = j.streams?.[0]?.codec_name || "";
  }
  cek("durasi hasil ≈ 2 dtk", Math.abs(dur - 2) < 0.35, dur);
  cek("codec h264", codec === "h264", codec);
} else {
  console.log("  (sumber /tmp/bench/src.mp4 tidak ada — render E2E dilewati)");
}

console.log(`\nHASIL: ${lolos} lolos, ${gagal} gagal`);
process.exit(gagal ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
