// POST /api/gabung — v2.0.0 GABUNG VIDEO: SEMUA video di Kotak Video (urutan
// atas→bawah) menjadi SATU MP4 utuh (timestamp menyambung mulus, judul per film
// & subtitle tetap ikut, concat demuxer -c copy → RAM datar).
// Body: { daftar: [{ file, nama, pengaturan? }], modeEkspor, targetMb? }
import { existsSync } from "node:fs";
import { NextRequest, NextResponse } from "next/server";
import { siapkanBingkai } from "@/lib/vidsplit/bingkai";
import { pathAman, probe } from "@/lib/vidsplit/ffmpeg";
import { mulaiGabungAntrean, type ItemEkspor } from "@/lib/vidsplit/jobs";
import {
  BATAS_VIDEO,
  INFO_FONT,
  neonDari,
  pengaturanDefault,
  rapikanThumbnail,
  templatDari,
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
  const daftarFont = Object.keys(INFO_FONT) as NamaFont[];
  p.mode = ["blur", "crop", "warna", "asli", "template"].includes(p.mode) ? p.mode : "blur";
  p.resolusi = p.resolusi === "720" ? "720" : "1080";
  if (!["auto", "720p", "1080p", "2k", "4k"].includes(p.resolusiOutput)) p.resolusiOutput = "auto";
  if (!["mati", "geser", "fade", "langsung"].includes(p.zoomPembicara)) p.zoomPembicara = "mati";
  if (!["cepat", "normal", "lambat"].includes(p.lajuPindah)) p.lajuPindah = "normal";
  p.senyapPembicara = p.senyapPembicara === "semua" ? "semua" : "tetap";
  p.backsoundAktif = p.backsoundAktif === true;
  p.backsoundFile = typeof p.backsoundFile === "string" ? p.backsoundFile.slice(0, 500) : "";
  p.backsoundVolume = clamp(p.backsoundVolume, 0, 150, 80);
  // v2.1.0 — UPGRADE BACKGROUND INTRO · v2.2.0 — frame dari video (ganti total);
  // GABUNG VIDEO TANPA intro (permintaan user) — field tetap dirapikan agar
  // pengaturan konsisten bila nanti video ikut diekspor terpisah.
  p.introAktif = p.introAktif === true;
  p.introPosisi = clamp(p.introPosisi, 0, 100, 35);
  if (!["mati", "zoom-masuk", "zoom-keluar", "geser-kiri", "geser-kanan"].includes(p.introAnimasi))
    p.introAnimasi = "zoom-masuk";
  p.introFade = p.introFade !== false;
  if (!daftarFont.includes(p.introTeksFont)) p.introTeksFont = "anton";
  p.introTeksUkuran = clamp(p.introTeksUkuran, 20, 160, 64);
  p.introTeksWarna = /^#[0-9a-fA-F]{6}$/.test(p.introTeksWarna || "") ? (p.introTeksWarna as string) : "#ffffff";
  if (!["semua", "pertama", "pertama-terakhir"].includes(p.introTampil)) p.introTampil = "semua";
  p.introSuaraFile = typeof p.introSuaraFile === "string" ? p.introSuaraFile.slice(0, 500) : "";
  p.introSuaraVolume = clamp(p.introSuaraVolume, 0, 150, 100);
  p.durasiIntro = clamp(p.durasiIntro, 1, 10, 2);
  p.judul = String(p.judul || "").slice(0, 300);
  p.warnaLatar = /^#[0-9a-fA-F]{6,8}$/.test(p.warnaLatar) ? p.warnaLatar : "#111827";
  p.gayaJudul.ukuran = clamp(p.gayaJudul?.ukuran, 20, 160, 64);
  p.gayaJudul.outlineLebar = clamp(p.gayaJudul?.outlineLebar, 0, 12, 4);
  p.posisiTeks = ["atas", "tengah", "bawah"].includes(p.posisiTeks) ? p.posisiTeks : "atas";
  if (!daftarFont.includes(p.gayaJudul?.font)) p.gayaJudul = { ...p.gayaJudul, font: "tebal" };
  if (!daftarFont.includes(p.gayaPart?.font)) p.gayaPart = { ...p.gayaPart, font: "tebal" };
  p.logoId = typeof p.logoId === "string" ? p.logoId.slice(0, 300) : "";
  p.ukuranLogo = clamp(p.ukuranLogo, 5, 40, 15);
  p.logoX = clamp(p.logoX, 0, 100, 81.5);
  p.logoY = clamp(p.logoY, 0, 100, 88.5);
  p.codec = p.codec === "h265" ? "h265" : "h264";
  p.frameId = typeof p.frameId === "string" ? p.frameId.slice(0, 300) : "";
  const neon = neonDari(p);
  p.neonAktif = neon.aktif;
  p.neonWarna = neon.warna;
  p.neonTebal = neon.tebal;
  p.neonKecepatan = neon.kecepatan;
  p.neonDuaGaris = neon.duaGaris;
  const templat = templatDari(p);
  p.templateGrad1 = templat.grad1;
  p.templateGrad2 = templat.grad2;
  p.subtitleAktif = p.subtitleAktif === true;
  p.subtitleUkuran = clamp(p.subtitleUkuran, 10, 80, 26);
  p.subtitleY = clamp(p.subtitleY, 30, 100, 88);
  p.subtitleDeteksiBahasa = p.subtitleDeteksiBahasa === true;
  p.subtitleCepat = p.subtitleCepat === true;
  return p;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      daftar?: Array<{
        file?: string;
        nama?: string;
        logo?: string;
        pengaturan?: Partial<Pengaturan>;
      }>;
      modeEkspor?: string;
      targetMb?: number;
      /** v2.1.0 — THUMBNAIL OTOMATIS */
      thumbnail?: { aktif?: boolean; kata?: string; format?: string };
    };

    const mentah = Array.isArray(body.daftar) ? body.daftar : [];
    if (mentah.length < 2) {
      throw new Error("GABUNG VIDEO butuh minimal 2 video di Kotak Video");
    }
    if (mentah.length > BATAS_VIDEO) {
      throw new Error(`Maksimal ${BATAS_VIDEO} video dalam satu antrean`);
    }

    const modeEkspor = body.modeEkspor === "cepat" ? "cepat" : "presisi";
    const targetMb = Math.min(100_000, Math.max(0, Number(body.targetMb) || 0));

    const items: ItemEkspor[] = [];
    for (let i = 0; i < mentah.length; i++) {
      const label = `Video ${i + 1}${mentah[i].file ? ` (${mentah[i].file})` : ""}`;
      if (!mentah[i].file) throw new Error(`${label}: file video wajib ada`);
      const srcAbs = pathAman(mentah[i].file as string);
      if (!existsSync(srcAbs)) throw new Error(`${label}: file video tidak ditemukan di server`);

      // v2.2.0 — bg unggahan dihapus (GABUNG tanpa intro).
      // logo watermark — validasi benar-benar gambar (logo korup membuat ffmpeg
      // menggantung saat render)
      let logoAbs: string | null = null;
      const logo = mentah[i].logo;
      if (logo) {
        const cand = pathAman(logo);
        if (existsSync(cand)) {
          try {
            const infoLogo = await probe(cand);
            if (!(infoLogo.lebar > 0)) throw new Error("tanpa dimensi");
          } catch {
            throw new Error(`${label}: logo tidak bisa dibaca (pastikan PNG/JPG/WebP yang valid)`);
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
      if (targetMb > 0) (pgh as Pengaturan & { targetMb?: number }).targetMb = targetMb;
      pgh.mulaiDetik = Math.min(pgh.mulaiDetik, Math.max(0, info.durasi - 1));
      if (pgh.akhirDetik > 0) {
        pgh.akhirDetik = Math.min(pgh.akhirDetik, info.durasi);
        if (pgh.akhirDetik <= pgh.mulaiDetik + 0.4) {
          throw new Error(
            `${label}: rentang tidak valid — akhir (${pgh.akhirDetik.toFixed(1)} dtk) harus SETELAH mulai (${pgh.mulaiDetik.toFixed(1)} dtk)`,
          );
        }
      }

      const frameAbs = pgh.frameId.startsWith("bawaan:") ? null : siapkanBingkai(pgh.frameId);

      items.push({
        nama:
          String(mentah[i].nama || mentah[i].file || "video")
            .split(/[\\/]/)
            .pop()!
            .replace(/\.[^.]+$/, "")
            .slice(0, 80) || "video",
        srcAbs,
        logoAbs,
        frameAbs,
        pengaturan: pgh,
        info,
      });
    }

    const id = mulaiGabungAntrean(items, modeEkspor, rapikanThumbnail(body.thumbnail));
    return NextResponse.json({ ok: true, id, total: items.length });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "GABUNG VIDEO gagal dimulai" },
      { status: 400 },
    );
  }
}
