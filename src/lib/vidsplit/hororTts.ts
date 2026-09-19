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
import { writeFile, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { probe } from "./ffmpeg";

export interface InfoSuara {
  id: string; // nama voice
  bahasa: string;
}

export interface OpsiNarasi {
  kecepatan?: number; // 0.6..1.5
  volume?: number; // 0..1
  suara?: string; // nama voice (opsional)
}

export interface HasilTts {
  ok: boolean;
  metode?: string; // strategi yang berhasil, mis. "PowerShell (bawaan)"
  galat?: string; // gabungan diagnosa bila gagal
}

interface HasilSpawn {
  kode: number | null;
  keluar: string;
  galat: string;
  spawnGagal: boolean; // biner tidak bisa dijalankan (ENOENT dkk.)
  timeout: boolean;
}

/** Jalankan proses Windows; resolve selalu (tidak melempar), dengan diagnosa. */
function jalankan(bin: string, args: string[], batasMs: number): Promise<HasilSpawn> {
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

/** Potong diagnosa agar ringkas. */
function potong(s: string, maks = 240): string {
  const b = (s || "").replace(/\s+/g, " ").trim();
  return b.length > maks ? b.slice(0, maks) + "…" : b;
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

/** Baca teks -> file WAV mono 22.05k. Coba 3 strategi; selalu beri diagnosa. */
export async function buatNarasiWav(
  teks: string,
  opsi: OpsiNarasi,
  keluar: string,
): Promise<HasilTts> {
  if (process.platform !== "win32") {
    return { ok: false, galat: "pembaca skrip (TTS) hanya tersedia di Windows — gunakan versi Windows VidSplit" };
  }
  const teksBersih = (teks || "").trim();
  if (!teksBersih) return { ok: false, galat: "teks paragraf kosong" };
  const kecepatan = Math.min(1.5, Math.max(0.6, opsi.kecepatan ?? 1));
  const rate = Math.round((kecepatan - 1) * 5); // -2..2 (SAPI -10..10)
  const volume = Math.min(100, Math.max(10, Math.round((opsi.volume ?? 1) * 100)));
  const stempel = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const teksPath = path.join(os.tmpdir(), `vidsplit-tts-teks-${stempel}.txt`);
  const vbsPath = path.join(os.tmpdir(), `vidsplit-tts-${stempel}.vbs`);
  const ps1Path = path.join(os.tmpdir(), `vidsplit-tts-${stempel}.ps1`);
  const diagnosa: string[] = [];
  const kumpul = (g: string) => { if (g) diagnosa.push(g); };
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

/** Uji cepat TTS: hasilkan WAV pendek "Satu dua tiga" + diagnosa. */
export async function ujiTts(): Promise<HasilUjiTts> {
  const keluar = path.join(os.tmpdir(), `vidsplit-uji-suara-${Date.now()}-${Math.floor(Math.random() * 1e6)}.wav`);
  const h = await buatNarasiWav("Uji suara VidSplit. Satu, dua, tiga.", { kecepatan: 1, volume: 1 }, keluar);
  if (!h.ok) return { ok: false, galat: h.galat };
  try {
    const info = await probe(keluar);
    return { ok: true, metode: h.metode, durasi: info.durasi, wavAbs: keluar };
  } catch {
    return { ok: false, metode: h.metode, galat: `berkas WAV terbuat tetapi gagal dibaca (${h.metode ?? "?"})` };
  }
}
