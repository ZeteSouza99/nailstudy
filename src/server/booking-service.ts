import "server-only";

import { and, count, eq, gte, inArray } from "drizzle-orm";
import type { z } from "zod";

import { atomic, db, type AtomicQueries } from "@/db";
import { appointmentEvents, appointments, clients, services } from "@/db/schema";
import {
  ACTIVE_APPOINTMENT_STATUSES,
  getAvailableSlots,
  MAX_ACTIVE_APPOINTMENTS_PER_CLIENT,
  MIN_CANCEL_LEAD_TIME_MINUTES,
} from "@/lib/booking";
import { getCurrentTime, getTodayKey } from "@/lib/date";
import { formatPhone, normalizePhone } from "@/lib/phone";
import type {
  availabilityQuerySchema,
  publicBookingSchema,
  rescheduleSchema,
} from "@/lib/validation";
import type { Appointment } from "@/types/domain";

import { assertBookable, loadDayContext } from "./booking-rules";
import { notifyAdminNewBooking } from "./admin-push";
import { UserError } from "./errors";
import { appointmentInsertValues } from "./mappers";
import { appointmentUrl, messages } from "./messages";
import { sendNotification } from "./notifications";
import { canClientModify, findAppointmentByToken } from "./portal-queries";
import { listProfessionals } from "./queries";
import { enforceRateLimit, rateLimits } from "./rate-limit";
import { createAccessToken, hashToken } from "./tokens";

type AvailabilityQuery = z.infer<typeof availabilityQuerySchema>;
type PublicBookingInput = z.infer<typeof publicBookingSchema>;
type RescheduleInput = z.infer<typeof rescheduleSchema>;

export interface PublicSlot {
  startTime: string;
  professionalId: string;
  professionalName: string;
}

export interface BookingConfirmation {
  token: string;
  date: string;
  startTime: string;
  endTime: string;
  serviceName: string;
  professionalName: string;
}

interface RequestContext {
  ip: string;
}

/** Devolve apenas os horários livres — nunca a agenda completa. */
export async function listAvailability(
  query: AvailabilityQuery,
  { ip }: RequestContext,
): Promise<PublicSlot[]> {
  await enforceRateLimit(`availability:ip:${ip}`, rateLimits.availabilityIp);

  const [service] = await db
    .select()
    .from(services)
    .where(eq(services.id, query.serviceId))
    .limit(1);

  if (!service || service.status !== "active") {
    throw new UserError("Serviço indisponível.");
  }

  let excludeAppointmentId: string | undefined;
  if (query.appointmentToken) {
    const [own] = await db
      .select({ id: appointments.id })
      .from(appointments)
      .where(eq(appointments.accessTokenHash, hashToken(query.appointmentToken)))
      .limit(1);
    excludeAppointmentId = own?.id;
  }

  const [allProfessionals, context] = await Promise.all([
    listProfessionals(),
    loadDayContext(query.date),
  ]);

  return getAvailableSlots({
    date: query.date,
    service,
    professionals: allProfessionals,
    appointments: context.appointments,
    blocks: context.blocks,
    today: getTodayKey(),
    currentTime: getCurrentTime(),
    excludeAppointmentId,
  }).map((slot) => ({
    startTime: slot.startTime,
    professionalId: slot.professionalId,
    professionalName: slot.professionalName,
  }));
}

