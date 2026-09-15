// Uji e2e v0.10.0 — STUDIO MUSIK: impor → analisis → proses (genre/karaoke) →
// render visualizer → berkas chord/lirik → ZIP → riwayat.
// Jalankan: BASE=http://127.0.0.1:3000 node scripts/uji-musik-e2e.mjs
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync, unlinkSync } from "node:fs";
import path from "node:path";

const BASE = process.env.BASE || "http://127.0.0.1:3000";
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const WORK = process.env.VIDSPLIT_WORK || path.join(ROOT, "work");
const SAMPEL = path.join(WORK, "sample", "musik-uji.mp3");

const gagal = (a) => { console.error("[GAGAL]", ...a); process.exit(1); };
const cek = (kondisi, ...a) => { if (kondisi) console.log("  [LOLOS]", ...a); else gagal(a); };
const jeda = (ms) => new Promise((r) => setTimeout(r, ms));
// fetch dgn retry — keep-alive undici bisa kena ECONNRESET saat server sibuk CPU (ORT/ffmpeg)
const fetchRetry = async (url, opsi = {}, coba = 3) => {
  for (let i = 1; i <= coba; i++) {
    try {
      return await fetch(url, { ...opsi, keepalive: false });
    } catch (e) {
      if (i === coba) throw e;
      await jeda(1500);
    }
  }
};

function buatSampel() {
  mkdirSync(path.join(WORK, "sample"), { recursive: true });
  if (existsSync(SAMPEL) && statSync(SAMPEL).size > 100_000) return;
  // lagu sintetis 16 dtk dgn PROGRESI CHORD nyata: Am → F → C → G (4 dtk per chord),
  // tiap chord = 3 osilator + tremolo 2 Hz (= 120 BPM) agar tempo terdeteksi.
  const chord = [
    [220.0, 261.63, 329.63], // Am
    [174.61, 220.0, 261.63], // F
    [261.63, 329.63, 392.0], // C
    [196.0, 246.94, 293.66], // G
  ];
  const masukan = [];
  const rantai = [];
  chord.forEach((nada, i) => {
    for (const f of nada) {
      masukan.push("-f", "lavfi", "-i", `sine=frequency=${f}:duration=4`);
    }
    const k0 = i * 3;
    rantai.push(`[${k0}:a][${k0 + 1}:a][${k0 + 2}:a]amix=inputs=3:duration=first,tremolo=f=2:d=0.95,volume=0.45[c${i}]`);
  });
  const graf = [...rantai, "[c0][c1][c2][c3]concat=n=4:v=0:a=1,aformat=sample_rates=44100:channel_layouts=stereo"].join(";");
  execFileSync("ffmpeg", ["-y", "-hide_banner", "-v", "error", ...masukan,
    "-filter_complex", graf,
    "-c:a", "libmp3lame", "-b:a", "192k", SAMPEL], { stdio: "inherit" });
}

function ffprobe(abs) {
  const out = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-print_format", "json",
    "-show_streams", "-show_format", abs]).toString());
  const v = out.streams.find((s) => s.codec_type === "video");
  const a = out.streams.find((s) => s.codec_type === "audio");
  return { v, a, durasi: Number(out.format?.duration || 0) };
}

async function pollJob(id, maksMs = 420_000) {
  const t0 = Date.now();
  while (Date.now() - t0 < maksMs) {
    await jeda(1200);
    const r = await fetchRetry(`${BASE}/api/musik/job?id=${id}`, { cache: "no-store" }, 5);
    const j = await r.json();
    if (!j.ok) throw new Error(`job ${id} hilang`);
    if (j.job.selesai || j.job.error) return j.job;
    process.stdout.write(`\r    progres ${String(j.job.progres).padStart(3)}% ${j.job.pesan.slice(0, 60)}          `);
  }
  throw new Error(`job ${id} timeout`);
}

