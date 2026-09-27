import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { appointments } from "@/db/schema";
import {
  getMaxBookingDate,
  hasEnoughLeadTime,
  isAccessLinkExpired,
  isActiveAppointment,
  MIN_CANCEL_LEAD_TIME_MINUTES,
} from "@/lib/booking";
import { getCurrentTime, getTodayKey } from "@/lib/date";
import { accessTokenSchema } from "@/lib/validation";
import type { Appointment, Professional, Service } from "@/types/domain";

import { toAppointment } from "./mappers";
import { isNotificationDeliveryConfigured } from "./notifications";
import { listProfessionals, listServices } from "./queries";
import { hashToken } from "./tokens";

/** Serviços e profissionais expostos publicamente, sem dados sensíveis. */
export interface BookingCatalog {
  services: Array<
    Pick<Service, "id" | "name" | "category" | "description" | "durationMinutes" | "price" | "color">
  >;
  professionals: Array<Pick<Professional, "id" | "name" | "role" | "serviceIds" | "color">>;
  today: string;
  maxDate: string;
  /** A recuperação por código só faz sentido quando o código chega à cliente. */
  recoveryAvailable: boolean;
}

export function isRecoveryAvailable() {
  return isNotificationDeliveryConfigured() || process.env.NODE_ENV !== "production";
}

export async function getBookingCatalog(): Promise<BookingCatalog> {
  const [serviceList, professionalList] = await Promise.all([
    listServices(),
    listProfessionals(),
  ]);

  const activeServiceIds = new Set(
    serviceList.filter((service) => service.status === "active").map((service) => service.id),
  );

  // Só entra no portal quem está ativa e faz ao menos um serviço ativo.
  const bookable = professionalList
    .filter((professional) => professional.active)
    .map((professional) => ({
      ...professional,
      serviceIds: professional.serviceIds.filter((id) => activeServiceIds.has(id)),
    }))
    .filter((professional) => professional.serviceIds.length > 0);

  const offered = new Set(bookable.flatMap((professional) => professional.serviceIds));
  const today = getTodayKey();

  return {
    services: serviceList
      .filter((service) => offered.has(service.id))
      .map((service) => ({
        id: service.id,
        name: service.name,
        category: service.category,
        description: service.description,
        durationMinutes: service.durationMinutes,
        price: service.price,
        color: service.color,
      })),
    professionals: bookable.map((professional) => ({
      id: professional.id,
      name: professional.name,
      role: professional.role,
      serviceIds: professional.serviceIds,
      color: professional.color,
    })),
    today,
    maxDate: getMaxBookingDate(today),
    recoveryAvailable: isRecoveryAvailable(),
  };
}

export interface PublicAppointmentView {
  token: string;
  date: string;
  startTime: string;
  endTime: string;
  clientFirstName: string;
  serviceId: string;
  serviceName: string;
  professionalName: string;
  status: Appointment["status"];
  price: number;
  canModify: boolean;
}

/** Busca pelo hash do token opaco; links expiram alguns dias depois do atendimento. */
export async function findAppointmentByToken(token: string): Promise<Appointment | null> {
  const parsed = accessTokenSchema.safeParse(token);
  if (!parsed.success) return null;

  const [row] = await db
    .select()
    .from(appointments)
    .where(eq(appointments.accessTokenHash, hashToken(parsed.data)))
    .limit(1);

  if (!row) return null;

  const appointment = toAppointment(row);
  return isAccessLinkExpired(appointment.date, getTodayKey()) ? null : appointment;
}

export function canClientModify(appointment: Appointment) {
  return (
    isActiveAppointment(appointment) &&
    appointment.status !== "in-progress" &&
    hasEnoughLeadTime(
      appointment.date,
      appointment.startTime,
      getTodayKey(),
      getCurrentTime(),
      MIN_CANCEL_LEAD_TIME_MINUTES,
    )
  );
}

export async function getAppointmentByToken(
  token: string,
): Promise<PublicAppointmentView | null> {
  const appointment = await findAppointmentByToken(token);
  if (!appointment) return null;

  return {
    token: token.trim(),
    date: appointment.date,
    startTime: appointment.startTime,
    endTime: appointment.endTime,
    clientFirstName: appointment.clientName.trim().split(/\s+/)[0] ?? "",
    serviceId: appointment.serviceId,
    serviceName: appointment.serviceName,
    professionalName: appointment.professionalName,
    status: appointment.status,
    price: appointment.price,
    canModify: canClientModify(appointment),
  };
}
