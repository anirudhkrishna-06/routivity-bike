CREATE TABLE "trip_member_locations" (
	"participant_id" uuid PRIMARY KEY NOT NULL,
	"latitude" text NOT NULL,
	"longitude" text NOT NULL,
	"accuracy_meters" integer,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locality" varchar(160)
);
--> statement-breakpoint
CREATE TABLE "trip_watch_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"share_id" uuid NOT NULL,
	"session_hash" varchar(128) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trip_watch_sessions_session_hash_unique" UNIQUE("session_hash")
);
--> statement-breakpoint
CREATE TABLE "trip_watch_shares" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"token_hash" varchar(128) NOT NULL,
	"passcode_hash" text NOT NULL,
	"recipient_label" varchar(80),
	"expires_at" timestamp with time zone,
	"active" boolean DEFAULT true NOT NULL,
	"last_accessed_at" timestamp with time zone,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trip_watch_shares_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "trip_member_locations" ADD CONSTRAINT "trip_member_locations_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_watch_sessions" ADD CONSTRAINT "trip_watch_sessions_share_id_trip_watch_shares_id_fk" FOREIGN KEY ("share_id") REFERENCES "public"."trip_watch_shares"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_watch_shares" ADD CONSTRAINT "trip_watch_shares_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_watch_shares" ADD CONSTRAINT "trip_watch_shares_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "trip_watch_sessions_share_idx" ON "trip_watch_sessions" USING btree ("share_id");--> statement-breakpoint
CREATE INDEX "trip_watch_shares_trip_idx" ON "trip_watch_shares" USING btree ("trip_id");