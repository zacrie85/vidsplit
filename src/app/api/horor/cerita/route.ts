// POST /api/horor/cerita — buat cerita offline dgn genre AI Video Generator (seed = reproduksi, seed baru = cerita baru)
import { NextRequest, NextResponse } from "next/server";
import { buatCerita } from "@/lib/vidsplit/hororCerita";
import { GENRE_IDS, type GenreId } from "@/lib/vidsplit/videoAi";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const b = (await req.json()) as {
      tema?: "rumah" | "sekolah" | "kantor" | "desa" | "acak";
      panjang?: "pendek" | "sedang" | "panjang" | "bab10" | "bab15" | "bab20";
      seed?: number;
      ide?: string;
      genre?: string;
    };
    const genre = b.genre && (GENRE_IDS as string[]).includes(b.genre) ? (b.genre as GenreId) : undefined;
    const cerita = buatCerita({ tema: b.tema, panjang: b.panjang, seed: b.seed, ide: b.ide, genre });
    return NextResponse.json({ ok: true, cerita, ide: (b.ide ?? "").trim() });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "gagal membuat cerita" }, { status: 500 });
  }
}
