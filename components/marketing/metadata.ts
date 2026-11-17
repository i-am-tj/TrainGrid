import type { Metadata } from "next";

/** Apply only to the future public page; never to private planner routes. */
export const landingMetadata: Metadata = {
  title: "TrainGrid — Plan the week. Own the work.",
  description:
    "Plan your training week with a flexible calendar, shared workout library and personal routines. TrainGrid is in invite-only Beta.",
  openGraph: {
    title: "TrainGrid — Plan the week. Own the work.",
    description: "Your training week, thoughtfully together.",
    type: "website",
    images: [
      {
        url: "/marketing/og-preview.png",
        width: 1200,
        height: 630,
        alt: "TrainGrid: Plan the week. Own the work. Example weekly training planner.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/marketing/og-preview.png"],
  },
};
