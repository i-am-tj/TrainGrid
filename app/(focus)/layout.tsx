/**
 * Shell for focused, full-screen tasks (the live workout): no site header or
 * footer, so the phone's whole screen belongs to the task. Every page still
 * checks membership itself.
 */
export default function FocusLayout({ children }: LayoutProps<"/">) {
  return (
    <main id="main-content" tabIndex={-1} className="focus-main flex-1">
      {children}
    </main>
  );
}
