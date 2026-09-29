// POST /api/subtitle-preview — v0.45.0 PRATINJAU SUBTITLE AI
// Permintaan user: "kawan ini tidak ada priview nya ya apakah subtitle nya ada
// atau tidak" — sebelumnya subtitle AI baru terlihat setelah ekspor selesai.
// API ini menganalisis suara video (CACHE SAMA dengan ekspor — tidak dihitung
// ulang saat ekspor), lalu merender KEPING ±15 detik pertama video dengan
// subtitle yang SUDAH TERBAKAR (ukuran & posisi persis setelan ekspor), plus
// daftar teks ter-transkrip supaya user yakin subtitle ADA sebelum ekspor.
//
// Body : { file: "upload/xxx.mp4", pengaturan: Partial<Pengaturan> }
// Return: { ok, klip?, segmen?, bahasa?, diterjemahkan?, jumlahSegmen?,
//           durasiKlip?, alasan?: "audio"|"model"|"gagal", pesan? }
import { existsSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import {
  dirFontsSub,
  dirWork,
  escapePathFilter,
  jalankanFfmpeg,
  pathAman,
  probe,
  pilihFfmpeg,
} from "@/lib/vidsplit/ffmpeg";
import {
  DURASI_PRATINJAU_SUB,
  MAKS_BARIS_TAMPIL,
  dimensiPratinjau,
  potongSegmenTampil,
} from "@/lib/vidsplit/pratinjauSub";
import {
  bangunAssSubtitle,
  kunciCache,
  modelTersedia,
  siapkanSegmenSubtitle,
} from "@/lib/vidsplit/subtitle";
import { pengaturanDefault, type Pengaturan } from "@/lib/vidsplit/types";

export const runtime = "nodejs";

/** Penjaga ganda: pratinjau identik yang sedang berjalan tidak diulang —
 *  permintaan kedua menunggu hasil yang sama (hemat CPU AI). */
const berjalan = new Map<string, Promise<Record<string, unknown>>>();

function clamp(n: unknown, min: number, max: number, fallback: number): number {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(min, v));
}

/** Hanya field yang mempengaruhi pratinjau yang dirapikan — sisanya default. */
function rapikanPengaturan(raw: Partial<Pengaturan> | undefined): Pengaturan {
  const p: Pengaturan = { ...pengaturanDefault, ...(raw || {}) };
  p.mode = ["blur", "crop", "warna", "asli"].includes(p.mode) ? p.mode : "blur";
  p.mulaiDetik = clamp(p.mulaiDetik, 0, 86400, 0);
  p.akhirDetik = clamp(p.akhirDetik, 0, 86400, 0);
  p.subtitleUkuran = clamp(p.subtitleUkuran, 10, 80, 26);
  p.subtitleY = clamp(p.subtitleY, 30, 100, 88);
  return p;
}

