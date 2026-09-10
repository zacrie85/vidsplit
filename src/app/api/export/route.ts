// POST /api/export { file, bg?, pengaturan, modeEkspor } — mulai job ekspor
import { existsSync } from "node:fs";
import { NextRequest, NextResponse } from "next/server";
import { pathAman, probe } from "@/lib/vidsplit/ffmpeg";
import { mulaiEkspor } from "@/lib/vidsplit/jobs";
import { pengaturanDefault, type Pengaturan } from "@/lib/vidsplit/types";

export const runtime = "nodejs";

function clamp(n: number, min: number, max: number, fallback: number): number {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(min, v));
}

function rapikanPengaturan(raw: Partial<Pengaturan> | undefined): Pengaturan {
  const p: Pengaturan = { ...pengaturanDefault, ...(raw || {}) };
  p.mode = ["blur", "crop", "warna"].includes(p.mode) ? p.mode : "blur";
  p.resolusi = p.resolusi === "720" ? "720" : "1080";
  p.posisiTeks = ["atas", "tengah", "bawah"].includes(p.posisiTeks) ? p.posisiTeks : "atas";
  p.durasiPart = clamp(p.durasiPart, 5, 3600, 20);
  p.durasiIntro = clamp(p.durasiIntro, 1, 10, 3);
  p.judul = String(p.judul || "").slice(0, 300);
  p.kataPart = String(p.kataPart || "Part").slice(0, 30);
  p.warnaLatar = /^#[0-9a-fA-F]{6,8}$/.test(p.warnaLatar) ? p.warnaLatar : "#111827";
  p.gayaJudul.ukuran = clamp(p.gayaJudul?.ukuran, 20, 160, 64);
  p.gayaJudul.outlineLebar = clamp(p.gayaJudul?.outlineLebar, 0, 12, 4);
  p.gayaPart.ukuran = clamp(p.gayaPart?.ukuran, 16, 120, 48);
  p.gayaPart.outlineLebar = clamp(p.gayaPart?.outlineLebar, 0, 12, 3);
  p.posisiPotong = clamp(p.posisiPotong, 0, 100, 50);
  p.prosesParalel = clamp(p.prosesParalel, 1, 4, 2);
  p.pakaiGpu = p.pakaiGpu !== false;
  return p;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      file?: string;
      bg?: string;
      pengaturan?: Partial<Pengaturan>;
      modeEkspor?: string;
    };
    if (!body.file) throw new Error("File video wajib ada");
    const srcAbs = pathAman(body.file);
    if (!existsSync(srcAbs)) throw new Error("File video tidak ditemukan di server");

    let bgAbs: string | null = null;
    if (body.bg) {
      const cand = pathAman(body.bg);
      if (existsSync(cand)) bgAbs = cand;
    }

    const info = await probe(srcAbs);
    if (!(info.durasi > 0.5)) throw new Error("Durasi video tidak terbaca / terlalu pendek");

    const pengaturan = rapikanPengaturan(body.pengaturan);
    const modeEkspor = body.modeEkspor === "cepat" ? "cepat" : "presisi";

    const id = mulaiEkspor({ srcAbs, bgAbs, pengaturan, info, modeEkspor });
    return NextResponse.json({ ok: true, id, total: Math.ceil(info.durasi / pengaturan.durasiPart) });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Ekspor gagal dimulai" },
      { status: 400 },
    );
  }
}
