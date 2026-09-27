import { eq } from "drizzle-orm";

import {
  appointments as mockAppointments,
  clients as mockClients,
  professionals as mockProfessionals,
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

/** Comissão de demonstração por profissional (basis points: 4000 = 40%). */
const commissionByProfessional: Record<string, number> = {
  "pro-001": 4000,
  "pro-002": 3500,
  "pro-003": 3000,
  "pro-004": 4500,
};

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

  await db
    .insert(clients)
    .values(mockClients.map((client) => ({ ...client, phoneDigits: normalizePhone(client.phone) })))
    .onConflictDoNothing();

  await db
    .insert(services)
    .values(
      mockServices.map(({ price, ...service }) => ({
        ...service,
        bufferMinutes: 0,
        priceCents: Math.round(price * 100),
      })),
    )
    .onConflictDoNothing();

  await db
    .insert(professionals)
    .values(
      mockProfessionals.map((professional) => ({
        id: professional.id,
        name: professional.name,
        role: professional.role,
        specialties: professional.specialties,
        phone: professional.phone,
        email: professional.email,
        color: professional.color,
        active: professional.active,
        workDays: professional.workDays,
        commissionRateBps: commissionByProfessional[professional.id] ?? 0,
      })),
    )
    .onConflictDoNothing();

  await db
    .insert(professionalServices)
    .values(
      mockProfessionals.flatMap((professional) =>
        professional.serviceIds.map((serviceId) => ({ professionalId: professional.id, serviceId })),
      ),
    )
    .onConflictDoNothing();

  const inserted = await db
    .insert(appointments)
    .values(
      mockAppointments.map(({ price, ...appointment }) => ({
        ...appointment,
        date: addDays(appointment.date, offset),
        priceCents: Math.round(price * 100),
        source: "staff" as const,
        accessTokenHash: withTokens ? accessTokenHashFor(appointment.id) : null,
      })),
    )
    .onConflictDoNothing()
    .returning({ id: appointments.id, status: appointments.status });

  if (inserted.length) {
    await db.insert(appointmentEvents).values(
      inserted.map((appointment) => ({
        appointmentId: appointment.id,
        kind: "created" as const,
        status: appointment.status,
        actorSource: "staff" as const,
        note: "Dados de demonstração",
      })),
    );
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
