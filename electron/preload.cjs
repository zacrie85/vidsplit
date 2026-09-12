// VidSplit — jembatan aman renderer ↔ proses utama
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("vdsplitDesktop", {
  pilih: (jenis) => ipcRenderer.invoke("vdsplit:pilih", jenis),
  /** buka folder hasil ekspor di Explorer — path relatif thd folder data */
  bukaFolder: (rel) => ipcRenderer.invoke("vdsplit:buka-folder", rel),
  /** v0.6.4 — dialog Windows utk memilih folder tujuan hasil ekspor */
  pilihFolder: () => ipcRenderer.invoke("vdsplit:pilih-folder"),
  /** v0.6.4 — buka folder ABSOLUT (folder tujuan) di Explorer */
  bukaFolderAbs: (p) => ipcRenderer.invoke("vdsplit:buka-folder-abs", p),
});
