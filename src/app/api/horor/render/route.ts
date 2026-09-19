// POST /api/horor/render — mulai job render video ilustrasi horor -> {id}
import { NextRequest, NextResponse } from "next/server";
import { mulaiRenderHoror, type OpsiHororMasuk } from "@/lib/vidsplit/hororJobs";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const b = (await req.json()) as OpsiHororMasuk;
    if (!b?.cerita?.bab?.length) throw new Error("Cerita kosong — buat cerita dulu");
    if (!b.cerita.bab.every((x) => Array.isArray(x.paragraf) && x.paragraf.length)) throw new Error("Ada bab tanpa paragraf");
    const id = mulaiRenderHoror(b);
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "gagal mulai render" }, { status: 500 });
  }
}
