// VidSplit v0.25.0 — uji smoke cepat mesin horor (cerita, musik, halaman, chunk, args)
import { buatCerita, estimasiDurasi } from "../src/lib/vidsplit/hororCerita";
import { sintesisMusikHoror } from "../src/lib/vidsplit/hororMusik";
import { renderHalamanPng, bungkusTeks, bacaTtf, lebarTeks } from "../src/lib/vidsplit/teksLayar";
import {
  TEMA_HOROR, rencanaHoror, pecahChunk, waktuKilat, buatArgumenLatar,
  buatArgumenChunk, buatArgumenConcat, isiListConcat, ukuranHoror,
} from "../src/lib/vidsplit/hororRender";

let gagal = 0;
function ok(kondisi: boolean, nama: string) {
  if (!kondisi) { gagal++; console.log(`  GAGAL: ${nama}`); }
  else console.log(`  ok: ${nama}`);
}

console.log("== 1. Mesin cerita ==");
const c1 = buatCerita({ tema: "rumah", panjang: "sedang", seed: 42 });
const c1lagi = buatCerita({ tema: "rumah", panjang: "sedang", seed: 42 });
const c2 = buatCerita({ tema: "rumah", panjang: "sedang", seed: 43 });
ok(c1.bab.length === 5, "sedang = 5 bab");
ok(JSON.stringify(c1) === JSON.stringify(c1lagi), "deterministik (seed sama = cerita sama)");
ok(JSON.stringify(c1) !== JSON.stringify(c2), "seed beda = cerita beda");
ok(c1.bab.every((b) => b.paragraf.length >= 1 && b.paragraf.every((p) => p.length > 40)), "semua paragraf terisi wajar");
const c3 = buatCerita({ panjang: "pendek", seed: 7 });
ok(c3.bab.length === 3, "pendek = 3 bab");
ok(estimasiDurasi("satu dua tiga empat lima enam") >= 6, "estimasi durasi >= 6 dtk");

console.log("== 2. Musik horor ==");
const m1 = sintesisMusikHoror({ intensitas: "menegangkan", polaDetik: 12, seed: 5 });
const m1lagi = sintesisMusikHoror({ intensitas: "menegangkan", polaDetik: 12, seed: 5 });
const m2 = sintesisMusikHoror({ intensitas: "menghantui", polaDetik: 12, seed: 5 });
ok(m1.length === 12 * 44100 * 4 + 44, "ukuran PCM pas (12 dtk stereo 16bit)");
ok(m1.equals(m1lagi), "musik deterministik");
ok(!m1.equals(m2), "intensitas beda = gelombang beda");
// amplitudo wajar (tidak senyap / tidak clipping parah)
let puncak = 0;
for (let i = 44; i < m1.length; i += 997) puncak = Math.max(puncak, Math.abs(m1.readInt16LE(i)));
ok(puncak > 1000 && puncak < 32767, `puncak amplitudo wajar (${puncak})`);

console.log("== 3. Halaman teks (resvg) ==");
const ttf = bacaTtf("assets/fonts/DejaVuSans.ttf");
ok(ttf.unitsPerEm > 0 && ttf.cmap.size > 1000, `TTF terbaca (cmap ${ttf.cmap.size} entri)`);
ok(lebarTeks("iii", ttf, 100) < lebarTeks("WWW", ttf, 100), "lebar i < W");
const baris = bungkusTeks("kata ".repeat(50), ttf, 48, 600);
ok(baris.length >= 4 && baris.every((b) => lebarTeks(b, ttf, 48) <= 640), `wrap wajar (${baris.length} baris)`);
const png1 = renderHalamanPng({ lebar: 720, tinggi: 1280, besar: "Pintu itu terbuka sendiri tepat pukul tiga pagi.", label: "BAB 2", footer: "Uji Halaman" });
const png1lagi = renderHalamanPng({ lebar: 720, tinggi: 1280, besar: "Pintu itu terbuka sendiri tepat pukul tiga pagi.", label: "BAB 2", footer: "Uji Halaman" });
ok(png1.length > 5000 && png1.equals(png1lagi), `PNG deterministik (${Math.round(png1.length / 1024)} KB)`);

console.log("== 4. Rencana & chunk ==");
const [w, h] = ukuranHoror("9:16", "1080p");
ok(w === 1080 && h === 1920, "ukuran 9:16 1080p");
const durasi: number[][] = c1.bab.map((b) => b.paragraf.map(() => 0));
const wav: (string | null)[][] = c1.bab.map((b) => b.paragraf.map(() => null));
const plan = rencanaHoror(c1, { cerita: c1, narasi: false }, durasi, wav);
ok(plan.length === 17, `rencana: judul(1)+5 label+10 paragraf+tamat(1) = 17 (${plan.length})`);
const chunk = pecahChunk(plan);
ok(chunk.flat().length === plan.length, "semua halaman tercakup chunk");
ok(chunk.every((ch) => ch.length <= 14), "chunk <= 14 halaman");
const tema = TEMA_HOROR[0];
const argsLatar = buatArgumenLatar(tema, 1080, 1920, "/tmp/latar.png");
ok(argsLatar.join(" ").includes("gradients=") && argsLatar.join(" ").includes("0x0a0a0c"), "arg latar pakai gradients + warna tema");
const kilat = waktuKilat(tema, 150, 0, 42);
ok(kilat.every((t) => t > 0 && t < 150) && JSON.stringify(kilat) === JSON.stringify(waktuKilat(tema, 150, 0, 42)), "kilat dalam rentang & deterministik");
const argsChunk = buatArgumenChunk({
  tema, lebar: 1080, tinggi: 1920, pngLatar: "/tmp/latar.png",
  halaman: [{ pngAbs: "/tmp/p1.png", t0: 0, t1: 10 }, { pngAbs: "/tmp/p2.png", t0: 10, t1: 20 }],
  wav: ["/tmp/n1.wav"], musikAbs: "/tmp/m.wav", volumeMusik: 0.8, volumeNarasi: 1,
  durasi: 20, kilat: [7.5], keluar: "/tmp/c.ts",
});
const fc = argsChunk[argsChunk.indexOf("-filter_complex") + 1];
ok(fc.includes("noise=alls=7") && fc.includes("vignette"), "grain+vignette ada");
ok(fc.includes("[2:v]format=rgba") && fc.includes("[3:v]format=rgba"), "indeks halaman 2,3 benar");
ok(fc.includes("[4:a]aresample=44100"), "indeks wav 4 benar");
ok(argsChunk.includes("-stream_loop") && argsChunk.includes("/tmp/m.wav"), "musik loop");
ok(fc.includes("amix=inputs=2"), "amix narasi+musik");
ok(fc.includes("[5:a]atrim=0:20.00"), "musik atrim sesuai durasi (input 5)");
ok(argsChunk[argsChunk.indexOf("-c:v") + 1] === "libx264", "encoder x264");
const argCon = buatArgumenConcat("/tmp/list.txt", "/tmp/out.mp4");
ok(argCon.includes("concat") && argCon.includes("-movflags"), "arg concat benar");
ok(isiListConcat(["/a.ts", "/b'c.ts"]).includes("file '/a.ts'") && isiListConcat(["/a.ts", "/b'c.ts"]).includes("b'\\''c"), "list concat escape aman");

console.log(gagal === 0 ? "\nSEMUA SMOKE LOLOS" : `\n${gagal} GAGAL`);
process.exit(gagal === 0 ? 0 : 1);
