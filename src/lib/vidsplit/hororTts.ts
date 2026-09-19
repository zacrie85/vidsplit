// VidSplit v0.27.0 — PEMBACA SKRIP (TTS) MULTI-STRATEGI, 100% offline.
// PERBAIKAN atas v0.25/0.26 (narasi kadang hilang total):
//   1) Pendeteksi suara dulu timeout 15 dtk -> UI mematikan narasi diam-diam.
//   2) Jalur tunggal (-File .ps1) mudah diblokir kebijakan Eksekusi GPO / antivirus
//      (banyak AV memantau .ps1) -> semua paragraf gagal -> video tanpa suara.
//   3) Kegagalan TTS disembunyikan (anggun tapi tak terlihat).
// SEKARANG: 3 strategi berurutan + DIAGNOSTIK yang tampil di UI:
//   A) powershell.exe -EncodedCommand (System.Speech/SAPI) — TANPA berkas skrip,
//      kebal kebijakan eksekusi berbasis berkas; teks lewat berkas UTF-8 BOM agar
//      aman dari batas panjang baris perintah Windows (32.767 karakter).
//   B) cscript.exe + VBScript SAPI.SpVoice (COM) — jalur di LUAR PowerShell,
//      sering lolos saat PowerShell diblokir AV/kebijakan.
//   C) powershell.exe -File .ps1 (UTF-8 BOM) — jalur lama yang diperkuat.
import { spawn } from "node:child_process";
import { writeFile, rm, open, stat } from "node:fs/promises";
import { statSync } from "node:fs";
import path from "node:path";
import os from "node:os";

export interface InfoSuara {
  id: string; // nama voice
  bahasa: string;
}

export interface OpsiNarasi {
  kecepatan?: number; // 0.6..1.5
  volume?: number; // 0..1
  suara?: string; // nama voice SAPI (opsional)
}

/** Mesin narasi: "ai" = AI Neural Piper (disarankan) | "windows" = SAPI bawaan. */
export type MesinNarasi = "ai" | "windows";

export interface HasilTts {
  ok: boolean;
  metode?: string; // strategi yang berhasil, mis. "AI Neural (Piper)"
  galat?: string; // gabungan diagnosa bila gagal
}

interface HasilSpawn {
  kode: number | null;
  keluar: string;
  galat: string;
  spawnGagal: boolean; // biner tidak bisa dijalankan (ENOENT dkk.)
  timeout: boolean;
}

/** Jalankan proses; resolve selalu (tidak melempar), dengan diagnosa.
 *  stdinTeks opsional (utk piper yang membaca teks dari stdin). */
function jalankan(bin: string, args: string[], batasMs: number, stdinTeks?: string, envTambah?: Record<string, string>): Promise<HasilSpawn> {
  return new Promise((resolve) => {
    let keluar = "";
    let galat = "";
    let selesai = false;
    let c: ReturnType<typeof spawn>;
    try {
      c = spawn(bin, args, { windowsHide: true });
    } catch {
      resolve({ kode: null, keluar: "", galat: `spawn ${bin} gagal`, spawnGagal: true, timeout: false });
      return;
    }
    const t = setTimeout(() => {
      if (selesai) return;
      selesai = true;
      try { c.kill(); } catch { /* abaikan */ }
      resolve({
        kode: null, keluar, galat,
        spawnGagal: false, timeout: true,
      });
    }, batasMs);
    c.stdout?.on("data", (d) => (keluar += d.toString()));
    c.stderr?.on("data", (d) => (galat += d.toString()));
    if (stdinTeks !== undefined && c.stdin) {
      c.stdin.on("error", () => { /* proses keluar lebih cepat — abaikan */ });
      c.stdin.write(stdinTeks);
      c.stdin.end();
    }
    c.on("error", (e) => {
      if (selesai) return;
      selesai = true; clearTimeout(t);
      resolve({ kode: null, keluar, galat: `${bin}: ${e.message}`, spawnGagal: true, timeout: false });
    });
    c.on("close", (kode) => {
      if (selesai) return;
      selesai = true; clearTimeout(t);
      resolve({ kode, keluar, galat, spawnGagal: false, timeout: false });
    });
  });
}

