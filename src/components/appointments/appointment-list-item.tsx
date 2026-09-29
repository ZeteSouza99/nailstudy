import { CalendarClock, Globe } from "lucide-react";

import { Avatar } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatCurrency } from "@/lib/formatters";
import type { Appointment } from "@/types/domain";

interface AppointmentListItemProps {
  appointment: Appointment;
  professionalColor?: string;
  showDate?: boolean;
}

export function AppointmentListItem({
  appointment,
  professionalColor = "#83423e",
  showDate = false,
}: AppointmentListItemProps) {
  return (
    <article className="group flex items-center gap-3 px-4 py-3.5 transition hover:bg-ink-50 dark:hover:bg-ink-950 sm:px-5">
      <div className="w-11 shrink-0 text-center">
        <p className="text-sm font-bold text-ink-900 dark:text-ink-50">{appointment.startTime}</p>
        <p className="text-[10px] text-ink-600 dark:text-ink-300">{appointment.endTime}</p>
      </div>
      <span className="h-9 w-px shrink-0 bg-ink-200 dark:bg-ink-700" />
      <Avatar name={appointment.clientName} color={professionalColor} size="md" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="truncate text-sm font-semibold text-ink-900 dark:text-ink-50">{appointment.clientName}</h3>
          {showDate ? (
            <CalendarClock className="size-3.5 shrink-0 text-ink-400" aria-hidden="true" />
          ) : null}
          {appointment.source === "portal" ? (
            <span
              className="inline-flex shrink-0 items-center gap-1 rounded-full bg-ink-100 dark:bg-ink-800 px-1.5 py-0.5 text-[10px] font-semibold text-ink-600 dark:text-ink-300 ring-1 ring-inset ring-ink-200 dark:ring-ink-700"
              title="Agendado pela cliente no portal online"
            >
              <Globe className="size-2.5" aria-hidden="true" />
              Online
            </span>
          ) : null}
        </div>
        <p className="truncate text-xs text-ink-500 dark:text-ink-400">
          {appointment.serviceName} · {appointment.professionalName}
        </p>
      </div>
      <div className="hidden text-right sm:block">
        <p className="text-xs font-semibold text-ink-700 dark:text-ink-200">{formatCurrency(appointment.price)}</p>
        <StatusBadge kind="appointment" status={appointment.status} className="mt-1 py-0.5" />
      </div>
    </article>
  );
}
