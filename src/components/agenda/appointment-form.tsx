"use client";

import { CalendarDays } from "lucide-react";
import { useMemo, useState } from "react";

import { createAppointmentAction } from "@/app/actions";
import { fieldError, useFormAction } from "@/components/forms/use-form-action";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { fieldA11y, FormField } from "@/components/ui/form-field";
import { formatCurrency } from "@/lib/formatters";
import { CLINIC_CLOSE_TIME, CLINIC_OPEN_TIME, getWorkDayLabel } from "@/lib/scheduling";
import { appointmentSchema } from "@/lib/validation";
import type { Appointment, Professional, Service } from "@/types/domain";

import { ClientPicker } from "./client-picker";

interface AppointmentFormProps {
  services: Service[];
  professionals: Professional[];
  defaultDate: string;
  today: string;
  onCancel: () => void;
  onCreated: (appointment: Appointment) => void;
}

export function AppointmentForm({
  services,
  professionals,
  defaultDate,
  today,
  onCancel,
  onCreated,
}: AppointmentFormProps) {
  const [serviceId, setServiceId] = useState("");
  const [date, setDate] = useState(defaultDate < today ? today : defaultDate);
  const [professionalId, setProfessionalId] = useState("");
  const [state, onSubmit, isPending] = useFormAction(
    appointmentSchema,
    createAppointmentAction,
    onCreated,
  );

  const eligibleProfessionals = useMemo(() => {
    const dayLabel = getWorkDayLabel(date);
    if (!serviceId || !dayLabel || dayLabel === "Dom") return [];
    return professionals.filter(
      (professional) =>
        professional.active &&
        professional.serviceIds.includes(serviceId) &&
        professional.workDays.includes(dayLabel),
    );
  }, [date, professionals, serviceId]);

  const errors = {
    clientId: fieldError(state, "clientId"),
    serviceId: fieldError(state, "serviceId"),
    date: fieldError(state, "date"),
    startTime: fieldError(state, "startTime"),
    professionalId: fieldError(state, "professionalId"),
    notes: fieldError(state, "notes"),
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4 p-5 sm:p-6" noValidate>
      {state.status === "error" ? <Alert>{state.error}</Alert> : null}

      <ClientPicker name="clientId" error={errors.clientId} />

      <FormField id="appointment-service" label="Serviço" error={errors.serviceId}>
        <select
          {...fieldA11y("appointment-service", errors.serviceId)}
          name="serviceId"
          className="form-control"
          value={serviceId}
          onChange={(event) => {
            setServiceId(event.target.value);
            setProfessionalId("");
          }}
        >
          <option value="" disabled>
            Selecione um serviço
          </option>
          {services
            .filter((service) => service.status === "active")
            .map((service) => (
              <option key={service.id} value={service.id}>
                {service.name} · {formatCurrency(service.price)}
              </option>
            ))}
        </select>
      </FormField>

      <div className="grid grid-cols-2 gap-3">
        <FormField id="appointment-date" label="Data" error={errors.date}>
          <input
            {...fieldA11y("appointment-date", errors.date)}
            name="date"
            type="date"
            className="form-control"
            min={today}
            value={date}
            onChange={(event) => {
              setDate(event.target.value);
              setProfessionalId("");
            }}
          />
        </FormField>
        <FormField id="appointment-time" label="Horário" error={errors.startTime}>
          <input
            {...fieldA11y("appointment-time", errors.startTime)}
            name="startTime"
            type="time"
            className="form-control"
            min={CLINIC_OPEN_TIME}
            max={CLINIC_CLOSE_TIME}
            step={900}
            defaultValue="09:00"
          />
        </FormField>
      </div>

      <FormField
        id="appointment-professional"
        label="Profissional"
        error={errors.professionalId}
        hint="A lista considera o serviço habilitado, o dia de trabalho e quem está ativa."
      >
        <select
          {...fieldA11y(
            "appointment-professional",
            errors.professionalId,
            "A lista considera o serviço habilitado, o dia de trabalho e quem está ativa.",
          )}
          name="professionalId"
          className="form-control"
          value={professionalId}
          disabled={!serviceId || !date}
          onChange={(event) => setProfessionalId(event.target.value)}
        >
          <option value="" disabled>
            {eligibleProfessionals.length
              ? "Selecione uma profissional"
              : "Nenhuma profissional disponível"}
          </option>
          {eligibleProfessionals.map((professional) => (
            <option key={professional.id} value={professional.id}>
              {professional.name} ({professional.workStart}–{professional.workEnd})
            </option>
          ))}
        </select>
      </FormField>

      <FormField id="appointment-notes" label="Observações" optional error={errors.notes}>
        <textarea
          {...fieldA11y("appointment-notes", errors.notes)}
          name="notes"
          rows={3}
          maxLength={500}
          className="form-control h-auto resize-none py-2"
          placeholder="Preferências ou informações importantes..."
        />
      </FormField>

      <div className="flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800 pt-4">
        <Button variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" loading={isPending}>
          {isPending ? null : <CalendarDays className="size-4" aria-hidden="true" />}
          Criar agendamento
        </Button>
      </div>
    </form>
  );
}
