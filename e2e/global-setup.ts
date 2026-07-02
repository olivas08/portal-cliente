import { execSync } from "node:child_process";

/**
 * Re-seeds the database before the E2E run so tests start from a known state.
 * The dataset is demo-only, so a destructive reseed is safe here.
 */
export default async function globalSetup() {
  console.log("🌱 A re-semear a base de dados para os testes E2E...");
  execSync("npx prisma db seed", { stdio: "inherit" });
}
