// Uji unit v0.42.0 — pembungkus teks (bungkus.ts): perbaikan bug "font besar
// terpotong kiri-kanan di hasil ekspor" — teks kini dilipat sama seperti pratinjau.
// Jalankan: bun scripts/uji-bungkus.ts
import { bungkusTeks, bungkusTeksRender, teksSiapGambar, skalaTeksRender, BATAS_LEBAR_TEKS } from "../src/lib/vidsplit/bungkus";
import { pengaturanDefault, type Pengaturan } from "../src/lib/vidsplit/types";

let jumlah = 0;
let gagal = 0;
function cek(kondisi: boolean, pesan: string, detail = "") {
  jumlah += 1;
  if (kondisi) console.log(`  ✓ ${pesan}`);
  else {
    gagal += 1;
    console.error(`  ✗ ${pesan}${detail ? ` — ${detail}` : ""}`);
  }
}

console.log("════ bungkusTeks — dasar ════");
{
  cek(bungkusTeks("", 1000, 23, "cinzeldec") === "", "teks kosong tetap kosong");
  cek(bungkusTeks("Halo", 1000, 23, "cinzeldec") === "Halo", "teks pendek tidak berubah");
  // lebar/ukuran tak valid → apa adanya (pengaman)
  cek(bungkusTeks("Halo dunia", 0, 23, "cinzeldec") === "Halo dunia", "lebar 0 → tanpa lipat");
  cek(bungkusTeks("Halo dunia", -5, 23, "cinzeldec") === "Halo dunia", "lebar negatif → tanpa lipat");
  cek(bungkusTeks("Halo dunia", 1000, NaN, "cinzeldec") === "Halo dunia", "ukuran NaN → tanpa lipat");
  cek(bungkusTeks("Halo dunia", Infinity, 23, "cinzeldec") === "Halo dunia", "lebar Infinity → tanpa lipat");
  // input tidak diubah (murni)
  const masuk = "kalimat pertama\nkalimat kedua";
  bungkusTeks(masuk, 200, 23, "anton");
  cek(masuk === "kalimat pertama\nkalimat kedua", "input tidak diubah (murni)");
}

console.log("════ bungkusTeks — lipat kata ════");
{
  // budget 240px, font 23px, faktor anton 0.54×1.06 → ~18 karakter per baris
  const teks = "kata satu kata dua kata tiga kata empat kata lima";
  const hasil = bungkusTeks(teks, 240, 23, "anton");
  const baris = hasil.split("\n");
  cek(baris.length > 1, `teks panjang terlipat jadi ${baris.length} baris`);
  cek(hasil.replace(/\n/g, " ").split(/\s+/).join(" ") === teks.split(/\s+/).join(" "), "semua kata utuh & berurutan");
  // tiap baris muat dalam budget
  const faktor = 0.54 * 1.06;
  const terlampaui = baris.filter((b) => b.length * faktor * 23 > 240 + 0.001);
  cek(terlampaui.length === 0, "tiap baris ≤ budget lebar", terlampaui.join("|"));
  // greedy: baris selain terakhir tidak bisa menampung kata pertama baris berikutnya
  cek(!hasil.includes("  "), "tidak ada spasi ganda sisa lipatan");
}

console.log("════ bungkusTeks — baris baru buatan user ════");
{
  const hasil = bungkusTeks("baris pertama pendek\nbaris kedua juga pendek", 10000, 23, "anton");
  cek(hasil === "baris pertama pendek\nbaris kedua juga pendek", "\\n user dipertahankan (muat lega)");
  const hasil2 = bungkusTeks("satu\ndua\ntiga", 60, 23, "anton");
  cek(hasil2.split("\n").length >= 3, "\\n user tetap walau lipatan tambahan");
  const kosong = bungkusTeks("atas\n\nbawah", 10000, 23, "anton");
  cek(kosong === "atas\n\nbawah", "baris kosong di tengah dipertahankan");
}

console.log("════ bungkusTeks — kata super panjang dipotong keras ════");
{
  const url = "kata https://contoh-domain-sangat-panjang-tanpa-spasi-sekali.com/selesai";
  const hasil = bungkusTeks(url, 200, 23, "anton");
  const baris = hasil.split("\n");
  cek(baris.length >= 3, `kata raksasa terpotong jadi ${baris.length} baris`);
  cek(hasil.replace(/\n/g, "").includes("https://contoh"), "isi kata utuh setelah digabung");
  const faktor = 0.54 * 1.06;
  cek(baris.every((b) => b.length * faktor * 23 <= 200 + 0.001), "tiap potongan ≤ budget");
}

