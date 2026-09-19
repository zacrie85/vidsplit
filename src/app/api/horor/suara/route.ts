// GET /api/horor/suara — daftar suara TTS bawaan perangkat (Windows saja; lainnya [])
import { NextResponse } from "next/server";
import { daftarSuaraTts } from "@/lib/vidsplit/hororTts";

export const runtime = "nodejs";

export async function GET() {
  const suara = await daftarSuaraTts();
  return NextResponse.json({ ok: true, suara, adaTts: suara.length > 0 });
}
