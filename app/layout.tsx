import type { Metadata } from "next";
import { JetBrains_Mono, Outfit } from "next/font/google";

import "./globals.css";

const outfit = Outfit({
  subsets: ["latin", "latin-ext"],
  variable: "--font-sans"
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono"
});

export const metadata: Metadata = {
  title: "Vietlot Lab · 6/55 & 6/45",
  description: "Thống kê & Monte Carlo cho Power 6/55 và Mega 6/45"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className={`${outfit.variable} ${jetbrains.variable}`}>
      <body>{children}</body>
    </html>
  );
}
