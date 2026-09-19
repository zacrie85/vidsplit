// VidSplit v0.25.0 — MESIN CERITA HOROR "AI" 100% OFFLINE:
// generator prosedural gramatika-kaya (lokasi × tokoh × pemicu × benda × penampakan
// × twist) dgn struktur bab fleksibel (3/5/10/15/20 bab). v0.26.0: PROMPT IDE —
// kata kunci idemu menentukan tema, lokasi, benda & penampakan; bank kejadian
// tengah diperluas agar 20 bab tak repetitif; bab tengah intensitasnya menaik.
// Seed deterministik -> hasil bisa direproduksi; seed baru -> cerita baru.

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

export type PanjangCerita = "pendek" | "sedang" | "panjang" | "bab10" | "bab15" | "bab20";
export const BAB_PANJANG: Record<PanjangCerita, number> = {
  pendek: 3, sedang: 5, panjang: 5, bab10: 10, bab15: 15, bab20: 20,
};

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

/** landmark frasa bebas dari prompt ide -> string lokasi */
const LANDMARK: Record<string, string> = {
  "rumah sakit": "rumah sakit tua blok C", rs: "rumah sakit tua blok C",
  sekolah: "asrama sekolah sayap timur", kelas: "asrama sekolah sayap timur", murid: "asrama sekolah sayap timur", asrama: "asrama sekolah sayap timur",
  kampus: "asrama sekolah sayap timur", madrasah: "asrama sekolah sayap timur",
  pabrik: "gudang pabrik tekstil yang tutup", gudang: "gudang pabrik tekstil yang tutup",
  kantor: "gedung kantor paruh tua yang sepi", mall: "mall tua yang tutup", supermarket: "mall tua yang tutup",
  hotel: "hotel tua lantai tiga", apartemen: "apartemen tua lantai tujuh",
  kos: "kos-kosan cat biru", kontrakan: "rumah kontrakan yang lama kosong",
  pemakaman: "pemakaman desa", kuburan: "pemakaman desa", makam: "pemakaman desa",
  sawah: "menara air di tepi sawah", hutan: "hutan pinus di tepi desa",
  stasiun: "stasiun kereta pinggiran", terminal: "terminal bus tua", jembatan: "jembatan tua di tepi sungai",
  sumur: "sumur tua berpetak batu", gunung: "vila tua di lereng gunung", pantai: "penginapan tua di tepi pantai",
  masjid: "masjid tua di ujung kampung", musala: "musala tua di ujung kampung",
};

const TOKOH = [
  ["Raka", "mahasiswa kedokteran yang rasional"], ["Sari", "penjaga toko yang pendiam"],
  ["Bu Wati", "pemilik rumah yang jarang tersenyum"], ["Dimas", "anak SMP yang hobi merekam"],
  ["Ningsih", "perawat shift malam"], ["Pak Har", "satpam bertubuh besar"],
  ["Maya", "penulis lepas penyuka mistis"], ["Bagas", "teknisi listrik yang ramah"],
  ["Om Darmawan", "tetangga yang selalu merem"], ["Alya", "mahasiswi antropologi yang haus bukti"],
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
  "membenahi lumbung belakang yang roboh sejak puluhan tahun",
  "mengambil barang temuannya di gudang tanpa melapor siapa-siapa",
  "memutus gantungan kunci tua yang terjepit di celah lantai",
  "membuka pintu ganda yang disegel papan dan paku",
];

const BENDA = [
  "cermin berbingkai kayu hitam", "boneka kain bermata jahit", "jam dinding yang berhenti 03.14",
  "sumur tua berpetak batu", "kunci pintu belakang yang tak pernah ada pintunya",
  "buku tamu bertulisan tangan 1987", "radio tua yang menyala sendiri", "sepeda ontel di teras",
  "piano lama tangganya berdebu", "wayang kayu yang menghadap dinding",
  "kotak musik tanpa engkol", "lukisan keluarga yang wajahnya tergores",
  "telepon dinding berputar", "tempat sirih tembaga berisi abu",
];

