// Uji e2e FOLDER TUJUAN hasil ekspor VidSplit v0.6.4:
//   (1) setelan default + validasi path (tolak path relatif)
//   (2) simpan folder tujuan → dibuat + lolos uji tulis
//   (3) explorer: daftar drive, isi folder, buat folder baru
//   (4) ekspor → hasil OTOMATIS tersalin ke folder tujuan (ukuran cocok)
//   (5) ekspor kedua judul sama → subfolder unik "(2)"
//   (6) bersihkanKerja → salinan kerja dibuang, riwayat tetap adaFile, ZIP tetap bisa
//   (7) otomatis OFF → tidak ada penyalinan
// Jalankan: BASE=http://127.0.0.1:3000 node scripts/uji-tujuan.mjs
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import path from "node:path";

const BASE = process.env.BASE || "http://127.0.0.1:3000";
const ROOT = "/home/z/my-project/vidsplit";
const WORK = path.join(ROOT, "work");
const DEST = path.join(WORK, "uji-tujuan", "hasil");

function log(...a) {
  console.log("[uji]", ...a);
}
function gagal(...a) {
  console.error("[GAGAL]", ...a);
  process.exit(1);
}

async function api(metode, url, body) {
  const r = await fetch(`${BASE}${url}`, {
    method: metode,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  let j = null;
  try {
    j = await r.json();
  } catch {
    /* non-JSON */
  }
  return { status: r.status, j };
}

function pasti(kondisi, label) {
  if (!kondisi) gagal(label);
  log("OK —", label);
}

/** video uji kecil 25 dtk (dibuat bila belum ada) */
function siapkanSampel() {
  const dir = path.join(WORK, "sample");
  mkdirSync(dir, { recursive: true });
  const f = path.join(dir, "uji-tujuan.mp4");
  if (!existsSync(f)) {
    execFileSync("ffmpeg", [
      "-f", "lavfi", "-i", "testsrc=duration=25:size=640x360:rate=24",
      "-f", "lavfi", "-i", "sine=frequency=440:duration=25",
      "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-shortest", "-y", f,
    ], { stdio: "pipe" });
    log("sampel dibuat:", f);
  }
  return f;
}

async function unggahVideo(file, nama) {
  const r = await fetch(`${BASE}/api/upload?kind=video&nama=${encodeURIComponent(nama)}`, {
    method: "POST",
    body: await (await import("node:fs/promises")).readFile(file),
  });
  const j = await r.json();
  if (!j.ok) gagal(`upload video: ${j.error}`);
  return j.file;
}

async function jalankanJob(judul, namaFile = "uji-tujuan.mp4") {
  const vid = await unggahVideo(sampel, namaFile);
  const r = await api("POST", "/api/export", {
    modeEkspor: "cepat",
    daftar: [
      {
        // nama dikirim persis seperti UI (nama asli file, tanpa prefek unggah)
        file: vid,
        nama: namaFile,
        pengaturan: {
          mode: "blur",
          judul,
          kataPart: "Part",
          durasiPart: 10,
          durasiIntro: 1,
          resolusi: "720",
          prosesParalel: 2,
        },
      },
    ],
  });
  if (!r.j?.ok || !r.j?.id) gagal(`ekspor gagal dimulai: ${JSON.stringify(r.j)}`);
  const id = r.j.id;
  log("job jalan:", id);
  // tunggu selesai (maks 5 menit)
  for (let i = 0; i < 600; i++) {
    await new Promise((s) => setTimeout(s, 500));
    const s = await api("GET", `/api/job?id=${id}`);
    if (s.j?.ok && s.j?.job?.selesaiSemua) return { id, job: s.j.job };
  }
  gagal("job tidak selesai dalam 5 menit");
}

const isiFolder = (p) => (existsSync(p) ? readdirSync(p) : null);

let sampel;

async function main() {
  sampel = siapkanSampel();

  // ---- 1) setelan default & validasi ----
  let r = await api("POST", "/api/tujuan", { folder: null, otomatis: true, bersihkanKerja: false });
  pasti(r.j?.ok === true, "reset setelan ke default");
  r = await api("GET", "/api/tujuan");
  pasti(r.j?.setelan?.folder === null, "folder default null");
  pasti(r.j?.setelan?.otomatis === true, "otomatis default aktif");

  r = await api("POST", "/api/tujuan", { folder: "folder-relatif" });
  pasti(r.status === 400 && !!r.j?.error, "path relatif DITOLAK");

  // ---- 2) simpan folder tujuan (dibuat otomatis) ----
  rmSync(DEST, { recursive: true, force: true });
  r = await api("POST", "/api/tujuan", { folder: DEST });
  pasti(r.j?.ok === true && r.j?.setelan?.folder === DEST, "folder tujuan tersimpan");
  pasti(existsSync(DEST), "folder tujuan dibuat di disk");

  // ---- 3) explorer ----
  r = await api("GET", "/api/tujuan/explorer");
  pasti(r.j?.akar === true && Array.isArray(r.j?.daftar) && r.j.daftar.length > 0,
    `daftar drive: ${r.j?.daftar?.map((d) => d.nama).join(", ")}`);
  r = await api("GET", `/api/tujuan/explorer?path=${encodeURIComponent(DEST)}`);
  pasti(r.j?.ok === true && Array.isArray(r.j?.entri), "isi folder tujuan terbaca");
  r = await api("POST", "/api/tujuan/explorer", { path: DEST, nama: "folder-baru" });
  pasti(r.j?.ok === true && existsSync(r.j?.path), "folder baru dibuat via explorer");
  r = await api("GET", "/api/tujuan/explorer?path=folder-relatif");
  pasti(r.status === 400, "explorer menolak path relatif");

  // ---- 4) ekspor → tersalin otomatis ----
  let { id: idA, job: jobA } = await jalankanJob("Uji Tujuan");
  pasti(jobA.folderTersimpan && jobA.folderTersimpan.startsWith(DEST),
    `job 1 tersalin ke: ${jobA.folderTersimpan}`);
  pasti(!jobA.peringatanSalin, "job 1 tanpa peringatan salin");
  pasti(jobA.menyalin === false, "job 1 flag menyalin selesai");
  const fileDestA = isiFolder(jobA.folderTersimpan) ?? [];
  pasti(fileDestA.length === jobA.outputs.length,
    `job 1: ${fileDestA.length} file di tujuan = ${jobA.outputs.length} output`);
  for (const o of jobA.outputs) {
    const p = path.join(jobA.folderTersimpan, o.file);
    pasti(existsSync(p) && statSync(p).size === o.ukuran, `job 1: ukuran cocok — ${o.file}`);
  }

  // ---- 5) ekspor kedua judul sama → subfolder unik ----
  let { job: jobB } = await jalankanJob("Uji Tujuan");
  pasti(jobB.folderTersimpan && jobB.folderTersimpan !== jobA.folderTersimpan,
    "job 2 subfolder BERBEDA (tidak menimpa)");
  pasti(path.basename(jobB.folderTersimpan).includes("(2)"),
    `job 2 subfolder ber-suffix (2): ${path.basename(jobB.folderTersimpan)}`);

  // ---- 6) bersihkanKerja → salinan kerja dibuang, riwayat & ZIP tetap hidup ----
  r = await api("POST", "/api/tujuan", { bersihkanKerja: true });
  pasti(r.j?.ok === true && r.j?.setelan?.bersihkanKerja === true, "bersihkanKerja aktif");
  let { id: idC, job: jobC } = await jalankanJob("Uji Tujuan");
  pasti(jobC.folderTersimpan && !jobC.peringatanSalin, "job 3 tersalin bersih");
  const kerjaC = path.join(WORK, "output", idC);
  const sisaKerja = (isiFolder(kerjaC) ?? []).filter((f) => f.endsWith(".mp4"));
  pasti(sisaKerja.length === 0, `job 3: salinan kerja DIBUANG (${sisaKerja.length} sisa)`);
  for (const o of jobC.outputs) {
    pasti(existsSync(path.join(jobC.folderTersimpan, o.file)), `job 3: utuh di tujuan — ${o.file}`);
  }
  r = await api("GET", "/api/riwayat");
  const entriC = r.j?.daftar?.find((e) => e.id === idC);
  pasti(entriC?.adaFile === true, "riwayat job 3: adaFile TRUE via folder tujuan");
  pasti(entriC?.folderTersimpan === jobC.folderTersimpan, "riwayat mencatat folderTersimpan");
  r = await api("GET", `/api/zip?id=${idC}`);
  pasti(r.status === 200, "ZIP job 3 tetap bisa (fallback folder tujuan)");

  // ---- 7) otomatis OFF → tidak menyalin ----
  r = await api("POST", "/api/tujuan", { otomatis: false });
  pasti(r.j?.ok === true && r.j?.setelan?.otomatis === false, "otomatis dimatikan");
  const jumlahSebelum = (isiFolder(DEST) ?? []).length;
  let { job: jobD } = await jalankanJob("Uji Tujuan Empat", "uji-empat.mp4");
  pasti(!jobD.folderTersimpan, "job 4: TIDAK tersalin (otomatis mati)");
  pasti((isiFolder(DEST) ?? []).length === jumlahSebelum, "folder tujuan tidak bertambah");

  // ---- kembalikan setelan default + bersih-bersih ----
  await api("POST", "/api/tujuan", { folder: null, otomatis: true, bersihkanKerja: false });
  rmSync(path.join(WORK, "uji-tujuan"), { recursive: true, force: true });
  log("setelan dikembalikan & folder uji dibersihkan");

  console.log("\n=== SEMUA UJI FOLDER TUJUAN LOLOS ===");
}

main().catch((e) => gagal(e?.stack || e?.message || String(e)));
