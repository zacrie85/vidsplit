// POST/GET /api/kilat/simpan — penerima hasil part MESIN KILAT (WebCodecs renderer)
// v2.9.0 — transplantasi KINOSTRA: renderer merender part dgn GPU lalu mengunggah
// berkas MP4 jadi ke sini; server menulisnya ke folder output job yang sama dgn
// jalur ffmpeg (output/<idKilat>/) sehingga Riwayat/Tujuan/ZIP bekerja persis sama.
// GET  ?idKilat=&nama=  → { ok, ada, ukuran, utuh } — LANJUTKAN EKSPOR (part utuh tidak diulang)
// POST (multipart)      → simpan berkas; meta JSON: { idKilat, nama }
import { existsSync, renameSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { dirWork } from "@/lib/vidsplit/ffmpeg";

export const runtime = "nodejs";

const polaNama = /^[a-zA-Z0-9._-]+$/;

export async function GET(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("idKilat") || "";
    const nama = req.nextUrl.searchParams.get("nama") || "";
    if (!/^[a-zA-Z0-9_-]{6,64}$/.test(id) || !polaNama.test(nama))
      return NextResponse.json({ ok: false, error: "Parameter tidak sah" }, { status: 400 });
    const p = path.join(dirWork(`output/${id}`), nama);
    const ada = existsSync(p) && statSync(p).isFile();
    return NextResponse.json({
      ok: true,
      ada,
      ukuran: ada ? statSync(p).size : 0,
      // part utuh (KINOSTRA LANJUTKAN): > 50 KB dianggap valid
      utuh: ada && statSync(p).size > 51200,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Gagal cek part" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const berkas = form.get("berkas");
    const metaMentah = form.get("meta");
    if (!(berkas instanceof Blob) || typeof metaMentah !== "string")
      return NextResponse.json({ ok: false, error: "Berkas/meta tidak lengkap" }, { status: 400 });
    const meta = JSON.parse(metaMentah) as { idKilat?: string; nama?: string };
    const id = String(meta.idKilat || "");
    const nama = String(meta.nama || "");
    if (!/^[a-zA-Z0-9_-]{6,64}$/.test(id) || !polaNama.test(nama))
      return NextResponse.json({ ok: false, error: "ID/nama tidak sah" }, { status: 400 });
    const folder = dirWork(`output/${id}`);
    const tujuan = path.join(folder, nama);
    const buf = Buffer.from(await berkas.arrayBuffer());
    if (buf.length < 1024)
      return NextResponse.json({ ok: false, error: "Berkas terlalu kecil (part rusak)" }, { status: 400 });
    /* tulis atomik: .part → rename, agar part setengah jadi tak pernah dianggap utuh */
    const sementara = `${tujuan}.part`;
    writeFileSync(sementara, buf);
    try {
      unlinkSync(tujuan);
    } catch {}
    renameSync(sementara, tujuan);
    return NextResponse.json({ ok: true, file: `output/${id}/${nama}`, ukuran: buf.length });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Gagal simpan part" },
      { status: 500 },
    );
  }
}
