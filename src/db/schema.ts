import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  time,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const appointmentStatusEnum = pgEnum("appointment_status", [
  "scheduled",
  "confirmed",
  "in-progress",
  "completed",
  "cancelled",
]);

export const serviceStatusEnum = pgEnum("service_status", [
  "active",
  "inactive",
]);

export const appointmentSourceEnum = pgEnum("appointment_source", [
  "staff",
  "portal",
]);

export const appointmentEventKindEnum = pgEnum("appointment_event_kind", [
  "created",
  "status_changed",
  "rescheduled",
]);

export const paymentStatusEnum = pgEnum("payment_status", ["paid", "refunded"]);

export const paymentMethodEnum = pgEnum("payment_method", [
  "pix",
  "cash",
  "credit",
  "debit",
  "transfer",
  "other",
]);

const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

const emptyTextArray = sql`ARRAY[]::text[]`;

export const clients = pgTable(
  "clients",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    phone: text("phone").notNull(),
    phoneDigits: text("phone_digits").notNull(),
    email: text("email"),
    birthDate: date("birth_date"),
    tags: text("tags").array().notNull().default(emptyTextArray),
    createdAt: createdAt(),
  },
  (table) => [uniqueIndex("clients_phone_digits_unique").on(table.phoneDigits)],
);

export const services = pgTable("services", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  description: text("description").notNull(),
  durationMinutes: integer("duration_minutes").notNull(),
  bufferMinutes: integer("buffer_minutes").notNull().default(0),
  priceCents: integer("price_cents").notNull(),
  status: serviceStatusEnum("status").notNull().default("active"),
  color: text("color").notNull(),
  createdAt: createdAt(),
});

export const professionals = pgTable("professionals", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  role: text("role").notNull(),
  specialties: text("specialties").array().notNull().default(emptyTextArray),
  phone: text("phone").notNull(),
  email: text("email").notNull(),
  active: boolean("active").notNull().default(true),
  color: text("color").notNull(),
  workDays: text("work_days").array().notNull().default(emptyTextArray),
  workStart: time("work_start").notNull().default("08:00"),
  workEnd: time("work_end").notNull().default("19:00"),
  breakStart: time("break_start"),
  breakEnd: time("break_end"),
  commissionRateBps: integer("commission_rate_bps").notNull().default(0),
  createdAt: createdAt(),
});

export const professionalServices = pgTable(
  "professional_services",
  {
    professionalId: text("professional_id")
      .notNull()
      .references(() => professionals.id, { onDelete: "cascade" }),
    serviceId: text("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.professionalId, table.serviceId] }),
    index("professional_services_service_idx").on(table.serviceId),
  ],
);

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    /** Chave constante e única: o sistema aceita exatamente uma conta administrativa. */
    singletonKey: integer("singleton_key").notNull().default(1).unique(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    password: text("password").notNull(),
    createdAt: date("created_at").notNull().defaultNow(),
  },
  (table) => [check("users_singleton_key_check", sql`${table.singletonKey} = 1`)],
);

