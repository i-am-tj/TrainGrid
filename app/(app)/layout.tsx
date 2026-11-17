import { AppHeader } from "@/components/AppHeader";

/**
 * Shell for the application: sign-in, home, planner, library, sessions and
 * admin. AppHeader reads the viewer to choose its links; every page still
 * checks membership (and admin rights) itself.
 */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <AppHeader />
      <main id="main-content" tabIndex={-1} className="app-main flex-1">
        {children}
      </main>
    </>
  );
}
