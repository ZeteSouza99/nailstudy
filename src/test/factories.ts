import type { Appointment, Professional, ScheduleBlock } from "@/types/domain";

export function makeProfessional(overrides: Partial<Professional> = {}): Professional {
  return {
    id: "pro-1",
    name: "Ana",
    role: "Esteticista",
    specialties: [],
    serviceIds: ["srv-1"],
    phone: "(11) 99999-9999",
    email: "ana@clinica.test",
    color: "#0f766e",
    active: true,
    workDays: ["Seg", "Ter", "Qua", "Qui", "Sex"],
    workStart: "08:00",
    workEnd: "19:00",
    breakStart: null,
    breakEnd: null,
    commissionRate: 0,
    ...overrides,
  };
}

export function makeAppointment(overrides: Partial<Appointment> = {}): Appointment {
  return {
    id: "apt-1",
    date: "2026-08-25",
    startTime: "10:00",
    endTime: "11:00",
    bufferMinutes: 0,
    clientId: "cli-1",
    clientName: "Cliente",
    serviceId: "srv-1",
    serviceName: "Serviço",
    professionalId: "pro-1",
    professionalName: "Ana",
    status: "scheduled",
    price: 100,
    source: "staff",
    ...overrides,
  };
}

export function makeBlock(overrides: Partial<ScheduleBlock> = {}): ScheduleBlock {
  return {
    id: "blk-1",
    professionalId: null,
    startDate: "2026-08-25",
    endDate: "2026-08-25",
    startTime: null,
    endTime: null,
    reason: "Feriado",
    ...overrides,
  };
}
