import { expect, test } from "@playwright/test";

/** Global header brand: logo, name and Beta badge. Runs signed out on the sign-in page. */

for (const [label, width] of [["desktop", 1280], ["phone", 360]] as const) {
  test(`the brand shows the logo, the name and a Beta badge (${label})`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/login");
    const banner = page.getByRole("banner");

    // The link is still just "TrainGrid"; the logo is decorative.
    const brand = banner.getByRole("link", { name: "TrainGrid", exact: true });
    await expect(brand).toBeVisible();
    await expect(brand.locator("svg")).toHaveAttribute("aria-hidden", "true");

    // Beta is plain text beside the link: visible, readable, not interactive.
    const beta = banner.getByText("Beta", { exact: true });
    await expect(beta).toBeVisible();
    expect(await beta.evaluate((el) => el.closest("a, button"))).toBeNull();
    await expect(banner.getByRole("link", { name: /beta/i })).toHaveCount(0);

    // Same line as the name, immediately after it.
    const b = (await brand.boundingBox())!;
    const t = (await beta.boundingBox())!;
    expect(Math.abs(t.y + t.height / 2 - (b.y + b.height / 2))).toBeLessThan(2);
    expect(t.x - (b.x + b.width)).toBeGreaterThanOrEqual(0);
    expect(t.x - (b.x + b.width)).toBeLessThan(12);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 4,
    );
    expect(overflow).toBe(false);
  });
}
