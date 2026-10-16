// VidSplit v0.44.0 — uji unit SUBTITLE AI OTOMATIS (fungsi murni subtitle.ts)
// Jalankan: bun scripts/uji-subtitle.ts
import {
  bangunAssSubtitle,
  bersihTeksSub,
  kebabAssSub,
  kunciCache,
  skorBahasa,
  tebakBahasa,
  KATA_EN,
  KATA_ID,
  // v0.47.0 — blok paralel + mode bahasa
  bagiBlokAudio,
  gabungSegmenBlok,
  jumlahPipaParalel,
  DURASI_BLOK,
  OVERLAP_BLOK,
  // v0.51.0 — percepatan + bersih halusinasi
  rmsBlok,
  apakahBlokSunyi,
  bersihSegmenHalusinasi,
  perkiraanSisaDtk,
  AMBATANG_SUNYI,
  // v0.51.2 — model cepat (Base) tak lagi hilang diam-diam
  modelCepatTersedia,
  // v0.53.0 — transkrip latar (pipeline dgn render part)
  balapanWaktu,
  indeksBlokTerakhirSebelum,
  BLOK_PERTAMA_DTK,
  MAKS_DTK_BLOK,
  type ModeBahasa,
} from "../src/lib/vidsplit/subtitle";

let lulus = 0;
let gagal = 0;
function cek(nama: string, kondisi: boolean, detail?: unknown) {
  if (kondisi) {
    lulus += 1;
  } else {
    gagal += 1;
    console.error(`  GAGAL: ${nama}`, detail ?? "");
  }
}

// ============ tebakBahasa / skorBahasa ============
cek("tebakBahasa: teks Indonesia → id", tebakBahasa("Selamat datang kembali di podcast kita. Hari ini kita akan membahas bagaimana memulai usaha kecil dengan modal terbatas dan jangan lupa konsisten karena keberhasilan tidak datang semalam") === "id");
cek("tebakBahasa: teks Inggris → en", tebakBahasa("Hello everyone, welcome back to the channel. Today we will talk about artificial intelligence and how it changes our daily life. Do not forget to subscribe for more updates") === "en");
cek("tebakBahasa: kosong → id", tebakBahasa("") === "id");
cek("tebakBahasa: angka/tanda → id", tebakBahasa("123 !!! ...") === "id");
cek("tebakBahasa: seri (tidak keduanya) → id", tebakBahasa("xyz abc") === "id");
const sId = skorBahasa("yang dan di itu dengan untuk ini kita");
cek("skorBahasa: 8 kata ID dikenali", sId.id === 8, sId);
cek("skorBahasa: total dihitung", sId.total === 8, sId);
const sEn = skorBahasa("the and is you that with for this");
cek("skorBahasa: 8 kata EN dikenali", sEn.en === 8, sEn);
cek("kamus tanpa irima", KATA_ID.every((k) => !KATA_EN.includes(k)));

// ============ bersihTeksSub ============
cek("bersih: strip '::' di akhir", bersihTeksSub("Halo semuanya.::") === "Halo semuanya.");
cek("bersih: strip '::::' ganda", bersihTeksSub("teks::::") === "teks");
cek("bersih: spasi ganda dirapatkan", bersihTeksSub("a   b\t\tc") === "a b c");
cek("bersih: strip di awal-akhir", bersihTeksSub(" - Halo - ") === "Halo");
cek("bersih: backslash dibuang", bersihTeksSub("ha\\lo") === "halo");
cek("bersih: kosong aman", bersihTeksSub("") === "" && bersihTeksSub(undefined as unknown as string) === "");
cek("bersih: teks normal tak berubah", bersihTeksSub("Keberhasilan tidak datang semalam.") === "Keberhasilan tidak datang semalam.");

