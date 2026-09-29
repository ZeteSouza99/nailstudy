import { z } from "zod";

import { STUDIO_PROFESSIONAL_ID } from "./studio";

import { getTodayKey } from "./date";
import { isValidPhone } from "./phone";
import {
  BUSINESS_DAYS,
  CLINIC_CLOSE_TIME,
  CLINIC_OPEN_TIME,
  timeToMinutes,
} from "./scheduling";

z.config(z.locales.pt());

/** Os mesmos schemas validam o formulário no navegador e a ação no servidor. */

const trimToUndefined = (value: unknown) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
};

export const dateKey = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.");

export const timeKey = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Horário inválido.");

const optionalTime = z.preprocess(trimToUndefined, timeKey.optional());

const optionalText = (max: number) =>
  z.preprocess(trimToUndefined, z.string().max(max).optional());

const requiredId = (message: string) => z.string().trim().min(1, message).max(80);

export const idSchema = requiredId("Registro inválido.");

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida.");

/** Checkboxes chegam como string única, várias strings ou nada. */
function stringList<T extends z.ZodType<string>>(
  item: T,
  { min = 0, max = 50, message }: { min?: number; max?: number; message?: string } = {},
) {
  return z.preprocess(
    (value) =>
      value === undefined || value === null || value === ""
        ? []
        : Array.isArray(value)
          ? value
          : [value],
    z.array(item).min(min, message).max(max),
  );
}

/** Texto separado por vírgulas, como "Fibra de vidro, Nail art". */
function commaList(maxItems: number, maxLength: number) {
  return z.preprocess(
    (value) =>
      typeof value === "string"
        ? value
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean)
        : (value ?? []),
    z.array(z.string().max(maxLength)).max(maxItems),
  );
}

const checkbox = z.preprocess(
  (value) => value === true || value === "on" || value === "true",
  z.boolean(),
);

/** Aceita "150", "150.5" e "150,50"; vírgula indica o formato brasileiro. */
const moneyField = z.preprocess(
  (value) => {
    if (typeof value === "number") return value;
    if (typeof value !== "string" || value.trim() === "") return undefined;
    const text = value.trim();
    const normalized = text.includes(",")
      ? text.replace(/\./g, "").replace(",", ".")
      : text;
    return /^\d+(\.\d{1,2})?$/.test(normalized) ? Number(normalized) : Number.NaN;
  },
  z
    .number({ error: "Informe um preço válido, com até duas casas decimais." })
    .min(0, "O preço não pode ser negativo.")
    .max(1_000_000, "Preço acima do permitido."),
);

const minutesField = (
  min: number,
  max: number,
  label: string,
  fallback?: number,
) =>
  z.preprocess(
    (value) => (trimToUndefined(value) === undefined ? fallback : value),
    z.coerce
      .number({ error: `Informe ${label} em minutos.` })
      .int(`Informe ${label} em minutos inteiros.`)
      .min(min, `Mínimo de ${min} minutos.`)
      .max(max, `Máximo de ${max} minutos.`)
      .multipleOf(5, "Use múltiplos de 5 minutos."),
  );

/** Percentual de 0 a 100; vazio vira 0. Aceita vírgula ("40,5"). */
const percentField = z.preprocess(
  (value) => {
    if (typeof value === "number") return value;
    if (typeof value !== "string" || value.trim() === "") return 0;
    const normalized = value.trim().replace(",", ".");
    return /^\d+(\.\d{1,2})?$/.test(normalized) ? Number(normalized) : Number.NaN;
  },
  z
    .number({ error: "Informe um percentual válido." })
    .min(0, "O percentual não pode ser negativo.")
    .max(100, "O percentual não pode passar de 100."),
);

/** Valor em reais que pode vir vazio (tratado como 0). */
const optionalMoney = z.preprocess(
  (value) =>
    value === undefined || value === null || (typeof value === "string" && value.trim() === "")
      ? 0
      : value,
  moneyField,
);

export const phoneField = z
  .string()
  .trim()
  .min(8, "Informe um telefone válido com DDD.")
  .max(20, "Informe um telefone válido com DDD.")
  .refine(isValidPhone, "Informe um telefone válido com DDD.");

const optionalEmail = z.preprocess(
  trimToUndefined,
  z.email("Informe um e-mail válido.").max(160).optional(),
);

