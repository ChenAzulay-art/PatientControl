"use client";

import { Check, Copy, ExternalLink } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { FormMessage } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import type { BookingSettings } from "@/lib/dal/booking-settings";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { format } from "@/lib/i18n/format";
import {
  INTERVAL_OPTIONS,
  MIN_NOTICE_OPTIONS,
  WINDOW_DAYS_OPTIONS,
} from "@/lib/validation/booking";
import { type BookingSettingsState, saveBookingSettings } from "./actions";

export function BookingSettingsForm({
  locale,
  t,
  settings,
  bookingUrl,
}: {
  locale: Locale;
  t: Dictionary["onlineBooking"];
  settings: BookingSettings;
  bookingUrl: string;
}) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [state, formAction, pending] = useActionState<
    BookingSettingsState,
    FormData
  >(saveBookingSettings, {});

  useEffect(() => {
    if (state.savedAt) router.refresh();
  }, [state.savedAt, router]);

  const noticeLabel = (minutes: number) =>
    format(t.hours, { n: String(minutes / 60) });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">{t.link}</span>
        <code
          dir="ltr"
          className="block rounded-md bg-muted px-3 py-2 text-sm break-all"
        >
          {bookingUrl}
        </code>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={async () => {
              await navigator.clipboard.writeText(bookingUrl);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
          >
            {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
            {copied ? t.copied : t.copy}
          </Button>
          <Button asChild variant="ghost" size="sm">
            <a href={bookingUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink aria-hidden />
              <span className="sr-only">{t.link}</span>
            </a>
          </Button>
        </div>
      </div>

      {settings.enabled && !settings.hasBookableTypes ? (
        <FormMessage message={t.needsTypes} />
      ) : null}
      {settings.enabled && !settings.hasWorkingHours ? (
        <FormMessage message={t.needsHours} />
      ) : null}

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
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            name="autoConfirm"
            defaultChecked={settings.autoConfirm}
            className="mt-0.5 size-4 accent-primary"
            aria-describedby="auto-confirm-hint"
          />
          <span>
            {t.autoConfirm}
            <span
              id="auto-confirm-hint"
              className="block text-muted-foreground"
            >
              {t.autoConfirmHint}
            </span>
          </span>
        </label>

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">{t.minNotice}</span>
            <NativeSelect
              name="minNoticeMinutes"
              defaultValue={String(settings.minNoticeMinutes)}
            >
              {MIN_NOTICE_OPTIONS.map((minutes) => (
                <NativeSelectOption key={minutes} value={String(minutes)}>
                  {noticeLabel(minutes)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">{t.window}</span>
            <NativeSelect
              name="windowDays"
              defaultValue={String(settings.windowDays)}
            >
              {WINDOW_DAYS_OPTIONS.map((days) => (
                <NativeSelectOption key={days} value={String(days)}>
                  {format(t.days, { n: String(days) })}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">{t.interval}</span>
            <NativeSelect
              name="intervalMinutes"
              defaultValue={String(settings.intervalMinutes)}
            >
              {INTERVAL_OPTIONS.map((minutes) => (
                <NativeSelectOption key={minutes} value={String(minutes)}>
                  {format(t.minutes, { n: String(minutes) })}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </label>
        </div>

        <FormMessage message={state.error ? t.invalid : null} />
        {state.savedAt ? (
          <FormMessage tone="success" message={t.saved} />
        ) : null}

        <div>
          <Button type="submit" disabled={pending}>
            {t.save}
          </Button>
        </div>
      </form>
    </div>
  );
}
