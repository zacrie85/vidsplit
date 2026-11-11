// uji-v330.ts — Uji unit v3.3.0: cover NOVACUT + efek/transisi + animasi teks + whisper.cpp
// Jalankan: npx tsx scripts/uji-v330.ts
import { mkdirSync, writeFileSync, unlinkSync } from "node:fs";
import path from "node:path";
import * as C from "../src/lib/vidsplit/coverNovacut";
import * as E from "../src/lib/vidsplit/efekNovacut";
import * as F from "../src/lib/vidsplit/ffmpeg";
import * as Th from "../src/lib/vidsplit/thumbnail";
import * as W from "../src/lib/vidsplit/whisperCpp";
import * as Ty from "../src/lib/vidsplit/types";

let lolos = 0;
let gagal = 0;
const uji = (nama: string, fn: () => void) => {
  try {
    fn();
    lolos++;
    console.log(`  ✓ ${nama}`);
  } catch (e) {
    gagal++;
    console.error(`  ✗ ${nama}\n    ${e instanceof Error ? e.message : e}`);
  }
};

const dirTmp = "/tmp/uji-v330";
mkdirSync(dirTmp, { recursive: true });

// ---------- katalog cover NOVACUT ----------
uji("katalog 103 template (3 dasar + 100 NOVACUT)", () => {
  const katalog = C.daftarTemplateCover();
  if (katalog.length !== 103) throw new Error("dapat " + katalog.length);
  if (C.GAYA_DASAR_COVER.length !== 3) throw new Error("dasar bukan 3");
});
uji("validasi id template", () => {
  if (!C.templateCoverValid("impact--cyber")) throw new Error("impact--cyber ditolak");
  if (C.templateCoverValid("ngawur--abjad")) throw new Error("id ngawur diterima");
});
uji("SVG dirender utk SEMUA 103 template (2 rasio, 2 latar)", () => {
  const ukur = C.pengukurPerkiraan();
  for (const t of C.daftarTemplateCover()) {
    for (const [w, h, latar] of [
      [720, 1280, "adegan"],
      [1280, 720, "hitam"],
    ] as const) {
      const svg = C.svgCover(
        { template: t.id, W: w, H: h, judul: "Judul Uji Panjang Sekali Sampai Perlu Wrap Dua Baris", labelPart: "Part 07", latar, skalaPart: 1.5 },
        ukur,
      );
      if (!svg.includes("<svg") || !svg.includes("</svg>")) throw new Error(`SVG rusak: ${t.id}`);
    }
  }
});
uji("judul multi-baris \\n dihormati", () => {
  const svg = C.svgCover(
    { template: "modern", W: 720, H: 1280, judul: "baris satu\nbaris dua", labelPart: "", latar: "hitam" },
    C.pengukurPerkiraan(),
  );
  if (!svg.includes("baris satu") || !svg.includes("baris dua")) throw new Error("wrap gagal");
});
uji("render PNG server (resvg) utk 4 template perwakilan", () => {
  for (const id of ["modern", "klasik", "impact--cyber", "neon--sunset", "outline--mono"]) {
    const png = Th.renderCoverTemplatePng({
      template: id,
      W: 360,
      H: 640,
      judul: "Uji Render",
      labelPart: "Part 01",
      latar: "hitam",
    });
    if (png.length < 2000) throw new Error(`${id}: PNG terlalu kecil (${png.length} b)`);
  }
});