const PENAMPAKAN = [
  "bayangan berdiri di balik tirai kamar mandi", "hembusan napas dingin di tengkuk",
  "langkah kaki di langit-langit", "suara menyapu lantai di ruang kosong",
  "wajah pucat terpantul sekilas di kaca jendela", "tangan kecil memeluk kakinya saat tidur",
  "getaran pintu yang digedor pelan… pelan… pelan", "tawa anak perempuan dari sumur",
  "tangis yang berpindah-pindah sudut ruangan", "bayangan yang duduk di kursi tamu lalu menghilang",
  "sentuhan dingin di pundak ketika tak ada siapa pun", "bau kemenyan yang datang tiba-tiba",
  "suara gelas ditatah pelan dari dapur gelap", "dengung lantunan sholawat nyaris tak terdengar dari bawah tanah",
];

const BAU = ["wangi kamper dan tanah basah", "bau arang yang menghangatkan", "bau sabun tua bunga melati", "bau kayu lembap dan lilin lampu minyak"];
const SUARA_MALAM = ["jangkrik berhenti serentak", "jendela digerakkan angin pelan", "air menetes dari langit-langit", "gesekan kursi dari ruang yang kosong"];

// bank kejadian tengah — dipakai bab 3..N-2 bergantian Tanda/Teror, intensitas menaik
const KEJADIAN_TANDA = [
  (o: Even) => `Setiap malam jam yang sama, ${o.penampakan}. ${o.malam.charAt(0).toUpperCase() + o.malam.slice(1)} — lalu semua suara diheningkan sekaligus.`,
  (o: Even) => `${o.nama2} menemukan garis kapur di bawah pintu — segar, digambar dari luar.`,
  (o: Even) => `Radio tua itu menyala sendiri pukul 03.14, mengalunkan nada yang nyaris seperti doa.`,
  (o: Even) => `${o.benda} itu berpindah tempat tanpa jejak — selalu sedikit lebih dekat ke kamar ${o.nama}.`,
  (o: Even) => `Di kaca jendela terukir angka 314 — dari sisi dalam.`,
  (o: Even) => `Semua cermin di rumah tersirat berkabut, kecuali satu yang justru terlalu jernih.`,
  (o: Even) => `Air di ember halaman berubah terasa es meski matahari siang sedang terik.`,
  (o: Even) => `${o.nama} mulai bermimpi satu mimpi yang sama: pintu terbuka, tak ada yang mengetuk dulu.`,
];
const KEJADIAN_TEROR = [
  (o: Even) => `Pintu kamarnya digedor tiga kali, pelan. ${o.nama} membuka — kosong. Hanya ${o.benda} di ujung lorong, kini menghadap langsung ke arahnya.`,
  (o: Even) => `${o.penampakan.charAt(0).toUpperCase() + o.penampakan.slice(1)} — kali ini cukup lama untuk dihafal.`,
  (o: Even) => `Lampu padam serentak. Dalam gelap, ada yang bernapas di sudut ruangan — berirama dengan napasnya sendiri, tapi selalu terlambat setengah detik.`,
  (o: Even) => `${o.nama2} digerakkan bangun oleh dorongan halus di pundaknya. Ternyata hanya angin. Tapi pintunya memang terbuka dari luar.`,
  (o: Even) => `Sepasang jejak kaki basah menyeberang lantai — berhenti tepat di depan kamar ${o.nama}, lalu kembali lagi, kali ini dari arah sebaliknya.`,
  (o: Even) => `Suara memanggil namanya dari atas — bukan nama besar yang biasa dipakai orang, melainkan nama kecil yang hanya dipakai almarhum ibunya.`,
  (o: Even) => `Ketika ${o.nama} menyalakan lampu, ${o.benda} sudah ada di dalam kamar. Pintunya masih terkunci.`,
  (o: Even) => `Gedoran datang lagi — lebih kuat, lebih cepat, hingga berhenti serentak saat ${o.nama} berhenti juga menahan napas.`,
  (o: Even) => `${o.nama2} menemukan ${o.nama} berdiri di tengah lorong pukul 03.14, mata terbuka, sedang tidur sambil berdiri.`,
];
interface Even { nama: string; nama2: string; benda: string; penampakan: string; malam: string }

