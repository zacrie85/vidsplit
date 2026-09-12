// Tipe tambahan untuk jembatan desktop Electron
export {};

declare global {
  interface Window {
    vdsplitDesktop?: {
      /** pilih file — video: array banyak file (antrean), bg/logo: array 1 file */
      pilih: (
        jenis: "video" | "bg" | "logo",
      ) => Promise<Array<{ path: string; nama: string; ukuran: number }>>;
      /** buka folder hasil ekspor di Explorer (hanya mode desktop) */
      bukaFolder?: (rel: string) => Promise<{ ok: boolean; error?: string }>;
      /** v0.6.4 — dialog Windows utk memilih folder tujuan hasil ekspor */
      pilihFolder?: () => Promise<{
        ok: boolean;
        path?: string;
        batal?: boolean;
        error?: string;
      }>;
      /** v0.6.4 — buka folder absolut (folder tujuan) di Explorer */
      bukaFolderAbs?: (p: string) => Promise<{ ok: boolean; error?: string }>;
    };
  }
}
