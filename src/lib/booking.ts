import type {
  Appointment,
  AppointmentStatus,
  Professional,
  ScheduleBlock,
} from "@/types/domain";

import { addDays, getTodayKey } from "./date";
import {
  CLINIC_CLOSE_TIME,
  CLINIC_OPEN_TIME,
  minutesToTime,
  timeToMinutes,
  validateAppointment,
  validateSchedulingDate,
} from "./scheduling";

/** Intervalo entre os horários oferecidos no portal, em minutos. */
export const SLOT_STEP_MINUTES = 30;

/** Antecedência mínima entre agora e o início do atendimento. */
export const MIN_LEAD_TIME_MINUTES = 60;

/** Até quantos dias no futuro a cliente pode agendar. */
export const MAX_ADVANCE_DAYS = 60;

/**
 * Antecedência mínima para cancelar ou remarcar sem falar com o estúdio.
 *
 * Precisa ser menor ou igual à antecedência de criação: se fosse maior,
 * quem agendasse dentro dessa diferença ficaria sem poder desmarcar pelo
 * portal logo após criar o agendamento.
 */
export const MIN_CANCEL_LEAD_TIME_MINUTES = MIN_LEAD_TIME_MINUTES;

/** Quantos agendamentos futuros e ativos uma mesma cliente pode ter pelo portal. */
export const MAX_ACTIVE_APPOINTMENTS_PER_CLIENT = 3;

/** Por quantos dias depois do atendimento o link da cliente continua abrindo. */
export const ACCESS_LINK_GRACE_DAYS = 7;

export const ACTIVE_APPOINTMENT_STATUSES = [
  "scheduled",
  "confirmed",
  "in-progress",
] as const satisfies readonly AppointmentStatus[];

export function isActiveAppointment(appointment: Pick<Appointment, "status">) {
  return (ACTIVE_APPOINTMENT_STATUSES as readonly AppointmentStatus[]).includes(
    appointment.status,
  );
}

/** Último dia disponível para agendamento no portal. */
export function getMaxBookingDate(today: string = getTodayKey()) {
  return addDays(today, MAX_ADVANCE_DAYS);
}

export function isAccessLinkExpired(appointmentDate: string, today: string) {
  return addDays(appointmentDate, ACCESS_LINK_GRACE_DAYS) < today;
}

/**
 * Minutos entre agora e o horário alvo.
 * Infinito positivo para datas futuras e negativo para datas passadas.
 */
function minutesUntil(
  targetDate: string,
  targetTime: string,
  today: string,
  currentTime: string,
) {
  if (targetDate > today) {
    return Number.POSITIVE_INFINITY;
  }
  if (targetDate < today) {
    return Number.NEGATIVE_INFINITY;
  }
  return timeToMinutes(targetTime) - timeToMinutes(currentTime);
}

export function hasEnoughLeadTime(
  date: string,
  startTime: string,
  today: string,
  currentTime: string,
  minimumMinutes = MIN_LEAD_TIME_MINUTES,
) {
  return minutesUntil(date, startTime, today, currentTime) >= minimumMinutes;
}

export interface AvailableSlot {
  startTime: string;
  endTime: string;
  professionalId: string;
  professionalName: string;
}

export interface SlotService {
  id: string;
  durationMinutes: number;
  bufferMinutes: number;
}

interface AvailabilityInput {
  date: string;
  service: SlotService;
  professionals: readonly Professional[];
  appointments: readonly Appointment[];
  blocks?: readonly ScheduleBlock[];
  today: string;
  currentTime: string;
  excludeAppointmentId?: string;
}

/**
 * Calcula os horários livres de cada profissional para um serviço usando
 * as mesmas regras da validação de agendamento. Roda somente no servidor:
 * o portal recebe apenas os slots livres, nunca a agenda completa.
 */
export function getAvailableSlots({
  date,
  service,
  professionals,
  appointments,
  blocks = [],
  today,
  currentTime,
  excludeAppointmentId,
}: AvailabilityInput): AvailableSlot[] {
  if (date < today || date > getMaxBookingDate(today)) {
    return [];
  }

  const slots: AvailableSlot[] = [];

  for (const professional of professionals) {
    if (!professional.active || !professional.serviceIds.includes(service.id)) {
      continue;
    }
    if (validateSchedulingDate(date, today, professional.workDays, currentTime)) {
      continue;
    }

    const open = Math.max(
      timeToMinutes(CLINIC_OPEN_TIME),
      timeToMinutes(professional.workStart),
    );
    const close = Math.min(
      timeToMinutes(CLINIC_CLOSE_TIME),
      timeToMinutes(professional.workEnd),
    );
    const firstSlot = Math.ceil(open / SLOT_STEP_MINUTES) * SLOT_STEP_MINUTES;

    for (
      let start = firstSlot;
      start + service.durationMinutes <= close;
      start += SLOT_STEP_MINUTES
    ) {
      const startTime = minutesToTime(start);

      if (!hasEnoughLeadTime(date, startTime, today, currentTime)) {
        continue;
      }

      const result = validateAppointment(
        {
          date,
          startTime,
          durationMinutes: service.durationMinutes,
          bufferMinutes: service.bufferMinutes,
          professionalId: professional.id,
          serviceId: service.id,
          excludeAppointmentId,
        },
        {
          professional,
          appointments,
          blocks,
          referenceDate: today,
          referenceTime: currentTime,
        },
      );

      if (!result.valid) continue;

      slots.push({
        startTime,
        endTime: result.endTime,
        professionalId: professional.id,
        professionalName: professional.name,
      });
    }
  }

  return slots.sort(
    (a, b) =>
      a.startTime.localeCompare(b.startTime) ||
      a.professionalName.localeCompare(b.professionalName),
  );
}

/** Agrupa os slots por horário, listando quem está livre em cada um. */
export function groupSlotsByTime<T extends { startTime: string }>(slots: readonly T[]) {
  const grouped = new Map<string, T[]>();

  for (const slot of slots) {
    const current = grouped.get(slot.startTime);
    if (current) {
      current.push(slot);
    } else {
      grouped.set(slot.startTime, [slot]);
    }
  }

  return [...grouped.entries()]
    .sort(([first], [second]) => first.localeCompare(second))
    .map(([startTime, options]) => ({ startTime, options }));
}
