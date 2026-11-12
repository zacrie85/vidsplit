// ============================================================
// VidSplit v3.3.0 — MESIN TEKS OTOMATIS WHISPER.CPP (OFFLINE)
// Port dari src/lib/server/transcribe.ts KolosalCut v1.4.9
// (whisper-cli lokal: `-m model -f wav -l id -sow -ml 1 -pp -oj`)
// + probe ganda Jawa/Indonesia ala KINOSTRA (leksikon wScoreLex):
//   • whisper.cpp JAUH lebih cepat dari jalur ONNX lama (C++ murni)
//   • 4 model ggml: tiny (RINGAN) / base (CEPAT) / small (AKURAT) q5_1
//     / large-v3-turbo q5_0 (TURBO ±547 MB — menu VOCALIS v4 KINOSTRA mod 06;
//     turbo memakai q5_0 — varian q5_1 turbo TIDAK ADA di HuggingFace,
//     run #93 CI gagal 404 'Entry not found')
//   • progres dihitung dari stderr `progress = N%`
//   • output JSON: transcription[].offsets.from/to (MILIDETIK) + text
//   • bahasa: id / jw / jwid (probe ganda) / enid (→ terjemah opus-mt
//     di subtitle.ts, mesin pengenalan tetap whisper.cpp)
//   • v3.4.0 — MODE LAGU + LEWATI SUNYI (port speechWindows/planChunks
//     subs.js KINOSTRA): PCM 16k dipindai RMS → blok suara digabung
//     (jeda lagu lebih longgar), whisper-cli dijalankan PER BLOK dgn
//     wav terpotong → waktu blok digeser balik; bagian sunyi dilompati.
// Binary & model dibundel di resources/whisper (extraResources) —
// dev: assets/whisper/{bin,models}. Binary tidak ada → pemanggil
// (subtitle.ts) otomatis jatuh ke mesin ONNX lama (nol regresi).
// ============================================================
import { spawn } from "node:child_process";
import { existsSync, readFileSync as readFileSyncWav } from "node:fs";
import { mkdirSync, statSync, unlinkSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { BahasaSubtitle, ModelSubtitle } from "./types";
import { LABEL_MODEL } from "./types";
import type { SegmenSub } from "./subtitle";

/** peta model → berkas ggml (tiny/base/small q5_1; turbo = q5_0 ±547 MB —
 *  varian q5_1 large-v3-turbo tidak ada di ggerganov/whisper.cpp) */
const MODEL_FILES: Record<ModelSubtitle, string> = {
  ringan: "ggml-tiny-q5_1.bin",
  cepat: "ggml-base-q5_1.bin",
  akurat: "ggml-small-q5_1.bin",
  turbo: "ggml-large-v3-turbo-q5_0.bin",
};

/** nama berkas model ggml utk pilihan user (utk pemanggil luar) */
export function namaModelGgml(model: ModelSubtitle): string {
  return MODEL_FILES[model] ?? MODEL_FILES.cepat;
}

export { LABEL_MODEL };

// ---------- v3.4.0 — LEWATI SUNYI + MODE LAGU (port subs.js KINOSTRA) ----------

/** jendela suara dari PCM mono 16-bit (port speechWindows):
 *  jendela 0,2 dtk — RMS > ambang = bersuara; mode lagu = ambang lebih rendah
 *  (vokal bernyanyi lebih pelan & kontinu). Return rentang [mulai, akhir] dtk. */
export function jendelaSuaraPcm(
  pcm: Int16Array,
  sr = 16000,
  modeLagu = false,
): Array<[number, number]> {
  const win = Math.round(sr * 0.2);
  const total = Math.floor(pcm.length / win);
  // ambang: derau dasar dinamis — persentil 20 dari RMS jendela × faktor
  const rmsJendela: number[] = [];
  for (let i = 0; i < total; i++) {
    let jumlah = 0;
    for (let j = i * win; j < (i + 1) * win; j++) jumlah += pcm[j] * pcm[j];
    rmsJendela.push(Math.sqrt(jumlah / win));
  }
  const urut = [...rmsJendela].sort((a, b) => a - b);
  const dasar = urut[Math.floor(urut.length * 0.2)] || 0;
  const ambang = Math.max(dasar * (modeLagu ? 2.2 : 3.0), modeLagu ? 120 : 220);
  const jendela: Array<[number, number]> = [];
  let mulai = -1;
  for (let i = 0; i < total; i++) {
    const suara = rmsJendela[i] > ambang;
    if (suara && mulai < 0) mulai = i;
    if (!suara && mulai >= 0) {
      jendela.push([mulai * 0.2, i * 0.2]);
      mulai = -1;
    }
  }
  if (mulai >= 0) jendela.push([mulai * 0.2, total * 0.2]);
  return jendela;
}

/** Gabung jendela suara → BLOK transkrip (port planChunks): jeda < gabung
 *  dtk dilebur (lagu 3.5 — vokal kontinu; bicara 1.5); blok minimum 1 dtk;
 *  maks 40 blok (lebih banyak → whisper dijalankan berulang, tetap murah
 *  karena bagian sunyi dilompati). Murni. */
export function blokBicara(
  jendela: Array<[number, number]>,
  durasiTotal: number,
  modeLagu = false,
): Array<[number, number]> {
  const gabung = modeLagu ? 3.5 : 1.5;
  const blok: Array<[number, number]> = [];
  let awal = -1, akhir = -1;
  for (const [a, b] of jendela) {
    if (awal < 0) {
      awal = a;
      akhir = b;
    } else if (a - akhir <= gabung) {
      akhir = Math.max(akhir, b);
    } else {
      blok.push([awal, akhir]);
      awal = a;
      akhir = b;
    }
  }
  if (awal >= 0) blok.push([awal, akhir]);
  // blok terlalu pendek (<1 dtk) dilebur ke tetangga — penggalan bikin whisper bingung
  const rapat = blok.filter(([a, b]) => b - a >= 1 || a < 0.5);
  const hasil = rapat.length ? rapat : blok.length ? [blok[0]] : [];
  // clamp dalam durasi
  return hasil
    .map(([a, b]) => [Math.max(0, a), Math.min(Math.max(0.5, durasiTotal), b)] as [number, number])
    .filter(([a, b]) => b > a + 0.4)
    .slice(0, 40);
}

// ---------- pencarian binary & model ----------

function kandidatBin(): string[] {
  const namaExe = process.platform === "win32" ? "whisper-cli.exe" : "whisper-cli";
  const res = (process as unknown as { resourcesPath?: string }).resourcesPath;
  return [
    process.env.VIDSPLIT_WHISPER_BIN || "",
    path.join(process.cwd(), "assets", "whisper", "bin", namaExe),
    path.join(process.cwd(), "..", "assets", "whisper", "bin", namaExe),
    res ? path.join(res, "whisper", "bin", namaExe) : "",
    path.join(process.cwd(), "bin", "whisper", namaExe),
  ].filter(Boolean) as string[];
}

function kandidatDirModel(): string[] {
  const res = (process as unknown as { resourcesPath?: string }).resourcesPath;
  return [
    process.env.VIDSPLIT_WHISPER_MODELS || "",
    path.join(process.cwd(), "assets", "whisper", "models"),
    path.join(process.cwd(), "..", "assets", "whisper", "models"),
    res ? path.join(res, "whisper", "models") : "",
  ].filter(Boolean) as string[];
}

export interface InfoWhisperCpp {
  bin: string;
  dirModel: string;
}

/** whisper.cpp tersedia? (binary + model utk pilihan user) */
export function cariWhisperCpp(model: ModelSubtitle = "cepat"): InfoWhisperCpp | null {
  const bin = kandidatBin().find((p) => {
    try {
      return existsSync(p) && statSync(p).isFile();
    } catch {
      return false;
    }
  });
  if (!bin) return null;
  const nama = MODEL_FILES[model] ?? MODEL_FILES.cepat;
  for (const d of kandidatDirModel()) {
    try {
      if (existsSync(path.join(d, nama))) return { bin, dirModel: d };
    } catch {
      /* lanjut */
    }
  }
  return null;
}

/** model tertentu tersedia? (utk label UI: model yang belum diunduh digelapkan) */
export function modelWhisperTersedia(model: ModelSubtitle): boolean {
  return cariWhisperCpp(model) !== null;
}

// ---------- leksikon Jawa / Indonesia (port KINOSTRA main.js) ----------

const W_ID_HINTS = ["yang", "dan", "di", "ini", "itu", "dengan", "untuk", "tidak", "saya", "kami", "kita",
  "adalah", "akan", "sudah", "dari", "pada", "bisa", "karena", "juga", "para", "orang", "ke", "dalam",
  "ada", "apa", "saat", "oleh", "agar", "banyak", "sekali", "belum", "kalau", "memang", "begini",
  "semuanya", "selamat", "malam", "pagi", "datang", "kembali", "video", "hari", "belajar",
  "memotong", "beberapa", "bagian", "cepat", "mudah", "jangan", "lupa", "tekan", "tombol", "suka",
  "langganan", "gratis", "channel"];
const W_JV_HINTS = ["aku", "awak", "dhewe", "iku", "iki", "kowe", "arep", "ora", "nggih", "ingkang",
  "menika", "meniko", "mawon", "saged", "badhe", "dados", "kangge", "inggih", "panjenengan", "sami",
  "wonten", "punika", "puniko", "sinau", "enggal", "gampil", "aja", "lali", "seneng", "sugeng",
  "rawuh", "kumbali", "kanthi", "dinten", "kepengin", "lakoni", "nggeh", "tembang", "kusumaning",
  "motong", "vidio", "sapanunggalane", "dumadi", "mesthine", "kedah", "boten", "saking"];

/** port wScoreLex KINOSTRA — cocok persis ATAU prefiks 4 huruf (tahan distorsi
 *  ejaan model kecil: wontun~wonten, kanti~kanthi, punika~puniko). */
export function skorLeksikon(teks: string, kamus: string[]): number {
  const kata = (teks || "")
    .toLowerCase()
    .replace(/[^\p{L}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (!kata.length) return 0;
  let cocok = 0;
  for (const x of kata) {
    for (const h of kamus) {
      if (
        x === h ||
        (h.length >= 4 && x.length >= 4 &&
          (x.startsWith(h.slice(0, 4)) || h.startsWith(x.slice(0, 4))))
      ) {
        cocok++;
        break;
      }
    }
  }
  return cocok / kata.length;
}

// ---------- jalankan binary eksternal ----------

interface HasilBin {
  stdout: string;
  stderr: string;
  kode: number;
}

function jalankanBin(
  bin: string,
  args: string[],
  onStderrLine?: (baris: string) => void,
  isBatal?: () => boolean,
): Promise<HasilBin> {
  return new Promise((resolve, reject) => {
    const proc = spawn(bin, args, {
      env: {
        ...process.env,
        // Linux: libwhisper/libggml bersebelahan binary — pastikan bisa dimuat
        LD_LIBRARY_PATH: [path.dirname(bin), process.env.LD_LIBRARY_PATH || ""]
          .filter(Boolean)
          .join(":"),
      },
    });
    let stdout = "";
    let stderr = "";
    let selesai = false;
    const tontonBatal = setInterval(() => {
      if (!selesai && isBatal?.()) {
        selesai = true;
        clearInterval(tontonBatal);
        try {
          proc.kill("SIGKILL");
        } catch {
          /* lanjut */
        }
        reject(new Error("Teks otomatis dibatalkan"));
      }
    }, 700);
    proc.stdout.on("data", (d) => (stdout += d.toString()));
    proc.stderr.on("data", (d) => {
      const s = d.toString();
      stderr += s;
      if (stderr.length > 12000) stderr = stderr.slice(-12000);
      if (onStderrLine) {
        for (const baris of s.split(/\r?\n|\r/)) if (baris.trim()) onStderrLine(baris);
      }
    });
    proc.on("close", (kode) => {
      if (selesai) return;
      selesai = true;
      clearInterval(tontonBatal);
      resolve({ stdout, stderr, kode: kode ?? -1 });
    });
    proc.on("error", (e) => {
      if (selesai) return;
      selesai = true;
      clearInterval(tontonBatal);
      reject(new Error(`Gagal menjalankan ${path.basename(bin)}: ${e.message}`));
    });
  });
}

// ---------- ekstraksi WAV 16 kHz mono ----------

async function ekstrakWav(
  ffmpegBin: string,
  videoPath: string,
  outWav: string,
  durasiDetik?: number,
  onProgres?: (f: number) => void,
): Promise<void> {
  const args = [
    "-y", "-hide_banner", "-loglevel", "error", "-nostdin",
    "-progress", "pipe:1", "-nostats",
    "-i", videoPath,
    "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le",
    outWav,
  ];
  const { kode, stderr, stdout } = await jalankanBin(ffmpegBin, args);
  if (kode !== 0) throw new Error(`ffmpeg gagal ekstrak audio: ${stderr.split("\n").slice(-2).join(" | ")}`);
  void stdout;
  if (durasiDetik && durasiDetik > 0) onProgres?.(1);
}

// ---------- penggabungan kata → segmen (port groupWords KolosalCut) ----------

interface KataWhisper {
  a: number;
  b: number;
  t: string;
}

export function gabungKataWhisper(kata: KataWhisper[]): SegmenSub[] {
  const segmen: SegmenSub[] = [];
  let kini: KataWhisper[] = [];
  const flush = () => {
    if (!kini.length) return;
    segmen.push({
      a: kini[0].a,
      b: kini[kini.length - 1].b,
      t: kini.map((k) => k.t).join(" ").replace(/\s+/g, " ").trim(),
    });
    kini = [];
  };
  for (let i = 0; i < kata.length; i++) {
    const k = kata[i];
    kini.push(k);
    const kataBerikut = kata[i + 1];
    const ujungKalimat = /[.!?…]["')]?$/.test(k.t);
    const koma = /[,]$/.test(k.t);
    const jeda = kataBerikut ? kataBerikut.a - k.b : 0;
    if (ujungKalimat || jeda > 0.7 || kini.length >= 12 || (koma && kini.length >= 5)) flush();
  }
  flush();
  return segmen;
}

// ---------- panggilan whisper-cli ----------

const RE_PROGRES = /progress\s*=\s*(\d+)/;

function benangWhisper(): number {
  const cores = os.cpus().length || 4;
  // sisakan ±2 core utk render ffmpeg (pola v0.55 VidSplit)
  return Math.max(1, Math.min(8, cores - 2));
}

interface OpsiPanggil {
  bin: string;
  modelPath: string;
  wavPath: string;
  bahasa: string; // "id" | "jw" | "en"
  outBase: string;
  onProgres?: (f: number) => void; // 0..1 khusus tahap whisper
  isBatal?: () => boolean;
}

async function panggilWhisperCli(o: OpsiPanggil): Promise<void> {
  const args = [
    "-m", o.modelPath,
    "-f", o.wavPath,
    "-l", o.bahasa,
    "-sow", "-ml", "1", // timestamp PER KATA (split-on-word + max-length 1)
    "-t", String(benangWhisper()),
    "-pp", "-np", // progres ke stderr, tanpa banner
    "-oj", "-of", o.outBase,
  ];
  const { kode, stderr } = await jalankanBin(
    o.bin,
    args,
    (baris) => {
      const m = RE_PROGRES.exec(baris);
      if (m) {
        const n = Number(m[1]);
        if (Number.isFinite(n) && n >= 0) o.onProgres?.(Math.min(1, n / 100));
      }
    },
    o.isBatal,
  );
  if (kode !== 0) {
    throw new Error(
      `whisper-cli keluar kode ${kode}: ${stderr.split("\n").filter(Boolean).slice(-3).join(" | ") || "tanpa detail"}`,
    );
  }
}

/** Jalankan whisper-cli + baca hasil JSON-nya → daftar kata bertanda waktu. */
export async function whisperCliJson(
  o: OpsiPanggil,
): Promise<KataWhisper[]> {
  await panggilWhisperCli(o);
  const { readFileSync } = await import("node:fs");
  return parseJsonWhisper(readFileSync(`${o.outBase}.json`, "utf8"));
}

/** Baca hasil JSON whisper-cli (-oj) → daftar kata bertanda waktu (detik). */
export function parseJsonWhisper(json: string): KataWhisper[] {
  const d = JSON.parse(json) as {
    transcription?: Array<{ offsets?: { from?: number; to?: number }; text?: string }>;
  };
  const kata: KataWhisper[] = [];
  for (const item of d.transcription ?? []) {
    const teks = (item.text ?? "").trim();
    if (!teks) continue;
    const a = (item.offsets?.from ?? 0) / 1000;
    const b = (item.offsets?.to ?? 0) / 1000;
    if (b <= a) continue;
    kata.push({ a, b, t: teks });
  }
  return kata;
}

// ---------- API utama ----------

export interface OpsiTranskripCpp {
  model: ModelSubtitle;
  bahasa: BahasaSubtitle;
  ffmpegBin: string;
  /** progres keseluruhan 0..1 (ekstrak 0–10%, whisper 10–100%) */
  onProgres?: (f: number, label?: string) => void;
  isBatal?: () => boolean;
  dirTmp: string;
  /** durasi sumber (dtk) — utk peta progres ekstraksi */
  durasiSumber?: number;
  /** v3.4.0 — mode lagu/vokal: jendela suara lebih longgar (mod 06 KINOSTRA) */
  modeLagu?: boolean;
  /** v3.4.0 — LEWATI SUNYI (mode turbo): bagian tanpa suara dilompati —
   *  whisper dijalankan PER BLOK bicara saja (jauh lebih cepat) */
  lewatiSunyi?: boolean;
}

/**
 * Transkrip SATU video via whisper.cpp → SegmenSub[] (waktu relatif awal video).
 * Return null bila mesin/model tidak tersedia → pemanggil jatuh ke mesin ONNX.
 */
export async function transkripWhisperCpp(
  videoPath: string,
  opsi: OpsiTranskripCpp,
): Promise<SegmenSub[] | null> {
  const info = cariWhisperCpp(opsi.model);
  if (!info) return null;
  const modelPath = path.join(info.dirModel, MODEL_FILES[opsi.model] ?? MODEL_FILES.cepat);
  mkdirSync(opsi.dirTmp, { recursive: true });
  const stempel = `ws${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  const wavPath = path.join(opsi.dirTmp, `${stempel}.wav`);
  const outBase = path.join(opsi.dirTmp, stempel);
  const jsonPath = `${outBase}.json`;
  try {
    // tahap 1 — ekstrak audio (progres 0–0.1)
    opsi.onProgres?.(0.01, "Menyiapkan audio...");
    await ekstrakWav(opsi.ffmpegBin, videoPath, wavPath, opsi.durasiSumber);

    // tahap 2 — tentukan bahasa
    let bahasa = "id";
    if (opsi.bahasa === "jw") bahasa = "jw";
    else if (opsi.bahasa === "enid") bahasa = "en";
    else if (opsi.bahasa === "jwid") {
      // PROBE GANDA ala KINOSTRA: 12 dtk pertama ditranskrip 2× (paksa jw & id),
      // skor leksikon memilih — auto-detect whisper terbukti salah utk jw/id
      opsi.onProgres?.(0.1, "Mendeteksi bahasa (Jawa/Indonesia)...");
      const wavProbe = path.join(opsi.dirTmp, `${stempel}-probe.wav`);
      const { kode: kodePotong } = await jalankanBin(
        opsi.ffmpegBin,
        ["-y", "-hide_banner", "-loglevel", "error", "-nostdin", "-t", "12", "-i", wavPath, "-c", "copy", wavProbe],
      );
      if (kodePotong === 0) {
        const basis = path.join(opsi.dirTmp, `${stempel}-probe`);
        const teksJ = await teksProbe(info.bin, modelPath, wavProbe, basis, "jw", opsi.isBatal);
        const teksI = await teksProbe(info.bin, modelPath, wavProbe, `${basis}2`, "id", opsi.isBatal);
        const sJ = skorLeksikon(teksJ, W_JV_HINTS);
        const sI = skorLeksikon(teksI, W_ID_HINTS);
        bahasa = sJ > sI + 0.02 ? "jw" : "id";
        try {
          unlinkSync(`${basis}.json`);
        } catch { /* opsional */ }
        try {
          unlinkSync(`${basis}2.json`);
        } catch { /* opsional */ }
        try {
          unlinkSync(wavProbe);
        } catch { /* opsional */ }
      }
    }

    // tahap 2b — v3.4.0 LEWATI SUNYI: pindai PCM → blok bicara (port
    // speechWindows+planChunks subs.js KINOSTRA). 1 blok penuh = jalur lama.
    let blok: Array<[number, number]> | null = null;
    if (opsi.lewatiSunyi) {
      try {
        const pcm = bacaPcmWav(wavPath);
        if (pcm && pcm.length > 0) {
          const kandidat = blokBicara(
            jendelaSuaraPcm(pcm, 16000, opsi.modeLagu === true),
            opsi.durasiSumber || pcm.length / 16000,
            opsi.modeLagu === true,
          );
          // berguna hanya bila benar-benar ada bagian sunyi terlewat
          const totalBicara = kandidat.reduce((s, [a, b]) => s + (b - a), 0);
          const durasiPenuh = opsi.durasiSumber || pcm.length / 16000;
          if (kandidat.length > 1 && totalBicara < durasiPenuh * 0.92) blok = kandidat;
        }
      } catch {
        blok = null; // gagal pindai → jalur penuh (aman)
      }
    }

    // tahap 3 — transkrip (progres 0.1–1). PER BLOK bila lewati-sunyi aktif
    // dan ada bagian sunyi; waktu kata digeser balik ke posisi aslinya.
    const kata: KataWhisper[] = [];
    if (blok) {
      const totalBicara = blok.reduce((s, [a, b]) => s + (b - a), 0);
      let berjalan = 0;
      for (let bi = 0; bi < blok.length; bi++) {
        if (opsi.isBatal?.()) throw new Error("Teks otomatis dibatalkan");
        const [a, b] = blok[bi];
        const panjang = b - a;
        const wavBlok = path.join(opsi.dirTmp, `${stempel}-b${bi}.wav`);
        const basisBlok = path.join(opsi.dirTmp, `${stempel}-b${bi}`);
        const { kode } = await jalankanBin(
          opsi.ffmpegBin,
          ["-y", "-hide_banner", "-loglevel", "error", "-nostdin", "-ss", a.toFixed(3), "-t", (panjang + 0.25).toFixed(3), "-i", wavPath, "-c", "copy", wavBlok],
        );
        if (kode !== 0) continue;
        opsi.onProgres?.(
          0.1 + (berjalan / Math.max(0.1, totalBicara)) * 0.9,
          `Mengenali suara (blok ${bi + 1}/${blok.length})...`,
        );
        try {
          const kataBlok = await whisperCliJson({
            bin: info.bin,
            modelPath,
            wavPath: wavBlok,
            bahasa,
            outBase: basisBlok,
            onProgres: (f) =>
              opsi.onProgres?.(
                0.1 + ((berjalan + f * panjang) / Math.max(0.1, totalBicara)) * 0.9,
                `Mengenali suara (blok ${bi + 1}/${blok.length})...`,
              ),
            isBatal: opsi.isBatal,
          });
          for (const k of kataBlok) kata.push({ a: k.a + a, b: k.b + a, t: k.t });
        } catch {
          /* blok gagal → dilewati */
        }
        berjalan += panjang;
        for (const f of [wavBlok, `${basisBlok}.json`]) {
          try {
            if (existsSync(f)) unlinkSync(f);
          } catch {
            /* opsional */
          }
        }
      }
      if (!kata.length) {
        // semua blok gagal → jalur penuh (aman)
        opsi.onProgres?.(0.11, "Mengenali suara (whisper.cpp)...");
        await panggilWhisperCli({
          bin: info.bin,
          modelPath,
          wavPath,
          bahasa,
          outBase,
          onProgres: (f) => opsi.onProgres?.(0.1 + f * 0.9, "Mengenali suara (whisper.cpp)..."),
          isBatal: opsi.isBatal,
        });
        const { readFileSync } = await import("node:fs");
        kata.push(...parseJsonWhisper(readFileSync(jsonPath, "utf8")));
      }
    } else {
      opsi.onProgres?.(0.11, "Mengenali suara (whisper.cpp)...");
      await panggilWhisperCli({
        bin: info.bin,
        modelPath,
        wavPath,
        bahasa,
        outBase,
        onProgres: (f) => opsi.onProgres?.(0.1 + f * 0.9, "Mengenali suara (whisper.cpp)..."),
        isBatal: opsi.isBatal,
      });
      const { readFileSync } = await import("node:fs");
      kata.push(...parseJsonWhisper(readFileSync(jsonPath, "utf8")));
    }

    // tahap 4 — gabung kata → segmen
    const segmen = gabungKataWhisper(kata.sort((x, y) => x.a - y.a));
    opsi.onProgres?.(1, "Teks otomatis siap");
    return segmen;
  } finally {
    for (const f of [wavPath, jsonPath]) {
      try {
        if (existsSync(f)) unlinkSync(f);
      } catch {
        /* bersih-bersih opsional */
      }
    }
  }
}

/** probe pendek utk deteksi bahasa — kembalikan TEKS gabungan ("" bila gagal) */
async function teksProbe(
  bin: string,
  modelPath: string,
  wav: string,
  outBase: string,
  bahasa: string,
  isBatal?: () => boolean,
): Promise<string> {
  try {
    await panggilWhisperCli({ bin, modelPath, wavPath: wav, bahasa, outBase, isBatal });
    const { readFileSync } = await import("node:fs");
    const kata = parseJsonWhisper(readFileSync(`${outBase}.json`, "utf8"));
    return kata.map((k) => k.t).join(" ");
  } catch {
    return "";
  }
}

/** v3.4.0 — baca PCM 16-bit mono dari WAV 16 kHz (hasil ekstrakWav).
 *  Cari chunk "data" (bukan asumsi header 44 byte), kembalikan sampel. */
export function bacaPcmWav(file: string): Int16Array | null {
  try {
    const buf = readFileSyncWav(file);
    const idx = buf.indexOf("data", 12, "ascii");
    if (idx < 0) return null;
    const ukuran = buf.readUInt32LE(idx + 4);
    const mulai = idx + 8;
    const akhir = ukuran > 0 ? Math.min(mulai + ukuran, buf.length) : buf.length;
    const sampel = Math.floor((akhir - mulai) / 2);
    const pcm = new Int16Array(sampel);
    for (let i = 0; i < sampel; i++) pcm[i] = buf.readInt16LE(mulai + i * 2);
    return pcm;
  } catch {
    return null;
  }
}
