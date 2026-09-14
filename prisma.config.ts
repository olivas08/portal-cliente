import path from "node:path";
import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

// Prisma 6 skips auto-loading `.env` when this config file exists.
loadEnv({ path: path.resolve(process.cwd(), ".env") });

// Migrations cannot use transaction-mode PgBouncer (port 6543). Local
// Postgres can reuse DATABASE_URL. On Vercel + Supabase, DIRECT_URL must
// be the Session pooler (*.pooler.supabase.com:5432) — db.*.supabase.co
// is IPv6-only and migrate deploy fails with P1001 from the build.
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
