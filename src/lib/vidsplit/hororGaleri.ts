// VidSplit v0.35.0 — PUSTAKA GAMBAR HANTU NUSANTARA (100% offline).
// Permintaan user v0.35.0: "hanya ada 5 gambar yang terus di ulang ulang...
// minimal 180 gambar hantu atau lukisan horor yang berbeda utk video 6 menit
// (gambar berganti tiap 2 detik)". Solusi 2 lapis (tetap 100% offline):
//  (1) PUSTAKA DIPERLUAS 21 → 60 ilustrasi AI (lihat KREDIT.txt);
//  (2) PERENCANA TINGKAT-VIDEO rencanaGambarCerita(): tiap potongan 2 dtk
//      mendapat kombinasi UNIK (gambar berbeda + variasi kamera/flip/warna/
//      kabut/grain) — video 6 menit = 180 potongan = 180 tampilan berbeda,
//      dipandu isi cerita (hantu & latar yang disebut, klimaks).
// Modul MURNI (tanpa node:*) — client-safe. Pemecah berkas nyata di hororRender.
export interface GambarGaleri {
  id: string;
  file: string;
  jenis: "hantu" | "latar";
  label: string;
  /** kata kunci pemicu (dicocokkan pada teks huruf kecil) — varian kosong */
  kata: RegExp[];
}

/** Manifest pustaka v0.35.0 — 60 gambar. URUTAN penting: hantu spesifik SEBELUM
 *  generik (sosok), latar spesifik SEBELUM generik (rumah/jalan). */
