import { expect, test } from "@playwright/test";

import { e2eUsers } from "./env";
import { login } from "./helpers";

test("aceita usuário sem diferenciar maiúsculas e mantém login por e-mail", async ({ page }) => {
  await login(page, { ...e2eUsers.admin, username: "erika" });
  await expect(page.getByRole("heading", { name: "Visão geral do estúdio" })).toBeVisible();
  await page.getByRole("button", { name: "Sair", exact: true }).click();
  await expect(page.getByLabel("Usuário")).toBeVisible();
  await login(page, { ...e2eUsers.admin, username: e2eUsers.admin.email });
  await expect(page.getByRole("heading", { name: "Visão geral do estúdio" })).toBeVisible();
});

test("rejeita senha incorreta e mantém a área administrativa protegida", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Usuário").fill("Erika");
  await page.getByLabel("Senha").fill("senha-incorreta");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByText("Usuário ou senha inválidos.")).toBeVisible();
  await page.goto("/clientes");
  await expect(page).toHaveURL(/\/login\?/);
});
