"use server";

import {
  appointmentSchema,
  blockSchema,
  clientSchema,
  idSchema,
  paymentSchema,
  professionalSchema,
  serviceSchema,
  staffRescheduleSchema,
  statusChangeSchema,
} from "@/lib/validation";
import { refreshApp, runAction } from "@/server/action";
import {
  changeAppointmentStatus,
  createStaffAppointment,
  deleteAppointment,
  rescheduleStaffAppointment,
} from "@/server/appointment-service";
import { parseInput } from "@/server/errors";
import { listBillableAppointments } from "@/server/payment-queries";
import { createPayment, deletePayment, refundPayment } from "@/server/payment-service";
import { searchClientOptions } from "@/server/queries";
import {
  createBlock,
  createClient,
  createProfessional,
  createService,
  deleteBlock,
  deleteClient,
  deleteProfessional,
  deleteService,
  updateClient,
  updateProfessional,
  updateService,
} from "@/server/registry-service";
import { requireActionUser } from "@/server/session";

export async function createClientAction(input: unknown) {
  return runAction(async () => {
    await requireActionUser("clients:manage");
    const client = await createClient(parseInput(clientSchema, input));
    refreshApp();
    return client;
  });
}

export async function updateClientAction(id: unknown, input: unknown) {
  return runAction(async () => {
    await requireActionUser("clients:manage");
    await updateClient(parseInput(idSchema, id), parseInput(clientSchema, input));
    refreshApp();
    return null;
  });
}

export async function deleteClientAction(id: unknown) {
  return runAction(async () => {
    await requireActionUser("clients:delete");
    await deleteClient(parseInput(idSchema, id));
    refreshApp();
    return null;
  });
}

export async function createServiceAction(input: unknown) {
  return runAction(async () => {
    await requireActionUser("catalog:manage");
    const service = await createService(parseInput(serviceSchema, input));
    refreshApp();
    return service;
  });
}

export async function updateServiceAction(id: unknown, input: unknown) {
  return runAction(async () => {
    await requireActionUser("catalog:manage");
    await updateService(parseInput(idSchema, id), parseInput(serviceSchema, input));
    refreshApp();
    return null;
  });
}

export async function deleteServiceAction(id: unknown) {
  return runAction(async () => {
    await requireActionUser("catalog:manage");
    await deleteService(parseInput(idSchema, id));
    refreshApp();
    return null;
  });
}

export async function createProfessionalAction(input: unknown) {
  return runAction(async () => {
    await requireActionUser("catalog:manage");
    const professional = await createProfessional(parseInput(professionalSchema, input));
    refreshApp();
    return professional;
  });
}

export async function updateProfessionalAction(id: unknown, input: unknown) {
  return runAction(async () => {
    await requireActionUser("catalog:manage");
    await updateProfessional(parseInput(idSchema, id), parseInput(professionalSchema, input));
    refreshApp();
    return null;
  });
}

export async function deleteProfessionalAction(id: unknown) {
  return runAction(async () => {
    await requireActionUser("catalog:manage");
    await deleteProfessional(parseInput(idSchema, id));
    refreshApp();
    return null;
  });
}

export async function createAppointmentAction(input: unknown) {
  return runAction(async () => {
    const actor = await requireActionUser("appointments:create");
    const appointment = await createStaffAppointment(parseInput(appointmentSchema, input), actor);
    refreshApp();
    return appointment;
  });
}

/** A permissão depende do status alvo e de quem atende; a regra fica no serviço. */
export async function changeAppointmentStatusAction(input: unknown) {
  return runAction(async () => {
    const actor = await requireActionUser();
    const appointment = await changeAppointmentStatus(parseInput(statusChangeSchema, input), actor);
    refreshApp();
    return appointment;
  });
}

export async function rescheduleAppointmentAction(input: unknown) {
  return runAction(async () => {
    const actor = await requireActionUser("appointments:manage");
    const appointment = await rescheduleStaffAppointment(
      parseInput(staffRescheduleSchema, input),
      actor,
    );
    refreshApp();
    return appointment;
  });
}

export async function deleteAppointmentAction(id: unknown) {
  return runAction(async () => {
    await requireActionUser("appointments:delete");
    await deleteAppointment(parseInput(idSchema, id));
    refreshApp();
    return null;
  });
}

export async function createBlockAction(input: unknown) {
  return runAction(async () => {
    const actor = await requireActionUser("blocks:manage");
    const result = await createBlock(parseInput(blockSchema, input), actor);
    refreshApp();
    return result;
  });
}

export async function deleteBlockAction(id: unknown) {
  return runAction(async () => {
    await requireActionUser("blocks:manage");
    await deleteBlock(parseInput(idSchema, id));
    refreshApp();
    return null;
  });
}

export async function listBillableAppointmentsAction() {
  return runAction(async () => {
    await requireActionUser("payments:manage");
    return listBillableAppointments();
  });
}

export async function createPaymentAction(input: unknown) {
  return runAction(async () => {
    const actor = await requireActionUser("payments:manage");
    const payment = await createPayment(parseInput(paymentSchema, input), actor);
    refreshApp();
    return payment;
  });
}

export async function refundPaymentAction(id: unknown) {
  return runAction(async () => {
    await requireActionUser("payments:manage");
    await refundPayment(parseInput(idSchema, id));
    refreshApp();
    return null;
  });
}

export async function deletePaymentAction(id: unknown) {
  return runAction(async () => {
    await requireActionUser("payments:manage");
    await deletePayment(parseInput(idSchema, id));
    refreshApp();
    return null;
  });
}

export async function searchClientsAction(query: unknown) {
  return runAction(async () => {
    await requireActionUser("appointments:create");
    return searchClientOptions(String(query ?? "").slice(0, 80));
  });
}
