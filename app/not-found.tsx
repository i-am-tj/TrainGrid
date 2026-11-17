import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto my-10 max-w-xl rounded-2xl border border-line bg-card px-5 py-10 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Not found</h1>
      <p className="mt-3 text-sm leading-7 text-stone-600">Session or page not found.</p>
      <Link href="/" className="mt-4 inline-flex min-h-10 items-center rounded-sm text-accent underline underline-offset-4">
        Back to planner
      </Link>
    </div>
  );
}
