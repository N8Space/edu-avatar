import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Edu-Avatar | AI Enablement Showcase by Nathan Lester",
  description: "Transform educational knowledge articles (≤ 500 words) into personalized talking-avatar videos in 30 seconds. Built with Google Gemini 3.6 Flash, multi-tier AI safety guardrails, zero-cost voice synthesis, Remotion video engine, and Google Drive archiving.",
  authors: [{ name: "Nathan Lester", url: "https://winelogbooks.com/projects" }],
  openGraph: {
    title: "Edu-Avatar | AI Enablement Showcase",
    description: "Personalized Educational Talking Avatar Video Generator by Nathan Lester",
    url: "https://winelogbooks.com/projects",
    siteName: "Nathan Lester AI Enablement Portfolio",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
