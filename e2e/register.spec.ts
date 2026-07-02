import { test, expect } from "@playwright/test";

test.describe("Registo de novos clientes", () => {
  test("empresa regista-se e entra automaticamente no dashboard", async ({
    page,
  }) => {
    const stamp = Date.now();
    const email = `e2e-${stamp}@empresa-teste.pt`;

    await page.goto("/login");
    await page.getByRole("link", { name: /Registar a minha empresa/ }).click();
    await expect(page).toHaveURL(/\/registo/);

    await page.getByPlaceholder("Ex: Auto Peças Mota, Lda.").fill(`Empresa Teste ${stamp}`);
    await page.getByPlaceholder("Ex: Jorge Mota").fill("Utilizador Teste");
    await page.getByPlaceholder("o.seu@email.pt").fill(email);
    await page.getByPlaceholder("Mínimo 6 caracteres").fill("password123");
    await page.getByRole("button", { name: "Criar conta" }).click();

    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByText("Bem-vindo", { exact: false })).toBeVisible();
  });

  test("rejeita registo com email já existente", async ({ page }) => {
    await page.goto("/registo");
    await page.getByPlaceholder("Ex: Auto Peças Mota, Lda.").fill("Outra Empresa");
    await page.getByPlaceholder("Ex: Jorge Mota").fill("Alguém");
    await page.getByPlaceholder("o.seu@email.pt").fill("compras@motapecas.pt");
    await page.getByPlaceholder("Mínimo 6 caracteres").fill("password123");
    await page.getByRole("button", { name: "Criar conta" }).click();

    await expect(page.getByText(/Já existe uma conta/)).toBeVisible();
    await expect(page).toHaveURL(/\/registo/);
  });
});
