// POST /api/export — mulai job ekspor ANTREAN
// Body: { daftar: [{ file, bg?, pengaturan? }], modeEkspor } — 1..15 video,
// diproses BERURUTAN sesuai urutan daftar. Bentuk lama { file, bg, pengaturan }
// (satu video) tetap didukung: otomatis dibungkus jadi daftar 1 item.
import { existsSync } from "node:fs";
import { NextRequest, NextResponse } from "next/server";
import { pathAman, probe } from "@/lib/vidsplit/ffmpeg";
import { mulaiEksporAntrean, type ItemEkspor } from "@/lib/vidsplit/jobs";
import {
  BATAS_VIDEO,
  durasiEfektif,
  INFO_FONT,
  pengaturanDefault,
  type NamaFont,
  type Pengaturan,
} from "@/lib/vidsplit/types";

export const runtime = "nodejs";

function clamp(n: number, min: number, max: number, fallback: number): number {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(min, v));
}

function rapikanPengaturan(raw: Partial<Pengaturan> | undefined): Pengaturan {
  const p: Pengaturan = { ...pengaturanDefault, ...(raw || {}) };
  p.mode = ["blur", "crop", "warna", "asli"].includes(p.mode) ? p.mode : "blur";
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
  p.mulaiDetik = clamp(p.mulaiDetik, 0, 86400, 0);
  p.akhirDetik = clamp(p.akhirDetik, 0, 86400, 0);
  p.codec = p.codec === "h265" ? "h265" : "h264";
  p.posisiLogo = ["kiri-atas", "kanan-atas", "kiri-bawah", "kanan-bawah"].includes(p.posisiLogo)
    ? p.posisiLogo
    : "kanan-bawah";
  p.ukuranLogo = clamp(p.ukuranLogo, 5, 40, 15);
  // v0.8.0 posisi bebas logo (persen frame, titik kiri-atas)
  p.logoX = clamp(p.logoX, 0, 100, 81.5);
  p.logoY = clamp(p.logoY, 0, 100, 88.5);
  p.logoId = typeof p.logoId === "string" ? p.logoId.slice(0, 300) : "";
  // font harus id yang dikenal — kalau tidak, pakai "tebal" (aman dari simpanan lama)
  const daftarFont = Object.keys(INFO_FONT) as NamaFont[];
  if (!daftarFont.includes(p.gayaJudul?.font)) p.gayaJudul = { ...p.gayaJudul, font: "tebal" };
  if (!daftarFont.includes(p.gayaPart?.font)) p.gayaPart = { ...p.gayaPart, font: "tebal" };
  p.prosesParalel = clamp(p.prosesParalel, 1, 4, 2);
  p.pakaiGpu = p.pakaiGpu !== false;
  return p;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      file?: string;
      bg?: string;
      logo?: string;
      pengaturan?: Partial<Pengaturan>;
      modeEkspor?: string;
      daftar?: Array<{
        file?: string;
        nama?: string;
        bg?: string;
        logo?: string;
        pengaturan?: Partial<Pengaturan>;
      }>;
    };

    // kompatibilitas lama: satu video → daftar 1 item
    const mentah =
      Array.isArray(body.daftar) && body.daftar.length
        ? body.daftar
        : [{ file: body.file, bg: body.bg, logo: body.logo, pengaturan: body.pengaturan }];

    if (!mentah.length) throw new Error("Daftar video kosong");
    if (mentah.length > BATAS_VIDEO) {
      throw new Error(`Maksimal ${BATAS_VIDEO} video dalam satu antrean`);
    }

    const modeEkspor = body.modeEkspor === "cepat" ? "cepat" : "presisi";

    // resolve & probe semua video terlebih dahulu (cepat — ffprobe hanya baca header)
    const items: ItemEkspor[] = [];
    for (let i = 0; i < mentah.length; i++) {
      const label = `Video ${i + 1}${mentah[i].file ? ` (${mentah[i].file})` : ""}`;
      if (!mentah[i].file) throw new Error(`${label}: file video wajib ada`);
      const srcAbs = pathAman(mentah[i].file as string);
      if (!existsSync(srcAbs)) throw new Error(`${label}: file video tidak ditemukan di server`);

      let bgAbs: string | null = null;
      const bg = mentah[i].bg;
      if (bg) {
        const cand = pathAman(bg);
        if (existsSync(cand)) {
          // validasi benar-benar gambar — bg korup membuat ffmpeg menggantung saat render
          try {
            const infoBg = await probe(cand);
            if (!(infoBg.lebar > 0)) throw new Error("tanpa dimensi");
          } catch {
            throw new Error(
              `${label}: background tidak bisa dibaca (pastikan PNG/JPG/WebP yang valid)`,
            );
          }
          bgAbs = cand;
        }
      }

      // logo watermark — validasi sama seperti background
      let logoAbs: string | null = null;
      const logo = mentah[i].logo;
      if (logo) {
        const cand = pathAman(logo);
        if (existsSync(cand)) {
          try {
            const infoLogo = await probe(cand);
            if (!(infoLogo.lebar > 0)) throw new Error("tanpa dimensi");
          } catch {
            throw new Error(
              `${label}: logo tidak bisa dibaca (pastikan PNG/JPG/WebP yang valid)`,
            );
          }
          logoAbs = cand;
        }
      }

      let info;
      try {
        info = await probe(srcAbs);
      } catch (e) {
        throw new Error(
          `${label}: video tidak bisa dibaca (${e instanceof Error ? e.message : String(e)})`,
        );
      }
      if (!(info.durasi > 0.5)) throw new Error(`${label}: durasi tidak terbaca / terlalu pendek`);

      const pgh = rapikanPengaturan(mentah[i].pengaturan);
      // rentang trim: clip ke durasi nyata + validasi urutan mulai < akhir
      pgh.mulaiDetik = Math.min(pgh.mulaiDetik, Math.max(0, info.durasi - 1));
      if (pgh.akhirDetik > 0) {
        pgh.akhirDetik = Math.min(pgh.akhirDetik, info.durasi);
        if (pgh.akhirDetik <= pgh.mulaiDetik + 0.4) {
          throw new Error(
            `${label}: rentang tidak valid — akhir (${pgh.akhirDetik.toFixed(1)} dtk) harus SETELAH mulai (${pgh.mulaiDetik.toFixed(1)} dtk)`,
          );
        }
      }

      items.push({
        // nama tampilan bersih (tanpa folder upload & UUID) — dipakai daftar antrean + folder ZIP
        nama:
          String(mentah[i].nama || mentah[i].file || "video")
            .split(/[\\/]/)
            .pop()!
            .replace(/\.[^.]+$/, "")
            .slice(0, 80) || "video",
        srcAbs,
        bgAbs,
        logoAbs,
        pengaturan: pgh,
        info,
      });
    }

    const totalPart = items.reduce((a, it) => {
      const efektif = durasiEfektif(it.info.durasi, it.pengaturan.mulaiDetik, it.pengaturan.akhirDetik);
      return a + Math.max(1, Math.ceil(efektif / it.pengaturan.durasiPart));
    }, 0);
    const id = mulaiEksporAntrean(items, modeEkspor);
    return NextResponse.json({ ok: true, id, total: items.length, totalPart });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Ekspor gagal dimulai" },
      { status: 400 },
    );
  }
}
