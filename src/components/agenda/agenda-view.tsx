"use client";

import {
  Ban,
  ChevronLeft,
  ChevronRight,
  Clock3,
  LayoutGrid,
  List,
  Plus,
  SlidersHorizontal,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { Alert } from "@/components/ui/alert";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { SearchInput } from "@/components/ui/search-input";
import { StatusBadge } from "@/components/ui/status-badge";
import { addDays, getWeekDays, getWeekStart, parseDateKey } from "@/lib/date";
import { appointmentStatusConfig } from "@/lib/domain-config";
import { cn, formatCurrency, normalizeText } from "@/lib/formatters";
import {
  calculateBookedMinutes,
  calculateDailyCapacityMinutes,
  calculateOccupancyPercentage,
} from "@/lib/scheduling";
import type {
  Appointment,
  AppointmentStatus,
  Professional,
  ScheduleBlock,
  Service,
} from "@/types/domain";

import { AppointmentDetails } from "./appointment-details";
import { AppointmentForm } from "./appointment-form";

type CalendarView = "week" | "day";
type StatusFilter = "all" | AppointmentStatus;

const dayFormatter = new Intl.DateTimeFormat("pt-BR", { weekday: "short" });
const monthFormatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });
const longDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "2-digit",
  month: "long",
  year: "numeric",
});

interface AgendaViewProps {
  appointments: Appointment[];
  professionals: Professional[];
  services: Service[];
  blocks: ScheduleBlock[];
  today: string;
  selectedDate: string;
  view: CalendarView;
  initiallyOpen: boolean;
}

