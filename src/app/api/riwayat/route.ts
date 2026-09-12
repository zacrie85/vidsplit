// GET /api/riwayat — daftar riwayat ekspor (hasil split sebelumnya yang masih ada di disk)
// POST /api/riwayat {id, aksi:"hapusFile"} — buang entri dari daftar + hapus file hasilnya
import { NextRequest, NextResponse } from "next/server";
import { daftarRiwayat, hapusRiwayat } from "@/lib/vidsplit/riwayat";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ ok: true, daftar: daftarRiwayat() });
}

export async function POST(req: NextRequest) {
  const b = (await req.json().catch(() => null)) as { id?: string; aksi?: string } | null;
  if (!b?.id || b.aksi !== "hapusFile") {
    return NextResponse.json({ ok: false, error: "Aksi tidak dikenal" }, { status: 400 });
  }
  const hapus = hapusRiwayat(b.id, true);
  if (!hapus) {
    return NextResponse.json({ ok: false, error: "Entri tidak ditemukan" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
