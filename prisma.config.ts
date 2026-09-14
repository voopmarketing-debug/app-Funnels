import { defineConfig } from "prisma/config";

// prisma.config.ts is loaded standalone by the CLI (no automatic .env loading),
// so we load it ourselves before reading env vars below.
try {
  process.loadEnvFile();
} catch {
  // no .env file present (e.g. in CI where vars are injected directly)
}

// `migrate deploy` needs a DIRECT connection: it holds a postgres advisory
// lock for the duration of the migration, which requires a stable session.
// Neon's default connection string (and most managed-Postgres poolers) runs
// through pgbouncer in transaction-pooling mode, where each statement can
// land on a different backend connection — the lock never resolves as
// expected and `migrate deploy` fails with P1002 ("Timed out trying to
// acquire a postgres advisory lock"), even though the DB is reachable.
// Set DIRECT_URL to the provider's direct/unpooled connection string to fix
// this (in Neon: dashboard > Connection Details > turn off "Pooled
// connection"); DATABASE_URL can stay pooled for the running app. Falls
// back to DATABASE_URL when DIRECT_URL isn't set, so this is a no-op for
// setups (like local Postgres) that don't pool at all.
const migrationDatabaseUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!migrationDatabaseUrl) {
  throw new Error("Set DATABASE_URL (or DIRECT_URL) before running Prisma CLI commands.");
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: migrationDatabaseUrl,
  },
});
