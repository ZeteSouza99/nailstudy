import type {
  Appointment,
  AppointmentStatus,
  Professional,
  ProfessionalStatus,
  ScheduleBlock,
} from "@/types/domain";

export const CLINIC_OPEN_TIME = "08:00";
export const CLINIC_CLOSE_TIME = "19:00";
export const WORK_DAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const;
export const BUSINESS_DAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const;

const timePattern = /^(\d{2,}):([0-5]\d)(?::[0-5]\d)?$/;
const datePattern = /^(\d{4})-(\d{2})-(\d{2})$/;

export interface AppointmentDraft {
  date: string;
  startTime: string;
  durationMinutes: number;
  bufferMinutes?: number;
  /** Ausente na busca de horários do portal, quando a cliente ainda é anônima. */
  clientId?: string;
  professionalId: string;
  serviceId: string;
  /** Ignorado nos conflitos — usado ao remarcar o próprio agendamento. */
  excludeAppointmentId?: string;
}

export interface SchedulingContext {
  professional: Professional;
  appointments: readonly Appointment[];
  blocks?: readonly ScheduleBlock[];
  referenceDate: string;
  referenceTime?: string;
}

export type SchedulingErrorCode =
  | "invalid-date"
  | "past-date"
  | "sunday"
  | "off-duty"
  | "inactive-professional"
  | "unsupported-service"
  | "invalid-time"
  | "outside-business-hours"
  | "outside-professional-hours"
  | "break-time"
  | "blocked"
  | "professional-conflict"
  | "client-conflict";

export type SchedulingValidationResult =
  | { valid: true; endTime: string }
  | { valid: false; code: SchedulingErrorCode; message: string };

type SchedulingError = Exclude<SchedulingValidationResult, { valid: true }>;

function invalid(code: SchedulingErrorCode, message: string): SchedulingError {
  return { valid: false, code, message };
}

export function timeToMinutes(time: string) {
  const match = timePattern.exec(time);

  if (!match) {
    throw new RangeError(`Horário inválido: ${time}`);
  }

  return Number(match[1]) * 60 + Number(match[2]);
}