/** Kandidat path biner Windows (PATH dulu, lalu absolut utk 32/64-bit). */
function kandidatWindows(nama: string): string[] {
  if (process.platform !== "win32") return [];
  const set = new Set<string>([nama]);
  set.add(`C:\\Windows\\System32\\${nama}`);
  set.add(`C:\\Windows\\SysNative\\${nama}`); // utk proses 32-bit di Windows 64-bit
  return [...set];
}

// ==================== v0.28.0 — AI VOICE GENERATOR (Piper TTS) ====================
// Suara neural 100% offline, GRATIS & bebas dipakai (MIT). Model Bahasa Indonesia
// id_ID-news_tts-medium dibundel di assets/tts-piper (binary + DLL + espeak-ng-data).

const MODEL_PIPER = "id_ID-news_tts-medium.onnx";

export interface PiperSiap {
  bin: string;
  model: string;
  konfig: string;
  dir: string;
}

/** Cari folder piper bundel (binary + model dalam satu folder). null = tidak ada. */
export function piperSiap(): PiperSiap | null {
  const kandidat = [
    process.env.VIDSPLIT_PIPER,
    path.join(process.cwd(), "assets", "tts-piper"),
    path.join(process.cwd(), "..", "assets", "tts-piper"),
    path.join(process.cwd(), "..", "..", "assets", "tts-piper"),
  ].filter(Boolean) as string[];
  for (const dir of kandidat) {
    const bin = path.join(dir, process.platform === "win32" ? "piper.exe" : "piper");
    const model = path.join(dir, MODEL_PIPER);
    const konfig = `${model}.json`;
    try {
      if (statSync(bin).isFile() && statSync(model).size > 10_000_000 && statSync(konfig).isFile()) {
        return { bin, model, konfig, dir };
      }
    } catch { /* lanjut kandidat berikutnya */ }
  }
  return null;
}

/** Baca teks via AI Neural Piper -> WAV 22.05k. (model id-ID, satu speaker) */
async function ttsPiper(
  teks: string, keluar: string, kecepatan: number, kumpul: (g: string) => void,
): Promise<HasilTts> {
  const p = piperSiap();
  if (!p) return { ok: false }; // tidak fatal — jalur SAPI tetap dicoba
  const skala = Math.min(2, Math.max(0.5, 1 / Math.min(1.5, Math.max(0.6, kecepatan))));
  const args = [
    "--model", p.model,
    "--config", p.konfig,
    "--length_scale", skala.toFixed(3),
    "--output_file", keluar,
  ];
  const envTambah = process.platform === "win32" ? undefined : { LD_LIBRARY_PATH: p.dir };
  // v0.31.0 — batas 90 dtk (dulu 150): piper yang sehat < 10 dtk/kalimat;
  // menggantung di Windows jangan memakan 2,5 menit per adegan.
  const h = await jalankan(p.bin, args, 90_000, teks + "\n", envTambah);
  if (!h.spawnGagal && h.kode === 0) {
    return { ok: true, metode: "AI Neural (suara Indonesia)" };
  }
  const alasan = h.timeout ? "timeout 90 dtk" : potong(h.galat || h.keluar);
  kumpul(`Piper-AI: exit ${h.kode ?? "-"} — ${alasan}`);
  return { ok: false };
}

/** Potong diagnosa agar ringkas. */
function potong(s: string, maks = 240): string {
  const b = (s || "").replace(/\s+/g, " ").trim();
  return b.length > maks ? b.slice(0, maks) + "…" : b;
}