export const clientSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome completo.").max(120),
  phone: phoneField,
  email: optionalEmail,
  birthDate: z.preprocess(
    trimToUndefined,
    dateKey
      .refine((value) => value <= getTodayKey(), "A data de nascimento não pode estar no futuro.")
      .optional(),
  ),
  tags: commaList(10, 40),
});

export const serviceSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do serviço.").max(120),
  category: z.string().trim().min(2, "Informe a categoria.").max(60),
  description: z.string().trim().min(1, "Descreva o serviço.").max(400),
  durationMinutes: minutesField(5, 600, "a duração"),
  bufferMinutes: minutesField(0, 120, "o tempo de preparo", 0),
  price: moneyField,
  status: z.enum(["active", "inactive"]).default("active"),
  color: hexColor,
});

export const professionalSchema = z
  .object({
    name: z.string().trim().min(2, "Informe o nome da profissional.").max(120),
    role: z.string().trim().min(2, "Informe o cargo.").max(80),
    specialties: commaList(20, 60),
    serviceIds: stringList(idSchema, {
      min: 1,
      message: "Selecione ao menos um serviço habilitado.",
    }),
    phone: phoneField,
    email: z.preprocess(trimToUndefined, z.email("Informe um e-mail válido.").max(160)),
    color: hexColor,
    active: checkbox,
    commissionPercent: percentField,
    workDays: stringList(z.enum(BUSINESS_DAYS), {
      min: 1,
      max: 6,
      message: "Selecione ao menos um dia de atendimento.",
    }),
    workStart: timeKey,
    workEnd: timeKey,
    breakStart: optionalTime,
    breakEnd: optionalTime,
  })
  .superRefine(validateWorkSchedule);

function validateWorkSchedule(value: { workStart: string; workEnd: string; breakStart?: string; breakEnd?: string }, ctx: z.RefinementCtx) {
    const start = timeToMinutes(value.workStart);
    const end = timeToMinutes(value.workEnd);

    if (
      start < timeToMinutes(CLINIC_OPEN_TIME) ||
      end > timeToMinutes(CLINIC_CLOSE_TIME) ||
      start >= end
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["workEnd"],
        message: `A jornada deve ficar entre ${CLINIC_OPEN_TIME} e ${CLINIC_CLOSE_TIME}, com início antes do fim.`,
      });
    }

    if (Boolean(value.breakStart) !== Boolean(value.breakEnd)) {
      ctx.addIssue({
        code: "custom",
        path: ["breakEnd"],
        message: "Informe o início e o fim do intervalo, ou deixe os dois em branco.",
      });
    } else if (value.breakStart && value.breakEnd) {
      const breakStart = timeToMinutes(value.breakStart);
      const breakEnd = timeToMinutes(value.breakEnd);
      if (breakStart >= breakEnd || breakStart < start || breakEnd > end) {
        ctx.addIssue({
          code: "custom",
          path: ["breakStart"],
          message: "O intervalo precisa começar antes de terminar e ficar dentro da jornada.",
        });
      }
    }
  }

export const studioSettingsSchema = z.object({
  active: checkbox,
  workDays: stringList(z.enum(BUSINESS_DAYS), { min: 1, max: 6, message: "Selecione ao menos um dia de atendimento." }),
  workStart: timeKey,
  workEnd: timeKey,
  breakStart: optionalTime,
  breakEnd: optionalTime,
}).superRefine(validateWorkSchedule);

export const appointmentSchema = z.object({
  clientId: requiredId("Selecione uma cliente."),
  serviceId: requiredId("Selecione um serviço."),
  professionalId: idSchema.default(STUDIO_PROFESSIONAL_ID),
  date: dateKey,
  startTime: timeKey,
  notes: optionalText(500),
});

export const appointmentStatusSchema = z.enum([
  "scheduled",
  "confirmed",
  "in-progress",
  "completed",
  "cancelled",
]);

export const statusChangeSchema = z.object({
  id: idSchema,
  status: appointmentStatusSchema,
});

export const staffRescheduleSchema = z.object({
  id: idSchema,
  date: dateKey,
  startTime: timeKey,
  professionalId: idSchema.default(STUDIO_PROFESSIONAL_ID),
});

