import { test, expect } from "@playwright/test";
import { ACCOUNTS, login } from "./helpers";

// One login per role, reused for both the "own area" / "blocked area" check
// and the shared /admin/kpis check — keeps this file's login-rate-limit
// footprint low (see src/lib/rate-limit.ts) instead of logging in twice per role.
test.describe("RBAC por área admin", () => {
  test("gestor de armazém: acede a Armazém e a KPIs, é bloqueado de Orçamentos", async ({
    page,
  }) => {
    await login(page, ACCOUNTS.armazem, "/admin/armazem");
    await page.goto("/admin/orcamentos");
    await expect(page).toHaveURL(/\/admin\/armazem$/);
    await page.goto("/admin/kpis");
    await expect(page).toHaveURL(/\/admin\/kpis$/);
  });

  test("comercial: acede a Orçamentos e a KPIs, é bloqueado de Armazém", async ({
    page,
  }) => {
    await login(page, ACCOUNTS.comercial, "/admin/orcamentos");
    await page.goto("/admin/armazem");
    await expect(page).toHaveURL(/\/admin\/orcamentos$/);
    await page.goto("/admin/kpis");
    await expect(page).toHaveURL(/\/admin\/kpis$/);
  });

  test("qualidade: acede a Qualidade e a KPIs, é bloqueado de Armazém", async ({
    page,
  }) => {
    await login(page, ACCOUNTS.qualidade, "/admin/producao/qualidade");
    await page.goto("/admin/armazem");
    await expect(page).toHaveURL(/\/admin\/producao\/qualidade$/);
    await page.goto("/admin/kpis");
    await expect(page).toHaveURL(/\/admin\/kpis$/);
  });

  test("produção: acede ao quadro de produção e a KPIs, é bloqueado de Armazém", async ({
    page,
  }) => {
    await login(page, ACCOUNTS.producao, /\/admin$/);
    await page.goto("/admin/armazem");
    await expect(page).toHaveURL(/\/admin$/);
    await page.goto("/admin/kpis");
    await expect(page).toHaveURL(/\/admin\/kpis$/);
  });
});
