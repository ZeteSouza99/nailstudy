CREATE TYPE "public"."appointment_source" AS ENUM('staff', 'portal');--> statement-breakpoint
CREATE TYPE "public"."appointment_status" AS ENUM('scheduled', 'confirmed', 'in-progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."professional_status" AS ENUM('available', 'in-service', 'off-duty');--> statement-breakpoint
CREATE TYPE "public"."service_status" AS ENUM('active', 'inactive');--> statement-breakpoint
CREATE TABLE "appointments" (
	"id" text PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	"client_id" text NOT NULL,
	"client_name" text NOT NULL,
	"service_id" text NOT NULL,
	"service_name" text NOT NULL,
	"professional_id" text NOT NULL,
	"professional_name" text NOT NULL,
	"status" "appointment_status" DEFAULT 'scheduled' NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"notes" text,
	"source" "appointment_source" DEFAULT 'staff' NOT NULL,
	"access_token" text
);
--> statement-breakpoint
CREATE TABLE "booking_rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"window_start" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"phone_digits" text,
	"email" text NOT NULL,
	"birth_date" date NOT NULL,
	"last_visit" date,
	"total_appointments" integer DEFAULT 0 NOT NULL,
	"tags" text[] DEFAULT ARRAY[]::text[] NOT NULL
);
--> statement-breakpoint
CREATE TABLE "professionals" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"role" text NOT NULL,
	"specialties" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"service_ids" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"phone" text NOT NULL,
	"email" text NOT NULL,
	"status" "professional_status" DEFAULT 'available' NOT NULL,
	"color" text NOT NULL,
	"work_days" text[] DEFAULT ARRAY[]::text[] NOT NULL
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"description" text NOT NULL,
	"duration_minutes" integer NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"status" "service_status" DEFAULT 'active' NOT NULL,
	"color" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password" text NOT NULL,
	"role" text DEFAULT 'admin' NOT NULL,
	"created_at" date DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_professional_id_professionals_id_fk" FOREIGN KEY ("professional_id") REFERENCES "public"."professionals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "appointments_date_idx" ON "appointments" USING btree ("date");--> statement-breakpoint
CREATE INDEX "appointments_professional_date_idx" ON "appointments" USING btree ("professional_id","date");--> statement-breakpoint
CREATE INDEX "appointments_client_idx" ON "appointments" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "appointments_access_token_idx" ON "appointments" USING btree ("access_token");--> statement-breakpoint
CREATE INDEX "clients_phone_digits_idx" ON "clients" USING btree ("phone_digits");