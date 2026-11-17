import { SectionLoader } from "@/components/LogoLoader";

/**
 * Shown while the library results load (E2-D14), under the heading and view
 * control, which stay on screen (they are in the layout). It lives in the
 * (list) route group so it applies to /library only: a loading boundary makes
 * a route stream, and detail pages must keep real 404 statuses and redirects.
 */
export default function LibraryLoading() {
  return <SectionLoader label="Loading routines…" minHeight="min-h-80" />;
}
