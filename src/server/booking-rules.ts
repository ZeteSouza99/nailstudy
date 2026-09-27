import "server-only";

import { and, eq, gte, lte, ne } from "drizzle-orm";

import { db } from "@/db";
import { appointments, scheduleBlocks, services } from "@/db/schema";
import {
  getMaxBookingDate,
  hasEnoughLeadTime,
  MIN_LEAD_TIME_MINUTES,
} from "@/lib/booking";
import { getCurrentTime, getTodayKey } from "@/lib/date";
import { validateAppointment } from "@/lib/scheduling";
import type { Appointment, Professional, ScheduleBlock, Service } from "@/types/domain";

import { UserError } from "./errors";
import { toAppointment, toBlock, toService } from "./mappers";
import { getProfessional } from "./queries";

/** Agendamentos ativos e bloqueios que valem para a data: tudo que a validação precisa. */
export async function loadDayContext(
  date: string,
): Promise<{ appointments: Appointment[]; blocks: ScheduleBlock[] }> {
  const [appointmentRows, blockRows] = await Promise.all([
    db
      .select()
      .from(appointments)
      .where(and(eq(appointments.date, date), ne(appointments.status, "cancelled"))),
    db
      .select()
      .from(scheduleBlocks)
      .where(and(lte(scheduleBlocks.startDate, date), gte(scheduleBlocks.endDate, date))),
  ]);

  return {
    appointments: appointmentRows.map(toAppointment),
    blocks: blockRows.map(toBlock),
  };
}

export interface BookingRequest {
  /** O portal tem regras extras: antecedência mínima e janela máxima. */
  channel: "staff" | "portal";
  serviceId: string;
  professionalId: string;
  clientId?: string;
  date: string;
  startTime: string;
  excludeAppointmentId?: string;
}

export interface BookableSlot {
  service: Service;
  professional: Professional;
  endTime: string;
}

/**
 * Validação única de reserva, usada ao criar e ao remarcar pela equipe e
 * pelo portal. A restrição de sobreposição no banco cobre a corrida entre
 * duas requisições que passem por aqui ao mesmo tempo.
 */
export async function assertBookable(request: BookingRequest): Promise<BookableSlot> {
  const [serviceRow] = await db
    .select()
    .from(services)
    .where(eq(services.id, request.serviceId))
    .limit(1);

  if (!serviceRow || serviceRow.status !== "active") {
    throw new UserError("Serviço indisponível para agendamento.", {
      serviceId: "Serviço indisponível para agendamento.",
    });
  }

  const professional = await getProfessional(request.professionalId);

  if (!professional || !professional.active) {
    throw new UserError("Profissional indisponível.", {
      professionalId: "Profissional indisponível.",
    });
  }

  if (!professional.serviceIds.includes(serviceRow.id)) {
    throw new UserError("Esta profissional não realiza o serviço escolhido.", {
      professionalId: "Esta profissional não realiza o serviço escolhido.",
    });
  }

  const today = getTodayKey();
  const currentTime = getCurrentTime();

  if (request.channel === "portal") {
    if (!hasEnoughLeadTime(request.date, request.startTime, today, currentTime)) {
      throw new UserError(
        `Escolha um horário com pelo menos ${MIN_LEAD_TIME_MINUTES / 60} hora de antecedência.`,
      );
    }
    if (request.date > getMaxBookingDate(today)) {
      throw new UserError("Data fora do período disponível para agendamento.");
    }
  }

  const context = await loadDayContext(request.date);
  const validation = validateAppointment(
    {
      date: request.date,
      startTime: request.startTime,
      durationMinutes: serviceRow.durationMinutes,
      bufferMinutes: serviceRow.bufferMinutes,
      clientId: request.clientId,
      professionalId: professional.id,
      serviceId: serviceRow.id,
      excludeAppointmentId: request.excludeAppointmentId,
    },
    {
      professional,
      appointments: context.appointments,
      blocks: context.blocks,
      referenceDate: today,
      referenceTime: currentTime,
    },
  );

  if (!validation.valid) {
    const field =
      validation.code === "professional-conflict" ||
      validation.code === "client-conflict" ||
      validation.code === "outside-business-hours" ||
      validation.code === "outside-professional-hours" ||
      validation.code === "break-time" ||
      validation.code === "invalid-time"
        ? "startTime"
        : validation.code === "unsupported-service" ||
            validation.code === "inactive-professional"
          ? "professionalId"
          : "date";
    throw new UserError(validation.message, { [field]: validation.message });
  }

  return { service: toService(serviceRow), professional, endTime: validation.endTime };
}
