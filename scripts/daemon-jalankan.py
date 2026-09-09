#!/usr/bin/env python3
"""Peluncur daemon VidSplit — double-fork agar proses server yatim (PPid=1),
kebal pembersih pohon proses antar-sesi shell di sandbox."""

import os
import signal
import sys

def jalankan(cmd: list[str], env: dict[str, str], log_file: str) -> None:
    pid1 = os.fork()
    if pid1 == 0:
        # anak-1: sesi baru, lalu fork lagi lalu langsung mati
        os.setsid()
        signal.signal(signal.SIGHUP, signal.SIG_IGN)
        pid2 = os.fork()
        if pid2 == 0:
            # anak-2: yatim segera → diadopsi init (PPid=1)
            fd = os.open(log_file, os.O_WRONLY | os.O_CREAT | os.O_APPEND, 0o644)
            os.dup2(fd, 1)
            os.dup2(fd, 2)
            devnull = os.open(os.devnull, os.O_RDONLY)
            os.dup2(devnull, 0)
            os.execvpe(cmd[0], cmd, env)
        os._exit(0)
    os.waitpid(pid1, 0)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("pakai: daemon-jalankan.py <log> CMD...")
        sys.exit(1)
    log = sys.argv[1]
    cmd = sys.argv[2:]
    env = dict(os.environ)
    jalankan(cmd, env, log)
    print(f"daemon diluncurkan (log: {log})")
