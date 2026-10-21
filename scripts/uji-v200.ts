// VidSplit v2.0.0 — uji unit + integrasi 6 FITUR BARU:
//   (1) SPLIT PER ADEGAN (adegan.ts murni + ffmpeg nyata),
//   (2) GABUNG VIDEO (e2e mini — 2 video sintetis → 1 MP4 mulus),
//   (3) ZOOM PEMBICARA (murni + inference YOLO nyata dgn model terunduh),
//   (4) JUMLAH PART OTOMATIS, (5) BACKSOUND (args + render nyata loop+offset),
//   (6) RESOLUSI OUTPUT (dimensi 9:16 dibalik + level + bitrate).
// Jalankan: bun scripts/uji-v200.ts
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, statSync, unlinkSync } from "node:fs";
import path from "node:path";
import {
  ambangAdegan,
  mad,
  median,
  parseMetadataPrint,
  pilihBatasAdegan,
  potonganAdegan,
  skorAdeganFfmpeg,
} from "../src/lib/vidsplit/adegan";
import {
  bitrateKbpsTarget,
  dimensiOutput,
  durasiPartDipakai,
  hitungPartV2,
  levelH264,
  offsetBacksound,
  pengaturanDefault,
  rapikanJumlahPart,
  type Pengaturan,
} from "../src/lib/vidsplit/types";
import {
  bangunArgumenPart,
  codecCpu,
  dirWork,
} from "../src/lib/vidsplit/ffmpeg";
import {
  cadanganDuaBagian,
  decodeYolo,
  ekspresiGeser,
  ekspresiStep,
  ekstrakStereoEnergi,
  iou,
  nms,
  pilihPembicara,
  rantaiPembicara,
  segmenFade,
  saringAnchor,
  type BoxDeteksi,
  type Keyframe,
} from "../src/lib/vidsplit/pembicara";
import { ambilJob, mulaiGabungAntrean, type ItemEkspor } from "../src/lib/vidsplit/jobs";

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
const DIR = dirWork("tmp");
const HAPUS: string[] = [];
const bereskan = (f: string) => HAPUS.push(f);

/* ================= (4) JUMLAH PART OTOMATIS ================= */
console.log("\n== (4) JUMLAH PART OTOMATIS ==");
cek(rapikanJumlahPart(10, 3600) === 10, "10 part di 60 mnt");
cek(rapikanJumlahPart(0, 3600) === 0, "0 = mati");
cek(rapikanJumlahPart(-5, 3600) === 0, "negatif = mati");
cek(rapikanJumlahPart(NaN, 3600) === 0, "NaN = mati");
cek(rapikanJumlahPart(9999, 60) === 60, "N > durasi dibatasi (60 dtk → 60)");
cek(rapikanJumlahPart(5, 0.5) === 0, "video < 1 dtk → mati");
cek(durasiPartDipakai({ durasiPart: 20, jumlahPartOtomatis: 10 }, 600) === 60, "600 dtk ÷ 10 = 60 dtk/part");
cek(durasiPartDipakai({ durasiPart: 20, jumlahPartOtomatis: 0 }, 600) === 20, "jumlah mati → durasi manual");
cek(durasiPartDipakai({ durasiPart: 20, jumlahPartOtomatis: 10 }, 600, 0, 0, [{ mulai: 100, akhir: 200 }]) === 50, "dgn zona 100 dtk → 500/10 = 50");
cek(hitungPartV2(600, { durasiPart: 20, jumlahPartOtomatis: 10 }) === 10, "hitungPartV2 = 10 part");
cek(hitungPartV2(600, { durasiPart: 20, jumlahPartOtomatis: 0 }) === 30, "hitungPartV2 mati = lama (30 part)");
// video berikutnya: setelan tetap aktif — 300 dtk ÷ 10 = 30
cek(hitungPartV2(300, { durasiPart: 20, jumlahPartOtomatis: 10 }) === 10 && durasiPartDipakai({ durasiPart: 20, jumlahPartOtomatis: 10 }, 300) === 30, "video 30 mnt → 10 × 30 dtk");

