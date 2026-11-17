import { PublicHeader } from "@/components/marketing/PublicHeader";

/**
 * Shell for the public landing page. PublicHeader takes no viewer data, so
 * nothing in this layout reads the session or the database.
 */
export default function MarketingLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <PublicHeader />
      <main id="main-content" tabIndex={-1} className="app-main flex-1">
        {children}
      </main>
    </>
  );
}
