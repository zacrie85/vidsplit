// VidSplit v2.7.0 — daftar frame bawaan (MURNI, aman-browser & server)
// Dipakai UI (grid pilihan frame) & resolver server — tanpa import node.
//
// v0.47.0 — 10 frame reguler tipis + 2 spesial bertema (dangdut/horor)
// v0.50.0 — +6 frame spesial IDOLA DESA bertema dangdut
// v0.52.0 — +7 frame HOROR "ALAM GAIB" · v0.54.0 — nama desain dihapus dr PNG
// v0.57.0 — +10 frame horor (teks atas HANYA "ALAM GAIB")
// v2.7.0 — KATEGORI FRAME (permintaan user: "tambahkan 40 frame baru dengan
//   kategori hiburan … 10 untuk hiburan, 10 untuk movie, 10 untuk drama dan
//   10 untuk cinema dan nama tema nya tidak usah di tulis di frame cukup
//   tulisan hiburan, movie, drama dan cinema saja"):
//   • field `kategori` baru utk SEMUA frame (filter chip di UI menu 05)
//   • +40 PNG baru (generator scripts/buat-bingkai-hiburan-v27.ts):
//     hiburan-1..10 (teks atas HANYA "HIBURAN"), movie-1..10 ("MOVIE"),
//     drama-1..10 ("DRAMA"), cinema-1..10 ("CINEMA")
//   • nama desain tetap ada di LABEL menu (membantu memilih) tapi TIDAK
//     pernah ditulis di dalam PNG — persis pola keluarga horor v0.54.0.
//
// Tiap frame punya DUA varian rasio: <slug>-916.png (1080×1920) dan
// <slug>-169.png (1920×1080) sehingga tampil PENUH di kedua rasio.

/** Kategori frame — dipakai UI utk chip filter menu 05 */
export type KategoriBingkai =
  | "dasar"
  | "dangdut"
  | "horor"
  | "hiburan"
  | "movie"
  | "drama"
  | "cinema";

export interface BingkaiBawaan {
  slug: string;
  label: string;
  /** v2.7.0 — kategori utk filter; bawaan "dasar" (frame reguler v0.47) */
  kategori?: KategoriBingkai;
}

export const LABEL_KATEGORI: Record<KategoriBingkai, string> = {
  dasar: "Dasar",
  dangdut: "Dangdut",
  horor: "Horor",
  hiburan: "Hiburan",
  movie: "Movie",
  drama: "Drama",
  cinema: "Cinema",
};

/** 67 frame bawaan v2.7.0 — 10 reguler + 17 dangdut/horor lama + 40 KATEGORI
 *  HIBURAN/MOVIE/DRAMA/CINEMA (10+10+10+10) */
