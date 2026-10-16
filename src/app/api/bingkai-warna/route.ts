// GET /api/bingkai-warna?frame=bawaan:slug|upload/xx&c1=%23rrggbb[&c2=%23rrggbb][&l=0|1]
// v0.54.0 — PRATINJAU FRAME BERWARNA (WYSIWYG dgn hasil ekspor):
// mewarnai ulang PNG frame pilihan user dgn warna solid (c1 saja) atau gradasi
// vertikal (c1+c2), TANPA mengubah bentuk — rantai filter & cache SAMA persis
// dgn jalur ekspor (siapkanBingkaiWarna). Gagal → PNG asli tetap disajikan.
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import {
  dirWork,
  jalankanFfmpeg,
  pathAman,
  pilihFfmpeg,
  probe,
} from "@/lib/vidsplit/ffmpeg";
import {
  argGradienBingkai,
  hexKeFf,
  jalurAsalBawaan,
  rantaiRecolorBingkai,
} from "@/lib/vidsplit/bingkai";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const frame = (req.nextUrl.searchParams.get("frame") || "").trim();
    const c1h = hexKeFf(req.nextUrl.searchParams.get("c1") || "");
    const c2h = hexKeFf(req.nextUrl.searchParams.get("c2") || "");
    const lanskap = req.nextUrl.searchParams.get("l") === "1";
    if (!frame || !c1h) return new NextResponse("Parameter frame & c1 wajib", { status: 400 });

    // resolve path frame (bawaan:slug / upload/xx) — sama dgn aturan ekspor
    let asal: string | null = null;
    if (frame.startsWith("bawaan:")) asal = jalurAsalBawaan(frame.slice(7), lanskap);
    else if (frame.startsWith("upload/")) {
      const p = pathAman(frame);
      asal = existsSync(p) ? p : null;
    }
    if (!asal || !existsSync(asal)) {
      return new NextResponse("Frame tidak ditemukan", { status: 404 });
    }

    // cache hasil pewarnaan — kunci sama dgn jalur ekspor (berkas+ukuran+mtime+warna)
    const { createHash } = await import("node:crypto");
    const stat = statSync(asal);
    const kunci =
      createHash("sha1")
        .update(`${path.basename(asal)}|${stat.size}|${stat.mtimeMs}|${c1h}|${c2h || ""}`)
        .digest("hex")
        .slice(0, 24) + ".png";
    const keluar = path.join(dirWork("bingkai-warna"), kunci);
    if (!existsSync(keluar)) {
      const ff = await pilihFfmpeg();
      const info = await probe(asal);
      const W = Math.max(2, Math.round(info.lebar));
      const H = Math.max(2, Math.round(info.tinggi));
      await jalankanFfmpeg(
        [
          "-y", "-hide_banner", "-v", "error",
          "-i", asal,
          "-f", "lavfi", "-i", argGradienBingkai(c1h, c2h || "", W, H),
          "-frames:v", "1",
          "-filter_complex", rantaiRecolorBingkai(),
          "-map", "[out]",
          keluar,
        ],
        0,
        undefined,
        ff.bin,
        undefined,
        { diamMs: 20_000, absolutMs: 60_000 },
      );
    }
    if (!existsSync(keluar)) {
      // gagal mewarnai → sajikan frame asli (pratinjau tetap tampil)
      return new NextResponse(readFileSync(asal), {
        headers: { "Content-Type": "image/png", "Cache-Control": "no-store" },
      });
    }
    return new NextResponse(readFileSync(keluar), {
      headers: { "Content-Type": "image/png", "Cache-Control": "no-store" },
    });
  } catch {
    return new NextResponse("Gagal mewarnai frame", { status: 500 });
  }
}
