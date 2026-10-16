// e2e browser v0.54.0 — verifikasi UI: warna subtitle, warna bingkai (solid+gradasi),
// pratinjau API, simpan localStorage. Jalankan: node scripts/e2e-browser-v54.mjs
// (butuh server produksi jalan di :3000 + video uji work/uji-mini2.mp4)
import { chromium } from "playwright";

const KUNCI = "A$rama33";
let lolos = 0;
let gagal = 0;
function cek(nama, kondisi, detail = "") {
  if (kondisi) {
    lolos++;
    console.log(`  ✓ ${nama}`);
  } else {
    gagal++;
    console.error(`  ✗ GAGAL: ${nama} ${detail}`);
  }
}

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1600, height: 1000 } });
const p = await ctx.newPage();

await p.goto("http://localhost:3000");
await p.locator('input[type=password]').first().fill(KUNCI);
await p.getByRole("button", { name: "Buka VidSplit" }).click();
await p.waitForTimeout(1200);

// unggah video uji
await p.locator("input[type=file]").first().setInputFiles("work/uji-mini2.mp4");
await p.waitForTimeout(3500);

// pilih video #1 (aktifkan panel pengaturan)
await p.getByText("uji-mini2.mp4", { exact: false }).first().click();
await p.waitForTimeout(800);

// ---------- FRAME & BINGKAI: pilih frame horor ----------
await p.getByRole("button", { name: /Frame & bingkai/ }).first().click().catch(() => {});
await p.waitForTimeout(400);
const imgHoror = p.locator('img[alt*="alam gaib" i], img[src*="horor-alam-gaib-4"]').first();
const adaGrid = await imgHoror.count();
if (adaGrid > 0) {
  await imgHoror.click();
} else {
  // kartu grid pakai alt = label — cari via src
  await p.locator('img[src*="horor-alam-gaib-4-916"]').first().click();
}
await p.waitForTimeout(600);

// Warna bingkai → "Satu warna"
await p.getByRole("button", { name: "Satu warna" }).first().click();
await p.waitForTimeout(2500);
const srcSolid = await p.locator('img[alt="pratinjau frame berwarna"]').first().getAttribute("src");
cek("panel: pratinjau recolor solid memakai API", (srcSolid || "").includes("/api/bingkai-warna?"), srcSolid || "-");
cek("panel: param c1 terkirim", (srcSolid || "").includes("c1="), "-");
await p.screenshot({ path: "work/uji-warna/browser-solid.png" });

// Warna bingkai → "Gradasi"
await p.getByRole("button", { name: "Gradasi", exact: true }).first().click();
await p.waitForTimeout(2500);
const srcGrad = await p.locator('img[alt="pratinjau frame berwarna"]').first().getAttribute("src");
cek("panel: pratinjau gradasi membawa c1+c2", (srcGrad || "").includes("c1=") && (srcGrad || "").includes("c2="), srcGrad || "-");
await p.screenshot({ path: "work/uji-warna/browser-grad.png" });

// Kembali ke warna asli
await p.getByRole("button", { name: "Warna asli" }).first().click();
await p.waitForTimeout(1200);
const srcAsli = await p.locator('img[alt="pratinjau frame berwarna"]').count();
cek("panel: mode asli menyembunyikan pratinjau recolor", srcAsli === 0, `n=${srcAsli}`);

// ---------- SUBTITLE AI: warna ----------
await p.getByRole("button", { name: /Subtitle AI otomatis/ }).first().click().catch(() => {});
await p.waitForTimeout(400);
await p.getByRole("button", { name: /Buat subtitle otomatis/ }).first().click();
await p.waitForTimeout(600);
cek("subtitle: pilihan Warna teks ada", (await p.getByText("Warna teks", { exact: true }).count()) > 0);
cek("subtitle: pilihan Warna outline ada", (await p.getByText("Warna outline", { exact: true }).count()) > 0);
const jumlahColor = await p.locator('input[type=color]').count();
cek("subtitle: input warna tersedia (≥6: 3 gaya teks ×2 + subtitle ×2)", jumlahColor >= 8, `n=${jumlahColor}`);
await p.screenshot({ path: "work/uji-warna/browser-sub.png" });

// ---------- persistensi localStorage ----------
const simpanan = await p.evaluate(() => localStorage.getItem("vidsplit-pengaturan-v1") || localStorage.getItem("vidsplit-pengaturan") || Object.keys(localStorage).filter((k) => k.startsWith("vidsplit")).map((k) => `${k}=${localStorage.getItem(k)}`).join(" | "));
cek("localStorage: frameWarna2 tersimpan", (simpanan || "").includes('"frameWarna2"'), (simpanan || "").slice(0, 120));

console.log(`\n=== e2e browser v54: ${lolos} LULUS, ${gagal} GAGAL ===`);
await b.close();
process.exit(gagal > 0 ? 1 : 0);
