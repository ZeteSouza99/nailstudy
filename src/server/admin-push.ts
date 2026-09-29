import "server-only";

import { createECDH } from "node:crypto";

import { and, eq } from "drizzle-orm";
import { after } from "next/server";
import webpush from "web-push";

import { db } from "@/db";
import { adminPushSubscriptions } from "@/db/schema";
import { normalizeTime } from "@/lib/date";
import { formatDate } from "@/lib/formatters";
import type { AdminPushSubscription } from "@/lib/push-validation";
import type { Appointment } from "@/types/domain";

import { UserError } from "./errors";
import { logger } from "./logger";

function pushConfiguration() {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim();
  if (!publicKey || !privateKey || !subject) return null;
  try {
    const contact = new URL(subject);
    if (contact.protocol !== "mailto:" && contact.protocol !== "https:") return null;
    const key = createECDH("prime256v1");
    key.setPrivateKey(Buffer.from(privateKey, "base64url"));
    if (key.getPublicKey().toString("base64url") !== publicKey) return null;
    return { publicKey, privateKey, subject };
  } catch {
    return null;
  }
}

export function getPushPublicKey() {
  return pushConfiguration()?.publicKey ?? null;
}

export async function savePushSubscription(userId: string, input: AdminPushSubscription) {
  if (!getPushPublicKey()) throw new UserError("As notificações ainda não foram configuradas no servidor.");
  await db.insert(adminPushSubscriptions).values({
    endpoint: input.endpoint, userId, ...input.keys,
  }).onConflictDoUpdate({
    target: adminPushSubscriptions.endpoint,
    set: { userId, ...input.keys, updatedAt: new Date() },
  });
}

export async function removePushSubscription(userId: string, endpoint: string) {
  await db.delete(adminPushSubscriptions).where(and(
    eq(adminPushSubscriptions.endpoint, endpoint), eq(adminPushSubscriptions.userId, userId),
  ));
}

interface PushMessage {
  title: string;
  body: string;
  tag: string;
}

async function deliver(row: typeof adminPushSubscriptions.$inferSelect, message: PushMessage) {
  const vapidDetails = pushConfiguration();
  if (!vapidDetails) return false;
  try {
    await webpush.sendNotification({
      endpoint: row.endpoint,
      keys: { p256dh: row.p256dh, auth: row.auth },
    }, JSON.stringify(message), {
      vapidDetails, TTL: 60 * 60, urgency: "high", timeout: 5000,
    });
    return true;
  } catch (error) {
    const statusCode = (error as { statusCode?: number })?.statusCode;
    if (statusCode === 404 || statusCode === 410) {
      await removePushSubscription(row.userId, row.endpoint);
    }
    // O erro do provedor pode conter endpoint e chaves: não registrar o objeto completo.
    logger.warn("admin_push_failed", { statusCode: statusCode ?? null });
    return false;
  }
}

export async function sendTestPush(userId: string, endpoint: string) {
  const [row] = await db.select().from(adminPushSubscriptions).where(and(
    eq(adminPushSubscriptions.endpoint, endpoint), eq(adminPushSubscriptions.userId, userId),
  )).limit(1);
  if (!row || !await deliver(row, {
    title: "Notificações ativadas", body: "Este dispositivo pode receber novos agendamentos.", tag: "push-test",
  })) {
    throw new UserError("Não foi possível enviar o teste. Tente ativar as notificações novamente.");
  }
}

type BookingPushDetails = Pick<Appointment, "id" | "clientName" | "date" | "startTime">;

export async function deliverNewBookingPush(appointment: BookingPushDetails) {
  if (!getPushPublicKey()) return;
  const subscriptions = await db.select().from(adminPushSubscriptions);
  const date = formatDate(appointment.date, { day: "2-digit", month: "2-digit", year: "numeric" });
  await Promise.allSettled(subscriptions.map((row) => deliver(row, {
    title: "Novo agendamento",
    body: `${appointment.clientName} · ${date} às ${normalizeTime(appointment.startTime)}.`,
    tag: `booking-${appointment.id}`,
  })));
}

/** Só chamado após a transação do agendamento; falhas de push não desfazem a reserva. */
export function notifyAdminNewBooking(appointment: BookingPushDetails) {
  if (!getPushPublicKey()) return;
  const send = async () => {
    try {
      await deliverNewBookingPush(appointment);
    } catch {
      logger.warn("admin_push_dispatch_failed");
    }
  };
  try {
    after(send);
  } catch {
    void send();
  }
}
