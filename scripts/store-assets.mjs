// Generates the app icons for the stores from the brand mark (FunnelsLogoMark):
//   node scripts/store-assets.mjs
// Android launcher icons (classic + adaptive) go into android/app/src/main/res,
// the Play Store icon (512) and the App Store icon (1024, no transparency) into store/.
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const LIME = "#b5ff2b";
const DARK = "#0b0d08";
const RES = "android/app/src/main/res";

// The mark, drawn in a 64x64 box (same shapes as src/components/FunnelsLogoMark.tsx).
const markSvg = (size, color = LIME) => `
  <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">
    <rect x="6" y="6" width="52" height="9" rx="4.5" fill="none" stroke="${color}" stroke-width="3"/>
    <rect x="17" y="26" width="30" height="9" rx="4.5" fill="none" stroke="${color}" stroke-width="3"/>
    <circle cx="32" cy="50" r="7.5" fill="${color}"/>
  </svg>`;

async function tile({ size, markRatio, radiusRatio = 0, background = DARK, transparent = false }) {
  const markSize = Math.round(size * markRatio);
  const offset = Math.round((size - markSize) / 2);
  const bg = transparent
    ? `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"/>`
    : `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${Math.round(size * radiusRatio)}" fill="${background}"/></svg>`;
  return sharp(Buffer.from(bg))
    .composite([{ input: Buffer.from(markSvg(markSize)), left: offset, top: offset }])
    .png();
}

async function save(img, file) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, await img.toBuffer());
  console.log("✓", file);
}

// Classic launcher icons (Android before 8): dark rounded tile with the mark.
for (const [dir, px] of [["mdpi", 48], ["hdpi", 72], ["xhdpi", 96], ["xxhdpi", 144], ["xxxhdpi", 192]]) {
  await save(await tile({ size: px, markRatio: 0.62, radiusRatio: 0.22 }), `${RES}/mipmap-${dir}/ic_launcher.png`);
}
// Adaptive icon foreground: 108dp canvas at 4x; only the middle 66% is always visible, so the mark stays inside it.
await save(await tile({ size: 432, markRatio: 0.5, transparent: true }), `${RES}/drawable-nodpi/ic_launcher_foreground.png`);
// Play Store listing icon (the store rounds the corners itself).
await save(await tile({ size: 512, markRatio: 0.6 }), "store/play-icon-512.png");
// App Store icon: 1024, square, no transparency.
await save((await tile({ size: 1024, markRatio: 0.6 })).flatten({ background: DARK }).removeAlpha(), "store/ios-icon-1024.png");