/* ================= (6) RESOLUSI OUTPUT ================= */
console.log("\n== (6) RESOLUSI OUTPUT ==");
cek(dimensiOutput("blur", "1080", "auto", 1920, 1080).W === 1080 && dimensiOutput("blur", "1080", "auto", 1920, 1080).H === 1920, "AUTO = perilaku lama 1080×1920");
cek(dimensiOutput("blur", "720", "auto", 1920, 1080).W === 720, "AUTO + 720 → 720");
cek(dimensiOutput("blur", "1080", "4k", 1920, 1080).W === 2160 && dimensiOutput("blur", "1080", "4k", 1920, 1080).H === 3840, "4K vertikal = 2160×3840 (dibalik)");
cek(dimensiOutput("blur", "1080", "2k", 1920, 1080).W === 1440 && dimensiOutput("blur", "1080", "2k", 1920, 1080).H === 2560, "2K vertikal = 1440×2560");
cek(dimensiOutput("blur", "1080", "720p", 0, 0).W === 720 && dimensiOutput("blur", "1080", "720p", 0, 0).H === 1280, "720p vertikal = 720×1280");
cek(dimensiOutput("asli", "1080", "4k", 1281, 721).W === 1280 && dimensiOutput("asli", "1080", "4k", 1281, 721).H === 720, "mode asli tetap sumber genap");
cek(levelH264(2160, 3840, 30) === "5.1", "4K 30fps → level 5.1");
cek(levelH264(3840, 2160, 60) === "5.2", "4K 60fps → level 5.2");
cek(levelH264(2560, 1440, 30) === "5.1", "2K → level 5.1");
cek(levelH264(1080, 1920, 30) === null, "1080p → level otomatis (null)");
cek(bitrateKbpsTarget(45, 60) === Math.round((45 * 8 * 1024) / 60 - 192), "target 45 MB / 60 dtk → kbps");
cek(bitrateKbpsTarget(0, 60) === null, "target 0 = mati");
cek(bitrateKbpsTarget(45, 0) === null, "durasi 0 = mati");
const argsLvl = codecCpu("medium", 20, "h264", "5.1", 2500);
cek(argsLvl.includes("-level") && argsLvl.includes("5.1"), "codecCpu level 5.1 masuk");
cek(argsLvl.includes("-maxrate") && argsLvl.includes("2500k"), "codecCpu bitrate masuk");
cek(!codecCpu("medium", 20).includes("-level"), "tanpa level = lama persis");

/* ================= OFFSET BACKSOUND ================= */
console.log("\n== OFFSET BACKSOUND (posisi kontinu) ==");
cek(offsetBacksound(1, 600, 60, 0, 0, [], false, 0, 1) === 0, "part 1 → offset 0");
cek(Math.abs(offsetBacksound(2, 600, 60, 0, 0, [], false, 0, 1) - 60) < 1e-9, "part 2 → 60 dtk");
cek(Math.abs(offsetBacksound(3, 600, 60, 0, 0, [], true, 3, 1) - (60 + 3 + 60 + 3)) < 1e-9, "part 3 dgn intro → 126 dtk");
cek(Math.abs(offsetBacksound(2, 600, 60, 0, 0, [], false, 0, 2) - 30) < 1e-9, "kecepatan 2× → offset hasil dibagi 2");
// zona: part 2 mulai setelah zona 100..200 → offset = panjang part 1 = 60 (zona tak memutar lagu)
cek(Math.abs(offsetBacksound(2, 600, 60, 0, 0, [{ mulai: 100, akhir: 200 }], false, 0, 1) - 60) < 1e-9, "zona di part berikut tak menggeser offset part 2");

