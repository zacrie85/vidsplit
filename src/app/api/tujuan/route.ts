// GET /api/tujuan — setelan folder tujuan hasil ekspor (folder pilihan + saklar otomatis)
// POST /api/tujuan {folder?, otomatis?, bersihkanKerja?} — simpan setelan;
//   folder divalidasi (harus absolut, dibuat bila belum ada, uji tulis sungguhan).
import { NextRequest, NextResponse } from "next/server";
import {
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
  } | null;
  if (!b) {
    return NextResponse.json({ ok: false, error: "Body tidak sah" }, { status: 400 });
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
