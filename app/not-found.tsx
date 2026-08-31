import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-3 py-16 text-center">
      <h1 className="text-xl font-semibold">Not found</h1>
      <p className="mt-2 text-sm text-stone-600">Session or page not found.</p>
      <Link href="/" className="mt-4 inline-block underline">
        Back to planner
      </Link>
    </div>
  );
}
