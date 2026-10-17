// VidSplit v0.57.0 — uji unit FITUR BARU: kecepatan tayang, transisi antar part,
// potong & hapus bagian (zona hapus), proses paralel 10.
// Jalankan: bun scripts/uji-v057.ts
import { bangunArgumenPart } from "../src/lib/vidsplit/ffmpeg";
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import {
  pengaturanDefault,
  rapikanKecepatan,
  LANGKAH_KECEPATAN,
  DURASI_TRANSISI,
  rapikanZonaHapus,
  potonganEfektif,
  hitungPart,
  hitungPartDgnHapus,
  rentangPart,
  rentangPartHapus,
  durasiEfektif,
  type Pengaturan,
} from "../src/lib/vidsplit/types";

let lulus = 0;
let gagal = 0;
const cek = (k: boolean, label: string, detail = "") => {
  if (k) {
    lulus++;
    console.log(`  [LOLOS] ${label}`);
  } else {
    gagal++;
    console.error(`  [GAGAL] ${label} ${detail}`);
  }
};

const gabung = (args: string[]) => args.join("\u0001");

// file nyata utk guard existsSync (bg dipakai tes intro bg)
const BG = "/tmp/uji-bg-nyata.png";
if (!existsSync(BG)) {
  execFileSync("ffmpeg", ["-y", "-v", "error", "-f", "lavfi", "-i", "color=c=yellow:s=1080x1920", "-frames:v", "1", BG]);
}

// ===================== rapikanKecepatan =====================
console.log("\n== RAPIKAN KECEPATAN ==");
cek(LANGKAH_KECEPATAN.length === 7, "7 langkah 0,5–2");
cek(rapikanKecepatan(1) === 1, "1 → normal");
cek(rapikanKecepatan(0.5) === 0.5, "0,5 → slow-mo");
cek(rapikanKecepatan(2) === 2, "2 → tercepat");
cek(rapikanKecepatan(1.24) === 1.25, "1,24 → snap 1,25");
cek(rapikanKecepatan(1.9) === 2, "1,9 → snap 2");
cek(rapikanKecepatan(NaN) === 1, "NaN → 1");
cek(rapikanKecepatan(undefined) === 1, "undefined → 1");
cek(rapikanKecepatan(9) === 2, "9 (di luar) → snap terdekat 2");
cek(rapikanKecepatan(-3) === 0.5, "-3 (di luar) → snap terdekat 0,5");

// ===================== zona hapus: rapikanZonaHapus =====================
console.log("\n== RAPIKAN ZONA HAPUS ==");
const dz = (zonas: Array<[number, number]>, mulai = 0, akhir = 0, durasi = 600) =>
  rapikanZonaHapus(zonas.map(([m, a]) => ({ mulai: m, akhir: a })), mulai, akhir, durasi);
cek(dz([]).length === 0, "tanpa zona → kosong");
cek(dz([[100, 60]]).length === 1 && dz([[100, 60]])[0].mulai === 60, "mulai>akhir ditukar");
cek(dz([[100, 100.3]]).length === 0, "zona < 0,5 dtk dibuang");
cek(dz([[-50, 100], [500, 900]]).length === 2 && dz([[-50, 100]])[0].mulai === 0, "clip ke 0");
cek(dz([[500, 900]])[0].akhir === 600, "clip ke durasi video");
cek(dz([[100, 200], [150, 300]]).length === 1 && dz([[100, 200], [150, 300]])[0].akhir === 300, "tumpang-tindih digabung");
cek(dz([[300, 400], [100, 200]])[0].mulai === 100, "diurutkan menaik");
cek(dz([[100, 200]], 150, 0, 600)[0].mulai === 150, "zona di luar trim (kiri) di-clip");
cek(dz([[200, 300]], 0, 150, 600).length === 0, "zona seluruhnya di luar trim → dibuang");

// ===================== zona hapus: potongan & hitung part =====================
console.log("\n== POTONGAN EFEKTIF & HITUNG PART ==");
// video 600 dtk, trim penuh, hapus 100–200 & 300–350 → potongan 0–100, 200–300, 350–600
const pot = potonganEfektif(600, 0, 0, [
  { mulai: 100, akhir: 200 },
  { mulai: 300, akhir: 350 },
]);
cek(pot.length === 3, "2 zona → 3 potongan", JSON.stringify(pot));
cek(
  pot[0].mulai === 0 && pot[0].akhir === 100 && pot[1].mulai === 200 && pot[1].akhir === 300 && pot[2].mulai === 350 && pot[2].akhir === 600,
  "batas potongan tepat",
);
cek(
  hitungPartDgnHapus(600, 20, 0, 0, []) === hitungPart(durasiEfektif(600, 0, 0), 20),
  "tanpa zona = hitungPart lama PERSIS",
);
// 100/20=5 + 100/20=5 + 250/20=13 = 23
cek(hitungPartDgnHapus(600, 20, 0, 0, [{ mulai: 100, akhir: 200 }, { mulai: 300, akhir: 350 }]) === 23, "total part dgn zona = 23");
cek(hitungPartDgnHapus(600, 20, 0, 0, [{ mulai: 590, akhir: 600 }]) === hitungPart(durasiEfektif(600, 0, 0), 20), "zona 10 dtk di ujung tak mengubah total ceil");

