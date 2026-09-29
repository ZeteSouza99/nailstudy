"use client";

import { ChevronRight, MessageCircle } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";

import { requestRecoveryCodeAction, verifyRecoveryCodeAction } from "@/app/public-actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDate } from "@/lib/formatters";
import { formatPhone } from "@/lib/phone";
import { firstIssueMessage, recoveryRequestSchema, recoveryVerifySchema } from "@/lib/validation";
import type { RecoveredAppointment } from "@/server/recovery-service";

type Step = "phone" | "code" | "list";

export function RecoveryFlow() {
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [appointments, setAppointments] = useState<RecoveredAppointment[]>([]);
  const [isPending, startTransition] = useTransition();

  function requestCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const parsed = recoveryRequestSchema.safeParse({ phone });
    if (!parsed.success) {
      setError(firstIssueMessage(parsed.error));
      return;
    }
    startTransition(async () => {
      const result = await requestRecoveryCodeAction(parsed.data);
      if (result.ok) setStep("code");
      else setError(result.error);
    });
  }

  function verifyCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const parsed = recoveryVerifySchema.safeParse({ phone, code });
    if (!parsed.success) {
      setError(firstIssueMessage(parsed.error));
      return;
    }
    startTransition(async () => {
      const result = await verifyRecoveryCodeAction(parsed.data);
      if (result.ok) {
        setAppointments(result.data);
        setStep("list");
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-ink-950 dark:text-ink-50 sm:text-2xl">Encontrar meu agendamento</h1>
        <p className="mt-1 text-sm text-ink-600 dark:text-ink-300">
          Enviamos um código para o seu WhatsApp para confirmar que é você.
        </p>
      </div>

      {error ? <Alert>{error}</Alert> : null}

      {step === "phone" ? (
        <form onSubmit={requestCode} className="surface-card space-y-3 p-4 sm:p-5" noValidate>
          <label className="form-label" htmlFor="recovery-phone">
            Telefone usado no agendamento
          </label>
          <input
            id="recovery-phone"
            className="form-control"
            inputMode="tel"
            autoComplete="tel"
            placeholder="(11) 91234-5678"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            onBlur={(event) => setPhone(formatPhone(event.target.value))}
            maxLength={20}
          />
          <Button type="submit" size="sm" loading={isPending}>
            <MessageCircle className="size-4" aria-hidden="true" />
            Enviar código
          </Button>
        </form>
      ) : null}

      {step === "code" ? (
        <form onSubmit={verifyCode} className="surface-card space-y-3 p-4 sm:p-5" noValidate>
          <Alert tone="info">
            Se houver agendamentos para {formatPhone(phone)}, você receberá um código de 6 dígitos em
            instantes. Ele vale por 10 minutos.
          </Alert>
          <label className="form-label" htmlFor="recovery-code">
            Código recebido
          </label>
          <input
            id="recovery-code"
            className="form-control tracking-[0.4em]"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
          />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm" loading={isPending}>
              Ver meus agendamentos
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setCode("");
                setStep("phone");
              }}
            >
              Trocar telefone
            </Button>
          </div>
        </form>
      ) : null}

      {step === "list" ? (
        <section className="surface-card overflow-hidden" aria-label="Seus agendamentos">
          {appointments.length ? (
            <ul className="divide-y divide-ink-100 dark:divide-ink-800">
              {appointments.map((appointment) => (
                <li key={appointment.path}>
                  <Link
                    href={appointment.path}
                    className="flex items-center justify-between gap-3 px-4 py-4 hover:bg-ink-50 dark:hover:bg-ink-950 sm:px-5"
                  >
                    <span className="min-w-0">
                      <span className="block font-semibold text-ink-900 dark:text-ink-50">{appointment.serviceName}</span>
                      <span className="block text-sm capitalize text-ink-600 dark:text-ink-300">
                        {formatDate(appointment.date, { weekday: "long", day: "2-digit", month: "long" })} às{" "}
                        {appointment.startTime}
                      </span>
                      <span className="block text-xs text-ink-500 dark:text-ink-400">{appointment.professionalName}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <StatusBadge kind="appointment" status={appointment.status} />
                      <ChevronRight className="size-4 text-ink-400" aria-hidden="true" />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-5 text-sm text-ink-600 dark:text-ink-300">
              Não encontramos agendamentos futuros para este telefone.{" "}
              <Link href="/agendar" className="font-semibold text-brand-700 dark:text-brand-300">
                Agendar agora
              </Link>
            </p>
          )}
        </section>
      ) : null}
    </div>
  );
}