// ============ kunciCache ============
const k1 = kunciCache("/a/v.mp4", 100, 1000, 0, 0);
const k2 = kunciCache("/a/v.mp4", 100, 1000, 0, 0);
const k3 = kunciCache("/a/v.mp4", 100, 2000, 0, 0);
const k4 = kunciCache("/a/v.mp4", 100, 1000, 5, 0);
const k5 = kunciCache("/a/v.mp4", 100, 1000, 0, 10);
cek("kunciCache: deterministik", k1 === k2);
cek("kunciCache: mtime berbeda → kunci beda", k1 !== k3);
cek("kunciCache: trim mulai berbeda → beda", k1 !== k4);
cek("kunciCache: trim akhir berbeda → beda", k1 !== k5);
cek("kunciCache: panjang 24 hex", /^[0-9a-f]{24}$/.test(k1));
// v0.47.0 — mode ikut kunci: fokus ≠ deteksi
cek("kunciCache: mode bawaan = fokus", k1 === kunciCache("/a/v.mp4", 100, 1000, 0, 0, "fokus"));
cek("kunciCache: mode deteksi ≠ fokus", k1 !== kunciCache("/a/v.mp4", 100, 1000, 0, 0, "deteksi"));

// ============ v0.47.0 — bagiBlokAudio ============
const sr = 16000;
function audioBuatan(detik: number): Float32Array {
  return new Float32Array(Math.round(detik * sr));
}
{
  const satu = bagiBlokAudio(audioBuatan(60));
  cek("bagiBlok: 60 dtk → 1 blok", satu.length === 1, satu.length);
  cek("bagiBlok: blok tunggal mulai 0", satu[0].mulai === 0);
  cek("bagiBlok: blok tunggal = audio penuh", Math.abs(satu[0].data.length / sr - 60) < 0.01);

  const dua = bagiBlokAudio(audioBuatan(150));
  cek("bagiBlok: 150 dtk → 2 blok", dua.length === 2, dua.length);
  cek("bagiBlok: blok-1 mulai 0", dua[0].mulai === 0);
  cek("bagiBlok: blok-2 mulai = langkah", dua[1].mulai > 0 && dua[1].mulai < 90);
  // tiap blok menjangkau blok berikutnya (overlap) — tanpa celah
  const akhir0 = dua[0].mulai + dua[0].data.length / sr;
  cek("bagiBlok: overlap nyata antar blok", akhir0 > dua[1].mulai + 0.5, { akhir0, mulai1: dua[1].mulai });
  // blok terakhir mencapai akhir audio
  const blokAkhir = dua[dua.length - 1];
  cek("bagiBlok: blok akhir sampai ujung", Math.abs(blokAkhir.mulai + blokAkhir.data.length / sr - 150) < 0.01);

  const banyak = bagiBlokAudio(audioBuatan(601));
  cek("bagiBlok: 601 dtk → 7 blok", banyak.length === 7, banyak.length);
  cek("bagiBlok: semua blok ≤ durasi+overlap", banyak.every((b) => b.data.length / sr <= DURASI_BLOK + OVERLAP_BLOK + 0.01));
  cek("bagiBlok: mulai terurut", banyak.every((b, i) => i === 0 || b.mulai > banyak[i - 1].mulai));
  // kosong aman
  cek("bagiBlok: audio kosong → 1 blok", bagiBlokAudio(new Float32Array(0)).length === 1);
}