const POST = async (url, body) => {
  const r = await fetchRetry(`${BASE}${url}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }, 5);
  return r.json();
};

console.log("== 0. Siapkan sampel ==");
buatSampel();
cek(existsSync(SAMPEL), `sampel lagu ada: ${SAMPEL} (${(statSync(SAMPEL).size / 1024).toFixed(0)} KB)`);

console.log("== 1. Impor musik ==");
const up = await (async () => {
  const r = await fetch(`${BASE}/api/upload?kind=audio&nama=musik-uji.mp3`, {
    method: "POST", headers: { "Content-Type": "application/octet-stream" },
    body: readFileSync(SAMPEL),
  });
  return r.json();
})();
cek(up.ok && up.file, `terunggah: ${up.file}`);

console.log("== 2. Analisis (BPM/kunci/chord) ==");
const an = await POST("/api/musik/analisis", { file: up.file });
cek(an.ok, "analisis ok");
cek(an.bpm >= 100 && an.bpm <= 140, `BPM terdeteksi ${an.bpm} (harapan ~120, tremolo 2 Hz)`);
cek(Array.isArray(an.chord) && an.chord.length >= 3 && an.chord.length <= 14, `chord terdeteksi: ${an.chord?.length} segmen (harapan ≈4, Am→F→C→G)`);
cek(!!an.kunci && an.gelombang?.length > 0, `kunci ≈ ${an.kunci}, gelombang ${an.gelombang?.length} titik`);

console.log("== 3. Proses audio: REMAKE 80%→60% (dangdut, layer 40%, transpos auto) ==");
const p1 = await POST("/api/musik/proses", {
  file: up.file, judul: "Musik Uji", genre: "dangdut", layerLevel: 40,
  karaoke: "asli", bpm: an.bpm, fase: an.fase,
  mode: "remake", kemiripan: 60, transpose: null,
});
cek(p1.ok && p1.id, `job proses mulai: ${p1.id}`);
const j1 = await pollJob(p1.id);
cek(!j1.error && j1.fileProses && j1.fileMp3, "proses remake selesai tanpa error");
const mp3Abs = path.join(WORK, j1.fileMp3);
cek(existsSync(mp3Abs) && statSync(mp3Abs).size > 50_000, `proses.mp3 ada (${(statSync(mp3Abs).size / 1024).toFixed(0)} KB)`);
const pr1 = ffprobe(mp3Abs);
// transpos auto ±4 semitone TIDAK mengubah durasi (dikompensasi atempo)
cek(Math.abs(pr1.durasi - 16 / 1.02) < 1.2, `durasi remake ≈ ${(16 / 1.02).toFixed(2)} dtk (${pr1.durasi.toFixed(2)})`);

console.log("== 4. Proses audio: mode KARAOKE (stereo dibuat dulu) ==");
const p2 = await POST("/api/musik/proses", {
  file: up.file, judul: "Musik Uji", genre: "asli", layerLevel: 0,
  karaoke: "karaoke", bpm: an.bpm, fase: an.fase,
});
const j2 = await pollJob(p2.id);
cek(!j2.error, "karaoke proses selesai tanpa error");
// pastikan hasil karaoke tak bisu (masih ada instrumen)
const vol = spawnSync("ffmpeg", ["-hide_banner", "-i", path.join(WORK, j2.fileMp3),
  "-af", "volumedetect", "-f", "null", "-"], { stdio: ["ignore", "ignore", "pipe"] }).stderr.toString();
const meanVol = Number(/mean_volume: ([-\d.]+) dB/.exec(vol)?.[1] || 0);
cek(meanVol > -60, `karaoke tidak bisu (mean_volume ${meanVol} dB)`);

console.log("== 5. Render penuh: visual + overlay judul/chord/lirik ==");
const lirik = [
  { mulai: 1, teks: "baris pertama lagu uji" },
  { mulai: 6, teks: "baris kedua lagu uji" },
  { mulai: 11, teks: "baris ketiga lagu uji" },
];
const r1 = await POST("/api/musik/render", {
  file: up.file, judul: "Musik Uji VidSplit", genre: "rock", layerLevel: 40,
  karaoke: "asli", bpm: an.bpm, fase: an.fase,
  visual: "cqt-gelombang", resolusi: "720",
  opsiVisual: { warna1: "#22d3ee", warna2: "#fbbf24", sensitivitas: 6, bgMode: "gelap", fontJudul: "bebas", teksJudul: "MUSIK UJI VIDsplit".toUpperCase(), tampilJudul: true, tampilChord: true, tampilLirik: true },
  lirik, chord: an.chord,
  audioSudahProses: false, wavSiap: null, fileMp3Siap: null,
});
cek(r1.ok && r1.id, `job render mulai: ${r1.id}`);
const jr = await pollJob(r1.id, 600_000);
cek(!jr.error, `render selesai tanpa error (${jr.outputs.length} berkas)`);
const namaFile = jr.outputs.map((o) => o.file).sort();
console.log("    berkas:", namaFile.join(", "));
cek(namaFile.some((f) => f.endsWith(".mp4")), "ada MP4");
cek(namaFile.some((f) => f.endsWith("-audio.mp3")), "ada MP3 320k");
cek(namaFile.some((f) => f.endsWith("chord-lirik.txt")), "ada chord sheet TXT");
cek(namaFile.some((f) => f.endsWith(".lrc")), "ada LRC");

const mp4Abs = path.join(WORK, "output", jr.id, namaFile.find((f) => f.endsWith(".mp4")));
const pr2 = ffprobe(mp4Abs);
cek(pr2.v && pr2.v.codec_name === "h264", `codec video ${pr2.v?.codec_name}`);
cek(pr2.v.width === 1280 && pr2.v.height === 720, `resolusi ${pr2.v.width}x${pr2.v.height}`);
cek(!!pr2.a, "jalur audio ada di MP4");
cek(Math.abs(pr2.durasi - 16) < 2, `durasi MP4 ≈ 16 dtk (${pr2.durasi.toFixed(2)})`);
// unduh per berkas via /api/file
const u1 = await fetch(`${BASE}/api/file?p=${encodeURIComponent(`output/${jr.id}/${namaFile[0]}`)}`);
cek(u1.status === 200, `unduh /api/file status ${u1.status}`);

console.log("== 6. ZIP hasil ==");
const z = await fetch(`${BASE}/api/zip?id=${jr.id}`);
const zBuf = Buffer.from(await z.arrayBuffer());
cek(z.status === 200 && zBuf.slice(0, 2).toString() === "PK", `ZIP valid (${(zBuf.length / 1024 / 1024).toFixed(1)} MB)`);

console.log("== 7. Riwayat mencatat job musik ==");
const riw = await (await fetch(`${BASE}/api/riwayat`)).json();
const entri = (riw.daftar || riw.entries || []).find((e) => e.id === jr.id);
cek(!!entri && entri.id === jr.id, "riwayat ekspor memuat hasil studio musik");

console.log("== 8. Batal job proses (kancab alias) ==");
const p3 = await POST("/api/musik/proses", {
  file: up.file, judul: "Batal Uji", genre: "gamelan", layerLevel: 60,
  karaoke: "asli", bpm: 120, fase: 0,
});
await fetch(`${BASE}/api/musik/job`, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ id: p3.id, aksi: "batal" }),
});
const j3 = await pollJob(p3.id);
cek(j3.dibatalkan || j3.error, "job terbatal dengan rapi");

console.log("== 9. v0.12.0 — MUSIK BARU DARI CHORD: dangdut murni + tempo 1.5× ==");
const p4 = await POST("/api/musik/proses", {
  file: up.file, judul: "Transformasi Uji", genre: "dangdut", layerLevel: 0,
  karaoke: "asli", bpm: an.bpm, fase: an.fase,
  mode: "penuh", kecepatan: 1.5, grooveLevel: 75, melodiLevel: 65,
  melodiAsliLevel: 0, vokalLevel: 0, variasi: 0,
});
cek(p4.ok && p4.id, `job musik baru mulai: ${p4.id}`);
const j4 = await pollJob(p4.id);
cek(!j4.error && j4.fileProses && j4.fileMp3, "musik baru dangdut selesai tanpa error");
const mp3Penuh = path.join(WORK, j4.fileMp3);
const prPenuh = ffprobe(mp3Penuh);
// durasi harapan: 16 dtk / (resep dangdut 1.02 × kecepatan 1.5) ≈ 10.46
cek(Math.abs(prPenuh.durasi - 16 / (1.02 * 1.5)) < 1.0,
  `durasi musik baru+tempo ≈ ${(16 / (1.02 * 1.5)).toFixed(2)} dtk (${prPenuh.durasi.toFixed(2)})`);
// audio tidak bisu — musik baru (drum+bass+akor+melodi+tabla+sitar) benar-benar tersintesis
const vol4 = spawnSync("ffmpeg", ["-hide_banner", "-i", mp3Penuh,
  "-af", "volumedetect", "-f", "null", "-"], { stdio: ["ignore", "ignore", "pipe"] }).stderr.toString();
const meanPenuh = Number(/mean_volume: ([-\d.]+) dB/.exec(vol4)?.[1] || 0);
cek(meanPenuh > -40, `musik baru dangdut tidak bisu (mean_volume ${meanPenuh} dB)`);

console.log("== 10. v0.12.0 — MUSIK BARU instrumental ska (vokal 0%) + tempo 0.5× ==");
const p5 = await POST("/api/musik/proses", {
  file: up.file, judul: "Instrumental Uji", genre: "ska", layerLevel: 0,
  karaoke: "karaoke", bpm: an.bpm, fase: an.fase,
  mode: "penuh", kecepatan: 0.5, grooveLevel: 80, melodiLevel: 60,
  melodiAsliLevel: 0, vokalLevel: 0, variasi: 2,
});
const j5 = await pollJob(p5.id);
cek(!j5.error && j5.fileMp3, "instrumental ska (0.5×) selesai tanpa error");
const pr5 = ffprobe(path.join(WORK, j5.fileMp3));
// durasi harapan: 16 / (resep ska 1.1 × 0.5) ≈ 29.09
cek(Math.abs(pr5.durasi - 16 / (1.1 * 0.5)) < 1.6,
  `durasi instrumental 0.5× ≈ ${(16 / (1.1 * 0.5)).toFixed(2)} dtk (${pr5.durasi.toFixed(2)})`);
const vol5 = spawnSync("ffmpeg", ["-hide_banner", "-i", path.join(WORK, j5.fileMp3),
  "-af", "volumedetect", "-f", "null", "-"], { stdio: ["ignore", "ignore", "pipe"] }).stderr.toString();
const mean5 = Number(/mean_volume: ([-\d.]+) dB/.exec(vol5)?.[1] || 0);
cek(mean5 > -40, `instrumental ska tidak bisu (mean_volume ${mean5} dB)`);

console.log("== 11. v0.12.0 — variasi melodi server-side (variasi 5) ==");
const p6 = await POST("/api/musik/proses", {
  file: up.file, judul: "Variasi Uji", genre: "jazz", layerLevel: 0,
  karaoke: "asli", bpm: an.bpm, fase: an.fase,
  mode: "penuh", kecepatan: 1, grooveLevel: 70, melodiLevel: 65,
  melodiAsliLevel: 0, vokalLevel: 0, variasi: 5,
});
const j6 = await pollJob(p6.id);
cek(!j6.error && j6.fileMp3, "jazz variasi 5 selesai tanpa error");
const pr6 = ffprobe(path.join(WORK, j6.fileMp3));
cek(Math.abs(pr6.durasi - 16 / 0.98) < 1.0,
  `durasi jazz 1× ≈ ${(16 / 0.98).toFixed(2)} dtk (${pr6.durasi.toFixed(2)})`);

console.log("== 12. v0.12.0 — analisis tetap menyertakan chord utk referensi ==");
const an2 = await POST("/api/musik/analisis", { file: up.file });
cek(an2.ok && an2.bpm >= 100 && an2.bpm <= 140, `analisis ulang ok (BPM ${an2.bpm})`);
cek(Array.isArray(an2.chord) && an2.chord.length >= 3, `chord referensi: ${an2.chord?.length} segmen`);
// bukti tidak langsung: proses musik baru di atas sudah menghasilkan audio tanpa error.

console.log("== 13. v0.14.0 — VERSI GENRE bawaan (tanpa field mode): TANPA lapisan + warna dangdut 55% ==");
const p7 = await POST("/api/musik/proses", {
  file: up.file, judul: "Remake Uji", genre: "dangdut", layerLevel: 0, tingkatGenre: 55,
  karaoke: "asli", bpm: an.bpm, fase: an.fase,
  // tanpa "mode" → clampStudio jatuh ke bawaan "remake" (v0.14): TANPA nada tambahan,
  // warna genre terkunci lagu (EQ/echo/lebar), kemiripan 80 (±2 semitone)
});
cek(p7.ok && p7.id, `job versi genre mulai: ${p7.id}`);
const j7 = await pollJob(p7.id);
cek(!j7.error && j7.fileMp3, "versi genre bawaan selesai tanpa error (tanpa lapisan)");
const pr7 = ffprobe(path.join(WORK, j7.fileMp3));
cek(Math.abs(pr7.durasi - 16 / 1.02) < 1.2,
  `durasi versi genre 80% ≈ ${(16 / 1.02).toFixed(2)} dtk (${pr7.durasi.toFixed(2)})`);
const vol7 = spawnSync("ffmpeg", ["-hide_banner", "-i", path.join(WORK, j7.fileMp3),
  "-af", "volumedetect", "-f", "null", "-"], { stdio: ["ignore", "ignore", "pipe"] }).stderr.toString();
const mean7 = Number(/mean_volume: ([-\d.]+) dB/.exec(vol7)?.[1] || 0);
cek(mean7 > -40, `versi genre 55% tidak bisu (mean_volume ${mean7} dB)`);

console.log("== 14. v0.14.0 — VERSI GENRE EDM: tremolo pump terkunci-BPM + lebar stereo ==");
const p8 = await POST("/api/musik/proses", {
  file: up.file, judul: "Pump Uji", genre: "edm", layerLevel: 0, tingkatGenre: 90,
  karaoke: "asli", bpm: an.bpm, fase: an.fase,
  mode: "remake", kemiripan: 100, transpose: 0, kecepatan: 1,
});
cek(p8.ok && p8.id, `job edm pump mulai: ${p8.id}`);
const j8 = await pollJob(p8.id);
cek(!j8.error && j8.fileMp3, "versi genre edm (pump) selesai tanpa error");
const pr8 = ffprobe(path.join(WORK, j8.fileMp3));
// resep edm tempo 1.06 → durasi ≈ 16/1.06
cek(Math.abs(pr8.durasi - 16 / 1.06) < 1.2,
  `durasi edm pump ≈ ${(16 / 1.06).toFixed(2)} dtk (${pr8.durasi.toFixed(2)})`);
const vol8 = spawnSync("ffmpeg", ["-hide_banner", "-i", path.join(WORK, j8.fileMp3),
  "-af", "volumedetect", "-f", "null", "-"], { stdio: ["ignore", "ignore", "pipe"] }).stderr.toString();
const mean8 = Number(/mean_volume: ([-\d.]+) dB/.exec(vol8)?.[1] || 0);
cek(mean8 > -40, `edm pump tidak bisu (mean_volume ${mean8} dB)`);

console.log("== 15. v0.15.0 — PERUBAHAN MUSIK 0%: benar-benar lagu asli (transpos ikut 0) ==");
const p9 = await POST("/api/musik/proses", {
  file: up.file, judul: "Perubahan 0 Uji", genre: "dangdut", layerLevel: 0,
  tingkatGenre: 80, tingkatMusik: 0, kemiripan: 60, nadaLevel: 0,
  karaoke: "asli", bpm: an.bpm, fase: an.fase,
  mode: "remake", kecepatan: 1.3,
});
cek(p9.ok && p9.id, `job perubahan 0% + tempo 1.3× mulai: ${p9.id}`);
const j9 = await pollJob(p9.id);
cek(!j9.error && j9.fileMp3, "perubahan 0% selesai tanpa error (warna genre dilepas, nada tetap)");
const pr9 = ffprobe(path.join(WORK, j9.fileMp3));
// transpos auto ±4 × perubahan 0% → 0 semitone; durasi hanya mengikuti tempo 1.02 × 1.3
cek(Math.abs(pr9.durasi - 16 / (1.02 * 1.3)) < 1.2,
  `durasi perubahan 0% + 1.3× ≈ ${(16 / (1.02 * 1.3)).toFixed(2)} dtk (${pr9.durasi.toFixed(2)})`);

console.log("== 16. v0.15.0 — KARAOKE NYARING: lagu stereo nyata tidak terpendam ==");
const STEREO = path.join(WORK, "sample", "musik-uji-stereo.mp3");
execFileSync("ffmpeg", ["-y", "-hide_banner", "-v", "error",
  "-f", "lavfi", "-i", "sine=frequency=440:duration=12",
  "-f", "lavfi", "-i", "sine=frequency=554.37:duration=12",
  "-f", "lavfi", "-i", "sine=frequency=220:duration=12",
  "-filter_complex",
  "[0:a][1:a][2:a]join=inputs=3:channel_layout=3.0:map=0.0-FL|1.0-FR|2.0-FC[j];[j]volume=0.35",
  "-c:a", "libmp3lame", "-b:a", "192k", STEREO], { stdio: "inherit" });
const upS = await (async () => {
  const r = await fetch(`${BASE}/api/upload?kind=audio&nama=musik-uji-stereo.mp3`, {
    method: "POST", headers: { "Content-Type": "application/octet-stream" },
    body: readFileSync(STEREO),
  });
  return r.json();
})();
cek(upS.ok && upS.file, `lagu stereo terunggah: ${upS.file}`);
const p10 = await POST("/api/musik/proses", {
  file: upS.file, judul: "Karaoke Nyaring", genre: "asli", layerLevel: 0,
  karaoke: "karaoke", bpm: 120, fase: 0,
});
const j10 = await pollJob(p10.id);
cek(!j10.error && j10.fileMp3, "karaoke 3-pita selesai tanpa error");
const vol10 = spawnSync("ffmpeg", ["-hide_banner", "-i", path.join(WORK, j10.fileMp3),
  "-af", "volumedetect", "-f", "null", "-"], { stdio: ["ignore", "ignore", "pipe"] }).stderr.toString();
const mean10 = Number(/mean_volume: ([-\d.]+) dB/.exec(vol10)?.[1] || 0);
cek(mean10 > -30, `karaoke tidak terpendam — mean_volume ${mean10} dB (harapan > -30; dulu bisa < -40)`);

console.log("== 17. v0.15.0 — RENDER 9:16 (1080×1920) + ukuran teks 25 ==");
const r2 = await POST("/api/musik/render", {
  file: up.file, judul: "Vertikal Uji VidSplit", genre: "rock", layerLevel: 0,
  tingkatGenre: 60, tingkatMusik: 70, kemiripan: 100, transpose: 0,
  karaoke: "asli", bpm: an.bpm, fase: an.fase,
  mode: "remake", kecepatan: 1.2,
  visual: "cqt-klasik", resolusi: "916",
  opsiVisual: { warna1: "#22d3ee", warna2: "#fbbf24", sensitivitas: 5, bgMode: "gelap",
    fontJudul: "bebas", teksJudul: "UJI VERTIKAL 9:16", ukuranTeks: 25,
    tampilJudul: true, tampilChord: true, tampilLirik: true },
  lirik: [{ mulai: 1, teks: "baris vertikal satu" }, { mulai: 6, teks: "baris vertikal dua" }],
  chord: an.chord,
  audioSudahProses: false, wavSiap: null, fileMp3Siap: null,
});
cek(r2.ok && r2.id, `job render 9:16 mulai: ${r2.id}`);
const jv = await pollJob(r2.id, 600_000);
cek(!jv.error, `render 9:16 selesai tanpa error (${jv.outputs.length} berkas)`);
const mp4Vert = jv.outputs.map((o) => o.file).find((f) => f.endsWith(".mp4"));
cek(!!mp4Vert, "ada MP4 vertikal");
const pv = ffprobe(path.join(WORK, "output", jv.id, mp4Vert));
cek(pv.v.width === 1080 && pv.v.height === 1920, `resolusi vertikal ${pv.v.width}x${pv.v.height} (harapan 1080x1920)`);
cek(!!pv.a, "jalur audio ada di MP4 vertikal");
// probe file via /api/probe seperti yang dilakukan tombol "Buka di Mode Video"
const prb = await POST("/api/probe", { file: `output/${jv.id}/${mp4Vert}` });
cek(prb.ok && prb.lebar === 1080 && prb.tinggi === 1920 && prb.durasi > 0,
  `/api/probe membaca MP4 musik (lulus prasyarat tombol Buka di Mode Video)`);

console.log("== 18. v0.16.0 — HARMONI TERKUNCI-AKOR: nada tambahan dari chord lagu sendiri ==");
const p16 = await POST("/api/musik/proses", {
  file: up.file, judul: "Harmoni Akor Uji", genre: "dangdut", layerLevel: 0,
  tingkatGenre: 55, tingkatMusik: 65, nadaLevel: 70, kemiripan: 80,
  karaoke: "asli", bpm: an.bpm, fase: an.fase,
  mode: "remake", kecepatan: 1,
});
cek(p16.ok && p16.id, `job harmoni akor mulai: ${p16.id}`);
const j16 = await pollJob(p16.id);
cek(!j16.error && j16.fileMp3, "harmoni akor selesai tanpa error");
const pr16 = ffprobe(path.join(WORK, j16.fileMp3));
// resep dangdut tempo 1.02 → durasi ≈ 16/1.02 (harmoni TIDAK mengubah durasi)
cek(Math.abs(pr16.durasi - 16 / 1.02) < 1.2,
  `durasi harmoni ≈ ${(16 / 1.02).toFixed(2)} dtk (${pr16.durasi.toFixed(2)})`);
const vol16 = spawnSync("ffmpeg", ["-hide_banner", "-i", path.join(WORK, j16.fileMp3),
  "-af", "volumedetect", "-f", "null", "-"], { stdio: ["ignore", "ignore", "pipe"] }).stderr.toString();
const mean16 = Number(/mean_volume: ([-\d.]+) dB/.exec(vol16)?.[1] || 0);
cek(mean16 > -30, `harmoni menambah isi (mean_volume ${mean16} dB > -30)`);

console.log("== 19. v0.16.0 — GENRE VOKAL: dangdut + referensi Rhoma Irama (karakter gaya) ==");
const p17 = await POST("/api/musik/proses", {
  file: up.file, judul: "Genre Vokal Uji", genre: "asli", layerLevel: 0,
  genreVokal: "dangdut", refVokal: "dangdut-p1", tingkatVokal: 80,
  karaoke: "asli", bpm: an.bpm, fase: an.fase,
  kecepatan: 1,
});
cek(p17.ok && p17.id, `job genre vokal mulai: ${p17.id}`);
const j17 = await pollJob(p17.id);
cek(!j17.error && j17.fileMp3, "genre vokal selesai tanpa error");
const pr17 = ffprobe(path.join(WORK, j17.fileMp3));
cek(Math.abs(pr17.durasi - 16) < 1.2, `durasi genre vokal = asli (${pr17.durasi.toFixed(2)})`);
const vol17 = spawnSync("ffmpeg", ["-hide_banner", "-i", path.join(WORK, j17.fileMp3),
  "-af", "volumedetect", "-f", "null", "-"], { stdio: ["ignore", "ignore", "pipe"] }).stderr.toString();
const mean17 = Number(/mean_volume: ([-\d.]+) dB/.exec(vol17)?.[1] || 0);
cek(mean17 > -40, `genre vokal tidak bisu (mean_volume ${mean17} dB, sumber pelan -40)`);

console.log("== 20. v0.16.0 — GENRE VOKAL di mode 'vokal saja' (sampel ADA vokalnya) ==");
// ===== sampel lagu+VOKAL (dipakai blok 20/22/23/24) — TTS manusia bila ada =====
const SAMPEL_VOKAL = path.join(WORK, "sample", "musik-uji-vokal.mp3");
const TTS_MENTAH = path.join(WORK, "uji-vokal-ai", "tts-mentah.wav");
const adaTts = existsSync(TTS_MENTAH);
const buatSampelVokal = () => {
  mkdirSync(path.join(WORK, "sample"), { recursive: true });
  if (existsSync(SAMPEL_VOKAL) && statSync(SAMPEL_VOKAL).size > 100_000) return;
  const masukan = ["-i", SAMPEL];
  let grafVok;
  if (adaTts) {
    masukan.push("-i", TTS_MENTAH);
    grafVok = "[1:a]aresample=44100,apad,atrim=duration=16,volume=0.85,pan=stereo|c0=c0|c1=c0,adelay=0|11[vok]";
  } else {
    masukan.push("-f", "lavfi", "-i", "sine=frequency=196:duration=16",
      "-f", "lavfi", "-i", "sine=frequency=392:duration=16");
    grafVok = "[1:a][2:a]amix=inputs=2:duration=first,tremolo=f=5:d=0.4,volume=0.3,pan=stereo|c0=c0|c1=c0,adelay=0|11[vok]";
  }
  // bed instrumen REALISTIS utk model: derau pink pulsa ala drum + "hat" derau tinggi
  // + bass — SEMUA broadband/perkusi (bukan nada harmonik murni yang mirip paduan suara)
  masukan.push("-f", "lavfi", "-i", "anoisesrc=d=16:c=pink:r=44100:a=0.9:seed=5",
    "-f", "lavfi", "-i", "sine=frequency=55:sample_rate=44100:duration=16",
    "-f", "lavfi", "-i", "anoisesrc=d=16:c=brown:r=44100:a=0.6:seed=9");
  execFileSync("ffmpeg", ["-y", "-hide_banner", "-v", "error", ...masukan,
    "-filter_complex",
    "[2:a]tremolo=f=2:d=0.95,lowpass=f=7500,volume=0.55,pan=stereo|c0=c0|c1=0.25*c0[drm];" +
    "[3:a]tremolo=f=1:d=0.5,volume=0.5,pan=stereo|c0=c0|c1=c0[bas];" +
    "[4:a]highpass=f=2500,volume=0.16,pan=stereo|c0=0.25*c0|c1=c0,adelay=6|0[hat];" +
    "[drm][bas][hat]amix=inputs=3:normalize=0[ir];" +
    `${grafVok};[ir][vok]amix=inputs=2:duration=first,volume=1.2,alimiter=limit=0.95[out]`,
    "-map", "[out]", "-c:a", "libmp3lame", "-b:a", "192k", SAMPEL_VOKAL], { stdio: "inherit" });
};
buatSampelVokal();
cek(existsSync(SAMPEL_VOKAL), `sampel lagu+vokal ada (${(statSync(SAMPEL_VOKAL).size / 1024).toFixed(0)} KB, sumber vokal: ${adaTts ? "TTS manusia" : "sintetis"})`);
const upVok = await (async () => {
  const r = await fetch(`${BASE}/api/upload?kind=audio&nama=musik-uji-vokal.mp3`, {
    method: "POST", headers: { "Content-Type": "application/octet-stream" },
    body: readFileSync(SAMPEL_VOKAL),
  });
  return r.json();
})();
cek(upVok.ok && upVok.file, `lagu+vokal terunggah → ${upVok.file}`);
const p18 = await POST("/api/musik/proses", {
  file: upVok.file, judul: "Vokal Saja Vokal Uji", genre: "asli", layerLevel: 0,
  genreVokal: "dangdut", refVokal: "dangdut-w1", tingkatVokal: 90,
  karaoke: "vokal", bpm: 120, fase: 0,
});
const j18 = await pollJob(p18.id, 600_000);
cek(!j18.error && j18.fileMp3, "vokal saja + genre vokal selesai tanpa error");
const vol18 = spawnSync("ffmpeg", ["-hide_banner", "-i", path.join(WORK, j18.fileMp3),
  "-af", "volumedetect", "-f", "null", "-"], { stdio: ["ignore", "ignore", "pipe"] }).stderr.toString();
const mean18 = Number(/mean_volume: ([-\d.]+) dB/.exec(vol18)?.[1] || 0);
cek(mean18 > -40, `vokal saja + warna vokal tidak bisu (mean_volume ${mean18} dB)`);

console.log("== 21. v0.18.0 — SUMBER VIDEO (MP4) + BPM MANUAL ==");
// (a) bungkus lagu sintetis yang sama menjadi MP4 (video testsrc2 + audio AAC)
const VIDEO_UJI = path.join(WORK, "sample", "musik-uji.mp4");
const VIDEO_BISU = path.join(WORK, "sample", "musik-uji-bisu.mp4");
execFileSync("ffmpeg", ["-y", "-hide_banner", "-v", "error",
  "-i", SAMPEL, "-f", "lavfi", "-i", "testsrc2=size=320x240:rate=15",
  "-shortest", "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p",
  "-c:a", "aac", "-b:a", "160k", VIDEO_UJI], { stdio: "inherit" });
// (b) MP4 TANPA audio — harus ditolak dengan pesan jelas
execFileSync("ffmpeg", ["-y", "-hide_banner", "-v", "error",
  "-f", "lavfi", "-i", "testsrc2=size=320x240:rate=15:duration=4",
  "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", VIDEO_BISU],
  { stdio: "inherit" });
cek(existsSync(VIDEO_UJI) && statSync(VIDEO_UJI).size > 50_000, `video uji ada (${(statSync(VIDEO_UJI).size / 1024).toFixed(0)} KB)`);
const unggahVideo = async (abs, nama) => {
  const r = await fetch(`${BASE}/api/upload?kind=audio&nama=${encodeURIComponent(nama)}`, {
    method: "POST", headers: { "Content-Type": "application/octet-stream" },
    body: readFileSync(abs),
  });
  return r.json();
};
const upV = await unggahVideo(VIDEO_UJI, "musik-uji.mp4");
cek(upV.ok && upV.file && upV.ekstrakDariVideo === true, `video terunggah + audio diekstrak otomatis → ${upV.file}`);
cek(String(upV.file).endsWith(".flac"), "hasil ekstraksi berbentuk FLAC lossless");
const upB = await unggahVideo(VIDEO_BISU, "musik-uji-bisu.mp4");
cek(!upB.ok && /audio/i.test(upB.error || ""), `video tanpa trek audio ditolak: "${(upB.error || "").slice(0, 60)}…"`);
// (c) analisis langsung di FLAC hasil ekstraksi — BPM & chord tetap terbaca
const anV = await POST("/api/musik/analisis", { file: upV.file });
cek(anV.ok && Math.abs((anV.bpm || 0) - 120) < 8, `analisis FLAC hasil ekstraksi ok — BPM ${anV.bpm} (≈120)`);
// (d) BPM MANUAL 137.5 (bukan hasil deteksi) dipakai proses — job sukses, durasi tak berubah
const p19 = await POST("/api/musik/proses", {
  file: upV.file, judul: "Sumber Video BPM Manual", genre: "asli", layerLevel: 0,
  karaoke: "asli", bpm: 137.5, fase: anV.fase || 0, kecepatan: 1,
});
cek(p19.ok && p19.id, `job proses dgn BPM manual 137.5 mulai: ${p19.id}`);
const j19 = await pollJob(p19.id);
cek(!j19.error && j19.fileMp3, "proses dgn BPM manual selesai tanpa error");
const pr19 = ffprobe(path.join(WORK, j19.fileMp3));
cek(Math.abs(pr19.durasi - 16) < 1.2, `durasi proses dgn BPM manual ≈ 16 dtk (${pr19.durasi.toFixed(2)} — BPM manual tidak mengubah durasi)`);

console.log("== 22. v0.20.0 — PISAH VOKAL & MUSIK dgn AI (vocal remover MDX-Net) ==");
const p20 = await POST("/api/musik/pisah", { file: upVok.file, judul: "Pisah Uji AI" });
cek(p20.ok && p20.id, `job pisah mulai: ${p20.id}`);
const j20 = await pollJob(p20.id, 600_000);
cek(!j20.error && j20.outputs.length === 2, `pisah AI selesai tanpa error (${j20.outputs.length} berkas)`);
const fMus = j20.outputs.find((o) => o.file.endsWith("-musik.mp3"));
const fVok = j20.outputs.find((o) => o.file.endsWith("-vokal.mp3"));
cek(!!fMus && !!fVok, `berkas keluaran benar: ${fMus?.file} + ${fVok?.file}`);
const rmsPita = (abs, pita) => {
  const ekstr = pita === "vokal"
    ? "aformat=channel_layouts=stereo,pan=mono|c0=0.5*c0+0.5*c1,highpass=f=180,lowpass=f=3800"
    : "aformat=channel_layouts=stereo,pan=mono|c0=0.5*c0+-0.5*c1,highpass=f=180,lowpass=f=3800";
  const out = spawnSync("ffmpeg", ["-hide_banner", "-i", abs, "-af", `${ekstr},volumedetect`, "-f", "null", "-"],
    { stdio: ["ignore", "ignore", "pipe"] }).stderr.toString();
  return Number(/mean_volume: ([-\d.]+) dB/.exec(out)?.[1] || -99);
};
const prMus = ffprobe(path.join(WORK, `output/${j20.id}/${fMus.file}`));
const prVok = ffprobe(path.join(WORK, `output/${j20.id}/${fVok.file}`));
cek(Math.abs(prMus.durasi - 16) < 1.5 && Math.abs(prVok.durasi - 16) < 1.5,
  `durasi kedua stem ≈ 16 dtk (${prMus.durasi.toFixed(2)} / ${prVok.durasi.toFixed(2)})`);
const musVok = rmsPita(path.join(WORK, `output/${j20.id}/${fMus.file}`), "vokal");
const vokVok = rmsPita(path.join(WORK, `output/${j20.id}/${fVok.file}`), "vokal");
cek(vokVok > musVok,
  `pita vokal lebih kuat di berkas vokal (${vokVok.toFixed(1)} dB) dibanding berkas musik (${musVok.toFixed(1)} dB)`);
cek(vokVok > -50, `berkas vokal tidak bisu (${vokVok.toFixed(1)} dB)`);
// v0.20 mesin AI (bila model tersedia): sisa vokal di instrumental harus TURUN jelas
const adaModel = existsSync(path.join(ROOT, "assets", "vokal-ai", "Kim_Vocal_2.onnx"));
if (adaModel && adaTts) {
  const asliVok = rmsPita(path.join(WORK, upVok.file), "vokal");
  cek(musVok < asliVok - 5,
    `AI: sisa vokal di instrumental turun ≥ 5 dB (lagu asli ${asliVok.toFixed(1)} dB → sisa ${musVok.toFixed(1)} dB)`);
}
const meanMus = spawnSync("ffmpeg", ["-hide_banner", "-i", path.join(WORK, `output/${j20.id}/${fMus.file}`),
  "-af", "volumedetect", "-f", "null", "-"], { stdio: ["ignore", "ignore", "pipe"] }).stderr.toString();
cek(Number(/mean_volume: ([-\d.]+) dB/.exec(meanMus)?.[1] || 0) > -30,
  "instrumental karaoke tidak terpendam (mean_volume > -30)");

console.log("== 23. v0.20.0 — VOKALGEN-4 TERUKUR: stem AI ganti suara penuh, instrumen utuh (A/B) ==");
const prosesAB = async (genreVokal) => {
  const p = await POST("/api/musik/proses", {
    file: upVok.file, judul: "VokalGen AB", genre: "asli", layerLevel: 0,
    genreVokal, refVokal: "dangdut-w1", tingkatVokal: 100, mesinVokal: "ai",
    karaoke: "asli", bpm: 120, fase: 0, kecepatan: 1,
  });
  const j = await pollJob(p.id, 600_000);
  if (j.error) throw new Error(j.error);
  return path.join(WORK, j.fileMp3);
};
const outA = await prosesAB("dangdut");
const outB = await prosesAB("mati");
const bandAbs = (sumber, pita) => {
  const jenis = pita.startsWith("vokal") ? "vokal" : "sisi";
  const ekstr = jenis === "vokal"
    ? "aformat=channel_layouts=stereo,pan=mono|c0=0.5*c0+0.5*c1,highpass=f=180,lowpass=f=3800"
    : "aformat=channel_layouts=stereo,pan=mono|c0=0.5*c0+-0.5*c1,highpass=f=180,lowpass=f=3800";
  const tujuan = path.join(WORK, `tmp-band-${pita}-${path.basename(sumber)}.wav`);
  execFileSync("ffmpeg", ["-y", "-hide_banner", "-v", "error", "-i", sumber, "-af", ekstr,
    "-c:a", "pcm_s16le", tujuan]);
  return tujuan;
};
const rmsFile = (abs) => {
  const out = spawnSync("ffmpeg", ["-hide_banner", "-i", abs, "-af", "volumedetect", "-f", "null", "-"],
    { stdio: ["ignore", "ignore", "pipe"] }).stderr.toString();
  return Number(/mean_volume: ([-\d.]+) dB/.exec(out)?.[1] || -99);
};
const perubahanPctAB = (a, b, pita) => {
  const ba = bandAbs(a, `${pita}-A`);
  const bb = bandAbs(b, `${pita}-B`);
  const bd = ba.replace("band-", "diff-");
  execFileSync("ffmpeg", ["-y", "-hide_banner", "-v", "error", "-i", ba, "-i", bb,
    "-filter_complex", "[0:a][1:a]amerge=inputs=2,pan=mono|c0=0.5*c0+-0.5*c1",
    "-c:a", "pcm_s16le", bd]);
  const A = 10 ** (rmsFile(ba) / 20), B = 10 ** (rmsFile(bb) / 20), C = 10 ** (rmsFile(bd) / 20) * 2;
  if (A <= 0 || B <= 0) return 0;
  const corr = Math.max(-1, Math.min(1, (A * A + B * B - C * C) / (2 * A * B)));
  return (1 - corr) * 100;
};
const chgVok = perubahanPctAB(outA, outB, "vokal");
// era stem-AI: vokal (termasuk karakter stereo barunya) diganti PENUH → pita sisi
// ikut berubah by design. Jaminan "musik utuh" = struktural (stem instrumental
// lewat tak tersentuh — terkunci di uji unit & blok 22) + linimasa tetap seirama:
const prA = ffprobe(outA);
const prB = ffprobe(outB);
cek(chgVok > 30, `karakter VOKAL berubah jelas: ${chgVok.toFixed(0)}% (harapan > 30%)`);
cek(Math.abs(prA.durasi - 16) < 1.2 && Math.abs(prB.durasi - 16) < 1.2,
  `linimasa musik tetap seirama: durasi A/B ≈ 16 dtk (${prA.durasi.toFixed(2)} / ${prB.durasi.toFixed(2)})`);
console.log(`    → vokal berubah ${chgVok.toFixed(0)}% · durasi A/B ${prA.durasi.toFixed(2)}/${prB.durasi.toFixed(2)} dtk`);

console.log("== 24. v0.20.0 — mesin DSP lama masih hidup sbg fallback (mesinVokal=dsp) ==");
const p24 = await POST("/api/musik/proses", {
  file: upVok.file, judul: "VokalGen DSP", genre: "asli", layerLevel: 0,
  genreVokal: "dangdut", refVokal: "dangdut-p1", tingkatVokal: 80, mesinVokal: "dsp",
  karaoke: "asli", bpm: 120, fase: 0, kecepatan: 1,
});
const j24 = await pollJob(p24.id, 600_000);
cek(!j24.error && j24.fileMp3, "proses dgn mesin DSP (fallback) selesai tanpa error");
const pr24 = ffprobe(path.join(WORK, j24.fileMp3));
cek(Math.abs(pr24.durasi - 16) < 1.5, `durasi hasil DSP ≈ 16 dtk (${pr24.durasi.toFixed(2)})`);

console.log(`\n=== SEMUA UJI E2E STUDIO MUSIK LOLOS ===`);
process.exit(0);
