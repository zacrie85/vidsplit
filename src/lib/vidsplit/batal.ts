// VidSplit — registry proses ffmpeg aktif per job + penanda pembatalan.
// Dipakai tombol Batalkan: child ffmpeg yang berjalan dibunuh lewat SIGKILL,
// worker pool melihat flag dan berhenti mengambil part/video baru.
import type { ChildProcess } from "node:child_process";

/** jobId → set child ffmpeg yang masih hidup */
const proses = new Map<string, Set<ChildProcess>>();

/** jobId yang diminta batal (tetap sampai dibersihkan di akhir job) */
const diminta = new Set<string>();

/** Daftarkan child ffmpeg ke job — otomatis lepas saat proses mati */
export function daftarkanProses(id: string, c: ChildProcess): void {
  let set = proses.get(id);
  if (!set) {
    set = new Set();
    proses.set(id, set);
  }
  set.add(c);
  const lepas = () => {
    const s = proses.get(id);
    if (s) s.delete(c);
  };
  c.on("close", lepas);
  c.on("error", lepas);
}

/** Minta pembatalan: pasang flag + bunuh semua ffmpeg aktif milik job ini */
export function mintaBatal(id: string): void {
  diminta.add(id);
  const set = proses.get(id);
  if (set) {
    for (const c of set) {
      try {
        c.kill("SIGKILL");
      } catch {
        /* proses mungkin sudah mati */
      }
    }
  }
}

/** Apakah job ini sedang dibatalkan? */
export function apakahBatal(id: string): boolean {
  return diminta.has(id);
}

/** Bersihkan registry job (panggil SEKALI setelah semua child pasti mati) */
export function bersihkanBatal(id: string): void {
  diminta.delete(id);
  proses.delete(id);
}
