// VidSplit v0.27.0 — uji smoke cepat mesin horor (cerita, musik, halaman, chunk, args, TTS)
import { buatCerita, estimasiDurasi } from "../src/lib/vidsplit/hororCerita";
import { sintesisMusikHoror, sintesisMusikGenre, sintesisMusikHangat } from "../src/lib/vidsplit/hororMusik";
import { renderHalamanPng, bungkusTeks, bacaTtf, lebarTeks } from "../src/lib/vidsplit/teksLayar";
import { buatNarasiWav, ujiTts, ekspresiVbs, durasiWav, infoWav, argumenSuaraPria, piperSiap } from "../src/lib/vidsplit/hororTts";
import { statSync, writeFileSync } from "node:fs";
import {
  TEMA_HOROR, rencanaHoror, pecahChunk, waktuKilat, buatArgumenLatar,
  buatArgumenChunk, buatArgumenConcat, isiListConcat, ukuranHoror,
  MUSIK_BUNDEL, pathMusikBundel, pathGambarGaleri,
  tataLetakKomik, durasiAdeganKomik, ekspresiZoompan, buatArgumenSegmenKomik, buatArgumenCampurMusik, buatArgumenMusikPanjang,
} from "../src/lib/vidsplit/hororRender";
import { svgAdegan, defsAdegan, jenisAdeganBab } from "../src/lib/vidsplit/hororIlustrasi";
import { renderIlustrasiPng, renderTeksPanelPng } from "../src/lib/vidsplit/teksLayar";
import { bangunPromptVideo, pecahKalimat, type Cerita } from "../src/lib/vidsplit/videoPrompt";
import { GALERI, GALERI_REAL, VARIAN_HANTU, deteksiHantu, deteksiLatar, hantuDominan, potonganAdegan, pilihGambarPotongan, rencanaGambarCerita, ambilGaleri, idTersedia, GRADE_CERAH } from "../src/lib/vidsplit/hororGaleri";

let gagal = 0;
function ok(kondisi: boolean, nama: string) {
  if (!kondisi) { gagal++; console.log(`  GAGAL: ${nama}`); }
  else console.log(`  ok: ${nama}`);
}
const tema = TEMA_HOROR[0];

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
ok(c3.bab[c3.bab.length - 1].judul === "Menguak", "pendek tetap ada twist di Menguak");
ok(buatCerita({ panjang: "bab10", seed: 9 }).bab.length === 10, "bab10 = 10");
ok(buatCerita({ panjang: "bab15", seed: 9 }).bab.length === 15, "bab15 = 15");
const c20 = buatCerita({ panjang: "bab20", seed: 9 });
ok(c20.bab.length === 20, "bab20 = 20");
const paragrafSemua = c20.bab.flatMap((b) => b.paragraf);
ok(new Set(paragrafSemua).size >= paragrafSemua.length * 0.75, "20 bab tak repetitif (≥75% unik)");

console.log("== 1b. Prompt ide ==");
const ci = buatCerita({ panjang: "sedang", seed: 5, ide: "anak yang pindah ke rumah dekat sumur tua, ada boneka misterius" });
ok(ci.tema === "rumah", `tema dari ide = rumah (${ci.tema})`);
ok(ci.bab[0].paragraf[0].includes("sumur"), "lokasi ikut ide (sumur)");
ok(ci.bab.flatMap((b) => b.paragraf).some((p) => p.includes("boneka")), "benda ikut ide (boneka)");
const ci2 = buatCerita({ panjang: "sedang", seed: 5, ide: "misteri sekolah berasrama di pinggir hutan" });
ok(ci2.tema === "sekolah", `tema dari ide = sekolah (${ci2.tema})`);
ok(estimasiDurasi("satu dua tiga empat lima enam") >= 6, "estimasi durasi >= 6 dtk");

console.log("== 1c. Genre AI Video Generator (v0.29.0) ==");
const gm = buatCerita({ genre: "misteri", panjang: "sedang", seed: 11 });
ok(gm.genre === "misteri", "cerita misteri menandai genre");
ok(gm.bab.length === 5 && gm.bab[gm.bab.length - 1].judul === "Terjawab", "bab akhir misteri = Terjawab");
const gd = buatCerita({ genre: "dongeng", panjang: "pendek", seed: 3 });
ok(gd.bab[gd.bab.length - 1].judul === "Tamat Cerita", "bab akhir dongeng = Tamat Cerita");
ok(buatCerita({ genre: "legenda", panjang: "sedang", seed: 8 }).bab[4].judul === "Hikmah", "bab akhir legenda = Hikmah");
ok(buatCerita({ genre: "motivasi", panjang: "sedang", seed: 8 }).bab[4].judul === "Pelajaran", "bab akhir motivasi = Pelajaran");
ok(buatCerita({ genre: "fakta", panjang: "sedang", seed: 8 }).bab[4].judul === "Terpesona", "bab akhir fakta = Terpesona");
for (const g of ["horor", "misteri", "legenda", "dongeng", "motivasi", "fakta"] as const) {
  const a = buatCerita({ genre: g, panjang: "bab10", seed: 21 });
  const b2 = buatCerita({ genre: g, panjang: "bab10", seed: 21 });
  const ps = a.bab.flatMap((b) => b.paragraf);
  ok(JSON.stringify(a) === JSON.stringify(b2), `genre ${g}: deterministik`);
  ok(new Set(ps).size >= ps.length * 0.75, `genre ${g}: 10 bab tak repetitif`);
  ok(a.bab.every((b) => b.paragraf.every((p) => p.length > 40)), `genre ${g}: paragraf wajar`);
}
ok(JSON.stringify(buatCerita({ genre: "bukan" as never, panjang: "pendek", seed: 5 })) === JSON.stringify(buatCerita({ panjang: "pendek", seed: 5 })), "genre tak dikenal jatuh ke horor");
const gm2 = buatCerita({ genre: "misteri", panjang: "sedang", seed: 2, ide: "surat tanpa pengirim di perpustakaan tua" });
ok(gm2.bab[0].paragraf[0].includes("perpustakaan"), "ide landmark genre (perpustakaan) masuk cerita");
ok(gm2.bab.flatMap((b) => b.paragraf).some((p) => p.includes("surat") || p.includes("berkas") || p.includes("amplop")), "ide kata kunci genre masuk benda/kejadian");

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