// ---------- efek & transisi ----------
uji("28 transisi → nama xfade ffmpeg semua dikenal", () => {
  const sah = new Set([
    "fade", "fadeblack", "fadewhite", "distance", "wipeleft", "wiperight", "wipeup", "wipedown",
    "slideleft", "slideright", "slideup", "slidedown", "smoothleft", "smoothright", "smoothup",
    "smoothdown", "circlecrop", "rectcrop", "circleclose", "circleopen", "horzclose", "horzopen",
    "vertclose", "vertopen", "diagbl", "diagbr", "diagtl", "diagtr", "hlslice", "hrslice",
    "vuslice", "vdslice", "dissolve", "pixelize", "radial", "hblur", "wipetl", "wipetr",
    "wipebl", "wipebr", "squeezeh", "squeezev", "zoomin", "fadegrays", "hlwind", "hrwind",
    "coverleft", "coverright", "revealleft", "revealright",
  ]);
  if (E.TRANSITIONS.length !== 28) throw new Error("jumlah " + E.TRANSITIONS.length);
  for (const t of E.TRANSITIONS)
    if (!sah.has(t.xfade)) throw new Error(`${t.id} → xfade tak dikenal: ${t.xfade}`);
});
uji("20 efek klip + planEffects parametrik", () => {
  if (E.CLIP_EFFECTS.length !== 20) throw new Error("jumlah efek " + E.CLIP_EFFECTS.length);
  const plan = E.planEffects(["grade-teal", "fx-vignette", "fx-bloom"], 720, 1280, 20, 30);
  if (!plan || plan.fragments.length < 3) throw new Error("plan gagal");
  if (!plan.fragments[0].startsWith("[fx0]")) throw new Error("label salah");
  const plan2 = E.planEffects(["fx-shake", "fx-kenburns"], 1080, 1920, 45, 30);
  if (!plan2 || !plan2.fragments[0].includes("crop=")) throw new Error("shake parametrik salah");
  const plan3 = E.planEffects(["fx-kenburns"], 720, 1280, 30, 25);
  if (!plan3 || !plan3.fragments[0].includes("s=720x1280")) throw new Error("kenburns s= salah");
});
uji("rapikanEfekKlip buang tak dikenal + batas 6", () => {
  const banyak = Array(10).fill("grade-teal").concat(["grade-vhs", "ngawur"]);
  if (E.rapikanEfekKlip(banyak).length !== 2) throw new Error("dedup gagal");
  const enam = ["grade-teal", "grade-noir", "grade-vhs", "fx-grain", "fx-vignette", "fx-letterbox", "fx-rgb"];
  if (E.rapikanEfekKlip(enam).length !== 6) throw new Error("batas 6 gagal");
  if (E.rapikanEfekKlip(["grade-teal", "bodoh", "grade-vhs"]).join(",") !== "grade-teal,grade-vhs")
    throw new Error("pembersihan gagal");
});

// ---------- bangunArgumenPart: xfade + efek + animasi ----------
const argumenDasar = (p: Ty.Pengaturan, extra: Partial<Parameters<typeof F.bangunArgumenPart>[0]> = {}) =>
  F.bangunArgumenPart({
    src: "/tmp/uji-v330/src.mp4",
    bg: null,
    logo: null,
    pengaturan: p,
    n: 3,
    mulai: 40,
    durasi: 20,
    W: 720,
    H: 1280,
    fps: 30,
    adaAudio: true,
    judulTxt: p.judul,
    partTxt: p.kataPart ? `Part 3` : "",
    deskripsiTxt: "",
    dirTmp,
    tag: "uji",
    codecArgs: ["-c:v", "libx264"],
    ...extra,
  });