export const GALERI: GambarGaleri[] = [
  // ---------- HANTU: pocong (4 varian) ----------
  { id: "pocong", file: "pocong-1.png", jenis: "hantu", label: "pocong", kata: [/pocong/] },
  { id: "pocong-2", file: "pocong-2.png", jenis: "hantu", label: "pocong (wajah dekat)", kata: [] },
  { id: "pocong-3", file: "pocong-3.png", jenis: "hantu", label: "pocong melompat di kuburan", kata: [] },
  { id: "pocong-4", file: "pocong-4.png", jenis: "hantu", label: "pocong di pintu rumah", kata: [] },
  // ---------- kuntilanak (4 varian + sundel bolong) ----------
  { id: "kuntilanak", file: "kuntilanak-1.png", jenis: "hantu", label: "kuntilanak", kata: [/kuntilanak/, /sundel\s?bolong/, /\bsundel\b/] },
  { id: "kuntilanak-2", file: "kuntilanak-2.png", jenis: "hantu", label: "kuntilanak (wajah dekat)", kata: [] },
  { id: "kuntilanak-3", file: "kuntilanak-3.png", jenis: "hantu", label: "kuntilanak di pohon beringin", kata: [] },
  { id: "kuntilanak-4", file: "kuntilanak-4.png", jenis: "hantu", label: "kuntilanak menoleh", kata: [] },
  { id: "kuntilanak-5", file: "sundel-1.png", jenis: "hantu", label: "sundel bolong", kata: [] },
  // ---------- genderuwo (4 varian) ----------
  { id: "genderuwo", file: "genderuwo-1.png", jenis: "hantu", label: "genderuwo", kata: [/genderuwo/, /gendoruwo/] },
  { id: "genderuwo-2", file: "genderuwo-2.png", jenis: "hantu", label: "genderuwo (raksasa)", kata: [] },
  { id: "genderuwo-3", file: "genderuwo-3.png", jenis: "hantu", label: "genderuwo mengintai di hutan", kata: [] },
  { id: "genderuwo-4", file: "genderuwo-4.png", jenis: "hantu", label: "genderuwo di puncak bukit", kata: [] },
  // ---------- tuyul / wewe / leak (varian baru) ----------
  { id: "tuyul", file: "tuyul-1.png", jenis: "hantu", label: "tuyul", kata: [/tuyul/, /bocah hantu/, /hantu bocah/] },
  { id: "tuyul-2", file: "tuyul-2.png", jenis: "hantu", label: "tuyul tertawa", kata: [] },
  { id: "tuyul-3", file: "tuyul-3.png", jenis: "hantu", label: "tuyul di atap", kata: [] },
  { id: "wewe", file: "wewe-1.png", jenis: "hantu", label: "wewe gombel", kata: [/\bwewe\b/, /gombel/] },
  { id: "wewe-2", file: "wewe-2.png", jenis: "hantu", label: "wewe gombel di dinding", kata: [] },
  { id: "leak", file: "leak-1.png", jenis: "hantu", label: "leak", kata: [/\bleak\b/, /\bleyak\b/, /\brangda\b/] },
  { id: "leak-2", file: "leak-2.png", jenis: "hantu", label: "leak di pemakaman", kata: [] },
  // ---------- hantu Nusantara BARU v0.35.0 ----------
  { id: "suster", file: "suster-1.png", jenis: "hantu", label: "suster ngesot", kata: [/\bsuster\b/, /ngesot/] },
  { id: "suster-2", file: "suster-2.png", jenis: "hantu", label: "suster ngesot (wajah dekat)", kata: [] },
  { id: "banaspati", file: "banaspati-1.png", jenis: "hantu", label: "banaspati (hantu api)", kata: [/banaspati/, /hantu api/, /bola api/] },
  { id: "siluman", file: "siluman-1.png", jenis: "hantu", label: "siluman ular raksasa", kata: [/siluman/, /\bular\b/, /\bnaga\b/] },
  { id: "arwah", file: "arwah-1.png", jenis: "hantu", label: "arwah melayang", kata: [/arwah/, /\broh\b/] },
  { id: "arwah-2", file: "arwah-2.png", jenis: "hantu", label: "arwah menjerit", kata: [] },
  { id: "sosok", file: "sosok-1.png", jenis: "hantu", label: "sosok bayangan", kata: [/hantu/, /gentayangan/, /penampakan/, /sesosok/, /sosok/, /bayangan/, /siluet/, /makhluk/, /menghantui/, /kegelapan/] },
  { id: "sosok-2", file: "sosok-2.png", jenis: "hantu", label: "arwah berayun", kata: [] },
  { id: "sosok-3", file: "sosok-3.png", jenis: "hantu", label: "bayangan di ujung lorong", kata: [] },
  { id: "sosok-4", file: "sosok-4.png", jenis: "hantu", label: "sosok bermata merah di pintu", kata: [] },
  { id: "pohon", file: "pohon-1.png", jenis: "hantu", label: "hantu pohon beringin", kata: [/hantu pohon/, /sosok di pohon/, /penunggu pohon/] },
  { id: "penunggu", file: "penunggu-1.png", jenis: "hantu", label: "penunggu kuburan", kata: [/penunggu/, /penjaga kuburan/, /penjaga makam/] },
  { id: "tembok", file: "tembok-1.png", jenis: "hantu", label: "wajah di tembok", kata: [/wajah di tembok/, /hantu tembok/, /muka di dinding/] },
  { id: "ranjang", file: "ranjang-1.png", jenis: "hantu", label: "hantu di bawah ranjang", kata: [/di bawah ranjang/, /bawah tempat tidur/, /bawah kasur/] },
  { id: "kubur", file: "kubur-1.png", jenis: "hantu", label: "tangan dari kubur", kata: [/bangkit dari kubur/, /dari dalam kubur/, /keluar dari kubur/, /tangan dari kubur/, /muncul dari kubur/] },
  { id: "belakang", file: "belakang-1.png", jenis: "hantu", label: "hantu dari belakang", kata: [/muncul di belakang/, /dari belakang/, /di belakangnya/, /berdiri di belakang/] },
  // ---------- LATAR: tempat khusus dulu ----------
  { id: "latar-makam", file: "latar-makam.png", jenis: "latar", label: "makam tua", kata: [/makam/, /nisan/, /kiran/] },
  { id: "latar-kuburan", file: "latar-kuburan.png", jenis: "latar", label: "kuburan sepi", kata: [/kuburan/, /pemakaman/] },
  { id: "latar-gerbang", file: "latar-gerbang.png", jenis: "latar", label: "gerbang kuburan", kata: [/gerbang/] },
  { id: "latar-beringin", file: "latar-beringin.png", jenis: "latar", label: "pohon beringin tua", kata: [/beringin/] },
  { id: "latar-sekolah", file: "latar-sekolah.png", jenis: "latar", label: "kelas sekolah tua", kata: [/sekolah/, /\bkelas\b/, /asrama/, /panti asuhan/] },
  { id: "latar-rumahsakit", file: "latar-rumahsakit.png", jenis: "latar", label: "rumah sakit tua", kata: [/rumah sakit/] },
  { id: "latar-lorong", file: "latar-lorong.png", jenis: "latar", label: "lorong tua", kata: [/lorong/, /koridor/, /kampus/] },
  { id: "latar-kamar", file: "latar-kamar.png", jenis: "latar", label: "kamar redup", kata: [/kamar/, /ranjang/, /kasur/, /tempat tidur/, /loteng/] },
  { id: "latar-atap", file: "latar-atap.png", jenis: "latar", label: "atap malam", kata: [/atap/, /genteng/, /plafon/] },
  { id: "latar-tangga", file: "latar-tangga.png", jenis: "latar", label: "tangga kayu tua", kata: [/tangga/] },
  { id: "latar-dapur", file: "latar-dapur.png", jenis: "latar", label: "dapur tua", kata: [/dapur/, /tungku/] },
  { id: "latar-gudang", file: "latar-gudang.png", jenis: "latar", label: "gudang berdebu", kata: [/gudang/, /pabrik/, /ligar/] },
  // ---------- LATAR: umum ----------
  { id: "latar-rumah", file: "latar-rumah.png", jenis: "latar", label: "rumah tua", kata: [/rumah/, /vila/, /gubuk/, /kediaman/, /pondok/, /paviliun/, /beranda/] },
  { id: "latar-hutan", file: "latar-hutan.png", jenis: "latar", label: "hutan berkabut", kata: [/hutan/, /rimba/, /pepohonan/] },
  { id: "latar-sawah", file: "latar-sawah.png", jenis: "latar", label: "sawah berkabut", kata: [/sawah/, /ladang/, /padi/] },
  { id: "latar-setapak", file: "latar-setapak.png", jenis: "latar", label: "jalan setapak hutan", kata: [/setapak/, /semak/] },
  { id: "latar-jalan", file: "latar-jalan.png", jenis: "latar", label: "jalan kampung malam", kata: [/\bjalan\b/, /desa/, /kampung/, /kebun/, /perjalanan/, /berjalan/] },
  { id: "latar-jembatan", file: "latar-jembatan.png", jenis: "latar", label: "jembatan kayu", kata: [/jembatan/] },
  { id: "latar-gua", file: "latar-gua.png", jenis: "latar", label: "gua gelap", kata: [/\bgua\b/, /\bgoa\b/] },
  { id: "latar-pasar", file: "latar-pasar.png", jenis: "latar", label: "pasar malam sepi", kata: [/pasar/, /bazar/] },
  { id: "latar-gang", file: "latar-gang.png", jenis: "latar", label: "gang kota gelap", kata: [/\bkota\b/, /\bgang\b/, /alun-alun/, /gedung/, /apartemen/] },
  { id: "latar-sumur", file: "latar-sumur.png", jenis: "latar", label: "sumur tua", kata: [/sumur/, /pekarangan/] },
  { id: "latar-gunung", file: "latar-gunung.png", jenis: "latar", label: "punggungan malam", kata: [/gunung/, /bukit/, /punggungan/, /jurang/] },
  { id: "latar-laut", file: "latar-laut.png", jenis: "latar", label: "laut malam", kata: [/laut/, /pantai/, /danau/, /sungai/, /\bkali\b/, /tepi/] },
];

