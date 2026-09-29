import {
  ArrowRight,
  CalendarCheck2,
  CalendarPlus,
  CircleDollarSign,
  Gauge,
  Plus,
  UserRoundPlus,
  UsersRound,
} from "lucide-react";
import Link from "next/link";

import { AppointmentListItem } from "@/components/appointments/appointment-list-item";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { parseDateKey } from "@/lib/date";
import { cn, formatCurrency, formatDuration } from "@/lib/formatters";
import {
  calculateBookedMinutes,
  calculateDailyCapacityMinutes,
  calculateOccupancyPercentage,
  getWorkDayLabel,
} from "@/lib/scheduling";
import type { ClientStats } from "@/server/queries";
import type {
  Appointment,
  AppointmentStatus,
  Professional,
  ScheduleBlock,
} from "@/types/domain";

const statusSummary: Array<{ status: AppointmentStatus; label: string; color: string }> = [
  { status: "confirmed", label: "Confirmados", color: "bg-sky-500" },
  { status: "scheduled", label: "Agendados", color: "bg-ink-500" },
  { status: "in-progress", label: "Em atendimento", color: "bg-amber-500" },
  { status: "completed", label: "Concluídos", color: "bg-emerald-500" },
  { status: "cancelled", label: "Cancelados", color: "bg-rose-500" },
];

const monthDayFormatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long" });
const weekdayFormatter = new Intl.DateTimeFormat("pt-BR", { weekday: "long" });

interface DashboardViewProps {
  today: string;
  weekDates: string[];
  weekAppointments: Appointment[];
  professionals: Professional[];
  blocks: ScheduleBlock[];
  clientStats: ClientStats | null;
  canCreateAppointment: boolean;
  canCreateClient: boolean;
}

