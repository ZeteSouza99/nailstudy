import { expect, type Page } from "@playwright/test";

/** Avança dias até achar uma data com horários livres e escolhe o primeiro. */
export async function pickFirstSlot(page: Page) {
  const dateInput = page.locator("input[type=date]").first();
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const slots = page.getByRole("group", { name: "Horários disponíveis" }).getByRole("button");
    try {
      await expect(slots.first()).toBeVisible({ timeout: 3_000 });
      const time = (await slots.first().innerText()).trim();
      await slots.first().click();
      return time;
    } catch {
      const current = await dateInput.inputValue();
      const next = new Date(`${current}T12:00:00`);
      next.setDate(next.getDate() + 1);
      await dateInput.fill(next.toISOString().slice(0, 10));
    }
  }
  throw new Error("Nenhuma data com horários livres encontrada.");
}

export async function bookThroughPortal(page: Page, phone: string) {
  await page.goto("/agendar");
  await page.getByRole("button", { name: /Esmaltação em gel premium/ }).click();
  const time = await pickFirstSlot(page);
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByLabel("Nome", { exact: true }).fill("Teste");
  await page.getByLabel("Sobrenome").fill("Portal");
  await page.getByLabel("Telefone (WhatsApp)").fill(phone);
  await page.getByRole("button", { name: "Confirmar agendamento" }).click();
  await expect(page.getByRole("heading", { name: "Agendamento registrado" })).toBeVisible();
  return time;
}

export async function login(
  page: Page,
  user: { email: string; username?: string; password: string },
  callbackUrl?: string,
) {
  await page.goto(callbackUrl ? `/login?callbackUrl=${encodeURIComponent(callbackUrl)}` : "/login");
  await page.getByLabel("Usuário").fill(user.username ?? user.email);
  await page.getByLabel("Senha").fill(user.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  // A primeira autenticação também abre o Postgres local dos testes.
  await expect(page).not.toHaveURL(/\/login(?:[?#]|$)/, { timeout: 30_000 });
}
