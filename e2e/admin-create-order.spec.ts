import { test, expect } from "@playwright/test";
import { ACCOUNTS, login } from "./helpers";

test.describe("Admin cria nova encomenda", () => {
  test("admin cria encomenda com artigos e é redirecionado para o detalhe", async ({
    page,
  }) => {
    await login(page, ACCOUNTS.admin, "/admin");

    await page.getByRole("button", { name: /Nova Encomenda/ }).click();
    const dialog = page.getByRole("dialog", { name: "Nova Encomenda" });
    await dialog.getByPlaceholder("Ex: LT-2026-090").fill(`LT-E2E-${Date.now()}`);
    await dialog.locator('input[type="date"]').fill("2026-12-31");
    await dialog.getByPlaceholder("Referência").fill("REF-E2E-1");
    await dialog.getByPlaceholder("Descrição").fill("Artigo de teste E2E");
    await dialog.getByPlaceholder("Qtd").fill("5");
    await dialog.getByPlaceholder("Un.").fill("un");
    await dialog.getByPlaceholder("Preço €").fill("10");
    await dialog.getByRole("button", { name: "Criar Encomenda" }).click();

    await expect(page).toHaveURL(/\/admin\/ordens\/.+/);
    await expect(
      page.getByRole("heading", { name: /^ENC-\d{4}-\d{3}$/ })
    ).toBeVisible();
    await expect(page.getByText("REF-E2E-1")).toBeVisible();
  });
});
