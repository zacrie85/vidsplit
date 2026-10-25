// VidSplit — integrasi ffmpeg/ffprobe: cari binary, probe, susun filter graph, eksekusi
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { teksSiapGambar, bungkusTeks } from "./bungkus";
import { TATA_TEMPLATE, kotakKePx } from "./templatLayar";
import type { CodecVideo, GayaTeks, ModeKonversi, NamaFont, Pengaturan } from "./types";
import { DURASI_TRANSISI, rapikanKecepatan } from "./types";
import { rantaiPembicara, type Keyframe } from "./pembicara";

export const ROOT_WORK = process.env.VIDSPLIT_WORK
  ? path.resolve(process.env.VIDSPLIT_WORK)
  : path.join(process.cwd(), "work");

/** Pastikan subfolder di dalam work ada, kembalikan path absolutnya */
export function dirWork(rel: string): string {
  const d = path.join(ROOT_WORK, rel);
  mkdirSync(d, { recursive: true });
  return d;
}

/** Hanya izinkan path di dalam work — kecuali mode Electron (file pilihan user) */
export function pathAman(rel: string): string {
  const p = path.isAbsolute(rel) ? path.resolve(rel) : path.resolve(ROOT_WORK, rel);
  // v0.58.0 — Windows PEKA-HURUF: C:\VidSplit\work vs c:\vidsplit\work adalah
  // path yang sama bagi NTFS — perbandingan lama menolak path sah dgn kapital beda
  const samakan = (x: string) => (process.platform === "win32" ? x.toLowerCase() : x);
  const dalam =
    samakan(p) === samakan(ROOT_WORK) ||
    samakan(p).startsWith(samakan(ROOT_WORK + path.sep));
  if (!dalam && process.env.VIDSPLIT_ELECTRON !== "1") {
    throw new Error("Path di luar folder kerja tidak diizinkan");
  }
  return p;
}

function cariDiNodeModules(rel: string): string | null {
  const kandidat = [
    path.join(process.cwd(), "node_modules", rel),
    path.join(process.cwd(), "..", "node_modules", rel),
    path.join(process.cwd(), "..", "..", "node_modules", rel),
  ];
  for (const k of kandidat) if (existsSync(k)) return k;
  return null;
}

/** Env VIDSPLIT_FFMPEG/FFPROBE → paket static → PATH.
 *  v0.58.0 — hasil DI-MEMOIZE per jenis (dulu: tiap probe() spawn `ffprobe -version`
 *  baru utk fallback PATH — kerja ulang yang mahal di antrean 100 video). */
const cacheBinary = new Map<string, Promise<string>>();
export function cariBinary(jenis: "ffmpeg" | "ffprobe"): Promise<string> {
  const ada = cacheBinary.get(jenis);
  if (ada) return ada;
  const janji = cariBinarySekali(jenis).catch((e) => {
    cacheBinary.delete(jenis); // gagal sementara — boleh dicoba lagi nanti
    throw e;
  });
  cacheBinary.set(jenis, janji);
  return janji;
}

async function cariBinarySekali(jenis: "ffmpeg" | "ffprobe"): Promise<string> {
  const envKey = jenis === "ffmpeg" ? "VIDSPLIT_FFMPEG" : "VIDSPLIT_FFPROBE";
  const kandidat: string[] = [];
  const dariEnv = process.env[envKey];
  if (dariEnv) kandidat.push(dariEnv);
  const statik: (string | null)[] =
    jenis === "ffmpeg"
      ? [
          cariDiNodeModules("ffmpeg-static/ffmpeg"),
          cariDiNodeModules("ffmpeg-static/ffmpeg.exe"),
        ]
      : [
          cariDiNodeModules("ffprobe-static/bin/win/x64/ffprobe.exe"),
          cariDiNodeModules("ffprobe-static/bin/linux/x64/ffprobe"),
          cariDiNodeModules("ffprobe-static/bin/darwin/x64/ffprobe"),
          cariDiNodeModules("ffprobe-static/bin/darwin/arm64/ffprobe"),
        ];
  for (const s of statik) if (s) kandidat.push(s);
  for (const k of kandidat) if (k && existsSync(k)) return k;

  // fallback: cari di PATH — uji benar-benar bisa dieksekusi
  return new Promise((resolve, reject) => {
    const c = spawn(jenis, ["-version"], { windowsHide: true });
    c.on("error", () =>
      reject(new Error(`${jenis} tidak ditemukan. Install ffmpeg atau set ${envKey}`)),
    );
    c.on("close", (code) =>
      code === 0 ? resolve(jenis) : reject(new Error(`${jenis} tidak bisa dijalankan`)),
    );
  });
}

export interface InfoVideo {
  durasi: number;
  lebar: number;
  tinggi: number;
  fps: number;
  adaAudio: boolean;
}

export async function probe(file: string): Promise<InfoVideo> {
  const bin = await cariBinary("ffprobe");
  const out = await new Promise<string>((resolve, reject) => {
    // v0.58.0 — ffprobe kini diberi batas 30 dtk: dulu file rusak/di drive lambat
    // bisa menggantung TANPA BATAS dan menggantung rute API yang memanggilnya
    const c = spawn(
      bin,
      ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", file],
      { windowsHide: true, timeout: 30_000, killSignal: "SIGKILL" },
    );
    let stdout = "";
    let stderr = "";
    c.stdout.on("data", (d) => (stdout += d));
    c.stderr.on("data", (d) => (stderr += d));
    c.on("error", reject);
    c.on("close", (code) =>
      code === 0 ? resolve(stdout) : reject(new Error(`ffprobe gagal: ${stderr.slice(-400)}`)),
    );
  });
  let j: {
    streams?: Array<{
      codec_type: string;
      width?: number;
      height?: number;
      duration?: string;
      avg_frame_rate?: string;
      r_frame_rate?: string;
    }>;
    format?: { duration?: string };
  };
  try {
    j = JSON.parse(out);
  } catch {
    throw new Error("ffprobe mengembalikan keluaran yang tidak valid");
  }
  const v = (j.streams || []).find((s) => s.codec_type === "video");
  const a = (j.streams || []).find((s) => s.codec_type === "audio");
  if (!v || !v.width || !v.height) throw new Error("File tidak punya stream video yang valid");
  const durasi = parseFloat(j.format?.duration ?? v.duration ?? "0") || 0;
  let fps = 30;
  const r = v.avg_frame_rate || v.r_frame_rate || "30/1";
  const [nu, de] = String(r).split("/").map(Number);
  if (nu > 0 && de > 0) fps = nu / de;
  fps = Math.min(60, Math.max(10, fps));
  return {
    durasi,
    lebar: v.width,
    tinggi: v.height,
    fps: Math.round(fps * 100) / 100,
    adaAudio: !!a,
  };
}

/* ---------- util filter graph ---------- */

/** #rrggbbaa → 0xrrggbb@a (format warna ffmpeg) */
function warnaFf(c: string): string {
  const h = (c || "#ffffff").replace("#", "");
  if (h.length === 8) {
    const alpha = (parseInt(h.slice(6, 8), 16) / 255).toFixed(3);
    return `0x${h.slice(0, 6)}@${alpha}`;
  }
  return `0x${h.slice(0, 6) || "ffffff"}`;
}

