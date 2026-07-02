import { test, expect } from "@playwright/test";
import { ACCOUNTS, login } from "./helpers";

test.describe("Isolamento de dados entre clientes", () => {
  test("a Mota vê apenas as suas 2 encomendas", async ({ page }) => {
    await login(page, ACCOUNTS.mota, "/dashboard");

    // Total de encomendas = 2
    await expect(page.getByText("Total Encomendas")).toBeVisible();

    // Vê as suas referências
    await expect(page.getByText("ENC-2026-041")).toBeVisible();
    await expect(page.getByText("ENC-2026-058")).toBeVisible();

    // NÃO vê encomendas de outras empresas
    await expect(page.getByText("ENC-2026-052")).toHaveCount(0); // Santos
    await expect(page.getByText("ENC-2026-044")).toHaveCount(0); // Norte
  });

  test("o admin vê encomendas de todas as empresas", async ({ page }) => {
    await login(page, ACCOUNTS.admin, "/admin");
    await expect(page.getByText("ENC-2026-041")).toBeVisible(); // Mota
    await expect(page.getByText("ENC-2026-052")).toBeVisible(); // Santos
    await expect(page.getByText("ENC-2026-044")).toBeVisible(); // Norte
  });
});
