// VidSplit v0.30.0 — AI TEXT-TO-VIDEO GENERATOR: PEMBANGUN PROMPT VIDEO KOMIK.
// Alur Mode Cerita (permintaan user):
//   AI Story Generator -> (1) Text-to-Speech (TTS)  (2) AI Text-to-Video Generator
//   -> audio TTS disisipkan ke video, SEMUA DISINKRONKAN saat membuat video.
// "Prompt" utk generator video dibangun DARI cerita hasil AI Story Generator:
//   gaya KOMIK — gambar di ATAS (v0.34.0: panel berganti tiap ±2 detik dgn gambar
//   HANTU NUSANTARA sesuai yang disebut cerita — pocong, kuntilanak, genderuwo, dll.),
//   kolom teks cerita di BAWAH, TANPA tulisan bab/chapter di dalam video.
// Modul murni (tanpa node:*) — aman dipakai di client & server.
import type { Cerita } from "./hororCerita";
import { ADEGAN_GENRE, type JenisAdegan } from "./hororIlustrasi";
import { deteksiHantu, ambilGaleri } from "./hororGaleri";
import { ambilGenre, type GenreId } from "./videoAi";

export type KameraKomik = "dalam" | "keluar" | "geser-kiri" | "geser-kanan";

export const KAMERA_KOMIK: KameraKomik[] = ["dalam", "geser-kanan", "keluar", "geser-kiri"];

/** Satu adegan komik = satu panel video (gambar atas berganti, teks di kolom bawah). */
export interface AdeganKomik {
  /** indeks adegan mulai 0 */
  i: number;
  /** kalimat cerita yg tampil di kolom bawah & dibacakan TTS adegan ini */
  teks: string;
  /** jenis ilustrasi panel komik (harus berganti-ganti tiap adegan) */
  jenisAdegan: JenisAdegan;
  /** seed deterministik ilustrasi */
  seedAdegan: number;
  /** gerak kamera AI (Ken Burns): dekat/mundur/geser */
  kamera: KameraKomik;
  /** catatan prompt visual singkat (deskripsi panel utk generator) */
  catatan: string;
  /** v0.34.0 — id hantu galeri yang terdeteksi di kalimat ini (null = latar
   *  suasana). Dipakai renderer utk memilih gambar hantu Nusantara. */
  hantu?: string | null;
}

/** PROMPT LENGKAP utk AI Text-to-Video Generator — dibangun dari cerita. */
export interface PromptVideoKomik {
  /** v0.37.0 — "komik-sinematik" (bawaan) | "realistis-sinematik" (pustaka realistis) */
  gaya: "komik-sinematik" | "realistis-sinematik";
  judul: string;
  /** label halaman judul ikut genre (mis. "Sebuah Cerita Horor") */
  labelJudul: string;
  /** tata letak versi komik: gambar ATAS, kolom teks cerita BAWAH */
  layout: { gambar: "atas"; teksCerita: "bawah" };
  /** gambar berusaha berganti tiap ±2 detik mengikuti alur cerita (v0.34.0) */
  lajuAdeganDetik: number;
  adegan: AdeganKomik[];
  /** estimasi total durasi video (dtk) bila TTS tidak tersedia */
  estimasiDetik: number;
}

