// VidSplit v0.29.0 — AI VIDEO GENERATOR: registri genre.
// v0.25–v0.28 aplikasi hanya punya Studio Cerita Horor; kini satu mesin yang sama
// melayani 6 genre — dari ide apa pun jadi video lengkap (naskah + ilustrasi +
// narasi AI + musik), semuanya 100% offline. Berkas ini satu-satunya tempat
// metadata genre: nama, label halaman judul, judul bab penutup, tema visual
// bawaan, suasana musik, dan gaya ilustrasi (cerah/gelap).
import type { IntensitasHoror, MoodMusik } from "./hororMusik";

export type GenreId = "horor" | "misteri" | "legenda" | "dongeng" | "motivasi" | "fakta";

export interface Genre {
  id: GenreId;
  nama: string;
  ket: string;
  /** teks kecil di halaman judul video (rencanaHoror) */
  labelJudul: string;
  /** judul bab penutup (bab terakhir) */
  babAkhir: string;
  /** id tema visual TEMA_HOROR yang disarankan */
  temaVisual: string;
  /** suasana musik sintesis bila user memakai "sintesis" */
  moodMusik: MoodMusik;
  /** intensitas musik bawaan genre */
  intensitasMusik: IntensitasHoror;
  /** ilustrasi cerah: matahari, tanpa gagak/petir, kabut tipis */
  cerah: boolean;
}

export const GENRE: Genre[] = [
  {
    id: "horor", nama: "Horor", ket: "cerita menegangkan dengan twist",
    labelJudul: "Sebuah Cerita Horor", babAkhir: "Menguak",
    temaVisual: "kelam", moodMusik: "gelap", intensitasMusik: "menegangkan", cerah: false,
  },
  {
    id: "misteri", nama: "Misteri", ket: "petunjuk, teka-teki, terjawab",
    labelJudul: "Sebuah Kisah Misteri", babAkhir: "Terjawab",
    temaVisual: "purnama", moodMusik: "gelap", intensitasMusik: "santai", cerah: false,
  },
  {
    id: "legenda", nama: "Legenda", ket: "pusaka & hikmah nusantara",
    labelJudul: "Sebuah Legenda Nusantara", babAkhir: "Hikmah",
    temaVisual: "kabut", moodMusik: "gelap", intensitasMusik: "santai", cerah: false,
  },
  {
    id: "dongeng", nama: "Dongeng", ket: "cerita hangat semua umur",
    labelJudul: "Sebuah Dongeng", babAkhir: "Tamat Cerita",
    temaVisual: "permata", moodMusik: "hangat", intensitasMusik: "santai", cerah: true,
  },
  {
    id: "motivasi", nama: "Motivasi", ket: "perjuangan & semangat baru",
    labelJudul: "Sebuah Kisah Perjuangan", babAkhir: "Pelajaran",
    temaVisual: "fajar", moodMusik: "hangat", intensitasMusik: "santai", cerah: true,
  },
  {
    id: "fakta", nama: "Fakta Unik", ket: "keanehan dunia yang nyata",
    labelJudul: "Fakta Menakjubkan", babAkhir: "Terpesona",
    temaVisual: "lautteduh", moodMusik: "hangat", intensitasMusik: "santai", cerah: true,
  },
];

export const GENRE_IDS = GENRE.map((g) => g.id);

/** Ambil genre valid (fallback: horor — perilaku lama tetap utuh) */
export function ambilGenre(id?: string | null): Genre {
  return GENRE.find((g) => g.id === id) ?? GENRE[0];
}
