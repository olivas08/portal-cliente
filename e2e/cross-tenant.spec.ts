import { test, expect } from "@playwright/test";
import { ACCOUNTS, login } from "./helpers";

test.describe("Guarda cross-tenant nas encomendas", () => {
  test("um cliente não pode abrir a encomenda de outra empresa", async ({
    browser,
  }) => {
    // 1) Admin descobre o id de uma encomenda da Santos (ENC-2026-052)
    const adminCtx = await browser.newContext();
    const adminPage = await adminCtx.newPage();
    await login(adminPage, ACCOUNTS.admin, "/admin");
    const gerirLink = adminPage
      .locator("tr", { hasText: "ENC-2026-052" })
      .getByRole("link", { name: /Gerir/ });
    const href = await gerirLink.getAttribute("href");
    expect(href).toMatch(/\/admin\/ordens\/.+/);
    const santosOrderId = href!.split("/").pop()!;
    await adminCtx.close();

    // 2) A Mota tenta abrir essa encomenda no seu portal → é reencaminhada
    const motaCtx = await browser.newContext();
    const motaPage = await motaCtx.newPage();
    await login(motaPage, ACCOUNTS.mota, "/dashboard");
    await motaPage.goto(`/dashboard/ordens/${santosOrderId}`);
    await expect(motaPage).toHaveURL(/\/dashboard$/);
    await motaCtx.close();
  });
});