console.log("== 2b. Musik hangat (v0.29.0: dongeng/motivasi/fakta) ==");
const mh = sintesisMusikGenre({ intensitas: "santai", polaDetik: 12, seed: 5, mood: "hangat" });
const mhLagi = sintesisMusikGenre({ intensitas: "santai", polaDetik: 12, seed: 5, mood: "hangat" });
ok(mh.length === 12 * 44100 * 4 + 44, "musik hangat ukuran PCM pas");
ok(mh.equals(mhLagi), "musik hangat deterministik");
ok(!mh.equals(m1), "mood beda = gelombang beda");
let puncakH = 0;
for (let i = 44; i < mh.length; i += 997) puncakH = Math.max(puncakH, Math.abs(mh.readInt16LE(i)));
ok(puncakH > 800 && puncakH < 32767, `puncak amplitudo hangat wajar (${puncakH})`);
ok(sintesisMusikGenre({ intensitas: "menegangkan", polaDetik: 12, seed: 5 }).equals(sintesisMusikHoror({ intensitas: "menegangkan", polaDetik: 12, seed: 5 })), "dispatcher mood gelap = sintesisMusikHoror");
ok(sintesisMusikHangat({ polaDetik: 12, seed: 9 }).equals(sintesisMusikGenre({ polaDetik: 12, seed: 9, mood: "hangat" })), "dispatcher mood hangat = sintesisMusikHangat");

console.log("== 3. Halaman teks (resvg) ==");
const ttf = bacaTtf("assets/fonts/DejaVuSans.ttf");
ok(ttf.unitsPerEm > 0 && ttf.cmap.size > 1000, `TTF terbaca (cmap ${ttf.cmap.size} entri)`);
ok(lebarTeks("iii", ttf, 100) < lebarTeks("WWW", ttf, 100), "lebar i < W");
const baris = bungkusTeks("kata ".repeat(50), ttf, 48, 600);
ok(baris.length >= 4 && baris.every((b) => lebarTeks(b, ttf, 48) <= 640), `wrap wajar (${baris.length} baris)`);
const png1 = renderHalamanPng({ lebar: 720, tinggi: 1280, besar: "Pintu itu terbuka sendiri tepat pukul tiga pagi.", label: "BAB 2", footer: "Uji Halaman" });
const png1lagi = renderHalamanPng({ lebar: 720, tinggi: 1280, besar: "Pintu itu terbuka sendiri tepat pukul tiga pagi.", label: "BAB 2", footer: "Uji Halaman" });
ok(png1.length > 5000 && png1.equals(png1lagi), `PNG deterministik (${Math.round(png1.length / 1024)} KB)`);

console.log("== 3b. Ilustrasi komik ==");
const adegan = svgAdegan({ jenis: "eksterior-rumah", lebar: 720, tinggi: 1280, seed: 42, tema, ambient: false });
const adeganLagi = svgAdegan({ jenis: "eksterior-rumah", lebar: 720, tinggi: 1280, seed: 42, tema, ambient: false });
ok(adegan.includes("circle") && adegan.includes("polygon"), "adegan berisi elemen (bulan, rumah)");
ok(adegan === adeganLagi, "adegan deterministik");
ok(svgAdegan({ jenis: "kamar", lebar: 720, tinggi: 1280, seed: 1, tema }) !== svgAdegan({ jenis: "lorong", lebar: 720, tinggi: 1280, seed: 1, tema }), "jenis adegan beda = gambar beda");
ok(JSON.stringify([jenisAdeganBab(0, 5)]) === JSON.stringify([jenisAdeganBab(0, 5)]), "jenisAdeganBab deterministik");

console.log("== 3c. Ilustrasi genre (v0.29.0) ==");
const adeganGunung = svgAdegan({ jenis: "gunung", lebar: 720, tinggi: 1280, seed: 42, tema, cerah: true });
ok(adeganGunung.includes("path") && adeganGunung.includes("polygon"), "adegan gunung berisi punggungan");
const adeganLaut = svgAdegan({ jenis: "laut", lebar: 720, tinggi: 1280, seed: 42, tema, cerah: true });
ok(adeganLaut.includes("polygon") && adeganLaut.includes("line"), "adegan laut berisi perahu/ombak");
const adeganKota = svgAdegan({ jenis: "kota", lebar: 720, tinggi: 1280, seed: 42, tema });
ok(adeganKota.includes("rect"), "adegan kota berisi gedung");
ok(svgAdegan({ jenis: "hutan", lebar: 720, tinggi: 1280, seed: 7, tema, cerah: true }) !== svgAdegan({ jenis: "hutan", lebar: 720, tinggi: 1280, seed: 7, tema }), "mode cerah mengubah gambar");
ok([0, 1, 2, 3, 4, 5, 6, 7].every((i) => ["gunung", "laut", "kota"].includes(jenisAdeganBab(i, 9, "motivasi"))), "jenisAdeganBab motivasi hanya gunung/laut/kota");
ok([0, 1, 2, 3, 4, 5, 6, 7].every((i) => ["lorong", "kota", "kamar", "eksterior-rumah", "hutan", "sosok"].includes(jenisAdeganBab(i, 9, "misteri"))), "jenisAdeganBab misteri sesuai daftar");
const pngAdegan = renderHalamanPng({ lebar: 720, tinggi: 1280, besar: "Uji adegan", label: "BAB 1", adeganSvg: adegan, defsSvg: defsAdegan(tema), adeganRedup: 0.75 });
ok(pngAdegan.length > 20000, `PNG dgn adegan lebih besar (${Math.round(pngAdegan.length / 1024)} KB > 20)`);
for (const m of MUSIK_BUNDEL) {
  let ada = false;
  try { ada = require("node:fs").statSync(pathMusikBundel(m.file)).size > 100000; } catch { ada = false; }
  ok(ada, `musik bundel ada: ${m.file}`);
}

console.log("== 4. Rencana & chunk ==");
const [w, h] = ukuranHoror("9:16", "1080p");
ok(w === 1080 && h === 1920, "ukuran 9:16 1080p");
const durasi: number[][] = c1.bab.map((b) => b.paragraf.map(() => 0));
const wav: (string | null)[][] = c1.bab.map((b) => b.paragraf.map(() => null));
const plan = rencanaHoror(c1, { cerita: c1, narasi: false, ilustrasi: true }, durasi, wav);
ok(plan.length === 17, `rencana: judul(1)+5 label+10 paragraf+tamat(1) = 17 (${plan.length})`);
ok(plan.every((h) => h.adeganJenis && h.adeganSeed !== undefined), "semua halaman punya adegan (ilustrasi aktif)");
const planTanpa = rencanaHoror(c1, { cerita: c1, narasi: false, ilustrasi: false }, durasi, wav);
ok(planTanpa.every((h) => !h.adeganJenis), "tanpa ilustrasi: tak ada adegan");
ok(plan[0].label === "Sebuah Cerita Horor", `label judul bawaan horor (${plan[0].label})`);
const c1M = { ...c1, genre: "misteri" as const };
const planM = rencanaHoror(c1M, { cerita: c1M, narasi: false, ilustrasi: true, genreId: "misteri" }, durasi, wav);
ok(planM[0].label === "Sebuah Kisah Misteri", `label judul ikut genre (${planM[0].label})`);
ok(planM.every((h) => h.adeganJenis && ["lorong", "kota", "kamar", "eksterior-rumah", "hutan", "sosok"].includes(h.adeganJenis)), "adegan rencana misteri sesuai genre");
const chunk = pecahChunk(plan);
ok(chunk.flat().length === plan.length, "semua halaman tercakup chunk");
ok(chunk.every((ch) => ch.length <= 14), "chunk <= 14 halaman");
ok(buatArgumenLatar(tema, 1080, 1920, "/tmp/latar.png").join(" ").includes("gradients="), "arg latar pakai gradients");
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

