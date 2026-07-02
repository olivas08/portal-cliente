import { test, expect } from "@playwright/test";
import { ACCOUNTS, login } from "./helpers";

test.describe("Autenticação e proteção de rotas", () => {
  test("redireciona utilizador não autenticado de /dashboard para /login", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });

  test("redireciona utilizador não autenticado de /admin para /login", async ({
    page,
  }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login/);
  });

  test("admin entra e é encaminhado para /admin", async ({ page }) => {
    await login(page, ACCOUNTS.admin, "/admin");
    await expect(page).toHaveURL(/\/admin$/);
  });

  test("cliente entra e é encaminhado para /dashboard", async ({ page }) => {
    await login(page, ACCOUNTS.mota, "/dashboard");
    await expect(
      page.getByRole("heading", { name: /Bem-vindo/ })
    ).toBeVisible();
  });

  test("credenciais inválidas mostram erro", async ({ page }) => {
    await page.goto("/login");
    await page.locator('input[type="email"]').fill("compras@motapecas.pt");
    await page.locator('input[type="password"]').fill("errada");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByText("Email ou palavra-passe incorretos.")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("cliente autenticado que abre /admin é reencaminhado para /dashboard", async ({
    page,
  }) => {
    await login(page, ACCOUNTS.mota, "/dashboard");
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/dashboard/);
  });
});
