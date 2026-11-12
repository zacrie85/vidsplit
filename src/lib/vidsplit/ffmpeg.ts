// VidSplit — integrasi ffmpeg/ffprobe: cari binary, probe, susun filter graph, eksekusi
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { teksSiapGambar, bungkusTeks } from "./bungkus";
import { TATA_TEMPLATE, kotakKePx } from "./templatLayar";
import type { CodecVideo, GayaTeks, ModeKonversi, NamaFont, Pengaturan } from "./types";
import { DURASI_ANIMASI_TEKS, DURASI_TRANSISI, rapikanKecepatan, posisiTeksBlok, rapikanPosisiXY, rapikanPosisiY } from "./types";
import type { AnimasiTeks, AnimasiCover } from "./types";
import { rantaiPembicara, type Keyframe } from "./pembicara";
// v3.3.0 — MESIN EFEK NOVACUT: 28 transisi (xfade) + 20 efek klip (rantai filter)
import { planEffects, getTransition, OVERLAY_EFFECTS as OVERLAY_NAMA } from "./efekNovacut";

/** v3.3.0 — path folder overlay efek (scanline/spotlight/flare). Kandidat env
 *  VIDSPLIT_EFEK + lokasi bawaan (assets/efek-novacut di dev, resources/ di paket). */
export function dirOverlayEfek(): string {
  const kandidat = [
    process.env.VIDSPLIT_EFEK,
    path.join(process.cwd(), "assets", "efek-novacut"),
    path.join(process.cwd(), "..", "assets", "efek-novacut"),
    path.join(process.cwd(), "..", "..", "assets", "efek-novacut"),
    path.join((process as unknown as { resourcesPath?: string }).resourcesPath ?? "", "efek-novacut"),
  ].filter(Boolean) as string[];
  for (const d of kandidat) if (existsSync(path.join(d, "scanline.png"))) return d;
  return kandidat[1] ?? "assets/efek-novacut";
}

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
  geserX = 0,
  geserY = 0,
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
      `[blur]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},boxblur=24:2,eq=brightness=-0.04:saturation=1.15[blurf]`,
      `[isi]scale='trunc(iw*${skala}/2)*2':'trunc(ih*${skala}/2)*2'[isif]`,
      `[blurf][isif]overlay=x='(W-w)*${pp}/100':y='(H-h)/2',${ekor}[mv]`,
    ].join(";");
  }
  if (mode === "warna") {
    return `[0:v]scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=${warnaFf(warna)},${ekor}[mv]`;
  }
  // blur: latar = video di-blur memenuhi layar, isi = video contain di tengah
  // v0.51.0 — zoomBlur > 100: isi DIPERBESAR (contain × zoom).
  // v2.7.0 — GESER BEBAS (panah ← ↑ ↓ →, permintaan user): posisi overlay
  //   x = (W−w)/2 × (1 + gx/100)   gx −100 = menempel kiri … +100 = kanan
  //   y = (H−h)/2 × (1 + gy/100)   gy −100 = menempel atas … +100 = bawah
  // gx=gy=0 → PERSIS rumus lama (tengah) — nol regresi. posisiPotong TIDAK
  // lagi dipakai mode blur (kini milik mode crop saja).
  // v2.7.0 — latar blur DICERAHKAN (eq brightness −0.12→−0.04, saturation
  // 0.9→1.15): permintaan user "bagian atas bawah nya hanya berwarna hitam,
  // tidak ada blur lembutnya" — video sumber gelap membuat blur nyaris hitam.
  const gxBlur = Math.min(100, Math.max(-100, Number.isFinite(geserX) ? geserX : 0));
  const gyBlur = Math.min(100, Math.max(-100, Number.isFinite(geserY) ? geserY : 0));
  const zBlur = Math.min(300, Math.max(100, Number.isFinite(zoomBlur) ? zoomBlur : 100)) / 100;
  const rumusGeser = `x='(W-w)/2*(1+${gxBlur}/100)':y='(H-h)/2*(1+${gyBlur}/100)'`;
  if (zBlur <= 1.005) {
    return [
      `[0:v]split=2[isi][blur]`,
      `[blur]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},boxblur=24:2,eq=brightness=-0.04:saturation=1.15[blurf]`,
      `[isi]scale=${W}:${H}:force_original_aspect_ratio=decrease[isif]`,
      `[blurf][isif]overlay=${rumusGeser},${ekor}[mv]`,
    ].join(";");
  }
  const skalaBlur = `min(${W}/iw,${H}/ih)*${zBlur.toFixed(3)}`;
  return [
    `[0:v]split=2[isi][blur]`,
    `[blur]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},boxblur=24:2,eq=brightness=-0.04:saturation=1.15[blurf]`,
    `[isi]scale='trunc(iw*${skalaBlur}/2)*2':'trunc(ih*${skalaBlur}/2)*2'[isif]`,
    `[blurf][isif]overlay=${rumusGeser},${ekor}[mv]`,
  ].join(";");
}

/** v2.1.0 — UPGRADE BACKGROUND INTRO: rantai gambar intro dgn animasi Ken Burns
 *  (zoompan) + teks intro (drawtext). Keluar label [bgv]. animasi "mati" = rantai
 *  lama PERSIS (nol regresi — dites unit di uji-v210).
 *  v2.2.0 — teks intro OTOMATIS dua lapis: JUDUL (dari nama file, warna/ukuran
 *  pilihan user) + LABEL ("Part NN", kuning, di bawah judul) — dua textfile.
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
  fileTeksLabel?: string | null,
  teksLabel?: string,
  /** v3.4.0 — perpanjangan utk transisi cover (xfadeD); kosong = pola lama */
  dTransisi?: number,
): string {
  const anim = p.introAnimasi;
  const aktifAnim =
    anim === "zoom-masuk" || anim === "zoom-keluar" || anim === "geser-kiri" || anim === "geser-kanan" ||
    anim === "geser-atas" || anim === "geser-bawah";
  const D = dTransisi !== undefined ? dTransisi : p.introFade ? DURASI_TRANSISI : 0;
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
    } else if (anim === "geser-atas" || anim === "geser-bawah") {
      // v3.4.0 — PAN Y (menu COVER KINOSTRA seg EFEK COVER: PAN Y): zoom konstan
      // 8% + kamera meluncur vertikal (ala cabang geser horizontal lama)
      zExpr = "1.08";
      const jalan = `(ih-ih/zoom)*min(on/${fr},1)`;
      posisi =
        anim === "geser-bawah"
          ? `x='${tengah}':y='min(max(0,${jalan}),ih-ih/zoom)'`
          : `x='${tengah}':y='min(max(0,(ih-ih/zoom)-${jalan}),ih-ih/zoom)'`;
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
  // v2.2.0 — LABEL intro otomatis ("Part/Bagian/Episode NN") di bawah judul:
  // kuning ala thumbnail, ukuran 55% judul; tanpa judul → label di posisi tengah
  if (fileTeksLabel && (teksLabel ?? "").trim()) {
    const skala = Math.min(W, H) / 1080;
    const uJ = Math.max(12, p.introTeksUkuran * skala);
    const adaJudul = !!teksIntro.trim();
    const barisJ = adaJudul ? Math.max(1, teksIntro.split("\n").length) : 0;
    const uL = Math.max(12, p.introTeksUkuran * 0.55 * skala);
    const yL = Math.round(
      H * 0.42 + (adaJudul ? barisJ * uJ * 1.5 + uJ * 0.45 : 0),
    );
    let dl =
      `drawtext=textfile=${kutipFilter(fileTeksLabel)}:fontsize=${uL.toFixed(1)}` +
      `:fontcolor=#fbbf24:borderw=${Math.max(1, Math.round(4 * skala))}:bordercolor=black` +
      `:x=(w-text_w)/2:y=${yL}`;
    const ffl = fontfile({ font: p.introTeksFont } as GayaTeks);
    if (ffl) dl += `:fontfile=${kutipFilter(ffl)}`;
    dl += `:expansion=none`;
    rantai = rantai.replace("[bgv]", `,${dl}[bgv]`);
  }
  return rantai;
}

