// VidSplit v2.1.0 — THUMBNAIL OTOMATIS: tiap part hasil split diberi gambar
// thumbnail siap upload (YouTube/TikTok/Shorts) — frame diambil dari video
// SUMBER (bersih, tanpa tulisan terbakar), lalu ditulisi:
//   • JUDUL — dari NAMA FILE (dibersihkan & dibungkus, di atas + kotak gelap)
//   • LABEL — "Part/Bagian/Episode N" (besar, di bawah, kotak gelap)
// Semua argumen murni & teruji unit (uji-v210); render nyata via jalankanFfmpeg.
// v2.2.0 — ditambah helper BACKGROUND INTRO DARI VIDEO: detikFrameIntro,
// labelIntro, bangunArgumenFrameSumber (frame polos — teks dibakar rantai intro).
// v2.2.1 — PERCEPAT EKSPOR (keluhan user: ekspor/split jadi sangat lama):
// posisi frame (intro + thumbnail) kini DIPETAKAN ke rentang MENIT 1–3 video
// (detikRentangCover) → seek selalu dekat awal video, cepat di semua format &
// panjang video; frame juga langsung diskalakan saat ekstraksi (mode W,H).
// v2.3.0 — SATU COVER UNTUK SEMUA PART + GAYA BINGKAI (permintaan user:
// "1 gambar saja dari setiap video untuk cover semua splitan" + "pilihan klasik
// modern dan futuristik"): (1) mode gambar — input = file frame PNG/JPG (tanpa
// -ss, ekstraksi bersama cukup 1× per video); (2) preset GAYA_COVER — modern
// (bawaan, rantai lama PERSIS), klasik (bingkai emas + Cinzel Decorative),
// futuristik (neon cyan/magenta + bracket sudut + Anton/Monoton).
import type { GayaThumbnail, NamaFont, OpsiThumbnail } from "./types";

/** Kunci drawtext: nilai teks SELALU lewat textfile (aman unicode/koma) */

/** v2.3.0 — preset GAYA BINGKAI cover: font, warna, dan hiasan per gaya.
 *  Semua nilai dihitung × skala (sisi terpendek/1080) saat digambar.
 *  "modern" HARUS memunculkan rantai lama PERSIS (nol regresi visual). */
export interface GayaCover {
  fontJudul: NamaFont;
  fontLabel: NamaFont;
  /** warna teks judul & label (fontcolor drawtext) */
  warnaJudul: string;
  warnaLabel: string;
  /** tebal border teks (px @1080); 0 = tanpa border */
  tebalBorderJudul: number;
  tebalBorderLabel: number;
  warnaBorderJudul: string;
  warnaBorderLabel: string;
  /** kotak belakang judul & label (drawbox color@alpha) */
  boxJudul: string;
  boxLabel: string;
  /** hiasan tambahan: "" = tanpa (modern), "emas" = bingkai ganda klasik,
   *  "neon" = garis aksen + 8 bracket sudut futuristik */
  hiasan: "" | "emas" | "neon";
}

export const GAYA_COVER: Record<GayaThumbnail, GayaCover> = {
  modern: {
    fontJudul: "tebal",
    fontLabel: "tebal",
    warnaJudul: "white",
    warnaLabel: "#fbbf24",
    tebalBorderJudul: 3,
    tebalBorderLabel: 4,
    warnaBorderJudul: "black",
    warnaBorderLabel: "black",
    boxJudul: "black@0.45",
    boxLabel: "black@0.55",
    hiasan: "",
  },
  klasik: {
    fontJudul: "cinzeldec",
    fontLabel: "cinzeldec",
    warnaJudul: "#f5e6c8",
    warnaLabel: "#f5d061",
    tebalBorderJudul: 3,
    tebalBorderLabel: 3,
    warnaBorderJudul: "black",
    warnaBorderLabel: "black",
    boxJudul: "black@0.55",
    boxLabel: "black@0.6",
    hiasan: "emas",
  },
  futuristik: {
    fontJudul: "anton",
    fontLabel: "monoton",
    warnaJudul: "white",
    warnaLabel: "#22d3ee",
    tebalBorderJudul: 3,
    tebalBorderLabel: 0, // Monoton sudah bergaya outline — border gelap justru menutupi
    warnaBorderJudul: "#22d3ee",
    warnaBorderLabel: "black",
    boxJudul: "black@0.6",
    boxLabel: "#020617@0.78",
    hiasan: "neon",
  },
};

