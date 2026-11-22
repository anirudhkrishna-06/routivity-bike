CREATE TABLE "restructuring_proposals" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "trip_id" uuid NOT NULL REFERENCES "trips"("id"),
  "kind" varchar(60) NOT NULL,
  "status" varchar(20) DEFAULT 'proposed' NOT NULL,
  "before_snapshot" jsonb NOT NULL,
  "after_snapshot" jsonb NOT NULL,
  "diff" jsonb NOT NULL,
  "created_by" uuid NOT NULL REFERENCES "users"("id"),
  "applied_at" timestamp with time zone,
  "undone_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_conflicts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "trip_id" uuid NOT NULL REFERENCES "trips"("id"),
  "entity_type" varchar(60) NOT NULL,
  "entity_id" uuid NOT NULL,
  "base" jsonb NOT NULL,
  "mine" jsonb NOT NULL,
  "theirs" jsonb NOT NULL,
  "status" varchar(20) DEFAULT 'open' NOT NULL,
  "resolution" jsonb,
  "created_by" uuid NOT NULL REFERENCES "users"("id"),
  "resolved_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