/* ================================================================
   v3.4.0 — MENU COVER KINOSTRA (mod 13): rantai intro BERLAPIS ala
   ncBuildCoverLayers — bg (Ken Burns) + judul & part (animasi masuk
   NCTEXTANIMS via geq alpha/zoompan) + bingkai statis paling atas.
   Port ncTextState (inDur = min(0.55, dur×0.35); part ditunda 0.25 dtk;
   TANPA outro-fade — teks menahan posisi sampai transisi mengambil alih).
   ================================================================ */

/** durasi animasi masuk cover (port KINOSTRA: min(0.55, dur × 0.35)) */
export function durasiAnimCover(durasiCover: number): number {
  return Math.min(0.55, Math.max(0.1, durasiCover * 0.35));
}

const easeOutExpr = (p: string) => `(1-pow(1-${p},3))`;

/** ekspresi geq ALPHA utk satu animasi cover (T = waktu sejak layer mulai).
 *  Semua port ncTextState — deterministik tanpa seed. */
function geqAlphaCover(anim: AnimasiCover, t0: number, inD: number): string {
  const geser = t0 > 0 ? `max(0,T-${t0.toFixed(3)})` : "T";
  const inP = `min(1,${geser}/${inD.toFixed(3)})`;
  const dasar = `alpha(X,Y)*`;
  switch (anim) {
    case "rise":
    case "fade":
      return `${dasar}${inP}`;
    case "typewriter":
      // huruf muncul kiri→kanan dgn kurva pow(inP,0.85) (port ncAnimSpacedLine)
      // catatan: ekspresi ffmpeg TIDAK punya ternary ? : — pakai if(lt(...),..,..)
      return `${dasar}if(lt(X,W*pow(${inP},0.85)),alpha(X,Y),0)`;
    case "neon":
      // kedip ala lampu neon (port 0.78+0.22*abs(sin(local*18)))
      return `${dasar}min(1,${inP})*(0.78+0.22*abs(sin(${geser}*18)))`;
    case "tracking":
      // huruf menyebar lalu rapat — dilakukan via geser sampel X (di geqHuruf)
      return `${dasar}${inP}`;
    case "glitch":
      // RGB split bergoyang — geser kanal ditangani geqHurufCover
      return `${dasar}min(1,${inP})`;
    case "wipe":
      return `${dasar}if(lt(X,W*${easeOutExpr(inP)}),alpha(X,Y),0)`;
    case "slam":
      // muncul cepat ×2.2 (port min(1,inP*2.2)); skala via zoompan
      return `${dasar}min(1,2.2*${inP})`;
    default:
      return `${dasar}min(1,${inP})`;
  }
}

/** geser sampel kanal RGB utk animasi tracking/glitch — geq per kanal.
 *  tracking: X direnggangkan dr tengah (1+spread); glitch: kanal R/B digeser
 *  bergoyang. Return string geq penuh (format=rgba sudah disuntik pemanggil). */
function geqHurufCover(anim: AnimasiCover, t0: number, inD: number): string | null {
  const geser = t0 > 0 ? `max(0,T-${t0.toFixed(3)})` : "T";
  const inP = `min(1,${geser}/${inD.toFixed(3)})`;
  const clampX = (e: string) => `min(max(${e},0),W-1)`;
  if (anim === "tracking") {
    const spread = `*(1+(1-${easeOutExpr(inP)})*0.12)`;
    const xs = `(W/2+(X-W/2)${spread})`;
    return `geq=r='r(${clampX(xs)},Y)':g='g(${clampX(xs)},Y)':b='b(${clampX(xs)},Y)':a='${geqAlphaCover("tracking", t0, inD)}'`;
  }
  if (anim === "glitch") {
    const jx = `(sin(T*47)*3+sin(T*31)*2)*(1+0.9*step(0.3,sin(T*13)))`;
    const jxr = clampX(`(X+${jx})`);
    const jxb = clampX(`(X-${jx})`);
    return `geq=r='r(${jxr},Y)':g='g(X,Y)':b='b(${jxb},Y)':a='${geqAlphaCover("glitch", t0, inD)}'`;
  }
  return null;
}

/** zoompan SLAM (skala 2.6→1 ala ncTextState: scale = 1+(1-easeOut(p×1.15))*1.6) */
function zoompanSlam(fps: number, t0: number, inD: number, W: number, H: number): string {
  const p = `min(1,max(0,(in/${fps})-${t0.toFixed(3)}))*1.15/${inD.toFixed(3)}`;
  const z = `min(2.6,1+1.6*(1-${easeOutExpr(p)}))`;
  return `zoompan=z='${z}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=${W}x${H}:fps=${fps}`;
}

export interface OpsiIntroKino {
  W: number;
  H: number;
  fps: number;
  /** durasi intro (detik) */
  N: number;
  /** perpanjangan utk xfade transisi (0 = potong kering) */
  D: number;
  /** indeks input filter graph: bg SELALU 1; judul/part/bingkai di akhir */
  idxJudul: number;
  idxPart: number;
  idxBingkai: number;
  animJudul: AnimasiCover;
  animPart: AnimasiCover;
  /** Ken Burns latar (p.introAnimasi — fx seg COVER KINOSTRA) */
}

/** Rantai intro BERLAPIS → [bgv]. Input: 1=bg PNG (framerate fps), idxJudul,
 *  idxPart, idxBingkai = PNG transparan penuh kanvas. KINOSTRA: bg digerakkan
 *  Ken Burns, judul/part dianimasikan (part +0.25 dtk), bingkai statis. */
