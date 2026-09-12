// Tipe tambahan untuk jembatan desktop Electron
export {};

declare global {
  interface Window {
    vdsplitDesktop?: {
      /** pilih file — video: array banyak file (antrean), bg/logo: array 1 file */
      pilih: (
        jenis: "video" | "bg" | "logo",
      ) => Promise<Array<{ path: string; nama: string; ukuran: number }>>;
    };
  }
}