// ============ v0.47.0 — gabungSegmenBlok ============
{
  const gab = gabungSegmenBlok([
    { mulai: 0, segmen: [
      { a: 1, b: 4, t: "awal" },
      { a: 80, b: 88, t: "kalimat lintas batas" },
    ] },
    { mulai: 88.5, segmen: [
      { a: 88.6, b: 89.4, t: "duplikat overlap — dibuang" },
      { a: 90.2, b: 95, t: "lanjutan" },
    ] },
  ]);
  cek("gabung: zona overlap dibuang", gab.length === 3, gab);
  cek("gabung: segmen pertama utuh", gab[0]?.t === "awal");
  cek("gabung: lintas batas dipertahankan", gab.some((s) => s.t === "kalimat lintas batas"));
  cek("gabung: lanjutan masuk", gab.some((s) => s.t === "lanjutan"));
  cek("gabung: urut berdasarkan waktu", gab.every((s, i) => i === 0 || gab[i - 1].a <= s.a));

  // segmen yang menimpa (mulai SETELAH zona overlap): yang lebih panjang menang
  const timpa = gabungSegmenBlok([
    { mulai: 0, segmen: [{ a: 10, b: 12, t: "pendek" }] },
    { mulai: 10, segmen: [{ a: 11.6, b: 15, t: "lebih panjang" }] },
  ]);
  cek("gabung: menimpa → yang panjang menang", timpa.length === 1 && timpa[0].t === "lebih panjang", timpa);
  // segmen yang MULAI di zona overlap selalu milik blok sebelumnya — dibuang
  const zona = gabungSegmenBlok([
    { mulai: 0, segmen: [{ a: 10, b: 12, t: "asli" }] },
    { mulai: 10, segmen: [{ a: 10.5, b: 15, t: "duplikat zona" }] },
  ]);
  cek("gabung: mulai di zona overlap dibuang", zona.length === 1 && zona[0].t === "asli", zona);

  cek("gabung: kosong → kosong", gabungSegmenBlok([]).length === 0);
}

// ============ v0.47.0 — jumlahPipaParalel ============
{
  const lama: string | undefined = process.env.VIDSPLIT_AI_PARALEL;
  delete process.env.VIDSPLIT_AI_PARALEL;
  cek("pipa: 2 core / RAM kecil → 1", jumlahPipaParalel(2, 3) === 1);
  cek("pipa: 2 core / RAM cukup → 1", jumlahPipaParalel(2, 8) === 1);
  cek("pipa: 4 core / RAM 4GB → 2", jumlahPipaParalel(4, 4) === 2);
  cek("pipa: 4 core / RAM 8GB → 2", jumlahPipaParalel(4, 8) === 2);
  cek("pipa: 8 core / RAM 8GB → 4 (v0.51.0 naik dari 3)", jumlahPipaParalel(8, 8) === 4);
  cek("pipa: RAM < 3.5GB selalu 1", jumlahPipaParalel(16, 3) === 1);
  process.env.VIDSPLIT_AI_PARALEL = "5";
  cek("pipa: env override = 5", jumlahPipaParalel(2, 3) === 5);
  process.env.VIDSPLIT_AI_PARALEL = "99";
  cek("pipa: env dibatasi 6", jumlahPipaParalel(2, 3) === 6);
  if (lama === undefined) delete process.env.VIDSPLIT_AI_PARALEL;
  else process.env.VIDSPLIT_AI_PARALEL = lama;
}

cekTipeMode();
function cekTipeMode() {
  const m: ModeBahasa = "fokus";
  cek("ModeBahasa: tipe tersedia", m === "fokus" || m === "deteksi");
}

// ============ kebabAssSub ============
cek("kebab: 0 → 0:00:00.00", kebabAssSub(0) === "0:00:00.00");
cek("kebab: 75.5 → 0:01:15.50", kebabAssSub(75.5) === "0:01:15.50");
cek("kebab: 3661.123 → 1:01:01.12", kebabAssSub(3661.123) === "1:01:01.12");
cek("kebab: negatif → diclip 0", kebabAssSub(-3) === "0:00:00.00");

// ============ bangunAssSubtitle ============
const segmen = [
  { a: 0, b: 5, t: "Selamat datang di podcast" },
  { a: 5.2, b: 9, t: "Hari ini kita membahas usaha kecil" },
  { a: 12, b: 16, t: "Sampai jumpa lagi" },
];

