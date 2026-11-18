import type { Metadata } from "next";
import { InlineText } from "@/components/info/InlineText";
import type { Release, ReleaseBlock } from "@/lib/changelog";
import { displayVersion } from "@/lib/changelog";
import { loadReleases } from "@/lib/changelog-file";
import { canonicalUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "What’s new · TrainGrid",
  description: "Every TrainGrid release, newest first.",
  alternates: canonicalUrl("/whats-new") ? { canonical: canonicalUrl("/whats-new")! } : undefined,
};

const LONG_DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

function formatDate(iso: string | null): string | null {
  return iso ? LONG_DATE.format(new Date(`${iso}T00:00:00Z`)) : null;
}

/** Releases from CHANGELOG.md, newest first; the latest one gets the spotlight. */
export default async function WhatsNewPage() {
  const [latest, ...earlier] = await loadReleases();

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      <header>
        <p className="ui-eyebrow">What’s new</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-5xl">Better every release</h1>
        <p className="mt-4 max-w-2xl text-base leading-8 text-stone-700">
          Everything that has changed in TrainGrid, newest first, most of it shaped by members’
          feedback.
        </p>
      </header>

      {latest ? (
        <article
          aria-labelledby={`release-${latest.version}`}
          className="ui-panel relative mt-10 overflow-hidden p-6 sm:p-8"
        >
          <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-accent/10 blur-3xl" />
          <div className="relative flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold text-white dark:text-stone-900">
              Latest
            </span>
            {latest.date ? (
              <time dateTime={latest.date} className="text-sm text-stone-600">
                {formatDate(latest.date)}
              </time>
            ) : null}
          </div>
          <h2 id={`release-${latest.version}`} className="relative mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">
            TrainGrid {displayVersion(latest.version)}
          </h2>
          <div className="relative mt-5">
            <ReleaseBody release={latest} />
          </div>
        </article>
      ) : (
        <p className="mt-10 text-stone-600">Release notes will appear here.</p>
      )}

      {earlier.length ? (
        <section aria-labelledby="earlier-title" className="mt-14">
          <h2 id="earlier-title" className="text-sm font-semibold uppercase tracking-[0.12em] text-stone-600">
            Earlier releases
          </h2>
          <ol className="relative mt-6 space-y-10 border-l border-line pl-6 sm:pl-8">
            {earlier.map((release) => (
              <li key={release.version} className="relative">
                <span
                  aria-hidden="true"
                  className="absolute -left-[calc(1.5rem+5px)] top-2 size-2.5 rounded-full border-2 border-card bg-stone-400 ring-1 ring-line sm:-left-[calc(2rem+5px)]"
                />
                <article aria-labelledby={`release-${release.version}`}>
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <h3 id={`release-${release.version}`} className="text-lg font-semibold tracking-tight">
                      TrainGrid {displayVersion(release.version)}
                    </h3>
                    {release.date ? (
                      <time dateTime={release.date} className="text-sm text-stone-600">
                        {formatDate(release.date)}
                      </time>
                    ) : null}
                  </div>
                  <div className="mt-3">
                    <ReleaseBody release={release} compact />
                  </div>
                </article>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  );
}

function ReleaseBody({ release, compact = false }: { release: Release; compact?: boolean }) {
  return (
    <div className={`space-y-4 ${compact ? "text-sm leading-7" : "text-[15px] leading-7"} text-stone-700`}>
      {release.blocks.map((block, index) => (
        <Block key={index} block={block} />
      ))}
    </div>
  );
}

function Block({ block }: { block: ReleaseBlock }) {
  if (block.type === "heading")
    return <h4 className="pt-2 text-sm font-semibold uppercase tracking-[0.1em] text-accent">{block.text}</h4>;
  if (block.type === "paragraph")
    return (
      <p>
        <InlineText text={block.text} />
      </p>
    );
  return (
    <ul className="space-y-2.5">
      {block.items.map((item) => (
        <li key={item} className="flex gap-3">
          <span aria-hidden="true" className="mt-[0.7em] size-1.5 shrink-0 rounded-full bg-accent" />
          <span className="min-w-0">
            <InlineText text={item} />
          </span>
        </li>
      ))}
    </ul>
  );
}
