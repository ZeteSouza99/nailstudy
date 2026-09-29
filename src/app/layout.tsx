import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import { themeScript } from "@/lib/theme";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Erika Queiroz | Nail Designer",
    template: "%s | Erika Queiroz",
  },
  description: "Erika Queiroz Nail Designer — agende seu horário e cuide de você.",
  appleWebApp: { capable: true, title: "Erika Queiroz", statusBarStyle: "default" },
  icons: { apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#83423e",
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
