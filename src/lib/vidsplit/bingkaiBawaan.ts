// VidSplit v0.47.0 — daftar frame bawaan (MURNI, aman-browser & server)
// Dipakai UI (grid pilihan frame) & resolver server — tanpa import node.
//
// v0.47.0 — permintaan user: hapus 7 frame lama, ganti 10 frame baru berbingkai
// TIPIS (agar video tetap terlihat jelas) + 2 frame spesial bertema:
//   • dangdut-idola-desa — teks "DANGDUT IDOLA DESA", tema panggung dangdut
//   • horor-alam-gaib   — teks "HOROR ALAM GAIB", tema cerita horor
// Tiap frame punya DUA varian rasio: <slug>-916.png (1080×1920) dan
// <slug>-169.png (1920×1080) sehingga tampil PENUH di kedua rasio (bug lama:
// frame 9:16 saja ter-crop di video 16:9).

export interface BingkaiBawaan {
  slug: string;
  label: string;
}

/** 12 frame bawaan v0.47.0 — 10 reguler tipis + 2 spesial bertema */
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
];

export function adalahSlugBawaan(slug: string): boolean {
  return BINGKAI_BAWAAN.some((b) => b.slug === slug);
}