export const blockSchema = z
  .object({
    professionalId: z.preprocess(trimToUndefined, idSchema.optional()),
    startDate: dateKey,
    endDate: dateKey,
    allDay: checkbox,
    startTime: optionalTime,
    endTime: optionalTime,
    reason: z.string().trim().min(2, "Informe o motivo do bloqueio.").max(120),
  })
  .superRefine((value, ctx) => {
    if (value.endDate < value.startDate) {
      ctx.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "A data final não pode ser anterior à inicial.",
      });
    }

    if (value.allDay) return;

    if (!value.startTime || !value.endTime) {
      ctx.addIssue({
        code: "custom",
        path: ["startTime"],
        message: "Informe o horário inicial e final, ou marque dia inteiro.",
      });
    } else if (timeToMinutes(value.startTime) >= timeToMinutes(value.endTime)) {
      ctx.addIssue({
        code: "custom",
        path: ["endTime"],
        message: "O horário final deve ser depois do inicial.",
      });
    }
  });

/** Token opaco entregue à cliente para acessar o próprio agendamento. */
export const accessTokenSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9_-]{32,64}$/, "Link inválido ou expirado.");

/** Dados que a cliente envia no portal público. */
export const publicBookingSchema = z.object({
  firstName: z.string().trim().min(2, "Informe seu nome.").max(60),
  lastName: z.string().trim().min(2, "Informe seu sobrenome.").max(60),
  phone: phoneField,
  serviceId: idSchema,
  professionalId: idSchema.default(STUDIO_PROFESSIONAL_ID),
  date: dateKey,
  startTime: timeKey,
  notes: optionalText(300),
});

export const availabilityQuerySchema = z.object({
  serviceId: idSchema,
  date: dateKey,
  professionalId: idSchema.optional(),
  appointmentToken: accessTokenSchema.optional(),
});

export const rescheduleSchema = z.object({
  token: accessTokenSchema,
  date: dateKey,
  startTime: timeKey,
  professionalId: idSchema.default(STUDIO_PROFESSIONAL_ID),
});

export const recoveryRequestSchema = z.object({ phone: phoneField });

export const recoveryVerifySchema = z.object({
  phone: phoneField,
  code: z.string().trim().regex(/^\d{6}$/, "Informe o código de 6 dígitos."),
});

export const paymentMethodKindSchema = z.enum([
  "pix",
  "cash",
  "credit",
  "debit",
  "transfer",
  "other",
]);

const paymentMethodEntrySchema = z.object({
  method: paymentMethodKindSchema,
  amount: moneyField,
});

/** Recibo enviado pela tela de pagamentos (objeto, não FormData). */
export const paymentSchema = z
  .object({
    appointmentIds: z
      .array(idSchema)
      .min(1, "Selecione ao menos um atendimento.")
      .max(50, "Selecione menos atendimentos por recibo."),
    paidAt: dateKey.refine(
      (value) => value <= getTodayKey(),
      "A data do pagamento não pode estar no futuro.",
    ),
    discount: optionalMoney,
    surcharge: optionalMoney,
    methods: z
      .array(paymentMethodEntrySchema)
      .min(1, "Informe ao menos uma forma de pagamento.")
      .max(10, "Formas de pagamento demais."),
    notes: optionalText(300),
  })
  .superRefine((value, ctx) => {
    if (value.methods.some((entry) => entry.amount <= 0)) {
      ctx.addIssue({
        code: "custom",
        path: ["methods"],
        message: "Cada forma de pagamento precisa de um valor maior que zero.",
      });
    }
  });

export type FieldErrors = Record<string, string>;

/** Extrai a primeira mensagem legível de um erro do Zod. */
export function firstIssueMessage(error: z.ZodError) {
  return error.issues[0]?.message ?? "Dados inválidos.";
}

/** Primeira mensagem de cada campo, indexada pelo nome do campo. */
export function fieldErrorsFrom(error: z.ZodError): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    errors[key] ??= issue.message;
  }
  return errors;
}

/** Converte FormData em objeto, agrupando campos repetidos (checkboxes) em listas. */
export function formDataToObject(formData: FormData) {
  const values: Record<string, FormDataEntryValue | FormDataEntryValue[]> = {};
  for (const key of new Set(formData.keys())) {
    const entries = formData.getAll(key);
    values[key] = entries.length > 1 ? entries : entries[0];
  }
  return values;
}
