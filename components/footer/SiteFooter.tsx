import { GitHubIcon, LinkedInIcon, MediumIcon, XIcon } from "./SocialIcons";

/**
 * Site footer, modelled on iamtj.dev: social links on the left, the "TJ"
 * monogram (linking to iamtj.dev) in the middle, the credit on the right.
 * Typography and sizing follow the app header: Geist, 14px text, 28-32px
 * controls with the header's hover pill, and the same container and height.
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
      {/* Same container, gutters and height as the header. */}
      <div className="mx-auto grid max-w-7xl grid-cols-1 items-center justify-items-center gap-2 px-3 py-3 sm:px-4 md:grid-cols-[1fr_auto_1fr] md:gap-3">
        <nav
          aria-labelledby="footer-find-me"
          className="flex items-center gap-1.5 md:justify-self-start"
        >
          <p id="footer-find-me" className="whitespace-nowrap text-sm text-stone-600">
            <span className="underline-reveal">Find me on</span>
          </p>
          <ul className="flex items-center">
            {SOCIAL_LINKS.map(({ name, href, Icon }) => (
              <li key={name} className="flex">
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={name}
                  className="inline-flex size-7 items-center justify-center rounded-md text-stone-600 hover:bg-stone-100 hover:text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900"
                >
                  <Icon />
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
            className="inline-flex size-7 items-center justify-center rounded-full border border-line text-xs font-semibold tracking-tight text-stone-900 group-hover:border-stone-400"
          >
            TJ
          </span>
        </a>

        <p className="credit-underline text-center text-sm text-stone-600 md:justify-self-end md:text-right">
          <span className="underline-reveal">Made with</span>{" "}
          <span className="relative -top-px inline-block text-[0.8em]" role="img" aria-label="love">
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
