import { test, expect } from "@playwright/test";
import { ACCOUNTS, login } from "./helpers";

test.describe("Fluxo de requerimentos", () => {
  test("cliente cria requerimento e o admin consegue vê-lo", async ({
    browser,
  }) => {
    const subject = `Orçamento E2E ${Date.now()}`;

    // Cliente cria o requerimento
    const motaCtx = await browser.newContext();
    const motaPage = await motaCtx.newPage();
    await login(motaPage, ACCOUNTS.mota, "/dashboard");
    await motaPage.goto("/dashboard/requerimentos");

    await motaPage.getByRole("button", { name: /Novo Requerimento/ }).click();
    await motaPage.locator('input[placeholder^="Ex:"]').fill(subject);
    await motaPage
      .locator("textarea")
      .fill("Pedido criado automaticamente pelos testes E2E.");
    await motaPage.getByRole("button", { name: "Enviar" }).click();

    // Redireciona para o detalhe e mostra o assunto no cabeçalho
    await expect(motaPage).toHaveURL(/\/dashboard\/requerimentos\/.+/);
    await expect(
      motaPage.getByRole("heading", { name: subject })
    ).toBeVisible();
    await motaCtx.close();

    // Admin vê o requerimento na sua lista
    const adminCtx = await browser.newContext();
    const adminPage = await adminCtx.newPage();
    await login(adminPage, ACCOUNTS.admin, "/admin");
    await adminPage.goto("/admin/requerimentos");
    await expect(adminPage.getByText(subject).first()).toBeVisible();
    await adminCtx.close();
  });
});
