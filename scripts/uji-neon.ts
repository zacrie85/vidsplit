// Uji unit v0.46.0 — FRAME NEON BERPUTAR (neonLayar.ts):
//   (a) palet 7 warna lengkap + rainbow berbeda antar progres
//   (b) geometri titikDi kontinu (tanpa lompatan) & menyatu di s=0 ≈ s=perim
//   (c) generator SVG: tanpa NaN, ada 3 lapis, dua garis = 2 komet
//   (d) rencanaSequence clamp (0.2× & 3×) dan lapDetik
//   (e) rapikanNeon clamp semua field
// Jalankan: bun scripts/uji-neon.ts
import {
  DAFTAR_WARNA_NEON,
  PALET_NEON,
  buatPathBulat,
  kunciCacheNeon,
  lapDetik,
  rapikanNeon,
  rencanaSequence,
  svgFrameNeon,
  titikDi,
  NEON_BAWAAN,
  type SetelanNeon,
} from "../src/lib/vidsplit/neonLayar";

let lolos = 0;
let gagal = 0;
function ok(kondisi: boolean, nama: string, detail = "") {
  if (kondisi) {
    lolos++;
  } else {
    gagal++;
    console.error(`  ✗ ${nama}${detail ? ` — ${detail}` : ""}`);
  }
}

/* (a) palet */
ok(DAFTAR_WARNA_NEON.length === 7, "7 warna tersedia");
for (const w of DAFTAR_WARNA_NEON) {
  const p = PALET_NEON[w];
  ok(!!p.label && !!p.inti, `palet ${w} punya label & inti`);
  if (w !== "rainbow") ok(!!p.dasar && !!p.glow, `palet ${w} punya dasar & glow`);
}
ok(PALET_NEON.rainbow.dasar === "", "rainbow tanpa warna dasar tetap (per segmen)");

/* (b) geometri */
const pth = buatPathBulat(1000, 1800);
ok(Math.abs(pth.perim - (2 * (1000 + 1800) - 8 * pth.r + 2 * Math.PI * pth.r)) < 0.01, "perim rumus benar");
// kontinuitas: jarak antar langkah kecil seluruh keliling
let maksLompatan = 0;
const langkah = pth.perim / 720;
for (let i = 0; i < 720; i++) {
  const a = titikDi(pth, i * langkah);
  const b = titikDi(pth, (i + 1) * langkah);
  const jarak = Math.hypot(b.x - a.x, b.y - a.y);
  if (jarak > maksLompatan) maksLompatan = jarak;
}
ok(maksLompatan < langkah * 2.5, "titikDi kontinu (tanpa lompatan)", `maks=${maksLompatan.toFixed(2)}`);
const t0 = titikDi(pth, 0);
const tEnd = titikDi(pth, pth.perim - 0.001);
ok(Math.hypot(t0.x - tEnd.x, t0.y - tEnd.y) < 2, "s=0 ≈ s=perim (lingkaran tertutup)");
const tTop = titikDi(pth, 0);
ok(Math.abs(tTop.y - 0) < 0.5 && Math.abs(tTop.x - 500) < 0.5, "mulai di tengah-atas");
// keempat sudut dilalui: titik dekat (w,0), (w,h), (0,h), (0,0) ada di lintasan
const dekat = (x: number, y: number, px: number, py: number, tol: number) =>
  Math.hypot(x - px, y - py) <= tol;
let kunjung = { tr: 0, br: 0, bl: 0, tl: 0 };
for (let i = 0; i < 2000; i++) {
  const t = titikDi(pth, (i / 2000) * pth.perim);
  if (dekat(t.x, t.y, 1000, 0, pth.r * 1.1)) kunjung.tr++;
  if (dekat(t.x, t.y, 1000, 1800, pth.r * 1.1)) kunjung.br++;
  if (dekat(t.x, t.y, 0, 1800, pth.r * 1.1)) kunjung.bl++;
  if (dekat(t.x, t.y, 0, 0, pth.r * 1.1)) kunjung.tl++;
}
ok(kunjung.tr > 0 && kunjung.br > 0 && kunjung.bl > 0 && kunjung.tl > 0, "lintasan menembus 4 sudut");

