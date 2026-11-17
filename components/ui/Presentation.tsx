import type { ReactNode } from "react";

export function PageHeading({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <header className="space-y-3">
      {eyebrow && <p className="ui-eyebrow">{eyebrow}</p>}
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        {title}
      </h1>
      {children && (
        <div className="max-w-2xl text-sm leading-7 text-stone-600">
          {children}
        </div>
      )}
    </header>
  );
}

export function EmptyState({
  title,
  children,
  action,
  icon,
  headingTag: Heading = "h3",
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  headingTag?: "h2" | "h3";
}) {
  return (
    <div className="ui-panel border-dashed px-5 py-10 text-center">
      <span
        aria-hidden="true"
        className="mb-4 inline-flex size-12 items-center justify-center rounded-xl border border-line text-accent"
      >
        {icon ?? "▦"}
      </span>
      <Heading className="font-semibold">{title}</Heading>
      <div className="mx-auto mt-2 max-w-md text-sm leading-6 text-stone-600">
        {children}
      </div>
      {action && (
        <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div>
      )}
    </div>
  );
}

export function InlineMessage({
  tone = "info",
  children,
}: {
  tone?: "info" | "success" | "warning" | "error";
  children: ReactNode;
}) {
  const styles = {
    info: "border-line bg-card text-stone-700",
    success: "border-emerald-200 bg-emerald-50 text-emerald-900",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
    error: "border-red-200 bg-red-50 text-red-900",
  };
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`rounded-lg border px-4 py-3 text-sm leading-6 ${styles[tone]}`}
    >
      {children}
    </div>
  );
}
