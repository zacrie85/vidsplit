// Uji e2e v2.9.0 — TRANSPLANTASI MESIN KINOSTRA via API nyata:
//   1. ekspor setelan BERSIH (mode asli, tanpa efek) → server memakai MESIN
//      POTONG LANGSUNG (job.antrean[].mesin === "POTONG LANGSUNG") dan hasil
//      valid (ffprobe: durasi + h264 + aac + didekode penuh).
//   2. ekspor dgn JUDUL → mesin RENDER (ffmpeg) — jalur lama utuh (regresi).
//   3. /api/kilat/simpan: kontrak simpan part (multipart) + cek part utuh.
// Jalankan: server next harus jalan di BASE (bawaan http://127.0.0.1:3100)
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const BASE = process.env.BASE || "http://127.0.0.1:3100";
const SAMPLE = "/home/z/my-project/vidsplit/work/sample";

let lolos = 0;
let gagalN = 0;
function cek(nama, kondisi, detail) {
  if (kondisi) {
    lolos++;
    console.log(`  ✓ ${nama}`);
  } else {
    gagalN++;
    console.error(`  ✗ ${nama}${detail ? ` — ${detail}` : ""}`);
  }
}
function tunggu(ms) {
  return new Promise((ok) => setTimeout(ok, ms));
}