export const BINGKAI_BAWAAN: BingkaiBawaan[] = [
  { slug: "garis-emas", label: "Garis Emas", kategori: "dasar" },
  { slug: "perak-minimal", label: "Perak Minimalis", kategori: "dasar" },
  { slug: "neon-ungu", label: "Neon Ungu", kategori: "dasar" },
  { slug: "pastel-lembut", label: "Pastel Lembut", kategori: "dasar" },
  { slug: "ganda-klasik", label: "Ganda Klasik", kategori: "dasar" },
  { slug: "sudut-berlian", label: "Sudut Berlian", kategori: "dasar" },
  { slug: "biru-es", label: "Biru Es", kategori: "dasar" },
  { slug: "film-retro", label: "Film Retro", kategori: "dasar" },
  { slug: "permen-pink", label: "Permen Pink", kategori: "dasar" },
  { slug: "emerald-alam", label: "Emerald Alam", kategori: "dasar" },
  { slug: "dangdut-idola-desa", label: "★ Dangdut Idola Desa", kategori: "dangdut" },
  { slug: "horor-alam-gaib", label: "★ Horor Alam Gaib", kategori: "horor" },
  { slug: "dangdut-idola-desa-2", label: "★ Dangdut Idola Desa 2 — Panggung Emas", kategori: "dangdut" },
  { slug: "horor-alam-gaib-2", label: "★ Horor Alam Gaib 2 — Bulan Sabit", kategori: "horor" },
  { slug: "dangdut-idola-desa-3", label: "★ Idola Desa 3 — Gong Emas", kategori: "dangdut" },
  { slug: "dangdut-idola-desa-4", label: "★ Idola Desa 4 — Kendang Ria", kategori: "dangdut" },
  { slug: "dangdut-idola-desa-5", label: "★ Idola Desa 5 — Tirai Merah", kategori: "dangdut" },
  { slug: "dangdut-idola-desa-6", label: "★ Idola Desa 6 — Payet Disco", kategori: "dangdut" },
  { slug: "dangdut-idola-desa-7", label: "★ Idola Desa 7 — Batik Mega", kategori: "dangdut" },
  { slug: "dangdut-idola-desa-8", label: "★ Idola Desa 8 — Bunga Rampak", kategori: "dangdut" },
  { slug: "horor-alam-gaib-3", label: "★ Horor Alam Gaib 3 — Tengkorak Bertanduk", kategori: "horor" },
  { slug: "horor-alam-gaib-4", label: "★ Horor Alam Gaib 4 — Tanah Kubur", kategori: "horor" },
  { slug: "horor-alam-gaib-5", label: "★ Horor Alam Gaib 5 — Sarang Laba-laba", kategori: "horor" },
  { slug: "horor-alam-gaib-6", label: "★ Horor Alam Gaib 6 — Gunung Darah", kategori: "horor" },
  { slug: "horor-alam-gaib-7", label: "★ Horor Alam Gaib 7 — Api Neraka", kategori: "horor" },
  { slug: "horor-alam-gaib-8", label: "★ Horor Alam Gaib 8 — Arwah Larung", kategori: "horor" },
  { slug: "horor-alam-gaib-9", label: "★ Horor Alam Gaib 9 — Rimba Terkutuk", kategori: "horor" },
  // v0.57.0 — +10 frame horor (teks atas HANYA "ALAM GAIB")
  { slug: "horor-alam-gaib-10", label: "★ Horor Alam Gaib 10 — Pocong Mengapit", kategori: "horor" },
  { slug: "horor-alam-gaib-11", label: "★ Horor Alam Gaib 11 — Pocong Melantai", kategori: "horor" },
  { slug: "horor-alam-gaib-12", label: "★ Horor Alam Gaib 12 — Kuntilanak Berdiri", kategori: "horor" },
  { slug: "horor-alam-gaib-13", label: "★ Horor Alam Gaib 13 — Kuntilanak Terik", kategori: "horor" },
  { slug: "horor-alam-gaib-14", label: "★ Horor Alam Gaib 14 — Wajah Mengintip", kategori: "horor" },
  { slug: "horor-alam-gaib-15", label: "★ Horor Alam Gaib 15 — Lorong Makam", kategori: "horor" },
  { slug: "horor-alam-gaib-16", label: "★ Horor Alam Gaib 16 — Pohon Arwah", kategori: "horor" },
  { slug: "horor-alam-gaib-17", label: "★ Horor Alam Gaib 17 — Lilin & Tengkorak", kategori: "horor" },
  { slug: "horor-alam-gaib-18", label: "★ Horor Alam Gaib 18 — Nisan Bercahaya", kategori: "horor" },
  { slug: "horor-alam-gaib-19", label: "★ Horor Alam Gaib 19 — Kabut Kuburan", kategori: "horor" },
  // v2.7.0 — 40 frame KATEGORI HIBURAN (teks atas HANYA kata kategorinya)
  { slug: "hiburan-1", label: "★ Hiburan 1 — Konfeti Ceria", kategori: "hiburan" },
  { slug: "hiburan-2", label: "★ Hiburan 2 — Balon Pesta", kategori: "hiburan" },
  { slug: "hiburan-3", label: "★ Hiburan 3 — Sorot Panggung", kategori: "hiburan" },
  { slug: "hiburan-4", label: "★ Hiburan 4 — Bintang Kilau", kategori: "hiburan" },
  { slug: "hiburan-5", label: "★ Hiburan 5 — Pita Warni", kategori: "hiburan" },
  { slug: "hiburan-6", label: "★ Hiburan 6 — Kembang Api", kategori: "hiburan" },
  { slug: "hiburan-7", label: "★ Hiburan 7 — Nota Musik", kategori: "hiburan" },
  { slug: "hiburan-8", label: "★ Hiburan 8 — Topi Pesta", kategori: "hiburan" },
  { slug: "hiburan-9", label: "★ Hiburan 9 — Bendera Umbul", kategori: "hiburan" },
  { slug: "hiburan-10", label: "★ Hiburan 10 — Disco Kilau", kategori: "hiburan" },
  { slug: "movie-1", label: "★ Movie 1 — Perforasi Film", kategori: "movie" },
  { slug: "movie-2", label: "★ Movie 2 — Clapperboard", kategori: "movie" },
  { slug: "movie-3", label: "★ Movie 3 — Sorot Sinema", kategori: "movie" },
  { slug: "movie-4", label: "★ Movie 4 — Gulungan Film", kategori: "movie" },
  { slug: "movie-5", label: "★ Movie 5 — Tiket Premier", kategori: "movie" },
  { slug: "movie-6", label: "★ Movie 6 — Kamera Klasik", kategori: "movie" },
  { slug: "movie-7", label: "★ Movie 7 — Lampu Studio", kategori: "movie" },
  { slug: "movie-8", label: "★ Movie 8 — Bintang Film", kategori: "movie" },
  { slug: "movie-9", label: "★ Movie 9 — Strip Samping", kategori: "movie" },
  { slug: "movie-10", label: "★ Movie 10 — Laurels Premier", kategori: "movie" },
  { slug: "drama-1", label: "★ Drama 1 — Tirai Panggung", kategori: "drama" },
  { slug: "drama-2", label: "★ Drama 2 — Mawar Merah", kategori: "drama" },
  { slug: "drama-3", label: "★ Drama 3 — Topeng Teater", kategori: "drama" },
  { slug: "drama-4", label: "★ Drama 4 — Ornamen Barok", kategori: "drama" },
  { slug: "drama-5", label: "★ Drama 5 — Lilin Emas", kategori: "drama" },
  { slug: "drama-6", label: "★ Drama 6 — Kipas Zaman", kategori: "drama" },
  { slug: "drama-7", label: "★ Drama 7 — Swag Emas", kategori: "drama" },
  { slug: "drama-8", label: "★ Drama 8 — Lampu Gantung", kategori: "drama" },
  { slug: "drama-9", label: "★ Drama 9 — Sulur Klasik", kategori: "drama" },
  { slug: "drama-10", label: "★ Drama 10 — Lampu Panggung", kategori: "drama" },
  { slug: "cinema-1", label: "★ Cinema 1 — Bohlam Marquee", kategori: "cinema" },
  { slug: "cinema-2", label: "★ Cinema 2 — Popcorn", kategori: "cinema" },
  { slug: "cinema-3", label: "★ Cinema 3 — Kacamata 3D", kategori: "cinema" },
  { slug: "cinema-4", label: "★ Cinema 4 — Proyektor", kategori: "cinema" },
  { slug: "cinema-5", label: "★ Cinema 5 — Gelas Minum", kategori: "cinema" },
  { slug: "cinema-6", label: "★ Cinema 6 — Tiket Bioskop", kategori: "cinema" },
  { slug: "cinema-7", label: "★ Cinema 7 — Neon Bioskop", kategori: "cinema" },
  { slug: "cinema-8", label: "★ Cinema 8 — Reel Ganda", kategori: "cinema" },
  { slug: "cinema-9", label: "★ Cinema 9 — Bintang Walk", kategori: "cinema" },
  { slug: "cinema-10", label: "★ Cinema 10 — Layar Megah", kategori: "cinema" },
];

export function adalahSlugBawaan(slug: string): boolean {
  return BINGKAI_BAWAAN.some((b) => b.slug === slug);
}