export interface ArgThumbnail {
  /** path video SUMBER (absolut) — wajib bila `gambar` kosong */
  src?: string;
  /** detik (waktu sumber) frame yang diambil — wajib bila `gambar` kosong */
  detik?: number;
  /** v2.3.0 — path gambar frame bersama (mode "satu"); diisi → tanpa -ss */
  gambar?: string;
  /** isi judul — SUDAH dibungkus multi-baris (dilakukan pemanggil) */
  judulTxt: string;
  /** isi label — mis. "Part 3" (dibesar-besarkan saat digambar) */
  labelTxt: string;
  W: number;
  H: number;
  /** path file .txt judul & label (ditulis pemanggil di dirTmp) */
  fileJudul: string;
  fileLabel: string;
  /** ukuran huruf dasar px pada sisi terpendek 1080 */
  ukuranJudul: number;
  ukuranLabel: number;
  /** file font TTF JUDUL (boleh "" → font bawaan ffmpeg) */
  fontfile: string;
  /** v2.3.0 — file font TTF LABEL (kosong = ikut `fontfile` judul) */
  fontLabel?: string;
  /** v2.3.0 — gaya bingkai (kosong = "modern" = rantai lama persis) */
  gaya?: GayaThumbnail;
  keluar: string;
  /** "jpg" (bawaan, -q:v 2) atau "png" */
  format: "jpg" | "png";
}

/** v2.1.0 — nama file sumber → judul thumbnail yang layak tampil:
 *  ekstensi dibuang, pemisah _-. diganti spasi, spasi ganda dirapikan,
 *  pola "part 12/ep 3/episode 004/bagian 2/full/HD/1080p/720p/4k" di ujung
 *  dibuang (informasi itu datang dari LABEL, bukan judul). Murni — dites unit. */
export function bersihkanNamaJudul(namaFile: string): string {
  let s = String(namaFile || "").replace(/\.[^.]+$/, "");
  s = s.replace(/[_]+/g, " ").replace(/\s*-\s*/g, " ").trim();
  // buang pola penomoran di UJUNG: part/ep/episode/bagian/eps + angka romawi/00
  s = s.replace(
    /[\s\-_.]*(?:part|ep|eps|episode|bagian|pt)[\s\-_.]*(?:\d{1,4}|[ivxlcdm]{1,6})\s*$/i,
    "",
  );
  // buang kualitas/format di ujung (bukan bagian judul)
  s = s.replace(/[\s\-_.]*(?:full\s?hd|hd|fhd|4k|2k|1080p|720p|480p|360p)\s*$/i, "");
  s = s.replace(/\s{2,}/g, " ").trim();
  // bang depan-belakang; kosong → fallback
  s = s.replace(/^[-_.\s]+|[-_.\s]+$/g, "");
  return s || "Video";
}

/** v2.2.1 — inti PERCEPATAN: posisi absolut di video dipetakan PROPORSIONAL ke
 *  rentang MENIT 1–3 (60–180 dtk) — permintaan user ("pengambilan cover dr video
 *  di antara menit 1-3 agar lebih cepat") → seek selalu dekat awal video, murah
 *  di semua format/panjang. Urutan part tetap terjaga (part awal → awal rentang,
 *  part akhir → akhir rentang) sehingga tiap part masih berbeda framenya.
 *  Video pendek (< 75 dtk) / tanpa durasi → posisi PERSIS (perilaku lama, aman).
 *  Murni — dites unit. */
