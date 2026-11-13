#!/usr/bin/env python3
# suntik-v380-font.py — pemetaan kunci font pilihan user di coverNovacut.ts (server)
# - kJ/kP = fontJudul/fontPart user ("" = bawaan layout)
# - FASE title: literal kunci ("impact"/"condensed"/...) → kJ ?? "..."
# - FASE part: literal kunci + FONT_COVER.x.family/bobot → kP ?? "..."
import re, sys

p = "src/lib/vidsplit/coverNovacut.ts"
s = open(p, encoding="utf-8").read()
KUNCI = r"(impact|condensed|serif|display|sans|monoton)"

# 1) sisipkan kJ/kP tepat setelah const lay di cabang NOVACUT
marker = '  const lay = tpl.layout ?? "impact";'
if "const kJ = o.fontJudul" not in s:
    assert s.count(marker) == 1, f"marker lay tak unik: {s.count(marker)}"
    s = s.replace(
        marker,
        marker
        + "\n  // v3.8.0 — PILIHAN FONT user: kJ/kP = kunci pilihan; null = bawaan layout.\n"
        + "  // Dipakai sbg ekspresi `kJ ?? \"impact\"` di fase title/part — pengukuran\n"
        + "  // (pasFitJudul/ukur.lebar) & SVG ikut memakai metrik font terpilih.\n"
        + "  const kJ = (o.fontJudul || null) as KunciFontCover | null;\n"
        + "  const kP = (o.fontPart || null) as KunciFontCover | null;",
    )

garis = s.split("\n")
iJudul = next(i for i, g in enumerate(garis) if "===== FASE title" in g)
iPart = next(i for i, g in enumerate(garis) if "===== FASE part" in g)
iAkhir = next((i for i, g in enumerate(garis) if i > iPart and "FASE" in g and "part" not in g), len(garis))

# 2) fase title — argumen kunci literal jadi kJ ?? "..."
for i in range(iJudul, iPart):
    garis[i] = re.sub(rf', "{KUNCI}"', r', kJ ?? "\1"', garis[i])
# 3) fase part — argumen kunci + FONT_COVER.x.family/.bobot
for i in range(iPart, iAkhir):
    garis[i] = re.sub(rf', "{KUNCI}"', r', kP ?? "\1"', garis[i])
    garis[i] = re.sub(
        rf'FONT_COVER\.{KUNCI}\.(family|bobot)',
        r'FONT_COVER[kP ?? "\1"].\2',
        garis[i],
    )

s = "\n".join(garis)
open(p, "w", encoding="utf-8").write(s)
# laporkan
n1 = len(re.findall(r'kJ \?\? "', s))
n2 = len(re.findall(r'kP \?\? "', s))
print(f"kJ dipakai {n1}x, kP dipakai {n2}x")