console.log("════ bungkusTeks — 18 font semuanya aman ════");
{
  const fonts = [
    "tebal", "bersih", "klasik", "bebas", "anton", "cinzel", "cinzeldec", "playfair",
    "marcellus", "julius", "oswald", "sixcaps", "teko", "alfaslab", "abril", "blackops",
    "creepster", "monoton",
  ] as const;
  const teks = "Tulisan panjang untuk menguji lipatan otomatis di semua font bundel VidSplit";
  let aman = true;
  for (const f of fonts) {
    const r = bungkusTeks(teks, 500, 60, f);
    if (!r || r.includes("undefined") || r.includes("NaN")) aman = false;
  }
  cek(aman, "18 font: hasil finite & tak kosong");
  // monoton (paling lebar) harus lebih banyak baris daripada sixcaps (paling sempit)
  const m = bungkusTeks(teks, 500, 60, "monoton").split("\n").length;
  const s = bungkusTeks(teks, 500, 60, "sixcaps").split("\n").length;
  cek(m > s, `font lebar lipat lebih cepat (monoton ${m} > sixcaps ${s})`);
}

console.log("════ skalaTeksRender & bungkusTeksRender ════");
{
  cek(skalaTeksRender(1080, 1920) === 1, "skala 1080×1920 = 1");
  cek(Math.abs(skalaTeksRender(720, 1280) - 720 / 1080) < 1e-12, "skala 720×1280 = 720/1080");
  cek(Math.abs(skalaTeksRender(1920, 1080) - 1) < 1e-12, "skala landscape 1920×1080 = 1 (sisi terpendek)");
  // titik lipat 1080p == 720p (keduanya skala linear dari ukuran pengaturan)
  const t = "Sebuah judul yang cukup panjang untuk terlipat di ukuran huruf besar sekali";
  const b1080 = bungkusTeksRender(t, { ...pengaturanDefault.gayaJudul, ukuran: 80 }, 1080, 1920, 12);
  const b720 = bungkusTeksRender(t, { ...pengaturanDefault.gayaJudul, ukuran: 80 }, 720, 1280, 12);
  cek(b1080 === b720, "titik lipat 1080p == 720p (proporsional)");
}

console.log("════ teksSiapGambar — konsisten dgn rantaiTeks ffmpeg ════");
{
  const p: Pengaturan = {
    ...pengaturanDefault,
    judul: "Judul super panjang sekali yang pasti terlipat ke beberapa baris pada ukuran besar",
    gayaJudul: { ...pengaturanDefault.gayaJudul, ukuran: 90 },
    kataPart: "Bagian",
    gayaPart: { ...pengaturanDefault.gayaPart, ukuran: 60 },
    deskripsi: "Deskripsi panjang yang juga harus terlipat otomatis agar tidak terpotong di ujung frame hasil ekspor",
    gayaDeskripsi: { ...pengaturanDefault.gayaDeskripsi, ukuran: 70 },
  };
  const siap = teksSiapGambar(p.judul, "Bagian 1", p.deskripsi, p, 1080, 1920);
  cek(siap.judul.split("\n").length > 1, "judul terlipat saat font 90");
  cek(siap.deskripsi.split("\n").length > 1, "deskripsi terlipat saat font 70");
  cek(siap.part === "Bagian 1", "part pendek tidak berubah");
  // lantai ukuran: judul min 12px, part/deskripsi min 10px (sama dgn rantaiTeks)
  const kecil = teksSiapGambar("a b c", "Part 1", "d e f", { ...p, gayaJudul: { ...p.gayaJudul, ukuran: 1 }, gayaPart: { ...p.gayaPart, ukuran: 1 }, gayaDeskripsi: { ...p.gayaDeskripsi, ukuran: 1 } }, 1080, 1920);
  cek(kecil.judul === "a b c" && kecil.part === "Part 1" && kecil.deskripsi === "d e f", "ukuran 1px dilantai ke min — teks pendek utuh");
  // teks kosong tetap kosong → drawtext tidak dibuat
  const kosong = teksSiapGambar("", "", "", pengaturanDefault, 1080, 1920);
  cek(kosong.judul === "" && kosong.part === "" && kosong.deskripsi === "", "semua kosong → kosong");
  // determinisme
  cek(JSON.stringify(teksSiapGambar(p.judul, "Bagian 1", p.deskripsi, p, 1080, 1920)) === JSON.stringify(siap), "deterministik (dipanggil 2x sama)");
}

console.log("════ v0.42.0 — default & migrasi ukuran 23 ════");
{
  cek(pengaturanDefault.gayaJudul.ukuran === 23, "bawaan gayaJudul.ukuran = 23");
  cek(pengaturanDefault.gayaPart.ukuran === 23, "bawaan gayaPart.ukuran = 23");
  cek(pengaturanDefault.gayaDeskripsi.ukuran === 23, "bawaan gayaDeskripsi.ukuran = 23");
}

console.log(`\n${jumlah - gagal}/${jumlah} cek LOLOS${gagal ? ` — ${gagal} GAGAL` : ""}`);
if (gagal) process.exit(1);