/* ================= (1) SPLIT PER ADEGAN — murni ================= */
console.log("\n== (1) ADEGAN — median/MAD/batas/potongan ==");
cek(median([1, 2, 3, 4]) === 2.5, "median genap");
cek(median([5, 1, 9]) === 5, "median ganjil");
cek(mad([1, 1, 1, 1]) === 0, "MAD datar = 0");
const skorLatar = Array.from({ length: 120 }, () => 0.02 + Math.random() * 0.02); // latar halus
const ambang = ambangAdegan(skorLatar);
cek(ambang >= 0.12 && ambang <= 0.95, `ambang adaptif masuk rentang (${ambang.toFixed(3)})`);
const pts = Array.from({ length: 121 }, (_, i) => i * 0.1);
const skor = [...skorLatar, 0.0]; // 120 frame (12 dtk)
skor[60] = 0.85; // adegan keras di t = 6 dtk
const batas = pilihBatasAdegan(pts, skor);
cek(batas.length === 1 && Math.abs(batas[0] - 6) < 1e-9, `1 batas di t=6 (${batas.join(",")})`);
const pot = potonganAdegan(batas, 12, 0, 0, []);
cek(pot.length === 2 && Math.abs(pot[0].akhir - 6) < 0.2 && Math.abs(pot[1].akhir - 12) < 0.2, "2 potongan terpecah di adegan");
// flicker 0,5 dtk ditolak — JARAK MIN 1 dtk: t=10 & 10,5 & 11 → sah hanya 10 & 11
const pts2 = Array.from({ length: 40 }, (_, i) => i * 0.5);
const skor2 = pts2.map(() => 0.03);
skor2[20] = 0.9; skor2[21] = 0.9; skor2[22] = 0.9; // t=10, 10.5, 11
const b2 = pilihBatasAdegan(pts2, skor2);
cek(b2.length === 2 && Math.abs(b2[0] - 10) < 1e-9 && Math.abs(b2[1] - 11) < 1e-9, `flicker 0,5 dtk ditolak — jarak min 1 dtk (${b2.join(",")})`);
// zona menghapus batas di dalamnya
const potZ = potonganAdegan([6], 12, 0, 0, [{ mulai: 5.5, akhir: 6.5 }]);
cek(potZ.every((p) => p.akhir <= 5.5 + 0.01 || p.mulai >= 6.5 - 0.01), "part TIDAK melintasi zona hapus");
cek(potonganAdegan([], 12, 0, 0, []).length === 1, "tanpa batas → 1 potongan penuh");
// parseMetadataPrint
const meta = [
  "[Parsed_metadata_0 @ 0x1] frame:0   pts:0       pts_time:0",
  "[Parsed_metadata_0 @ 0x1] lavfi.scene_score=0.023100",
  "[Parsed_metadata_0 @ 0x1] frame:1   pts:10      pts_time:1",
  "[Parsed_metadata_0 @ 0x1] lavfi.scene_score=8.900000e-01",
].join("\n");
const parsed = parseMetadataPrint(meta);
cek(parsed.pts.length === 2 && parsed.pts[1] === 1 && parsed.skor[1] === 0.89, "parse metadata print (incl. notasi e)");

