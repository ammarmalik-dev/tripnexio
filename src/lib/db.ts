import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

/**
 * Prisma 7 requires an explicit driver adapter — there's no more implicit
 * env-based connection at the client level (see prisma7.config.ts, which
 * only configures the CLI, not this runtime client).
 *
 * The `dotenv/config` import above is a no-op inside Next.js (which already
 * loads .env itself) but makes this module work standalone too — e.g. a
 * one-off script run directly via `tsx` outside the Prisma CLI or Next.js,
 * neither of which would otherwise populate process.env.DATABASE_URL.
 *
 * Cached on `globalThis` in development so Next.js's hot-reload doesn't
 * spin up a new pool (and exhaust Postgres connections) on every edit.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