console.log("== 4b. AI Text-to-Video Generator — prompt komik (v0.30.0) ==");
const pk = bangunPromptVideo(c1);
ok(pk.gaya === "komik-sinematik", "gaya komik-sinematik");
ok(pk.layout.gambar === "atas" && pk.layout.teksCerita === "bawah", "layout: gambar ATAS + kolom cerita BAWAH");
ok(pk.lajuAdeganDetik === 2, "gambar berganti ±2 dtk (v0.34.0)");
ok(pk.adegan.length >= 6, `adegan cukup (${pk.adegan.length})`);
ok(pk.adegan.every((a) => a.teks.trim().length > 3), "teks adegan terisi");
ok(pk.adegan.every((a) => !/^bab\b/i.test(a.teks.trim())), "TANPA tulisan bab di dalam adegan");
ok(pk.adegan.every((a, i) => i === 0 || a.jenisAdegan !== pk.adegan[i - 1].jenisAdegan), "ilustrasi SELALU berganti antar-adegan");
ok(pk.adegan.every((a) => ["dalam", "keluar", "geser-kiri", "geser-kanan"].includes(a.kamera)), "kamera AI valid");
ok(pk.adegan.every((a) => a.catatan.length > 10), "catatan prompt visual per adegan");
ok(JSON.stringify(pk) === JSON.stringify(bangunPromptVideo(buatCerita({ tema: "rumah", panjang: "sedang", seed: 42 }))), "prompt deterministik");
ok(bangunPromptVideo({ ...c1, genre: "motivasi" }).adegan.every((a) => ["gunung", "laut", "kota"].includes(a.jenisAdegan)), "genre motivasi → adegan gunung/laut/kota");
ok(pk.estimasiDetik >= pk.adegan.length * 3, "estimasi durasi wajar");
// kalimat sangat panjang dipecah agar panel tetap singkat
const cPanjang: Cerita = { judul: "Uji", tema: "rumah", seed: 3, bab: [{ judul: "", paragraf: ["Kata penggalan yang sangat panjang sekali terus berlanjut, berjela-jela tanpa henti, berputar-putar membabi buta, dan tetap saja bertambah panjang hingga melampaui dua puluh dua kata pada satu kalimat yang sama di paragraf ini."] }] };
ok(bangunPromptVideo(cPanjang).adegan.every((a) => a.teks.split(/\s+/).length <= 30), "kalimat panjang dipecah dgn wajar");
// pecahKalimat
ok(JSON.stringify(pecahKalimat("Ia pulang. Lalu hujan turun! Siapa di sana?")) === JSON.stringify(["Ia pulang.", "Lalu hujan turun!", "Siapa di sana?"]), "pecahKalimat dasar");
ok(pecahKalimat("Dia bilang \u201cjangan menoleh\u201d. Setelah itu diam.").length === 2, "tutup kutip ikut kalimatnya");
ok(pecahKalimat("").length === 0, "teks kosong → 0 kalimat");
// tata letak + durasi + zoompan
ok(tataLetakKomik(1080, 1920).panelTinggi === Math.round(1920 * 0.62), "9:16: gambar atas 62%");
ok(tataLetakKomik(1920, 1080).panelTinggi === Math.round(1080 * 0.6), "16:9: gambar atas 60%");
ok(durasiAdeganKomik(0, "satu dua tiga") >= 3.0, "durasi adegan min 3 dtk");
ok(durasiAdeganKomik(8, "teks") >= 8.5, "durasi adegan mengikuti durasi TTS");
const dz = durasiAdeganKomik(2, "satu dua tiga empat lima");
ok(Math.abs(dz * 30 - Math.round(dz * 30)) < 1e-9, "durasi kelipatan 1/30 (sinkron frame)");
ok(ekspresiZoompan("dalam", 90).z.includes("on/90"), "zoompan kamera dalam");
ok(ekspresiZoompan("geser-kanan", 90).x.includes("on/90"), "zoompan kamera geser");
const argsSeg = buatArgumenSegmenKomik({
  tema, lebar: 1080, tinggi: 1920, panelTinggi: 1190,
  ilustrasiAbs: "/tmp/i.png", panelTeksAbs: "/tmp/p.png",
  kamera: "dalam", durasi: 3.5, wavAbs: "/tmp/n.wav", volumeNarasi: 1, keluar: "/tmp/seg.ts",
});
ok(argsSeg.join(" ").includes("zoompan") && argsSeg.join(" ").includes("s=1080x1190"), "arg segmen: zoompan di ukuran panel atas");
ok(argsSeg.join(" ").includes("pad=1080:1920"), "arg segmen: pad ke kanvas penuh");
ok(argsSeg.join(" ").includes("overlay=0:0"), "arg segmen: overlay kolom teks bawah");
ok(argsSeg.join(" ").includes("adelay=150|150") && argsSeg.join(" ").includes("apad") && argsSeg.join(" ").includes("atrim=0:3.5"), "arg segmen: audio di-pad PERSIS sepanjang adegan");
ok(argsSeg[argsSeg.indexOf("-frames:v") + 1] === "105", "arg segmen: 105 frame @ 3.5 dtk");
// v0.32.0 — anti-hang 3 lapis: -t output, apad=whole_len, input panel terbatas -t
ok(argsSeg[argsSeg.indexOf("-frames:v") + 2] === "-t" && argsSeg[argsSeg.indexOf("-frames:v") + 3] === "3.500", "arg segmen: -t 3.500 di output (rem ABSOLUT anti-hang)");
ok(argsSeg.join(" ").includes("apad=whole_len=154350"), "arg segmen: apad=whole_len=154350 (padding audio BERBATAS 3.5×44100)");
const iPanel = argsSeg.indexOf("/tmp/p.png");
ok(iPanel > 4 && argsSeg[iPanel - 5] === "-loop" && argsSeg[iPanel - 4] === "1" && argsSeg[iPanel - 3] === "-t" && argsSeg[iPanel - 2] === "3.500" && argsSeg[iPanel - 1] === "-i", "arg segmen: input panel teks -loop 1 -t 3.500 (tak lagi tak berujung)");
ok(argsSeg.join(" ").includes("-preset veryfast"), "arg segmen: preset bawaan veryfast");
ok(buatArgumenSegmenKomik({ tema, lebar: 1080, tinggi: 1920, panelTinggi: 1190, ilustrasiAbs: "/tmp/i.png", panelTeksAbs: "/tmp/p.png", kamera: "dalam", durasi: 3.5, wavAbs: null, volumeNarasi: 1, preset: "ultrafast", keluar: "/tmp/s.ts" }).join(" ").includes("-preset ultrafast"), "arg segmen: opsi preset ultrafast (percobaan ulang)");
ok(!argsSeg.includes("anullsrc"), "arg segmen dgn wav: tanpa anullsrc");
const argsHening = buatArgumenSegmenKomik({
  tema, lebar: 720, tinggi: 1280, panelTinggi: 794,
  ilustrasiAbs: "/tmp/i.png", panelTeksAbs: "/tmp/p.png",
  kamera: "keluar", durasi: 3, wavAbs: null, volumeNarasi: 1, fadeKeluar: true, keluar: "/tmp/seg2.ts",
});
ok(argsHening.join(" ").includes("anullsrc"), "arg segmen tanpa wav: hening");
ok(argsHening.join(" ").includes("fade=t=out") && argsHening.join(" ").includes("afade"), "adegan terakhir: fade keluar video+audio");
const argsMix = buatArgumenCampurMusik("/tmp/v.mp4", "/tmp/m.wav", 60, 0.8, "/tmp/out.mp4");
ok(argsMix[argsMix.indexOf("-c:v") + 1] === "copy" && argsMix.join(" ").includes("amix=inputs=2"), "campur musik: -c:v copy + amix (video tak disentuh)");
ok(argsMix.join(" ").includes("atrim=0:60.00"), "campur musik: atrim sesuai durasi");
// v0.31.0 — musik latar masuk langsung ke segmen (pola per-chunk terbukti di Windows)
const argsSegMusik = buatArgumenSegmenKomik({
  tema, lebar: 1080, tinggi: 1920, panelTinggi: 1190,
  ilustrasiAbs: "/tmp/i.png", panelTeksAbs: "/tmp/p.png",
  kamera: "dalam", durasi: 3.5, wavAbs: "/tmp/n.wav", volumeNarasi: 1,
  musikAbs: "/tmp/musik-panjang.wav", mulaiMusik: 10.5, volumeMusik: 0.8, keluar: "/tmp/seg3.ts",
});
const iMusik = argsSegMusik.indexOf("/tmp/musik-panjang.wav");
ok(iMusik > 4 && argsSegMusik[iMusik - 5] === "-ss" && argsSegMusik[iMusik - 4] === "10.500" && argsSegMusik[iMusik - 3] === "-t" && argsSegMusik[iMusik - 2] === "3.750" && argsSegMusik[iMusik - 1] === "-i",
  "arg segmen+musik: potongan -ss 10.5 -t dur+0.25 (input 3)");
