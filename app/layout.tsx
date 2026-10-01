import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { SIDEBAR_BOOT_SCRIPT } from "@/components/app-shell/sidebar-boot";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "Flux", template: "%s · Flux" },
  description:
    "Flux liest SDAT- und ESL-Dateien ein und zeigt Verbrauch, Einspeisung und Zählerstand. Alle Daten werden lokal im Browser verarbeitet.",
  applicationName: "Flux",
  openGraph: {
    title: "Flux",
    description:
      "Flux liest SDAT- und ESL-Dateien ein und zeigt Verbrauch, Einspeisung und Zählerstand. Alle Daten werden lokal im Browser verarbeitet.",
    type: "website",
    locale: "de_CH",
  },
  twitter: {
    card: "summary_large_image",
    title: "Flux",
    description:
      "Flux liest SDAT- und ESL-Dateien ein und zeigt Verbrauch, Einspeisung und Zählerstand. Alle Daten werden lokal im Browser verarbeitet.",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // the boot script sets data-sidebar before hydration
    <html
      suppressHydrationWarning
      lang="de"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: SIDEBAR_BOOT_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col">
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
