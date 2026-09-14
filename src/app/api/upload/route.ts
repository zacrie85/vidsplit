// POST /api/upload?kind=video|bg|logo|audio&nama=file.mp4 — body raw = isi file (streaming)
// v0.10.0: kind "audio" untuk Studio Musik (mp3/wav/m4a/ogg/flac, maks 500 MB)
// v0.18.0: kind "audio" menerima VIDEO (mp4/mkv/webm/mov/m4v/avi, maks 2 GB) —
//          trek audionya diekstrak otomatis jadi FLAC lossless, video sementara dibuang,
//          sehingga analisis/proses/render Studio Musik bekerja apa adanya di berkas FLAC.
import { randomBytes } from "node:crypto";
import { createWriteStream, existsSync, statSync, unlinkSync } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { NextRequest, NextResponse } from "next/server";
import { dirWork, jalankanFfmpeg, pilihFfmpeg } from "@/lib/vidsplit/ffmpeg";
import { adalahVideoMusik } from "@/lib/vidsplit/musik";

export const runtime = "nodejs";

const BATAS: Record<"video" | "bg" | "logo" | "audio", number> = {
  video: 20 * 1024 * 1024 * 1024, // 20 GB
  bg: 25 * 1024 * 1024, // 25 MB
  logo: 25 * 1024 * 1024, // 25 MB
  audio: 500 * 1024 * 1024, // 500 MB — v0.10.0 Studio Musik
};
const BATAS_AUDIO_VIDEO = 2 * 1024 * 1024 * 1024; // v0.18.0 — sumber video utk Mode Musik

/** Ekstrak trek audio pertama dari file video → FLAC lossless. Melempar error jika
 * video tidak punya trek audio / tidak bisa dibaca. Hapus file video sumber setelah sukses. */
async function ekstrakAudioVideo(
  bin: string, videoAbs: string, flacAbs: string,
): Promise<void> {
  try {
    await jalankanFfmpeg([
      "-y", "-hide_banner", "-v", "error",
      "-i", videoAbs,
      "-vn",              // buang semua video
      "-map", "0:a:0",    // trek audio pertama saja
      "-c:a", "flac", "-compression_level", "5",
      flacAbs,
    ], 0, undefined, bin);
  } catch (e) {
    throw new Error(
      `Tidak bisa mengekstrak audio dari video (pastikan file punya trek audio & tidak rusak): ${
        e instanceof Error ? e.message : String(e)
      }`,
    );
  }
  if (!existsSync(flacAbs) || statSync(flacAbs).size < 1024) {
    throw new Error("Trek audio dari video kosong / tidak terbaca");
  }
  try { unlinkSync(videoAbs); } catch { /* abaikan */ }
}

export async function POST(req: NextRequest) {
  const jenisRaw = req.nextUrl.searchParams.get("kind") || "";
  const kind: "video" | "bg" | "logo" | "audio" =
    jenisRaw === "bg" ? "bg"
      : jenisRaw === "logo" ? "logo"
        : jenisRaw === "audio" ? "audio"
          : "video";
  const namaMentah = req.nextUrl.searchParams.get("nama") || "";
  const nama = (
    namaMentah.replace(/[^\p{L}\p{N}._-]+/gu, "_").slice(-80) ||
    (kind === "video" ? "video.mp4"
      : kind === "logo" ? "logo.png"
        : kind === "audio" ? "musik.mp3"
          : "bg.png")
  ).replace(/^\.+/, "_");
  // v0.18.0 — sumber video utk Mode Musik: batas lebih longgar (2 GB), audio diekstrak nanti
  const sumberVideo = kind === "audio" && adalahVideoMusik(nama);
  const batas = kind === "audio" && sumberVideo ? BATAS_AUDIO_VIDEO : BATAS[kind];
  const dir = dirWork("upload");
  const namaFile = `${randomBytes(4).toString("hex")}-${nama}`;
  const tujuan = path.join(dir, namaFile);
  const ws = createWriteStream(tujuan);
  let ukuran = 0;
  try {
    if (!req.body) throw new Error("Body kosong");
    const sumber = Readable.fromWeb(req.body as Parameters<typeof Readable.fromWeb>[0]);
    await pipeline(
      sumber,
      async function* (src) {
        for await (const chunk of src) {
          ukuran += chunk.length;
          if (ukuran > batas) {
            const pesan: Record<typeof kind, string> = {
              video: "Video melebihi batas 20 GB",
              logo: "Logo melebihi batas 25 MB",
              audio: sumberVideo
                ? "Video musik melebihi batas 2 GB"
                : "Musik melebihi batas 500 MB",
              bg: "Background melebihi batas 25 MB",
            };
            throw new Error(pesan[kind]);
          }
          yield chunk;
        }
      },
      ws,
    );

    // v0.18.0 — file video diunggah ke Studio Musik: ekstrak audionya jadi FLAC lossless
    if (sumberVideo) {
      try {
        const ff = await pilihFfmpeg();
        const dasar = nama.replace(/\.[^.]+$/, "");
        const namaFlac = `${path.basename(namaFile).replace(/\.[^.]+$/, "")}.flac`;
        const flacAbs = path.join(dir, namaFlac);
        await ekstrakAudioVideo(ff.bin, tujuan, flacAbs);
        const ukuranFlac = statSync(flacAbs).size;
        return NextResponse.json({
          ok: true,
          file: `upload/${namaFlac}`,
          nama: `${dasar}.flac`,
          ukuran: ukuranFlac,
          ekstrakDariVideo: true,
          sumberAsli: nama,
        });
      } catch (e) {
        try { if (existsSync(tujuan)) unlinkSync(tujuan); } catch { /* abaikan */ }
        return NextResponse.json(
          { ok: false, error: e instanceof Error ? e.message : "Ekstraksi audio video gagal" },
          { status: 400 },
        );
      }
    }

    return NextResponse.json({
      ok: true,
      file: `upload/${namaFile}`,
      nama,
      ukuran,
    });
  } catch (e) {
    try {
      ws.destroy();
      unlinkSync(tujuan);
    } catch {
      /* abaikan */
    }
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Upload gagal" },
      { status: 400 },
    );
  }
}
