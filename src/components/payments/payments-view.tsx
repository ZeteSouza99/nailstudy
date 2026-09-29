"use client";

import { CircleDollarSign, Plus, Receipt, RotateCcw, Trash2, Wallet } from "lucide-react";
import { useState } from "react";

import { deletePaymentAction, refundPaymentAction } from "@/app/actions";
import { PeriodFilter } from "@/components/finance/period-filter";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { cn, formatCurrency, formatDate } from "@/lib/formatters";
import { PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS } from "@/lib/payments";
import type { BillableAppointment, Payment } from "@/types/domain";

import { PaymentForm } from "./payment-form";

interface PaymentsViewProps {
  payments: Payment[];
  billable: BillableAppointment[];
  from: string;
  to: string;
  today: string;
  canManage: boolean;
  openNew: boolean;
}

const dateFormat = { day: "2-digit", month: "short", year: "numeric" } as const;

function methodsSummary(payment: Payment) {
  return payment.methods
    .map((entry) => `${PAYMENT_METHOD_LABELS[entry.method]} ${formatCurrency(entry.amount)}`)
    .join(" · ");
}

export function PaymentsView({
  payments,
  billable,
  from,
  to,
  today,
  canManage,
  openNew,
}: PaymentsViewProps) {
  const [isCreating, setIsCreating] = useState(openNew);
  const [refunding, setRefunding] = useState<Payment | null>(null);
  const [removing, setRemoving] = useState<Payment | null>(null);
  const [feedback, setFeedback] = useState("");

  const received = payments
    .filter((payment) => payment.status === "paid")
    .reduce((sum, payment) => sum + payment.total, 0);
  const paidCount = payments.filter((payment) => payment.status === "paid").length;
  const billableTotal = billable.reduce((sum, item) => sum + item.price, 0);

  const stats = [
    {
      label: "Recebido no período",
      value: formatCurrency(received, true),
      detail: `${paidCount} recibo(s)`,
      icon: CircleDollarSign,
    },
    {
      label: "A receber",
      value: formatCurrency(billableTotal, true),
      detail: `${billable.length} atendimento(s) concluído(s)`,
      icon: Receipt,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Financeiro"
        title="Pagamentos"
        description="Registre o que foi pago por atendimento, com formas combinadas e comissão de quem atendeu."
        actions={
          canManage ? (
            <Button onClick={() => setIsCreating(true)}>
              <Plus className="size-4" aria-hidden="true" />
              Registrar pagamento
            </Button>
          ) : null
        }
      />

      {feedback ? (
        <Alert tone="success" onDismiss={() => setFeedback("")}>
          {feedback}
        </Alert>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2" aria-label="Resumo de pagamentos">
        {stats.map((stat) => (
          <article key={stat.label} className="surface-card flex items-center gap-4 p-4">
            <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 dark:bg-brand-950 text-brand-700 dark:text-brand-300">
              <stat.icon className="size-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-2xl font-extrabold text-ink-950 dark:text-ink-50">{stat.value}</p>
              <p className="text-sm font-medium text-ink-600 dark:text-ink-300">{stat.label}</p>
              <p className="text-xs text-ink-500 dark:text-ink-400">{stat.detail}</p>
            </div>
          </article>
        ))}
      </section>

      <PeriodFilter from={from} to={to} />

      {billable.length ? (
        <section className="surface-card p-4" aria-label="Aguardando pagamento">
          <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h2 className="font-semibold text-ink-900 dark:text-ink-50">Aguardando pagamento</h2>
              <p className="text-xs text-ink-500 dark:text-ink-400">
                Atendimentos concluídos que ainda não entraram num recibo.
              </p>
            </div>
            {canManage ? (
              <Button size="sm" variant="secondary" onClick={() => setIsCreating(true)}>
                <Wallet className="size-4" aria-hidden="true" />
                Registrar
              </Button>
            ) : null}
          </div>
          <ul className="mt-3 divide-y divide-ink-100 dark:divide-ink-800 text-sm">
            {billable.slice(0, 8).map((item) => (
              <li key={item.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 py-3 sm:flex sm:justify-between">
                <span className="col-span-2 min-w-0 break-words text-ink-700 dark:text-ink-200 sm:flex-1">
                  {item.clientName} · {item.serviceName} · {item.professionalName}
                </span>
                <span className="shrink-0 text-xs text-ink-500 dark:text-ink-400">{formatDate(item.date)}</span>
                <span className="shrink-0 text-right font-semibold text-ink-900 dark:text-ink-50">
                  {formatCurrency(item.price)}
                </span>
              </li>
            ))}
          </ul>
          {billable.length > 8 ? (
            <p className="mt-2 text-xs text-ink-500 dark:text-ink-400">
              e mais {billable.length - 8} atendimento(s). Abra “Registrar pagamento” para ver todos.
            </p>
          ) : null}
        </section>
      ) : null}

      <section className="space-y-3" aria-label="Recibos do período">
        <h2 className="text-sm font-bold uppercase tracking-wide text-ink-400">
          Recibos do período
        </h2>
        {payments.length ? (
          payments.map((payment) => (
            <article key={payment.id} className="surface-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 break-words">
                    <p className="font-semibold text-ink-900 dark:text-ink-50">{payment.clientName}</p>
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset",
                        payment.status === "paid"
                          ? "bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 ring-emerald-200 dark:ring-emerald-800"
                          : "bg-ink-100 dark:bg-ink-800 text-ink-600 dark:text-ink-300 ring-ink-200 dark:ring-ink-700",
                      )}
                    >
                      {PAYMENT_STATUS_LABELS[payment.status]}
                    </span>
                  </div>
                  <p className="text-xs text-ink-500 dark:text-ink-400">
                    {formatDate(payment.paidAt, dateFormat)} · {methodsSummary(payment)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-extrabold text-ink-950 dark:text-ink-50">
                    {formatCurrency(payment.total)}
                  </p>
                  {payment.discount || payment.surcharge ? (
                    <p className="text-xs text-ink-500 dark:text-ink-400">
                      Subtotal {formatCurrency(payment.subtotal)}
                      {payment.discount ? ` · −${formatCurrency(payment.discount)}` : ""}
                      {payment.surcharge ? ` · +${formatCurrency(payment.surcharge)}` : ""}
                    </p>
                  ) : null}
                </div>
              </div>

              <ul className="mt-3 space-y-1 border-t border-ink-100 dark:border-ink-800 pt-3 text-sm">
                {payment.items.map((item) => (
                  <li key={item.appointmentId} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 py-2 sm:flex sm:justify-between">
                    <span className="col-span-2 min-w-0 break-words text-ink-600 dark:text-ink-300 sm:flex-1">
                      {item.serviceName} · {item.professionalName}
                    </span>
                    <span className="text-xs text-ink-500 dark:text-ink-400 sm:shrink-0">
                      {item.commission
                        ? `comissão ${formatCurrency(item.commission)} (${item.commissionRate}%)`
                        : "sem comissão"}
                    </span>
                    <span className="w-20 shrink-0 text-right font-semibold text-ink-900 dark:text-ink-50">
                      {formatCurrency(item.price)}
                    </span>
                  </li>
                ))}
              </ul>

              {payment.notes ? (
                <p className="mt-2 break-words rounded-lg bg-amber-50 dark:bg-amber-950 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
                  {payment.notes}
                </p>
              ) : null}

              {canManage ? (
                <div className="mt-3 flex justify-end gap-2">
                  {payment.status === "paid" ? (
                    <Button size="sm" variant="secondary" onClick={() => setRefunding(payment)}>
                      <RotateCcw className="size-4" aria-hidden="true" />
                      Estornar
                    </Button>
                  ) : null}
                  <Button size="sm" variant="ghost" onClick={() => setRemoving(payment)}>
                    <Trash2 className="size-4" aria-hidden="true" />
                    Excluir
                  </Button>
                </div>
              ) : null}
            </article>
          ))
        ) : (
          <div className="surface-card overflow-hidden">
            <EmptyState
              title="Nenhum recibo no período"
              description="Ajuste o período acima ou registre um novo pagamento."
            />
          </div>
        )}
      </section>

      {canManage ? (
        <>
          <Modal
            open={isCreating}
            onClose={() => setIsCreating(false)}
            title="Registrar pagamento"
            description="Escolha os atendimentos, as formas de pagamento e os ajustes."
          >
            {isCreating ? (
              <PaymentForm
                today={today}
                onCancel={() => setIsCreating(false)}
                onDone={(message) => {
                  setIsCreating(false);
                  setFeedback(message);
                }}
              />
            ) : null}
          </Modal>

          <ConfirmDialog
            open={refunding !== null}
            title="Estornar pagamento?"
            description="O recibo fica marcado como estornado e sai do total recebido. O histórico é mantido."
            confirmLabel="Estornar"
            onConfirm={() => refundPaymentAction(refunding?.id)}
            onClose={() => setRefunding(null)}
            onConfirmed={() => {
              setRefunding(null);
              setFeedback("Pagamento estornado.");
            }}
          />

          <ConfirmDialog
            open={removing !== null}
            title="Excluir pagamento?"
            description="O recibo é apagado e os atendimentos voltam a aparecer como a receber."
            confirmLabel="Excluir"
            onConfirm={() => deletePaymentAction(removing?.id)}
            onClose={() => setRemoving(null)}
            onConfirmed={() => {
              setRemoving(null);
              setFeedback("Pagamento excluído.");
            }}
          />
        </>
      ) : null}
    </div>
  );
}
