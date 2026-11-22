CREATE TABLE IF NOT EXISTS "trip_join_codes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "trip_id" uuid NOT NULL REFERENCES "trips"("id"),
  "code_hash" varchar(128) NOT NULL UNIQUE,
  "expires_at" timestamptz NOT NULL,
  "active" boolean NOT NULL DEFAULT true,
  "created_by" uuid NOT NULL REFERENCES "users"("id"),
  "created_at" timestamptz NOT NULL DEFAULT now()
);
