import { BrandLogo } from "@/components/BrandLogo";

/**
 * TrainGrid's loader: the logo turning clockwise. Announced politely to screen
 * readers; with reduced motion it pulses gently instead of spinning.
 */

const SIZES = {
  sm: "h-5 w-5",
  md: "h-8 w-8",
  lg: "h-12 w-12",
} as const;

export function LogoLoader({
  size = "md",
  label = "Loading…",
  showLabel = false,
}: {
  size?: keyof typeof SIZES;
  label?: string;
  showLabel?: boolean;
}) {
  return (
    <span role="status" aria-live="polite" className="inline-flex flex-col items-center gap-2">
      <BrandLogo
        className={`${SIZES[size]} rounded-[22%] animate-spin [animation-duration:1.1s] motion-reduce:animate-pulse dark:outline dark:outline-1 dark:outline-hairline`}
      />
      <span className={showLabel ? "text-sm text-stone-600" : "sr-only"}>{label}</span>
    </span>
  );
}

/** A section-sized loader: holds roughly the section's space while its data arrives. */
export function SectionLoader({ label = "Loading…", minHeight = "min-h-48" }: { label?: string; minHeight?: string }) {
  return (
    <div className={`flex ${minHeight} w-full items-center justify-center rounded-lg`} data-testid="section-loader">
      <LogoLoader size="md" label={label} showLabel />
    </div>
  );
}
