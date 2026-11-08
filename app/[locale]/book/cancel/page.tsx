import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { FormMessage } from "@/components/form-message";
import { getAppointmentByCancelToken } from "@/lib/dal/public-booking";
import { getDictionary, getLocale } from "@/lib/i18n/dictionaries";
import { format } from "@/lib/i18n/format";
import { CancelForm } from "./cancel-form";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: (await getDictionary()).booking.cancel.title,
    robots: { index: false, follow: false },
  };
}

export default async function CancelPage({
  searchParams,
}: PageProps<"/[locale]/book/cancel">) {
  const t = await getDictionary();
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">{t.booking.cancel.title}</h1>
      <Suspense
        fallback={
          <p className="text-sm text-muted-foreground">{t.common.loading}</p>
        }
      >
        <CancelDetails searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function CancelDetails({
  searchParams,
}: {
  searchParams: PageProps<"/[locale]/book/cancel">["searchParams"];
}) {
  const locale = await getLocale();
  const t = await getDictionary();
  const c = t.booking.cancel;
  const { token } = await searchParams;
  // Whether it can still be cancelled depends on the current time.
  await connection();
  const appointment =
    typeof token === "string" ? await getAppointmentByCancelToken(token) : null;

  if (!appointment) return <FormMessage message={c.invalid} />;

  const when = new Intl.DateTimeFormat(locale === "he" ? "he-IL" : "en-IL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: appointment.timezone,
  }).format(new Date(appointment.startsAt));

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border p-4">
        <p className="font-medium">{when}</p>
        <p className="text-muted-foreground">
          {appointment.treatmentName
            ? format(c.with, {
                treatment: appointment.treatmentName,
                clinic: appointment.clinicName,
              })
            : appointment.clinicName}
        </p>
      </div>
      {appointment.canCancel ? (
        <CancelForm
          locale={locale}
          t={c}
          token={token as string}
          slug={appointment.clinicSlug}
        />
      ) : (
        <div className="flex flex-col gap-3">
          <FormMessage
            message={
              appointment.status === "cancelled"
                ? c.alreadyCancelled
                : c.notCancellable
            }
          />
          <Link
            href={`/${locale}/book/${appointment.clinicSlug}`}
            className="text-sm font-medium underline underline-offset-4"
          >
            {c.bookAgain}
          </Link>
        </div>
      )}
    </div>
  );
}
