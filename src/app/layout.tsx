import type { Metadata } from "next";
import { Saira, Saira_Condensed, JetBrains_Mono } from "next/font/google";
import { HighContrastInit } from "@/presentation/ui/HighContrastInit";
import "./globals.css";

const saira = Saira({
  variable: "--font-saira",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

const sairaCondensed = Saira_Condensed({
  variable: "--font-saira-condensed",
  subsets: ["latin"],
  weight: ["700", "800"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["500", "700"],
});

export const metadata: Metadata = {
  title: "Friend Fire — Tático Top-Down",
  description:
    "Shooter tático top-down multiplayer no navegador. TR vs CT, economia, bots e rádio.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${saira.variable} ${sairaCondensed.variable} ${jetbrainsMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full bg-[#0b0d12] font-sans text-white">
        <HighContrastInit />
        {children}
      </body>
    </html>
  );
}
