// GET /api/horor/job?id= — status job render horor
// DELETE /api/horor/job?id= — minta pembatalan job
import { NextRequest, NextResponse } from "next/server";
import { ambilJobHoror, batalkanJobHoror } from "@/lib/vidsplit/hororJobs";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "id wajib" }, { status: 400 });
  const job = ambilJobHoror(id);
  if (!job) return NextResponse.json({ ok: false, error: "job tidak ditemukan" }, { status: 404 });
  return NextResponse.json({ ok: true, job });
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "id wajib" }, { status: 400 });
  return NextResponse.json({ ok: batalkanJobHoror(id) });
}