ok(argsSegMusik.join(" ").includes("[nar][ms]amix=inputs=2:duration=first:normalize=0"), "arg segmen+musik: amix narasi+musik (narasi pertama = durasi adegan)");
ok(argsSegMusik.join(" ").includes("volume=0.80"), "arg segmen+musik: volume musik di filter");
ok(!argsSegMusik.join(" ").includes("afade=t=out:st=2.30"), "arg segmen+musik: tanpa fade musik di adegan biasa");
const argsSegMusikAkhir = buatArgumenSegmenKomik({
  tema, lebar: 1080, tinggi: 1920, panelTinggi: 1190,
  ilustrasiAbs: "/tmp/i.png", panelTeksAbs: "/tmp/p.png",
  kamera: "dalam", durasi: 3.5, wavAbs: null, volumeNarasi: 1,
  musikAbs: "/tmp/musik-panjang.wav", mulaiMusik: 0, volumeMusik: 0.9, fadeMusikKeluar: true, keluar: "/tmp/seg4.ts",
});
ok(argsSegMusikAkhir.join(" ").includes("afade=t=out:st=2.30:d=1.2"), "adegan akhir: musik fade-out 1.2 dtk");
ok(argsSegMusikAkhir.join(" ").includes("volume=0.90") && argsSegMusikAkhir.join(" ").includes("anullsrc"), "adegan akhir tanpa narasi: hening + musik tetap disisipkan");
// v0.33.0 — jalur CADANGAN musik: sumber diloop (-stream_loop) + potongan atrim di graf
const argsSegLoop = buatArgumenSegmenKomik({
  tema, lebar: 1080, tinggi: 1920, panelTinggi: 1190,
  ilustrasiAbs: "/tmp/i.png", panelTeksAbs: "/tmp/p.png",
  kamera: "dalam", durasi: 3.5, wavAbs: "/tmp/n.wav", volumeNarasi: 1,
  musikAbs: "/tmp/musik.wav", musikLoopSumber: true, mulaiMusik: 10.5, volumeMusik: 0.8, keluar: "/tmp/seg5.ts",
});
ok(argsSegLoop.includes("-stream_loop") && argsSegLoop.includes("-1"), "arg segmen cadangan: musik diloop -stream_loop -1 (tanpa -ss demuxer)");
ok(!argsSegLoop.join(" ").includes("-ss 10.500"), "arg segmen cadangan: TANPA -ss input (potongan via atrim)");
ok(argsSegLoop.join(" ").includes("atrim=start=10.500:end=14.250"), "arg segmen cadangan: potongan atrim=start:end sesuai posisi adegan");
ok(argsSegLoop.join(" ").includes("[nar][ms]amix=inputs=2"), "arg segmen cadangan: amix tetap narasi+musik");
// v0.33.0 — argumen musik-panjang: loudnorm (penguat) + pola polos utk percobaan ulang
const argsPanjangKuat = buatArgumenMusikPanjang("/tmp/m.wav", 121, "/tmp/panjang.wav", true);
const argsPanjangPolos = buatArgumenMusikPanjang("/tmp/m.wav", 121, "/tmp/panjang.wav", false);
ok(argsPanjangKuat.join(" ").includes("loudnorm=I=-18:TP=-2:LRA=11"), "musik-panjang: loudnorm I=-18 (backsound pasti terdengar di semua genre)");
ok(argsPanjangKuat.includes("-stream_loop") && argsPanjangKuat[argsPanjangKuat.indexOf("-t") + 1] === "121.00", "musik-panjang: stream_loop + -t total+1");
ok(!argsPanjangPolos.join(" ").includes("loudnorm"), "musik-panjang polos (percobaan ulang): tanpa loudnorm");
// ===================== v0.34.0 — GALERI HANTU + POTONGAN 2 DTK =====================
console.log("== 4b. Galeri hantu Nusantara + potongan gambar 2 detik ==");
ok(deteksiHantu("Pocong itu bergerak mendekat.") === "pocong", "deteksi hantu: pocong");
ok(deteksiHantu("Kuntilanak berdiri di ujung lorong.") === "kuntilanak", "deteksi hantu: kuntilanak");
ok(deteksiHantu("Sundel bolong meninggalkan jejak.") === "kuntilanak", "deteksi hantu: sundel bolong → kuntilanak");
ok(deteksiHantu("Genderuwo meraung dari balik pepohonan.") === "genderuwo", "deteksi hantu: genderuwo");
ok(deteksiHantu("Tuyul itu tertawa kecil.") === "tuyul", "deteksi hantu: tuyul");
ok(deteksiHantu("Wewe gombel mengintai di atap.") === "wewe", "deteksi hantu: wewe gombel");
ok(deteksiHantu("Leak menguntit di tepi pemakaman.") === "leak", "deteksi hantu: leak");
ok(deteksiHantu("Sesosok bayangan berdiri di kegelapan.") === "sosok", "deteksi hantu: sosok generik");
ok(deteksiHantu("Sawah terbentang luas dan sunyi.") === null, "deteksi hantu: tanpa hantu → null");
ok(deteksiLatar("di kuburan tua itu sangat sepi") === "latar-kuburan", "deteksi latar: kuburan");
ok(deteksiLatar("rumah itu berdiri tua di tepi jalan") === "latar-rumah", "deteksi latar: rumah");
ok(hantuDominan(["pocong keluar dari kuburan", "pocong mendekat lagi", "kuntilanak datang"]) === "pocong", "hantu dominan: pocong");
ok(JSON.stringify(potonganAdegan(5.5)) === "[2,2,1.5]", "potongan 5.5 dtk = 2+2+1.5 (2 dtk per gambar)");
ok(JSON.stringify(potonganAdegan(2)) === "[2]", "potongan 2 dtk = [2]");
ok(JSON.stringify(potonganAdegan(3.5)) === "[2,1.5]", "potongan 3.5 dtk = 2+1.5");
ok(Math.min(...potonganAdegan(6.05)) >= 0.8, "potongan 6.05 dtk: tanpa ekor kilat <0.8 dtk");
for (const dP of [2, 3.2, 5.5, 6.05, 9.5, 12.4]) {
  const tot = potonganAdegan(dP).reduce((a, b) => a + b, 0);
  ok(Math.round(tot * 30) === Math.round(dP * 30), `potongan ${dP} dtk: total frame TEPAT (${Math.round(tot * 30)})`);
}
const pil1 = pilihGambarPotongan({ teks: "Pocong itu bergerak mendekat.", indeks: 1, posisi: 0.3, seed: 99, jumlahPotongan: 3 });
ok(JSON.stringify(pil1) === JSON.stringify(pilihGambarPotongan({ teks: "Pocong itu bergerak mendekat.", indeks: 1, posisi: 0.3, seed: 99, jumlahPotongan: 3 })), "pilihGambarPotongan deterministik");
ok(VARIAN_HANTU.pocong.includes(pil1[0]) && pil1[0].startsWith("pocong"), "potongan 0 adegan pocong = gambar pocong");
ok(ambilGaleri(pil1[1])?.jenis === "latar", "potongan 1 adegan pocong = latar pasangan");
ok(pil1.length === 3, "jumlah gambar = jumlah potongan");
ok(pilihGambarPotongan({ teks: "Aku berjalan di kuburan tua.", indeks: 2, posisi: 0.2, seed: 5, jumlahPotongan: 2 }).includes("latar-kuburan"), "adegan kuburan → latar kuburan");
ok(pilihGambarPotongan({ teks: "malam makin gelap", indeks: 3, posisi: 0.8, seed: 7, jumlahPotongan: 2, hantuDominan: "kuntilanak" }).some((nid) => nid.startsWith("kuntilanak")), "klimaks tanpa sebutan: hantu dominan disuntik");
ok(GALERI.length === 60, `manifest galeri = 60 gambar v0.35.0 (${GALERI.length})`);
ok(new Set(GALERI.map((g) => g.id)).size === GALERI.length, "id galeri semuanya unik");
for (const g of GALERI) {
  const p = pathGambarGaleri(g.file);
  ok(statSync(p).size > 20000, `galeri ada: ${g.id} (${Math.round(statSync(p).size / 1024)} KB)`);
}
// ---- v0.35.0 — hantu & latar BARU + PERENCANA SE-VIDEO (anti "5 gambar berulang") ----
ok(deteksiHantu("Suster ngesot merayap di lorong rumah sakit.") === "suster", "deteksi hantu: suster ngesot");
ok(deteksiHantu("Arwah itu melayang di atas laut gelap.") === "arwah", "deteksi hantu: arwah (bukan sosok)");
ok(deteksiHantu("Banaspati menyala di dapur tua.") === "banaspati", "deteksi hantu: banaspati");
ok(deteksiHantu("Siluman ular itu berguling di semak.") === "siluman", "deteksi hantu: siluman ular");
ok(deteksiHantu("Penunggu kuburan membawa lentera redup.") === "penunggu", "deteksi hantu: penunggu kuburan");
ok(deteksiHantu("Sosok di pohon beringin itu menunduk.") === "pohon", "deteksi hantu: hantu pohon");
ok(deteksiHantu("Tangan-tangan bangkit dari kubur.") === "kubur", "deteksi hantu: bangkit dari kubur");
ok(deteksiLatar("padi sawah terbentang berkabut") === "latar-sawah", "deteksi latar: sawah");
ok(deteksiLatar("mereka menyeberangi jembatan kayu") === "latar-jembatan", "deteksi latar: jembatan");
ok(deteksiLatar("kelas sekolah tua itu berdebu") === "latar-sekolah", "deteksi latar: sekolah");
ok(deteksiLatar("jalan setapak itu menembus semak") === "latar-setapak", "deteksi latar: setapak (sebelum jalan)");
ok(deteksiLatar("bola api melayang di udara gelap") === null, "deteksi latar: kata hantu tak dianggap latar");
const KALIMAT_ADEGAN = [
  "Pocong itu muncul lagi di dekat makam tua.",
  "Malam makin gelap, angin berhembus lembut.",
  "Kuntilanak berdiri di bawah pohon beringin.",
  "Hujan mulai turun membasahi tanah pekarangan.",
  "Genderuwo meraung dari balik pepohonan.",
  "Cahaya lilin berkedip di kamar tua itu.",
  "Tuyul tertawa kecil di atas atap genteng.",
  "Wewe gombel mengintai dari dinding rumah.",
  "Leak menguntit di tepi pemakaman.",
  "Suster ngesot merayap di lorong rumah sakit.",
];
const adegan180 = Array.from({ length: 90 }, (_, i) => ({
  teks: KALIMAT_ADEGAN[i % KALIMAT_ADEGAN.length],
  durasi: 4, // 2 potongan 2 dtk per adegan
}));
const r1 = rencanaGambarCerita({ adegan: adegan180, seed: 777 });
const datar = r1.flat();
ok(r1.length === 90 && r1.every((b) => b.length === 2), "rencana per-adegan = jumlah potonganAdegan");
ok(datar.length === 180, `video 6 menit → 180 potongan 2 dtk (${datar.length})`);
let adaUlang = false;
for (let i = 0; i < datar.length; i++) {
  for (let j = i + 1; j < Math.min(datar.length, i + 10); j++) {
    if (datar[i].id === datar[j].id) adaUlang = true;
  }
}
ok(!adaUlang, "jendela 10 potongan berurutan: TIDAK ada gambar sama (anti 5-gambar-berulang)");
let samaTampil = 0;
for (let i = 1; i < datar.length; i++) {
  const a = datar[i - 1].variasi, b = datar[i].variasi;
  if (a.grade === b.grade && a.hflip === b.hflip) samaTampil++;
}
ok(samaTampil === 0, "pasangan potongan berurutan selalu beda tampilan (grade/hflip)");
ok(new Set(datar.map((d) => d.id)).size >= 45, `rencana memakai >=45 gambar berbeda dr pustaka (${new Set(datar.map((d) => d.id)).size})`);
ok(r1[0][0].id.startsWith("pocong"), "rencana: adegan pocong → gambar pocong");
ok(r1[2][0].id.startsWith("kuntilanak"), "rencana: adegan kuntilanak → gambar kuntilanak");
ok(r1[1][0].id.startsWith("latar-"), "rencana: adegan polos → latar suasana");
const r2 = rencanaGambarCerita({ adegan: adegan180, seed: 777 });
ok(JSON.stringify(r1) === JSON.stringify(r2), "rencanaGambarCerita deterministik");
const rLain = rencanaGambarCerita({ adegan: adegan180, seed: 778 });
ok(JSON.stringify(r1) !== JSON.stringify(rLain), "rencanaGambarCerita beda seed → beda rencana");

