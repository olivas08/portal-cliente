import { Page, expect } from "@playwright/test";

export const ACCOUNTS = {
  admin: { email: "admin@fabrica-demo.pt", password: "admin2026" },
  mota: { email: "compras@motapecas.pt", password: "mota2026" },
  santos: { email: "geral@metalsantos.pt", password: "santos2026" },
  producao: { email: "producao@fabrica-demo.pt", password: "producao2026" },
  armazem: { email: "armazem@fabrica-demo.pt", password: "armazem2026" },
  comercial: { email: "comercial@fabrica-demo.pt", password: "comercial2026" },
  qualidade: { email: "qualidade@fabrica-demo.pt", password: "qualidade2026" },
} as const;

/** Logs in via the login form and waits for the post-login redirect. */
export async function login(
  page: Page,
  account: { email: string; password: string },
  expectedPath: string | RegExp
) {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.locator('input[type="email"]').fill(account.email);
  await page.locator('input[type="password"]').fill(account.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  const pattern =
    expectedPath instanceof RegExp
      ? expectedPath
      : new RegExp(`${expectedPath}(/|$)`);
  await expect(page).toHaveURL(pattern);
  await page.waitForLoadState("domcontentloaded");
}

/** Logs an operator in at the shop-floor terminal via the PIN keypad. */
export async function operatorLogin(
  page: Page,
  operatorName: string,
  pin: string
) {
  await page.goto("/producao/terminal");
  await page.locator("select").first().selectOption({ label: operatorName });
  for (const digit of pin) {
    await page.getByRole("button", { name: digit, exact: true }).click();
  }
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(
    page.getByRole("heading", { name: "Escolha o posto de trabalho" })
  ).toBeVisible();
}
