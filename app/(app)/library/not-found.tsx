import { NotFoundContent } from "@/components/NotFoundContent";

/** notFound() from a routine page: back to the Library, not the planner. */
export default function LibraryNotFound() {
  return (
    <NotFoundContent
      message="This routine doesn’t exist, or it’s no longer available."
      back={{ href: "/library", label: "Back to Library" }}
    />
  );
}
