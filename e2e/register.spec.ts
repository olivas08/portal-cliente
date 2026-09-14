import { test, expect } from "@playwright/test";

test.describe("Registo de novos clientes", () => {
  test("página de registo explica que o acesso é por convite", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByRole("link", { name: /Pedir convite/ }).click();
    await expect(page).toHaveURL(/\/registo/);
    await expect(page.getByRole("heading", { name: /Registo por convite/ })).toBeVisible();
    await expect(page.getByText(/acesso ao portal é concedido pela fábrica/i)).toBeVisible();
    await expect(page.getByRole("button", { name: "Criar conta" })).toHaveCount(0);
  });

  test("não existe formulário de auto-registo", async ({ page }) => {
    await page.goto("/registo");
    await expect(page.getByPlaceholder("Ex: Auto Peças Mota, Lda.")).toHaveCount(0);
    await expect(page.getByRole("link", { name: /Já tem conta/ })).toBeVisible();
  });
});
