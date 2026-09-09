// GET /api/job?id=xxx — status satu job; tanpa id = daftar semua
import { NextRequest, NextResponse } from "next/server";
import { ambilJob, daftarJob } from "@/lib/vidsplit/jobs";

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
