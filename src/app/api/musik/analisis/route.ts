// POST /api/musik/analisis — analisis lagu: durasi, BPM, fase beat, kunci,
// chord otomatis (perkiraan), profil gelombang. Hasil di-cache server-side.
import { NextRequest, NextResponse } from "next/server";
import { cariBinary } from "@/lib/vidsplit/ffmpeg";
import { analisisMusik } from "@/lib/vidsplit/musikAnalisis";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { file?: string };
    if (!body.file) {
      return NextResponse.json({ ok: false, error: "Berkas belum diisi" }, { status: 400 });
    }
    const bin = await cariBinary("ffmpeg");
    const hasil = await analisisMusik(body.file, bin);
    return NextResponse.json({ ok: true, ...hasil });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Analisis gagal" },
      { status: 400 },
    );
  }
}