const LANJUTAN_TENGAH = [
  (o: Even, lok: string) => `${o.nama} mulai mencatat setiap kejadian — jam, ruangan, dan siapa yang ada di rumah saat itu. Pola menunjuk satu hal yang sama: ${lok} tidak ingin diam.`,
  (o: Even, _lok: string) => `${o.nama2} akhirnya percaya setelah melihat sendiri. "Kita jangan berdua saja di sini," katanya, suaranya setengah bisik.`,
  (o: Even, lok: string) => `Mereka mengecek sudut demi sudut ${lok} — tak ada yang tertinggal, tapi semua terasa diam-diam menghitung mereka.`,
  (o: Even, _lok: string) => `${o.nama} mencoba menceritakan semua ini pada keluarganya lewat telepon; sinyal hilang tepat sebelum pukul dua pagi.`,
  (o: Even, _lok: string) => `Garis kapur di bawah pintu mereka ulang setiap sore. Setiap pagi, garis itu pindah sekitar satu jengkal lebih ke dalam.`,
  (o: Even, _lok: string) => `${o.nama2} menaburkan garam di ambang kamar. Pagi harinya, garam itu tersusun menjadi garis lurus — rapi, dari luar.`,
  (o: Even, _lok: string) => `Malam itu mereka sepakat tidur serombongan di ruang tamu. Jam dinding berdetak lebih pelan dari biasanya — seolah sengaja.`,
  (o: Even, _lok: string) => `${o.nama} menandai peta kecil ${"ruangan"} dengan salib; salib-salib itu menyusun huruf yang tidak ingin ia baca keras-keras.`,
];

const TWIST = [
  "ternyata semua itu sudah pernah dialaminya — sebelum pindah, sebelum lupa",
  "yang menolongnya selama ini bukan tetangga, melainkan penunggu rumah itu sendiri",
  "ia menemukan namanya sendiri di buku tamu 1987 — tulisan tangannya sendiri",
  "cermin tak menampakkan bayangannya; yang tampak adalah rumah itu di siang bolong, ditempati keluarga yang tersenyum",
  "rekaman kaset itu berisi suaranya sendiri membacakan doa untuk seseorang yang belum meninggal",
  "kamar terlarang itu selalu terkunci… dari dalam. Dan malam ini terbuka, menunggu",
  "kalender di dapur berhenti di tanggal wafatnya si penunggu — dan besok adalah tanggal itu",
  "yang memanggil namanya setiap 03.14 bukan ingin menyakiti — melainkan minta ditemani menunggu orang yang tak pernah kembali",
];

const PENYELESAIAN = [
  "Ia membakar kotak besi itu di halaman; asapnya berbau wangi sekarang. Sejak malam itu, rumah benar-benar sunyi.",
  "Bu Wati mengetuk pintunya pagi harinya, membawa kopi hangat. \"Kamu sudah minta izin pada mereka? Yang di sini pun cuma mau tidur tenang.\"",
  "Ia mengembalikan cermin itu ke pasar loak. Pedagang tua itu tersenyum, \"Alhamdulillah, akhirnya ada yang bawa pulang.\"",
  "Raka menutup kamar itu dengan batu bata dan semen — bukan untuk mengunci yang di dalam, tapi untuk menghormatinya.",
  "Sejak itu tiap malam Jumat, ia menaruh secangkir kopi hitam di teras. Setiap pagi, cangkirnya kosong. Sudah tidak menakutkan lagi.",
  "Mereka menggelar tahlilan satu malam penuh di ruang tamu. Sejak itu, tiap ada tamu menginap, tak ada lagi yang bermimpi buruk.",
];

const JUDUL_POLA = [
  (a: string, b: string) => `Teror ${a}`,
  (a: string, b: string) => `Yang Mengintai di ${a}`,
  (a: string, b: string) => `Kamar Terlarang di ${a}`,
  (a: string, b: string) => `${b} dan Suara di Lantai Dua`,
  (a: string, b: string) => `Lewat Tengah Malam di ${a}`,
  (a: string, b: string) => `Jam 03.14 di ${a}`,
];

const JUDUL_BAB_TENGAH = [
  "Tanda", "Teror", "Bisikan", "Langkah Kaki", "Kabut Pekat", "Pintu Berderit",
  "Gema", "Retak", "Cermin", "Noda Lama", "Jam Tiga Pagi", "Penglihatan",
  "Amarah Sunyi", "Ketukan", "Celah Pintu", "Lorong Panjang", "Bayangan Kursi",
  "Nama Kecil", "Kabut dan Garam", "Jemari Dingin",
];

