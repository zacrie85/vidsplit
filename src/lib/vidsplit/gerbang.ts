// VidSplit — gerbang password: kunci layar saat aplikasi dibuka (100% lokal).
// Password tersimpan sebagai hash SHA-256 ber-salt di <work>/gate.json — di mode
// desktop folder itu = VidSplit-Data (portable) / AppData (terinstal), ikut pindah
// bersama aplikasi. Bila gate.json belum ada, dipakai PASSWORD_DEFAULT; MENGHAPUS
// gate.json mengembalikan password ke default (jalur pemulihan bila lupa).
import { createHash, randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { ROOT_WORK } from "./ffmpeg";

export const PASSWORD_DEFAULT = "A$rama33";

const FILE_GATE = path.join(ROOT_WORK, "gate.json");

function hash(salt: string, password: string): string {
  return createHash("sha256").update(`${salt}:${password}`, "utf8").digest("hex");
}

interface SimpananGate {
  v: number;
  salt: string;
  hash: string;
}

function bacaSimpanan(): SimpananGate | null {
  try {
    if (!existsSync(FILE_GATE)) return null;
    const j = JSON.parse(readFileSync(FILE_GATE, "utf8")) as Partial<SimpananGate>;
    if (typeof j.salt === "string" && typeof j.hash === "string") {
      return { v: 1, salt: j.salt, hash: j.hash };
    }
    return null;
  } catch {
    return null;
  }
}

/** true bila password cocok (default A$rama33 bila belum pernah diganti) */
export function verifikasi(password: string): boolean {
  const s = bacaSimpanan();
  if (!s) return password === PASSWORD_DEFAULT;
  const coba = hash(s.salt, password);
  // bandingkan konstanta-waktu biar tidak bocor lewat timing
  if (coba.length !== s.hash.length) return false;
  let beda = 0;
  for (let i = 0; i < coba.length; i++) beda |= coba.charCodeAt(i) ^ s.hash.charCodeAt(i);
  return beda === 0;
}

/** Ganti password (wajib password lama benar). Password disimpan sebagai hash+salt. */
export function gantiPassword(lama: string, baru: string): { ok: boolean; error?: string } {
  if (!verifikasi(lama)) return { ok: false, error: "Password lama salah" };
  const bersih = (baru || "").trim();
  if (bersih.length < 4) return { ok: false, error: "Password baru minimal 4 karakter" };
  if (bersih.length > 100) return { ok: false, error: "Password baru maksimal 100 karakter" };
  if (bersih === lama.trim()) {
    return { ok: false, error: "Password baru sama dengan yang lama" };
  }
  const salt = randomBytes(8).toString("hex");
  try {
    writeFileSync(
      FILE_GATE,
      JSON.stringify({ v: 1, salt, hash: hash(salt, bersih) }, null, 2),
      { mode: 0o600 },
    );
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Gagal menyimpan password" };
  }
  return { ok: true };
}

/** true bila password sudah pernah diganti (gate.json ada) */
export function sudahDiganti(): boolean {
  return bacaSimpanan() !== null;
}
