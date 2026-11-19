import type { Metadata } from "next";
import { LandingScroll } from "@/components/marketing/LandingScroll";
import { LandingPage } from "@/components/marketing/LandingPage";
import { landingMetadata } from "@/components/marketing/metadata";
import { canonicalUrl } from "@/lib/site";

/**
 * The public landing page. It is the only public page with content, so it
 * deliberately imports nothing that reads the session, the database or
 * member data; it renders the same for everyone, signed in or not, and even
 * when Supabase is not configured.
 */
export function generateMetadata(): Metadata {
  const canonical = canonicalUrl("/");
  return canonical ? { ...landingMetadata, alternates: { canonical } } : landingMetadata;
}

export default function HomePage() {
  return (
    <>
      <LandingScroll />
      <LandingPage />
    </>
  );
}
