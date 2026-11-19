import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import { Suspense } from "react";
import { NavigationLoader } from "@/components/NavigationLoader";
import { SlowSectionWatcher } from "@/components/SlowSectionWatcher";
import { SkipLink } from "@/components/ui/SkipLink";
import { SiteFooter } from "@/components/footer/SiteFooter";
import { siteMetadataBase } from "@/lib/site";
import { TIME_ZONE_COOKIE } from "@/lib/time-zone";
import { getRequestToday } from "@/lib/today";
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
  applicationName: "TrainGrid",
  // Installed on a phone's home screen: open like an app, titled TrainGrid.
  appleWebApp: { capable: true, title: "TrainGrid", statusBarStyle: "default" },
  formatDetection: { telephone: false },
  // A link to any page (not only /) previews with the TrainGrid card.
  openGraph: {
    siteName: "TrainGrid",
    type: "website",
    title: "TrainGrid",
    description: "Plan the week. Own the work. An invite-only training planner.",
    images: [{ url: "/marketing/og-preview.png", width: 1200, height: 630, alt: "TrainGrid weekly training planner" }],
  },
  twitter: { card: "summary_large_image", images: ["/marketing/og-preview.png"] },
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
 *      (lib/time-zone.ts). The value is validated on the server before use;
 *   3. corrects the first request. Before the cookie exists (or after
 *      travelling, while it names the old zone) the server can only guess the
 *      zone, and around midnight the guess lands on the wrong day. The server
 *      stamps the day it used on <html data-today>; when the browser's own day
 *      differs, the page is hidden and loaded again, now with the cookie. A
 *      planner page that /week/current redirected to is asked for again as
 *      /week/current, so the redirect is decided again too. At most once per
 *      day and zone, so blocked cookies can never cause a reload loop.
 */
const THEME_INIT = `(function () {
  try {
    var tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    var name = "${TIME_ZONE_COOKIE}=";
    if (tz && document.cookie.split("; ").indexOf(name + encodeURIComponent(tz)) === -1) {
      document.cookie = name + encodeURIComponent(tz) + "; path=/; max-age=31536000; samesite=lax" +
        (location.protocol === "https:" ? "; secure" : "");
    }
    var root = document.documentElement;
    var served = root.getAttribute("data-today");
    var p = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
    var part = function (t) { for (var i = 0; i < p.length; i++) if (p[i].type === t) return p[i].value; return ""; };
    var local = part("year") + "-" + part("month") + "-" + part("day");
    var stored = document.cookie.split("; ").indexOf(name + encodeURIComponent(tz)) !== -1;
    var once = "tg_tz_corrected:" + tz + ":" + local;
    if (served && served !== local && stored && sessionStorage.getItem(once) === null) {
      sessionStorage.setItem(once, "1");
      root.style.visibility = "hidden";
      var target = location.pathname + location.search + location.hash;
      var nav = performance.getEntriesByType && performance.getEntriesByType("navigation")[0];
      var week = /^[/]week[/]([0-9]{4}-W[0-9]{2})([/]add)?$/.exec(location.pathname);
      if (week && nav && nav.redirectCount > 0 && week[1] === root.getAttribute("data-today-week")) {
        target = "/week/current" + (week[2] || "");
      }
      location.replace(target);
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

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // The day this response is rendered for; the script above checks it.
  const today = await getRequestToday();
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      data-today={today.date}
      data-today-week={today.weekId}
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
