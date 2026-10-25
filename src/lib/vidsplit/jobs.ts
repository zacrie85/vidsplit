// VidSplit — manajer job ekspor ANTREAN: video diproses berurutan dari atas ke bawah,
// di dalam tiap video part dirender paralel (pool 1-4 ffmpeg), progres dipolling API
import { randomBytes } from "node:crypto";
import { existsSync, readdirSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { apakahBatal, bersihkanBatal, daftarkanProses, mintaBatal } from "./batal";
import {
  bangunArgumenPart,
  dirWork,
  fontfileNama,
  jalankanFfmpeg,
  pathAman,
  pilihEncoder,
  pilihFfmpeg,
  resetUjiGpu,
  type InfoVideo,
  type PilihanEncoder,
} from "./ffmpeg";
import {
  bangunArgumenFrameSumber,
  bangunArgumenThumbnail,
  bersihkanNamaJudul,
  detikFrameIntro,
  detikFrameThumbnail,
  labelIntro,
  labelThumbnail,
} from "./thumbnail";
import { bungkusTeks } from "./bungkus";
import { siapkanBingkai, siapkanBingkaiWarna } from "./bingkai";
import { catatRiwayat } from "./riwayat";
import {
  bangunAssSubtitle,
  mulaiTranskripLatar,
  type SegmenSub,
  type TranskripLatar,
} from "./subtitle";
import { buangSalinanKerja, muatSetelanTujuan, salinHasilKeTujuan } from "./tujuan";
import { siapkanSequenceNeon } from "./neonRender";
import { siapkanLatarTemplate } from "./templatRender";
import { TATA_TEMPLATE, kotakKePx } from "./templatLayar";
import { jadwalkanPangkas } from "./kebersihan";
import type { SeqNeon } from "./ffmpeg";
import { analisisAdegan, potonganAdegan, type PotonganAdegan } from "./adegan";
import {
  PembicaraLatar,
  cadanganDuaBagian,
  ekstrakStereoEnergi,
  type Keyframe,
} from "./pembicara";
import {
  neonDari,
  bitrateKbpsTarget,
  dimensiOutput,
  durasiEfektif,
  hitungPartDgnHapus,
  hitungPartV2,
  levelH264,
  offsetBacksound,
  pilihBgPart,
  rapikanKecepatan as rapikanKecepatanLocal,
  rentangPart,
  rentangPartHapus,
  slugify,
  slugUnikDaftar,
  templatDari,
  durasiPartDipakai,
  opsiThumbnailDefault,
  type CodecVideo,
  type OpsiThumbnail,
  type Pengaturan,
} from "./types";

export interface KeluaranJob {
  /** nama video asal (nama file sumber) */
  video: string;
  file: string;
  ukuran: number;
}

export type StatusVideo = "menunggu" | "proses" | "selesai" | "gagal" | "dibatalkan";

export interface StatusVideoAntrean {
  nama: string;
  /** jumlah part video ini */
  total: number;
  selesai: number;
  status: StatusVideo;
  /** v0.44.0 — teks tahap khusus (mis. "Analisis suara AI… 12 dtk") saat status proses */
  tahap?: string;
}

export interface InfoJob {
  id: string;
  /** status tiap video dalam antrean, urut dari atas */
  antrean: StatusVideoAntrean[];
  /** index video yang sedang dirender (-1 = sudah tidak ada) */
  videoAktif: number;
  /** jumlah part yang sedang dirender serentak */
  partAktif: number;
  /** 0..100 rata-rata part yang sedang berjalan (kompatibilitas lama) */
  progresPart: number;
  /** 0..100 progres keseluruhan lintas semua video */
  progresTotal: number;
  outputs: KeluaranJob[];
  error: string | null;
  /** true bila ada video yang gagal (antrean tetap lanjut) */
  adaGagal: boolean;
  selesaiSemua: boolean;
  /** true bila tombol Batalkan sudah ditekan dan proses sedang dihentikan */
  batalDiminta: boolean;
  /** true bila ekspor diakhiri oleh tombol Batalkan — hasil parsial tetap bisa diunduh */
  dibatalkan: boolean;
  dibuat: number;
  /** encoder yang dipakai, mis. "NVIDIA NVENC (GPU)" / "CPU (libx264)" */
  akselerasi: string;
  /** jumlah proses serentak per video */
  paralel: number;
  /** v0.6.4 — true saat hasil sedang disalin ke folder tujuan */
  menyalin?: boolean;
  /** v0.6.4 — path absolut folder tempat hasil tersalin (bila simpan otomatis aktif) */
  folderTersimpan?: string | null;
  /** v0.6.4 — pesan peringatan bila penyalinan sebagian/total gagal */
  peringatanSalin?: string | null;
  /** v0.44.0 — pesan peringatan subtitle AI (mis. penerjemah tidak tersedia) */
  peringatanSubtitle?: string | null;
}

const jobs = new Map<string, InfoJob>();

// v0.58.0 — EVIKSI JOB LAMA: Map jobs dulu TIDAK PERNAH menghapus entri —
// aplikasi desktop yang dibiarkan menyala menumpuk objek job (antrean 100 video,
// ribuan outputs, log tahap) di RAM selamanya. Hasil tetap bisa diunduh dari
// Riwayat (riwayat.ts menyimpan salinannya).
const UMUR_JOB_MS = 6 * 3_600_000;
const MAKS_JOB = 40;
export function evictJobLama(sekarang = Date.now()): number {
  let buang = 0;
  const selesai = [...jobs.values()]
    .filter((j) => j.selesaiSemua)
    .sort((a, b) => a.dibuat - b.dibuat); // terlama dulu
  for (const j of selesai) {
    if (sekarang - j.dibuat >= UMUR_JOB_MS && jobs.delete(j.id)) buang += 1;
  }
  while (jobs.size > MAKS_JOB) {
    const terlama = selesai.find((j) => jobs.has(j.id));
    if (!terlama) break; // semua masih berjalan — jangan disentuh
    jobs.delete(terlama.id);
    buang += 1;
  }
  return buang;
}

/** v0.53.0 — tunggu subtitle zona part siap sambil tetap respons terhadap batal.
 *  v0.58.0 — SATU panggilan tungguCakupan dgn sinyal batal (dulu: race 500 ms
 *  membuat loop-zombie menumpuk — ribuan loop tidur 400 ms yang tak pernah
 *  dihentikan memakan CPU/memori persis saat CPU dipenuhi sesi Whisper). */
async function tungguCakupanDenganBatal(
  latar: TranskripLatar,
  akhirRel: number,
  id: string,
): Promise<SegmenSub[]> {
  if (apakahBatal(id)) throw new Error("DIBATALKAN");
  return latar.tungguCakupan(akhirRel, () => apakahBatal(id));
}

export function ambilJob(id: string): InfoJob | undefined {
  return jobs.get(id);
}

export function daftarJob(): InfoJob[] {
  return [...jobs.values()].sort((a, b) => b.dibuat - a.dibuat);
}

/** Batalkan job yang sedang berjalan: pasang flag + bunuh ffmpeg aktif.
 *  Worker pool berhenti mengambil part baru; hasil parsial tetap bisa diunduh. */
export function batalkanJob(id: string): boolean {
  const job = jobs.get(id);
  if (!job || job.selesaiSemua) return false;
  job.batalDiminta = true;
  mintaBatal(id);
  return true;
}

export interface ItemEkspor {
  /** nama tampilan (nama file sumber) */
  nama: string;
  srcAbs: string;
  /** v2.2.0 — background intro kini frame dari video (diekstrak per part di
   *  renderSatu) — field bgAbs (gambar unggahan) DIHAPUS. */
  logoAbs: string | null;
  /** v0.46.0 — frame hiasan (path absolut) atau null */
  frameAbs?: string | null;
  pengaturan: Pengaturan;
  info: InfoVideo;
}

export function mulaiEksporAntrean(
  daftar: ItemEkspor[],
  modeEkspor: "presisi" | "cepat",
  /** v2.1.0 — THUMBNAIL OTOMATIS (bawaan mati) */
  thumbnail: OpsiThumbnail = opsiThumbnailDefault,
): string {
  const id = randomBytes(4).toString("hex");
  // v0.58.0 — beres-beres RAM job lama + pangkas disk (throttled 1×/jam)
  evictJobLama();
  jadwalkanPangkas();
  const folder = dirWork(`output/${id}`);
  const dirTmp = dirWork("tmp");
  // v0.57.0 — bawaan maks 4 → 10 atas permintaan user (selama AI latar jalan, tetap dibatasi 1 oleh gerbang v0.56)
  const paralel = Math.min(10, Math.max(1, Math.round(daftar[0]?.pengaturan.prosesParalel || 2)));

  // v0.57.0 — hitung part MENGHORMATI zona hapus (Potong & Hapus Bagian):
  // tanpa zona = rumus lama PERSIS; dgn zona = tiap potongan dipecah mandiri.
  // v2.0.0 — hitungPartV2 juga MENGHORMATI JUMLAH PART OTOMATIS (N part merata)
  // dan SPLIT PER ADEGAN diberi estimasi sementara (total dipastikan setelah
  // analisis — job.antrean[vi].total diperbarui sebelum part pertama dirender).
  const nTotalPerVideo = daftar.map((it) =>
    it.pengaturan.modeSplit === "adegan"
      ? 1 // estimasi — total sejati dari hasil analisis adegan
      : hitungPartV2(
          it.info.durasi,
          it.pengaturan,
          it.pengaturan.mulaiDetik,
          it.pengaturan.akhirDetik,
          it.pengaturan.zonaHapus || [],
        ),
  );

  // v0.58.0 — ANTI-TABRAKAN NAMA FILE: dua video dgn judul sama (atau dua-duanya
  // kosong) dulu menulis nama part IDENTIK ke folder output bersama → hasil
  // saling menimpa (kehilangan data senyap). Slug ke-2 dst. diberi akhiran -2, -3, …
  const slugPerVideo = slugUnikDaftar(daftar.map((it) => it.pengaturan.judul));

  const job: InfoJob = {
    id,
    antrean: daftar.map((it, i) => ({
      nama: it.nama,
      total: nTotalPerVideo[i],
      selesai: 0,
      status: "menunggu" as StatusVideo,
    })),
    videoAktif: 0,
    partAktif: 0,
    progresPart: 0,
    progresTotal: 0,
    outputs: [],
    error: null,
    adaGagal: false,
    selesaiSemua: false,
    batalDiminta: false,
    dibatalkan: false,
    dibuat: Date.now(),
    akselerasi: "mendeteksi…",
    paralel,
  };
  jobs.set(id, job);

  (async () => {
    const ff = await pilihFfmpeg();
    // ffmpeg tanpa drawtext hanya fatal kalau memang ada video yang butuh tulisan
    // v0.39.0 — deskripsi ikut dihitung tulisan
    const butuhTeks = daftar.some(
      (it) =>
        !!(it.pengaturan.judul || "").trim() ||
        !!(it.pengaturan.kataPart || "").trim() ||
        !!(it.pengaturan.deskripsi || "").trim(),
    );
    if (butuhTeks && !ff.drawtext) {
      throw new Error(
        `ffmpeg yang terpilih (${ff.bin}) tidak mendukung filter drawtext (libfreetype), padahal ada tulisan judul/Part. Pasang ffmpeg lengkap atau arahkan VIDSPLIT_FFMPEG ke ffmpeg yang punya libfreetype.`,
      );
    }
    const preset = modeEkspor === "cepat" ? "ultrafast" : "medium";
    const crf = modeEkspor === "cepat" ? 23 : 20;
    // v2.0.0 — KOMPRES PINTAR: target MB global → bitrate kbps per video (durasi beda)
    const targetMb = (daftar[0]?.pengaturan as Pengaturan & { targetMb?: number }).targetMb || 0;
    // encoder per (codec, level, bitrate): hasil uji GPU di-cache per kunci
    const cacheEnc = new Map<string, PilihanEncoder>();
    const ambilEnc = async (p: Pengaturan, W: number, H: number, fps: number, durasi: number): Promise<PilihanEncoder> => {
      const codec: CodecVideo = p.codec === "h265" ? "h265" : "h264";
      // level H.264 sesuai standar utk 2K/4K (termasuk 4K 60fps → 5.2)
      const level = codec === "h264" ? levelH264(W, H, fps) : null;
      const br = targetMb > 0 ? bitrateKbpsTarget(targetMb, durasi) : null;
      const kunci = `${codec}|${level ?? ""}|${br ?? ""}`;
      let e = cacheEnc.get(kunci);
      if (!e) {
        e = await pilihEncoder(p.pakaiGpu !== false, preset, crf, ff.bin, codec, level, br);
        cacheEnc.set(kunci, e);
      }
      return e;
    };
    const it0 = daftar[0];
    const d0 = dimensiOutput(it0.pengaturan.mode, it0.pengaturan.resolusi, it0.pengaturan.resolusiOutput, it0.info.lebar, it0.info.tinggi);
    job.akselerasi = (await ambilEnc(it0.pengaturan, d0.W, d0.H, it0.info.fps, it0.info.durasi)).nama;

    // v0.8.0 — outputs diisi LANGSUNG saat tiap part selesai (bukan menunggu SEMUA
    // video tuntas): slot menyimpan urutan antrean, segarkanOutput() menyalin isi slot
    // ke job.outputs sehingga UI bisa menampilkan & mengunduh hasil sedini mungkin.
    const slot: (KeluaranJob | null)[] = [];
    let pengisi = 0;
    // v2.1.0 — thumbnail tidak menempati slot part (urutan tetap rapi);
    // masuk ekor outputs setelah partnya tercatat
    const slotThumb: KeluaranJob[] = [];
    const segarkanOutput = () => {
      job.outputs = [...slot.filter((s): s is KeluaranJob => !!s), ...slotThumb];
    };

    /** v2.1.0 — THUMBNAIL OTOMATIS satu part: frame dari SUMBER (bersih tanpa
     *  tulisan terbakar) + judul dr NAMA FILE + label Part/Bagian/Episode.
     *  Gagal thumbnail TIDAK menggagalkan job (null → dilewati senyap). */
    const buatThumbnailPart = async (
      it: ItemEkspor,
      n: number,
      mulaiPart: number,
      durasiPart: number,
      W: number,
      H: number,
      slug: string,
      tag: string,
      thumb: OpsiThumbnail,
    ): Promise<KeluaranJob | null> => {
      try {
        const skala = Math.min(W, H) / 1080;
        const teksJ = bungkusTeks(bersihkanNamaJudul(it.nama), W * 0.92, Math.max(14, 52 * skala), "tebal");
        const lbl = labelThumbnail(thumb, n);
        const fileJ = path.join(dirTmp, `${tag}-thumb-j.txt`);
        const fileL = path.join(dirTmp, `${tag}-thumb-l.txt`);
        writeFileSync(fileJ, teksJ, "utf8");
        writeFileSync(fileL, lbl, "utf8");
        const ekst = thumb.format === "png" ? "png" : "jpg";
        const keluarT = path.join(folder, `${slug}-part-${String(n).padStart(2, "0")}-thumbnail.${ekst}`);
        const argsT = bangunArgumenThumbnail({
          src: it.srcAbs,
          // v2.2.1 — durasi total dikirim → frame DIPETAKAN ke menit 1–3 video
          // (permintaan user: pengambilan cover menit 1–3 agar cepat)
          detik: detikFrameThumbnail(mulaiPart, durasiPart, it.info.durasi),
          judulTxt: teksJ,
          labelTxt: lbl,
          W,
          H,
          fileJudul: fileJ,
          fileLabel: fileL,
          ukuranJudul: 52,
          ukuranLabel: 74,
          fontfile: fontfileNama("tebal"),
          keluar: keluarT,
          format: thumb.format,
        });
        await jalankanFfmpeg(argsT, 1, undefined, ff.bin);
        return { video: it.nama, file: path.basename(keluarT), ukuran: statSync(keluarT).size };
      } catch {
        return null;
      }
    };
    const fraksi = new Map<string, number>(); // "vi:part" → 0..1
    // v0.58.0 — fraksi part yang sudah BERAKHIR ditumpuk ke dasar: dulu entri
    // dihapus di .finally() sehingga progresTotal TURUN setiap part selesai
    // (bar maju-mundur, berakhir 0% padahal ekspor sukses)
    let dasarSelesai = 0;
    // v2.0.0 — total part kini DINAMIS (split per adegan memastikan jumlahnya
    // setelah analisis) → dihitung dari antrean setiap pembaruan
    const totalPartKini = () => job.antrean.reduce((a, v) => a + Math.max(1, v.total), 0);

    const perbaruiProgres = () => {
      let aktif = 0;
      for (const f of fraksi.values()) aktif += f;
      job.progresTotal = Math.min(
        100,
        Math.round(((dasarSelesai + aktif) / Math.max(1, totalPartKini())) * 100),
      );
      let rata = 0;
      if (fraksi.size) {
        for (const f of fraksi.values()) rata += f;
        rata /= fraksi.size;
      }
      job.progresPart = Math.round(rata * 100);
      job.partAktif = fraksi.size;
    };

    /** render SATU part dari video ke-vi — v2.0.0: konteks adegan/backsound/pembicara */
    const renderSatu = async (
      vi: number,
      it: ItemEkspor,
      n: number,
      subLatar: TranskripLatar | null,
      aset46: { neon: SeqNeon | null; templatBg: string | null },
      konteks: {
        potonganAdgn: PotonganAdegan[];
        durasiPartEff: number;
        backsoundAbs: string | null;
        filePembicara: string | null;
        /** v2.1.0 — file suara intro (absolut) atau null */
        suaraIntroAbs: string | null;
        /** v2.1.0 — opsi thumbnail otomatis */
        thumb: OpsiThumbnail;
      },
    ) => {
      if (apakahBatal(id)) throw new Error("DIBATALKAN");
      const p = it.pengaturan;
      // v0.57.0 — rentang part melompati zona hapus bila ada (part TIDAK
      // PERNAH berisi bagian yang dihapus); tanpa zona = jalur lama PERSIS.
      // v2.0.0 — SPLIT PER ADEGAN: part ke-n = potongan adegan ke-n (tepat di
      // pergantian adegan); jumlah otomatis: durasiPart = durasi efektif ÷ N.
      const [mulai, durasi] =
        konteks.potonganAdgn.length
          ? (() => {
              const pot = konteks.potonganAdgn[Math.min(Math.max(1, n), konteks.potonganAdgn.length) - 1];
              return [pot.mulai, Math.max(0.5, pot.akhir - pot.mulai)] as [number, number];
            })()
          : p.zonaHapus && p.zonaHapus.length
            ? rentangPartHapus(n, it.info.durasi, konteks.durasiPartEff, p.mulaiDetik, p.akhirDetik, p.zonaHapus)
            : rentangPart(n, it.info.durasi, konteks.durasiPartEff, p.mulaiDetik, p.akhirDetik);
      const kec2 = rapikanKecepatanLocal(p.kecepatanVideo);
      // v0.7.0 mode "asli" — v2.0.0: dimensiOutput (resolusi 720p/1080p/2K/4K
      // terkunci dgn 9:16 dibalik; auto = perilaku lama; asli = sumber genap)
      const { W, H } = dimensiOutput(p.mode, p.resolusi, p.resolusiOutput, it.info.lebar, it.info.tinggi);
      const fps = Math.min(60, Math.max(15, Math.round(it.info.fps)));
      const slug = slugPerVideo[vi] || slugify(p.judul) || "vidsplit";
      const nama = `${slug}-part-${String(n).padStart(2, "0")}.mp4`;
      const keluar = path.join(folder, nama);
      const tag = `${id}-${vi}-${n}`;
      // v0.44.0 — bangun berkas .ass subtitle utk part ini (bila subtitle aktif
      // dan hasil analisis suara tersedia); waktu segmen RELATIF RENTANG TRIM
      // v2.1.0 — GATING INTRO (introTampil): part tanpa intro benar-benar dirender
      // TANPA bg (durasi/offset backsound/offset subtitle ikut konsisten).
      // v2.2.0 — BACKGROUND INTRO DARI VIDEO: frame diambil OTOMATIS dari video
      // SUMBER (bersih tanpa tulisan terbakar) pada posisi p.introPosisi di
      // dalam potongan ini (0–100%). Ekstraksi 1 frame cepat (-ss + 1 frame);
      // gagal → part dirender TANPA intro (tidak menggagalkan job) + peringatan.
      const totalPartVid = konteks.potonganAdgn.length || Math.max(1, job.antrean[vi].total);
      let bgPart: string | null = null;
      if (p.introAktif && pilihBgPart(p.introTampil, n, totalPartVid)) {
        const fileFrame = path.join(dirTmp, `${tag}-introbg.png`);
        try {
          // v2.2.1 — posisi frame DIPETAKAN ke MENIT 1–3 video (detikRentangCover
          // via detikFrameIntro dgn durasi total) → seek dekat awal = cepat;
          // frame langsung diskalakan ke W×H output (PNG kecil, intro ringan).
          const dtkFrame = detikFrameIntro(mulai, durasi, p.introPosisi, it.info.durasi);
          await jalankanFfmpeg(
            bangunArgumenFrameSumber(it.srcAbs, dtkFrame, fileFrame, W, H),
            1,
            undefined,
            ff.bin,
          );
          bgPart = existsSync(fileFrame) ? fileFrame : null;
        } catch {
          bgPart = null;
        }
        if (!bgPart && !job.peringatanSubtitle) {
          job.peringatanSubtitle = `${it.nama}: frame intro gagal diambil — part ${n} dirender tanpa intro`;
        }
      }
      const pakaiBg = !!bgPart;
      // v2.0.0 — BACKSOUND: posisi lagu KONTINU antar part (offset fungsi murni
      // dgn zona/intro/kecepatan ikut), volume 0–150 %
      const offsetBs = konteks.backsoundAbs
        ? offsetBacksound(
            n,
            it.info.durasi,
            konteks.durasiPartEff,
            p.mulaiDetik,
            p.akhirDetik,
            p.zonaHapus || [],
            pakaiBg,
            p.durasiIntro,
            kec2,
            // v2.1.0 — intro hanya di sebagian part → offset lagu ikut aturan itu
            (k) => pilihBgPart(p.introTampil, k, totalPartVid),
          )
        : 0;
      // v0.53.0 — transkrip berjalan DI LATAR: tunggu sampai blok audio zona
      // part ini selesai dianalisis (umumnya sudah lama selesai krn render lebih
      // lambat dr transkrip). Blok zona gagal? part tetap dirender tanpa teks.
      let segmenSub: SegmenSub[] | null = null;
      if (subLatar) {
        segmenSub = await tungguCakupanDenganBatal(
          subLatar,
          mulai - p.mulaiDetik + durasi,
          id,
        );
      }
      let fileSub: string | null = null;
      if (segmenSub && segmenSub.length) {
        const ass = bangunAssSubtitle({
          segmen: segmenSub,
          // rentangPart: mulai ABSOLUT video → relatif trim = mulai - p.mulaiDetik
          mulaiPartRel: mulai - p.mulaiDetik,
          durasiPart: durasi,
          offsetIntro: pakaiBg ? p.durasiIntro : 0,
          W,
          H,
          ukuran: p.subtitleUkuran,
          yPersen: p.subtitleY,
          // v0.54.0 — warna teks & outline subtitle pilihan user
          warna: p.subtitleWarna,
          warnaOutline: p.subtitleOutlineWarna,
        });
        if (ass) {
          fileSub = path.join(dirTmp, `${tag}-sub.ass`);
          try {
            writeFileSync(fileSub, ass, "utf8");
          } catch {
            fileSub = null;
          }
        }
      }
      const enc = await ambilEnc(p, W, H, fps, (pakaiBg ? p.durasiIntro + durasi : durasi) / kec2);
      if (!job.akselerasi.includes(enc.nama)) {
        job.akselerasi = `${job.akselerasi} + ${enc.nama}`;
      }
      const { args, total } = bangunArgumenPart({
        src: it.srcAbs,
        bg: bgPart,
        logo: it.logoAbs,
        frameAbs: it.frameAbs ?? null,
        neon: aset46.neon,
        templatBg: aset46.templatBg,
        pengaturan: p,
        n,
        mulai,
        durasi,
        W,
        H,
        fps,
        adaAudio: it.info.adaAudio,
        judulTxt: p.judul || "",
        partTxt: `${p.kataPart || "Part"} ${n}`,
        deskripsiTxt: p.deskripsi || "",
        fileSub,
        // v2.0.0 — backsound + zoom pembicara
        fileBacksound: konteks.backsoundAbs,
        volumeBacksound: p.backsoundVolume,
        offsetBacksound: offsetBs,
        filePembicara: konteks.filePembicara,
        sumberLebar: it.info.lebar,
        sumberTinggi: it.info.tinggi,
        // v2.1.0 — suara intro
        fileSuaraIntro: konteks.suaraIntroAbs,
        // v2.2.0 — teks intro OTOMATIS: judul dr nama file + label kata-part NN
        introJudulTxt: bgPart ? bersihkanNamaJudul(it.nama) : "",
        introLabelTxt: bgPart ? labelIntro(p.kataPart, n) : "",
        dirTmp,
        tag,
        codecArgs: enc.codecArgs,
        keluar,
      });
      const slotIdx = pengisi++;
      return jalankanFfmpeg(args, total, (f) => {
        fraksi.set(`${vi}:${n}`, f);
        perbaruiProgres();
      }, ff.bin, (c) => daftarkanProses(id, c))
        .then(() => {
          slot[slotIdx] = { video: it.nama, file: nama, ukuran: statSync(keluar).size };
          job.antrean[vi].selesai += 1;
          segarkanOutput(); // v0.8.0 — part baru selesai → langsung tampak di UI
          // v2.1.0 — THUMBNAIL OTOMATIS: gagal diabaikan (job tetap sukses);
          // hasil masuk ekor outputs (ikut unduhan & ZIP)
          if (konteks.thumb?.aktif) {
            void buatThumbnailPart(it, n, mulai, durasi, W, H, slug, tag, konteks.thumb)
              .then((hasil) => {
                if (hasil) {
                  slotThumb.push(hasil);
                  segarkanOutput();
                }
              })
              .catch(() => {});
          }
        })
        .finally(() => {
          // v0.58.0 — pembersihan temp dipindah ke finally: dulu hanya di jalur
          // sukses — render gagal/batal menetaskan 3-4 berkas yatim per part
          // di work/tmp yang menumpuk selamanya
          for (const akhiran of ["judul", "part", "deskripsi", "sub", "intro", "intro-l", "thumb-j", "thumb-l"]) {
            try {
              unlinkSync(path.join(dirTmp, `${tag}-${akhiran}.txt`));
            } catch {
              /* abaikan */
            }
            try {
              unlinkSync(path.join(dirTmp, `${tag}-${akhiran}.ass`));
            } catch {
              /* abaikan */
            }
          }
          // v2.2.0 — PNG frame intro ikut dibersihkan
          try {
            unlinkSync(path.join(dirTmp, `${tag}-introbg.png`));
          } catch {
            /* abaikan */
          }
          const f = fraksi.get(`${vi}:${n}`);
          if (f !== undefined) dasarSelesai += f;
          fraksi.delete(`${vi}:${n}`);
          perbaruiProgres();
        });
    };

    /** render semua part satu video — pool paralel; antrean video BERURUTAN.
     *  Bila video ini gagal, tandai gagal lalu antrean LANJUT ke video berikutnya.
     *  v2.0.0 — SPLIT PER ADEGAN: analisis dijalankan SEBELUM render (tahap UI
     *  "Analisis adegan…"), total part dipastikan, part = potongan adegan;
     *  ZOOM PEMBICARA: analisis AI LATAR — part menunggu keyframe.
     *  KOMPRES PINTAR targetMb diteruskan via pengaturan (route menyuntikkan). */
    const renderVideo = async (
      vi: number,
      it: ItemEkspor,
      subLatar: TranskripLatar | null,
      aset46: { neon: SeqNeon | null; templatBg: string | null },
    ) => {
      job.videoAktif = vi;
      job.antrean[vi].status = "proses";
      const p = it.pengaturan;

      // ---------- v2.0.0 — SPLIT PER ADEGAN (sinkron, sebelum part pertama) ----------
      let potonganAdgn: PotonganAdegan[] = [];
      if (p.modeSplit === "adegan") {
        const t0 = Date.now();
        job.antrean[vi].tahap = "Analisis adegan…";
        const pemantau = setInterval(() => {
          job.antrean[vi].tahap = `Analisis adegan… ${Math.round((Date.now() - t0) / 1000)} dtk`;
        }, 1000);
        try {
          const batas = await analisisAdegan(
            it.srcAbs,
            ff.bin,
            it.info.durasi,
            p.mulaiDetik,
            p.akhirDetik,
            p.zonaHapus || [],
          );
          potonganAdgn = potonganAdegan(
            batas,
            it.info.durasi,
            p.mulaiDetik,
            p.akhirDetik,
            p.zonaHapus || [],
          );
          // total part = jumlah potongan adegan SEBELUM part dirender (bar akurat)
          job.antrean[vi].total = Math.max(1, potonganAdgn.length);
        } catch (e) {
          // analisis gagal → jatuh ke pemecahan per durasi (perilaku aman)
          job.antrean[vi].total = hitungPartV2(
            it.info.durasi, p, p.mulaiDetik, p.akhirDetik, p.zonaHapus || [],
          );
          if (!job.peringatanSubtitle) {
            job.peringatanSubtitle = `${it.nama}: analisis adegan gagal (${e instanceof Error ? e.message : String(e)}) — pemecahan per durasi dipakai`;
          }
        } finally {
          clearInterval(pemantau);
          delete job.antrean[vi].tahap;
        }
      }
      const durasiPartEff = durasiPartDipakai(p, it.info.durasi, p.mulaiDetik, p.akhirDetik, p.zonaHapus || []);

      // ---------- v2.0.0 — ZOOM PEMBICARA (AI LATAR + cadangan stereo) ----------
      let latarPembicara: PembicaraLatar | null = null;
      let filePembicara: string | null = null;
      if (p.zoomPembicara !== "mati") {
        latarPembicara = new PembicaraLatar(it.srcAbs, ff.bin, {
          mulai: p.mulaiDetik,
          durasi: durasiEfektif(it.info.durasi, p.mulaiDetik, p.akhirDetik),
          lebarSumber: it.info.lebar,
          tinggiSumber: it.info.tinggi,
          senyap: p.senyapPembicara === "semua" ? "semua" : "tetap",
          onTahap: (t) => { job.antrean[vi].tahap = `AI pembicara: ${t}`; },
          pakaiCadanganStereo: true,
        });
        try {
          let kf: Keyframe[] = await latarPembicara.tunggu(() => apakahBatal(id));
          // cadangan 2-BAGIAN: AI tak mengenali → energi stereo L/R (kiri/kanan)
          if (latarPembicara.cadangan && it.info.adaAudio) {
            job.antrean[vi].tahap = "AI pembicara: mode cadangan 2 bagian (kiri/kanan)…";
            try {
              const { L, R, langkahDtk } = await ekstrakStereoEnergi(
                it.srcAbs, ff.bin, p.mulaiDetik,
                durasiEfektif(it.info.durasi, p.mulaiDetik, p.akhirDetik),
              );
              kf = cadanganDuaBagian(L, R, langkahDtk, p.senyapPembicara === "semua" ? "semua" : "tetap");
              // stereo SEIMBANG (mono/lahirdi tengah) → kamera tengah statis
              if (kf.length === 1 && Math.abs(kf[0].cx - 0.25) < 0.001) {
                const seimbang = L.every((l, i) => Math.abs(l - (R[i] ?? 0)) < 1e-6);
                if (seimbang) kf = [{ t: 0, cx: 0.5 }];
              }
            } catch {
              kf = [{ t: 0, cx: 0.5 }]; // kamera tengah (tetap vertikal)
            }
          }
          if (kf.length) {
            filePembicara = path.join(dirTmp, `${id}-${vi}-pembicara.json`);
            try {
              writeFileSync(filePembicara, JSON.stringify(kf), "utf8");
            } catch {
              filePembicara = null;
            }
          }
        } catch (e) {
          // bukan DIBATALKAN → lanjut tanpa zoom (peringatan); DIBATALKAN di-lempar
          if (!(e instanceof Error) || e.message !== "DIBATALKAN") {
            if (!job.peringatanSubtitle) {
              job.peringatanSubtitle = `${it.nama}: zoom pembicara dilewati (${e instanceof Error ? e.message : String(e)})`;
            }
          }
        } finally {
          delete job.antrean[vi].tahap;
        }
        if (apakahBatal(id)) {
          job.antrean[vi].status = "dibatalkan";
          return;
        }
      }

      // ---------- v2.0.0 — BACKSOUND: resolve path sekali per video ----------
      let backsoundAbs: string | null = null;
      if (p.backsoundAktif && p.backsoundFile) {
        try {
          const c = pathAman(p.backsoundFile);
          if (existsSync(c)) backsoundAbs = c;
          else if (!job.peringatanSubtitle) {
            job.peringatanSubtitle = `${it.nama}: berkas backsound tidak ditemukan — musik dilewati`;
          }
        } catch {
          if (!job.peringatanSubtitle) {
            job.peringatanSubtitle = `${it.nama}: path backsound tidak diizinkan — musik dilewati`;
          }
        }
      }
      // v2.1.0 — SUARA INTRO: resolve path (pola backsound, gagal = senyap dilewati)
      let suaraIntroAbs: string | null = null;
      if (p.introSuaraFile) {
        try {
          const c = pathAman(p.introSuaraFile);
          if (existsSync(c)) suaraIntroAbs = c;
        } catch {
          /* dilewati */
        }
      }
      const konteks = {
        potonganAdgn,
        durasiPartEff,
        backsoundAbs,
        filePembicara,
        suaraIntroAbs,
        thumb: thumbnail,
      };

      const nTotal = Math.max(1, job.antrean[vi].total);
      let berikut = 1;
      let gagal = false;
      let sedangRender = 0; // jumlah ffmpeg aktif utk video ini
      const pekerja = Array.from({ length: Math.min(paralel, nTotal) }, async () => {
        while (true) {
          if (apakahBatal(id)) return;
          // v0.56.0 — SELAMA transkrip AI latar masih berjalan, render aktif
          // dibatasi SATU part: pool ffmpeg (default 2) + sesi Whisper di mesin
          // 8 core membuat tiap render cuma dapat <1 core → fps=1.9, speed=0.06x
          // → kena batas waktu (laporan user v0.55, encoder pun sudah QSV GPU).
          // Satu part dgn CPU lega selesai LEBIH CEPAT dr dua part berebutan;
          // setelah AI tuntas (sukses/gagal) atau tanpa AI → paralel penuh.
          while (subLatar && !subLatar.apakahTuntas() && sedangRender > 0) {
            if (apakahBatal(id)) return;
            await new Promise<void>((ok) => setTimeout(ok, 500));
          }
          const n = berikut;
          berikut += 1;
          if (n > nTotal || gagal) return;
          sedangRender += 1;
          try {
            await renderSatu(vi, it, n, subLatar, aset46, konteks);
          } catch (e) {
            // dibatalkan ≠ gagal — keluar senyap, status dibatalkan diset di luar
            if (apakahBatal(id)) return;
            // v0.58.0 — encoder GPU gagal di runtime (driver reset/jatah habis)?
            // kosongkan cache uji GPU + cache encoder job agar video BERIKUTNYA
            // otomatis menguji ulang & jatuh ke CPU (dulu: gagal beruntun)
            const pesan = e instanceof Error ? e.message : String(e);
            if (/nvenc|qsv|amf/i.test(pesan)) {
              resetUjiGpu();
              cacheEnc.clear();
            }
            // hentikan pengambilan part baru video INI; part berjalan biar selesai
            if (!gagal) {
              gagal = true;
              job.error = `${it.nama}: ${pesan}`;
            }
          } finally {
            sedangRender -= 1;
          }
        }
      });
      await Promise.all(pekerja);
      if (apakahBatal(id)) {
        job.antrean[vi].status = "dibatalkan";
        return;
      }
      if (gagal) {
        job.antrean[vi].status = "gagal";
        job.adaGagal = true;
      } else {
        job.antrean[vi].status = "selesai";
      }
    };

    for (let vi = 0; vi < daftar.length; vi++) {
      if (apakahBatal(id)) break;
      const it = daftar[vi];
      // v0.53.0 — SUBTITLE AI LATAR: transkrip dijalankan BERBARENGAN dgn render
      // part (dulu: analisis SELURUH video menunggu tuntas SEBELUM part pertama
      // dirender → video 30 mnt+ tampak "tidak mulai-mulai" berpuluh menit).
      // Eksport & part mulai seketika; part N hanya menunggu blok audio zona-nya.
      let subLatar: TranskripLatar | null = null;
      if (it.pengaturan.subtitleAktif && it.info.adaAudio) {
        const mulaiAi = Date.now();
        const pemantau = setInterval(() => {
          // hanya isi bila kosong — progres transkrip (onTahap) diutamakan
          if (!job.antrean[vi].tahap) {
            job.antrean[vi].tahap = `AI: analisis suara… ${Math.round((Date.now() - mulaiAi) / 1000)} dtk`;
          }
        }, 1000);
        const bersihkan = () => {
          clearInterval(pemantau);
          delete job.antrean[vi].tahap;
        };
        try {
          subLatar = await mulaiTranskripLatar(
            it.srcAbs,
            it.pengaturan.mulaiDetik,
            it.pengaturan.akhirDetik,
            it.info.durasi,
            ff.bin,
            {
              onTahap: (t) => { job.antrean[vi].tahap = `AI: ${t}`; },
              // v0.47.0 — fokus Indonesia bawaan (cepat); deteksi ID/EN opt-in
              modeBahasa: it.pengaturan.subtitleDeteksiBahasa ? "deteksi" : "fokus",
              // v0.51.0 — pilihan model: Whisper Base (cepat) vs Small (bawaan, tepat)
              modelCepat: it.pengaturan.subtitleCepat === true,
              // v0.53.0 — ekspor dibatalkan → transkrip berhenti ambil blok baru
              apakahBerhenti: () => apakahBatal(id),
            },
          );
        } catch (e) {
          if (!job.peringatanSubtitle) {
            job.peringatanSubtitle = `Subtitle AI dilewati: ${
              e instanceof Error ? e.message : String(e)
            }`;
          }
        }
        if (!subLatar) {
          bersihkan();
        } else {
          // latar: peringatan + tahap diperbarui saat transkrip berakhir
          void subLatar.janji
            .then((hasil) => {
              if (hasil) {
                if (hasil.bahasa === "en" && !hasil.diterjemahkan && !job.peringatanSubtitle) {
                  job.peringatanSubtitle =
                    "Penerjemah EN→ID tidak tersedia — subtitle dipakai dalam bahasa Inggris asli";
                }
                // v0.47.0 — sebagian blok gagal dianalisis (jarang): teks bisa kurang
                if (hasil.peringatan && !job.peringatanSubtitle) {
                  job.peringatanSubtitle = `${it.nama}: ${hasil.peringatan}`;
                }
              } else if (!job.peringatanSubtitle) {
                job.peringatanSubtitle =
                  "Mesin subtitle AI tidak tersedia (model tidak ditemukan) — video dirender tanpa subtitle";
              }
            })
            .catch((e) => {
              if (!job.peringatanSubtitle) {
                job.peringatanSubtitle = `Subtitle AI dilewati: ${
                  e instanceof Error ? e.message : String(e)
                }`;
              }
            })
            .finally(bersihkan);
        }
      } else if (it.pengaturan.subtitleAktif && !it.info.adaAudio) {
        job.antrean[vi].tahap = undefined;
        if (!job.peringatanSubtitle) {
          job.peringatanSubtitle = `${it.nama}: tanpa track audio — subtitle AI dilewati`;
        }
      }
      // v0.46.0 — FRAME & BINGKAI: siapkan aset SEKALI per video (cache param).
      // Gagal siapkan TIDAK menggagalkan ekspor — lanjut tanpa frame/neon/templat.
      const aset46: { neon: SeqNeon | null; templatBg: string | null } = { neon: null, templatBg: null };
      try {
        const pgh = it.pengaturan;
        // v2.0.0 — dimensi target ekspor video ini via dimensiOutput (resolusi
        // 720p/1080p/2K/4K terkunci dgn 9:16 dibalik; auto = perilaku lama)
        const dT = dimensiOutput(pgh.mode, pgh.resolusi, pgh.resolusiOutput, it.info.lebar, it.info.tinggi);
        const Wt = dT.W;
        const Ht = dT.H;
        const lanskap = Wt > Ht;
        // frame hiasan (resolve path bawaan/unggahan — varian rasio yang pas)
        if (!it.frameAbs && pgh.frameId) it.frameAbs = siapkanBingkai(pgh.frameId, lanskap);
        // v0.54.0 — RECOLOR frame (warna solid/gradasi pilihan user, bentuk tetap).
        // Gagal pewarnaan TIDAK menggagalkan ekspor (fallback path asli di dalam).
        if (it.frameAbs && (pgh.frameWarna || pgh.frameWarna2)) {
          it.frameAbs = await siapkanBingkaiWarna(
            it.frameAbs,
            pgh.frameWarna || "",
            pgh.frameWarna2 || "",
            ff.bin,
          );
        }
        // neon berputar — rect: mode template = kotak video, lainnya kanvas penuh
        const neon = neonDari(pgh);
        if (neon.aktif) {
          const rect =
            pgh.mode === "template"
              ? kotakKePx(TATA_TEMPLATE.video, Wt, Ht)
              : { x: 0, y: 0, w: Wt, h: Ht };
          const seq = await siapkanSequenceNeon(rect.w, rect.h, neon);
          aset46.neon = { ...seq, x: rect.x, y: rect.y, w: rect.w, h: rect.h };
        }
        // latar template halaman
        if (pgh.mode === "template") {
          aset46.templatBg = await siapkanLatarTemplate(Wt, Ht, templatDari(pgh));
        }
      } catch (e) {
        job.peringatanSubtitle =
          (job.peringatanSubtitle ? `${job.peringatanSubtitle} · ` : "") +
          `Frame/bingkai dilewati: ${e instanceof Error ? e.message : String(e)}`;
        aset46.neon = null;
        aset46.templatBg = null;
      }
      await renderVideo(vi, it, subLatar, aset46);
      // v0.53.0 — pastikan transkrip latar tuntas (cache tersimpan, peringatan
      // terpasang) sebelum lanjut video berikutnya — part terakhir sudah
      // menjamin cakupan penuh, jadi ini biasanya langsung selesai.
      if (subLatar) await subLatar.janji.catch(() => null);
    }

    // rapikan urutan akhir — slot menjaga posisi meski ada video yang gagal di tengah
    segarkanOutput();

    if (apakahBatal(id)) {
      // pembatalan: tandai status, buang file parsial yang tak jadi, jaga hasil utuh
      for (const v of job.antrean) {
        if (v.status === "menunggu" || v.status === "proses") v.status = "dibatalkan";
      }
      job.error = null;
      job.dibatalkan = true;
      try {
        const utuh = new Set(job.outputs.map((o) => o.file));
        for (const f of readdirSync(folder)) {
          if (f.endsWith(".mp4") && !utuh.has(f)) {
            try {
              unlinkSync(path.join(folder, f));
            } catch {
              /* abaikan */
            }
          }
        }
      } catch {
        /* folder mungkin belum ada */
      }
    }

    // v0.6.4 — simpan otomatis: salin hasil ke folder tujuan yang dipilih user
    // SEBELUM proses dimulai. Hasil tetap tersedia di aplikasi; salinan ini untuk
    // langsung dipakai di folder pilihan user tanpa mengunduh satu per satu.
    const setelan = muatSetelanTujuan();
    if (setelan.otomatis && setelan.folder && job.outputs.length) {
      job.menyalin = true;
      try {
        const hasil = await salinHasilKeTujuan(job, setelan.folder);
        job.folderTersimpan = hasil.folder;
        if (hasil.gagal.length) {
          job.peringatanSalin = `${hasil.gagal.length} dari ${job.outputs.length} file gagal disalin ke folder tujuan — salinan tetap ada di aplikasi`;
        } else if (setelan.bersihkanKerja) {
          buangSalinanKerja(job); // hemat ruang: hanya bila SEMUA file terverifikasi tersalin
        }
      } catch (e) {
        job.peringatanSalin = `Gagal menyalin ke folder tujuan: ${
          e instanceof Error ? e.message : String(e)
        }`;
      } finally {
        job.menyalin = false;
      }
    }

    job.videoAktif = -1;
    job.partAktif = 0;
    job.selesaiSemua = true;
    job.progresTotal = 100; // v0.58.0 — progres berakhir PASTI 100 (fraksi berbasis waktu bisa 99)
    catatRiwayat(job); // hasil tetap bisa diunduh ulang dari panel Riwayat
    bersihkanBatal(id);
  })().catch((e) => {
    job.error = e instanceof Error ? e.message : String(e);
    job.selesaiSemua = true;
    for (const v of job.antrean) {
      if (v.status === "menunggu" || v.status === "proses") v.status = "gagal";
    }
    job.adaGagal = true;
    catatRiwayat(job); // part yang sempat jadi sebelum gagal tetap tercatat
    bersihkanBatal(id);
  });

  return id;
}

/* ================= v2.0.0 — GABUNG VIDEO → SATU FILE ================= */

/**
 * GABUNG VIDEO (kebalikan split): SEMUA video di Kotak Video (urutan atas→bawah)
 * menjadi SATU MP4 utuh — timestamp menyambung MULUS:
 *   1. tiap video dirender SATU SEGMEN sesuai pengaturannya (mode vertikal,
 *      judul per film + subtitle + frame + backsound + zoom pembicara tetap ikut)
 *      ke dimensi/fps SAMA (dari pengaturan video PERTAMA);
 *   2. concat DEMUXER dgn -c copy → streaming tulis langsung ke disk (RAM datar),
 *      tanpa re-encode, cepat & bebas kehabisan memori walau antrean berjam-jam.
 * Zona hapus & jumlah part otomatis tidak relevan di mode gabung (segmen penuh).
 */
export function mulaiGabungAntrean(
  daftar: ItemEkspor[],
  modeEkspor: "presisi" | "cepat",
  /** v2.1.0 — THUMBNAIL OTOMATIS utk hasil gabungan (bawaan mati) */
  thumbnail: OpsiThumbnail = opsiThumbnailDefault,
): string {
  if (daftar.length < 2) {
    throw new Error("GABUNG VIDEO butuh minimal 2 video di Kotak Video");
  }
  const id = randomBytes(4).toString("hex");
  evictJobLama();
  jadwalkanPangkas();
  const folder = dirWork(`output/${id}`);
  const dirTmp = dirWork("tmp");
  // segmen dirender BERURUTAN (satu ffmpeg per waktu — concat butuh semua lengkap)
  const paralel = 1;

  // dimensi & fps target konsisten utk SEMUA segmen (dari video pertama)
  const it0 = daftar[0];
  const dT = dimensiOutput(it0.pengaturan.mode, it0.pengaturan.resolusi, it0.pengaturan.resolusiOutput, it0.info.lebar, it0.info.tinggi);
  const W = dT.W;
  const H = dT.H;
  const fpsTarget = Math.min(60, Math.max(15, Math.round(it0.info.fps)));
  const durasiTotal = daftar.reduce((a, it) => a + durasiEfektif(it.info.durasi, it.pengaturan.mulaiDetik, it.pengaturan.akhirDetik), 0);

  const job: InfoJob = {
    id,
    antrean: daftar.map((it) => ({
      nama: it.nama,
      total: 1,
      selesai: 0,
      status: "menunggu" as StatusVideo,
    })),
    videoAktif: -1,
    partAktif: 0,
    progresPart: 0,
    progresTotal: 0,
    outputs: [],
    error: null,
    adaGagal: false,
    selesaiSemua: false,
    batalDiminta: false,
    dibatalkan: false,
    dibuat: Date.now(),
    akselerasi: "mendeteksi…",
    paralel,
  };
  jobs.set(id, job);

  (async () => {
    const ff = await pilihFfmpeg();
    const butuhTeks = daftar.some(
      (it) =>
        !!(it.pengaturan.judul || "").trim() ||
        !!(it.pengaturan.deskripsi || "").trim(),
    );
    if (butuhTeks && !ff.drawtext) {
      throw new Error(
        `ffmpeg yang terpilih (${ff.bin}) tidak mendukung filter drawtext (libfreetype), padahal ada tulisan judul. Pasang ffmpeg lengkap atau arahkan VIDSPLIT_FFMPEG ke ffmpeg yang punya libfreetype.`,
      );
    }
    const preset = modeEkspor === "cepat" ? "ultrafast" : "medium";
    const crf = modeEkspor === "cepat" ? 23 : 20;
    const targetMb = (daftar[0]?.pengaturan as Pengaturan & { targetMb?: number }).targetMb || 0;
    const br = targetMb > 0 ? bitrateKbpsTarget(targetMb, durasiTotal) : null;
    const codec: CodecVideo = it0.pengaturan.codec === "h265" ? "h265" : "h264";
    const level = codec === "h264" ? levelH264(W, H, fpsTarget) : null;
    const enc = await pilihEncoder(it0.pengaturan.pakaiGpu !== false, preset, crf, ff.bin, codec, level, br);
    job.akselerasi = enc.nama;

    let dasarSelesai = 0;
    const perbarui = (f: number) => {
      job.progresTotal = Math.min(99, Math.round(((dasarSelesai + f) / daftar.length) * 100));
    };

    // --- tahap 1: render SATU SEGMEN per video (judul per film + sub tetap ikut) ---
    const segmen: string[] = [];
    const dirSeg = dirWork(`gabung/${id}`);
    for (let vi = 0; vi < daftar.length; vi++) {
      if (apakahBatal(id)) break;
      const it = daftar[vi];
      job.videoAktif = vi;
      job.antrean[vi].status = "proses";
      const p = it.pengaturan;
      const mulai = p.mulaiDetik;
      const durasi = durasiEfektif(it.info.durasi, p.mulaiDetik, p.akhirDetik);
      const kec = rapikanKecepatanLocal(p.kecepatanVideo);

      // subtitle AI (latar) — pola split; segmen tunggal menunggu tuntas penuh
      let subLatar: TranskripLatar | null = null;
      if (p.subtitleAktif && it.info.adaAudio) {
        const mulaiAi = Date.now();
        const pemantau = setInterval(() => {
          if (!job.antrean[vi].tahap) {
            job.antrean[vi].tahap = `AI: analisis suara… ${Math.round((Date.now() - mulaiAi) / 1000)} dtk`;
          }
        }, 1000);
        try {
          subLatar = await mulaiTranskripLatar(it.srcAbs, p.mulaiDetik, p.akhirDetik, it.info.durasi, ff.bin, {
            onTahap: (t) => { job.antrean[vi].tahap = `AI: ${t}`; },
            modeBahasa: p.subtitleDeteksiBahasa ? "deteksi" : "fokus",
            modelCepat: p.subtitleCepat === true,
            apakahBerhenti: () => apakahBatal(id),
          });
        } catch {
          subLatar = null;
        }
        if (!subLatar) clearInterval(pemantau);
        else void subLatar.janji.finally(() => clearInterval(pemantau));
      }

      // zoom pembicara (latar) — tiap film dianalisis sendiri
      let filePembicara: string | null = null;
      if (p.zoomPembicara !== "mati") {
        const latar = new PembicaraLatar(it.srcAbs, ff.bin, {
          mulai: p.mulaiDetik,
          durasi,
          lebarSumber: it.info.lebar,
          tinggiSumber: it.info.tinggi,
          senyap: p.senyapPembicara === "semua" ? "semua" : "tetap",
          onTahap: (t) => { job.antrean[vi].tahap = `AI pembicara: ${t}`; },
          pakaiCadanganStereo: true,
        });
        try {
          let kf: Keyframe[] = await latar.tunggu(() => apakahBatal(id));
          if (latar.cadangan && it.info.adaAudio) {
            try {
              const { L, R, langkahDtk } = await ekstrakStereoEnergi(it.srcAbs, ff.bin, p.mulaiDetik, durasi);
              kf = cadanganDuaBagian(L, R, langkahDtk, p.senyapPembicara === "semua" ? "semua" : "tetap");
            } catch {
              kf = [{ t: 0, cx: 0.5 }];
            }
          }
          if (kf.length) {
            filePembicara = path.join(dirTmp, `${id}-${vi}-pembicara.json`);
            writeFileSync(filePembicara, JSON.stringify(kf), "utf8");
          }
        } catch {
          /* lanjut tanpa zoom */
        } finally {
          delete job.antrean[vi].tahap;
        }
      }

      // backsound
      let backsoundAbs: string | null = null;
      if (p.backsoundAktif && p.backsoundFile) {
        try {
          const c = pathAman(p.backsoundFile);
          if (existsSync(c)) backsoundAbs = c;
        } catch { /* dilewati */ }
      }

      // subtitle .ass (segmen penuh)
      let fileSub: string | null = null;
      if (subLatar) {
        const segmenSub = await subLatar.tungguCakupan(durasi, () => apakahBatal(id)).catch(() => []);
        if (segmenSub && segmenSub.length) {
          const ass = bangunAssSubtitle({
            segmen: segmenSub,
            mulaiPartRel: 0,
            durasiPart: durasi,
            // v2.2.0 — GABUNG tanpa intro (permintaan user): offset 0
            offsetIntro: 0,
            W,
            H,
            ukuran: p.subtitleUkuran,
            yPersen: p.subtitleY,
            warna: p.subtitleWarna,
            warnaOutline: p.subtitleOutlineWarna,
          });
          if (ass) {
            fileSub = path.join(dirTmp, `${id}-${vi}-sub.ass`);
            writeFileSync(fileSub, ass, "utf8");
          }
        }
        await subLatar.janji.catch(() => null);
      }

      // aset frame/neon/templat
      const aset46: { neon: SeqNeon | null; templatBg: string | null } = { neon: null, templatBg: null };
      try {
        const lanskap = W > H;
        if (!it.frameAbs && p.frameId) it.frameAbs = siapkanBingkai(p.frameId, lanskap);
        if (it.frameAbs && (p.frameWarna || p.frameWarna2)) {
          it.frameAbs = await siapkanBingkaiWarna(it.frameAbs, p.frameWarna || "", p.frameWarna2 || "", ff.bin);
        }
        const neon = neonDari(p);
        if (neon.aktif) {
          const rect = p.mode === "template" ? kotakKePx(TATA_TEMPLATE.video, W, H) : { x: 0, y: 0, w: W, h: H };
          const seq = await siapkanSequenceNeon(rect.w, rect.h, neon);
          aset46.neon = { ...seq, x: rect.x, y: rect.y, w: rect.w, h: rect.h };
        }
        if (p.mode === "template") {
          aset46.templatBg = await siapkanLatarTemplate(W, H, templatDari(p));
        }
      } catch {
        aset46.neon = null;
        aset46.templatBg = null;
      }

      const namaSeg = `seg-${String(vi + 1).padStart(2, "0")}.mp4`;
      const keluar = path.join(dirSeg, namaSeg);
      const tag = `${id}-gab-${vi}`;
      const { args, total } = bangunArgumenPart({
        src: it.srcAbs,
        // v2.2.0 — GABUNG VIDEO TANPA intro (permintaan user): bg selalu null
        bg: null,
        logo: it.logoAbs,
        frameAbs: it.frameAbs ?? null,
        neon: aset46.neon,
        templatBg: aset46.templatBg,
        pengaturan: p,
        n: 1,
        mulai,
        durasi,
        W,
        H,
        fps: fpsTarget,
        adaAudio: it.info.adaAudio,
        judulTxt: p.judul || "",
        partTxt: "", // GABUNG: tanpa kata Part — judul per film tetap tampil
        deskripsiTxt: p.deskripsi || "",
        fileSub,
        fileBacksound: backsoundAbs,
        volumeBacksound: p.backsoundVolume,
        offsetBacksound: backsoundAbs ? durasiHasilSebelumGabung(daftar, vi) : 0,
        filePembicara,
        sumberLebar: it.info.lebar,
        sumberTinggi: it.info.tinggi,
        dirTmp,
        tag,
        codecArgs: enc.codecArgs,
        keluar,
      });
      await jalankanFfmpeg(args, total, (f) => perbarui((vi + f) / daftar.length), ff.bin, (c) => daftarkanProses(id, c));
      segmen.push(namaSeg);
      job.antrean[vi].selesai = 1;
      dasarSelesai = vi + 1;
      perbarui(0);
      job.antrean[vi].status = "selesai";
    }

    if (apakahBatal(id)) {
      for (const v of job.antrean) {
        if (v.status === "menunggu" || v.status === "proses") v.status = "dibatalkan";
      }
      job.dibatalkan = true;
      job.error = null;
    } else {
      // --- tahap 2: concat demuxer -c copy → tulis MENGALIR ke disk (RAM datar) ---
      const listTxt = segmen.map((s) => `file '${s.replace(/'/g, "'\\''")}'`).join("\n");
      const fileList = path.join(dirSeg, "list.txt");
      writeFileSync(fileList, listTxt + "\n", "utf8");
      const slug = slugify(daftar[0].pengaturan.judul || daftar[0].nama) || "vidsplit";
      const namaHasil = `gabung-${slug}.mp4`;
      const keluarHasil = path.join(folder, namaHasil);
      job.videoAktif = daftar.length;
      await jalankanFfmpeg(
        ["-f", "concat", "-safe", "0", "-i", fileList, "-c", "copy", "-movflags", "+faststart", keluarHasil],
        5,
        undefined,
        ff.bin,
        (c) => daftarkanProses(id, c),
        { absolutMs: 300_000, diamAwalMs: 300_000 },
      );
      job.outputs = [{ video: "gabung", file: namaHasil, ukuran: statSync(keluarHasil).size }];
      job.progresTotal = 99;
      for (const v of job.antrean) if (v.status === "menunggu") v.status = "selesai";
      // v2.1.0 — THUMBNAIL hasil gabungan: frame dari video PERTAMA (bersih),
      // judul dari nama filenya, tanpa label Part. Gagal = diabaikan.
      if (thumbnail.aktif) {
        try {
          const it0t = daftar[0];
          const dT0 = durasiEfektif(it0t.info.durasi, it0t.pengaturan.mulaiDetik, it0t.pengaturan.akhirDetik);
          const skala0 = Math.min(W, H) / 1080;
          const teksJ = bungkusTeks(bersihkanNamaJudul(it0t.nama), W * 0.92, Math.max(14, 52 * skala0), "tebal");
          const fileJ = path.join(dirTmp, `${id}-gab-thumb-j.txt`);
          const fileL = path.join(dirTmp, `${id}-gab-thumb-l.txt`);
          writeFileSync(fileJ, teksJ, "utf8");
          writeFileSync(fileL, "", "utf8");
          const ekst = thumbnail.format === "png" ? "png" : "jpg";
          const keluarT = path.join(folder, `gabung-${slug}-thumbnail.${ekst}`);
          const argsT = bangunArgumenThumbnail({
            src: it0t.srcAbs,
            // v2.2.1 — juga dipetakan ke menit 1–3 video pertama (cepat)
            detik: detikFrameThumbnail(it0t.pengaturan.mulaiDetik, dT0, it0t.info.durasi),
            judulTxt: teksJ,
            labelTxt: "",
            W,
            H,
            fileJudul: fileJ,
            fileLabel: fileL,
            ukuranJudul: 52,
            ukuranLabel: 74,
            fontfile: fontfileNama("tebal"),
            keluar: keluarT,
            format: thumbnail.format,
          });
          await jalankanFfmpeg(argsT, 1, undefined, ff.bin);
          job.outputs.push({ video: "gabung", file: path.basename(keluarT), ukuran: statSync(keluarT).size });
        } catch {
          /* thumbnail gabung gagal → diabaikan */
        }
      }
    }

    // simpan otomatis ke folder tujuan (pola split)
    const setelan = muatSetelanTujuan();
    if (setelan.otomatis && setelan.folder && job.outputs.length) {
      job.menyalin = true;
      try {
        const hasil = await salinHasilKeTujuan(job, setelan.folder);
        job.folderTersimpan = hasil.folder;
      } catch (e) {
        job.peringatanSalin = `Gagal menyalin ke folder tujuan: ${e instanceof Error ? e.message : String(e)}`;
      } finally {
        job.menyalin = false;
      }
    }

    job.videoAktif = -1;
    job.selesaiSemua = true;
    job.progresTotal = 100;
    catatRiwayat(job);
    bersihkanBatal(id);
  })().catch((e) => {
    job.error = e instanceof Error ? e.message : String(e);
    job.selesaiSemua = true;
    for (const v of job.antrean) {
      if (v.status === "menunggu" || v.status === "proses") v.status = "gagal";
    }
    job.adaGagal = true;
    catatRiwayat(job);
    bersihkanBatal(id);
  });

  return id;
}

/** Σ durasi HASIL segmen sebelum index vi (posisi lagu kontinu antar segmen)
 *  v2.2.0 — GABUNG tanpa intro → Σ durasi efektif saja */
function durasiHasilSebelumGabung(daftar: ItemEkspor[], vi: number): number {
  let sumber = 0;
  for (let k = 0; k < vi; k++) {
    const p = daftar[k].pengaturan;
    sumber += durasiEfektif(daftar[k].info.durasi, p.mulaiDetik, p.akhirDetik);
  }
  const kec = rapikanKecepatanLocal(daftar[0].pengaturan.kecepatanVideo);
  return Math.max(0, sumber / Math.max(0.1, kec));
}
