// GET  /api/musik/job?id=…  — status job Studio Musik (polling UI)
// POST /api/musik/job       — {id, aksi:"batal"}
import { NextRequest, NextResponse } from "next/server";
import { ambilJobMusik, batalkanJobMusik } from "@/lib/vidsplit/musikJobs";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id") || "";
  const job = ambilJobMusik(id);
  if (!job) {
    return NextResponse.json({ ok: false, error: "Job tidak ditemukan" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, job });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { id?: string; aksi?: string };
    if (!body.id || body.aksi !== "batal") {
      return NextResponse.json({ ok: false, error: "Permintaan tidak dikenal" }, { status: 400 });
    }
    const jadi = batalkanJobMusik(body.id);
    return NextResponse.json({ ok: jadi, error: jadi ? null : "Job tidak bisa dibatalkan" });
  } catch {
    return NextResponse.json({ ok: false, error: "Permintaan rusak" }, { status: 400 });
  }
}
