// VidSplit v0.46.0 — daftar frame bawaan (MURNI, aman-browser & server)
// Dipakai UI (grid pilihan frame) & resolver server — tanpa import node.

export interface BingkaiBawaan {
  slug: string;
  label: string;
}

/** 7 frame bawaan — diolah dari gambar referensi user (jendela transparan) */
export const BINGKAI_BAWAAN: BingkaiBawaan[] = [
  { slug: "arkara-muda", label: "Live Report Arkara Muda" },
  { slug: "pemilu-raya", label: "Pemilu Raya" },
  { slug: "live-report-kkn", label: "Live Report KKN" },
  { slug: "ekspedisi-merah-putih", label: "Ekspedisi Merah Putih" },
  { slug: "metamorfosis", label: "Metamorfosis 2023" },
  { slug: "exploraship", label: "Exploraship Karier.mu" },
  { slug: "jurnalistik", label: "Jurnalistik Birthday" },
];

export function adalahSlugBawaan(slug: string): boolean {
  return BINGKAI_BAWAAN.some((b) => b.slug === slug);
}
