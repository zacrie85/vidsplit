// afterPack — salin hasil `next build` standalone ke resources/server secara UTUH
// (termasuk node_modules hasil output-tracing dan folder titik .next) lalu verifikasi.
// Alasan: extraResources electron-builder MELEWATI node_modules dan memecah layout
// (bug installer v0.1.0 — aplikasi tak mau menyala karena server.js tak ketemu / modul hilang).
const fs = require("node:fs");
const path = require("node:path");

/**
 * v2.9.0 — filter cpSync salinan standalone: relatif thd AKAR standalone.
 * Terima folder "assets" agar traversal lanjut, tolak subfoldernya kecuali
 * fonts; tolak work/ seluruhnya. Diekspor juga utk uji terisolasi.
 */
function filterBundel(akarStandalone) {
  return function (src) {
    const rel = path.relative(akarStandalone, src);
    if (rel === "") return true; // akar
    if (rel === "work" || rel.startsWith(`work${path.sep}`)) return false;
    if (rel === "assets" || rel.startsWith(`assets${path.sep}`)) {
      return (
        rel === "assets" ||
        rel === path.join("assets", "fonts") ||
        rel === path.join("assets", "LISENSI-FONT.txt") ||
        rel.startsWith(path.join("assets", "fonts") + path.sep)
      );
    }
    return true;
  };
}

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== "win32") return;

  const proyek = context.packager.projectDir; // root proyek vidsplit
  const resDir = path.join(context.appOutDir, "resources");
  const sumberStandalone = path.join(proyek, ".next", "standalone");
  const sumberStatic = path.join(proyek, ".next", "static");
  const sumberPublic = path.join(proyek, "public");
  const tujuanServer = path.join(resDir, "server");

  if (!fs.existsSync(path.join(sumberStandalone, "package.json")) &&
      !fs.existsSync(path.join(sumberStandalone, "vidsplit", "package.json"))) {
    throw new Error(`afterPack: standalone Next tidak ditemukan di ${sumberStandalone} — jalankan 'next build' dulu`);
  }

  // bersihkan salinan lama (dari extraResources / build sebelumnya)
  fs.rmSync(tujuanServer, { recursive: true, force: true });

  // v2.9.0 — LAPIS ANTI-BOLOM: salin standalone TANPA berkas yang TIDAK dipakai
  // aplikasi ter-install — dulu tersalin apa adanya dan menaikkan installer
  // hingga ±1.2 GB. Yang dibuang dari salinan:
  //   .next/standalone/work/        → folder kerja RUNTIME (output/upload/musik/
  //                                   sampel/analisis-vokal) bekas uji build —
  //                                   dibuat ulang otomatis oleh server saat jalan.
  //   .next/standalone/assets/*     → salinan GANDA aset bundel (vokal-ai 64 MB,
  //                                   tts-piper 99 MB, musik-horor 13 MB, hantu
  //                                   8 MB, hantu-real 5 MB, ai-models ±200-300 MB
  //                                   di CI): server selalu membaca semuanya dari
  //                                   process.resourcesPath (resources/) lewat
  //                                   extraResources — BUKAN dari server/assets.
  //   HANYA assets/fonts (+ LISENSI-FONT.txt) dipertahankan di salinan server —
  //   itu fallback PERTAMA pencarian font drawtext libass di ffmpeg.ts
  //   (path.join(cwd,"assets","fonts") dgn cwd = resources/server).
  fs.cpSync(sumberStandalone, tujuanServer, {
    recursive: true,
    dereference: true,
    filter: filterBundel(sumberStandalone),
  });
  console.log("[afterPack] lapis anti-bolom: work/ + duplikat aset (vokal-ai, tts-piper, musik-horor, hantu*, ai-models) tidak ikut ke installer — font tetap di server/assets/fonts");

  // server.js bisa di root (CI: proyek = workspace root) atau nested vidsplit/ (sandbox/monorepo)
  const target = fs.existsSync(path.join(tujuanServer, "server.js"))
    ? tujuanServer
    : path.join(tujuanServer, "vidsplit");
  if (!fs.existsSync(path.join(target, "server.js"))) {
    throw new Error("afterPack: server.js tidak ditemukan setelah menyalin standalone");
  }

  // v0.20.0 — mesin pisah vokal AI: pastikan onnxruntime-node (modul native) tersedia
  // di server/node_modules. Standalone trace bisa saja menyalin versi UTUH (semua platform,
  // ±290 MB) — ganti dgn salinan PRUNED khusus win32/x64 CPU (±30 MB).
  const ortSrc = path.join(proyek, "node_modules", "onnxruntime-node");
  const ortCmnSrc = path.join(proyek, "node_modules", "onnxruntime-common");
  const nmServer = path.join(target, "node_modules");
  if (fs.existsSync(ortSrc)) {
    fs.rmSync(path.join(nmServer, "onnxruntime-node"), { recursive: true, force: true });
    fs.cpSync(ortSrc, path.join(nmServer, "onnxruntime-node"), { recursive: true, dereference: true });
    if (fs.existsSync(ortCmnSrc)) {
      fs.rmSync(path.join(nmServer, "onnxruntime-common"), { recursive: true, force: true });
      fs.cpSync(ortCmnSrc, path.join(nmServer, "onnxruntime-common"), { recursive: true, dereference: true });
    }
    // buang binari platform lain (installer = Windows x64 saja)
    const binDir = path.join(nmServer, "onnxruntime-node", "bin", "napi-v6");
    if (fs.existsSync(binDir)) {
      for (const d of fs.readdirSync(binDir)) {
        if (d !== "win32") fs.rmSync(path.join(binDir, d), { recursive: true, force: true });
      }
      const w64 = path.join(binDir, "win32", "x64");
      if (fs.existsSync(w64)) {
        // komponen DirectML (GPU) tidak dipakai — mesin vokal memakai CPU EP
        for (const f of ["DirectML.dll", "dxcompiler.dll", "dxil.dll"]) {
          try { fs.rmSync(path.join(w64, f), { force: true }); } catch {}
        }
      }
    }
    console.log("[afterPack] onnxruntime-node (win32/x64 CPU) tersalin ke server/node_modules");
  }

  // v0.44.0 — mesin subtitle AI: @huggingface/transformers + dependensi runtime-nya
  // (sharp di-require EAGER oleh transformers Node build; jinja & tokenizers utk tokenizer)
  const paketAi = [
    "@huggingface/transformers",
    "@huggingface/jinja",
    "@huggingface/tokenizers",
    "sharp",
  ];
  for (const nama of paketAi) {
    const src = path.join(proyek, "node_modules", ...nama.split("/"));
    if (!fs.existsSync(src)) {
      throw new Error(`afterPack: paket ${nama} tidak ditemukan di node_modules — jalankan npm install dulu`);
    }
    fs.rmSync(path.join(nmServer, ...nama.split("/")), { recursive: true, force: true });
    fs.cpSync(src, path.join(nmServer, ...nama.split("/")), { recursive: true, dereference: true });
  }
  // sharp memuat binari @img/* per platform — buang platform non-Windows (installer x64 saja)
  const imgSrc = path.join(proyek, "node_modules", "@img");
  if (fs.existsSync(imgSrc)) {
    fs.rmSync(path.join(nmServer, "@img"), { recursive: true, force: true });
    fs.cpSync(imgSrc, path.join(nmServer, "@img"), { recursive: true, dereference: true });
    const imgDst = path.join(nmServer, "@img");
    for (const d of fs.readdirSync(imgDst)) {
      if (/linux|darwin|arm|musl|android|freebsd/i.test(d)) {
        fs.rmSync(path.join(imgDst, d), { recursive: true, force: true });
      }
    }
  }
  console.log("[afterPack] @huggingface/transformers + sharp (win32/x64) tersalin ke server/node_modules");

  // taruh .next/static dan public tepat di sebelah server.js
  fs.cpSync(sumberStatic, path.join(target, ".next", "static"), { recursive: true, dereference: true });
  if (fs.existsSync(sumberPublic)) {
    fs.cpSync(sumberPublic, path.join(target, "public"), { recursive: true, dereference: true });
  }

  // verifikasi keras — gagalkan build bila ada berkas penting yang hilang
  const wajib = [
    path.join(target, "server.js"),
    path.join(target, "package.json"),
    path.join(target, ".next", "required-server-files.json"),
    path.join(target, ".next", "static"),
    path.join(target, "node_modules"),
    path.join(resDir, "ffmpeg.exe"),
    path.join(resDir, "ffprobe.exe"),
    path.join(resDir, "fonts", "DejaVuSans-Bold.ttf"),
    path.join(resDir, "fonts", "BebasNeue.ttf"),
    path.join(resDir, "fonts", "Monoton.ttf"),
    // v0.20.0 — mesin pisah vokal AI: model + runtime native wajib ada
    path.join(resDir, "vokal-ai", "Kim_Vocal_2.onnx"),
    path.join(target, "node_modules", "onnxruntime-node", "bin", "napi-v6", "win32", "x64", "onnxruntime_binding.node"),
    path.join(target, "node_modules", "onnxruntime-node", "bin", "napi-v6", "win32", "x64", "onnxruntime.dll"),
    path.join(target, "node_modules", "onnxruntime-common", "package.json"),
    // v0.44.0 — model AI subtitle otomatis (Whisper ASR + penerjemah EN→ID) wajib ada
    path.join(resDir, "ai-models", "onnx-community", "whisper-small", "onnx", "encoder_model_quantized.onnx"),
    path.join(resDir, "ai-models", "onnx-community", "whisper-small", "onnx", "decoder_model_merged_quantized.onnx"),
    path.join(resDir, "ai-models", "onnx-community", "whisper-small", "tokenizer.json"),
    path.join(resDir, "ai-models", "Xenova", "opus-mt-en-id", "onnx", "encoder_model_quantized.onnx"),
    path.join(resDir, "ai-models", "Xenova", "opus-mt-en-id", "onnx", "decoder_model_merged_quantized.onnx"),
    path.join(resDir, "ai-models", "Xenova", "opus-mt-en-id", "tokenizer.json"),
    path.join(target, "node_modules", "@huggingface", "transformers", "package.json"),
    path.join(target, "node_modules", "sharp", "package.json"),
  ];
  const kurang = wajib.filter((p) => !fs.existsSync(p));
  if (kurang.length > 0) {
    throw new Error("afterPack: berkas wajib hilang:\n" + kurang.join("\n"));
  }
  // v3.3.0 — whisper.cpp: bila folder assets/whisper ADA di build (CI mengunduhnya),
  // binary + 3 model WAJIB ikut terkemas — bila tidak ada, build lokal lama tetap lolos
  const srcWhisper = path.join(process.cwd(), "assets", "whisper");
  if (fs.existsSync(path.join(srcWhisper, "bin"))) {
    const wWhisper = [
      path.join(resDir, "whisper", "bin", "whisper-cli.exe"),
      path.join(resDir, "whisper", "models", "ggml-tiny-q5_1.bin"),
      path.join(resDir, "whisper", "models", "ggml-base-q5_1.bin"),
      path.join(resDir, "whisper", "models", "ggml-small-q5_1.bin"),
    ];
    // whisper-cli.exe sendiri HANYA ±300 KB — ambang 1 MB hanya utk MODEL;
    // binary cukup wajib ada (≥100 KB, anti file kosong/halaman error)
    const kurangW = wWhisper.filter((p) => {
      try {
        const ambang = p.endsWith(".exe") ? 102400 : 1048576;
        return !fs.existsSync(p) || fs.statSync(p).size < ambang;
      } catch {
        return true;
      }
    });
    if (kurangW.length > 0) {
      throw new Error("afterPack: whisper.cpp tidak lengkap (v3.3.0):\n" + kurangW.join("\n"));
    }
  } else {
    console.log("afterPack: assets/whisper tidak ada — build TANPA whisper.cpp (subtitle jatuh ke ONNX)");
  }

  console.log(`[afterPack] server terkemas utuh di ${target} (server.js + node_modules + .next + public)`);
};

// dipakai scripts/uji-afterpack-filter.cjs — uji terisolasi lapis anti-bolom
exports.filterBundel = filterBundel;