export function rantaiIntroKino(
  p: Pengaturan,
  o: OpsiIntroKino,
): string {
  const { W, H, fps } = o;
  const N = o.N;
  const D = o.D;
  const panjang = N + D;
  const fr = Math.max(1, Math.round(fps * panjang));
  const inD = durasiAnimCover(N);
  const t0Part = 0.25;

  // ---- latar dgn Ken Burns (persis pola rantaiIntroBg anim) ----
  const anim = p.introAnimasi;
  const tengah = "iw/2-(iw/zoom/2)";
  let zExpr = "1";
  let posisi = `x='${tengah}':y='ih/2-(ih/zoom/2)'`;
  const Z = 0.12;
  if (anim === "zoom-masuk") {
    zExpr = `min(1+${Z}*on/${fr},1+${Z})`;
  } else if (anim === "zoom-keluar") {
    zExpr = `max(1+${Z}-${Z}*on/${fr},1)`;
  } else if (anim === "geser-kiri" || anim === "geser-kanan") {
    zExpr = "1.08";
    const jalan = `(iw-iw/zoom)*min(on/${fr},1)`;
    posisi =
      anim === "geser-kiri"
        ? `x='min(max(0,${jalan}),iw-iw/zoom)':y='ih/2-(ih/zoom/2)'`
        : `x='min(max(0,(iw-iw/zoom)-${jalan}),iw-iw/zoom)':y='ih/2-(ih/zoom/2)'`;
  } else if (anim === "geser-atas" || anim === "geser-bawah") {
    zExpr = "1.08";
    const jalan = `(ih-ih/zoom)*min(on/${fr},1)`;
    posisi =
      anim === "geser-bawah"
        ? `x='${tengah}':y='min(max(0,${jalan}),ih-ih/zoom)'`
        : `x='${tengah}':y='min(max(0,(ih-ih/zoom)-${jalan}),ih-ih/zoom)'`;
  }
  const FAKTOR_UPS = W * H > 3_500_000 ? 1.25 : 2;
  const upW = Math.max(2, Math.round((W * FAKTOR_UPS) / 2) * 2);
  const upH = Math.max(2, Math.round((H * FAKTOR_UPS) / 2) * 2);
  const rantai: string[] = [];
  rantai.push(
    `[1:v]scale=${upW}:${upH}:force_original_aspect_ratio=increase,crop=${upW}:${upH},` +
      `zoompan=z='${zExpr}':${posisi}:d=1:fps=${fps}:s=${W}x${H},setsar=1` +
      `,trim=duration=${panjang.toFixed(3)},setpts=PTS-STARTPTS,fps=${fps}[bgv]`,
  );

  // ---- lapis judul + part (animasi masuk) ----
  const lapis = (
    labelIn: string,
    idx: number,
    anim: AnimasiCover,
    t0: number,
    tag: string,
  ): string | null => {
    if (!anim || idx < 0) return null;
    const langkah: string[] = [`[${idx}:v]`];
    const slam = anim === "slam";
    if (slam) langkah.push(zoompanSlam(fps, t0, inD, W, H));
    langkah.push("format=rgba,setsar=1");
    const gh = geqHurufCover(anim, t0, inD);
    if (gh) langkah.push(gh);
    else langkah.push(`geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='${geqAlphaCover(anim, t0, inD)}'`);
    langkah.push(`trim=duration=${panjang.toFixed(3)},setpts=PTS-STARTPTS,fps=${fps}[${tag}t]`);
    // label TANPA koma sesudahnya; langkah berikutnya disambung koma
    rantai.push(langkah[0] + langkah.slice(1).join(","));
    // geser Y utk RISE (dy = (1-easeOut(inP)) × 0.09H — port ncTextState rise)
    let xy = "0:0";
    if (anim === "rise") {
      const geser = t0 > 0 ? `max(0,t-${t0.toFixed(3)})` : "t";
      const inPt = `min(1,${geser}/${inD.toFixed(3)})`;
      xy = `0:'(1-${easeOutExpr(inPt)})*${(H * 0.09).toFixed(1)}'`;
    }
    rantai.push(`[bgv][${tag}t]overlay=${xy}[bgv]`);
    void labelIn;
    return tag;
  };
  lapis("judul", o.idxJudul, o.animJudul, 0, "aj");
  lapis("part", o.idxPart, o.animPart, t0Part, "ap");

  // ---- bingkai statis paling atas ----
  if (o.idxBingkai >= 0) {
    rantai.push(`[${o.idxBingkai}:v]format=rgba,setsar=1,trim=duration=${panjang.toFixed(3)},setpts=PTS-STARTPTS,fps=${fps}[bk]`);
    rantai.push(`[bgv][bk]overlay=0:0[bgv]`);
  }
  return rantai.join(";");
}

/* ================================================================
   v3.4.0 — EFEK VISUAL (mod 08 KINOSTRA): kecerahan/kontras/kejenuhan
   + filter warna satu klik (port COLORFILTERS core.js) + vignette +
   film grain. Diujung rantai video (semua lapisan ikut).
   ================================================================ */

/** matriks sepia parsial (blend identik ↔ sepia ×) — colorchannelmixer */
function matriksSepia(x: number): string {
  const f = (ident: number, sepia: number) => (ident * (1 - x) + sepia * x).toFixed(4);
  return (
    `colorchannelmixer=rr=${f(1, 0.393)}:rg=${f(0, 0.769)}:rb=${f(0, 0.189)}` +
    `:gr=${f(0, 0.349)}:gg=${f(1, 0.686)}:gb=${f(0, 0.168)}` +
    `:br=${f(0, 0.272)}:bg=${f(0, 0.534)}:bb=${f(1, 0.131)}`
  );
}

/** rantai filter warna satu klik (port COLORFILTERS: css + tint overlay) */
export function rantaiFilterWarna(kunci: string): string[] {
  const tint = (warna: string, op: number) => `drawbox=x=0:y=0:w=iw:h=ih:color=${warna}@${op}:t=fill`;
  switch (kunci) {
    case "horor":
      return ["hue=h=-12", "eq=saturation=0.72:contrast=1.13:brightness=-0.07", tint("#5AFFAA", 0.07)];
    case "dangdut":
      return [matriksSepia(0.16), "eq=saturation=1.32:contrast=1.06:brightness=0.04", tint("#FFBE3C", 0.06)];
    case "teal":
      return ["eq=contrast=1.14:saturation=1.16", tint("#008CFF", 0.08)];
    case "noir":
      return ["hue=s=0", "eq=contrast=1.24:brightness=0.02"];
    case "vintage":
      return [matriksSepia(0.42), "eq=saturation=0.85:contrast=0.94:brightness=0.05", tint("#FFAA5A", 0.05)];
    case "vivid":
      return ["eq=saturation=1.45:contrast=1.1"];
    case "dingin":
      return ["hue=h=14", "eq=saturation=0.92:brightness=-0.02", tint("#3C78FF", 0.07)];
    case "pucat":
      return ["eq=saturation=0.6:brightness=0.12:contrast=0.92", tint("#FFDCF0", 0.06)];
    case "seram":
      return ["eq=saturation=0.82:contrast=1.28:brightness=-0.1", tint("#FF1428", 0.08)];
    default:
      return [];
  }
}

