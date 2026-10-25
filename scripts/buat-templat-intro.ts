// VidSplit v2.1.0 — GENERATOR 10 TEMPLATE INTRO SIAP PAKAI (SVG → sharp → PNG)
// Dijalankan: npx tsx scripts/buat-templat-intro.ts   (butuh node_modules: sharp)
//
// Keluaran: public/intro/<id>-916.png (1080×1920) — dipakai menu
// "6. Background intro" sebagai latar pembuka siap pakai bergaya horor VidSplit.
// Desain TANPA teks — teks judul ditambahkan user lewat fitur "Teks di atas intro"
// sehingga bisa diganti-ganti tanpa regenerasi gambar.
// Seluruh desain gelap di tengah → teks putih selalu terbaca.
import { mkdirSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const W = 1080;
const H = 1920;

type Desain = { id: string; svg: string };

const buka = (isi: string, latar: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="latar" x1="0" y1="0" x2="0" y2="1">${latar}</linearGradient>
    <radialGradient id="vinyet" cx="50%" cy="42%" r="75%">
      <stop offset="55%" stop-color="#000000" stop-opacity="0"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0.82"/>
    </radialGradient>
    <filter id="blurBesar" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="70"/>
    </filter>
    <filter id="blurSedang" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="26"/>
    </filter>
  </defs>
  ${isi}
  <rect width="${W}" height="${H}" fill="url(#vinyet)"/>
</svg>`;

const DESAIN: Desain[] = [
  {
    id: "kabut-kelam",
    svg: buka(
      `<rect width="${W}" height="${H}" fill="url(#latar)"/>
       <ellipse cx="540" cy="1500" rx="700" ry="300" fill="#243b32" opacity="0.85" filter="url(#blurBesar)"/>
       <ellipse cx="200" cy="900" rx="420" ry="240" fill="#31493d" opacity="0.6" filter="url(#blurBesar)"/>
       <ellipse cx="900" cy="700" rx="380" ry="220" fill="#1c2f27" opacity="0.7" filter="url(#blurBesar)"/>
       <ellipse cx="540" cy="500" rx="460" ry="200" fill="#0d1713" opacity="0.8" filter="url(#blurBesar)"/>`,
      `<stop offset="0%" stop-color="#0b1210"/><stop offset="55%" stop-color="#12211b"/><stop offset="100%" stop-color="#070d0b"/>`,
    ),
  },
  {
    id: "kilat-merah",
    svg: buka(
      `<rect width="${W}" height="${H}" fill="url(#latar)"/>
       <path d="M600 80 L430 720 L560 720 L380 1500 L760 860 L600 860 L800 80 Z"
             fill="#c1272d" opacity="0.28" filter="url(#blurSedang)"/>
       <path d="M600 80 L430 720 L560 720 L380 1500 L760 860 L600 860 L800 80 Z"
             fill="#ff5c5c" opacity="0.5" filter="url(#blurBesar)"/>
       <ellipse cx="540" cy="1700" rx="620" ry="260" fill="#5c0f14" opacity="0.55" filter="url(#blurBesar)"/>`,
      `<stop offset="0%" stop-color="#12060a"/><stop offset="60%" stop-color="#1d0d12"/><stop offset="100%" stop-color="#0a0406"/>`,
    ),
  },
  {
    id: "bulan-purnama",
    svg: buka(
      `<rect width="${W}" height="${H}" fill="url(#latar)"/>
       <circle cx="540" cy="560" r="360" fill="#aecbff" opacity="0.16" filter="url(#blurBesar)"/>
       <circle cx="540" cy="560" r="205" fill="#dfe8f7" opacity="0.85" filter="url(#blurSedang)"/>
       <circle cx="540" cy="560" r="185" fill="#eef3fb" opacity="0.95"/>
       <circle cx="480" cy="520" r="26" fill="#c9d5ea" opacity="0.7"/>
       <circle cx="600" cy="610" r="40" fill="#c9d5ea" opacity="0.55"/>
       <circle cx="560" cy="470" r="16" fill="#c9d5ea" opacity="0.6"/>
       <path d="M0 1500 L140 1330 L240 1470 L360 1290 L470 1480 L610 1300 L720 1460 L850 1310 L960 1470 L1080 1330 L1080 1920 L0 1920 Z"
             fill="#04070d" opacity="0.96"/>`,
      `<stop offset="0%" stop-color="#070d1a"/><stop offset="55%" stop-color="#101c33"/><stop offset="100%" stop-color="#05080f"/>`,
    ),
  },
  {
    id: "kuburan-asap",
    svg: buka(
      `<rect width="${W}" height="${H}" fill="url(#latar)"/>
       <g fill="#0e0a12" opacity="0.95">
         <rect x="220" y="1150" width="46" height="330" rx="10"/>
         <rect x="160" y="1230" width="166" height="40" rx="10"/>
         <rect x="800" y="1210" width="42" height="290" rx="9"/>
         <rect x="748" y="1285" width="146" height="34" rx="8"/>
         <rect x="520" y="1280" width="38" height="240" rx="8"/>
       </g>
       <ellipse cx="540" cy="1560" rx="720" ry="240" fill="#2a2136" opacity="0.55" filter="url(#blurBesar)"/>
       <ellipse cx="300" cy="1050" rx="380" ry="200" fill="#241c30" opacity="0.5" filter="url(#blurBesar)"/>`,
      `<stop offset="0%" stop-color="#0c0812"/><stop offset="55%" stop-color="#171022"/><stop offset="100%" stop-color="#060409"/>`,
    ),
  },
  {
    id: "api-neraka",
    svg: buka(
      `<rect width="${W}" height="${H}" fill="url(#latar)"/>
       <ellipse cx="540" cy="1980" rx="900" ry="520" fill="#7a2410" opacity="0.6" filter="url(#blurBesar)"/>
       <ellipse cx="540" cy="2050" rx="700" ry="420" fill="#e8590c" opacity="0.5" filter="url(#blurBesar)"/>
       <path d="M340 1920 Q420 1600 380 1450 Q470 1620 470 1450 Q540 1700 560 1430 Q600 1660 640 1470 Q660 1640 740 1500 Q700 1720 780 1920 Z"
             fill="#ff7a2f" opacity="0.35" filter="url(#blurSedang)"/>
       <g fill="#ffb454" opacity="0.75">
         <circle cx="300" cy="1300" r="5"/><circle cx="700" cy="1200" r="4"/>
         <circle cx="480" cy="1150" r="3"/><circle cx="620" cy="1400" r="6"/>
         <circle cx="400" cy="1500" r="4"/><circle cx="780" cy="1560" r="5"/>
         <circle cx="520" cy="980" r="3"/><circle cx="860" cy="1080" r="4"/>
       </g>`,
      `<stop offset="0%" stop-color="#1a0f0a"/><stop offset="60%" stop-color="#4a2413"/><stop offset="100%" stop-color="#200c06"/>`,
    ),
  },
  {
    id: "pocong-bayang",
    svg: buka(
      `<rect width="${W}" height="${H}" fill="url(#latar)"/>
       <ellipse cx="540" cy="1620" rx="360" ry="120" fill="#000000" opacity="0.6" filter="url(#blurSedang)"/>
       <g opacity="0.88" filter="url(#blurSedang)">
         <circle cx="540" cy="640" r="105" fill="#d8d8d2"/>
         <rect x="440" y="730" width="200" height="480" rx="90" fill="#d8d8d2"/>
         <rect x="430" y="700" width="220" height="46" rx="20" fill="#b9b9b2"/>
         <rect x="430" y="900" width="220" height="40" rx="18" fill="#b9b9b2"/>
         <rect x="430" y="1090" width="220" height="40" rx="18" fill="#b9b9b2"/>
       </g>
       <ellipse cx="540" cy="760" rx="300" ry="520" fill="#ffffff" opacity="0.10" filter="url(#blurBesar)"/>`,
      `<stop offset="0%" stop-color="#090a0c"/><stop offset="55%" stop-color="#14161a"/><stop offset="100%" stop-color="#050506"/>`,
    ),
  },
  {
    id: "kuntilanak",
    svg: buka(
      `<rect width="${W}" height="${H}" fill="url(#latar)"/>
       <ellipse cx="540" cy="1680" rx="380" ry="130" fill="#000000" opacity="0.6" filter="url(#blurSedang)"/>
       <g opacity="0.92">
         <path d="M540 400 Q760 400 760 680 Q760 900 700 1120 Q660 1420 640 1660 L440 1660 Q420 1420 380 1120 Q320 900 320 680 Q320 400 540 400 Z"
               fill="#0b0b0d" filter="url(#blurSedang)"/>
         <circle cx="540" cy="600" r="118" fill="#e7e3da"/>
         <circle cx="502" cy="592" r="10" fill="#101014"/>
         <circle cx="578" cy="592" r="10" fill="#101014"/>
         <path d="M395 640 Q370 800 380 1000 L700 1000 Q710 800 685 640 Q660 760 540 760 Q420 760 395 640 Z"
               fill="#0b0b0d" opacity="0.55"/>
         <path d="M400 760 Q330 1200 260 1660 L460 1660 Q500 1300 480 900 Z" fill="#0b0b0d"/>
         <path d="M680 760 Q750 1200 820 1660 L620 1660 Q580 1300 600 900 Z" fill="#0b0b0d"/>
         <path d="M540 780 Q700 780 730 1100 Q760 1400 790 1660 L290 1660 Q320 1400 350 1100 Q380 780 540 780 Z"
               fill="#f2efe8"/>
       </g>
       <ellipse cx="540" cy="800" rx="320" ry="560" fill="#ffffff" opacity="0.07" filter="url(#blurBesar)"/>`,
      `<stop offset="0%" stop-color="#08090b"/><stop offset="55%" stop-color="#121318"/><stop offset="100%" stop-color="#040405"/>`,
    ),
  },
  {
    id: "lorong-makam",
    svg: buka(
      `<rect width="${W}" height="${H}" fill="url(#latar)"/>
       <path d="M540 1920 L340 1150 L430 1150 L470 1920 Z" fill="#181510" opacity="0.9"/>
       <path d="M540 1920 L740 1150 L650 1150 L610 1920 Z" fill="#181510" opacity="0.9"/>
       <path d="M340 1150 L740 1150 L700 1080 L380 1080 Z" fill="#221d15" opacity="0.85"/>
       <g fill="#0f0d09" opacity="0.95">
         <rect x="120" y="980" width="70" height="360" rx="12"/>
         <rect x="890" y="980" width="70" height="360" rx="12"/>
         <rect x="255" y="1040" width="52" height="300" rx="10"/>
         <rect x="775" y="1040" width="52" height="300" rx="10"/>
       </g>
       <ellipse cx="540" cy="1380" rx="640" ry="300" fill="#3a3226" opacity="0.4" filter="url(#blurBesar)"/>
       <ellipse cx="540" cy="1120" rx="300" ry="140" fill="#c9b98a" opacity="0.12" filter="url(#blurBesar)"/>`,
      `<stop offset="0%" stop-color="#0d0c08"/><stop offset="55%" stop-color="#1c1910"/><stop offset="100%" stop-color="#060503"/>`,
    ),
  },
  {
    id: "mata-gaib",
    svg: buka(
      `<rect width="${W}" height="${H}" fill="url(#latar)"/>
       <ellipse cx="540" cy="640" rx="460" ry="260" fill="#0a0a0a" opacity="0.9" filter="url(#blurBesar)"/>
       <g filter="url(#blurSedang)">
         <ellipse cx="420" cy="620" rx="88" ry="42" fill="#ffd24d" opacity="0.9"/>
         <ellipse cx="665" cy="620" rx="88" ry="42" fill="#ffd24d" opacity="0.9"/>
       </g>
       <g>
         <ellipse cx="420" cy="620" rx="62" ry="26" fill="#ffea9e"/>
         <ellipse cx="665" cy="620" rx="62" ry="26" fill="#ffea9e"/>
         <circle cx="420" cy="620" r="11" fill="#100c02"/>
         <circle cx="665" cy="620" r="11" fill="#100c02"/>
       </g>
       <ellipse cx="540" cy="620" rx="430" ry="240" fill="#ff9d2f" opacity="0.10" filter="url(#blurBesar)"/>
       <path d="M0 1400 L120 1250 L230 1390 L350 1230 L470 1400 L600 1240 L720 1400 L850 1250 L960 1390 L1080 1260 L1080 1920 L0 1920 Z"
             fill="#020202" opacity="0.95"/>`,
      `<stop offset="0%" stop-color="#020202"/><stop offset="55%" stop-color="#0b0906"/><stop offset="100%" stop-color="#000000"/>`,
    ),
  },
  {
    id: "rimba-mistis",
    svg: buka(
      `<rect width="${W}" height="${H}" fill="url(#latar)"/>
       <g fill="#07130c" opacity="0.95">
         <rect x="150" y="0" width="80" height="1920"/>
         <rect x="430" y="0" width="60" height="1920"/>
         <rect x="700" y="0" width="90" height="1920"/>
         <rect x="950" y="0" width="56" height="1920"/>
       </g>
       <ellipse cx="540" cy="1600" rx="700" ry="300" fill="#0e2417" opacity="0.6" filter="url(#blurBesar)"/>
       <g fill="#9fe870" opacity="0.8">
         <circle cx="300" cy="820" r="5"/><circle cx="620" cy="700" r="4"/>
         <circle cx="820" cy="960" r="5"/><circle cx="500" cy="1150" r="4"/>
         <circle cx="180" cy="1250" r="4"/><circle cx="900" cy="1300" r="3"/>
         <circle cx="400" cy="980" r="3"/>
       </g>
       <ellipse cx="540" cy="900" rx="360" ry="300" fill="#1d3a26" opacity="0.35" filter="url(#blurBesar)"/>`,
      `<stop offset="0%" stop-color="#050d08"/><stop offset="55%" stop-color="#0d1f14"/><stop offset="100%" stop-color="#030704"/>`,
    ),
  },
];

async function main() {
  const tujuan = path.join(process.cwd(), "public", "intro");
  mkdirSync(tujuan, { recursive: true });
  for (const d of DESAIN) {
    const file = path.join(tujuan, `${d.id}-916.png`);
    await sharp(Buffer.from(d.svg)).png({ compressionLevel: 9 }).toFile(file);
    console.log(`OK ${file}`);
  }
  console.log(`SELESAI — ${DESAIN.length} template intro ditulis ke public/intro/`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
