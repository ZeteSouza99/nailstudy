import { expect, test, type Locator, type Page } from "@playwright/test";

import { e2eUsers } from "./env";
import { login } from "./helpers";
import { cashierDates } from "./payment-data";

function clientItems(form: Locator, name: string) {
  return form.getByText(name, { exact: true }).locator("..").getByRole("checkbox");
}

async function openPayment(page: Page) {
  await page.getByRole("button", { name: "Registrar pagamento", exact: true }).click();
  const form = page.getByRole("dialog", { name: "Registrar pagamento" });
  await expect(form).toBeVisible();
  return form;
}

async function finishAppointment(page: Page, name: string) {
  await page.goto(`/agenda?data=${cashierDates.future}&visao=dia`);
  await page.getByRole("button", { name: new RegExp(`^${name},`) }).click();
  const details = page.getByRole("dialog", { name: "Detalhes do atendimento" });
  await details.getByRole("button", { name: "Concluir", exact: true }).click();
  await expect(page.getByText(`${name}: status alterado para concluído.`)).toBeVisible();
  await details.getByRole("button", { name: "Fechar janela" }).click();
}

test.describe("caixa", () => {
  test("conclui na agenda e cobra com desconto, acréscimo e formas divididas", async ({ page }) => {
    await login(page, e2eUsers.reception, "/pagamentos");
    await expect(page.getByRole("heading", { name: "Pagamentos", exact: true })).toBeVisible();
    await finishAppointment(page, "Caixa Fluxo");
    await page.getByRole("link", { name: "Pagamentos", exact: true }).click();

    const form = await openPayment(page);
    await clientItems(form, "Caixa Fluxo").check();
    await expect(clientItems(form, "Caixa Antigo").first()).toBeDisabled();
    await form.getByLabel("Desconto (R$)").fill("20,00");
    await form.getByLabel("Acréscimo (R$)").fill("10,00");
    await form.getByRole("textbox", { name: "Valor", exact: true }).fill("100,25");
    await form.getByRole("button", { name: "Dividir" }).click();
    await form.getByLabel("Forma de pagamento").nth(1).selectOption("cash");
    await form.getByRole("button", { name: "= restante", exact: true }).nth(1).click();
    await expect(form.getByRole("textbox", { name: "Valor", exact: true }).nth(1)).toHaveValue("109,75");
    await form.getByLabel("Observações").fill("Caixa E2E dividido");
    await form.getByRole("button", { name: "Registrar pagamento", exact: true }).click();

    await expect(form).not.toBeVisible();
    await expect(page.getByText("Pagamento de Caixa Fluxo registrado.")).toBeVisible();
    const receipt = page.getByRole("article").filter({ hasText: "Caixa E2E dividido" });
    await expect(receipt).toContainText(/210,00/);
    await expect(receipt).toContainText(/Pix.*100,25.*Dinheiro.*109,75/);
    await expect(receipt).toContainText(/comissão.*88,00/);
    const next = await openPayment(page);
    await expect(next.getByText("Caixa Fluxo", { exact: true })).toHaveCount(0);
  });

  test("atualiza o caixa já aberto após outra profissional concluir", async ({ page, browser }) => {
    await login(page, e2eUsers.reception, "/pagamentos");
    await expect(page.getByRole("heading", { name: "Pagamentos", exact: true })).toBeVisible();
    const professional = await browser.newPage();
    const otherCashier = await browser.newPage();
    try {
      await login(professional, e2eUsers.professional);
      await expect(professional.getByRole("heading", { name: "Visão geral do estúdio" })).toBeVisible();
      await finishAppointment(professional, "Caixa Atualização");

      const form = await openPayment(page);
      await clientItems(form, "Caixa Atualização").check();
      await form.getByRole("button", { name: "= restante", exact: true }).click();

      // A outra recepção já selecionou o mesmo atendimento antes da primeira cobrança.
      await login(otherCashier, e2eUsers.reception, "/pagamentos");
      const staleForm = await openPayment(otherCashier);
      await clientItems(staleForm, "Caixa Atualização").check();
      await staleForm.getByRole("button", { name: "= restante", exact: true }).click();
      await form.getByRole("button", { name: "Registrar pagamento", exact: true }).click();
      await expect(page.getByText("Pagamento de Caixa Atualização registrado.")).toBeVisible();

      await staleForm.getByRole("button", { name: "Registrar pagamento", exact: true }).click();
      await expect(staleForm.getByRole("alert")).toContainText("já tem pagamento registrado");
      await staleForm.getByRole("button", { name: "Fechar janela" }).click();
      const reopened = await openPayment(otherCashier);
      await expect(reopened.getByText("Caixa Atualização", { exact: true })).toHaveCount(0);
    } finally {
      await professional.close();
      await otherCashier.close();
    }
  });

  test("cobra pendências antigas, valida valores, estorna e libera após exclusão", async ({ page }) => {
    await login(page, e2eUsers.admin, `/pagamentos?de=${cashierDates.today}&ate=${cashierDates.today}&novo=1`);
    const form = page.getByRole("dialog", { name: "Registrar pagamento" });
    const items = clientItems(form, "Caixa Antigo");
    await expect(items).toHaveCount(2);
    await items.nth(0).check();
    await items.nth(1).check();
    await form.getByRole("textbox", { name: "Valor", exact: true }).fill("100");
    await form.getByRole("button", { name: "Registrar pagamento", exact: true }).click();
    await expect(form.getByRole("alert")).toContainText("A soma das formas de pagamento precisa bater com o total.");
    await expect(items.nth(0)).toBeChecked();
    await expect(items.nth(1)).toBeChecked();

    await form.getByLabel("Desconto (R$)").fill("10.50");
    await form.getByRole("textbox", { name: "Valor", exact: true }).fill("219.50");
    await form.getByRole("button", { name: "Registrar pagamento", exact: true }).click();
    await expect(page.getByText("Pagamento de Caixa Antigo registrado.")).toBeVisible();

    const receipt = page.getByRole("article").filter({ hasText: "Caixa Antigo" });
    await expect(receipt).toContainText(/219,50/);
    await receipt.getByRole("button", { name: "Estornar", exact: true }).click();
    await page.getByRole("dialog", { name: "Estornar pagamento?" }).getByRole("button", { name: "Estornar", exact: true }).click();
    await expect(receipt.getByText("Estornado", { exact: true })).toBeVisible();
    const afterRefund = await openPayment(page);
    await expect(afterRefund.getByText("Caixa Antigo", { exact: true })).toHaveCount(0);
    await afterRefund.getByRole("button", { name: "Fechar janela" }).click();
    await receipt.getByRole("button", { name: "Excluir", exact: true }).click();
    await page.getByRole("dialog", { name: "Excluir pagamento?" }).getByRole("button", { name: "Excluir", exact: true }).click();
    await expect(page.getByText("Pagamento excluído.")).toBeVisible();
    const afterDelete = await openPayment(page);
    await expect(clientItems(afterDelete, "Caixa Antigo")).toHaveCount(2);
  });

  test("profissional não acessa pagamentos nem relatórios", async ({ page }) => {
    await login(page, e2eUsers.professional, "/pagamentos");
    await expect(page.getByRole("heading", { name: "Visão geral do estúdio" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Pagamentos", exact: true })).toHaveCount(0);
    await page.goto("/relatorios");
    await expect(page.getByRole("heading", { name: "Visão geral do estúdio" })).toBeVisible();
  });

  test("permite tentar novamente quando a consulta de atendimentos falha", async ({ page }) => {
    await login(page, e2eUsers.reception, "/pagamentos");
    await expect(page.getByRole("heading", { name: "Pagamentos", exact: true })).toBeVisible();
    let failNext = true;
    await page.route("**/pagamentos", async (route) => {
      if (failNext && route.request().method() === "POST" && route.request().headers()["next-action"]) {
        failNext = false;
        await route.abort();
      } else {
        await route.continue();
      }
    });
    const form = await openPayment(page);
    await expect(form.getByRole("alert")).toContainText("Não foi possível carregar os atendimentos");
    await expect(form.getByRole("button", { name: "Registrar pagamento", exact: true })).toHaveCount(0);
    await form.getByRole("button", { name: "Tentar novamente" }).click();
    await expect(clientItems(form, "Caixa Antigo")).toHaveCount(2);
  });
});
