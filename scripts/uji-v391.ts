/**
 * UJI v3.9.1 — FOLDER OUTPUT APLIKASI TIDAK LAGI MENYIMPAN SALINAN
 * (keluhan user: hasil masih muncul di C:\...\vidsplit\data\output padahal
 * folder tujuan sudah dipilih — v3.8.0 membuat salinan dgn bawaan bersihkanKerja=false).
 * 1. Bawaan baru bersihkanKerja = TRUE.
 * 2. Migrasi setelan lama TANPA penanda v:2 (bersihkanKerja false = bawaan lama,
 *    bukan pilihan) → menjadi true + file ditulis ulang dgn penanda v:2.
 * 3. File v:2 (pilihan user) DIPATUHI: false tetap false, true tetap true.
 * 4. buangSalinanKerja menghapus berkas + folder job + folder output (bila kosong).
 * 5. bersihkanFolderOutputLama: folder lama (>10 mnt) & berkas lepas tua dihapus;
 *    folder baru (job berjalan) AMAN.
 * 6. salinHasilKeTujuan + buangSalinanKerja E2E: tersalin terverifikasi → salinan
 *    kerja hilang (data\output bersih).
 * Pola: kasus berjalan dlm proses anak dgn VIDSPLIT_WORK sendiri (cache & file isolat).
 */
import { spawnSync } from "node:child_process";
import path from "node:path";

let lolos = 0, gagal = 0;
function cek(nama: string, syarat: boolean, konteks?: unknown) {
  if (syarat) { lolos++; console.log(`  LOLOS  ${nama} ✓`); }
  else { gagal++; console.error(`  GAGAL  ${nama}${konteks !== undefined ? " :: " + JSON.stringify(konteks).slice(0, 300) : ""}`); }
}

