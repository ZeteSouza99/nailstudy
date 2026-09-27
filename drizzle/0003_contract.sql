CREATE TYPE "public"."user_role" AS ENUM('admin', 'receptionist', 'professional');--> statement-breakpoint
DROP INDEX "appointments_access_token_idx";--> statement-breakpoint
DROP INDEX "clients_phone_digits_idx";--> statement-breakpoint
ALTER TABLE "appointments" ALTER COLUMN "price_cents" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "clients" ALTER COLUMN "phone_digits" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "services" ALTER COLUMN "price_cents" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" SET DATA TYPE "public"."user_role" USING "role"::"public"."user_role";--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'admin'::"public"."user_role";--> statement-breakpoint
CREATE UNIQUE INDEX "clients_phone_digits_unique" ON "clients" USING btree ("phone_digits");--> statement-breakpoint
ALTER TABLE "appointments" DROP COLUMN "price";--> statement-breakpoint
ALTER TABLE "appointments" DROP COLUMN "access_token";--> statement-breakpoint
ALTER TABLE "clients" DROP COLUMN "last_visit";--> statement-breakpoint
ALTER TABLE "clients" DROP COLUMN "total_appointments";--> statement-breakpoint
ALTER TABLE "professionals" DROP COLUMN "service_ids";--> statement-breakpoint
ALTER TABLE "professionals" DROP COLUMN "status";--> statement-breakpoint
ALTER TABLE "services" DROP COLUMN "price";--> statement-breakpoint
DROP TYPE "public"."professional_status";