/** v3.4.0 — rantai VFX penuh (null = tidak ada = perilaku lama persis).
 *  Dipasang di [vout] terakhir sebelum kecepatan/transisi → semua lapisan ikut. */
export function rantaiVfx(p: Pengaturan): string[] | null {
  const bagian: string[] = [];
  const eq: string[] = [];
  if (Math.abs(p.vfxKecerahan - 1) > 0.001) eq.push(`brightness=${(p.vfxKecerahan - 1).toFixed(3)}`);
  if (Math.abs(p.vfxKontras - 1) > 0.001) eq.push(`contrast=${p.vfxKontras.toFixed(3)}`);
  if (Math.abs(p.vfxKejenuhan - 1) > 0.001) eq.push(`saturation=${p.vfxKejenuhan.toFixed(3)}`);
  if (eq.length) bagian.push(`eq=${eq.join(":")}`);
  bagian.push(...rantaiFilterWarna(p.vfxFilter || ""));
  if (p.vfxVignette) bagian.push("vignette=angle=PI/5");
  if (p.vfxGrain) bagian.push("noise=alls=7:allf=t+u");
  return bagian.length ? bagian : null;
}

/* ================================================================
   v3.4.0 — KEN BURNS VIDEO (mod 09 GERAK & TRANSISI KINOSTRA):
   perbesar/geser perlahan otomatis DI DALAM video (zoompan di ujung
   rantai, kekuatan 0.05–0.6). Port semangat ncKenburnsRect.
   ================================================================ */
export function rantaiKenburns(
  mode: string,
  kekuatan: number,
  W: number,
  H: number,
  fps: number,
  durasi: number,
): string | null {
  if (mode === "off" || !mode) return null;
  const S = Math.min(0.6, Math.max(0.05, kekuatan || 0.3));
  const dur = Math.max(0.5, durasi);
  const prog = `min(on/(${fps}*${dur.toFixed(3)}),1)`;
  const tengah = "iw/2-(iw/zoom/2)";
  let zExpr = "1";
  let xy = `x='${tengah}':y='ih/2-(ih/zoom/2)'`;
  if (mode === "in") {
    zExpr = `min(1+${S.toFixed(3)}*${prog},1+${S.toFixed(3)})`;
  } else if (mode === "out") {
    zExpr = `max(1+${S.toFixed(3)}-${S.toFixed(3)}*${prog},1)`;
  } else if (mode === "panx" || mode === "pany" || mode === "diag") {
    // zoom tetap + kamera menyapu; diag = zoom in + sapuan diagonal
    const zoomTetap = (1 + S * 0.5).toFixed(3);
    const slack = mode === "pany" ? "(ih-ih/zoom)" : "(iw-iw/zoom)";
    const jalan = `${slack}*${prog}`;
    if (mode === "panx") {
      zExpr = zoomTetap;
      xy = `x='min(max(0,${jalan}),iw-iw/zoom)':y='ih/2-(ih/zoom/2)'`;
    } else if (mode === "pany") {
      zExpr = zoomTetap;
      xy = `x='${tengah}':y='min(max(0,${jalan}),ih-ih/zoom)'`;
    } else {
      zExpr = `min(1+${S.toFixed(3)}*${prog},1+${S.toFixed(3)})`;
      const slack2 = `min(iw-iw/zoom,ih-ih/zoom)`;
      xy = `x='min(max(0,(iw-iw/zoom)/2+(${slack2})*(${prog}-0.5)),iw-iw/zoom)':y='min(max(0,(ih-ih/zoom)/2+(${slack2})*(${prog}-0.5)),ih-ih/zoom)'`;
    }
  }
  return (
    `zoompan=z='${zExpr}':${xy}:d=1:s=${W}x${H}:fps=${fps},setsar=1`
  );
}

/** v3.4.0 — opasitas & posisi WATERMARK TEKS (mod 08 KINOSTRA drawWatermark):
 *  pad 28u, fontsize 30u×skala, posisi tl/tr/bl/br — u = H/1080. Murni. */
