// Dump argumen persis untuk kasus .TS blur (untu debug durasi)
import { bangunArgumenPart } from "../src/lib/vidsplit/ffmpeg";
import { pengaturanDefault } from "../src/lib/vidsplit/types";

const { args, total } = bangunArgumenPart({
  src: "/home/z/my-project/vidsplit/work/sample/uji-ts.ts",
  bg: null,
  logo: null,
  pengaturan: {
    ...pengaturanDefault,
    judul: "Uji TS",
    kataPart: "Bagian",
    durasiPart: 3,
    resolusi: "720",
    prosesParalel: 1,
    pakaiGpu: false,
    gayaJudul: { font: "anton", ukuran: 72, warna: "#ffffff", outlineLebar: 3, outlineWarna: "#000000" },
    gayaPart: { font: "bebas", ukuran: 56, warna: "#ffe14d", outlineLebar: 2, outlineWarna: "#000000" },
  },
  n: 1,
  mulai: 0,
  durasi: 3,
  W: 720,
  H: 1280,
  fps: 30,
  adaAudio: true,
  judulTxt: "Uji TS",
  partTxt: "Bagian 1",
  dirTmp: "/tmp",
  tag: "dbg",
  codecArgs: ["-c:v", "libx264", "-preset", "ultrafast", "-crf", "23"],
  keluar: "/tmp/uji-ts-part-dbg.mp4",
});
console.log("total =", total);
console.log(JSON.stringify(args, null, 1));
