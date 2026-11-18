/**
 * Generates the install icons from the TrainGrid mark (BrandLogo's drawing):
 *
 *   public/icons/icon-192.png, icon-512.png   rounded, transparent corners ("any")
 *   public/icons/maskable-512.png              full bleed, mark inside the 80 % safe zone
 *   app/apple-icon.png                         180 × 180, full bleed (iOS rounds it)
 *
 * Run: node --import tsx scripts/generate-app-icons.ts
 */
import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";

const INK = "#1c1917";
const PAPER = "#fffcf7";
const AMBER = "#f59e0b";

/** The 3 × 3 week grid with its rising diagonal, in a 32-unit box. */
function cells(scale: number, offset: number): string {
  const tones: Record<string, [string, number]> = {
    "2,0": [AMBER, 1],
    "1,1": [PAPER, 1],
    "0,2": [PAPER, 1],
  };
  const out: string[] = [];
  for (let y = 0; y < 3; y++) {
    for (let x = 0; x < 3; x++) {
      const [fill, opacity] = tones[`${x},${y}`] ?? [PAPER, 0.22];
      const size = 6 * scale;
      out.push(
        `<rect x="${offset + (5 + x * 8) * scale}" y="${offset + (5 + y * 8) * scale}" width="${size}" height="${size}" rx="${1.5 * scale}" fill="${fill}" fill-opacity="${opacity}"/>`,
      );
    }
  }
  return out.join("");
}

function svg(size: number, { radius, inset }: { radius: number; inset: number }): Buffer {
  // `inset` shrinks the grid towards the centre (maskable safe zone).
  const scale = (size * (1 - inset * 2)) / 32;
  const offset = size * inset;
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
      `<rect width="${size}" height="${size}" rx="${radius}" fill="${INK}"/>${cells(scale, offset)}</svg>`,
  );
}

async function png(source: Buffer, file: string) {
  await writeFile(file, await sharp(source).png({ compressionLevel: 9, palette: true }).toBuffer());
  console.log(`wrote ${file}`);
}

async function main() {
  await mkdir("public/icons", { recursive: true });
  await png(svg(192, { radius: 192 * 0.22, inset: 0 }), "public/icons/icon-192.png");
  await png(svg(512, { radius: 512 * 0.22, inset: 0 }), "public/icons/icon-512.png");
  await png(svg(512, { radius: 0, inset: 0.12 }), "public/icons/maskable-512.png");
  await png(svg(180, { radius: 0, inset: 0 }), "app/apple-icon.png");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
