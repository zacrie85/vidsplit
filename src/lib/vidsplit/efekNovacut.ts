// ============================================================
// VidSplit v3.3.0 — REGISTRY EFEK & TRANSISI NOVACUT
// Port dari src/lib/novacut-fx.ts KolosalCut v1.4.9 (komentar asli:
// "Port dari src/lib/editor/constants.ts + visual.ts (NOVACUT)").
// Dipakai bersama oleh client (tab EFEK / pratinjau) & server (ffmpeg) —
// TIDAK boleh mengimpor modul DOM/Node di sini.
//
// Bedah sumber (KolosalCut v1.4.9, KINOSTRA v3.16.0 nccover.js):
//  • 28 transisi = 4 kategori (Trailer Hollywood / Iklan Produk /
//    Sinematik / Trend Viral) — server mengeksekusinya via filter
//    `xfade` ASLI ffmpeg (registry menyimpan nama xfade-nya), ANTARA
//    ekor part sebelumnya & kepala part sekarang → transisi silang
//    sungguhan antar klip (bukan fade ke hitam per part).
//  • 20 efek klip = 8 color grading + 12 efek visual, semua dirantai
//    dengan filter ffmpeg murni (planEffects di bawah — port planEffects
//    KolosalCut, dibuat PARAMETRIK W×H karena VidSplit merender semua
//    resolusi, bukan hanya 1080×1920).
// ============================================================

// ------------------------------------------------------------
// 28 TRANSISI MASUK (tampil di awal setiap bagian)
// ------------------------------------------------------------

export interface TransitionMeta {
  id: string;
  name: string;
  cat: "trailer" | "iklan" | "sinematik" | "trend";
  desc: string;
  /** nama transisi FFmpeg xfade yang dipakai server */
  xfade: string;
}

export const TRANSITIONS: TransitionMeta[] = [
  // Trailer Hollywood
  { id: "flash", name: "Flash Snap", cat: "trailer", desc: "Kilat putih ala trailer aksi Hollywood", xfade: "fadewhite" },
  { id: "whip-pan", name: "Whip Pan", cat: "trailer", desc: "Kamerasapu cepat dengan blur, khas trailer & vlog", xfade: "hblur" },
  { id: "zoom-punch", name: "Zoom Punch", cat: "trailer", desc: "Dorongan zoom khas trailer blockbuster", xfade: "zoomin" },
  { id: "zoom-blast", name: "Zoom Blast", cat: "trailer", desc: "Ledakan zoom radial dengan blur", xfade: "radial" },
  { id: "glitch-rgb", name: "RGB Glitch", cat: "trailer", desc: "Glitch digital ala trailer sci-fi", xfade: "hlslice" },
  { id: "shake-impact", name: "Impact Shake", cat: "trailer", desc: "Guncangan impact saat masuk adegan", xfade: "rectcrop" },
  { id: "bars-reveal", name: "Cinematic Bars", cat: "trailer", desc: "Bar hitam sinematik membuka adegan", xfade: "horzopen" },
  { id: "film-burn", name: "Film Burn", cat: "trailer", desc: "Light leak api khas film 35mm", xfade: "dissolve" },
  // Iklan Produk
  { id: "slide-l", name: "Slide Kiri", cat: "iklan", desc: "Geser masuk dari kanan", xfade: "slideleft" },
  { id: "slide-r", name: "Slide Kanan", cat: "iklan", desc: "Geser masuk dari kiri", xfade: "slideright" },
  { id: "slide-u", name: "Slide Atas", cat: "iklan", desc: "Geser masuk dari bawah", xfade: "slideup" },
  { id: "slide-d", name: "Slide Bawah", cat: "iklan", desc: "Geser masuk dari atas", xfade: "slidedown" },
  { id: "push-l", name: "Push Parallax", cat: "iklan", desc: "Dorongan parallax halus", xfade: "revealleft" },
  { id: "wipe-diag", name: "Diagonal Wipe", cat: "iklan", desc: "Sapuan diagonal dengan garis cahaya", xfade: "diagbl" },
  { id: "iris", name: "Iris Circle", cat: "iklan", desc: "Bukaan lingkaran klasik", xfade: "circleopen" },
  { id: "blinds", name: "Window Blinds", cat: "iklan", desc: "Bukaan tirai horizontal", xfade: "vuslice" },
  { id: "split-v", name: "Split Reveal", cat: "iklan", desc: "Belahan layar terbuka dari tengah", xfade: "squeezeh" },
  { id: "bounce", name: "Bounce Pop", cat: "iklan", desc: "Pantulan elastis playful", xfade: "circlecrop" },
  { id: "flare-sweep", name: "Flare Sweep", cat: "iklan", desc: "Sapuan flare produk premium", xfade: "smoothleft" },
  // Sinematik
  { id: "crossfade", name: "Cross Dissolve", cat: "sinematik", desc: "Lebur klasik halus", xfade: "fade" },
  { id: "dip-black", name: "Dip ke Hitam", cat: "sinematik", desc: "Tenggelam ke hitam lalu bangkit", xfade: "fadeblack" },
  { id: "dip-white", name: "Dip ke Putih", cat: "sinematik", desc: "Tenggelam ke putih terang", xfade: "fadewhite" },
  { id: "blur-dissolve", name: "Blur Dissolve", cat: "sinematik", desc: "Lebur dengan blur mimpi", xfade: "distance" },
  // Trend Viral
  { id: "spin-swap", name: "Spin Swap", cat: "trend", desc: "Putaran pertukaran adegan", xfade: "circleclose" },
  { id: "pixelate", name: "Pixelate", cat: "trend", desc: "Pecah piksel ala game retro", xfade: "pixelize" },
  { id: "tv-static", name: "TV Static", cat: "trend", desc: "Debu TV analog", xfade: "hlwind" },
  { id: "chroma-slide", name: "Chromatic Slide", cat: "trend", desc: "Geser dengan bayangan RGB", xfade: "slideleft" },
  { id: "mosaic", name: "Mosaic Reveal", cat: "trend", desc: "Ubin mosaik menyusun adegan", xfade: "vdslice" },
];