async function main() {
  /* ---------- siapkan video bersih ---------- */
  const src = "/tmp/uji-fastcut-src.mp4";
  if (!existsSync(src)) {
    execFileSync("ffmpeg", [
      "-y", "-v", "error",
      "-f", "lavfi", "-i", "testsrc2=size=640x360:rate=30:duration=30",
      "-f", "lavfi", "-i", "sine=frequency=440:duration=30",
      "-c:v", "libx264", "-preset", "veryfast", "-g", "48", "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-b:a", "96k",
      src,
    ]);
  }
  let r = await fetch(`${BASE}/api/upload?kind=video&nama=uji-kilat.mp4`, {
    method: "POST",
    body: readFileSync(src),
  });
  const up = await r.json();
  if (!up.ok) throw new Error("unggah gagal: " + up.error);

  /* ================= 1. POTONG LANGSUNG ================= */
  console.log("\n[1] EKSPOR BERSIH → MESIN POTONG LANGSUNG");
  r = await fetch(`${BASE}/api/export`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      daftar: [
        {
          file: up.file,
          nama: "uji-kilat.mp4",
          pengaturan: {
            mode: "asli",
            judul: "",
            kataPart: "",
            deskripsi: "",
            introAktif: false,
            logoId: "",
            frameId: "",
            neonAktif: false,
            transisiPart: "",
            kecepatanVideo: 1,
            resolusiOutput: "auto",
            zoomPembicara: "mati",
            subtitleAktif: false,
            backsoundAktif: false,
            introSuaraFile: "",
            codec: "h264",
            modeSplit: "durasi",
            durasiPart: 10,
          },
        },
      ],
      modeEkspor: "cepat",
    }),
  });
  let j = await r.json();
  if (!j.ok) throw new Error("ekspor gagal dimulai: " + j.error);
  const id1 = j.id;
  /* poling sampai selesai (maks 60 dtk — potong langsung harusnya detik) */
  let job1 = null;
  for (let i = 0; i < 60; i++) {
    await tunggu(1000);
    const res = await fetch(`${BASE}/api/job?id=${id1}`, { cache: "no-store" });
    const jj = await res.json();
    if (jj.ok && jj.job) {
      job1 = jj.job;
      if (jj.job.selesaiSemua || jj.job.error) break;
    }
  }
  if (!job1) throw new Error("job tidak kunjung selesai");
  cek("job 1 selesai tanpa galat", job1.selesaiSemua && !job1.error, job1.error || "");
  cek("mesin = POTONG LANGSUNG", job1.antrean[0]?.mesin === "POTONG LANGSUNG", job1.antrean[0]?.mesin);
  cek("3 part selesai", job1.antrean[0]?.selesai === 3, `${job1.antrean[0]?.selesai}`);
  cek("outputs ≥ 3", (job1.outputs || []).length >= 3, `${job1.outputs?.length}`);
  const partFiles = (job1.outputs || []).filter((o) => o.file.includes("part-") && o.file.endsWith(".mp4"));
  cek("ada 3 file part .mp4", partFiles.length === 3, `${partFiles.length}`);
  for (const o of partFiles) {
    const p = path.join("/home/z/my-project/vidsplit/work/output", id1, o.file);
    const ada = existsSync(p) && statSync(p).size > 51200;
    cek(`${o.file} ada & >50 KB`, ada);
    if (!ada) continue;
    const dur = parseFloat(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", p], { encoding: "utf8" }));
    cek(`${o.file} durasi ≈ 10 dtk`, Math.abs(dur - 10) < 1.6, `${dur}`);
    const dec = execFileSync("ffmpeg", ["-v", "error", "-i", p, "-f", "null", "-"], { encoding: "utf8" });
    cek(`${o.file} didekode penuh tanpa galat`, dec.trim() === "", dec.trim().slice(0, 100));
  }

  /* ================= 2. JUDUL ADA → MESIN RENDER (regresi) ================= */
  console.log("\n[2] EKSPOR DGN JUDUL → MESIN RENDER (ffmpeg, jalur lama)");
  r = await fetch(`${BASE}/api/export`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      daftar: [
        {
          file: up.file,
          nama: "uji-kilat.mp4",
          pengaturan: {
            mode: "blur",
            judul: "Uji Judul",
            kataPart: "Part",
            durasiPart: 10,
            resolusi: "720",
          },
        },
      ],
      modeEkspor: "cepat",
    }),
  });
  j = await r.json();
  if (!j.ok) throw new Error("ekspor 2 gagal dimulai: " + j.error);
  const id2 = j.id;
  let job2 = null;
  for (let i = 0; i < 240; i++) {
    await tunggu(1000);
    const res = await fetch(`${BASE}/api/job?id=${id2}`, { cache: "no-store" });
    const jj = await res.json();
    if (jj.ok && jj.job) {
      job2 = jj.job;
      if (jj.job.selesaiSemua || jj.job.error) break;
    }
  }
  if (!job2) throw new Error("job 2 tidak kunjung selesai");
  cek("job 2 selesai tanpa galat", job2.selesaiSemua && !job2.error, job2.error || "");
  cek("mesin = RENDER", job2.antrean[0]?.mesin === "RENDER", job2.antrean[0]?.mesin);
  const part2 = (job2.outputs || []).filter((o) => o.file.includes("part-") && o.file.endsWith(".mp4"));
  cek("3 part render lama tetap jalan", part2.length === 3, `${part2.length}`);

  /* ================= 3. KONTRAK /api/kilat/simpan ================= */
  console.log("\n[3] KONTRAK /api/kilat/simpan");
  const fd = new FormData();
  fd.append("berkas", new Blob([readFileSync(src)], { type: "video/mp4" }), "part-01.mp4");
  fd.append("meta", JSON.stringify({ idKilat: "kilaUjiE2e01", nama: "part-01.mp4" }));
  r = await fetch(`${BASE}/api/kilat/simpan`, { method: "POST", body: fd });
  const js = await r.json();
  cek("POST simpan ok", js.ok === true && !!js.file, JSON.stringify(js).slice(0, 120));
  const pSimpan = path.join("/home/z/my-project/vidsplit/work/output/kilaUjiE2e01", "part-01.mp4");
  cek("berkas tersimpan di work/output", existsSync(pSimpan));
  r = await fetch(`${BASE}/api/kilat/simpan?idKilat=kilaUjiE2e01&nama=part-01.mp4`);
  const jc = await r.json();
  cek("GET cek part utuh = true", jc.ok && jc.utuh === true, JSON.stringify(jc));
  r = await fetch(`${BASE}/api/kilat/simpan?idKilat=kilaUjiE2e01&nama=part-99.mp4`);
  const jc2 = await r.json();
  cek("GET part belum ada = utuh false", jc2.ok && jc2.utuh === false);
  r = await fetch(`${BASE}/api/kilat/simpan?idKilat=../jail&nama=x.mp4`);
  const jj = await r.json();
  cek("ID jahil ditolak", jj.ok === false, JSON.stringify(jj));

  console.log(`\n═══ HASIL: ${lolos} LOLOS, ${gagalN} GAGAL ═══`);
  process.exit(gagalN > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
