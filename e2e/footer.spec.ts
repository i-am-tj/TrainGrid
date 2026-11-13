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
