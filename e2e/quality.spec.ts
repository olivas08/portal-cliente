import { test, expect } from "@playwright/test";
import { ACCOUNTS, login, operatorLogin } from "./helpers";

test.describe("Não conformidade: registo no terminal → resolução em Qualidade", () => {
  test("operador regista não conforme ao concluir um passo, e a qualidade reprocessa-a", async ({
    browser,
  }) => {
    const reason = `Defeito E2E ${Date.now()} — rebarba fora de tolerância`;

    const operatorCtx = await browser.newContext();
    const operatorPage = await operatorCtx.newPage();
    await operatorLogin(operatorPage, "Miguel Costa", "2345");

    await operatorPage.getByRole("link", { name: /Maquinação CNC/ }).click();
    const card = operatorPage
      .locator("div.rounded-xl", { hasText: "Chumaceira Rolamento SKF 6205-ZZ" })
      .first();
    await expect(card).toBeVisible();

    const start = card.getByRole("button", { name: "Iniciar" });
    if (await start.isVisible()) await start.click();
    await card.getByRole("button", { name: "Concluir" }).click();
    await card.getByRole("button", { name: "Registar não conforme" }).click();
    await card.getByLabel("Qtd. não conforme").fill("2");
    await card.getByLabel("Motivo").fill(reason);
    await card.getByRole("button", { name: "Confirmar conclusão" }).click();

    await expect(card).toHaveCount(0);
    await operatorCtx.close();

    const qualityCtx = await browser.newContext();
    const qualityPage = await qualityCtx.newPage();
    await login(
      qualityPage,
      ACCOUNTS.qualidade,
      "/admin/producao/qualidade"
    );

    const ncRow = qualityPage.locator("div.rounded-lg", { hasText: reason });
    await expect(ncRow).toBeVisible();
    await ncRow.getByRole("button", { name: "Reprocessar" }).click();

    await expect(ncRow).toHaveCount(0);
    await expect(qualityPage.getByText(reason)).toHaveCount(0);
    await qualityCtx.close();
  });
});
