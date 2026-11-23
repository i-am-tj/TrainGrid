import { createRequire } from "node:module";
import path from "node:path";
import type { Page } from "@playwright/test";

const resolve = createRequire(path.resolve("package.json")).resolve;

/** Test-only injection. The engine is never imported by production application code. */
export async function accessibilityResults(page: Page, email = false) {
  await page.addScriptTag({ path: resolve("axe-core/axe.min.js") });
  await page.evaluate(() => document.fonts.ready);
  // A dialog fading in is translucent until its transition ends, and axe would
  // measure that half-faded contrast. Transitions are finite; animations such
  // as loaders may loop forever and are left alone.
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((animation) => animation instanceof CSSTransition)
        .map((animation) => animation.finished.catch(() => undefined)),
    ),
  );
  return page.evaluate(async (isEmail) => {
    const axe = (window as typeof window & { axe: typeof import("axe-core") })
      .axe;
    const results = await axe.run(document, {
      runOnly: {
        type: "tag",
        values: [
          "wcag2a",
          "wcag2aa",
          "wcag21aa",
          "wcag22aa",
          ...(!isEmail ? ["best-practice"] : []),
        ],
      },
      resultTypes: ["violations", "incomplete"],
    });
    return {
      violations: results.violations.map((item) => ({
        id: item.id,
        impact: item.impact,
        help: item.help,
        nodes: item.nodes.map((node) => ({
          target: node.target,
          summary: node.failureSummary,
        })),
      })),
      incomplete: results.incomplete.map((item) => ({
        id: item.id,
        help: item.help,
        targets: item.nodes.map((node) => node.target),
      })),
    };
  }, email);
}
