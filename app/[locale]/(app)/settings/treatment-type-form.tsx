"use client";

import { Check, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { treatmentColorNames, treatmentColors } from "@/lib/scheduling/colors";
import { saveTreatmentType, type TreatmentTypeFormState } from "./actions";

export type TreatmentTypeValues = {
  id?: string;
  name: string;
  durationMinutes: number;
  priceAgorot: number | null;
  color: string;
  bookableOnline: boolean;
};

/** Adds a treatment type, or edits one when `initial.id` is set. */
export function TreatmentTypeForm({
  locale,
  t,
  initial,
  onDone,
}: {
  locale: Locale;
  t: Dictionary["treatmentTypes"];
  initial?: TreatmentTypeValues;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<
    TreatmentTypeFormState,
    FormData
  >(saveTreatmentType, {});

  useEffect(() => {
    if (!state.savedAt) return;
    router.refresh();
    onDone?.();
  }, [state.savedAt, router, onDone]);

  const idPrefix = initial?.id ?? "new";
  const price =
    initial?.priceAgorot != null ? String(initial.priceAgorot / 100) : "";

  return (
    <form
      action={formAction}
      key={state.savedAt ?? "form"}
      className="flex flex-col gap-3"
    >
      <input type="hidden" name="locale" value={locale} />
      {initial?.id ? (
        <input type="hidden" name="id" value={initial.id} />
      ) : null}

      <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr]">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">{t.name}</span>
          <Input
            name="name"
            required
            minLength={2}
            maxLength={60}
            defaultValue={initial?.name}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">{t.duration}</span>
          <Input
            name="durationMinutes"
            type="number"
            inputMode="numeric"
            min={5}
            max={480}
            step={5}
            required
            defaultValue={initial?.durationMinutes ?? 60}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">
            {t.price}{" "}
            <span className="font-normal text-muted-foreground">
              ({t.priceHint})
            </span>
          </span>
          <Input
            name="price"
            inputMode="decimal"
            dir="ltr"
            pattern="\d{1,6}([.,]\d{1,2})?"
            defaultValue={price}
          />
        </label>
      </div>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-sm font-medium">{t.color}</legend>
        <div className="flex flex-wrap gap-2">
          {treatmentColorNames.map((color) => (
            <label key={color} className="relative cursor-pointer">
              <input
                type="radio"
                name="color"
                value={color}
                defaultChecked={(initial?.color ?? "teal") === color}
                className="peer sr-only"
                id={`${idPrefix}-color-${color}`}
              />
              <span
                aria-hidden
                className="flex size-8 items-center justify-center rounded-full border-2 peer-checked:ring-2 peer-checked:ring-ring peer-checked:ring-offset-2 peer-focus-visible:ring-2 peer-focus-visible:ring-ring [&>svg]:invisible peer-checked:[&>svg]:visible"
                style={{
                  background: treatmentColors[color].background,
                  borderColor: treatmentColors[color].border,
                  color: treatmentColors[color].text,
                }}
              >
                <Check className="size-4" />
              </span>
              <span className="sr-only">{t.colors[color]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="bookableOnline"
          defaultChecked={initial?.bookableOnline ?? false}
          className="size-4 accent-primary"
        />
        {t.bookableOnline}
      </label>

      <FieldError>{state.error ? t[state.error] : null}</FieldError>

      <div className="flex gap-2">
        <Button
          type="submit"
          variant={initial ? "default" : "secondary"}
          disabled={pending}
        >
          {initial ? null : <Plus aria-hidden />}
          {initial ? t.save : t.add}
        </Button>
        {onDone ? (
          <Button type="button" variant="ghost" onClick={onDone}>
            {t.cancel}
          </Button>
        ) : null}
      </div>
    </form>
  );
}
