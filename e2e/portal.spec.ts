import { expect, test } from "@playwright/test";

import { bookThroughPortal, pickFirstSlot } from "./helpers";

test.describe("portal da cliente", () => {
  test("agenda, remarca e cancela pelo link com token", async ({ page }) => {
    const time = await bookThroughPortal(page, "(11) 95555-1001");
    await expect(page.getByText("Aguardando confirmação do estúdio.")).toBeVisible();
    await expect(page.getByText(time).first()).toBeVisible();

    await page.getByRole("link", { name: /Abrir meu agendamento/ }).click();
    await expect(page).toHaveURL(/\/meu-agendamento\/[A-Za-z0-9_-]{32,}/);
    await expect(page.getByRole("heading", { name: "Meu agendamento" })).toBeVisible();
    const tokenUrl = page.url();

    await page.getByRole("button", { name: "Remarcar" }).click();
    const newTime = await pickFirstSlot(page);
    await page.getByRole("button", { name: "Confirmar novo horário" }).click();
    await expect(page.getByText(/remarcado com sucesso/)).toBeVisible();
    await expect(page.getByText(new RegExp(`${newTime} às`))).toBeVisible();

    await page.getByRole("button", { name: "Cancelar agendamento" }).click();
    await expect(page.getByText("Agendamento cancelado.")).toBeVisible();

    await page.goto(tokenUrl);
    await expect(page.getByText("Cancelado")).toBeVisible();
    await expect(page.getByRole("button", { name: "Remarcar" })).toHaveCount(0);
  });

  test("link forjado não dá acesso", async ({ page }) => {
    const response = await page.goto(`/meu-agendamento/${"a".repeat(43)}`);
    expect(response?.status()).toBe(404);
  });

  test("envia cabeçalhos de segurança e não vaza o token pelo Referer", async ({ request }) => {
    const portal = await request.get("/agendar");
    expect(portal.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(portal.headers()["x-content-type-options"]).toBe("nosniff");

    const link = await request.get(`/meu-agendamento/${"b".repeat(43)}`);
    expect(link.headers()["referrer-policy"]).toBe("no-referrer");
  });

  test("rotas internas exigem login", async ({ page }) => {
    await page.goto("/agenda");
    await expect(page).toHaveURL(/\/login\?callbackUrl=%2Fagenda/);
  });
});
