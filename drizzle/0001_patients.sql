CREATE TABLE "patient_treatment_types" (
	"clinic_id" text NOT NULL,
	"patient_id" uuid NOT NULL,
	"treatment_type_id" uuid NOT NULL,
	CONSTRAINT "patient_treatment_types_patient_id_treatment_type_id_pk" PRIMARY KEY("patient_id","treatment_type_id")
);
--> statement-breakpoint
CREATE TABLE "patients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" text NOT NULL,
	"full_name" text NOT NULL,
	"phone" text NOT NULL,
	"email" text,
	"date_of_birth" date,
	"national_id_encrypted" text,
	"national_id_hash" text,
	"medical_background_encrypted" text,
	"important_notes_encrypted" text,
	"preferred_locale" text DEFAULT 'he' NOT NULL,
	"reminder_consent" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp with time zone,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "patients_clinic_id_id_key" UNIQUE("clinic_id","id")
);
--> statement-breakpoint
CREATE TABLE "treatment_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" text NOT NULL,
	"name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "treatment_types_clinic_id_id_key" UNIQUE("clinic_id","id")
);
--> statement-breakpoint
ALTER TABLE "patient_treatment_types" ADD CONSTRAINT "patient_treatment_types_patient_fk" FOREIGN KEY ("clinic_id","patient_id") REFERENCES "public"."patients"("clinic_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_treatment_types" ADD CONSTRAINT "patient_treatment_types_treatment_type_fk" FOREIGN KEY ("clinic_id","treatment_type_id") REFERENCES "public"."treatment_types"("clinic_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patients" ADD CONSTRAINT "patients_clinic_id_organization_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patients" ADD CONSTRAINT "patients_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treatment_types" ADD CONSTRAINT "treatment_types_clinic_id_organization_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "patients_clinic_name_idx" ON "patients" USING btree ("clinic_id","full_name");--> statement-breakpoint
CREATE INDEX "patients_clinic_national_id_idx" ON "patients" USING btree ("clinic_id","national_id_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "treatment_types_clinic_name_uidx" ON "treatment_types" USING btree ("clinic_id",lower("name"));