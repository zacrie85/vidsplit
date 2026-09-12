// Uji e2e TOMBOL BATALKAN (v0.6.2):
//   mulai ekspor video panjang (12 part) → tunggu render berjalan → POST batal
//   → verifikasi job berakhir status dibatalkan, ffmpeg mati, file parsial dibuang,
//     part yang sudah selesai tetap tercantum & filenya ada.
// Jalankan: BASE=http://127.0.0.1:3000 node scripts/uji-batal.mjs
import { execFileSync, execFile } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const BASE = process.env.BASE || "http://127.0.0.1:3000";
const SAMPLE = "/home/z/my-project/vidsplit/work/sample";
const SAMPANJANG = path.join(SAMPLE, "uji-panjang.mp4");

const log = (...a) => console.log("[uji]", ...a);
const gagal = (...a) => {
  console.error("[GAGAL]", ...a);
  process.exit(1);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** buat video uji 120 dtk bergerak (testsrc) bila belum ada */
function buatVideoPanjang() {
  if (existsSync(SAMPANJANG) && statSync(SAMPANJANG).size > 100000) return;
  log("membuat video uji 120 dtk (sekali saja)…");
  execFileSync("ffmpeg", [
    "-y", "-v", "error",
    "-f", "lavfi", "-i", "testsrc2=size=640x360:rate=24:duration=120",
    "-f", "lavfi", "-i", "sine=frequency=440:duration=120",
    "-c:v", "libx264", "-preset", "ultrafast", "-crf", "30",
    "-c:a", "aac", "-shortest",
    SAMPANJANG,
  ], { timeout: 180000 });
  log("video uji siap:", SAMPANJANG);
}

async function unggah(file, nama) {
  const r = await fetch(`${BASE}/api/upload?kind=video&nama=${encodeURIComponent(nama)}`, {
    method: "POST",
    body: readFileSync(file),
  });
  const j = await r.json();
  if (!j.ok) gagal("upload gagal", j.error);
  log("unggah →", j.file);
  return j.file;
}

async function pollJob(id, maksMs) {
  const t0 = Date.now();
  while (Date.now() - t0 < maksMs) {
    const r = await fetch(`${BASE}/api/job?id=${id}`, { cache: "no-store" });
    const j = await r.json();
    if (j.ok && j.job) return j.job;
    await sleep(300);
  }
  gagal("timeout menunggu job");
}

async function main() {
  buatVideoPanjang();
  const v = await unggah(SAMPANJANG, "uji-panjang.mp4");

  // mulai ekspor: 120 dtk ÷ 10 dtk = 12 part, presisi agar render cukup lama
  const r = await fetch(`${BASE}/api/export`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      modeEkspor: "presisi",
      daftar: [
        {
          file: v,
          pengaturan: {
            mode: "blur", judul: "Uji Batal", kataPart: "Part", durasiPart: 10,
            durasiIntro: 0, resolusi: "720", prosesParalel: 2,
          },
        },
      ],
    }),
  });
  const j0 = await r.json();
  if (!j0.ok || !j0.id) gagal("ekspor gagal dimulai", j0.error);
  const id = j0.id;
  log("job:", id);

  // tunggu sampai render benar-benar berjalan
  let job = null;
  const t0 = Date.now();
  while (Date.now() - t0 < 30000) {
    job = await pollJob(id, 3000);
    if (job.partAktif > 0 || job.progresTotal > 0) break;
  }
  if (!job || (job.partAktif === 0 && job.progresTotal === 0)) {
    gagal("render tidak kunjung berjalan — tidak bisa menguji pembatalan");
  }
  log(`render berjalan — partAktif=${job.partAktif}, progres=${job.progresTotal}%`);

  // BATALKAN
  const rb = await fetch(`${BASE}/api/job`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, aksi: "batal" }),
  });
  const jb = await rb.json();
  if (!jb.ok) gagal("POST batal gagal", jb.error);
  log("batal diminta ✓");

  // tunggu job berakhir (maks 30 dtk)
  const t1 = Date.now();
  while (Date.now() - t1 < 30000) {
    job = await pollJob(id, 3000);
    if (job.selesaiSemua) break;
    await sleep(300);
  }
  if (!job.selesaiSemua) gagal("job tidak berakhir setelah batal dalam 30 dtk");
  const durasiHenti = (Date.now() - t1) / 1000;
  log(`job berakhir ${durasiHenti.toFixed(1)} dtk setelah batal`);

  // verifikasi status pembatalan
  if (!job.dibatalkan) gagal("dibatalkan harus true");
  if (!job.batalDiminta) gagal("batalDiminta harus true");
  if (job.error) gagal("error harus null saat dibatalkan, dapat:", job.error);
  for (const vq of job.antrean) {
    if (vq.status !== "dibatalkan" && vq.status !== "selesai") {
      gagal("status antrean setelah batal salah:", vq.status);
    }
  }
  log("status: dibatalkan=true, antrean =", job.antrean.map((x) => x.status).join(","));

  // ffmpeg harus mati
  await sleep(1000);
  let hidup = "";
  try {
    hidup = execFileSync("pgrep", ["-f", "ffmpeg"], { encoding: "utf8" }).trim();
  } catch {
    /* pgrep exit≠0 = tidak ada proses */
  }
  if (hidup) log("PERINGATAN: masih ada proses ffmpeg di sistem (mungkin milik lain)");
  else log("ffmpeg sudah mati ✓");

  // file parsial harus dibuang; semua .mp4 di folder = outputs
  const folder = `/home/z/my-project/vidsplit/work/output/${id}`;
  const diDisk = existsSync(folder)
    ? readdirSync(folder).filter((f) => f.endsWith(".mp4")).sort()
    : [];
  const tercantum = job.outputs.map((o) => o.file).sort();
  const liar = diDisk.filter((f) => !tercantum.includes(f));
  if (liar.length) gagal("file parsial tidak dibuang:", liar.join(", "));
  for (const f of tercantum) {
    if (!existsSync(path.join(folder, f))) gagal("output tercantum tapi file hilang:", f);
  }
  log(`folder bersih ✓ — ${tercantum.length} file utuh (parsial dibuang)`);

  // ===== SKENARIO B: batal SETELAH beberapa part selesai → hasil parsial tetap ada =====
  log("\n--- skenario B: batal setelah part selesai ---");
  const r2 = await fetch(`${BASE}/api/export`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      modeEkspor: "presisi",
      daftar: [
        {
          file: v,
          pengaturan: {
            mode: "blur", judul: "Uji Batal B", kataPart: "Part", durasiPart: 5,
            durasiIntro: 0, resolusi: "720", prosesParalel: 1,
          },
        },
      ],
    }),
  });
  const j2 = await r2.json();
  if (!j2.ok || !j2.id) gagal("ekspor B gagal dimulai", j2.error);
  const id2 = j2.id;

  // tunggu sampai ada part yang SELESAI — cek antrean[].selesai (real-time;
  // outputs baru terisi lengkap di akhir job)
  let job2 = null;
  const t2 = Date.now();
  while (Date.now() - t2 < 90000) {
    job2 = await pollJob(id2, 3000);
    if (job2.antrean[0].selesai >= 2) break;
    if (job2.selesaiSemua) gagal("skenario B: job selesai sebelum sempat dibatalkan");
  }
  if (!job2 || job2.antrean[0].selesai < 2) gagal("skenario B: tidak ada part selesai dalam 90 dtk");
  const sudahJadi = job2.antrean[0].selesai;
  log(`skenario B — ${sudahJadi} part sudah selesai, membatalkan…`);

  const rb2 = await fetch(`${BASE}/api/job`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: id2, aksi: "batal" }),
  });
  if (!(await rb2.json()).ok) gagal("skenario B: POST batal gagal");

  const t3 = Date.now();
  while (Date.now() - t3 < 30000) {
    job2 = await pollJob(id2, 3000);
    if (job2.selesaiSemua) break;
    await sleep(300);
  }
  if (!job2.selesaiSemua) gagal("skenario B: job tidak berakhir setelah batal");
  if (!job2.dibatalkan) gagal("skenario B: dibatalkan harus true");
  if (job2.outputs.length < sudahJadi) {
    gagal("skenario B: hasil parsial hilang!", job2.outputs.length, "<", sudahJadi);
  }
  const folder2 = `/home/z/my-project/vidsplit/work/output/${id2}`;
  const disk2 = readdirSync(folder2).filter((f) => f.endsWith(".mp4")).sort();
  const cantum2 = job2.outputs.map((o) => o.file).sort();
  if (disk2.length !== cantum2.length || disk2.some((f, i) => f !== cantum2[i])) {
    gagal("skenario B: isi folder ≠ outputs — parsial bocor atau hasil hilang");
  }
  log(
    `skenario B ✓ — dibatalkan dengan ${job2.outputs.length} part utuh tersisa & bisa diunduh`,
  );

  console.log(`\n=== SEMUA UJI BATAL LOLOS ===\njob id: ${id}\nfolder: ${folder}`);
}

main().catch((e) => gagal(e instanceof Error ? e.message : String(e)));
