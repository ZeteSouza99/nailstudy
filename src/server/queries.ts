import "server-only";

import { and, asc, count, eq, gte, inArray, like, lte, or, sql, type SQL } from "drizzle-orm";

import { db } from "@/db";
import {
  appointments,
  clients,
  professionalServices,
  professionals,
  scheduleBlocks,
  services,
} from "@/db/schema";
import { ACTIVE_APPOINTMENT_STATUSES } from "@/lib/booking";
import { getWeekDays } from "@/lib/date";
import { normalizeText } from "@/lib/formatters";
import { STUDIO_PROFESSIONAL_ID } from "@/lib/studio";
import type {
  Appointment,
  ClientSummary,
  Professional,
  ScheduleBlock,
  Service,
} from "@/types/domain";

import { toAppointment, toBlock, toClient, toProfessional, toService } from "./mappers";

const activeStatuses = [...ACTIVE_APPOINTMENT_STATUSES];

export async function listServices(): Promise<Service[]> {
  const rows = await db.select().from(services).orderBy(asc(services.name));
  return rows.map(toService);
}

export async function listProfessionals(): Promise<Professional[]> {
  const [rows, links] = await Promise.all([
    db.select().from(professionals).where(eq(professionals.id, STUDIO_PROFESSIONAL_ID)),
    db.select().from(professionalServices),
  ]);

  const servicesByProfessional = new Map<string, string[]>();
  for (const link of links) {
    const list = servicesByProfessional.get(link.professionalId) ?? [];
    list.push(link.serviceId);
    servicesByProfessional.set(link.professionalId, list);
  }

  return rows.map((row) => toProfessional(row, servicesByProfessional.get(row.id) ?? []));
}

export async function getProfessional(id: string): Promise<Professional | null> {
  const [row] = await db
    .select()
    .from(professionals)
    .where(eq(professionals.id, id))
    .limit(1);
  if (!row) return null;

  const links = await db
    .select({ serviceId: professionalServices.serviceId })
    .from(professionalServices)
    .where(eq(professionalServices.professionalId, id));

  return toProfessional(
    row,
    links.map((link) => link.serviceId),
  );
}

export async function listAppointmentsInRange(
  startDate: string,
  endDate: string,
): Promise<Appointment[]> {
  const rows = await db
    .select()
    .from(appointments)
    .where(
      and(
        gte(appointments.date, startDate),
        lte(appointments.date, endDate),
      ),
    )
    .orderBy(asc(appointments.date), asc(appointments.startTime));

  return rows.map(toAppointment);
}

export async function listBlocksInRange(
  startDate: string,
  endDate: string,
): Promise<ScheduleBlock[]> {
  const rows = await db
    .select()
    .from(scheduleBlocks)
    .where(and(lte(scheduleBlocks.startDate, endDate), gte(scheduleBlocks.endDate, startDate)))
    .orderBy(asc(scheduleBlocks.startDate), asc(scheduleBlocks.startTime));

  return rows.map(toBlock);
}

export async function listUpcomingBlocks(today: string): Promise<ScheduleBlock[]> {
  const rows = await db
    .select()
    .from(scheduleBlocks)
    .where(gte(scheduleBlocks.endDate, today))
    .orderBy(asc(scheduleBlocks.startDate), asc(scheduleBlocks.startTime));

  return rows.map(toBlock);
}

/** Pedidos feitos pelo portal que ainda aguardam a confirmação do administrador. */
export async function listPendingPortalAppointments(today: string): Promise<Appointment[]> {
  const rows = await db
    .select()
    .from(appointments)
    .where(
      and(
        eq(appointments.source, "portal"),
        eq(appointments.status, "scheduled"),
        gte(appointments.date, today),
      ),
    )
    .orderBy(asc(appointments.date), asc(appointments.startTime));

  return rows.map(toAppointment);
}

export interface NavigationCounters {
  todayActive: number;
  portalPending: number;
}

export async function getNavigationCounters(
  today: string,
): Promise<NavigationCounters> {
  const [todayRow] = await db
    .select({ value: count() })
    .from(appointments)
    .where(
      and(
        eq(appointments.date, today),
        inArray(appointments.status, activeStatuses),
      ),
    );

  const [pendingRow] = await db
    .select({ value: count() })
    .from(appointments)
    .where(
      and(
        eq(appointments.source, "portal"),
        eq(appointments.status, "scheduled"),
        gte(appointments.date, today),
      ),
    );

  return { todayActive: todayRow?.value ?? 0, portalPending: pendingRow?.value ?? 0 };
}

// Acentos saem antes do lower(): em bancos com locale C o lower() só trata ASCII.
const accentsFrom = "ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇáàâãäéèêëíìîïóòôõöúùûüç";
const accentsTo = "AAAAAEEEEIIIIOOOOOUUUUCaaaaaeeeeiiiiooooouuuuc";

function searchable(expression: SQL) {
  return sql`lower(translate(${expression}, ${accentsFrom}, ${accentsTo}))`;
}

