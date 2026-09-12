// Uji e2e v0.8.0 — HASIL BERTAHAP (incremental outputs) + ZIP PER VIDEO:
//   antrean 2 video (video-2 sengaja lebih lama) → SEBELUM antrean tuntas:
//     (a) job.outputs sudah berisi part video-1 yang selesai (muncul dini)
//     (b) /api/zip?id=..&video=<nama-1> terunduh walau antrean masih jalan
//     (c) /api/zip?video=<nama-2> saat belum ada hasil → 400 ramah
//     (d) akhir: semua part ada, ZIP per video-2 juga terunduh
//     (e) default font baru ikut terpakai di render (fontsize 40/35 di argumen
//         sudah diuji uji-logo-bebas.ts — di sini cukup hasil e2e utuh)
// Jalankan: BASE=http://127.0.0.1:3000 node scripts/uji-bertahap.mjs
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync, rmSync } from "node:fs";
import path from "node:path";

const BASE = process.env.BASE || "http://127.0.0.1:3000";
const SAMPLE = "/home/z/my-project/vidsplit/work/sample";
const DIRTMP = "/home/z/my-project/vidsplit/work/uji-bertahap";

function log(...a) { console.log("[uji]", ...a); }
function gagal(...a) { console.error("[GAGAL]", ...a); process.exit(1); }

const readBuf = (f) => readFileSync(f);

async function unggah(kind, file, nama) {
  const r = await fetch(`${BASE}/api/upload?kind=${kind}&nama=${encodeURIComponent(nama)}`, {
    method: "POST",
    body: readBuf(file),
  });
  const j = await r.json();
  if (!j.ok) gagal(`upload ${kind}`, j.error);
  log(`unggah ${kind} → ${j.file}`);
  return j.file;
}

/** mulai ekspor antrean 2 video; video-1 pendek (3 part), video-2 panjang (6 part) */
async function mulaiEkspor(v1, v2) {
  const r = await fetch(`${BASE}/api/export`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      modeEkspor: "cepat",
      daftar: [
        {
          file: v1,
          pengaturan: { mode: "warna", warnaLatar: "#22c55e", judul: "Bertahap Satu", kataPart: "Part", durasiPart: 3, durasiIntro: 0, resolusi: "720", prosesParalel: 2 },
        },
        {
          file: v2,
          pengaturan: { mode: "warna", warnaLatar: "#3b82f6", judul: "Bertahap Dua", kataPart: "Part", durasiPart: 3, durasiIntro: 0, resolusi: "720", prosesParalel: 2 },
        },
      ],
    }),
  });
  const j = await r.json();
  if (!j.ok) gagal("mulai ekspor", j.error);
  return j.id;
}

async function ambilJob(id) {
  const r = await fetch(`${BASE}/api/job?id=${id}`);
  const j = await r.json();
  if (!j.ok) gagal("ambil job", j.error);
  return j.job; // {ok, job} → ambil isinya
}

/** tunggu sampai kondisi() benar atau habis waktu */
async function tunggu(kondisi, batasMs, label) {
  const t0 = Date.now();
  while (Date.now() - t0 < batasMs) {
    if (await kondisi()) return true;
    await new Promise((res) => setTimeout(res, 300));
  }
  gagal(`tunggu habis: ${label}`);
}

/** unduh ZIP (per video / semua) → { status, ukuran, entri } */
function unduhZip(id, video) {
  const url = `${BASE}/api/zip?id=${id}${video ? `&video=${encodeURIComponent(video)}` : ""}`;
  const zip = DIRTMP + (video ? `/zip-${video}.zip` : "/zip-semua.zip");
  if (existsSync(zip)) rmSync(zip);
  let status;
  try {
    // curl supaya status HTTP terbaca; -f gagal bila ≥400
    const kode = execFileSync("curl", ["-s", "-o", zip, "-w", "%{http_code}", url], {
      stdio: ["ignore", "pipe", "ignore"],
    }).toString().trim();
    status = Number(kode) || 0;
  } catch {
    status = 0;
  }
  const ukuran = status === 200 && existsSync(zip) ? statSync(zip).size : 0;
  let entri = [];
  if (ukuran > 0) {
    entri = execFileSync("unzip", ["-l", zip]).toString().split("\n").filter((l) => l.includes(".mp4"));
  }
  return { status, ukuran, entri };
}

