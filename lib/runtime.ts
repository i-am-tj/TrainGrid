/**
 * Published / hosted builds are read-only.
 * Edit locally, then commit + push `data/` to publish a new plan.
 *
 * Override with TRAINGRID_READONLY=true|false when needed.
 */
export function isPublishedReadonly(): boolean {
  const override = process.env.TRAINGRID_READONLY;
  if (override === "true") return true;
  if (override === "false") return false;
  return process.env.VERCEL === "1";
}
