// Runs before `next build` (see package.json "build").
//
// 1. Database migrations only for the production build (or a local build,
//    where VERCEL_ENV is unset). Preview deployments share the env vars of
//    the Neon integration, so without this guard any pushed branch would
//    migrate the production database with unreviewed changes.
// 2. The ffmpeg binary that voice notes go through is downloaded by
//    ffmpeg-static's install script from GitHub Releases with no checksum;
//    a swapped binary would run inside our functions on user audio. Its
//    SHA-256 is pinned here and a mismatch stops the deploy.
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

// ffmpeg-static 5.3.0, release b6.1.1, linux-x64 (Vercel's build image).
const FFMPEG_SHA256 = {
  "linux-x64": "e7e7fb30477f717e6f55f9180a70386c62677ef8a4d4d1a5d948f4098aa3eb99",
};

const env = process.env.VERCEL_ENV;

if (!env || env === "production") {
  console.log(`[prebuild] prisma migrate deploy (${env ?? "local"})`);
  execSync("npx --no-install prisma migrate deploy", { stdio: "inherit" });
} else {
  console.log(`[prebuild] skipping migrations on a ${env} build`);
}

const key = `${process.platform}-${process.arch}`;
const expected = FFMPEG_SHA256[key];
const binary = require("ffmpeg-static");
if (expected && binary && existsSync(binary)) {
  const actual = createHash("sha256").update(readFileSync(binary)).digest("hex");
  if (actual !== expected) {
    console.error(`[prebuild] ffmpeg binary checksum mismatch (${key}): expected ${expected}, got ${actual}`);
    if (process.env.VERCEL) process.exit(1);
  } else {
    console.log("[prebuild] ffmpeg binary checksum OK");
  }
} else if (process.env.VERCEL) {
  console.error(`[prebuild] ffmpeg binary missing or no pinned checksum for ${key}`);
  process.exit(1);
}