// ===================== zona hapus: rentangPartHapus =====================
console.log("\n== RENTANG PART DENGAN ZONA ==");
const zonas = [{ mulai: 100, akhir: 200 }, { mulai: 300, akhir: 350 }];
// part 1..5 di potongan 1 (0–100)
cek(rentangPartHapus(1, 600, 20, 0, 0, zonas)[0] === 0 && rentangPartHapus(1, 600, 20, 0, 0, zonas)[1] === 20, "part 1 = 0–20");
cek(rentangPartHapus(5, 600, 20, 0, 0, zonas)[0] === 80, "part 5 = 80–100");
// part 6..10 di potongan 2 (200–300)
cek(rentangPartHapus(6, 600, 20, 0, 0, zonas)[0] === 200, "part 6 = 200 (LOMEPAT zona 100–200)");
cek(rentangPartHapus(10, 600, 20, 0, 0, zonas)[0] === 280, "part 10 = 280–300");
// part 11 mulai potongan 3 (350–600)
cek(rentangPartHapus(11, 600, 20, 0, 0, zonas)[0] === 350, "part 11 = 350 (LOMEPAT zona 300–350)");
// part terakhir (23) = potongan 3 (350–600 = 250 dtk → 13 part): part ke-13
// dari potongan = 350 + 12×20 = 590, durasi = min(20, 600−590) = 10
const [m23, d23] = rentangPartHapus(23, 600, 20, 0, 0, zonas);
cek(m23 === 590 && d23 === 10, "part 23 = 590–600 (durasi 10)");
// TIDAK ADA part yang memotong zona: telusuri semua part
let adaHamparan = false;
const total23 = hitungPartDgnHapus(600, 20, 0, 0, zonas);
for (let n = 1; n <= total23; n++) {
  const [m, d] = rentangPartHapus(n, 600, 20, 0, 0, zonas);
  for (const z of zonas) {
    if (m < z.akhir && m + d > z.mulai) adaHamparan = true;
  }
}
cek(!adaHamparan, "TIDAK ADA part memotong zona merah");
// tanpa zona = rentangPart lama persis
const [am, ad] = rentangPart(3, 600, 20, 0, 0);
const [bm, bd] = rentangPartHapus(3, 600, 20, 0, 0, []);
cek(am === bm && ad === bd, "tanpa zona = rentangPart lama PERSIS");

// ===================== bangunArgumenPart: KECEPATAN =====================
console.log("\n== ARGUMEN: KECEPATAN TAYANG ==");
const dasar: Pengaturan = { ...pengaturanDefault, judul: "Uji", kataPart: "Part", durasiPart: 3 };
const buat = (p: Partial<Pengaturan>, durasi = 10) =>
  bangunArgumenPart({
    src: "/tmp/x.mp4",
    bg: null,
    logo: null,
    pengaturan: { ...dasar, ...p },
    n: 1,
    mulai: 0,
    durasi,
    W: 720,
    H: 1280,
    fps: 30,
    adaAudio: true,
    judulTxt: "Uji",
    partTxt: "Part 1",
    deskripsiTxt: "",
    dirTmp: "/tmp",
    tag: "u57",
    codecArgs: ["-c:v", "libx264", "-preset", "ultrafast", "-crf", "23"],
    keluar: "/tmp/u57.mp4",
  });
{
  const { args, total } = buat({ kecepatanVideo: 1 });
  const g = gabung(args);
  cek(total === 10, "kecepatan 1: total = durasi sumber (perilaku lama)");
  cek(!g.includes("setpts=PTS/") && !g.includes("atempo="), "kecepatan 1: TANPA setpts/atempo (bit-exact lama)");
}
{
  const { args, total } = buat({ kecepatanVideo: 2 });
  const g = gabung(args);
  cek(Math.abs(total - 5) < 0.01, "kecepatan 2: total = 10/2 = 5", String(total));
  cek(g.includes("setpts=PTS/2.0000"), "video setpts=PTS/2");
  cek(g.includes("atempo=2"), "audio atempo=2");
}
{
  const { args, total } = buat({ kecepatanVideo: 0.5, durasi: 10 });
  const g = gabung(args);
  cek(Math.abs(total - 20) < 0.01, "kecepatan 0,5: total = 20 (slow-mo)", String(total));
  cek(g.includes("setpts=PTS/0.5000") && g.includes("atempo=0.5"), "setpts & atempo 0,5");
}
{
  // bg intro: total = (intro+durasi)/kecepatan
  const { total } = bangunArgumenPart({
    src: "/tmp/x.mp4",
    bg: "/tmp/uji-bg-nyata.png",
    logo: null,
    pengaturan: { ...dasar, kecepatanVideo: 2, durasiIntro: 3 },
    n: 1,
    mulai: 0,
    durasi: 10,
    W: 720,
    H: 1280,
    fps: 30,
    adaAudio: true,
    judulTxt: "Uji",
    partTxt: "Part 1",
    deskripsiTxt: "",
    dirTmp: "/tmp",
    tag: "u57b",
    codecArgs: ["-c:v", "libx264", "-preset", "ultrafast", "-crf", "23"],
    keluar: "/tmp/u57.mp4",
  });
  cek(Math.abs(total - 6.5) < 0.01, "dgn intro bg: total = (3+10)/2 = 6,5", String(total));
}