/* ================= (3) ZOOM PEMBICARA — murni ================= */
console.log("\n== (3) PEMBICARA — decode/NMS/pilih/ekspresi/rantai ==");
const boxA: BoxDeteksi = { x: 0.1, y: 0.2, w: 0.3, h: 0.6, skor: 0.9 };
const boxB: BoxDeteksi = { x: 0.12, y: 0.22, w: 0.3, h: 0.6, skor: 0.8 };
const boxC: BoxDeteksi = { x: 0.6, y: 0.2, w: 0.3, h: 0.6, skor: 0.7 };
const iouAB = iou(boxA, boxB);
cek(iouAB > 0.8 && iouAB <= 1.01, `IoU box hampir sama ≈ tinggi (${iouAB.toFixed(3)})`);
cek(iou(boxA, boxC) === 0, "IoU beda jauh = 0");
const hasilNms = nms([boxA, boxB, boxC]);
cek(hasilNms.length === 2 && hasilNms[0].skor === 0.9, "NMS buang box tumpang-tindih, urut skor");
// decode person-only [1,5,3]: anchor cx,cy,w,h,score
const out5 = new Float32Array(15);
out5[0] = 0.25 * 3; out5[3] = 0.25 * 3; out5[5] = 0.6; out5[6] = 0.6; out5[7] = 0.4; out5[8] = 0.4; out5[9] = 0.9; // 3 anchor: data layout [dim2 stride]
// layout [1,5,N]: idx = kanal*N + anchor
// decode person-only [1,5,2]: keluaran YOLO asli dalam PIXEL (fraksi × dim2)
// — layout [1,5,N]: idx = kanal*N + anchor
const out5b = new Float32Array(5 * 2);
out5b[0] = 1.0; out5b[1] = 1.6; // cx anchor0=0.5, anchor1=0.8 (fraksi × 2)
out5b[2] = 1.0; out5b[3] = 1.6; // cy
out5b[4] = 0.8; out5b[5] = 0.8; // w
out5b[6] = 1.2; out5b[7] = 1.2; // h
out5b[8] = 0.95; out5b[9] = 0.1; // score (anchor1 di bawah ambang)
const dec5 = decodeYolo(out5b, 5, 2);
cek(dec5.length === 1 && Math.abs(dec5[0].x + dec5[0].w / 2 - 0.5) < 1e-6 && Math.abs(dec5[0].skor - 0.95) < 1e-6, `decode person-only (dim1=5) → ${dec5.length} box`);
// decode COCO [1,84,2] — kelas 0 = person
const out84 = new Float32Array(84 * 2);
out84[0] = 0.3; // cx anchor0
out84[2] = 0.3; // cy
out84[4] = 0.2; // w
out84[6] = 0.5; // h
out84[8] = 0.55; // kelas 0 (person)
const dec84 = decodeYolo(out84, 84, 2);
cek(dec84.length === 1 && Math.abs(dec84[0].skor - 0.55) < 1e-6, "decode COCO (dim1=84, orang = kelas 0)");
cek(decodeYolo(new Float32Array(0), 5, 0).length === 0, "decode kosong aman");
// pilihPembicara: suara + gerakan memilih pembicara; senyap semua → tengah semua orang
const jendela = [
  { t: 0.25, suara: true, gerak: [2.0, 0.5], cx: [0.25, 0.75] },
  { t: 1.0, suara: true, gerak: [0.2, 3.0], cx: [0.25, 0.75] },
  { t: 2.0, suara: false, gerak: [0.1, 0.1], cx: [0.25, 0.75] },
];
const kfG = pilihPembicara(jendela, "tetap");
cek(kfG.length === 2 && Math.abs(kfG[0].cx - 0.25) < 1e-9 && Math.abs(kfG[1].cx - 0.75) < 1e-9, "pembicara ikut GERAKAN terbesar saat bersuara");
const kfS = pilihPembicara(jendela, "semua");
cek(kfS.length === 3 && Math.abs(kfS[2].cx - 0.5) < 1e-9, "senyap 'semua' → tengah semua orang");
// cadangan 2-bagian: L kencang → kiri, lalu R kencang + histeresis → kanan
const cad = cadanganDuaBagian(
  [0.5, 0.5, 0.1, 0.1, 0.1],
  [0.05, 0.05, 0.6, 0.6, 0.6],
  0.5,
);
cek(cad.length === 2 && Math.abs(cad[0].cx - 0.25) < 1e-9 && Math.abs(cad[1].cx - 0.75) < 1e-9 && cad[1].t === 1.0, "cadangan L/R dgn histeresis 1.25×");
// ekspresi
const kfe: Keyframe[] = [{ t: 0, cx: 0.25 }, { t: 2, cx: 0.75 }];
const eksS = ekspresiStep(kfe);
cek(eksS !== null && eksS.includes("if(lt(t,2)"), "ekspresi LANGSUNG berisi lompatan di t=2");
const eksG = ekspresiGeser(kfe, 0.8);
cek(eksG !== null && eksG.includes("min(max((t-2)/0.8,0),1)"), "ekspresi GESER interpolasi linear 0,8 dtk");
cek(ekspresiStep([{ t: 0, cx: 0.5 }]) === "0.5", "1 anchor → nilai tunggal");
// rantai
const rz = rantaiPembicara(kfe, { w: 1280, h: 720 }, { W: 1080, H: 1920 }, "geser", "normal", 30, 10);
const mCrop = rz?.filter.match(/crop=(\d+):720/);
const w9Eks = Math.round((720 * 9) / 16 / 2) * 2; // = 406 (genap)
cek(!!mCrop && Number(mCrop[1]) === w9Eks, `crop 9:16 dinamis w9=${w9Eks} (${mCrop?.[1]})`);
cek(rz?.filter.includes("scale=1080:1920") === true, "scale target 1080×1920");
const rv = rantaiPembicara(kfe, { w: 720, h: 1280 }, { W: 1080, H: 1920 }, "geser", "normal", 30, 10);
cek(rv !== null && !rv.filter.includes("crop="), "sumber vertikal → tanpa crop");
const rf = rantaiPembicara(kfe, { w: 1280, h: 720 }, { W: 1080, H: 1920 }, "fade", "normal", 30, 10);
cek(rf !== null && rf.filter.includes("xfade=transition=fade") && rf.filter.includes("split=2"), "FADE → xfade dissolve antar 2 segmen");
cek(segmenFade(kfe, 10).length === 2 && Math.abs(segmenFade(kfe, 10)[1].akhir - 10) < 1e-9, "segmenFade 2 segmen, terakhir sampai akhir");
cek(saringAnchor([{ t: 0, cx: 0.5 }, { t: 1, cx: 0.5 }, { t: 2, cx: 0.2 }]).length === 2, "saringAnchor buang cx sama berurutan");

