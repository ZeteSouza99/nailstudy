import { expect, test, type Locator } from "@playwright/test";

import { e2eUsers } from "./env";
import { login } from "./helpers";

const storageKey = "nail-agenda-theme";

async function expectDarkSurface(locator: Locator) {
  await expect(locator).toBeVisible();
  const lightness = await locator.evaluate((element) => {
    const context = document.createElement("canvas").getContext("2d")!;
    context.fillStyle = getComputedStyle(element).backgroundColor;
    context.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;
    return { channel: Math.max(r, g, b), alpha: a };
  });
  expect(lightness.channel).toBeLessThan(100);
  expect(lightness.alpha).toBeGreaterThan(200);
}

test.describe("tema", () => {
  for (const scenario of [
    { name: "preferência do dispositivo", system: "dark", saved: null, expected: "dark" },
    { name: "escolha escura salva", system: "light", saved: "dark", expected: "dark" },
    { name: "escolha clara salva", system: "dark", saved: "light", expected: "light" },
  ] as const) {
    test(`aplica ${scenario.name} antes de carregar o React`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scenario.system });
      if (scenario.saved) {
        await page.addInitScript(({ key, value }) => localStorage.setItem(key, value), {
          key: storageKey,
          value: scenario.saved,
        });
      }
      // O script do head precisa funcionar mesmo enquanto os bundles não chegaram.
      await page.route("**/_next/static/**/*.js", (route) => route.abort());
      await page.goto("/login");
      await expect(page.locator("html")).toHaveAttribute("data-theme", scenario.expected);
      await expect(page.locator("html")).toHaveCSS("color-scheme", scenario.expected);
      if (scenario.expected === "dark") await expectDarkSurface(page.locator("form"));
    });
  }

  test("alterna por teclado, persiste ao recarregar e sincroniza entre abas", async ({ page, context }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/login");
    const toggle = page.getByRole("button", { name: "Tema escuro" });
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await toggle.focus();
    await page.keyboard.press("Enter");
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    await page.reload();
    await expect(toggle).toHaveAttribute("aria-pressed", "true");

    const other = await context.newPage();
    await other.emulateMedia({ colorScheme: "light" });
    await other.goto("/agendar");
    await expect(other.getByRole("button", { name: "Tema escuro" })).toHaveAttribute("aria-pressed", "true");
    await expectDarkSurface(other.locator("header"));

    await toggle.click();
    await expect(other.locator("html")).toHaveAttribute("data-theme", "light");
    await other.reload();
    await expect(other.locator("html")).toHaveAttribute("data-theme", "light");
    expect(await page.evaluate((key) => localStorage.getItem(key), storageKey)).toBe("light");
    expect(errors).toEqual([]);
    await other.close();
  });

  test("acompanha o sistema até o usuário escolher um tema", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.addInitScript((key) => localStorage.setItem(key, "valor-invalido"), storageKey);
    await page.goto("/login");
    const toggle = page.getByRole("button", { name: "Tema escuro" });
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await page.emulateMedia({ colorScheme: "dark" });
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    await toggle.click();
    await page.emulateMedia({ colorScheme: "light" });
    await page.emulateMedia({ colorScheme: "dark" });
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await expect(page.locator("html")).toHaveCSS("color-scheme", "light");
  });

  test("permite alternar mesmo com o armazenamento bloqueado", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.emulateMedia({ colorScheme: "dark" });
    await page.addInitScript(() => {
      for (const method of ["getItem", "setItem"]) {
        Object.defineProperty(Storage.prototype, method, {
          value() { throw new DOMException("Bloqueado", "SecurityError"); },
        });
      }
    });
    await page.goto("/login");
    const toggle = page.getByRole("button", { name: "Tema escuro" });
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    expect(errors).toEqual([]);
  });

  for (const mobile of [false, true]) {
    test(`mantém telas e formulário do caixa escuros no ${mobile ? "celular" : "desktop"}`, async ({ page }, testInfo) => {
      await page.setViewportSize(mobile ? { width: 375, height: 812 } : { width: 1440, height: 1000 });
      await page.emulateMedia({ colorScheme: "dark" });
      await login(page, e2eUsers.admin);
      await expect(page.getByRole("heading", { name: "Visão geral do estúdio" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Tema escuro" })).toBeVisible();
      await expectDarkSurface(page.locator(".surface-card").first());
      await page.screenshot({ path: testInfo.outputPath("painel-dark.png"), fullPage: true });

      const routes = mobile
        ? ["/agenda", "/pagamentos"]
        : ["/agenda", "/agenda/pendentes", "/clientes", "/servicos", "/profissionais", "/bloqueios", "/relatorios", "/pagamentos"];
      for (const route of routes) {
        await page.goto(route);
        await expect(page.locator("main h1")).toBeVisible();
        await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
        await expectDarkSurface(page.locator("header").first());
      }

      await page.getByRole("button", { name: "Registrar pagamento", exact: true }).click();
      const dialog = page.getByRole("dialog", { name: "Registrar pagamento" });
      await expectDarkSurface(dialog);
      await expectDarkSurface(dialog.locator("select").first());
      await page.screenshot({ path: testInfo.outputPath("caixa-dark.png"), fullPage: true });
      await dialog.getByRole("button", { name: "Fechar janela" }).click();

      const toggle = page.getByRole("button", { name: "Tema escuro" });
      await toggle.click();
      await expect(toggle).toHaveAttribute("aria-pressed", "false");
      await expect(page.locator("html")).toHaveCSS("color-scheme", "light");
      await page.reload();
      await expect(toggle).toHaveAttribute("aria-pressed", "false");
      await toggle.click();
      await page.goto("/agendar");
      await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
      await expect(page.getByRole("button", { name: "Tema escuro" })).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath("portal-dark.png"), fullPage: true });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    });
  }
});
