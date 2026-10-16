// VidSplit v0.54.0 — uji RECOLOR BINGKAI (warna solid + gradasi, TANPA ubah bentuk)
// Permintaan user: "opsi untuk merubah warna frame yang sudah ada tanpa merubah
// bentuk frame nya hanya warnanya saja dan berikan juga opsi warna gradasi".
//
// Yang diuji (ffmpeg SUNGGUHAN — rantai filter yang persis dipakai ekspor):
//   1) rantaiRecolorBingkai + argGradienBingkai → PNG hasil valid
//   2) warna SOLID: piksel terang frame bergeser ke target (R/G/B sesuai warna),
//      piksel gelap tetap gelap, alpha transparan TENGAH tetap 0 (bentuk utuh)
//   3) warna GRADASI: zona atas condong warna-1, zona bawah condong warna-2
//   4) hexKeFf: valid/salah
//   5) cache: panggilan ke-2 instan (berkas sama, tidak re-render — mtime sama)
// Jalankan: bun scripts/uji-warna-bingkai.ts
import { existsSync, statSync } from "node:fs";
import path from "node:path";
import {
  argGradienBingkai,
  hexKeFf,
  jalurAsalBawaan,
  rantaiRecolorBingkai,
  siapkanBingkaiWarna,
} from "../src/lib/vidsplit/bingkai";
import { jalankanFfmpeg, pilihFfmpeg } from "../src/lib/vidsplit/ffmpeg";

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

type Px = { r: number; g: number; b: number; a: number };
async function rataZona(
  file: string,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  hanyaTerang = true,
): Promise<{ n: number; r: number; g: number; b: number; a: number }> {
  const sharp = (await import("sharp")).default;
  const { data, info } = await sharp(file)
    .ensureAlpha()
    .extract({ left: x0, top: y0, width: x1 - x0, height: y1 - y0 })
    .raw()
    .toBuffer({ resolveWithObject: true });
  let n = 0;
  let r = 0;
  let g = 0;
  let b = 0;
  let a = 0;
  for (let i = 0; i < data.length; i += 4) {
    const al = data[i + 3];
    const maks = Math.max(data[i], data[i + 1], data[i + 2]);
    if (al < 200) continue;
    // hasil recolor berwarna pekat bisa ber-LUMA rendah (merah 0xff3366 luma ±117)
    // — pakai kanal maksimum supaya piksel berwarna tetap terhitung
    if (hanyaTerang && maks < 120) continue;
    n++;
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
    a += al;
  }
  void info;
  return { n, r: r / (n || 1), g: g / (n || 1), b: b / (n || 1), a: a / (n || 1) };
}

async function pikselTunggal(file: string, x: number, y: number): Promise<Px> {
  const sharp = (await import("sharp")).default;
  const { data } = await sharp(file).ensureAlpha().extract({ left: x, top: y, width: 1, height: 1 }).raw().toBuffer({ resolveWithObject: true });
  return { r: data[0], g: data[1], b: data[2], a: data[3] };
}

// ---------- 1. fungsi murni ----------
ok(hexKeFf("#FF3366") === "0xff3366", "hexKeFf: #FF3366 → 0xff3366");
ok(hexKeFf("#abc") === null, "hexKeFf: salah format → null");
ok(hexKeFf("") === null, "hexKeFf: kosong → null");
ok(rantaiRecolorBingkai().includes("alphamerge"), "rantai: alpha digabung kembali");
ok(rantaiRecolorBingkai().includes("colorchannelmixer"), "rantai: luminance rgb (bukan gray)");
ok(
  argGradienBingkai("0xaabbcc", "", 1080, 1920).includes("geq=r='170+(0)*") &&
    argGradienBingkai("0xaabbcc", "", 1080, 1920).includes("b='204+(0)*"),
  "gradien: c2 kosong = solid (kanal tak berubah)",
);
ok(
  argGradienBingkai("0xaabbcc", "0x112233", 1080, 1920).includes("r='170+(-153)*(Y/(H-1))'") &&
    argGradienBingkai("0xaabbcc", "0x112233", 1080, 1920).includes("g='187+(-153)*") &&
    argGradienBingkai("0xaabbcc", "0x112233", 1080, 1920).includes("b='204+(-153)*"),
  "gradien: c2 terpasang (rumus atas→bawah)",
);