export function AgendaView({
  appointments,
  professionals,
  services,
  blocks,
  today,
  selectedDate,
  view,
  initiallyOpen,
}: AgendaViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isNavigating, startNavigation] = useTransition();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");
  const [isCreating, setIsCreating] = useState(initiallyOpen);
  const [createDate, setCreateDate] = useState(selectedDate);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");

  const colorByProfessional = useMemo(
    () => new Map(professionals.map((professional) => [professional.id, professional.color])),
    [professionals],
  );
  const colorByService = useMemo(
    () => new Map(services.map((service) => [service.id, service.color])),
    [services],
  );
  const nameByProfessional = useMemo(
    () => new Map(professionals.map((professional) => [professional.id, professional.name])),
    [professionals],
  );

  const visibleDates = view === "week" ? getWeekDays(selectedDate) : [selectedDate];
  const selectedAppointment = appointments.find((appointment) => appointment.id === selectedId);

  const filteredAppointments = useMemo(() => {
    const normalizedQuery = normalizeText(query);
    return appointments.filter((appointment) => {
      const matchesStatus = statusFilter === "all" || appointment.status === statusFilter;
      const searchable = normalizeText(
        `${appointment.clientName} ${appointment.serviceName} ${appointment.professionalName}`,
      );
      return matchesStatus && searchable.includes(normalizedQuery);
    });
  }, [appointments, query, statusFilter]);

  const weekStart = getWeekStart(selectedDate);
  const periodLabel =
    view === "week"
      ? `${monthFormatter.format(parseDateKey(weekStart))} – ${monthFormatter.format(parseDateKey(addDays(weekStart, 5)))}`
      : longDateFormatter.format(parseDateKey(selectedDate));

  function navigate(date: string, nextView: CalendarView = view) {
    setFeedback("");
    startNavigation(() => {
      router.push(`${pathname}?data=${date}&visao=${nextView === "day" ? "dia" : "semana"}`, {
        scroll: false,
      });
    });
  }

  function openNewAppointment(date = selectedDate) {
    setFeedback("");
    setCreateDate(date);
    setIsCreating(true);
  }

  function closeNewAppointment() {
    setIsCreating(false);
    if (initiallyOpen) {
      router.replace(pathname, { scroll: false });
    }
  }

  const hasFilters = statusFilter !== "all" || query;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Atendimentos"
        title="Agenda"
        description="Organize horários, acompanhe confirmações e filtre a agenda de Erika Queiroz."
        actions={
          <Button onClick={() => openNewAppointment()}>
            <Plus className="size-4" aria-hidden="true" />
            Novo agendamento
          </Button>
        }
      />

      {feedback ? (
        <Alert tone="success" onDismiss={() => setFeedback("")}>
          {feedback}
        </Alert>
      ) : null}

      <section className="surface-card p-3 sm:p-4" aria-label="Controles da agenda">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="icon"
              onClick={() => navigate(addDays(selectedDate, view === "week" ? -7 : -1))}
              aria-label={view === "week" ? "Semana anterior" : "Dia anterior"}
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
            </Button>
            <Button variant="secondary" size="sm" onClick={() => navigate(today)}>
              Hoje
            </Button>
            <Button
              variant="secondary"
              size="icon"
              onClick={() => navigate(addDays(selectedDate, view === "week" ? 7 : 1))}
              aria-label={view === "week" ? "Próxima semana" : "Próximo dia"}
            >
              <ChevronRight className="size-4" aria-hidden="true" />
            </Button>
            <p className="ml-1 min-w-0 text-sm font-bold capitalize text-ink-800 dark:text-ink-100 sm:min-w-52" aria-live="polite">
              {periodLabel}
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <SearchInput
              className="w-full sm:w-60"
              placeholder="Buscar na agenda..."
              aria-label="Buscar cliente ou serviço"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onClear={() => setQuery("")}
            />
            <div className="inline-flex rounded-xl border border-ink-200 dark:border-ink-700 bg-ink-50 dark:bg-ink-950 p-1" role="group" aria-label="Modo de visualização">
              {(
                [
                  ["week", "Semana", LayoutGrid],
                  ["day", "Dia", List],
                ] as const
              ).map(([value, label, Icon]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => navigate(selectedDate, value)}
                  aria-pressed={view === value}
                  className={cn(
                    "inline-flex h-11 sm:h-8 flex-1 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 sm:flex-none",
                    view === value ? "bg-white dark:bg-ink-900 text-brand-700 dark:text-brand-300 shadow-sm" : "text-ink-500 dark:text-ink-400 hover:text-ink-800 dark:hover:text-ink-100",
                  )}
                >
                  <Icon className="size-3.5" aria-hidden="true" />
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-col flex-wrap gap-2 border-t border-ink-100 dark:border-ink-800 pt-3 sm:flex-row sm:items-center">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-500 dark:text-ink-400">
            <SlidersHorizontal className="size-3.5" aria-hidden="true" />
            Filtros
          </span>
          <label className="sr-only" htmlFor="status-filter">
            Filtrar por situação
          </label>
          <select
            id="status-filter"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
            className="form-control sm:w-48"
          >
            <option value="all">Todas as situações</option>
            {Object.entries(appointmentStatusConfig).map(([value, config]) => (
              <option key={value} value={value}>
                {config.label}
              </option>
            ))}
          </select>
          {hasFilters ? (
            <button
              type="button"
              onClick={() => {
                setStatusFilter("all");
                setQuery("");
              }}
              className="h-9 rounded-lg px-2 text-xs font-bold text-brand-700 dark:text-brand-300 hover:text-brand-900 dark:hover:text-brand-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
            >
              Limpar filtros
            </button>
          ) : null}
          <span className="text-xs text-ink-500 dark:text-ink-400 sm:ml-auto">
            {filteredAppointments.length} atendimento{filteredAppointments.length === 1 ? "" : "s"} no período
          </span>
        </div>
      </section>

      <div className={cn("transition-opacity", isNavigating && "opacity-60")} aria-busy={isNavigating}>
        {view === "week" ? (
          <WeekView
            dates={visibleDates}
            appointments={filteredAppointments}
            blocks={blocks}
            selectedDate={selectedDate}
            today={today}
            canCreate
            colorByProfessional={colorByProfessional}
            colorByService={colorByService}
            nameByProfessional={nameByProfessional}
            onSelectDate={(date) => navigate(date)}
            onAdd={openNewAppointment}
            onOpen={setSelectedId}
          />
        ) : (
          <DayView
            date={selectedDate}
            appointments={filteredAppointments}
            allDayAppointments={appointments}
            professionals={professionals}
            blocks={blocks}
            canCreate
            colorByProfessional={colorByProfessional}
            colorByService={colorByService}
            nameByProfessional={nameByProfessional}
            onAdd={() => openNewAppointment(selectedDate)}
            onOpen={setSelectedId}
          />
        )}
      </div>

      <Modal
          open={isCreating}
          onClose={closeNewAppointment}
          title="Novo agendamento"
          description="Preencha os dados para registrar o atendimento."
        >
          {isCreating ? (
            <AppointmentForm
              key={createDate}
              services={services}
              professionals={professionals}
              defaultDate={createDate}
              today={today}
              onCancel={closeNewAppointment}
              onCreated={(appointment) => {
                closeNewAppointment();
                if (!visibleDates.includes(appointment.date)) navigate(appointment.date);
                setFeedback(
                  `Agendamento criado para ${appointment.clientName}, às ${appointment.startTime}.`,
                );
              }}
            />
          ) : null}
      </Modal>

      <Modal
        open={Boolean(selectedAppointment)}
        onClose={() => setSelectedId(null)}
        title="Detalhes do atendimento"
      >
        {selectedAppointment ? (
          <AppointmentDetails
            key={selectedAppointment.id}
            appointment={selectedAppointment}
            professionals={professionals}
            today={today}
            onFeedback={setFeedback}
            onClose={() => setSelectedId(null)}
          />
        ) : null}
      </Modal>
    </div>
  );
}

