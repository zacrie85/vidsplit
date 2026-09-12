// GET /api/job?id=xxx — status satu job; tanpa id = daftar semua
// POST /api/job {id, aksi:"batal"} — batalkan ekspor yang sedang berjalan
import { NextRequest, NextResponse } from "next/server";
import { ambilJob, batalkanJob, daftarJob } from "@/lib/vidsplit/jobs";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (id) {
    const job = ambilJob(id);
    if (!job) return NextResponse.json({ ok: false, error: "Job tidak ditemukan" }, { status: 404 });
    return NextResponse.json({ ok: true, job });
  }
  return NextResponse.json({ ok: true, jobs: daftarJob() });
}

export async function POST(req: NextRequest) {
  const b = (await req.json().catch(() => null)) as { id?: string; aksi?: string } | null;
  if (!b?.id || b.aksi !== "batal") {
    return NextResponse.json({ ok: false, error: "Aksi tidak dikenal" }, { status: 400 });
  }
  const jalan = batalkanJob(b.id);
  if (!jalan) {
    return NextResponse.json(
      { ok: false, error: "Job tidak ditemukan atau sudah selesai" },
      { status: 404 },
    );
  }
  return NextResponse.json({ ok: true });
}
