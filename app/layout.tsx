import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import { Suspense } from "react";
import { NavigationLoader } from "@/components/NavigationLoader";
import { SlowSectionWatcher } from "@/components/SlowSectionWatcher";
import { SkipLink } from "@/components/ui/SkipLink";
import { SiteFooter } from "@/components/footer/SiteFooter";
import { siteMetadataBase } from "@/lib/site";
import { TIME_ZONE_COOKIE } from "@/lib/time-zone";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// The display serif from iamtj.dev, used only for the "TJ" monogram in the footer.
const displaySerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
  style: "italic",
  display: "swap",
});

export const metadata: Metadata = {
  // Absolute URLs for Open Graph images and canonical links. Unset (null) when
  // the deployment origin is not known; Next.js then falls back to the request.
  metadataBase: siteMetadataBase(),
  title: "TrainGrid",
  description: "A lightweight 7-day training planner and workout reference.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f1ea" },
    { media: "(prefers-color-scheme: dark)", color: "#12100e" },
  ],
};

export const dynamic = "force-dynamic";

/**
 * Runs before the first paint:
 *
 *   1. applies the theme, so a dark page never flashes light: the saved choice
 *      (ThemeToggle), else the system setting;
 *   2. records the browser's IANA time zone in a cookie, so the server decides
 *      "today" for /home and the planner in the member's own time zone
 *      (lib/time-zone.ts). The value is validated on the server before use.
 */
const THEME_INIT = `(function () {
  try {
    var tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    var name = "${TIME_ZONE_COOKIE}=";
    if (tz && document.cookie.split("; ").indexOf(name + encodeURIComponent(tz)) === -1) {
      document.cookie = name + encodeURIComponent(tz) + "; path=/; max-age=31536000; samesite=lax" +
        (location.protocol === "https:" ? "; secure" : "");
    }
  } catch (e) {}
  try {
    var saved = localStorage.getItem("theme");
    var theme = saved === "light" || saved === "dark"
      ? saved
      : (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.style.colorScheme = theme;
  } catch (e) {}
})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${displaySerif.variable} h-full antialiased`}
      // The theme script changes the class and color-scheme before React hydrates.
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body className="min-h-dvh flex flex-col">
        <SkipLink />
        {/*
          The header and <main id="main-content"> come from the route group
          layouts: app/(marketing) for the public landing page, app/(app) for
          everything else. not-found.tsx and error.tsx render their own.
        */}
        {children}
        <SiteFooter />
        <Suspense fallback={null}>
          <NavigationLoader />
          <SlowSectionWatcher />
        </Suspense>
      </body>
    </html>
  );
}
