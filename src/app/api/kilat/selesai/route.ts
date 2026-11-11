// POST /api/kilat/selesai — finalisasi ekspor MESIN KILAT (WebCodecs renderer)
// v2.9.0 — dipanggil renderer SETELAH semua part terunggah: server menghasilkan
// thumbnail otomatis dari SUMBER (mesin-independent — argumen sama dgn jalur
// ffmpeg), menyalin hasil ke folder tujuan bila simpan otomatis aktif, dan
// mencatat Riwayat sehingga hasil kilat terlihat persis seperti hasil render.
import { writeFileSync } from "node:fs";
import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { dirWork, fontfileNama, jalankanFfmpeg, pathAman, pilihFfmpeg } from "@/lib/vidsplit/ffmpeg";
import { bungkusTeks } from "@/lib/vidsplit/bungkus";
import {
  bangunArgumenFrameSumber,
  bangunArgumenThumbnail,
  bersihkanNamaJudul,
  detikFrameThumbnail,
  GAYA_COVER,
  labelThumbnail,
} from "@/lib/vidsplit/thumbnail";
import { muatSetelanTujuan, salinHasilKeTujuan } from "@/lib/vidsplit/tujuan";
import { catatRiwayat } from "@/lib/vidsplit/riwayat";
import type { InfoJob, KeluaranJob, StatusVideoAntrean } from "@/lib/vidsplit/jobs";
import type { ModeThumbnail, Pengaturan } from "@/lib/vidsplit/types";
import { slugify } from "@/lib/vidsplit/types";

export const runtime = "nodejs";

interface Body {
  idKilat?: string;
  hasil?: { file: string; nama: string; ukuran: number }[];
  nama?: string;
  pengaturan?: Partial<Pengaturan>;
  durasi?: number;
  lebar?: number;
  tinggi?: number;
  thumbnail?: { aktif: boolean; kata: "Part" | "Bagian" | "Episode"; format: "jpg" | "png"; mode: ModeThumbnail; gaya: "modern" | "klasik" | "futuristik" } | null;
  folderTujuan?: string | null;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;
    const id = String(body.idKilat || "");
    if (!/^[a-zA-Z0-9_-]{6,64}$/.test(id))
      return NextResponse.json({ ok: false, error: "ID tidak sah" }, { status: 400 });
    const hasil = (body.hasil || []).filter((h) => h && typeof h.file === "string");
    if (!hasil.length)
      return NextResponse.json({ ok: false, error: "Tidak ada hasil" }, { status: 400 });
    const nama = String(body.nama || "Video");
    const p = { ...(body.pengaturan || {}) } as Pengaturan;
    const folder = dirWork(`output/${id}`);
    const outputs: KeluaranJob[] = hasil.map((h) => {
      const penuh = path.join(folder, path.basename(h.nama));
      return { video: nama, file: path.basename(h.nama), ukuran: existsSync(penuh) ? statSync(penuh).size : h.ukuran || 0 };
    });

    /* ---------- thumbnail otomatis dari SUMBER (sama dgn jalur ffmpeg) ---------- */
    const thumb = body.thumbnail;
    const peringatan: string[] = [];
    if (thumb?.aktif) {
      const { bin } = await pilihFfmpeg();
      const srcAbs = pathAman(String((body as { sumber?: string }).sumber || ""));
      if (existsSync(srcAbs)) {
        const gy = GAYA_COVER[thumb.gaya] ?? GAYA_COVER.modern;
        const slug = slugify(p.judul) || "vidsplit";
        const durasi = Number(body.durasi) || 0;
        for (let n = 1; n <= hasil.length; n++) {
          const fileJ = path.join(dirWork("tmp"), `${id}-thumb-${n}-j.txt`);
          const fileL = path.join(dirWork("tmp"), `${id}-thumb-${n}-l.txt`);
          try {
            /* posisi frame: bagian tengah part ke-n (paritas detikFrameThumbnail) */
            const bagian = durasi / hasil.length;
            const m = (n - 1) * bagian;
            const d = bagian;
            const teksJ = bungkusTeks(
              bersihkanNamaJudul(nama),
              1080 * 0.92,
              52,
              gy.fontJudul as unknown as Parameters<typeof bungkusTeks>[3],
            );
            const lbl = thumb.mode === "identik" ? "" : labelThumbnail(thumb, n);
            writeFileSync(fileJ, teksJ, "utf8");
            writeFileSync(fileL, lbl, "utf8");
            const ekst = thumb.format === "png" ? "png" : "jpg";
            const keluarT = path.join(folder, `${slug}-part-${String(n).padStart(2, "0")}-thumbnail.${ekst}`);
            const argsT = bangunArgumenThumbnail({
              src: srcAbs,
              detik: detikFrameThumbnail(m, d, durasi),
              judulTxt: teksJ,
              labelTxt: lbl,
              W: Number(body.lebar) || 1080,
              H: Number(body.tinggi) || 1920,
              fileJudul: fileJ,
              fileLabel: fileL,
              ukuranJudul: 52,
              ukuranLabel: 74,
              fontfile: fontfileNama(gy.fontJudul),
              fontLabel: fontfileNama(gy.fontLabel),
              gaya: thumb.gaya,
              keluar: keluarT,
              format: thumb.format,
            });
            await jalankanFfmpeg(argsT, 1, undefined, bin);
            if (existsSync(keluarT))
              outputs.push({ video: nama, file: path.basename(keluarT), ukuran: statSync(keluarT).size });
          } catch (e) {
            peringatan.push(`thumbnail part ${n} gagal: ${e instanceof Error ? e.message : "?"}`);
          }
        }
      } else {
        peringatan.push("sumber tidak ditemukan — thumbnail dilewati");
      }
    }

    /* ---------- antrean riwayat + folder tujuan ---------- */
    const antrean: StatusVideoAntrean[] = [
      { nama, total: hasil.length, selesai: hasil.length, status: "selesai", mesin: "KILAT GPU" },
    ];
    const job: InfoJob = {
      id,
      antrean,
      videoAktif: -1,
      partAktif: 0,
      progresPart: 100,
      progresTotal: 100,
      outputs,
      error: null,
      adaGagal: false,
      selesaiSemua: true,
      batalDiminta: false,
      dibatalkan: false,
      dibuat: Date.now(),
      akselerasi: "KILAT GPU (WebCodecs)",
      paralel: 2,
      peringatanSubtitle: peringatan.length ? peringatan.join("; ") : null,
    };
    let folderTersimpan: string | null = null;
    let peringatanSalin: string | null = null;
    const setelan = muatSetelanTujuan();
    const tujuan = body.folderTujuan || setelan.otomatis ? setelan.folder : null;
    if (tujuan) {
      try {
        const r = await salinHasilKeTujuan({ id, outputs, antrean }, tujuan);
        folderTersimpan = r.folder;
        if (r.gagal.length) peringatanSalin = `${r.gagal.length} berkas gagal disalin: ${r.gagal.slice(0, 3).join(", ")}`;
      } catch (e) {
        peringatanSalin = e instanceof Error ? e.message : "penyalinan gagal";
      }
    }
    job.folderTersimpan = folderTersimpan;
    job.peringatanSalin = peringatanSalin;
    catatRiwayat(job);
    return NextResponse.json({
      ok: true,
      outputs,
      folderTersimpan,
      peringatanSalin,
      peringatan: peringatan.length ? peringatan.join("; ") : null,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Gagal finalisasi kilat" },
      { status: 500 },
    );
  }
}
