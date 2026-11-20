import type { MetadataRoute } from "next";

/**
 * Makes TrainGrid installable ("Add to Home Screen"): it opens on the
 * member's home in its own window, with the brand colours and app icons
 * (scripts/generate-app-icons.ts). Public (lib/auth/routes.ts), because the
 * browser fetches it without a session.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "TrainGrid",
    short_name: "TrainGrid",
    description: "Plan your training week, then run each workout on your phone: log your sets, rest on a timer, and keep going without signal.",
    start_url: "/home",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#f4f1ea",
    theme_color: "#1c1917",
    categories: ["health", "fitness", "lifestyle"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Planner", short_name: "Planner", url: "/week/current", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Library", short_name: "Library", url: "/library", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Home", short_name: "Home", url: "/home", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
