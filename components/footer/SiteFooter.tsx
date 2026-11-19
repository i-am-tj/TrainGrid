import { GitHubIcon, LinkedInIcon, MediumIcon, XIcon } from "./SocialIcons";

/**
 * Site footer, modelled on iamtj.dev: author credit on the left, the "TJ"
 * monogram (linking to iamtj.dev) in the middle, the social links on the right.
 * Typography and sizing follow the app header (Geist, 14px text, 40px
 * controls with the header's hover pill, same container and height), except
 * the monogram, which keeps iamtj.dev's Instrument Serif italic ring.
 * Stacks and centres on narrow screens. Static content only.
 */

const AUTHOR = "Tanuj Chakraborty";
const SITE = "https://iamtj.dev";

const SOCIAL_LINKS = [
  { name: "GitHub", href: "https://github.com/i-am-tj", Icon: GitHubIcon },
  { name: "LinkedIn", href: "https://www.linkedin.com/in/i-am-tj/", Icon: LinkedInIcon },
  { name: "X", href: "https://x.com/_i_am_tj_", Icon: XIcon },
  { name: "Medium", href: "https://medium.com/@i-am-tj", Icon: MediumIcon },
] as const;

export function SiteFooter() {
  return (
    <footer className="w-full border-t border-line bg-card">
      {/* Same container, gutters and height as the header. */}
      <div className="mx-auto grid max-w-7xl grid-cols-1 items-center justify-items-center gap-2 px-3 py-3 sm:px-4 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:gap-3 md:py-2">
        <p className="credit-underline text-center text-sm text-stone-600 md:justify-self-start md:text-left">
          <span className="underline-reveal">Made with</span>{" "}
          <span className="relative -top-px inline-block text-[0.8em]" role="img" aria-label="love">
            ❤️
          </span>{" "}
          <span className="underline-reveal">
            by {AUTHOR} &copy; {new Date().getFullYear()}
          </span>
        </p>

        <a
          href={SITE}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${AUTHOR} (TJ), iamtj.dev`}
          className="group rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900"
        >
          {/*
            The iamtj.dev monogram, as it is there: Instrument Serif italic in a
            soft hairline ring that warms to the copper accent on hover or focus
            (#9a4e24, or #e0a37a in dark mode).
          */}
          <span
            aria-hidden="true"
            data-testid="monogram"
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-hairline font-display text-[1.0625rem] italic leading-none tracking-tight text-foreground transition-colors duration-300 group-hover:border-accent group-hover:text-accent group-focus-visible:border-accent group-focus-visible:text-accent motion-reduce:transition-none"
          >
            <span className="-translate-x-px">TJ</span>
          </span>
        </a>

        <nav
          aria-labelledby="footer-find-me"
          className="flex min-w-0 max-w-full flex-wrap items-center justify-center gap-1.5 md:justify-self-end"
        >
          <p id="footer-find-me" className="whitespace-nowrap text-sm text-stone-600">
            <span className="underline-reveal">Follow me</span>
          </p>
          <ul className="flex min-w-0 flex-wrap items-center justify-center">
            {SOCIAL_LINKS.map(({ name, href, Icon }) => (
              <li key={name} className="flex">
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={name}
                  className="inline-flex size-10 items-center justify-center rounded-md text-stone-600 hover:bg-stone-100 hover:text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900"
                >
                  <Icon />
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
}