export const TRANSITION_CATS: { id: TransitionMeta["cat"]; name: string }[] = [
  { id: "trailer", name: "Trailer Hollywood" },
  { id: "iklan", name: "Iklan Produk" },
  { id: "sinematik", name: "Sinematik" },
  { id: "trend", name: "Trend Viral" },
];

export function getTransition(id: string): TransitionMeta | undefined {
  return TRANSITIONS.find((t) => t.id === id);
}

/** id transisi valid utk Pengaturan.efekTransisi ("" selalu valid = mati) */
export function isTransisiValid(id: string): boolean {
  return id === "" || TRANSITIONS.some((t) => t.id === id);
}

// ------------------------------------------------------------
// 20 EFEK BLOCKBUSTER (8 color grading + 12 efek visual)
// ------------------------------------------------------------

export interface EffectMeta {
  id: string;
  name: string;
  group: "grade" | "fx";
  desc: string;
}

export const CLIP_EFFECTS: EffectMeta[] = [
  { id: "grade-teal", name: "Teal & Orange", group: "grade", desc: "Warna khas blockbuster Hollywood" },
  { id: "grade-bleach", name: "Bleach Bypass", group: "grade", desc: "Kontras pudar ala film perang" },
  { id: "grade-noir", name: "Noir", group: "grade", desc: "Hitam putih dramatis" },
  { id: "grade-vintage", name: "Vintage Film", group: "grade", desc: "Nostalgia film jadul" },
  { id: "grade-vhs", name: "VHS Retro", group: "grade", desc: "Kaset video 90-an" },
  { id: "grade-cyber", name: "Cyberpunk Neon", group: "grade", desc: "Neon magenta-cyan futuristik" },
  { id: "grade-golden", name: "Golden Hour", group: "grade", desc: "Cahaya senja hangat" },
  { id: "grade-cold", name: "Thriller Dingin", group: "grade", desc: "Tona dingin film thriller" },
  { id: "fx-letterbox", name: "Bar Sinematik", group: "fx", desc: "Garis hitam atas-bawah 2.39:1" },
  { id: "fx-vignette", name: "Vignette", group: "fx", desc: "Sudut gelap fokus tengah" },
  { id: "fx-grain", name: "Film Grain", group: "fx", desc: "Bintik film analog" },
  { id: "fx-bloom", name: "Bloom Glow", group: "fx", desc: "Pendar cahaya lembut" },
  { id: "fx-flare", name: "Lens Flare", group: "fx", desc: "Kilau lensa sinematik" },
  { id: "fx-rgb", name: "RGB Split", group: "fx", desc: "Pecah kanal warna" },
  { id: "fx-scanline", name: "Scanline CRT", group: "fx", desc: "Garis pindai TV tabung" },
  { id: "fx-shake", name: "Handheld Shake", group: "fx", desc: "Getar kamera tangan" },
  { id: "fx-pulse", name: "Beat Pulse", group: "fx", desc: "Denut zoom mengikuti beat" },
  { id: "fx-kenburns", name: "Slow Zoom", group: "fx", desc: "Zoom perlahan Ken Burns" },
  { id: "fx-echo", name: "Ghost Trail", group: "fx", desc: "Jejak bayangan bergerak" },
  { id: "fx-spotlight", name: "Spotlight", group: "fx", desc: "Sorot lampu panggung dramatis" },
];

