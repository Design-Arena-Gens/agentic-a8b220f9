import type { Metadata } from "next";
import { Inter, Special_Elite } from "next/font/google";
import "./globals.css";

const base = Inter({
  variable: "--font-base",
  subsets: ["latin"],
  display: "swap",
});

const whisper = Special_Elite({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-whisper",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Night Whispers | 30s Horror Short",
  description:
    "A 30-second horror microfilm built for reels, blending sinister visuals and escalating sound design.",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${base.variable} ${whisper.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
