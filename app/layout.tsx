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
  title: "Favs — AI-Powered Movie, TV & Music Recommendations",
  description:
    "Describe what you're looking for — even vaguely — and get personalized movie, TV series, and music recommendations powered by AI.",
  openGraph: {
    title: "Favs — AI-Powered Recommendations",
    description:
      "Discover your next favorite movie, TV series, or song with AI-powered search and recommendations.",
    images: [{ url: "/og-image.png", width: 1024, height: 1024 }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Favs — AI-Powered Recommendations",
    description:
      "Discover your next favorite movie, TV series, or song with AI-powered search and recommendations.",
    images: ["/og-image.png"],
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[#141414] text-white overflow-x-hidden`}
      >
        {children}
      </body>
    </html>
  );
}
