import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { getAvailableSlots, getBookingClinic } from "@/lib/dal/public-booking";
import { getDictionary, getLocale } from "@/lib/i18n/dictionaries";
import { format } from "@/lib/i18n/format";
import { BookingFlow } from "./booking-flow";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: (await getDictionary()).booking.title,
    // Booking pages are shared by link, not found through search engines.
    robots: { index: false, follow: false },
  };
}

type Params = PageProps<"/[locale]/book/[slug]">["params"];

export default async function BookingPage({
  params,
}: PageProps<"/[locale]/book/[slug]">) {
  const t = await getDictionary();
  return (
    <Suspense
      fallback={
        <p className="text-sm text-muted-foreground">{t.common.loading}</p>
      }
    >
      <Booking params={params} />
    </Suspense>
  );
}

async function Booking({ params }: { params: Params }) {
  const locale = await getLocale();
  const t = await getDictionary();
  const { slug } = await params;
  // Free times depend on the current time: render per request.
  await connection();
  const clinic = await getBookingClinic(slug);
  if (!clinic) notFound();
  // One treatment: show its times right away.
  const initialSlots =
    clinic.treatmentTypes.length === 1
      ? await getAvailableSlots(clinic, clinic.treatmentTypes[0].id)
      : undefined;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold">{clinic.name}</h1>
        <p className="mt-1 text-muted-foreground">
          {format(t.booking.subtitle, { clinic: clinic.name })}
        </p>
      </div>
      {clinic.treatmentTypes.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          {t.booking.noTypes}
        </p>
      ) : (
        <BookingFlow
          locale={locale}
          t={t.booking}
          minutesLabel={t.appointment.minutes}
          clinic={{
            name: clinic.name,
            slug: clinic.slug,
            timezone: clinic.timezone,
            treatmentTypes: clinic.treatmentTypes,
          }}
          initialSlots={initialSlots}
        />
      )}
    </div>
  );
}
