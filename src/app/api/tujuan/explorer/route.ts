// Explorer folder SERVER-SIDE utk memilih folder tujuan hasil ekspor (v0.6.4).
// GET tanpa ?path = daftar drive (Windows A–Z; POSIX: "/") + ruang bebas.
// GET ?path=/absolut = daftar subfolder di path itu (folder saja, urut nama).
// POST {path, nama} = buat folder baru di dalam path, balas path folder barunya.
// Aman: server hanya mendengar di 127.0.0.1 (desktop lokal) — semua path absolut.
import { existsSync, mkdirSync, readdirSync, statSync, statfsSync } from "node:fs";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { bersihkanNama } from "@/lib/vidsplit/tujuan";

export const runtime = "nodejs";

const MAKS_ENTRI = 400;

interface EntriDrive {
  nama: string;
  path: string;
  /** byte ruang bebas (bila bisa dibaca) */
  bebas?: number;
}

function daftarDrive(): EntriDrive[] {
  const hasil: EntriDrive[] = [];
  if (process.platform === "win32") {
    for (let i = 65; i <= 90; i++) {
      const huruf = String.fromCharCode(i);
      const akar = `${huruf}:\\`;
      try {
        if (!statSync(akar).isDirectory()) continue;
        let bebas: number | undefined;
        try {
          bebas = statfsSync(akar).bsize * statfsSync(akar).bavail;
        } catch {
          /* ruang bebas tak tersedia */
        }
        hasil.push({ nama: `Drive ${huruf}:`, path: akar, bebas });
      } catch {
        /* drive tidak ada — lewati */
      }
    }
  }
  if (!hasil.length) {
    // POSIX (dev/server Linux): akar sistem + mount umum yang benar-benar ada
    const kandidat = ["/", "/media", "/mnt"];
    for (const k of kandidat) {
      try {
        if (!statSync(k).isDirectory()) continue;
        let bebas: number | undefined;
        try {
          bebas = statfsSync(k).bsize * statfsSync(k).bavail;
        } catch {
          /* abaikan */
        }
        hasil.push({ nama: k === "/" ? "Disk sistem" : k, path: k, bebas });
      } catch {
        /* abaikan */
      }
    }
  }
  return hasil;
}

function infoPath(mentah: string): { ok: true; r: string } | { ok: false; error: string } {
  const t = (mentah || "").trim();
  if (!t) return { ok: false, error: "Path kosong" };
  if (t.length > 250) return { ok: false, error: "Path terlalu panjang" };
  if (!path.isAbsolute(t)) return { ok: false, error: "Path harus absolut" };
  const r = path.normalize(t);
  try {
    if (!statSync(r).isDirectory()) return { ok: false, error: "Bukan folder" };
  } catch {
    return { ok: false, error: "Folder tidak ditemukan" };
  }
  return { ok: true, r };
}

export async function GET(req: NextRequest) {
  const mentah = req.nextUrl.searchParams.get("path");
  if (!mentah) {
    return NextResponse.json({ ok: true, akar: true, daftar: daftarDrive() });
  }
  const cek = infoPath(mentah);
  if (!cek.ok) {
    return NextResponse.json({ ok: false, error: cek.error }, { status: 400 });
  }
  const r = cek.r;
  let entri: { nama: string; path: string }[] = [];
  try {
    entri = readdirSync(r, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith("."))
      .map((d) => ({ nama: d.name, path: path.join(r, d.name) }))
      .sort((a, b) => a.nama.localeCompare(b.nama, "id", { numeric: true }))
      .slice(0, MAKS_ENTRI);
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: `Gagal membaca folder: ${e instanceof Error ? e.message : e}` },
      { status: 400 },
    );
  }
  // induk navigasi: null di akar drive / akar sistem
  const induk = path.dirname(r);
  return NextResponse.json({
    ok: true,
    akar: false,
    path: r,
    induk: induk && induk !== r ? induk : null,
    entri,
  });
}

export async function POST(req: NextRequest) {
  const b = (await req.json().catch(() => null)) as { path?: string; nama?: string } | null;
  if (!b?.path || !b?.nama?.trim()) {
    return NextResponse.json({ ok: false, error: "Path & nama folder wajib diisi" }, { status: 400 });
  }
  const cek = infoPath(b.path);
  if (!cek.ok) {
    return NextResponse.json({ ok: false, error: cek.error }, { status: 400 });
  }
  const baru = path.join(cek.r, bersihkanNama(b.nama));
  if (existsSync(baru)) {
    return NextResponse.json({ ok: false, error: "Folder dengan nama itu sudah ada" }, { status: 400 });
  }
  try {
    mkdirSync(baru, { recursive: true });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: `Gagal membuat folder: ${e instanceof Error ? e.message : e}` },
      { status: 400 },
    );
  }
  return NextResponse.json({ ok: true, path: baru });
}
