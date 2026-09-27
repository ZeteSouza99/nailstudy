import "server-only";

import { eq } from "drizzle-orm";
import type { z } from "zod";

import { atomic, db } from "@/db";
import { appointmentEvents, appointments, clients } from "@/db/schema";
import { isActiveAppointment } from "@/lib/booking";
import { appointmentStatusConfig } from "@/lib/domain-config";
import { canChangeAppointmentStatus } from "@/lib/permissions";
import { canTransitionStatus } from "@/lib/scheduling";
import type {
  appointmentSchema,
  staffRescheduleSchema,
  statusChangeSchema,
} from "@/lib/validation";
import type { Appointment, SessionUser } from "@/types/domain";

import { assertBookable } from "./booking-rules";
import { UserError } from "./errors";
import { appointmentInsertValues, toAppointment } from "./mappers";
import { appointmentUrl, messages } from "./messages";
import { sendNotification } from "./notifications";
import { accessTokenHashFor, createAccessToken } from "./tokens";

type AppointmentInput = z.infer<typeof appointmentSchema>;
type StatusChangeInput = z.infer<typeof statusChangeSchema>;
type StaffRescheduleInput = z.infer<typeof staffRescheduleSchema>;

async function loadAppointment(id: string) {
  const [row] = await db
    .select({ appointment: appointments, phone: clients.phoneDigits })
    .from(appointments)
    .innerJoin(clients, eq(clients.id, appointments.clientId))
    .where(eq(appointments.id, id))
    .limit(1);

  if (!row) {
    throw new UserError("Agendamento não encontrado.");
  }

  return { appointment: toAppointment(row.appointment), phone: row.phone };
}

function linkFor(appointmentId: string) {
  return appointmentUrl(createAccessToken(appointmentId));
}

export async function createStaffAppointment(
  input: AppointmentInput,
  actor: SessionUser,
): Promise<Appointment> {
  const [client] = await db
    .select({ id: clients.id, name: clients.name, phoneDigits: clients.phoneDigits })
    .from(clients)
    .where(eq(clients.id, input.clientId))
    .limit(1);

  if (!client) {
    throw new UserError("Cliente não encontrada.", { clientId: "Cliente não encontrada." });
  }

  const slot = await assertBookable({
    channel: "staff",
    clientId: client.id,
    serviceId: input.serviceId,
    professionalId: input.professionalId,
    date: input.date,
    startTime: input.startTime,
  });

  const appointment: Appointment = {
    id: `apt-${crypto.randomUUID()}`,
    date: input.date,
    startTime: input.startTime,
    endTime: slot.endTime,
    bufferMinutes: slot.service.bufferMinutes,
    clientId: client.id,
    clientName: client.name,
    serviceId: slot.service.id,
    serviceName: slot.service.name,
    professionalId: slot.professional.id,
    professionalName: slot.professional.name,
    status: "scheduled",
    price: slot.service.price,
    notes: input.notes,
    source: "staff",
  };

  await atomic([
    db.insert(appointments).values({
      ...appointmentInsertValues(appointment),
      accessTokenHash: accessTokenHashFor(appointment.id),
      createdBy: actor.id,
    }),
    db.insert(appointmentEvents).values({
      appointmentId: appointment.id,
      kind: "created",
      status: appointment.status,
      actorUserId: actor.id,
      actorSource: "staff",
    }),
  ]);

  sendNotification({
    kind: "booking-created",
    to: client.phoneDigits,
    text: messages.created(appointment, linkFor(appointment.id)),
  });

  return appointment;
}

export async function changeAppointmentStatus(
  input: StatusChangeInput,
  actor: SessionUser,
): Promise<Appointment> {
  const { appointment, phone } = await loadAppointment(input.id);

  if (!canTransitionStatus(appointment.status, input.status)) {
    throw new UserError(
      `Não é possível mudar de "${appointmentStatusConfig[appointment.status].label}" para "${appointmentStatusConfig[input.status].label}".`,
    );
  }

  if (!canChangeAppointmentStatus(actor, appointment, input.status)) {
    throw new UserError("Você não tem permissão para esta ação.");
  }

  await atomic([
    db
      .update(appointments)
      .set({ status: input.status, updatedAt: new Date() })
      .where(eq(appointments.id, appointment.id)),
    db.insert(appointmentEvents).values({
      appointmentId: appointment.id,
      kind: "status_changed",
      status: input.status,
      actorUserId: actor.id,
      actorSource: "staff",
    }),
  ]);

  const updated = { ...appointment, status: input.status };

  if (input.status === "confirmed") {
    sendNotification({
      kind: "booking-confirmed",
      to: phone,
      text: messages.confirmed(updated, linkFor(updated.id)),
    });
  } else if (input.status === "cancelled") {
    sendNotification({ kind: "booking-cancelled", to: phone, text: messages.cancelled(updated) });
  }

  return updated;
}

export async function rescheduleStaffAppointment(
  input: StaffRescheduleInput,
  actor: SessionUser,
): Promise<Appointment> {
  const { appointment, phone } = await loadAppointment(input.id);

  if (!isActiveAppointment(appointment) || appointment.status === "in-progress") {
    throw new UserError("Só é possível remarcar agendamentos que ainda não começaram.");
  }

  const slot = await assertBookable({
    channel: "staff",
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
        reminderSentAt: null,
        updatedAt: new Date(),
      })
      .where(eq(appointments.id, appointment.id)),
    db.insert(appointmentEvents).values({
      appointmentId: appointment.id,
      kind: "rescheduled",
      status: appointment.status,
      actorUserId: actor.id,
      actorSource: "staff",
      note: `De ${appointment.date} ${appointment.startTime} para ${input.date} ${input.startTime}`,
    }),
  ]);

  const updated: Appointment = {
    ...appointment,
    date: input.date,
    startTime: input.startTime,
    endTime: slot.endTime,
    bufferMinutes: slot.service.bufferMinutes,
    professionalId: slot.professional.id,
    professionalName: slot.professional.name,
  };

  sendNotification({
    kind: "booking-rescheduled",
    to: phone,
    text: messages.rescheduled(updated, linkFor(updated.id)),
  });

  return updated;
}

export async function deleteAppointment(id: string) {
  const deleted = await db
    .delete(appointments)
    .where(eq(appointments.id, id))
    .returning({ id: appointments.id });

  if (!deleted.length) {
    throw new UserError("Agendamento não encontrado.");
  }
}