uji("xfade antar part + efek klip + animasi masuk rantai", () => {
  const p: Ty.Pengaturan = {
    ...Ty.pengaturanDefault,
    judul: "Judul Uji",
    kataPart: "Part",
    efekTransisi: "crossfade",
    efekTransisiDurasi: 0.6,
    efekKlip: ["grade-teal", "fx-letterbox"],
    animasiTeks: "naik",
    introTemplate: "",
  };
  const { args } = argumenDasar(p, { transisiMasuk: { id: "crossfade", durasi: 0.6, mulaiPrev: 39.4 } });
  const filter = args[args.indexOf("-filter_complex") + 1];
  if (!filter.includes("[vta][vbh]xfade=transition=fade")) throw new Error("graf xfade salah");
  if (!filter.includes("concat=n=2:v=1:a=0")) throw new Error("concat salah");
  if (!filter.includes("alpha=") || !filter.includes("min(t/0.70,1)")) throw new Error("animasi naik hilang");
  if (!filter.includes("eq=contrast=1.18")) throw new Error("grade-teal hilang");
  if (!filter.includes("drawbox=x=0:y=0:w=iw:h=ih*0.115")) throw new Error("letterbox hilang");
  // input = sumber + anullsrc (audio) + ekor transisi = 3
  const jumlahInput = args.filter((x) => x === "-i").length;
  if (jumlahInput !== 3) throw new Error(`input harus 3 (sumber+audio+ekor), dapat ${jumlahInput}`);
});
uji("nol regresi: semua mati → tanpa xfade/alpha/efek", () => {
  const p: Ty.Pengaturan = {
    ...Ty.pengaturanDefault,
    judul: "",
    kataPart: "",
    efekTransisi: "",
    efekKlip: [],
    animasiTeks: "",
  };
  const { args } = argumenDasar(p);
  const filter = args[args.indexOf("-filter_complex") + 1];
  if (filter.includes("xfade") || filter.includes("alpha=")) throw new Error("ada jejak fitur baru");
  // input = sumber + anullsrc (tanpa audio asli) = 2
  if (args.filter((x) => x === "-i").length !== 2) throw new Error("input beda dari harapan");
});
uji("animasi slam & neon menghasilkan ekspresi khusus", () => {
  const p: Ty.Pengaturan = { ...Ty.pengaturanDefault, judul: "J", kataPart: "Part", animasiTeks: "slam", efekTransisi: "", efekKlip: [] };
  const { args } = argumenDasar(p);
  const filter = args[args.indexOf("-filter_complex") + 1];
  if (!filter.includes("pow(1-min(t/0.45,1),3)")) throw new Error("slam salah");
  const p2: Ty.Pengaturan = { ...p, animasiTeks: "neon" };
  const { args: a2 } = argumenDasar(p2);
  const f2 = a2[a2.indexOf("-filter_complex") + 1];
  if (!f2.includes("0.78+0.22*abs(sin(t*9))")) throw new Error("neon flicker salah");
});
uji("part terlalu pendek utk transisi → tanpa xfade", () => {
  const p: Ty.Pengaturan = { ...Ty.pengaturanDefault, efekTransisi: "flash", efekTransisiDurasi: 0.6, efekKlip: [], judul: "", kataPart: "" };
  const { args } = F.bangunArgumenPart({
    src: "/tmp/uji-v330/src.mp4", bg: null, logo: null, pengaturan: p, n: 2, mulai: 20, durasi: 0.4,
    W: 720, H: 1280, fps: 30, adaAudio: false, judulTxt: "", partTxt: "", deskripsiTxt: "",
    dirTmp, tag: "uji3", codecArgs: ["-c:v", "libx264"],
    transisiMasuk: { id: "flash", durasi: 0.6, mulaiPrev: 19.4 },
  });
  const filter = args[args.indexOf("-filter_complex") + 1];
  if (filter.includes("xfade")) throw new Error("xfade seharusnya dilewati");
});

// ---------- thumbnail template ----------
uji("bangunArgumenThumbnail cabang template overlay", () => {
  const pngTpl = path.join(dirTmp, "tpl.png");
  writeFileSync(pngTpl, "PNG");
  const aT = Th.bangunArgumenThumbnail({
    src: "/tmp/uji-v330/src.mp4",
    detik: 5,
    judulTxt: "J",
    labelTxt: "Part 1",
    W: 1280,
    H: 720,
    fileJudul: path.join(dirTmp, "j.txt"),
    fileLabel: path.join(dirTmp, "l.txt"),
    ukuranJudul: 52,
    ukuranLabel: 74,
    fontfile: "",
    gaya: "impact--cyber",
    templatePng: pngTpl,
    templateLatarHitam: false,
    keluar: path.join(dirTmp, "t.jpg"),
    format: "jpg",
  });
  if (!aT.some((x) => x.includes("overlay=0:0"))) throw new Error("overlay tidak ada");
  if (aT.filter((x) => x === "-i").length !== 2) throw new Error("input harus 2");
  // gaya dasar → rantai lama (tanpa overlay)
  const aD = Th.bangunArgumenThumbnail({
    src: "/tmp/uji-v330/src.mp4", detik: 5, judulTxt: "J", labelTxt: "Part 1", W: 1280, H: 720,
    fileJudul: path.join(dirTmp, "j.txt"), fileLabel: path.join(dirTmp, "l.txt"),
    ukuranJudul: 52, ukuranLabel: 74, fontfile: "", gaya: "modern",
    keluar: path.join(dirTmp, "t2.jpg"), format: "jpg",
  });
  if (aD.some((x) => x.includes("overlay=0:0,"))) throw new Error("gaya dasar tak boleh overlay");
});

