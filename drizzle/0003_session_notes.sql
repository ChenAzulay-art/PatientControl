-- Moved first by hand: the session_notes foreign key below needs this key to exist.
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_clinic_id_id_key" UNIQUE("clinic_id","id");--> statement-breakpoint
CREATE TABLE "session_note_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" text NOT NULL,
	"note_id" uuid NOT NULL,
	"body_encrypted" text NOT NULL,
	"saved_by" text,
	"saved_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" text NOT NULL,
	"appointment_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"body_encrypted" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"author_id" text,
	"finalized_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_notes_appointment_key" UNIQUE("appointment_id"),
	CONSTRAINT "session_notes_clinic_id_id_key" UNIQUE("clinic_id","id"),
	CONSTRAINT "session_notes_status_check" CHECK ("session_notes"."status" in ('draft', 'final')),
	CONSTRAINT "session_notes_finalized_check" CHECK (("session_notes"."status" = 'final') = ("session_notes"."finalized_at" is not null))
);
--> statement-breakpoint
ALTER TABLE "session_note_versions" ADD CONSTRAINT "session_note_versions_saved_by_user_id_fk" FOREIGN KEY ("saved_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_note_versions" ADD CONSTRAINT "session_note_versions_note_fk" FOREIGN KEY ("clinic_id","note_id") REFERENCES "public"."session_notes"("clinic_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_notes" ADD CONSTRAINT "session_notes_clinic_id_organization_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_notes" ADD CONSTRAINT "session_notes_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_notes" ADD CONSTRAINT "session_notes_appointment_fk" FOREIGN KEY ("clinic_id","appointment_id") REFERENCES "public"."appointments"("clinic_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_notes" ADD CONSTRAINT "session_notes_patient_fk" FOREIGN KEY ("clinic_id","patient_id") REFERENCES "public"."patients"("clinic_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "session_note_versions_note_idx" ON "session_note_versions" USING btree ("note_id","saved_at");--> statement-breakpoint
CREATE INDEX "session_notes_patient_idx" ON "session_notes" USING btree ("clinic_id","patient_id");
