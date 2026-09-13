// POST /api/musik/proses — job pemrosesan AUDIO saja (genre + karaoke + layer instrumen)
// → proses.wav (bahan video) + proses.mp3 320k (bisa langsung didengar & jadi hasil MP3).
import { NextRequest, NextResponse } from "next/server";
import { clampStudio, type OpsiStudioMusik } from "@/lib/vidsplit/musik";
import { mulaiProsesMusik } from "@/lib/vidsplit/musikJobs";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<OpsiStudioMusik>;
    if (!body.file) {
      return NextResponse.json({ ok: false, error: "Lagu belum diimpor" }, { status: 400 });
    }
    const opsi = clampStudio(body);
    const id = mulaiProsesMusik(opsi);
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Gagal memulai proses" },
      { status: 400 },
    );
  }
}
