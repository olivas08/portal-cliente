import { test, expect } from "@playwright/test";

test.describe("Esqueci-me da password", () => {
  test("mostra confirmação genérica após submeter o email", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("link", { name: /Esqueceu-se da password/ }).click();
    await expect(page).toHaveURL(/\/esqueci-password/);

    await page.getByPlaceholder("o.seu@email.pt").fill("compras@motapecas.pt");
    await page.getByRole("button", { name: /Enviar link de reposição/ }).click();

    await expect(page.getByText(/receberá em breve um email/)).toBeVisible();
  });

  test("mostra a mesma confirmação mesmo para email inexistente (sem leak)", async ({
    page,
  }) => {
    await page.goto("/esqueci-password");
    await page.getByPlaceholder("o.seu@email.pt").fill("ninguem@inexistente.pt");
    await page.getByRole("button", { name: /Enviar link de reposição/ }).click();

    await expect(page.getByText(/receberá em breve um email/)).toBeVisible();
  });

  test("link de reposição inválido mostra mensagem de erro", async ({ page }) => {
    await page.goto("/reset-password?token=token-invalido-e2e");
    await page.getByPlaceholder("Mínimo 6 caracteres").fill("novapassword1");
    await page.getByPlaceholder("Repita a palavra-passe").fill("novapassword1");
    await page.getByRole("button", { name: "Repor palavra-passe" }).click();

    await expect(page.getByText(/inválido ou já expirou/)).toBeVisible();
  });
});
