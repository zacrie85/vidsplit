// Uji unit judulDariNama — fitur judul otomatis dari nama file (v0.6.1)
import { judulDariNama } from "../src/lib/vidsplit/types";

const kasus: Array<[string, string]> = [
  ["video-kuda_laut.mp4", "Video Kuda Laut"],
  ["AVENGER_ENDGAME_Trim.mp4", "Avenger Endgame Trim"],
  ["videoKudaLucu.mp4", "Video Kuda Lucu"],
  ["jalan.2.sisi.mkv", "Jalan 2 Sisi"],
  ["sudah ada spasi.webm", "Sudah Ada Spasi"],
  ["Part1-Part2.AVENGER.12.mp4", "Part1 Part2 Avenger 12"],
  ["C:\\Users\\aku\\video lucu.mp4", "Video Lucu"],
  ["/home/z/klip/POV_akanah_kamu.ts", "Pov Akanah Kamu"],
  ["___", ""],
  [".hidden", ""],
  ["", ""],
];

let lulus = 0;
for (const [masuk, harap] of kasus) {
  const hasil = judulDariNama(masuk);
  const ok = hasil === harap;
  if (ok) lulus++;
  else console.log(`GAGAL: ${JSON.stringify(masuk)} → "${hasil}" (harap "${harap}")`);
}

// nama panjang dipotong di sekitar 80 karakter + …
const panjang = judulDariNama("ini adalah nama file video yang sangat panjang sekali loh kawan hingga melewati batas delapan puluh karakter.mp4");
const okPanjang = panjang.length <= 81 && panjang.endsWith("…");
if (okPanjang) lulus++; else console.log(`GAGAL panjang: len=${panjang.length} "${panjang}"`);

console.log(`\n${lulus}/${kasus.length + 1} lulus`);
process.exit(lulus === kasus.length + 1 ? 0 : 1);
