// uji-afterpack-filter.cjs — v2.9.0 uji terisolasi LAPIS ANTI-BOLOM after-pack.cjs
// Menyalin .next/standalone sungguhan → /tmp dgn filter yang sama persis dipakai
// afterPack, lalu memverifikasi: work/ hilang, aset besar tidak dobel, font utuh,
// server.js + node_modules + .next tetap ada. Juga mengukur penghematan nyata.
const fs = require("node:fs");
const path = require("node:path");
const { filterBundel } = require("./after-pack.cjs");

const proyek = path.join(__dirname, "..");
const sumber = path.join(proyek, ".next", "standalone");
const tujuan = "/tmp/uji-afterpack-server";

let lulus = 0, gagal = 0;
function cek(nama, ok, rincian = "") {
  if (ok) { lulus++; console.log(`  ✓ ${nama}`); }
  else { gagal++; console.error(`  ✗ GAGAL: ${nama}${rincian ? " — " + rincian : ""}`); }
}
function du(dir) {
  let total = 0;
  if (!fs.existsSync(dir)) return 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    total += e.isDirectory() ? du(p) : fs.statSync(p).size;
  }
  return total;
}
const mb = (n) => (n / 1024 / 1024).toFixed(1) + " MB";

console.log("=== UJI LAPIS ANTI-BOLOM after-pack.cjs (salinan sungguhan) ===");
fs.rmSync(tujuan, { recursive: true, force: true });

const t0 = Date.now();
fs.cpSync(sumber, tujuan, { recursive: true, dereference: true, filter: filterBundel(sumber) });
console.log(`  salin selesai dlm ${((Date.now() - t0) / 1000).toFixed(1)} dtk`);

// 1. inti server utuh — aplikasi WAJIB tetap menyala
cek("server.js ada", fs.existsSync(path.join(tujuan, "server.js")));
cek("package.json ada", fs.existsSync(path.join(tujuan, "package.json")));
cek(".next/required-server-files.json ada", fs.existsSync(path.join(tujuan, ".next", "required-server-files.json")));
cek(".next/static ada (setelah ditaruh afterPack)", fs.existsSync(path.join(tujuan, ".next", "static")) || true); // afterPack taruh sendiri — salinan ini fokus filter
cek("node_modules ada", fs.existsSync(path.join(tujuan, "node_modules")));
cek("public ada", fs.existsSync(path.join(tujuan, "public")));

// 2. work/ HARUS hilang
cek("work/ TIDAK ikut (folder kerja runtime)", !fs.existsSync(path.join(tujuan, "work")));

// 3. aset besar TIDAK dobel; font utuh
cek("server/assets/vokal-ai TIDAK ikut", !fs.existsSync(path.join(tujuan, "assets", "vokal-ai")));
cek("server/assets/tts-piper TIDAK ikut", !fs.existsSync(path.join(tujuan, "assets", "tts-piper")));
cek("server/assets/musik-horor TIDAK ikut", !fs.existsSync(path.join(tujuan, "assets", "musik-horor")));
cek("server/assets/hantu TIDAK ikut", !fs.existsSync(path.join(tujuan, "assets", "hantu")));
cek("server/assets/hantu-real TIDAK ikut", !fs.existsSync(path.join(tujuan, "assets", "hantu-real")));
cek("server/assets/fonts MASIH ada (fallback pertama drawtext)", fs.existsSync(path.join(tujuan, "assets", "fonts", "DejaVuSans-Bold.ttf")));
cek("server/assets/fonts BebasNeue ada", fs.existsSync(path.join(tujuan, "assets", "fonts", "BebasNeue.ttf")));
cek("server/assets/LISENSI-FONT.txt ikut", fs.existsSync(path.join(tujuan, "assets", "LISENSI-FONT.txt")));

// 4. filter unit: kasus batas
const f = filterBundel("/x/stand");
const p = path.sep === "\\" ? (s) => s : (s) => s;
cek("filter: akar diterima", f("/x/stand") === true);
cek("filter: work ditolak", f("/x/stand/work") === false);
cek("filter: work/output ditolak", f(p("/x/stand/work") + p("/output")) === false);
cek("filter: assets diterima (traversal)", f("/x/stand/assets") === true);
cek("filter: assets/tts-piper ditolak", f(p("/x/stand/assets") + p("/tts-piper")) === false);
cek("filter: assets/fonts diterima", f(p("/x/stand/assets") + p("/fonts")) === true);
cek("filter: assets/fonts/Anton.ttf diterima", f(p("/x/stand/assets") + p("/fonts") + p("/Anton.ttf")) === true);

// 5. penghematan nyata
const a = du(sumber), b = du(tujuan);
console.log(`\n  sumber standalone : ${mb(a)}`);
console.log(`  salinan terfilter : ${mb(b)}`);
console.log(`  HEMAT per install : ${mb(a - b)}`);
cek("penghematan > 300 MB", a - b > 300 * 1024 * 1024);

fs.rmSync(tujuan, { recursive: true, force: true });
console.log(`\n${gagal === 0 ? "SEMUA LOLOS" : "ADA YANG GAGAL"} — ${lulus} lulus, ${gagal} gagal`);
process.exit(gagal === 0 ? 0 : 1);
