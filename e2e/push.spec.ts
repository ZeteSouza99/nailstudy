import { createECDH } from "node:crypto";

import { expect, test } from "@playwright/test";

import { e2eUsers } from "./env";
import { login } from "./helpers";

test("manifest, ícones e worker ficam acessíveis sem login", async ({ request }) => {
  const manifest = await request.get("/manifest.webmanifest");
  expect(manifest.status()).toBe(200);
  expect(await manifest.json()).toMatchObject({ display: "standalone", start_url: "/" });
  const worker = await request.get("/sw.js");
  expect(worker.status()).toBe(200);
  expect(worker.headers()["content-type"]).toContain("javascript");
  expect(worker.headers()["cache-control"]).toContain("no-store");
  expect((await request.get("/icons/apple-touch-icon.png")).status()).toBe(200);
  const privatePage = await request.get("/agenda/pendentes", { maxRedirects: 0 });
  expect(privatePage.status()).toBe(307);
});

test("orienta a instalação no iPhone antes de pedir permissão", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "userAgent", { get: () => "iPhone" });
  });
  await login(page, e2eUsers.admin);
  await page.getByRole("button", { name: "Notificações de agendamentos" }).click();
  await expect(page.getByText("Escolha Adicionar à Tela de Início", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "Ativar notificações" })).toHaveCount(0);
});

test("ativa, reconhece e desativa a inscrição do aparelho", async ({ page }) => {
  const key = createECDH("prime256v1");
  key.generateKeys();
  const keys = { p256dh: key.getPublicKey().toString("base64url"), auth: Buffer.alloc(16, 2).toString("base64url") };
  // Simula somente o provedor externo; worker, ações, autenticação e banco são reais.
  await page.addInitScript(({ keys }) => {
    let current: object | null = null;
    Object.defineProperty(Notification, "permission", { get: () => "granted" });
    Object.defineProperty(PushManager.prototype, "getSubscription", { value: async () => current });
    Object.defineProperty(PushManager.prototype, "subscribe", { value: async () => {
      const endpoint = "https://fcm.googleapis.com/fcm/send/e2e-device";
      current = { endpoint, toJSON: () => ({ endpoint, keys }), unsubscribe: async () => { current = null; return true; } };
      return current;
    } });
  }, { keys });
  await login(page, e2eUsers.admin);
  await page.getByRole("button", { name: "Notificações de agendamentos" }).click();
  await page.getByRole("button", { name: "Ativar notificações" }).click();
  await expect(page.getByText("Notificações ativadas neste dispositivo.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Fechar janela" }).click();
  await page.getByRole("button", { name: "Notificações de agendamentos" }).click();
  await expect(page.getByText("Este dispositivo está cadastrado", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Desativar neste dispositivo" }).click();
  await expect(page.getByText("Notificações desativadas neste dispositivo.", { exact: true })).toBeVisible();
});