export function isValidEffect(id: string): boolean {
  return CLIP_EFFECTS.some((e) => e.id === id);
}

/**
 * Rantai filter FFmpeg per efek (urutan = registry).
 * Dipakai server; tab UI memakai registry ini untuk daftar + deskripsi.
 * fx-kenburns & fx-pulse butuh durasi bagian (dtk) + fps — diinterpolasi
 * lewat placeholder {DUR} / {FPS} oleh planEffects.
 */
export const EFFECT_FFMPEG: Record<string, string> = {
  // ---- color grading ----
  "grade-teal": "eq=contrast=1.18:saturation=1.3,colorbalance=rs=-0.05:gs=0.02:bs=0.10:rh=0.08:bh=-0.06",
  "grade-bleach": "eq=contrast=1.45:saturation=0.5:brightness=0.08",
  "grade-noir": "hue=s=0,eq=contrast=1.30:brightness=0.02",
  "grade-vintage": "eq=saturation=0.82:contrast=0.95:brightness=0.05,colorbalance=rs=0.05:bs=-0.03:rh=0.07:gh=0.02:bh=-0.06",
  "grade-vhs": "eq=saturation=1.35:contrast=1.12:brightness=0.02,rgbashift=rh=2:bh=-2",
  "grade-cyber": "eq=saturation=1.55:contrast=1.18,colorbalance=rs=0.07:bs=0.09:bh=0.05",
  "grade-golden": "eq=brightness=0.06:saturation=1.18,colorbalance=rh=0.10:gh=0.04:bh=-0.10",
  "grade-cold": "eq=saturation=0.9:contrast=1.22:brightness=-0.04,colorbalance=rs=-0.06:bs=0.10:bh=0.05",
  // ---- efek visual (filter murni, parametrik W×H di planEffects) ----
  "fx-letterbox": "drawbox=x=0:y=0:w=iw:h=ih*0.115:color=black@1:t=fill,drawbox=x=0:y=ih-ih*0.115:w=iw:h=ih*0.115:color=black@1:t=fill",
  "fx-vignette": "vignette=angle=PI/5",
  "fx-grain": "noise=alls=8:allf=t+u",
  "fx-rgb": "rgbashift=rh=3:bh=-3",
  "fx-echo": "lagfun=decay=0.82",
  // fx-bloom, fx-shake, fx-pulse, fx-kenburns = graf berlabel (ditangani planEffects)
  // fx-scanline / fx-spotlight / fx-flare = overlay PNG (OVERLAY_EFFECTS)
};

/** efek yang butuh file overlay PNG (dibundel di public/efek-novacut) */
export const OVERLAY_EFFECTS: Record<string, string> = {
  "fx-scanline": "scanline.png",
  "fx-spotlight": "spotlight.png",
  "fx-flare": "flare.png",
};

export interface EffectPlan {
  /** urutan fragmen filter_complex berlabel: [fxN]...[fxN+1] */
  fragments: string[];
  labelIn: string;
  labelOut: string;
  /** overlay PNG yang perlu ditambahkan sbg input & ditumpuk di atas hasil */
  overlays: Array<"fx-scanline" | "fx-spotlight" | "fx-flare">;
}

/**
 * Susun rencana efek utk filter_complex FFmpeg.
 * Port planEffects KolosalCut — PARAMETRIK W×H (VidSplit merender semua
 * resolusi): shake = crop bergerak dgn margin 5%, pulse/kenburns = zoompan
 * dgn ukuran keluaran s=WxH tetap.
 * effects dalam urutan bebas — diterapkan sesuai urutan registry agar konsisten.
 */
