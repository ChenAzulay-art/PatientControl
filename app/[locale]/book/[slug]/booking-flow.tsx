"use client";

import { CalendarCheck, CheckCircle2, Clock, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useState, useTransition, type FormEvent } from "react";
import { FormMessage } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { BookingClinic } from "@/lib/dal/public-booking";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { format } from "@/lib/i18n/format";
import type { DaySlots, Slot } from "@/lib/scheduling/slots";
import { cn } from "@/lib/utils";
import { type BookActionResult, bookAction, getSlotsAction } from "./actions";

type Props = {
  locale: Locale;
  t: Dictionary["booking"];
  minutesLabel: string;
  clinic: Pick<BookingClinic, "name" | "slug" | "timezone" | "treatmentTypes">;
  initialSlots?: DaySlots[];
};

export function BookingFlow({
  locale,
  t,
  minutesLabel,
  clinic,
  initialSlots,
}: Props) {
  const intl = locale === "he" ? "he-IL" : "en-IL";
  const [typeId, setTypeId] = useState<string | null>(
    clinic.treatmentTypes.length === 1 ? clinic.treatmentTypes[0].id : null,
  );
  // With a single treatment, the server already loaded its times.
  const [days, setDays] = useState<DaySlots[] | null>(initialSlots ?? null);
  const [day, setDay] = useState<string | null>(
    initialSlots?.[0]?.date ?? null,
  );
  const [slot, setSlot] = useState<Slot | null>(null);
  const [result, setResult] = useState<BookActionResult | null>(null);
  const [loading, startLoading] = useTransition();
  const [submitting, startSubmit] = useTransition();

  const type = clinic.treatmentTypes.find((item) => item.id === typeId);
  const currency = new Intl.NumberFormat(intl, {
    style: "currency",
    currency: "ILS",
    maximumFractionDigits: 2,
  });
  const dayLabel = (date: string) =>
    new Intl.DateTimeFormat(intl, {
      weekday: "short",
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    }).format(new Date(`${date}T12:00:00Z`));
  const longWhen = (iso: string) =>
    new Intl.DateTimeFormat(intl, {
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      timeZone: clinic.timezone,
    }).format(new Date(iso));

  function loadSlots(id: string) {
    setDays(null);
    setDay(null);
    setSlot(null);
    startLoading(async () => {
      const loaded = await getSlotsAction({
        slug: clinic.slug,
        treatmentTypeId: id,
      });
      setDays(loaded);
      setDay(loaded[0]?.date ?? null);
    });
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!type || !slot) return;
    const form = new FormData(event.currentTarget);
    startSubmit(async () => {
      try {
        const outcome = await bookAction({
          slug: clinic.slug,
          locale,
          treatmentTypeId: type.id,
          startsAt: slot.startsAt,
          fullName: String(form.get("fullName") ?? ""),
          phone: String(form.get("phone") ?? ""),
          email: String(form.get("email") ?? ""),
          reminderConsent: form.get("reminderConsent") === "on",
        });
        setResult(outcome);
        // The time was taken meanwhile: show fresh times.
        if (!outcome.ok && outcome.error === "slotUnavailable")
          loadSlots(type.id);
      } catch {
        setResult({ ok: false, error: "generic" });
      }
    });
  }

  if (result?.ok) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border p-8 text-center">
        <CheckCircle2 className="size-10 text-primary" aria-hidden />
        <h2 className="text-xl font-semibold">
          {result.status === "confirmed" ? t.confirmedTitle : t.requestedTitle}
        </h2>
        {type && slot ? (
          <p className="font-medium">
            {type.name} · {longWhen(slot.startsAt)}
          </p>
        ) : null}
        <p className="text-muted-foreground">
          {format(
            result.status === "confirmed" ? t.confirmedBody : t.requestedBody,
            { email: result.email, clinic: clinic.name },
          )}
        </p>
      </div>
    );
  }

  const failed = result && !result.ok ? result : null;
  const fieldError = (field: "fullName" | "phone" | "email") => {
    const code = failed?.fieldErrors?.[field];
    return code ? t.errors[code] : null;
  };
  const selectedDay = days?.find((item) => item.date === day);

  return (
    <div className="flex flex-col gap-8">
      {/* 1. Treatment */}
      <section className="flex flex-col gap-3" aria-labelledby="step-treatment">
        <h2 id="step-treatment" className="text-lg font-semibold">
          {t.chooseTreatment}
        </h2>
        <div
          className="grid gap-2 sm:grid-cols-2"
          role="radiogroup"
          aria-labelledby="step-treatment"
        >
          {clinic.treatmentTypes.map((item) => (
            <button
              key={item.id}
              type="button"
              role="radio"
              aria-checked={item.id === typeId}
              onClick={() => {
                if (item.id === typeId) return;
                setTypeId(item.id);
                setResult(null);
                loadSlots(item.id);
              }}
              className={cn(
                "flex flex-col items-start gap-1 rounded-lg border p-3 text-start transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                item.id === typeId && "border-primary bg-primary/5",
              )}
            >
              <span className="font-medium">{item.name}</span>
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Clock className="size-3.5" aria-hidden />
                {format(minutesLabel, { n: String(item.durationMinutes) })}
                {item.priceAgorot != null
                  ? ` · ${currency.format(item.priceAgorot / 100)}`
                  : ""}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* 2. Day and time */}
      {type ? (
        <section className="flex flex-col gap-3" aria-labelledby="step-time">
          <h2 id="step-time" className="text-lg font-semibold">
            {t.chooseTime}
          </h2>
          {loading || days === null ? (
            <p
              className="flex items-center gap-2 text-sm text-muted-foreground"
              role="status"
            >
              <LoaderCircle className="size-4 animate-spin" aria-hidden />
              {t.loadingSlots}
            </p>
          ) : days.length === 0 ? (
            <p className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">
              {t.noSlots}
            </p>
          ) : (
            <>
              <div
                className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
                role="radiogroup"
                aria-label={t.chooseTime}
              >
                {days.map((item) => (
                  <button
                    key={item.date}
                    type="button"
                    role="radio"
                    aria-checked={item.date === day}
                    onClick={() => {
                      setDay(item.date);
                      setSlot(null);
                    }}
                    className={cn(
                      "shrink-0 rounded-lg border px-3 py-2 text-sm whitespace-nowrap hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                      item.date === day &&
                        "border-primary bg-primary/5 font-medium",
                    )}
                  >
                    {dayLabel(item.date)}
                  </button>
                ))}
              </div>
              {selectedDay ? (
                <div
                  className="grid grid-cols-3 gap-2 sm:grid-cols-5"
                  role="radiogroup"
                  aria-label={dayLabel(selectedDay.date)}
                >
                  {selectedDay.slots.map((item) => (
                    <button
                      key={item.startsAt}
                      type="button"
                      role="radio"
                      aria-checked={item.startsAt === slot?.startsAt}
                      onClick={() => setSlot(item)}
                      dir="ltr"
                      className={cn(
                        "rounded-md border py-2 text-sm tabular-nums hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                        item.startsAt === slot?.startsAt &&
                          "border-primary bg-primary text-primary-foreground hover:bg-primary",
                      )}
                    >
                      {item.time}
                    </button>
                  ))}
                </div>
              ) : null}
            </>
          )}
        </section>
      ) : null}

      {/* 3. Details */}
      {type && slot ? (
        <section className="flex flex-col gap-3" aria-labelledby="step-details">
          <h2 id="step-details" className="text-lg font-semibold">
            {t.details}
          </h2>
          <p className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm">
            <CalendarCheck className="size-4 shrink-0" aria-hidden />
            <span>
              {type.name} · {longWhen(slot.startsAt)}
            </span>
          </p>
          <form onSubmit={submit} className="flex flex-col gap-4">
            <FormMessage
              message={failed?.error ? t.errors[failed.error] : null}
            />
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">{t.fullName}</span>
              <Input
                name="fullName"
                autoComplete="name"
                required
                minLength={2}
                maxLength={120}
                aria-invalid={failed?.fieldErrors?.fullName ? true : undefined}
              />
              <FieldError>{fieldError("fullName")}</FieldError>
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">{t.phone}</span>
              <Input
                name="phone"
                type="tel"
                dir="ltr"
                autoComplete="tel"
                required
                aria-invalid={failed?.fieldErrors?.phone ? true : undefined}
                aria-describedby="booking-phone-hint"
              />
              <span id="booking-phone-hint" className="text-muted-foreground">
                {t.phoneHint}
              </span>
              <FieldError>{fieldError("phone")}</FieldError>
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">{t.email}</span>
              <Input
                name="email"
                type="email"
                dir="ltr"
                autoComplete="email"
                required
                aria-invalid={failed?.fieldErrors?.email ? true : undefined}
                aria-describedby="booking-email-hint"
              />
              <span id="booking-email-hint" className="text-muted-foreground">
                {t.emailHint}
              </span>
              <FieldError>{fieldError("email")}</FieldError>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="reminderConsent"
                defaultChecked
                className="size-4 accent-primary"
              />
              {t.reminderConsent}
            </label>
            <p className="text-sm text-muted-foreground">
              {format(t.privacyNote, { clinic: clinic.name })}{" "}
              <Link
                href={`/${locale}/privacy`}
                target="_blank"
                className="underline underline-offset-4 hover:text-foreground"
              >
                {t.privacyLink}
              </Link>
            </p>
            <div>
              <Button type="submit" size="lg" disabled={submitting}>
                {submitting ? (
                  <LoaderCircle className="animate-spin" aria-hidden />
                ) : null}
                {t.submit}
              </Button>
            </div>
          </form>
        </section>
      ) : null}
    </div>
  );
}
