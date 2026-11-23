ALTER TABLE "activities" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "activities" ADD COLUMN "commitment" varchar(20) DEFAULT 'PLANNED' NOT NULL;--> statement-breakpoint
ALTER TABLE "activities" ADD COLUMN "time_window" varchar(20);--> statement-breakpoint
ALTER TABLE "activities" ADD COLUMN "duration_min" integer;--> statement-breakpoint
ALTER TABLE "activities" ADD COLUMN "travel_mode" varchar(30);--> statement-breakpoint
ALTER TABLE "activities" ADD COLUMN "stay_nights" integer;