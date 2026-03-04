import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/react";
import "./globals.css";

export const metadata: Metadata = {
  title: "repocost — What would it cost to build?",
  description:
    "Estimate the human time and money behind any GitHub repo. Powered by COCOMO II with per-language market rates.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_URL || "https://repocost.dev"),
  openGraph: {
    title: "repocost — What would it cost to build?",
    description: "Estimate the human time and money behind any GitHub repo.",
    type: "website",
    images: ["/og-default.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "repocost",
    description: "Estimate the human time and money behind any GitHub repo.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