// part 1 (0..10) tanpa intro
const ass1 = bangunAssSubtitle({
  segmen: segmen, mulaiPartRel: 0, durasiPart: 10, offsetIntro: 0,
  W: 1080, H: 1920, ukuran: 26, yPersen: 88,
});
cek("ass1: ada 2 dialogue (segmen 3 di luar)", (ass1.match(/^Dialogue:/gm) || []).length === 2);
cek("ass1: segmen 1 mulai 0:00:00.00", ass1.includes("Dialogue: 0,0:00:00.00,0:00:05.00,Sub"), ass1);
cek("ass1: segmen 2 mulai 5.2", ass1.includes("0:00:05.20"));
cek("ass1: ada fad", ass1.includes("{\\fad(120,120)}Selamat datang di podcast"));
cek("ass1: PlayResX 1080", ass1.includes("PlayResX: 1080"));
cek("ass1: fs = 26 @1080x1920", ass1.includes("Style: Sub,DejaVu Sans,26,"), ass1.split("\n").find((l) => l.startsWith("Style:")));
cek("ass1: outline = round(26*0.11)=3", ass1.includes(",1,3,1,2,48,48,230,1"), ass1.split("\n").find((l) => l.startsWith("Style:")));
cek("ass1: marginV dari bawah = 1920*(100-88)/100 = 230", ass1.includes("48,230,1"));

// part 1 DENGAN intro 3 dtk → semua bergeser +3
const ass1b = bangunAssSubtitle({
  segmen: segmen, mulaiPartRel: 0, durasiPart: 10, offsetIntro: 3,
  W: 1080, H: 1920, ukuran: 26, yPersen: 88,
});
cek("ass1b: segmen 1 mulai di 3 dtk (offset intro)", ass1b.includes("Dialogue: 0,0:00:03.00,0:00:08.00,Sub"), ass1b);

// part 2 (10..20): segmen 2 (5.2..9) di LUAR; segmen 3 (12..16) masuk → 12-10=2
const ass2 = bangunAssSubtitle({
  segmen: segmen, mulaiPartRel: 10, durasiPart: 10, offsetIntro: 0,
  W: 1080, H: 1920, ukuran: 26, yPersen: 88,
});
cek("ass2: hanya 1 dialogue", (ass2.match(/^Dialogue:/gm) || []).length === 1);
cek("ass2: segmen 3 digeser ke 2 dtk", ass2.includes("Dialogue: 0,0:00:02.00,0:00:06.00,Sub"), ass2);

// segmen memotong batas part: 8..12 pada part 1 (0..10) → diclip 8..10
const potong = bangunAssSubtitle({
  segmen: [{ a: 8, b: 12, t: "menyeberang part" }], mulaiPartRel: 0, durasiPart: 10, offsetIntro: 0,
  W: 1080, H: 1920, ukuran: 26, yPersen: 88,
});
cek("potong: diclip ke akhir part (10 → 0:00:10.00)", potong.includes(",0:00:08.00,0:00:10.00,Sub"), potong);

// segmen tipis 0.1 dtk di jendela → dibuang
const tipis = bangunAssSubtitle({
  segmen: [{ a: 9.95, b: 10.05, t: "hampir tak terlihat" }], mulaiPartRel: 0, durasiPart: 10, offsetIntro: 0,
  W: 1080, H: 1920, ukuran: 26, yPersen: 88,
});
cek("tipis: tanpa dialogue → ass kosong", tipis === "");

// tanpa segmen → kosong
cek("kosong: tanpa segmen → ''", bangunAssSubtitle({ segmen: [], mulaiPartRel: 0, durasiPart: 10, offsetIntro: 0, W: 1080, H: 1920, ukuran: 26, yPersen: 88 }) === "");

// skala 720: fs = round(26 * 720/1080) = 17
const ass720 = bangunAssSubtitle({
  segmen, mulaiPartRel: 0, durasiPart: 10, offsetIntro: 0,
  W: 720, H: 1280, ukuran: 26, yPersen: 88,
});
cek("720p: fs = 17", ass720.includes("Style: Sub,DejaVu Sans,17,"), ass720.split("\n").find((l) => l.startsWith("Style:")));
cek("720p: marginV = 1280*(100-88)/100 = 154", ass720.includes("48,154,1"));

