// VidSplit v0.50.0 — daftar frame bawaan (MURNI, aman-browser & server)
// Dipakai UI (grid pilihan frame) & resolver server — tanpa import node.
//
// v0.47.0 — permintaan user: hapus 7 frame lama, ganti 10 frame baru berbingkai
// TIPIS (agar video tetap terlihat jelas) + 2 frame spesial bertema:
//   • dangdut-idola-desa — teks "DANGDUT IDOLA DESA", tema panggung dangdut
//   • horor-alam-gaib   — teks "HOROR ALAM GAIB", tema cerita horor
// v0.49.0 — teks spesial naik menyentuh garis atas + 2 varian baru
// v0.50.0 — permintaan user: +6 frame spesial IDOLA DESA bertema dangdut
//   (Gong Emas, Kendang Ria, Tirai Merah, Payet Disco, Batik Mega, Bunga Rampak)
// v0.52.0 — permintaan user: +7 frame HOROR "ALAM GAIB" (teks ALAM GAIB di
//   bagian atas frame, sisi kiri-kanan TIPIS): Tengkorak Bertanduk, Tanah
//   Kubur, Sarang Laba-laba, Gunung Darah, Api Neraka, Arwah Larung,
//   Rimba Terkutuk
// Tiap frame punya DUA varian rasio: <slug>-916.png (1080×1920) dan
// <slug>-169.png (1920×1080) sehingga tampil PENUH di kedua rasio (bug lama:
// frame 9:16 saja ter-crop di video 16:9).

export interface BingkaiBawaan {
  slug: string;
  label: string;
}

/** 27 frame bawaan v0.52.0 — 10 reguler tipis + 17 spesial bertema
 *  (v0.52.0: +7 frame HOROR ALAM GAIB atas permintaan user) */
export const BINGKAI_BAWAAN: BingkaiBawaan[] = [
  { slug: "garis-emas", label: "Garis Emas" },
  { slug: "perak-minimal", label: "Perak Minimalis" },
  { slug: "neon-ungu", label: "Neon Ungu" },
  { slug: "pastel-lembut", label: "Pastel Lembut" },
  { slug: "ganda-klasik", label: "Ganda Klasik" },
  { slug: "sudut-berlian", label: "Sudut Berlian" },
  { slug: "biru-es", label: "Biru Es" },
  { slug: "film-retro", label: "Film Retro" },
  { slug: "permen-pink", label: "Permen Pink" },
  { slug: "emerald-alam", label: "Emerald Alam" },
  { slug: "dangdut-idola-desa", label: "★ Dangdut Idola Desa" },
  { slug: "horor-alam-gaib", label: "★ Horor Alam Gaib" },
  { slug: "dangdut-idola-desa-2", label: "★ Dangdut Idola Desa 2 — Panggung Emas" },
  { slug: "horor-alam-gaib-2", label: "★ Horor Alam Gaib 2 — Bulan Sabit" },
  { slug: "dangdut-idola-desa-3", label: "★ Idola Desa 3 — Gong Emas" },
  { slug: "dangdut-idola-desa-4", label: "★ Idola Desa 4 — Kendang Ria" },
  { slug: "dangdut-idola-desa-5", label: "★ Idola Desa 5 — Tirai Merah" },
  { slug: "dangdut-idola-desa-6", label: "★ Idola Desa 6 — Payet Disco" },
  { slug: "dangdut-idola-desa-7", label: "★ Idola Desa 7 — Batik Mega" },
  { slug: "dangdut-idola-desa-8", label: "★ Idola Desa 8 — Bunga Rampak" },
  { slug: "horor-alam-gaib-3", label: "★ Horor Alam Gaib 3 — Tengkorak Bertanduk" },
  { slug: "horor-alam-gaib-4", label: "★ Horor Alam Gaib 4 — Tanah Kubur" },
  { slug: "horor-alam-gaib-5", label: "★ Horor Alam Gaib 5 — Sarang Laba-laba" },
  { slug: "horor-alam-gaib-6", label: "★ Horor Alam Gaib 6 — Gunung Darah" },
  { slug: "horor-alam-gaib-7", label: "★ Horor Alam Gaib 7 — Api Neraka" },
  { slug: "horor-alam-gaib-8", label: "★ Horor Alam Gaib 8 — Arwah Larung" },
  { slug: "horor-alam-gaib-9", label: "★ Horor Alam Gaib 9 — Rimba Terkutuk" },
  // v0.57.0 — +10 frame horor BARU (pocong, kuntilanak & seram lainnya) atas
  // permintaan user — teks atas HANYA "ALAM GAIB"
  { slug: "horor-alam-gaib-10", label: "★ Horor Alam Gaib 10 — Pocong Mengapit" },
  { slug: "horor-alam-gaib-11", label: "★ Horor Alam Gaib 11 — Pocong Melantai" },
  { slug: "horor-alam-gaib-12", label: "★ Horor Alam Gaib 12 — Kuntilanak Berdiri" },
  { slug: "horor-alam-gaib-13", label: "★ Horor Alam Gaib 13 — Kuntilanak Terik" },
  { slug: "horor-alam-gaib-14", label: "★ Horor Alam Gaib 14 — Wajah Mengintip" },
  { slug: "horor-alam-gaib-15", label: "★ Horor Alam Gaib 15 — Lorong Makam" },
  { slug: "horor-alam-gaib-16", label: "★ Horor Alam Gaib 16 — Pohon Arwah" },
  { slug: "horor-alam-gaib-17", label: "★ Horor Alam Gaib 17 — Lilin & Tengkorak" },
  { slug: "horor-alam-gaib-18", label: "★ Horor Alam Gaib 18 — Nisan Bercahaya" },
  { slug: "horor-alam-gaib-19", label: "★ Horor Alam Gaib 19 — Kabut Kuburan" },
];

export function adalahSlugBawaan(slug: string): boolean {
  return BINGKAI_BAWAAN.some((b) => b.slug === slug);
}
