// POST /api/musik/pratinjau — render SINGKAT 10 detik 640×360 utk mengintip gaya visual
// + overlay judul/chord/lirik sebelum ekspor penuh. Berjalan serentak (await) — biasanya
// 3–8 detik utk 300 frame.
import { NextRequest, NextResponse } from "next/server";
import { VISUAL_MUSIK, opsiVisualDefault } from "@/lib/vidsplit/musik";
import type { BarisLirik, IdVisual, OpsiVisual, SegmenChord } from "@/lib/vidsplit/musik";
import { pratinjauVisual } from "@/lib/vidsplit/musikJobs";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      wavRel?: string; judul?: string; visual?: string;
      opsiVisual?: Partial<OpsiVisual>; mulai?: number;
      lirik?: BarisLirik[]; chord?: SegmenChord[];
    };
    if (!body.wavRel) {
      return NextResponse.json(
        { ok: false, error: "Proses audio dulu sebelum mengintip visual" },
        { status: 400 },
      );
    }
    const visual = (VISUAL_MUSIK.find((v) => v.id === body.visual)?.id ?? "cqt-klasik") as IdVisual;
    const file = await pratinjauVisual({
      wavRel: body.wavRel,
      judul: String(body.judul || "Pratinjau").slice(0, 120),
      visual,
      opsiVisual: { ...opsiVisualDefault, ...(body.opsiVisual || {}) },
      mulai: Math.max(0, Number(body.mulai) || 0),
      lirik: Array.isArray(body.lirik) ? body.lirik.slice(0, 900) : [],
      chord: Array.isArray(body.chord) ? body.chord.slice(0, 900) : [],
    });
    return NextResponse.json({ ok: true, file });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Pratinjau gagal" },
      { status: 400 },
    );
  }
}
