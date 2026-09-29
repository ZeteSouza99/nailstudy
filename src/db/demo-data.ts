import { STUDIO_PROFESSIONAL_ID, STUDIO_PROFESSIONAL_NAME } from "@/lib/studio";

import { eq } from "drizzle-orm";

import {
  appointments as mockAppointments,
  clients as mockClients,
  REFERENCE_TODAY,
  services as mockServices,
} from "@/data/mock-data";
import { addDays, getTodayKey, parseDateKey } from "@/lib/date";
import { normalizePhone } from "@/lib/phone";
import { accessTokenHashFor, hasTokenSecret } from "@/server/tokens";

import type { Database } from "./client";
import {
  appointmentEvents,
  appointments,
  clients,
  paymentItems,
  paymentMethods,
  payments,
  professionalServices,
  professionals,
  services,
} from "./schema";

/** Desloca os dados em semanas inteiras para a demonstração cair na semana atual. */
function weekOffsetDays() {
  const days = Math.round(
    (parseDateKey(getTodayKey()).getTime() - parseDateKey(REFERENCE_TODAY).getTime()) /
      86_400_000,
  );
  return Math.floor(days / 7) * 7;
}

export async function seedDemoData(db: Database) {
  const offset = weekOffsetDays();
  const withTokens = hasTokenSecret();

  for (const client of mockClients) {
    await db
      .insert(clients)
      .values({ ...client, phoneDigits: normalizePhone(client.phone) })
      .onConflictDoNothing();
  }

  for (const { price, ...service } of mockServices) {
    await db
      .insert(services)
      .values({
        ...service,
        bufferMinutes: 0,
        priceCents: Math.round(price * 100),
      })
      .onConflictDoNothing();
  }

  // O cadastro único é criado pela migration; o seed nunca recria uma equipe.
  for (const service of mockServices) {
    await db.insert(professionalServices).values({
      professionalId: STUDIO_PROFESSIONAL_ID, serviceId: service.id,
    }).onConflictDoNothing();
  }

  const inserted: Array<{ id: string; status: (typeof mockAppointments)[number]["status"] }> = [];
  for (const { price, ...appointment } of mockAppointments.filter((item) => item.professionalId === STUDIO_PROFESSIONAL_ID)) {
    const [created] = await db
      .insert(appointments)
      .values({
        ...appointment,
        professionalName: STUDIO_PROFESSIONAL_NAME,
        date: addDays(appointment.date, offset),
        priceCents: Math.round(price * 100),
        source: "staff" as const,
        accessTokenHash: withTokens ? accessTokenHashFor(appointment.id) : null,
      })
      .onConflictDoNothing()
      .returning({ id: appointments.id, status: appointments.status });
    if (created) inserted.push(created);
  }

  for (const appointment of inserted) {
    await db.insert(appointmentEvents).values({
        appointmentId: appointment.id,
        kind: "created" as const,
        status: appointment.status,
        actorSource: "staff" as const,
        note: "Dados de demonstração",
    });
  }

  // Recibos de demonstração para os atendimentos já concluídos.
  const completed = await db
    .select({
      id: appointments.id,
      date: appointments.date,
      clientId: appointments.clientId,
      clientName: appointments.clientName,
      serviceId: appointments.serviceId,
      serviceName: appointments.serviceName,
      professionalId: appointments.professionalId,
      professionalName: appointments.professionalName,
      priceCents: appointments.priceCents,
      commissionRateBps: professionals.commissionRateBps,
    })
    .from(appointments)
    .innerJoin(professionals, eq(professionals.id, appointments.professionalId))
    .where(eq(appointments.status, "completed"));

  for (const appointment of completed) {
    const [created] = await db
      .insert(payments)
      .values({
        id: `pay-demo-${appointment.id}`,
        clientId: appointment.clientId,
        clientName: appointment.clientName,
        paidAt: appointment.date,
        subtotalCents: appointment.priceCents,
        totalCents: appointment.priceCents,
        status: "paid",
      })
      .onConflictDoNothing()
      .returning({ id: payments.id });

    if (!created) continue;

    await db.insert(paymentItems).values({
      paymentId: created.id,
      appointmentId: appointment.id,
      professionalId: appointment.professionalId,
      professionalName: appointment.professionalName,
      serviceId: appointment.serviceId,
      serviceName: appointment.serviceName,
      priceCents: appointment.priceCents,
      commissionRateBps: appointment.commissionRateBps,
      commissionCents: Math.round((appointment.priceCents * appointment.commissionRateBps) / 10_000),
    });
    await db.insert(paymentMethods).values({
      paymentId: created.id,
      method: "pix",
      amountCents: appointment.priceCents,
    });
  }
}