interface CalendarCommonProps {
  blocks: ScheduleBlock[];
  canCreate: boolean;
  colorByProfessional: Map<string, string>;
  colorByService: Map<string, string>;
  nameByProfessional: Map<string, string>;
  onOpen: (id: string) => void;
}

function blocksOn(date: string, blocks: ScheduleBlock[]) {
  return blocks.filter((block) => block.startDate <= date && block.endDate >= date);
}

function BlockChips({
  date,
  blocks,
  nameByProfessional,
}: {
  date: string;
  blocks: ScheduleBlock[];
  nameByProfessional: Map<string, string>;
}) {
  const dayBlocks = blocksOn(date, blocks);
  if (!dayBlocks.length) return null;

  return (
    <ul className="space-y-1">
      {dayBlocks.map((block) => (
        <li
          key={block.id}
          className="flex items-start gap-1.5 rounded-lg bg-ink-100 dark:bg-ink-800 px-2 py-1.5 text-[10px] leading-4 text-ink-700 dark:text-ink-200"
        >
          <Ban className="mt-0.5 size-3 shrink-0 text-ink-500 dark:text-ink-400" aria-hidden="true" />
          <span>
            <strong className="font-semibold">{block.reason}</strong>
            {" · "}
            {block.professionalId ? nameByProfessional.get(block.professionalId) : "Estúdio"}
            {" · "}
            {block.startTime && block.endTime ? `${block.startTime}–${block.endTime}` : "dia inteiro"}
          </span>
        </li>
      ))}
    </ul>
  );
}

