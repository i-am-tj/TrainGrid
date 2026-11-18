import { AppHeader } from "@/components/AppHeader";
import { PublicHeader } from "@/components/marketing/PublicHeader";
import { getViewer } from "@/lib/auth/session";

/**
 * Shell for the public information pages (privacy, terms, what's new):
 * members keep their app header and navigation; everyone else gets the
 * public header, whose Features and About lead back to the landing page.
 */
export default async function InfoLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  return (
    <>
      {viewer.status === "member" ? <AppHeader /> : <PublicHeader anchorBase="/" />}
      <main id="main-content" tabIndex={-1} className="app-main flex-1">
        {children}
      </main>
    </>
  );
}
