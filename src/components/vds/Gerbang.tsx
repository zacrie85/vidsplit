"use client";

// VidSplit — gerbang password: layar kunci saat aplikasi dibuka + tombol ganti password.
// Verifikasi lewat server lokal (/api/gate, hash SHA-256 di folder data aplikasi);
// setelah berhasil, status "terbuka" disimpan di sessionStorage — tidak mengunci ulang
// selama sesi terbuka. Lupa password? Hapus gate.json di folder data → kembali default.
import { useState } from "react";
import { KeyRound, Loader2, Lock, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";

const KUNCI_SESI = "vidsplit-gerbang-terbuka";

export function sudahTerbuka(): boolean {
  try {
    return sessionStorage.getItem(KUNCI_SESI) === "1";
  } catch {
    return false;
  }
}

/** Layar penuh yang menutupi aplikasi sampai password benar */
export function GerbangLayar({ onBuka }: { onBuka: () => void }) {
  const [password, setPassword] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [salah, setSalah] = useState("");

  const buka = async () => {
    if (!password.trim() || sibuk) return;
    setSibuk(true);
    setSalah("");
    try {
      const r = await fetch("/api/gate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aksi: "buka", password }),
      });
      const j = (await r.json()) as { ok: boolean; error?: string };
      if (j.ok) {
        try {
          sessionStorage.setItem(KUNCI_SESI, "1");
        } catch {
          /* abaikan */
        }
        onBuka();
      } else {
        setSalah(j.error || "Password salah");
      }
    } catch {
      setSalah("Gagal menghubungi server lokal");
    } finally {
      setSibuk(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0b0f14]/95 px-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-slate-700/60 bg-slate-900/80 p-6 shadow-2xl shadow-black/60">
        <div className="mb-5 text-center">
          <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-400/15 text-amber-400">
            <Lock className="h-7 w-7" />
          </span>
          <h1 className="text-xl font-bold tracking-tight text-slate-50">
            Vid<span className="text-amber-400">Split</span> terkunci
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            Masukkan password untuk masuk ke aplikasi
          </p>
        </div>

        <input
          type="password"
          value={password}
          autoFocus
          onChange={(e) => {
            setPassword(e.target.value);
            setSalah("");
          }}
          onKeyDown={(e) => e.key === "Enter" && buka()}
          placeholder="Password"
          className="w-full rounded-xl border border-slate-700 bg-slate-800/70 px-4 py-2.5 text-center text-lg tracking-widest text-slate-100 outline-none placeholder:tracking-normal placeholder:text-slate-500 focus:border-amber-400/70"
        />
        {salah && (
          <p className="mt-2 rounded-lg bg-red-500/10 px-3 py-2 text-center text-xs text-red-300">
            {salah}
          </p>
        )}

        <button
          type="button"
          onClick={buka}
          disabled={sibuk || !password.trim()}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-amber-400 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {sibuk ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ShieldCheck className="h-4 w-4" />
          )}
          {sibuk ? "Memeriksa…" : "Buka VidSplit"}
        </button>

        <p className="mt-4 text-center text-[11px] leading-relaxed text-slate-500">
          Lupa password? Hapus berkas <code className="text-slate-400">gate.json</code> di
          folder VidSplit-Data lalu buka ulang aplikasi — password kembali ke bawaan.
        </p>
      </div>
    </div>
  );
}

/** Tombol + dialog untuk mengganti password gerbang (butuh password lama) */
export function TombolGantiPassword() {
  const [buka, setBuka] = useState(false);
  const [lama, setLama] = useState("");
  const [baru, setBaru] = useState("");
  const [ulang, setUlang] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [salah, setSalah] = useState("");

  const tutup = () => {
    setBuka(false);
    setLama("");
    setBaru("");
    setUlang("");
    setSalah("");
  };

  const simpan = async () => {
    if (sibuk) return;
    if (baru !== ulang) {
      setSalah("Ulangi password baru tidak sama");
      return;
    }
    setSibuk(true);
    setSalah("");
    try {
      const r = await fetch("/api/gate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aksi: "ganti", lama, baru }),
      });
      const j = (await r.json()) as { ok: boolean; error?: string; pesan?: string };
      if (j.ok) {
        toast.success(j.pesan || "Password gerbang diganti");
        tutup();
      } else {
        setSalah(j.error || "Gagal mengganti password");
      }
    } catch {
      setSalah("Gagal menghubungi server lokal");
    } finally {
      setSibuk(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setBuka(true)}
        title="Ganti password gerbang"
        className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-2.5 py-1.5 text-[11px] text-slate-400 transition hover:border-amber-400/70 hover:text-amber-300"
      >
        <KeyRound className="h-3.5 w-3.5" />
        Kunci
      </button>

      {buka && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && tutup()}
        >
          <div className="w-full max-w-sm rounded-2xl border border-slate-700/60 bg-slate-900 p-5 shadow-2xl shadow-black/60">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="flex items-center gap-2 font-semibold text-slate-100">
                <KeyRound className="h-4 w-4 text-amber-400" />
                Ganti password gerbang
              </h3>
              <button
                type="button"
                onClick={tutup}
                className="rounded-md p-1 text-slate-500 hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-2.5">
              <input
                type="password"
                value={lama}
                autoFocus
                onChange={(e) => setLama(e.target.value)}
                placeholder="Password sekarang"
                className="w-full rounded-lg border border-slate-700 bg-slate-800/70 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-amber-400/70"
              />
              <input
                type="password"
                value={baru}
                onChange={(e) => setBaru(e.target.value)}
                placeholder="Password baru (min. 4 karakter)"
                className="w-full rounded-lg border border-slate-700 bg-slate-800/70 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-amber-400/70"
              />
              <input
                type="password"
                value={ulang}
                onChange={(e) => setUlang(e.target.value)}
                placeholder="Ulangi password baru"
                className="w-full rounded-lg border border-slate-700 bg-slate-800/70 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-amber-400/70"
              />
            </div>
            {salah && (
              <p className="mt-2 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300">
                {salah}
              </p>
            )}
            <button
              type="button"
              onClick={simpan}
              disabled={sibuk || !lama || !baru}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-amber-400 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {sibuk && <Loader2 className="h-4 w-4 animate-spin" />}
              Simpan password baru
            </button>
          </div>
        </div>
      )}
    </>
  );
}
