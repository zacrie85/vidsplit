// Validasi cepat VokalGen-3 (v0.19) + PISAH VOKAL & MUSIK: graf baru harus lulus ffmpeg sungguhan.
// Jalankan: bun scripts/coba-vokalgen.ts
import { execSync } from "node:child_process";
import { existsSync, statSync, unlinkSync } from "node:fs";
const statUkuran = (f: string) => statSync(f).size;
import { bangunFilterAudio, grafPisahVokalMusik } from "../src/lib/vidsplit/musik";

const dasar = { file: "work/coba-in.wav", judul: "Coba", genre: "asli" as const, layerLevel: 0, karaoke: "asli" as const, bpm: 120, fase: 0 };
const kasus = [
  { nama: "asli+dangdut+Rhoma 55", opsi: { ...dasar, genreVokal: "dangdut" as const, refVokal: "dangdut-p1", tingkatVokal: 55 } },
  { nama: "asli+lofi+Joji 80", opsi: { ...dasar, genreVokal: "lofi" as const, refVokal: "lofi-p1", tingkatVokal: 80 } },
  { nama: "vokal saja+dangdut+Elvi 90", opsi: { ...dasar, karaoke: "vokal" as const, genreVokal: "dangdut" as const, refVokal: "dangdut-w1", tingkatVokal: 90 } },
  { nama: "asli+country+Cash 100", opsi: { ...dasar, genreVokal: "country" as const, refVokal: "country-p1", tingkatVokal: 100 } },
];

if (!existsSync("work/coba-in.wav")) {
  execSync(`ffmpeg -y -hide_banner -loglevel error -f lavfi -i "sine=frequency=440:duration=16" -f lavfi -i "sine=frequency=660:duration=16" -filter_complex "[0:a][1:a]amerge=inputs=2,pan=stereo|c0=c0|c1=c1,aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo" -c:a pcm_s16le work/coba-in.wav`);
}

let gagal = 0;
for (const k of kasus) {
  const g = bangunFilterAudio(k.opsi);
  console.log(`\n== ${k.nama} ==`);
  console.log(g.graf.slice(0, 600));
  const out = "work/coba-out.mp3";
  if (existsSync(out)) unlinkSync(out);
  try {
    execSync(`ffmpeg -y -hide_banner -loglevel error -i work/coba-in.wav -filter_complex "${g.graf.replace(/"/g, '\\"')}" -map "[aout]" -c:a libmp3lame -b:a 192k ${out}`);
    const dur = Number(execSync(`ffprobe -v error -show_entries format=duration -of csv=p=0 ${out}`).toString().trim());
    const mean = execSync(`ffmpeg -i ${out} -af volumedetect -f null - 2>&1 | grep mean_volume`).toString().trim();
    const ok = Math.abs(dur - 16) < 1.5;
    console.log(`  durasi=${dur.toFixed(2)} | ${mean} | ${ok ? "LOLOS" : "GAGAL-durasi"}`);
    if (!ok) gagal++;
  } catch (e) {
    console.error(`  GAGAL-ffmpeg: ${e}`);
    gagal++;
  }
}
// v0.19 — uji PISAH VOKAL & MUSIK (dua keluaran)
{
  const outM = "work/coba-pisah-musik.wav";
  const outV = "work/coba-pisah-vokal.wav";
  try {
    execSync(`ffmpeg -y -hide_banner -loglevel error -i work/coba-in.wav -filter_complex "${grafPisahVokalMusik().replace(/"/g, '\\"')}" -map "[mout]" ${outM} -map "[vout]" ${outV}`);
    const okM = existsSync(outM) && statUkuran(outM) > 1000;
    const okV = existsSync(outV) && statUkuran(outV) > 1000;
    console.log(`\n== pisah vokal & musik ==`);
    console.log(`  musik=${okM ? "OK" : "GAGAL"} · vokal=${okV ? "OK" : "GAGAL"}`);
    if (!okM || !okV) gagal++;
  } catch (e) {
    console.error(`\n== pisah vokal & musik: GAGAL-ffmpeg: ${e}`);
    gagal++;
  }
}

if (existsSync("work/coba-in.wav") && process.argv.includes("--bersih")) unlinkSync("work/coba-in.wav");
console.log(gagal === 0 ? "\nSEMUA KASUS LOLOS" : `\n${gagal} KASUS GAGAL`);
process.exit(gagal === 0 ? 0 : 1);
