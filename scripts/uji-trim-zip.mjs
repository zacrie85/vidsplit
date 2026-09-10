// Uji e2e v0.5.0 — TRIM rentang (mulaiDetik/akhirDetik) + ZIP server streaming.
// Video uji: 20 dtk, warna berganti tiap 5 dtk (merah, biru, hijau, kuning).
// Trim 5..15 dtk → part harus berisi biru lalu hijau.
// Lalu ekspor antrean 2 video (salah satu pakai trim) → unduh /api/zip →
// verifikasi struktur folder + isi identik sumber via 7zz.
// Jalankan: BASE=http://127.0.0.1:3000 node scripts/uji-trim-zip.mjs
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const BASE = process.env.BASE || "http://127.0.0.1:3000";
const SAMPLE = "/home/z/my-project/vidsplit/work/sample";
const KELUAR = "/home/z/my-project/vidsplit/work/uji-trim-zip";

function log(...a) {
  console.log("[uji]", ...a);
}
function gagal(...a) {
  console.error("[GAGAL]", ...a);
  process.exit(1);
}

async function unggah(kind, file, nama) {
  const r = await fetch(`${BASE}/api/upload?kind=${kind}&nama=${encodeURIComponent(nama)}`, {
    method: "POST",
    body: readFileSync(file),
  });
  const j = await r.json();
  if (!j.ok) gagal(`upload ${kind}`, j.error);
  return j.file;
}

function warnaPiksel(file, t) {
  const buf = execFileSync("ffmpeg", [
    "-v", "error", "-ss", String(t), "-i", file,
    "-frames:v", "1", "-vf", "crop=8:8:356:636",
    "-f", "rawvideo", "-pix_fmt", "rgb24", "-",
  ]);
  let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i + 2 < buf.length; i += 3) {
    r += buf[i]; g += buf[i + 1]; b += buf[i + 2]; n++;
  }
  return { r: r / n, g: g / n, b: b / n };
}
function cekWarna(label, c, r, g, b, tol = 60) {
  log(`${label}: rgb(${Math.round(c.r)},${Math.round(c.g)},${Math.round(c.b)}) — ekspektasi (${r},${g},${b})`);
  if (Math.abs(c.r - r) > tol || Math.abs(c.g - g) > tol || Math.abs(c.b - b) > tol) gagal("warna salah:", label);
}
function probeDurasi(f) {
  const j = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-print_format", "json", "-show_format", f]).toString());
  return parseFloat(j.format.duration);
}

async function tungguJob(id) {
  const t0 = Date.now();
  while (Date.now() - t0 < 300_000) {
    await new Promise((res) => setTimeout(res, 900));
    const job = (await (await fetch(`${BASE}/api/job?id=${id}`)).json()).job;
    if (job.error) gagal("job error:", job.error);
    if (job.selesaiSemua) return job;
  }
  gagal("timeout job", id);
}

