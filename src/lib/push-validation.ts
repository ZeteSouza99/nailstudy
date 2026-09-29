import { z } from "zod";

/** O servidor só envia para provedores de push conhecidos, nunca para URLs arbitrárias. */
export const pushEndpointSchema = z.string().max(2048).url().refine((value) => {
  try {
    const url = new URL(value);
    const host = url.hostname;
    return url.protocol === "https:" && !url.username && !url.password && !url.port && !url.hash && (
      host === "fcm.googleapis.com" ||
      host === "updates.push.services.mozilla.com" ||
      host.endsWith(".push.services.mozilla.com") ||
      host === "web.push.apple.com" ||
      host.endsWith(".push.apple.com")
    );
  } catch {
    return false;
  }
}, "Este provedor de notificações não é compatível.");

export const pushSubscriptionSchema = z.object({
  endpoint: pushEndpointSchema,
  keys: z.object({
    p256dh: z.string().regex(/^[A-Za-z0-9_-]{87}$/, "Chave do dispositivo inválida."),
    auth: z.string().regex(/^[A-Za-z0-9_-]{22}$/, "Chave do dispositivo inválida."),
  }),
});

export type AdminPushSubscription = z.infer<typeof pushSubscriptionSchema>;
