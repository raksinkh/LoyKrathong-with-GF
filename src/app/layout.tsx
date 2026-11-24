import type { Metadata, Viewport } from "next";
import { Noto_Sans_Thai, Prompt } from "next/font/google";
import "./globals.css";

const prompt = Prompt({
  subsets: ["thai", "latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-prompt",
  display: "swap",
});

const notoSansThai = Noto_Sans_Thai({
  subsets: ["thai", "latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-noto-thai",
  display: "swap",
});

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
    <html
      lang="th"
      className={`${prompt.variable} ${notoSansThai.variable} dark`}
    >
      <body className="min-h-dvh bg-[#060918] text-[#f8f3e8] antialiased selection:bg-amber-400/30 selection:text-amber-100">
        {children}
      </body>
    </html>
  );
}