/** kata kunci di prompt ide -> tema */
const KATA_TEMA: Record<string, string[]> = {
  sekolah: ["sekolah", "asrama", "kelas", "murid", "kampus", "madrasah", "sekolahan", "pelajar"],
  kantor: ["kantor", "pabrik", "gudang", "rumah sakit", "rs", "hotel", "apartemen", "mall", "toko", "stasiun", "terminal"],
  desa: ["desa", "sawah", "pemakaman", "kuburan", "makam", "kebun", "hutan", "gunung", "kampung"],
  rumah: ["rumah", "kos", "kontrakan", "kamar", "pindah", "nenek", "panti"],
};

/** kata kunci di prompt ide -> pilah benda/penampakan */
const KATA_OBJEK: Record<string, string[]> = {
  boneka: ["boneka"], cermin: ["cermin", "kaca"], jam: ["jam", "03.14", "3 pagi"],
  sumur: ["sumur"], kunci: ["kunci"], buku: ["buku", "album"], radio: ["radio"],
  telepon: ["telepon", "tlp"], piano: ["piano"], lukisan: ["lukisan", "gambar"], wayang: ["wayang"],
  tawa: ["tawa", "ketawa"], tangis: ["tangis", "nangis"], langkah: ["langkah", "jalan malam"],
  napas: ["napas"], bayangan: ["bayangan", "sosok"], kemenyan: ["kemenyan", "dupa", "asap"],
};

function pilihTemaDariIde(ide: string): string | null {
  const il = ide.toLowerCase();
  for (const [tema, kata] of Object.entries(KATA_TEMA))
    if (kata.some((k) => il.includes(k))) return tema;
  return null;
}

function objekDariIde(ide: string): { benda: string | null; penampakan: string | null } {
  const il = ide.toLowerCase();
  let benda: string | null = null;
  let penampakan: string | null = null;
  for (const [k, daftar] of Object.entries(KATA_OBJEK)) {
    if (!daftar.some((k2) => il.includes(k2))) continue;
    if (!benda) benda = BENDA.find((b) => b.includes(k)) ?? null;
    if (!penampakan) penampakan = PENAMPAKAN.find((p) => p.includes(k)) ?? null;
  }
  return { benda, penampakan };
}

function lokasiDariIde(ide: string): string | null {
  const il = ide.toLowerCase();
  // cari frasa landmark terpanjang dulu
  const kunci = Object.keys(LANDMARK).sort((a, b) => b.length - a.length);
  for (const k of kunci) if (il.includes(k)) return LANDMARK[k];
  return null;
}

export interface OpsiCerita {
  tema?: "rumah" | "sekolah" | "kantor" | "desa" | "acak";
  panjang?: PanjangCerita;
  seed?: number;
  /** PROMPT IDE — kata kunci cerita yang diinginkan (v0.26.0) */
  ide?: string;
}

