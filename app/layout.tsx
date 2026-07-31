import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BangBuck — the most cost-efficient AI coding model",
  description:
    "Which AI model gives you the most work per dollar? Benchmark scores from DeepSWE and arena.ai, ranked by cost efficiency instead of raw capability.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