export async function createPublicBooking(
  input: PublicBookingInput,
  { ip }: RequestContext,
): Promise<BookingConfirmation> {
  const phoneDigits = normalizePhone(input.phone);
  await enforceRateLimit(`booking:ip:${ip}`, rateLimits.bookingIp);
  await enforceRateLimit(`booking:phone:${phoneDigits}`, rateLimits.bookingPhone);

  const fullName = `${input.firstName} ${input.lastName}`.replace(/\s+/g, " ").trim();
  const today = getTodayKey();

  // O telefone identifica a cliente: reaproveita a ficha existente.
  const [existingClient] = await db
    .select({ id: clients.id })
    .from(clients)
    .where(eq(clients.phoneDigits, phoneDigits))
    .limit(1);

  if (existingClient) {
    const [active] = await db
      .select({ value: count() })
      .from(appointments)
      .where(
        and(
          eq(appointments.clientId, existingClient.id),
          eq(appointments.source, "portal"),
          gte(appointments.date, today),
          inArray(appointments.status, [...ACTIVE_APPOINTMENT_STATUSES]),
        ),
      );

    if ((active?.value ?? 0) >= MAX_ACTIVE_APPOINTMENTS_PER_CLIENT) {
      throw new UserError(
        "Você já possui o limite de agendamentos futuros. Entre em contato com o estúdio.",
      );
    }
  }

  const slot = await assertBookable({
    channel: "portal",
    clientId: existingClient?.id,
    serviceId: input.serviceId,
    professionalId: input.professionalId,
    date: input.date,
    startTime: input.startTime,
  });

  const clientId = existingClient?.id ?? `cli-${crypto.randomUUID()}`;
  const appointment: Appointment = {
    id: `apt-${crypto.randomUUID()}`,
    date: input.date,
    startTime: input.startTime,
    endTime: slot.endTime,
    bufferMinutes: slot.service.bufferMinutes,
    clientId,
    // O nome digitado fica no agendamento; a ficha existente não é exposta.
    clientName: fullName,
    serviceId: slot.service.id,
    serviceName: slot.service.name,
    professionalId: slot.professional.id,
    professionalName: slot.professional.name,
    // Agendamentos do portal aguardam confirmação do administrador.
    status: "scheduled",
    price: slot.service.price,
    notes: input.notes,
    source: "portal",
  };
  const token = createAccessToken(appointment.id);

  const queries: AtomicQueries = [
    db.insert(appointments).values({
      ...appointmentInsertValues(appointment),
      accessTokenHash: hashToken(token),
    }),
    db.insert(appointmentEvents).values({
      appointmentId: appointment.id,
      kind: "created",
      status: appointment.status,
      actorSource: "portal",
    }),
  ];

  await atomic(
    existingClient
      ? queries
      : [
          db.insert(clients).values({
            id: clientId,
            name: fullName,
            phone: formatPhone(input.phone),
            phoneDigits,
            tags: ["Portal"],
          }),
          ...queries,
        ],
  );

  sendNotification({
    kind: "booking-requested",
    to: phoneDigits,
    text: messages.requested(appointment, appointmentUrl(token)),
  });

  notifyAdminNewBooking(appointment.id);

  return {
    token,
    date: appointment.date,
    startTime: appointment.startTime,
    endTime: appointment.endTime,
    serviceName: appointment.serviceName,
    professionalName: appointment.professionalName,
  };
}

async function loadModifiableAppointment(token: string) {
  const appointment = await findAppointmentByToken(token);

  if (!appointment) {
    throw new UserError("Agendamento não encontrado.");
  }

  if (!canClientModify(appointment)) {
    throw new UserError(
      `Alterações online só são permitidas em agendamentos ativos, com no mínimo ${MIN_CANCEL_LEAD_TIME_MINUTES} minutos de antecedência. Entre em contato com o estúdio.`,
    );
  }

  const [client] = await db
    .select({ phoneDigits: clients.phoneDigits })
    .from(clients)
    .where(eq(clients.id, appointment.clientId))
    .limit(1);

  return { appointment, phone: client?.phoneDigits ?? "" };
}

export async function cancelPublicBooking(token: string) {
  const { appointment, phone } = await loadModifiableAppointment(token);

  await atomic([
    db
      .update(appointments)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(eq(appointments.id, appointment.id)),
    db.insert(appointmentEvents).values({
      appointmentId: appointment.id,
      kind: "status_changed",
      status: "cancelled",
      actorSource: "portal",
      note: "Cancelado pela cliente",
    }),
  ]);

  sendNotification({ kind: "booking-cancelled", to: phone, text: messages.cancelled(appointment) });
}

export async function reschedulePublicBooking(
  input: RescheduleInput,
): Promise<BookingConfirmation> {
  const { appointment, phone } = await loadModifiableAppointment(input.token);
  await enforceRateLimit(`reschedule:client:${appointment.clientId}`, rateLimits.reschedule);

  const slot = await assertBookable({
    channel: "portal",
    serviceId: appointment.serviceId,
    professionalId: input.professionalId,
    clientId: appointment.clientId,
    date: input.date,
    startTime: input.startTime,
    excludeAppointmentId: appointment.id,
  });

  await atomic([
    db
      .update(appointments)
      .set({
        date: input.date,
        startTime: input.startTime,
        endTime: slot.endTime,
        bufferMinutes: slot.service.bufferMinutes,
        professionalId: slot.professional.id,
        professionalName: slot.professional.name,
        // Remarcação pelo portal volta a aguardar o administrador.
        status: "scheduled",
        reminderSentAt: null,
        updatedAt: new Date(),
      })
      .where(eq(appointments.id, appointment.id)),
    db.insert(appointmentEvents).values({
      appointmentId: appointment.id,
      kind: "rescheduled",
      status: "scheduled",
      actorSource: "portal",
      note: `De ${appointment.date} ${appointment.startTime} para ${input.date} ${input.startTime}`,
    }),
  ]);

  const updated = {
    ...appointment,
    date: input.date,
    startTime: input.startTime,
    professionalName: slot.professional.name,
  };

  sendNotification({
    kind: "booking-rescheduled",
    to: phone,
    text: messages.rescheduled(updated, appointmentUrl(input.token)),
  });

  return {
    token: input.token,
    date: input.date,
    startTime: input.startTime,
    endTime: slot.endTime,
    serviceName: slot.service.name,
    professionalName: slot.professional.name,
  };
}