export function DashboardView({
  today,
  weekDates,
  weekAppointments,
  professionals,
  blocks,
  clientStats,
  canCreateAppointment,
  canCreateClient,
}: DashboardViewProps) {
  const colorByProfessional = new Map(
    professionals.map((professional) => [professional.id, professional.color]),
  );
  const todayAppointments = weekAppointments.filter((appointment) => appointment.date === today);
  const activeToday = todayAppointments.filter((appointment) => appointment.status !== "cancelled");
  const upcoming = todayAppointments
    .filter((appointment) =>
      ["confirmed", "scheduled", "in-progress"].includes(appointment.status),
    )
    .toSorted((first, second) => first.startTime.localeCompare(second.startTime));

  const expectedRevenue = activeToday.reduce((total, appointment) => total + appointment.price, 0);
  const completedRevenue = todayAppointments
    .filter((appointment) => appointment.status === "completed")
    .reduce((total, appointment) => total + appointment.price, 0);

  const todayCapacity = calculateDailyCapacityMinutes(today, professionals, blocks);
  const todayBooked = calculateBookedMinutes(today, weekAppointments);
  const todayOccupancy = calculateOccupancyPercentage(today, weekAppointments, professionals, blocks);
  const weeklyCapacity = weekDates.reduce(
    (total, date) => total + calculateDailyCapacityMinutes(date, professionals, blocks),
    0,
  );
  const weeklyBooked = weekDates.reduce(
    (total, date) => total + calculateBookedMinutes(date, weekAppointments),
    0,
  );
  const remainingToday = upcoming.filter((appointment) => appointment.status !== "in-progress").length;

  const metrics = [
    {
      id: "appointments",
      label: "Atendimentos hoje",
      value: String(activeToday.length),
      detail: `${remainingToday} ainda por atender`,
      icon: CalendarCheck2,
    },
    {
      id: "revenue",
      label: "Receita prevista",
      value: formatCurrency(expectedRevenue, true),
      detail: `${formatCurrency(completedRevenue, true)} realizados`,
      icon: CircleDollarSign,
    },
    clientStats
      ? {
          id: "clients",
          label: "Clientes cadastradas",
          value: String(clientStats.total),
          detail: `${clientStats.withoutVisits} aguardando primeira visita`,
          icon: UsersRound,
        }
      : {
          id: "week",
          label: "Atendimentos na semana",
          value: String(weekAppointments.filter((item) => item.status !== "cancelled").length),
          detail: "Segunda a sábado",
          icon: UsersRound,
        },
    {
      id: "occupancy",
      label: "Ocupação da agenda",
      value: `${todayOccupancy}%`,
      detail: `${formatDuration(Math.max(0, todayCapacity - todayBooked))} livres hoje`,
      icon: Gauge,
    },
  ];

  const weeklyPerformance = weekDates.map((date) => ({
    date,
    day: getWorkDayLabel(date) ?? "—",
    value: calculateOccupancyPercentage(date, weekAppointments, professionals, blocks),
    appointments: weekAppointments.filter(
      (appointment) => appointment.date === date && appointment.status !== "cancelled",
    ).length,
    current: date === today,
  }));

  const quickActions = [
    canCreateAppointment && {
      label: "Novo agendamento",
      description: "Reserve um horário",
      href: "/agenda?novo=1",
      icon: CalendarPlus,
      color: "bg-brand-50 dark:bg-brand-950 text-brand-700 dark:text-brand-300",
    },
    canCreateClient && {
      label: "Cadastrar cliente",
      description: "Adicione à sua base",
      href: "/clientes?novo=1",
      icon: UserRoundPlus,
      color: "bg-ink-100 dark:bg-ink-800 text-ink-600 dark:text-ink-300",
    },
  ].filter((action) => action !== false);

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageHeader
        eyebrow={`${weekdayFormatter.format(parseDateKey(today))}, ${monthDayFormatter.format(parseDateKey(today))}`}
        title="Visão geral do estúdio"
        description="Acompanhe a operação e os compromissos mais importantes do dia."
        actions={
          canCreateAppointment ? (
            <Link
              href="/agenda?novo=1"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-brand-700 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-ink-900"
            >
              <Plus className="size-4" aria-hidden="true" />
              Novo agendamento
            </Link>
          ) : null
        }
      />

      <section aria-label="Indicadores do dia" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <article key={metric.id} className="surface-card flex items-start gap-3.5 p-4">
              <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-ink-100 dark:bg-ink-800 text-ink-500 dark:text-ink-400">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-medium text-ink-500 dark:text-ink-400">{metric.label}</p>
                <p className="mt-0.5 text-2xl font-bold tracking-tight tabular-nums text-ink-900 dark:text-ink-50">
                  {metric.value}
                </p>
                <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">{metric.detail}</p>
              </div>
            </article>
          );
        })}
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(310px,0.85fr)]">
        <section className="surface-card overflow-hidden" aria-labelledby="upcoming-title">
          <div className="flex items-center justify-between gap-3 border-b border-ink-100 dark:border-ink-800 px-4 py-4 sm:px-5">
            <div>
              <h2 id="upcoming-title" className="font-bold text-ink-900 dark:text-ink-50">
                Próximos atendimentos
              </h2>
              <p className="mt-0.5 text-xs text-ink-600 dark:text-ink-300">
                {upcoming.length} compromissos ativos hoje
              </p>
            </div>
            <Link
              href="/agenda"
              className="inline-flex items-center gap-1 text-xs font-bold text-brand-700 dark:text-brand-300 hover:text-brand-900 dark:hover:text-brand-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
            >
              Ver agenda
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          </div>
          {upcoming.length ? (
            <div className="divide-y divide-ink-100 dark:divide-ink-800">
              {upcoming.map((appointment) => (
                <AppointmentListItem
                  key={appointment.id}
                  appointment={appointment}
                  professionalColor={colorByProfessional.get(appointment.professionalId)}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              title="Nenhum compromisso ativo"
              description="A agenda de hoje não possui atendimentos pendentes."
            />
          )}
        </section>

        <div className="space-y-6">
          <section className="surface-card p-5" aria-labelledby="week-title">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="week-title" className="font-bold text-ink-900 dark:text-ink-50">
                  Ritmo da semana
                </h2>
                <p className="mt-0.5 text-xs text-ink-600 dark:text-ink-300">Ocupação por dia</p>
              </div>
              <span className="rounded-lg bg-brand-50 dark:bg-brand-950 px-2 py-1 text-xs font-bold text-brand-700 dark:text-brand-300">
                {weekAppointments.filter((item) => item.status !== "cancelled").length} atendimentos
              </span>
            </div>
            <div className="mt-6 flex h-32 items-end justify-between gap-2" aria-label="Gráfico de ocupação semanal">
              {weeklyPerformance.map((item) => (
                <div key={item.date} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                  <span className="text-[10px] font-semibold text-ink-600 dark:text-ink-300" aria-hidden="true">
                    {item.appointments} · {item.value}%
                  </span>
                  <span className="sr-only">
                    {item.day}: {item.appointments} atendimentos e {item.value}% de ocupação.
                  </span>
                  <div className="flex h-22 w-full max-w-8 items-end overflow-hidden rounded-t-lg bg-ink-100 dark:bg-ink-800" aria-hidden="true">
                    <div
                      className={cn("w-full rounded-t-lg", item.current ? "bg-brand-600" : "bg-brand-200 dark:bg-brand-700")}
                      style={{ height: `${item.value}%` }}
                    />
                  </div>
                  <span className={cn("text-[11px] font-semibold", item.current ? "text-brand-700 dark:text-brand-300" : "text-ink-600 dark:text-ink-300")}>
                    {item.day}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {quickActions.length ? (
            <section className="surface-card p-5" aria-labelledby="quick-title">
              <h2 id="quick-title" className="font-bold text-ink-900 dark:text-ink-50">
                Ações rápidas
              </h2>
              <div className="mt-3 grid gap-2">
                {quickActions.map((action) => {
                  const Icon = action.icon;
                  return (
                    <Link
                      key={action.label}
                      href={action.href}
                      className="group flex items-center gap-3 rounded-xl border border-ink-100 dark:border-ink-800 p-3 transition hover:border-ink-200 dark:hover:border-ink-700 hover:bg-ink-50 dark:hover:bg-ink-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
                    >
                      <span className={cn("flex size-9 items-center justify-center rounded-xl", action.color)}>
                        <Icon className="size-4.5" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-ink-800 dark:text-ink-100">{action.label}</span>
                        <span className="block text-xs text-ink-600 dark:text-ink-300">{action.description}</span>
                      </span>
                      <ArrowRight
                        className="size-4 text-ink-300 dark:text-ink-600 transition group-hover:translate-x-0.5 group-hover:text-ink-500 dark:group-hover:text-ink-400"
                        aria-hidden="true"
                      />
                    </Link>
                  );
                })}
              </div>
            </section>
          ) : null}
        </div>
      </div>

      <section className="surface-card p-5" aria-labelledby="summary-title">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 id="summary-title" className="font-bold text-ink-900 dark:text-ink-50">
              Resumo da agenda semanal
            </h2>
            <p className="mt-1 text-xs text-ink-600 dark:text-ink-300">
              Todos os atendimentos, incluindo cancelados, entre segunda e sábado
            </p>
          </div>
          <div className="grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-3 xl:grid-cols-6">
            {statusSummary.map((item) => (
              <div key={item.status}>
                <div className="flex items-center gap-2">
                  <span className={cn("size-2 rounded-full", item.color)} aria-hidden="true" />
                  <span className="text-xs text-ink-600 dark:text-ink-300">{item.label}</span>
                </div>
                <p className="mt-1 pl-4 text-xl font-extrabold text-ink-900 dark:text-ink-50">
                  {weekAppointments.filter((appointment) => appointment.status === item.status).length}
                </p>
              </div>
            ))}
            <div>
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-brand-500" aria-hidden="true" />
                <span className="text-xs text-ink-600 dark:text-ink-300">Capacidade livre</span>
              </div>
              <p className="mt-1 pl-4 text-xl font-extrabold text-ink-900 dark:text-ink-50">
                {formatDuration(Math.max(0, weeklyCapacity - weeklyBooked))}
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
