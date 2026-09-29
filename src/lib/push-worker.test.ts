import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

import { describe, expect, it, vi } from "vitest";

function worker() {
  const handlers: Record<string, (event: unknown) => void> = {};
  const showNotification = vi.fn(async () => {});
  const openWindow = vi.fn(async () => {});
  const matchAll = vi.fn(async (): Promise<unknown[]> => []);
  runInNewContext(readFileSync("public/sw.js", "utf8"), {
    URL,
    self: { addEventListener: (name: string, fn: (event: unknown) => void) => { handlers[name] = fn; },
      registration: { showNotification }, location: { origin: "https://agenda.example" } },
    clients: { openWindow, matchAll },
  });
  return { handlers, showNotification, openWindow, matchAll };
}

describe("worker das notificações", () => {
  it("exibe o aviso com a tag do agendamento e mantém o evento vivo", async () => {
    const { handlers, showNotification } = worker();
    const waitUntil = vi.fn();
    handlers.push({ data: { json: () => ({ title: "Novo agendamento", body: "Novo pedido", tag: "apt-1" }) }, waitUntil });
    await waitUntil.mock.calls[0][0];
    expect(showNotification).toHaveBeenCalledWith("Novo agendamento", expect.objectContaining({ body: "Novo pedido", tag: "apt-1" }));
  });

  it("sempre mostra uma notificação mesmo se o payload for inválido", async () => {
    const { handlers, showNotification } = worker();
    handlers.push({ data: { json: () => { throw new Error(); } }, waitUntil: vi.fn() });
    expect(showNotification).toHaveBeenCalledWith("Erika Queiroz", expect.any(Object));
  });

  it("abre apenas a página interna de pedidos ao tocar no aviso", async () => {
    const { handlers, openWindow } = worker();
    const waitUntil = vi.fn();
    const close = vi.fn();
    handlers.notificationclick({ notification: { close, data: { url: "https://attacker.test" } }, waitUntil });
    await waitUntil.mock.calls[0][0];
    expect(close).toHaveBeenCalledOnce();
    expect(openWindow).toHaveBeenCalledWith("https://agenda.example/agenda/pendentes");
  });
});