/** Kutip path untuk nilai opsi filter (spasi, :, \ aman) */
function kutipFilter(s: string): string {
  return "'" + s.replace(/\\/g, "/").replace(/'/g, "\\'").replace(/:/g, "\\:") + "'";
}

/** v0.44.0 — escape path utk nilai opsi filter `subtitles=` (pola musikJobs):
 *  aman utk drive Windows (C\:\…) — dipakai utk filename & fontsdir.
 *  v0.45.0 diekspor — juga dipakai API pratinjau subtitle. */
export function escapePathFilter(p: string): string {
  return p.replaceAll("\\", "/").replaceAll(":", "\\:").replaceAll("'", "\\'");
}

/** Folder font pertama yang benar-benar ada (utk fontsdir libass).
 *  v0.45.0 diekspor — juga dipakai API pratinjau subtitle.
 *  v0.58.0 — bila TIDAK ADA kandidat yang ada, kembalikan "" (pemanggil melewatkan
 *  opsi fontsdir → libass pakai font bawaan) — dulu path POSIX palsu diteruskan
 *  tanpa dicek → subtitle bisa jatuh ke font salah secara senyap. */
export function dirFontsSub(): string {
  const kandidat = [
    process.env.VIDSPLIT_FONTS,
    path.join(process.cwd(), "assets", "fonts"),
    path.join(process.cwd(), "..", "assets", "fonts"),
    path.join(process.cwd(), "..", "..", "assets", "fonts"),
    "/usr/share/fonts/truetype/dejavu",
  ].filter(Boolean) as string[];
  for (const d of kandidat) if (existsSync(d)) return d;
  return "";
}

const NAMA_FONT: Record<GayaTeks["font"], string[]> = {
  tebal: ["DejaVuSans-Bold.ttf", "arialbd.ttf"],
  bersih: ["DejaVuSans.ttf", "arial.ttf"],
  klasik: ["DejaVuSerif-Bold.ttf", "timesbd.ttf"],
  // 15 font sinematik (dibundel di assets/fonts, lisensi OFL) — fallback ke font sistem
  bebas: ["BebasNeue.ttf", "DejaVuSans-Bold.ttf", "arialbd.ttf"],
  anton: ["Anton.ttf", "DejaVuSans-Bold.ttf", "arialbd.ttf"],
  cinzel: ["Cinzel-Bold.ttf", "DejaVuSerif-Bold.ttf", "timesbd.ttf"],
  cinzeldec: ["CinzelDecorative-Bold.ttf", "DejaVuSerif-Bold.ttf", "timesbd.ttf"],
  playfair: ["PlayfairDisplay-Bold.ttf", "DejaVuSerif-Bold.ttf", "timesbd.ttf"],
  marcellus: ["Marcellus.ttf", "DejaVuSerif-Bold.ttf", "timesbd.ttf"],
  julius: ["JuliusSansOne.ttf", "DejaVuSans.ttf", "arial.ttf"],
  oswald: ["Oswald-SemiBold.ttf", "DejaVuSans-Bold.ttf", "arialbd.ttf"],
  sixcaps: ["SixCaps.ttf", "DejaVuSans-Bold.ttf", "arialbd.ttf"],
  teko: ["Teko-Bold.ttf", "DejaVuSans-Bold.ttf", "arialbd.ttf"],
  alfaslab: ["AlfaSlabOne.ttf", "DejaVuSans-Bold.ttf", "arialbd.ttf"],
  abril: ["AbrilFatface.ttf", "DejaVuSans-Bold.ttf", "arialbd.ttf"],
  blackops: ["BlackOpsOne.ttf", "DejaVuSans-Bold.ttf", "arialbd.ttf"],
  creepster: ["Creepster.ttf", "DejaVuSans-Bold.ttf", "arialbd.ttf"],
  monoton: ["Monoton.ttf", "DejaVuSans.ttf", "arial.ttf"],
};

/** Folder kandidat berisi TTF bundel — dipakai drawtext & route /api/font */
export function dirFontKandidat(): string[] {
  return [
    process.env.VIDSPLIT_FONTS,
    path.join(process.cwd(), "assets", "fonts"),
    path.join(process.cwd(), "..", "assets", "fonts"),
    path.join(process.cwd(), "..", "..", "assets", "fonts"),
  ].filter(Boolean) as string[];
}

const cacheFontfile = new Map<string, string>();
function fontfile(gaya: GayaTeks): string {
  // v0.58.0 — memoize per gaya font: dulu tiap drawtext di tiap part memindai
  // ulang ±18 kandidat × 5 folder (existsSync) — kerja ulang murni di event loop
  const hit = cacheFontfile.get(gaya.font);
  if (hit !== undefined) return hit;
  const dirs = [
    ...dirFontKandidat(),
    "/usr/share/fonts/truetype/dejavu",
    "C:\\Windows\\Fonts",
  ];
  let hasil = ""; // biarkan ffmpeg pakai font bawaan
  for (const d of dirs) {
    let ketemu = false;
    for (const n of NAMA_FONT[gaya.font]) {
      const p = path.join(d, n);
      if (existsSync(p)) {
        hasil = p;
        ketemu = true;
        break;
      }
    }
    if (ketemu) break;
  }
  cacheFontfile.set(gaya.font, hasil);
  return hasil;
}

/** v2.1.0 — path TTF utk NAMA font (dipakai THUMBNAIL OTOMATIS & pengujian);
 *  "" = biarkan ffmpeg pakai font bawaan. */
export function fontfileNama(font: NamaFont): string {
  return fontfile({ font } as GayaTeks);
}

/** Filter konversi frame video sumber → frame W×H (tanpa label akhir)
 *  v0.50.0 — zoomPotong 50–100 utk mode "crop": 100 = potong penuh seperti
 *  semula; di bawahnya video diskalakan (zoom × skala-cover) di ATAS latar
 *  blur lembut (sama dgn mode blur) sehingga user bebas memilih seberapa
 *  besar zoom — dan posisiPotong tetap menggeser kiri/kanan.
 *  v0.51.0 — zoomBlur 100–300 utk mode "blur": 100 = blur lembut seperti
 *  semula (video pas layar); di atasnya video DIPERBESAR (zoom × skala-contain,
 *  dimensi genap) di atas latar blur yang sama, posisiPotong menggeser
 *  kiri/kanan dgn rumus overlay yang SAMA dgn zoomPotong — x=(W-w)*pp/100. */
function rantaiUtama(
  mode: ModeKonversi,
  W: number,
  H: number,
  warna: string,
  fps: number,
  durasi: number,
  posisiPotong = 50,
  zoomPotong = 100,
  zoomBlur = 100,
): string {
  const ekor = `fps=${fps},trim=duration=${durasi.toFixed(3)},setpts=PTS-STARTPTS,setsar=1`;
  if (mode === "asli") {
    // v0.7.0 video original: TANPA konversi rasio — frame tetap seukuran sumber.
    // W/H = dimensi sumber yang sudah digenapkan (dari jobs.ts); scale ke ukuran
    // yang sama tidak mengubah apa pun, hanya mengamankan sumber berdimensi ganjil
    // agar tetap valid utk yuv420p (libx264 menolak lebar/tinggi ganjil).
    // v2.0.0 — bila rasio sumber ≠ target W:H (GABUNG VIDEO menyamakan semua
    // segmen / resolusi terkunci dgn mode asli) → scale decrease + pad hitam
    // (bukan distorsi). Rasio sama = persis perilaku lama (nol regresi).
    return `[0:v]scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1,${ekor}`;
  }
  if (mode === "crop") {
    // posisiPotong 0=kiri, 50=tengah, 100=kanan — geser jendela potong secara horizontal
    const pp = Math.min(100, Math.max(0, posisiPotong));
    const z = Math.min(100, Math.max(50, Number.isFinite(zoomPotong) ? zoomPotong : 100)) / 100;
    if (z >= 0.995) {
      // zoom 100% — jalur lama persis seperti sebelum v0.50.0 (nol regresi):
      // scale-to-fill lalu crop jendela W×H pada posisi pp.
      return `[0:v]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H}:(iw-ow)*${pp}/100:0,${ekor}[mv]`;
    }
    // v0.50.0 — zoom manual (<100%): latar = video blur memenuhi layar (identik
    // dgn mode blur), isi = video diskalakan skala-cover × z (dimensi GENAP via
    // trunc(x/2)*2), diletakkan dgn overlay:
    //   x = (W-w)*pp/100 → sama rumusnya dgn crop: pp=0 kiri, pp=100 kanan —
    //     berlaku juga saat video masih lebih lebar dr frame (nilai x negatif =
    //     potong kiri/kanan, persis perilaku crop).
    //   y = (H-h)/2 → tegak selalu di tengah.
    // Skala seragam: faktor = max(W/iw, H/ih) × z (cover × zoom).
    const skala = `max(${W}/iw,${H}/ih)*${z.toFixed(3)}`;
    return [
      `[0:v]split=2[isi][blur]`,
      `[blur]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},boxblur=24:2,eq=brightness=-0.12:saturation=0.9[blurf]`,
      `[isi]scale='trunc(iw*${skala}/2)*2':'trunc(ih*${skala}/2)*2'[isif]`,
      `[blurf][isif]overlay=x='(W-w)*${pp}/100':y='(H-h)/2',${ekor}[mv]`,
    ].join(";");
  }
  if (mode === "warna") {
    return `[0:v]scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=${warnaFf(warna)},${ekor}[mv]`;
  }
  // blur: latar = video di-blur memenuhi layar, isi = video contain di tengah
  // v0.51.0 — zoomBlur > 100: isi DIPERBESAR (contain × zoom) — rumus overlay
  // identik dgn zoomPotong: x=(W-w)*pp/100 (pp=0 kiri … 100 kanan; berlaku
  // juga saat video lebih lebar dr frame → x negatif = potong sisi). Saat
  // zoomBlur ≤ 100 jalur lama PERSIS dipakai (nol regresi).
  const ppBlur = Math.min(100, Math.max(0, posisiPotong));
  const zBlur = Math.min(300, Math.max(100, Number.isFinite(zoomBlur) ? zoomBlur : 100)) / 100;
  if (zBlur <= 1.005) {
    return [
      `[0:v]split=2[isi][blur]`,
      `[blur]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},boxblur=24:2,eq=brightness=-0.12:saturation=0.9[blurf]`,
      `[isi]scale=${W}:${H}:force_original_aspect_ratio=decrease[isif]`,
      `[blurf][isif]overlay=(W-w)/2:(H-h)/2,${ekor}[mv]`,
    ].join(";");
  }
  const skalaBlur = `min(${W}/iw,${H}/ih)*${zBlur.toFixed(3)}`;
  return [
    `[0:v]split=2[isi][blur]`,
    `[blur]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},boxblur=24:2,eq=brightness=-0.12:saturation=0.9[blurf]`,
    `[isi]scale='trunc(iw*${skalaBlur}/2)*2':'trunc(ih*${skalaBlur}/2)*2'[isif]`,
    `[blurf][isif]overlay=x='(W-w)*${ppBlur}/100':y='(H-h)/2',${ekor}[mv]`,
  ].join(";");
}

/** v2.1.0 — UPGRADE BACKGROUND INTRO: rantai gambar intro dgn animasi Ken Burns
 *  (zoompan) + teks intro (drawtext). Keluar label [bgv]. animasi "mati" = rantai
 *  lama PERSIS (nol regresi — dites unit di uji-v210).
 *  Catatan timing: bila transisi FADE aktif, gambar diperpanjang +DURASI_TRANSISI
 *  (masih gambar murah) sehingga xfade offset=durasiIntro TIDAK pernah melewati
 *  akhir input pertama — total durasi hasil TETAP N+M (identik concat).
 *  Butuh input bg dgn `-framerate fps` bila animasi aktif (timing zoompan). */
export function rantaiIntroBg(
  p: Pengaturan,
  W: number,
  H: number,
  fps: number,
  N: number,
  fileTeksIntro: string | null,
  teksIntro: string,
): string {
  const anim = p.introAnimasi;
  const aktifAnim =
    anim === "zoom-masuk" || anim === "zoom-keluar" || anim === "geser-kiri" || anim === "geser-kanan";
  const D = p.introFade ? DURASI_TRANSISI : 0;
  const panjang = N + D; // fade: gambar tampil N + D dtk (xfade menimpa D terakhir)
  const fr = Math.max(1, Math.round(fps * panjang)); // total frame animasi
  const Z = 0.12; // rentang zoom 12% — halus, ala Ken Burns
  let rantai: string;
  if (aktifAnim) {
    const tengah = "iw/2-(iw/zoom/2)";
    let zExpr: string;
    let posisi: string;
    if (anim === "zoom-masuk") {
      zExpr = `min(1+${Z}*on/${fr},1+${Z})`;
      posisi = `x='${tengah}':y='ih/2-(ih/zoom/2)'`;
    } else if (anim === "zoom-keluar") {
      zExpr = `max(1+${Z}-${Z}*on/${fr},1)`;
      posisi = `x='${tengah}':y='ih/2-(ih/zoom/2)'`;
    } else {
      // geser: zoom konstan 8% memberi ruang geser; kamera meluncur pelan
      zExpr = "1.08";
      const jalan = `(iw-iw/zoom)*min(on/${fr},1)`;
      posisi =
        anim === "geser-kiri"
          ? `x='min(max(0,${jalan}),iw-iw/zoom)':y='ih/2-(ih/zoom/2)'`
          : `x='min(max(0,(iw-iw/zoom)-${jalan}),iw-iw/zoom)':y='ih/2-(ih/zoom/2)'`;
    }
    // upscale sebelum zoompan → mengurangi jitter langkah zoom pada frame;
    // 4K tak di-upscale 2× (33 MP/frame terlalu berat) — 1,25× cukup
    const FAKTOR_UPS = W * H > 3_500_000 ? 1.25 : 2;
    const upW = Math.max(2, Math.round((W * FAKTOR_UPS) / 2) * 2);
    const upH = Math.max(2, Math.round((H * FAKTOR_UPS) / 2) * 2);
    rantai =
      `[1:v]scale=${upW}:${upH}:force_original_aspect_ratio=increase,crop=${upW}:${upH},` +
      `zoompan=z='${zExpr}':${posisi}:d=1:fps=${fps}:s=${W}x${H},setsar=1` +
      `,trim=duration=${panjang.toFixed(3)},setpts=PTS-STARTPTS[bgv]`;
  } else {
    rantai =
      `[1:v]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},fps=${fps},setsar=1` +
      `,trim=duration=${panjang.toFixed(3)},setpts=PTS-STARTPTS[bgv]`;
  }
  // teks intro dibakar DI ATAS gambar SEBELUM digabung ke video utama →
  // otomatis hanya tampil selama intro (bukan sepanjang video)
  if (fileTeksIntro && teksIntro.trim()) {
    const skala = Math.min(W, H) / 1080;
    const u = Math.max(12, p.introTeksUkuran * skala);
    let d =
      `drawtext=textfile=${kutipFilter(fileTeksIntro)}:fontsize=${u.toFixed(1)}` +
      `:fontcolor=${warnaFf(p.introTeksWarna)}` +
      `:borderw=${Math.max(1, Math.round(4 * skala))}:bordercolor=black` +
      `:x=(w-text_w)/2:y=H*0.42`;
    const ff = fontfile({ font: p.introTeksFont } as GayaTeks);
    if (ff) d += `:fontfile=${kutipFilter(ff)}`;
    d += `:line_spacing=${(u * 0.3).toFixed(1)}:expansion=none`;
    rantai = rantai.replace("[bgv]", `,${d}[bgv]`);
  }
  return rantai;
}

/** v0.39.0 — ekspresi posisi drawtext deskripsi, murni & teruji:
 *   • X = persen LEBAR frame, dihitung dari TENGAH blok teks → x = W*X/100 - text_w/2
 *   • Y = persen TINGGI frame, dihitung dari ATAS blok teks → y = H*Y/100
 *   • min/max menjaga teks tetap di dalam frame (identik dgn perilaku overlay logo)
 *  Nilai tak valid (NaN/Infinity/di luar 0–100) diclamp ke bawaan 50/80. */
export function ekspresiPosisiDeskripsi(
  xPersen: number,
  yPersen: number,
): { x: string; y: string } {
  const bulat = (n: number, bawaan: number) => {
    if (!Number.isFinite(n)) return bawaan;
    return Math.min(100, Math.max(0, n));
  };
  const x = bulat(xPersen, 50);
  const y = bulat(yPersen, 80);
  const fmt = (n: number) => String(Number(n.toFixed(2)));
  return {
    x: `min(max(0,W*${fmt(x)}/100-text_w/2),W-text_w)`,
    y: `min(max(0,H*${fmt(y)}/100),H-text_h)`,
  };
}

/** Dua-tiga drawtext (judul + Part + deskripsi) di atas hasil concat → [vout].
 *  v0.42.0 — teksJ/teksP/teksD = teks SUDAH DIBUNGKUS (teksSiapGambar): jumlah
 *  barisnya dipakai utk tata letak tinggi (tJ/tP) & isinya sudah ditulis ke
 *  textfile — drawtext multi-baris, tidak ada lagi teks 1 baris terpotong kiri-kanan. */
function rantaiTeks(
  p: Pengaturan,
  W: number,
  H: number,
  teksJ: string,
  teksP: string,
  teksD: string,
  fileJudul: string,
  filePart: string,
  fileDeskripsi: string,
): string {
  // skala berdasar SISI TERPENDEK: identik dgn perilaku lama utk vertikal 1080/720
  // (min(1080,1920)=1080, min(720,1280)=720), dan memberi ukuran proporsional saat
  // mode "asli" memakai dimensi landscape/square/4K dari video sumber.
  const skala = Math.min(W, H) / 1080;
  const uJ = Math.max(12, p.gayaJudul.ukuran * skala);
  const uP = Math.max(10, p.gayaPart.ukuran * skala);
  // v0.42.0 — jumlah baris dari teks TERBUNGKUS (bukan lagi \n buatan user saja):
  // blok judul/Part multi-baris menggeser posisi Part di bawahnya dgn benar.
  // Faktor per baris 1.5 = tinggi baris alami font (±1.2em) + line_spacing 0.3em
  // yang ditambahkan di drawtext — tanpa ini Part menimpa baris terakhir judul
  // saat judul terlipat banyak baris (terlihat di uji render nyata).
  const barisJ = Math.max(1, teksJ.split("\n").length);
  const barisP = Math.max(1, teksP.split("\n").length);
  const tJ = barisJ * uJ * 1.5;
  const tP = barisP * uP * 1.5;
  const gap = uJ * 0.45;
  const mrg = H * 0.045;

  let yJ: number;
  let yP: number;
  if (p.posisiTeks === "tengah") {
    const tot = tJ + gap + tP;
    yJ = (H - tot) / 2;
    yP = yJ + tJ + gap;
  } else if (p.posisiTeks === "bawah") {
    yP = H - mrg - tP;
    yJ = yP - gap - tJ;
  } else {
    yJ = mrg;
    yP = yJ + tJ + gap;
  }

  const bagian: string[] = [];
  const opsiDasar = (
    fontsize: number,
    warna: string,
    outline: GayaTeks,
    y: number,
    ff: string,
  ) => {
    let s = `fontsize=${fontsize.toFixed(1)}:fontcolor=${warnaFf(warna)}`;
    if (outline.outlineLebar > 0) {
      s += `:borderw=${Math.max(1, Math.round(outline.outlineLebar * skala))}:bordercolor=${warnaFf(outline.outlineWarna)}`;
    }
    s += `:x=(w-text_w)/2:y=${Math.round(y)}`;
    if (ff) s += `:fontfile=${kutipFilter(ff)}`;
    // v0.58.0 — expansion=none: teks user berisi "%{" dulu membuat parser drawtext
    // gagal → seluruh part kena galat samar (aplikasi tak memakai fungsi %{...})
    s += `:expansion=none`;
    return s;
  };

  if (teksJ.trim()) {
    const ffJ = fontfile(p.gayaJudul) || fontfile(p.gayaPart);
    bagian.push(
      `drawtext=textfile=${kutipFilter(fileJudul)}:${opsiDasar(uJ, p.gayaJudul.warna, p.gayaJudul, yJ, ffJ)}:line_spacing=${(uJ * 0.3).toFixed(1)}`,
    );
  }
  if (teksP.trim()) {
    const ffP = fontfile(p.gayaPart) || fontfile(p.gayaJudul);
    bagian.push(
      `drawtext=textfile=${kutipFilter(filePart)}:${opsiDasar(uP, p.gayaPart.warna, p.gayaPart, yP, ffP)}:line_spacing=${(uP * 0.3).toFixed(1)}`,
    );
  }
  // v0.39.0 — deskripsi posisi BEBAS (persen frame): X = tengah blok teks,
  // Y = atas blok teks; v0.42.0 — multi-baris juga dari pembungkus otomatis
  if (teksD.trim()) {
    const ffD = fontfile(p.gayaDeskripsi) || fontfile(p.gayaJudul) || fontfile(p.gayaPart);
    const posD = ekspresiPosisiDeskripsi(p.deskripsiX, p.deskripsiY);
    const uD = Math.max(10, p.gayaDeskripsi.ukuran * skala);
    let d = `fontsize=${uD.toFixed(1)}:fontcolor=${warnaFf(p.gayaDeskripsi.warna)}`;
    if (p.gayaDeskripsi.outlineLebar > 0) {
      d += `:borderw=${Math.max(1, Math.round(p.gayaDeskripsi.outlineLebar * skala))}:bordercolor=${warnaFf(p.gayaDeskripsi.outlineWarna)}`;
    }
    // PENTING: ekspresi mengandung KOMA (min(max(...),...)) yang memecah parser
    // filter_complex — wajib dibungkus kutip tunggal (pola sama dgn overlay logo)
    d += `:x='${posD.x}':y='${posD.y}'`;
    if (ffD) d += `:fontfile=${kutipFilter(ffD)}`;
    d += `:line_spacing=${(uD * 0.3).toFixed(1)}`;
    d += `:expansion=none`; // v0.58.0 — teks user dgn %{ tak lagi merusak parser
    bagian.push(`drawtext=textfile=${kutipFilter(fileDeskripsi)}:${d}`);
  }
  if (!bagian.length) return `[cc]null[vout]`;
  return `[cc]${bagian.join(",")}[vout]`;
}

/** v0.46.0 — drawtext MODE TEMPLATE: teks ditempatkan DI DALAM kotak desain
 *  (judul di kotak atas, deskripsi di kotak bawah, Part di kotak kecil kiri-bawah)
 *  — geometri dari TATA_TEMPLATE (satu sumber kebenaran dgn pratinjau CSS).
 *  Posisi memakai ekspresi text_h/text_w agar blok multi-baris tetap di tengah kotak. */
function rantaiTeksTemplate(
  p: Pengaturan,
  W: number,
  H: number,
  teksJ: string,
  teksP: string,
  teksD: string,
  fileJudul: string,
  filePart: string,
  fileDeskripsi: string,
): string {
  const skala = Math.min(W, H) / 1080;
  const uJ = Math.max(12, p.gayaJudul.ukuran * skala);
  const uP = Math.max(10, p.gayaPart.ukuran * skala);
  const uD = Math.max(10, p.gayaDeskripsi.ukuran * skala);
  const jb = kotakKePx(TATA_TEMPLATE.judul, W, H);
  const pb = kotakKePx(TATA_TEMPLATE.part, W, H);
  const db = kotakKePx(TATA_TEMPLATE.deskripsi, W, H);

  const gaya = (fontsize: number, gayaTeks: GayaTeks) => {
    let s = `fontsize=${fontsize.toFixed(1)}:fontcolor=${warnaFf(gayaTeks.warna)}`;
    if (gayaTeks.outlineLebar > 0) {
      s += `:borderw=${Math.max(1, Math.round(gayaTeks.outlineLebar * skala))}:bordercolor=${warnaFf(gayaTeks.outlineWarna)}`;
    }
    s += `:expansion=none`; // v0.58.0 — ekspansi teks dimatikan (lihat rantaiTeks)
    return s;
  };
  const bagian: string[] = [];
  if (teksJ.trim()) {
    const ffJ = fontfile(p.gayaJudul) || fontfile(p.gayaPart);
    bagian.push(
      `drawtext=textfile=${kutipFilter(fileJudul)}:${gaya(uJ, p.gayaJudul)}` +
        `:x='(w-text_w)/2':y='${jb.y + Math.round(jb.h / 2)}-text_h/2'` +
        `:line_spacing=${(uJ * 0.3).toFixed(1)}${ffJ ? `:fontfile=${kutipFilter(ffJ)}` : ""}`,
    );
  }
  if (teksP.trim()) {
    const ffP = fontfile(p.gayaPart) || fontfile(p.gayaJudul);
    bagian.push(
      `drawtext=textfile=${kutipFilter(filePart)}:${gaya(uP, p.gayaPart)}` +
        `:x='${pb.x + Math.round(pb.w / 2)}-text_w/2':y='${pb.y + Math.round(pb.h / 2)}-text_h/2'` +
        `:line_spacing=${(uP * 0.3).toFixed(1)}${ffP ? `:fontfile=${kutipFilter(ffP)}` : ""}`,
    );
  }
  if (teksD.trim()) {
    const ffD = fontfile(p.gayaDeskripsi) || fontfile(p.gayaJudul) || fontfile(p.gayaPart);
    bagian.push(
      `drawtext=textfile=${kutipFilter(fileDeskripsi)}:${gaya(uD, p.gayaDeskripsi)}` +
        `:x='(w-text_w)/2':y='${db.y + Math.round(db.h / 2)}-text_h/2'` +
        `:line_spacing=${(uD * 0.3).toFixed(1)}${ffD ? `:fontfile=${kutipFilter(ffD)}` : ""}`,
    );
  }
  if (!bagian.length) return `[cc]null[vout]`;
  return `[cc]${bagian.join(",")}[vout]`;
}

export interface ArgPart {
  src: string;
  bg: string | null;
  /** logo watermark (path absolut) atau null */
  logo: string | null;
  pengaturan: Pengaturan;
  /** nomor part (untuk nama file tmp) */
  n: number;
  mulai: number;
  durasi: number;
  W: number;
  H: number;
  fps: number;
  adaAudio: boolean;
  /** ISI teks judul & part — ditulis ke textfile agar aman unicode */
  judulTxt: string;
  partTxt: string;
  /** v0.39.0 — isi teks deskripsi ("" = tanpa deskripsi) */
  deskripsiTxt: string;
  /** v0.44.0 — berkas .ass subtitle AI utk part ini (absen/kosong = tanpa subtitle) */
  fileSub?: string | null;
  /** v0.46.0 — PNG frame hiasan (path absolut) atau null — video tampil di baliknya */
  frameAbs?: string | null;
  /** v0.46.0 — sequence PNG frame neon berputar (cache work/neon) atau null */
  neon?: SeqNeon | null;
  /** v0.46.0 — PNG latar template halaman (path absolut) atau null */
  templatBg?: string | null;
  /** v2.0.0 — backsound musik (path absolut) atau null — diputar LOOP mulai dari
   *  offsetBacksound (posisi lagu kontinu antar part), volume 0–150 % */
  fileBacksound?: string | null;
  /** v2.0.0 — volume backsound 0–1.5 (dari persen ÷ 100) */
  volumeBacksound?: number;
  /** v2.0.0 — posisi lagu saat part ini mulai (detik, waktu HASIL) */
  offsetBacksound?: number;
  /** v2.1.0 — file SUARA INTRO (path absolut) atau null — diputar selama intro
   *  (LOOP otomatis bila lebih pendek), fade-out saat transisi fade aktif */
  fileSuaraIntro?: string | null;
  /** v2.0.0 — keyframe ZOOM PEMBICARA (JSON work/tmp) atau null — rantai video
   *  diganti crop dinamis mengikuti pembicara aktif (geser/fade/langsung) */
  filePembicara?: string | null;
  /** v2.0.0 — dimensi SUMBER video (utk crop pembicara 9:16) */
  sumberLebar?: number;
  sumberTinggi?: number;
  /** v2.0.0 — bitrate target KOMPRES PINTAR (kbps) — null = ikuti CRF/CQ */
  bitrateKbps?: number | null;
  dirTmp: string;
  tag: string;
  /** argumen codec video lengkap, mis. ["-c:v","libx264","-preset","medium","-crf","20"] */
  codecArgs: string[];
  keluar: string;
}

/** v0.46.0 — sequence neon: file f%04d.png di dir, putar berulang dgn -stream_loop.
 *  x/y/w/h = rect overlay pada kanvas (mode template = rect kotak video). */
export interface SeqNeon {
  dir: string;
  fps: number;
  jumlah: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Susun argumen ffmpeg lengkap untuk satu part hasil split */
export function bangunArgumenPart(a: ArgPart): { args: string[]; total: number } {
  const p = a.pengaturan;
  const pakaiBg = !!a.bg && existsSync(a.bg);
  const pakaiLogo = !!a.logo && existsSync(a.logo);
  // v0.46.0 — frame hiasan / neon / template
  const pakaiTemplat = p.mode === "template" && !!a.templatBg && existsSync(a.templatBg);
  // frame hiasan TIDAK dipakai di mode template (template sendiri sudah halaman
  // desain penuh — frame 9:16 akan menutupi kotak-kotaknya)
  const pakaiFrame = !!a.frameAbs && existsSync(a.frameAbs) && p.mode !== "template";
  const pakaiNeon =
    !!a.neon && existsSync(path.join((a.neon as SeqNeon).dir, "f0001.png"));
  // TANPA bg: total = durasi video saja (bukan + durasiIntro — kalau tidak,
  // track audio/hening ikut memanjang dan hasil split punya ekor diam ±3 dtk)
  // v0.57.0 — KECEPATAN TAYANG: durasi part hasil = durasi sumber ÷ kecepatan
  // (video setpts + audio atempo diujung rantai; subtitle ikut bergeser otomatis
  // karena dibakar SEBELUM setpts — waktu ASS tetap waktu sumber).
  const kec = rapikanKecepatan(p.kecepatanVideo);
  const totalDasar = pakaiBg ? p.durasiIntro + a.durasi : a.durasi;
  const total = kec !== 1 ? totalDasar / kec : totalDasar;
  const W = a.W;
  const H = a.H;
  const fps = a.fps;

  // v0.42.0 — bungkus teks ke beberapa baris SEBELUM digambar (bug teks besar
  // terpotong kiri-kanan): aturan lipat SAMA dgn pratinjau (bungkus.ts), jadi
  // pratinjau = hasil ekspor.
  // v0.46.0 — mode template: pembungusan memakai LEBAR KOTAK video (bukan kanvas)
  // agar blok teks muat di dalam kotak desainnya.
  const vTemplat = pakaiTemplat ? kotakKePx(TATA_TEMPLATE.video, W, H) : null;
  const siap = vTemplat
    ? teksSiapGambar(a.judulTxt, a.partTxt, a.deskripsiTxt, p, vTemplat.w, vTemplat.h)
    : teksSiapGambar(a.judulTxt, a.partTxt, a.deskripsiTxt, p, W, H);

  writeFileSync(path.join(a.dirTmp, `${a.tag}-judul.txt`), siap.judul, "utf8");
  writeFileSync(path.join(a.dirTmp, `${a.tag}-part.txt`), siap.part, "utf8");
  writeFileSync(path.join(a.dirTmp, `${a.tag}-deskripsi.txt`), siap.deskripsi || "", "utf8");
  const fileJudul = path.join(a.dirTmp, `${a.tag}-judul.txt`);
  const filePart = path.join(a.dirTmp, `${a.tag}-part.txt`);
  const fileDeskripsi = path.join(a.dirTmp, `${a.tag}-deskripsi.txt`);
  // v2.1.0 — teks intro dibungkus (aturan sama dgn judul: lebar 92% frame)
  // lalu ditulis ke textfile — drawtext multi-baris aman unicode.
  const teksIntroMentah = (p.introTeks || "").trim();
  const fileIntro = teksIntroMentah && pakaiBg ? path.join(a.dirTmp, `${a.tag}-intro.txt`) : null;
  if (fileIntro) {
    const skalaTxt = Math.min(W, H) / 1080;
    const uTxt = Math.max(12, p.introTeksUkuran * skalaTxt);
    writeFileSync(fileIntro, bungkusTeks(teksIntroMentah, W * 0.92, uTxt, p.introTeksFont), "utf8");
  }

  // URUTAN INPUT PENTING (indeks filter graph): 0=src, 1=bg?, lalu anullsrc,
  // lalu logo PALING AKHIR — sehingga idxLogo = pakaiBg ? 3 : 2 selalu benar
  // dan referensi audio [2:a] / -map 2:a tidak pernah bergeser oleh logo.
  const inputs: string[] = ["-ss", a.mulai.toFixed(3), "-i", a.src];
  // v2.1.0 — FADE LEMBUT: gambar diperpanjang +DURASI_TRANSISI (xfade menimpa
  // D terakhir) → durasi hasil TETAP N+M; animasi Ken Burns butuh -framerate
  // fps agar ekspresi zoompan `on` selaras dgn waktu (nol regresi: mati+langsung
  // = argumen input persis lama).
  const pakaiFadeIntro = pakaiBg && p.introFade === true;
  const panjangBg = pakaiBg ? p.durasiIntro + (pakaiFadeIntro ? DURASI_TRANSISI : 0) : 0;
  const pakaiAnimIntro =
    pakaiBg &&
    (p.introAnimasi === "zoom-masuk" ||
      p.introAnimasi === "zoom-keluar" ||
      p.introAnimasi === "geser-kiri" ||
      p.introAnimasi === "geser-kanan");
  if (pakaiBg) {
    if (pakaiAnimIntro) inputs.push("-framerate", String(fps));
    inputs.push("-loop", "1", "-t", panjangBg.toFixed(3), "-i", a.bg as string);
  }
  const idxLogo = pakaiLogo ? (pakaiBg ? 3 : 2) : -1;
  const inputLogo: string[] = pakaiLogo ? ["-loop", "1", "-i", a.logo as string] : [];
  // v0.46.0 — input tambahan SELALU di akhir (setelah logo) sehingga indeks
  // anullsrc ([2:a]/[1:a]) dan idxLogo tidak pernah bergeser:
  //   tanpa bg: 0=src 1=audio 2=logo 3=templat 4=frame 5=neon
  //   dgn bg:   0=src 1=bg 2=audio 3=logo 4=templat 5=frame 6=neon
  const dasarBerikut = pakaiLogo ? (pakaiBg ? 4 : 3) : pakaiBg ? 3 : 2;
  const idxTemplat = pakaiTemplat ? dasarBerikut : -1;
  let idxBerikut = pakaiTemplat ? dasarBerikut + 1 : dasarBerikut;
  const idxFrame = pakaiFrame ? idxBerikut++ : -1;
  const idxNeon = pakaiNeon ? idxBerikut++ : -1;
  const inputTemplat: string[] = pakaiTemplat ? ["-loop", "1", "-i", a.templatBg as string] : [];
  const inputFrame: string[] = pakaiFrame ? ["-loop", "1", "-i", a.frameAbs as string] : [];
  const neonS = a.neon as SeqNeon | null;
  const inputNeon: string[] = pakaiNeon
    ? ["-framerate", String(neonS?.fps ?? 25), "-stream_loop", "-1", "-i", path.join(neonS?.dir ?? "", "f%04d.png")]
    : [];

  // v2.0.0 — input backsound SELALU PALING AKHIR (indeks dihitung dari sisa input)
  const pakaiBacksound =
    !!a.fileBacksound && existsSync(a.fileBacksound) && (a.volumeBacksound ?? 0) > 0;
  const inputBacksound: string[] = pakaiBacksound
    ? ["-stream_loop", "-1", "-t", ((a.offsetBacksound ?? 0) + total + 1).toFixed(3), "-i", a.fileBacksound as string]
    : [];
  const idxBacksound = pakaiBacksound
    ? (pakaiNeon ? idxNeon + 1 : pakaiFrame ? idxFrame + 1 : pakaiTemplat ? idxTemplat + 1 : dasarBerikut)
    : -1;

  // v2.1.0 — SUARA INTRO: input SELALU PALING AKHIR (setelah backsound) — indeks
  // eksplisit sehingga anullsrc ([2:a])/logo/templat tidak pernah bergeser.
  // LOOP otomatis (-stream_loop -1) bila lagu lebih pendek dr intro; atrim.
  const pakaiSuaraIntro = pakaiBg && !!a.fileSuaraIntro && existsSync(a.fileSuaraIntro);
  const dasarAkhir = pakaiBacksound
    ? idxBacksound + 1
    : pakaiNeon
      ? idxNeon + 1
      : pakaiFrame
        ? idxFrame + 1
        : pakaiTemplat
          ? idxTemplat + 1
          : dasarBerikut;
  const inputSuaraIntro: string[] = pakaiSuaraIntro
    ? ["-stream_loop", "-1", "-t", (p.durasiIntro + 1).toFixed(3), "-i", a.fileSuaraIntro as string]
    : [];
  const idxSuaraIntro = pakaiSuaraIntro ? dasarAkhir : -1;

  // v2.0.0 — ZOOM PEMBICARA: keyframe dari file JSON (analisis latar) → rantai
  // video khusus menggantikan rantaiUtama (crop dinamis pembicara aktif). Gagal
  // baca/rantai tak bisa dibangun → jatuh ke rantai lama (perilaku aman).
  let rantaiPembicaraStr: string | null = null;
  if (a.filePembicara && existsSync(a.filePembicara) && a.sumberLebar && a.sumberTinggi) {
    try {
      const kf = JSON.parse(readFileSync(a.filePembicara, "utf8")) as Keyframe[];
      if (Array.isArray(kf) && kf.length && p.zoomPembicara !== "mati") {
        const hasil = rantaiPembicara(
          kf,
          { w: a.sumberLebar, h: a.sumberTinggi },
          { W, H },
          p.zoomPembicara === "fade" ? "fade" : p.zoomPembicara === "langsung" ? "langsung" : "geser",
          p.lajuPindah === "cepat" ? "cepat" : p.lajuPindah === "lambat" ? "lambat" : "normal",
          fps,
          a.durasi,
        );
        if (hasil) rantaiPembicaraStr = hasil.filter.replace(/\[vz\]$/, "[cc]");
      }
    } catch {
      rantaiPembicaraStr = null;
    }
  }

  // audio: suara intro / hening selama intro + audio sumber ter-trim
  const inputAudio: string[] = [];
  const filterAudio: string[] = [];
  let mapAudio: string[];
  // kasus bg + video tanpa audio: track hening harus sepanjang TOTAL (intro+durasi),
  // bukan cuma durasi intro — kalau tidak, track audio output terpotong pendek
  const durasiAudio = pakaiBg && a.adaAudio ? p.durasiIntro : total;
  inputAudio.push("-f", "lavfi", "-t", durasiAudio.toFixed(3), "-i", "anullsrc=channel_layout=stereo:sample_rate=44100");
  // v2.1.0 — fade lembut: audio sumber memudar masuk selama transisi (setelah
  // intro), suara intro memudar keluar — pergantian terasa mulus dua arah
  const DFade = pakaiFadeIntro ? DURASI_TRANSISI : 0;
  if (pakaiBg) {
    if (pakaiSuaraIntro) {
      const vol = Math.min(1.5, Math.max(0.01, (p.introSuaraVolume ?? 100) / 100));
      const fadeKel =
        DFade > 0 && p.durasiIntro > DFade
          ? `,afade=t=out:st=${(p.durasiIntro - DFade).toFixed(3)}:d=${DFade.toFixed(3)}`
          : "";
      filterAudio.push(
        `[${idxSuaraIntro}:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,` +
          `atrim=duration=${p.durasiIntro.toFixed(3)},asetpts=PTS-STARTPTS,volume=${vol.toFixed(3)}${fadeKel}[sia]`,
      );
      if (a.adaAudio) {
        const fadeMasuk = DFade > 0 ? `,afade=t=in:st=0:d=${DFade.toFixed(3)}` : "";
        filterAudio.push(
          `[0:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,atrim=duration=${a.durasi.toFixed(3)},asetpts=PTS-STARTPTS${fadeMasuk}[ma]`,
          `[sia][ma]concat=n=2:v=0:a=1${kec !== 1 ? `,atempo=${kec}` : ""}[aout]`,
        );
        mapAudio = ["-map", "[aout]"];
      } else {
        // suara intro + hening sisanya (anullsrc tetap sepanjang TOTAL → atrim mulai N)
        filterAudio.push(
          `[2:a]atrim=start=${p.durasiIntro.toFixed(3)},asetpts=PTS-STARTPTS[seN]`,
          `[sia][seN]concat=n=2:v=0:a=1${kec !== 1 ? `,atempo=${kec}` : ""}[aout]`,
        );
        mapAudio = ["-map", "[aout]"];
      }
    } else if (a.adaAudio) {
      const fadeMasuk = DFade > 0 ? `,afade=t=in:st=0:d=${DFade.toFixed(3)}` : "";
      filterAudio.push(
        `[0:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,atrim=duration=${a.durasi.toFixed(3)},asetpts=PTS-STARTPTS${fadeMasuk}[ma]`,
        `[2:a][ma]concat=n=2:v=0:a=1${kec !== 1 ? `,atempo=${kec}` : ""}[aout]`,
      );
      mapAudio = ["-map", "[aout]"];
    } else {
      mapAudio = ["-map", "2:a"];
    }
  } else if (a.adaAudio) {
    filterAudio.push(`[0:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,asetpts=PTS-STARTPTS${kec !== 1 ? `,atempo=${kec}` : ""}[aout]`);
    mapAudio = ["-map", "[aout]"];
  } else {
    // tanpa bg & tanpa audio: input 0 = src, input 1 = anullsrc
    mapAudio = ["-map", "1:a"];
  }

  // v2.0.0 — BACKSOUND MUSIK SENDIRI: diputar LOOP otomatis (lagu lebih pendek
  // dari video), posisi KONTINU antar part (offset), volume 0–150 %. Input musik
  // di-loop dgn -stream_loop -1 lalu atrim start=offset → posisi lagu kontinu.
  if (pakaiBacksound) {
    const vol = Math.min(1.5, Math.max(0.01, (a.volumeBacksound ?? 0.8) / 100));
    const off = Math.max(0, a.offsetBacksound ?? 0);
    filterAudio.push(
      `[${idxBacksound}:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,` +
        (off > 0.01 ? `atrim=start=${off.toFixed(3)},asetpts=PTS-STARTPTS,` : "") +
        `volume=${vol.toFixed(3)}[bsv]`,
    );
    // bila video punya audio asli → campur dgn amix TANPA normalisasi (volume
    // asli tetap 1.0); tanpa audio asli → backsound jadi satu-satunya track
    // (video tanpa suara tetap diekspor DENGAN audio) ✓ permintaan user
    // v2.1.0 — suara intro: [aout] pasti ada (rantai suara intro memakainya)
    const dasarAudio = pakaiBg
      ? (a.adaAudio || pakaiSuaraIntro ? "[aout]" : "[2:a]")
      : a.adaAudio ? "[aout]" : "[1:a]";
    if (a.adaAudio || pakaiBg) {
      filterAudio.push(`${dasarAudio}[bsv]amix=inputs=2:duration=first:normalize=0[amixv]`);
      mapAudio = ["-map", "[amixv]"];
    } else {
      mapAudio = ["-map", "[bsv]"];
    }
  }

  // video: intro bg (opsional) + video utama → concat/xfade → frame hiasan → neon → teks
  // v2.0.0 — bila rantai pembicara tersedia → menggantikan rantaiUtama ([cc])
  // v2.1.0 — rantai intro = rantaiIntroBg (Ken Burns + teks intro); gabungan
  // intro→konten = FADE LEMBUT (xfade offset=N; gambar sudah diperpanjang N+D)
  // atau concat langsung (perilaku lama, identik bit-per-bit saat semua mati).
  const filterVideo: string[] = [];
  const sambungIntro = (lblKonten: string) =>
    pakaiFadeIntro
      ? // xfade WAJIB masukan constant-frame-rate — fps= di kedua cabang
        // menjamin itu (zoompan/overlay bisa melaporkan rate 1/0 → xfade menolak)
        `[${lblKonten}]format=yuv420p,fps=${fps}[ccx];[bgv]format=yuv420p,fps=${fps}[bgx];` +
        `[bgx][ccx]xfade=transition=fade:duration=${DURASI_TRANSISI.toFixed(3)}:offset=${p.durasiIntro.toFixed(3)}[cc]`
      : `[bgv][${lblKonten}]concat=n=2:v=1:a=0[cc]`;
  const rantaiBgStr = pakaiBg
    ? rantaiIntroBg(p, W, H, fps, p.durasiIntro, fileIntro, teksIntroMentah)
    : null;
  if (rantaiPembicaraStr && !pakaiBg && !pakaiTemplat) {
    // zoom pembicara: hasil langsung [cc] (tanpa intro bg — podca/raycast vertikal)
    filterVideo.push(rantaiPembicaraStr);
  } else if (rantaiPembicaraStr && pakaiBg) {
    // intro bg tetap jalan di depan, lalu konten pembicara
    filterVideo.push(rantaiBgStr as string);
    filterVideo.push(rantaiPembicaraStr);
    filterVideo.push(sambungIntro("cc"));
  } else if (pakaiTemplat) {
    // v0.46.0 MODE TEMPLATE — video pas DI DALAM jendela kotak tengah:
    // (1) video contain di kotak + pad putih, (2) diletakkan di posisi kotak pada
    // kanvas penuh, (3) latar PNG (gradasi + kotak putih, jendela transparan)
    // diletakkan DI ATAS video sehingga video hanya terlihat lewat jendela.
    const v = vTemplat as { x: number; y: number; w: number; h: number; r: number };
    filterVideo.push(`[${idxTemplat}:v]scale=${W}:${H}[tbgx]`);
    filterVideo.push(
      `[0:v]scale=${v.w}:${v.h}:force_original_aspect_ratio=decrease,pad=${v.w}:${v.h}:(ow-iw)/2:(oh-ih)/2:color=white,pad=${W}:${H}:${v.x}:${v.y}:color=black,fps=${fps},trim=duration=${a.durasi.toFixed(3)},setpts=PTS-STARTPTS,setsar=1[vidbox]`,
    );
    filterVideo.push(`[vidbox][tbgx]overlay=0:0${pakaiBg ? "[tv1]" : "[cc]"}`);
    if (pakaiBg) {
      filterVideo.push(rantaiBgStr as string);
      filterVideo.push(sambungIntro("tv1"));
    }
  } else if (pakaiBg) {
    filterVideo.push(rantaiBgStr as string);
    filterVideo.push(rantaiUtama(p.mode, W, H, p.warnaLatar, fps, a.durasi, p.posisiPotong, p.zoomPotong, p.zoomBlur));
    filterVideo.push(sambungIntro("mv"));
  } else {
    filterVideo.push(
      rantaiUtama(p.mode, W, H, p.warnaLatar, fps, a.durasi, p.posisiPotong, p.zoomPotong, p.zoomBlur).replace("[mv]", "[cc]"),
    );
  }
  // v0.46.0 — FRAME HIASAN & NEON di atas komposisi video, DI BAWAH teks:
  // urutan lapisan = video (+intro) → frame → neon → judul/Part/deskripsi →
  // subtitle → logo. Frame di-scale "cover" (9:16 pas penuh; mode asli
  // landscape ikut terisi, sisi frame terpotong sedikit).
  let labelKini = "cc";
  if (pakaiFrame) {
    filterVideo.push(
      `[${idxFrame}:v]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H}[fm]`,
    );
    filterVideo.push(`[${labelKini}][fm]overlay=0:0[vfr]`);
    labelKini = "vfr";
  }
  if (pakaiNeon) {
    filterVideo.push(`[${idxNeon}:v]scale=${neonS?.w ?? W}:${neonS?.h ?? H}[nfs]`);
    filterVideo.push(`[${labelKini}][nfs]overlay=${neonS?.x ?? 0}:${neonS?.y ?? 0}[vne]`);
    labelKini = "vne";
  }
  const rantaiTeksStr = (pakaiTemplat
    ? rantaiTeksTemplate(p, W, H, siap.judul, siap.part, siap.deskripsi, fileJudul, filePart, fileDeskripsi)
    : rantaiTeks(p, W, H, siap.judul, siap.part, siap.deskripsi, fileJudul, filePart, fileDeskripsi)
  ).replace(/^\[cc\]/, `[${labelKini}]`);
  // v0.44.0 — subtitle AI (libass) diselipkan SETELAH drawtext judul/Part/deskripsi
  // dan SEBELUM overlay logo — memakai pola filter `subtitles=` yang sudah terbukti
  // di Studio Musik (bundle ffmpeg memiliki libass + fontsdir font bundel).
  const pakaiSub = !!a.fileSub && existsSync(a.fileSub);
  // v0.58.0 — fontsdir hanya disisipkan bila foldernya BENAR-BENAR ada
  // (dirFontsSub kini bisa "" — biarkan libass pakai font bawaan sistem)
  const fdirSub = dirFontsSub();
  const opsiSub = pakaiSub
    ? `filename='${escapePathFilter(a.fileSub as string)}'${
        fdirSub ? `:fontsdir='${escapePathFilter(fdirSub)}'` : ""
      }`
    : "";
  if (pakaiLogo) {
    // rantai teks menghasilkan [vtx] (atau [vpre]→subtitles→[vtx]) lalu logo → [vout]
    filterVideo.push(rantaiTeksStr.replace("[vout]", pakaiSub ? "[vpre]" : "[vtx]"));
    if (pakaiSub) {
      filterVideo.push(
        `[vpre]subtitles=${opsiSub},format=yuv420p[vtx]`,
      );
    }
    const lebarWm = Math.max(
      24,
      Math.round((W * Math.min(40, Math.max(5, p.ukuranLogo || 15))) / 100),
    );
    filterVideo.push(`[${idxLogo}:v]scale=${lebarWm}:-1[wmf]`);
    // v0.8.0 posisi BEBAS logo: titik kiri-atas logo = (logoX%, logoY%) dari frame.
    // Ekspresi min/max menjaga logo tetap di dalam frame walau rasio gambarnya tinggi
    // (posisi disimpan dalam % sehingga konsisten utk 9:16, 720p, maupun mode asli).
    const lx = Math.min(100, Math.max(0, Number.isFinite(p.logoX) ? p.logoX : 81.5));
    const ly = Math.min(100, Math.max(0, Number.isFinite(p.logoY) ? p.logoY : 88.5));
    filterVideo.push(
      `[vtx][wmf]overlay=x='min(max(0,W*${lx}/100),W-w)':y='min(max(0,H*${ly}/100),H-h)'[vout]`,
    );
  } else {
    filterVideo.push(rantaiTeksStr.replace("[vout]", pakaiSub ? "[vpre]" : "[vout]"));
    if (pakaiSub) {
      filterVideo.push(
        `[vpre]subtitles=${opsiSub},format=yuv420p[vout]`,
      );
    }
  }

  // v0.57.0 — PASCA-PROSES di ujung rantai video: KECEPATAN TAYANG (setpts)
  // + TRANSISI ANTAR PART (fade / slide). Ditempatkan SETELAH frame, teks,
  // subtitle & logo sehingga SELURUH gambar ikut berpindah (transisi terlihat
  // utuh). Label [vout] produsen terakhir diganti [vpre], rantai pasca
  // menghasilkan [vout] kembali → -map & sisa argumen tak berubah.
  const transisi: string =
    p.transisiPart === "fade" || p.transisiPart === "slide" ? p.transisiPart : "";
  if (kec !== 1 || transisi) {
    const idxAkhir = filterVideo.length - 1;
    filterVideo[idxAkhir] = filterVideo[idxAkhir].replace("[vout]", "[vpre]");
    const TD = DURASI_TRANSISI;
    const stKeluar = Math.max(0, total - TD).toFixed(3);
    if (transisi === "fade") {
      // pudar dari hitam (masuk) + pudar ke hitam (keluar) tiap part
      const fade = `fade=t=in:st=0:d=${TD},fade=t=out:st=${stKeluar}:d=${TD}`;
      filterVideo.push(
        kec !== 1
          ? `[vpre]setpts=PTS/${kec.toFixed(4)},${fade}[vout]`
          : `[vpre]${fade}[vout]`,
      );
    } else if (transisi === "slide") {
      // geser: masuk dari kanan (0→TD dtk), keluar ke kiri (total−TD→total),
      // di atas latar hitam — waktu memakai t SETELAH setpts (detik hasil)
      const xExpr =
        `if(lt(t,${TD}),W*(1-min(t/${TD},1)),` +
        `if(gte(t,${stKeluar}),-W*min((t-${stKeluar})/${TD},1),0))`;
      if (kec !== 1) filterVideo.push(`[vpre]setpts=PTS/${kec.toFixed(4)}[vspd]`);
      filterVideo.push(`color=c=black:s=${W}x${H}:r=${fps}:d=${total.toFixed(3)}[bgtr]`);
      filterVideo.push(`[bgtr][${kec !== 1 ? "vspd" : "vpre"}]overlay=x='${xExpr}':y=0[vout]`);
    } else {
      // hanya kecepatan tanpa transisi
      filterVideo.push(`[vpre]setpts=PTS/${kec.toFixed(4)}[vout]`);
    }
  }

  const filter = [...filterVideo, ...filterAudio].join(";");
  const args = [
    "-y",
    "-hide_banner",
    ...inputs,
    ...inputAudio,
    ...inputLogo,
    ...inputTemplat,
    ...inputFrame,
    ...inputNeon,
    ...inputBacksound,
    ...inputSuaraIntro,
    "-filter_complex",
    filter,
    "-map",
    "[vout]",
    ...mapAudio,
    "-t",
    total.toFixed(3),
    "-r",
    String(fps),
    ...a.codecArgs,
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-ar",
    "44100",
    "-movflags",
    "+faststart",
    a.keluar,
  ];
  return { args, total };
}

export interface OpsiFfmpeg {
  /** tenggat DASAR wall-clock (ms) — titik awal sebelum diperpanjang progres.
   *  Bawaan 240_000 (atau durasi×15 bila durasi diketahui). Panggilan adegan
   *  komik mengirim max(150 dtk, durasi×15). */
  absolutMs?: number;
  /** batas tanpa statistik time= di stderr saat fase JALAN (ms). Bawaan 40_000. */
  diamMs?: number;
  /** v0.57.1 — batas FASE AWAL (belum ada baris time= pertama): pesan
   *  inisialisasi font/libass + frame pertama yang berat TIDAK menulis time=
   *  sama sekali — v0.57.0 membunuhnya di diamMs (40 dtk) padahal masih
   *  bekerja (laporan user: stderr terakhir hanya "fontselect: ... DejaVuSans").
   *  Fase awal kini diberi masa tenggang berbasis TANDA HIDUP stderr (output
   *  apapun dihitung hidup). Bawaan 150_000. */
  diamAwalMs?: number;
  /** v0.57.1 — fase jalan: stderr mengalir tapi time= TAK NAIK >0,001 dtk
   *  selama ini (ms) → terhenti (mis. loop galat decode tanpa akhir). Bawaan
   *  180_000 — jangan biarkan menggantung sampai tenggat adaptif (puluhan menit). */
  bekuMediaMs?: number;
  /** liveness: dipanggil tiap ±5 dtk dgn detik berlalu — UI tampil proses hidup */
  onDetik?: (detik: number) => void;
}

/** v0.55.0 — batas keras MUTLAK (murni — dites unit): jaring pengaman terakhir
 *  agar proses tak mungkin bergantung selamanya walau progres terus mengalir.
 *  = max(absolutMs × 6, 2 jam). Render es-lambat ekstrem sampai di sini pun
 *  dihentikan dgn pesan yg menjelaskan kecepatan teramati. */
export function hitungBatasKeras(absolutMs: number): number {
  return Math.max(absolutMs * 6, 2 * 3_600_000);
}

/** v0.55.0 — PERPANJANGAN TENGGAT ADAPTIF (murni — dites unit).
 *  Dulu: batas absolut KAKU (durasi×15 dtk) MEMBUNUH ffmpeg yg masih maju —
 *  render berat (frame hiasan + blur + subtitle) sambil AI latar berebut CPU
 *  melorot ke 0,06x → part 45 dtk kena batas 675 dtk & eksport gagal (laporan
 *  user v0.54, stderr jelas menunjukkan time= TERUS BERTAMBAH = bukan macet).
 *  v0.56.0 — AMBANG DIPERKECIL (laporan user kedua): di fps=1,9 tiap event
 *  stderr hanya maju 0,03–0,05 dtk media — ambang lama 0,25 dtk PER EVENT
 *  membuat perpanjangan TIDAK PERNAH terjadi (media maju kecil-kecil terus,
 *  tenggat tetap habis). Kini maju >0,001 dtk sejak penilaian terakhir sudah
 *  dihitung maju → tenggat digeser ke now + max(estimasiSisa×2500 ms + 90 dtk,
 *  absolutMs), plafon absolutMs×4. estimasiSisa = kecepatan teramati
 *  (dtk-wall/dtk-media) × sisa media. Render LAMBAT TAPI MAJU = selamat
 *  (dibatasi batas keras 2 jam); yang benar-benar beku (media tak maju sama
 *  sekali) tetap dibunuh — oleh tenggat / diamMs (sunyi total). */
export function perpanjangTenggat(
  tenggatLama: number,
  sekarang: number,
  mulaiMs: number,
  absolutMs: number,
  totalDetik: number,
  mediaDetik: number,
  mediaSebelumnya: number,
): number {
  if (mediaDetik - mediaSebelumnya <= 0.001) return tenggatLama; // tak maju bermakna
  const lewatDtk = Math.max(0.001, (sekarang - mulaiMs) / 1000);
  const kecepatan = lewatDtk / Math.max(0.25, mediaDetik); // dtk-wall per dtk-media
  const sisa = Math.max(0, totalDetik - mediaDetik);
  const estimasiSisa = kecepatan * sisa;
  const tambah = Math.min(
    Math.max(estimasiSisa * 2500 + 90_000, absolutMs), // estimasiSisa dtk → ms
    absolutMs * 4,
  );
  return Math.max(tenggatLama, sekarang + tambah);
}

/** format detik → HH:MM:SS utk pesan diagnosa */
function fmtWaktu(dtk: number): string {
  const s = Math.max(0, Math.floor(dtk));
  const j = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const d = s % 60;
  return `${String(j).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(d).padStart(2, "0")}`;
}

/** Bunuh proses + SELURUH pohon anaknya (Windows: taskkill /T /F — SIGKILL Node
 *  kadang tak mematikan ffmpeg yang sedang menulis; POSIX: SIGKILL cukup). */
function bunuhPohon(c: ChildProcess): void {
  try {
    if (process.platform === "win32" && c.pid) {
      const t = spawn("taskkill", ["/PID", String(c.pid), "/T", "/F"], { windowsHide: true });
      // v0.58.0 — taskkill tak ditemukan/blokir AV TIDAK BOLEH merobohkan proses
      // Node saat justru sedang membersihkan (dulu: unhandled 'error' event)
      t.on("error", () => {
        try { c.kill("SIGKILL"); } catch { /* sudah mati */ }
      });
    } else {
      c.kill("SIGKILL");
    }
  } catch {
    try { c.kill("SIGKILL"); } catch { /* sudah mati */ }
  }
}

/** Jalankan ffmpeg, laporkan progres 0..1 dari parsing time= stderr.
 *  bin boleh kosong — akan dipilih otomatis via pilihFfmpeg().
 *  v0.32.0 PERBAIKAN "Merender adegan stak selamanya" (laporan user v0.31):
 *  (1) -nostdin + stdin diabaikan — ffmpeg yang dit_spawn dari Node punya stdin
 *  pipe yang tak pernah tertutup; sebagian build ffmpeg Windows menunggu stdin
 *  dan BEKU tanpa jejak;
 *  (2) batas wall-clock + Windows: taskkill /T /F membunuh seluruh pohon proses;
 *  (3) pesan galat macet menyertakan ekor stderr utk diagnosa.
 *  v0.55.0 — TENGGAT ADAPTIF (laporan user "ffmpeg melewati batas waktu 675
 *  detik" padahal stderr menunjukkan time= masih bertambah): batas absolut kaku
 *  diganti tenggat yg DIPERPANJANG tiap media maju ≥0,25 dtk (perpanjangTenggat)
 *  — render lambat-tapi-maju dibiarkan selesai; beku tetap dibunuh oleh tenggat
 *  (tak diperpanjang) / diamMs (sunyi >diamMs) / batas keras 2 jam (hitungBatasKeras).
 *  v0.57.1 — FASE AWAL (belum ada time=): pesan inisialisasi font/libass + frame
 *  pertama yang berat TIDAK menulis time= → dulu dibunuh diamMs 40 dtk padahal
 *  masih bekerja (laporan user: stderr terakhir hanya "fontselect: ..."). Kini
 *  fase awal diberi diamAwalMs (bawaan 150 dtk) berbasis tanda hidup stderr;
 *  fase jalan diberi bekuMediaMs (stderr hidup tapi time= tak naik 180 dtk →
 *  terhenti, tak menunggu tenggat puluhan menit). */
export async function jalankanFfmpeg(
  args: string[],
  totalDetik: number,
  onProgres?: (fraksi: number) => void,
  bin?: string,
  onSpawn?: (child: ChildProcess) => void,
  opsi?: OpsiFfmpeg,
): Promise<void> {
  const binFinal = bin || (await pilihFfmpeg()).bin;
  const diamMs = opsi?.diamMs ?? 40_000;
  // v0.57.1 — fase awal (belum ada time=): masa tenggang berbasis tanda hidup
  const diamAwalMs = Math.max(diamMs, opsi?.diamAwalMs ?? 150_000);
  const bekuMediaMs = opsi?.bekuMediaMs ?? 180_000;
  // tenggat dasar: eksplisit > skala durasi utk stream terpanjang > bawaan 4 menit
  const absolutMs = opsi?.absolutMs
    ?? (totalDetik > 0 ? Math.max(150_000, Math.ceil(totalDetik) * 15_000) : 240_000);
  const kerasMs = hitungBatasKeras(absolutMs);
  // -nostdin HARUS di depan (opsi global); hindari dobel bila pemanggil sudah mengirim
  const argumen = args[0] === "-nostdin" ? args : ["-nostdin", ...args];
  await new Promise<void>((resolve, reject) => {
    // v0.58.0 — stdout di-IGNORE (dulu "pipe" tanpa pembaca): build ffmpeg yang
    // menulis >64 KB ke stdout bisa MACET menunggu pipa penuh → salah dilaporkan
    // "macet 40 detik" padahal bekerja. Semua pemanggilan menulis ke berkas keluaran,
    // stdout memang tidak pernah dipakai.
    const c = spawn(binFinal, argumen, { windowsHide: true, stdio: ["ignore", "ignore", "pipe"] });
    onSpawn?.(c);
    const mulai = Date.now();
    let stderr = "";
    let terakhirProgres = Date.now(); // baris time= terakhir (fase jalan)
    let terakhirHidup = Date.now(); // v0.57.1 — output stderr APAPUN (fase awal)
    let majuTerakhir = Date.now(); // v0.57.1 — terakhir time= NAIK >0,001 dtk
    let sudahTime = false; // v0.57.1 — sudah ada baris time= (fase jalan)?
    let tenggat = mulai + absolutMs;
    let mediaDetik = 0;
    const berhenti = () => clearInterval(pemeriksa);
    const pemeriksa = setInterval(() => {
      const lewat = Date.now() - mulai;
      opsi?.onDetik?.(Math.round(lewat / 1000));
      if (!sudahTime) {
        // v0.57.1 FASE AWAL — pesan inisialisasi font/libass + frame pertama
        // berat TIDAK menulis time= sama sekali; dulu dibunuh diamMs 40 dtk
        // padahal masih bekerja (laporan user v0.57). Kini masa tenggang
        // diamAwalMs berbasis tanda hidup stderr (output apapun = hidup).
        if (Date.now() - terakhirHidup > diamAwalMs) {
          berhenti();
          bunuhPohon(c);
          reject(
            new Error(
              `ffmpeg belum menghasilkan frame pertama (tidak ada keluaran ${Math.round(diamAwalMs / 1000)} detik) — filter/font berat, mesin sangat sibuk (kurangi Proses paralel, tunggu Subtitle AI selesai), atau kemungkinan berkas sumber/background bermasalah. stderr: ${stderr.slice(-400)}`,
            ),
          );
          return;
        }
      } else {
        // fase JALAN: sunyi dari baris time= > diamMs → macet (perilaku v0.55)
        if (Date.now() - terakhirProgres > diamMs) {
          berhenti();
          bunuhPohon(c);
          reject(
            new Error(
              `ffmpeg macet (tidak ada progres ${Math.round(diamMs / 1000)} detik) — kemungkinan file sumber/background rusak. stderr: ${stderr.slice(-400)}`,
            ),
          );
          return;
        }
        // v0.57.1 — stderr mengalir tapi time= TAK NAIK sama sekali (mis. loop
        // galat decode tanpa akhir) → potong di bekuMediaMs; dulu hanya tenggat
        // adaptif yang menangkap — bisa menggantung puluhan menit.
        if (Date.now() - majuTerakhir > bekuMediaMs) {
          berhenti();
          bunuhPohon(c);
          const spd2 = mediaDetik > 0 ? ((lewat / 1000) / mediaDetik).toFixed(2) : "?";
          reject(
            new Error(
              `ffmpeg terhenti (media tidak maju ${Math.round(bekuMediaMs / 1000)} detik — terakhir time=${fmtWaktu(mediaDetik)}, kecepatan ±${spd2}x) — mesin kelebihan beban atau berkas bermasalah; kurangi Proses paralel / coba Mode Cepat atau 720p. stderr: ${stderr.slice(-400)}`,
            ),
          );
          return;
        }
      }
      const spd = mediaDetik > 0 ? ((lewat / 1000) / mediaDetik).toFixed(2) : "?";
      if (Date.now() > tenggat) {
        // media TAK maju cukup lama (perpanjangan tak terjadi) = macet pelan
        berhenti();
        bunuhPohon(c);
        reject(
          new Error(
            `ffmpeg macet pelan (media tidak maju — terakhir time=${fmtWaktu(mediaDetik)}, kecepatan ±${spd}x) — kemungkinan berkas sumber/background bermasalah atau mesin kelebihan beban. stderr: ${stderr.slice(-400)}`,
          ),
        );
      } else if (lewat > kerasMs) {
        // jaring mutlak 2 jam: maju terus tapi super lambat luar biasa
        berhenti();
        bunuhPohon(c);
        reject(
          new Error(
            `ffmpeg melewati batas keras ${Math.round(kerasMs / 1000)} detik — media baru sampai time=${fmtWaktu(mediaDetik)} (kecepatan ±${spd}x; mesin sangat sibuk/sangat lambat — coba Mode Cepat, resolusi 720p, atau GPU). stderr: ${stderr.slice(-400)}`,
          ),
        );
      }
    }, 5000);
    c.stderr.on("data", (d) => {
      const s = d.toString();
      stderr += s;
      if (stderr.length > 8000) stderr = stderr.slice(-8000);
      terakhirHidup = Date.now(); // v0.57.1 — output apapun = tanda hidup (fase awal)
      const m = s.match(/time=(\d+):(\d+):(\d+(?:\.\d+)?)/);
      if (m) {
        terakhirProgres = Date.now();
        if (!sudahTime) {
          sudahTime = true; // fase jalan dimulai (baris time= pertama)
          majuTerakhir = Date.now(); // penilaian kemajuan mulai dari sini
        }
        const det = Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
        if (det - mediaDetik > 0.001) majuTerakhir = Date.now(); // v0.57.1 — maju beneran
        // v0.55.0 — media maju → tenggat ikut digeser (render lambat tapi maju = selamat)
        tenggat = perpanjangTenggat(
          tenggat, Date.now(), mulai, absolutMs, totalDetik, det, mediaDetik,
        );
        mediaDetik = Math.max(mediaDetik, det);
        if (onProgres && totalDetik > 0) {
          onProgres(Math.min(1, Math.max(0, det / totalDetik)));
        }
      }
    });
    c.on("error", (e) => {
      berhenti();
      reject(new Error(`ffmpeg gagal dijalankan: ${e.message}`));
    });
    c.on("close", (code) => {
      berhenti();
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg keluar dengan kode ${code}: ${stderr.slice(-600)}`));
    });
  });
}

/* ---------- akselerasi perangkat keras (NVENC / QSV / AMF) ---------- */

export interface PilihanEncoder {
  /** nama ramah untuk ditampilkan */
  nama: string;
  /** apakah ini encoder GPU */
  gpu: boolean;
  /** argumen codec lengkap (tanpa -pix_fmt) */
  codecArgs: string[];
}

/** argumen codec CPU dari preset/crf/mode ekspor.
 *  v2.0.0 — level H.264 5.1/5.2 utk 2K/4K (sesuai standar) + bitrate KOMPRES
 *  PINTAR (kbps) — bila bitrate diberikan, CRF diganti CRF-TERBATAS
 *  (crf + maxrate/bufsize) supaya kualitas tetap baik dgn ukuran terkunci. */
export function codecCpu(
  preset: string,
  crf: number,
  codec: CodecVideo = "h264",
  level: string | null = null,
  bitrateKbps: number | null = null,
): string[] {
  const lvl = level ? ["-level", level] : [];
  const br = bitrateKbps && bitrateKbps > 0
    ? ["-maxrate", `${Math.round(bitrateKbps)}k`, "-bufsize", `${Math.round(bitrateKbps * 2)}k`]
    : [];
  return codec === "h265"
    ? ["-c:v", "libx265", "-preset", preset, "-crf", String(crf), "-tag:v", "hvc1", ...lvl, ...br]
    : ["-c:v", "libx264", "-preset", preset, "-crf", String(crf), ...lvl, ...br];
}

const KANDIDAT_GPU: Record<CodecVideo, Array<{
  encoder: string;
  nama: string;
  /** level=true → encoder ini menerima opsi -level string (nvenc) */
  codecArgs: (crf: number, level: string | null, bitrateKbps: number | null) => string[];
}>> = {
  h264: [
    {
      encoder: "h264_nvenc",
      nama: "NVIDIA NVENC H.264 (GPU)",
      codecArgs: (crf, level, br) => [
        "-c:v", "h264_nvenc", "-preset", "p4", "-rc", "vbr", "-cq", String(crf), "-b:v", "0",
        ...(level ? ["-level", level] : []),
        ...(br && br > 0 ? ["-maxrate", `${Math.round(br)}k`, "-bufsize", `${Math.round(br * 2)}k`] : []),
      ],
    },
    {
      encoder: "h264_qsv",
      nama: "Intel Quick Sync H.264 (GPU)",
      codecArgs: (crf, _level, br) => [
        "-c:v", "h264_qsv", "-preset", "faster", "-global_quality", String(crf),
        ...(br && br > 0 ? ["-maxrate", `${Math.round(br)}k`, "-bufsize", `${Math.round(br * 2)}k`] : []),
      ],
    },
    {
      encoder: "h264_amf",
      nama: "AMD AMF H.264 (GPU)",
      codecArgs: (crf, _level, br) => [
        "-c:v", "h264_amf", "-quality", "balanced", "-rc", "cqp", "-qp_i", String(crf), "-qp_p", String(crf),
        ...(br && br > 0 ? ["-maxrate", `${Math.round(br)}k`, "-bufsize", `${Math.round(br * 2)}k`] : []),
      ],
    },
  ],
  h265: [
    {
      encoder: "hevc_nvenc",
      nama: "NVIDIA NVENC H.265 (GPU)",
      codecArgs: (crf, level, br) => [
        "-c:v", "hevc_nvenc", "-preset", "p4", "-rc", "vbr", "-cq", String(crf), "-b:v", "0", "-tag:v", "hvc1",
        ...(level ? ["-level", level] : []),
        ...(br && br > 0 ? ["-maxrate", `${Math.round(br)}k`, "-bufsize", `${Math.round(br * 2)}k`] : []),
      ],
    },
    {
      encoder: "hevc_qsv",
      nama: "Intel Quick Sync H.265 (GPU)",
      codecArgs: (crf, _level, br) => [
        "-c:v", "hevc_qsv", "-preset", "faster", "-global_quality", String(crf), "-tag:v", "hvc1",
        ...(br && br > 0 ? ["-maxrate", `${Math.round(br)}k`, "-bufsize", `${Math.round(br * 2)}k`] : []),
      ],
    },
    {
      encoder: "hevc_amf",
      nama: "AMD AMF H.265 (GPU)",
      codecArgs: (crf, _level, br) => [
        "-c:v", "hevc_amf", "-quality", "balanced", "-rc", "cqp", "-qp_i", String(crf), "-qp_p", String(crf), "-tag:v", "hvc1",
        ...(br && br > 0 ? ["-maxrate", `${Math.round(br)}k`, "-bufsize", `${Math.round(br * 2)}k`] : []),
      ],
    },
  ],
};

let cacheUjiGpu: Map<string, boolean> | null = null;

/** v0.58.0 — kosongkan cache uji encoder GPU: dipanggil jobs.ts saat encoder GPU
 *  GAGAL di runtime (driver reset/jatah sesi habis) supaya video berikutnya
 *  menguji ulang dan otomatis jatuh ke CPU — dulu hasil positif disetuh selamanya. */
export function resetUjiGpu(): void {
  cacheUjiGpu = null;
}

/** Uji encoder benar-benar jalan (terdaftar ≠ berfungsi — butuh GPU fisiknya) */
async function ujiEncoder(encoder: string, bin: string): Promise<boolean> {
  if (!cacheUjiGpu) cacheUjiGpu = new Map();
  const tercache = cacheUjiGpu.get(encoder);
  if (tercache !== undefined) return tercache;
  let hasil = false;
  try {
    await new Promise<void>((resolve, reject) => {
      const c = spawn(
        bin,
        [
          "-hide_banner", "-v", "error",
          "-f", "lavfi", "-i", "color=c=black:s=320x320:d=0.3:r=25",
          "-c:v", encoder, "-f", "null", "-",
        ],
        { windowsHide: true, timeout: 15000 },
      );
      c.on("error", reject);
      c.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`kode ${code}`))));
    });
    hasil = true;
  } catch {
    hasil = false;
  }
  cacheUjiGpu.set(encoder, hasil);
  return hasil;
}

/** Pilih encoder: GPU bila diminta & tersedia, selain itu CPU. Hasilnya di-cache.
 *  v2.0.0 — level (H.264 5.1/5.2 utk 2K/4K) + bitrateKbps (KOMPRES PINTAR).
 *  Cache kini PER-KUNCI (encoder beda level/bitrate = hasil beda). */
export async function pilihEncoder(
  pakaiGpu: boolean,
  preset: string,
  crf: number,
  bin: string,
  codec: CodecVideo = "h264",
  level: string | null = null,
  bitrateKbps: number | null = null,
): Promise<PilihanEncoder> {
  if (pakaiGpu) {
    for (const k of KANDIDAT_GPU[codec]) {
      if (await ujiEncoder(k.encoder, bin)) {
        return { nama: k.nama, gpu: true, codecArgs: k.codecArgs(crf, level, bitrateKbps) };
      }
    }
  }
  return {
    nama: codec === "h265" ? "CPU (libx265)" : "CPU (libx264)",
    gpu: false,
    codecArgs: codecCpu(preset, crf, codec, level, bitrateKbps),
  };
}

/* ---------- pemilihan ffmpeg terbaik (harus dukung drawtext bila ada) ---------- */

export interface FfmpegTerpilih {
  bin: string;
  /** apakah binary ini mendukung filter drawtext (libfreetype) */
  drawtext: boolean;
}

let cacheFfmpeg: FfmpegTerpilih | null = null;

async function bisaDieksekusi(bin: string): Promise<boolean> {
  return new Promise((resolve) => {
    const c = spawn(bin, ["-version"], { windowsHide: true, timeout: 10000 });
    c.on("error", () => resolve(false));
    c.on("close", (code) => resolve(code === 0));
  });
}

/** Uji sungguhan filter drawtext (biner terdaftar ≠ punya libfreetype) */
async function ujiDrawtext(bin: string): Promise<boolean> {
  try {
    await new Promise<void>((resolve, reject) => {
      const c = spawn(
        bin,
        [
          "-hide_banner", "-v", "error",
          "-f", "lavfi", "-i", "color=c=black:s=64x64:d=0.1:r=10",
          "-filter_complex", "drawtext=text='x'",
          "-f", "null", "-",
        ],
        { windowsHide: true, timeout: 15000 },
      );
      c.on("error", reject);
      c.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`kode ${code}`))));
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Pilih binary ffmpeg terbaik: utamakan yang punya drawtext (untuk tulisan judul/Part).
 * Urutan: env VIDSPLIT_FFMPEG → ffmpeg-static → PATH. Hasil di-cache per proses.
 */
export async function pilihFfmpeg(): Promise<FfmpegTerpilih> {
  if (cacheFfmpeg) return cacheFfmpeg;
  const kandidat: string[] = [];
  if (process.env.VIDSPLIT_FFMPEG) kandidat.push(process.env.VIDSPLIT_FFMPEG);
  const statik = [
    cariDiNodeModules("ffmpeg-static/ffmpeg"),
    cariDiNodeModules("ffmpeg-static/ffmpeg.exe"),
  ];
  for (const s of statik) if (s) kandidat.push(s);
  kandidat.push("ffmpeg");

  let cadangan: string | null = null;
  for (const k of [...new Set(kandidat)]) {
    if (!(await bisaDieksekusi(k))) continue;
    if (await ujiDrawtext(k)) {
      cacheFfmpeg = { bin: k, drawtext: true };
      return cacheFfmpeg;
    }
    if (!cadangan) cadangan = k;
  }
  if (cadangan) {
    cacheFfmpeg = { bin: cadangan, drawtext: false };
    return cacheFfmpeg;
  }
  throw new Error("ffmpeg tidak ditemukan. Install ffmpeg atau set VIDSPLIT_FFMPEG");
}
