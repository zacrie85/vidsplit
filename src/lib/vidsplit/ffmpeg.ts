// VidSplit — integrasi ffmpeg/ffprobe: cari binary, probe, susun filter graph, eksekusi
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { CodecVideo, GayaTeks, ModeKonversi, PosisiLogo, Pengaturan } from "./types";

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

function fontfile(gaya: GayaTeks): string {
  const dirs = [
    ...dirFontKandidat(),
    "/usr/share/fonts/truetype/dejavu",
    "C:\\Windows\\Fonts",
  ];
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
  posisiPotong = 50,
): string {
  const ekor = `fps=${fps},trim=duration=${durasi.toFixed(3)},setpts=PTS-STARTPTS,setsar=1`;
  if (mode === "crop") {
    // posisiPotong 0=kiri, 50=tengah, 100=kanan — geser jendela potong secara horizontal
    const pp = Math.min(100, Math.max(0, posisiPotong));
    return `[0:v]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H}:(iw-ow)*${pp}/100:0,${ekor}[mv]`;
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
    return s;
  };

  if (p.judul.trim()) {
    const ffJ = fontfile(p.gayaJudul) || fontfile(p.gayaPart);
    bagian.push(
      `drawtext=textfile=${kutipFilter(fileJudul)}:${opsiDasar(uJ, p.gayaJudul.warna, p.gayaJudul, yJ, ffJ)}:line_spacing=${(uJ * 0.3).toFixed(1)}`,
    );
  }
  if ((p.kataPart || "").trim()) {
    const ffP = fontfile(p.gayaPart) || fontfile(p.gayaJudul);
    bagian.push(
      `drawtext=textfile=${kutipFilter(filePart)}:${opsiDasar(uP, p.gayaPart.warna, p.gayaPart, yP, ffP)}`,
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
  dirTmp: string;
  tag: string;
  /** argumen codec video lengkap, mis. ["-c:v","libx264","-preset","medium","-crf","20"] */
  codecArgs: string[];
  keluar: string;
}

/** Susun argumen ffmpeg lengkap untuk satu part hasil split */
export function bangunArgumenPart(a: ArgPart): { args: string[]; total: number } {
  const p = a.pengaturan;
  const pakaiBg = !!a.bg && existsSync(a.bg);
  const pakaiLogo = !!a.logo && existsSync(a.logo);
  // TANPA bg: total = durasi video saja (bukan + durasiIntro — kalau tidak,
  // track audio/hening ikut memanjang dan hasil split punya ekor diam ±3 dtk)
  const total = pakaiBg ? p.durasiIntro + a.durasi : a.durasi;
  const W = a.W;
  const H = a.H;
  const fps = a.fps;

  writeFileSync(path.join(a.dirTmp, `${a.tag}-judul.txt`), a.judulTxt, "utf8");
  writeFileSync(path.join(a.dirTmp, `${a.tag}-part.txt`), a.partTxt, "utf8");
  const fileJudul = path.join(a.dirTmp, `${a.tag}-judul.txt`);
  const filePart = path.join(a.dirTmp, `${a.tag}-part.txt`);

  // URUTAN INPUT PENTING (indeks filter graph): 0=src, 1=bg?, lalu anullsrc,
  // lalu logo PALING AKHIR — sehingga idxLogo = pakaiBg ? 3 : 2 selalu benar
  // dan referensi audio [2:a] / -map 2:a tidak pernah bergeser oleh logo.
  const inputs: string[] = ["-ss", a.mulai.toFixed(3), "-i", a.src];
  if (pakaiBg) inputs.push("-loop", "1", "-t", p.durasiIntro.toFixed(3), "-i", a.bg as string);
  const idxLogo = pakaiLogo ? (pakaiBg ? 3 : 2) : -1;
  const inputLogo: string[] = pakaiLogo ? ["-loop", "1", "-i", a.logo as string] : [];

  // audio: hening selama intro + audio sumber ter-trim
  const inputAudio: string[] = [];
  const filterAudio: string[] = [];
  let mapAudio: string[];
  // kasus bg + video tanpa audio: track hening harus sepanjang TOTAL (intro+durasi),
  // bukan cuma durasi intro — kalau tidak, track audio output terpotong pendek
  const durasiAudio = pakaiBg && a.adaAudio ? p.durasiIntro : total;
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
    // tanpa bg & tanpa audio: input 0 = src, input 1 = anullsrc
    mapAudio = ["-map", "1:a"];
  }

  // video: intro bg (opsional) + video utama → concat → teks
  const filterVideo: string[] = [];
  if (pakaiBg) {
    filterVideo.push(
      `[1:v]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},fps=${fps},setsar=1,trim=duration=${p.durasiIntro.toFixed(3)},setpts=PTS-STARTPTS[bgv]`,
    );
    filterVideo.push(rantaiUtama(p.mode, W, H, p.warnaLatar, fps, a.durasi, p.posisiPotong));
    filterVideo.push(`[bgv][mv]concat=n=2:v=1:a=0[cc]`);
  } else {
    filterVideo.push(
      rantaiUtama(p.mode, W, H, p.warnaLatar, fps, a.durasi, p.posisiPotong).replace("[mv]", "[cc]"),
    );
  }
  const rantaiTeksStr = rantaiTeks(p, W, H, fileJudul, filePart);
  if (pakaiLogo) {
    // rantai teks menghasilkan [vtx] lalu logo di-overlay → [vout]
    filterVideo.push(rantaiTeksStr.replace("[vout]", "[vtx]"));
    const lebarWm = Math.max(
      24,
      Math.round((W * Math.min(40, Math.max(5, p.ukuranLogo || 15))) / 100),
    );
    const mx = Math.round(W * 0.035);
    const my = Math.round(H * 0.03);
    const posisi: Record<PosisiLogo, string> = {
      "kiri-atas": `x=${mx}:y=${my}`,
      "kanan-atas": `x=W-w-${mx}:y=${my}`,
      "kiri-bawah": `x=${mx}:y=H-h-${my}`,
      "kanan-bawah": `x=W-w-${mx}:y=H-h-${my}`,
    };
    filterVideo.push(`[${idxLogo}:v]scale=${lebarWm}:-1[wmf]`);
    filterVideo.push(`[vtx][wmf]overlay=${posisi[p.posisiLogo] ?? posisi["kanan-bawah"]}[vout]`);
  } else {
    filterVideo.push(rantaiTeksStr);
  }

  const filter = [...filterVideo, ...filterAudio].join(";");
  const args = [
    "-y",
    "-hide_banner",
    ...inputs,
    ...inputAudio,
    ...inputLogo,
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

/** Jalankan ffmpeg, laporkan progres 0..1 dari parsing time= stderr.
 *  bin boleh kosong — akan dipilih otomatis via pilihFfmpeg().
 *  Detektor macet: bila 40 detik TANPA progres time= sama sekali, proses dibunuh
 *  (input korup dgn -loop bisa membuat ffmpeg menggantung tanpa keluar). */
export async function jalankanFfmpeg(
  args: string[],
  totalDetik: number,
  onProgres?: (fraksi: number) => void,
  bin?: string,
  onSpawn?: (child: ChildProcess) => void,
): Promise<void> {
  const binFinal = bin || (await pilihFfmpeg()).bin;
  await new Promise<void>((resolve, reject) => {
    const c = spawn(binFinal, args, { windowsHide: true });
    onSpawn?.(c);
    let stderr = "";
    let terakhirProgres = Date.now();
    const pemeriksa = setInterval(() => {
      if (Date.now() - terakhirProgres > 40_000) {
        clearInterval(pemeriksa);
        try {
          c.kill("SIGKILL");
        } catch {}
        reject(
          new Error(
            "ffmpeg macet (tidak ada progres 40 detik) — kemungkinan file sumber/background rusak",
          ),
        );
      }
    }, 5000);
    c.stderr.on("data", (d) => {
      const s = d.toString();
      stderr += s;
      if (stderr.length > 8000) stderr = stderr.slice(-8000);
      const m = s.match(/time=(\d+):(\d+):(\d+(?:\.\d+)?)/);
      if (m) {
        terakhirProgres = Date.now();
        if (onProgres && totalDetik > 0) {
          const det = Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
          onProgres(Math.min(1, Math.max(0, det / totalDetik)));
        }
      }
    });
    c.on("error", (e) => {
      clearInterval(pemeriksa);
      reject(new Error(`ffmpeg gagal dijalankan: ${e.message}`));
    });
    c.on("close", (code) => {
      clearInterval(pemeriksa);
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

/** argumen codec CPU dari preset/crf/mode ekspor */
export function codecCpu(preset: string, crf: number, codec: CodecVideo = "h264"): string[] {
  return codec === "h265"
    ? ["-c:v", "libx265", "-preset", preset, "-crf", String(crf), "-tag:v", "hvc1"]
    : ["-c:v", "libx264", "-preset", preset, "-crf", String(crf)];
}

const KANDIDAT_GPU: Record<CodecVideo, Array<{
  encoder: string;
  nama: string;
  codecArgs: (crf: number) => string[];
}>> = {
  h264: [
    {
      encoder: "h264_nvenc",
      nama: "NVIDIA NVENC H.264 (GPU)",
      codecArgs: (crf) => ["-c:v", "h264_nvenc", "-preset", "p4", "-rc", "vbr", "-cq", String(crf), "-b:v", "0"],
    },
    {
      encoder: "h264_qsv",
      nama: "Intel Quick Sync H.264 (GPU)",
      codecArgs: (crf) => ["-c:v", "h264_qsv", "-preset", "faster", "-global_quality", String(crf)],
    },
    {
      encoder: "h264_amf",
      nama: "AMD AMF H.264 (GPU)",
      codecArgs: (crf) => ["-c:v", "h264_amf", "-quality", "balanced", "-rc", "cqp", "-qp_i", String(crf), "-qp_p", String(crf)],
    },
  ],
  h265: [
    {
      encoder: "hevc_nvenc",
      nama: "NVIDIA NVENC H.265 (GPU)",
      codecArgs: (crf) => ["-c:v", "hevc_nvenc", "-preset", "p4", "-rc", "vbr", "-cq", String(crf), "-b:v", "0", "-tag:v", "hvc1"],
    },
    {
      encoder: "hevc_qsv",
      nama: "Intel Quick Sync H.265 (GPU)",
      codecArgs: (crf) => ["-c:v", "hevc_qsv", "-preset", "faster", "-global_quality", String(crf), "-tag:v", "hvc1"],
    },
    {
      encoder: "hevc_amf",
      nama: "AMD AMF H.265 (GPU)",
      codecArgs: (crf) => ["-c:v", "hevc_amf", "-quality", "balanced", "-rc", "cqp", "-qp_i", String(crf), "-qp_p", String(crf), "-tag:v", "hvc1"],
    },
  ],
};

let cacheUjiGpu: Map<string, boolean> | null = null;

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

/** Pilih encoder: GPU bila diminta & tersedia, selain itu CPU. Hasilnya di-cache. */
export async function pilihEncoder(
  pakaiGpu: boolean,
  preset: string,
  crf: number,
  bin: string,
  codec: CodecVideo = "h264",
): Promise<PilihanEncoder> {
  if (pakaiGpu) {
    for (const k of KANDIDAT_GPU[codec]) {
      if (await ujiEncoder(k.encoder, bin)) {
        return { nama: k.nama, gpu: true, codecArgs: k.codecArgs(crf) };
      }
    }
  }
  return {
    nama: codec === "h265" ? "CPU (libx265)" : "CPU (libx264)",
    gpu: false,
    codecArgs: codecCpu(preset, crf, codec),
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