// mode "asli" landscape 1920x1080: skala pakai sisi terpendek (1080)
const assAsli = bangunAssSubtitle({
  segmen, mulaiPartRel: 0, durasiPart: 10, offsetIntro: 0,
  W: 1920, H: 1080, ukuran: 26, yPersen: 88,
});
cek("asli 16:9: fs = 26 (sisi terpendek 1080)", assAsli.includes("Style: Sub,DejaVu Sans,26,"));

// tumpang tindih: segmen 2 mulai sebelum segmen 1 selesai → segmen 1 diclip ke segmen 2.a
const tumpuk = bangunAssSubtitle({
  segmen: [
    { a: 0, b: 6, t: "pertama" },
    { a: 4, b: 8, t: "kedua" },
  ],
  mulaiPartRel: 0, durasiPart: 10, offsetIntro: 0,
  W: 1080, H: 1920, ukuran: 26, yPersen: 88,
});
cek("tumpuk: pertama diclip ke 4 dtk", tumpuk.includes("0:00:00.00,0:00:04.00"), tumpuk);
cek("tumpuk: kedua tetap 4..8", tumpuk.includes("0:00:04.00,0:00:08.00"), tumpuk);

// durasi minimum 0.4: segmen 0.5 dtk tetap tampil
const pendek = bangunAssSubtitle({
  segmen: [{ a: 1, b: 1.5, t: "singkat" }], mulaiPartRel: 0, durasiPart: 10, offsetIntro: 0,
  W: 1080, H: 1920, ukuran: 26, yPersen: 88,
});
cek("pendek: durasi 0.5 tetap tampil", pendek.includes("0:00:01.00,0:00:01.50,Sub"));

// teks berbahaya dibersihkan: { } \ hilang
const aman = bangunAssSubtitle({
  segmen: [{ a: 0, b: 2, t: "teks {berbahaya}\\satu" }], mulaiPartRel: 0, durasiPart: 10, offsetIntro: 0,
  W: 1080, H: 1920, ukuran: 26, yPersen: 88,
});
cek("aman: {} dan \\ dibersihkan", aman.includes("teks berbahaya satu"), aman.split("\n").pop());

// header wajib
cek("header: WrapStyle 0 + ScaledBorderAndShadow", ass1.includes("WrapStyle: 0") && ass1.includes("ScaledBorderAndShadow: yes"));
cek("header: Style pakai DejaVu Sans (font bundel)", ass1.includes("Sub,DejaVu Sans,"));

// ================= v0.51.0 — PERCEPATAN & BERSIH HALUSINASI =================

// --- rmsBlok: RMS sinyal ---
cek("rms: array kosong → 0", rmsBlok(new Float32Array(0)) === 0);
cek("rms: nol semua → 0", rmsBlok(new Float32Array(1000)) === 0);
const sinus = new Float32Array(4800);
for (let i = 0; i < sinus.length; i++) sinus[i] = Math.sin((2 * Math.PI * 440 * i) / 48000) * 0.5;
// RMS sinus penuh amplitudo A = A/√2 ≈ 0.354
cek("rms: sinus 0.5 → ±0.354", Math.abs(rmsBlok(sinus) - 0.5 / Math.SQRT2) < 0.01, rmsBlok(sinus));

// --- apakahBlokSunyi: ambang -50 dBFS ---
cek("sunyi: blok nol → true", apakahBlokSunyi(new Float32Array(4800)));
cek("sunyi: RMS 0.001 < ambang → true", apakahBlokSunyi(new Float32Array(4800).fill(0.001)));
cek("tidak sunyi: sinus 0.35 → false", !apakahBlokSunyi(sinus));
cek("ambang konsisten dgn ekspor", AMBATANG_SUNYI === 0.003);

