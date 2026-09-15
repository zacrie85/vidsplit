// POST /api/musik/pisah — job PISAH VOKAL & MUSIK (vocal remover, v0.19.0):
// satu lagu → dua berkas MP3 320k (instrumental karaoke + vokal bersih).
import { NextRequest, NextResponse } from "next/server";
import { mulaiPisahMusik } from "@/lib/vidsplit/musikJobs";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { file?: string; judul?: string };
    if (!body.file) {
      return NextResponse.json({ ok: false, error: "Lagu belum diimpor" }, { status: 400 });
    }
    const id = mulaiPisahMusik({
      file: body.file,
      judul: (body.judul || "lagu").slice(0, 120),
    });
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Gagal memulai pemisahan" },
      { status: 400 },
    );
  }
}
