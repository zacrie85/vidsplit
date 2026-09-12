// VidSplit — jembatan aman renderer ↔ proses utama
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("vdsplitDesktop", {
  pilih: (jenis) => ipcRenderer.invoke("vdsplit:pilih", jenis),
  /** buka folder hasil ekspor di Explorer — path relatif thd folder data */
  bukaFolder: (rel) => ipcRenderer.invoke("vdsplit:buka-folder", rel),
});
