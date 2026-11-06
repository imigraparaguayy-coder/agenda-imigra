import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agenda do Imigra | Gravações e publicações",
  description: "Organize suas visitas às lojas, gravações de vídeos e publicações em um só lugar.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
