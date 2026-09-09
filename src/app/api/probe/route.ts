// POST /api/probe { file } — info video: durasi, dimensi, fps, ada audio
import { existsSync, statSync } from "node:fs";
import { NextRequest, NextResponse } from "next/server";
import { pathAman, probe } from "@/lib/vidsplit/ffmpeg";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { file?: string };
    if (!body.file) throw new Error("Field 'file' wajib diisi");
    const abs = pathAman(body.file);
    if (!existsSync(abs)) throw new Error("File tidak ditemukan di server");
    const info = await probe(abs);
    return NextResponse.json({
      ok: true,
      file: body.file,
      nama: body.file.split("/").pop(),
      ukuran: statSync(abs).size,
      ...info,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Probe gagal" },
      { status: 400 },
    );
  }
}
