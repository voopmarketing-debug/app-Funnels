import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient() {
  // Caps how many real Postgres connections THIS ONE server instance opens.
  // pg's own default (10) is fine for a single long-running server, but
  // Vercel can run many concurrent instances of this app under load — each
  // with its own independent pool — so an uncapped/high per-instance max
  // multiplies with instance count and can exhaust the database's real
  // connection limit well before 1000 businesses' worth of traffic. This
  // assumes DATABASE_URL is the provider's POOLED connection string (see
  // .env.example / prisma.config.ts) so a pooler (e.g. Neon's PgBouncer)
  // multiplexes these into far fewer actual backend connections.
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
    max: Number(process.env.DATABASE_POOL_MAX) || 5,
  });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