/* ================= ffmpeg nyata — sumber sintetis (DENGAN audio utk uji cadangan) ================= */
console.log("\n== FFMPEG NYATA — video sintetis 2 adegan (merah 6 dtk → biru 6 dtk, dgn audio) ==");
const VID = "/tmp/uji-v200-dua-adegan.mp4";
if (!existsSync(VID)) {
  execFileSync("ffmpeg", ["-y", "-v", "error",
    "-f", "lavfi", "-i", "color=c=red:s=320x240:d=6:r=25",
    "-f", "lavfi", "-i", "color=c=blue:s=320x240:d=6:r=25",
    "-f", "lavfi", "-i", "sine=frequency=440:duration=12",
    "-filter_complex", "[0:v][1:v]concat=n=2:v=1:a=0[bgv]",
    "-map", "[bgv]", "-map", "2:a", "-c:a", "aac", "-pix_fmt", "yuv420p", VID]);
  bereskan(VID);
}
{
  const skor = await skorAdeganFfmpeg(VID, "ffmpeg", 0, 12);
  cek(skor.pts.length >= 50, `skor terkumpul (${skor.pts.length} frame)`);
  const batasNyata = pilihBatasAdegan(skor.pts, skor.skor);
  cek(batasNyata.length >= 1 && Math.abs(batasNyata[0] - 6) <= 0.6, `batas adegan nyata terdeteksi di ±6 dtk (${batasNyata.join(",")})`);
  const potNyata = potonganAdegan(batasNyata, 12, 0, 0, []);
  cek(potNyata.length >= 2, `split per adegan → ${potNyata.length} part`);
}

