ALTER TABLE "users" ADD COLUMN "username" text DEFAULT 'Erika' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_username_unique" UNIQUE("username");