function prngPrompt(seed: number): () => number {
  let s = (seed || 1) >>> 0;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

/** Pecah satu paragraf jadi kalimat (titik/tanya/seru/…). Aman utk teks ID. */
export function pecahKalimat(paragraf: string): string[] {
  const bersih = (paragraf || "").replace(/\s+/g, " ").trim();
  if (!bersih) return [];
  const kasar: string[] = [];
  let kini = "";
  for (let p = 0; p < bersih.length; p++) {
    const c = bersih[p];
    kini += c;
    // akhir kalimat: . ! ? … (boleh diikuti tutup kutip)
    if (".!?…".includes(c)) {
      const sisanya = bersih.slice(p + 1);
      if (sisanya.length === 0 || /^\s/.test(sisanya)) {
        // sertakan tutup kutip yang menempel
        const m = sisanya.match(/^[”"']+/);
        if (m) { kini += m[0]; p += m[0].length; }
        kasar.push(kini.trim());
        kini = "";
      }
    }
  }
  if (kini.trim()) kasar.push(kini.trim());
  return kasar.filter(Boolean);
}

function jumlahKata(s: string): number {
  return s.split(/\s+/).filter(Boolean).length;
}

/** Kalimat panjang (>maks kata) dipecah di tanda baca tengah agar panel tetap singkat. */
function pecahKalimatPanjang(kalimat: string, maks = 22): string[] {
  if (jumlahKata(kalimat) <= maks) return [kalimat];
  // kandidat titik potong: ';' lalu ',' paling dekat tengah
  const tengah = kalimat.length / 2;
  let terbaik = -1;
  for (const tanda of [";", ","]) {
    let idx = kalimat.indexOf(tanda);
    while (idx >= 0) {
      if (idx > kalimat.length * 0.25 && idx < kalimat.length * 0.75) {
        if (terbaik < 0 || Math.abs(idx - tengah) < Math.abs(terbaik - tengah)) terbaik = idx;
      }
      idx = kalimat.indexOf(tanda, idx + 1);
    }
  }
  if (terbaik < 0) return [kalimat];
  const a = kalimat.slice(0, terbaik + 1).trim();
  const b = kalimat.slice(terbaik + 1).trim();
  if (!b) return [kalimat];
  return [...pecahKalimatPanjang(a, maks), ...pecahKalimatPanjang(b, maks)];
}

/** Semua paragraf cerita rata (satu alur utuh — tanpa judul bab). */
export function paragrafSatuAlur(cerita: Cerita): string[] {
  return cerita.bab.flatMap((b) => b.paragraf.map((p) => p.trim()).filter(Boolean));
}

const LABEL_ADEGAN: Record<JenisAdegan, [string, string]> = {
  // [gelap, cerah]
  "eksterior-rumah": ["rumah tua di tepi jalan", "rumah hangat di tepi jalan"],
  pemakaman: ["pemakaman sepi", "taman peringatan tenang"],
  hutan: ["hutan berdiri rapat", "hutan rindang berembun pagi"],
  kamar: ["kamar berlampu redup", "kamar penuh cahaya pagi"],
  lorong: ["lorong panjang berdebu", "lorong sekolah riang"],
  sosok: ["sosok samar di kejauhan", "sosok bersahabat menunggu"],
  gunung: ["punggungan gunung berlapis", "punggungan empat matahari terbit"],
  laut: ["laut luas berombak pelan", "laut biru memantulkan fajar"],
  kota: ["kota berjendela menyala", "kota riang berlangit cerah"],
};

const MOOD_TAHAP = ["pembuka", "mengembang", "menegangkan", "klimaks", "penutup"];

/** Label mood visual per posisi adegan (0..1). */
function moodAdegan(posisi: number): string {
  const i = Math.min(4, Math.floor(posisi * 5));
  return MOOD_TAHAP[i];
}

/**
 * Bangun PROMPT AI Text-to-Video Generator dari cerita hasil AI Story Generator.
 * - tiap adegan = 1 kalimat (dipendekkan bila kepanjangan) → panel berganti cepat (±2 dtk)
 * - kalimat sangat pendek digabung dgn tetangganya agar tak terlalu cepat ganti
 * - jenis ilustrasi SELALU berbeda dari adegan sebelumnya (berganti-ganti mengikuti alur)
 * - v0.34.0: hantu yang disebut kalimat terdeteksi → panel memakai gambar hantu itu
 * - v0.35.0: referensi pustaka 60 ilustrasi hantu/latar + variasi kamera-warna-kabut
 *   per potongan 2 dtk (perencana rencanaGambarCerita) → tiap potongan TAMPIL BEDA.
 * - v0.37.0: gayaIlus "realistis" → prompt menyebut ilustrasi REALISTIS sinematik
 *   (pustaka hantu-real) — agen pendamping menu 5.
 * - TANPA judul bab: hanya kalimat cerita yang masuk prompt.
 */
export function bangunPromptVideo(cerita: Cerita, genreId?: GenreId | null, gayaIlus: "komik" | "realistis" = "komik"): PromptVideoKomik {
  const genre = ambilGenre(genreId ?? (cerita.genre as GenreId | undefined) ?? "horor");
  const r = prngPrompt((cerita.seed ^ 0x5f3759df) >>> 0);
  const daftarAdegan = ADEGAN_GENRE[genre.id] ?? ADEGAN_GENRE.horor;

  // 1) kalimat → unit adegan
  const unit: string[] = [];
  for (const p of paragrafSatuAlur(cerita)) {
    for (const k of pecahKalimat(p)) unit.push(...pecahKalimatPanjang(k));
  }
  // 2) gabung kalimat terlalu pendek dgn berikutnya (min 5 kata)
  const gabung: string[] = [];
  for (const u of unit) {
    const terakhir = gabung[gabung.length - 1];
    if (terakhir && (jumlahKata(terakhir) < 5 || jumlahKata(u) < 5) && jumlahKata(terakhir) + jumlahKata(u) <= 26) {
      gabung[gabung.length - 1] = `${terakhir} ${u}`;
    } else gabung.push(u);
  }

  // 3) jadikan adegan komik
  let idxAdegan = Math.floor(r() * daftarAdegan.length);
  const adegan: AdeganKomik[] = [];
  for (let i = 0; i < gabung.length; i++) {
    // WAJIB berganti: lompat 1..2 posisi (daftar >= 3 jenis → selalu beda)
    idxAdegan = (idxAdegan + 1 + Math.floor(r() * 2)) % daftarAdegan.length;
    const jenis = daftarAdegan[idxAdegan];
    const posisi = gabung.length > 1 ? i / (gabung.length - 1) : 0;
    const label = LABEL_ADEGAN[jenis][genre.cerah ? 1 : 0];
    const kamera = KAMERA_KOMIK[(i + Math.floor(r() * 4)) % KAMERA_KOMIK.length];
    // v0.34.0 — deteksi hantu di kalimat ini → catatan prompt menyebut hantunya
    const idHantu = genre.cerah ? null : deteksiHantu(gabung[i]);
    const namaHantu = idHantu ? ambilGaleri(idHantu)?.label ?? null : null;
    const gayaPanel = gayaIlus === "realistis" ? "ilustrasi realistis sinematik" : "panel komik";
    adegan.push({
      i,
      teks: gabung[i],
      jenisAdegan: jenis,
      seedAdegan: (cerita.seed ^ (i * 2654435761) ^ 0x9e3779b9) >>> 0,
      kamera,
      catatan: `${gayaPanel} ${genre.nama.toLowerCase()} — ${moodAdegan(posisi)}: ${label}${namaHantu ? `, ${namaHantu} muncul dalam panel (referensi pustaka hantu${gayaIlus === "realistis" ? " realistis" : ""})` : ""}, gerak kamera ${kamera}, berganti tiap 2 dtk dgn gambar & pewarnaan berbeda-beda`,
      hantu: idHantu,
    });
  }

  const estimasi = adegan.reduce((s, a) => s + Math.max(3, jumlahKata(a.teks) / 2.6 + 1.5), 0);
  return {
    gaya: gayaIlus === "realistis" ? "realistis-sinematik" : "komik-sinematik",
    judul: cerita.judul,
    labelJudul: genre.labelJudul,
    layout: { gambar: "atas", teksCerita: "bawah" },
    lajuAdeganDetik: 2,
    adegan,
    estimasiDetik: Math.round(estimasi),
  };
}