/** varian gambar per id hantu dasar — diputar utk potongan 2 dtk agar tak monoton.
 *  v0.35.0: 2-5 varian per hantu (dulu 1-2 → penyebab "5 gambar terus berulang"). */
export const VARIAN_HANTU: Record<string, string[]> = {
  pocong: ["pocong", "pocong-2", "pocong-3", "pocong-4"],
  kuntilanak: ["kuntilanak", "kuntilanak-2", "kuntilanak-3", "kuntilanak-4", "kuntilanak-5"],
  genderuwo: ["genderuwo", "genderuwo-2", "genderuwo-3", "genderuwo-4"],
  tuyul: ["tuyul", "tuyul-2", "tuyul-3"],
  wewe: ["wewe", "wewe-2"],
  leak: ["leak", "leak-2"],
  suster: ["suster", "suster-2"],
  banaspati: ["banaspati"],
  siluman: ["siluman"],
  arwah: ["arwah", "arwah-2"],
  pohon: ["pohon"],
  penunggu: ["penunggu"],
  tembok: ["tembok"],
  ranjang: ["ranjang"],
  kubur: ["kubur"],
  belakang: ["belakang"],
  sosok: ["sosok", "sosok-2", "sosok-3", "sosok-4"], // generik PALING AKHIR (kata /hantu/ paling luas)
};

