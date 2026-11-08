CREATE TABLE "public_rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer NOT NULL,
	"reset_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "clinic_settings" ADD COLUMN "booking_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "clinic_settings" ADD COLUMN "booking_auto_confirm" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "clinic_settings" ADD COLUMN "booking_min_notice_minutes" integer DEFAULT 720 NOT NULL;--> statement-breakpoint
ALTER TABLE "clinic_settings" ADD COLUMN "booking_window_days" integer DEFAULT 30 NOT NULL;--> statement-breakpoint
ALTER TABLE "clinic_settings" ADD COLUMN "booking_slot_interval_minutes" integer DEFAULT 30 NOT NULL;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "cancel_token_hash" text;--> statement-breakpoint
CREATE UNIQUE INDEX "appointments_cancel_token_uidx" ON "appointments" USING btree ("cancel_token_hash");