/** Buat cerita horor lengkap. Deterministik terhadap seed. */
export function buatCerita(opsi: OpsiCerita = {}): Cerita {
  const seed = (opsi.seed ?? Math.floor(Math.random() * 2 ** 31)) >>> 0;
  const r = buatPrng(seed);
  const pilih = <T>(a: T[]): T => a[Math.floor(r() * a.length) % a.length];

  const ide = (opsi.ide ?? "").trim();
  const temaDariIde = ide ? pilihTemaDariIde(ide) : null;
  const temaPilihan = temaDariIde ?? (opsi.tema && opsi.tema !== "acak" ? opsi.tema : pilih(["rumah", "sekolah", "kantor", "desa"] as const));
  const objek = ide ? objekDariIde(ide) : { benda: null, penampakan: null };
  const lokasiIde = ide ? lokasiDariIde(ide) : null;

  const lokasi = lokasiIde ?? pilih(LOKASI[temaPilihan] ?? SEMUA_LOKASI);
  const [nama, sifat] = pilih(TOKOH);
  const [nama2, sifat2] = (() => { let x = pilih(TOKOH); let jaga = 0; while (x[0] === nama && jaga++ < 5) x = pilih(TOKOH); return x; })();
  const pemicu = pilih(PEMICU);
  const benda = objek.benda ?? pilih(BENDA);
  const penampakanUtama = objek.penampakan ?? pilih(PENAMPAKAN);
  const penampakan = (() => { let x = pilih(PENAMPAKAN); let jaga = 0; while (x === penampakanUtama && jaga++ < 5) x = pilih(PENAMPAKAN); return x; })();
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

  const jumlahBab = BAB_PANJANG[opsi.panjang ?? "sedang"];
  const bab: BabCerita[] = [];
  const even: Even = { nama, nama2, benda, penampakan: penampakanUtama, malam };

  // bab 1 — Kedatangan
  const pembukaIde = ide
    ? `Semua bermula dari satu gagasan yang menempel di kepala ${nama}: ${ide.charAt(0).toLowerCase()}${ide.slice(1)}.`
    : `${nama}, ${sifat}, tiba di ${lokasi} saat senja menelan sisa cahaya.`;
  bab.push({
    judul: "Kedatangan",
    paragraf: [
      `${pembukaIde} ${tTema[temaPilihan][0]}`,
      `Awalnya semuanya biasa saja — ${bau} menyambut di ambang pintu, dan ${nama2}, ${sifat2}, adalah satu-satunya wajah yang sering ia temui.`,
    ],
  });

  // bab 2 — Pemicu (dilewati bila jumlahBab === 3)
  if (jumlahBab >= 5) {
    bab.push({
      judul: "Pemicu",
      paragraf: [
        `Semuanya berubah ketika ia mulai ${pemicu}.`,
        `Di dalamnya ada ${benda}, berdein tebal, seolah menunggu diambil. ${nama2} memperingatkan: "Jangan dibawa ke kamar. Apapun yang tertarik padanya, biarkan tertarik pada ruang tamu saja."`,
      ],
    });
  }

  // bab tengah — Tanda & Teror bergantian, intensitas menaik, tanpa pengulangan
  const tanda = [...KEJADIAN_TANDA];
  const teror = [...KEJADIAN_TEROR];
  const tarik = (pool: ((e: Even) => string)[], cadangan: ((e: Even) => string)[]): ((e: Even) => string) => {
    if (!pool.length) pool.push(...cadangan);
    return pool.splice(Math.floor(r() * pool.length), 1)[0];
  };
  const babTengah = jumlahBab === 3 ? 1 : Math.max(0, jumlahBab - 3);
  for (let i = 0; i < babTengah; i++) {
    const mulaiTeror = jumlahBab === 3 ? true : i % 2 === 1; // pendek: langsung teror
    const kalimat = tarik(mulaiTeror ? teror : tanda, mulaiTeror ? KEJADIAN_TEROR : KEJADIAN_TANDA)(even);
    const eskalasi = i >= babTengah - 1;
    const lanjutan = eskalasi
      ? `Malam itu juga, ${nama} berhenti berani tidur sendirian. ${nama2} menyalakan lampu kecil di lorong — "Sedikit pun berguna," katanya, "kalau kamu tak mau melihat lebih jauh."`
      : LANJUTAN_TENGAH[i % LANJUTAN_TENGAH.length](even, lokasi);
    const judulTengah = jumlahBab === 3 ? "Teror" : JUDUL_BAB_TENGAH[(i * 2 + (mulaiTeror ? 1 : 0)) % JUDUL_BAB_TENGAH.length];
    bab.push({ judul: judulTengah, paragraf: [kalimat, lanjutan] });
  }

  // bab akhir — Menguak (twist + penyelesaian selalu masuk)
  bab.push({
    judul: "Menguak",
    paragraf: [
      `Di bawah lantai kayu, ${nama} menemukan jawabannya. ${twist.charAt(0).toUpperCase() + twist.slice(1)}.`,
      selesai,
    ],
  });

  const hasil = bab.slice(0, jumlahBab);
  if (opsi.panjang === "panjang") {
    hasil[hasil.length - 1].paragraf.push(`Lusa, ${nama} memakankan ${pilih(["nasi kotak", "kopi panas", "roti manis"])} di teras untuk ${nama2}, bercerita panjang lebar. ${nama2} hanya mendengarkan, lalu berkata pelan: "Yang penting kau sudah tahu kapan harus pulang."`);
  }
  return { judul, tema: temaPilihan, bab: hasil, seed };
}

/** Estimasi durasi baca satu paragraf (tanpa TTS): ~2.6 kata/dtk + jeda */
export function estimasiDurasi(paragraf: string): number {
  const kata = paragraf.split(/\s+/).filter(Boolean).length;
  return Math.max(6, Math.round(kata / 2.6 + 2));
}
