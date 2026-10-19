/**
 * Renders the PWA icons from src/app/icon.svg (run again if the logo changes):
 *
 *   pnpm icons
 *
 * Writes public/icons/: 192 and 512 px "any" icons, a 512 px maskable icon
 * (the star inside the safe zone on the brand background), and the 180 px
 * Apple touch icon.
 */
import { mkdir, readFile } from "node:fs/promises";

import sharp from "sharp";

const BACKGROUND = "#f7f8f3";
const svg = await readFile("src/app/icon.svg");
await mkdir("public/icons", { recursive: true });

/** The star at `scale` of the canvas, centred on the brand background. */
async function icon(size: number, scale: number, file: string) {
  const inner = Math.round(size * scale);
  const star = await sharp(svg, { density: 1200 }).resize(inner, inner).png().toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: BACKGROUND } })
    .composite([{ input: star, gravity: "center" }])
    .png({ compressionLevel: 9 })
    .toFile(`public/icons/${file}`);
  console.log(`✓ public/icons/${file}`);
}

await icon(192, 0.86, "icon-192.png");
await icon(512, 0.86, "icon-512.png");
// Maskable icons are cropped to a circle or squircle: keep the star inside the 80% safe zone.
await icon(512, 0.62, "icon-maskable-512.png");
await icon(180, 0.8, "apple-touch-icon.png");
