// afterPack — salin hasil `next build` standalone ke resources/server secara UTUH
// (termasuk node_modules hasil output-tracing dan folder titik .next) lalu verifikasi.
// Alasan: extraResources electron-builder MELEWATI node_modules dan memecah layout
// (bug installer v0.1.0 — aplikasi tak mau menyala karena server.js tak ketemu / modul hilang).
const fs = require("node:fs");
const path = require("node:path");

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

  // salin SELURUH isi standalone apa adanya (node_modules + .next + server.js ikut)
  fs.cpSync(sumberStandalone, tujuanServer, { recursive: true, dereference: true });

  // server.js bisa di root (CI: proyek = workspace root) atau nested vidsplit/ (sandbox/monorepo)
  const target = fs.existsSync(path.join(tujuanServer, "server.js"))
    ? tujuanServer
    : path.join(tujuanServer, "vidsplit");
  if (!fs.existsSync(path.join(target, "server.js"))) {
    throw new Error("afterPack: server.js tidak ditemukan setelah menyalin standalone");
  }

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
  ];
  const kurang = wajib.filter((p) => !fs.existsSync(p));
  if (kurang.length > 0) {
    throw new Error("afterPack: berkas wajib hilang:\n" + kurang.join("\n"));
  }

  console.log(`[afterPack] server terkemas utuh di ${target} (server.js + node_modules + .next + public)`);
};