// ===================== bangunArgumenPart: TRANSISI =====================
console.log("\n== ARGUMEN: TRANSISI ANTAR PART ==");
{
  const { args } = buat({ transisiPart: "" });
  cek(!gabung(args).includes("fade="), "tanpa transisi: TANPA fade (perilaku lama)");
}
{
  const { args, total } = buat({ transisiPart: "fade" });
  const g = gabung(args);
  cek(g.includes(`fade=t=in:st=0:d=${DURASI_TRANSISI}`), "fade masuk 0,5 dtk");
  cek(g.includes(`fade=t=out:st=${(10 - DURASI_TRANSISI).toFixed(3)}`), "fade keluar total-0,5");
  cek(total === 10, "fade: total tak berubah");
}
{
  const { args } = buat({ transisiPart: "slide" });
  const g = gabung(args);
  cek(g.includes("color=c=black:s=720x1280"), "slide: latar hitam 720x1280");
  cek(g.includes("overlay=x='if(lt(t,0.5),W*(1-min(t/0.5,1))"), "slide: masuk dari kanan");
  cek(g.includes("-W*min((t-9.500)/0.5,1)"), "slide: keluar ke kiri (total-0,5)");
}
{
  // kecepatan + slide bersamaan
  const { args } = buat({ transisiPart: "slide", kecepatanVideo: 2 });
  const g = gabung(args);
  cek(g.includes("setpts=PTS/2.0000") && g.includes("[vspd]"), "slide+kecepatan: setpts jalan sebelum overlay");
  cek(g.includes("-W*min((t-4.500)/0.5,1)"), "slide+kecepatan: waktu slide pakai total HASIL (5-0,5)");
  cek(g.includes("atempo=2"), "slide+kecepatan: audio ikut dipercepat");
}
{
  const { args } = buat({ transisiPart: "fade", kecepatanVideo: 2 });
  const g = gabung(args);
  cek(g.includes("setpts=PTS/2.0000,fade=t=in:st=0:d=0.5"), "fade+kecepatan: setpts lalu fade");
  cek(g.includes("fade=t=out:st=4.500"), "fade+kecepatan: keluar di 5-0,5");
}

// ===================== proses paralel (sanitas) =====================
console.log("\n== PROSES PARALEL ==");
cek(pengaturanDefault.prosesParalel === 2, "bawaan paralel tetap 2 (aman)");
// batas 10 diverifikasi di PanelEkspor/jobs/route (cek string di sumber)
const fs = await import("node:fs");
const panel = fs.readFileSync("src/components/vds/PanelEkspor.tsx", "utf8");
const jobs = fs.readFileSync("src/lib/vidsplit/jobs.ts", "utf8");
const route = fs.readFileSync("src/app/api/export/route.ts", "utf8");
cek(panel.includes("max={10}"), "PanelEkspor: slider sampai 10");
cek(jobs.includes("Math.min(10,"), "jobs.ts: paralel maks 10");
cek(route.includes("clamp(p.prosesParalel, 1, 10, 2)"), "route: clamp 1–10");

console.log(`\nHASIL: ${lulus} lulus, ${gagal} gagal`);
process.exit(gagal ? 1 : 0);
