// Uji kompatibilitas ffmpeg — v0.19.0
// Masalah v0.17.0: graf visual lolos uji sandbox (ffmpeg 7.1.x) tapi GAGAL di PC user
// karena installer membundel ffmpeg-static 7.0.x yang tidak punya opsi `rate` di
// showspectrum (`Error applying option 'rate' to filter 'showspectrum': Option not found`).
// Solusi: skrip ini merender SEMUA gaya visual + bentuk graf ekspor penuh + graf
// VOKALGEN-3 (genre vokal) + PISAH VOKAL & MUSIK memakai binary node_modules/ffmpeg-static
// (7.0.x — kembaran versi bundel Windows), plus ffmpeg sistem bila ada, sehingga
// ketidakcocokan versi tertangkap SEBELUM rilis.
// Jalankan: bun scripts/uji-kompat-ffmpeg.ts
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { bangunFilterAudio, bangunFilterAudioAi, bangunFilterAudioGantiAi, bangunRantaiVisual, grafPisahVokalMusik, VISUAL_MUSIK, opsiVisualDefault } from "../src/lib/vidsplit/musik";

const DUR = 2;
const W = 320, H = 568; // 9:16 kecil — cepat, tetap mewakili resolusi vertikal bawaan
const FPS = 30;

const kandidat = [
  "node_modules/ffmpeg-static/ffmpeg", // static 7.0.x — kembaran versi bundel installer Windows
  "/usr/bin/ffmpeg",                   // sandbox/CI — versi lebih baru
].filter((p) => existsSync(p));

if (kandidat.length === 0) {
  console.error("Tidak ada binary ffmpeg untuk diuji");
  process.exit(1);
}

let lulus = 0;
let gagal = 0;
const daftarGagal: string[] = [];

function versiDari(bin: string): string {
  const r = spawnSync(bin, ["-version"], { encoding: "utf8" });
  return (r.stdout || "?").split("\n")[0] || "?";
}

