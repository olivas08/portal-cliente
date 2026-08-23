import { test, expect } from "@playwright/test";
import { ACCOUNTS, login } from "./helpers";

test.describe("Armazém", () => {
  test("admin lança ordem, cria material e regista entrada de stock", async ({
    page,
  }) => {
    // Releasing a work order into production requires the "producao" area
    // (releaseWorkOrder in src/actions/production.ts), even though the
    // button lives on the Armazém page — the super-admin covers both areas
    // in one session, same as the material actions below ("armazem").
    await login(page, ACCOUNTS.admin, "/admin");
    await page.goto("/admin/armazem");

    // 1) Lançar ordem de fabrico com materiais suficientes.
    const awaitingCard = page
      .locator("div.rounded-xl", { hasText: "OF-2026-004" })
      .first();
    await expect(awaitingCard).toBeVisible();
    await awaitingCard.getByRole("button", { name: "Confirmar e lançar" }).click();
    await expect(
      page.getByText("Ordem OF-2026-004 lançada para produção.")
    ).toBeVisible();

    // 2) Criar um novo material.
    const materialRef = `MAT-E2E-${Date.now()}`;
    await page.getByRole("button", { name: "Novo material" }).click();
    await page.getByPlaceholder("MAT-001").fill(materialRef);
    await page.getByPlaceholder("Chapa de aço 2mm").fill("Material de teste E2E");
    await page.getByRole("button", { name: "Criar" }).click();
    await expect(page.getByText("Material criado.")).toBeVisible();

    const materialRow = page.locator("tr", { hasText: materialRef });
    await expect(materialRow).toBeVisible();

    // 3) Registar uma entrada de stock para o material criado.
    await materialRow.getByRole("button", { name: "Receber" }).click();
    await materialRow.locator('input[type="number"]').fill("25");
    await materialRow.getByRole("button", { name: "Registar" }).click();
    await expect(page.getByText("Entrada de stock registada.")).toBeVisible();

    const movementRow = page
      .locator("tr", { hasText: materialRef })
      .filter({ hasText: "Entrada" });
    await expect(movementRow).toBeVisible();
  });
});