// ==================== v0.28.0 — DURASI WAV MURNI JS (tanpa ffprobe) ====================
// FIX inti laporan "berkas WAV terbuat tetapi gagal dibaca": probe() menuntut
// stream VIDEO sehingga WAV narasi (audio murni) selalu ditolak -> suara dibuang.
// durasiWav membaca header RIFF langsung — tidak butuh binary apa pun.

const tidur = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Durasi detik berkas WAV (RIFF) dari header. Coba ulang 3x (AV Windows kadang
 *  mengunci berkas baru beberapa ratus ms). Melempar bila bukan WAV rusak. */
export async function durasiWav(file: string, cobaMaks = 3): Promise<number> {
  let terakhir: unknown = null;
  for (let coba = 0; coba < cobaMaks; coba++) {
    if (coba > 0) await tidur(350);
    try {
      const fd = await open(file, "r");
      try {
        const kepala = Buffer.alloc(12);
        await fd.read(kepala, 0, 12, 0);
        if (kepala.toString("ascii", 0, 4) !== "RIFF" || kepala.toString("ascii", 8, 12) !== "WAVE") {
          throw new Error("bukan berkas WAV (RIFF)");
        }
        let pos = 12;
        let sampleRate = 0;
        let bits = 0;
        let kanal = 0;
        let dataUkuran = 0;
        for (let iter = 0; iter < 16; iter++) {
          const hdr = Buffer.alloc(8);
          await fd.read(hdr, 0, 8, pos);
          const idc = hdr.toString("ascii", 0, 4);
          const ukuran = hdr.readUInt32LE(4);
          if (idc === "fmt ") {
            const fmt = Buffer.alloc(16);
            await fd.read(fmt, 0, 16, pos + 8);
            kanal = fmt.readUInt16LE(2);
            sampleRate = fmt.readUInt32LE(4);
            bits = fmt.readUInt16LE(14);
          } else if (idc === "data") {
            dataUkuran = ukuran;
            break;
          }
          if (ukuran === 0) break; // hindari loop tak berujung
          pos += 8 + ukuran + (ukuran % 2); // chunk RIFF selalu genap
        }
        if (!sampleRate || !bits || !kanal) throw new Error("header fmt WAV tidak lengkap");
        if (!dataUkuran) {
          // data chunk besar/aneh — estimasi dari ukuran berkas
          const s = await stat(file);
          dataUkuran = Math.max(0, s.size - 44);
        }
        return dataUkuran / ((sampleRate * kanal * bits) / 8);
      } finally {
        await fd.close();
      }
    } catch (e) {
      terakhir = e;
    }
  }
  throw terakhir instanceof Error ? terakhir : new Error(String(terakhir));
}

