// pratinjau-bingkai.ts — render PNG bingkai judul dgn judul BESAR (ukuran 80)
// lalu pangkas area atas → lembar kontak utk cek visual bentuk 10 gaya.
// Jalankan: npx tsx scripts/pratinjau-bingkai.ts
import { mkdirSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import * as Bj from "../src/lib/vidsplit/bingkaiJudul";
import * as Ty from "../src/lib/vidsplit/types";
import { tulisPngBingkaiJudul } from "../src/lib/vidsplit/thumbnail";

const dirTmp = path.join(process.cwd(), "work", "tmp-pratinjau-bingkai");
mkdirSync(dirTmp, { recursive: true });

const gayaList = Bj.BINGKAI_JUDUL.map((g) => g.id);
const p: Ty.Pengaturan = {
  ...Ty.pengaturanDefault,
  judul: "JUDUL FUTURISTIK v3.5",
  gayaJudul: { ...Ty.pengaturanDefault.gayaJudul, ukuran: 80 },
};
for (const id of gayaList) {
  const f = tulisPngBingkaiJudul({
    pengaturan: { ...p, bingkaiJudul: id },
    judulTxt: p.judul,
    partTxt: "Part 1",
    W: 1080,
    H: 1920,
    dirTmp,
    tag: `besar-${id}`,
  });
  console.log(id, "->", f);
}

// lembar kontak 2 × 5 — pangkas area atas (bingkai di y ± 40..350)
// PENTING: alpha harus DI-BLEND ke latar (overlay di atas warna), bukan
// dibuang (format=rgb24) — kalau dibuang, isi kaca 6-10% tampil pekat.
const potong = (id: string, out: string) => {
  execFileSync(
    "ffmpeg",
    ["-y", "-v", "error",
     "-f", "lavfi", "-i", "color=c=0x111827:s=1080x330:d=1",
     "-i", path.join(dirTmp, `besar-${id}-bingkai-judul.png`),
     "-filter_complex", "[1:v]crop=1080:330:0:20[c];[0:v][c]overlay=0:0,scale=400:122",
     "-frames:v", "1", out],
    { stdio: "ignore" },
  );
};
const sheet = (ids: string[], out: string) => {
  const inputs = ids.flatMap((id) => ["-i", path.join(dirTmp, `potong-${id}.jpg`)]);
  execFileSync("ffmpeg", ["-y", "-v", "error", ...inputs, "-filter_complex", `hstack=${ids.length}`, out], { stdio: "ignore" });
};
gayaList.forEach((id) => potong(id, path.join(dirTmp, `potong-${id}.jpg`)));
sheet(gayaList.slice(0, 5), "/tmp/render/bingkai-besar-a.jpg");
sheet(gayaList.slice(5), "/tmp/render/bingkai-besar-b.jpg");
console.log("selesai → /tmp/render/bingkai-besar-{a,b}.jpg");
