"use client";

import { CalendarCheck, Copy, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/formatters";

interface BookingConfirmedProps {
  confirmation: {
    token: string;
    date: string;
    startTime: string;
    endTime: string;
    serviceName: string;
    professionalName: string;
  };
}

export function BookingConfirmed({ confirmation }: BookingConfirmedProps) {
  const [copied, setCopied] = useState(false);
  const path = `/meu-agendamento/${confirmation.token}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${path}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="surface-card p-5 sm:p-6">
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
          <CalendarCheck className="size-5" aria-hidden="true" />
        </span>
        <div>
          <h1 className="text-lg font-bold text-slate-950 dark:text-slate-50">
            Agendamento registrado
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Aguardando confirmação da recepção.
          </p>
        </div>
      </div>

      <dl className="mt-4 space-y-2 rounded-xl bg-slate-50 dark:bg-slate-950 p-4 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-slate-500 dark:text-slate-400">Serviço</dt>
          <dd className="font-medium text-slate-900 dark:text-slate-50">
            {confirmation.serviceName}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-slate-500 dark:text-slate-400">Profissional</dt>
          <dd className="font-medium text-slate-900 dark:text-slate-50">
            {confirmation.professionalName}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-slate-500 dark:text-slate-400">Data</dt>
          <dd className="font-medium text-slate-900 dark:text-slate-50">
            {formatDate(confirmation.date, {
              weekday: "long",
              day: "2-digit",
              month: "long",
            })}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-slate-500 dark:text-slate-400">Horário</dt>
          <dd className="font-medium text-slate-900 dark:text-slate-50">
            {confirmation.startTime} às {confirmation.endTime}
          </dd>
        </div>
      </dl>

      <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">
        Guarde o link abaixo. É por ele que você acompanha, remarca ou cancela
        este atendimento.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button onClick={copyLink} variant="secondary" size="sm">
          <Copy className="size-4" aria-hidden="true" />
          {copied ? "Link copiado" : "Copiar link"}
        </Button>
        <Link
          href={path}
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-teal-700 px-3 text-sm font-semibold text-white transition-colors hover:bg-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900"
        >
          <ExternalLink className="size-4" aria-hidden="true" />
          Abrir meu agendamento
        </Link>
      </div>

      <p aria-live="polite" className="sr-only">
        {copied ? "Link copiado para a área de transferência." : ""}
      </p>
    </div>
  );
}
