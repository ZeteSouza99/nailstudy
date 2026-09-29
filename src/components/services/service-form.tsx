"use client";

import { Scissors, Trash2 } from "lucide-react";
import { useId, useState } from "react";

import { createServiceAction, deleteServiceAction, updateServiceAction } from "@/app/actions";
import { fieldError, useFormAction } from "@/components/forms/use-form-action";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { fieldA11y, FormField } from "@/components/ui/form-field";
import { serviceSchema } from "@/lib/validation";
import type { Service } from "@/types/domain";

const suggestedCategories = ["Manicure", "Pedicure", "Alongamento", "Gel", "Nail art"];

interface ServiceFormProps {
  service?: Service;
  categories: string[];
  onCancel: () => void;
  onDone: (message: string) => void;
}

export function ServiceForm({ service, categories, onCancel, onDone }: ServiceFormProps) {
  const categoryListId = useId();
  const [isDeleting, setIsDeleting] = useState(false);
  const [state, onSubmit, isPending] = useFormAction(
    serviceSchema,
    (input) => (service ? updateServiceAction(service.id, input) : createServiceAction(input)),
    () => onDone(service ? "Serviço atualizado." : "Serviço adicionado ao catálogo."),
  );

  const errors = {
    name: fieldError(state, "name"),
    description: fieldError(state, "description"),
    category: fieldError(state, "category"),
    durationMinutes: fieldError(state, "durationMinutes"),
    bufferMinutes: fieldError(state, "bufferMinutes"),
    price: fieldError(state, "price"),
    status: fieldError(state, "status"),
    color: fieldError(state, "color"),
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4 p-5 sm:p-6" noValidate>
      {state.status === "error" ? <Alert>{state.error}</Alert> : null}

      <FormField id="service-name" label="Nome do serviço" error={errors.name}>
        <input
          {...fieldA11y("service-name", errors.name)}
          name="name"
          className="form-control"
          placeholder="Ex.: Esmaltação francesa com nail art"
          defaultValue={service?.name}
        />
      </FormField>

      <FormField id="service-description" label="Descrição" error={errors.description}>
        <textarea
          {...fieldA11y("service-description", errors.description)}
          name="description"
          rows={3}
          maxLength={400}
          className="form-control h-auto resize-none py-2"
          placeholder="Descreva brevemente o procedimento..."
          defaultValue={service?.description}
        />
      </FormField>

      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <FormField id="service-category" label="Categoria" error={errors.category}>
          <input
            {...fieldA11y("service-category", errors.category)}
            name="category"
            list={categoryListId}
            className="form-control"
            placeholder="Ex.: Alongamento"
            defaultValue={service?.category}
          />
          <datalist id={categoryListId}>
            {[...new Set([...categories, ...suggestedCategories])].map((category) => (
              <option key={category} value={category} />
            ))}
          </datalist>
        </FormField>
        <FormField id="service-color" label="Cor" error={errors.color}>
          <input
            {...fieldA11y("service-color", errors.color)}
            name="color"
            type="color"
            className="form-control w-20 cursor-pointer p-1"
            defaultValue={service?.color ?? "#83423e"}
          />
        </FormField>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <FormField id="service-duration" label="Duração (min)" error={errors.durationMinutes}>
          <input
            {...fieldA11y("service-duration", errors.durationMinutes)}
            name="durationMinutes"
            type="number"
            min={5}
            max={600}
            step={5}
            className="form-control"
            defaultValue={service?.durationMinutes ?? 60}
          />
        </FormField>
        <FormField
          id="service-buffer"
          label="Preparo (min)"
          error={errors.bufferMinutes}
          hint="Intervalo após o atendimento."
        >
          <input
            {...fieldA11y("service-buffer", errors.bufferMinutes, "Intervalo após o atendimento.")}
            name="bufferMinutes"
            type="number"
            min={0}
            max={120}
            step={5}
            className="form-control"
            defaultValue={service?.bufferMinutes ?? 0}
          />
        </FormField>
        <FormField id="service-price" label="Preço (R$)" error={errors.price}>
          <input
            {...fieldA11y("service-price", errors.price)}
            name="price"
            inputMode="decimal"
            className="form-control"
            placeholder="0,00"
            defaultValue={service ? service.price.toFixed(2).replace(".", ",") : ""}
          />
        </FormField>
      </div>

      <FormField id="service-status" label="Disponibilidade" error={errors.status}>
        <select
          {...fieldA11y("service-status", errors.status)}
          name="status"
          className="form-control"
          defaultValue={service?.status ?? "active"}
        >
          <option value="active">Ativo — aparece para agendamento</option>
          <option value="inactive">Inativo — oculto da agenda e do portal</option>
        </select>
      </FormField>

      <div className="flex flex-col-reverse gap-2 border-t sm:flex-row sm:items-center sm:justify-between border-ink-100 dark:border-ink-800 pt-4">
        {service ? (
          <Button variant="ghost" size="sm" onClick={() => setIsDeleting(true)}>
            <Trash2 className="size-4" aria-hidden="true" />
            Excluir
          </Button>
        ) : (
          <span />
        )}
        <div className="form-actions">
          <Button variant="secondary" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit" loading={isPending}>
            {isPending ? null : <Scissors className="size-4" aria-hidden="true" />}
            {service ? "Salvar alterações" : "Adicionar serviço"}
          </Button>
        </div>
      </div>

      {service ? (
        <ConfirmDialog
          open={isDeleting}
          title={`Excluir ${service.name}?`}
          description="Serviços com atendimentos registrados não podem ser excluídos; nesse caso, marque como inativo."
          confirmLabel="Excluir serviço"
          onConfirm={() => deleteServiceAction(service.id)}
          onClose={() => setIsDeleting(false)}
          onConfirmed={() => {
            setIsDeleting(false);
            onDone("Serviço excluído.");
          }}
        />
      ) : null}
    </form>
  );
}
