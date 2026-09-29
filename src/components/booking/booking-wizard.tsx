"use client";

import { CalendarDays, Check, ChevronLeft, Clock } from "lucide-react";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";

import { createPublicBookingAction, listAvailabilityAction } from "@/app/public-actions";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate, formatDuration } from "@/lib/formatters";
import { formatPhone } from "@/lib/phone";
import { firstIssueMessage, publicBookingSchema } from "@/lib/validation";
import type { BookingConfirmation } from "@/server/booking-service";
import type { BookingCatalog } from "@/server/portal-queries";

import { BookingConfirmed } from "./booking-confirmed";
import { SlotPicker, type SlotOption } from "./slot-picker";

type Step = "service" | "slot" | "identify" | "done";

const stepOrder: Step[] = ["service", "slot", "identify"];

const stepLabels: Record<Step, string> = {
  service: "Serviço",
  slot: "Data e horário",
  identify: "Seus dados",
  done: "Confirmado",
};



interface BookingWizardProps {
  catalog: BookingCatalog;
}

export function BookingWizard({ catalog }: BookingWizardProps) {
  const [step, setStep] = useState<Step>("service");
  const [serviceId, setServiceId] = useState("");
  const [date, setDate] = useState(catalog.today);
  const [slots, setSlots] = useState<SlotOption[]>([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<SlotOption | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState<BookingConfirmation | null>(null);

  const service = useMemo(
    () => catalog.services.find((item) => item.id === serviceId),
    [catalog.services, serviceId],
  );

  const loadSlots = useCallback(
    async (nextDate: string, selectedServiceId = serviceId) => {
      if (!selectedServiceId) return;
      setIsLoadingSlots(true);
      setError("");
      setSelectedSlot(null);

      const result = await listAvailabilityAction({
        serviceId: selectedServiceId,
        date: nextDate,
      });

      if (result.ok) {
        setSlots(result.data);
      } else {
        setSlots([]);
        setError(result.error);
      }
      setIsLoadingSlots(false);
    },
    [serviceId],
  );

  function handleDateChange(nextDate: string) {
    setDate(nextDate);
    void loadSlots(nextDate);
  }

  function goBack() {
    const index = stepOrder.indexOf(step);
    if (index > 0) {
      setError("");
      setStep(stepOrder[index - 1]);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!selectedSlot || !service) {
      setError("Escolha um horário antes de continuar.");
      return;
    }

    const parsed = publicBookingSchema.safeParse({
      firstName,
      lastName,
      phone,
      serviceId: service.id,
      professionalId: selectedSlot.professionalId,
      date,
      startTime: selectedSlot.startTime,
      notes,
    });
    if (!parsed.success) {
      setError(firstIssueMessage(parsed.error));
      return;
    }

    setIsSubmitting(true);
    const result = await createPublicBookingAction(parsed.data);
    setIsSubmitting(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setConfirmation(result.data);
    setStep("done");
  }

  if (step === "done" && confirmation) {
    return <BookingConfirmed confirmation={confirmation} />;
  }

  const currentIndex = stepOrder.indexOf(step);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-ink-950 dark:text-ink-50 sm:text-2xl">
          Agendar horário
        </h1>
        <p className="mt-1 text-sm text-ink-600 dark:text-ink-300">
          Agende seu atendimento com Erika Queiroz.
          {catalog.recoveryAvailable ? (
            <>
              {" "}
              Já agendou?{" "}
              <Link
                href="/meu-agendamento"
                className="font-semibold text-brand-700 dark:text-brand-300 hover:text-brand-900 dark:hover:text-brand-200"
              >
                Encontre seu agendamento
              </Link>
              .
            </>
          ) : null}
        </p>
      </div>

      <ol className="flex items-center gap-2" aria-label="Etapas">
        {stepOrder.map((item, index) => {
          const isDone = index < currentIndex;
          const isCurrent = index === currentIndex;
          return (
            <li key={item} className="flex flex-1 items-center gap-2">
              <span
                aria-current={isCurrent ? "step" : undefined}
                className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                  isDone
                    ? "bg-brand-700 text-white"
                    : isCurrent
                      ? "bg-brand-100 dark:bg-brand-900 text-brand-800 dark:text-brand-200 ring-2 ring-brand-600"
                      : "bg-ink-200 dark:bg-ink-700 text-ink-500 dark:text-ink-400"
                }`}
              >
                {isDone ? (
                  <Check className="size-3.5" aria-hidden="true" />
                ) : (
                  index + 1
                )}
              </span>
              <span
                className={`hidden truncate text-xs font-medium sm:block ${
                  isCurrent ? "text-ink-900 dark:text-ink-50" : "text-ink-500 dark:text-ink-400"
                }`}
              >
                {stepLabels[item]}
              </span>
              {index < stepOrder.length - 1 ? (
                <span className="h-px flex-1 bg-ink-200 dark:bg-ink-700" aria-hidden="true" />
              ) : null}
            </li>
          );
        })}
      </ol>

      {error ? (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950 px-3 py-2.5 text-sm font-medium text-rose-800 dark:text-rose-200"
        >
          {error}
        </div>
      ) : null}

      {step === "service" ? (
        <section className="surface-card p-4 sm:p-5">
          <h2 className="text-sm font-semibold text-ink-900 dark:text-ink-50">
            Qual serviço você deseja?
          </h2>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {catalog.services.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setServiceId(item.id);
                  setStep("slot");
                  void loadSlots(date, item.id);
                }}
                className="flex min-w-0 items-start gap-3 rounded-xl border border-ink-200 dark:border-ink-700 p-3 text-left transition-colors hover:border-brand-500 hover:bg-brand-50/40 dark:hover:bg-brand-950/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
              >
                <span
                  className="mt-1 size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: item.color }}
                  aria-hidden="true"
                />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-ink-900 dark:text-ink-50">
                    {item.name}
                  </span>
                  <span className="mt-0.5 block text-xs text-ink-500 dark:text-ink-400">
                    {formatDuration(item.durationMinutes)} ·{" "}
                    {formatCurrency(item.price)}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {step === "slot" ? (
        <section className="surface-card p-4 sm:p-5">
          <h2 className="text-sm font-semibold text-ink-900 dark:text-ink-50">
            Escolha a data e o horário
          </h2>

          <SlotPicker
            id="booking-date"
            date={date}
            minDate={catalog.today}
            maxDate={catalog.maxDate}
            slots={slots}
            isLoading={isLoadingSlots}
            selected={selectedSlot}
            onDateChange={handleDateChange}
            onSelect={setSelectedSlot}
          />

          <div className="form-actions mt-4">
            <Button variant="secondary" size="sm" onClick={goBack}>
              <ChevronLeft className="size-4" aria-hidden="true" />
              Voltar
            </Button>
            <Button
              size="sm"
              disabled={!selectedSlot}
              onClick={() => setStep("identify")}
            >
              Continuar
            </Button>
          </div>
        </section>
      ) : null}

      {step === "identify" && service && selectedSlot ? (
        <form onSubmit={handleSubmit} className="surface-card p-4 sm:p-5" noValidate>
          <h2 className="text-sm font-semibold text-ink-900 dark:text-ink-50">Seus dados</h2>

          <dl className="mt-3 space-y-1 rounded-xl bg-ink-50 dark:bg-ink-950 p-3 text-sm">
            <div className="flex items-center gap-2 text-ink-700 dark:text-ink-200">
              <CalendarDays className="size-4 text-ink-400" aria-hidden="true" />
              <dt className="sr-only">Data</dt>
              <dd>
                {formatDate(date, {
                  weekday: "long",
                  day: "2-digit",
                  month: "long",
                })}
              </dd>
            </div>
            <div className="flex items-center gap-2 text-ink-700 dark:text-ink-200">
              <Clock className="size-4 text-ink-400" aria-hidden="true" />
              <dt className="sr-only">Horário</dt>
              <dd>
                {selectedSlot.startTime} · {service.name} ·{" "}
                {selectedSlot.professionalName}
              </dd>
            </div>
          </dl>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="form-label" htmlFor="first-name">
                Nome
              </label>
              <input
                id="first-name"
                className="form-control"
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                required
                autoComplete="given-name"
                maxLength={60}
              />
            </div>
            <div>
              <label className="form-label" htmlFor="last-name">
                Sobrenome
              </label>
              <input
                id="last-name"
                className="form-control"
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                required
                autoComplete="family-name"
                maxLength={60}
              />
            </div>
          </div>

          <div className="mt-3">
            <label className="form-label" htmlFor="phone">
              Telefone (WhatsApp)
            </label>
            <input
              id="phone"
              className="form-control"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              onBlur={(event) => setPhone(formatPhone(event.target.value))}
              inputMode="tel"
              autoComplete="tel"
              placeholder="(11) 91234-5678"
              required
              maxLength={20}
            />
          </div>

          <div className="mt-3">
            <label className="form-label" htmlFor="notes">
              Observação (opcional)
            </label>
            <textarea
              id="notes"
              className="form-control"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={2}
              maxLength={300}
            />
          </div>

          <p className="mt-3 text-xs text-ink-500 dark:text-ink-400">
            Seu agendamento fica pendente até o estúdio confirmar. Você recebe
            um link para acompanhar, remarcar ou cancelar.
          </p>

          <div className="form-actions mt-4">
            <Button variant="secondary" size="sm" onClick={goBack} type="button">
              <ChevronLeft className="size-4" aria-hidden="true" />
              Voltar
            </Button>
            <Button type="submit" size="sm" loading={isSubmitting}>
              Confirmar agendamento
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
