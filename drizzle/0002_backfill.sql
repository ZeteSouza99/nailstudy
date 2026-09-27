-- Custom SQL migration file, put your code below! --
-- Mesma regra de src/lib/phone.ts: só dígitos, sem o código do país.
UPDATE "clients" SET "phone_digits" = CASE
  WHEN length(regexp_replace("phone", '\D', '', 'g')) > 11
    AND regexp_replace("phone", '\D', '', 'g') LIKE '55%'
    THEN substr(regexp_replace("phone", '\D', '', 'g'), 3)
  ELSE regexp_replace("phone", '\D', '', 'g')
END
WHERE "phone_digits" IS NULL OR "phone_digits" = '';
--> statement-breakpoint
UPDATE "clients" SET "phone_digits" = 'sem-telefone:' || "id" WHERE "phone_digits" = '';
--> statement-breakpoint
UPDATE "clients" SET "email" = NULL WHERE btrim("email") = '';
--> statement-breakpoint
-- O portal gravava a data do cadastro como nascimento.
UPDATE "clients" SET "birth_date" = NULL WHERE "email" IS NULL AND 'Portal' = ANY("tags");
--> statement-breakpoint
UPDATE "clients" SET "tags" = array_remove("tags", 'Nova cliente');
--> statement-breakpoint
-- Fichas duplicadas pelo telefone: mantém a que tem e-mail e mais atendimentos.
WITH ranked AS (
  SELECT c."id",
    first_value(c."id") OVER (
      PARTITION BY c."phone_digits"
      ORDER BY (c."email" IS NOT NULL) DESC,
        (SELECT count(*) FROM "appointments" a WHERE a."client_id" = c."id") DESC,
        c."id"
    ) AS "keep_id"
  FROM "clients" c
)
UPDATE "appointments" a SET "client_id" = r."keep_id"
FROM ranked r
WHERE a."client_id" = r."id" AND r."id" <> r."keep_id";
--> statement-breakpoint
WITH ranked AS (
  SELECT c."id",
    first_value(c."id") OVER (
      PARTITION BY c."phone_digits"
      ORDER BY (c."email" IS NOT NULL) DESC,
        (SELECT count(*) FROM "appointments" a WHERE a."client_id" = c."id") DESC,
        c."id"
    ) AS "keep_id"
  FROM "clients" c
)
DELETE FROM "clients" c USING ranked r
WHERE c."id" = r."id" AND r."id" <> r."keep_id";
--> statement-breakpoint
UPDATE "services" SET "price_cents" = round("price" * 100)::integer;
--> statement-breakpoint
UPDATE "appointments" SET "price_cents" = round("price" * 100)::integer;
--> statement-breakpoint
INSERT INTO "professional_services" ("professional_id", "service_id")
SELECT p."id", s."id"
FROM "professionals" p
CROSS JOIN LATERAL unnest(p."service_ids") AS sid("service_id")
JOIN "services" s ON s."id" = sid."service_id"
ON CONFLICT DO NOTHING;
--> statement-breakpoint
-- Links já enviados continuam válidos: o banco passa a guardar só o hash.
UPDATE "appointments"
SET "access_token_hash" = encode(sha256(convert_to("access_token", 'UTF8')), 'hex')
WHERE "access_token" IS NOT NULL;
--> statement-breakpoint
INSERT INTO "appointment_events" ("appointment_id", "kind", "status", "actor_source", "note")
SELECT "id", 'created', "status", "source", 'Registro anterior ao histórico'
FROM "appointments";
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS btree_gist;
--> statement-breakpoint
-- A profissional fica ocupada até o fim do tempo de preparo; a cliente, até o fim do atendimento.
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_professional_no_overlap"
  EXCLUDE USING gist (
    "professional_id" WITH =,
    tsrange(
      "date" + "start_time",
      "date" + "end_time" + "buffer_minutes" * interval '1 minute',
      '[)'
    ) WITH &&
  ) WHERE ("status" <> 'cancelled');
--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_client_no_overlap"
  EXCLUDE USING gist (
    "client_id" WITH =,
    tsrange("date" + "start_time", "date" + "end_time", '[)') WITH &&
  ) WHERE ("status" <> 'cancelled');
