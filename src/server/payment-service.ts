import "server-only";
import { STUDIO_PROFESSIONAL_ID, STUDIO_PROFESSIONAL_NAME } from "@/lib/studio";

import { and, eq, inArray } from "drizzle-orm";
import type { z } from "zod";

import { atomic, db } from "@/db";
import {
  appointments,
  paymentItems,
  paymentMethods,
  payments,
  professionals,
} from "@/db/schema";
import { formatCurrency } from "@/lib/formatters";
import {
  calculateCommission,
  paymentTotals,
  sameAmount,
  sumMethods,
} from "@/lib/payments";
import type { paymentSchema } from "@/lib/validation";
import type { Payment, PaymentItem, SessionUser } from "@/types/domain";

import { UserError } from "./errors";
import { bpsToPercent, centsToReais, percentToBps, reaisToCents } from "./mappers";

type PaymentInput = z.infer<typeof paymentSchema>;

const createId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;

export async function createPayment(
  input: PaymentInput,
  actor: SessionUser,
): Promise<Payment> {
  const ids = [...new Set(input.appointmentIds)];

  const rows = await db
    .select({
      id: appointments.id,
      status: appointments.status,
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
    .where(inArray(appointments.id, ids));

  if (rows.length !== ids.length) {
    throw new UserError("Algum atendimento selecionado não existe mais.");
  }

  if (rows.some((row) => row.status !== "completed")) {
    throw new UserError("Só é possível registrar o pagamento de atendimentos concluídos.");
  }

  const clientIds = new Set(rows.map((row) => row.clientId));
  if (clientIds.size > 1) {
    throw new UserError("Selecione atendimentos de uma mesma cliente para o recibo.");
  }

  const alreadyPaid = await db
    .select({ appointmentId: paymentItems.appointmentId })
    .from(paymentItems)
    .where(inArray(paymentItems.appointmentId, ids));

  if (alreadyPaid.length) {
    throw new UserError("Um dos atendimentos selecionados já tem pagamento registrado.");
  }

  const items: PaymentItem[] = rows.map((row) => {
    const price = centsToReais(row.priceCents);
    const commissionRate = bpsToPercent(row.commissionRateBps);
    return {
      appointmentId: row.id,
      professionalId: STUDIO_PROFESSIONAL_ID,
      professionalName: STUDIO_PROFESSIONAL_NAME,
      serviceId: row.serviceId,
      serviceName: row.serviceName,
      price,
      commissionRate,
      commission: calculateCommission(price, commissionRate),
    };
  });

  const { subtotal, total } = paymentTotals({
    items,
    discount: input.discount,
    surcharge: input.surcharge,
  });

  if (total <= 0) {
    throw new UserError("O total do pagamento precisa ser maior que zero.");
  }

  const paid = sumMethods(input.methods);
  if (!sameAmount(paid, total)) {
    throw new UserError(
      `As formas de pagamento somam ${formatCurrency(paid)}, mas o total é ${formatCurrency(total)}.`,
      { methods: "A soma das formas precisa bater com o total." },
    );
  }

  const id = createId("pay");
  const [{ clientId, clientName }] = rows;

  await atomic([
    db.insert(payments).values({
      id,
      clientId,
      clientName,
      paidAt: input.paidAt,
      subtotalCents: reaisToCents(subtotal),
      discountCents: reaisToCents(input.discount),
      surchargeCents: reaisToCents(input.surcharge),
      totalCents: reaisToCents(total),
      status: "paid",
      notes: input.notes ?? null,
      createdBy: actor.id,
    }),
    db.insert(paymentItems).values(
      items.map((item) => ({
        paymentId: id,
        appointmentId: item.appointmentId,
        professionalId: item.professionalId,
        professionalName: item.professionalName,
        serviceId: item.serviceId,
        serviceName: item.serviceName,
        priceCents: reaisToCents(item.price),
        commissionRateBps: percentToBps(item.commissionRate),
        commissionCents: reaisToCents(item.commission),
      })),
    ),
    db.insert(paymentMethods).values(
      input.methods.map((method) => ({
        paymentId: id,
        method: method.method,
        amountCents: reaisToCents(method.amount),
      })),
    ),
  ]);

  return {
    id,
    clientId,
    clientName,
    paidAt: input.paidAt,
    subtotal,
    discount: input.discount,
    surcharge: input.surcharge,
    total,
    status: "paid",
    notes: input.notes ?? null,
    items,
    methods: input.methods,
    createdAt: new Date().toISOString(),
  };
}

export async function refundPayment(id: string) {
  const updated = await db
    .update(payments)
    .set({ status: "refunded", updatedAt: new Date() })
    .where(and(eq(payments.id, id), eq(payments.status, "paid")))
    .returning({ id: payments.id });

  if (!updated.length) {
    throw new UserError("Pagamento não encontrado ou já estornado.");
  }
}

export async function deletePayment(id: string) {
  const deleted = await db
    .delete(payments)
    .where(eq(payments.id, id))
    .returning({ id: payments.id });

  if (!deleted.length) {
    throw new UserError("Pagamento não encontrado.");
  }
}