export const appointments = pgTable(
  "appointments",
  {
    id: text("id").primaryKey(),
    date: date("date").notNull(),
    startTime: time("start_time").notNull(),
    endTime: time("end_time").notNull(),
    bufferMinutes: integer("buffer_minutes").notNull().default(0),
    clientId: text("client_id")
      .notNull()
      .references(() => clients.id),
    clientName: text("client_name").notNull(),
    serviceId: text("service_id")
      .notNull()
      .references(() => services.id),
    serviceName: text("service_name").notNull(),
    professionalId: text("professional_id")
      .notNull()
      .references(() => professionals.id),
    professionalName: text("professional_name").notNull(),
    status: appointmentStatusEnum("status").notNull().default("scheduled"),
    priceCents: integer("price_cents").notNull(),
    notes: text("notes"),
    source: appointmentSourceEnum("source").notNull().default("staff"),
    accessTokenHash: text("access_token_hash"),
    reminderSentAt: timestamp("reminder_sent_at", { withTimezone: true }),
    createdBy: text("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("appointments_date_idx").on(table.date),
    index("appointments_professional_date_idx").on(
      table.professionalId,
      table.date,
    ),
    index("appointments_client_idx").on(table.clientId),
    uniqueIndex("appointments_access_token_hash_unique").on(
      table.accessTokenHash,
    ),
  ],
);

export const appointmentEvents = pgTable(
  "appointment_events",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    appointmentId: text("appointment_id")
      .notNull()
      .references(() => appointments.id, { onDelete: "cascade" }),
    kind: appointmentEventKindEnum("kind").notNull(),
    status: appointmentStatusEnum("status").notNull(),
    actorUserId: text("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    actorSource: appointmentSourceEnum("actor_source").notNull(),
    note: text("note"),
    createdAt: createdAt(),
  },
  (table) => [index("appointment_events_appointment_idx").on(table.appointmentId)],
);

/** Folgas, feriados e bloqueios; `professionalId` nulo vale para o estúdio todo. */
export const scheduleBlocks = pgTable(
  "schedule_blocks",
  {
    id: text("id").primaryKey(),
    professionalId: text("professional_id").references(() => professionals.id, {
      onDelete: "cascade",
    }),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    startTime: time("start_time"),
    endTime: time("end_time"),
    reason: text("reason").notNull(),
    createdBy: text("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
  },
  (table) => [index("schedule_blocks_dates_idx").on(table.startDate, table.endDate)],
);

/** Contador por chave (telefone, IP, e-mail) da janela corrente de tentativas. */
export const bookingRateLimits = pgTable("booking_rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull().default(0),
  windowStart: timestamp("window_start", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const verificationCodes = pgTable("verification_codes", {
  key: text("key").primaryKey(),
  codeHash: text("code_hash").notNull(),
  attempts: integer("attempts").notNull().default(0),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: createdAt(),
});

/** Recibo de pagamento; pode reunir vários atendimentos da mesma cliente. */
export const payments = pgTable(
  "payments",
  {
    id: text("id").primaryKey(),
    clientId: text("client_id")
      .notNull()
      .references(() => clients.id),
    clientName: text("client_name").notNull(),
    paidAt: date("paid_at").notNull(),
    subtotalCents: integer("subtotal_cents").notNull(),
    discountCents: integer("discount_cents").notNull().default(0),
    surchargeCents: integer("surcharge_cents").notNull().default(0),
    totalCents: integer("total_cents").notNull(),
    status: paymentStatusEnum("status").notNull().default("paid"),
    notes: text("notes"),
    createdBy: text("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("payments_paid_at_idx").on(table.paidAt),
    index("payments_client_idx").on(table.clientId),
  ],
);

/** Cada atendimento cobrado no recibo, com o valor e a comissão de quem atendeu. */
export const paymentItems = pgTable(
  "payment_items",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    paymentId: text("payment_id")
      .notNull()
      .references(() => payments.id, { onDelete: "cascade" }),
    appointmentId: text("appointment_id")
      .notNull()
      .references(() => appointments.id),
    professionalId: text("professional_id")
      .notNull()
      .references(() => professionals.id),
    professionalName: text("professional_name").notNull(),
    serviceId: text("service_id")
      .notNull()
      .references(() => services.id),
    serviceName: text("service_name").notNull(),
    priceCents: integer("price_cents").notNull(),
    commissionRateBps: integer("commission_rate_bps").notNull().default(0),
    commissionCents: integer("commission_cents").notNull().default(0),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("payment_items_appointment_unique").on(table.appointmentId),
    index("payment_items_payment_idx").on(table.paymentId),
    index("payment_items_professional_idx").on(table.professionalId),
  ],
);

/** Formas usadas para quitar o recibo; permite dividir (ex.: parte Pix, parte dinheiro). */
export const paymentMethods = pgTable(
  "payment_methods",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    paymentId: text("payment_id")
      .notNull()
      .references(() => payments.id, { onDelete: "cascade" }),
    method: paymentMethodEnum("method").notNull(),
    amountCents: integer("amount_cents").notNull(),
    createdAt: createdAt(),
  },
  (table) => [index("payment_methods_payment_idx").on(table.paymentId)],
);
