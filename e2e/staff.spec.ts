import { expect, test } from "@playwright/test";

import { e2eUsers } from "./env";
import { bookThroughPortal, login } from "./helpers";

test.describe("painel da equipe", () => {
  test("não segue callbackUrl para outro domínio", async ({ page }) => {
    await login(page, e2eUsers.admin, "//evil.example");
    await expect(page.getByRole("heading", { name: "Visão geral do estúdio" })).toBeVisible();
    expect(new URL(page.url()).pathname).toBe("/");
  });

  test("recepção confirma o pedido feito pelo portal", async ({ page, browser }) => {
    const portal = await browser.newPage();
    await bookThroughPortal(portal, "(11) 95555-2002");
    await portal.close();

    await login(page, e2eUsers.reception, "/agenda/pendentes");
    await expect(page.getByRole("heading", { name: "Pendentes do portal" })).toBeVisible();

    const pending = page.getByRole("listitem").filter({ hasText: "Teste Portal" }).first();
    await pending.getByRole("button", { name: "Confirmar" }).click();
    await expect(page.getByText(/confirmado\. A cliente foi avisada/)).toBeVisible();
  });

  test("recepção vê o catálogo mas não o edita", async ({ page }) => {
    await login(page, e2eUsers.reception);
    await expect(page.getByRole("heading", { name: "Visão geral do estúdio" })).toBeVisible();
    await page.goto("/servicos");
    await expect(page.getByRole("heading", { name: "Serviços" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Novo serviço" })).toHaveCount(0);
  });

  test("profissional vê só a própria agenda e não os cadastros", async ({ page }) => {
    await login(page, e2eUsers.professional);
    await expect(page.getByRole("heading", { name: "Visão geral do estúdio" })).toBeVisible();

    await page.goto("/agenda");
    await expect(page.getByRole("heading", { name: "Minha agenda" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Novo agendamento" })).toHaveCount(0);

    await page.goto("/clientes");
    await expect(page.getByRole("heading", { name: "Visão geral do estúdio" })).toBeVisible();
  });

  test("novo agendamento mantém os dados quando o servidor recusa o horário", async ({ page }) => {
    await login(page, e2eUsers.admin);
    await expect(page.getByRole("heading", { name: "Visão geral do estúdio" })).toBeVisible();

    // Quarta-feira distante: todas as profissionais trabalham e não há dados de demonstração.
    const target = new Date();
    target.setHours(12, 0, 0, 0);
    target.setDate(target.getDate() + 21);
    while (target.getDay() !== 3) target.setDate(target.getDate() + 1);
    const day = target.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

    await page.goto("/agenda?novo=1");
    const form = page.getByRole("dialog", { name: "Novo agendamento" });
    await form.getByRole("combobox", { name: "Cliente" }).fill("mariana");
    await form.getByRole("button", { name: /Mariana Alves/ }).click();
    await form.getByLabel("Serviço").selectOption("srv-001");
    await form.getByLabel("Data").fill(day);
    await form.getByLabel("Profissional").selectOption("pro-001");
    await form.getByLabel("Horário").fill("07:00");
    await form.getByLabel("Observações").fill("Teste E2E");
    await form.getByRole("button", { name: "Criar agendamento" }).click();

    await expect(form.getByRole("alert")).toContainText("a partir das 08:00");
    await expect(form.getByLabel("Profissional")).toHaveValue("pro-001");
    await expect(form.getByLabel("Observações")).toHaveValue("Teste E2E");

    await form.getByLabel("Horário").fill("10:00");
    await form.getByRole("button", { name: "Criar agendamento" }).click();
    await expect(page.getByText("Agendamento criado para Mariana Alves, às 10:00.")).toBeVisible();

    // Remove o registro para o teste poder rodar de novo contra o mesmo servidor.
    await page.getByRole("button", { name: /^Mariana Alves, Esmaltação em gel premium, 10:00/ }).click();
    await page
      .getByRole("dialog", { name: "Detalhes do atendimento" })
      .getByRole("button", { name: "Excluir registro" })
      .click();
    await page
      .getByRole("dialog", { name: "Excluir agendamento?" })
      .getByRole("button", { name: "Excluir", exact: true })
      .click();
    await expect(page.getByText("Agendamento excluído.")).toBeVisible();
  });

  test("bloqueio de agenda some com os horários do portal", async ({ page }) => {
    await login(page, e2eUsers.admin);
    await expect(page.getByRole("heading", { name: "Visão geral do estúdio" })).toBeVisible();
    await page.goto("/bloqueios");
    await page.getByRole("button", { name: "Novo bloqueio" }).click();
    await page.getByLabel("Motivo").fill("Feriado E2E");

    const target = new Date();
    target.setDate(target.getDate() + 3);
    if (target.getDay() === 0) target.setDate(target.getDate() + 1);
    const day = target.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
    await page.getByLabel("De", { exact: true }).fill(day);
    await page.getByLabel("Até", { exact: true }).fill(day);
    await page.getByRole("button", { name: "Bloquear agenda" }).click();
    await expect(page.getByRole("listitem").filter({ hasText: "Feriado E2E" })).toBeVisible();

    await page.goto("/agendar");
    await page.getByRole("button", { name: /Esmaltação em gel premium/ }).click();
    await page.getByRole("button", { name: /Sem preferência/ }).click();
    await page.locator("input[type=date]").fill(day);
    await expect(page.getByText("Nenhum horário livre nesta data.")).toBeVisible();
  });
});
