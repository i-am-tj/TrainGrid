import { GitHubIcon, LinkedInIcon, MediumIcon, XIcon } from "./SocialIcons";

/**
 * Site footer, modelled on iamtj.dev: social links on the left, the "TJ"
 * monogram (linking to iamtj.dev) in the middle, the credit on the right.
 * Stacks and centres on narrow screens. Static content only.
 */

const AUTHOR = "Tanuj Chakraborty";
const SITE = "https://iamtj.dev";

const SOCIAL_LINKS = [
  { name: "X", href: "https://x.com/_i_am_tj_", Icon: XIcon },
  { name: "GitHub", href: "https://github.com/i-am-tj", Icon: GitHubIcon },
  { name: "LinkedIn", href: "https://www.linkedin.com/in/i-am-tj/", Icon: LinkedInIcon },
  { name: "Medium", href: "https://medium.com/@i-am-tj", Icon: MediumIcon },
] as const;

export function SiteFooter() {
  return (
    <footer className="w-full border-t border-line bg-card">
      <div className="mx-auto grid max-w-7xl grid-cols-1 items-center justify-items-center gap-3 px-3 py-6 sm:px-4 md:grid-cols-[1fr_auto_1fr] md:gap-6 md:py-5">
        <nav
          aria-labelledby="footer-find-me"
          className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 md:justify-self-start"
        >
          <p id="footer-find-me" className="whitespace-nowrap text-xs text-stone-500 md:text-sm">
            <span className="underline-reveal">Find me on</span>
          </p>
          <ul className="flex items-center gap-0.5 md:gap-1">
            {SOCIAL_LINKS.map(({ name, href, Icon }) => (
              <li key={name}>
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={name}
                  className="group inline-flex size-11 items-center justify-center rounded-full text-stone-500 transition-colors duration-300 hover:text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900"
                >
                  <span className="inline-flex transition-transform duration-500 ease-out group-hover:-translate-y-0.5">
                    <Icon />
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <a
          href={SITE}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${AUTHOR} (TJ), iamtj.dev`}
          className="group rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900"
        >
          <span
            aria-hidden="true"
            className="inline-flex size-9 items-center justify-center rounded-full border border-line font-serif text-[1.0625rem] italic leading-none tracking-tight text-stone-900 transition-colors duration-300 group-hover:border-stone-900"
          >
            <span className="-translate-x-px">TJ</span>
          </span>
        </a>

        <p className="credit-underline text-center text-xs leading-relaxed text-stone-500 md:justify-self-end md:text-right md:text-sm">
          <span className="underline-reveal">Made with</span>{" "}
          <span className="relative -top-px mx-0.5 inline-block text-[0.8em]" role="img" aria-label="love">
            ❤️
          </span>{" "}
          <span className="underline-reveal">
            by {AUTHOR} &copy; {new Date().getFullYear()}
          </span>
        </p>
      </div>
    </footer>
  );
}
