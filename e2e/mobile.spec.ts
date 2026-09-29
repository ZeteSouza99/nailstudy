import { expect, test, type Locator, type Page } from "@playwright/test";

import { e2eUsers } from "./env";
import { login, pickFirstSlot } from "./helpers";

async function expectNoOverflow(page: Page, scope?: Locator) {
  const overflowing = await (scope ?? page.locator("html")).evaluate((element) => ({
    width: element.clientWidth,
    content: element.scrollWidth,
  }));
  expect(overflowing.content).toBeLessThanOrEqual(overflowing.width + 1);
}

const routes = ["/", "/agenda", "/agenda/pendentes", "/clientes", "/servicos", "/profissionais", "/bloqueios", "/pagamentos", "/relatorios"];

for (const viewport of [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 844, height: 390 },
  { width: 1440, height: 900 },
]) {
  test(`todas as telas cabem em ${viewport.width}×${viewport.height}`, async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    await page.setViewportSize(viewport);
    await page.goto("/login");
    await expectNoOverflow(page);
    await login(page, e2eUsers.admin);
    for (const route of routes) {
      await page.goto(route);
      await expect(page.locator("main h1")).toBeVisible();
      await expectNoOverflow(page);
    }
    await page.goto("/servicos");
    await page.getByRole("button", { name: "Lista", exact: true }).click();
    await expectNoOverflow(page);
    if (viewport.width < 640) {
      const rows = page.getByRole("region", { name: "Tabela de serviços" }).locator("tbody tr");
      await expect(rows.first().getByRole("button", { name: "Editar" })).toBeVisible();
      await expectNoOverflow(page, rows.first());
    }
    for (const route of ["/agendar", "/meu-agendamento"]) {
      await page.goto(route);
      await expect(page.locator("main h1")).toBeVisible();
      await expectNoOverflow(page);
    }
    await page.goto("/agenda");
    await page.screenshot({ path: testInfo.outputPath("agenda.png"), fullPage: true });
  });
}

test.describe("interação por toque", () => {
  test.use({ viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true });

  test("menu e formulários permanecem acessíveis em telas pequenas", async ({ page }) => {
    test.setTimeout(120_000);
    await login(page, e2eUsers.admin);
    const nav = page.getByRole("navigation", { name: "Navegação móvel" });
    await nav.getByRole("button", { name: "Mais" }).click();
    const menu = page.getByRole("dialog", { name: "Menu", exact: true });
    await menu.getByRole("link", { name: "Serviços", exact: true }).click();
    await expect(page).toHaveURL(/\/servicos$/);
    await expect(menu).not.toBeVisible();

    for (const [route, action, title] of [
      ["/agenda", "Novo agendamento", "Novo agendamento"],
      ["/clientes", "Nova cliente", "Nova cliente"],
      ["/servicos", "Novo serviço", "Novo serviço"],
      ["/bloqueios", "Novo bloqueio", "Novo bloqueio"],
      ["/pagamentos", "Registrar pagamento", "Registrar pagamento"],
    ]) {
      await page.goto(route);
      await page.getByRole("button", { name: action, exact: true }).click();
      const dialog = page.getByRole("dialog", { name: title, exact: true });
      await expect(dialog).toBeVisible();
      await expect(dialog).toBeFocused();
      await expectNoOverflow(page, dialog);
      const fields = dialog.locator("input:not([type=hidden]):not([type=checkbox]), select, textarea");
      for (const field of await fields.all()) {
        expect(await field.evaluate((element) => parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(16);
      }
      if (route === "/pagamentos") {
        await dialog.getByRole("button", { name: "Dividir", exact: true }).click();
        await expect(dialog.getByLabel("Forma de pagamento")).toHaveCount(2);
        await expectNoOverflow(page, dialog);
        await dialog.getByRole("button", { name: "Remover forma" }).last().click();
      }
      const cancel = dialog.getByRole("button", { name: "Cancelar", exact: true });
      await cancel.scrollIntoViewIfNeeded();
      await expect(cancel).toBeInViewport();
      // Simulates the reduced visible area while the on-screen keyboard is open.
      await page.setViewportSize({ width: 320, height: 360 });
      await cancel.scrollIntoViewIfNeeded();
      await expect(cancel).toBeInViewport();
      await cancel.click();
      await expect(dialog).not.toBeVisible();
      await page.setViewportSize({ width: 320, height: 568 });
      await expectNoOverflow(page);
    }
  });

  test("portal permite agendar e abrir o acompanhamento no celular", async ({ page }, testInfo) => {
    await page.goto("/agendar");
    await page.getByRole("button", { name: /Esmaltação em gel premium/ }).click();
    await pickFirstSlot(page);
    await expectNoOverflow(page);
    await page.getByRole("button", { name: "Continuar" }).click();
    await page.getByLabel("Nome", { exact: true }).fill("Cliente");
    await page.getByLabel("Sobrenome").fill("Mobile");
    await page.getByLabel("Telefone (WhatsApp)").fill("11955553999");
    await expectNoOverflow(page);
    await page.getByRole("button", { name: "Confirmar agendamento" }).click();
    await expect(page.getByRole("heading", { name: "Agendamento registrado" })).toBeVisible();
    await expectNoOverflow(page);
    await page.getByRole("link", { name: "Abrir meu agendamento" }).click();
    await expect(page.getByRole("heading", { name: "Meu agendamento" })).toBeVisible();
    await expectNoOverflow(page);
    await page.getByRole("button", { name: "Remarcar", exact: true }).click();
    await expectNoOverflow(page);
    await page.screenshot({ path: testInfo.outputPath("portal-mobile.png"), fullPage: true });
  });

  test("registra pagamento dividido e apresenta os relatórios como cartões", async ({ page }, testInfo) => {
    await login(page, e2eUsers.admin, "/pagamentos");
    await page.getByRole("button", { name: "Registrar pagamento", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Registrar pagamento" });
    await dialog.getByText("Caixa Mobile", { exact: true }).locator("..").getByRole("checkbox").check();
    await dialog.getByRole("textbox", { name: "Valor", exact: true }).fill("50,00");
    await dialog.getByRole("button", { name: "Dividir" }).click();
    await dialog.getByLabel("Forma de pagamento").nth(1).selectOption("cash");
    await dialog.getByRole("button", { name: "= restante", exact: true }).nth(1).click();
    await expect(dialog.getByRole("textbox", { name: "Valor", exact: true }).nth(1)).toHaveValue("100,00");
    await expectNoOverflow(page, dialog);
    await dialog.getByRole("button", { name: "Registrar pagamento", exact: true }).click();
    await expect(dialog).not.toBeVisible();
    const receipt = page.getByRole("article").filter({ hasText: "Caixa Mobile" });
    await expect(receipt).toContainText(/150,00/);
    await expectNoOverflow(page, receipt);
    await page.goto("/relatorios");
    const professionals = page.getByRole("region", { name: "Atendimentos de Erika", exact: true });
    await expect(professionals.locator("tbody tr").first()).toBeVisible();
    await expectNoOverflow(page, professionals);
    await expectNoOverflow(page);
    await page.screenshot({ path: testInfo.outputPath("relatorios-mobile.png"), fullPage: true });
  });
});