/* (c) generator SVG */
const setelan: SetelanNeon = { aktif: true, warna: "cyan", tebal: 6, kecepatan: 1, duaGaris: false };
const svg1 = svgFrameNeon({ W: 1080, H: 1920, setelan, progres: 0.25 });
ok(!svg1.includes("NaN"), "SVG tanpa NaN");
ok(svg1.startsWith("<svg") && svg1.endsWith("</svg>"), "SVG bentuk valid");
ok(svg1.includes("feGaussianBlur"), "SVG pakai blur (glow)");
ok((svg1.match(/<path /g) || []).length >= 48, "cukup segmen komet (≥48 path)", String((svg1.match(/<path /g) || []).length));
const svgDua = svgFrameNeon({
  W: 1080,
  H: 1920,
  setelan: { ...setelan, duaGaris: true },
  progres: 0.25,
});
ok(
  (svgDua.match(/<path /g) || []).length >= (svg1.match(/<path /g) || []).length * 1.9,
  "dua garis ≈ 2× segmen",
);
const svgRainbow1 = svgFrameNeon({
  W: 1080,
  H: 1920,
  setelan: { ...setelan, warna: "rainbow" },
  progres: 0.1,
});
const svgRainbow2 = svgFrameNeon({
  W: 1080,
  H: 1920,
  setelan: { ...setelan, warna: "rainbow" },
  progres: 0.6,
});
ok(svgRainbow1 !== svgRainbow2, "rainbow berubah seiring waktu");
ok(/#[0-9a-f]{6}/i.test(svgRainbow1), "rainbow memakai hex hsl→hex");

/* (d) rencanaSequence */
ok(Math.abs(lapDetik(1) - 6) < 1e-9, "1× = 6 dtk/putaran");
ok(Math.abs(lapDetik(3) - 2) < 1e-9, "3× = 2 dtk");
ok(Math.abs(lapDetik(0.2) - 30) < 1e-9, "0.2× = 30 dtk");
const rLambat = rencanaSequence(0.2);
ok(rLambat.jumlah <= 400, "0.2× ≤ 400 frame", String(rLambat.jumlah));
const rCepat = rencanaSequence(3);
ok(rCepat.jumlah >= 24, "3× ≥ 24 frame", String(rCepat.jumlah));
ok(rCepat.fps >= 15 && rCepat.fps <= 25, "fps clamp 15–25", String(rCepat.fps));

/* (e) rapikanNeon */
const kacau = rapikanNeon({ aktif: 1 as unknown as boolean, warna: "ungu" as never, tebal: 99, kecepatan: 22, duaGaris: "ya" as never });
ok(kacau.warna === "cyan", "warna tak dikenal → cyan");
ok(kacau.tebal === 16, "tebal clamp 16", String(kacau.tebal));
ok(kacau.kecepatan === 3, "kecepatan clamp 3", String(kacau.kecepatan));
ok(kacau.aktif === true && kacau.duaGaris === true, "truthy → true");
const kosong = rapikanNeon(undefined);
ok(JSON.stringify(kosong) === JSON.stringify(NEON_BAWAAN), "undefined → bawaan");

/* (f) v0.48.0 — CINCIN PENUH TERANG: keluhan user "garis hanya ada di sisi
 * sebelah saja, bawah & kiri tidak ada" — cincin dasar WAJIB terang penuh
 * (bukan samar 0.26) di KEEMPAT sisi, semua rasio & semua warna. */
for (const rasio of [
  { nama: "9:16", W: 1080, H: 1920 },
  { nama: "16:9", W: 1920, H: 1080 },
]) {
  for (const warna of ["cyan", "amber", "rainbow"] as const) {
    for (const progres of [0, 0.13, 0.5, 0.79]) {
      const svg = svgFrameNeon({ W: rasio.W, H: rasio.H, setelan: { ...NEON_BAWAAN, aktif: true, warna }, progres });
      const m = NEON_BAWAAN.tebal * (Math.min(rasio.W, rasio.H) / 1080) * 3.6 + 12;
      // cincin badan: lebar = tebal, blur g2; opasitas ~1 (rainbow 0.98, solid 1)
      const tebalPx = NEON_BAWAAN.tebal * (Math.min(rasio.W, rasio.H) / 1080);
      const badan =
        warna === "rainbow"
          ? `stroke-width="${tebalPx.toFixed(2)}" opacity="0.98" filter="url(#g2)"`
          : `stroke-width="${tebalPx.toFixed(2)}" opacity="1" filter="url(#g2)"`;
      ok(svg.includes(badan), `cincin badan penuh ${rasio.nama} ${warna} p${progres}`);
      // 3 lapis cincin ada (glow + badan + inti) = 3 path dPathBulat
      const hitung = (svg.match(/<path d="M \d/g) || []).length; // path bulat utama
      ok(hitung >= 3, `3 lapis cincin ${rasio.nama} ${warna} p${progres}`, String(hitung));
      ok(svg.includes(`translate(${m.toFixed(2)}`), `margin translate ${rasio.nama} p${progres}`);
      ok(!svg.includes("NaN"), `SVG tanpa NaN ${rasio.nama} ${warna} p${progres}`);
    }
  }
}
// kunci cache naik ke v48 (cache lama bingkai samar tak boleh terpakai)
ok(kunciCacheNeon(540, 960, NEON_BAWAAN).endsWith("v48"), "kunciCacheNeon v48");
ok(svgFrameNeon({ W: 1080, H: 1920, setelan: { ...NEON_BAWAAN, aktif: true }, progres: 0 }).includes('opacity="1" filter="url(#g2)"'), "cincin badan opasitas penuh (terang)");

console.log(`\n=== uji-neon: ${lolos} LOLOS, ${gagal} GAGAL ===`);
if (gagal > 0) process.exit(1);