const KUTIP_PS = (s: string) => s.replace(/'/g, "''");

/** Inti skrip PowerShell SAPI (teks disisipkan via parameter ekspresi). */
function intiPskrip(keluar: string, rate: number, volume: number, suara: string | undefined, ekspresiTeks: string): string {
  const pilih = suara
    ? `try { $s.SelectVoice('${KUTIP_PS(suara)}') } catch {}`
    : `try { foreach ($v in $s.GetInstalledVoices()) { if ($v.VoiceInfo.Culture.Name -like 'id*') { $s.SelectVoice($v.VoiceInfo.Name); break } } } catch {}`;
  return `$ErrorActionPreference = 'Stop'
try {
  Add-Type -AssemblyName System.Speech
  $s = New-Object System.Speech.Synthesis.SpeechSynthesizer
  $s.SetOutputToWaveFile('${KUTIP_PS(keluar)}', [System.Speech.AudioFormat.SpeechAudioFormatInfo]::new(22050, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono))
  $s.Rate = ${rate}
  $s.Volume = ${volume}
  ${pilih}
  $s.Speak(${ekspresiTeks})
  $s.Dispose()
  Write-Output SELESAI
} catch {
  Write-Output ("GALATPS: " + $_.Exception.Message)
  exit 1
}`;
}

/** Ekspresi string VBScript: ASCII langsung, non-ASCII lewat ChrW(). */
export function ekspresiVbs(teks: string): string {
  const bagian: string[] = [];
  let ascii = "";
  const flush = () => {
    if (ascii) { bagian.push('"' + ascii.replace(/"/g, '""') + '"'); ascii = ""; }
  };
  for (const ch of teks) {
    const c = ch.codePointAt(0) ?? 63;
    if (c >= 32 && c <= 126) ascii += ch;
    else { flush(); bagian.push(`ChrW(${c})`); }
  }
  flush();
  return bagian.length ? bagian.join("&") : '""';
}

/** Skrip A: -EncodedCommand (tanpa berkas .ps1). */
async function ttsEncoded(
  teksPath: string, keluar: string, rate: number, volume: number, suara: string | undefined,
  kumpul: (g: string) => void,
): Promise<HasilTts> {
  const skrip =
    `$teks = [IO.File]::ReadAllText('${KUTIP_PS(teksPath)}', [Text.Encoding]::UTF8)\n` +
    intiPskrip(keluar, rate, volume, suara, "$teks");
  const enc = Buffer.from(skrip, "utf16le").toString("base64");
  let binerCoba = false;
  for (const bin of kandidatWindows("powershell.exe")) {
    const h = await jalankan(bin, ["-NoProfile", "-NonInteractive", "-EncodedCommand", enc], 150_000);
    if (!h.spawnGagal && h.kode === 0 && h.keluar.includes("SELESAI")) {
      return { ok: true, metode: "PowerShell (suara bawaan Windows)" };
    }
    if (h.spawnGagal) { binerCoba = true; continue; }
    const alasan = h.timeout ? `timeout 150 dtk` : potong(h.galat || h.keluar.replace(/^SELESAI/m, ""));
    kumpul(`PowerShell-Encoded: exit ${h.kode ?? "-"} — ${alasan}`);
    return { ok: false }; // biner jalan; gagal skrip — path lain tak akan beda
  }
  if (binerCoba) kumpul("PowerShell-Encoded: powershell.exe tidak ditemukan");
  return { ok: false };
}

/** Skrip B: cscript.exe + SAPI.SpVoice COM (VBScript, di luar PowerShell). */
async function ttsCscript(
  teks: string, keluar: string, rate: number, volume: number, suara: string | undefined,
  ps1Vbs: string, kumpul: (g: string) => void,
): Promise<HasilTts> {
  const filter = suara
    ? `Set vs = s.GetVoices("Name=${suara.replace(/"/g, "")}")`
    : `Set vs = s.GetVoices("Language=421")`;
  const isi = `On Error Resume Next
Dim s: Set s = CreateObject("SAPI.SpVoice")
If Err.Number <> 0 Then
  WScript.Echo "GALAT: buat SAPI.SpVoice: " & Err.Description
  WScript.Quit 1
End If
s.Rate = ${rate}
s.Volume = ${volume}
Dim vs
${filter}
If Err.Number <> 0 Then Err.Clear
If Not vs Is Nothing Then
  If vs.Count > 0 Then Set s.Voice = vs(0)
End If
Err.Clear
Dim fs: Set fs = CreateObject("SAPI.SpFileStream")
fs.Open "${keluar.replace(/"/g, "")}", 3, False
If Err.Number <> 0 Then
  WScript.Echo "GALAT: buka berkas WAV: " & Err.Description
  WScript.Quit 1
End If
Set s.AudioOutputStream = fs
If Err.Number <> 0 Then
  WScript.Echo "GALAT: pasang keluaran: " & Err.Description
  WScript.Quit 1
End If
s.Speak ${ekspresiVbs(teks)}
If Err.Number <> 0 Then
  WScript.Echo "GALAT: baca skrip: " & Err.Description
  WScript.Quit 1
End If
fs.Close
WScript.Echo "SELESAI"
WScript.Quit 0
`;
  await writeFile(ps1Vbs, isi, "utf8"); // isi dijamin ASCII murni (ChrW utk non-ASCII)
  let binerCoba = false;
  for (const bin of kandidatWindows("cscript.exe")) {
    const h = await jalankan(bin, ["//Nologo", ps1Vbs], 150_000);
    if (!h.spawnGagal && h.kode === 0 && h.keluar.includes("SELESAI")) {
      return { ok: true, metode: "Suara bawaan Windows (jalur COM)" };
    }
    if (h.spawnGagal) { binerCoba = true; continue; }
    const alasan = h.timeout ? "timeout 150 dtk" : potong(h.keluar || h.galat);
    kumpul(`CScript-COM: exit ${h.kode ?? "-"} — ${alasan}`);
    return { ok: false };
  }
  if (binerCoba) kumpul("CScript-COM: cscript.exe tidak ditemukan");
  return { ok: false };
}

/** Skrip C: -File .ps1 UTF-8 BOM (jalur lama, diperkuat). */
async function ttsFile(
  teks: string, keluar: string, rate: number, volume: number, suara: string | undefined,
  ps1Path: string, kumpul: (g: string) => void,
): Promise<HasilTts> {
  const teksAman = KUTIP_PS(teks);
  const isi = "\ufeff" + intiPskrip(keluar, rate, volume, suara, `'${teksAman}'`);
  await writeFile(ps1Path, isi, "utf8");
  let binerCoba = false;
  for (const bin of kandidatWindows("powershell.exe")) {
    const h = await jalankan(bin, ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", ps1Path], 150_000);
    if (!h.spawnGagal && h.kode === 0 && h.keluar.includes("SELESAI")) {
      return { ok: true, metode: "PowerShell (berkas skrip)" };
    }
    if (h.spawnGagal) { binerCoba = true; continue; }
    const alasan = h.timeout ? "timeout 150 dtk" : potong(h.galat || h.keluar.replace(/^SELESAI/m, ""));
    kumpul(`PowerShell-File: exit ${h.kode ?? "-"} — ${alasan}`);
    return { ok: false };
  }
  if (binerCoba) kumpul("PowerShell-File: powershell.exe tidak ditemukan");
  return { ok: false };
}

/** Baca teks -> file WAV mono 22.05k. AI Neural dulu (bila dipilih & tersedia),
 *  lalu 3 strategi SAPI; selalu beri diagnosa. */
export async function buatNarasiWav(
  teks: string,
  opsi: OpsiNarasi,
  keluar: string,
  mesin: MesinNarasi = "ai",
): Promise<HasilTts> {
  const teksBersih = (teks || "").trim();
  if (!teksBersih) return { ok: false, galat: "teks paragraf kosong" };
  const kecepatan = Math.min(1.5, Math.max(0.6, opsi.kecepatan ?? 1));
  const diagnosa: string[] = [];
  const kumpul = (g: string) => { if (g) diagnosa.push(g); };
  // ---- Mesin AI Neural (Piper) — jalur utama, berbeda total dari SAPI ----
  if (mesin === "ai") {
    const a = await ttsPiper(teksBersih, keluar, kecepatan, kumpul);
    if (a.ok) return a;
    if (!piperSiap()) kumpul("Piper-AI: tidak terpasang (folder tts-piper tidak ditemukan)");
  }
  if (process.platform !== "win32") {
    return { ok: false, galat: diagnosa.join(" | ") || "pembaca skrip berbasis Windows/SAPI tidak tersedia di platform ini" };
  }
  const rate = Math.round((kecepatan - 1) * 5); // -2..2 (SAPI -10..10)
  const volume = Math.min(100, Math.max(10, Math.round((opsi.volume ?? 1) * 100)));
  const stempel = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const teksPath = path.join(os.tmpdir(), `vidsplit-tts-teks-${stempel}.txt`);
  const vbsPath = path.join(os.tmpdir(), `vidsplit-tts-${stempel}.vbs`);
  const ps1Path = path.join(os.tmpdir(), `vidsplit-tts-${stempel}.ps1`);
  try {
    await writeFile(teksPath, "\ufeff" + teksBersih, "utf8"); // BOM -> PowerShell membaca Unicode dgn benar
    const a = await ttsEncoded(teksPath, keluar, rate, volume, opsi.suara, kumpul);
    if (a.ok) return a;
    const b = await ttsCscript(teksBersih, keluar, rate, volume, opsi.suara, vbsPath, kumpul);
    if (b.ok) return b;
    const c = await ttsFile(teksBersih, keluar, rate, volume, opsi.suara, ps1Path, kumpul);
    if (c.ok) return c;
    return { ok: false, galat: diagnosa.join(" | ") || "semua jalur TTS gagal" };
  } catch (e) {
    return { ok: false, galat: diagnosa.join(" | ") + (diagnosa.length ? " | " : "") + (e instanceof Error ? e.message : String(e)) };
  } finally {
    for (const f of [teksPath, vbsPath, ps1Path]) {
      try { await rm(f, { force: true }); } catch { /* abaikan */ }
    }
  }
}

/** Daftar suara TTS terpasang (Windows saja; luar Windows = []). Timeout longgar 30 dtk. */
export async function daftarSuaraTts(): Promise<InfoSuara[]> {
  if (process.platform !== "win32") return [];
  const skrip = `try {
  Add-Type -AssemblyName System.Speech
  $s = New-Object System.Speech.Synthesis.SpeechSynthesizer
  foreach ($v in $s.GetInstalledVoices()) {
    Write-Output ($v.VoiceInfo.Name + [char]9 + $v.VoiceInfo.Culture.Name)
  }
  $s.Dispose()
} catch { exit 1 }`;
  const enc = Buffer.from(skrip, "utf16le").toString("base64");
  for (const bin of kandidatWindows("powershell.exe")) {
    const h = await jalankan(bin, ["-NoProfile", "-NonInteractive", "-EncodedCommand", enc], 30_000);
    if (h.spawnGagal) continue;
    if (h.kode === 0 && h.keluar.includes("\t")) {
      return h.keluar.split(/\r?\n/).filter((l) => l.includes("\t")).map((l) => {
        const [id, bahasa] = l.split("\t");
        return { id, bahasa };
      });
    }
    return []; // biner jalan tapi gagal -> jangan coba path lain
  }
  return [];
}

export interface HasilUjiTts extends HasilTts {
  durasi?: number;
  wavAbs?: string;
}

/** Uji cepat TTS: hasilkan WAV pendek "Satu dua tiga" + diagnosa.
 *  v0.28.0: durasi dibaca via durasiWav() RIFF murni — TIDAK lewat ffprobe lagi
 *  (probe() menuntut stream video sehingga WAV selalu "gagal dibaca"). */
export async function ujiTts(mesin: MesinNarasi = "ai"): Promise<HasilUjiTts> {
  const keluar = path.join(os.tmpdir(), `vidsplit-uji-suara-${Date.now()}-${Math.floor(Math.random() * 1e6)}.wav`);
  const h = await buatNarasiWav("Uji suara VidSplit. Satu, dua, tiga.", { kecepatan: 1, volume: 1 }, keluar, mesin);
  if (!h.ok) {
    try { await rm(keluar, { force: true }); } catch { /* abaikan */ }
    return { ok: false, galat: h.galat };
  }
  try {
    const durasi = await durasiWav(keluar);
    return { ok: true, metode: h.metode, durasi, wavAbs: keluar };
  } catch {
    // WAV terbuat walau header tak terbaca penuh — cukup kirim ok bila ukurannya wajar
    try {
      const s = await stat(keluar);
      if (s.size > 5000) return { ok: true, metode: h.metode, wavAbs: keluar };
    } catch { /* abaikan */ }
    return { ok: false, metode: h.metode, galat: `berkas WAV terbuat tetapi tak terbaca (${h.metode ?? "?"})` };
  }
}
