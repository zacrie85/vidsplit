// GET /api/model-pembicara — status model YOLO ZOOM PEMBICARA (ada/ukuran)
// POST /api/model-pembicara — unduh model sekarang (±12 MB, sekali, lalu 100% offline)
import { NextResponse } from "next/server";
import { statusModel, unduhModel } from "@/lib/vidsplit/pembicara";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET() {
  return NextResponse.json({ ok: true, ...statusModel() });
}

export async function POST() {
  try {
    const path = await unduhModel();
    return NextResponse.json({ ok: true, ...statusModel(), path });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Unduhan model gagal" },
      { status: 500 },
    );
  }
}
