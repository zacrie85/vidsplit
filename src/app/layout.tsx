import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "VidSplit — Split & Konversi Video Vertikal",
  description:
    "Ubah video horizontal jadi vertikal 9:16, beri judul + tulisan Part otomatis berganti sesuai durasi set, split tepat di batas part, dan intro background di tiap potongan.",
};

export const viewport: Viewport = {
  themeColor: "#0b0f14",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className="min-h-screen antialiased">
        {children}
        <Toaster position="top-center" richColors theme="dark" />
      </body>
    </html>
  );
}
