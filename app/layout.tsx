import type { Metadata, Viewport } from "next";
import "./globals.css";

const DESCRIPTION =
  "Which AI coding model gives you the most work per dollar? Every model has to clear two bars — " +
  "finish the job on DeepSWE, and write code humans actually prefer on Arena's WebDev board — " +
  "then balance capability, measured cost, output tokens, and agent steps.";

export const metadata: Metadata = {
  // Absolute URLs for the social card. Vercel injects its production hostname,
  // so this self-configures on deploy; NEXT_PUBLIC_SITE_URL wins if set (e.g. a
  // custom domain), and localhost keeps dev builds warning-free.
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ??
      (process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
        : "http://localhost:3000"),
  ),
  title: "BangBuck — the most cost-efficient AI coding model",
  description: DESCRIPTION,
  // A link with no card is a link nobody opens, and this site is built to be
  // sent to someone. The image itself is generated from the ranking in
  // app/opengraph-image.tsx, so the preview can never disagree with the page.
  openGraph: {
    title: "BangBuck — best code per dollar",
    description: DESCRIPTION,
    siteName: "BangBuck",
    type: "website",
    locale: "en",
  },
  twitter: {
    card: "summary_large_image",
    title: "BangBuck — best code per dollar",
    description: DESCRIPTION,
  },
};

// Next 15 wants themeColor here rather than in metadata. Dark-only by design;
// telling the browser means form controls and the mobile address bar match
// instead of flashing white on load.
export const viewport: Viewport = {
  themeColor: "#0c0d10",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
