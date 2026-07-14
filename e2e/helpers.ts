import { Page, expect } from "@playwright/test";

export const ACCOUNTS = {
  admin: { email: "admin@jolucor.pt", password: "admin2026" },
  mota: { email: "compras@motapecas.pt", password: "mota2026" },
  santos: { email: "geral@metalsantos.pt", password: "santos2026" },
} as const;

/** Logs in via the login form and waits for the post-login redirect. */
export async function login(
  page: Page,
  account: { email: string; password: string },
  expectedPath: "/dashboard" | "/admin"
) {
  await page.goto("/login");
  await page.locator('input[type="email"]').fill(account.email);
  await page.locator('input[type="password"]').fill(account.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(new RegExp(`${expectedPath}(/|$)`));
}
