// Tipe tambahan untuk jembatan desktop Electron
export {};

declare global {
  interface Window {
    vdsplitDesktop?: {
      pilih: (
        jenis: "video" | "bg",
      ) => Promise<{ path: string; nama: string; ukuran: number } | null>;
    };
  }
}
