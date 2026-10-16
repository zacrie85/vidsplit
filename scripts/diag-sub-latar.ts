// VidSplit v0.53.0 — DIAGNOSTIK NYATA TRANSKRIP LATAR (pipeline eksport ↔ subtitle).
// Membuktikan perbaikan laporan user: video 30 mnt dulu MENUNGGU transkrip penuh
// sebelum part pertama dirender (terasa "tidak mulai-mulai"). Kini:
//   (a) tungguCakupan(15) — zona part-1 — selesai JAUH sebelum transkrip penuh
//       (blok kickstart 30 dtk vs blok penuh 90 dtk);
//   (b) janji hasil penuh selalu selesai & cache tersimpan;
//   (c) ekspor ulang = cache kena → tungguCakupan instan;
//   (d) batal di tengah jalan → cache TIDAK diracuni hasil parsial/kosong.
//
// Jalankan (butuh model — bash scripts/unduh-model-ai.sh):
//   VIDSPLIT_AI_MODELS="$PWD/assets/ai-models" bun scripts/diag-sub-latar.ts
import { existsSync, mkdirSync, statSync } from "node:fs";
import path from "path";
import { execFileSync } from "node:child_process";
import {
  kunciCache,
  mulaiTranskripLatar,
  modelTersedia,
} from "../src/lib/vidsplit/subtitle.ts";

let lulus = 0;
let gagal = 0;
function cek(nama: string, ok: boolean, detail?: unknown) {
  if (ok) {
    lulus += 1;
    console.log(`  ✓ ${nama}`);
  } else {
    gagal += 1;
    console.error(`  ✗ GAGAL: ${nama}`, detail ?? "");
  }
}

cek("modelTersedia() = true", modelTersedia() === true);

const ffmpegBin = process.env.VIDSPLIT_FFMPEG || "ffmpeg";
const DIR = "work/uji-sub-latar";
mkdirSync(DIR, { recursive: true });
// audio uji 200 dtk (3 blok dgn kickstart 30 dtk): nada + derau pink — RMS di atas
// ambang sunyi, jadi semua blok dianalisis sungguhan
const SUMBER = path.join(DIR, "audio-200s.wav");
if (!existsSync(SUMBER)) {
  execFileSync(ffmpegBin, [
    "-nostdin", "-v", "error", "-y",
    "-f", "lavfi", "-i", "sine=frequency=210:duration=200",
    "-f", "lavfi", "-i", "anoisesrc=d=200:c=pink:a=0.06",
    "-filter_complex", "[0:a][1:a]amix=inputs=2:duration=first,aformat=sample_rates=44100:channel_layouts=mono",
    SUMBER,
  ]);
}
const dtkSumber = 200;
const stat = statSync(SUMBER);
cek("audio uji 200 dtk tersedia", stat.size > 1000, stat.size);

// ---------- (a)+(b) alur latar: zona part-1 siap JAUH lebih awal ----------
console.log("  … transkrip latar 200 dtk audio (kickstart 30 dtk, ±1–2 mnt) …");
const t0 = Date.now();
const latar = await mulaiTranskripLatar(SUMBER, 0, 0, dtkSumber, ffmpegBin, {
  modelCepat: true,
  modeBahasa: "fokus",
  onTahap: (t) => console.log(`    [tahap +${((Date.now() - t0) / 1000).toFixed(1)}s] ${t}`),
});
cek("mulaiTranskripLatar segera kembali (tidak menunggu AI)", latar !== null && Date.now() - t0 < 5000, Date.now() - t0);
if (latar) {
  const zona15Janji = latar.tungguCakupan(15).then(() => Date.now());
  const janjiWaktu = latar.janji.then((h) => ({ waktu: Date.now(), h }));
  const tZona15 = await zona15Janji;
  const { waktu: tJanji, h: hasil } = await janjiWaktu;
  const dtkZona = (tZona15 - t0) / 1000;
  const dtkPenuh = (tJanji - t0) / 1000;
  console.log(`  [waktu] zona part-1 (15 dtk) siap ${dtkZona.toFixed(1)}s · transkrip penuh ${dtkPenuh.toFixed(1)}s`);
  cek("zona part-1 siap SEBELUM transkrip penuh (part bisa langsung dirender)", dtkZona < dtkPenuh, { dtkZona, dtkPenuh });
  cek("hasil penuh TIDAK null", hasil !== null);
  cek("segmen berupa array", Array.isArray(hasil?.segmen));
  // cache tersimpan dgn kunci bawaan (fokus + model efektif)
  const kunci = kunciCache(SUMBER, stat.size, stat.mtimeMs, 0, 0, "fokus", true);
  cek("cache tersimpan setelah janji", existsSync(path.join("work", "subtitle-ai", `${kunci}.json`)));

  // ---------- (c) ekspor ulang: cache kena → cakupan INSTAN ----------
  const t1 = Date.now();
  const latar2 = await mulaiTranskripLatar(SUMBER, 0, 0, dtkSumber, ffmpegBin, { modelCepat: true });
  const segCache = latar2 ? await latar2.tungguCakupan(100) : null;
  const msCache = Date.now() - t1;
  console.log(`  [waktu] cache kena → tungguCakupan(100) ${msCache} ms`);
  cek("cache hit: instan (<500 ms)", msCache < 500, msCache);
  cek("cache hit: segmen sama dgn hasil penuh", !!segCache && segCache.length === (hasil?.segmen.length ?? -1));

  // ---------- (d) batal di tengah jalan → cache TIDAK diracuni ----------
  // trim beda (mulai 1 dtk) = kunci berbeda; apakahBerhenti selalu true = simulasi batal
  const kunciBatal = kunciCache(SUMBER, stat.size, stat.mtimeMs, 1, 0, "fokus", true);
  const latar3 = await mulaiTranskripLatar(SUMBER, 1, 0, dtkSumber, ffmpegBin, {
    modelCepat: true,
    apakahBerhenti: () => true,
  });
  cek("mode batal: latar tetap kembali", latar3 !== null);
  if (latar3) {
    const segBatal = await latar3.tungguCakupan(150);
    const hasilBatal = await latar3.janji;
    cek("mode batal: tungguCakupan tidak menggantung", Array.isArray(segBatal));
    cek("mode batal: janji selesai tanpa menggantung", hasilBatal !== undefined);
    cek("mode batal: cache TIDAK ditulis (tidak meracuni)", !existsSync(path.join("work", "subtitle-ai", `${kunciBatal}.json`)));
  }
}

console.log(`\n=== diag-sub-latar: ${lulus} LULUS, ${gagal} GAGAL ===`);
if (gagal > 0) process.exit(1);
