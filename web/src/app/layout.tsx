import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Shell } from "@/components/nav";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getFreshness } from "@/lib/queries";

/* Inter is the fallback for platforms without San Francisco. */
const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: { default: "Wannabe Fit", template: "%s · Wannabe Fit" },
  description: "Recovery, sleep, and strain computed from a CMF Watch Pro 2.",
  applicationName: "Wannabe Fit",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Wannabe Fit" },
  formatDetection: { telephone: false },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  viewportFit: "cover",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const fresh = getFreshness();
  return (
    <html lang="en" className={`dark ${inter.variable} h-full antialiased`}>
      <body className="min-h-full">
        <TooltipProvider delayDuration={150}>
          <Shell fresh={fresh}>{children}</Shell>
        </TooltipProvider>
      </body>
    </html>
  );
}
