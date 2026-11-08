"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { addException, type ExceptionFormState } from "./actions";

export function ExceptionForm({
  locale,
  t,
  hoursT,
  minDate,
}: {
  locale: Locale;
  t: Dictionary["exceptions"];
  hoursT: Dictionary["workingHours"];
  minDate: string;
}) {
  const router = useRouter();
  const [closed, setClosed] = useState(true);
  const [state, formAction, pending] = useActionState<
    ExceptionFormState,
    FormData
  >(addException, {});

  useEffect(() => {
    if (state.savedAt) router.refresh();
  }, [state.savedAt, router]);

  return (
    <form
      action={formAction}
      key={state.savedAt ?? "form"}
      className="flex flex-col gap-3"
    >
      <input type="hidden" name="locale" value={locale} />
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">{t.date}</span>
          <Input
            name="date"
            type="date"
            min={minDate}
            required
            className="w-44"
          />
        </label>
        <label className="flex items-center gap-2 pb-2 text-sm">
          <input
            type="checkbox"
            name="closed"
            checked={closed}
            onChange={(event) => setClosed(event.target.checked)}
            className="size-4 accent-primary"
          />
          {t.closedAllDay}
        </label>
        {closed ? null : (
          <>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">{hoursT.from}</span>
              <Input
                name="start"
                type="time"
                step={300}
                required
                defaultValue="09:00"
                className="w-32"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">{hoursT.to}</span>
              <Input
                name="end"
                type="time"
                step={300}
                required
                defaultValue="13:00"
                className="w-32"
              />
            </label>
          </>
        )}
        <Button type="submit" variant="secondary" disabled={pending}>
          <Plus aria-hidden />
          {t.add}
        </Button>
      </div>
      <FieldError>{state.error ? t[state.error] : null}</FieldError>
    </form>
  );
}
