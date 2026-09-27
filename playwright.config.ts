import { defineConfig, devices } from "@playwright/test";

import { E2E_PORT } from "./e2e/env";

const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${E2E_PORT}`;

export default defineConfig({
  testDir: "e2e",
  testMatch: "**/*.spec.ts",
  // Os cenários compartilham o mesmo banco descartável.
  workers: 1,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    // Ex.: PW_CHANNEL=msedge para usar o Edge instalado em vez do Chromium baixado.
    channel: process.env.PW_CHANNEL,
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npx tsx e2e/serve.ts",
        url: `${baseURL}/login`,
        timeout: 300_000,
        reuseExistingServer: !process.env.CI,
        stdout: "pipe",
      },
});
