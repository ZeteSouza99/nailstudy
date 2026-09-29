"use client";

import { CalendarDays } from "lucide-react";
import { useState } from "react";

import { createAppointmentAction } from "@/app/actions";
import { fieldError, useFormAction } from "@/components/forms/use-form-action";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { fieldA11y, FormField } from "@/components/ui/form-field";
import { formatCurrency } from "@/lib/formatters";
import { CLINIC_CLOSE_TIME, CLINIC_OPEN_TIME } from "@/lib/scheduling";
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
  defaultDate,
  today,
  onCancel,
  onCreated,
}: AppointmentFormProps) {
  const [serviceId, setServiceId] = useState("");
  const [date, setDate] = useState(defaultDate < today ? today : defaultDate);
  const [state, onSubmit, isPending] = useFormAction(
    appointmentSchema,
    createAppointmentAction,
    onCreated,
  );

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

      <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2">
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

      <p className="text-sm text-ink-500 dark:text-ink-400">Atendimento com Erika Queiroz.</p>

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

      <div className="form-actions border-t border-ink-100 dark:border-ink-800 pt-4">
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
