// VidSplit — integrasi ffmpeg/ffprobe: cari binary, probe, susun filter graph, eksekusi
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { GayaTeks, ModeKonversi, Pengaturan } from "./types";

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
  const dalam = p === ROOT_WORK || p.startsWith(ROOT_WORK + path.sep);
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

/** Env VIDSPLIT_FFMPEG/FFPROBE → paket static → PATH */
export async function cariBinary(jenis: "ffmpeg" | "ffprobe"): Promise<string> {
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
    const c = spawn(
      bin,
      ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", file],
      { windowsHide: true },
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
  const j = JSON.parse(out) as {
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

const NAMA_FONT: Record<GayaTeks["font"], string[]> = {
  tebal: ["DejaVuSans-Bold.ttf", "arialbd.ttf"],
  bersih: ["DejaVuSans.ttf", "arial.ttf"],
  klasik: ["DejaVuSerif-Bold.ttf", "timesbd.ttf"],
};

function fontfile(gaya: GayaTeks): string {
  const dirs = [
    process.env.VIDSPLIT_FONTS,
    path.join(process.cwd(), "assets", "fonts"),
    path.join(process.cwd(), "..", "assets", "fonts"),
    path.join(process.cwd(), "..", "..", "assets", "fonts"),
    "/usr/share/fonts/truetype/dejavu",
    "C:\\Windows\\Fonts",
  ].filter(Boolean) as string[];
  for (const d of dirs) {
    for (const n of NAMA_FONT[gaya.font]) {
      const p = path.join(d, n);
      if (existsSync(p)) return p;
    }
  }
  return ""; // biarkan ffmpeg pakai font bawaan
}

/** Filter konversi frame video sumber → frame W×H (tanpa label akhir) */
function rantaiUtama(
  mode: ModeKonversi,
  W: number,
  H: number,
  warna: string,
  fps: number,
  durasi: number,
): string {
  const ekor = `fps=${fps},trim=duration=${durasi.toFixed(3)},setpts=PTS-STARTPTS,setsar=1`;
  if (mode === "crop") {
    return `[0:v]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},${ekor}[mv]`;
  }
  if (mode === "warna") {
    return `[0:v]scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=${warnaFf(warna)},${ekor}[mv]`;
  }
  // blur: latar = video di-blur memenuhi layar, isi = video contain di tengah
  return [
    `[0:v]split=2[isi][blur]`,
    `[blur]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},boxblur=24:2,eq=brightness=-0.12:saturation=0.9[blurf]`,
    `[isi]scale=${W}:${H}:force_original_aspect_ratio=decrease[isif]`,
    `[blurf][isif]overlay=(W-w)/2:(H-h)/2,${ekor}[mv]`,
  ].join(";");
}

/** Dua drawtext (judul + Part) di atas hasil concat → [vout] */
function rantaiTeks(p: Pengaturan, W: number, H: number, fileJudul: string, filePart: string): string {
  const skala = W / 1080;
  const uJ = Math.max(12, p.gayaJudul.ukuran * skala);
  const uP = Math.max(10, p.gayaPart.ukuran * skala);
  const barisJ = Math.max(1, (p.judul || "").split("\n").length);
  const tJ = barisJ * uJ * 1.35;
  const tP = uP * 1.3;
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

  const ff = fontfile(p.gayaJudul) || fontfile(p.gayaPart);
  const bagian: string[] = [];
  const opsiDasar = (fontsize: number, warna: string, outline: GayaTeks, y: number) => {
    let s = `fontsize=${fontsize.toFixed(1)}:fontcolor=${warnaFf(warna)}`;
    if (outline.outlineLebar > 0) {
      s += `:borderw=${Math.max(1, Math.round(outline.outlineLebar * skala))}:bordercolor=${warnaFf(outline.outlineWarna)}`;
    }
    s += `:x=(w-text_w)/2:y=${Math.round(y)}`;
    if (ff) s += `:fontfile=${kutipFilter(ff)}`;
    return s;
  };

  if (p.judul.trim()) {
    bagian.push(
      `drawtext=textfile=${kutipFilter(fileJudul)}:${opsiDasar(uJ, p.gayaJudul.warna, p.gayaJudul, yJ)}:line_spacing=${(uJ * 0.3).toFixed(1)}`,
    );
  }
  if ((p.kataPart || "").trim()) {
    bagian.push(
      `drawtext=textfile=${kutipFilter(filePart)}:${opsiDasar(uP, p.gayaPart.warna, p.gayaPart, yP)}`,
    );
  }
  if (!bagian.length) return `[cc]null[vout]`;
  return `[cc]${bagian.join(",")}[vout]`;
}

export interface ArgPart {
  src: string;
  bg: string | null;
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
  dirTmp: string;
  tag: string;
  preset: string;
  crf: number;
  keluar: string;
}

/** Susun argumen ffmpeg lengkap untuk satu part hasil split */
export function bangunArgumenPart(a: ArgPart): { args: string[]; total: number } {
  const p = a.pengaturan;
  const total = p.durasiIntro + a.durasi;
  const W = a.W;
  const H = a.H;
  const fps = a.fps;

  writeFileSync(path.join(a.dirTmp, `${a.tag}-judul.txt`), a.judulTxt, "utf8");
  writeFileSync(path.join(a.dirTmp, `${a.tag}-part.txt`), a.partTxt, "utf8");
  const fileJudul = path.join(a.dirTmp, `${a.tag}-judul.txt`);
  const filePart = path.join(a.dirTmp, `${a.tag}-part.txt`);

  const pakaiBg = !!a.bg && existsSync(a.bg);
  const inputs: string[] = ["-ss", a.mulai.toFixed(3), "-i", a.src];
  if (pakaiBg) inputs.push("-loop", "1", "-t", p.durasiIntro.toFixed(3), "-i", a.bg as string);

  // audio: hening selama intro + audio sumber ter-trim
  const inputAudio: string[] = [];
  const filterAudio: string[] = [];
  let mapAudio: string[];
  const durasiAudio = pakaiBg ? p.durasiIntro : total;
  inputAudio.push("-f", "lavfi", "-t", durasiAudio.toFixed(3), "-i", "anullsrc=channel_layout=stereo:sample_rate=44100");
  if (pakaiBg) {
    if (a.adaAudio) {
      filterAudio.push(
        `[0:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,atrim=duration=${a.durasi.toFixed(3)},asetpts=PTS-STARTPTS[ma]`,
        `[2:a][ma]concat=n=2:v=0:a=1[aout]`,
      );
      mapAudio = ["-map", "[aout]"];
    } else {
      mapAudio = ["-map", "2:a"];
    }
  } else if (a.adaAudio) {
    filterAudio.push(`[0:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,asetpts=PTS-STARTPTS[aout]`);
    mapAudio = ["-map", "[aout]"];
  } else {
    mapAudio = ["-map", "2:a"];
  }

  // video: intro bg (opsional) + video utama → concat → teks
  const filterVideo: string[] = [];
  if (pakaiBg) {
    filterVideo.push(
      `[1:v]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},fps=${fps},setsar=1,trim=duration=${p.durasiIntro.toFixed(3)},setpts=PTS-STARTPTS[bgv]`,
    );
    filterVideo.push(rantaiUtama(p.mode, W, H, p.warnaLatar, fps, a.durasi));
    filterVideo.push(`[bgv][mv]concat=n=2:v=1:a=0[cc]`);
  } else {
    filterVideo.push(rantaiUtama(p.mode, W, H, p.warnaLatar, fps, a.durasi).replace("[mv]", "[cc]"));
  }
  const rantaiTeksStr = rantaiTeks(p, W, H, fileJudul, filePart);
  filterVideo.push(rantaiTeksStr);

  const filter = [...filterVideo, ...filterAudio].join(";");
  const args = [
    "-y",
    "-hide_banner",
    ...inputs,
    ...inputAudio,
    "-filter_complex",
    filter,
    "-map",
    "[vout]",
    ...mapAudio,
    "-t",
    total.toFixed(3),
    "-r",
    String(fps),
    "-c:v",
    "libx264",
    "-preset",
    a.preset,
    "-crf",
    String(a.crf),
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

/** Jalankan ffmpeg, laporkan progres 0..1 dari parsing time= stderr */
export async function jalankanFfmpeg(
  args: string[],
  totalDetik: number,
  onProgres?: (fraksi: number) => void,
): Promise<void> {
  const bin = await cariBinary("ffmpeg");
  await new Promise<void>((resolve, reject) => {
    const c = spawn(bin, args, { windowsHide: true });
    let stderr = "";
    c.stderr.on("data", (d) => {
      const s = d.toString();
      stderr += s;
      if (stderr.length > 8000) stderr = stderr.slice(-8000);
      const m = s.match(/time=(\d+):(\d+):(\d+(?:\.\d+)?)/);
      if (m && onProgres && totalDetik > 0) {
        const det = Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
        onProgres(Math.min(1, Math.max(0, det / totalDetik)));
      }
    });
    c.on("error", (e) => reject(new Error(`ffmpeg gagal dijalankan: ${e.message}`)));
    c.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg keluar dengan kode ${code}: ${stderr.slice(-600)}`));
    });
  });
}
