// VidSplit v0.25.0 — MESIN CERITA HOROR "AI" 100% OFFLINE:
// generator prosedural gramatika-kaya (lokasi × tokoh × pemicu × benda × penampakan
// × twist) dgn struktur 5 bab. Seed deterministik -> hasil bisa direproduksi;
// seed baru -> cerita baru. Tanpa internet, tanpa model besar — murni mesin tulis.

export interface BabCerita {
  judul: string;
  paragraf: string[];
}

export interface Cerita {
  judul: string;
  tema: string;
  bab: BabCerita[];
  seed: number;
}

export type PanjangCerita = "pendek" | "sedang" | "panjang";

function buatPrng(seed: number): () => number {
  let s = (seed || 1) >>> 0;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

const LOKASI: Record<string, string[]> = {
  rumah: ["rumah tua di ujung gang", "rumah kontrakan yang lama kosong", "rumah nenek di kaki bukit", "kos-kosan cat biru", "panti asuhan lama"],
  sekolah: ["asrama sekolah sayap timur", "panti asuhan lama", "toko kelontong tua di belakang sekolah", "menara air di sisi asrama"],
  kantor: ["gudang pabrik tekstil yang tutup", "rumah sakit tua blok C", "stasiun kereta pinggiran", "gedung kantor paruh tua yang sepi"],
  desa: ["pemakaman desa", "menara air di tepi sawah", "toko kelontong tua", "rumah nenek di kaki bukit"],
};
const SEMUA_LOKASI = [...new Set(Object.values(LOKASI).flat())];

const TOKOH = [
  ["Raka", "mahasiswa kedokteran yang rasional"], ["Sari", "penjaga toko yang pendiam"],
  ["Bu Wati", "pemilik rumah yang jarang tersenyum"], ["Dimas", "anak SMP yang hobi merekam"],
  ["Ningsih", "perawat shift malam"], ["Pak Har", "satpam bertubuh besar"],
  ["Maya", "penulis lepas penyuka mistis"], ["Bagas", "teknisi listrik yang ramah"],
  ["Lulu", "kucing hitam pencurinya"], ["Om Darmawan", "tetangga yang selalu merem"],
];

const PEMICU = [
  "menemukan kamar tertutup yang tak pernah dibicarakan siapa pun",
  "memutar kaset rekaman suara yang tak pernah dibuatnya",
  "menggali kotak besi terkubur di halaman belakang",
  "memasang kamera CCTV bekas di lorong",
  "membeli cermin antik di pasar loak",
  "mewarisi kunci loker berkarat dari almarhum paman",
  "menjawab telepon lantai dua yang seharusnya sudah tak terpasang",
  "menemukan album foto berisi wajah yang dihapus pensil",
];

const BENDA = [
  "cermin berbingkai kayu hitam", "boneka kain bermata jahit", "jam dinding yang berhenti 03.14",
  "sumur tua berpetak batu", "kunci pintu belakang yang tak pernah ada pintunya",
  "buku tamu bertulisan tangan 1987", "radio tua yang menyala sendiri", "sepeda ontel di teras",
];

const PENAMPAKAN = [
  "bayangan berdiri di balik tirai kamar mandi", "hembusan napas dingin di tengkuk",
  "langkah kaki di langit-langit", "suara menyapu lantai di ruang kosong",
  "wajah pucat terpantul sekilas di kaca jendela", "tangan kecil memeluk kakinya saat tidur",
  "getaran pintu yang digedor pelan… pelan… pelan", "tawa anak perempuan dari sumur",
];

const BAU = ["wangi kamper dan tanah basah", "bau arang yang menghangatkan", "bau sabun tua bunga melati"];
const SUARA_MALAM = ["jangkrik berhenti serentak", "jendela digerakkan angin pelan", "air menetes dari langit-langit"];

const TWIST = [
  "ternyata semua itu sudah pernah dialaminya — sebelum pindah, sebelum lupa",
  "yang menolongnya selama ini bukan tetangga, melainkan penunggu rumah itu sendiri",
  "ia menemukan namanya sendiri di buku tamu 1987 — tulisan tangannya sendiri",
  "cermin tak menampakkan bayangannya; yang tampak adalah rumah itu di siang bolong, ditempati keluarga yang tersenyum",
  "rekaman kaset itu berisi suaranya sendiri membacakan doa untuk seseorang yang belum meninggal",
  "kamar terlarang itu selalu terkunci… dari dalam. Dan malam ini terbuka, menunggu",
];

const PENYELESAIAN = [
  "Ia membakar kotak besi itu di halaman; asapnya berbau wanginya sekarang. Sejak malam itu, rumah benar-benar sunyi.",
  "Bu Wati mengetuk pintunya pagi harinya, membawa kopi hangat. \"Kamu sudah minta izin pada mereka? Yang di sini pun cuma mau tidur tenang.\"",
  "Ia mengembalikan cermin itu ke pasar loak. Pedagang tua itu tersenyum, \"Alhamdulillah, akhirnya ada yang bawa pulang.\"",
  "Raka menutup kamar itu dengan batu bata dan semen — bukan untuk mengunci yang di dalam, tapi untuk menghormatinya.",
  "Sejak itu tiap malam Jumat, ia menaruh secangkir kopi hitam di teras. Setiap pagi, cangkirnya kosong. Sudah tidak menakutkan lagi.",
];

const JUDUL_POLA = [
  (a: string, b: string) => `Teror ${a}`,
  (a: string, b: string) => `Yang Mengintai di ${a}`,
  (a: string, b: string) => `Kamar Terlarang di ${a}`,
  (a: string, b: string) => `${b} dan Suara di Lantai Dua`,
  (a: string, b: string) => `Lewat Tengah Malam di ${a}`,
  (a: string, b: string) => `Jam 03.14 di ${a}`,
];

function isi(template: string[], ...nilai: string[][]): string[] {
  return template.map((t) => {
    let i = 0;
    return t.replace(/\$\$/g, () => nilai[i++ % nilai.length][0] ?? "");
  });
}

export interface OpsiCerita {
  tema?: "rumah" | "sekolah" | "kantor" | "desa" | "acak";
  panjang?: PanjangCerita;
  seed?: number;
}

/** Buat cerita horor lengkap. Deterministik terhadap seed. */
export function buatCerita(opsi: OpsiCerita = {}): Cerita {
  const seed = (opsi.seed ?? Math.floor(Math.random() * 2 ** 31)) >>> 0;
  const r = buatPrng(seed);
  const pilih = <T>(a: T[]): T => a[Math.floor(r() * a.length) % a.length];

  const temaPilihan = opsi.tema && opsi.tema !== "acak" ? opsi.tema : pilih(["rumah", "sekolah", "kantor", "desa"] as const);
  const lokasi = pilih(LOKASI[temaPilihan] ?? SEMUA_LOKASI);
  const [nama, sifat] = pilih(TOKOH);
  const [nama2, sifat2] = (() => { let x = pilih(TOKOH); let jaga = 0; while (x[0] === nama && jaga++ < 5) x = pilih(TOKOH); return x; })();
  const pemicu = pilih(PEMICU);
  const benda = pilih(BENDA);
  const penampakan = pilih(PENAMPAKAN);
  const penampakan2 = (() => { let x = pilih(PENAMPAKAN); let jaga = 0; while (x === penampakan && jaga++ < 5) x = pilih(PENAMPAKAN); return x; })();
  const bau = pilih(BAU);
  const malam = pilih(SUARA_MALAM);
  const twist = pilih(TWIST);
  const selesai = pilih(PENYELESAIAN);
  const judul = pilih(JUDUL_POLA)(lokasi.split(" ")[0].replace(/^./, (c) => c.toUpperCase()), nama);

  const tTema: Record<string, string[]> = {
    rumah: ["Kampung itu masih percaya: jangan menoleh kalau ada yang memanggil dari dalam rumah."],
    sekolah: ["Legenda sekolah itu tidak pernah ditulis di dinding; ia diwariskan dari bisik ke bisik."],
    kantor: ["Shift malam punya aturan tak tertulis: lampu koridor boleh mati, tapi jangan mati bersamanya."],
    desa: ["Di desa itu, malam Jumat bukan untuk keluar. Bahkan kucing pun tahu."],
  };

  const bab: BabCerita[] = [
    {
      judul: "Kedatangan",
      paragraf: [
        `${nama}, ${sifat}, tiba di ${lokasi} saat senja menelan sisa cahaya. ${tTema[temaPilihan][0]}`,
        `Awalnya semuanya biasa saja — ${bau} menyambut di ambang pintu, dan ${nama2}, ${sifat2}, adalah satu-satunya wajah yang sering ia temui.`,
      ],
    },
    {
      judul: "Pemicu",
      paragraf: [
        `Semuanya berubah ketika ia mulai ${pemicu}.`,
        `Di dalamnya ada ${benda}, berdein tebal, seolah menunggu diambil. ${nama2} memperingatkan: "Jangan dibawa ke kamar. Apapun yang tertarik padanya, biarkan tertarik pada ruang tamu saja."`,
      ],
    },
    {
      judul: "Tanda-Tanda",
      paragraf: [
        `Malam pertama, ${penampakan}. Malam kedua, ${penampakan2}.`,
        `${nama} menghitung: setiap kejadian selalu 03.14 pagi. ${malam.charAt(0).toUpperCase() + malam.slice(1)} — tepat sebelum semua suara diheningkan sekaligus, seperti ditenggelamkan.`,
      ],
    },
    {
      judul: "Teror",
      paragraf: [
        `Malam ketiga, pintu kamarnya digedor. Tiga kali. Pelan. ${nama} membuka — kosong. Hanya ${benda} di ujung lorong, kini menghadap langsung ke arahnya.`,
        `Ia berlari ke kamar ${nama2}, menggedor: "Bukakan! Tolong!" Pintu terbuka — dan ${nama2} baru saja bangun, bertanya kenapa wajah ${nama} pucat seperti baru melihat sesuatu yang seharusnya tak terlihat.`,
      ],
    },
    {
      judul: "Menguak & Selesai",
      paragraf: [
        `Di bawah lantai kayu, ${nama} menemukan jawabannya. ${twist.charAt(0).toUpperCase() + twist.slice(1)}.`,
        selesai,
      ],
    },
  ];

  const panjang = opsi.panjang ?? "sedang";
  const dipakai = panjang === "pendek" ? bab.slice(0, 3) : bab;
  const hasil = dipakai.map((b) => ({
    judul: b.judul,
    paragraf: panjang === "panjang" ? [...b.paragraf] : b.paragraf.map((p) => (p.length > 220 ? p : p)),
  }));
  if (panjang === "panjang") {
    hasil[hasil.length - 1].paragraf.push(`Lusa, ${nama} memakankan ${pilih(["nasi kotak", "kopi panas", "roti manis"])} di teras untuk ${nama2}, bercerita panjang lebar. ${nama2} hanya mendengarkan, lalu berkata pelan: "Yang penting kau sudah tahu kapan harus pulang."`);
  }
  return { judul, tema: temaPilihan, bab: hasil, seed };
}

/** Estimasi durasi baca satu paragraf (tanpa TTS): ~2.6 kata/dtk + jeda */
export function estimasiDurasi(paragraf: string): number {
  const kata = paragraf.split(/\s+/).filter(Boolean).length;
  return Math.max(6, Math.round(kata / 2.6 + 2));
}
