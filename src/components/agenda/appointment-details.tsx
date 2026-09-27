"use client";

import {
  CalendarClock,
  CheckCircle2,
  Globe,
  Play,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { useMemo, useOptimistic, useState, useTransition } from "react";

import {
  changeAppointmentStatusAction,
  deleteAppointmentAction,
  rescheduleAppointmentAction,
} from "@/app/actions";
import { fieldError, useFormAction } from "@/components/forms/use-form-action";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { fieldA11y, FormField } from "@/components/ui/form-field";
import { StatusBadge } from "@/components/ui/status-badge";
import { appointmentStatusConfig } from "@/lib/domain-config";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { can, canChangeAppointmentStatus } from "@/lib/permissions";
import {
  appointmentStatusTransitions,
  CLINIC_CLOSE_TIME,
  CLINIC_OPEN_TIME,
  getWorkDayLabel,
} from "@/lib/scheduling";
import { staffRescheduleSchema } from "@/lib/validation";
import type {
  Appointment,
  AppointmentStatus,
  Professional,
  SessionUser,
} from "@/types/domain";

const statusActions: Record<
  AppointmentStatus,
  { label: string; icon: typeof CheckCircle2; variant: "primary" | "secondary" | "danger" }
> = {
  confirmed: { label: "Confirmar", icon: CheckCircle2, variant: "primary" },
  "in-progress": { label: "Iniciar atendimento", icon: Play, variant: "primary" },
  completed: { label: "Concluir", icon: CheckCircle2, variant: "primary" },
  cancelled: { label: "Cancelar agendamento", icon: X, variant: "danger" },
  scheduled: { label: "Reabrir", icon: CalendarClock, variant: "secondary" },
};

interface AppointmentDetailsProps {
  appointment: Appointment;
  professionals: Professional[];
  viewer: Pick<SessionUser, "role" | "professionalId">;
  today: string;
  onFeedback: (message: string) => void;
  onClose: () => void;
}

export function AppointmentDetails({
  appointment,
  professionals,
  viewer,
  today,
  onFeedback,
  onClose,
}: AppointmentDetailsProps) {
  const [status, setOptimisticStatus] = useOptimistic(appointment.status);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const current = { ...appointment, status };
  const actions = appointmentStatusTransitions[status].filter((target) =>
    canChangeAppointmentStatus(viewer, current, target),
  );
  const canReschedule =
    can(viewer.role, "appointments:manage") && (status === "scheduled" || status === "confirmed");

  function changeStatus(target: AppointmentStatus) {
    setError("");
    startTransition(async () => {
      setOptimisticStatus(target);
      const result = await changeAppointmentStatusAction({ id: appointment.id, status: target });
      if (result.ok) {
        onFeedback(
          `${appointment.clientName}: status alterado para ${appointmentStatusConfig[target].label.toLowerCase()}.`,
        );
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="space-y-4 p-5 sm:p-6">
      {error ? <Alert>{error}</Alert> : null}

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-base font-bold text-slate-950 dark:text-slate-50">{appointment.clientName}</p>
          <p className="text-sm text-slate-600 dark:text-slate-300">{appointment.serviceName}</p>
        </div>
        <StatusBadge kind="appointment" status={status} />
      </div>

      <dl className="grid gap-2 rounded-xl bg-slate-50 dark:bg-slate-950 p-3 text-sm text-slate-700 dark:text-slate-200">
        <div className="flex items-center gap-2">
          <CalendarClock className="size-4 text-slate-400" aria-hidden="true" />
          <dt className="sr-only">Quando</dt>
          <dd>
            {formatDate(appointment.date, { weekday: "long", day: "2-digit", month: "long" })},{" "}
            {appointment.startTime} às {appointment.endTime}
            {appointment.bufferMinutes ? ` (+${appointment.bufferMinutes} min de preparo)` : ""}
          </dd>
        </div>
        <div className="flex items-center gap-2">
          <UserRound className="size-4 text-slate-400" aria-hidden="true" />
          <dt className="sr-only">Profissional</dt>
          <dd>{appointment.professionalName}</dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt className="sr-only">Valor</dt>
          <dd className="font-semibold text-slate-900 dark:text-slate-50">{formatCurrency(appointment.price)}</dd>
          {appointment.source === "portal" ? (
            <dd className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
              <Globe className="size-3.5" aria-hidden="true" />
              Agendado pelo portal
            </dd>
          ) : null}
        </div>
      </dl>

      {appointment.notes ? (
        <p className="rounded-lg bg-amber-50 dark:bg-amber-950 px-3 py-2 text-xs leading-5 text-amber-800 dark:text-amber-200">
          {appointment.notes}
        </p>
      ) : null}

      {actions.length || canReschedule ? (
        <div className="flex flex-wrap gap-2">
          {actions.map((target) => {
            const action = statusActions[target];
            const Icon = action.icon;
            return (
              <Button
                key={target}
                size="sm"
                variant={action.variant}
                disabled={isPending}
                onClick={() => changeStatus(target)}
              >
                <Icon className="size-4" aria-hidden="true" />
                {action.label}
              </Button>
            );
          })}
          {canReschedule ? (
            <Button size="sm" variant="secondary" onClick={() => setIsRescheduling((open) => !open)}>
              <CalendarClock className="size-4" aria-hidden="true" />
              Remarcar
            </Button>
          ) : null}
        </div>
      ) : null}

      {isRescheduling ? (
        <RescheduleForm
          appointment={appointment}
          professionals={professionals}
          today={today}
          onDone={() => {
            setIsRescheduling(false);
            onFeedback(`Agendamento de ${appointment.clientName} remarcado.`);
          }}
        />
      ) : null}

      <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-4">
        {can(viewer.role, "appointments:delete") ? (
          <Button size="sm" variant="ghost" onClick={() => setIsDeleting(true)}>
            <Trash2 className="size-4" aria-hidden="true" />
            Excluir registro
          </Button>
        ) : (
          <span />
        )}
        <Button size="sm" variant="secondary" onClick={onClose}>
          Fechar
        </Button>
      </div>

      <ConfirmDialog
        open={isDeleting}
        title="Excluir agendamento?"
        description="O registro e o histórico serão apagados. Para desmarcar um horário, prefira cancelar."
        confirmLabel="Excluir"
        onConfirm={() => deleteAppointmentAction(appointment.id)}
        onClose={() => setIsDeleting(false)}
        onConfirmed={() => {
          setIsDeleting(false);
          onFeedback("Agendamento excluído.");
          onClose();
        }}
      />
    </div>
  );
}

function RescheduleForm({
  appointment,
  professionals,
  today,
  onDone,
}: {
  appointment: Appointment;
  professionals: Professional[];
  today: string;
  onDone: () => void;
}) {
  const [date, setDate] = useState(appointment.date < today ? today : appointment.date);
  const [professionalId, setProfessionalId] = useState(appointment.professionalId);
  const [state, onSubmit, isPending] = useFormAction(
    staffRescheduleSchema,
    rescheduleAppointmentAction,
    onDone,
  );

  const eligible = useMemo(() => {
    const dayLabel = getWorkDayLabel(date);
    return professionals.filter(
      (professional) =>
        professional.active &&
        professional.serviceIds.includes(appointment.serviceId) &&
        Boolean(dayLabel && professional.workDays.includes(dayLabel)),
    );
  }, [appointment.serviceId, date, professionals]);

  const errors = {
    date: fieldError(state, "date"),
    startTime: fieldError(state, "startTime"),
    professionalId: fieldError(state, "professionalId"),
  };
  const selectedProfessionalId = eligible.some((professional) => professional.id === professionalId)
    ? professionalId
    : (eligible[0]?.id ?? "");

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-xl border border-slate-200 dark:border-slate-700 p-3" noValidate>
      <input type="hidden" name="id" value={appointment.id} />
      {state.status === "error" ? <Alert>{state.error}</Alert> : null}
      <div className="grid grid-cols-2 gap-3">
        <FormField id="reschedule-date" label="Nova data" error={errors.date}>
          <input
            {...fieldA11y("reschedule-date", errors.date)}
            name="date"
            type="date"
            min={today}
            className="form-control"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </FormField>
        <FormField id="reschedule-time" label="Horário" error={errors.startTime}>
          <input
            {...fieldA11y("reschedule-time", errors.startTime)}
            name="startTime"
            type="time"
            min={CLINIC_OPEN_TIME}
            max={CLINIC_CLOSE_TIME}
            step={900}
            className="form-control"
            defaultValue={appointment.startTime}
          />
        </FormField>
      </div>
      <FormField id="reschedule-professional" label="Profissional" error={errors.professionalId}>
        <select
          {...fieldA11y("reschedule-professional", errors.professionalId)}
          name="professionalId"
          className="form-control"
          value={selectedProfessionalId}
          onChange={(event) => setProfessionalId(event.target.value)}
        >
          {eligible.length === 0 ? <option value="">Nenhuma profissional nesse dia</option> : null}
          {eligible.map((professional) => (
            <option key={professional.id} value={professional.id}>
              {professional.name}
            </option>
          ))}
        </select>
      </FormField>
      <div className="flex justify-end">
        <Button type="submit" size="sm" loading={isPending}>
          Confirmar novo horário
        </Button>
      </div>
    </form>
  );
}
