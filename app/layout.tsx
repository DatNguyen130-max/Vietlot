import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Power 6/55 & Mega 6/45 Probability Dashboard",
  description: "Internal dashboard to estimate next-draw number probabilities for Power 6/55 and Mega 6/45"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
