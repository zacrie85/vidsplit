// GET  /api/gate — status gerbang (selalu terpasang; info bila password pernah diganti)
// POST /api/gate — { aksi:"buka", password } buka kunci | { aksi:"ganti", lama, baru }
import { NextRequest, NextResponse } from "next/server";
import { gantiPassword, sudahDiganti, verifikasi } from "@/lib/vidsplit/gerbang";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ ok: true, terpasang: true, diganti: sudahDiganti() });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      aksi?: string;
      password?: string;
      lama?: string;
      baru?: string;
    };

    if (body.aksi === "ganti") {
      const r = gantiPassword(body.lama ?? "", body.baru ?? "");
      if (!r.ok) {
        return NextResponse.json({ ok: false, error: r.error }, { status: 400 });
      }
      return NextResponse.json({ ok: true, pesan: "Password gerbang berhasil diganti" });
    }

    // default aksi: buka gerbang
    if (!verifikasi(body.password ?? "")) {
      // jeda kecil mempersulit coba-coba
      await new Promise((r) => setTimeout(r, 500));
      return NextResponse.json({ ok: false, error: "Password salah" }, { status: 401 });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "Permintaan tidak valid" }, { status: 400 });
  }
}
