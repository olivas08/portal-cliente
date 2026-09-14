import path from "node:path";
import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

// Prisma 6 skips auto-loading `.env` when this config file exists.
loadEnv({ path: path.resolve(process.cwd(), ".env") });

// Migrations need a direct (non-pooled) connection. Local Postgres can use
// the same URL as DATABASE_URL; Supabase should set DIRECT_URL to port 5432.
if (!process.env.DIRECT_URL && process.env.DATABASE_URL) {
  process.env.DIRECT_URL = process.env.DATABASE_URL;
}

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    path: path.join("prisma", "migrations"),
    seed: "tsx prisma/seed.ts",
  },
});
