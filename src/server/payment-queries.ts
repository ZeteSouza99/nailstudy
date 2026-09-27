import "server-only";

import { and, asc, desc, eq, gte, inArray, isNull, lte } from "drizzle-orm";

import { db } from "@/db";
import {
  appointments,
  paymentItems,
  paymentMethods,
  payments,
  professionals,
} from "@/db/schema";
import type { BillableAppointment, Payment } from "@/types/domain";

import { bpsToPercent, centsToReais, toPayment } from "./mappers";

function groupByPayment<T extends { paymentId: string }>(rows: T[]) {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const list = map.get(row.paymentId);
    if (list) list.push(row);
    else map.set(row.paymentId, [row]);
  }
  return map;
}

export async function listPayments(from: string, to: string): Promise<Payment[]> {
  const paymentRows = await db
    .select()
    .from(payments)
    .where(and(gte(payments.paidAt, from), lte(payments.paidAt, to)))
    .orderBy(desc(payments.paidAt), desc(payments.createdAt));

  if (!paymentRows.length) return [];

  const ids = paymentRows.map((row) => row.id);
  const [itemRows, methodRows] = await Promise.all([
    db.select().from(paymentItems).where(inArray(paymentItems.paymentId, ids)).orderBy(asc(paymentItems.id)),
    db
      .select()
      .from(paymentMethods)
      .where(inArray(paymentMethods.paymentId, ids))
      .orderBy(asc(paymentMethods.id)),
  ]);

  const itemsByPayment = groupByPayment(itemRows);
  const methodsByPayment = groupByPayment(methodRows);

  return paymentRows.map((row) =>
    toPayment(row, itemsByPayment.get(row.id) ?? [], methodsByPayment.get(row.id) ?? []),
  );
}

/** Pendências de cobrança independem da data agendada e do período dos recibos. */
export async function listBillableAppointments(): Promise<BillableAppointment[]> {
  const rows = await db
    .select({
      id: appointments.id,
      date: appointments.date,
      clientId: appointments.clientId,
      clientName: appointments.clientName,
      serviceId: appointments.serviceId,
      serviceName: appointments.serviceName,
      professionalId: appointments.professionalId,
      professionalName: appointments.professionalName,
      priceCents: appointments.priceCents,
      commissionRateBps: professionals.commissionRateBps,
    })
    .from(appointments)
    .innerJoin(professionals, eq(professionals.id, appointments.professionalId))
    .leftJoin(paymentItems, eq(paymentItems.appointmentId, appointments.id))
    .where(
      and(
        eq(appointments.status, "completed"),
        isNull(paymentItems.appointmentId),
      ),
    )
    .orderBy(asc(appointments.date), asc(appointments.startTime));

  return rows.map((row) => ({
    id: row.id,
    date: row.date,
    clientId: row.clientId,
    clientName: row.clientName,
    serviceId: row.serviceId,
    serviceName: row.serviceName,
    professionalId: row.professionalId,
    professionalName: row.professionalName,
    price: centsToReais(row.priceCents),
    commissionRate: bpsToPercent(row.commissionRateBps),
  }));
}