// ==== v0.36.0 — mode CERAH: pustaka yang sama utk semua genre (akar laporan
// user "5 gambar terus berulang" = adegan ujinya memakai tema Permata Dongeng
// = genre cerah yang dulu MELEWATI seluruh pustaka & memakai SVG lama) ====
const adeganCerah = Array.from({ length: 40 }, (_, i) => ({
  teks: `Awan di atas desa itu bergerak melawan angin, bagian ${i} penuh keajaiban.`,
  durasi: 4, // 2 potongan 2 dtk per adegan
}));
const rc = rencanaGambarCerita({ adegan: adeganCerah, seed: 55, cerah: true });
const datarC = rc.flat();
ok(datarC.length === 80, `rencana cerah: 40 adegan × 4 dtk = 80 potongan (${datarC.length})`);
ok(rc.every((b) => b.every((p) => ambilGaleri(p.id)?.jenis === "latar")),
  "rencana cerah polos: SEMUA latar — tanpa suntikan hantu ke adegan yang tak menyebutnya");
ok(datarC.every((p) => GRADE_CERAH.includes(p.variasi.grade)),
  `rencana cerah: hanya pewarnaan terang ${JSON.stringify(GRADE_CERAH)}`);
ok(datarC.every((p) => !p.variasi.kabut || true) && datarC.filter((p) => p.variasi.kabut).length < datarC.length * 0.3,
  "rencana cerah: kabut jarang (<30% potongan)");
