"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { FormMessage } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { format } from "@/lib/i18n/format";
import {
  REMINDER_LEAD_OPTIONS,
  type ReminderSettingsInput,
} from "@/lib/validation/reminders";
import { type ReminderSettingsState, saveReminderSettings } from "./actions";

export function ReminderSettingsForm({
  locale,
  t,
  settings,
}: {
  locale: Locale;
  t: Dictionary["reminders"];
  settings: ReminderSettingsInput;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<
    ReminderSettingsState,
    FormData
  >(saveReminderSettings, {});

  useEffect(() => {
    if (state.savedAt) router.refresh();
  }, [state.savedAt, router]);

  return (
    <form
      action={formAction}
      key={state.savedAt ?? "form"}
      className="flex flex-col gap-4"
    >
      <input type="hidden" name="locale" value={locale} />
      <label className="flex items-center gap-2 font-medium">
        <input
          type="checkbox"
          name="enabled"
          defaultChecked={settings.enabled}
          className="size-4 accent-primary"
        />
        {t.enabled}
      </label>
      <label className="flex flex-col gap-1.5 text-sm sm:max-w-xs">
        <span className="font-medium">{t.lead}</span>
        <NativeSelect
          name="leadMinutes"
          defaultValue={String(settings.leadMinutes)}
        >
          {REMINDER_LEAD_OPTIONS.map((minutes) => (
            <NativeSelectOption key={minutes} value={String(minutes)}>
              {format(t.hoursBefore, { n: String(minutes / 60) })}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </label>
      <p className="text-sm text-muted-foreground">{t.consentHint}</p>

      <FormMessage message={state.error ? t.invalid : null} />
      {state.savedAt ? <FormMessage tone="success" message={t.saved} /> : null}

      <div>
        <Button type="submit" disabled={pending}>
          {t.save}
        </Button>
      </div>
    </form>
  );
}