/** Busca por nome, e-mail e etiquetas sem diferenciar acentos, e por trechos do telefone. */
function clientSearchCondition(term: string) {
  const trimmed = term.trim();
  if (!trimmed) return undefined;

  const pattern = `%${normalizeText(trimmed)}%`;
  const byText = or(
    sql`${searchable(sql`${clients.name}`)} like ${pattern}`,
    sql`lower(coalesce(${clients.email}, '')) like ${pattern}`,
    sql`${searchable(sql`array_to_string(${clients.tags}, ' ')`)} like ${pattern}`,
  );

  const digits = trimmed.replace(/\D/g, "");
  return digits.length >= 3 ? or(byText, like(clients.phoneDigits, `%${digits}%`)) : byText;
}

function hasUpcomingAppointment(today: string) {
  return sql<boolean>`exists (
    select 1 from ${appointments}
    where ${appointments.clientId} = ${clients.id}
      and ${appointments.date} >= ${today}
      and ${appointments.status} in ('scheduled', 'confirmed', 'in-progress')
  )`;
}

const hasCompletedAppointment = sql<boolean>`exists (
  select 1 from ${appointments}
  where ${appointments.clientId} = ${clients.id} and ${appointments.status} = 'completed'
)`;

export type ClientSegment = "todas" | "com-agenda" | "sem-agenda";

/**
 * Em selects de uma tabela só o Drizzle tira o nome da tabela das colunas do
 * SELECT; aninhar o SQL preserva "clients"."id" nas subconsultas correlacionadas.
 */
function nested<T>(query: SQL) {
  return sql<T>`${query}`;
}

export interface ClientSearchParams {
  query: string;
  segment: ClientSegment;
  page: number;
  pageSize: number;
  today: string;
}

export interface ClientStats {
  total: number;
  withUpcoming: number;
  withoutVisits: number;
}

export async function searchClients({
  query,
  segment,
  page,
  pageSize,
  today,
}: ClientSearchParams): Promise<{ items: ClientSummary[]; total: number }> {
  const upcoming = hasUpcomingAppointment(today);
  const where = and(
    clientSearchCondition(query),
    segment === "com-agenda" ? upcoming : undefined,
    segment === "sem-agenda" ? sql`not ${upcoming}` : undefined,
  );

  const lastVisit = nested<string | null>(sql`(
    select max(${appointments.date})::text from ${appointments}
    where ${appointments.clientId} = ${clients.id} and ${appointments.status} = 'completed'
  )`);
  const completedCount = nested<number>(sql`(
    select count(*)::int from ${appointments}
    where ${appointments.clientId} = ${clients.id} and ${appointments.status} = 'completed'
  )`);
  const nextSlot = nested<string | null>(sql`(
    select ${appointments.date}::text || ' ' || to_char(${appointments.startTime}, 'HH24:MI')
    from ${appointments}
    where ${appointments.clientId} = ${clients.id}
      and ${appointments.date} >= ${today}
      and ${appointments.status} in ('scheduled', 'confirmed', 'in-progress')
    order by ${appointments.date}, ${appointments.startTime}
    limit 1
  )`);

  const [rows, totals] = await Promise.all([
    db
      .select({ client: clients, lastVisit, completedCount, nextSlot })
      .from(clients)
      .where(where)
      .orderBy(asc(clients.name))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ value: count() }).from(clients).where(where),
  ]);

  return {
    total: totals[0]?.value ?? 0,
    items: rows.map((row) => {
      const [date, startTime] = row.nextSlot?.split(" ") ?? [];
      return {
        ...toClient(row.client),
        lastVisit: row.lastVisit,
        completedAppointments: Number(row.completedCount),
        nextAppointment: date && startTime ? { date, startTime } : null,
      };
    }),
  };
}

export async function getClientStats(today: string): Promise<ClientStats> {
  const upcoming = hasUpcomingAppointment(today);
  const [row] = await db
    .select({
      total: count(),
      withUpcoming: sql<number>`(count(*) filter (where ${upcoming}))::int`,
      withoutVisits: sql<number>`(count(*) filter (where not ${hasCompletedAppointment}))::int`,
    })
    .from(clients);

  return {
    total: row?.total ?? 0,
    withUpcoming: Number(row?.withUpcoming ?? 0),
    withoutVisits: Number(row?.withoutVisits ?? 0),
  };
}

export interface ClientOption {
  id: string;
  name: string;
  phone: string;
}

export async function searchClientOptions(term: string, limit = 12): Promise<ClientOption[]> {
  return db
    .select({ id: clients.id, name: clients.name, phone: clients.phone })
    .from(clients)
    .where(clientSearchCondition(term))
    .orderBy(asc(clients.name))
    .limit(limit);
}

export async function getDashboardData(today: string) {
  const weekDates = getWeekDays(today);
  const firstDay = weekDates[0];
  const lastDay = weekDates[weekDates.length - 1];

  const [weekAppointments, allProfessionals, blocks, clientStats] = await Promise.all([
    listAppointmentsInRange(firstDay, lastDay),
    listProfessionals(),
    listBlocksInRange(firstDay, lastDay),
    getClientStats(today),
  ]);

  return {
    weekDates,
    weekAppointments,
    professionals: allProfessionals.filter((professional) => professional.active),
    blocks,
    clientStats,
  };
}
