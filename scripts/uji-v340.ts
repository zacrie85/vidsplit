// uji-v340.ts — Uji unit v3.4.0: menu KINOSTRA (mod 13 cover berlapis + animasi,
// mod 08 vfx/watermark, mod 09 ken burns, mod 06 vocalis v4) + render nyata.
// Jalankan: bunx tsx scripts/uji-v340.ts
import { mkdirSync, writeFileSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import * as C from "../src/lib/vidsplit/coverNovacut";
import * as F from "../src/lib/vidsplit/ffmpeg";
import * as W from "../src/lib/vidsplit/whisperCpp";
import * as Ty from "../src/lib/vidsplit/types";
import { gerbangFastcut } from "../src/lib/vidsplit/fastcut";
import { bangunArgumenPart } from "../src/lib/vidsplit/ffmpeg";
import { pengukurPerkiraan } from "../src/lib/vidsplit/coverNovacut";

let lolos = 0;
let gagal = 0;
const uji = (nama: string, fn: () => void | Promise<void>) => {
  try {
    const r = fn();
    if (r instanceof Promise) {
      gagal++;
      console.error(`  ✗ ${nama}\n    uji async harus dipanggil via ujiAsync`);
      return;
    }
    lolos++;
    console.log(`  ✓ ${nama}`);
  } catch (e) {
    gagal++;
    console.error(`  ✗ ${nama}\n    ${e instanceof Error ? e.message : e}`);
  }
};
const ujiAsync = async (nama: string, fn: () => Promise<void>) => {
  try {
    await fn();
    lolos++;
    console.log(`  ✓ ${nama}`);
  } catch (e) {
    gagal++;
    console.error(`  ✗ ${nama}\n    ${e instanceof Error ? e.message : e}`);
  }
};

const dirTmp = "/tmp/uji-v340";
mkdirSync(dirTmp, { recursive: true });
const ukur = pengukurPerkiraan();
const P = { ...Ty.pengaturanDefault };

// ---------- 1. BINGKAI COVER (port NCCOVER_FRAMES) ----------
uji("svgCover bingkai klasik → rect emas + berlian + busur", () => {
  const svg = C.svgCover(
    { template: "impact--cyber", W: 540, H: 960, judul: "Tes", labelPart: "Part 01", latar: "adegan", bingkai: "klasik" },
    ukur,
  );
  if (!svg.includes("#ecd9a0")) throw new Error("warna emas bingkai klasik absen");
  if (!svg.includes("rotate(45")) throw new Error("berlian 45° absen");
});
uji("svgCover bingkai modern → bulat putih + aksen accent", () => {
  const svg = C.svgCover(
    { template: "neon--sunset", W: 540, H: 960, judul: "Tes", labelPart: "Part 01", latar: "adegan", bingkai: "modern" },
    ukur,
  );
  if (!svg.includes('stroke="#ffffff"')) throw new Error("bingkai putih modern absen");
  if (!svg.includes("#fb923c")) throw new Error("aksen palet absen");
});
uji("svgCover bingkai futuristik → oktagon + tick", () => {
  const svg = C.svgCover(
    { template: "lower--ice", W: 540, H: 960, judul: "Tes", labelPart: "Part 01", latar: "adegan", bingkai: "futuristik" },
    ukur,
  );
  if (!svg.includes("A") && !svg.includes("L ")) throw new Error("path oktagon absen");
});
uji("svgCover TANPA bingkai = output tanpa elemen bingkai (nol regresi)", () => {
  const a = C.svgCover({ template: "impact--cyber", W: 270, H: 480, judul: "Tes", labelPart: "P 1", latar: "hitam" }, ukur);
  const b = C.svgCover({ template: "impact--cyber", W: 270, H: 480, judul: "Tes", labelPart: "P 1", latar: "hitam", bingkai: "none" }, ukur);
  if (a !== b) throw new Error("bingkai none mengubah output");
  if (a.includes("#ecd9a0")) throw new Error("elemen bingkai bocor");
});

// ---------- 2. LAPISAN COVER (port ncBuildCoverLayers) ----------
uji("svgCoverLapis → 4 dokumen SVG (bg/judul/part/bingkai) non-kosong", () => {
  const L = C.svgCoverLapis(
    { template: "impact--cyber", W: 270, H: 480, judul: "Judul", labelPart: "Part 01", latar: "adegan", bingkai: "klasik" },
    ukur,
  );
  for (const k of ["bg", "judul", "part", "bingkai"] as const) {
    if (!L[k].startsWith("<svg") || !L[k].endsWith("</svg>")) throw new Error(`lapis ${k} bukan dokumen SVG utuh`);
  }
  if (!L.judul.includes("<text")) throw new Error("lapis judul tanpa teks");
  if (L.bg.includes("<text")) throw new Error("lapis bg harus TANPA teks (animasi terpisah)");
  if (!L.judul.includes("<defs>")) throw new Error("lapis judul NOVACUT butuh defs (glow)");
});
uji("svgCoverLapis template DASAR — bingkai hiasan pindah lapis bingkai", () => {
  const L = C.svgCoverLapis(
    { template: "klasik", W: 270, H: 480, judul: "Judul", labelPart: "Part 01", latar: "adegan" },
    ukur,
  );
  if (!L.bingkai.includes("#d4af37")) throw new Error("hiasan emas tak ada di lapis bingkai");
  if (L.bg.includes("#d4af37")) throw new Error("hiasan emas masih di lapis bg");
});
uji("svgCover gabungan = defs+bg+judul+part+bingkai (urutan lapis)", () => {
  const full = C.svgCover(
    { template: "impact--cyber", W: 270, H: 480, judul: "Judul", labelPart: "Part 01", latar: "adegan", bingkai: "klasik" },
    ukur,
  );
  const posDefs = full.indexOf("<defs>");
  const posBg = full.indexOf('fill="url(#ncg2)"');
  if (posDefs < 0 || posBg < 0 || posDefs > posBg) throw new Error("defs harus sebelum bg");
});

// ---------- 3. label part cover ----------
uji("labelPartCover: TANPA/#/EPS/BAGIAN", () => {
  if (Ty.labelPartCover("", 3) !== "") throw new Error("kosong harus tanpa label");
  if (Ty.labelPartCover("#", 3) !== "#3") throw new Error("# salah format");
  if (Ty.labelPartCover("EPS", 3) !== "EPS 03") throw new Error("EPS salah format");
  if (Ty.labelPartCover("bagian", 12) !== "BAGIAN 12") throw new Error("kata harus di-KAPITAL-kan");
});

// ---------- 4. ANIMASI MASUK COVER (port NCTEXTANIMS) ----------
uji("durasiAnimCover = min(0.55, dur×0.35)", () => {
  if (F.durasiAnimCover(2) !== 0.55) throw new Error("durasi panjang salah");
  if (Math.abs(F.durasiAnimCover(1) - 0.35) > 1e-9) throw new Error("durasi pendek salah");
});
uji("rantaiIntroKino: slam → zoompan + geq alpha ×2.2", () => {
  const r = F.rantaiIntroKino(P, {
    W: 540, H: 960, fps: 30, N: 2, D: 0.6,
    idxJudul: 3, idxPart: 4, idxBingkai: 5,
    animJudul: "slam", animPart: "slam",
  });
  if (!r.includes("zoompan=z='min(2.6")) throw new Error("zoompan slam absen");
  if (!r.includes("min(1,2.2*min(1,T/0.550))") && !r.includes("2.2*min(1,T/0.550)")) throw new Error("alpha slam absen");
  if (!r.includes("[4:v]")) throw new Error("lapis part tak mereferensikan inputnya");
  if (!r.includes("max(0,T-0.250)")) throw new Error("part harus ditunda 0.25 dtk");
});
uji("rantaiIntroKino: typewriter/wipe/tracking/glitch/neon → geq khas", () => {
  const mk = (anim: Ty.AnimasiCover) =>
    F.rantaiIntroKino(P, { W: 540, H: 960, fps: 30, N: 2, D: 0, idxJudul: 2, idxPart: -1, idxBingkai: -1, animJudul: anim, animPart: "" });
  if (!mk("typewriter").includes("if(lt(X,W*pow(min(1,T/0.550),0.85)),alpha(X,Y),0)")) throw new Error("kurva typewriter absen");
  if (!mk("wipe").includes("if(lt(X,W*(1-pow(1-min(1,T/0.550),3))),alpha(X,Y),0)")) throw new Error("wipe absen");
  if (!mk("tracking").includes("(W/2+(X-W/2)*(1+(1-(1-pow(1-min(1,T/0.550),3)))*0.12)")) throw new Error("spread tracking absen");
  const gl = mk("glitch");
  if (!gl.includes("sin(T*47)") || !gl.includes("sin(T*31)")) throw new Error("jitter glitch absen");
  if (!mk("neon").includes("0.78+0.22*abs(sin(T*18))")) throw new Error("kedip neon absen");
});
uji("rantaiIntroKino: rise → overlay y naik + animasi TANPA = teks hanya bg", () => {
  const r = F.rantaiIntroKino(P, { W: 540, H: 960, fps: 30, N: 2, D: 0, idxJudul: 2, idxPart: -1, idxBingkai: -1, animJudul: "rise", animPart: "" });
  if (!r.includes("*86.4")) throw new Error("dy rise (9% × 960) absen");
  const kosong = F.rantaiIntroKino(P, { W: 540, H: 960, fps: 30, N: 2, D: 0, idxJudul: 2, idxPart: -1, idxBingkai: -1, animJudul: "", animPart: "" });
  if (kosong.includes("geq")) throw new Error("TANPA animasi tidak boleh ada geq");
});
uji("rantaiIntroKino: bingkai statis paling atas (overlay terakhir)", () => {
  const r = F.rantaiIntroKino(P, { W: 540, H: 960, fps: 30, N: 2, D: 0, idxJudul: 2, idxPart: 3, idxBingkai: 4, animJudul: "fade", animPart: "fade" });
  const posBk = r.indexOf("[4:v]");
  if (posBk < 0) throw new Error("lapis bingkai absen");
  if (r.lastIndexOf("overlay") < posBk) throw new Error("bingkai bukan overlay terakhir");
});

// ---------- 5. EFEK VISUAL (mod 08) ----------
uji("rantaiVfx: eq manual + vignette + grain + filter warna", () => {
  const p = { ...P, vfxKecerahan: 1.2, vfxKontras: 0.9, vfxKejenuhan: 1.4, vfxVignette: true, vfxGrain: true, vfxFilter: "noir" };
  const b = F.rantaiVfx(p);
  if (!b) throw new Error("vfx aktif harus menghasilkan rantai");
  const s = b.join(",");
  if (!s.includes("eq=brightness=0.200:contrast=0.900:saturation=1.400")) throw new Error("eq manual salah");
  if (!s.includes("hue=s=0") || !s.includes("eq=contrast=1.24:brightness=0.02")) throw new Error("noir salah");
  if (!s.includes("vignette=angle=PI/5") || !s.includes("noise=alls=7:allf=t+u")) throw new Error("vignette/grain absen");
});
uji("rantaiVfx: semua nilai netral → null (nol regresi)", () => {
  if (F.rantaiVfx(P) !== null) throw new Error("bawaan harus tanpa rantai vfx");
});
uji("rantaiFilterWarna 10 gaya semuanya berantai", () => {
  for (const f of Ty.FILTER_WARNA) {
    const b = F.rantaiFilterWarna(f.k);
    if (f.k === "" && b.length) throw new Error("NORMAL harus kosong");
    if (f.k !== "" && !b.length) throw new Error(`filter ${f.k} kosong`);
  }
  if (!F.rantaiFilterWarna("dangdut").join().includes("colorchannelmixer")) throw new Error("sepia dangdut absen");
  if (!F.rantaiFilterWarna("horor").join().includes("hue=h=-12")) throw new Error("hue horor absen");
});

// ---------- 6. KEN BURNS VIDEO (mod 09) ----------
uji("rantaiKenburns: in/out/panx/pany/diag/off", () => {
  if (F.rantaiKenburns("off", 0.3, 540, 960, 30, 10)) throw new Error("off harus null");
  const zin = F.rantaiKenburns("in", 0.3, 540, 960, 30, 10)!;
  if (!zin.includes("min(1+0.300*min(on/(30*10.000),1)")) throw new Error("zoom in salah");
  const pan = F.rantaiKenburns("panx", 0.3, 540, 960, 30, 10)!;
  if (!pan.includes("z='1.150'")) throw new Error("zoom tetap pan salah");
  if (!F.rantaiKenburns("diag", 0.3, 540, 960, 30, 10)!.includes("(iw-iw/zoom)/2+")) throw new Error("diag absen");
});

// ---------- 7. WATERMARK (mod 08) ----------
uji("posisiWmTeks 4 sudut + pad 28u", () => {
  const br = F.posisiWmTeks("br", 1080, 1920);
  if (br.x !== "main_w-text_w-49.8" || br.y !== "main_h-text_h-49.8") throw new Error(`br salah: ${br.x}, ${br.y}`);
  const tl = F.posisiWmTeks("tl", 1080, 1920);
  if (tl.x !== "49.8" || tl.y !== "49.8") throw new Error("tl salah");
  const tr = F.posisiWmTeks("tr", 1080, 1080);
  if (tr.x !== "main_w-text_w-28.0" || tr.y !== "28.0") throw new Error("tr salah");
});

// ---------- 8. bangunArgumenPart: wm teks + lapisan + transisi cover ----------
function argPart(opsi: Partial<Ty.Pengaturan>, lapis = false) {
  const p = { ...Ty.pengaturanDefault, introAktif: true, ...opsi };
  const bg = path.join(dirTmp, "bg.png");
  const judul = path.join(dirTmp, "j.png");
  const part = path.join(dirTmp, "p.png");
  const bingkai = path.join(dirTmp, "b.png");
  for (const f of [bg, judul, part, bingkai]) writeFileSync(f, "png");
  return bangunArgumenPart({
    src: path.join(dirTmp, "src.mp4"),
    bg,
    ...(lapis ? { bgJudul: judul, bgPartLapis: part, bgBingkai: bingkai } : {}),
    logo: null,
    pengaturan: p,
    n: 1,
    mulai: 0,
    durasi: 5,
    W: 540,
    H: 960,
    fps: 30,
    adaAudio: false,
    judulTxt: "Judul",
    partTxt: "Part 1",
    dirTmp,
    tag: "t",
    codecArgs: ["-c:v", "libx264"],
    keluar: path.join(dirTmp, "out.mp4"),
  });
}
uji("wmMode teks → drawtext textfile wm.txt", () => {
  const { args } = argPart({ wmMode: "teks", wmTeks: "@KAMU" });
  const filter = args[args.indexOf("-filter_complex") + 1];
  if (!filter.includes("wm.txt")) throw new Error("textfile wm absen");
  if (!filter.includes("fontcolor=white@0.60")) throw new Error("opasitas wm absen");
});
uji("transisi antar part: fps= HARUS paling akhir (bug laten v3.3.0 — 1/0)", () => {
  const p = { ...Ty.pengaturanDefault, durasiPart: 12, efekTransisi: "crossfade" };
  const { args } = bangunArgumenPart({
    src: path.join(dirTmp, "src.mp4"),
    bg: null,
    logo: null,
    pengaturan: p,
    n: 2,
    mulai: 12,
    durasi: 12,
    W: 540,
    H: 960,
    fps: 30,
    adaAudio: false,
    judulTxt: "",
    partTxt: "",
    transisiMasuk: { id: "crossfade", durasi: 0.5, mulaiPrev: 11.5 },
    dirTmp,
    tag: "fpsakhir",
    codecArgs: ["-c:v", "libx264"],
    keluar: path.join(dirTmp, "fpsakhir.mp4"),
  });
  const filter = args[args.indexOf("-filter_complex") + 1];
  // produser label: …,fps=30[vta] / …,fps=30[vbh] — fps PALING AKHIR
  if (!filter.includes("setpts=PTS-STARTPTS,fps=30[vta]"))
    throw new Error("fps harus tepat sesudah setpts terakhir di [vta]");
  if (!filter.includes("settb=AVTB,fps=30[vbh]"))
    throw new Error("fps harus paling akhir di [vbh]");
  if (/settb=AVTB,trim=[^;]*\[vta\]/.test(filter) && !/fps=30\[vta\]/.test(filter))
    throw new Error("fps hilang dari [vta]");
});
uji("coverTrans flash → xfade fadewhite + durasi tersambung", () => {
  const { args } = argPart({ introAktif: true, coverTrans: "flash", coverTransDurasi: 0.8 });
  const filter = args[args.indexOf("-filter_complex") + 1];
  if (!filter.includes("xfade=transition=fadewhite:duration=0.800")) throw new Error("xfade flash absen");
});
uji("coverTrans kosong + introFade false → concat kering", () => {
  const { args } = argPart({ introAktif: true, coverTrans: "", introFade: false });
  const filter = args[args.indexOf("-filter_complex") + 1];
  if (filter.includes("xfade=")) throw new Error("tidak boleh ada xfade");
});
uji("lapisan cover → lapis beranimasi geq + lapis TANPA anim tetap digambar statis (v3.7.2)", () => {
  const { args } = argPart({ introAktif: true, coverAnimJudul: "fade", coverAnimPart: "" }, true);
  const filter = args[args.indexOf("-filter_complex") + 1];
  if (!filter.includes("[3:v]")) throw new Error("indeks judul lapis salah");
  // v3.7.2 — lapis TANPA animasi tetap digambar (overlay statis), bukan dibuang:
  // dulu "input lapis nganggur tidak boleh ada" → judul/part tanpa anim HILANG
  // dari ekspor saat pasangannya beranimasi (mode lapis).
  if (!filter.includes("[4:v]")) throw new Error("lapis part tanpa anim harus tetap digambar statis (v3.7.2)");
  const nGeq = (filter.match(/geq=r='r\(X,Y\)'/g) || []).length;
  if (nGeq !== 1) throw new Error(`geq hanya utk lapis beranimasi (dapat ${nGeq})`);
  if (filter.includes("setsar=1geq")) throw new Error("koma antar filter hilang");
  if (filter.includes("fps=30format=")) throw new Error("koma sesudah zoompan hilang");
});
uji("lapisan lengkap (judul+part+bingkai) → [3:v]/[4:v]/[5:v] berurutan", () => {
  const { args } = argPart({ introAktif: true, coverAnimJudul: "slam", coverAnimPart: "wipe", coverBingkai: "klasik" }, true);
  const filter = args[args.indexOf("-filter_complex") + 1];
  for (const idx of ["[3:v]", "[4:v]", "[5:v]"]) {
    if (!filter.includes(idx)) throw new Error(`indeks ${idx} absen`);
  }
});
uji("animasi TANPA → rantai intro polos (tanpa input lapis)", () => {
  const { args } = argPart({ introAktif: true, coverAnimJudul: "", coverAnimPart: "" }, true);
  const filter = args[args.indexOf("-filter_complex") + 1];
  if (filter.includes("geq")) throw new Error("animasi TANPA tidak boleh memakai geq");
});
uji("fastcut gerbang: vfx/wm/kb memaksa render", () => {
  const info = { lebar: 1080, tinggi: 1920, durasi: 10, fps: 30, adaAudio: false, codec: "h264", ukuran: 1 } as never;
  const alasan = (o: Partial<Ty.Pengaturan>) => gerbangFastcut({ ...Ty.pengaturanDefault, mode: "asli", judul: "", kataPart: "", deskripsi: "", ...o }, info as never);
  if (alasan({ vfxKecerahan: 1.3 }) !== "KECERAHAN") throw new Error("kecerahan tak mengunci");
  if (alasan({ wmMode: "teks", wmTeks: "@A" }) !== "WATERMARK TEKS") throw new Error("wm teks tak mengunci");
  if (alasan({ kbMode: "in" }) !== "KEN BURNS") throw new Error("kb tak mengunci");
  if (alasan({}) !== null) throw new Error("setelan bersih harus boleh fastcut");
});

// ---------- 9. migrasi & bawaan ----------
uji("bawaan v3.4.0: cover slam/slam + transisi flash + vfx netral", () => {
  if (Ty.pengaturanDefault.coverAnimJudul !== "slam") throw new Error("anim judul default salah");
  if (Ty.pengaturanDefault.coverAnimPart !== "slam") throw new Error("anim part default salah");
  if (Ty.pengaturanDefault.coverTrans !== "flash") throw new Error("transisi default salah");
  if (Ty.pengaturanDefault.subtitleLewatiSunyi !== true) throw new Error("lewati sunyi default salah");
  if (Ty.pengaturanDefault.wmMode !== "off") throw new Error("wm default salah");
});
uji("migrasi: introTemplate → coverLayout/palet; introFade → coverTrans", () => {
  const a = Ty.migrasiSimpanan({ introTemplate: "neon--gold", introFade: true } as never);
  if (a.coverLayout !== "neon" || a.coverPalet !== "gold") throw new Error("layout/palet salah");
  if (a.coverTrans !== "crossfade") throw new Error("fade lama harus → crossfade");
  if (a.coverAnimJudul !== "") throw new Error("simpanan lama harus animasi TANPA (nol regresi)");
  const b = Ty.migrasiSimpanan({ introTemplate: "" } as never);
  // v3.7.0 — seg "GAYA LAMA" dihapus dr UI (permintaan user: menu cover lama
  // membingungkan) → nilai polos/gaya-lama dipetakan ke layout KINOSTRA:
  // "" → impact, modern → boxed, klasik → impact, futuristik → neon.
  if (b.coverLayout !== "impact") throw new Error(`polos harus → impact (dapat ${b.coverLayout})`);
  const c = Ty.migrasiSimpanan({ logoId: "upload/x.png" } as never);
  if (c.wmMode !== "logo") throw new Error("logoId lama → wmMode logo");
  const d = Ty.migrasiSimpanan({} as never);
  if (d.coverSumber !== "auto" || d.coverKataPart !== "" || d.subtitleGeser !== 0) throw new Error("field baru harus terisi bawaan");
});

// ---------- 10. VOCALIS v4 (mod 06): blok bicara + lewati sunyi ----------
uji("jendelaSuaraPcm + blokBicara: senyap dilompati, lagu lebih longgar", () => {
  const sr = 16000;
  const pcm = new Int16Array(sr * 10);
  // suara 1–3 dtk dan 6–8 dtk (sinus keras), sisanya senyap
  for (let i = sr * 1; i < sr * 3; i++) pcm[i] = Math.round(Math.sin((i / sr) * 440 * 2 * Math.PI) * 12000);
  for (let i = sr * 6; i < sr * 8; i++) pcm[i] = Math.round(Math.sin((i / sr) * 440 * 2 * Math.PI) * 12000);
  const j = W.jendelaSuaraPcm(pcm, sr, false);
  if (j.length < 2) throw new Error(`jendela suara kurang (${j.length})`);
  const blok = W.blokBicara(j, 10, false);
  if (blok.length !== 2) throw new Error(`blok harus 2 (dapat ${blok.length})`);
  if (blok[0][0] > 1.2 || blok[1][1] < 7.5) throw new Error("rentang blok meleset");
  // mode lagu: ambang lebih rendah — suara pelan (±1500) ikut terdeteksi
  const pcmL = new Int16Array(sr * 6);
  for (let i = sr * 2; i < sr * 4; i++) pcmL[i] = Math.round(Math.sin((i / sr) * 330 * 2 * Math.PI) * 1500);
  const jL = W.jendelaSuaraPcm(pcmL, sr, true);
  if (!jL.length) throw new Error("mode lagu tak mendeteksi vokal pelan");
});
uji("bacaPcmWav: header WAV standar terbaca", () => {
  const f = path.join(dirTmp, "tes.wav");
  const sr = 8000;
  const data = Buffer.alloc(sr * 2);
  for (let i = 0; i < sr; i++) data.writeInt16LE(i % 100, i * 2);
  const hdr = Buffer.alloc(44);
  hdr.write("RIFF", 0); hdr.writeUInt32LE(36 + data.length, 4); hdr.write("WAVE", 8);
  hdr.write("fmt ", 12); hdr.writeUInt32LE(16, 16); hdr.writeUInt16LE(1, 20); hdr.writeUInt16LE(1, 22);
  hdr.writeUInt32LE(sr, 24); hdr.writeUInt32LE(sr * 2, 28); hdr.writeUInt16LE(2, 32); hdr.writeUInt16LE(16, 34);
  hdr.write("data", 36); hdr.writeUInt32LE(data.length, 40);
  writeFileSync(f, Buffer.concat([hdr, data]));
  const pcm = W.bacaPcmWav(f);
  if (!pcm || pcm.length !== sr) throw new Error("PCM salah panjang");
  if (pcm[10] !== 10) throw new Error("isi PCM salah");
});

// ---------- 11. RENDER NYATA — rantai KINOSTRA jalan di ffmpeg asli ----------
const ffmpegBin = process.env.FFMPEG || "ffmpeg";
async function jalan(args: string[]): Promise<void> {
  const { spawn } = await import("node:child_process");
  await new Promise<void>((resolve, reject) => {
    const p = spawn(ffmpegBin, args, { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    p.stderr.on("data", (d) => (err += d.toString()));
    p.on("close", (k) => (k === 0 ? resolve() : reject(new Error(err.split("\n").slice(-3).join(" | ")))));
    p.on("error", reject);
  });
}
async function renderNyata(nama: string, opsi: Partial<Ty.Pengaturan>, lapis: boolean): Promise<number> {
  const src = path.join(dirTmp, "sumber.mp4");
  if (!existsSync(src)) {
    await jalan([
      "-y", "-hide_banner", "-loglevel", "error",
      "-f", "lavfi", "-i", "testsrc2=size=270x480:rate=30:duration=4",
      "-f", "lavfi", "-i", "sine=frequency=440:duration=4",
      "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", "-c:a", "aac", src,
    ]);
  }
  // PNG lapisan asli (SVG → resvg sederhana pakai coverNovacut penuh)
  const bg = path.join(dirTmp, "bg.png");
  const judul = path.join(dirTmp, "lap-j.png");
  const part = path.join(dirTmp, "lap-p.png");
  const bingkai = path.join(dirTmp, "lap-b.png");
  await jalan(["-y", "-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "color=c=gray:s=540x960:d=1", "-frames:v", "1", bg]);
  const L = C.svgCoverLapis(
    { template: "impact--cyber", W: 540, H: 960, judul: "Judul Uji", labelPart: "Part 01", latar: "adegan", bingkai: "klasik" },
    ukur,
  );
  const { renderSvgCoverPng } = await import("../src/lib/vidsplit/thumbnail");
  writeFileSync(judul, renderSvgCoverPng(L.judul, 540, 960));
  writeFileSync(part, renderSvgCoverPng(L.part, 540, 960));
  writeFileSync(bingkai, renderSvgCoverPng(L.bingkai, 540, 960));
  const keluar = path.join(dirTmp, `${nama}.mp4`);
  const { args } = bangunArgumenPart({
    src,
    bg,
    ...(lapis ? { bgJudul: judul, bgPartLapis: part, bgBingkai: bingkai } : {}),
    logo: null,
    pengaturan: { ...Ty.pengaturanDefault, introAktif: true, durasiIntro: 2, ...opsi },
    n: 1,
    mulai: 0,
    durasi: 4,
    W: 540,
    H: 960,
    fps: 30,
    adaAudio: true,
    judulTxt: "Judul Uji",
    partTxt: "Part 01",
    dirTmp,
    tag: nama,
    codecArgs: ["-c:v", "libx264", "-preset", "ultrafast", "-crf", "30"],
    keluar,
  });
  await jalan(args);
  const st = statSync(keluar);
  if (st.size < 10_000) throw new Error(`hasil terlalu kecil (${st.size} B)`);
  return st.size;
}
const utama = async () => {
await ujiAsync("RENDER: cover animasi slam+slam + bingkai klasik + transisi flash", async () => {
  const ukuran = await renderNyata("kino-slam", { coverTrans: "flash", coverTransDurasi: 0.6 }, true);
  console.log(`      (${(ukuran / 1024).toFixed(0)} KB)`);
});
await ujiAsync("RENDER: typewriter + wipe + neon flicker", async () => {
  await renderNyata("kino-typewriter", { coverAnimJudul: "typewriter", coverAnimPart: "wipe", coverTrans: "" }, true);
});
await ujiAsync("RENDER: vfx noir + grain + ken burns diag + wm teks", async () => {
  await renderNyata(
    "kino-vfx",
    { vfxFilter: "noir", vfxGrain: true, vfxVignette: true, kbMode: "diag", kbKekuatan: 0.3, wmMode: "teks", wmTeks: "@UJI", ukuranLogo: 15, introAktif: false, coverTrans: "" },
    false,
  );
});
await ujiAsync("RENDER: geser-atas (PAN Y) + water logo opasitas", async () => {
  await renderNyata("kino-pany", { introAnimasi: "geser-atas", wmMode: "logo", wmOpasitas: 0.4, introAktif: false, coverTrans: "" }, false);
});

};
utama()
  .then(() => {
    console.log(`\nHASIL: ${lolos} lolos, ${gagal} gagal`);
    process.exit(gagal ? 1 : 0);
  })
  .catch((e) => {
    console.error("FATAL:", e);
    process.exit(1);
  });