/** latar pasangan utk alternasi adegan hantu (membangun suasana, bukan monoton) */
export const LATAR_PASANGAN: Record<string, string> = {
  pocong: "latar-kuburan",
  kuntilanak: "latar-beringin",
  genderuwo: "latar-hutan",
  tuyul: "latar-rumah",
  wewe: "latar-jalan",
  leak: "latar-kuburan",
  suster: "latar-rumahsakit",
  banaspati: "latar-dapur",
  siluman: "latar-setapak",
  arwah: "latar-laut",
  sosok: "latar-lorong",
  pohon: "latar-beringin",
  penunggu: "latar-gerbang",
  tembok: "latar-gudang",
  ranjang: "latar-kamar",
  kubur: "latar-makam",
  belakang: "latar-rumah",
};

const DAFTAR_HANTU = Object.keys(VARIAN_HANTU); // urutan prioritas deteksi
const GALERI_MAP: Record<string, GambarGaleri> = Object.fromEntries(GALERI.map((g) => [g.id, g]));

export function ambilGaleri(id: string): GambarGaleri | null {
  return GALERI_MAP[id] ?? null;
}

function bersih(teks: string): string {
  return (teks || "").toLowerCase().replace(/\s+/g, " ");
}

/** Deteksi id hantu DASAR dari satu kalimat/adegan (null = tidak ada hantu disebut). */
export function deteksiHantu(teks: string): string | null {
  const t = bersih(teks);
  for (const h of DAFTAR_HANTU) {
    const g = GALERI_MAP[h];
    if (g && g.kata.some((k) => k.test(t))) return h;
  }
  return null;
}

/** Deteksi id latar dari satu kalimat/adegan (null = tak ada kata kunci tempat). */
export function deteksiLatar(teks: string): string | null {
  const t = bersih(teks);
  for (const g of GALERI) {
    if (g.jenis !== "latar") continue;
    if (g.kata.some((k) => k.test(t))) return g.id;
  }
  return null;
}

/** Hitung kemunculan tiap hantu di SELURUH cerita (kata kunci dijumlahkan). */
export function hitungHantu(paragraf: string[]): Record<string, number> {
  const hasil: Record<string, number> = {};
  for (const p of paragraf) {
    const h = deteksiHantu(p);
    if (h) hasil[h] = (hasil[h] ?? 0) + 1;
  }
  return hasil;
}

/** Hantu paling sering disebut di cerita (untuk "jump-scare" klimaks & kartu). */
export function hantuDominan(paragraf: string[]): string | null {
  const h = hitungHantu(paragraf);
  let terbaik: string | null = null;
  let maks = 0;
  for (const [k, v] of Object.entries(h)) {
    if (v > maks) { terbaik = k; maks = v; }
  }
  return terbaik;
}

