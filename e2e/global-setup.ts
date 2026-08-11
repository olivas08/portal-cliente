import { execSync } from "node:child_process";

/**
 * Re-seeds the database before the E2E run so tests start from a known state.
 * The dataset is demo-only, so a destructive reseed is safe here.
 */
export default async function globalSetup() {
  console.log("🌱 A re-semear a base de dados para os testes E2E...");
  execSync("npx prisma db seed", { stdio: "inherit" });

  // The reseed above bypasses the app (raw Prisma), so any `unstable_cache`
  // entries (revalidate: false — see src/lib/data.ts) on an already-running
  // dev server (reuseExistingServer: true locally) are now stale. Flush them
  // via the test-only route so tests see the freshly seeded data. The dev
  // server may still be starting up (webServer boot happens independently of
  // globalSetup), so retry for a bit instead of failing on the first miss.
  await flushCacheWithRetry();
}

async function flushCacheWithRetry() {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch("http://localhost:3000/api/test/revalidate-all", {
        method: "POST",
      });
      if (res.ok) {
        console.log("🧹 Cache de dados invalidada para os testes E2E.");
        return;
      }
    } catch {
      // Server not up yet — retry.
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  console.warn(
    "⚠️  Não foi possível invalidar a cache antes dos testes E2E (o servidor não respondeu a tempo)."
  );
}
