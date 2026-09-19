// /api/horor/suara — GET: daftar suara TTS bawaan perangkat (Windows; lainnya []).
// POST: UJI SUARA — hasilkan WAV pendek dgn 3 strategi TTS, kembalikan diagnosa +
// WAV base64 agar bisa didengarkan langsung dari UI (v0.27.0).
import { readFile, rm } from "node:fs/promises";
import { NextResponse } from "next/server";
import { daftarSuaraTts, ujiTts } from "@/lib/vidsplit/hororTts";

export const runtime = "nodejs";

export async function GET() {
  const suara = await daftarSuaraTts();
  return NextResponse.json({ ok: true, suara, adaTts: suara.length > 0 });
}

export async function POST() {
  const h = await ujiTts();
  if (!h.ok || !h.wavAbs) {
    return NextResponse.json({ ok: false, metode: h.metode ?? null, galat: h.galat ?? "TTS tidak tersedia" });
  }
  try {
    const data = await readFile(h.wavAbs);
    void rm(h.wavAbs, { force: true }).catch(() => { /* abaikan */ });
    return NextResponse.json({
      ok: true,
      metode: h.metode ?? null,
      durasi: h.durasi ?? null,
      wav: `data:audio/wav;base64,${data.toString("base64")}`,
    });
  } catch {
    void rm(h.wavAbs, { force: true }).catch(() => { /* abaikan */ });
    return NextResponse.json({ ok: false, galat: "berkas uji tidak terbaca" });
  }
}
