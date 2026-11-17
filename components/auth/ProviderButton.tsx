import type { OAuthProviderId } from "@/lib/auth/providers";
import { GitHubIcon } from "@/components/footer/SocialIcons";
import { btnSecondary } from "@/lib/ui";

/** Pure presentation also used to exercise the pending state in component QA. */
export function ProviderButton({
  provider,
  label,
  pending = false,
}: {
  provider: OAuthProviderId;
  label: string;
  pending?: boolean;
}) {
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      aria-label={label}
      className={`${btnSecondary} w-full gap-3 !rounded-lg !py-3`}
    >
      <span
        aria-hidden="true"
        className="inline-flex size-5 shrink-0 items-center justify-center"
      >
        {pending ? (
          <span
            aria-hidden="true"
            className="size-3 rounded-full border-2 border-line border-t-accent motion-safe:animate-spin"
          />
        ) : provider === "github" ? (
          <GitHubIcon />
        ) : (
          <GoogleIcon />
        )}
      </span>
      <span className="min-w-0 [overflow-wrap:anywhere]">
        {pending
          ? `Connecting to ${provider === "google" ? "Google" : "GitHub"}…`
          : label}
      </span>
    </button>
  );
}

function GoogleIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5">
      <path
        fill="#4285f4"
        d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.33 2.98-7.36Z"
      />
      <path
        fill="#34a853"
        d="M12 22c2.7 0 4.96-.9 6.62-2.41l-3.24-2.51c-.9.6-2.04.96-3.38.96-2.6 0-4.8-1.76-5.59-4.12H3.07v2.59A10 10 0 0 0 12 22Z"
      />
      <path
        fill="#fbbc05"
        d="M6.41 13.92a6 6 0 0 1 0-3.84V7.49H3.07a10 10 0 0 0 0 9.02l3.34-2.59Z"
      />
      <path
        fill="#ea4335"
        d="M12 5.96c1.47 0 2.79.5 3.82 1.49l2.87-2.87A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.93 5.49l3.34 2.59C7.2 7.72 9.4 5.96 12 5.96Z"
      />
    </svg>
  );
}
