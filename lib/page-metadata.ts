import type { Metadata } from "next";

/**
 * A member page's metadata: a title naming the task ("Edit exercises ·
 * TrainGrid"), so tabs, history and the route announcer can tell pages apart
 * (UI_DESIGN_AUDIT rank 8). Never a session's or routine's name or notes,
 * which would end up in browser history and synced tabs. Social pages use
 * lib/social/metadata.ts.
 */
export function pageMetadata(title: string): Metadata {
  return {
    title: `${title} · TrainGrid`,
    robots: { index: false, follow: false },
  };
}
