// Probe v0.52 — ukur cap-height & lebar teks "ALAM GAIB" font Creepster
// Jalankan: bun scripts/probe-font-v52.ts
import sharp from "sharp";

async function ukur(fs: number, teks: string, font: string) {
  const W = 2400;
  const H = 600;
  const baseline = 400;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<rect width="${W}" height="${H}" fill="black"/>` +
    `<text x="${W / 2}" y="${baseline}" text-anchor="middle" font-family="${font}" font-size="${fs}" fill="white">${teks}</text>` +
    `</svg>`;
  const buf = await sharp(Buffer.from(svg)).raw().toBuffer();
  const ch = 4;
  let atas = -1;
  let kiri = W;
  let kanan = -1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const a = buf[(y * W + x) * ch];
      if (a > 40) {
        if (atas < 0) atas = y;
        if (x < kiri) kiri = x;
        if (x > kanan) kanan = x;
      }
    }
  }
  const capH = baseline - atas;
  const lebar = kanan - kiri;
  console.log(
    `fs=${fs} font=${font} teks="${teks}" → capHeight=${capH} (rasio ${(capH / fs).toFixed(3)}em), lebar=${lebar} (rasio ${(lebar / fs).toFixed(3)}em)`,
  );
}

await ukur(100, "ALAM GAIB", "Creepster");
await ukur(150, "ALAM GAIB", "Creepster");
await ukur(100, "ALAM GAIB", "Cinzel Decorative");
