// GET /api/tujuan — setelan folder tujuan hasil ekspor (folder pilihan + saklar otomatis)
// POST /api/tujuan {folder?, otomatis?, bersihkanKerja?} — simpan setelan;
//   folder divalidasi (harus absolut, dibuat bila belum ada, uji tulis sungguhan).
// POST {aksi:"bersihkan-output"} — v3.9.1: hapus SISA hasil ekspor lama di folder
//   output aplikasi (data\output); folder job yang masih baru (<10 menit, job
//   berjalan) tidak disentuh.
import { NextRequest, NextResponse } from "next/server";
import {
  bersihkanFolderOutputLama,
  muatSetelanTujuan,
  perbaruiSetelanTujuan,
  validasiFolderTujuan,
} from "@/lib/vidsplit/tujuan";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ ok: true, setelan: muatSetelanTujuan() });
}

export async function POST(req: NextRequest) {
  const b = (await req.json().catch(() => null)) as {
    folder?: string | null;
    otomatis?: boolean;
    bersihkanKerja?: boolean;
    aksi?: string;
  } | null;
  if (!b) {
    return NextResponse.json({ ok: false, error: "Body tidak sah" }, { status: 400 });
  }

  // v3.9.1 — aksi bersih-bersih folder output lama (terpisah dr penyimpanan setelan)
  if (b.aksi === "bersihkan-output") {
    const hasil = bersihkanFolderOutputLama(10);
    return NextResponse.json({ ok: true, hasil });
  }

  let folder = b.folder;
  if (folder !== undefined && folder !== null) {
    const v = validasiFolderTujuan(folder);
    if (!v.ok) return NextResponse.json({ ok: false, error: v.error }, { status: 400 });
    folder = v.folder;
  }

  const setelan = await perbaruiSetelanTujuan({
    folder,
    otomatis: b.otomatis,
    bersihkanKerja: b.bersihkanKerja,
  });
  return NextResponse.json({ ok: true, setelan });
}
