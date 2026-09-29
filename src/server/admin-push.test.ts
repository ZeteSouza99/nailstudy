import { createECDH } from "node:crypto";

import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

import { adminPushSubscriptions } from "@/db/schema";
import { pushSubscriptionSchema } from "@/lib/push-validation";
import { seedAdmin } from "@/test/fixtures";
import { getTestDatabase, resetDatabase } from "@/test/test-db";

const session = vi.hoisted(() => ({ userId: null as string | null }));
vi.mock("@/lib/auth", () => ({ auth: async () => session.userId ? { user: { id: session.userId } } : null }));
vi.mock("@/db", async () => {
  const { getTestDatabase: open } = await import("@/test/test-db");
  return open();
});
vi.mock("web-push", () => ({ default: { sendNotification: vi.fn(async () => ({})) } }));
vi.mock("next/server", () => ({ after: vi.fn() }));
vi.mock("@/server/logger", () => ({ logger: { warn: vi.fn(), error: vi.fn() } }));

const { default: webpush } = await import("web-push");
const { after } = await import("next/server");
const { deliverNewBookingPush, getPushPublicKey, notifyAdminNewBooking, removePushSubscription } = await import("./admin-push");
const { getPushConfigurationAction, subscribeAdminPushAction, unsubscribeAdminPushAction, testAdminPushAction } = await import("@/app/push-actions");

const key = createECDH("prime256v1");
key.generateKeys();
const publicKey = key.getPublicKey().toString("base64url");
const subscription = (id = "device-1") => ({
  endpoint: `https://fcm.googleapis.com/fcm/send/${id}`,
  keys: { p256dh: publicKey, auth: Buffer.alloc(16, 1).toString("base64url") },
});

beforeEach(async () => {
  await resetDatabase();
  await seedAdmin();
  session.userId = "usr-admin";
  vi.clearAllMocks();
  vi.mocked(webpush.sendNotification).mockResolvedValue({ statusCode: 201, headers: {}, body: "" });
  vi.stubEnv("VAPID_PUBLIC_KEY", publicKey);
  vi.stubEnv("VAPID_PRIVATE_KEY", key.getPrivateKey().toString("base64url"));
  vi.stubEnv("VAPID_SUBJECT", "mailto:admin@example.com");
});
afterEach(() => vi.unstubAllEnvs());

describe("notificações da administradora", () => {
  it.each([null, "conta-removida"])("exige sessão válida para %s", async (id) => {
    session.userId = id;
    const results = [await getPushConfigurationAction(), await subscribeAdminPushAction(subscription()),
      await unsubscribeAdminPushAction(subscription().endpoint), await testAdminPushAction(subscription().endpoint)];
    expect(results.every((result) => !result.ok)).toBe(true);
    const { db } = await getTestDatabase();
    expect(await db.select().from(adminPushSubscriptions)).toHaveLength(0);
    expect(webpush.sendNotification).not.toHaveBeenCalled();
  });

  it("persiste mais de um dispositivo sem duplicar inscrições e desativa só o escolhido", async () => {
    expect((await subscribeAdminPushAction(subscription())).ok).toBe(true);
    await subscribeAdminPushAction(subscription());
    await subscribeAdminPushAction(subscription("device-2"));
    await removePushSubscription("outra-conta", subscription().endpoint);
    const { db } = await getTestDatabase();
    expect(await db.select().from(adminPushSubscriptions)).toHaveLength(2);
    await unsubscribeAdminPushAction(subscription().endpoint);
    expect(await db.select().from(adminPushSubscriptions)).toMatchObject([{ endpoint: subscription("device-2").endpoint }]);
  });

  it.each(["endereco-invalido", "https://localhost/push", "http://fcm.googleapis.com/push", "https://fcm.googleapis.com.attacker.test/push", "https://127.0.0.1/push", "https://user:pass@fcm.googleapis.com/push", "https://fcm.googleapis.com:444/push"])("recusa endpoint arbitrário %s", async (endpoint) => {
    expect(pushSubscriptionSchema.safeParse({ ...subscription(), endpoint }).success).toBe(false);
    expect((await subscribeAdminPushAction({ ...subscription(), endpoint })).ok).toBe(false);
  });

  it.each(["https://web.push.apple.com/abc", "https://updates.push.services.mozilla.com/wpush/v2/abc", subscription().endpoint])("aceita o provedor %s", (endpoint) => {
    expect(pushSubscriptionSchema.safeParse({ ...subscription(), endpoint }).success).toBe(true);
  });

  it("entrega a todos, remove inscrições vencidas e preserva falhas temporárias", async () => {
    for (const id of ["ok", "expired", "temporary"]) await subscribeAdminPushAction(subscription(id));
    vi.mocked(webpush.sendNotification).mockImplementation(async (sub) => {
      if (sub.endpoint.endsWith("expired")) throw { statusCode: 410 };
      if (sub.endpoint.endsWith("temporary")) throw { statusCode: 503 };
      return { statusCode: 201, headers: {}, body: "" };
    });
    await deliverNewBookingPush("apt-123");
    expect(webpush.sendNotification).toHaveBeenCalledTimes(3);
    const payload = JSON.parse(vi.mocked(webpush.sendNotification).mock.calls[0][1] as string);
    expect(payload).toEqual({ title: "Novo agendamento", body: expect.any(String), tag: "booking-apt-123" });
    const { db } = await getTestDatabase();
    const rows = await db.select().from(adminPushSubscriptions);
    expect(rows.map((row) => row.endpoint)).toEqual(expect.arrayContaining([subscription("ok").endpoint, subscription("temporary").endpoint]));
    expect(rows).toHaveLength(2);
  });

  it("não envia testes a endpoints que não foram cadastrados pela conta", async () => {
    expect((await testAdminPushAction(subscription().endpoint)).ok).toBe(false);
    expect(webpush.sendNotification).not.toHaveBeenCalled();
    await subscribeAdminPushAction(subscription());
    expect((await testAdminPushAction(subscription().endpoint)).ok).toBe(true);
  });

  it("funciona sem push configurado e só expõe a chave pública", async () => {
    expect(await getPushConfigurationAction()).toEqual({ ok: true, data: { publicKey } });
    vi.stubEnv("VAPID_PRIVATE_KEY", "");
    expect(getPushPublicKey()).toBeNull();
    expect((await subscribeAdminPushAction(subscription())).ok).toBe(false);
    await deliverNewBookingPush("apt-1");
    expect(webpush.sendNotification).not.toHaveBeenCalled();
  });

  it("agenda o envio após a resposta", () => {
    notifyAdminNewBooking("apt-1");
    expect(after).toHaveBeenCalledOnce();
    expect(webpush.sendNotification).not.toHaveBeenCalled();
  });
});
