// Prisma 7 config file (CLI-only — connection URL and CLI paths). This does
// NOT affect the runtime PrismaClient, which takes its connection via the
// `adapter` passed in src/lib/db.ts. See https://pris.ly/d/prisma7-client-config.
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
