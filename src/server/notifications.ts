import "server-only";

import { after } from "next/server";

import { maskPhone } from "@/lib/phone";

import { logger, serializeError } from "./logger";

export type NotificationKind =
  | "booking-requested"
  | "booking-created"
  | "booking-confirmed"
  | "booking-cancelled"
  | "booking-rescheduled"
  | "reminder"
  | "recovery-code";

export interface NotificationMessage {
  kind: NotificationKind;
  /** Telefone só com dígitos, com DDD. */
  to: string;
  text: string;
  link?: string;
}

/**
 * Sem webhook configurado as mensagens só vão para o log. O webhook recebe
 * JSON e pode ser ligado a um provedor de WhatsApp/SMS (Z-API, Twilio, n8n...).
 */
export function isNotificationDeliveryConfigured() {
  return process.env.NOTIFY_DRIVER === "webhook" && Boolean(process.env.NOTIFY_WEBHOOK_URL);
}

export async function deliverNotification(message: NotificationMessage) {
  if (!isNotificationDeliveryConfigured()) {
    logger.info("notification_not_sent", {
      kind: message.kind,
      to: maskPhone(message.to),
      // Em produção o texto pode conter código de acesso; só aparece no log local.
      ...(process.env.NODE_ENV !== "production" ? { text: message.text } : {}),
    });
    return false;
  }

  const secret = process.env.NOTIFY_WEBHOOK_SECRET;

  try {
    const response = await fetch(process.env.NOTIFY_WEBHOOK_URL as string, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(secret ? { authorization: `Bearer ${secret}` } : {}),
      },
      body: JSON.stringify({ ...message, to: `55${message.to}` }),
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      logger.warn("notification_failed", { kind: message.kind, status: response.status });
      return false;
    }
    return true;
  } catch (error) {
    logger.warn("notification_failed", { kind: message.kind, error: serializeError(error) });
    return false;
  }
}

/** Envia depois de responder à requisição, para não atrasar quem está agendando. */
export function sendNotification(message: NotificationMessage) {
  try {
    after(() => deliverNotification(message));
  } catch {
    // Fora de uma requisição do Next (scripts e testes).
    void deliverNotification(message);
  }
}
