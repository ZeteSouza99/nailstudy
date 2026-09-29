import type {
  appointments,
  clients,
  paymentItems,
  paymentMethods,
  payments,
  professionals,
  scheduleBlocks,
  services,
} from "@/db/schema";
import { normalizeTime } from "@/lib/date";
import { STUDIO_PROFESSIONAL_ID, STUDIO_PROFESSIONAL_NAME } from "@/lib/studio";
import type {
  Appointment,
  Client,
  Payment,
  Professional,
  ScheduleBlock,
  Service,
} from "@/types/domain";

export const centsToReais = (cents: number) => cents / 100;
export const reaisToCents = (value: number) => Math.round(value * 100);
export const bpsToPercent = (bps: number) => bps / 100;
export const percentToBps = (percent: number) => Math.round(percent * 100);

const optionalTime = (value: string | null) => (value ? normalizeTime(value) : null);

export function toAppointment(row: typeof appointments.$inferSelect): Appointment {
  return {
    id: row.id,
    date: row.date,
    startTime: normalizeTime(row.startTime),
    endTime: normalizeTime(row.endTime),
    bufferMinutes: row.bufferMinutes,
    clientId: row.clientId,
    clientName: row.clientName,
    serviceId: row.serviceId,
    serviceName: row.serviceName,
    // Os IDs antigos ficam arquivados no banco; toda a agenda agora ocupa Erika.
    professionalId: STUDIO_PROFESSIONAL_ID,
    professionalName: STUDIO_PROFESSIONAL_NAME,
    status: row.status,
    price: centsToReais(row.priceCents),
    notes: row.notes ?? undefined,
    source: row.source,
  };
}

export function appointmentInsertValues(appointment: Appointment) {
  return {
    id: appointment.id,
    date: appointment.date,
    startTime: appointment.startTime,
    endTime: appointment.endTime,
    bufferMinutes: appointment.bufferMinutes,
    clientId: appointment.clientId,
    clientName: appointment.clientName,
    serviceId: appointment.serviceId,
    serviceName: appointment.serviceName,
    professionalId: appointment.professionalId,
    professionalName: appointment.professionalName,
    status: appointment.status,
    priceCents: reaisToCents(appointment.price),
    notes: appointment.notes ?? null,
    source: appointment.source,
  } satisfies typeof appointments.$inferInsert;
}

export function toService(row: typeof services.$inferSelect): Service {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    description: row.description,
    durationMinutes: row.durationMinutes,
    bufferMinutes: row.bufferMinutes,
    price: centsToReais(row.priceCents),
    status: row.status,
    color: row.color,
  };
}

export function toProfessional(
  row: typeof professionals.$inferSelect,
  serviceIds: string[],
): Professional {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    specialties: row.specialties,
    serviceIds,
    phone: row.phone,
    email: row.email,
    color: row.color,
    active: row.active,
    workDays: row.workDays,
    workStart: normalizeTime(row.workStart),
    workEnd: normalizeTime(row.workEnd),
    breakStart: optionalTime(row.breakStart),
    breakEnd: optionalTime(row.breakEnd),
    commissionRate: bpsToPercent(row.commissionRateBps),
  };
}

export function toClient(row: typeof clients.$inferSelect): Client {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    birthDate: row.birthDate,
    tags: row.tags,
  };
}

export function toBlock(row: typeof scheduleBlocks.$inferSelect): ScheduleBlock {
  return {
    id: row.id,
    professionalId: null,
    startDate: row.startDate,
    endDate: row.endDate,
    startTime: optionalTime(row.startTime),
    endTime: optionalTime(row.endTime),
    reason: row.reason,
  };
}

export function toPayment(
  row: typeof payments.$inferSelect,
  items: (typeof paymentItems.$inferSelect)[],
  methods: (typeof paymentMethods.$inferSelect)[],
): Payment {
  return {
    id: row.id,
    clientId: row.clientId,
    clientName: row.clientName,
    paidAt: row.paidAt,
    subtotal: centsToReais(row.subtotalCents),
    discount: centsToReais(row.discountCents),
    surcharge: centsToReais(row.surchargeCents),
    total: centsToReais(row.totalCents),
    status: row.status,
    notes: row.notes,
    items: items.map((item) => ({
      appointmentId: item.appointmentId,
      professionalId: STUDIO_PROFESSIONAL_ID,
      professionalName: STUDIO_PROFESSIONAL_NAME,
      serviceId: item.serviceId,
      serviceName: item.serviceName,
      price: centsToReais(item.priceCents),
      commissionRate: bpsToPercent(item.commissionRateBps),
      commission: centsToReais(item.commissionCents),
    })),
    methods: methods.map((method) => ({
      method: method.method,
      amount: centsToReais(method.amountCents),
    })),
    createdAt: row.createdAt.toISOString(),
  };
}
