import { expect, test } from "@playwright/test";
import { e2eUsers } from "./env";
import { login } from "./helpers";

test("portal pula a escolha de profissional e mantém os três passos", async ({ page }) => {
  await page.goto("/agendar");
  await expect(page.getByRole("list", { name: "Etapas" }).getByRole("listitem")).toHaveCount(3);
  await page.getByRole("button", { name: /Esmaltação em gel premium/ }).click();
  await expect(page.getByRole("heading", { name: "Escolha a data e o horário" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sem preferência" })).toHaveCount(0);
  await expect(page.locator("main")).not.toContainText(/Amanda Souza|Camila Rocha|Larissa Gomes|Paula Martins/);
  await page.getByRole("button", { name: "Voltar", exact: true }).click();
  await page.getByRole("button", { name: /Pedicure completa/ }).click();
  await expect(page.getByRole("heading", { name: "Escolha a data e o horário" })).toBeVisible();
});

test("configura o estúdio e não exibe seleção de profissional nos formulários", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, e2eUsers.admin, "/profissionais");
  await expect(page.getByRole("heading", { name: "Meu estúdio" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Erika Queiroz" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Nova profissional" })).toHaveCount(0);
  await page.getByLabel("Início do atendimento", { exact: true }).fill("08:00");
  await page.getByRole("button", { name: "Salvar horários" }).click();
  await expect(page.getByText("Horários do estúdio atualizados.")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Início do atendimento", { exact: true })).toHaveValue("08:00");
  await page.goto("/agenda");
  await expect(page.getByLabel("Filtrar por profissional")).toHaveCount(0);
  await page.getByRole("button", { name: "Novo agendamento", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("Atendimento com Erika Queiroz.");
  await expect(page.getByLabel("Profissional", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await page.goto("/bloqueios");
  await page.getByRole("button", { name: "Novo bloqueio" }).click();
  await expect(page.getByLabel("Vale para", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("dialog")).toContainText("agenda de Erika Queiroz");
});
