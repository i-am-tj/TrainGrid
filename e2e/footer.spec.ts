import { expect, test } from "@playwright/test";

test("the footer shows the social links, monogram and credit on every page", async ({ page }) => {
  await page.goto("/login");
  const footer = page.getByRole("contentinfo");

  await expect(footer.getByText("Find me on")).toBeVisible();
  for (const [name, href] of [
    ["X", "https://x.com/_i_am_tj_"],
    ["GitHub", "https://github.com/i-am-tj"],
    ["LinkedIn", "https://www.linkedin.com/in/i-am-tj/"],
    ["Medium", "https://medium.com/@i-am-tj"],
  ]) {
    const link = footer.getByRole("link", { name, exact: true });
    await expect(link).toHaveAttribute("href", href);
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", "noopener noreferrer");
  }
  await expect(footer.getByRole("link", { name: /iamtj\.dev/ })).toHaveAttribute("href", "https://iamtj.dev");
  await expect(footer).toContainText(`Made with ❤️ by Tanuj Chakraborty © ${new Date().getFullYear()}`);
});

// The "TJ" ring, as on iamtj.dev: a soft hairline that warms to the copper
// accent on hover, never black.
for (const [scheme, accent, hairline] of [
  ["light", "rgb(154, 78, 36)", "rgba(28, 22, 18, 0.14)"],
  ["dark", "rgb(224, 163, 122)", "rgba(244, 239, 232, 0.14)"],
] as const) {
  test(`the TJ ring glows copper on hover (${scheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
    await page.goto("/login");
    const ring = page.getByTestId("monogram");
    await expect(ring).toHaveCSS("border-top-color", hairline);

    await ring.hover();
    await expect(ring).toHaveCSS("border-top-color", accent);
    await expect(ring).toHaveCSS("color", accent);

    // Keyboard focus shows the same accent.
    await page.mouse.move(0, 0);
    await page.getByRole("contentinfo").getByRole("link", { name: /iamtj\.dev/ }).focus();
    await expect(ring).toHaveCSS("border-top-color", accent);
  });
}

test("the TJ ring fades like iamtj.dev's (300 ms colour transition)", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByTestId("monogram")).toHaveCSS("transition-duration", "0.3s");
});
