/**
 * UJI v3.9.2 — VIDEO BISU TIDAK LAGI MENGGAGALKAN EKSPOR & SPLIT
 * (laporan user: "ffmpeg keluar dengan kode 4294967274: ... [0:a]aformat=...
 * matches no streams. Error initializing complex filters: Invalid argument"
 * — video sumber ternyata tanpa trek audio tapi grafik memakai [0:a]).
 * 1. adaAudioSaatRender: bisu→false, ber-audio→true, probe gagal→bawaan.
 * 2. Unit argumen: adaAudio=false TANPA [0:a] (map anullsrc 1:a); true → [0:a] ada.
 * 3. RANTAI PENYELAMATAN (kasus user E2E): src bisu + flag SALAH(true) → ffmpeg
 *    GAGAL "matches no streams" (bukti akar); dibangun ulang flag false → SUKSES,
 *    output punya trek audio aac (senyap) — persis rantai retry jaring pengaman.
 * 4. Flag BENAR sejak awal (video bisu, probe benar) → sukses tanpa retry.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import * as Ty from "../src/lib/vidsplit/types";
import { adaAudioSaatRender, bangunArgumenPart } from "../src/lib/vidsplit/ffmpeg";

let lolos = 0, gagal = 0;
function cek(nama: string, syarat: boolean, konteks?: unknown) {
  if (syarat) { lolos++; console.log(`  LOLOS  ${nama} ✓`); }
  else { gagal++; console.error(`  GAGAL  ${nama}${konteks !== undefined ? " :: " + JSON.stringify(konteks).slice(0, 240) : ""}`); }
}

const dirTmp = mkdtempSync(path.join(tmpdir(), "uji-v392-"));

// — siapkan sumber uji: bisu (tanpa audio) & ber-audio (sine) —
for (const [nama, audio] of [["bisu.mp4", false], ["beraudio.mp4", true]] as [string, boolean][]) {
  const src = audio
    ? "testsrc2=size=200x356:rate=15:duration=2,format=yuv420p"
    : "testsrc2=size=200x356:rate=15:duration=2,format=yuv420p";
  const args = ["-y", "-loglevel", "error", "-f", "lavfi", "-i", src];
  if (audio) args.push("-f", "lavfi", "-i", "sine=frequency=440:duration=2", "-c:a", "aac", "-shortest");
  args.push("-an", "-c:v", "libx264", "-preset", "ultrafast", "-crf", "45", path.join(dirTmp, nama));
  if (audio) { args.splice(args.indexOf("-an"), 1); }
  const r = spawnSync("ffmpeg", args, { encoding: "utf8", timeout: 120_000 });
  if (r.status !== 0) throw new Error(`gagal buat sumber ${nama}: ${r.stderr}`);
}

async function main() {
  // ——— 1. adaAudioSaatRender ———
  const bisu = await adaAudioSaatRender(path.join(dirTmp, "bisu.mp4"), true);
  cek("probe saat render: bisu → FALSE (bukan bawaan)", bisu === false, bisu);
  const ada = await adaAudioSaatRender(path.join(dirTmp, "beraudio.mp4"), false);
  cek("probe saat render: ber-audio → TRUE", ada === true, ada);
  const hantu = await adaAudioSaatRender(path.join(dirTmp, "tak-ada.mp4"), true);
  cek("probe gagal → kembali ke bawaan (true)", hantu === true, hantu);

  // ——— 2. unit argumen ———
  const p: Ty.Pengaturan = { ...Ty.pengaturanDefault, judul: "Gadis Ini Masuk Novel", kataPart: "Part" };
  const dasar = {
    src: path.join(dirTmp, "bisu.mp4"),
    bg: null, logo: null,
    pengaturan: p, n: 1, mulai: 0, durasi: 2,
    W: 720, H: 1280, fps: 15,
    judulTxt: "Gadis Ini Masuk Novel", partTxt: "Part 1", deskripsiTxt: "",
    dirTmp, tag: "uji392",
    codecArgs: ["-c:v", "libx264", "-preset", "ultrafast", "-crf", "45", "-c:a", "aac"],
    keluar: path.join(dirTmp, "keluar.mp4"),
  };
  const tanpa = bangunArgumenPart({ ...dasar, adaAudio: false } as never).args.join(" ");
  cek("flag false → TANPA referensi [0:a]", !tanpa.includes("[0:a]"), tanpa.slice(-160));
  cek("flag false → audio dari anullsrc (map 1:a)", tanpa.includes("-map 1:a"), tanpa.slice(-160));
  const dengan = bangunArgumenPart({ ...dasar, adaAudio: true } as never).args.join(" ");
  cek("flag true → grafik memakai [0:a] (berisiko bila src bisu)", dengan.includes("[0:a]"));

  // ——— 3. rantai penyelamatan E2E (persis kasus user) ———
  const { args: argSalah } = bangunArgumenPart({ ...dasar, adaAudio: true } as never);
  const rSalah = spawnSync("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", ...argSalah], { encoding: "utf8", timeout: 180_000 });
  const errSalah = `${rSalah.stderr || ""}`;
  cek("flag SALAH + src bisu → ffmpeg GAGAL (bukti akar EINVAL)", rSalah.status !== 0);
  cek("pesan berisi 'matches no streams' (sama dgn laporan user)", /matches no streams/i.test(errSalah), errSalah.slice(0, 160));

  const { args: argSelamat } = bangunArgumenPart({ ...dasar, adaAudio: false } as never);
  const rSelamat = spawnSync("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", ...argSelamat], { encoding: "utf8", timeout: 180_000 });
  cek("dibangun ulang flag false → render SUKSES", rSelamat.status === 0 && statSync(dasar.keluar).size > 0, (rSelamat.stderr || "").slice(0, 160));
  const pr = spawnSync("ffprobe", ["-v", "error", "-select_streams", "a", "-show_entries", "stream=codec_name", "-of", "csv", dasar.keluar], { encoding: "utf8" });
  cek("hasil penyelamatan punya trek audio senyap (aac)", /aac/.test(pr.stdout || ""), pr.stdout);

  // ——— 4. flag benar sejak awal ———
  const { args: argBenar } = bangunArgumenPart({ ...dasar, adaAudio: false, keluar: path.join(dirTmp, "keluar2.mp4") } as never);
  const rBenar = spawnSync("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", ...argBenar], { encoding: "utf8", timeout: 180_000 });
  cek("flag benar (probe benar) → sukses tanpa retry", rBenar.status === 0 && statSync(path.join(dirTmp, "keluar2.mp4")).size > 0, (rBenar.stderr || "").slice(0, 160));

  console.log(`\nHASIL: ${lolos} lolos, ${gagal} gagal`);
  process.exit(gagal ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
