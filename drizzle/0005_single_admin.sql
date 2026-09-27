-- Preserva preferencialmente a primeira conta administradora e remove as demais.
-- As referências históricas usam ON DELETE SET NULL.
DELETE FROM "users"
WHERE "id" NOT IN (
	SELECT "id" FROM "users"
	ORDER BY ("role" = 'admin') DESC, "created_at", "id"
	LIMIT 1
);
--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "users_professional_id_professionals_id_fk";
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "singleton_key" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "role";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "professional_id";--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_singleton_key_unique" UNIQUE("singleton_key");--> statement-breakpoint
DROP TYPE "public"."user_role";