// --- bersihSegmenHalusinasi ---
const S = (a: number, b: number, t: string) => ({ a, b, t });
// teks tanpa huruf/angka dibuang
cek("halusinasi: '…' tanpa huruf dibuang", bersihSegmenHalusinasi([S(0, 2, "…"), S(2, 4, "halo")]).length === 1);
// satu kata diulang ≥4× dibuang
cek("halusinasi: 'hah hah hah hah' dibuang", bersihSegmenHalusinasi([S(0, 2, "hah hah hah hah")]).length === 0);
// pengulangan 2–3× TETAP disimpan (konservatif)
cek("halusinasi: 'ya ya' 2× tetap disimpan", bersihSegmenHalusinasi([S(0, 2, "ya ya")]).length === 1);
// ≥3 identik berurutan → dilipat jadi 2
const loop = bersihSegmenHalusinasi([
  S(0, 2, "musik"), S(2, 4, "Musik"), S(4, 6, "MUSIK"), S(6, 8, "musik"), S(8, 10, "musik"),
]);
cek("halusinasi: 5× 'musik' berurutan → 2", loop.length === 2, loop.map((s) => s.t));
// teks berbeda berseling TIDAK dibuang
const seling = bersihSegmenHalusinasi([S(0, 2, "satu"), S(2, 4, "dua"), S(4, 6, "satu"), S(6, 8, "dua")]);
cek("halusinasi: teks berseling tetap utuh", seling.length === 4);
// waktu segmen tersimpan
cek("halusinasi: waktu a/b utuh", loop[0].a === 0 && loop[0].b === 2 && loop[1].a === 2 && loop[1].b === 4);

// --- perkiraanSisaDtk ---
cek("sisa: belum mulai → 0", perkiraanSisaDtk(0, 0, 10, 2) === 0);
cek("sisa: selesai ≥ total → 0", perkiraanSisaDtk(1000, 10, 10, 2) === 0);
// (1000ms/2)×8 = 4000ms÷2 jalur = 2000ms → dibulatkan 2 dtk
cek("sisa: 1 dtk per blok, 8 sisa, 2 jalur → 4 dtk", perkiraanSisaDtk(2000, 2, 10, 2) === 4, perkiraanSisaDtk(2000, 2, 10, 2));
cek("sisa: jalur NaN → dibulatkan ke 1", perkiraanSisaDtk(2000, 2, 10, Number.NaN) === 8);

// --- kunciCache: model cepat dgn akhiran "|cepat", bawaan tak berubah ---
const kTepat = kunciCache("v.mp4", 123, 456.7, 0, 60, "fokus");
const kCepat = kunciCache("v.mp4", 123, 456.7, 0, 60, "fokus", true);
cek("cache: bawaan 24 hex", kTepat.length === 24);
cek("cache: cepat ≠ tepat", kTepat !== kCepat);
cek("cache: mode ikut kunci", kTepat !== kunciCache("v.mp4", 123, 456.7, 0, 60, "deteksi"));
cek("cache: dipanggil tanpa arg opsi = tepat", kTepat === kunciCache("v.mp4", 123, 456.7, 0, 60));

// --- jumlahPipaParalel: mesin besar dapat 4 jalur (v0.51.0) ---
cek("jalur: 2 core → 1", jumlahPipaParalel(2, 16) === 1);
cek("jalur: 4 core RAM 4GB → 2", jumlahPipaParalel(4, 4) === 2);
cek("jalur: 5 core RAM 8GB → 2", jumlahPipaParalel(5, 8) === 2);
cek("jalur: 6 core RAM 7GB → 3", jumlahPipaParalel(6, 7) === 3);
cek("jalur: 8 core RAM 8GB → 4 (naik dari 3)", jumlahPipaParalel(8, 8) === 4);
cek("jalur: 16 core RAM 6GB → 3 (RAM kurang)", jumlahPipaParalel(16, 6) === 3);