let samaC = 0;
for (let i = 1; i < datarC.length; i++) {
  const a = datarC[i - 1].variasi, b = datarC[i].variasi;
  if (a.grade === b.grade && a.hflip === b.hflip) samaC++;
}
ok(samaC === 0, "rencana cerah: pasangan berurutan tetap selalu beda tampilan (grade/hflip)");
let ulangC = false;
for (let i = 0; i < datarC.length; i++) {
  for (let j = i + 1; j < Math.min(datarC.length, i + 12); j++) {
    if (datarC[i].id === datarC[j].id) ulangC = true;
  }
}
ok(!ulangC, "rencana cerah: TIDAK ada gambar sama dalam jendela 12 potongan (≈24 dtk)");
ok(new Set(datarC.map((d) => d.id)).size >= 12,
  `rencana cerah memutar banyak latar berbeda (${new Set(datarC.map((d) => d.id)).size} dr 24)`);
const rcH = rencanaGambarCerita({
  adegan: [
    { teks: "Pocong itu bangkit dari kuburan di balik desa.", durasi: 6 },
    { teks: "Penduduk desa berlari menyelamatkan diri.", durasi: 6 },
  ],
  seed: 9, cerah: true,
});
ok(rcH[0].some((p) => p.id.startsWith("pocong")), "rencana cerah: cerita SEBUT pocong → gambar pocong tetap tampil");
ok(JSON.stringify(rencanaGambarCerita({ adegan: adeganCerah, seed: 55, cerah: true })) === JSON.stringify(rc),
  "rencana cerah juga deterministik");

// ==== v0.37.0 — PUSTAKA REALISTIS (agen pendamping menu 5, kartu 6) ====
ok(GALERI_REAL.length >= 40, `pustaka realistis >= 40 entri (${GALERI_REAL.length})`);
ok(GALERI_REAL.every((g) => GALERI.some((k) => k.id === g.id)),
  "id pustaka realistis = subset id pustaka komik (deteksi & varian dipakai bersama)");
ok(GALERI_REAL.every((g) => g.file.endsWith(".jpg")), "berkas realistis berformat .jpg");
ok(new Set(GALERI_REAL.map((g) => g.id)).size === GALERI_REAL.length, "id pustaka realistis unik");
// SEMUA 17 hantu dasar punya >=1 varian realistis
const dasarReal = Object.keys(VARIAN_HANTU).filter((h) => (VARIAN_HANTU[h] ?? []).some((v) => idTersedia(v, "realistis")));
ok(dasarReal.length === Object.keys(VARIAN_HANTU).length,
  `semua ${Object.keys(VARIAN_HANTU).length} hantu dasar punya gambar realistis (${dasarReal.length})`);
let realAda = 0;
for (const g of GALERI_REAL) {
  try { if (statSync(pathGambarGaleri(g.file, "realistis")).size > 20000) realAda++; } catch { /* hilang */ }
}
ok(realAda === GALERI_REAL.length, `semua berkas realistis nyata >20KB (${realAda}/${GALERI_REAL.length})`);
ok(pathGambarGaleri("pocong-1.jpg", "realistis").includes("hantu-real"),
  "pathGambarGaleri realistis menunjuk folder hantu-real");
ok(pathGambarGaleri("pocong-1.png").includes("hantu") && !pathGambarGaleri("pocong-1.png").includes("hantu-real"),
  "pathGambarGaleri komik (bawaan) tak berubah");
ok(ambilGaleri("pocong", "realistis")?.file === "pocong-1.jpg" && ambilGaleri("pocong", "komik")?.file === "pocong-1.png",
  "ambilGaleri membedakan pustaka komik vs realistis");