export function posisiWmTeks(
  pos: string,
  W: number,
  H: number,
): { x: string; y: string } {
  // v3.4.0 — ekspresi drawtext memakai main_w/main_h/text_w/text_h
  // (beda dgn overlay yang punya alias W/w — drawtext tak punya alias itu,
  // 'W-w-…' diam-diam gagal diparse → teks tak digambar; ketemu di uji render)
  const pad = (28 * (H / 1080)).toFixed(1);
  const p = String(pos || "br");
  if (p === "tl") return { x: `${pad}`, y: `${pad}` };
  if (p === "tr") return { x: `main_w-text_w-${pad}`, y: `${pad}` };
  if (p === "bl") return { x: `${pad}`, y: `main_h-text_h-${pad}` };
  return { x: `main_w-text_w-${pad}`, y: `main_h-text_h-${pad}` };
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
 *  textfile — drawtext multi-baris, tidak ada lagi teks 1 baris terpotong kiri-kanan.
 *  v2.4.0 — POSISI BEBAS TERPISAH (permintaan user: "posisi judul serta part
 *  bisa dipisah" + "bebas ditaruh dimana saja dengan cara digeser"): judul &
 *  part kini punya judulX/Y & partX/Y sendiri (persen frame; -1 = otomatis).
 *  NOL REGRESI: bawaan (50/-1/50/-1) memunculkan string PERSIS rantai lama
 *  posisiTeks "atas" (judul margin atas, part tepat di bawahnya) — dites
 *  string-sajar di uji-v240. */
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

  // v2.4.0 — posisi Y efektif (otomatis -1 = perilaku lama) + posisi X (50 = tengah)
  const { yJ, yP } = posisiTeksBlok(
    rapikanPosisiY(p.judulY, -1),
    rapikanPosisiY(p.partY, -1),
    H, mrg, tJ, tP, gap,
  );
  const xJ = rapikanPosisiXY(p.judulX, 50);
  const xP = rapikanPosisiXY(p.partX, 50);

  const bagian: string[] = [];
  /** v2.4.0 — X drawtext: 50 → pola lama persis (x=(w-text_w)/2); lainnya →
   *  ekspresi berjaga (teks tak keluar frame), jangkar = TENGAH blok teks.
   *  PENTING: ekspresi mengandung KOMA — wajib dibungkus kutip tunggal (pola
   *  sama dgn overlay deskripsi/logo). */
  const ekspresiX = (x: number): string =>
    x === 50
      ? "(w-text_w)/2"
      : `'min(max(0,W*${Number(x.toFixed(2))}/100-text_w/2),W-text_w)'`;
  // v3.3.0 — ANIMASI MASUK TEKS (8 gaya): drawtext alpha/x/y ekspresi waktu.
  // p = min(t/D,1) progres; semua ekspresi dikutip (berisi koma). Mati → null.
  const anim = (p.animasiTeks ?? "") as AnimasiTeks;
  const D = DURASI_ANIMASI_TEKS;
  const prog = `min(t/${D.toFixed(2)},1)`;
  const animAlpha: Record<string, string> = {
    fade: prog,
    naik: prog,
    turun: prog,
    "geser-kiri": prog,
    "geser-kanan": prog,
    neon: `min(${prog}*1.6,1)*(0.78+0.22*abs(sin(t*9)))`,
    denyut: `${prog}*(0.85+0.15*sin(t*8))`,
    slam: "min(t/0.15,1)",
  };
  const animY = (yPx: number): string => {
    switch (anim) {
      case "naik": return `'${Math.round(yPx)}+(1-${prog})*${(H * 0.06).toFixed(1)}'`;
      case "turun": return `'${Math.round(yPx)}-(1-${prog})*${(H * 0.06).toFixed(1)}'`;
      case "slam": return `'${Math.round(yPx)}-(1-pow(1-${prog.replace("t/" + D.toFixed(2), "t/0.45")},3))*${(H * 0.12).toFixed(1)}'`;
      default: return String(Math.round(yPx));
    }
  };
  const animX = (xExpr: string): string => {
    if (anim === "geser-kiri") return `'(${xExpr})+(1-${prog})*${(W * 0.18).toFixed(1)}'`;
    if (anim === "geser-kanan") return `'(${xExpr})-(1-${prog})*${(W * 0.18).toFixed(1)}'`;
    return xExpr;
  };
  const animOpsi = (): string => {
    const a = animAlpha[anim];
    return a ? `:alpha='${a}'` : "";
  };

  const opsiDasar = (
    fontsize: number,
    warna: string,
    outline: GayaTeks,
    y: number,
    ff: string,
    xExpr: string,
  ) => {
    let s = `fontsize=${fontsize.toFixed(1)}:fontcolor=${warnaFf(warna)}`;
    if (outline.outlineLebar > 0) {
      s += `:borderw=${Math.max(1, Math.round(outline.outlineLebar * skala))}:bordercolor=${warnaFf(outline.outlineWarna)}`;
    }
    s += `:x=${xExpr}`;
    // v3.3.0 — y TIDAK di sini: pemanggil menyisipkan :y= (ekspresi animasi ATAU
    // angka statis) setelah opsiDasar
    if (ff) s += `:fontfile=${kutipFilter(ff)}`;
    // v0.58.0 — expansion=none: teks user berisi "%{" dulu membuat parser drawtext
    // gagal → seluruh part kena galat samar (aplikasi tak memakai fungsi %{...})
    s += `:expansion=none`;
    return s;
  };

  if (teksJ.trim()) {
    const ffJ = fontfile(p.gayaJudul) || fontfile(p.gayaPart);
    // v3.3.0 — animasi: y/x berubah jadi ekspresi + alpha (mati → persis lama)
    bagian.push(
      `drawtext=textfile=${kutipFilter(fileJudul)}:${opsiDasar(uJ, p.gayaJudul.warna, p.gayaJudul, yJ, ffJ, animX(ekspresiX(xJ)))}` +
        `${animOpsi()}:y=${animY(yJ)}:line_spacing=${(uJ * 0.3).toFixed(1)}`,
    );
  }
  if (teksP.trim()) {
    const ffP = fontfile(p.gayaPart) || fontfile(p.gayaJudul);
    bagian.push(
      `drawtext=textfile=${kutipFilter(filePart)}:${opsiDasar(uP, p.gayaPart.warna, p.gayaPart, yP, ffP, animX(ekspresiX(xP)))}` +
        `${animOpsi()}:y=${animY(yP)}:line_spacing=${(uP * 0.3).toFixed(1)}`,
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
  /** v2.2.0 — path PNG frame intro (hasil ambil frame dari video sumber di
   *  jobs.ts) atau null. Fitur unggah gambar/template DIHAPUS. */
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
  /** v2.2.0 — TEKS INTRO OTOMATIS: judul dari NAMA FILE (mentah — dibungkus di
   *  sini) + label "Part/Bagian/Episode NN". Kosong = tanpa teks itu. */
  introJudulTxt?: string;
  introLabelTxt?: string;
  /** v3.3.0 — TRANSISI NOVACUT ANTAR PART: ekor part SEBELUMNYA diambil dari
   *  SUMBER (mulaiPrev = detik sumber awal ekor, durasi = detik OUTPUT) lalu
   *  dilebur xfade dgn kepala part ini — transisi silang sungguhan ala
   *  KolosalCut/NOVACUT. null / part pertama = tanpa transisi. */
  transisiMasuk?: { id: string; durasi: number; mulaiPrev: number; srcPrev?: string } | null;
  /** v3.4.0 — COVER BERLAPIS ala KINOSTRA (ncBuildCoverLayers): PNG judul/part/
   *  bingkai penuh kanvas (jobs.ts menulis via svgCoverLapis). Diisi → rantai
   *  intro memakai rantaiIntroKino (animasi masuk dgn geq/zoompan). */
  bgJudul?: string | null;
  bgPartLapis?: string | null;
  bgBingkai?: string | null;
  /** v3.5.0 — BINGKAI JUDUL FUTURISTIK: PNG transparan kanvas penuh (kotak
   *  frame mengikuti blok judul, posisi = judulX/judulY — jobs.ts menulis via
   *  tulisPngBingkaiJudul/thumbnail.ts). Diisi → overlay DI BAWAH drawtext. */
  fileBingkaiJudul?: string | null;
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
  // v3.5.0 — bingkai judul futuristik: PNG transparan di bawah drawtext
  // (mode template punya kotak desain sendiri — bingkai bebas tidak berlaku)
  const pakaiBingkaiJudul =
    !!a.fileBingkaiJudul && existsSync(a.fileBingkaiJudul) && p.mode !== "template";
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
  // v3.4.0 — WATERMARK TEKS (mod 08 KINOSTRA) — textfile aman unicode/koma
  writeFileSync(path.join(a.dirTmp, `${a.tag}-wm.txt`), (p.wmTeks || "").trim(), "utf8");
  const fileJudul = path.join(a.dirTmp, `${a.tag}-judul.txt`);
  const filePart = path.join(a.dirTmp, `${a.tag}-part.txt`);
  const fileDeskripsi = path.join(a.dirTmp, `${a.tag}-deskripsi.txt`);
  // v2.2.0 — TEKS INTRO OTOMATIS: judul dari NAMA FILE (dibungkus aturan sama
  // dgn judul utama: lebar 92% frame) + label "Part/Bagian/Episode NN" — dua
  // textfile, digambar rantaiIntroBg (judul warna pilihan user, label kuning).
  // TEKS TERBUNGKUS ikut diteruskan ke rantai — jumlah barisnya menentukan
  // posisi label (bug: mentah 1 baris membuat label menimpa judul terlipat).
  const judulIntroMentah = (a.introJudulTxt || "").trim();
  const labelIntroMentah = (a.introLabelTxt || "").trim();
  const fileIntro =
    pakaiBg && judulIntroMentah ? path.join(a.dirTmp, `${a.tag}-intro.txt`) : null;
  let teksIntroSiap = "";
  if (fileIntro) {
    const skalaTxt = Math.min(W, H) / 1080;
    const uTxt = Math.max(12, p.introTeksUkuran * skalaTxt);
    teksIntroSiap = bungkusTeks(judulIntroMentah, W * 0.92, uTxt, p.introTeksFont);
    writeFileSync(fileIntro, teksIntroSiap, "utf8");
  }
  const fileIntroLbl =
    pakaiBg && labelIntroMentah ? path.join(a.dirTmp, `${a.tag}-intro-l.txt`) : null;
  if (fileIntroLbl) {
    writeFileSync(fileIntroLbl, labelIntroMentah, "utf8");
  }

  // URUTAN INPUT PENTING (indeks filter graph): 0=src, 1=bg?, lalu anullsrc,
  // lalu logo PALING AKHIR — sehingga idxLogo = pakaiBg ? 3 : 2 selalu benar
  // dan referensi audio [2:a] / -map 2:a tidak pernah bergeser oleh logo.
  const inputs: string[] = ["-ss", a.mulai.toFixed(3), "-i", a.src];
  // v2.1.0 — FADE LEMBUT: gambar diperpanjang +DURASI_TRANSISI (xfade menimpa
  // D terakhir) → durasi hasil TETAP N+M; animasi Ken Burns butuh -framerate
  // fps agar ekspresi zoompan `on` selaras dgn waktu (nol regresi: mati+langsung
  // = argumen input persis lama).
  // v3.4.0 — TRANSISI COVER → VIDEO (mod 13 KINOSTRA): p.coverTrans (28 gaya
  // NOVACUT, "" = potong kering) menggantikan introFade (simpanan lama sudah
  // dimigrasi → crossfade; introFade hanya jaga-jaga).
  const infoTransCover = (() => {
    const t = p.coverTrans ? getTransition(p.coverTrans) : null;
    if (t) return { xfade: t.xfade, d: Math.min(1.5, Math.max(0.2, p.coverTransDurasi || 0.6)) };
    if (p.introFade === true) return { xfade: "fade", d: DURASI_TRANSISI };
    return null;
  })();
  const pakaiXfadeIntro = pakaiBg && !!infoTransCover;
  const xfadeD = infoTransCover?.d ?? 0;
  const panjangBg = pakaiBg ? p.durasiIntro + (pakaiXfadeIntro ? xfadeD : 0) : 0;
  const pakaiAnimIntro =
    pakaiBg &&
    (p.introAnimasi === "zoom-masuk" ||
      p.introAnimasi === "zoom-keluar" ||
      p.introAnimasi === "geser-kiri" ||
      p.introAnimasi === "geser-kanan" ||
      p.introAnimasi === "geser-atas" ||
      p.introAnimasi === "geser-bawah");
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

  // v3.4.0 — COVER BERLAPIS ala KINOSTRA: PNG judul/part/bingkai (penuh kanvas)
  // ditambahkan SETELAH suara intro (pola input-di-akhir — indeks audio tetap).
  // rantai intro memakai rantaiIntroKino (animasi masuk geq/zoompan).
  // Input hanya untuk lapis yang BENAR-BENAR dianimasikan (tanpa input nganggur).
  const pakaiJudulLapis =
    pakaiBg && !!a.bgJudul && existsSync(a.bgJudul) && (p.coverAnimJudul || "") !== "";
  const pakaiPartLapis =
    pakaiBg && !!a.bgPartLapis && existsSync(a.bgPartLapis) && (p.coverAnimPart || "") !== "";
  const pakaiBingkaiLapis =
    pakaiBg && !!a.bgBingkai && existsSync(a.bgBingkai) && (p.coverBingkai || "none") !== "none";
  const inputLapis: string[] = [];
  let idxLapis = pakaiSuaraIntro ? idxSuaraIntro + 1 : dasarAkhir;
  const idxJudulLapis = pakaiJudulLapis ? idxLapis++ : -1;
  const idxPartLapis = pakaiPartLapis ? idxLapis++ : -1;
  const idxBingkaiLapis = pakaiBingkaiLapis ? idxLapis++ : -1;
  // v3.5.0 — input bingkai judul SETELAH lapis cover (pola input-di-akhir —
  // indeks audio [2:a]/[1:a] & logo tidak pernah bergeser)
  const idxBingkaiJudul = pakaiBingkaiJudul ? idxLapis++ : -1;
  const inputBingkaiJudul: string[] = pakaiBingkaiJudul
    ? ["-loop", "1", "-i", a.fileBingkaiJudul as string]
    : [];
  if (pakaiJudulLapis) {
    inputLapis.push("-loop", "1", "-framerate", String(fps), "-t", panjangBg.toFixed(3), "-i", a.bgJudul as string);
  }
  if (pakaiPartLapis) {
    inputLapis.push("-loop", "1", "-framerate", String(fps), "-t", panjangBg.toFixed(3), "-i", a.bgPartLapis as string);
  }
  if (pakaiBingkaiLapis) {
    inputLapis.push("-loop", "1", "-framerate", String(fps), "-t", panjangBg.toFixed(3), "-i", a.bgBingkai as string);
  }

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
  const DFade = pakaiXfadeIntro ? xfadeD : 0;
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
  // v3.4.0 — KEN BURNS VIDEO (mod 09) + VFX (mod 08) diterapkan pada KONTEN
  // (sebelum overlay frame/teks/sub/logo/watermark) — pola KINOSTRA: kb & warna
  // menggerakkan/mewarnai VIDEO saja; overlay tetap terkunci di kanvas.
  // (dipasang di konten juga mencegah intro ikut zoom ganda — intro punya fx sendiri)
  const rantaiVfxBagian = rantaiVfx(p);
  const rantaiKb = rantaiKenburns(p.kbMode || "off", p.kbKekuatan, W, H, fps, a.durasi);
  const terapkanKontenEfek = (lblIn: string, lblOut = "kbc"): string => {
    const langkah: string[] = [];
    if (rantaiKb) langkah.push(rantaiKb);
    if (rantaiVfxBagian) langkah.push(...rantaiVfxBagian);
    if (!langkah.length) return lblIn;
    filterVideo.push(`[${lblIn}]fps=${fps},${langkah.join(",")},format=yuv420p[${lblOut}]`);
    return lblOut;
  };
  const sambungIntro = (lblKonten: string) => {
    const lbl = terapkanKontenEfek(lblKonten);
    return pakaiXfadeIntro
      ? // xfade WAJIB masukan constant-frame-rate — fps= di kedua cabang
        // menjamin itu (zoompan/overlay bisa melaporkan rate 1/0 → xfade menolak)
        // v3.4.0 — nama transisi & durasi dari menu COVER KINOSTRA (coverTrans)
        `[${lbl}]format=yuv420p,fps=${fps}[ccx];[bgv]format=yuv420p,fps=${fps}[bgx];` +
        `[bgx][ccx]xfade=transition=${infoTransCover?.xfade ?? "fade"}:duration=${xfadeD.toFixed(3)}:offset=${p.durasiIntro.toFixed(3)}[cc]`
      : `[bgv][${lbl}]concat=n=2:v=1:a=0[cc]`;
  };
  const rantaiBgStr = pakaiBg
    ? pakaiJudulLapis || pakaiPartLapis || pakaiBingkaiLapis
      ? rantaiIntroKino(p, {
          W,
          H,
          fps,
          N: p.durasiIntro,
          D: pakaiXfadeIntro ? xfadeD : 0,
          idxJudul: idxJudulLapis,
          idxPart: idxPartLapis,
          idxBingkai: idxBingkaiLapis,
          animJudul: (p.coverAnimJudul || "") as AnimasiCover,
          animPart: (p.coverAnimPart || "") as AnimasiCover,
        })
      : rantaiIntroBg(p, W, H, fps, p.durasiIntro, fileIntro, teksIntroSiap, fileIntroLbl, labelIntroMentah, pakaiXfadeIntro ? xfadeD : 0)
    : null;
  if (rantaiPembicaraStr && !pakaiBg && !pakaiTemplat) {
    // zoom pembicara: hasil langsung [cc] (tanpa intro bg — podca/raycast vertikal)
    filterVideo.push(rantaiPembicaraStr);
    terapkanKontenEfek("cc");
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
    } else {
      terapkanKontenEfek("cc");
    }
  } else if (pakaiBg) {
    filterVideo.push(rantaiBgStr as string);
    filterVideo.push(rantaiUtama(p.mode, W, H, p.warnaLatar, fps, a.durasi, p.posisiPotong, p.zoomPotong, p.zoomBlur, p.geserBlurX, p.geserBlurY));
    filterVideo.push(sambungIntro("mv"));
  } else {
    filterVideo.push(
      rantaiUtama(p.mode, W, H, p.warnaLatar, fps, a.durasi, p.posisiPotong, p.zoomPotong, p.zoomBlur, p.geserBlurX, p.geserBlurY).replace("[mv]", "[cc]"),
    );
    terapkanKontenEfek("cc");
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
  // v3.5.0 — BINGKAI JUDUL FUTURISTIK: PNG transparan (kotak frame mengikuti
  // blok judul, posisi = judulX/judulY dari jobs.ts) DI BAWAH drawtext —
  // urutan lapis: video → frame → neon → BINGKAI JUDUL → judul/Part → sub → logo.
  // Animasi masuk mengikuti animasiTeks: gaya posisi (naik/turun/slam/geser)
  // lewat ekspresi x/y overlay + eval=frame; gaya alpha (fade/neon/denyut/slam)
  // lewat fade alpha (slam cepat 0,15 s — sama dgn drawtext).
  if (pakaiBingkaiJudul) {
    const animBj = (p.animasiTeks ?? "") as AnimasiTeks;
    const progBj = `min(t/${DURASI_ANIMASI_TEKS.toFixed(2)},1)`;
    const posisiAnim = animBj === "naik" || animBj === "turun" || animBj === "slam" || animBj === "geser-kiri" || animBj === "geser-kanan";
    const dFadeBj = animBj === "slam" ? 0.15 : DURASI_ANIMASI_TEKS;
    const fadeBj =
      animBj && !posisiAnim ? `,fade=t=in:st=0:d=${dFadeBj.toFixed(2)}:alpha=1` : "";
    let posBj = "0:0";
    if (animBj === "naik") posBj = `x=0:y='(1-${progBj})*${(H * 0.06).toFixed(1)}':eval=frame`;
    else if (animBj === "turun") posBj = `x=0:y='-(1-${progBj})*${(H * 0.06).toFixed(1)}':eval=frame`;
    else if (animBj === "slam") posBj = `x=0:y='-(1-pow(1-min(t/0.45,1),3))*${(H * 0.12).toFixed(1)}':eval=frame`;
    else if (animBj === "geser-kiri") posBj = `x='(1-${progBj})*${(W * 0.18).toFixed(1)}':y=0:eval=frame`;
    else if (animBj === "geser-kanan") posBj = `x='-(1-${progBj})*${(W * 0.18).toFixed(1)}':y=0:eval=frame`;
    filterVideo.push(`[${idxBingkaiJudul}:v]format=rgba${fadeBj}[bjf]`);
    filterVideo.push(`[${labelKini}][bjf]overlay=${posBj}[bjk]`);
    labelKini = "bjk";
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
  // v3.4.0 — pakaiLogo sekarang diatur wmMode (mod 08 KINOSTRA): MATI/TEKS/LOGO.
  // wmMode "teks" → logo DISEMBUNYIKAN (satu watermark saja); "off" + logoId ada
  // = perilaku lama (logo tetap tampil — simpanan lama dimigrasi ke "logo").
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
    // v3.4.0 — OPASITAS watermark (mod 08 KINOSTRA drawWatermark: globalAlpha)
    const opasitasLogo = Math.min(1, Math.max(0.1, p.wmOpasitas || 0.6));
    filterVideo.push(
      `[${idxLogo}:v]scale=${lebarWm}:-1,format=rgba,colorchannelmixer=aa=${opasitasLogo.toFixed(3)}[wmf]`,
    );
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
  // v3.4.0 — WATERMARK TEKS (mod 08 KINOSTRA): teks @KAMU dgn opasitas,
  // ukuran 30u×skala, posisi seg tl/tr/bl/br (ikut posisiLogo), pad 28u
  if (p.wmMode === "teks" && (p.wmTeks || "").trim()) {
    const idxAkhirWm = filterVideo.length - 1;
    filterVideo[idxAkhirWm] = filterVideo[idxAkhirWm].replace("[vout]", "[vwm]");
    const uWm = Math.min(W, H) / 1080;
    const fsWm = Math.max(12, Math.round(30 * uWm * Math.min(2.5, Math.max(0.5, p.ukuranLogo / 15))));
    const posSeg =
      p.posisiLogo === "kiri-atas" ? "tl"
      : p.posisiLogo === "kanan-atas" ? "tr"
      : p.posisiLogo === "kiri-bawah" ? "bl"
      : "br";
    const posWm = posisiWmTeks(posSeg, W, H);
    // v3.4.0 — fontfile WAJIB (sandbox/fontconfig tanpa font bawaan → drawtext
    // tanpa fontfile diam-diam tak menggambar apa pun — ketemu di uji render)
    const ffWm = fontfile(p.gayaJudul) || fontfile(p.gayaPart) || fontfile(p.introTeksFont ? ({ font: p.introTeksFont } as GayaTeks) : p.gayaJudul);
    filterVideo.push(
      `[vwm]drawtext=textfile=${kutipFilter(path.join(a.dirTmp, `${a.tag}-wm.txt`))}` +
        `:fontsize=${fsWm}:fontcolor=white@${Math.min(1, Math.max(0.1, p.wmOpasitas || 0.6)).toFixed(2)}` +
        `:x='${posWm.x}':y='${posWm.y}':expansion=none${ffWm ? `:fontfile=${kutipFilter(ffWm)}` : ""}[vout]`,
    );
  }

  // v3.4.0 — CATATAN: VFX & KEN BURNS kini dipasang pada KONTEN (terapkanKontenEfek
  // di rantai atas) — pola KINOSTRA: overlay (frame/teks/sub/watermark) tetap
  // terkunci di kanvas, tidak ikut zoom/pan.

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

  // v3.3.0 — EFEK KLIP NOVACUT + TRANSISI ANTAR PART (xfade antar ekor part
  // sebelumnya & kepala part ini). Dijalankan SETELAH semua lapisan lain
  // (kecepatan/transisiPart lama) sehingga seluruh gambar ikut ter efek,
  // dan label [vout] selalu kembali utk -map.
  // Indeks input overlay & transisi berlanjut SETELAH input suara intro
  // (paling akhir) → indeks lama tidak pernah bergeser.
  const inputEfekOv: string[] = [];
  const inputTransisi: string[] = [];
  // v3.4.0 — ekor efek/transisi mulai SETELAH input lapisan cover KINOSTRA
  const idxEkorBaru = idxLapis;
  const planEfek = p.efekKlip && p.efekKlip.length ? planEffects(p.efekKlip, W, H, a.durasi, fps) : null;
  if (planEfek) {
    const idxAkhir = filterVideo.length - 1;
    filterVideo[idxAkhir] = filterVideo[idxAkhir].replace("[vout]", "[fx0]");
    filterVideo.push(...planEfek.fragments);
    let lblFx = planEfek.labelOut;
    let jumlahOv = 0;
    for (const id of planEfek.overlays) {
      const file = path.join(dirOverlayEfek(), OVERLAY_NAMA[id] ?? "");
      if (!file || !existsSync(file)) continue;
      inputEfekOv.push("-loop", "1", "-i", file);
      const idxOv = idxEkorBaru + jumlahOv;
      jumlahOv++;
      filterVideo.push(`[${idxOv}:v]scale=${W}:${H}[ovf${jumlahOv}]`);
      filterVideo.push(`[${lblFx}][ovf${jumlahOv}]overlay=0:0[ovx${jumlahOv}]`);
      lblFx = `ovx${jumlahOv}`;
    }
    filterVideo.push(`[${lblFx}]format=yuv420p[vout]`);
  }
  const infoTrans = (() => {
    const t = p.efekTransisi ? getTransition(p.efekTransisi) : null;
    if (!t || !a.transisiMasuk) return null;
    const d = Math.min(1.5, Math.max(0.2, Number(a.transisiMasuk.durasi) || 0.6));
    if (a.transisiMasuk.mulaiPrev < 0 || d <= 0.05 || d >= total - 0.05) return null;
    return { xfade: t.xfade, d, mulaiPrev: Math.max(0, a.transisiMasuk.mulaiPrev) };
  })();
  if (infoTrans) {
    const idxAkhir = filterVideo.length - 1;
    filterVideo[idxAkhir] = filterVideo[idxAkhir].replace("[vout]", "[vtb]");
    const d = infoTrans.d;
    // ekor part sebelumnya dari SUMBER: durasi sumber = d × kecepatan;
    // dinormalisasi persis ke W×H / fps / yuv420p / AVTB agar xfade diterima
    inputTransisi.push(
      "-ss", infoTrans.mulaiPrev.toFixed(3),
      "-t", (d * kec + 0.25).toFixed(3),
      "-i", a.transisiMasuk?.srcPrev || a.src,
    );
    const idxTrans = idxEkorBaru + inputEfekOv.length / 4;
    // v3.4.0 — PENTING: filter fps= HARUS PALING AKHIR (sesudah trim/setpts) —
    // trim/setpts menghapus properti laju frame pada link filter → xfade menolak
    // dgn "current rate of 1/0 is invalid" (bug laten v3.3.0, ketemu di uji
    // render E2E part 2). Urutan benar: …trim,setpts,fps.
    filterVideo.push(
      `[${idxTrans}:v]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},format=yuv420p,setsar=1,settb=AVTB,` +
        `trim=duration=${(d * kec).toFixed(3)},setpts=PTS-STARTPTS${kec !== 1 ? `,setpts=PTS/${kec.toFixed(4)},trim=duration=${d.toFixed(3)}` : ""},fps=${fps}[vta]`,
    );
    filterVideo.push(
      `[vtb]split=2[vb1][vb2];` +
        `[vb1]trim=duration=${d.toFixed(3)},setpts=PTS-STARTPTS,format=yuv420p,setsar=1,settb=AVTB,fps=${fps}[vbh];` +
        `[vb2]trim=start=${d.toFixed(3)},setpts=PTS-STARTPTS,format=yuv420p,setsar=1,settb=AVTB,fps=${fps}[vtl];` +
        `[vta][vbh]xfade=transition=${infoTrans.xfade}:duration=${d.toFixed(3)}:offset=0,settb=AVTB[vtx];` +
        `[vtx][vtl]concat=n=2:v=1:a=0[vout]`,
    );
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
    ...inputLapis,
    ...inputBingkaiJudul,
    ...inputEfekOv,
    ...inputTransisi,
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
