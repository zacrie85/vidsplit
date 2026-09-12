// GET /api/font?f=Anton.ttf — sajikan TTF bundel untuk pratinjau font di UI
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { dirFontKandidat } from "@/lib/vidsplit/ffmpeg";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const f = req.nextUrl.searchParams.get("f") || "";
  // whitelist ketat: hanya nama berkas TTF sederhana (tanpa path traversal)
  if (!/^[A-Za-z0-9._-]+\.ttf$/.test(f)) {
    return new NextResponse("Nama font tidak valid", { status: 400 });
  }
  for (const d of dirFontKandidat()) {
    const p = path.join(d, f);
    if (existsSync(p)) {
      try {
        const buf = readFileSync(p);
        return new NextResponse(new Uint8Array(buf), {
          headers: {
            "Content-Type": "font/ttf",
            "Cache-Control": "public, max-age=604800",
          },
        });
      } catch {
        break;
      }
    }
  }
  return new NextResponse("Font tidak ditemukan", { status: 404 });
}
