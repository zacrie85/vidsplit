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
    const r = await fetch(`${BASE}/api/musik/job?id=${id}`, { cache: "no-store" });
    const j = await r.json();
    if (!j.ok) throw new Error(`job ${id} hilang`);
    if (j.job.selesai || j.job.error) return j.job;
    process.stdout.write(`\r    progres ${String(j.job.progres).padStart(3)}% ${j.job.pesan.slice(0, 60)}          `);
  }
  throw new Error(`job ${id} timeout`);
}

const POST = async (url, body) => {
  const r = await fetch(`${BASE}${url}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
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

console.log("== 3. Proses audio: genre rock + layer 40% ==");
const p1 = await POST("/api/musik/proses", {
  file: up.file, judul: "Musik Uji", genre: "rock", layerLevel: 40,
  karaoke: "asli", bpm: an.bpm, fase: an.fase,
});
cek(p1.ok && p1.id, `job proses mulai: ${p1.id}`);
const j1 = await pollJob(p1.id);
cek(!j1.error && j1.fileProses && j1.fileMp3, "proses selesai tanpa error");
const mp3Abs = path.join(WORK, j1.fileMp3);
cek(existsSync(mp3Abs) && statSync(mp3Abs).size > 50_000, `proses.mp3 ada (${(statSync(mp3Abs).size / 1024).toFixed(0)} KB)`);
const pr1 = ffprobe(mp3Abs);
cek(Math.abs(pr1.durasi - 16) < 1.2, `durasi proses ≈ 16 dtk (${pr1.durasi.toFixed(2)})`);

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

console.log(`\n=== SEMUA UJI E2E STUDIO MUSIK LOLOS ===`);
process.exit(0);
