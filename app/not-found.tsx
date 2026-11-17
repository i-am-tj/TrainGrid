import { AppHeader } from "@/components/AppHeader";
import { NotFoundContent } from "@/components/NotFoundContent";

/**
 * 404 for URLs that match no route. It renders outside the route group
 * layouts, so it brings the header and main landmark itself. notFound()
 * thrown by an app page is handled by app/(app)/not-found.tsx instead, inside
 * the app layout. Both show the same content, so the admin page's 404 is
 * indistinguishable from a page that does not exist.
 */
export default function NotFound() {
  return (
    <>
      <AppHeader />
      <main id="main-content" tabIndex={-1} className="app-main flex-1">
        <NotFoundContent />
      </main>
    </>
  );
}
