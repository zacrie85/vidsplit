// GET /api/file?p=rel[&dl=1] — sajikan file dari work (dukung Range utk seek video)
import { createReadStream, existsSync, statSync } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { NextRequest, NextResponse } from "next/server";
import { pathAman } from "@/lib/vidsplit/ffmpeg";

export const runtime = "nodejs";

const MIME: Record<string, string> = {
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mkv": "video/x-matroska",
  ".mov": "video/quicktime",
  ".ts": "video/mp2t",
  ".m2t": "video/mp2t",
  ".m2ts": "video/mp2t",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".zip": "application/zip",
  ".txt": "text/plain; charset=utf-8",
};

export async function GET(req: NextRequest) {
  try {
    const rel = req.nextUrl.searchParams.get("p");
    if (!rel) throw new Error("Parameter 'p' wajib");
    const abs = pathAman(rel);
    if (!existsSync(abs)) return new NextResponse("File tidak ditemukan", { status: 404 });
    const stat = statSync(abs);
    if (!stat.isFile()) return new NextResponse("Bukan file", { status: 400 });

    const mime = MIME[path.extname(abs).toLowerCase()] || "application/octet-stream";
    const namaFile = path.basename(abs);
    const unduh = req.nextUrl.searchParams.get("dl") === "1";
    const headers = new Headers({
      "Content-Type": mime,
      "Accept-Ranges": "bytes",
      "Cache-Control": "no-store",
      "Content-Disposition": `${unduh ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(namaFile)}`,
    });

    const range = req.headers.get("range");
    if (range) {
      const m = range.match(/bytes=(\d*)-(\d*)/);
      if (m) {
        const mulai = m[1] ? parseInt(m[1], 10) : 0;
        const akhir = m[2] ? Math.min(parseInt(m[2], 10), stat.size - 1) : stat.size - 1;
        if (mulai >= stat.size || mulai > akhir) {
          return new NextResponse(null, {
            status: 416,
            headers: { "Content-Range": `bytes */${stat.size}` },
          });
        }
        headers.set("Content-Range", `bytes ${mulai}-${akhir}/${stat.size}`);
        headers.set("Content-Length", String(akhir - mulai + 1));
        const stream = Readable.toWeb(
          createReadStream(abs, { start: mulai, end: akhir }),
        ) as unknown as ReadableStream;
        return new NextResponse(stream, { status: 206, headers });
      }
    }

    headers.set("Content-Length", String(stat.size));
    const stream = Readable.toWeb(createReadStream(abs)) as unknown as ReadableStream;
    return new NextResponse(stream, { status: 200, headers });
  } catch (e) {
    return new NextResponse(e instanceof Error ? e.message : "Gagal membaca file", { status: 400 });
  }
}
