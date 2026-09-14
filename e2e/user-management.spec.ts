import { test, expect } from "@playwright/test";
import { ACCOUNTS, login } from "./helpers";

test.describe("Gestão de utilizadores", () => {
  test("cliente convida um utilizador da empresa e consegue reativá-lo", async ({
    page,
  }) => {
    const name = `Utilizador E2E ${Date.now()}`;
    const email = `e2e-${Date.now()}@motapecas.pt`;

    await login(page, ACCOUNTS.mota, "/dashboard");
    await page.goto("/dashboard/utilizadores");

    await page.getByRole("button", { name: "Convidar Utilizador" }).click();
    await page.getByPlaceholder("Ex: Maria Costa").fill(name);
    await page.getByPlaceholder("Ex: maria@empresa.pt").fill(email);
    await page.getByRole("button", { name: "Enviar Convite" }).click();

    const userCard = page.locator("div.rounded-xl", { hasText: name }).first();
    await expect(userCard).toBeVisible();
    await expect(userCard.getByText(email)).toBeVisible();
    await expect(userCard.getByText("Convite pendente / inativo")).toBeVisible();

    await userCard.getByRole("button", { name: "Reativar" }).click();
    await expect(userCard.getByText("Ativo")).toBeVisible();
    await expect(userCard.getByRole("button", { name: "Desativar" })).toBeVisible();
  });

  test("admin de fábrica convida uma conta de área (Produção)", async ({
    page,
  }) => {
    const name = `Gestor E2E ${Date.now()}`;
    const email = `e2e-${Date.now()}@fabrica-demo.pt`;

    await login(page, ACCOUNTS.admin, "/admin");
    await page.goto("/admin/utilizadores");

    await page.getByRole("button", { name: "Convidar Utilizador" }).click();
    await page.getByPlaceholder("Ex: Maria Costa").fill(name);
    await page.getByPlaceholder("Ex: maria@empresa.pt").fill(email);
    await page.getByLabel("Função").selectOption({ label: "Produção" });
    await page.getByRole("button", { name: "Enviar Convite" }).click();

    const userCard = page.locator("div.rounded-xl", { hasText: name }).first();
    await expect(userCard).toBeVisible();
    await expect(userCard.getByText(email)).toBeVisible();
    await expect(userCard.getByText("Produção")).toBeVisible();
  });

  test("admin de fábrica cria um cliente e envia o convite", async ({ page }) => {
    const company = `Cliente E2E ${Date.now()}`;
    const name = `Contacto E2E ${Date.now()}`;
    const email = `e2e-client-${Date.now()}@exemplo.pt`;

    await login(page, ACCOUNTS.admin, "/admin");
    await page.goto("/admin/clientes", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Clientes" })).toBeVisible();

    await page.getByRole("button", { name: "Novo cliente" }).click();
    await page.getByPlaceholder("Ex: Metalúrgica Silva, Lda.").fill(company);
    await page.getByPlaceholder("Ex: Ana Silva").fill(name);
    await page.getByPlaceholder("Ex: ana@silva.pt").fill(email);
    await page.getByRole("button", { name: "Enviar convite" }).click();

    await expect(page.getByRole("heading", { name: company })).toBeVisible();
    await expect(page.getByText(email)).toBeVisible();
    await expect(page.getByText("Convite pendente")).toBeVisible();
  });
});
