/**
 * The member's getting-started steps on /home. Pure: progress in, steps out.
 * Each step is done when the member's own data shows it, never by a click.
 */

export type OnboardingProgress = {
  /** At least one session on their calendar. */
  plannedSession: boolean;
  /** At least one routine of their own (created or copied from the library). */
  ownRoutine: boolean;
  /** At least one session scheduled from a routine. */
  scheduledRoutine: boolean;
};

export type OnboardingStep = {
  id: keyof OnboardingProgress;
  title: string;
  description: string;
  actionLabel: string;
  href: string;
  done: boolean;
};

/** Cookie set when the member hides the card; read on the server, so no flash. */
export const ONBOARDING_DISMISSED_COOKIE = "tg_onboarding_hidden";

export function onboardingSteps(progress: OnboardingProgress, links: { addSessionHref: string }): OnboardingStep[] {
  return [
    {
      id: "plannedSession",
      title: "Plan your first session",
      description: "Put a run, a lift or anything else on a day this week.",
      actionLabel: "Add a session",
      href: links.addSessionHref,
      done: progress.plannedSession,
    },
    {
      id: "ownRoutine",
      title: "Make a routine your own",
      description: "Copy one from the TrainGrid library, or build your own from scratch.",
      actionLabel: "Browse the library",
      href: "/library?scope=global",
      done: progress.ownRoutine,
    },
    {
      id: "scheduledRoutine",
      title: "Schedule a routine",
      description: "Drop a routine onto your week, ready to go with its full workout.",
      actionLabel: "Pick a routine",
      href: "/library",
      done: progress.scheduledRoutine,
    },
  ];
}

/** Shown until every step is done, unless the member hid it. */
export function showOnboarding(progress: OnboardingProgress | null, dismissed: boolean): boolean {
  if (dismissed || !progress) return false;
  return !(progress.plannedSession && progress.ownRoutine && progress.scheduledRoutine);
}
