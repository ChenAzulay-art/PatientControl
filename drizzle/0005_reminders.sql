CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" text NOT NULL,
	"appointment_id" uuid NOT NULL,
	"kind" text DEFAULT 'reminder' NOT NULL,
	"channel" text DEFAULT 'email' NOT NULL,
	"appointment_starts_at" timestamp with time zone NOT NULL,
	"status" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_attempt_at" timestamp with time zone,
	"next_attempt_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"provider_message_id" text,
	"error_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notifications_status_check" CHECK ("notifications"."status" in ('sending', 'sent', 'retry', 'failed'))
);
--> statement-breakpoint
ALTER TABLE "clinic_settings" ADD COLUMN "reminders_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "clinic_settings" ADD COLUMN "reminder_lead_minutes" integer DEFAULT 1440 NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_clinic_id_organization_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_appointment_fk" FOREIGN KEY ("clinic_id","appointment_id") REFERENCES "public"."appointments"("clinic_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_appointment_kind_time_uidx" ON "notifications" USING btree ("appointment_id","kind","appointment_starts_at");--> statement-breakpoint
CREATE INDEX "notifications_status_next_idx" ON "notifications" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE INDEX "notifications_clinic_created_idx" ON "notifications" USING btree ("clinic_id","created_at");--> statement-breakpoint
CREATE INDEX "appointments_starts_idx" ON "appointments" USING btree ("starts_at");