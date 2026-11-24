import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ลอยกระทงใต้แสงจันทร์ • ลอยกระทงร่วมกันสองคน",
  description:
    "แต่งกระทงใบเดียวกัน ปล่อยโคมลอยบนท้องฟ้า และกดปล่อยกระทงลงสายน้ำพร้อมกันในคืนวันเพ็ญ 24 พฤศจิกายน 2569",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#070b1a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" className="dark">
      <head>
        {/*
          Load Thai display fonts via stylesheet links instead of next/font/google.
          Vercel builds were intermittently failing when Google Fonts fetch returned
          null during next/font compile (Noto_Sans_Thai / Prompt).
        */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@300;400;500;600&family=Prompt:wght@300;400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-dvh bg-[#060918] font-sans text-[#f8f3e8] antialiased selection:bg-amber-400/30 selection:text-amber-100">
        {children}
      </body>
    </html>
  );
}