async function main() {
  // ===== 1) TRIM =====
  const vTrim = await unggah("video", path.join(SAMPLE, "uji-trim.mp4"), "uji-trim.mp4");
  log("trim: mulai 5 dtk, akhir 15 dtk, durasiPart 10 → 1 part (biru+ hijau)");
  let r = await fetch(`${BASE}/api/export`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      modeEkspor: "cepat",
      daftar: [{
        file: vTrim,
        pengaturan: { mode: "warna", warnaLatar: "#333333", judul: "Trim Uji", kataPart: "P", durasiPart: 10, resolusi: "720", mulaiDetik: 5, akhirDetik: 15 },
      }],
    }),
  });
  const j1 = await r.json();
  if (!j1.ok) gagal("export trim:", j1.error);
  log(`job trim ${j1.id} totalPart=${j1.totalPart} (harus 1)`);
  if (j1.totalPart !== 1) gagal("totalPart trim salah:", j1.totalPart);
  await tungguJob(j1.id);

  const fTrim = path.join("/home/z/my-project/vidsplit/work/output", j1.id, "trim-uji-part-01.mp4");
  if (!existsSync(fTrim)) gagal("file trim tidak ada:", fTrim);
  const dur = probeDurasi(fTrim);
  log(`durasi trim: ${dur.toFixed(2)} (harus 10)`);
  if (Math.abs(dur - 10) > 0.3) gagal("durasi trim salah:", dur);
  // t=2 dalam part → detik 7 sumber = BIRU (0,0,255)
  cekWarna("t=2 (sumber 7 dtk)", warnaPiksel(fTrim, 2), 0, 0, 255);
  // t=8 dalam part → detik 13 sumber = HIJAU (0,128,0)
  cekWarna("t=8 (sumber 13 dtk)", warnaPiksel(fTrim, 8), 0, 128, 0);

  // ===== 2) ZIP server streaming — antrean 2 video =====
  const vA = await unggah("video", path.join(SAMPLE, "uji-a.mp4"), "uji-a.mp4");
  const vC = await unggah("video", path.join(SAMPLE, "uji-c.mp4"), "uji-c.mp4");
  r = await fetch(`${BASE}/api/export`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      modeEkspor: "cepat",
      daftar: [
        { file: vA, pengaturan: { mode: "blur", judul: "Video A", kataPart: "P", durasiPart: 10, resolusi: "720" } },
        { file: vC, pengaturan: { mode: "blur", judul: "Video C", kataPart: "P", durasiPart: 10, resolusi: "720" } },
      ],
    }),
  });
  const j2 = await r.json();
  if (!j2.ok) gagal("export zip:", j2.error);
  const job2 = await tungguJob(j2.id);
  log(`antrean zip selesai: ${job2.outputs.length} file`);

  const rZip = await fetch(`${BASE}/api/zip?id=${j2.id}`);
  if (!rZip.ok) gagal("ZIP HTTP", rZip.status, await rZip.text());
  const disp = rZip.headers.get("content-disposition") || "";
  const ct = rZip.headers.get("content-type") || "";
  log(`zip: ct=${ct} disp=${disp.slice(0, 60)}`);
  if (!ct.includes("zip")) gagal("content-type bukan zip:", ct);
  if (!disp.includes("vidsplit-antrean-2video.zip")) gagal("nama zip salah:", disp);
  const zipBuf = Buffer.from(await rZip.arrayBuffer());
  log(`zip unduhan: ${zipBuf.length} B`);
  if (zipBuf.length < 50_000) gagal("zip terlalu kecil");

  // simpan + bedah dengan 7zz
  execFileSync("mkdir", ["-p", KELUAR]);
  const zipPath = path.join(KELUAR, "uji.zip");
  execFileSync("sh", ["-c", `printf '%s' "$(cat /dev/null)" > /dev/null`]); // noop
  await import("node:fs").then((fs) => fs.writeFileSync(zipPath, zipBuf));
  const daftar = execFileSync("/home/z/my-project/tools/7zz", ["l", "-slt", zipPath]).toString();
  const entri = daftar.split("\n").filter((l) => l.startsWith("Path = ")).map((l) => l.slice(7).trim());
  log("entri zip:", entri.join(" | "));
  if (!entri.includes("BACA-SAYA.txt")) gagal("BACA-SAYA.txt hilang dari zip");
  const folderA = entri.find((e) => e.includes("/") && e.includes("video-a") && e.endsWith("part-01.mp4"));
  const folderC = entri.find((e) => e.includes("/") && e.includes("video-c") && e.endsWith("part-01.mp4"));
  if (!folderA || !folderC) gagal("entri folder per video tidak ketemu:", entri.join(" | "));

  // ekstrak + bandingkan byte-dengan-byte dengan file asli di server
  execFileSync("/home/z/my-project/tools/7zz", ["x", "-y", zipPath, `-o${path.join(KELUAR, "z")}`], { stdio: "ignore" });
  const asli = path.join("/home/z/my-project/vidsplit/work/output", j2.id, job2.outputs[0].file);
  const hasil = path.join(KELUAR, "z", folderA);
  const sAsli = statSync(asli).size;
  const sHasil = statSync(hasil).size;
  log(`bandingkan: asli ${sAsli} B vs zip ${sHasil} B`);
  if (sAsli !== sHasil) gagal("ukuran file dalam zip ≠ asli");
  const md5 = (f) => execFileSync("md5sum", [f]).toString().split(" ")[0];
  if (md5(asli) !== md5(hasil)) gagal("md5 file dalam zip ≠ asli");

  // validasi error: zip job tidak dikenal → 404
  const r404 = await fetch(`${BASE}/api/zip?id=tidakada`);
  log(`zip job bohong → HTTP ${r404.status} (harus 404)`);
  if (r404.status !== 404) gagal("zip job tidak dikenal harus 404");

  console.log("\n=== SEMUA UJI TRIM + ZIP LOLOS ===");
}
main().catch((e) => gagal(e.message));