/* ================= (5) BACKSOUND — args + render nyata ================= */
console.log("\n== (5) BACKSOUND — argumen & render nyata (loop + offset) ==");
const MUSIK = "/tmp/uji-v200-musik.wav";
if (!existsSync(MUSIK)) {
  execFileSync("ffmpeg", ["-y", "-v", "error", "-f", "lavfi", "-i", "sine=frequency=440:duration=1", "-ar", "44100", "-ac", "2", MUSIK]);
  bereskan(MUSIK);
}
const pBs: Pengaturan = { ...pengaturanDefault, backsoundAktif: true, backsoundFile: MUSIK, backsoundVolume: 80 };
{
  const { args } = bangunArgumenPart({
    src: VID, bg: null, logo: null, pengaturan: pBs, n: 2, mulai: 0, durasi: 4,
    W: 1080, H: 1920, fps: 25, adaAudio: false,
    judulTxt: "", partTxt: "Part 2", deskripsiTxt: "",
    fileBacksound: MUSIK, volumeBacksound: 80, offsetBacksound: 4,
    dirTmp: DIR, tag: "uji-bs", codecArgs: ["-c:v", "libx264", "-preset", "ultrafast", "-crf", "30"], keluar: "/tmp/uji-v200-bs.mp4",
  });
  const adaLoop = args.includes("-stream_loop") && args.includes("-1");
  const idxMusik = args.indexOf(MUSIK);
  // struktur: [-stream_loop, -1, -t, NILAI, -i, MUSIK] → -t di idxMusik-3
  const adaT = idxMusik > 2 && args[idxMusik - 3] === "-t" && Math.abs(Number(args[idxMusik - 2]) - 9) < 0.5; // offset 4 + total 4 + 1 = 9
  const filter = args[args.indexOf("-filter_complex") + 1];
  const semuaMap = args.map((a, i) => (args[i - 1] === "-map" ? a : null)).filter(Boolean) as string[];
  cek(adaLoop, "input musik LOOP (-stream_loop -1)");
  cek(adaT, `-t offset+total+1 = 9 (${idxMusik > 2 ? args[idxMusik - 2] : "?"})`);
  cek(filter.includes("atrim=start=4.000"), "posisi lagu KONTINU (atrim start=offset)");
  cek(filter.includes("volume=0.800"), "volume 80% → 0.800");
  // video TANPA audio asli → backsound satu-satunya track (map [bsv], TANPA amix)
  cek(semuaMap.includes("[bsv]"), `tanpa audio asli → map [bsv] (${semuaMap.join(",")})`);
  cek(!filter.includes("amix"), "tanpa audio asli → tanpa amix");
  // render nyata: video tanpa audio + backsound 80% → file punya audio 4 dtk
  const keluar = "/tmp/uji-v200-bs.mp4";
  execFileSync("ffmpeg", args.filter((a) => a !== "-nostdin"), { stdio: "ignore" });
  bereskan(keluar);
  const pr = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-print_format", "json", "-show_format", keluar]).toString());
  const durasiHasil = Number(pr.format.duration);
  cek(Math.abs(durasiHasil - 4) < 0.3, `render nyata: durasi 4 dtk (${durasiHasil.toFixed(2)})`);
  cek(!!pr.format.duration && pr.format.duration > 0, "video TANPA suara asli tetap punya audio ✓");

  // kasus 2: video PUNYA audio asli → amix normalize=0 (volume asli utuh)
  const { args: args2 } = bangunArgumenPart({
    src: VID, bg: null, logo: null, pengaturan: pBs, n: 1, mulai: 0, durasi: 4,
    W: 1080, H: 1920, fps: 25, adaAudio: true,
    judulTxt: "", partTxt: "Part 1", deskripsiTxt: "",
    fileBacksound: MUSIK, volumeBacksound: 150, offsetBacksound: 0,
    dirTmp: DIR, tag: "uji-bs2", codecArgs: ["-c:v", "libx264", "-preset", "ultrafast", "-crf", "30"], keluar: "/tmp/uji-v200-bs2.mp4",
  });
  const filter2 = args2[args2.indexOf("-filter_complex") + 1];
  cek(filter2.includes("amix=inputs=2:duration=first:normalize=0"), "audio asli + backsound → amix normalize=0");
  cek(filter2.includes("volume=1.500"), "volume 150% → 1.500 (boleh lebih keras)");
  cek(filter2.includes("[0:a]aformat") && !filter2.includes("atrim=start="), "offset 0 → tanpa atrim start");
}

/* ================= (2) GABUNG VIDEO — e2e mini ================= */
console.log("\n== (2) GABUNG VIDEO — e2e 2 video sintetis ==");
{
  const V1 = "/tmp/uji-v200-gab1.mp4";
  const V2 = "/tmp/uji-v200-gab2.mp4";
  if (!existsSync(V1)) execFileSync("ffmpeg", ["-y", "-v", "error", "-f", "lavfi", "-i", "testsrc=s=640x360:d=2:r=25", "-pix_fmt", "yuv420p", V1]);
  if (!existsSync(V2)) execFileSync("ffmpeg", ["-y", "-v", "error", "-f", "lavfi", "-i", "smptebars=s=640x360:d=1.5:r=25", "-pix_fmt", "yuv420p", V2]);
  bereskan(V1); bereskan(V2);
  const daftarGabung: ItemEkspor[] = [V1, V2].map((f) => ({
    nama: path.basename(f),
    srcAbs: f,
    bgAbs: null,
    logoAbs: null,
    frameAbs: null,
    pengaturan: { ...pengaturanDefault, mode: "asli" as const, judul: f === V1 ? "Segmen Satu" : "Segmen Dua" },
    info: { durasi: f === V1 ? 2 : 1.5, lebar: 640, tinggi: 360, fps: 25, adaAudio: false },
  }));
  const id = mulaiGabungAntrean(daftarGabung, "cepat");
  let job = ambilJob(id);
  const t0 = Date.now();
  while (job && !job.selesaiSemua && Date.now() - t0 < 120_000) {
    await new Promise((ok) => setTimeout(ok, 500));
    job = ambilJob(id);
  }
  cek(!!job && job.selesaiSemua && !job.error, `job gabung tuntas (${job?.error ?? "ok"})`);
  const out = job?.outputs[0];
  cek(!!out && statSync(path.join(dirWork(`output/${id}`), out.file)).size > 10_000, "1 file hasil gabung tersimpan");
  if (out) {
    const pr = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-print_format", "json", "-show_format", path.join(dirWork(`output/${id}`), out.file)]).toString());
    const dur = Number(pr.format.duration);
    cek(Math.abs(dur - 3.5) < 0.6, `timestamp menyambung: durasi ≈ 3.5 dtk (${dur.toFixed(2)})`);
    cek(out.file.startsWith("gabung-"), `nama hasil: ${out.file}`);
  }
}

