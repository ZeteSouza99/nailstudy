"use client";

import { CheckCircle2, X } from "lucide-react";
import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";

import { changeAppointmentStatusAction } from "@/app/actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { formatCurrency, formatDate } from "@/lib/formatters";
import type { Appointment } from "@/types/domain";

export function PendingList({ appointments }: { appointments: Appointment[] }) {
  const [visible, removeOptimistically] = useOptimistic(
    appointments,
    (current, removedId: string) => current.filter((appointment) => appointment.id !== removedId),
  );
  const [, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; message: string } | null>(
    null,
  );

  function decide(appointment: Appointment, status: "confirmed" | "cancelled") {
    setFeedback(null);
    startTransition(async () => {
      removeOptimistically(appointment.id);
      const result = await changeAppointmentStatusAction({ id: appointment.id, status });
      setFeedback(
        result.ok
          ? {
              tone: "success",
              message:
                status === "confirmed"
                  ? `Horário de ${appointment.clientName} confirmado. A cliente foi avisada.`
                  : `Pedido de ${appointment.clientName} recusado.`,
            }
          : { tone: "error", message: result.error },
      );
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Atendimentos"
        title="Pendentes do portal"
        description="Pedidos feitos pelas clientes online que aguardam a confirmação da recepção."
      />

      {feedback ? (
        <Alert tone={feedback.tone} onDismiss={() => setFeedback(null)}>
          {feedback.message}
        </Alert>
      ) : null}

      <section className="surface-card overflow-hidden" aria-label="Pedidos pendentes">
        {visible.length ? (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {visible.map((appointment) => (
              <li
                key={appointment.id}
                className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900 dark:text-slate-50">{appointment.clientName}</p>
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    {appointment.serviceName} com {appointment.professionalName} ·{" "}
                    {formatCurrency(appointment.price)}
                  </p>
                  <p className="text-xs font-medium capitalize text-slate-500 dark:text-slate-400">
                    {formatDate(appointment.date, { weekday: "long", day: "2-digit", month: "long" })}
                    , {appointment.startTime} às {appointment.endTime}
                  </p>
                  {appointment.notes ? (
                    <p className="mt-1 text-xs text-amber-800 dark:text-amber-200">“{appointment.notes}”</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button size="sm" onClick={() => decide(appointment, "confirmed")}>
                    <CheckCircle2 className="size-4" aria-hidden="true" />
                    Confirmar
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => decide(appointment, "cancelled")}>
                    <X className="size-4" aria-hidden="true" />
                    Recusar
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title="Nenhum pedido aguardando"
            description="Novos agendamentos feitos pelo portal aparecem aqui para confirmação."
          />
        )}
      </section>

      <p className="text-center text-xs text-slate-600 dark:text-slate-300">
        Para remarcar um pedido, abra-o na{" "}
        <Link href="/agenda" className="font-semibold text-teal-700 dark:text-teal-300 hover:text-teal-900 dark:hover:text-teal-200">
          agenda
        </Link>
        .
      </p>
    </div>
  );
}
