import "server-only";

import { and, count, eq, gte, inArray, lte, ne, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import type { z } from "zod";

import { atomic, db } from "@/db";
import {
  appointments,
  clients,
  professionalServices,
  professionals,
  scheduleBlocks,
  services,
} from "@/db/schema";
import { STUDIO_PROFESSIONAL_ID, STUDIO_PROFESSIONAL_NAME } from "@/lib/studio";
import type { studioSettingsSchema } from "@/lib/validation";

import { ACTIVE_APPOINTMENT_STATUSES } from "@/lib/booking";
import { getTodayKey } from "@/lib/date";
import { formatPhone, normalizePhone } from "@/lib/phone";
import type {
  blockSchema,
  clientSchema,
  professionalSchema,
  serviceSchema,
} from "@/lib/validation";
import type {
  Client,
  Professional,
  ScheduleBlock,
  Service,
  SessionUser,
} from "@/types/domain";

import { UserError } from "./errors";
import { reaisToCents } from "./mappers";

type ClientInput = z.infer<typeof clientSchema>;
type ServiceInput = z.infer<typeof serviceSchema>;
type ProfessionalInput = z.infer<typeof professionalSchema>;
type BlockInput = z.infer<typeof blockSchema>;

const createId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;

async function countAppointments(column: AnyPgColumn, id: string) {
  const [row] = await db.select({ value: count() }).from(appointments).where(eq(column, id));
  return row?.value ?? 0;
}

/** Nomes guardados nos agendamentos futuros acompanham correções no cadastro. */
function futureActiveAppointments(column: AnyPgColumn, id: string) {
  return and(
    eq(column, id),
    gte(appointments.date, getTodayKey()),
    inArray(appointments.status, [...ACTIVE_APPOINTMENT_STATUSES]),
  );
}

async function assertClientEmailAvailable(email: string | undefined, exceptId?: string) {
  if (!email) return;
  const [taken] = await db
    .select({ id: clients.id })
    .from(clients)
    .where(
      and(
        sql`lower(${clients.email}) = lower(${email})`,
        exceptId ? ne(clients.id, exceptId) : undefined,
      ),
    )
    .limit(1);

  if (taken) {
    throw new UserError("Já existe uma cliente cadastrada com esse e-mail.", {
      email: "Já existe uma cliente cadastrada com esse e-mail.",
    });
  }
}

function clientValues(input: ClientInput) {
  return {
    name: input.name,
    phone: formatPhone(input.phone),
    phoneDigits: normalizePhone(input.phone),
    email: input.email ?? null,
    birthDate: input.birthDate ?? null,
    tags: input.tags,
  };
}

export async function createClient(input: ClientInput): Promise<Client> {
  await assertClientEmailAvailable(input.email);
  const { phoneDigits, ...client } = { id: createId("cli"), ...clientValues(input) };
  await db.insert(clients).values({ ...client, phoneDigits });
  return client;
}

export async function updateClient(id: string, input: ClientInput): Promise<void> {
  await assertClientEmailAvailable(input.email, id);
  const values = clientValues(input);

  const updated = await db
    .update(clients)
    .set(values)
    .where(eq(clients.id, id))
    .returning({ id: clients.id });

  if (!updated.length) {
    throw new UserError("Cliente não encontrada.");
  }

  await db
    .update(appointments)
    .set({ clientName: values.name })
    .where(futureActiveAppointments(appointments.clientId, id));
}

export async function deleteClient(id: string) {
  if (await countAppointments(appointments.clientId, id)) {
    throw new UserError("Não é possível excluir uma cliente com atendimentos registrados.");
  }
  await db.delete(clients).where(eq(clients.id, id));
}

function serviceValues(input: ServiceInput) {
  return {
    name: input.name,
    category: input.category,
    description: input.description,
    durationMinutes: input.durationMinutes,
    bufferMinutes: input.bufferMinutes,
    priceCents: reaisToCents(input.price),
    status: input.status,
    color: input.color,
  };
}

export async function createService(input: ServiceInput): Promise<Service> {
  const service: Service = { id: createId("srv"), ...input };
  await atomic([
    db.insert(services).values({ id: service.id, ...serviceValues(input) }),
    db.insert(professionalServices).values({ professionalId: STUDIO_PROFESSIONAL_ID, serviceId: service.id }),
  ]);
  return service;
}

export async function updateService(id: string, input: ServiceInput) {
  const updated = await db
    .update(services)
    .set(serviceValues(input))
    .where(eq(services.id, id))
    .returning({ id: services.id });

  if (!updated.length) {
    throw new UserError("Serviço não encontrado.");
  }
}

export async function deleteService(id: string) {
  if (await countAppointments(appointments.serviceId, id)) {
    throw new UserError(
      "Este serviço já tem atendimentos registrados. Desative-o em vez de excluir.",
    );
  }
  await db.delete(services).where(eq(services.id, id));
}

export async function createProfessional(): Promise<Professional> {
  throw new UserError("O estúdio possui apenas Erika Queiroz. Não é possível adicionar outra profissional.");
}

export async function updateProfessional(id: string, input: ProfessionalInput) {
  if (id !== STUDIO_PROFESSIONAL_ID) throw new UserError("Somente Erika Queiroz pode ser configurada.");
  await updateStudioSettings(input);
}

export async function deleteProfessional() {
  throw new UserError("Erika Queiroz é a única profissional e não pode ser excluída.");
}

export async function updateStudioSettings(input: z.infer<typeof studioSettingsSchema>) {
  await db.update(professionals).set({
    active: input.active, workDays: input.workDays, workStart: input.workStart, workEnd: input.workEnd,
    name: STUDIO_PROFESSIONAL_NAME,
    breakStart: input.breakStart ?? null, breakEnd: input.breakEnd ?? null,
  }).where(eq(professionals.id, STUDIO_PROFESSIONAL_ID));
}

export async function createBlock(
  input: BlockInput,
  actor: SessionUser,
): Promise<{ block: ScheduleBlock; affectedAppointments: number }> {
  const block: ScheduleBlock = {
    id: createId("blk"),
    professionalId: null,
    startDate: input.startDate,
    endDate: input.endDate,
    startTime: input.allDay ? null : (input.startTime ?? null),
    endTime: input.allDay ? null : (input.endTime ?? null),
    reason: input.reason,
  };

  await db.insert(scheduleBlocks).values({ ...block, createdBy: actor.id });

  // O bloqueio não cancela nada sozinho: só avisa quantos atendimentos ficaram dentro dele.
  const [affected] = await db
    .select({ value: count() })
    .from(appointments)
    .where(
      and(
        gte(appointments.date, block.startDate),
        lte(appointments.date, block.endDate),
        inArray(appointments.status, [...ACTIVE_APPOINTMENT_STATUSES]),
        block.professionalId ? eq(appointments.professionalId, block.professionalId) : undefined,
        block.startTime && block.endTime
          ? and(
              sql`${appointments.startTime} < ${block.endTime}::time`,
              sql`${appointments.endTime} > ${block.startTime}::time`,
            )
          : undefined,
      ),
    );

  return { block, affectedAppointments: affected?.value ?? 0 };
}

export async function deleteBlock(id: string) {
  const deleted = await db
    .delete(scheduleBlocks)
    .where(eq(scheduleBlocks.id, id))
    .returning({ id: scheduleBlocks.id });

  if (!deleted.length) {
    throw new UserError("Bloqueio não encontrado.");
  }
}
