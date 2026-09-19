// VidSplit v0.25.0 — PEMBACA SKRIP (TTS) via Windows SAPI System.Speech lewat
// PowerShell — suara BAWAAN Windows, 100% offline. Di perangkat tanpa PowerShell
// (atau tanpa TTS), narasi dilewati dengan anggun -> video tetap dibuat (musik saja).
import { spawn } from "node:child_process";
import { writeFile, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

function binPowerShell(): string | null {
  if (process.platform !== "win32") return null;
  return "powershell.exe";
}

export interface InfoSuara {
  id: string; // nama voice
  bahasa: string;
}

/** Daftar suara TTS terpasang (Windows saja; luar Windows = []) */
export async function daftarSuaraTts(): Promise<InfoSuara[]> {
  const ps = binPowerShell();
  if (!ps) return [];
  const skrip = `
Add-Type -AssemblyName System.Speech
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
foreach ($v in $s.GetInstalledVoices()) {
  $n = $v.VoiceInfo.Name
  $c = $v.VoiceInfo.Culture.Name
  Write-Output ($n + [char]9 + $c)
}
$s.Dispose()`;
  return new Promise((resolve) => {
    const c = spawn(ps, ["-NoProfile", "-NonInteractive", "-Command", skrip], { windowsHide: true });
    let out = "";
    c.stdout?.on("data", (d) => (out += d.toString()));
    c.on("error", () => resolve([]));
    c.on("close", (kode) => {
      if (kode !== 0) return resolve([]);
      const hasil = out.split(/\r?\n/).filter((l) => l.includes("\t")).map((l) => {
        const [id, bahasa] = l.split("\t");
        return { id, bahasa };
      });
      resolve(hasil);
    });
    setTimeout(() => { try { c.kill(); } catch { /* abaikan */ } resolve([]); }, 15000);
  });
}

export interface OpsiNarasi {
  kecepatan?: number; // 0.6..1.5
  volume?: number; // 0..1
  suara?: string; // nama voice (opsional)
}

/** Baca teks -> file WAV mono 22.05k. false = TTS tidak tersedia/gagal. */
export async function buatNarasiWav(
  teks: string,
  opsi: OpsiNarasi,
  keluar: string,
): Promise<boolean> {
  const ps = binPowerShell();
  if (!ps) return false;
  const kecepatan = Math.min(1.5, Math.max(0.6, opsi.kecepatan ?? 1));
  const rate = Math.round((kecepatan - 1) * 5); // -2..2 (SAPI -10..10)
  const volume = Math.min(100, Math.max(10, Math.round((opsi.volume ?? 1) * 100)));
  const ps1 = path.join(os.tmpdir(), `vidsplit-tts-${Date.now()}-${Math.floor(Math.random() * 1e6)}.ps1`);
  const teksAman = teks.replace(/'/g, "''");
  const pilihSuara = opsi.suara
    ? `try { $s.SelectVoice('${(opsi.suara || "").replace(/'/g, "''")}') } catch {}`
    : `try { foreach ($v in $s.GetInstalledVoices()) { if ($v.VoiceInfo.Culture.Name -like 'id*') { $s.SelectVoice($v.VoiceInfo.Name); break } } } catch {}`;
  const isi = `
Add-Type -AssemblyName System.Speech
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
$s.SetOutputToWaveFile('${keluar.replace(/'/g, "''")}',
  [System.Speech.AudioFormat.SpeechAudioFormatInfo]::new(22050,
    [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen,
    [System.Speech.AudioFormat.AudioChannel]::Mono))
$s.Rate = ${rate}
$s.Volume = ${volume}
${pilihSuara}
$s.Speak('${teksAman}')
$s.Dispose()
Write-Output SELESAI`;
  try {
    await writeFile(ps1, isi, "utf8");
    const ok = await new Promise<boolean>((resolve) => {
      const c = spawn(ps, ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", ps1], { windowsHide: true });
      c.on("error", () => resolve(false));
      c.on("close", (kode) => resolve(kode === 0));
      setTimeout(() => { try { c.kill(); } catch { /* abaikan */ } resolve(false); }, 120_000);
    });
    return ok;
  } catch {
    return false;
  } finally {
    try { await rm(ps1, { force: true }); } catch { /* abaikan */ }
  }
}