async function kerjakan(
  fileRel: string,
  pengaturan: Pengaturan,
): Promise<Record<string, unknown>> {
  const srcAbs = pathAman(fileRel);
  if (!existsSync(srcAbs)) {
    return { ok: false, alasan: "gagal", pesan: "File video tidak ditemukan di server" };
  }
  if (!modelTersedia()) {
    return {
      ok: false,
      alasan: "model",
      pesan:
        "Mesin subtitle AI tidak ditemukan di aplikasi ini. Gunakan VidSplit v0.44.0 atau yang lebih baru.",
    };
  }
  const info = await probe(srcAbs);
  if (!info.adaAudio) {
    return {
      ok: false,
      alasan: "audio",
      pesan: "Video ini tidak punya suara — tidak ada yang bisa dibuat subtitle.",
    };
  }

  const ff = await pilihFfmpeg();
  const mulaiTrim = pengaturan.mulaiDetik;
  const akhirTrim = pengaturan.akhirDetik;

  // 1) Analisis suara PENUH — CACHE SAMA dengan ekspor (kunci = file|ukuran|mtime|trim),
  //    jadi pratinjau sekali → ekspor nanti tidak menghitung ulang AI.
  const hasil = await siapkanSegmenSubtitle(srcAbs, mulaiTrim, akhirTrim, info.durasi, ff.bin);
  if (!hasil) return { ok: false, alasan: "model", pesan: "Mesin subtitle AI tidak bisa dimuat." };
  if (!hasil.segmen.length) {
    return {
      ok: false,
      alasan: "gagal",
      pesan:
        "Tidak ada ucapan yang terdeteksi di video ini (mungkin hanya musik/keheningan).",
    };
  }

  // 2) Keping pratinjau: jendela [0, durasiKlip] pada rentang trim, proporsi = hasil
  //    ekspor (9:16 utk mode frame, rasio asli utk mode "asli") — libass menskala
  //    font dgn sisi terpendek sehingga ukuran & posisi teks SAMA dengan ekspor.
  const durasiEfektif = Math.max(
    1,
    (akhirTrim > 0 ? Math.min(akhirTrim, info.durasi) : info.durasi) - mulaiTrim,
  );
  const durasiKlip = Math.min(DURASI_PRATINJAU_SUB, durasiEfektif);
  const { W, H } = dimensiPratinjau(pengaturan.mode, info.lebar, info.tinggi);
  const ass = bangunAssSubtitle({
    segmen: hasil.segmen,
    mulaiPartRel: 0, // keping mulai tepat di awal rentang trim
    durasiPart: durasiKlip,
    offsetIntro: 0, // pratinjau tanpa background intro
    W,
    H,
    ukuran: pengaturan.subtitleUkuran,
    yPersen: pengaturan.subtitleY,
  });
  if (!ass) {
    return {
      ok: false,
      alasan: "gagal",
      pesan:
        "Tidak ada subtitle pada 15 detik pertama — coba ekspor langsung, teks akan muncul mengikuti suara di seluruh video.",
    };
  }

  // 3) Render keping (cache hasil render: hash file+trim+setelan → pratinjau ke-2 instan)
  let stat: { size: number; mtimeMs: number } = { size: 0, mtimeMs: 0 };
  try {
    stat = statSync(srcAbs) as unknown as { size: number; mtimeMs: number };
  } catch {
    /* sudah dicek exists di atas */
  }
  const kunci = `${kunciCache(srcAbs, stat.size, stat.mtimeMs, mulaiTrim, akhirTrim)}-u${pengaturan.subtitleUkuran}-y${pengaturan.subtitleY}`;
  const namaKlip = `${kunci}.mp4`;
  const keluar = path.join(dirWork("pratinjau-sub"), namaKlip);
  if (!existsSync(keluar)) {
    const fileAss = path.join(dirWork("tmp"), `pratinjau-${kunci}.ass`);
    writeFileSync(fileAss, ass, "utf8");
    try {
      await jalankanFfmpeg(
        [
          "-y", "-hide_banner", "-v", "error",
          "-ss", mulaiTrim.toFixed(3),
          "-i", srcAbs,
          "-t", durasiKlip.toFixed(3),
          "-vf",
          `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},` +
            `subtitles=filename='${escapePathFilter(fileAss)}':fontsdir='${escapePathFilter(dirFontsSub())}',format=yuv420p`,
          "-c:v", "libx264", "-preset", "ultrafast", "-crf", "26",
          "-c:a", "aac", "-b:a", "96k", "-ar", "44100",
          "-movflags", "+faststart",
          keluar,
        ],
        durasiKlip,
        undefined,
        ff.bin,
      );
    } finally {
      try {
        unlinkSync(fileAss);
      } catch {
        /* abaikan */
      }
    }
  }
  if (!existsSync(keluar)) {
    return { ok: false, alasan: "gagal", pesan: "Gagal merender keping pratinjau." };
  }

  return {
    ok: true,
    klip: `pratinjau-sub/${namaKlip}`,
    durasiKlip,
    bahasa: hasil.bahasa,
    diterjemahkan: hasil.diterjemahkan,
    jumlahSegmen: hasil.segmen.length,
    segmen: potongSegmenTampil(hasil.segmen, MAKS_BARIS_TAMPIL),
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { file?: string; pengaturan?: Partial<Pengaturan> };
    if (!body.file) throw new Error("Parameter 'file' wajib");
    const pengaturan = rapikanPengaturan(body.pengaturan);
    const kunci = `${body.file}|${pengaturan.subtitleUkuran}|${pengaturan.subtitleY}|${pengaturan.mulaiDetik}|${pengaturan.akhirDetik}|${pengaturan.mode}`;
    let janji = berjalan.get(kunci);
    if (!janji) {
      janji = kerjakan(body.file, pengaturan).finally(() => berjalan.delete(kunci));
      berjalan.set(kunci, janji);
    }
    const hasil = await janji;
    return NextResponse.json(hasil);
  } catch (e) {
    return NextResponse.json(
      { ok: false, alasan: "gagal", pesan: e instanceof Error ? e.message : String(e) },
      { status: 200 },
    );
  }
}
