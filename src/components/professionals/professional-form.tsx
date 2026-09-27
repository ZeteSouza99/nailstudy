"use client";

import { Trash2, UserRoundPlus } from "lucide-react";
import { useState } from "react";

import {
  createProfessionalAction,
  deleteProfessionalAction,
  updateProfessionalAction,
} from "@/app/actions";
import { fieldError, useFormAction } from "@/components/forms/use-form-action";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { fieldA11y, FormField } from "@/components/ui/form-field";
import { cn } from "@/lib/formatters";
import { BUSINESS_DAYS, CLINIC_CLOSE_TIME, CLINIC_OPEN_TIME } from "@/lib/scheduling";
import { professionalSchema } from "@/lib/validation";
import type { Professional, Service } from "@/types/domain";

const palette = ["#0f766e", "#7c3aed", "#d97706", "#2563eb", "#db2777"];

interface ProfessionalFormProps {
  professional?: Professional;
  services: Service[];
  suggestedColor: string;
  onCancel: () => void;
  onDone: (message: string) => void;
}

export function ProfessionalForm({
  professional,
  services,
  suggestedColor,
  onCancel,
  onDone,
}: ProfessionalFormProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [state, onSubmit, isPending] = useFormAction(
    professionalSchema,
    (input) =>
      professional
        ? updateProfessionalAction(professional.id, input)
        : createProfessionalAction(input),
    () => onDone(professional ? "Cadastro atualizado." : "Profissional adicionada à equipe."),
  );

  const errors = Object.fromEntries(
    [
      "name",
      "role",
      "specialties",
      "phone",
      "email",
      "color",
      "workDays",
      "workStart",
      "workEnd",
      "breakStart",
      "breakEnd",
      "serviceIds",
      "commissionPercent",
    ].map((field) => [field, fieldError(state, field)]),
  ) as Record<string, string | undefined>;

  const workDays = professional?.workDays ?? ["Seg", "Ter", "Qua", "Qui", "Sex"];
  const serviceIds = professional?.serviceIds ?? [];
  const active = professional?.active ?? true;
  const offerableServices = services.filter(
    (service) => service.status === "active" || professional?.serviceIds.includes(service.id),
  );

  return (
    <form onSubmit={onSubmit} className="space-y-4 p-5 sm:p-6" noValidate>
      {state.status === "error" ? <Alert>{state.error}</Alert> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="professional-name" label="Nome completo" error={errors.name}>
          <input
            {...fieldA11y("professional-name", errors.name)}
            name="name"
            className="form-control"
            autoComplete="name"
            placeholder="Ex.: Bruna Souza"
            defaultValue={professional?.name}
          />
        </FormField>
        <FormField id="professional-role" label="Cargo" error={errors.role}>
          <input
            {...fieldA11y("professional-role", errors.role)}
            name="role"
            className="form-control"
            placeholder="Ex.: Esteticista"
            defaultValue={professional?.role}
          />
        </FormField>
      </div>

      <FormField
        id="professional-specialties"
        label="Especialidades"
        optional
        error={errors.specialties}
        hint="Separe por vírgulas. Ex.: Fibra de vidro, Nail art"
      >
        <input
          {...fieldA11y("professional-specialties", errors.specialties, "Separe por vírgulas. Ex.: Fibra de vidro, Nail art")}
          name="specialties"
          className="form-control"
          defaultValue={professional?.specialties.join(", ") ?? ""}
        />
      </FormField>

      <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto]">
        <FormField id="professional-phone" label="Telefone" error={errors.phone}>
          <input
            {...fieldA11y("professional-phone", errors.phone)}
            name="phone"
            type="tel"
            inputMode="tel"
            className="form-control"
            autoComplete="tel"
            placeholder="(11) 99999-9999"
            defaultValue={professional?.phone}
          />
        </FormField>
        <FormField id="professional-email" label="E-mail" error={errors.email}>
          <input
            {...fieldA11y("professional-email", errors.email)}
            name="email"
            type="email"
            className="form-control"
            autoComplete="email"
            placeholder="nome@studio.com.br"
            defaultValue={professional?.email}
          />
        </FormField>
        <FormField id="professional-color" label="Cor" error={errors.color}>
          <input
            {...fieldA11y("professional-color", errors.color)}
            name="color"
            type="color"
            className="form-control w-20 cursor-pointer p-1"
            defaultValue={professional?.color ?? suggestedColor}
          />
        </FormField>
      </div>

      <fieldset aria-describedby={errors.workDays ? "professional-workdays-error" : undefined}>
        <legend className="form-label">Dias de atendimento</legend>
        <div className="grid grid-cols-6 gap-1.5">
          {BUSINESS_DAYS.map((day) => (
            <label key={day} className="cursor-pointer">
              <input
                type="checkbox"
                name="workDays"
                value={day}
                defaultChecked={workDays.includes(day)}
                className="peer sr-only"
              />
              <span className="flex h-9 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] font-semibold text-slate-500 dark:text-slate-400 transition peer-checked:border-teal-600 peer-checked:bg-teal-50 dark:peer-checked:bg-teal-950 peer-checked:text-teal-700 dark:peer-checked:text-teal-300 peer-focus-visible:ring-2 peer-focus-visible:ring-teal-600">
                {day}
              </span>
            </label>
          ))}
        </div>
        {errors.workDays ? (
          <p id="professional-workdays-error" className="mt-1 text-[11px] font-medium text-rose-700 dark:text-rose-300">
            {errors.workDays}
          </p>
        ) : null}
      </fieldset>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(
          [
            ["workStart", "Início da jornada", professional?.workStart ?? CLINIC_OPEN_TIME],
            ["workEnd", "Fim da jornada", professional?.workEnd ?? CLINIC_CLOSE_TIME],
            ["breakStart", "Intervalo (início)", professional?.breakStart ?? ""],
            ["breakEnd", "Intervalo (fim)", professional?.breakEnd ?? ""],
          ] as const
        ).map(([field, label, fallback]) => (
          <FormField key={field} id={`professional-${field}`} label={label} error={errors[field]}>
            <input
              {...fieldA11y(`professional-${field}`, errors[field])}
              name={field}
              type="time"
              min={CLINIC_OPEN_TIME}
              max={CLINIC_CLOSE_TIME}
              step={900}
              className="form-control"
              defaultValue={fallback}
            />
          </FormField>
        ))}
      </div>

      <fieldset aria-describedby={errors.serviceIds ? "professional-services-error" : undefined}>
        <legend className="form-label">Serviços habilitados</legend>
        <div className="grid max-h-40 gap-2 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 p-3 sm:grid-cols-2">
          {offerableServices.map((service) => (
            <label key={service.id} className="flex cursor-pointer items-start gap-2 rounded-lg p-1.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-950">
              <input
                type="checkbox"
                name="serviceIds"
                value={service.id}
                defaultChecked={serviceIds.includes(service.id)}
                className="mt-0.5 size-4 accent-teal-700"
              />
              <span className={cn(service.status === "inactive" && "text-slate-400")}>
                {service.name}
                {service.status === "inactive" ? " (inativo)" : ""}
              </span>
            </label>
          ))}
        </div>
        {errors.serviceIds ? (
          <p id="professional-services-error" className="mt-1 text-[11px] font-medium text-rose-700 dark:text-rose-300">
            {errors.serviceIds}
          </p>
        ) : null}
      </fieldset>

      <FormField
        id="professional-commission"
        label="Comissão (%)"
        optional
        error={errors.commissionPercent}
        hint="Percentual sobre cada atendimento pago. Deixe 0 se não usar."
      >
        <input
          {...fieldA11y(
            "professional-commission",
            errors.commissionPercent,
            "Percentual sobre cada atendimento pago. Deixe 0 se não usar.",
          )}
          name="commissionPercent"
          inputMode="decimal"
          className="form-control"
          placeholder="0"
          defaultValue={
            professional && professional.commissionRate
              ? String(professional.commissionRate).replace(".", ",")
              : ""
          }
        />
      </FormField>

      <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-slate-200 dark:border-slate-700 p-3 text-sm text-slate-700 dark:text-slate-200">
        <input type="checkbox" name="active" defaultChecked={active} className="mt-0.5 size-4 accent-teal-700" />
        <span>
          <span className="block font-semibold">Ativa na equipe</span>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Desmarque para tirar a profissional da agenda e do portal sem apagar o histórico.
          </span>
        </span>
      </label>

      <div className="flex items-center justify-between gap-2 border-t border-slate-100 dark:border-slate-800 pt-4">
        {professional ? (
          <Button variant="ghost" size="sm" onClick={() => setIsDeleting(true)}>
            <Trash2 className="size-4" aria-hidden="true" />
            Excluir
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit" loading={isPending}>
            {isPending ? null : <UserRoundPlus className="size-4" aria-hidden="true" />}
            {professional ? "Salvar alterações" : "Adicionar profissional"}
          </Button>
        </div>
      </div>

      {professional ? (
        <ConfirmDialog
          open={isDeleting}
          title={`Excluir ${professional.name}?`}
          description="Profissionais com atendimentos registrados não podem ser excluídas; nesse caso, desmarque “Ativa na equipe”."
          confirmLabel="Excluir profissional"
          onConfirm={() => deleteProfessionalAction(professional.id)}
          onClose={() => setIsDeleting(false)}
          onConfirmed={() => {
            setIsDeleting(false);
            onDone("Profissional excluída.");
          }}
        />
      ) : null}
    </form>
  );
}

export function suggestColor(index: number) {
  return palette[index % palette.length];
}