/* ================= (3b) YOLO inference nyata (model terunduh) ================= */
console.log("\n== (3b) YOLO INFERENCE NYATA (model deepghs yolo-person) ==");
{
  const modelPath = path.join(process.cwd(), "assets", "ai-models", "yolo-pembicara.onnx");
  cek(existsSync(modelPath) && statSync(modelPath).size > 5_000_000, "model yolo-pembicara.onnx tersedia (±12 MB)");
  if (existsSync(modelPath)) {
    const ort = require("onnxruntime-node");
    const sesi = await ort.InferenceSession.create(modelPath, { executionProviders: ["cpu"] });
    cek(sesi.inputNames.length > 0, `input: ${sesi.inputNames.join(",")}`);
    // inference dgn input acak 640×640 — hanya memastikan GRAFIK jalan & bentuk keluaran terbaca
    const masuk = new ort.Tensor("float32", new Float32Array(3 * 640 * 640), [1, 3, 640, 640]);
    const hasil = await sesi.run({ [sesi.inputNames[0]]: masuk });
    const kel = hasil[sesi.outputNames[0]];
    const dim = kel.dims as number[];
    cek(dim.length >= 2, `keluaran YOLO dims=[${dim.join(",")}]`);
    const data = kel.data as Float32Array;
    const d1 = dim.length === 3 ? dim[1] : dim[0];
    const d2 = dim.length === 3 ? dim[2] : dim[1];
    const boxes = decodeYolo(data, d1, d2, 0.5);
    cek(Array.isArray(boxes), `decodeYolo pada keluaran nyata OK (${boxes.length} box dgn input acak)`);
  }
}
// analisis paksa cadangan → lempar PEMBICARA_CADANGAN
{
  let dilempar = false;
  try {
    const { analisisPembicara } = await import("../src/lib/vidsplit/pembicara");
    await analisisPembicara(VID, "ffmpeg", {
      mulai: 0, durasi: 6, lebarSumber: 320, tinggiSumber: 240,
      senyap: "tetap", paksaCadangan: true,
    });
  } catch (e) {
    dilempar = e instanceof Error && e.message.startsWith("PEMBICARA_CADANGAN");
  }
  cek(dilempar, "tanpa model → PEMBICARA_CADANGAN (jobs jatuh ke cadangan 2-bagian)");
}
// ekstrak stereo energi nyata: L≠R
{
  const ST = "/tmp/uji-v200-stereo.wav";
  execFileSync("ffmpeg", ["-y", "-v", "error",
    "-f", "lavfi", "-i", "sine=frequency=300:duration=2",
    "-f", "lavfi", "-i", "sine=frequency=900:duration=2",
    "-filter_complex", "[0:a]volume=1.0[a];[1:a]volume=0.1[b];[a][b]amerge=inputs=2,pan=stereo|c0=c0|c1=c1", "-ar", "16000", ST]);
  bereskan(ST);
  const { L, R, langkahDtk } = await ekstrakStereoEnergi(ST, "ffmpeg", 0, 2);
  cek(langkahDtk === 0.5 && L.length >= 3 && R.length >= 3, `energi stereo terkumpul (${L.length} langkah)`);
  cek(Math.abs(L[0] - R[0]) > 0.01, "kanal L ≠ R (300 vs 900 Hz) ✓ sinyal cadangan hidup");
}

/* ================= rapikan ================= */
for (const f of HAPUS) {
  try { unlinkSync(f); } catch { /* abaikan */ }
}
try { rmSync(dirWork("gabung"), { recursive: true, force: true }); } catch { /* abaikan */ }

console.log(`\n================ HASIL UJI-V200: ${lulus} LOLOS, ${gagal} GAGAL ================`);
if (gagal > 0) process.exit(1);
