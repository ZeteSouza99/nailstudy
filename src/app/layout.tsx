import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import { themeScript } from "@/lib/theme";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Nail Agenda",
    template: "%s | Nail Agenda",
  },
  description: "Agendamento e gestão para profissionais de unhas.",
  appleWebApp: { capable: true, title: "Nail Agenda", statusBarStyle: "default" },
  icons: { apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#073b3a",
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
