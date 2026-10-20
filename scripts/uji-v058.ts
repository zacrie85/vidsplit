// Uji unit v0.58.0 — PAKET PERBAIKAN & OPTIMASI MENYELURUH (hasil audit 4 lapisan).
// Jalankan: bun scripts/uji-v058.ts
// Mencakup: slug unik anti-tabrakan, timestamp ASS floor, kebersihan disk (pangkas
// berumur), evict job lama, pathAman, expansi drawtext dimatikan, batas waktu AI.
import { mkdtempSync, mkdirSync, writeFileSync, utimesSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { slugify, slugUnikDaftar, hitungPartDgnHapus } from "../src/lib/vidsplit/types";
import { kebabAssSub } from "../src/lib/vidsplit/subtitle";
import { pangkasWork, resetThrottlePangkas, jadwalkanPangkas, JEDA_PANGKAS_MS } from "../src/lib/vidsplit/kebersihan";
import { pathAman, ROOT_WORK } from "../src/lib/vidsplit/ffmpeg";
import { evictJobLama } from "../src/lib/vidsplit/jobs";
import { balapanWaktu } from "../src/lib/vidsplit/subtitle";

let lolos = 0;
let total = 0;
function ok(kondisi: boolean, nama: string, detail?: unknown) {
  total++;
  if (kondisi) {
    lolos++;
    console.log(`  ✓ ${nama}`);
  } else {
    console.error(`  ✗ GAGAL: ${nama}`, detail ?? "");
  }
}

console.log("== v0.58.0 — SLUG UNIK ANTI-TABRAKAN NAMA FILE ==");
// dua video judul sama → slug ke-2 dst. diberi akhiran -2, -3
const dupe = slugUnikDaftar(["Alam Gaib", "Alam Gaib", "alam  gaib"]);
ok(dupe[0] === "alam-gaib", "judul pertama tak berubah", dupe);
ok(dupe[1] === "alam-gaib-2", "judul kedua diberi -2", dupe);
ok(dupe[2] === "alam-gaib-3", "judul ketiga diberi -3 (slugify menyamakan)", dupe);
// judul unik → persis slugify lama (nol regresi)
const unik = slugUnikDaftar(["Video Kuda Laut", "", "Kuda laut"]);
ok(unik[0] === slugify("Video Kuda Laut"), "judul unik-1 = slugify lama", unik);
ok(unik[1] === slugify(""), "judul kosong = slugify lama", unik);
ok(unik[2] === slugify("Kuda laut"), "judul unik-2 = slugify lama", unik);
ok(slugUnikDaftar([]).length === 0, "daftar kosong → hasil kosong");
const empat = slugUnikDaftar(["", "", "", ""]);
ok(new Set(empat).size === 4, "4 judul kosong → 4 nama unik", empat);

console.log("== v0.58.0 — TIMESTAMP ASS FLOOR (59.995 tak lagi jadi 60.00) ==");
ok(kebabAssSub(59.995) === "0:00:59.99", "59.995 → 0:00:59.99 (bukan 0:00:60.00)", kebabAssSub(59.995));
ok(kebabAssSub(59.9999) === "0:00:59.99", "59.9999 → 0:00:59.99", kebabAssSub(59.9999));
ok(kebabAssSub(0) === "0:00:00.00", "0 → 0:00:00.00", kebabAssSub(0));
ok(kebabAssSub(3599.999) === "0:59:59.99", "3599.999 → 0:59:59.99", kebabAssSub(3599.999));
ok(kebabAssSub(3661.5) === "1:01:01.50", "3661.5 → 1:01:01.50", kebabAssSub(3661.5));
ok(kebabAssSub(-3) === "0:00:00.00", "negatif dijepit ke 0", kebabAssSub(-3));
// format tetap valid utk libass (tak ada 60 di detik/menit)
let semuaValid = true;
for (let t = 0; t < 7200; t += 0.137) {
  const s = kebabAssSub(t);
  const m = s.match(/^(\d+):(\d{2}):(\d{2}\.\d{2})$/);
  if (!m || Number(m[2]) > 59 || Number(m[3]) >= 60) {
    semuaValid = false;
    break;
  }
}
ok(semuaValid, "sweep 2 jam: semua timestamp valid (tak ada detik/menit 60)");

console.log("== v0.58.0 — KEBERSIHAN DISK (pangkas berumur) ==");
// root uji terpisah — jangan sentuh folder kerja nyata
const rootUji = mkdtempSync(path.join(tmpdir(), "vds-kebersihan-"));
const kini = Date.now();
const lama = kini - 2 * 24 * 3600_000; // 2 hari lalu (mulus utk ambang 24 jam)
const sangatLama = kini - 8 * 24 * 3600_000; // 8 hari (lewati ambang 7 hari)
const buat = (rel: string, mtimeMs: number) => {
  const p = path.join(rootUji, rel);
  mkdirSync(path.dirname(p), { recursive: true });
  writeFileSync(p, "x");
  utimesSync(p, new Date(mtimeMs), new Date(mtimeMs));
};
/** buat SUBFOLDER dgn mtime tua — pangkasFolder menilai umur dr mtime FOLDER */
const buatFolder = (rel: string, mtimeMs: number) => {
  const p = path.join(rootUji, rel);
  mkdirSync(p, { recursive: true });
  writeFileSync(path.join(p, "f0001.png"), "x");
  utimesSync(p, new Date(mtimeMs), new Date(mtimeMs));
};
// tmp: lama harus terbuang, baru bertahan
buat("tmp/a-judul.txt", lama);
buat("tmp/b-part.txt", kini);
// cache aset folder: folder lama terbuang
buatFolder("neon/kunci-lama", lama);
buatFolder("neon/kunci-baru", kini);
// vokal-ai: 8 hari (ambang 7 hari) → terbuang
buat("vokal-ai/abcdef-vokal.f32", sangatLama);
buat("vokal-ai/abcdef-musik.f32", sangatLama);
// upload: masih muda → bertahan
buat("upload/video.mp4", kini);
const hapus = pangkasWork(rootUji, kini);
ok(hapus >= 3, "jumlah hapus ≥ 3 (tmp lama, neon lama, 2 stem)", hapus);
ok(!existsSync(path.join(rootUji, "tmp/a-judul.txt")), "tmp lama TERPANGKAS");
ok(existsSync(path.join(rootUji, "tmp/b-part.txt")), "tmp baru BERTAHAN");
ok(!existsSync(path.join(rootUji, "neon/kunci-lama")), "neon lama TERPANGKAS");
ok(existsSync(path.join(rootUji, "neon/kunci-baru")), "neon baru BERTAHAN");
ok(!existsSync(path.join(rootUji, "vokal-ai/abcdef-vokal.f32")), "stem vokal lama TERPANGKAS");
ok(existsSync(path.join(rootUji, "upload/video.mp4")), "upload muda BERTAHAN");
// throttle
resetThrottlePangkas();
ok(jadwalkanPangkas(kini) === true, "panggilan pertama jalan");
ok(jadwalkanPangkas(kini + 1000) === false, "panggilan kedua dalam 1 jam DITAHAN");
ok(jadwalkanPangkas(kini + JEDA_PANGKAS_MS + 1) === true, "setelah 1 jam jalan lagi");

console.log("== v0.58.0 — EVIKSI JOB LAMA ==");
// evictJobLama bekerja pada Map internal — uji via perilaku: dipanggil tanpa error
// & mengembalikan angka ≥ 0 (Map kosong pada uji)
const buang = evictJobLama(Date.now());
ok(typeof buang === "number" && buang >= 0, "evictJobLama aman pada Map kosong", buang);

console.log("== v0.58.0 — PATH AMAN ==");
ok(pathAman("tmp/x.txt").startsWith(ROOT_WORK), "path relatif di dalam work diterima");
let ditolak = false;
try {
  pathAman("/etc/passwd");
} catch {
  ditolak = true;
}
ok(ditolak, "path di luar work ditolak (mode non-Electron)");
let lolosTetangga = false;
try {
  // path yang BERAWALAN sama tapi folder berbeda (work-lain) harus ditolak
  pathAman(ROOT_WORK + "-lain/file.mp4");
} catch {
  lolosTetangga = true;
}
ok(lolosTetangga, "folder tetangga (work-lain) ditolak — bukan prefix buta");

console.log("== v0.58.0 — HITUNG PART DGN HAPUS (pemakaian PanelEkspor) ==");
// tanpa zona = rumus lama
const tanpaZona = hitungPartDgnHapus(45, 20, 0, 0, []);
ok(tanpaZona === 3, "45 dtk ÷ 20 = 3 part (tanpa zona)", tanpaZona);
// zona 10 dtk di tengah memperpendek total
const dgnZona = hitungPartDgnHapus(45, 20, 0, 0, [{ mulai: 15, akhir: 25 }]);
ok(dgnZona < tanpaZona, "zona hapus mengurangi jumlah part", dgnZona);

console.log("== v0.58.0 — BALAPAN WAKTU (jaring anti-hang dipakai AI) ==");
(async () => {
  const cepat = await balapanWaktu(Promise.resolve("hasil"), 1000);
  ok(cepat === "hasil", "janji cepat → hasil");
  const lambat = await balapanWaktu(
    new Promise<string>((ok2) => setTimeout(() => ok2("terlambat"), 300)),
    50,
  );
  ok(lambat === null, "janji melewati batas → null (dibatalkan dari luar)");
  let tertolak = false;
  try {
    await balapanWaktu(Promise.reject(new Error("x")), 1000);
  } catch {
    tertolak = true;
  }
  ok(tertolak, "janji tertolak → galat diteruskan (bukan null)");
  ok(kebabAssSub(60) === "0:01:00.00", "60 dtk → 0:01:00.00 (format 1-digit jam)");

  console.log(`\n=== HASIL: ${lolos}/${total} LOLOS ===`);
  if (lolos !== total) process.exit(1);
  // folder uji dibuang
  try {
    const { rmSync } = await import("node:fs");
    rmSync(rootUji, { recursive: true, force: true });
  } catch { /* abaikan */ }
})();
