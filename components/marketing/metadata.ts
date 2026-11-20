import type { Metadata } from "next";

/** Apply only to the future public page; never to private planner routes. */
export const landingMetadata: Metadata = {
  title: "TrainGrid — Plan the week. Train with it.",
  description:
    "Plan your training week with a flexible calendar, shared workout library and personal routines, then run each session on your phone: log every set, rest on a timer and see last time’s numbers. TrainGrid is in invite-only early access.",
  openGraph: {
    title: "TrainGrid — Plan the week. Train with it.",
    description: "Plan your training week, then run each workout on your phone, set by set.",
    type: "website",
    images: [
      {
        url: "/marketing/og-preview.png",
        width: 1200,
        height: 630,
        alt: "TrainGrid: Plan the week. Train with it. An example training week beside a workout being logged on a phone.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/marketing/og-preview.png"],
  },
};