export function minutesToTime(totalMinutes: number) {
  if (!Number.isInteger(totalMinutes) || totalMinutes < 0) {
    throw new RangeError("O total de minutos deve ser um inteiro não negativo.");
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function calculateEndTime(startTime: string, durationMinutes: number) {
  if (!Number.isInteger(durationMinutes) || durationMinutes < 0) {
    throw new RangeError("A duração deve ser um inteiro não negativo.");
  }

  return minutesToTime(timeToMinutes(startTime) + durationMinutes);
}

export function intervalsOverlap(
  newStartTime: string,
  newEndTime: string,
  existingStartTime: string,
  existingEndTime: string,
) {
  const newStart = timeToMinutes(newStartTime);
  const newEnd = timeToMinutes(newEndTime);
  const existingStart = timeToMinutes(existingStartTime);
  const existingEnd = timeToMinutes(existingEndTime);

  return newStart < existingEnd && newEnd > existingStart;
}

export function isWithinBusinessHours(startTime: string, endTime: string) {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  return (
    start >= timeToMinutes(CLINIC_OPEN_TIME) &&
    end <= timeToMinutes(CLINIC_CLOSE_TIME) &&
    end > start
  );
}

export function isWithinProfessionalHours(
  professional: Pick<Professional, "workStart" | "workEnd">,
  startTime: string,
  endTime: string,
) {
  return (
    timeToMinutes(startTime) >= timeToMinutes(professional.workStart) &&
    timeToMinutes(endTime) <= timeToMinutes(professional.workEnd)
  );
}

export function overlapsBreak(
  professional: Pick<Professional, "breakStart" | "breakEnd">,
  startTime: string,
  endTime: string,
) {
  if (!professional.breakStart || !professional.breakEnd) return false;
  return intervalsOverlap(
    startTime,
    endTime,
    professional.breakStart,
    professional.breakEnd,
  );
}

export function blockApplies(
  block: ScheduleBlock,
  professionalId: string,
  date: string,
) {
  return (
    date >= block.startDate &&
    date <= block.endDate &&
    (block.professionalId === null || block.professionalId === professionalId)
  );
}

export function findBlockingBlock(
  blocks: readonly ScheduleBlock[],
  professionalId: string,
  date: string,
  startTime: string,
  endTime: string,
) {
  return blocks.find(
    (block) =>
      blockApplies(block, professionalId, date) &&
      (!block.startTime ||
        !block.endTime ||
        intervalsOverlap(startTime, endTime, block.startTime, block.endTime)),
  );
}

export function getWorkDayLabel(dateKey: string) {
  const match = datePattern.exec(dateKey);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day, 12);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return WORK_DAY_LABELS[date.getDay()];
}

export function validateSchedulingDate(
  date: string,
  referenceDate: string,
  workDays?: readonly string[],
  referenceTime?: string,
): SchedulingError | null {
  const dayLabel = getWorkDayLabel(date);

  if (!dayLabel || !getWorkDayLabel(referenceDate)) {
    return invalid("invalid-date", "Informe uma data válida para o agendamento.");
  }

  if (date < referenceDate) {
    return invalid(
      "past-date",
      "Não é possível agendar em uma data anterior à data de referência.",
    );
  }

  if (
    date === referenceDate &&
    referenceTime &&
    timeToMinutes(referenceTime) >= timeToMinutes(CLINIC_CLOSE_TIME)
  ) {
    return invalid("past-date", "O expediente de hoje já encerrou.");
  }

  if (dayLabel === "Dom") {
    return invalid("sunday", "O estúdio não realiza atendimentos aos domingos.");
  }

  if (workDays && !workDays.includes(dayLabel)) {
    return invalid(
      "off-duty",
      "A profissional selecionada não atende nesse dia da semana.",
    );
  }

  return null;
}

interface ConflictCandidate {
  date: string;
  startTime: string;
  endTime: string;
  bufferMinutes?: number;
  clientId?: string;
  professionalId: string;
  excludeAppointmentId?: string;
}

/**
 * A profissional fica ocupada até o fim do tempo de preparo;
 * a cliente, só até o fim do atendimento.
 */
export function findSchedulingConflict(
  candidate: ConflictCandidate,
  appointments: readonly Appointment[],
) {
  const start = timeToMinutes(candidate.startTime);
  const end = timeToMinutes(candidate.endTime);
  const busyEnd = end + (candidate.bufferMinutes ?? 0);

  for (const appointment of appointments) {
    if (
      appointment.status === "cancelled" ||
      appointment.date !== candidate.date ||
      appointment.id === candidate.excludeAppointmentId
    ) {
      continue;
    }

    let existingStart: number;
    let existingEnd: number;

    try {
      existingStart = timeToMinutes(appointment.startTime);
      existingEnd = timeToMinutes(appointment.endTime);
    } catch {
      continue;
    }

    if (appointment.professionalId === candidate.professionalId) {
      const existingBusyEnd = existingEnd + (appointment.bufferMinutes ?? 0);
      if (start < existingBusyEnd && busyEnd > existingStart) {
        return { type: "professional" as const, appointment };
      }
    }

    if (
      candidate.clientId &&
      appointment.clientId === candidate.clientId &&
      start < existingEnd &&
      end > existingStart
    ) {
      return { type: "client" as const, appointment };
    }
  }

  return null;
}

export function validateAppointment(
  draft: AppointmentDraft,
  context: SchedulingContext,
): SchedulingValidationResult {
  const { professional, appointments, referenceDate, referenceTime } = context;
  const blocks = context.blocks ?? [];

  const dateError = validateSchedulingDate(
    draft.date,
    referenceDate,
    professional.workDays,
    referenceTime,
  );
  if (dateError) return dateError;

  if (!professional.active) {
    return invalid(
      "inactive-professional",
      "A profissional selecionada não está atendendo no momento.",
    );
  }

  let startMinutes: number;
  let endTime: string;

  try {
    startMinutes = timeToMinutes(draft.startTime);
    endTime = calculateEndTime(draft.startTime, draft.durationMinutes);
  } catch {
    return invalid("invalid-time", "Informe um horário e uma duração válidos.");
  }

  if (
    draft.date === referenceDate &&
    referenceTime &&
    startMinutes < timeToMinutes(referenceTime)
  ) {
    return invalid("past-date", "Não é possível agendar em um horário que já passou.");
  }

  if (!professional.serviceIds.includes(draft.serviceId)) {
    return invalid(
      "unsupported-service",
      "A profissional selecionada não executa esse serviço.",
    );
  }

  if (!isWithinBusinessHours(draft.startTime, endTime)) {
    return invalid(
      "outside-business-hours",
      `O atendimento deve começar a partir das ${CLINIC_OPEN_TIME} e terminar até as ${CLINIC_CLOSE_TIME}.`,
    );
  }

  if (!isWithinProfessionalHours(professional, draft.startTime, endTime)) {
    return invalid(
      "outside-professional-hours",
      `A profissional atende das ${professional.workStart} às ${professional.workEnd}.`,
    );
  }

  if (overlapsBreak(professional, draft.startTime, endTime)) {
    return invalid(
      "break-time",
      `O horário coincide com o intervalo da profissional (${professional.breakStart} às ${professional.breakEnd}).`,
    );
  }

  const block = findBlockingBlock(
    blocks,
    professional.id,
    draft.date,
    draft.startTime,
    endTime,
  );
  if (block) {
    return invalid("blocked", `Agenda bloqueada nesse horário: ${block.reason}.`);
  }

  const conflict = findSchedulingConflict({ ...draft, endTime }, appointments);

  if (conflict?.type === "professional") {
    return invalid(
      "professional-conflict",
      `A profissional já possui um atendimento das ${conflict.appointment.startTime} às ${conflict.appointment.endTime}.`,
    );
  }

  if (conflict?.type === "client") {
    return invalid(
      "client-conflict",
      `A cliente já possui um atendimento das ${conflict.appointment.startTime} às ${conflict.appointment.endTime}.`,
    );
  }

  return { valid: true, endTime };
}

export function getAppointmentDurationMinutes(appointment: Appointment) {
  try {
    return Math.max(
      0,
      timeToMinutes(appointment.endTime) - timeToMinutes(appointment.startTime),
    );
  } catch {
    return 0;
  }
}

/** Soma dos minutos cobertos pelos intervalos, recortados à janela e sem contar sobreposições. */
function coveredMinutes(
  windowStart: number,
  windowEnd: number,
  intervals: Array<[number, number]>,
) {
  const clipped = intervals
    .map(([start, end]) => [Math.max(start, windowStart), Math.min(end, windowEnd)] as const)
    .filter(([start, end]) => end > start)
    .toSorted((first, second) => first[0] - second[0]);

  let total = 0;
  let cursor = windowStart;
  for (const [start, end] of clipped) {
    const from = Math.max(start, cursor);
    if (end > from) {
      total += end - from;
      cursor = end;
    }
  }
  return total;
}

/** Minutos que a profissional pode atender na data, descontando intervalo e bloqueios. */
export function getProfessionalWorkingMinutes(
  professional: Professional,
  date: string,
  blocks: readonly ScheduleBlock[] = [],
) {
  const dayLabel = getWorkDayLabel(date);
  if (
    !professional.active ||
    !dayLabel ||
    dayLabel === "Dom" ||
    !professional.workDays.includes(dayLabel)
  ) {
    return 0;
  }

  const start = Math.max(
    timeToMinutes(professional.workStart),
    timeToMinutes(CLINIC_OPEN_TIME),
  );
  const end = Math.min(
    timeToMinutes(professional.workEnd),
    timeToMinutes(CLINIC_CLOSE_TIME),
  );
  if (end <= start) return 0;

  const unavailable: Array<[number, number]> = [];
  if (professional.breakStart && professional.breakEnd) {
    unavailable.push([
      timeToMinutes(professional.breakStart),
      timeToMinutes(professional.breakEnd),
    ]);
  }

  for (const block of blocks) {
    if (!blockApplies(block, professional.id, date)) continue;
    if (!block.startTime || !block.endTime) return 0;
    unavailable.push([timeToMinutes(block.startTime), timeToMinutes(block.endTime)]);
  }

  return end - start - coveredMinutes(start, end, unavailable);
}

export function calculateDailyCapacityMinutes(
  date: string,
  professionals: readonly Professional[],
  blocks: readonly ScheduleBlock[] = [],
) {
  return professionals.reduce(
    (total, professional) =>
      total + getProfessionalWorkingMinutes(professional, date, blocks),
    0,
  );
}

export function calculateBookedMinutes(
  date: string,
  appointments: readonly Appointment[],
) {
  return appointments
    .filter(
      (appointment) =>
        appointment.date === date && appointment.status !== "cancelled",
    )
    .reduce(
      (total, appointment) => total + getAppointmentDurationMinutes(appointment),
      0,
    );
}

export function calculateOccupancyPercentage(
  date: string,
  appointments: readonly Appointment[],
  professionals: readonly Professional[],
  blocks: readonly ScheduleBlock[] = [],
) {
  const capacity = calculateDailyCapacityMinutes(date, professionals, blocks);
  if (capacity === 0) return 0;

  return Math.min(
    100,
    Math.round((calculateBookedMinutes(date, appointments) / capacity) * 100),
  );
}

export function calculateProfessionalOccupancyPercentage(
  professional: Professional,
  dates: readonly string[],
  appointments: readonly Appointment[],
  blocks: readonly ScheduleBlock[] = [],
) {
  const capacity = dates.reduce(
    (total, date) =>
      total + getProfessionalWorkingMinutes(professional, date, blocks),
    0,
  );
  if (capacity === 0) return 0;

  const booked = appointments
    .filter(
      (appointment) =>
        appointment.professionalId === professional.id &&
        dates.includes(appointment.date) &&
        appointment.status !== "cancelled",
    )
    .reduce(
      (total, appointment) => total + getAppointmentDurationMinutes(appointment),
      0,
    );

  return Math.min(100, Math.round((booked / capacity) * 100));
}

export function getProfessionalLiveStatus(
  professional: Professional,
  appointments: readonly Appointment[],
  today: string,
  currentTime: string,
  blocks: readonly ScheduleBlock[] = [],
): ProfessionalStatus {
  const now = timeToMinutes(currentTime);

  const busy = appointments.some((appointment) => {
    if (appointment.professionalId !== professional.id || appointment.date !== today) {
      return false;
    }
    if (appointment.status === "in-progress") return true;
    if (appointment.status !== "scheduled" && appointment.status !== "confirmed") {
      return false;
    }
    return (
      timeToMinutes(appointment.startTime) <= now &&
      now < timeToMinutes(appointment.endTime)
    );
  });
  if (busy) return "in-service";

  if (getProfessionalWorkingMinutes(professional, today, blocks) === 0) {
    return "off-duty";
  }

  if (
    now < timeToMinutes(professional.workStart) ||
    now >= timeToMinutes(professional.workEnd)
  ) {
    return "off-duty";
  }

  const nextMinute = minutesToTime(now + 1);
  if (
    overlapsBreak(professional, currentTime, nextMinute) ||
    findBlockingBlock(blocks, professional.id, today, currentTime, nextMinute)
  ) {
    return "off-duty";
  }

  return "available";
}

export const appointmentStatusTransitions: Record<
  AppointmentStatus,
  readonly AppointmentStatus[]
> = {
  scheduled: ["confirmed", "in-progress", "cancelled"],
  confirmed: ["in-progress", "cancelled"],
  "in-progress": ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

export function canTransitionStatus(
  from: AppointmentStatus,
  to: AppointmentStatus,
) {
  return appointmentStatusTransitions[from].includes(to);
}

export function getNextAppointmentForProfessional(
  appointments: readonly Appointment[],
  professionalId: string,
  referenceDate: string,
) {
  return appointments
    .filter(
      (appointment) =>
        appointment.professionalId === professionalId &&
        appointment.date >= referenceDate &&
        appointment.status !== "cancelled" &&
        appointment.status !== "completed",
    )
    .toSorted((first, second) =>
      `${first.date}T${first.startTime}`.localeCompare(
        `${second.date}T${second.startTime}`,
      ),
    )[0];
}
