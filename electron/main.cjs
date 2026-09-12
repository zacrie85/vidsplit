// VidSplit — proses utama Electron: nyalakan server Next standalone lalu buka jendela
// v0.1.1: deteksi server.js adaptif, dialog error saat gagal, log ke file, aman di Windows
const { app, BrowserWindow, dialog, ipcMain, shell } = require("electron");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const port = 31900 + Math.floor(Math.random() * 400);
let server;
let win;
let logStream;
let fileLog;
let dirKerjaGlobal = null; // folder data aktif — dipakai IPC buka-folder

/**
 * Pilih folder data aplikasi:
 * - Mode PORTABLE (exe tunggal, tanpa install): electron-builder menyetel env
 *   PORTABLE_EXECUTABLE_DIR = folder tempat exe berada → data disimpan di
 *   "VidSplit-Data" di sampingnya, ikut pindah bersama exe (benar-benar portabel).
 * - Uji tulis sungguhan — bila folder tidak boleh ditulis (mis. ditaruh di
 *   Program Files / root C:), fallback otomatis ke AppData seperti mode terinstal.
 */
function pilihDataDir() {
  const userData = app.getPath("userData");
  const portableDir = process.env.PORTABLE_EXECUTABLE_DIR;
  if (portableDir) {
    try {
      const dataDir = path.join(portableDir, "VidSplit-Data");
      fs.mkdirSync(dataDir, { recursive: true });
      const probe = path.join(dataDir, ".uji-tulis");
      fs.writeFileSync(probe, "ok");
      fs.unlinkSync(probe);
      return {
        dataDir,
        logFile: path.join(dataDir, "server.log"),
        portable: true,
      };
    } catch {
      /* folder exe tak bisa ditulis → pakai AppData */
    }
  }
  const dataDir = path.join(userData, "data");
  fs.mkdirSync(dataDir, { recursive: true });
  return { dataDir, logFile: path.join(userData, "server.log"), portable: false };
}

function catat(pesan) {
  const baris = `[${new Date().toISOString()}] ${pesan}\n`;
  try {
    logStream?.write(baris);
  } catch {}
  try {
    process.stdout?.write(baris);
  } catch {}
}

function nyalakanServer() {
  const res = process.resourcesPath || path.join(__dirname, "..");
  const data = pilihDataDir();
  fileLog = data.logFile;

  // Layout standalone bisa berbeda: nested vidsplit/ (monorepo) atau root (CI)
  const kandidat = [
    path.join(res, "server", "vidsplit", "server.js"),
    path.join(res, "server", "server.js"),
  ];
  const serverJs = kandidat.find((p) => fs.existsSync(p));
  if (!serverJs) {
    throw new Error(
      `server.js tidak ditemukan. Dicari:\n${kandidat.join("\n")}\nIsi ${res}:\n${amankanList(res)}`
    );
  }

  logStream = fs.createWriteStream(fileLog, { flags: "a" });
  const dirKerja = data.dataDir;
  dirKerjaGlobal = dirKerja;
  catat(`Mode: ${data.portable ? "PORTABLE" : "terinstal"} — folder data: ${dirKerja}`);

  const env = {
    ...process.env,
    ELECTRON_RUN_AS_NODE: "1",
    NODE_ENV: "production",
    PORT: String(port),
    HOSTNAME: "127.0.0.1",
    VIDSPLIT_WORK: dirKerja,
    VIDSPLIT_FONTS: path.join(res, "fonts"),
    VIDSPLIT_FFMPEG: path.join(res, "ffmpeg.exe"),
    VIDSPLIT_FFPROBE: path.join(res, "ffprobe.exe"),
    VIDSPLIT_ELECTRON: "1",
  };
  catat(`Menjalankan server: ${serverJs} (port ${port}, kerja: ${dirKerja})`);
  server = spawn(process.execPath, [serverJs], {
    env,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  server.stdout.on("data", (d) => catat(`[server] ${String(d).trimEnd()}`));
  server.stderr.on("data", (d) => catat(`[server] ${String(d).trimEnd()}`));
  server.on("exit", (code) => {
    catat(`[server] keluar, kode ${code}`);
    if (!win) {
      tampilkanGalat(
        `Server internal berhenti (kode ${code}).`,
        `Log lengkap: ${fileLog}`
      );
    }
  });
}

function amankanList(dir) {
  try {
    return fs.readdirSync(dir).slice(0, 30).join(", ");
  } catch (e) {
    return `(gagal membaca: ${e.message})`;
  }
}

function tampilkanGalat(judul, detail) {
  try {
    dialog.showErrorBox(`VidSplit — ${judul}`, detail);
  } catch {}
}

function tungguServer(coba = 0) {
  return new Promise((resolve, reject) => {
    const req = http.get(`http://127.0.0.1:${port}/api/job`, (res) => {
      res.resume();
      resolve();
    });
    req.on("error", () => {
      if (coba > 300) {
        return reject(
          new Error(
            `Server internal tidak merespons setelah 60 detik. Log: ${fileLog}`
          )
        );
      }
      setTimeout(() => tungguServer(coba + 1).then(resolve, reject), 200);
    });
  });
}

async function buatJendela() {
  win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 980,
    minHeight: 640,
    backgroundColor: "#0b0f14",
    autoHideMenuBar: true,
    title: "VidSplit",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  await win.loadURL(`http://127.0.0.1:${port}/`);
}

ipcMain.handle("vdsplit:pilih", async (_e, jenis) => {
  const opsi =
    jenis === "bg" || jenis === "logo"
      ? { filters: [{ name: "Gambar", extensions: ["png", "jpg", "jpeg", "webp"] }] }
      : {
          filters: [
            { name: "Video", extensions: ["mp4", "mov", "mkv", "avi", "webm", "m4v", "ts"] },
            { name: "Semua file", extensions: ["*"] },
          ],
          properties: ["openFile", "multiSelections"], // antrean: boleh pilih banyak video
        };
  const r = await dialog.showOpenDialog(win, { properties: ["openFile"], ...opsi });
  if (r.canceled || !r.filePaths.length) return [];
  return r.filePaths.map((p) => {
    let ukuran = 0;
    try {
      ukuran = fs.statSync(p).size;
    } catch {}
    return { path: p, nama: path.basename(p), ukuran };
  });
});

// Buka folder hasil ekspor (di dalam folder data) di Explorer Windows.
// Renderer hanya mengirim path RELATIF — proses utama yang menggabungkan dgn folder data.
ipcMain.handle("vdsplit:buka-folder", async (_e, rel) => {
  try {
    if (!dirKerjaGlobal) return { ok: false, error: "Folder kerja belum siap" };
    const r = String(rel || "").replace(/\\/g, "/");
    if (!r || r.includes("..") || path.isAbsolute(r) || r.startsWith("/")) {
      return { ok: false, error: "Path tidak sah" };
    }
    const target = path.join(dirKerjaGlobal, r);
    fs.mkdirSync(target, { recursive: true });
    await shell.openPath(target);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

app.whenReady().then(async () => {
  try {
    nyalakanServer();
    await tungguServer();
    await buatJendela();
  } catch (err) {
    catat(`GAGAL: ${err.stack || err.message}`);
    tampilkanGalat(
      "gagal menyala",
      `${err.message}\n\nLog lengkap: ${fileLog}`
    );
    app.quit();
  }
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) buatJendela();
  });
});

app.on("window-all-closed", () => app.quit());
app.on("quit", () => {
  try {
    server?.kill();
  } catch {}
});