function WeekView({
  dates,
  appointments,
  blocks,
  selectedDate,
  today,
  canCreate,
  colorByProfessional,
  colorByService,
  nameByProfessional,
  onSelectDate,
  onAdd,
  onOpen,
}: CalendarCommonProps & {
  dates: string[];
  appointments: Appointment[];
  selectedDate: string;
  today: string;
  onSelectDate: (date: string) => void;
  onAdd: (date: string) => void;
}) {
  return (
    <section className="surface-card overflow-hidden" aria-label="Agenda semanal">
      <div className="xl:overflow-x-auto">
        <div className="grid grid-cols-1 divide-y divide-ink-100 dark:divide-ink-800 sm:grid-cols-2 xl:min-w-260 xl:grid-cols-6 xl:divide-x xl:divide-y-0">
          {dates.map((date) => {
            const dateAppointments = appointments
              .filter((appointment) => appointment.date === date)
              .sort((a, b) => a.startTime.localeCompare(b.startTime));
            const isToday = date === today;
            const isSelected = date === selectedDate;

            return (
              <div key={date} className="min-w-0 bg-white xl:min-h-124 dark:bg-ink-900">
                <button
                  type="button"
                  onClick={() => onSelectDate(date)}
                  className={cn(
                    "flex w-full items-center justify-between border-b px-3 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-600",
                    isSelected ? "border-brand-200 dark:border-brand-800 bg-brand-50/70 dark:bg-brand-950/70" : "border-ink-100 dark:border-ink-800 hover:bg-ink-50 dark:hover:bg-ink-950",
                  )}
                  aria-pressed={isSelected}
                >
                  <span>
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-ink-600 dark:text-ink-300">
                      {dayFormatter.format(parseDateKey(date)).replace(".", "")}
                    </span>
                    <span className={cn("text-lg font-extrabold", isToday ? "text-brand-700 dark:text-brand-300" : "text-ink-800 dark:text-ink-100")}>
                      {parseDateKey(date).getDate()}
                    </span>
                  </span>
                  {isToday ? (
                    <span className="rounded-full bg-brand-600 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                      Hoje
                    </span>
                  ) : null}
                </button>

                <div className="space-y-2 p-2.5">
                  <BlockChips date={date} blocks={blocks} nameByProfessional={nameByProfessional} />
                  {dateAppointments.length ? (
                    dateAppointments.map((appointment) => (
                      <AgendaCard
                        key={appointment.id}
                        appointment={appointment}
                        professionalColor={colorByProfessional.get(appointment.professionalId)}
                        serviceColor={colorByService.get(appointment.serviceId)}
                        onOpen={onOpen}
                        compact
                      />
                    ))
                  ) : (
                    <div className="flex h-16 flex-col xl:h-32 items-center justify-center rounded-xl border border-dashed border-ink-200 dark:border-ink-700 text-center">
                      <Clock3 className="mb-2 size-4 text-ink-300 dark:text-ink-600" aria-hidden="true" />
                      <p className="text-[11px] text-ink-600 dark:text-ink-300">Nenhum atendimento</p>
                    </div>
                  )}
                  {canCreate && date >= today ? (
                    <button
                      type="button"
                      onClick={() => onAdd(date)}
                      className="flex h-11 w-full xl:h-9 items-center justify-center gap-1 rounded-xl border border-dashed border-ink-200 dark:border-ink-700 text-[11px] font-semibold text-ink-600 dark:text-ink-300 transition hover:border-brand-300 dark:hover:border-brand-700 hover:bg-brand-50 dark:hover:bg-brand-950 hover:text-brand-700 dark:hover:text-brand-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
                    >
                      <Plus className="size-3" aria-hidden="true" />
                      Adicionar horário
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function DayView({
  date,
  appointments,
  allDayAppointments,
  professionals,
  blocks,
  canCreate,
  colorByProfessional,
  colorByService,
  nameByProfessional,
  onAdd,
  onOpen,
}: CalendarCommonProps & {
  date: string;
  appointments: Appointment[];
  allDayAppointments: Appointment[];
  professionals: Professional[];
  onAdd: () => void;
}) {
  const dateAppointments = appointments
    .filter((appointment) => appointment.date === date)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
  const dayAppointments = allDayAppointments.filter((appointment) => appointment.date === date);
  const projectedRevenue = dayAppointments
    .filter((appointment) => appointment.status !== "cancelled")
    .reduce((sum, appointment) => sum + appointment.price, 0);
  const dailyCapacity = calculateDailyCapacityMinutes(date, professionals, blocks);
  const bookedMinutes = calculateBookedMinutes(date, dayAppointments);
  const occupancy = calculateOccupancyPercentage(date, dayAppointments, professionals, blocks);

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_280px]">
      <section className="surface-card overflow-hidden" aria-label="Agenda diária">
        <div className="flex items-center justify-between gap-3 border-b border-ink-100 dark:border-ink-800 px-5 py-4">
          <div>
            <h2 className="font-bold capitalize text-ink-900 dark:text-ink-50">
              {longDateFormatter.format(parseDateKey(date))}
            </h2>
            <p className="text-xs text-ink-600 dark:text-ink-300">
              {dateAppointments.length} exibidos de {dayAppointments.length} no dia
            </p>
          </div>
          {canCreate ? (
            <Button size="sm" onClick={onAdd}>
              <Plus className="size-4" aria-hidden="true" />
              Adicionar
            </Button>
          ) : null}
        </div>
        <div className="px-4 pt-3 sm:px-5">
          <BlockChips date={date} blocks={blocks} nameByProfessional={nameByProfessional} />
        </div>
        {dateAppointments.length ? (
          <div className="divide-y divide-ink-100 dark:divide-ink-800">
            {dateAppointments.map((appointment) => (
              <div key={appointment.id} className="grid grid-cols-[58px_1fr] gap-3 px-4 py-4 sm:grid-cols-[70px_1fr] sm:px-5">
                <div className="pt-1 text-right">
                  <p className="text-sm font-extrabold text-ink-900 dark:text-ink-50">{appointment.startTime}</p>
                  <p className="text-[10px] text-ink-600 dark:text-ink-300">{appointment.endTime}</p>
                </div>
                <AgendaCard
                  appointment={appointment}
                  professionalColor={colorByProfessional.get(appointment.professionalId)}
                  serviceColor={colorByService.get(appointment.serviceId)}
                  onOpen={onOpen}
                />
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="Dia sem atendimentos" description="Altere os filtros ou adicione um novo horário à agenda." />
        )}
      </section>
      <aside className="space-y-4" aria-label="Resumo do dia">
        <div className="surface-card p-5">
          <p className="text-xs font-semibold text-ink-500 dark:text-ink-400">Receita prevista</p>
          <p className="mt-1 text-2xl font-extrabold text-ink-950 dark:text-ink-50">{formatCurrency(projectedRevenue)}</p>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800">
            <div className="h-full rounded-full bg-brand-600" style={{ width: `${occupancy}%` }} />
          </div>
          <p className="mt-2 text-[11px] text-ink-600 dark:text-ink-300">
            {occupancy}% da capacidade diária · {Math.max(0, dailyCapacity - bookedMinutes)} min livres
          </p>
        </div>
        <div className="surface-card p-5">
          <p className="text-xs font-semibold text-ink-500 dark:text-ink-400">Situações do dia inteiro</p>
          <p className="mt-1 text-[11px] text-ink-600 dark:text-ink-300">Inclui atendimentos cancelados.</p>
          <div className="mt-3 space-y-2.5">
            {(["confirmed", "scheduled", "in-progress", "completed", "cancelled"] as AppointmentStatus[]).map((itemStatus) => {
              const config = appointmentStatusConfig[itemStatus];
              const count = dayAppointments.filter((item) => item.status === itemStatus).length;
              return (
                <div key={itemStatus} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2 text-ink-600 dark:text-ink-300">
                    <span className={cn("size-2 rounded-full", config.dotClassName)} />
                    {config.label}
                  </span>
                  <strong className="text-ink-900 dark:text-ink-50">{count}</strong>
                </div>
              );
            })}
          </div>
        </div>
      </aside>
    </div>
  );
}

function AgendaCard({
  appointment,
  professionalColor,
  serviceColor,
  onOpen,
  compact = false,
}: {
  appointment: Appointment;
  professionalColor?: string;
  serviceColor?: string;
  onOpen: (id: string) => void;
  compact?: boolean;
}) {
  const statusConfig = appointmentStatusConfig[appointment.status];

  return (
    <button
      type="button"
      onClick={() => onOpen(appointment.id)}
      aria-label={`${appointment.clientName}, ${appointment.serviceName}, ${appointment.startTime} às ${appointment.endTime}, ${statusConfig.label}. Abrir detalhes`}
      className={cn(
        "block w-full rounded-xl border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-left shadow-sm transition hover:border-ink-300 dark:hover:border-ink-600 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600",
        compact ? "p-2.5" : "p-4",
        appointment.status === "cancelled" && "opacity-60",
      )}
      style={{ borderLeftWidth: 3, borderLeftColor: serviceColor ?? "#83423e" }}
    >
      <span className="flex items-start justify-between gap-2">
        <span className="min-w-0">
          {compact ? (
            <span className="mb-1 block text-[10px] font-bold text-ink-500 dark:text-ink-400">
              {appointment.startTime} – {appointment.endTime}
            </span>
          ) : null}
          <span className={cn("block truncate font-bold text-ink-900 dark:text-ink-50", compact ? "text-xs" : "text-sm")}>
            {appointment.clientName}
          </span>
          <span className={cn("mt-0.5 block text-ink-500 dark:text-ink-400", compact ? "line-clamp-2 text-[10px]" : "text-xs")}>
            {appointment.serviceName}
          </span>
        </span>
        {!compact ? <StatusBadge kind="appointment" status={appointment.status} /> : null}
      </span>
      <span className={cn("flex items-center gap-2", compact ? "mt-2" : "mt-3 border-t border-ink-100 dark:border-ink-800 pt-3")}>
        <Avatar name={appointment.professionalName} color={professionalColor} size="sm" decorative />
        <span className="min-w-0 flex-1">
          <span className={cn("block truncate font-semibold text-ink-700 dark:text-ink-200", compact ? "text-[10px]" : "text-xs")}>
            {appointment.professionalName}
          </span>
          {!compact ? (
            <span className="block text-[10px] text-ink-600 dark:text-ink-300">{formatCurrency(appointment.price)}</span>
          ) : null}
        </span>
        {compact ? (
          <span className={cn("block size-2 shrink-0 rounded-full", statusConfig.dotClassName)} aria-hidden="true" />
        ) : null}
      </span>
      {appointment.notes && !compact ? (
        <span className="mt-3 block rounded-lg bg-amber-50 dark:bg-amber-950 px-3 py-2 text-[11px] leading-4 text-amber-800 dark:text-amber-200">
          {appointment.notes}
        </span>
      ) : null}
    </button>
  );
}
