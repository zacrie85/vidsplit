// /api/horor/suara — GET: daftar suara TTS + ketersediaan mesin (AI Neural/SAPI).
// POST: UJI SUARA — hasilkan WAV pendek dgn mesin terpilih, kembalikan diagnosa +
// WAV base64 agar bisa didengarkan langsung dari UI (v0.28.0).
import { readFile, rm } from "node:fs/promises";
import { NextResponse } from "next/server";
import { daftarSuaraTts, ujiTts, piperSiap, type MesinNarasi } from "@/lib/vidsplit/hororTts";

export const runtime = "nodejs";

export async function GET() {
  const suara = await daftarSuaraTts();
  return NextResponse.json({
    ok: true,
    suara,
    adaTts: suara.length > 0,
    /** v0.28.0 — AI Voice Generator (Piper) terpasang di aplikasi */
    adaAi: piperSiap() !== null,
  });
}

export async function POST(req: Request) {
  let mesin: MesinNarasi = "ai";
  let pria = false;
  try {
    const b = (await req.json()) as { mesin?: MesinNarasi; pria?: boolean };
    if (b?.mesin === "windows" || b?.mesin === "ai") mesin = b.mesin;
    pria = b?.pria === true; // v0.33.0 — uji suara dgn nada pria bila dipilih
  } catch { /* tanpa isi — pakai bawaan "ai" */ }
  const h = await ujiTts(mesin, pria);
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