function uji(bin: string, label: string) {
  console.log(`\n== ${label}: ${versiDari(bin).slice(0, 60)} ==`);
  // ==== v0.19 — graf AUDIO kritis: VOKALGEN-3 (3 genre) + PISAH VOKAL & MUSIK ====
  const dasarVok = {
    file: "uji", judul: "uji", genre: "asli" as const, layerLevel: 0,
    karaoke: "asli" as const, bpm: 120, fase: 0, mode: "remake" as const,
  };
  const grafAudio: { nama: string; graf: string; nInput?: number }[] = [
    { nama: "vokalgen-3 dangdut 100", graf: bangunFilterAudio({ ...dasarVok, genreVokal: "dangdut", refVokal: "dangdut-w1", tingkatVokal: 100 }).graf },
    { nama: "vokalgen-3 rock 80", graf: bangunFilterAudio({ ...dasarVok, genreVokal: "rock", refVokal: "rock-p1", tingkatVokal: 80 }).graf },
    { nama: "vokalgen-3 hiphop 55", graf: bangunFilterAudio({ ...dasarVok, genreVokal: "hiphop", refVokal: "hiphop-p1", tingkatVokal: 55 }).graf },
    { nama: "vokal saja + genre vokal", graf: bangunFilterAudio({ ...dasarVok, karaoke: "vokal", genreVokal: "dangdut", refVokal: "dangdut-p1", tingkatVokal: 90 }).graf },
    { nama: "pisah vokal & musik", graf: grafPisahVokalMusik() },
  ];
  // ==== v0.20 — graf VOKALGEN-4 (stem AI): input 0 = vokal stem, 1 = musik stem,
  // 2 = harmoni, 3 = lapisan — bentuk persis dgn prosesAudio jalur AI ====
  const dasarAi = {
    file: "uji", judul: "uji", genre: "asli" as const, layerLevel: 0,
    karaoke: "asli" as const, bpm: 120, fase: 0, mode: "remake" as const,
    genreVokal: "dangdut" as const, refVokal: "dangdut-p1", tingkatVokal: 55, mesinVokal: "ai" as const,
  };
  grafAudio.push(
    { nama: "vokalgen-4 AI dangdut 55", graf: bangunFilterAudioAi(dasarAi).graf, nInput: 2 },
    { nama: "vokalgen-4 AI karaoke", graf: bangunFilterAudioAi({ ...dasarAi, karaoke: "karaoke" }).graf, nInput: 2 },
    { nama: "vokalgen-4 AI vokal-saja", graf: bangunFilterAudioAi({ ...dasarAi, karaoke: "vokal", tingkatVokal: 90 }).graf, nInput: 2 },
    { nama: "vokalgen-4 AI transpos +3", graf: bangunFilterAudioAi({ ...dasarAi, transpose: 3 }).graf, nInput: 2 },
    { nama: "vokalgen-5 AI register penuh 100", graf: bangunFilterAudioAi({ ...dasarAi, tingkatVokal: 100 }).graf, nInput: 2 },
    { nama: "vokalgen-4 AI harmoni+lapisan", graf: bangunFilterAudioAi({ ...dasarAi, genre: "rock", layerLevel: 40, nadaLevel: 50 }).graf, nInput: 4 },
    // ==== v0.22 — GANTI INSTRUMEN (mode ganti): vokal stem + aransemen WAV ====
    { nama: "ganti AI rock (penyanyi+aransemen)", graf: bangunFilterAudioGantiAi({ ...dasarAi, mode: "ganti", genre: "rock", vokalLevel: 100, grooveLevel: 75, variasi: 0 }, 2).graf, nInput: 3 },
    { nama: "ganti AI karaoke (aransemen murni)", graf: bangunFilterAudioGantiAi({ ...dasarAi, mode: "ganti", genre: "edm", karaoke: "karaoke", grooveLevel: 75 }, 2).graf, nInput: 3 },
    { nama: "ganti AI vokal-saja", graf: bangunFilterAudioGantiAi({ ...dasarAi, mode: "ganti", karaoke: "vokal" }, 2).graf, nInput: 3 },
    { nama: "ganti AI tempo 1.5x", graf: bangunFilterAudioGantiAi({ ...dasarAi, mode: "ganti", genre: "dangdut", kecepatan: 1.5 }, 2).graf, nInput: 3 },
    { nama: "ganti DSP fallback (aransemen input 1)", graf: bangunFilterAudio({ ...dasarAi, mode: "ganti", genre: "rock", vokalLevel: 100, grooveLevel: 75 }, 44100).graf, nInput: 2 },
  );
  for (const { nama, graf, nInput } of grafAudio) {
    const pisah = nama.startsWith("pisah");
    const n = nInput ?? 1;
    const masukan = Array.from({ length: n }, () => ["-f", "lavfi", "-i", `anoisesrc=d=${DUR}:c=pink:r=48000`]).flat();
    const r = spawnSync(bin, [
      "-hide_banner", "-v", "error",
      ...masukan,
      "-filter_complex", graf,
      // pisah punya DUA keluaran ([mout] + [vout]); graf lain satu [aout]
      ...(pisah ? ["-map", "[mout]", "-map", "[vout]"] : ["-map", "[aout]"]),
      "-t", String(DUR),
      "-f", "null", "-",
    ], { encoding: "utf8", timeout: 180_000 });
    const ok = r.status === 0 && !(r.stderr || "").includes("Option not found");
    if (ok) {
      lulus++;
      console.log(`  LULUS  ${nama}`);
    } else {
      gagal++;
      daftarGagal.push(`${label} :: ${nama}`);
      const s = (r.stderr || r.stdout || "tanpa stderr").trim().split("\n").slice(0, 3).join("\n    ");
      console.log(`  GAGAL  ${nama}\n    ${s}`);
    }
  }
  VISUAL_MUSIK.forEach((v, idx) => {
    const o = {
      ...opsiVisualDefault,
      // selang-seling agar jalur `gradients` (gradien) & `color` (gelap/hitam) keduanya teruji
      bgMode: (idx % 2 === 0 ? "gradien" : "hitam") as typeof opsiVisualDefault.bgMode,
    };
    const grafViz = bangunRantaiVisual(v.id, { w: W, h: H, fps: FPS, durasi: DUR, o }).replace("[av]", "[av2]");
    // bentuk graf identik dgn renderVid (musikJobs.ts): split audio utk MP3 + video visualizer
    const graf = [
      "[0:a]aformat=channel_layouts=stereo[asrc]",
      "[asrc]asplit=2[ae][av]",
      "[av]volume=0.0dB[av2]",
      grafViz,
      "[viz]format=yuv420p[vfin]",
    ].join(";");
    const r = spawnSync(bin, [
      "-hide_banner", "-v", "error",
      "-f", "lavfi", "-i", `anoisesrc=d=${DUR}:c=pink:r=48000`,
      "-filter_complex", graf,
      "-map", "[vfin]", "-map", "[ae]",
      "-t", String(DUR),
      "-f", "null", "-",
    ], { encoding: "utf8", timeout: 180_000 });
    const ok = r.status === 0 && !(r.stderr || "").includes("Option not found");
    if (ok) {
      lulus++;
      console.log(`  LULUS  ${v.id}`);
    } else {
      gagal++;
      daftarGagal.push(`${label} :: ${v.id}`);
      const s = (r.stderr || r.stdout || "tanpa stderr").trim().split("\n").slice(0, 3).join("\n    ");
      console.log(`  GAGAL  ${v.id}\n    ${s}`);
    }
  });
}

for (const [i, bin] of kandidat.entries()) {
  uji(bin, i === 0 ? "BUNDEL (ffmpeg-static, versi dgn installer Windows)" : `SISTEM #${i}`);
}

console.log(`\n===== HASIL: ${lulus} lulus, ${gagal} gagal =====`);
if (gagal > 0) {
  console.log("Gaya gagal: " + daftarGagal.join(", "));
  process.exit(1);
}
