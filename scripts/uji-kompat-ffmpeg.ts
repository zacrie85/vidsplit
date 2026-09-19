// Uji kompatibilitas ffmpeg — v0.19.0
// Masalah v0.17.0: graf visual lolos uji sandbox (ffmpeg 7.1.x) tapi GAGAL di PC user
// karena installer membundel ffmpeg-static 7.0.x yang tidak punya opsi `rate` di
// showspectrum (`Error applying option 'rate' to filter 'showspectrum': Option not found`).
// Solusi: skrip ini merender SEMUA gaya visual + bentuk graf ekspor penuh + graf
// VOKALGEN-3 (genre vokal) + PISAH VOKAL & MUSIK memakai binary node_modules/ffmpeg-static
// (7.0.x — kembaran versi bundel Windows), plus ffmpeg sistem bila ada, sehingga
// ketidakcocokan versi tertangkap SEBELUM rilis.
// Jalankan: bun scripts/uji-kompat-ffmpeg.ts
import { existsSync, mkdtempSync, writeFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { bangunFilterAudio, bangunFilterAudioAi, bangunFilterAudioAiGen, bangunFilterAudioGantiAi, bangunRantaiVisual, grafPisahVokalMusik, rantaiGenderMusik, rantaiGenderVokal, VISUAL_MUSIK, opsiVisualDefault } from "../src/lib/vidsplit/musik";
import { buatArgumenLatar, buatArgumenChunk, buatArgumenSegmenKomik, buatArgumenCampurMusik, buatArgumenConcat, isiListConcat, TEMA_HOROR } from "../src/lib/vidsplit/hororRender";
import { renderIlustrasiPng, renderTeksPanelPng } from "../src/lib/vidsplit/teksLayar";

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
    // v0.23 — register wanita sejati (+4,5 st → asetrate rasio tinggi) + feminisasi timbre
    { nama: "vokalgen-5 AI wanita register 100", graf: bangunFilterAudioAi({ ...dasarAi, refVokal: "dangdut-w1", tingkatVokal: 100 }).graf, nInput: 2 },
    { nama: "vokalgen-4 AI harmoni+lapisan", graf: bangunFilterAudioAi({ ...dasarAi, genre: "rock", layerLevel: 40, nadaLevel: 50 }).graf, nInput: 4 },
    // ==== v0.22 — GANTI INSTRUMEN (mode ganti): vokal stem + aransemen WAV ====
    { nama: "ganti AI rock (penyanyi+aransemen)", graf: bangunFilterAudioGantiAi({ ...dasarAi, mode: "ganti", genre: "rock", vokalLevel: 100, grooveLevel: 75, variasi: 0 }, 2).graf, nInput: 3 },
    { nama: "ganti AI karaoke (aransemen murni)", graf: bangunFilterAudioGantiAi({ ...dasarAi, mode: "ganti", genre: "edm", karaoke: "karaoke", grooveLevel: 75 }, 2).graf, nInput: 3 },
    { nama: "ganti AI vokal-saja", graf: bangunFilterAudioGantiAi({ ...dasarAi, mode: "ganti", karaoke: "vokal" }, 2).graf, nInput: 3 },
    { nama: "ganti AI tempo 1.5x", graf: bangunFilterAudioGantiAi({ ...dasarAi, mode: "ganti", genre: "dangdut", kecepatan: 1.5 }, 2).graf, nInput: 3 },
    { nama: "ganti DSP fallback (aransemen input 1)", graf: bangunFilterAudio({ ...dasarAi, mode: "ganti", genre: "rock", vokalLevel: 100, grooveLevel: 75 }, 44100).graf, nInput: 2 },
    // ==== v0.24 — VOKALGEN-6 AI GENDER REALISTIS: rantai rubberband (jalan sebagai
    // -af pada berkas stem terpisah) + graf campuran AiGen (tanpa asetrate di stem) ====
    { nama: "vokalgen-6 rantai vokal gender (3 tahap rubberband)", graf: `[0:a]${rantaiGenderVokal(6, 1.1095, 0)}[aout]` },
    { nama: "vokalgen-6 rantai musik gender (1 tahap)", graf: `[0:a]${rantaiGenderMusik(6, 0)}[aout]` },
    { nama: "vokalgen-6 rantai vokal pria dada", graf: `[0:a]${rantaiGenderVokal(-8, 0.9635, 0)}[aout]` },
    { nama: "vokalgen-6 graf AiGen wanita", graf: bangunFilterAudioAiGen({ ...dasarAi, refVokal: "dangdut-w1", mesinVokal: "aigen" }, { st: 6, formant: 1.1095 }, 6).graf, nInput: 2 },
    { nama: "vokalgen-6 graf AiGen karaoke", graf: bangunFilterAudioAiGen({ ...dasarAi, refVokal: "dangdut-w1", mesinVokal: "aigen", karaoke: "karaoke" }, { st: 6, formant: 1.1095 }, 6).graf, nInput: 2 },
    { nama: "vokalgen-6 graf AiGen nada ikut register", graf: bangunFilterAudioAiGen({ ...dasarAi, genre: "rock", nadaLevel: 40, mesinVokal: "aigen" }, { st: 6, formant: 1.1095 }, 6).graf, nInput: 3 },
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

  // ==== v0.25 — STUDIO HOROR: latar gradients + graf chunk (grain+vignette+kilat+
  // overlay halaman fade+audio narasi/musik loop amix). Induks input di sini lavfi
  // (setara: 0 dasar, 1 latar, 2-3 halaman, 4 narasi, 5 musik) — GRAF identik dgn produksi.
  const tmp = mkdtempSync(path.join(tmpdir(), "uji-horor-"));
  const pngLatar = path.join(tmp, "latar.png");
  const rLatar = spawnSync(bin, ["-hide_banner", "-v", "error", ...buatArgumenLatar(TEMA_HOROR[0], W, H, pngLatar)], { encoding: "utf8", timeout: 60_000 });
  const okLatar = rLatar.status === 0 && existsSync(pngLatar);
  if (okLatar) { lulus++; console.log("  LULUS  horor latar gradients -> PNG"); }
  else { gagal++; daftarGagal.push(`${label} :: horor latar gradients`); console.log(`  GAGAL  horor latar gradients\n    ${(rLatar.stderr || "").slice(0, 200)}`); }

  const fcHoror = buatArgumenChunk({
    tema: TEMA_HOROR[0], lebar: W, tinggi: H, pngLatar,
    halaman: [
      { pngAbs: "P1", t0: 0, t1: 1 },
      { pngAbs: "P2", t0: 1, t1: 2 },
    ],
    wav: [], musikAbs: "MUS", volumeMusik: 0.8, volumeNarasi: 1,
    durasi: 2, kilat: [0.7], keluar: "OUT",
  });
  // ganti placeholder path dgn sumber lavfi: P1/P2 = color, MUS = sine
  const idxFc = fcHoror.indexOf("-filter_complex");
  const grafHoror = fcHoror[idxFc + 1];
  const rHoror = spawnSync(bin, [
    "-hide_banner", "-v", "error",
    "-f", "lavfi", "-i", `color=c=black:s=${W}x${H}:r=${FPS}`,
    "-loop", "1", "-i", pngLatar,
    "-f", "lavfi", "-i", `color=c=white:s=${W}x${H}`,
    "-f", "lavfi", "-i", `color=c=gray:s=${W}x${H}`,
    "-f", "lavfi", "-i", `sine=f=220:r=44100:d=${DUR}`,
    "-filter_complex", grafHoror,
    "-map", "[vout]", "-map", "[aout]",
    "-t", String(DUR),
    "-f", "null", "-",
  ], { encoding: "utf8", timeout: 120_000 });
  const okHoror = rHoror.status === 0 && !(rHoror.stderr || "").includes("Option not found");
  if (okHoror) { lulus++; console.log("  LULUS  horor graf chunk penuh"); }
  else { gagal++; daftarGagal.push(`${label} :: horor graf chunk`); console.log(`  GAGAL  horor graf chunk (status=${rHoror.status} signal=${rHoror.signal})\n    ${((rHoror.stderr || "") + (rHoror.stdout || "")).slice(0, 300)}`); }

  // ==== v0.30.0 — AI TEXT-TO-VIDEO GENERATOR (komik): render NYATA 2 segmen
  // (zoompan+pad+overlay+apad) -> concat -c copy -> campur musik -c:v copy.
  // Rantai produksi penuh diuji pada kedua versi ffmpeg. ====
  const panelTinggiK = Math.round(H * 0.62);
  const pngIlusK = path.join(tmp, "ilus-komik.png");
  const pngPanelK = path.join(tmp, "panel-komik.png");
  writeFileSync(pngIlusK, renderIlustrasiPng({ lebar: W * 2, tinggi: panelTinggiK * 2, warnaDasar: "#101018" }));
  writeFileSync(pngPanelK, renderTeksPanelPng({ lebar: W, tinggi: H, areaY: panelTinggiK, teks: "Uji adegan komik VidSplit v0.30." }));
  const segK: string[] = [];
  let gagalSegK = false;
  for (const [i, kamera] of ["dalam", "geser-kanan"].entries()) {
    const segTs = path.join(tmp, `seg-komik-${i}.mp4`);
    const rSeg = spawnSync(bin, ["-hide_banner", "-v", "error", ...buatArgumenSegmenKomik({
      tema: TEMA_HOROR[0], lebar: W, tinggi: H, panelTinggi: panelTinggiK,
      ilustrasiAbs: pngIlusK, panelTeksAbs: pngPanelK, kamera,
      durasi: DUR, wavAbs: null, volumeNarasi: 1, keluar: segTs,
    })], { encoding: "utf8", timeout: 120_000 });
    const okSeg = rSeg.status === 0 && existsSync(segTs) && statSync(segTs).size > 5000;
    if (okSeg) { lulus++; console.log(`  LULUS  komik segmen ${kamera} -> mp4`); }
    else { gagal++; gagalSegK = true; daftarGagal.push(`${label} :: komik segmen ${kamera}`); console.log(`  GAGAL  komik segmen ${kamera}\n    ${((rSeg.stderr || "") + (rSeg.stdout || "")).slice(0, 300)}`); }
    segK.push(segTs);
  }
  if (!gagalSegK) {
    // v0.30.0: segmen komik = MP4 → concat demuxer -c copy aman di semua build
    const listK = path.join(tmp, "list-komik.txt");
    const gabungK = path.join(tmp, "gabung-komik.mp4");
    writeFileSync(listK, isiListConcat(segK), "utf8");
    const rGab = spawnSync(bin, ["-hide_banner", "-v", "error", ...buatArgumenConcat(listK, gabungK)], { encoding: "utf8", timeout: 60_000 });
    const okGab = rGab.status === 0 && existsSync(gabungK);
    if (okGab) { lulus++; console.log("  LULUS  komik concat 2 segmen -c copy"); }
    else { gagal++; daftarGagal.push(`${label} :: komik concat`); console.log(`  GAGAL  komik concat\n    ${((rGab.stderr || "") + (rGab.stdout || "")).slice(0, 300)}`); }
    const wavK = path.join(tmp, "musik-komik.wav");
    spawnSync(bin, ["-hide_banner", "-v", "error", "-f", "lavfi", "-i", `sine=f=200:r=44100:d=${DUR + 5}`, wavK], { encoding: "utf8", timeout: 60_000 });
    const mp4K = path.join(tmp, "final-komik.mp4");
    const rMix = spawnSync(bin, ["-hide_banner", "-v", "error", ...buatArgumenCampurMusik(gabungK, wavK, DUR * 2, 0.8, mp4K)], { encoding: "utf8", timeout: 60_000 });
    const okMix = rMix.status === 0 && existsSync(mp4K) && statSync(mp4K).size > 10_000;
    if (okMix) { lulus++; console.log("  LULUS  komik campur musik (-c:v copy + amix)"); }
    else { gagal++; daftarGagal.push(`${label} :: komik campur musik`); console.log(`  GAGAL  komik campur musik\n    ${((rMix.stderr || "") + (rMix.stdout || "")).slice(0, 300)}`); }
    // v0.31.0 — musik langsung DI DALAM segmen (amix per adegan, potongan -ss):
    // pola baru pengganti pass akhir — wajib lolos di kedua build ffmpeg.
    const segMusik = path.join(tmp, "seg-komik-musik.mp4");
    const rSegM = spawnSync(bin, ["-hide_banner", "-v", "error", ...buatArgumenSegmenKomik({
      tema: TEMA_HOROR[0], lebar: W, tinggi: H, panelTinggi: panelTinggiK,
      ilustrasiAbs: pngIlusK, panelTeksAbs: pngPanelK, kamera: "geser-kiri",
      durasi: DUR, wavAbs: null, volumeNarasi: 1,
      musikAbs: wavK, mulaiMusik: 1.25, volumeMusik: 0.8, fadeMusikKeluar: true, keluar: segMusik,
    })], { encoding: "utf8", timeout: 120_000 });
    const okSegM = rSegM.status === 0 && existsSync(segMusik) && statSync(segMusik).size > 5000;
    if (okSegM) { lulus++; console.log("  LULUS  komik segmen dgn musik di dalam (amix per adegan)"); }
    else { gagal++; daftarGagal.push(`${label} :: komik segmen+musik`); console.log(`  GAGAL  komik segmen dgn musik\n    ${((rSegM.stderr || "") + (rSegM.stdout || "")).slice(0, 300)}`); }
  }
}

for (const [i, bin] of kandidat.entries()) {
  uji(bin, i === 0 ? "BUNDEL (ffmpeg-static, versi dgn installer Windows)" : `SISTEM #${i}`);
}

console.log(`\n===== HASIL: ${lulus} lulus, ${gagal} gagal =====`);
if (gagal > 0) {
  console.log("Gaya gagal: " + daftarGagal.join(", "));
  process.exit(1);
}
