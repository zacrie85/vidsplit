// POST /api/horor/cerita — buat cerita horor offline (seed = reproduksi, seed baru = cerita baru)
import { NextRequest, NextResponse } from "next/server";
import { buatCerita } from "@/lib/vidsplit/hororCerita";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const b = (await req.json()) as {
      tema?: "rumah" | "sekolah" | "kantor" | "desa" | "acak";
      panjang?: "pendek" | "sedang" | "panjang" | "bab10" | "bab15" | "bab20";
      seed?: number;
      ide?: string;
    };
    const cerita = buatCerita({ tema: b.tema, panjang: b.panjang, seed: b.seed, ide: b.ide });
    return NextResponse.json({ ok: true, cerita, ide: (b.ide ?? "").trim() });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "gagal membuat cerita" }, { status: 500 });
  }
}
