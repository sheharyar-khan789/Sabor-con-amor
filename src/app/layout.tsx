import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Cormorant_Garamond, Playfair_Display, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { business, siteUrl } from "@/lib/config";
import { baseOpenGraph } from "@/lib/seo";

// Self-hosted at build time by next/font: no render-blocking third-party CSS.
const display = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "swap",
});

const body = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});

// Sabor con Amor design-system display face (DESIGN.md). Used where the
// `.theme-sabor` scope maps --font-display to it (customer area from Phase 3).
const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["500", "600"],
  style: ["normal", "italic"],
  variable: "--font-playfair",
  display: "swap",
});

// Only facts verified from the venue's own signage (media/MEDIA_INVENTORY.md):
// the name and its three services. Location and other details are added once
// the business confirms them.
const defaultTitle = "Sabor con Amor | Banquet Hall, Restaurant & Rooftop BBQ";
const defaultDescription = "Sabor con Amor: banquet hall, restaurant and rooftop BBQ.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: defaultTitle, template: `%s | ${business.name}` },
  description: defaultDescription,
  applicationName: business.name,
  keywords: [business.name, "banquet hall", "restaurant", "rooftop BBQ"],
  openGraph: baseOpenGraph,
  twitter: { card: "summary_large_image" },
  icons: { icon: "/favicon.ico" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#14110f",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Per-request CSP nonce from src/proxy.ts. Reading it makes every page
  // render per request, which nonce-based CSP requires (a prerendered page
  // could not carry a fresh nonce on its inline scripts).
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${display.variable} ${body.variable} ${playfair.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Marks JS as available before first paint so reveal styles apply without a flash. */}
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js')" }} />
      </head>
      <body className="bg-surface-low font-body text-ink antialiased">{children}</body>
    </html>
  );
}
