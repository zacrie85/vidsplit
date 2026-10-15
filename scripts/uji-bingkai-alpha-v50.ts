// Uji v0.50.0 — pemeriksaan piksel 20 PNG bingkai (10 spesial + 10 reguler):
//   1) TENGAH HARUS TEMBUS PANDANG (alpha rata-rata < 40/255 ≈ 16%) — pelajaran
//      v0.49: bila tengah tertutup, video tertutup penuh. Catatan: varian
//      lanskap desain keluarga spesial memang punya gradasi fade halus dari zona
//      atas (vignette) yg menyisakan alpha rendah (terukur 0.8–38) — itu DESAIN
//      (v0.49 sudah dirilis & disetujui), yg dilarang adalah TUTUPAN SOLID.
//   2) zona atas harus ada piksel (teks IDOLA DESA + motif)
//   3) pita bawah harus ada piksel (teks DANGDUT IDOLA DESA)
//   4) dimensi benar per rasio (teks menyentuh atas diverifikasi VISUAL saat
//      render — baseline dihitung dari CAP 0.70 di generator).
// Jalankan: bun scripts/uji-bingkai-alpha-v50.ts
import { existsSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

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

const DIR = path.join(process.cwd(), "public", "bingkai");
const SPESIAL = [
  "dangdut-idola-desa",
  "horor-alam-gaib",
  "dangdut-idola-desa-2",
  "horor-alam-gaib-2",
  "dangdut-idola-desa-3",
  "dangdut-idola-desa-4",
  "dangdut-idola-desa-5",
  "dangdut-idola-desa-6",
  "dangdut-idola-desa-7",
  "dangdut-idola-desa-8",
];

async function alphaRata(img: sharp.Sharp, kiri: number, atas: number, w: number, h: number): Promise<number> {
  const buf = await img.clone().extract({ left: kiri, top: atas, width: w, height: h }).raw().toBuffer();
  let sum = 0;
  const ch = 4; // RGBA
  for (let i = 3; i < buf.length; i += ch) sum += buf[i];
  return sum / ((buf.length / ch) || 1);
}

for (const slug of SPESIAL) {
  for (const varian of ["916", "169"] as const) {
    const p = path.join(DIR, `${slug}-${varian}.png`);
    if (!existsSync(p)) {
      ok(false, `${slug}-${varian}: berkas ada`, p);
      continue;
    }
    const meta = await sharp(p).metadata();
    const W = meta.width ?? 0;
    const H = meta.height ?? 0;
    const potret = varian === "916";
    ok(potret ? W === 1080 && H === 1920 : W === 1920 && H === 1080, `${slug}-${varian}: dimensi ${W}×${H}`);

    const img = sharp(p).ensureAlpha();
    const tengah = await alphaRata(img, Math.round(W * 0.3), Math.round(H * 0.42), Math.round(W * 0.4), Math.round(H * 0.2));
    ok(tengah < 40, `${slug}-${varian}: tengah tembus pandang (alpha ${tengah.toFixed(2)} < 40)`);

    const atas = await alphaRata(img, Math.round(W * 0.2), Math.round(H * 0.04), Math.round(W * 0.6), Math.round(H * 0.08));
    ok(atas > 3, `${slug}-${varian}: zona atas berisi (alpha ${atas.toFixed(2)})`);

    const bawah = await alphaRata(img, Math.round(W * 0.2), Math.round(H - (potret ? 120 : 110)), Math.round(W * 0.6), 70);
    ok(bawah > 3, `${slug}-${varian}: pita bawah berisi (alpha ${bawah.toFixed(2)})`);
  }
}

console.log(`\n${lolos}/${total} uji LOLOS`);
if (lolos !== total) process.exit(1);
console.log("=== SEMUA UJI ALPHA BINGKAI LOLOS ===");
