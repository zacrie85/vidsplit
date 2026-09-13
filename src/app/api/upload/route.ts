// POST /api/upload?kind=video|bg|logo|audio&nama=file.mp4 — body raw = isi file (streaming)
// v0.10.0: kind "audio" untuk Studio Musik (mp3/wav/m4a/ogg/flac, maks 500 MB)
import { randomBytes } from "node:crypto";
import { createWriteStream } from "node:fs";
import { unlinkSync } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { NextRequest, NextResponse } from "next/server";
import { dirWork } from "@/lib/vidsplit/ffmpeg";

export const runtime = "nodejs";

const BATAS: Record<"video" | "bg" | "logo" | "audio", number> = {
  video: 20 * 1024 * 1024 * 1024, // 20 GB
  bg: 25 * 1024 * 1024, // 25 MB
  logo: 25 * 1024 * 1024, // 25 MB
  audio: 500 * 1024 * 1024, // 500 MB — v0.10.0 Studio Musik
};

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
  const batas = BATAS[kind];
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
              audio: "Musik melebihi batas 500 MB",
              bg: "Background melebihi batas 25 MB",
            };
            throw new Error(pesan[kind]);
          }
          yield chunk;
        }
      },
      ws,
    );
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
