import { test, expect } from "@playwright/test";
import { operatorLogin } from "./helpers";

test.describe("Terminal de produção (login PIN + execução de passo)", () => {
  test("operador inicia e conclui um passo no posto Corte a Laser", async ({
    page,
  }) => {
    await operatorLogin(page, "João Ferreira", "1234");

    await page.getByRole("link", { name: /Corte a Laser/ }).click();
    await expect(page).toHaveURL(/\/producao\/terminal\?posto=.+/);
    await expect(
      page.getByText(/Retentor 35×55×8 NBR/)
    ).toBeVisible();

    const card = page
      .locator("div.rounded-xl", { hasText: "Retentor 35×55×8 NBR" })
      .first();
    await card.getByRole("button", { name: "Iniciar" }).click();
    await expect(card.getByRole("button", { name: "Concluir" })).toBeVisible();

    await card.getByRole("button", { name: "Concluir" }).click();
    await card.getByRole("button", { name: "Confirmar conclusão" }).click();

    await expect(
      page.getByText(/Retentor 35×55×8 NBR/)
    ).toHaveCount(0);
  });

  test("operador termina sessão através do botão Sair", async ({ page }) => {
    await operatorLogin(page, "Carla Sousa", "3456");
    await page.getByRole("button", { name: "Sair" }).click();
    await expect(
      page.getByRole("heading", { name: "Operon Station" })
    ).toBeVisible();
  });
});
