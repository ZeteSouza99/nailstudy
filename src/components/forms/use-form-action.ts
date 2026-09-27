"use client";

import { type FormEvent, useActionState, useTransition } from "react";
import type { z } from "zod";

import type { ActionResult } from "@/lib/action-result";
import {
  fieldErrorsFrom,
  firstIssueMessage,
  formDataToObject,
  type FieldErrors,
} from "@/lib/validation";

export type FormState<T> =
  | { status: "idle" }
  | { status: "error"; error: string; fieldErrors: FieldErrors }
  | { status: "success"; data: T };

/**
 * `useActionState` com o mesmo schema Zod do servidor: valida no navegador
 * antes de enviar e mostra erros por campo vindos de qualquer um dos lados.
 *
 * A action é disparada pelo `onSubmit` (e não por `<form action>`) para o
 * React não limpar o formulário quando o servidor devolve erro.
 */
export function useFormAction<TSchema extends z.ZodType, TResult>(
  schema: TSchema,
  action: (input: z.output<TSchema>) => Promise<ActionResult<TResult>>,
  onSuccess?: (data: TResult) => void,
) {
  const [, startTransition] = useTransition();
  const [state, dispatch, isPending] = useActionState<FormState<TResult>, FormData>(
    async (_previous, formData) => {
      const parsed = schema.safeParse(formDataToObject(formData));

      if (!parsed.success) {
        return {
          status: "error",
          error: firstIssueMessage(parsed.error),
          fieldErrors: fieldErrorsFrom(parsed.error),
        };
      }

      const result = await action(parsed.data);
      if (!result.ok) {
        return { status: "error", error: result.error, fieldErrors: result.fieldErrors ?? {} };
      }

      onSuccess?.(result.data);
      return { status: "success", data: result.data };
    },
    { status: "idle" },
  );

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => dispatch(formData));
  }

  return [state, onSubmit, isPending] as const;
}

export function fieldError<T>(state: FormState<T>, field: string) {
  return state.status === "error" ? state.fieldErrors[field] : undefined;
}