// ---------- whisper.cpp ----------
uji("parseJsonWhisper + gabungKataWhisper", () => {
  const kata = W.parseJsonWhisper(
    JSON.stringify({
      transcription: [
        { offsets: { from: 0, to: 800 }, text: "Assalamualaikum," },
        { offsets: { from: 850, to: 1900 }, text: "selamat menonton." },
        { offsets: { from: 1900, to: 2600 }, text: "halo" },
      ],
    }),
  );
  if (kata.length !== 3) throw new Error("parse kata gagal");
  const seg = W.gabungKataWhisper(kata);
  // "menonton." berujung titik → flush; "halo" tanpa koma & jeda 0.7 (tidak > 0.7)
  // → SEGMENTASI BARU setelahnya karena kalimat sebelumnya sudah tertutup
  if (seg.length !== 2 || !seg[0].t.includes("Assalamualaikum,") || seg[1].t !== "halo")
    throw new Error("gabung gagal: " + JSON.stringify(seg));
});
uji("skorLeksikon jawa vs indonesia (port KINOSTRA)", () => {
  if (W.skorLeksikon("aku arep sinau basa jawa", ["aku", "arep", "sinau"]) < 0.6)
    throw new Error("skor jawa rendah");
  if (W.skorLeksikon("saya ingin belajar bahasa indonesia", ["aku", "arep", "sinau"]) > 0.34)
    throw new Error("skor id terlalu tinggi dgn kamus jawa");
});
uji("namaModelGgml 3 pilihan", () => {
  if (W.namaModelGgml("ringan") !== "ggml-tiny-q5_1.bin") throw new Error("tiny salah");
  if (W.namaModelGgml("cepat") !== "ggml-base-q5_1.bin") throw new Error("base salah");
  if (W.namaModelGgml("akurat") !== "ggml-small-q5_1.bin") throw new Error("small salah");
});

// ---------- migrasi simpanan ----------
uji("migrasi transisiPart & subtitle lama → mesin baru", () => {
  const k1 = Ty.migrasiSimpanan({ transisiPart: "fade" });
  if (k1.efekTransisi !== "crossfade" || k1.transisiPart !== "") throw new Error("fade gagal");
  const k2 = Ty.migrasiSimpanan({ transisiPart: "slide" });
  if (k2.efekTransisi !== "slide-l") throw new Error("slide gagal");
  const k3 = Ty.migrasiSimpanan({ subtitleCepat: false, subtitleDeteksiBahasa: true });
  if (k3.subtitleModel !== "akurat" || k3.subtitleBahasa !== "enid") throw new Error("subtitle gagal");
  const k4 = Ty.migrasiSimpanan({});
  if (k4.animasiTeks !== "" || k4.introTemplate !== "") throw new Error("default baru gagal");
});
uji("terapkanSebagian ikut efek & animasi", () => {
  const sumber: Ty.Pengaturan = {
    ...Ty.pengaturanDefault,
    efekTransisi: "flash",
    efekTransisiDurasi: 0.9,
    efekKlip: ["grade-noir"],
    animasiTeks: "fade",
  };
  const target = Ty.terapkanSebagian(sumber, { ...Ty.pengaturanDefault });
  if (target.efekTransisi !== "flash" || target.animasiTeks !== "fade") throw new Error("ikut gagal");
  if (JSON.stringify(target.efekKlip) !== '["grade-noir"]') throw new Error("efekKlip gagal");
});

// ---------- bersih-bersih ----------
try { unlinkSync(path.join(dirTmp, "tpl.png")); } catch {}

console.log(`\nHASIL: ${lolos} lolos, ${gagal} gagal`);
process.exit(gagal ? 1 : 0);