export function detikRentangCover(posisiAbsolut: number, durasiTotal?: number): number {
  const total = Math.max(0, Number(durasiTotal) || 0);
  const pos = Math.max(0, Number(posisiAbsolut) || 0);
  // total diketahui → clamp dalam video; tak diketahui → hanya clamp bawah
  const t = total > 0 ? Math.min(pos, Math.max(0, total - 0.5)) : pos;
  if (total < 75) return t; // video pendek / durasi tak diketahui → persis
  const batas = Math.min(180, total - 1); // menit 3, tak pernah melewati akhir video
  const dipetakan = 60 + (t / total) * (batas - 60);
  return Math.min(batas, Math.max(1, dipetakan));
}

/** v2.1.0 — detik pengambilan frame thumbnail: ±35% awal part (hindari frame
 *  hitam awal, tetap mewakili isi part). Part sangat pendek → 40%. Murni.
 *  v2.2.1 — durasiTotal diisi → DIPETAKAN ke menit 1–3 (detikRentangCover);
 *  tanpa durasiTotal → persis (kompatibel pemanggil lama). */
export function detikFrameThumbnail(
  mulaiPart: number,
  durasiPart: number,
  durasiTotal?: number,
): number {
  const d = Math.max(0, Number(durasiPart) || 0);
  const dalam = Math.max(0, Number(mulaiPart) || 0) + d * 0.35;
  return durasiTotal === undefined ? dalam : detikRentangCover(dalam, durasiTotal);
}

/** v2.2.0 — detik frame BACKGROUND INTRO: mulai part + durasi × posisiPersen/100
 *  (posisi bebas 0–100% pilihan user; 0 = awal part, 35 = bawaan = sama dgn
 *  thumbnail). Posisi/durasi aneh di-clamp aman. Murni — dites unit.
 *  v2.2.1 — durasiTotal diisi → DIPETAKAN ke menit 1–3 (detikRentangCover);
 *  tanpa durasiTotal → persis (kompatibel pemanggil lama). */
export function detikFrameIntro(
  mulaiPart: number,
  durasiPart: number,
  posisiPersen: number,
  durasiTotal?: number,
): number {
  const d = Math.max(0, Number(durasiPart) || 0);
  const pos = Math.min(100, Math.max(0, Number(posisiPersen) || 0));
  const dalam = Math.max(0, Number(mulaiPart) || 0) + (d * pos) / 100;
  return durasiTotal === undefined ? dalam : detikRentangCover(dalam, durasiTotal);
}

/** v2.2.0 — label teks intro otomatis: kata part (teks bebas user, kosong →
 *  "Part") + nomor 2-digit konsisten dgn label thumbnail. Murni — dites unit. */
export function labelIntro(kata: string, n: number): string {
  const k = String(kata || "").trim() || "Part";
  return `${k} ${String(Math.max(1, Math.floor(n))).padStart(2, "0")}`;
}

/** v2.2.0 — argumen ffmpeg utk mengambil SATU frame polos dari video sumber
 *  (tanpa kotak/tulisan — gaya teks dibakar kemudian oleh rantai intro).
 *  -ss SEBELUM -i (seek cepat, keyframe terdekat cukup utk background).
 *  v2.2.1 — W,H diisi → frame langsung DISKALAKAN+DI-CROP ke W×H saat ekstraksi
 *  (PNG jauh lebih kecil, rantai intro tak men-scale ulang file besar → lebih
 *  cepat; -an = abaikan audio). Tanpa W,H → 9 argumen polos PERSIS lama. */
export function bangunArgumenFrameSumber(
  src: string,
  detik: number,
  keluar: string,
  W?: number,
  H?: number,
): string[] {
  const args: string[] = ["-y", "-hide_banner", "-ss", Math.max(0, detik).toFixed(3), "-i", src];
  const w2 = W ? Math.max(2, Math.round(W / 2) * 2) : 0;
  const h2 = H ? Math.max(2, Math.round(H / 2) * 2) : 0;
  if (w2 > 0 && h2 > 0) {
    args.push(
      "-vf",
      `scale=${w2}:${h2}:force_original_aspect_ratio=increase,crop=${w2}:${h2}`,
      "-an",
    );
  }
  args.push("-frames:v", "1", keluar);
  return args;
}

