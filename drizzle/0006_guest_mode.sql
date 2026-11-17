ALTER TABLE "user" ADD COLUMN "is_anonymous" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "clinic_settings" ADD COLUMN "is_demo" boolean DEFAULT false NOT NULL;