const rr37 = rencanaGambarCerita({ adegan: adegan180, seed: 88, pustaka: "realistis" });
const datarR37 = rr37.flat();
const setReal37 = new Set(GALERI_REAL.map((g) => g.id));
ok(datarR37.length === 180, `rencana realistis: video 6 mnt = 180 potongan (${datarR37.length})`);
ok(datarR37.every((p) => setReal37.has(p.id)), "rencana realistis: semua id tersedia di pustaka realistis");
let ulangR37 = false;
for (let i = 0; i < datarR37.length; i++) {
  for (let j = i + 1; j < Math.min(datarR37.length, i + 12); j++) {
    if (datarR37[i].id === datarR37[j].id) ulangR37 = true;
  }
}
ok(!ulangR37, "rencana realistis: jendela 12 potongan TANPA gambar sama");
ok(rr37[0][0].id.startsWith("pocong"), "rencana realistis: adegan pocong → gambar pocong realistis");
ok(new Set(datarR37.map((d) => d.id)).size >= 20,
  `rencana realistis memutar >=20 gambar berbeda (${new Set(datarR37.map((d) => d.id)).size})`);
const rcR37 = rencanaGambarCerita({ adegan: adeganCerah, seed: 55, cerah: true, pustaka: "realistis" });
ok(rcR37.flat().every((p) => setReal37.has(p.id)), "rencana cerah + realistis juga terkunci pustaka realistis");
ok(JSON.stringify(rencanaGambarCerita({ adegan: adegan180, seed: 88, pustaka: "realistis" })) === JSON.stringify(rr37),
  "rencana realistis deterministik");
const prReal = bangunPromptVideo(c1, "horor", "realistis");
ok(prReal.gaya === "realistis-sinematik" && prReal.adegan.some((a) => a.catatan.includes("realistis sinematik")),
  "prompt versi realistis: gaya + catatan menyebut realistis sinematik");
