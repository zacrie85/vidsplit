// Debug: cetak filter_complex yang dibangun bangunArgumenPart
import { bangunArgumenPart } from "../src/lib/vidsplit/ffmpeg";
import { pengaturanDefault } from "../src/lib/vidsplit/types";

const { args } = bangunArgumenPart({
  src: "/home/z/my-project/vidsplit/work/sample/uji-dua-warna.mp4",
  bg: null,
  pengaturan: { ...pengaturanDefault, mode: "crop", posisiPotong: 0, judul: "Uji Crop Kiri" },
  n: 1,
  mulai: 0,
  durasi: 20,
  W: 1080,
  H: 1920,
  fps: 15,
  adaAudio: true,
  judulTxt: "Uji Crop Kiri",
  partTxt: "Part 1",
  dirTmp: "/tmp",
  tag: "dbg",
  codecArgs: ["-c:v", "libx264", "-preset", "ultrafast", "-crf", "23"],
  keluar: "/tmp/dbg-out.mp4",
});

const idx = args.indexOf("-filter_complex");
console.log("=== FILTER ===");
console.log(args[idx + 1]);
console.log("=== ARGS LENGKAP ===");
console.log(args.join(" "));
