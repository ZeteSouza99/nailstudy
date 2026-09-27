import type { z } from "zod";

import {
  fieldErrorsFrom,
  firstIssueMessage,
  type FieldErrors,
} from "@/lib/validation";

import { logger, serializeError } from "./logger";

/** Erro cuja mensagem pode ser mostrada como está para quem usa o sistema. */
export class UserError extends Error {
  constructor(
    message: string,
    readonly fieldErrors?: FieldErrors,
  ) {
    super(message);
    this.name = "UserError";
  }
}

export function parseInput<T extends z.ZodType>(schema: T, input: unknown): z.infer<T> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new UserError(firstIssueMessage(result.error), fieldErrorsFrom(result.error));
  }
  return result.data;
}

interface PgErrorLike {
  code: string;
  constraint?: string;
}

/** Os drivers (Neon e PGlite) chegam embrulhados em DrizzleQueryError; o código fica na causa. */
export function getPgError(error: unknown): PgErrorLike | null {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current; depth += 1) {
    const code = (current as { code?: unknown }).code;
    if (typeof code === "string" && /^[0-9A-Z]{5}$/.test(code)) {
      return current as PgErrorLike;
    }
    current = (current as { cause?: unknown }).cause;
  }
  return null;
}

const constraintMessages: Record<string, { message: string; field?: string }> = {
  appointments_professional_no_overlap: {
    message: "Esse horário acabou de ser ocupado para a profissional. Escolha outro.",
    field: "startTime",
  },
  appointments_client_no_overlap: {
    message: "A cliente já tem um atendimento nesse horário.",
    field: "startTime",
  },
  clients_phone_digits_unique: {
    message: "Já existe uma cliente cadastrada com esse telefone.",
    field: "phone",
  },
  users_email_unique: { message: "Já existe um usuário com esse e-mail.", field: "email" },
};

export function toUserMessage(error: unknown): {
  message: string;
  fieldErrors?: FieldErrors;
} {
  if (error instanceof UserError) {
    return { message: error.message, fieldErrors: error.fieldErrors };
  }

  const pgError = getPgError(error);
  const known = pgError?.constraint ? constraintMessages[pgError.constraint] : undefined;
  if (known) {
    return {
      message: known.message,
      fieldErrors: known.field ? { [known.field]: known.message } : undefined,
    };
  }

  if (pgError?.code === "23503") {
    return { message: "Este registro está vinculado a outros dados e não pode ser removido." };
  }

  logger.error("unexpected_error", { error: serializeError(error) });
  return { message: "Não foi possível concluir a operação. Tente novamente." };
}