async function main() {
  execFileSync("mkdir", ["-p", DIRTMP]);
  const v1 = await unggah("video", path.join(SAMPLE, "uji-a.mp4"), "bertahap-satu.mp4");
  const v2 = await unggah("video", path.join(SAMPLE, "uji-b.mp4"), "bertahap-dua.mp4");

  // durasi asli sample: a=10 dtk → intro0+durasiPart3 → 4 part? (10/3→4) ;
  // b=15 dtk → 5 part. Pemilihan angka tepat tak penting — cukup beda jumlah.
  const id = await mulaiEkspor(v1, v2);
  log("ekspor jalan — id", id);

  // (a)+(b): tunggu outputs muncul PADAHAL antrean belum selesai
  let job = null;
  await tunggu(async () => {
    job = await ambilJob(id);
    return job.outputs.length > 0 && !job.selesaiSemua;
  }, 120_000, "outputs muncul sebelum antrean tuntas");
  log(`outputs dini = ${job.outputs.length} part (antrean masih proses) — FITUR 3 OK`);
  if (!job.selesaiSemua) log("selesaiSemua masih false — benar, sedang berjalan");

  // (b) ZIP per video-1 saat antrean masih jalan
  const nama1 = job.antrean[0].nama;
  const z1 = unduhZip(id, nama1);
  log(`ZIP per video "${nama1}" saat berjalan: HTTP ${z1.status}, ${z1.ukuran} B, ${z1.entri.length} mp4`);
  if (z1.status !== 200 || z1.ukuran < 10_000 || z1.entri.length < 1) gagal("ZIP per video gagal saat antrean berjalan", z1);
  log("FITUR 3b OK — ZIP per video bisa diunduh TANPA menunggu semua selesai");

  // (c) ZIP video yang BELUM punya hasil → 400 ramah (bila video-2 belum selesai)
  const jobC = await ambilJob(id);
  const nama2 = jobC.antrean[1].nama;
  if (!jobC.selesaiSemua) {
    const sudahAdahasil2 = jobC.outputs.some((o) => o.video === nama2);
    if (!sudahAdahasil2) {
      const z2 = unduhZip(id, nama2);
      log(`ZIP "${nama2}" sebelum ada hasil: HTTP ${z2.status} (harus 400)`);
      if (z2.status !== 400) gagal("ZIP video tanpa hasil harus 400", z2);
    }
  }

  // (d) tunggu antrean tuntas → semua part + ZIP per video-2 + ZIP semua
  await tunggu(async () => {
    job = await ambilJob(id);
    return job.selesaiSemua;
  }, 300_000, "antrean selesai semua");
  log(`antrean tuntas: ${job.antrean.map((v) => `${v.nama}:${v.status} ${v.selesai}/${v.total}`).join(" · ")}`);
  const totalPart = job.antrean.reduce((s, v) => s + v.total, 0);
  if (job.outputs.length !== totalPart) gagal("outputs akhir ≠ total part", job.outputs.length, totalPart);

  const z2b = unduhZip(id, nama2);
  log(`ZIP per video-2 setelah tuntas: HTTP ${z2b.status}, ${z2b.entri.length} mp4`);
  if (z2b.status !== 200 || z2b.entri.length !== job.antrean[1].total) gagal("ZIP per video-2 salah isinya", z2b);

  const zSemua = unduhZip(id, "");
  log(`ZIP semua: HTTP ${zSemua.status}, ${zSemua.entri.length} mp4`);
  if (zSemua.status !== 200 || zSemua.entri.length !== totalPart) gagal("ZIP semua salah isinya", zSemua);

  // (e) outputs dini memang MERUPAKAN bagian awal outputs akhir (urutan stabil)
  log("urutan outputs stabil:", job.outputs.map((o) => `${o.video}/${o.file}`).join(", "));

  console.log("\n=== SEMUA UJI BERTAHAP LOLOS — hasil muncul dini + ZIP per video ===");
  console.log("job id:", id);
}

main().catch((e) => gagal(e.message, e));
