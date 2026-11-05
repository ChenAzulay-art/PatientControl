"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { addTreatmentType, type AddTreatmentTypeState } from "./actions";

export function AddTreatmentTypeForm({
  locale,
  t,
}: {
  locale: Locale;
  t: Dictionary["treatmentTypes"];
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<
    AddTreatmentTypeState,
    FormData
  >(addTreatmentType, {});

  // Show the new type in the list after it's saved.
  useEffect(() => {
    if (state.savedAt) router.refresh();
  }, [state.savedAt, router]);

  return (
    <form
      action={formAction}
      key={state.savedAt ?? "new"}
      className="flex flex-col gap-2"
    >
      <input type="hidden" name="locale" value={locale} />
      <div className="flex gap-2">
        <label htmlFor="treatment-type-name" className="sr-only">
          {t.name}
        </label>
        <Input
          id="treatment-type-name"
          name="name"
          placeholder={t.name}
          required
          minLength={2}
          maxLength={60}
          defaultValue={state.value}
          aria-invalid={state.error ? true : undefined}
          className="max-w-xs"
        />
        <Button type="submit" variant="secondary" disabled={pending}>
          <Plus aria-hidden />
          {t.add}
        </Button>
      </div>
      <FieldError>{state.error ? t[state.error] : null}</FieldError>
    </form>
  );
}
