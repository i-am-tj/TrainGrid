/** Static component QA harness. No Next route, auth bypass, database access or deployment. */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { renderToStaticMarkup } from "react-dom/server";
import { LandingPage } from "../components/marketing/LandingPage";
import { PublicHeader } from "../components/marketing/PublicHeader";
import { SiteFooter } from "../components/footer/SiteFooter";

async function main() {
  const directory = path.resolve(".next/ui-preview");
  await mkdir(directory, { recursive: true });
  const css = await postcss([tailwind()]).process(
    await readFile("app/globals.css", "utf8"),
    { from: path.resolve("app/globals.css") },
  );
  await writeFile(path.join(directory, "styles.css"), css.css);
  const markup = renderToStaticMarkup(
    <>
      <PublicHeader />
      <main>
        <LandingPage />
      </main>
      <SiteFooter />
    </>,
  );
  await writeFile(
    path.join(directory, "index.html"),
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>TrainGrid — component preview</title><link rel="stylesheet" href="/styles.css"></head><body>${markup}</body></html>`,
  );
  console.log(
    "Static UI preview prepared in .next/ui-preview (not an application route).",
  );
}
main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