export function planEffects(
  effects: string[],
  W: number,
  H: number,
  durSec: number,
  fps = 30,
): EffectPlan | null {
  const ordered = CLIP_EFFECTS.map((e) => e.id).filter((id) => effects.includes(id));
  if (ordered.length === 0) return null;
  const fragments: string[] = [];
  let li = 0;
  let cur = `fx${li}`;
  const labelIn = cur;
  const overlays: EffectPlan["overlays"] = [];
  const dur = Math.max(0.1, durSec);
  // margin 5% utk shake (angka genap)
  const mW = Math.max(2, Math.round((W * 0.05) / 2) * 2);
  const mH = Math.max(2, Math.round((H * 0.05) / 2) * 2);
  const cW = Math.max(2, W - mW * 2);
  const cH = Math.max(2, H - mH * 2);
  const gW = (f: number) => Math.max(2, Math.round((W * f) / 2) * 2); // genap
  const gH = (f: number) => Math.max(2, Math.round((H * f) / 2) * 2);

  for (const id of ordered) {
    const next = `fx${++li}`;
    if (id === "fx-bloom") {
      fragments.push(
        `[${cur}]split[fxa${li}][fxb${li}];` +
          `[fxb${li}]gblur=sigma=${Math.max(6, Math.round(W * 0.013))}:steps=2,eq=brightness=0.18:saturation=1.15[fxbl${li}];` +
          `[fxa${li}][fxbl${li}]blend=all_mode=screen:all_opacity=0.30[${next}]`,
      );
    } else if (id === "fx-shake") {
      // margin 5% supaya getaran tidak keluar frame (parametrik W×H)
      fragments.push(
        `[${cur}]crop=${cW}:${cH}:x='(in_w-${cW})/2+(sin(t*23.7)*${(mW * 0.5).toFixed(1)}+sin(t*41.3)*${(mW * 0.3).toFixed(1)})':y='(in_h-${cH})/2+(cos(t*19.1)*${(mH * 0.5).toFixed(1)}+sin(t*33.7)*${(mH * 0.3).toFixed(1)})',` +
          `scale=${W}:${H}:flags=lanczos[${next}]`,
      );
    } else if (id === "fx-pulse") {
      fragments.push(
        `[${cur}]zoompan=z='1+0.035*max(0,sin(in/${fps}*4*PI))':` +
          `x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=${W}x${H}:fps=${fps},setsar=1[${next}]`,
      );
    } else if (id === "fx-kenburns") {
      // naikkan 8% agar geser Ken Burns tetap valid saat zoom mulai dari 1.0
      const kWS = gW(1.08), kHS = gH(1.08);
      const sx = Math.round((kWS - W) / 2), sy = Math.round((kHS - H) / 2);
      fragments.push(
        `[${cur}]scale=${kWS}:${kHS}:flags=lanczos,` +
          `zoompan=z='min(1.16,1+0.14*on/(${fps}*${dur.toFixed(3)}))':` +
          `x='iw/2-(iw/zoom/2)-${sx}*(on/(${fps}*${dur.toFixed(3)})-0.5)':` +
          `y='ih/2-(ih/zoom/2)+${sy}*(on/(${fps}*${dur.toFixed(3)})-0.5)':d=1:s=${W}x${H}:fps=${fps},setsar=1[${next}]`,
      );
    } else if (OVERLAY_EFFECTS[id]) {
      overlays.push(id as EffectPlan["overlays"][number]);
      // passthrough agar label tetap nyambung — overlay ditumpuk terpisah
      fragments.push(`[${cur}]null[${next}]`);
    } else {
      const f = EFFECT_FFMPEG[id];
      if (f) fragments.push(`[${cur}]${f}[${next}]`);
      else fragments.push(`[${cur}]null[${next}]`);
    }
    cur = next;
  }
  return { fragments, labelIn, labelOut: cur, overlays };
}

/** Urutan efek sesuai registry (deterministik) + potong batas jumlah */
export function rapikanEfekKlip(ids: unknown): string[] {
  if (!Array.isArray(ids)) return [];
  const set = new Set(ids.filter((x): x is string => typeof x === "string" && isValidEffect(x)));
  return CLIP_EFFECTS.map((e) => e.id).filter((id) => set.has(id)).slice(0, 6);
}