// ================= v0.51.2 — MODEL CEPAT TAK LAGI HILANG DIAM-DIAM =================

// --- modelCepatTersedia: cek berkas Whisper Base di folder model (env disamarkan) ---
const { mkdtempSync, mkdirSync, closeSync, openSync, rmSync, existsSync } = await import("node:fs");
const { tmpdir } = await import("node:os");
const { join: gabungPath } = await import("node:path");
const envModelLama = process.env.VIDSPLIT_AI_MODELS;
const dirModelUji = mkdtempSync(gabungPath(tmpdir(), "vds-model-"));
const envModel = (d?: string) => {
  if (d === undefined) delete process.env.VIDSPLIT_AI_MODELS;
  else process.env.VIDSPLIT_AI_MODELS = d;
};
const sentuh = (p: string) => closeSync(openSync(p, "w"));
// struktur minimum model TEPAT — syarat cariDirModelAi menganggap folder valid
mkdirSync(gabungPath(dirModelUji, "onnx-community", "whisper-small"), { recursive: true });
sentuh(gabungPath(dirModelUji, "onnx-community", "whisper-small", "config.json"));
envModel(dirModelUji);
// simulasi bundel rilis v0.51.0 (CI hanya unduh whisper-small):
cek("modelCepat: hanya Small → tak tersedia (jatuh ke Tepat)", modelCepatTersedia() === false);
// setelah v0.51.2 CI mengunduh dua-duanya:
mkdirSync(gabungPath(dirModelUji, "onnx-community", "whisper-base"), { recursive: true });
sentuh(gabungPath(dirModelUji, "onnx-community", "whisper-base", "config.json"));
cek("modelCepat: Small+Base → tersedia", modelCepatTersedia() === true);
envModel(gabungPath(dirModelUji, "tak-ada"));
// v0.53.0 — cariDirModelAi punya KANDIDAT CADANGAN (cwd/assets/ai-models); di
// sandbox dgn model terunduh fallback itu ada → hasil mengikuti fallback, bukan
// env. Uji hermetic: hasil WAJIB sama dgn keberadaan base di kandidat cadangan.
const cadanganBase = gabungPath(process.cwd(), "assets", "ai-models", "onnx-community", "whisper-base", "config.json");
cek(
  "modelCepat: env folder tak ada → ikut kandidat cadangan (hermetic)",
  modelCepatTersedia() === existsSync(cadanganBase),
);
if (envModelLama === undefined) envModel(undefined); else envModel(envModelLama);
cek("modelCepat: hasil selalu boolean", typeof modelCepatTersedia() === "boolean");
rmSync(dirModelUji, { recursive: true, force: true });

// ================= v0.53.0 — TRANSKRIP LATAR (pipeline dgn render part) =================