// ---------- 2-3. render sungguhan ----------
const ff = await pilihFfmpeg();
const asal = jalurAsalBawaan("horor-alam-gaib-3", false);
if (!asal) {
  ok(false, "frame sumber horor-alam-gaib-3-916 ada");
} else {
  const dir = path.join(process.cwd(), "work", "uji-warna");
  const solid = path.join(dir, "uji-solid.png");
  const grad = path.join(dir, "uji-grad.png");
  await jalankanFfmpeg(
    ["-y", "-hide_banner", "-v", "error", "-i", asal,
     "-f", "lavfi", "-i", argGradienBingkai("0xff3366", "", 1080, 1920),
     "-frames:v", "1", "-filter_complex", rantaiRecolorBingkai(), "-map", "[out]", solid],
    0, undefined, ff.bin, undefined, { diamMs: 20_000, absolutMs: 60_000 },
  );
  await jalankanFfmpeg(
    ["-y", "-hide_banner", "-v", "error", "-i", asal,
     "-f", "lavfi", "-i", argGradienBingkai("0x22ccee", "0xffaa22", 1080, 1920),
     "-frames:v", "1", "-filter_complex", rantaiRecolorBingkai(), "-map", "[out]", grad],
    0, undefined, ff.bin, undefined, { diamMs: 20_000, absolutMs: 60_000 },
  );
  ok(existsSync(solid), "render solid: berkas dibuat");
  ok(existsSync(grad), "render gradasi: berkas dibuat");

  // SOLID — piksel terang teks "ALAM GAIB" (y 34–146) jadi merah-pink 0xff3366
  const at = await rataZona(solid, 270, 40, 810, 150);
  ok(at.n > 500, `solid: piksel terang ada (n=${at.n})`);
  ok(at.r > at.g * 1.6, `solid: merah dominan (R ${at.r.toFixed(0)} vs G ${at.g.toFixed(0)})`);
  ok(at.b > at.g, `solid: biru > hijau utk 0xff3366 (B ${at.b.toFixed(0)} vs G ${at.g.toFixed(0)})`);

  // BENTUK UTUH — alpha piksel yang tadinya terang tetap 255; tengah tetap transparan
  const pxTeks = await pikselTunggal(solid, 540, 210);
  const pxTengah = await pikselTunggal(solid, 540, 960);
  ok(pxTengah.a === 0, `bentuk: tengah tetap transparan (alpha ${pxTengah.a})`);
  ok(pxTeks.a > 200 || pxTeks.r + pxTeks.g + pxTeks.b === 0, "bentuk: alpha zona teks utuh");

  // GRADASI — teks atas condong cyan (G&B tinggi vs R), hiasan pita bawah condong oranye
  const atas = await rataZona(grad, 270, 40, 810, 150);
  const bawah = await rataZona(grad, 40, 1780, 1040, 1900);
  ok(atas.n > 300 && bawah.n > 100, `gradasi: kedua zona terukur (atas n=${atas.n}, bawah n=${bawah.n})`);
  ok(atas.g > atas.r, `gradasi: atas condong cyan (G ${atas.g.toFixed(0)} > R ${atas.r.toFixed(0)})`);
  ok(bawah.r > bawah.b * 1.3, `gradasi: bawah condong oranye (R ${bawah.r.toFixed(0)} > B ${bawah.b.toFixed(0)})`);

  // ---------- 5. siapkanBingkaiWarna: cache + fallback ----------
  const hasil1 = await siapkanBingkaiWarna(asal, "#3366ff", "", ff.bin);
  ok(hasil1 !== asal && existsSync(hasil1), "siapkanBingkaiWarna: menghasilkan PNG cache");
  const m1 = statSync(hasil1).mtimeMs;
  const hasil2 = await siapkanBingkaiWarna(asal, "#3366ff", "", ff.bin);
  ok(hasil2 === hasil1 && statSync(hasil2).mtimeMs === m1, "cache: panggilan ke-2 memakai berkas sama");
  const asli = await siapkanBingkaiWarna(asal, "", "", ff.bin);
  ok(asli === asal, "warna kosong → frame asli (tanpa recolor)");
  const salah = await siapkanBingkaiWarna(asal, "merah-muda", "", ff.bin);
  ok(salah === asal, "hex salah → frame asli (tak pernah gagalkan ekspor)");
}

console.log(`\n${lolos}/${total} uji LOLOS`);
if (lolos !== total) process.exit(1);
console.log("=== SEMUA UJI WARNA BINGKAI LOLOS ===");
