import { defineConfig, env } from "prisma/config";

// prisma.config.ts is loaded standalone by the CLI (no automatic .env loading),
// so we load it ourselves before reading DATABASE_URL below.
try {
  process.loadEnvFile();
} catch {
  // no .env file present (e.g. in CI where vars are injected directly)
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("DATABASE_URL"),
  },
});