const KASUS: Record<string, () => Promise<void>> = {
  async bawaan() {
    const { muatSetelanTujuan, setelanTujuanDefault } = await import("../src/lib/vidsplit/tujuan");
    const s = muatSetelanTujuan();
    cek("bawaan bersihkanKerja = TRUE (folder output tak menumpuk)", s.bersihkanKerja === true, s);
    cek("bawaan folder null", s.folder === null, s);
    cek("bawaan otomatis true", s.otomatis === true, s);
    cek("konstanta default juga true", setelanTujuanDefault.bersihkanKerja === true);
  },
  async migrasiLama() {
    const { writeFileSync, readFileSync } = await import("node:fs");
    const { dirWork } = await import("../src/lib/vidsplit/ffmpeg");
    writeFileSync(path.join(dirWork(""), "folder-tujuan.json"),
      JSON.stringify({ folder: "D:\\Hasil Split", otomatis: true, bersihkanKerja: false }), "utf8");
    const { muatSetelanTujuan } = await import("../src/lib/vidsplit/tujuan");
    const s = muatSetelanTujuan();
    cek("setelan lama tanpa penanda → bersihkanKerja MIGRASI ke true", s.bersihkanKerja === true, s);
    cek("folder & otomatis tetap", s.folder === "D:\\Hasil Split" && s.otomatis === true, s);
    const kembali = JSON.parse(readFileSync(path.join(dirWork(""), "folder-tujuan.json"), "utf8"));
    cek("file ditulis ulang dgn penanda v:2", kembali.v === 2 && kembali.bersihkanKerja === true, kembali);
  },
  async pilihanUserDipatuhi() {
    const { writeFileSync } = await import("node:fs");
    const { dirWork } = await import("../src/lib/vidsplit/ffmpeg");
    const { muatSetelanTujuan } = await import("../src/lib/vidsplit/tujuan");
    writeFileSync(path.join(dirWork(""), "folder-tujuan.json"),
      JSON.stringify({ v: 2, folder: "E:\\Video", otomatis: true, bersihkanKerja: false }), "utf8");
    cek("file v:2 false (pilihan user) TETAP false", muatSetelanTujuan().bersihkanKerja === false);
    const { resetCacheUji } = await import("../src/lib/vidsplit/tujuan");
    resetCacheUji();
    writeFileSync(path.join(dirWork(""), "folder-tujuan.json"),
      JSON.stringify({ v: 2, folder: "E:\\Video", otomatis: true, bersihkanKerja: true }), "utf8");
    cek("file v:2 true tetap true", muatSetelanTujuan().bersihkanKerja === true);
  },
  async buangSalinan() {
    const { mkdirSync, writeFileSync, existsSync } = await import("node:fs");
    const { dirWork } = await import("../src/lib/vidsplit/ffmpeg");
    const { buangSalinanKerja } = await import("../src/lib/vidsplit/tujuan");
    const jobDir = path.join(dirWork("output"), "job-uji");
    mkdirSync(jobDir, { recursive: true });
    writeFileSync(path.join(jobDir, "part-01.mp4"), "x".repeat(100));
    writeFileSync(path.join(jobDir, "part-01-thumb.jpg"), "y".repeat(10));
    buangSalinanKerja(jobUji());
    cek("folder job terhapus", !existsSync(jobDir));
    cek("folder output aplikasi ikut terhapus (kosong)", !existsSync(dirWork("output")));
    function jobUji() {
      return { id: "job-uji", outputs: [{ video: "v", file: "part-01.mp4", ukuran: 100 }, { video: "v", file: "part-01-thumb.jpg", ukuran: 10 }] };
    }
  },
  async bersihLama() {
    const { mkdirSync, writeFileSync, existsSync, utimesSync } = await import("node:fs");
    const { dirWork } = await import("../src/lib/vidsplit/ffmpeg");
    const { bersihkanFolderOutputLama } = await import("../src/lib/vidsplit/tujuan");
    const akar = dirWork("output");
    const lama = path.join(akar, "job-lama");
    const baru = path.join(akar, "job-baru");
    mkdirSync(lama, { recursive: true });
    mkdirSync(baru, { recursive: true });
    writeFileSync(path.join(lama, "part-01.mp4"), "a".repeat(2048));
    writeFileSync(path.join(baru, "part-01.mp4"), "b".repeat(512));
    writeFileSync(path.join(akar, "berkas-lepas.mp4"), "c".repeat(100));
    const tua = new Date(Date.now() - 30 * 60_000);
    utimesSync(lama, tua, tua);
    utimesSync(path.join(akar, "berkas-lepas.mp4"), tua, tua);
    const hasil = bersihkanFolderOutputLama(10);
    cek("folder lama terhapus", !existsSync(lama), hasil);
    cek("folder baru (job berjalan) AMAN", existsSync(baru));
    cek("berkas lepas tua terhapus", !existsSync(path.join(akar, "berkas-lepas.mp4")));
    cek("statistik: 1 folder, 2 berkas, 2148 byte",
      hasil.folder === 1 && hasil.berkas === 2 && hasil.byte === 2048 + 100, hasil);
  },
  async salinE2E() {
    const { mkdirSync, writeFileSync, existsSync } = await import("node:fs");
    const { dirWork } = await import("../src/lib/vidsplit/ffmpeg");
    const { salinHasilKeTujuan, buangSalinanKerja } = await import("../src/lib/vidsplit/tujuan");
    const jobDir = path.join(dirWork("output"), "job-e2e");
    mkdirSync(jobDir, { recursive: true });
    writeFileSync(path.join(jobDir, "hasil-part-01.mp4"), "d".repeat(4096));
    const tujuan = path.join(dirWork("tujuan-e2e"));
    const r = await salinHasilKeTujuan(
      { id: "job-e2e", outputs: [{ video: "Film.mp4", file: "hasil-part-01.mp4", ukuran: 4096 }], antrean: [{ nama: "Film.mp4" } as never] },
      tujuan,
    );
    cek("tersalin tanpa gagal", r.gagal.length === 0, r);
    const fileTujuan = path.join(r.folder, "hasil-part-01.mp4");
    cek("file ada di folder tujuan", existsSync(fileTujuan));
    buangSalinanKerja({ id: "job-e2e", outputs: [{ video: "Film.mp4", file: "hasil-part-01.mp4", ukuran: 4096 }] });
    cek("salinan kerja dihilangkan — data\\output bersih", !existsSync(jobDir));
    cek("hasil tetap utuh di folder tujuan", existsSync(fileTujuan));
  },
};

async function main() {
const kasus = process.argv[2];
if (kasus && KASUS[kasus]) {
  await KASUS[kasus]();
  process.exit(0);
}

// ——— induk: jalankan tiap kasus dlm proses anak dgn work isolat ———
console.log("— v3.9.1: folder output aplikasi tidak menyimpan salinan —");
for (const nama of Object.keys(KASUS)) {
  const work = path.join("/tmp", `uji-v391-${nama}`);
  const r = spawnSync("npx", ["tsx", __filename, nama], {
    encoding: "utf8",
    timeout: 120_000,
    env: { ...process.env, VIDSPLIT_WORK: work },
  });
  const baris = (r.stdout || "").trim();
  const semuaLolos = baris.includes("LOLOS") && !baris.includes("GAGAL") && r.status === 0;
  if (semuaLolos) {
    lolos += (baris.match(/LOLOS/g) || []).length;
    console.log(`  LOLOS  kasus ${nama} (${(baris.match(/LOLOS/g) || []).length} cek) ✓`);
  } else {
    gagal++;
    console.error(`  GAGAL  kasus ${nama} (status ${r.status})\n${baris || r.stderr}\n`);
  }
}

console.log(`\nHASIL: ${lolos} lolos, ${gagal} gagal`);
process.exit(gagal ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
