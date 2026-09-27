CREATE TYPE "public"."appointment_event_kind" AS ENUM('created', 'status_changed', 'rescheduled');--> statement-breakpoint
CREATE TABLE "appointment_events" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "appointment_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"appointment_id" text NOT NULL,
	"kind" "appointment_event_kind" NOT NULL,
	"status" "appointment_status" NOT NULL,
	"actor_user_id" text,
	"actor_source" "appointment_source" NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "professional_services" (
	"professional_id" text NOT NULL,
	"service_id" text NOT NULL,
	CONSTRAINT "professional_services_professional_id_service_id_pk" PRIMARY KEY("professional_id","service_id")
);
--> statement-breakpoint
CREATE TABLE "schedule_blocks" (
	"id" text PRIMARY KEY NOT NULL,
	"professional_id" text,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"start_time" time,
	"end_time" time,
	"reason" text NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification_codes" (
	"key" text PRIMARY KEY NOT NULL,
	"code_hash" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "clients" ALTER COLUMN "email" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "clients" ALTER COLUMN "birth_date" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "buffer_minutes" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "price_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "access_token_hash" text;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "reminder_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "created_by" text;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "professionals" ADD COLUMN "active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "professionals" ADD COLUMN "work_start" time DEFAULT '08:00' NOT NULL;--> statement-breakpoint
ALTER TABLE "professionals" ADD COLUMN "work_end" time DEFAULT '19:00' NOT NULL;--> statement-breakpoint
ALTER TABLE "professionals" ADD COLUMN "break_start" time;--> statement-breakpoint
ALTER TABLE "professionals" ADD COLUMN "break_end" time;--> statement-breakpoint
ALTER TABLE "professionals" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "buffer_minutes" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "price_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "professional_id" text;--> statement-breakpoint
ALTER TABLE "appointment_events" ADD CONSTRAINT "appointment_events_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_events" ADD CONSTRAINT "appointment_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professional_services" ADD CONSTRAINT "professional_services_professional_id_professionals_id_fk" FOREIGN KEY ("professional_id") REFERENCES "public"."professionals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professional_services" ADD CONSTRAINT "professional_services_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_blocks" ADD CONSTRAINT "schedule_blocks_professional_id_professionals_id_fk" FOREIGN KEY ("professional_id") REFERENCES "public"."professionals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_blocks" ADD CONSTRAINT "schedule_blocks_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "appointment_events_appointment_idx" ON "appointment_events" USING btree ("appointment_id");--> statement-breakpoint
CREATE INDEX "professional_services_service_idx" ON "professional_services" USING btree ("service_id");--> statement-breakpoint
CREATE INDEX "schedule_blocks_dates_idx" ON "schedule_blocks" USING btree ("start_date","end_date");--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_professional_id_professionals_id_fk" FOREIGN KEY ("professional_id") REFERENCES "public"."professionals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "appointments_access_token_hash_unique" ON "appointments" USING btree ("access_token_hash");