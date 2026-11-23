import { readFile } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { docImage } from "../helpers/doc-images";

test.beforeEach(async ({ page }) => {
  await page.route("http://ui-preview.test/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    const file =
      pathname.endsWith(".html") || pathname === "/styles.css"
        ? path.join(process.cwd(), ".next/ui-preview", pathname)
        : path.join(process.cwd(), "public", pathname);
    await route.fulfill({
      body: await readFile(file),
      contentType: pathname.endsWith(".css")
        ? "text/css"
        : pathname.endsWith(".svg")
          ? "image/svg+xml"
          : pathname.endsWith(".png")
            ? "image/png"
            : "text/html",
    });
  });
});
for (const width of [320, 360, 768, 1024, 1440]) {
  for (const dark of [false, true]) {
    test(`invitation and email variants fit ${width}px, dark=${dark}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      for (const name of [
        "invitations-ready",
        "invitations-empty",
        "invitation-email",
      ]) {
        await page.goto(`http://ui-preview.test/${name}.html`);
        if (name !== "invitation-email")
          await page.evaluate(
            (value) => document.documentElement.classList.toggle("dark", value),
            dark,
          );
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        if (name === "invitations-ready") {
          await expect(
            page.getByText("Pending", { exact: true }),
          ).toBeVisible();
          await expect(
            page.getByText("Revoked", { exact: true }),
          ).toBeVisible();
          await expect(
            page.getByText("Admin · Protected", { exact: true }),
          ).toBeVisible();
          for (const button of await page.getByRole("button").all())
            await expect(button).toBeDisabled();
        } else if (name === "invitations-empty")
          await expect(
            page.getByRole("heading", { name: "No invitations yet." }),
          ).toBeVisible();
        else {
          await expect(
            page.getByRole("heading", { name: "You’re invited to TrainGrid." }),
          ).toBeVisible();
          await expect(
            page.getByRole("link", { name: "Open TrainGrid" }),
          ).toHaveAttribute("href", "http://ui-preview.test/login");
          if (!dark && [360, 1440].includes(width)) {
            await docImage(page, `docs/images/epic-3/ui-03/email-${width}.png`, {
              fullPage: true,
            });
          }
        }
      }
    });
  }
}