ok(bangunPromptVideo(c1, "horor").gaya === "komik-sinematik", "prompt bawaan tetap komik-sinematik");
const argsVar = buatArgumenSegmenKomik({
  tema, lebar: 1080, tinggi: 1920, panelTinggi: 1190,
  ilustrasiAbs: "/tmp/i.png", ilustrasiAbsList: ["/tmp/a.png", "/tmp/b.png"],
  variasiList: [
    { hflip: true, grade: 1, kabut: true, derau: true },
    { hflip: false, grade: 0, kabut: false, derau: false },
  ],
  panelTeksAbs: "/tmp/p.png", kamera: "dalam", durasi: 4, wavAbs: "/tmp/n.wav", volumeNarasi: 1,
  keluar: "/tmp/segv.mp4",
});
const fcVar = argsVar.join(" ");
const cabang0 = (fcVar.match(/\[0:v\][^\[]+/) ?? [""])[0];
const cabang1 = (fcVar.match(/\[1:v\][^\[]+/) ?? [""])[0];
ok(cabang0.includes("hflip") && cabang0.includes("eq=brightness=-0.04") && cabang0.includes("boxblur"), "arg variasi potongan 0: cermin + malam biru + kabut");
ok(fcVar.includes("noise=alls=6:allf=t"), "arg variasi potongan 0: grain film sesudah zoompan");
ok(cabang1.includes("zoompan") && !cabang1.includes("hflip") && !cabang1.includes("eq="), "arg variasi potongan 1 netral: rantai polos (kompat)");
const argsMulti = buatArgumenSegmenKomik({
  tema, lebar: 1080, tinggi: 1920, panelTinggi: 1190,
  ilustrasiAbs: "/tmp/i.png", ilustrasiAbsList: ["/tmp/a.png", "/tmp/b.png", "/tmp/c.png"],
  panelTeksAbs: "/tmp/p.png", kamera: "dalam", durasi: 5.5, wavAbs: "/tmp/n.wav", volumeNarasi: 1,
  keluar: "/tmp/seg6.mp4",
});
ok(argsMulti.includes("/tmp/a.png") && argsMulti.includes("/tmp/b.png") && argsMulti.includes("/tmp/c.png"), "arg multi: 3 gambar potongan jadi input ffmpeg");
ok(argsMulti.join(" ").includes("concat=n=3:v=1:a=0"), "arg multi: concat 3 potongan zoompan");
ok(argsMulti.join(" ").split("d=60").length - 1 === 2 && argsMulti.join(" ").includes("d=45"), "arg multi: frame potongan 60+60+45 (2+2+1.5 dtk)");
ok(argsMulti.indexOf("/tmp/p.png") > argsMulti.indexOf("/tmp/c.png"), "arg multi: input panel teks SETELAH gambar potongan");
ok(argsMulti[argsMulti.indexOf("-frames:v") + 1] === "165", "arg multi: 165 frame @ 5.5 dtk");
ok(argsMulti.join(" ").includes("apad=whole_len=242550"), "arg multi: audio pad PERSIS 5.5 dtk (242550 sampel)");
ok(argsMulti.join(" ").includes("force_original_aspect_ratio=increase"), "arg multi: pra-skala 1.2x utk ruang zoom");
ok(argsMulti.join(" ").includes("s=1080x1190"), "arg multi: zoompan ke ukuran panel atas");
ok(argsMulti.join(" ").includes("(iw-iw/zoom)*min(1,on/"), "arg multi: kamera geser antar-potongan berganti");
ok(buatArgumenSegmenKomik({ tema, lebar: 1080, tinggi: 1920, panelTinggi: 1190, ilustrasiAbs: "/tmp/i.png", ilustrasiAbsList: ["/tmp/a.png"], panelTeksAbs: "/tmp/p.png", kamera: "keluar", durasi: 3.5, wavAbs: null, volumeNarasi: 1, keluar: "/tmp/seg7.mp4" }).join(" ").includes("concat=n=1") === false, "arg multi 1 gambar: TANPA concat (jalur tunggal)");
// PNG panel komik
const pngIlus = renderIlustrasiPng({ lebar: 720, tinggi: 540, adeganSvg: svgAdegan({ jenis: "hutan", lebar: 720, tinggi: 540, seed: 9, tema }), defsSvg: defsAdegan(tema) });
ok(pngIlus.length > 5000 && pngIlus.equals(renderIlustrasiPng({ lebar: 720, tinggi: 540, adeganSvg: svgAdegan({ jenis: "hutan", lebar: 720, tinggi: 540, seed: 9, tema }), defsSvg: defsAdegan(tema) })), `PNG ilustrasi panel jadi + deterministik (${Math.round(pngIlus.length / 1024)} KB)`);
const teksAdegan = "Ia mendengar pintu itu berderit perlahan, lalu suara langkah kecil dari dalam.";
const pngPanel = renderTeksPanelPng({ lebar: 720, tinggi: 1280, areaY: 794, teks: teksAdegan, warnaAksen: tema.aksen, warnaTeks: tema.teks });
ok(pngPanel.length > 3000 && pngPanel.equals(renderTeksPanelPng({ lebar: 720, tinggi: 1280, areaY: 794, teks: teksAdegan, warnaAksen: tema.aksen, warnaTeks: tema.teks })), `PNG panel teks jadi + deterministik (${Math.round(pngPanel.length / 1024)} KB)`);
ok(renderTeksPanelPng({ lebar: 720, tinggi: 1280, areaY: 794, teks: teksAdegan.repeat(6), warnaAksen: tema.aksen }).length > 3000, "teks panjang tetap muat (auto-shrink)");

console.log("== 5. Pembaca skrip (TTS multi-mesin) ==");
// --- durasiWav: pembaca RIFF murni JS (fix "WAV gagal dibaca" oleh probe) ---
function buatWavSintetis(p: string, detik: number, sr: number, kanal: number, bit: number) {
  const nData = Math.round(detik * sr * kanal * (bit / 8));
  const buf = Buffer.alloc(44 + nData);
  buf.write("RIFF", 0, "ascii"); buf.writeUInt32LE(36 + nData, 4); buf.write("WAVE", 8, "ascii");
  buf.write("fmt ", 12, "ascii"); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(kanal, 22); buf.writeUInt32LE(sr, 24); buf.writeUInt32LE(sr * kanal * (bit / 8), 28);
  buf.writeUInt16LE((kanal * bit) / 8, 32); buf.writeUInt16LE(bit, 34);
  buf.write("data", 36, "ascii"); buf.writeUInt32LE(nData, 40);
  writeFileSync(p, buf);
}
buatWavSintetis("/tmp/vidsplit-uji-riff.wav", 2.0, 22050, 1, 16);
const dRiff = await durasiWav("/tmp/vidsplit-uji-riff.wav");
ok(Math.abs(dRiff - 2.0) < 0.05, `durasiWav membaca RIFF benar (${dRiff.toFixed(2)} dtk)`);
buatWavSintetis("/tmp/vidsplit-uji-riff2.wav", 0.5, 44100, 2, 16);
ok(Math.abs((await durasiWav("/tmp/vidsplit-uji-riff2.wav")) - 0.5) < 0.05, "durasiWav stereo 44.1k benar");
// v0.33.0 — infoWav: sample rate + kanal terbaca (dipakai penurunan nada pria)
const iw = await infoWav("/tmp/vidsplit-uji-riff.wav");
ok(iw.sampleRate === 22050 && iw.kanal === 1 && Math.abs(iw.durasi - 2.0) < 0.05, `infoWav: sr+kanal+durasi benar (${iw.sampleRate} Hz, ${iw.kanal} ch)`);
// v0.33.0 — argumen suara pria: asetrate turun 0.84 + atempo kompensasi
const argPria = argumenSuaraPria(22050, "/tmp/in.wav", "/tmp/out.wav");
ok(argPria.join(" ").includes("asetrate=22050*0.84") && argPria.join(" ").includes("atempo=1.19048"), "arg suara pria: asetrate×0.84 + atempo 1.19048 (nada turun, durasi tetap)");
ok(argumenSuaraPria(44100, "/tmp/in.wav", "/tmp/out.wav").join(" ").includes("asetrate=44100*0.84"), "arg suara pria: ikut sample rate sumber (44.1k)");
writeFileSync("/tmp/vidsplit-bukan-wav.bin", Buffer.from("BUKAN BERKAS WAV"));
let tolak = false;
try { await durasiWav("/tmp/vidsplit-bukan-wav.bin"); } catch { tolak = true; }
ok(tolak, "durasiWav menolak berkas bukan-WAV");
// --- mesin Windows di luar Windows: galat jelas, tidak senyap ---
const hWin = await buatNarasiWav("Uji suara.", {}, "/tmp/vidsplit-uji-tts.wav", "windows");
ok(!hWin.ok && !!hWin.galat, "mesin Windows di luar Windows -> galat jelas");
ok(ekspresiVbs('dia bilang "jangan"') === '"dia bilang ""jangan"""', "vbs: kutip ganda diekapsulasi aman");
ok(ekspresiVbs("cahaya…").includes("ChrW(8230)"), "vbs: non-ASCII lewat ChrW");
ok(!ekspresiVbs("abc").includes("ChrW"), "vbs: ASCII murni tanpa ChrW");
ok(ekspresiVbs("") === '""', "vbs: teks kosong aman");
ok(ekspresiVbs("baris\nbaru").includes("ChrW(10)"), "vbs: baris-baru lewat ChrW");
// --- mesin AI Neural (Piper): uji nyata bila bundel tersedia ---
const ai = piperSiap();
if (ai) {
  const hAi = await buatNarasiWav("Raka mendengar suara aneh dari balik pintu gudang.", { kecepatan: 1 }, "/tmp/vidsplit-uji-ai.wav", "ai");
  ok(hAi.ok && !!hAi.metode, `mesin AI Neural menghasilkan suara (${hAi.metode ?? "-"})`);
  const dAi = await durasiWav("/tmp/vidsplit-uji-ai.wav");
  ok(dAi > 1, `durasi WAV AI wajar (${dAi.toFixed(1)} dtk)`);
  ok(statSync("/tmp/vidsplit-uji-ai.wav").size > 50_000, "WAV AI berukuran wajar");
  const ujiAi = await ujiTts("ai");
  ok(ujiAi.ok && (ujiAi.durasi ?? 0) > 1, `ujiTts("ai") lolos + durasi terbaca (${ujiAi.durasi?.toFixed(1)} dtk)`);
  // v0.33.0 — SUARA PRIA: TTS nyata + penurunan nada, durasi tetap wajar
  const ujiAiPria = await ujiTts("ai", true);
  ok(ujiAiPria.ok && (ujiAiPria.metode ?? "").includes("pria"), `ujiTts("ai", pria) lolos — metode: ${ujiAiPria.metode ?? "-"}`);
  const dPria = ujiAiPria.durasi ?? 0;
  const dBiasa = ujiAi.durasi ?? 1;
  ok(dPria > dBiasa * 0.75 && dPria < dBiasa * 1.35, `durasi nada pria tetap wajar (${dPria.toFixed(1)} vs ${dBiasa.toFixed(1)} dtk)`);
} else {
  ok(true, "piper bundel tidak ada di lingkungan ini — uji AI dilewati");
}
const ujiWin = await ujiTts("windows");
ok(!ujiWin.ok === (process.platform !== "win32"), "ujiTts windows konsisten dgn platform");

console.log(gagal === 0 ? "\nSEMUA SMOKE LOLOS" : `\n${gagal} GAGAL`);
process.exit(gagal === 0 ? 0 : 1);
