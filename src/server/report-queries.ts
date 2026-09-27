import "server-only";

import { and, asc, count, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";

import { db } from "@/db";
import { appointments, paymentItems, paymentMethods, payments } from "@/db/schema";
import { addDays } from "@/lib/date";
import { calculateProfessionalOccupancyPercentage } from "@/lib/scheduling";
import type { PaymentMethodKind } from "@/types/domain";

import { centsToReais } from "./mappers";
import { listAppointmentsInRange, listBlocksInRange, listProfessionals } from "./queries";

export interface ReportSummary {
  received: number;
  refunded: number;
  paymentsCount: number;
  discounts: number;
  surcharges: number;
  commission: number;
  averageTicket: number;
  completedCount: number;
  cancelledCount: number;
}

export interface ReportByProfessional {
  professionalId: string;
  professionalName: string;
  itemsCount: number;
  revenue: number;
  commission: number;
  net: number;
  occupancy: number;
}

export interface ReportByService {
  serviceId: string;
  serviceName: string;
  quantity: number;
  revenue: number;
}

export interface ReportByMethod {
  method: PaymentMethodKind;
  amount: number;
  count: number;
}

export interface ReportByDay {
  date: string;
  revenue: number;
}

export interface FinancialReport {
  range: { from: string; to: string };
  summary: ReportSummary;
  byProfessional: ReportByProfessional[];
  byService: ReportByService[];
  byMethod: ReportByMethod[];
  byDay: ReportByDay[];
}

/** Datas (YYYY-MM-DD) do período, inclusive, limitadas a um ano. */
function datesBetween(from: string, to: string) {
  const dates: string[] = [];
  let cursor = from;
  for (let guard = 0; cursor <= to && guard < 366; guard += 1) {
    dates.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return dates;
}

export async function getFinancialReport(from: string, to: string): Promise<FinancialReport> {
  const paidWindow = and(
    eq(payments.status, "paid"),
    gte(payments.paidAt, from),
    lte(payments.paidAt, to),
  );

  const [
    statusRows,
    commissionRows,
    professionalRows,
    serviceRows,
    methodRows,
    dayRows,
    appointmentRows,
    professionalsList,
    rangeAppointments,
    blocks,
  ] = await Promise.all([
    db
      .select({
        status: payments.status,
        total: sql<number>`sum(${payments.totalCents})::int`,
        discount: sql<number>`sum(${payments.discountCents})::int`,
        surcharge: sql<number>`sum(${payments.surchargeCents})::int`,
        count: count(),
      })
      .from(payments)
      .where(and(gte(payments.paidAt, from), lte(payments.paidAt, to)))
      .groupBy(payments.status),
    db
      .select({ value: sql<number>`coalesce(sum(${paymentItems.commissionCents}), 0)::int` })
      .from(paymentItems)
      .innerJoin(payments, eq(payments.id, paymentItems.paymentId))
      .where(paidWindow),
    db
      .select({
        professionalId: paymentItems.professionalId,
        professionalName: paymentItems.professionalName,
        itemsCount: count(),
        revenue: sql<number>`sum(${paymentItems.priceCents})::int`,
        commission: sql<number>`sum(${paymentItems.commissionCents})::int`,
      })
      .from(paymentItems)
      .innerJoin(payments, eq(payments.id, paymentItems.paymentId))
      .where(paidWindow)
      .groupBy(paymentItems.professionalId, paymentItems.professionalName)
      .orderBy(desc(sql`sum(${paymentItems.priceCents})`)),
    db
      .select({
        serviceId: paymentItems.serviceId,
        serviceName: paymentItems.serviceName,
        quantity: count(),
        revenue: sql<number>`sum(${paymentItems.priceCents})::int`,
      })
      .from(paymentItems)
      .innerJoin(payments, eq(payments.id, paymentItems.paymentId))
      .where(paidWindow)
      .groupBy(paymentItems.serviceId, paymentItems.serviceName)
      .orderBy(desc(sql`sum(${paymentItems.priceCents})`)),
    db
      .select({
        method: paymentMethods.method,
        amount: sql<number>`sum(${paymentMethods.amountCents})::int`,
        count: count(),
      })
      .from(paymentMethods)
      .innerJoin(payments, eq(payments.id, paymentMethods.paymentId))
      .where(paidWindow)
      .groupBy(paymentMethods.method)
      .orderBy(desc(sql`sum(${paymentMethods.amountCents})`)),
    db
      .select({
        date: payments.paidAt,
        revenue: sql<number>`sum(${payments.totalCents})::int`,
      })
      .from(payments)
      .where(paidWindow)
      .groupBy(payments.paidAt)
      .orderBy(asc(payments.paidAt)),
    db
      .select({ status: appointments.status, count: count() })
      .from(appointments)
      .where(
        and(
          gte(appointments.date, from),
          lte(appointments.date, to),
          inArray(appointments.status, ["completed", "cancelled"]),
        ),
      )
      .groupBy(appointments.status),
    listProfessionals(),
    listAppointmentsInRange(from, to),
    listBlocksInRange(from, to),
  ]);

  const paidRow = statusRows.find((row) => row.status === "paid");
  const refundedRow = statusRows.find((row) => row.status === "refunded");
  const received = centsToReais(paidRow?.total ?? 0);
  const paymentsCount = paidRow?.count ?? 0;
  const completedCount =
    appointmentRows.find((row) => row.status === "completed")?.count ?? 0;
  const cancelledCount =
    appointmentRows.find((row) => row.status === "cancelled")?.count ?? 0;

  const dates = datesBetween(from, to);
  const occupancyByProfessional = new Map(
    professionalsList.map((professional) => [
      professional.id,
      calculateProfessionalOccupancyPercentage(professional, dates, rangeAppointments, blocks),
    ]),
  );

  return {
    range: { from, to },
    summary: {
      received,
      refunded: centsToReais(refundedRow?.total ?? 0),
      paymentsCount,
      discounts: centsToReais(paidRow?.discount ?? 0),
      surcharges: centsToReais(paidRow?.surcharge ?? 0),
      commission: centsToReais(commissionRows[0]?.value ?? 0),
      averageTicket: paymentsCount ? received / paymentsCount : 0,
      completedCount,
      cancelledCount,
    },
    byProfessional: professionalRows.map((row) => {
      const revenue = centsToReais(row.revenue);
      const commission = centsToReais(row.commission);
      return {
        professionalId: row.professionalId,
        professionalName: row.professionalName,
        itemsCount: row.itemsCount,
        revenue,
        commission,
        net: revenue - commission,
        occupancy: occupancyByProfessional.get(row.professionalId) ?? 0,
      };
    }),
    byService: serviceRows.map((row) => ({
      serviceId: row.serviceId,
      serviceName: row.serviceName,
      quantity: row.quantity,
      revenue: centsToReais(row.revenue),
    })),
    byMethod: methodRows.map((row) => ({
      method: row.method,
      amount: centsToReais(row.amount),
      count: row.count,
    })),
    byDay: dayRows.map((row) => ({ date: row.date, revenue: centsToReais(row.revenue) })),
  };
}
