#!/usr/bin/env python3
"""Unduh 15 font sinematik (SIL OFL) dari repo resmi google/fonts → assets/fonts/.
Font variabel otomatis di-instantiate ke bobot tebal (fonttools varLib.instancer).
Idempoten: file yang sudah valid tidak diunduh ulang."""

import os
import struct
import subprocess
import sys
import urllib.request

BASE = "https://raw.githubusercontent.com/google/fonts/main/ofl/"
DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "assets", "fonts")

# (id, nama_file_output, [url kandidat], bobot_instancer atau None)
FONTS = [
    ("bebas",     "BebasNeue.ttf",             ["bebasneue/BebasNeue-Regular.ttf"], None),
    ("anton",     "Anton.ttf",                 ["anton/Anton-Regular.ttf"], None),
    ("cinzel",    "Cinzel-Bold.ttf",           ["cinzel/Cinzel%5Bwght%5D.ttf"], 700),
    ("cinzeldec", "CinzelDecorative-Bold.ttf", ["cinzeldecorative/CinzelDecorative-Bold.ttf"], None),
    ("playfair",  "PlayfairDisplay-Bold.ttf",  ["playfairdisplay/PlayfairDisplay%5Bwght%5D.ttf"], 700),
    ("marcellus", "Marcellus.ttf",             ["marcellus/Marcellus-Regular.ttf"], None),
    ("julius",    "JuliusSansOne.ttf",         ["juliussansone/JuliusSansOne-Regular.ttf"], None),
    ("oswald",    "Oswald-SemiBold.ttf",       ["oswald/Oswald%5Bwght%5D.ttf"], 600),
    ("sixcaps",   "SixCaps.ttf",               ["sixcaps/SixCaps-Regular.ttf"], None),
    ("teko",      "Teko-Bold.ttf",             ["teko/Teko%5Bwght%5D.ttf"], 700),
    ("alfaslab",  "AlfaSlabOne.ttf",           ["alfaslabone/AlfaSlabOne-Regular.ttf"], None),
    ("abril",     "AbrilFatface.ttf",          ["abrilfatface/AbrilFatface-Regular.ttf"], None),
    ("blackops",  "BlackOpsOne.ttf",           ["blackopsone/BlackOpsOne-Regular.ttf"], None),
    ("creepster", "Creepster.ttf",             ["creepster/Creepster-Regular.ttf"], None),
    ("monoton",   "Monoton.ttf",               ["monoton/Monoton-Regular.ttf"], None),
]

MAGIC_OK = (b"\x00\x01\x00\x00", b"OTTO", b"true", b"ttcf")


def ttf_valid(path: str) -> bool:
    try:
        with open(path, "rb") as f:
            head = f.read(4)
        return head in MAGIC_OK and os.path.getsize(path) > 10_000
    except OSError:
        return False


def punya_fvar(path: str) -> bool:
    """Deteksi tabel fvar = font variabel."""
    try:
        with open(path, "rb") as f:
            f.seek(4)
            (num_tables,) = struct.unpack(">H", f.read(2))
            f.seek(12)
            for _ in range(num_tables):
                tag = f.read(4)
                f.seek(12, os.SEEK_CUR)
                if tag == b"fvar":
                    return True
                f.seek(0, os.SEEK_CUR)
    except OSError:
        pass
    return False


def unduh(url: str, dest: str) -> None:
    req = urllib.request.Request(url, headers={"User-Agent": "vidsplit-font-fetch/1.0"})
    with urllib.request.urlopen(req, timeout=60) as r, open(dest, "wb") as f:
        f.write(r.read())


def instancer(path: str, wght: int, dest: str) -> None:
    subprocess.run(
        [sys.executable, "-m", "fontTools.varLib.instancer", path, f"wght={wght}", "-o", dest, "--quiet"],
        check=True,
    )


def utama() -> int:
    os.makedirs(DIR, exist_ok=True)
    gagal = []
    for fid, nama, kandidat, wght in FONTS:
        dest = os.path.join(DIR, nama)
        if ttf_valid(dest):
            print(f"[skip] {nama} sudah ada & valid")
            continue
        ok = False
        for rel in kandidat:
            url = BASE + rel
            tmp = dest + ".tmp"
            try:
                print(f"[unduh] {fid} ← {rel}")
                unduh(url, tmp)
                if not ttf_valid(tmp):
                    raise RuntimeError("bukan TTF valid")
                if wght and punya_fvar(tmp):
                    instancer(tmp, wght, dest)
                    os.unlink(tmp)
                    if not ttf_valid(dest):
                        raise RuntimeError(f"instancer wght={wght} gagal")
                    print(f"        → instancer wght={wght}")
                else:
                    os.replace(tmp, dest)
                ok = True
                break
            except Exception as e:  # noqa: BLE001
                print(f"        gagal: {e}")
                try:
                    os.unlink(tmp)
                except OSError:
                    pass
        if not ok:
            gagal.append(fid)
        else:
            print(f"[ok] {nama} ({os.path.getsize(dest):,} B)")

    if gagal:
        print(f"\nGAGAL untuk: {', '.join(gagal)}", file=sys.stderr)
        return 1
    print(f"\nSemua {len(FONTS)} font sinematik siap di {DIR}")
    return 0


if __name__ == "__main__":
    sys.exit(utama())
