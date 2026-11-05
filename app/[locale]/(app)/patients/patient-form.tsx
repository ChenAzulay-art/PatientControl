"use client";

import { Lock, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";
import { FormMessage } from "@/components/form-message";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { PatientFormValues } from "@/lib/validation/patient";
import { savePatient, type PatientFormState } from "./actions";

type Props = {
  locale: Locale;
  t: Dictionary["patients"];
  languageNames: Record<Locale, string>;
  treatmentTypes: { id: string; name: string }[];
  initial: PatientFormValues;
  patientId?: string;
  cancelHref: string;
};

export function PatientForm({
  locale,
  t,
  languageNames,
  treatmentTypes,
  initial,
  patientId,
  cancelHref,
}: Props) {
  const [state, formAction, pending] = useActionState<
    PatientFormState,
    FormData
  >(savePatient, {});
  const values = state.values ?? initial;
  const errors = state.errors ?? {};
  const errorFor = (field: keyof PatientFormValues) =>
    errors[field] ? t.errors[errors[field]] : undefined;
  const invalid = (field: keyof PatientFormValues) =>
    errors[field] ? true : undefined;
  // Remount fields with the submitted values after a failed save.
  const formKey = JSON.stringify(values);

  return (
    <form action={formAction} key={formKey} className="flex flex-col gap-6">
      <input type="hidden" name="locale" value={locale} />
      {patientId ? (
        <input type="hidden" name="patientId" value={patientId} />
      ) : null}

      {Object.keys(errors).length > 0 ? (
        <FormMessage message={t.form.fixErrors} />
      ) : null}

      {state.duplicates?.length ? (
        <Alert variant="destructive">
          <TriangleAlert aria-hidden />
          <AlertTitle>{t.form.duplicateTitle}</AlertTitle>
          <AlertDescription>
            <p>{t.form.duplicateBody}</p>
            <ul className="mt-2 list-disc ps-5">
              {state.duplicates.map((duplicate) => (
                <li key={duplicate.id}>
                  <Link
                    href={`/${locale}/patients/${duplicate.id}`}
                    target="_blank"
                    className="underline underline-offset-4"
                  >
                    {duplicate.fullName}
                  </Link>
                </li>
              ))}
            </ul>
            <label className="mt-3 flex items-center gap-2 font-medium">
              <input
                type="checkbox"
                name="confirmDuplicate"
                className="size-4 accent-primary"
              />
              {t.form.duplicateConfirm}
            </label>
          </AlertDescription>
        </Alert>
      ) : null}

      <FieldSet>
        <FieldLegend>{t.card.personal}</FieldLegend>
        <FieldGroup>
          <Field data-invalid={invalid("fullName")}>
            <FieldLabel htmlFor="fullName">{t.form.fullName}</FieldLabel>
            <Input
              id="fullName"
              name="fullName"
              required
              minLength={2}
              maxLength={120}
              autoComplete="off"
              defaultValue={values.fullName}
              aria-invalid={invalid("fullName")}
            />
            <FieldError>{errorFor("fullName")}</FieldError>
          </Field>

          <div className="grid gap-6 sm:grid-cols-2">
            <Field data-invalid={invalid("phone")}>
              <FieldLabel htmlFor="phone">{t.form.phone}</FieldLabel>
              <Input
                id="phone"
                name="phone"
                type="tel"
                dir="ltr"
                required
                autoComplete="off"
                defaultValue={values.phone}
                aria-invalid={invalid("phone")}
                aria-describedby="phone-hint"
              />
              <FieldDescription id="phone-hint">
                {t.form.phoneHint}
              </FieldDescription>
              <FieldError>{errorFor("phone")}</FieldError>
            </Field>

            <Field data-invalid={invalid("email")}>
              <FieldLabel htmlFor="email">
                {t.form.email}{" "}
                <span className="font-normal text-muted-foreground">
                  ({t.form.optional})
                </span>
              </FieldLabel>
              <Input
                id="email"
                name="email"
                type="email"
                dir="ltr"
                autoComplete="off"
                defaultValue={values.email}
                aria-invalid={invalid("email")}
              />
              <FieldError>{errorFor("email")}</FieldError>
            </Field>

            <Field data-invalid={invalid("dateOfBirth")}>
              <FieldLabel htmlFor="dateOfBirth">
                {t.form.dateOfBirth}{" "}
                <span className="font-normal text-muted-foreground">
                  ({t.form.optional})
                </span>
              </FieldLabel>
              <Input
                id="dateOfBirth"
                name="dateOfBirth"
                type="date"
                min="1900-01-01"
                defaultValue={values.dateOfBirth}
                aria-invalid={invalid("dateOfBirth")}
              />
              <FieldError>{errorFor("dateOfBirth")}</FieldError>
            </Field>

            <Field data-invalid={invalid("nationalId")}>
              <FieldLabel htmlFor="nationalId">
                {t.form.nationalId}{" "}
                <span className="font-normal text-muted-foreground">
                  ({t.form.optional})
                </span>
              </FieldLabel>
              <Input
                id="nationalId"
                name="nationalId"
                inputMode="numeric"
                dir="ltr"
                maxLength={11}
                autoComplete="off"
                defaultValue={values.nationalId}
                aria-invalid={invalid("nationalId")}
                aria-describedby="nationalId-hint"
              />
              <FieldDescription id="nationalId-hint">
                {t.form.nationalIdHint}
              </FieldDescription>
              <FieldError>{errorFor("nationalId")}</FieldError>
            </Field>
          </div>
        </FieldGroup>
      </FieldSet>

      <FieldSet>
        <FieldLegend>{t.card.treatment}</FieldLegend>
        <FieldGroup>
          <Field>
            <FieldTitle id="treatmentTypes-label">
              {t.form.treatmentTypes}
            </FieldTitle>
            {treatmentTypes.length === 0 ? (
              <FieldDescription>
                {t.form.noTreatmentTypes}{" "}
                <Link
                  href={`/${locale}/settings#treatment-types`}
                  className="underline underline-offset-4"
                >
                  {t.form.manageTreatmentTypes}
                </Link>
              </FieldDescription>
            ) : (
              <div
                role="group"
                aria-labelledby="treatmentTypes-label"
                className="flex flex-wrap gap-2"
              >
                {treatmentTypes.map((type) => (
                  <label
                    key={type.id}
                    className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm has-checked:border-primary has-checked:bg-primary/5"
                  >
                    <input
                      type="checkbox"
                      name="treatmentTypeIds"
                      value={type.id}
                      defaultChecked={values.treatmentTypeIds.includes(type.id)}
                      className="size-4 accent-primary"
                    />
                    {type.name}
                  </label>
                ))}
              </div>
            )}
          </Field>

          <Field data-invalid={invalid("importantNotes")}>
            <FieldLabel htmlFor="importantNotes">
              {t.form.importantNotes}
            </FieldLabel>
            <Textarea
              id="importantNotes"
              name="importantNotes"
              rows={3}
              maxLength={2000}
              defaultValue={values.importantNotes}
              aria-describedby="importantNotes-hint"
              aria-invalid={invalid("importantNotes")}
            />
            <FieldDescription id="importantNotes-hint">
              {t.form.importantNotesHint}
            </FieldDescription>
            <FieldError>{errorFor("importantNotes")}</FieldError>
          </Field>

          <Field data-invalid={invalid("medicalBackground")}>
            <FieldLabel htmlFor="medicalBackground">
              {t.form.medicalBackground}
            </FieldLabel>
            <Textarea
              id="medicalBackground"
              name="medicalBackground"
              rows={5}
              maxLength={5000}
              defaultValue={values.medicalBackground}
              aria-describedby="medicalBackground-hint"
              aria-invalid={invalid("medicalBackground")}
            />
            <FieldDescription id="medicalBackground-hint">
              {t.form.medicalBackgroundHint}
            </FieldDescription>
            <FieldError>{errorFor("medicalBackground")}</FieldError>
          </Field>

          <Field>
            <FieldLabel htmlFor="preferredLocale">
              {t.form.preferredLocale}
            </FieldLabel>
            <NativeSelect
              id="preferredLocale"
              name="preferredLocale"
              defaultValue={values.preferredLocale || locale}
            >
              {(Object.keys(languageNames) as Locale[]).map((code) => (
                <NativeSelectOption key={code} value={code}>
                  {languageNames[code]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="reminderConsent"
              defaultChecked={values.reminderConsent}
              className="size-4 accent-primary"
            />
            {t.form.reminderConsent}
          </label>
        </FieldGroup>
      </FieldSet>

      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Lock className="size-4 shrink-0" aria-hidden />
        {t.form.encryptedNote}
      </p>

      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={pending}>
          {t.form.save}
        </Button>
        <Button asChild variant="outline">
          <Link href={cancelHref}>{t.form.cancel}</Link>
        </Button>
      </div>
    </form>
  );
}
