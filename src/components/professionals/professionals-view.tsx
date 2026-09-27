"use client";

import {
  BriefcaseMedical,
  CalendarClock,
  Gauge,
  Mail,
  Phone,
  Plus,
  UserRoundCheck,
  UsersRound,
} from "lucide-react";
import { useMemo, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { SearchInput } from "@/components/ui/search-input";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn, formatDate, normalizeText } from "@/lib/formatters";
import {
  BUSINESS_DAYS,
  calculateProfessionalOccupancyPercentage,
  getNextAppointmentForProfessional,
  getProfessionalLiveStatus,
} from "@/lib/scheduling";
import type {
  Appointment,
  Professional,
  ProfessionalStatus,
  ScheduleBlock,
  Service,
} from "@/types/domain";

import { ProfessionalForm, suggestColor } from "./professional-form";

type StatusFilter = "all" | ProfessionalStatus | "inactive";

interface ProfessionalsViewProps {
  professionals: Professional[];
  services: Service[];
  appointments: Appointment[];
  blocks: ScheduleBlock[];
  weekDates: string[];
  today: string;
  currentTime: string;
  canManage: boolean;
}

export function ProfessionalsView({
  professionals,
  services,
  appointments,
  blocks,
  weekDates,
  today,
  currentTime,
  canManage,
}: ProfessionalsViewProps) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [editing, setEditing] = useState<Professional | "new" | null>(null);
  const [feedback, setFeedback] = useState("");

  const details = useMemo(
    () =>
      new Map(
        professionals.map((professional) => [
          professional.id,
          {
            liveStatus: getProfessionalLiveStatus(professional, appointments, today, currentTime, blocks),
            occupancy: calculateProfessionalOccupancyPercentage(professional, weekDates, appointments, blocks),
            next: getNextAppointmentForProfessional(appointments, professional.id, today),
          },
        ]),
      ),
    [appointments, blocks, currentTime, professionals, today, weekDates],
  );

  const activeProfessionals = professionals.filter((professional) => professional.active);
  const workingNow = activeProfessionals.filter(
    (professional) => details.get(professional.id)?.liveStatus !== "off-duty",
  ).length;
  const averageOccupancy = activeProfessionals.length
    ? Math.round(
        activeProfessionals.reduce(
          (sum, professional) => sum + (details.get(professional.id)?.occupancy ?? 0),
          0,
        ) / activeProfessionals.length,
      )
    : 0;

  const filteredProfessionals = useMemo(() => {
    const normalizedQuery = normalizeText(query);
    return professionals.filter((professional) => {
      const searchable = normalizeText(
        `${professional.name} ${professional.role} ${professional.specialties.join(" ")}`,
      );
      const matchesStatus =
        status === "all" ||
        (status === "inactive"
          ? !professional.active
          : professional.active && details.get(professional.id)?.liveStatus === status);
      return searchable.includes(normalizedQuery) && matchesStatus;
    });
  }, [details, professionals, query, status]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Equipe"
        title="Profissionais"
        description="Especialidades, jornada, disponibilidade em tempo real e ocupação da agenda da equipe."
        actions={
          canManage ? (
            <Button onClick={() => setEditing("new")}>
              <Plus className="size-4" aria-hidden="true" />
              Nova profissional
            </Button>
          ) : null
        }
      />

      {feedback ? (
        <Alert tone="success" onDismiss={() => setFeedback("")}>
          {feedback}
        </Alert>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-3" aria-label="Resumo da equipe">
        {[
          { label: "Equipe ativa", value: activeProfessionals.length, detail: `${professionals.length - activeProfessionals.length} inativa(s)`, icon: UsersRound },
          { label: "Em expediente agora", value: workingNow, detail: "Disponíveis ou atendendo", icon: UserRoundCheck },
          { label: "Ocupação média", value: `${averageOccupancy}%`, detail: "Agenda desta semana", icon: Gauge },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <article key={item.label} className="surface-card flex items-center gap-4 p-4 sm:p-5">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-xl font-extrabold text-slate-950 dark:text-slate-50">{item.value}</p>
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">{item.label}</p>
                <p className="mt-0.5 text-[11px] text-slate-600 dark:text-slate-300">{item.detail}</p>
              </div>
            </article>
          );
        })}
      </section>

      <section className="surface-card p-3 sm:p-4" aria-label="Filtros de profissionais">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <SearchInput
            className="w-full sm:max-w-sm"
            placeholder="Buscar nome ou especialidade..."
            aria-label="Buscar profissionais"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onClear={() => setQuery("")}
          />
          <div className="flex overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-1" role="group" aria-label="Filtrar situação profissional">
            {(
              [
                ["all", "Todas"],
                ["available", "Disponíveis"],
                ["in-service", "Atendendo"],
                ["off-duty", "Fora"],
                ["inactive", "Inativas"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setStatus(value)}
                aria-pressed={status === value}
                className={cn(
                  "h-8 shrink-0 rounded-lg px-3 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600",
                  status === value ? "bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-300 shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {filteredProfessionals.length ? (
        <section className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3" aria-label="Equipe do estúdio">
          {filteredProfessionals.map((professional) => {
            const info = details.get(professional.id);
            return (
              <ProfessionalCard
                key={professional.id}
                professional={professional}
                services={services}
                liveStatus={info?.liveStatus ?? "off-duty"}
                occupancy={info?.occupancy ?? 0}
                nextAppointment={info?.next}
                today={today}
                onEdit={canManage ? () => setEditing(professional) : undefined}
              />
            );
          })}
        </section>
      ) : (
        <section className="surface-card">
          <EmptyState title="Nenhuma profissional encontrada" description="Revise a busca ou selecione outro filtro de disponibilidade." />
        </section>
      )}

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === "new" ? "Nova profissional" : "Editar profissional"}
      >
        {editing ? (
          <ProfessionalForm
            key={editing === "new" ? "new" : editing.id}
            professional={editing === "new" ? undefined : editing}
            services={services}
            suggestedColor={suggestColor(professionals.length)}
            onCancel={() => setEditing(null)}
            onDone={(message) => {
              setEditing(null);
              setFeedback(message);
            }}
          />
        ) : null}
      </Modal>
    </div>
  );
}

function ProfessionalCard({
  professional,
  services,
  liveStatus,
  occupancy,
  nextAppointment,
  today,
  onEdit,
}: {
  professional: Professional;
  services: Service[];
  liveStatus: ProfessionalStatus;
  occupancy: number;
  nextAppointment?: Appointment;
  today: string;
  onEdit?: () => void;
}) {
  const enabledServices = services.filter(
    (service) => professional.serviceIds.includes(service.id) && service.status === "active",
  );
  const nextLabel = nextAppointment
    ? `${nextAppointment.date === today ? "Hoje" : formatDate(nextAppointment.date)}, ${nextAppointment.startTime}`
    : "Sem próximos horários";

  return (
    <article className={cn("surface-card overflow-hidden transition hover:shadow-md", !professional.active && "opacity-70")}>
      <div className="p-5">
        <div className="flex items-start gap-3">
          <Avatar name={professional.name} color={professional.color} size="lg" />
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-bold text-slate-950 dark:text-slate-50">{professional.name}</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">{professional.role}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {professional.active ? (
                <StatusBadge kind="professional" status={liveStatus} />
              ) : (
                <span className="inline-flex rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:text-slate-300 ring-1 ring-inset ring-slate-200 dark:ring-slate-700">
                  Inativa
                </span>
              )}
            </div>
          </div>
          {onEdit ? (
            <Button size="sm" variant="secondary" onClick={onEdit}>
              Editar
            </Button>
          ) : null}
        </div>

        <div className="mt-5">
          <div className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
            <BriefcaseMedical className="size-3.5" aria-hidden="true" /> Especialidades
          </div>
          <div className="flex min-h-12 flex-wrap content-start gap-1.5">
            {professional.specialties.length ? (
              professional.specialties.map((specialty) => (
                <span key={specialty} className="rounded-lg bg-slate-100 dark:bg-slate-800 px-2 py-1 text-[11px] font-medium text-slate-600 dark:text-slate-300">
                  {specialty}
                </span>
              ))
            ) : (
              <span className="text-[11px] text-slate-500 dark:text-slate-400">Nenhuma informada</span>
            )}
          </div>
        </div>

        <div className="mt-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">Serviços habilitados</p>
          <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-slate-600 dark:text-slate-300">
            {enabledServices.length
              ? enabledServices.map((service) => service.name).join(" · ")
              : "Nenhum serviço ativo habilitado"}
          </p>
        </div>

        <div className="mt-5 rounded-xl bg-slate-50 dark:bg-slate-950 p-3.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-600 dark:text-slate-300">Ocupação semanal</span>
            <strong className="text-slate-900 dark:text-slate-50">{occupancy}%</strong>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
            <div className="h-full rounded-full" style={{ width: `${occupancy}%`, backgroundColor: professional.color }} />
          </div>
          <div className="mt-3 flex items-center gap-1">
            {BUSINESS_DAYS.map((day) => (
              <span
                key={day}
                className={cn(
                  "flex size-7 items-center justify-center rounded-lg text-[9px] font-bold",
                  professional.workDays.includes(day) ? "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 shadow-sm" : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400",
                )}
                title={day}
              >
                {day.slice(0, 1)}
              </span>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-slate-600 dark:text-slate-300">
            {professional.workStart}–{professional.workEnd}
            {professional.breakStart && professional.breakEnd
              ? ` · intervalo ${professional.breakStart}–${professional.breakEnd}`
              : ""}
          </p>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
          <span className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <CalendarClock className="size-4 text-slate-400" aria-hidden="true" /> Próximo horário
          </span>
          <span className="text-xs font-bold text-slate-800 dark:text-slate-100">{nextLabel}</span>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-slate-500 dark:text-slate-400">
          <a href={`tel:${professional.phone.replace(/\D/g, "")}`} className="inline-flex items-center gap-1.5 hover:text-teal-700 dark:hover:text-teal-300">
            <Phone className="size-3.5" aria-hidden="true" /> {professional.phone}
          </a>
          <a href={`mailto:${professional.email}`} className="inline-flex min-w-0 items-center gap-1.5 hover:text-teal-700 dark:hover:text-teal-300">
            <Mail className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{professional.email}</span>
          </a>
        </div>
      </div>
    </article>
  );
}
