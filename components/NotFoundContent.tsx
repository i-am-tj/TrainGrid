import Link from "next/link";

/**
 * The 404 message. The default is identical for every viewer and route, so
 * an admin page's 404 cannot be told from a page that doesn't exist. A
 * section may name what is missing and offer its own way back (the Library
 * does), as long as the words are the same whether the item never existed or
 * belongs to someone else (UI_DESIGN_AUDIT rank 9).
 */
export function NotFoundContent({
  message = "This page doesn’t exist, or it’s no longer available.",
  back = { href: "/week/current", label: "Back to planner" },
}: {
  message?: string;
  back?: { href: string; label: string };
}) {
  return (
    <div className="mx-auto my-10 max-w-xl rounded-2xl border border-line bg-card px-5 py-10 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Not found</h1>
      <p className="mt-3 text-sm leading-7 text-stone-600">{message}</p>
      <Link
        href={back.href}
        className="mt-4 inline-flex min-h-10 items-center rounded-sm text-accent underline underline-offset-4"
      >
        {back.label}
      </Link>
    </div>
  );
}