/** v2.1.0 — label thumbnail: "Part 03" (nomor 2-digit konsisten dgn nama part) */
export function labelThumbnail(opsi: Pick<OpsiThumbnail, "kata">, n: number): string {
  const kata = opsi.kata === "Bagian" ? "Bagian" : opsi.kata === "Episode" ? "Episode" : "Part";
  return `${kata} ${String(Math.max(1, Math.floor(n))).padStart(2, "0")}`;
}

/** Susun argumen ffmpeg: 1 frame sumber (atau GAMBAR frame bersama v2.3.0) →
 *  scale cover W×H → kotak+judul+label dgn gaya pilihan. Memakai -filter_complex
 *  (bukan -vf) karena rantai menghasilkan label [out].
 *  NOL REGRESI: tanpa `gaya` (atau gaya "modern") + tanpa `gambar` → argumen
 *  PERSIS sama dgn v2.1.0–v2.2.1 (dites string-sajar di uji-v230 & uji-v210). */
export function bangunArgumenThumbnail(a: ArgThumbnail): string[] {
  const W = Math.max(2, Math.round(a.W / 2) * 2);
  const H = Math.max(2, Math.round(a.H / 2) * 2);
  const skala = Math.min(W, H) / 1080;
  const uJ = Math.max(12, a.ukuranJudul * skala);
  const uL = Math.max(12, a.ukuranLabel * skala);
  const amanFilter = (p: string) => p.replaceAll("\\", "/").replaceAll(":", "\\:").replaceAll("'", "\\'");
  const gy = GAYA_COVER[a.gaya ?? "modern"];
  const ff = a.fontfile ? `:fontfile=${amanFilter(a.fontfile)}` : "";
  const fl = (a.fontLabel || a.fontfile) ? `:fontfile=${amanFilter(a.fontLabel || a.fontfile)}` : "";
  // tebal border teks: 0 = tanpa border (param borderw/bordercolor tak ditulis)
  const bwJ = gy.tebalBorderJudul > 0 ? Math.max(1, Math.round(gy.tebalBorderJudul * skala)) : 0;
  const bwL = gy.tebalBorderLabel > 0 ? Math.max(1, Math.round(gy.tebalBorderLabel * skala)) : 0;
  // judul: kotak gelap semi transparan + teks, posisi atas (blok naik dgn jumlah baris)
  const barisJ = Math.max(1, a.judulTxt.split("\n").length);
  const yJudul = Math.round(H * 0.055);
  const hBoxJ = Math.round(barisJ * uJ * 1.35 + uJ * 0.5);
  const rantai = [
    `[0:v]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1`,
    // kotak judul: drawbox selebar frame, tinggi = jumlah baris × tinggi baris
    `drawbox=x=0:y=${yJudul}:w=${W}:h=${hBoxJ}:color=${gy.boxJudul}:t=fill`,
    `drawtext=textfile='${amanFilter(a.fileJudul)}'` +
      `:fontsize=${uJ.toFixed(1)}:fontcolor=${gy.warnaJudul}` +
      (bwJ > 0 ? `:borderw=${bwJ}:bordercolor=${gy.warnaBorderJudul}` : "") +
      `:x=(w-text_w)/2:y=${yJudul + Math.round(uJ * 0.25)}` +
      `:line_spacing=${(uJ * 0.3).toFixed(1)}:expansion=none${ff}`,
  ];
  // v2.1.0 — label opsional ("" = tanpa label, mis. thumbnail GABUNG)
  let yLabel = 0;
  if (a.labelTxt.trim()) {
    yLabel = Math.round(H * 0.76);
    rantai.push(
      // label: kotak gelap + teks besar di bawah (78% tinggi)
      `drawbox=x=0:y=${yLabel}:w=${W}:h=${Math.round(uL * 1.6)}:color=${gy.boxLabel}:t=fill`,
      `drawtext=textfile='${amanFilter(a.fileLabel)}'` +
        `:fontsize=${uL.toFixed(1)}:fontcolor=${gy.warnaLabel}` +
        (bwL > 0 ? `:borderw=${bwL}:bordercolor=${gy.warnaBorderLabel}` : "") +
        `:x=(w-text_w)/2:y=${yLabel + Math.round(uL * 0.3)}` +
        `:expansion=none${fl}`,
    );
  }
  // v2.3.0 — hiasan per gaya (digambar TERAKHIR agar bersih di atas teks)
  if (gy.hiasan === "emas") {
    // bingkai ganda emas mengelilingi frame + garis emas tipis di bawah kotak judul
    const tebal = Math.max(2, Math.round(5 * skala));
    const jarak = Math.round(16 * skala);
    rantai.push(
      `drawbox=x=0:y=0:w=${W}:h=${H}:color=#d4af37@0.9:t=${tebal}`,
      `drawbox=x=${jarak}:y=${jarak}:w=${W - jarak * 2}:h=${H - jarak * 2}:color=#d4af37@0.45:t=${Math.max(1, Math.round(2 * skala))}`,
      `drawbox=x=0:y=${yJudul + hBoxJ}:w=${W}:h=${Math.max(2, Math.round(2 * skala))}:color=#d4af37@0.75:t=fill`,
    );
  } else if (gy.hiasan === "neon") {
    // garis aksen neon: cyan di bawah kotak judul, magenta di atas kotak label
    const garis = Math.max(2, Math.round(2 * skala));
    rantai.push(
      `drawbox=x=0:y=${yJudul + hBoxJ}:w=${W}:h=${garis}:color=#22d3ee@0.9:t=fill`,
    );
    if (a.labelTxt.trim()) {
      rantai.push(
        `drawbox=x=0:y=${yLabel - garis}:w=${W}:h=${garis}:color=#e879f9@0.9:t=fill`,
      );
    }
    // 8 bracket sudut (2 garis per sudut) — kesan HUD sci-fi
    const s = Math.round(64 * skala); // panjang bracket
    const t = Math.max(2, Math.round(3 * skala)); // tebal garis
    rantai.push(
      // kiri-atas
      `drawbox=x=0:y=0:w=${s}:h=${t}:color=#22d3ee@0.9:t=fill`,
      `drawbox=x=0:y=0:w=${t}:h=${s}:color=#22d3ee@0.9:t=fill`,
      // kanan-atas
      `drawbox=x=${W - s}:y=0:w=${s}:h=${t}:color=#22d3ee@0.9:t=fill`,
      `drawbox=x=${W - t}:y=0:w=${t}:h=${s}:color=#22d3ee@0.9:t=fill`,
      // kiri-bawah
      `drawbox=x=0:y=${H - t}:w=${s}:h=${t}:color=#22d3ee@0.9:t=fill`,
      `drawbox=x=0:y=${H - s}:w=${t}:h=${s}:color=#22d3ee@0.9:t=fill`,
      // kanan-bawah
      `drawbox=x=${W - s}:y=${H - t}:w=${s}:h=${t}:color=#22d3ee@0.9:t=fill`,
      `drawbox=x=${W - t}:y=${H - s}:w=${t}:h=${s}:color=#22d3ee@0.9:t=fill`,
    );
  }
  rantai.push("format=yuv420p[out]");
  // v2.3.0 — input gambar (mode SATU COVER) → tanpa -ss; input video → seek cepat
  const args: string[] = ["-y", "-hide_banner"];
  if (a.gambar) args.push("-i", a.gambar);
  else args.push("-ss", Math.max(0, a.detik ?? 0).toFixed(3), "-i", a.src ?? "");
  args.push("-frames:v", "1", "-filter_complex", rantai.join(","), "-map", "[out]");
  if (a.format === "png") args.push("-pred", "mixed");
  else args.push("-q:v", "2");
  args.push(a.keluar);
  return args;
}
