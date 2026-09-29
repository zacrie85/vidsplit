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

console.log(`\n=== uji-subtitle: ${lulus} LULUS, ${gagal} GAGAL ===`);
if (gagal > 0) process.exit(1);
