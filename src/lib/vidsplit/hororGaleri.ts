// VidSplit v0.34.0 — PUSTAKA GAMBAR HANTU NUSANTARA (100% offline).
// Permintaan user: "upgrade menu 5. AI Text-to-Video Generator (versi komik) agar bisa
// membuat video dgn gambar pocong, kuntilanak, genderuwo dan hantu-hantu lainnya
// SESUAI DGN HANTU YANG ADA DI DALAM CERITA...buat pertukaran gambarnya setiap 2 detik."
// 21 ilustrasi AI dibundel di assets/hantu (lihat KREDIT.txt). Modul ini MURNI
// (tanpa node:*) — manifest + deteksi kata kunci hantu/latar dari teks cerita +
// pembagian potongan gambar 2 detik per adegan. Pemecah berkas nyata ada di
// hororRender.pathGambarGaleri (server-side).
export interface GambarGaleri {
  id: string;
  file: string;
  jenis: "hantu" | "latar";
  label: string;
  /** kata kunci pemicu (dicocokkan pada teks huruf kecil) — varian kosong */
  kata: RegExp[];
}

/** Manifest pustaka — URUTAN penting: hantu spesifik SEBELUM generik (sosok). */
export const GALERI: GambarGaleri[] = [
  { id: "pocong", file: "pocong-1.png", jenis: "hantu", label: "pocong", kata: [/pocong/] },
  { id: "pocong-2", file: "pocong-2.png", jenis: "hantu", label: "pocong (wajah dekat)", kata: [] },
  { id: "kuntilanak", file: "kuntilanak-1.png", jenis: "hantu", label: "kuntilanak", kata: [/kuntilanak/, /sundel\s?bolong/, /\bsundel\b/] },
  { id: "kuntilanak-2", file: "kuntilanak-2.png", jenis: "hantu", label: "kuntilanak (wajah dekat)", kata: [] },
  { id: "genderuwo", file: "genderuwo-1.png", jenis: "hantu", label: "genderuwo", kata: [/genderuwo/, /gendoruwo/] },
  { id: "genderuwo-2", file: "genderuwo-2.png", jenis: "hantu", label: "genderuwo (raksasa)", kata: [] },
  { id: "tuyul", file: "tuyul-1.png", jenis: "hantu", label: "tuyul", kata: [/tuyul/, /bocah hantu/, /hantu bocah/] },
  { id: "wewe", file: "wewe-1.png", jenis: "hantu", label: "wewe gombel", kata: [/\bwewe\b/, /gombel/] },
  { id: "leak", file: "leak-1.png", jenis: "hantu", label: "leak", kata: [/\bleak\b/, /\bleyak\b/, /\brangda\b/] },
  { id: "sosok", file: "sosok-1.png", jenis: "hantu", label: "sosok bayangan", kata: [/hantu/, /arwah/, /\broh\b/, /gentayangan/, /penampakan/, /sesosok/, /sosok/, /bayangan/, /siluet/, /makhluk/, /menghantui/, /kegelapan/ ] },
  { id: "sosok-2", file: "sosok-2.png", jenis: "hantu", label: "arwah berayun", kata: [] },
  { id: "latar-kuburan", file: "latar-kuburan.png", jenis: "latar", label: "kuburan sepi", kata: [/kuburan/, /pemakaman/, /makam/, /nisan/, /kiran/] },
  { id: "latar-rumah", file: "latar-rumah.png", jenis: "latar", label: "rumah tua", kata: [/rumah/, /vila/, /gubuk/, /kediaman/, /pondok/, /paviliun/, /beranda/] },
  { id: "latar-hutan", file: "latar-hutan.png", jenis: "latar", label: "hutan berkabut", kata: [/hutan/, /rimba/, /beringin/, /pepohonan/, /pohon beringin/] },
  { id: "latar-lorong", file: "latar-lorong.png", jenis: "latar", label: "lorong tua", kata: [/sekolah/, /lorong/, /koridor/, /\bkelas\b/, /asrama/, /kampus/, /panti asuhan/] },
  { id: "latar-kamar", file: "latar-kamar.png", jenis: "latar", label: "kamar redup", kata: [/kamar/, /ranjang/, /kasur/, /tempat tidur/, /gudang/, /loteng/, /atap/] },
  { id: "latar-jalan", file: "latar-jalan.png", jenis: "latar", label: "jalan kampung malam", kata: [/\bjalan\b/, /desa/, /kampung/, /sawah/, /kebun/, /perjalanan/, /berjalan/] },
  { id: "latar-sumur", file: "latar-sumur.png", jenis: "latar", label: "sumur tua", kata: [/sumur/, /pekarangan/] },
  { id: "latar-gang", file: "latar-gang.png", jenis: "latar", label: "gang kota gelap", kata: [/\bkota\b/, /\bgang\b/, /pasar/, /alun-alun/, /gedung/, /apartemen/, /jembatan/] },
  { id: "latar-gunung", file: "latar-gunung.png", jenis: "latar", label: "punggungan malam", kata: [/gunung/, /bukit/, /punggungan/, /jurang/, /bukit/] },
  { id: "latar-laut", file: "latar-laut.png", jenis: "latar", label: "laut malam", kata: [/laut/, /pantai/, /danau/, /sungai/, /\bkali\b/, /tepi/ ] },
];

/** varian gambar per id hantu dasar — diputar utk potongan 2 dtk agar tak monoton */
export const VARIAN_HANTU: Record<string, string[]> = {
  pocong: ["pocong", "pocong-2"],
  kuntilanak: ["kuntilanak", "kuntilanak-2"],
  genderuwo: ["genderuwo", "genderuwo-2"],
  sosok: ["sosok", "sosok-2"],
  tuyul: ["tuyul"],
  wewe: ["wewe"],
  leak: ["leak"],
};

/** latar pasangan utk alternasi adegan hantu (membangun suasana, bukan monoton) */
export const LATAR_PASANGAN: Record<string, string> = {
  pocong: "latar-kuburan",
  kuntilanak: "latar-hutan",
  genderuwo: "latar-hutan",
  tuyul: "latar-rumah",
  wewe: "latar-jalan",
  leak: "latar-kuburan",
  sosok: "latar-lorong",
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
 *  - polos → latar sesuai kata kunci tempat, tiap potongan latar BERBEDA (gambar selalu berganti) */
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
