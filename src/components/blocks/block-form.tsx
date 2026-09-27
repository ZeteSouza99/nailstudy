"use client";

import { CalendarOff } from "lucide-react";
import { useState } from "react";

import { createBlockAction } from "@/app/actions";
import { fieldError, useFormAction } from "@/components/forms/use-form-action";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { fieldA11y, FormField } from "@/components/ui/form-field";
import { CLINIC_CLOSE_TIME, CLINIC_OPEN_TIME } from "@/lib/scheduling";
import { blockSchema } from "@/lib/validation";
import type { Professional } from "@/types/domain";

interface BlockFormProps {
  professionals: Professional[];
  today: string;
  onCancel: () => void;
  onDone: (message: string) => void;
}

export function BlockForm({ professionals, today, onCancel, onDone }: BlockFormProps) {
  const [allDay, setAllDay] = useState(true);
  const [state, onSubmit, isPending] = useFormAction(blockSchema, createBlockAction, (result) =>
    onDone(
      result.affectedAppointments
        ? `Bloqueio criado. Atenção: ${result.affectedAppointments} atendimento(s) já marcado(s) nesse período precisam ser remanejados.`
        : "Bloqueio criado.",
    ),
  );

  const errors = Object.fromEntries(
    ["professionalId", "startDate", "endDate", "startTime", "endTime", "reason"].map((field) => [
      field,
      fieldError(state, field),
    ]),
  ) as Record<string, string | undefined>;

  return (
    <form onSubmit={onSubmit} className="space-y-4 p-5 sm:p-6" noValidate>
      {state.status === "error" ? <Alert>{state.error}</Alert> : null}

      <FormField id="block-reason" label="Motivo" error={errors.reason}>
        <input
          {...fieldA11y("block-reason", errors.reason)}
          name="reason"
          className="form-control"
          placeholder="Ex.: Feriado, férias, curso"
        />
      </FormField>

      <FormField id="block-professional" label="Vale para" error={errors.professionalId}>
        <select
          {...fieldA11y("block-professional", errors.professionalId)}
          name="professionalId"
          className="form-control"
        >
          <option value="">Estúdio inteiro</option>
          {professionals
            .filter((professional) => professional.active)
            .map((professional) => (
              <option key={professional.id} value={professional.id}>
                {professional.name}
              </option>
            ))}
        </select>
      </FormField>

      <div className="grid grid-cols-2 gap-3">
        <FormField id="block-start-date" label="De" error={errors.startDate}>
          <input
            {...fieldA11y("block-start-date", errors.startDate)}
            name="startDate"
            type="date"
            min={today}
            className="form-control"
            defaultValue={today}
          />
        </FormField>
        <FormField id="block-end-date" label="Até" error={errors.endDate}>
          <input
            {...fieldA11y("block-end-date", errors.endDate)}
            name="endDate"
            type="date"
            min={today}
            className="form-control"
            defaultValue={today}
          />
        </FormField>
      </div>

      <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
        <input
          type="checkbox"
          name="allDay"
          checked={allDay}
          onChange={(event) => setAllDay(event.target.checked)}
          className="size-4 accent-teal-700"
        />
        Dia inteiro
      </label>

      {!allDay ? (
        <div className="grid grid-cols-2 gap-3">
          <FormField id="block-start-time" label="Das" error={errors.startTime}>
            <input
              {...fieldA11y("block-start-time", errors.startTime)}
              name="startTime"
              type="time"
              min={CLINIC_OPEN_TIME}
              max={CLINIC_CLOSE_TIME}
              step={900}
              className="form-control"
              defaultValue="12:00"
            />
          </FormField>
          <FormField id="block-end-time" label="Às" error={errors.endTime}>
            <input
              {...fieldA11y("block-end-time", errors.endTime)}
              name="endTime"
              type="time"
              min={CLINIC_OPEN_TIME}
              max={CLINIC_CLOSE_TIME}
              step={900}
              className="form-control"
              defaultValue="13:00"
            />
          </FormField>
        </div>
      ) : null}

      <p className="text-xs text-slate-500 dark:text-slate-400">
        Bloqueios impedem novos agendamentos no período. Atendimentos já marcados não são cancelados
        automaticamente.
      </p>

      <div className="flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800 pt-4">
        <Button variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" loading={isPending}>
          {isPending ? null : <CalendarOff className="size-4" aria-hidden="true" />}
          Bloquear agenda
        </Button>
      </div>
    </form>
  );
}
