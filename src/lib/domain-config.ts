import type {
  AppointmentStatus,
  ProfessionalStatus,
  ServiceStatus,
} from "@/types/domain";

export const appointmentStatusConfig: Record<
  AppointmentStatus,
  { label: string; className: string; dotClassName: string }
> = {
  scheduled: {
    label: "Agendado",
    className: "bg-ink-100 dark:bg-ink-800 text-ink-700 dark:text-ink-200 ring-ink-200 dark:ring-ink-700",
    dotClassName: "bg-ink-400",
  },
  confirmed: {
    label: "Confirmado",
    className: "bg-sky-50 dark:bg-sky-950 text-sky-700 dark:text-sky-300 ring-sky-200 dark:ring-sky-800",
    dotClassName: "bg-sky-500",
  },
  "in-progress": {
    label: "Em atendimento",
    className: "bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 ring-amber-200 dark:ring-amber-800",
    dotClassName: "bg-amber-500",
  },
  completed: {
    label: "Concluído",
    className: "bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 ring-emerald-200 dark:ring-emerald-800",
    dotClassName: "bg-emerald-500",
  },
  cancelled: {
    label: "Cancelado",
    className: "bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300 ring-rose-200 dark:ring-rose-800",
    dotClassName: "bg-rose-500",
  },
};

export const professionalStatusConfig: Record<
  ProfessionalStatus,
  { label: string; className: string; dotClassName: string }
> = {
  available: {
    label: "Disponível",
    className: "bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 ring-emerald-200 dark:ring-emerald-800",
    dotClassName: "bg-emerald-500",
  },
  "in-service": {
    label: "Em atendimento",
    className: "bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 ring-amber-200 dark:ring-amber-800",
    dotClassName: "bg-amber-500",
  },
  "off-duty": {
    label: "Fora do expediente",
    className: "bg-ink-100 dark:bg-ink-800 text-ink-600 dark:text-ink-300 ring-ink-200 dark:ring-ink-700",
    dotClassName: "bg-ink-400",
  },
};

export const serviceStatusConfig: Record<
  ServiceStatus,
  { label: string; className: string; dotClassName: string }
> = {
  active: {
    label: "Ativo",
    className: "bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 ring-emerald-200 dark:ring-emerald-800",
    dotClassName: "bg-emerald-500",
  },
  inactive: {
    label: "Inativo",
    className: "bg-ink-100 dark:bg-ink-800 text-ink-600 dark:text-ink-300 ring-ink-200 dark:ring-ink-700",
    dotClassName: "bg-ink-400",
  },
};
