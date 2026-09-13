// POST /api/musik/render — job lengkap Studio Musik: audio (bila perlu) → video
// visualizer + overlay judul/chord/lirik (ASS) → berkas txt/lrc → salin tujuan → riwayat.
import { NextRequest, NextResponse } from "next/server";
import { VISUAL_MUSIK, opsiVisualDefault, clampStudio } from "@/lib/vidsplit/musik";
import type { BarisLirik, IdVisual, OpsiStudioMusik, OpsiVisual, SegmenChord } from "@/lib/vidsplit/musik";
import { mulaiRenderMusik } from "@/lib/vidsplit/musikJobs";

export const runtime = "nodejs";

function rapiVisual(v: Partial<OpsiVisual> | undefined): OpsiVisual {
  const dasar = { ...opsiVisualDefault };
  if (!v || typeof v !== "object") return dasar;
  const hex = (x: unknown, bawaan: string) =>
    typeof x === "string" && /^#[0-9a-fA-F]{6}$/.test(x) ? x : bawaan;
  return {
    warna1: hex(v.warna1, dasar.warna1),
    warna2: hex(v.warna2, dasar.warna2),
    sensitivitas: Math.min(10, Math.max(1, Math.round(Number(v.sensitivitas) || 5))),
    bgMode: v.bgMode === "gradien" || v.bgMode === "hitam" ? v.bgMode : "gelap",
    fontJudul: typeof v.fontJudul === "string" ? v.fontJudul : dasar.fontJudul,
    teksJudul: String(v.teksJudul || "").slice(0, 120),
    tampilJudul: v.tampilJudul !== false,
    tampilChord: v.tampilChord !== false,
    tampilLirik: v.tampilLirik !== false,
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      file?: string; judul?: string; genre?: string; layerLevel?: number;
      karaoke?: string; bpm?: number; fase?: number;
      mode?: string; kecepatan?: number; grooveLevel?: number;
      melodiLevel?: number; vokalLevel?: number;
      visual?: string; opsiVisual?: Partial<OpsiVisual>;
      resolusi?: string; lirik?: BarisLirik[]; chord?: SegmenChord[];
      audioSudahProses?: boolean; wavSiap?: string | null; fileMp3Siap?: string | null;
    };
    if (!body.file) {
      return NextResponse.json({ ok: false, error: "Lagu belum diimpor" }, { status: 400 });
    }
    const visual = (VISUAL_MUSIK.find((v) => v.id === body.visual)?.id ?? "cqt-klasik") as IdVisual;
    const opsi = {
      ...clampStudio({
        file: body.file,
        judul: body.judul,
        genre: body.genre as OpsiStudioMusik["genre"],
        layerLevel: body.layerLevel,
        karaoke: body.karaoke as OpsiStudioMusik["karaoke"],
        bpm: body.bpm,
        fase: body.fase,
        mode: body.mode as OpsiStudioMusik["mode"],
        kecepatan: body.kecepatan,
        grooveLevel: body.grooveLevel,
        melodiLevel: body.melodiLevel,
        vokalLevel: body.vokalLevel,
      }),
      visual,
      opsiVisual: rapiVisual(body.opsiVisual),
      resolusi: body.resolusi === "720" ? "720" as const : "1080" as const,
      lirik: Array.isArray(body.lirik)
        ? body.lirik
          .filter((b) => b && typeof b.teks === "string" && Number.isFinite(b.mulai))
          .slice(0, 900)
          .map((b) => ({ mulai: Math.max(0, Number(b.mulai)), teks: String(b.teks).slice(0, 200) }))
        : [],
      chord: Array.isArray(body.chord)
        ? body.chord
          .filter((c) => c && typeof c.chord === "string" && Number.isFinite(c.mulai) && Number.isFinite(c.durasi))
          .slice(0, 900)
          .map((c) => ({ mulai: Math.max(0, Number(c.mulai)), durasi: Math.max(0.1, Number(c.durasi)), chord: String(c.chord).slice(0, 8) }))
        : [],
      audioSudahProses: body.audioSudahProses === true && !!body.wavSiap,
      wavSiap: body.wavSiap ?? null,
      fileMp3Siap: body.fileMp3Siap ?? null,
    };
    const id = mulaiRenderMusik(opsi);
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Gagal memulai render" },
      { status: 400 },
    );
  }
}