// --- bagiBlokAudio dgn blok pertama kickstart (durasiPertama) ---
{
  // durasiPertama 0/undefined = perilaku lama PERSIS
  const lama = bagiBlokAudio(audioBuatan(601));
  const lama2 = bagiBlokAudio(audioBuatan(601), DURASI_BLOK, OVERLAP_BLOK, 0);
  cek("kickstart: param 0 = perilaku lama", lama.length === lama2.length && lama.length === 7);

  // 600 dtk, blok pertama 30 dtk → blok-0 [0, 31.5], blok-1 mulai tepat 30
  const k = bagiBlokAudio(audioBuatan(600), DURASI_BLOK, OVERLAP_BLOK, 30);
  cek("kickstart: blok-0 mulai 0", k[0].mulai === 0);
  cek("kickstart: blok-0 ≈ 30 + overlap", Math.abs(k[0].data.length / sr - (30 + OVERLAP_BLOK)) < 0.01, k[0].data.length / sr);
  cek("kickstart: blok-1 mulai = durasiPertama", Math.abs(k[1].mulai - 30) < 0.01, k[1].mulai);
  // zona menyambung: tiap blok menjangkau blok berikutnya (overlap nyata, tanpa celah)
  let nyambung = true;
  for (let i = 0; i < k.length - 1; i += 1) {
    const akhirI = k[i].mulai + k[i].data.length / sr;
    if (akhirI <= k[i + 1].mulai + 0.01 || k[i + 1].mulai + OVERLAP_BLOK > akhirI + 0.01) nyambung = false;
  }
  cek("kickstart: zona nyambung & overlap konsisten", nyambung);
  // blok terakhir mencapai ujung audio
  const akhirK = k[k.length - 1].mulai + k[k.length - 1].data.length / sr;
  cek("kickstart: blok akhir sampai ujung", Math.abs(akhirK - 600) < 0.01, akhirK);
  // semua blok menutup [0, 600] tanpa celah waktu
  const mulaiNaik = k.every((b, i) => i === 0 || b.mulai > k[i - 1].mulai);
  cek("kickstart: mulai terurut", mulaiNaik);
  // audio pendek (< kickstart+overlap) → jalur lama (1 blok)
  const pendek = bagiBlokAudio(audioBuatan(20), DURASI_BLOK, OVERLAP_BLOK, 30);
  cek("kickstart: audio 20 dtk tetap 1 blok", pendek.length === 1 && Math.abs(pendek[0].data.length / sr - 20) < 0.01);
}

// --- indeksBlokTerakhirSebelum: blok pengandung ujung zona part ---
{
  const zona = [
    { mulai: 0, akhir: 31.5 },
    { mulai: 30, akhir: 121.5 },
    { mulai: 120, akhir: 211.5 },
  ];
  cek("indeksBlok: t=0 → -1", indeksBlokTerakhirSebelum(zona, 0) === -1);
  cek("indeksBlok: t=20 → blok 0 (kickstart cepat)", indeksBlokTerakhirSebelum(zona, 20) === 0);
  cek("indeksBlok: t=30 persis → blok 0", indeksBlokTerakhirSebelum(zona, 30) === 0);
  cek("indeksBlok: t=45 → blok 1", indeksBlokTerakhirSebelum(zona, 45) === 1);
  cek("indeksBlok: t=130 → blok 2", indeksBlokTerakhirSebelum(zona, 130) === 2);
  cek("indeksBlok: t melewati semua → blok terakhir", indeksBlokTerakhirSebelum(zona, 500) === 2);
  cek("indeksBlok: daftar kosong → -1", indeksBlokTerakhirSebelum([], 10) === -1);
}

// --- balapanWaktu: janji lambat kena batas, janji cepat lolos ---
{
  const tidur = (ms: number) => new Promise((ok) => setTimeout(ok, ms));
  const lambat = balapanWaktu(tidur(300).then(() => "terlambat"), 30);
  cek("balapan: janji lambat → null", (await lambat) === null);
  const cepat2 = balapanWaktu(Promise.resolve("cepat"), 5000);
  cek("balapan: janji cepat → nilainya", (await cepat2) === "cepat");
  // janji yang kalah balapan lalu REJECT tidak boleh menjatuhkan proses
  const jahat = balapanWaktu(
    tidur(60).then(() => { throw new Error("rejection terlambat"); }),
    20,
  );
  cek("balapan: janji jahat → null", (await jahat) === null);
  await tidur(120); // beri waktu rejection terlambat terjadi (tak boleh crash)
}

// --- konstanta v0.53.0 ---
cek("kickstart: BLOK_PERTAMA_DTK = 30", BLOK_PERTAMA_DTK === 30);
cek("anti-hang: MAKS_DTK_BLOK = 900", MAKS_DTK_BLOK === 900);

console.log(`\n=== uji-subtitle: ${lulus} LULUS, ${gagal} GAGAL ===`);
if (gagal > 0) process.exit(1);
