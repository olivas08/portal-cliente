import { test, expect } from "@playwright/test";
import { ACCOUNTS, login } from "./helpers";

test.describe("Admin cria nova encomenda", () => {
  test("admin cria encomenda com artigos e é redirecionado para o detalhe", async ({
    page,
  }) => {
    await login(page, ACCOUNTS.admin, "/admin");

    await page.getByRole("button", { name: /Nova Encomenda/ }).click();
    await page.getByPlaceholder("Ex: LT-2026-090").fill(`LT-E2E-${Date.now()}`);
    await page.locator('input[type="date"]').fill("2026-12-31");
    await page.getByPlaceholder("Referência").fill("REF-E2E-1");
    await page.getByPlaceholder("Descrição").fill("Artigo de teste E2E");
    await page.getByPlaceholder("Qtd").fill("5");
    await page.getByPlaceholder("Un.").fill("un");
    await page.getByPlaceholder("Preço €").fill("10");
    await page.getByRole("button", { name: "Criar Encomenda" }).click();

    await expect(page).toHaveURL(/\/admin\/ordens\/.+/);
    await expect(
      page.getByRole("heading", { name: /^ENC-\d{4}-\d{3}$/ })
    ).toBeVisible();
    await expect(page.getByText("REF-E2E-1")).toBeVisible();
  });
});
