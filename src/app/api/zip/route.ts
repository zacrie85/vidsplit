// GET /api/zip?id=<jobId> — ZIP semua hasil antrean, dirakit DI SERVER secara STREAMING.
// Alasan: versi lama merakit ZIP di browser (semua file dimuat ke memori + diduplikasi
// zipSync) — dengan 15 video memori browser habis → "Array buffer allocation failed".
// Kini fflate Zip (STORE, tanpa kompresi — MP4 memang tak bisa dikompres) mengalirkan
// data langsung ke respons HTTP, hanya satu file di memori pada satu waktu.
import { createReadStream, existsSync } from "node:fs";
import path from "node:path";
import { Zip, ZipPassThrough } from "fflate";
import { NextRequest, NextResponse } from "next/server";
import { pathAman } from "@/lib/vidsplit/ffmpeg";
import { ambilJob } from "@/lib/vidsplit/jobs";
import { ambilRiwayat } from "@/lib/vidsplit/riwayat";
import { slugify } from "@/lib/vidsplit/types";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id") || "";
  const job = ambilJob(id);
  // job lama tidak lagi ada di memori → coba riwayat ekspor (persisten di disk)
  const lama = job ? null : ambilRiwayat(id);
  const antrean = job?.antrean ?? lama?.antrean ?? null;
  const outputsMentah = job?.outputs ?? lama?.outputs ?? null;
  if (!antrean || !outputsMentah) {
    return new NextResponse("Riwayat tidak ditemukan — silakan ekspor ulang", { status: 404 });
  }
  const paralel = job?.paralel ?? lama?.paralel ?? 1;
  const akselerasi = job?.akselerasi ?? lama?.akselerasi ?? "ffmpeg";

  // file hasil bisa saja sudah dibuang manual — saring yang benar-benar ada
  const folderAbs = pathAman(`output/${id}`);
  const outputs = outputsMentah.filter((o) => existsSync(path.join(folderAbs, o.file)));
  if (!outputs.length) {
    return new NextResponse("File hasil sudah tidak ada di folder kerja", { status: 400 });
  }

  // folder per video — nama unik berurutan bila ada nama sumber kembar
  const mapFolder = new Map<string, string>();
  antrean.forEach((v, i) => {
    mapFolder.set(v.nama, `${String(i + 1).padStart(2, "0")}-${slugify(v.nama)}`);
  });
  const namaZip = `vidsplit-antrean-${antrean.length}video.zip`;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let tertutup = false;
      const alir = (e: Error | null, data?: Uint8Array, final?: boolean) => {
        if (tertutup) return;
        try {
          if (e) {
            tertutup = true;
            controller.error(e);
            return;
          }
          if (data && data.length) controller.enqueue(data);
          if (final) {
            tertutup = true;
            controller.close();
          }
        } catch {
          tertutup = true;
        }
      };

      const zip = new Zip(alir);

      const tambahTeks = async (nama: string, isi: string) => {
        const zp = new ZipPassThrough(nama);
        zip.add(zp);
        zp.push(new TextEncoder().encode(isi));
        zp.push(new Uint8Array(0), true);
      };

      const tambahFile = async (nama: string, abs: string) => {
        if (!existsSync(abs)) return; // lewati bila file sudah tidak ada
        const zp = new ZipPassThrough(nama);
        zip.add(zp);
        const rs = createReadStream(abs, { highWaterMark: 1 << 20 });
        for await (const c of rs) {
          zp.push(new Uint8Array(c as Buffer));
        }
        zp.push(new Uint8Array(0), true);
      };

      (async () => {
        await tambahTeks(
          "BACA-SAYA.txt",
          [
            "VidSplit — hasil split antrean",
            `Video: ${antrean.length}, diproses berurutan dari atas`,
            `Paralel: ${paralel} part serentak · Encoder: ${akselerasi}`,
            "",
            "Isi (folder per video):",
            ...antrean.map((v) => `- ${mapFolder.get(v.nama)} (${v.selesai}/${v.total} part)`),
          ].join("\n"),
        );
        for (const o of outputs) {
          const folder = mapFolder.get(o.video) ?? "video";
          await tambahFile(`${folder}/${o.file}`, path.join(folderAbs, o.file));
        }
        zip.end();
      })().catch((e) => alir(e instanceof Error ? e : new Error(String(e))));
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${namaZip}"`,
      "Cache-Control": "no-store",
    },
  });
}
