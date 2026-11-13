#!/usr/bin/env python3
# suntik-v380-font-klien.py — pemilih font di mesin pratinjau klien (coverKinostraGambar.ts)
# - FAMILI_KINO: kunci pilihan → font stack canvas (@font-face "VDS *" di globals.css)
# - aturFontKino(judul, part) + ncFontStackJudul/Part — override per fase
# - ncDrawPartBadge & fase title/part di ncLayoutPass memakai stack override
import re

p = "src/lib/vidsplit/coverKinostraGambar.ts"
s = open(p, encoding="utf-8").read()

# 1) blok helper setelah ncFontStack (sebelum siapkanFontKino)
if "FAMILI_KINO" not in s:
    marker = "/** pastikan font bundel termuat sebelum mengukur/menggambar (best-effort) */"
    assert marker in s
    blok = """/* ---------- v3.8.0 — PEMILIH FONT JUDUL/PART cover (pratinjau canvas) ----------
   Kunci = kunci FONT_COVER server (coverNovacut.ts). ""/null = bawaan layout.
   Stack memakai @font-face "VDS *" (globals.css) — pratinjau = ekspor. */
const FAMILI_KINO: Record<string, string> = {
  impact: '"VDS Anton", Impact, "Arial Black", sans-serif',
  condensed: '"VDS Bebas Neue", "Arial Narrow", sans-serif',
  serif: '"VDS Cinzel Decorative", Georgia, serif',
  display: '"VDS Black Ops One", "Arial Black", sans-serif',
  sans: '"DejaVu Sans", "Segoe UI", sans-serif',
  monoton: '"VDS Monoton", "Arial Black", sans-serif',
  cinzel: '"VDS Cinzel", Georgia, serif',
  playfair: '"VDS Playfair Display", Georgia, serif',
  marcellus: '"VDS Marcellus", Georgia, serif',
  julius: '"VDS Julius Sans One", "Segoe UI", sans-serif',
  oswald: '"VDS Oswald", "Arial Narrow", sans-serif',
  sixcaps: '"VDS Six Caps", "Arial Narrow", sans-serif',
  teko: '"VDS Teko", "Arial Narrow", sans-serif',
  alfaslab: '"VDS Alfa Slab One", "Arial Black", sans-serif',
  abril: '"VDS Abril Fatface", Georgia, serif',
  creepster: '"VDS Creepster", "Arial Black", sans-serif',
};

/* pilihan font aktif (diatur PanelCoverKinostra sebelum menggambar) */
let fontOvJudul = "";
let fontOvPart = "";

/** set pilihan font judul/part cover pratinjau — "" = bawaan layout */
export function aturFontKino(judul: string, part: string): void {
  fontOvJudul = judul || "";
  fontOvPart = part || "";
}

/** stack font JUDUL: ikut pilihan user bila ada, selain itu font khas layout */
export function ncFontStackJudul(id: JenisFontKino): string {
  return (fontOvJudul && FAMILI_KINO[fontOvJudul]) || ncFontStack(id);
}

/** stack font PART: ikut pilihan user bila ada, selain itu font khas layout */
export function ncFontStackPart(id: JenisFontKino): string {
  return (fontOvPart && FAMILI_KINO[fontOvPart]) || ncFontStack(id);
}

"""
    s = s.replace(marker, blok + marker)

# 2) siapkanFontKino — muat SEMUA face VDS
lama_muat = """      (
        [
          ['900 40px "VDS Anton"', "VDS Anton"],
          ['700 40px "VDS Bebas Neue"', "VDS Bebas Neue"],
          ['400 40px "VDS Playfair Display"', "VDS Playfair Display"],
          ['400 40px "DejaVu Sans"', "DejaVu Sans"],
        ] as [string, string][]
      ).map(([f]) => document.fonts.load(f, "PART 01 Judul").catch(() => undefined)),"""
baru_muat = """        (
        [
          // v3.8.0 — semua face pilihan font cover (agar pratinjau = ekspor)
          ['400 40px "VDS Anton"', "VDS Anton"],
          ['700 40px "VDS Bebas Neue"', "VDS Bebas Neue"],
          ['700 40px "VDS Cinzel"', "VDS Cinzel"],
          ['700 40px "VDS Cinzel Decorative"', "VDS Cinzel Decorative"],
          ['700 40px "VDS Playfair Display"', "VDS Playfair Display"],
          ['400 40px "VDS Marcellus"', "VDS Marcellus"],
          ['400 40px "VDS Julius Sans One"', "VDS Julius Sans One"],
          ['600 40px "VDS Oswald"', "VDS Oswald"],
          ['400 40px "VDS Six Caps"', "VDS Six Caps"],
          ['700 40px "VDS Teko"', "VDS Teko"],
          ['400 40px "VDS Alfa Slab One"', "VDS Alfa Slab One"],
          ['400 40px "VDS Abril Fatface"', "VDS Abril Fatface"],
          ['400 40px "VDS Black Ops One"', "VDS Black Ops One"],
          ['400 40px "VDS Creepster"', "VDS Creepster"],
          ['400 40px "VDS Monoton"', "VDS Monoton"],
          ['400 40px "DejaVu Sans"', "DejaVu Sans"],
        ] as [string, string][]
      ).map(([f]) => document.fonts.load(f, "PART 01 Judul ABC").catch(() => undefined)),"""
assert lama_muat in s, "blok siapkanFontKino tak cocok"
s = s.replace(lama_muat, baru_muat)

# 3) region: ncDrawPartBadge (247..289) → Part; title (356..471) → Judul; part (471..533) → Part
garis = s.split("\n")
iBadge = next(i for i, g in enumerate(garis) if "export function ncDrawPartBadge" in g)
iLayout = next(i for i, g in enumerate(garis) if "export function ncLayoutPass" in g)
iTitle = next(i for i, g in enumerate(garis) if 'if (phase === "title") {' in g)
iPart = next(i for i, g in enumerate(garis) if "/* phase === 'part'" in g)
iAkhir = next(i for i, g in enumerate(garis) if "export function ncDrawCoverFrame" in g)
for i in range(iBadge, iLayout):
    garis[i] = garis[i].replace('ncFontStack("condensed")', 'ncFontStackPart("condensed")')
for i in range(iTitle, iPart):
    garis[i] = re.sub(r'ncFontStack\("(impact|condensed|display|serif|sans|monoton)"\)', r'ncFontStackJudul("\1")', garis[i])
for i in range(iPart, iAkhir):
    garis[i] = re.sub(r'ncFontStack\("(impact|condensed|display|serif|sans|monoton)"\)', r'ncFontStackPart("\1")', garis[i])
s = "\n".join(garis)
open(p, "w", encoding="utf-8").write(s)
nJ = s.count("ncFontStackJudul(")
nP = s.count('ncFontStackPart("')
print(f"Judul {nJ - 1} titik (excl. definisi), Part {nP - 1} titik (excl. definisi)")
