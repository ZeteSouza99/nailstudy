"use client";

import { CalendarDays, Clock, Sparkles, UserRound, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import {
  cancelPublicBookingAction,
  listAvailabilityAction,
  reschedulePublicBookingAction,
} from "@/app/public-actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { MIN_CANCEL_LEAD_TIME_MINUTES } from "@/lib/booking";
import { formatCurrency, formatDate } from "@/lib/formatters";
import type { BookingCatalog, PublicAppointmentView } from "@/server/portal-queries";

import { SlotPicker, type SlotOption } from "./slot-picker";

interface AppointmentManagerProps {
  appointment: PublicAppointmentView;
  catalog: Pick<BookingCatalog, "today" | "maxDate">;
}

export function AppointmentManager({ appointment, catalog }: AppointmentManagerProps) {
  const router = useRouter();
  const [mode, setMode] = useState<"view" | "reschedule">("view");
  const [date, setDate] = useState(
    appointment.date < catalog.today ? catalog.today : appointment.date,
  );
  const [slots, setSlots] = useState<SlotOption[]>([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<SlotOption | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");

  const loadSlots = useCallback(
    async (nextDate: string) => {
      setIsLoadingSlots(true);
      setError("");
      setSelectedSlot(null);

      const result = await listAvailabilityAction({
        serviceId: appointment.serviceId,
        date: nextDate,
        appointmentToken: appointment.token,
      });

      if (result.ok) {
        setSlots(result.data);
      } else {
        setSlots([]);
        setError(result.error);
      }
      setIsLoadingSlots(false);
    },
    [appointment.serviceId, appointment.token],
  );

  function startReschedule() {
    setMode("reschedule");
    void loadSlots(date);
  }

  function handleDateChange(nextDate: string) {
    setDate(nextDate);
    void loadSlots(nextDate);
  }

  async function handleCancel() {
    setError("");
    setIsSubmitting(true);
    const result = await cancelPublicBookingAction(appointment.token);
    setIsSubmitting(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    setFeedback("Agendamento cancelado.");
    router.refresh();
  }

  async function handleReschedule() {
    if (!selectedSlot) return;
    setError("");
    setIsSubmitting(true);
    const result = await reschedulePublicBookingAction({
      token: appointment.token,
      date,
      startTime: selectedSlot.startTime,
      professionalId: selectedSlot.professionalId,
    });
    setIsSubmitting(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    setFeedback("Agendamento remarcado com sucesso. Ele volta a aguardar a confirmação do estúdio.");
    setMode("view");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-950 dark:text-slate-50 sm:text-2xl">Meu agendamento</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Olá, {appointment.clientFirstName}.</p>
      </div>

      {feedback ? <Alert tone="success">{feedback}</Alert> : null}
      {error ? <Alert>{error}</Alert> : null}

      <section className="surface-card p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-slate-900 dark:text-slate-50">{appointment.serviceName}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">{formatCurrency(appointment.price)}</p>
          </div>
          <StatusBadge kind="appointment" status={appointment.status} className="shrink-0" />
        </div>

        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
            <CalendarDays className="size-4 text-slate-400" aria-hidden="true" />
            <dt className="sr-only">Data</dt>
            <dd>{formatDate(appointment.date, { weekday: "long", day: "2-digit", month: "long" })}</dd>
          </div>
          <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
            <Clock className="size-4 text-slate-400" aria-hidden="true" />
            <dt className="sr-only">Horário</dt>
            <dd>
              {appointment.startTime} às {appointment.endTime}
            </dd>
          </div>
          <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
            <UserRound className="size-4 text-slate-400" aria-hidden="true" />
            <dt className="sr-only">Profissional</dt>
            <dd>{appointment.professionalName}</dd>
          </div>
        </dl>

        {appointment.canModify ? (
          <div className="mt-5 flex flex-wrap gap-2">
            {mode === "view" ? (
              <>
                <Button size="sm" onClick={startReschedule}>
                  <Sparkles className="size-4" aria-hidden="true" />
                  Remarcar
                </Button>
                <Button size="sm" variant="danger" loading={isSubmitting} onClick={handleCancel}>
                  <X className="size-4" aria-hidden="true" />
                  Cancelar agendamento
                </Button>
              </>
            ) : (
              <Button size="sm" variant="secondary" onClick={() => setMode("view")}>
                Voltar
              </Button>
            )}
          </div>
        ) : appointment.status === "scheduled" || appointment.status === "confirmed" ? (
          <p className="mt-5 rounded-xl bg-slate-50 dark:bg-slate-950 p-3 text-xs text-slate-600 dark:text-slate-300">
            Alterações online só são possíveis com no mínimo {MIN_CANCEL_LEAD_TIME_MINUTES} minutos de
            antecedência. Para mudar algo agora, fale com o estúdio.
          </p>
        ) : null}
      </section>

      {mode === "reschedule" ? (
        <section className="surface-card p-4 sm:p-5">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Escolha o novo horário</h2>

          <SlotPicker
            id="reschedule-date"
            date={date}
            minDate={catalog.today}
            maxDate={catalog.maxDate}
            slots={slots}
            isLoading={isLoadingSlots}
            selected={selectedSlot}
            onDateChange={handleDateChange}
            onSelect={setSelectedSlot}
          />

          <div className="mt-4">
            <Button size="sm" disabled={!selectedSlot} loading={isSubmitting} onClick={handleReschedule}>
              Confirmar novo horário
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
