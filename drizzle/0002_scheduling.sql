CREATE TABLE "appointments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" text NOT NULL,
	"patient_id" uuid NOT NULL,
	"treatment_type_id" uuid,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"source" text DEFAULT 'staff' NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "appointments_time_check" CHECK ("appointments"."ends_at" > "appointments"."starts_at"),
	CONSTRAINT "appointments_status_check" CHECK ("appointments"."status" in ('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show')),
	CONSTRAINT "appointments_source_check" CHECK ("appointments"."source" in ('staff', 'online'))
);
--> statement-breakpoint
CREATE TABLE "availability_exceptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" text NOT NULL,
	"date" date NOT NULL,
	"start_time" time,
	"end_time" time,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "availability_exceptions_time_check" CHECK (("availability_exceptions"."start_time" is null and "availability_exceptions"."end_time" is null) or ("availability_exceptions"."start_time" is not null and "availability_exceptions"."end_time" is not null and "availability_exceptions"."end_time" > "availability_exceptions"."start_time"))
);
--> statement-breakpoint
CREATE TABLE "availability_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" text NOT NULL,
	"weekday" smallint NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "availability_rules_weekday_check" CHECK ("availability_rules"."weekday" between 0 and 6),
	CONSTRAINT "availability_rules_time_check" CHECK ("availability_rules"."end_time" > "availability_rules"."start_time")
);
--> statement-breakpoint
ALTER TABLE "treatment_types" ADD COLUMN "duration_minutes" integer DEFAULT 60 NOT NULL;--> statement-breakpoint
ALTER TABLE "treatment_types" ADD COLUMN "price_agorot" integer;--> statement-breakpoint
ALTER TABLE "treatment_types" ADD COLUMN "color" text DEFAULT 'teal' NOT NULL;--> statement-breakpoint
ALTER TABLE "treatment_types" ADD COLUMN "bookable_online" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_clinic_id_organization_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_patient_fk" FOREIGN KEY ("clinic_id","patient_id") REFERENCES "public"."patients"("clinic_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_treatment_type_fk" FOREIGN KEY ("clinic_id","treatment_type_id") REFERENCES "public"."treatment_types"("clinic_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availability_exceptions" ADD CONSTRAINT "availability_exceptions_clinic_id_organization_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availability_rules" ADD CONSTRAINT "availability_rules_clinic_id_organization_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "appointments_clinic_starts_idx" ON "appointments" USING btree ("clinic_id","starts_at");--> statement-breakpoint
CREATE INDEX "appointments_patient_idx" ON "appointments" USING btree ("clinic_id","patient_id","starts_at");--> statement-breakpoint
CREATE INDEX "availability_exceptions_clinic_date_idx" ON "availability_exceptions" USING btree ("clinic_id","date");--> statement-breakpoint
CREATE INDEX "availability_rules_clinic_idx" ON "availability_rules" USING btree ("clinic_id","weekday");--> statement-breakpoint
-- Hand-written (Drizzle can't express exclusion constraints): no two
-- non-cancelled appointments in the same clinic may overlap in time.
-- '[)' makes back-to-back appointments (10:00–11:00, 11:00–12:00) allowed.
CREATE EXTENSION IF NOT EXISTS btree_gist;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_no_overlap" EXCLUDE USING gist ("clinic_id" WITH =, tstzrange("starts_at", "ends_at", '[)') WITH &&) WHERE ("status" <> 'cancelled');
