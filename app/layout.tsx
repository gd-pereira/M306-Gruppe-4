import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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

export const metadata: Metadata = {
  title: { default: "Flux", template: "%s · Flux" },
  description:
    "Flux liest SDAT- und ESL-Dateien ein und zeigt Verbrauch, Einspeisung und Zählerstand. Alle Daten werden lokal im Browser verarbeitet.",
  applicationName: "Flux",
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
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
