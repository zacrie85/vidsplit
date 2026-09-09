// VidSplit — jembatan aman renderer ↔ proses utama
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("vdsplitDesktop", {
  pilih: (jenis) => ipcRenderer.invoke("vdsplit:pilih", jenis),
});
