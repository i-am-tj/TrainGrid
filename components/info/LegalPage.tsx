import type { ReactNode } from "react";

export type LegalSection = { id: string; title: string; body: ReactNode };

/**
 * A calm, readable layout for the privacy notice and terms: a short summary
 * first, then numbered sections with an "On this page" index that stays in
 * view on wide screens.
 */
export function LegalPage({
  eyebrow,
  title,
  updated,
  intro,
  summary,
  sections,
}: {
  eyebrow: string;
  title: string;
  /** Human date, e.g. "17 November 2026". */
  updated: string;
  intro: ReactNode;
  summary: string[];
  sections: LegalSection[];
}) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <header className="max-w-3xl">
        <p className="ui-eyebrow">{eyebrow}</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-5xl">{title}</h1>
        <p className="mt-4 text-sm text-stone-600">Last updated {updated}</p>
        <div className="mt-5 text-base leading-8 text-stone-700">{intro}</div>
      </header>

      <section aria-labelledby="summary-title" className="ui-panel relative mt-10 max-w-3xl overflow-hidden p-6 sm:p-7">
        <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-20 size-56 rounded-full bg-accent/10 blur-3xl" />
        <h2 id="summary-title" className="relative text-sm font-semibold uppercase tracking-[0.12em] text-accent">
          The short version
        </h2>
        <ul className="relative mt-4 space-y-3">
          {summary.map((line) => (
            <li key={line} className="flex gap-3 text-sm leading-6 text-stone-700">
              <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" />
              {line}
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-12 grid gap-10 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-14">
        <nav aria-label="On this page" className="hidden lg:block">
          <div className="sticky top-6">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-600">On this page</p>
            <ol className="mt-3 space-y-1 border-l border-line">
              {sections.map((section, index) => (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    className="-ml-px block border-l border-transparent py-1.5 pl-4 text-sm text-stone-600 hover:border-accent hover:text-foreground"
                  >
                    <span className="mr-2 font-mono text-xs text-stone-500">{String(index + 1).padStart(2, "0")}</span>
                    {section.title}
                  </a>
                </li>
              ))}
            </ol>
          </div>
        </nav>
        <div className="max-w-3xl space-y-12">
          {sections.map((section, index) => (
            <section key={section.id} id={section.id} aria-labelledby={`${section.id}-title`} className="scroll-mt-6">
              <h2 id={`${section.id}-title`} className="flex items-baseline gap-3 text-xl font-semibold tracking-tight">
                <span aria-hidden="true" className="font-mono text-sm text-accent">
                  {String(index + 1).padStart(2, "0")}
                </span>
                {section.title}
              </h2>
              <div className="legal-prose mt-4 space-y-4 text-[15px] leading-7 text-stone-700">{section.body}</div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
