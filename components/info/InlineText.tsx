import { inlineTokens } from "@/lib/changelog";

/** Changelog text with its **bold**, `code` and links, rendered as elements (never HTML). */
export function InlineText({ text }: { text: string }) {
  return (
    <>
      {inlineTokens(text).map((token, index) => {
        if (token.type === "strong")
          return (
            <strong key={index} className="font-semibold text-foreground">
              {token.value}
            </strong>
          );
        if (token.type === "code")
          return (
            <code key={index} className="rounded bg-stone-100 px-1 py-0.5 font-mono text-[0.85em]">
              {token.value}
            </code>
          );
        if (token.type === "link") {
          const external = /^https?:/.test(token.href);
          return (
            <a
              key={index}
              href={token.href}
              {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              className="rounded-sm text-accent underline decoration-accent/40 underline-offset-4 hover:decoration-accent"
            >
              {token.value}
            </a>
          );
        }
        return <span key={index}>{token.value}</span>;
      })}
    </>
  );
}