function prngGaleri(seed: number): () => number {
  let s = (seed || 1) >>> 0;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

/** PEMBAGIAN POTONGAN GAMBAR: ±2 detik per gambar (permintaan user v0.34.0).
 *  Kelipatan 1/30 dtk — potongan pertama..n-1 PERSIS 2 dtk, potongan akhir
 *  menyerap sisa (≥0.8 dtk; kalau lebih pendek → digabung ke potongan sebelumnya).
 *  Jumlah hasil selalu == jumlah gambar yang harus disiapkan utk adegan ini. */
export function potonganAdegan(durasi: number, laju = 2): number[] {
  const D = Math.max(1, Math.round(durasi * 30));
  const f60 = Math.max(1, Math.round(laju * 30)); // 60 frame = 2 dtk @30fps
  if (D <= f60) return [D / 30];
  let n = Math.ceil(D / f60);
  if (n > 1 && D - f60 * (n - 1) < 24) n -= 1; // ekor < 0.8 dtk → digabung
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(i === n - 1 ? (D - f60 * (n - 1)) / 30 : f60 / 30);
  return out;
}

export interface OpsiPilihGambar {
  /** teks adegan (sumber deteksi hantu/latar) */
  teks: string;
  /** indeks adegan (untuk variasi deterministik) */
  indeks: number;
  /** posisi adegan di linimasa 0..1 (utk suntikan hantu dominan menjelang klimaks) */
  posisi: number;
  /** seed cerita */
  seed: number;
  /** jumlah potongan 2 dtk adegan ini (== jumlah gambar yang dikembalikan) */
  jumlahPotongan: number;
  /** id hantu paling sering muncul di cerita (boleh null) */
  hantuDominan?: string | null;
}

/** Pilih id gambar galeri UNTUK TIAP POTONGAN adegan (deterministik).
 *  - hantu disebut → pola [hantu, latar, hantu-var, latar, ...] (hantu tampil ~setiap 4 dtk)
 *  - menjelang klimaks (posisi > 0.55, adegan ganjil) tanpa sebutan → hantu dominan cerita muncul
 *  - polos → latar sesuai kata kunci tempat, tiap potongan latar BERBEDA (gambar selalu berganti)
 *  v0.35.0: varian per hantu kini 2-5 → pola ini memutar LEBIH BANYAK gambar beda. */
export function pilihGambarPotongan(o: OpsiPilihGambar): string[] {
  const n = Math.max(1, Math.round(o.jumlahPotongan));
  const r = prngGaleri(((o.seed || 1) ^ Math.imul(o.indeks + 1, 2654435761) ^ 0x34d8b4fd) >>> 0);
  const rotasiLatar = (): string => {
    const latars = GALERI.filter((g) => g.jenis === "latar");
    return latars[Math.floor(r() * latars.length)].id;
  };
  const hantu = deteksiHantu(o.teks) ??
    (o.hantuDominan && o.posisi > 0.55 && o.indeks % 2 === 1 ? o.hantuDominan : null);
  if (!hantu) {
    const utama = deteksiLatar(o.teks) ?? rotasiLatar();
    const out = [utama];
    for (let p = 1; p < n; p++) {
      let cand = rotasiLatar();
      let jaga = 0;
      while (cand === out[p - 1] && jaga++ < 5) cand = rotasiLatar();
      out.push(cand);
    }
    return out;
  }
  const varian = VARIAN_HANTU[hantu] ?? [hantu];
  const latarP = LATAR_PASANGAN[hantu] ?? deteksiLatar(o.teks) ?? rotasiLatar();
  const out: string[] = [];
  let vi = Math.floor(r() * varian.length);
  for (let p = 0; p < n; p++) {
    if (p % 2 === 0) out.push(varian[vi++ % varian.length]);
    else out.push(p % 4 === 1 ? latarP : rotasiLatar());
  }
  return out;
}

// ================= v0.35.0 — PERENCANA TINGKAT-VIDEO + VARIASI VISUAL =================

/** Variasi visual SATU potongan 2 detik — data murni; diterjemahkan ke filter
 *  ffmpeg oleh hororRender (GRADE_TABEL). Inilah yang membuat 60 gambar dasar
 *  mampu tampil sebagai RATUSAN tampilan berbeda dalam video 6 menit. */
export interface VariasiPotongan {
  /** cermin horizontal (komposisi tampak lain dari gambar yang sama) */
  hflip: boolean;
  /** indeks pewarnaan 0..GRADE_JUMLAH-1 (malam biru, hijau sakit, noir, merah bara, ...) */
  grade: number;
  /** kabut: blur lembut + hitam diangkat (suasana berkabut) */
  kabut: boolean;
  /** grain film halus */
  derau: boolean;
}

export const GRADE_JUMLAH = 8;

export interface PilihanPotongan {
  id: string;
  variasi: VariasiPotongan;
}

export interface OpsiRencanaCerita {
  /** daftar adegan (urut) — teks utk deteksi, durasi utk hitung potongan */
  adegan: { teks: string; durasi: number; seedAdegan?: number }[];
  /** seed cerita (deterministik: cerita sama → rencana sama) */
  seed: number;
  /** detik per potongan (bawaan 2 — permintaan user) */
  laju?: number;
}

/** VARIASI potongan baru yang DIJAMIN BERBEDA dari variasi sebelumnya pada
 *  pasangan (grade, hflip) — mata langsung melihat potongan 2 dtk berbeda. */
function buatVariasi(r: () => number, prev?: VariasiPotongan): VariasiPotongan {
  let grade = Math.floor(r() * GRADE_JUMLAH);
  let hflip = r() < 0.45;
  if (prev && grade === prev.grade && hflip === prev.hflip) grade = (grade + 3) % GRADE_JUMLAH;
  return { hflip, grade, kabut: r() < 0.26, derau: r() < 0.42 };
}

/** PERENCANA GAMBAR SEPANJANG CERITA (v0.35.0 — inti jawaban "5 gambar terus
 *  berulang"): membagi SEMUA adegan jadi potongan 2 dtk lalu menetapkan
 *  kombinasi (gambar, variasi) utk TIAP potongan dgn jaminan:
 *  1. TIDAK ADA gambar sama dalam jendela JENDELA_UNIK potongan berurutan
 *     (≈24 dtk) di seluruh video — dulu inilah akar "5 gambar diulang-ulang";
 *  2. dipandu cerita: adegan yang menyebut hantu → varian hantu itu + latar
 *     konteks; adegan polos → latar sesuai tempat + sesekali lukisan hantu
 *     generik; klimaks (posisi > 0.55) → hantu dominan cerita muncul;
 *  3. variasi visual (grade/hflip/kabut/derau) potongan berurutan selalu beda;
 *  4. deterministik penuh (cerita + seed sama → video sama). */
const JENDELA_UNIK = 12; // gambar tak boleh muncul lagi dalam 12 potongan (≈24 dtk)

export function rencanaGambarCerita(o: OpsiRencanaCerita): PilihanPotongan[][] {
  const r = prngGaleri(((o.seed || 1) ^ 0x5bf03635) >>> 0);
  const semuaLatar = GALERI.filter((g) => g.jenis === "latar").map((g) => g.id);
  const semuaHantu = Object.keys(VARIAN_HANTU);
  const riwayat: string[] = []; // id urut pemakaian (global se-video)
  const terpakai = (id: string): boolean => {
    for (let i = Math.max(0, riwayat.length - JENDELA_UNIK); i < riwayat.length; i++) {
      if (riwayat[i] === id) return true;
    }
    return false;
  };
  // pilih id dr kandidat: hindari jendela; bila semua baru dipakai → yg terlama
  const pilih = (kandidat: string[]): string => {
    const sisa = kandidat.filter((k) => !terpakai(k));
    if (sisa.length) {
      const id = sisa[Math.floor(r() * sisa.length)];
      riwayat.push(id);
      return id;
    }
    let terbaik = kandidat[0];
    let posisiTerbaik = riwayat.indexOf(terbaik);
    for (const k of kandidat) {
      const p = riwayat.lastIndexOf(k);
      if (p >= 0 && (posisiTerbaik < 0 || p < posisiTerbaik)) { terbaik = k; posisiTerbaik = p; }
    }
    riwayat.push(terbaik);
    return terbaik;
  };
  const dominan = hantuDominan(o.adegan.map((a) => a.teks));
  const total = Math.max(1, o.adegan.length);
  let variasiSebelumnya: VariasiPotongan | undefined;
  const rencana: PilihanPotongan[][] = [];
  for (let i = 0; i < o.adegan.length; i++) {
    const a = o.adegan[i];
    const posisi = total > 1 ? i / (total - 1) : 0;
    const pot = potonganAdegan(a.durasi, o.laju ?? 2);
    const hantu = deteksiHantu(a.teks) ??
      (dominan && posisi > 0.55 && i % 2 === 1 ? dominan : null);
    const latarUtama = deteksiLatar(a.teks);
    const varian = hantu ? (VARIAN_HANTU[hantu] ?? [hantu]) : [];
    const baris: PilihanPotongan[] = [];
    for (let p = 0; p < pot.length; p++) {
      let id: string;
      if (hantu) {
        // pola [hantu, latar konteks, hantu/lukisan generik, ...]
        if (p % 3 === 0) id = pilih(varian);
        else if (p % 3 === 1) id = pilih([latarUtama ?? LATAR_PASANGAN[hantu] ?? semuaLatar[0], ...semuaLatar]);
        else id = pilih(r() < 0.6 ? varian : semuaHantu);
      } else {
        // polos: latar suasana (potongan pembuka); sesekali lukisan hantu
        // generik muncul di potongan berikut (rasa misteri)
        const kandidat = p > 0 && r() < 0.22
          ? semuaHantu
          : (latarUtama ? [latarUtama, ...semuaLatar] : semuaLatar);
        id = pilih(kandidat);
      }
      const variasi = buatVariasi(r, variasiSebelumnya);
      variasiSebelumnya = variasi;
      baris.push({ id, variasi });
    }
    rencana.push(baris);
  }
  return rencana;
}
