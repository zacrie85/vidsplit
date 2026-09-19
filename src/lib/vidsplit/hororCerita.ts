// VidSplit v0.25.0 — MESIN CERITA "AI" 100% OFFLINE (v0.29.0: AI VIDEO GENERATOR):
// generator prosedural gramatika-kaya (lokasi × tokoh × pemicu × benda × penampakan
// × twist) dgn struktur bab fleksibel (3/5/10/15/20 bab). v0.26.0: PROMPT IDE —
// kata kunci idemu menentukan tema, lokasi, benda & penampakan; bank kejadian
// tengah diperluas agar 20 bab tak repetitif; bab tengah intensitasnya menaik.
// v0.29.0 — MULTI-GENRE: bank kosakata lengkap utk misteri, legenda, dongeng,
// motivasi & fakta unik (horor tetap bawaan). Semua deterministik per seed.
import { ambilGenre, GENRE_IDS, type GenreId } from "./videoAi";

export interface BabCerita {
  judul: string;
  paragraf: string[];
}

export interface Cerita {
  judul: string;
  tema: string;
  bab: BabCerita[];
  seed: number;
  /** v0.29.0 — genre cerita ("horor" bila dibuat versi lama) */
  genre?: string;
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
  // v0.29.0 — landmark genre lain (dipakai semua genre)
  perpustakaan: "perpustakaan kota yang berdebu", pustaka: "perpustakaan kota yang berdebu",
  museum: "museum kecil di ujung jalan", observatorium: "observatorium rakyat di bukit",
  candi: "candi tua di lereng yang berkabut", kafe: "kafe sudut yang nyaris tutup",
  kedai: "kedai kopi yang paling akhir tutup tiap malam", pelabuhan: "pos jaga tua di pelabuhan",
  lapangan: "lapangan futsal di belakang pasar", danau: "kota keramik di tepi danau",
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

// ==================== v0.29.0 — BANK GENRE (AI VIDEO GENERATOR) ====================
// Horor tetap memakai bank lama di atas. Lima genre lain punya kosakata sendiri
// agar mesin yang sama menghasilkan kisah yang benar-benar berbeda suasana.
interface BankGenre {
  pembuka: string[];
  tokoh: [string, string][];
  lokasi: string[];
  pemicu: string[];
  benda: string[];
  /** fragmen kalimat penampakan/keanehan (dipakai template Even) */
  fragmen: string[];
  tanda: ((o: Even) => string)[];
  kuat: ((o: Even) => string)[];
  lanjutan: ((o: Even, lok: string) => string)[];
  twist: string[];
  selesai: string[];
  judulPola: ((a: string, b: string) => string)[];
  judulBab: string[];
  eskalasi: (o: Even) => string;
  epilog: (nama: string, nama2: string) => string;
}

const BANK_G: Record<Exclude<GenreId, "horor">, BankGenre> = {
  misteri: {
    pembuka: [
      "Di kota itu, satu pertanyaan lama tidak pernah selesai ditanyakan — dan malam ini seseorang mulai mencari jawabannya.",
      "Ada berkas yang lebih suka diam di rak paling bawah; ia menunggu pembaca yang tidak mudah percaya.",
    ],
    tokoh: [
      ["Aldo", "detektif amatir penyuka arsip"], ["Ratna", "jurnalis muda yang mencatat semuanya"],
      ["Pak Yusuf", "arsiparis tua yang ingat semua nama"], ["Sandra", "polisi muda yang tak percaya kebetulan"],
      ["Beni", "kurir yang tahu semua jalan sempit kota"], ["Nona Lia", "pemilik kedai tempat semua orang bercerita"],
    ],
    lokasi: [
      "perpustakaan kota yang berdebu", "kantor surat kabar kecil lantai dua",
      "gudang arsip di bawah tanah", "stasiun kereta tertua di kota",
      "pos jaga tua di pelabuhan", "kedai kopi yang paling akhir tutup tiap malam",
    ],
    pemicu: [
      "menemukan surat tanpa pengirim yang bertanggal besok",
      "melihat foto lama yang satu wajahnya dicoret rapi",
      "menerima kertas berisi peta kecil tanpa nama",
      "membaca berkas yang seharusnya sudah dimusnahkan",
      "menghitung uang titipan yang tak cocok dengan catatan",
      "mendengar telepon umum berdering di lorong yang kosong",
    ],
    benda: [
      "berkas lama bertuliskan \"jangan dibuka\"", "jam saku yang berhenti tepat pukul 21.07",
      "foto dua orang yang hanya satu yang jelas", "kunci brankas tanpa nomor",
      "buku log dengan halaman yang rontok", "peta kota yang satu jalannya tak ada di peta lain",
      "kaset wawancara yang tak pernah tayang", "amplop bersegel lilin tanpa alamat",
    ],
    fragmen: [
      "sebuah amplop tanpa nama muncul di bawah pintu", "angka 21.07 terukir tipis di kaca berdebu",
      "langkah orang ketiga di tangga yang sepi", "lampu lorong berkedip mengikuti seseorang yang tak terlihat",
      "bekas sepatu basah yang datang lalu pergi", "bisikan nama dari belakang kaca etalase",
    ],
    tanda: [
      (o) => `Setiap malam pada jam yang sama, ${o.penampakan}. Lalu semua suara diheningkan sekaligus, seolah menunggu dicatat.`,
      (o) => `${o.nama2} menyadari satu hal kecil: catatan kunjungan itu rapi — terlalu rapi untuk tempat yang katanya tak pernah dijaga.`,
      (o) => `Di balik ${o.benda}, ada urutan angka tersusun rapi — bukan acak, melainkan seperti tanggal.`,
      (o) => `${o.nama} mencocokkan dua daftar yang seharusnya identik. Satu nama berbeda — dan itu nama yang tak pernah diajarkan siapa pun.`,
      (o) => `Kertas-kertas di meja tersusun ulang ketika tak ada yang melihat; hanya arah lipatannya yang berubah.`,
      (o) => `${o.nama} bermimpi satu peta yang sama tiga malam berturut-turut — dan garis merahnya menebal tiap malam.`,
    ],
    kuat: [
      (o) => `${o.penampakan.charAt(0).toUpperCase() + o.penampakan.slice(1)} — kali ini cukup lama untuk dicatat jam dan sudut ruangannya.`,
      (o) => `Seseorang menghubunginya memakai nama yang hanya dipakai almarhum ayahnya. Suaranya tenang: "Kamu sedang dekat sekali."`,
      (o) => `Ketika ${o.nama} pulang, pintu kamar terbuka — di dalamnya, ${o.benda} sudah menunggu di atas meja.`,
      (o) => `${o.nama2} memanggil dari ujung lorong; bayangan yang menjawab berjalan ke arah yang salah.`,
      (o) => `Dua kejadian terpisah puluhan tahun menyisakan bekas yang sama persis — ${o.benda} ada di keduanya.`,
      (o) => `Rekaman itu berisi suara ruangan yang didengarkan dari dalam — dan satu tarikan napas yang bukan miliknya.`,
    ],
    lanjutan: [
      (o, lok) => `${o.nama} menempelkan petunjuk di dinding — jam, tempat, saksi. Semua benang merah bermuara ke satu pintu di ${lok}.`,
      (o, _lok) => `${o.nama2} yang paling rasional akhirnya mengaku: "Ada yang tidak cocok, dan kita berdua tahu angka mana."`,
      (o, lok) => `Mereka membuka ulang catatan lama ${lok}, halaman demi halaman, mencari satu malam yang sengaja dilompati.`,
      (o, _lok) => `Ia berhenti menebak dan mulai membuktikan: kamera tua, jam tangan, dan dua saksi yang tak saling mengenal.`,
      (o, _lok) => `Pertanyaannya berubah: bukan "siapa" — melainkan "untuk siapa". Dan jawabannya membuat dingin.`,
      (o, lok) => `Di ${lok}, satu-satunya yang tak pernah diinterogasi justru yang paling sering tersenyum.`,
    ],
    twist: [
      "penyelip surat itu ternyata dirinya sendiri — surat yang ia tulis sebagai anak, lalu dilupakannya",
      "kasus itu sudah pernah ia selesaikan; seseorang membukanya lagi persis seperti aslinya, untuk mengujinya",
      "yang dicoret di foto bukan orang asing — itu wajahnya sendiri sebelum kejadian yang tak pernah ia ceritakan",
      "angka 21.07 bukan jam kejadian — itu jam lahir orang yang selama ini ia lindungi",
      "berkas itu sengaja ia temukan: saksi terakhir menunggu orang yang layak meneruskan penjagaan",
      "semua petunjuk mengarah ke satu orang yang tak mungkin — karena ia sudah lama tiada; yang bergerak adalah janjinya",
    ],
    selesai: [
      "Ia menyusun ulang kejadian di depan orang-orang yang merasa sudah tahu. Ketika urutannya benar, ruangan jadi sunyi — lalu jujur.",
      "Pak Yusuf membuka laci terakhir dan menyerahkan kuncinya: \"Arsip tidak menjaga rahasia; ia menunggu orang yang sabar.\"",
      "Surat terakhir akhirnya dibalas — bukan dengan surat, melainkan dengan datang ke alamat yang dulu tak berani ia singgahi.",
      "Ratna menulis semuanya, lalu memilih menyimpannya. Beberapa kebenaran paling berguna ketika pemalu datang lebih dulu.",
      "Kasus ditutup tanpa gaduh. Yang penting: nama yang salah dituduh dibersihkan, dan satu keluarga berhenti menunggu jawaban yang tak akan datang.",
    ],
    judulPola: [
      (a, _b) => `Teka-Teki ${a}`, (a, _b) => `Yang Hilang di ${a}`,
      (a, _b) => `Berkas ${a}`, (_a, b) => `${b} dan Surat Tanpa Pengirim`,
      (a, _b) => `Petunjuk Terakhir di ${a}`,
    ],
    judulBab: ["Petunjuk", "Jejak", "Amplop", "Berkas Lama", "Wawancara", "Rekonstruksi", "Jam 21.07", "Sidik", "Kunci Tanpa Nomor", "Foto Tua", "Arsip", "Saksi Sunyi", "Alibi Retak", "Yang Tak Terpikirkan"],
    eskalasi: (o) => `Malam itu ${o.nama} berhenti menebak. Ia menata seluruh petunjuk di lantai — dan satu garis merah menghubungkan semuanya ke tempat yang sama.`,
    epilog: (nama, nama2) => `${nama2} mengajak ${nama} minum di kedai biasa. "Kasus berikutnya kalau kamu butuh teman," katanya, "aku ikut tanpa banyak tanya."`,
  },

  legenda: {
    pembuka: [
      "Orang-orang desa menyimpan kisah itu seperti menyimpan api: cukup untuk hangat, jangan sampai membakar.",
      "Setiap tanah punya janji yang diturunkan dari mulut ke mulut — dan malam ini, satu janji mulai meminta ditepati.",
    ],
    tokoh: [
      ["Ki Sena", "pembatik tua yang hafal asal-usul pola"], ["Dara", "mahasiswi penulis cerita rakyat"],
      ["Pak Lurah", "kepala desa yang setia pada adat"], ["Wulan", "penari yang menolak menari malam ini"],
      ["Mbah Karta", "penjaga sumur pusaka"], ["Reza", "dalang muda yang berani bertanya"],
    ],
    lokasi: [
      "candi tua di lereng yang berkabut", "hutan keramat di tepi sungai",
      "sumur pusaka di pekarangan belakang", "pohon beringin seribu tahun di alun-alun",
      "jembatan bambu di atas ngarai", "gunung yang puncaknya tak pernah terlihat sebelah siang",
    ],
    pemicu: [
      "menggali batu bertulis tanpa sengaja di kebun",
      "memotong dahan pohon tua yang seharusnya tidak",
      "membawa benda pusaka keluar desa untuk dipamerkan",
      "menabur bunga di tepi sungai pada malam purnama",
      "membuka kotak warisan yang disegel lilin merah",
      "menyanyikan lagu yang hanya boleh dibunyikan saat panen",
    ],
    benda: [
      "keris pusaka berukir awan larat", "kain tenun berpola yang tak pernah selesai",
      "batu bertulis aksara kuno", "gamelan kecil yang berbunyi sendiri",
      "kotak jati bersegel lilin merah", "wayang purwa yang tepiannya hangus",
      "cawan air yang tak pernah kering", "gelang tembaga milik penjaga terakhir",
    ],
    fragmen: [
      "kilat lembut tanpa suara di atas pohon beringin", "aroma kemenyan dan bunga melati di udara dingin",
      "gemuruh air yang naik pelan dari dasar sumur", "bayangan wayang menari di dinding tanpa lampu",
      "lagu lama yang hanya terdengar oleh yang diundang", "bunga tumpah tersusun rapi di ambang pintu",
    ],
    tanda: [
      (o) => `Setiap malam pada jam yang sama, ${o.penampakan}. Orang desa menunduk dan bicara lebih pelan, seperti hadir di ruangan yang bukan miliknya.`,
      (o) => `${o.nama2} mengaku melihat ${o.benda} berkilau di tiga tempat berbeda dalam satu malam — masing-masing lebih dekat ke rumah ${o.nama}.`,
      (o) => `Tanah di halaman menghangat tanpa matahari; rumput tumbuh membentuk pola yang sama dengan pola kain pusaka.`,
      (o) => `Burung-burung seketika hening ketika ${o.nama} lewat — semua, kecuali satu yang menunggu di gerbang.`,
      (o) => `Di cermin sumur, air memantulkan langit yang berbeda: bulan penuh padahal malam itu sabit.`,
      (o) => `${o.nama} bermimpi tangan tua menitipkan sesuatu sambil berkata: "Jaga, jangan miliki."`,
    ],
    kuat: [
      (o) => `${o.penampakan.charAt(0).toUpperCase() + o.penampakan.slice(1)} — kali ini cukup jelas untuk dihitung: tiga ketukan, tiga napas, satu nama yang disebut.`,
      (o) => `Sungai berhenti berbunyi pada detik yang sama dengan langkah ${o.nama}. Semua menunggu, lalu mengalir lagi seperti selesai menghafalnya.`,
      (o) => `${o.benda} ditemukan di atas altar kayu — padahal semalam disimpan di kamar, terkunci.`,
      (o) => `Hujan turun hanya di satu titik kebun, tepat di atas tanah yang pernah digali. Tanah itu tetap hangat.`,
      (o) => `${o.nama2} hampir terjatuh setelah menoleh ke balik beringin; ia tak menceritakan apa yang dilihatnya, hanya meminta pulang lebih cepat.`,
      (o) => `Ketukan tiga kali di pintu pada malam Jumat — adat bilang jangan dijawab. Tangannya sudah di pegangan sebelum ia sadar.`,
    ],
    lanjutan: [
      (o, lok) => `${o.nama} menemui orang-orang tua satu per satu, mencatat versi-versi kisah ${lok} — dan menemukan satu detail yang sama di semua versi.`,
      (o, _lok) => `Mereka menyiapkan sesaji sederhana seperti adat: bunga, air, dan permintaan maaf yang diucapkan dengan sungguh-sungguh.`,
      (o, lok) => `Malam itu seluruh keluarga berkumpul di ${lok}; tak ada yang tidur, tapi tak ada yang berani menyebut namanya keras-keras.`,
      (o, _lok) => `${o.nama2} membaca ulang aksara pada batu itu bersama Mbah Karta — dan menemukan satu kata yang selalu salah dibaca orang.`,
      (o, _lok) => `Ia mulai memeriksa silsilah keluarganya sendiri; ada satu nama yang selama ini dihindari semua orang tua.`,
      (o, lok) => `Jalan menuju ${lok} mereka taburi kapur barus; pagi harinya, kapur itu tersusun garis lurus — dari arah hutan.`,
    ],
    twist: [
      "ia bukan pendatang — ia keturunan penjaga terakhir yang tercatat pada batu itu",
      "yang selama ini menunggu di beringin bukan penunggu murka, melainkan leluhurnya yang belum dibacakan doanya",
      "kain tenun yang tak pernah selesai baru terlihat utuh ketika ditenun ulang oleh tangan keluarganya",
      "pusaka itu tidak pernah hilang — ia dipinjam oleh tanah, dan batu bertulis adalah kuitansinya",
      "benda yang dianggap kutukan ternyata titipan: sesuatu yang harus diteruskan, bukan dikubur lagi",
      "lagu larangan ternyata peta: dinyanyikan dengan benar, ia menuntun ke air yang menyelamatkan desa saat kemarau besar dulu",
    ],
    selesai: [
      "Mereka menggelar kirab kecil: mengelilingi desa, membawa bunga dan nama-nama yang dulu dihindari. Sejak malam itu, sumur tak lagi berbunyi sendiri.",
      "Ki Sena menyelesaikan pola pada kain terakhir, lalu menyimpannya kembali ke kotak — kali ini tanpa segel, karena tak ada lagi yang perlu ditutupi.",
      "Ia membangun ulang pagar kecil di sekeliling beringin dan menaruh papan nama. Nama itu bukan nama penunggu — melainkan nama leluhurnya sendiri.",
      "Pak Lurah mengangkatnya sebagai penjaga muda. Persyaratannya satu: jangan berhenti bertanya pada yang tua, jangan berhenti menulis jawabannya.",
      "Hujan datang tepat saat panen. Orang desa bilang itu biasa; Mbah Karta tersenyum dan menuang dua cangkir kopi — satu untuk tamu yang tak terlihat.",
    ],
    judulPola: [
      (a, _b) => `Penjaga ${a}`, (a, _b) => `Pusaka ${a}`,
      (a, _b) => `${a} dan Janji Tanah`, (a, _b) => `Kabut ${a}`,
      (b, _a) => `Lagu yang Dilarang dari ${b}`,
    ],
    judulBab: ["Panggilan Tanah", "Pusaka", "Purnama", "Batu Bertulis", "Sumur Pusaka", "Beringin", "Larangan", "Sesaji", "Tiga Ketukan", "Kabut Lereng", "Nama yang Dihindari", "Warisan", "Kirab", "Janji Lama"],
    eskalasi: (o) => `Malam itu ${o.nama} berhenti menghindar. Ia menyalakan lampu minyak, membuka catatan versi-versi kisah, dan memutuskan bertanya dengan sopan — pada yang berhak menjawab.`,
    epilog: (nama, nama2) => `${nama2} mengantar ${nama} sampai gerbang desa. "Kalau tanah memanggil lagi," katanya, "jawab dengan hormat — kini kamu salah satu dari kami."`,
  },

  dongeng: {
    pembuka: [
      "Di balik bukit yang tertiup angin ada desa kecil yang jendelanya selalu dibiarkan sedikit terbuka — untuk tamu yang datang bersama bintang jatuh.",
      "Kata orang, keajaiban itu pemalu: ia baru datang setelah pintu diketuk tiga kali dengan ikhlas.",
    ],
    tokoh: [
      ["Lira", "gadis penenun yang ramah pada burung"], ["Kakek Damar", "pemain seruling di alun-alun"],
      ["Bimo", "anak pembuat kue yang selalu menyisakan satu"], ["Nina", "penjaga kedai tempat kupu-kupu berteduh"],
      ["Pak Gerbang", "penjaga taman yang tersenyum pada semua orang"], ["Tomi", "bocah yang hafal nama semua awan"],
    ],
    lokasi: [
      "desa kecil di balik bukit", "hutan gula tempat burung bernyanyi berbalas",
      "kota keramik di tepi danau", "taman bunga yang tak pernah layu",
      "menara jam tua yang ramah", "pelabuhan kecil berisi perahu kertas",
    ],
    pemicu: [
      "menemukan biji bintang jatuh di kebun",
      "mengikuti kupu-kupu biru sampai gerbang tua",
      "membuka jendela yang lama terkunci",
      "memberi setengah rotinya pada orang yang tersenyum di jalan",
      "menanam kancing kaca di kebun karena rindu bunga",
      "meniup seruling tua peninggalan kakeknya",
    ],
    benda: [
      "biji bintang yang bersinar lembut", "seruling bambu bersuara burung",
      "payung kertas yang bisa terbang rendah", "toples kue yang tak pernah habis",
      "lampu kuning pengundang kunang-kunang", "jam dinding yang melompat satu detik tiap ada yang tersenyum",
      "botol hujan bulan Mei", "sepeda tua yang belnya menjawab salam",
    ],
    fragmen: [
      "bintang jatuh yang mendarat pelan di kolam", "kupu-kupu biru yang selalu memutar tiga kali",
      "bunyi lonceng kecil tanpa sumber", "petir bunga memekar di malam cerah",
      "uap kue yang berbentuk kepala kucing", "hujan yang hanya turun di satu kebun, dan anak-anak menari di bawahnya",
    ],
    tanda: [
      (o) => `Setiap pagi pada jam yang sama, ${o.penampakan}. Penduduk desa bilang itu biasa — lalu tersenyum seperti menyimpan rahasia baik.`,
      (o) => `${o.benda} itu menghangat setiap ada orang bertanya dengan sopan, dan mendingin sekadar dipuji tanpa niat.`,
      (o) => `${o.nama2} menemukan jejak kaki kecil di tepi kolam — jejak yang selalu berhenti sejenak untuk menunggu.`,
      (o) => `Awan di atas desa itu bergerak melawan angin, seolah ikut penasaran.`,
      (o) => `${o.nama} menanam biji itu tanpa harapan; subuhnya, dua daun kecil melambai paling duluan padanya.`,
      (o) => `Lonceng menara berbunyi satu kali di luar jadwal — persis ketika seseorang jujur untuk pertama kalinya.`,
    ],
    kuat: [
      (o) => `${o.penampakan.charAt(0).toUpperCase() + o.penampakan.slice(1)} — kali ini cukup jelas untuk diikuti sampai gerbang tua, meski kakinya gemetar karena senang.`,
      (o) => `Badai kecil datang hanya untuk mengetuk jendela ${o.nama}. Ketika dibuka, isinya bukan air hujan, melainkan surat dari daun.`,
      (o) => `${o.benda} bercahaya terang di tengah malam, menuntun jalur menuju tempat yang tak terdapat di peta mana pun.`,
      (o) => `${o.nama2} mengikuti kupu-kupu itu sampai taman bunga — dan menemukan semua orang yang pernah berbaik hati sedang menunggu untuk berterima kasih.`,
      (o) => `Menara jam berbunyi dua belas kali di siang terang. Di detik terakhir, seluruh desa mencium bau roti hangat.`,
      (o) => `Perahu kertas di pelabuhan berlayar sendiri ke tengah danau, membawa satu nama yang ditulis dengan kapur.`,
    ],
    lanjutan: [
      (o, lok) => `${o.nama} bertanya pada satu-satunya yang selalu tahu: penjaga taman di ${lok}. Jawabannya selalu sama — "Perhatikan yang kecil, ia sedang menyapa."`,
      (o, _lok) => `Mereka menyiapkan pesta kecil: kue, lagu, dan satu kursi kosong untuk tamu yang belum datang.`,
      (o, lok) => `Di ${lok}, hujan bunga pertama tahun itu turun tepat ketika semua orang berbagi makanan.`,
      (o, _lok) => `${o.nama2} membuat peta kecil dari semua kejadian ajaib — dan peta itu membentuk jalan menuju satu pintu.`,
      (o, _lok) => `Ia menuliskan semua kejadian di buku bersampul biru; entri terakhir selalu bertambah sendiri satu kata: "hampir".`,
      (o, lok) => `Penduduk ${lok} sepakat berkumpul serombongan — bukan karena takut, tapi karena tak ingin ketinggalan keajaiban berikutnya.`,
    ],
    twist: [
      "penjaga keajaiban desa itu ternyata kakeknya dulu — yang kini hidup dalam setiap bunga yang pernah ia tanam",
      "biji bintang itu bukan pemberian: itu balasan untuk semua roti yang selama ini dibagikannya tanpa hitung-hitungan",
      "kupu-kupu biru adalah surat dari teman kecilnya yang pindah jauh — dan mereka bertemu di taman pada halaman terakhir",
      "yang mengetuk jendela tiap badai bukan roh jahat, melainkan awan kecil yang takut petir dan ingin teman",
      "taman bunga yang tak pernah layu bertambah satu bunga setiap ada orang yang berbagi tanpa diminta",
      "seruling itu bersuara indah bukan karena kayunya — karena siapa pun yang memainkannya mulai mengingat hal-hal baik",
    ],
    selesai: [
      "Mereka mengadakan pesta di bawah menara jam: kue untuk yang paling lapar, lagu untuk yang paling diam. Bintang jatuh satu lagi — dan kali ini semua orang menangkapnya bersama.",
      "Kakek Damar memainkan lagu penutup; kunang-kunang datang beramai-ramai seperti publik kecil yang setia.",
      "Lira menenun kain dari benang warna malam itu. Setiap kali dilihat lagi, ada satu detail baru yang tak pernah sama.",
      "Nina menuliskan resep terakhir di kedainya: \"Bahan utama: satu kejujuran kecil per hari. Sisanya ikut hangat sendiri.\"",
      "Dan desa di balik bukit tetap meninggalkan satu jendela terbuka — sebab keajaiban, seperti tamu baik, hanya butuh tahu bahwa ia disambut.",
    ],
    judulPola: [
      (a, _b) => `Biji Bintang dari ${a}`, (b, _a) => `${b} dan Kupu-Kupu Biru`,
      (a, _b) => `Keajaiban Kecil di ${a}`, (b, _a) => `Tamu Tak Terduga di ${b}`,
      (a, _b) => `Jendela Terbuka ${a}`,
    ],
    judulBab: ["Biji Bintang", "Kupu-Kupu Biru", "Roti Setengah", "Gerbang Tua", "Taman Tak Layu", "Menara Ramah", "Hujan Bunga", "Peta Kecil", "Surat dari Daun", "Lonceng Sekali", "Tamu Badai", "Kursi Kosong", "Pesta Kecil", "Jendela Terbuka"],
    eskalasi: (o) => `Malam itu ${o.nama} tidak tidur karena takut — ia terjaga karena penasaran yang indah. Ia menaruh satu cangkir susu di jendela, untuk siapa pun yang sedang menuju ke sana.`,
    epilog: (nama, nama2) => `${nama2} mengajak ${nama} menanam satu biji lagi di tepi jalan. "Untuk orang yang lewat nanti," katanya, "biar jalan ini selalu punya cerita."`,
  },

  motivasi: {
    pembuka: [
      "Ada peta yang tak dijual di toko mana pun: peta menuju versi diri yang belum terjadi. Malam ini, seseorang mulai menggambarnya.",
      "Kota itu punya jutaian cerita gagal yang nyaman diceritakan berulang. Ia memutuskan menulis bagian yang berbeda — yang setelah gagal.",
    ],
    tokoh: [
      ["Ayu", "barista yang menyisihkan untung pertama"], ["Farhan", "mahasiswa pekerja shift malam"],
      ["Pak Rudy", "pelatih yang percaya pada latihan kecil"], ["Melati", "penjual roti keliling paling gigih"],
      ["Dika", "pemula yang menabung dari ransel bekas"], ["Bu Sari", "guru yang menyimpan surat penolakan muridnya"],
    ],
    lokasi: [
      "kantor kecil lantai tiga yang sewa murah", "lapangan futsal di belakang pasar",
      "dapur roti yang menyala pukul tiga pagi", "kafe sudut yang nyaris tutup",
      "asrama mahasiswa sempit tapi rapi", "stasiun bus pukul lima pagi",
    ],
    pemicu: [
      "menerima surel penolakan yang ketujuh",
      "menandatangani surat jual sepeda kesayangannya",
      "melihat papan skor terakhir musim lalu",
      "menghitung tabungan yang tinggal untuk dua minggu",
      "mendengar kalimat \"mungkin kamu tidak cocok\" dari orang yang dikaguminya",
      "memeluk kotak pindahan dan berjanji hanya berlabuh sementara",
    ],
    benda: [
      "buku rencana berhalaman lecek", "botol tinta pertama dari gaji pertama",
      "sepatu lari yang solnya habis dua kali", "papan tulis kecil bertuliskan target 90 hari",
      "sertifikat kejuaraan lama yang kusut", "termos kopi penyerta di semua begadang",
      "amplop berisi kartu nama yang dikumpulkan satu-satu", "tas ransel berlubang yang membuktikan banyak jalan",
    ],
    fragmen: [
      "daftar target di kulkas yang bertambah satu baris", "lampu kamar yang menyala setelah lampu jalan mati",
      "joging sebelum fajar di jalan yang sepi", "daftar penolakan yang kini dibingkai",
      "jam tangan yang diputar ulang setiap kali ingin berhenti", "sarapan sederhana supaya mimpi bisa sedikit mewah",
    ],
    tanda: [
      (o) => `Setiap pagi pada jam yang sama, ${o.penampakan}. Tidak ada yang ajaib — hanya pengulangan yang pelan-pelan berubah jadi kekuatan.`,
      (o) => `${o.nama2} mulai memperhatikan: yang dulu dicap nekat, kini ditanyakan cara kerjanya.`,
      (o) => `${o.benda} penuh coretan baru — bukan mimpinya yang berubah, melainkan langkahnya yang makin kecil dan makin pasti.`,
      (o) => `Penolakan pertama dijahit ulang jadi catatan pembelajaran; sejak itu tiap "tidak" punya lampiran: "karena… dan besok aku…".`,
      (o) => `Ia berhenti menunggu suasana hati. Jadwal tak peduli suasana hati — dan entah kenapa itu justru melegakan.`,
      (o) => `Papan skor kecil di kamarnya bertambah satu garis miring: hari keempat belas tanpa melewatkan satu latihan.`,
    ],
    kuat: [
      (o) => `${o.penampakan.charAt(0).toUpperCase() + o.penampakan.slice(1)} — lalu datang ujian yang besar: satu peluang hanya dibuka tiga hari, dan modalnya tinggal sepertiga.`,
      (o) => `Malam sebelum hari penentuan, listrik kamarnya mati. ${o.nama} memindahkan catatannya ke bawah lampu jalan — dan menyelesaikannya di sana.`,
      (o) => `${o.nama2}, yang paling mendukung, justru menarik diri di tengah jalan. ${o.nama} belajar mendorong pilihan sendiri tanpa menyalakannya.`,
      (o) => `Alat utamanya rusak tiga hari sebelum pameran pertama. Tangan panik, lalu ingat papan target: "Plan B bukan aib."`,
      (o) => `Penolakan kedelapan datang dari tempat yang paling diinginkan. Ia membacanya dua kali — lalu menulis di papan: "Belum berarti tidak."`,
      (o) => `Tubuhnya menyerah dua hari: demam tinggi. ${o.nama2} menggantikan sebagian tugasnya tanpa diminta — dan itu pelajaran lain: meminta bantuan.`,
    ],
    lanjutan: [
      (o, _lok) => `${o.nama} memecah target besar jadi langkah harian yang kecilnya memalukan — dan justru di situ progres mulai terlihat.`,
      (o, _lok) => `Mereka membuat kubu kecil: berbagi jadwal, saling mengabsen, dan satu aturan — dilarang menghina diri sendiri.`,
      (o, lok) => `Setiap sore mereka berlatih di ${lok} selama satu jam persis. Tidak panjang; yang penting tak pernah kosong.`,
      (o, _lok) => `Ia mulai mendokumentasikan prosesnya — bukan untuk pamer, tapi untuk membuktikan pada dirinya sendiri bahwa garis naiknya nyata.`,
      (o, _lok) => `Gagal yang keempat belas dicatat dengan rapi. Baris ke-15 dibuka kosong, di atasnya ditulis: "siap menerima data baru".`,
      (o, _lok) => `${o.nama2} kembali membawa dua cangkir kopi. Mereka tak bicara banyak; jadwal bicara sendiri.`,
    ],
    twist: [
      "penolakan itu datang karena idenya terlalu maju waktunya — setahun kemudian, pihak yang sama memintanya kembali dengan syarat lebih baik",
      "guru yang dulu meragukannya ternyata menyimpan semua tulisannya — sebagai bahan mengajar untuk murid-murid berikutnya",
      "usaha kecil yang \"gagal\" itu justru jadi referensi terbaiknya: datanya dicari banyak orang",
      "sepeda yang dijual untuk modal kini kembali kepadanya — dibeli dan dirawat orang yang pertama kali ia tolong di jalan",
      "yang membuatnya bertahan bukan semangat besar, melainkan kebiasaan kecil yang tak boleh pindah dari jadwalnya",
      "posisi yang ia idamkan akhirnya ia tolak sendiri — karena di tengah perjalanan ia menemukan soal yang lebih layak dijawab",
    ],
    selesai: [
      "Tahun berikutnya, papan target 90 hari itu diganti: sekarang berisi nama-nama orang yang ikut naik bersamanya.",
      "Bu Sari membingkai surat penolakan pertamanya dan menaruhnya di kelas: \"Baca sampai garis terakhir — di situ letak pelajarannya.\"",
      "Toko kecilnya buka di sudut yang dulu dikira terlalu sepi. Antreannya pendek tapi setia — dan pemiliknya tak pernah lupa nama pelanggan.",
      "Ia menyelesaikan lomba itu bukan juara pertama, tapi tepat waktu dan tanpa berhenti di tengah. Pak Rudy bilang itu kelas juara yang berbeda.",
      "Malam itu ia tidur awal. Besoknya jadwal terisi lagi — bukan beban lama, melainkan pilihan yang kini ia mengerti.",
    ],
    judulPola: [
      (a, _b) => `Langkah Kecil di ${a}`, (_a, b) => `${b} Tidak Menyerah`,
      (a, _b) => `Fajar ${a}`, (_a, b) => `Sembilan Puluh Hari ${b}`,
      (a, _b) => `Papan Target ${a}`,
    ],
    judulBab: ["Penolakan Ketujuh", "Papan Target", "Joging Fajar", "Plan B", "Sepeda Kesayangan", "Jam Malam", "Amplop Kosong", "Hari ke-14", "Alat Rusak", "Demam", "Kubu Kecil", "Tiga Hari", "Garis Naik", "Papan Skor"],
    eskalasi: (o) => `Malam itu ${o.nama} berhenti mengeluh. Ia menulis ulang rencananya di papan: langkah-langkahnya ia perkecil, tekadnya ia perbesar.`,
    epilog: (nama, nama2) => `${nama2} mengetuk kamarnya pagi-pagi, membawa dua roti. "Hari ke-91," katanya, "mulai sekarang kita menulis bab yang lebih ringan."`,
  },

  fakta: {
    pembuka: [
      "Dunia tidak pernah benar-benar selesai dijelaskan. Ia hanya menunggu orang yang cukup penasaran untuk mencatat — dan malam ini, satu catatan kecil terbuka.",
      "Ada keanehan yang bukan mistis, melainkan cerita: ia hanya butuh orang yang mau bertanya sampai selesai.",
    ],
    tokoh: [
      ["Nadia", "guru sains muda penyuka penggaris"], ["Pak Seno", "penjaga museum yang hafal semua nomor etalase"],
      ["Gilang", "pelajar yang mencatat cuaca tiap hari"], ["Roro", "dokter hewan desa yang penasaran"],
      ["Mas Tono", "nelayan tua pembaca awan"], ["Vira", "pustakawan yang membaca indeks sebelum ceritanya"],
    ],
    lokasi: [
      "museum kecil di ujung jalan", "observatorium rakyat di bukit",
      "kebun raya di belakang kampus", "pelabuhan nelayan pukul empat pagi",
      "gudang alat sains sekolah", "stasiun cuaca tua di tepi sawah",
    ],
    pemicu: [
      "menemukan keanehan yang tak masuk akal di buku catatan lama",
      "mencatat cuaca selama sembilan puluh hari berturut-turut",
      "menyimpan botol air hujan pertama setiap bulan",
      "membeli kerang tua di pasar loak",
      "mengarsipkan surat kabar lima puluh tahun lalu",
      "mengukur tinggi tanaman tiap sore dengan penggaris kayu",
    ],
    benda: [
      "botol berisi sampel hujan pertama", "buku catatan cuaca berhalaman kusut",
      "kerang yang berdengung saat badai datang", "peta gempa tua berlubang pin di titik sama",
      "penggaris kayu berskala ganda", "album kupu-kupu dengan satu halaman kosong",
      "jam ayunan yang berjalan lebih cepat di kamar dingin", "barometer kuningan yang jatuh sebelum hujan besar",
    ],
    fragmen: [
      "angka-angka yang tersusun seperti spiral", "jam yang berjalan lebih cepat di kamar dingin",
      "kupu-kupu yang datang berdua sebelum hujan", "cahaya lembut di kaki langit tepat sebelum subuh",
      "bintang yang berkedip berpola, bukan acak", "garis-garis halus di batu tepi sungai",
    ],
    tanda: [
      (o) => `Setiap hari pada jam yang sama, ${o.penampakan}. Tidak ada yang menakutkan — yang menarik justru keteraturan yang tak disengaja.`,
      (o) => `${o.nama} mencatatnya tiga puluh hari berturut-turut. Polanya makin jelas, dan bukti tersusun sendiri.`,
      (o) => `${o.benda} berubah sebelum cuaca berubah — selisihnya selalu enam jam, seolah punya kalender sendiri.`,
      (o) => `${o.nama2} menguji ulang dengan alat lain. Hasilnya cocok. Keanehan itu kini resmi: bukan salah alat.`,
      (o) => `Di tiga catatan lama dari tiga orang yang tak saling kenal, angka yang sama muncul di halaman yang berbeda-beda.`,
      (o) => `Peta gempa itu berlubang pin di titik yang persis sama setiap sepuluh tahun — dan tahun kesepuluh sedang berjalan.`,
    ],
    kuat: [
      (o) => `${o.penampakan.charAt(0).toUpperCase() + o.penampakan.slice(1)} — kali ini cukup terukur untuk dihitung, dan angkanya jauh melebihi dugaan buku.`,
      (o) => `Hujan datang tepat enam jam setelah ${o.benda} berubah — untuk kesembilan belas kalinya. Kebetulan tidak sekuat itu.`,
      (o) => `${o.nama2} membawa hasil temuannya ke orang paling kritis di kota; yang terjadi bukan cemoahan, melainkan sunyi yang penuh rasa penasaran.`,
      (o) => `Kerang itu berdengung saat langit masih cerah. Dua hari kemudian, badai terbesar tahun itu mendarat seperti dengungnya.`,
      (o) => `Album kupu-kupu itu terbuka sendiri di halaman kosong saat angin kencang — dan halaman itu akhirnya terisi: spesies yang katanya tak pernah turun ke dataran rendah.`,
      (o) => `Jam ayunan berjalan lebih cepat saat kamar didinginkan — bukan rusak: ia mengukur sesuatu yang lebih halus dari waktu.`,
    ],
    lanjutan: [
      (o, _lok) => `${o.nama} menyusun tabel: tanggal, jam, suhu, arah angin. Penjelasan yang menakjubkan biasanya duduk di kolom yang paling sering diabaikan.`,
      (o, _lok) => `Mereka mengundang guru sains lain untuk menggugat temuannya. Makin digugat, makin kokoh tumpannya.`,
      (o, lok) => `Di ${lok}, arsip lima puluh tahun dibuka; keanehan yang sama tercatat — hanya tak pernah dihitung ulang.`,
      (o, _lok) => `${o.nama2} mereplikasi percobaannya di tempat berbeda. Hasilnya konsisten — dan pertanyaannya berubah jadi "mengapa".`,
      (o, _lok) => `Malam itu mereka menghitung ulang semua angka dengan tangan, pelan-pelan, dan menemukan satu nol yang dulu terlewat.`,
      (o, _lok) => `Ia menulis surat ke komunitas pengamat terdekat, melampirkan tabel dan foto, plus satu kalimat jujur: "Aku butuh yang menyanggah."`,
    ],
    twist: [
      "keanehan itu ternyata jejak peristiwa tua yang tercatat di tiga arsip berbeda — mereka orang pertama yang menghitung ulang",
      "dengung kerang bukan prediksi badai: kerang bereaksi pada gelombang yang datang lebih cepat daripada awannya",
      "angka yang sama di tiga catatan lama ternyata pola tahunan yang benar-benar ada — dan sudah lama menunggu siapa pun mau menghitungnya",
      "jam ayunan berjalan lebih cepat karena suhu: udara dingin mengencangkan pendulumnya — penjelasan sederhana yang indah",
      "halaman kosong album itu tak kosong: kupu-kupunya menunggu hujan pertama untuk terbang, dan catatannya selalu menyusul",
      "lubang pin di peta gempa menyusun lingkaran — pusatnya bukan gunung, melainkan sungai tua yang arahnya pernah berbalik",
    ],
    selesai: [
      "Temuan kecil itu akhirnya terbit di buletin komunitas. Tidak bombastis — tapi lima sekolah mulai meniru tabel cuacanya.",
      "Pak Seno memindahkan etalase kerang ke dekat jendela dan menempel kartu kecil: \"Berbunyi sebelum badai. Periksa tanggalnya.\"",
      "Nadia membawa catatan itu ke kelas dan memberi tugas yang sama pada muridnya: ukur, catat, jangan percaya sebelum dihitung ulang.",
      "Museum menambah satu lembar arsip: bukan benda yang berubah, melainkan cara bertanya orang-orang yang datang kemudian.",
      "Dan setiap kali hujan datang enam jam kemudian, tak ada yang tepuk tangan. Ada yang mencatat — itu jauh lebih indah.",
    ],
    judulPola: [
      (a, _b) => `Keanehan di ${a}`, (_a, b) => `Sembilan Puluh Hari ${b}`,
      (a, _b) => `Tabel ${a}`, (_a, b) => `Nomor Etalase ${b}`,
      (a, _b) => `Angka yang Sama di ${a}`,
    ],
    judulBab: ["Penggaris Kayu", "Tabel Suhu", "Kerang Berdengung", "Enam Jam", "Peta Berlubang", "Halaman Kosong", "Arsip Lima Puluh", "Menghitung Ulang", "Dua Alat", "Yang Tak Terjawab", "Surat Kecil", "Penggugat", "Nol yang Terlewat", "Buletin"],
    eskalasi: (o) => `Malam itu ${o.nama} berhenti menganggapnya kebetulan. Ia menyusun tabel baru — lebih teliti, lebih jujur, dan siap dibantah.`,
    epilog: (nama, nama2) => `${nama2} mengantarkan ${nama} ke stasiun. "Catatan berikutnya jangan berhenti di halaman seratus," katanya, "dunia masih panjang."`,
  },
};

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

function objekDariIde(ide: string, poolBenda: string[] = BENDA, poolFrag: string[] = PENAMPAKAN): { benda: string | null; penampakan: string | null } {
  const il = ide.toLowerCase();
  let benda: string | null = null;
  let penampakan: string | null = null;
  for (const [k, daftar] of Object.entries(KATA_OBJEK)) {
    if (!daftar.some((k2) => il.includes(k2))) continue;
    if (!benda) benda = poolBenda.find((b) => b.includes(k)) ?? null;
    if (!penampakan) penampakan = poolFrag.find((p) => p.includes(k)) ?? null;
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
  /** v0.29.0 — genre AI Video Generator (bawaan: horor) */
  genre?: GenreId;
}

/** Buat cerita lengkap (6 genre). Deterministik terhadap seed. */
export function buatCerita(opsi: OpsiCerita = {}): Cerita {
  const seed = (opsi.seed ?? Math.floor(Math.random() * 2 ** 31)) >>> 0;
  const r = buatPrng(seed);
  const pilih = <T>(a: T[]): T => a[Math.floor(r() * a.length) % a.length];

  const genreId: GenreId = opsi.genre && GENRE_IDS.includes(opsi.genre) ? opsi.genre : "horor";
  const bank = genreId === "horor" ? null : BANK_G[genreId];
  const gInfo = ambilGenre(genreId);

  const ide = (opsi.ide ?? "").trim();
  const temaDariIde = ide ? pilihTemaDariIde(ide) : null;
  const temaPilihan = temaDariIde ?? (opsi.tema && opsi.tema !== "acak" ? opsi.tema : pilih(["rumah", "sekolah", "kantor", "desa"] as const));
  const poolBenda = bank ? bank.benda : BENDA;
  const poolFrag = bank ? bank.fragmen : PENAMPAKAN;
  const objek = ide ? objekDariIde(ide, poolBenda, poolFrag) : { benda: null, penampakan: null };
  const lokasiIde = ide ? lokasiDariIde(ide) : null;

  // lokasi: genre non-horor punya lokasi khas — 60% dari bank, sisanya lokasi tema
  const lokasi = lokasiIde ?? (bank && r() < 0.6 ? pilih(bank.lokasi) : pilih(LOKASI[temaPilihan] ?? SEMUA_LOKASI));
  const poolTokoh = bank ? [...TOKOH, ...bank.tokoh] : TOKOH;
  const [nama, sifat] = pilih(poolTokoh);
  const [nama2, sifat2] = (() => { let x = pilih(poolTokoh); let jaga = 0; while (x[0] === nama && jaga++ < 5) x = pilih(poolTokoh); return x; })();
  const pemicu = bank ? pilih(bank.pemicu) : pilih(PEMICU);
  const benda = objek.benda ?? pilih(poolBenda);
  const penampakanUtama = objek.penampakan ?? pilih(poolFrag);
  const penampakan = (() => { let x = pilih(poolFrag); let jaga = 0; while (x === penampakanUtama && jaga++ < 5) x = pilih(poolFrag); return x; })();
  const bau = pilih(BAU);
  const malam = pilih(SUARA_MALAM);
  const twist = bank ? pilih(bank.twist) : pilih(TWIST);
  const selesai = bank ? pilih(bank.selesai) : pilih(PENYELESAIAN);
  const judul = pilih(bank ? bank.judulPola : JUDUL_POLA)(lokasi.split(" ")[0].replace(/^./, (c) => c.toUpperCase()), nama);

  const tTema: Record<string, string[]> = {
    rumah: ["Kampung itu masih percaya: jangan menoleh kalau ada yang memanggil dari dalam rumah."],
    sekolah: ["Legenda sekolah itu tidak pernah ditulis di dinding; ia diwariskan dari bisik ke bisik."],
    kantor: ["Shift malam punya aturan tak tertulis: lampu koridor boleh mati, tapi jangan mati bersamanya."],
    desa: ["Di desa itu, malam Jumat bukan untuk keluar. Bahkan kucing pun tahu."],
  };
  const pembukaSuasana = bank ? pilih(bank.pembuka) : tTema[temaPilihan][0];

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
      `${pembukaIde} ${pembukaSuasana}`,
      `Awalnya semuanya biasa saja — ${bau} menyambut di ambang pintu, dan ${nama2}, ${sifat2}, adalah satu-satunya wajah yang sering ia temui.`,
    ],
  });

  // bab 2 — Pemicu (dilewati bila jumlahBab === 3)
  if (jumlahBab >= 5) {
    bab.push({
      judul: "Pemicu",
      paragraf: [
        `Semuanya berubah ketika ia mulai ${pemicu}.`,
        bank
          ? `Di dalamnya ada ${benda} — seolah sedang menunggu ditemukan. ${nama2} memperingatkan: "Kalau memang menarik perhatianmu, jaga jaraknya dulu. Biarkan ia yang menyesuaikan diri."`
          : `Di dalamnya ada ${benda}, berdein tebal, seolah menunggu diambil. ${nama2} memperingatkan: "Jangan dibawa ke kamar. Apapun yang tertarik padanya, biarkan tertarik pada ruang tamu saja."`,
      ],
    });
  }

  // bab tengah — Tanda & Momen Kuat bergantian, intensitas menaik, tanpa pengulangan
  const tanda = [...(bank ? bank.tanda : KEJADIAN_TANDA)];
  const teror = [...(bank ? bank.kuat : KEJADIAN_TEROR)];
  const tarik = (pool: ((e: Even) => string)[], cadangan: ((e: Even) => string)[]): ((e: Even) => string) => {
    if (!pool.length) pool.push(...cadangan);
    return pool.splice(Math.floor(r() * pool.length), 1)[0];
  };
  const babTengah = jumlahBab === 3 ? 1 : Math.max(0, jumlahBab - 3);
  for (let i = 0; i < babTengah; i++) {
    const mulaiTeror = jumlahBab === 3 ? true : i % 2 === 1; // pendek: langsung momen kuat
    const kalimat = tarik(mulaiTeror ? teror : tanda, mulaiTeror ? (bank ? bank.kuat : KEJADIAN_TEROR) : (bank ? bank.tanda : KEJADIAN_TANDA))(even);
    const eskalasi = i >= babTengah - 1;
    const lanjutan = eskalasi
      ? bank
        ? bank.eskalasi(even)
        : `Malam itu juga, ${nama} berhenti berani tidur sendirian. ${nama2} menyalakan lampu kecil di lorong — "Sedikit pun berguna," katanya, "kalau kamu tak mau melihat lebih jauh."`
      : bank
        ? bank.lanjutan[i % bank.lanjutan.length](even, lokasi)
        : LANJUTAN_TENGAH[i % LANJUTAN_TENGAH.length](even, lokasi);
    const judulTengah = jumlahBab === 3
      ? (bank ? bank.judulBab[1] : "Teror")
      : bank
        ? bank.judulBab[(i * 2 + (mulaiTeror ? 1 : 0)) % bank.judulBab.length]
        : JUDUL_BAB_TENGAH[(i * 2 + (mulaiTeror ? 1 : 0)) % JUDUL_BAB_TENGAH.length];
    bab.push({ judul: judulTengah, paragraf: [kalimat, lanjutan] });
  }

  // bab akhir — twist + penyelesaian selalu masuk
  bab.push({
    judul: gInfo.babAkhir,
    paragraf: [
      bank
        ? `Akhirnya, ${nama} menemukan jawaban yang dicari-carinya. ${twist.charAt(0).toUpperCase() + twist.slice(1)}.`
        : `Di bawah lantai kayu, ${nama} menemukan jawabannya. ${twist.charAt(0).toUpperCase() + twist.slice(1)}.`,
      selesai,
    ],
  });

  const hasil = bab.slice(0, jumlahBab);
  if (opsi.panjang === "panjang") {
    hasil[hasil.length - 1].paragraf.push(
      bank
        ? bank.epilog(nama, nama2)
        : `Lusa, ${nama} memakankan ${pilih(["nasi kotak", "kopi panas", "roti manis"])} di teras untuk ${nama2}, bercerita panjang lebar. ${nama2} hanya mendengarkan, lalu berkata pelan: "Yang penting kau sudah tahu kapan harus pulang."`,
    );
  }
  return { judul, tema: temaPilihan, bab: hasil, seed, genre: genreId };
}

/** Estimasi durasi baca satu paragraf (tanpa TTS): ~2.6 kata/dtk + jeda */
export function estimasiDurasi(paragraf: string): number {
  const kata = paragraf.split(/\s+/).filter(Boolean).length;
  return Math.max(6, Math.round(kata / 2.6 + 2));
}
