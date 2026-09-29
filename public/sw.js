/* global self, clients */

// Apenas push: páginas autenticadas e respostas da API não são guardadas em cache.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(clients.claim()));

self.addEventListener("push", (event) => {
  let message = {};
  try {
    const payload = event.data?.json();
    message = payload && typeof payload === "object" ? payload : {};
  } catch {
    // Mesmo um payload inválido deve resultar em notificação visível no iOS.
  }
  event.waitUntil(self.registration.showNotification(
    typeof message.title === "string" ? message.title : "Erika Queiroz",
    {
      body: typeof message.body === "string" ? message.body : "Confira os pedidos pendentes no painel.",
      icon: "/icons/icon-192.png",
      tag: typeof message.tag === "string" ? message.tag : "nail-agenda",
    },
  ));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  // Destino fixo da própria aplicação; nunca utiliza URLs recebidas no payload.
  const target = new URL("/agenda/pendentes", self.location.origin).href;
  event.waitUntil((async () => {
    const windows = await clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const windowClient of windows) {
      if (new URL(windowClient.url).origin === self.location.origin) {
        const navigated = await windowClient.navigate(target);
        if (navigated) return navigated.focus();
      }
    }
    return clients.openWindow(target);
  })());
});
