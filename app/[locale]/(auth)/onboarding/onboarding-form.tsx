"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { createClinic, type CreateClinicState } from "./actions";

export function OnboardingForm({
  locale,
  t,
}: {
  locale: Locale;
  t: Dictionary;
}) {
  const [state, formAction, pending] = useActionState<
    CreateClinicState,
    FormData
  >(createClinic, {});
  const error = state.error
    ? state.error === "generic"
      ? t.auth.errors.generic
      : t.onboarding[state.error]
    : null;

  return (
    <form action={formAction}>
      <input type="hidden" name="locale" value={locale} />
      <FieldGroup>
        <FormMessage message={error} />
        <Field>
          <FieldLabel htmlFor="name">{t.onboarding.clinicName}</FieldLabel>
          <Input
            id="name"
            name="name"
            required
            minLength={2}
            maxLength={80}
            defaultValue={state.values?.name}
            aria-describedby="name-hint"
            aria-invalid={state.error === "nameRequired" || undefined}
          />
          <FieldDescription id="name-hint">
            {t.onboarding.clinicNameHint}
          </FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="slug">{t.onboarding.slug}</FieldLabel>
          <Input
            id="slug"
            name="slug"
            dir="ltr"
            required
            minLength={3}
            maxLength={40}
            // Browsers compile `pattern` with the `v` flag, where a literal dash must be escaped.
            pattern={"[a-z0-9][a-z0-9\\-]{1,38}[a-z0-9]"}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            defaultValue={state.values?.slug}
            aria-describedby="slug-hint"
            aria-invalid={
              state.error === "slugInvalid" ||
              state.error === "slugTaken" ||
              undefined
            }
          />
          <FieldDescription id="slug-hint">
            {t.onboarding.slugHint}
          </FieldDescription>
        </Field>
        <Button type="submit" disabled={pending}>
          {t.onboarding.submit}
        </Button>
      </FieldGroup>
    </form>
  );
}
