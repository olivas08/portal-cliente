import { test, expect } from "@playwright/test";
import { ACCOUNTS, login } from "./helpers";

test.describe("Orçamento → encomenda", () => {
  test("admin cria e envia orçamento, cliente aceita e a encomenda é gerada", async ({
    browser,
  }) => {
    const subject = `Orçamento E2E ${Date.now()}`;

    // Admin cria o rascunho e envia ao cliente.
    const adminCtx = await browser.newContext();
    const adminPage = await adminCtx.newPage();
    await login(adminPage, ACCOUNTS.admin, "/admin");

    await adminPage.goto("/admin/orcamentos/novo");
    await adminPage.getByPlaceholder(/Ex: Estrutura em inox/).fill(subject);
    await adminPage
      .getByPlaceholder(/Ex: Painel lateral inox/)
      .fill("Peça de teste E2E");
    await adminPage.getByRole("button", { name: "Criar rascunho" }).click();

    await expect(adminPage).toHaveURL(/\/admin\/orcamentos\/[^/]+$/);
    await expect(adminPage.getByRole("heading", { name: subject })).toBeVisible();

    const quoteId = adminPage.url().split("/").pop()!;

    await adminPage.getByRole("button", { name: "Enviar ao cliente" }).click();
    await expect(adminPage.getByText("Enviado")).toBeVisible();
    await adminCtx.close();

    // O cliente (Auto Peças Mota, primeira empresa criada / cliente por
    // omissão do QuoteBuilder) vê o orçamento enviado e aceita-o.
    const motaCtx = await browser.newContext();
    const motaPage = await motaCtx.newPage();
    await login(motaPage, ACCOUNTS.mota, "/dashboard");

    await motaPage.goto(`/dashboard/orcamentos/${quoteId}`);
    await expect(motaPage.getByRole("heading", { name: subject })).toBeVisible();
    await motaPage.getByRole("button", { name: "Aceitar orçamento" }).click();

    const generatedOrderLink = motaPage.getByRole("link", {
      name: /Orçamento aceite/,
    });
    await expect(generatedOrderLink).toBeVisible();
    const orderHref = await generatedOrderLink.getAttribute("href");
    expect(orderHref).toMatch(/\/dashboard\/ordens\/.+/);

    await generatedOrderLink.click();
    await expect(motaPage).toHaveURL(/\/dashboard\/ordens\/.+/);
    await motaCtx.close();
  });
});
