"use client";

import { Mail, Phone, Trash2, UserRoundPlus } from "lucide-react";
import { useState } from "react";

import { createClientAction, deleteClientAction, updateClientAction } from "@/app/actions";
import { fieldError, useFormAction } from "@/components/forms/use-form-action";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { fieldA11y, FormField } from "@/components/ui/form-field";
import { clientSchema } from "@/lib/validation";
import type { Client } from "@/types/domain";

interface ClientFormProps {
  client?: Client;
  today: string;
  canDelete: boolean;
  onCancel: () => void;
  onDone: (message: string) => void;
}

export function ClientForm({ client, today, canDelete, onCancel, onDone }: ClientFormProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [state, onSubmit, isPending] = useFormAction(
    clientSchema,
    (input) => (client ? updateClientAction(client.id, input) : createClientAction(input)),
    () => onDone(client ? "Cadastro atualizado." : "Cliente adicionada à lista."),
  );

  const errors = {
    name: fieldError(state, "name"),
    phone: fieldError(state, "phone"),
    birthDate: fieldError(state, "birthDate"),
    email: fieldError(state, "email"),
    tags: fieldError(state, "tags"),
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4 p-5 sm:p-6" noValidate>
      {state.status === "error" ? <Alert>{state.error}</Alert> : null}

      <FormField id="client-name" label="Nome completo" error={errors.name}>
        <input
          {...fieldA11y("client-name", errors.name)}
          name="name"
          className="form-control"
          autoComplete="name"
          placeholder="Ex.: Amanda Oliveira"
          defaultValue={client?.name}
        />
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="client-phone" label="Telefone (WhatsApp)" error={errors.phone}>
          <div className="relative">
            <Phone className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" aria-hidden="true" />
            <input
              {...fieldA11y("client-phone", errors.phone)}
              name="phone"
              type="tel"
              inputMode="tel"
              className="form-control pl-9"
              autoComplete="tel"
              placeholder="(11) 99999-9999"
              defaultValue={client?.phone}
            />
          </div>
        </FormField>
        <FormField id="client-birth" label="Nascimento" optional error={errors.birthDate}>
          <input
            {...fieldA11y("client-birth", errors.birthDate)}
            name="birthDate"
            type="date"
            className="form-control"
            max={today}
            defaultValue={client?.birthDate ?? ""}
          />
        </FormField>
      </div>

      <FormField id="client-email" label="E-mail" optional error={errors.email}>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" aria-hidden="true" />
          <input
            {...fieldA11y("client-email", errors.email)}
            name="email"
            type="email"
            className="form-control pl-9"
            autoComplete="email"
            placeholder="cliente@email.com"
            defaultValue={client?.email ?? ""}
          />
        </div>
      </FormField>

      <FormField
        id="client-tags"
        label="Etiquetas"
        optional
        error={errors.tags}
        hint="Separe por vírgulas. Ex.: VIP, Gel"
      >
        <input
          {...fieldA11y("client-tags", errors.tags, "Separe por vírgulas. Ex.: VIP, Gel")}
          name="tags"
          className="form-control"
          defaultValue={client?.tags.join(", ") ?? ""}
        />
      </FormField>

      <div className="flex flex-col-reverse gap-2 border-t sm:flex-row sm:items-center sm:justify-between border-ink-100 dark:border-ink-800 pt-4">
        {client && canDelete ? (
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
            {isPending ? null : <UserRoundPlus className="size-4" aria-hidden="true" />}
            {client ? "Salvar alterações" : "Adicionar cliente"}
          </Button>
        </div>
      </div>

      {client ? (
        <ConfirmDialog
          open={isDeleting}
          title={`Excluir ${client.name}?`}
          description="Só é possível excluir clientes sem atendimentos registrados."
          confirmLabel="Excluir cliente"
          onConfirm={() => deleteClientAction(client.id)}
          onClose={() => setIsDeleting(false)}
          onConfirmed={() => {
            setIsDeleting(false);
            onDone("Cliente excluída.");
          }}
        />
      ) : null}
    </form>
  );
}
