// Uji e2e RIWAYAT EKSPOR (v0.6.3):
//   ekspor video uji (3 part cepat) → tunggu selesai → entri muncul di /api/riwayat
//   → RESTART server (job hilang dari memori) → riwayat tetap ada & ZIP bisa diunduh ulang
//   → hapusFile → entri + folder hasil lenyap.
// Jalankan: BASE=http://127.0.0.1:3000 node scripts/uji-riwayat.mjs
import { execFileSync, execSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const BASE = process.env.BASE || "http://127.0.0.1:3000";
const REPO = "/home/z/my-project/vidsplit";
const WORK = path.join(REPO, "work");
const SAMPLE = path.join(WORK, "sample", "uji-panjang.mp4");

const log = (...a) => console.log("[uji]", ...a);
const gagal = (...a) => {
  console.error("[GAGAL]", ...a);
  process.exit(1);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function buatVideoPanjang() {
  if (existsSync(SAMPLE) && statSync(SAMPLE).size > 100000) return;
  log("membuat video uji 120 dtk…");
  execFileSync("ffmpeg", [
    "-y", "-v", "error",
    "-f", "lavfi", "-i", "testsrc2=size=640x360:rate=24:duration=120",
    "-f", "lavfi", "-i", "sine=frequency=440:duration=120",
    "-c:v", "libx264", "-preset", "ultrafast", "-crf", "30",
    "-c:a", "aac", "-shortest",
    SAMPLE,
  ], { timeout: 180000 });
}

async function tungguServer(maksMs) {
  const t0 = Date.now();
  while (Date.now() - t0 < maksMs) {
    try {
      const r = await fetch(`${BASE}/api/riwayat`, { cache: "no-store" });
      if (r.ok) return;
    } catch {
      /* coba lagi */
    }
    await sleep(500);
  }
  gagal("server tidak hidup setelah restart");
}

async function main() {
  buatVideoPanjang();

  // 1) unggah & ekspor cepat — 120 dtk ÷ 40 dtk = 3 part
  const ru = await fetch(`${BASE}/api/upload?kind=video&nama=uji-riwayat.mp4`, {
    method: "POST",
    body: readFileSync(SAMPLE),
  });
  const ju = await ru.json();
  if (!ju.ok) gagal("unggah gagal", ju.error);

  const re = await fetch(`${BASE}/api/export`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      modeEkspor: "cepat",
      daftar: [
        {
          file: ju.file,
          pengaturan: {
            mode: "crop", judul: "Uji Riwayat", kataPart: "Bagian", durasiPart: 40,
            durasiIntro: 0, resolusi: "720", prosesParalel: 2,
          },
        },
      ],
    }),
  });
  const je = await re.json();
  if (!je.ok || !je.id) gagal("ekspor gagal dimulai", je.error);
  const id = je.id;
  log("job:", id, "— menunggu selesai…");

  // 2) tunggu job selesai (maks 3 menit)
  let job = null;
  const t0 = Date.now();
  while (Date.now() - t0 < 180000) {
    const r = await fetch(`${BASE}/api/job?id=${id}`, { cache: "no-store" });
    const j = await r.json();
    if (j.ok && j.job?.selesaiSemua) { job = j.job; break; }
    await sleep(1000);
  }
  if (!job?.selesaiSemua) gagal("job tidak selesai dalam 3 menit");
  if (job.error) gagal("job berakhir dgn error:", job.error);
  if (job.outputs.length !== 3) gagal("harusnya 3 part, dapat", job.outputs.length);
  log("ekspor selesai — 3 part ✓");

  // 3) riwayat harus sudah berisi entri ini
  let entri = null;
  for (let i = 0; i < 20; i++) {
    const r = await fetch(`${BASE}/api/riwayat`, { cache: "no-store" });
    const j = await r.json();
    if (j.ok) {
      entri = (j.daftar || []).find((e) => e.id === id);
      if (entri) break;
    }
    await sleep(500);
  }
  if (!entri) gagal("entri riwayat tidak muncul setelah ekspor selesai");
  if (entri.outputs.length !== 3) gagal("riwayat: outputs salah", entri.outputs.length);
  if (!entri.adaFile) gagal("riwayat: adaFile harus true");
  if (!(entri.ukuranAda > 0)) gagal("riwayat: ukuranAda harus > 0");
  if (entri.dibatalkan) gagal("riwayat: dibatalkan harus false");
  log(`riwayat tercatat ✓ — ${entri.antrean[0].nama}, ukuran ${(entri.ukuranAda / 1e6).toFixed(1)} MB`);

  // 4) RESTART server — job hilang dari memori, riwayat HARUS tetap bisa diunduh
  log("me-restart server (simulasi aplikasi ditutup & dibuka lagi)…");
  // PENTING: proses server standalone me-rename dirinya jadi "next-server (v16.x)" —
  // pola path server.js tidak akan pernah cocok. Pakai regex [s] agar shell-nya sendiri
  // tidak ikut terbunuh (cmdline shell berisi pola literal).
  execSync('pkill -f "next-[s]erver" || true', { shell: "/bin/bash" });
  await sleep(1500);
  execSync(
    `PORT=3000 HOSTNAME=127.0.0.1 VIDSPLIT_WORK=${WORK} ` +
      `python3 scripts/daemon-jalankan.py /tmp/vidsplit-preview.log node .next/standalone/vidsplit/server.js`,
    { cwd: REPO, shell: "/bin/bash", timeout: 30000 },
  );
  await tungguServer(30000);
  log("server hidup lagi ✓");

  // 5) job lama tidak ada di memori…
  const rj = await fetch(`${BASE}/api/job?id=${id}`, { cache: "no-store" });
  if (rj.status !== 404) gagal("job lama harusnya hilang dari memori (404), dapat", rj.status);
  // …tapi riwayat tetap ada
  const rr = await fetch(`${BASE}/api/riwayat`, { cache: "no-store" });
  const jr = await rr.json();
  const entri2 = (jr.daftar || []).find((e) => e.id === id);
  if (!entri2) gagal("riwayat hilang setelah restart — persistensi gagal");
  if (entri2.outputs.length !== 3 || !entri2.adaFile) gagal("riwayat pasca-restart rusak");
  log("riwayat persisten lintas restart ✓");

  // 6) unduh ulang ZIP dari riwayat (jalur fallback zip → riwayat)
  const rz = await fetch(`${BASE}/api/zip?id=${id}`);
  if (!rz.ok) gagal("ZIP dari riwayat gagal:", rz.status, await rz.text());
  const buf = Buffer.from(await rz.arrayBuffer());
  if (buf.length < 50000) gagal("ZIP terlalu kecil", buf.length);
  if (!(buf[0] === 0x50 && buf[1] === 0x4b)) gagal("bukan file ZIP (magic PK)");
  log(`ZIP dari riwayat ✓ — ${(buf.length / 1e6).toFixed(1)} MB`);

  // 7) ZIP id tak dikenal → 404 ramah
  const r404 = await fetch(`${BASE}/api/zip?id=tidakada`);
  if (r404.status !== 404) gagal("zip id tak dikenal harus 404, dapat", r404.status);

  // 8) hapusFile → entri + folder hasil lenyap
  const rh = await fetch(`${BASE}/api/riwayat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, aksi: "hapusFile" }),
  });
  if (!(await rh.json()).ok) gagal("hapusFile gagal");
  const rs = await fetch(`${BASE}/api/riwayat`, { cache: "no-store" });
  const js = await rs.json();
  if ((js.daftar || []).some((e) => e.id === id)) gagal("entri masih ada setelah dihapus");
  if (existsSync(path.join(WORK, "output", id))) gagal("folder hasil masih ada setelah hapusFile");
  log("hapusFile ✓ — entri & folder hasil bersih");

  // 9) hapus id tak dikenal → 404
  const rh404 = await fetch(`${BASE}/api/riwayat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: "tidakada", aksi: "hapusFile" }),
  });
  if (rh404.status !== 404) gagal("hapusFile id tak dikenal harus 404");

  console.log("\n=== SEMUA UJI RIWAYAT LOLOS ===");
}

main().catch((e) => gagal(e instanceof Error ? e.message : String(e)));
