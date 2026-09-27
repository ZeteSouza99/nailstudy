import "server-only";

import { and, eq, inArray, isNull } from "drizzle-orm";

import { db } from "@/db";
import { appointments, clients } from "@/db/schema";
import { addDays, getTodayKey } from "@/lib/date";

import { ensureAccessTokens } from "./access-links";
import { toAppointment } from "./mappers";
import { appointmentUrl, messages } from "./messages";
import { deliverNotification, isNotificationDeliveryConfigured } from "./notifications";

/** Lembra, na véspera, quem tem horário amanhã. Cada agendamento recebe um lembrete só. */
export async function sendDueReminders() {
  if (!isNotificationDeliveryConfigured()) {
    return { sent: 0, pending: 0, skipped: "Envio de mensagens não configurado." };
  }

  const tomorrow = addDays(getTodayKey(), 1);
  const rows = await db
    .select({ appointment: appointments, phone: clients.phoneDigits })
    .from(appointments)
    .innerJoin(clients, eq(clients.id, appointments.clientId))
    .where(
      and(
        eq(appointments.date, tomorrow),
        inArray(appointments.status, ["scheduled", "confirmed"]),
        isNull(appointments.reminderSentAt),
      ),
    );

  const tokens = await ensureAccessTokens(rows.map((row) => row.appointment));
  let sent = 0;

  for (const row of rows) {
    const appointment = toAppointment(row.appointment);
    const delivered = await deliverNotification({
      kind: "reminder",
      to: row.phone,
      text: messages.reminder(
        appointment,
        appointmentUrl(tokens.get(appointment.id) as string),
      ),
    });

    if (delivered) {
      await db
        .update(appointments)
        .set({ reminderSentAt: new Date() })
        .where(eq(appointments.id, appointment.id));
      sent += 1;
    }
  }

  return { sent, pending: rows.length - sent, skipped: null };
}
