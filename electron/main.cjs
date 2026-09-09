// VidSplit — proses utama Electron: nyalakan server Next standalone lalu buka jendela
const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const port = 31900 + Math.floor(Math.random() * 400);
let server;
let win;

function nyalakanServer() {
  const res = process.resourcesPath || path.join(__dirname, "..");
  const serverJs = path.join(res, "server", "vidsplit", "server.js");
  const env = {
    ...process.env,
    ELECTRON_RUN_AS_NODE: "1",
    NODE_ENV: "production",
    PORT: String(port),
    HOSTNAME: "127.0.0.1",
    VIDSPLIT_WORK: path.join(app.getPath("userData"), "data"),
    VIDSPLIT_FONTS: path.join(res, "fonts"),
    VIDSPLIT_FFMPEG: path.join(res, "ffmpeg.exe"),
    VIDSPLIT_FFPROBE: path.join(res, "ffprobe.exe"),
    VIDSPLIT_ELECTRON: "1",
  };
  server = spawn(process.execPath, [serverJs], { env, stdio: ["ignore", "pipe", "pipe"] });
  server.stdout.on("data", (d) => process.stdout.write(`[server] ${d}`));
  server.stderr.on("data", (d) => process.stderr.write(`[server] ${d}`));
  server.on("exit", (code) => console.log("[server] keluar", code));
}

function tungguServer(coba = 0) {
  return new Promise((resolve, reject) => {
    const req = http.get(`http://127.0.0.1:${port}/api/job`, (res) => {
      res.resume();
      resolve();
    });
    req.on("error", () => {
      if (coba > 150) return reject(new Error("Server internal tidak mau hidup"));
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
    jenis === "bg"
      ? { filters: [{ name: "Gambar", extensions: ["png", "jpg", "jpeg", "webp"] }] }
      : {
          filters: [
            { name: "Video", extensions: ["mp4", "mov", "mkv", "avi", "webm", "m4v"] },
            { name: "Semua file", extensions: ["*"] },
          ],
        };
  const r = await dialog.showOpenDialog(win, { properties: ["openFile"], ...opsi });
  if (r.canceled || !r.filePaths[0]) return null;
  const p = r.filePaths[0];
  let ukuran = 0;
  try {
    ukuran = fs.statSync(p).size;
  } catch {}
  return { path: p, nama: path.basename(p), ukuran };
});

app.whenReady().then(async () => {
  nyalakanServer();
  await tungguServer();
  await buatJendela();
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
