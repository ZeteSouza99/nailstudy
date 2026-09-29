"use client";

import { Save } from "lucide-react";
import { updateStudioSettingsAction } from "@/app/actions";
import { fieldError, useFormAction } from "@/components/forms/use-form-action";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { fieldA11y, FormField } from "@/components/ui/form-field";
import { BUSINESS_DAYS, CLINIC_CLOSE_TIME, CLINIC_OPEN_TIME } from "@/lib/scheduling";
import { studioSettingsSchema } from "@/lib/validation";
import type { Professional } from "@/types/domain";

export function ProfessionalForm({ professional, onDone }: { professional: Professional; onDone: () => void }) {
  const [state, onSubmit, isPending] = useFormAction(studioSettingsSchema, updateStudioSettingsAction, onDone);
  return (
    <form onSubmit={onSubmit} className="space-y-5 p-5 sm:p-6" noValidate>
      {state.status === "error" ? <Alert>{state.error}</Alert> : null}
      <fieldset aria-describedby={fieldError(state, "workDays") ? "workdays-error" : undefined}>
        <legend className="form-label">Dias de atendimento</legend>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {BUSINESS_DAYS.map((day) => (
            <label key={day} className="cursor-pointer">
              <input type="checkbox" name="workDays" value={day} defaultChecked={professional.workDays.includes(day)} className="peer sr-only" />
              <span className="flex min-h-11 items-center justify-center rounded-xl border border-ink-200 text-sm font-semibold text-ink-600 peer-checked:border-brand-600 peer-checked:bg-brand-50 peer-checked:text-brand-700 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-600 dark:border-ink-700 dark:text-ink-300 dark:peer-checked:bg-brand-950 dark:peer-checked:text-brand-300">{day}</span>
            </label>
          ))}
        </div>
        {fieldError(state, "workDays") ? <p id="workdays-error" className="mt-2 text-sm text-rose-600">{fieldError(state, "workDays")}</p> : null}
      </fieldset>
      <div className="grid gap-4 min-[400px]:grid-cols-2">
        {([
          ["workStart", "Início do atendimento", professional.workStart],
          ["workEnd", "Fim do atendimento", professional.workEnd],
          ["breakStart", "Intervalo (início)", professional.breakStart ?? ""],
          ["breakEnd", "Intervalo (fim)", professional.breakEnd ?? ""],
        ] as const).map(([name, label, value]) => (
          <FormField key={name} id={`studio-${name}`} label={label} error={fieldError(state, name)} optional={name.startsWith("break")}>
            <input {...fieldA11y(`studio-${name}`, fieldError(state, name))} name={name} type="time" min={CLINIC_OPEN_TIME} max={CLINIC_CLOSE_TIME} step={900} className="form-control" defaultValue={value} />
          </FormField>
        ))}
      </div>
      <p className="text-sm text-ink-500 dark:text-ink-400">Todos os serviços cadastrados pertencem automaticamente à Erika. Serviços inativos não aparecem para agendamento.</p>
      <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-ink-700 dark:text-ink-200">
        <input type="checkbox" name="active" defaultChecked={professional.active} className="size-5 accent-brand-700" />
        Receber novos agendamentos
      </label>
      <div className="form-actions border-t border-ink-100 pt-4 dark:border-ink-800">
        <Button type="submit" loading={isPending}><Save className="size-4" aria-hidden="true" />Salvar horários</Button>
      </div>
    </form>
  );
}
