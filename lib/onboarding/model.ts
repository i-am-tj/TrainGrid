/**
 * Home's first-session invitation (PRODUCT_AUDIT F14). Pure.
 *
 * A fresh member gets one invitation, in place of Today's empty state: plan a
 * first session, ideally from a TrainGrid routine. It goes away on its own once
 * any session is planned (from a routine, from scratch or a quick workout), or
 * on this device when the member hides it.
 */

/** Cookie set when the member hides the invitation; read on the server, so no flash. */
export const ONBOARDING_DISMISSED_COOKIE = "tg_onboarding_hidden";

/**
 * Whether to invite the member to plan a first session. `plannedAny` is null
 * when it could not be read: then Today keeps its usual empty state.
 */
export function showFirstSessionInvite(plannedAny: boolean | null, dismissed: boolean): boolean {
  return !dismissed && plannedAny === false;
}
