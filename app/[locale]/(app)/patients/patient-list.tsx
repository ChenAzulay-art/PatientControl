"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import type { PatientListItem } from "@/lib/dal/patients";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { formatPhone } from "@/lib/validation/phone";
import { searchPatients } from "./actions";

const LIST_LIMIT = 200;

export function PatientList({
  locale,
  t,
  archived,
  initial,
}: {
  locale: Locale;
  t: Dictionary["patients"];
  archived: boolean;
  initial: PatientListItem[];
}) {
  const [query, setQuery] = useState("");
  const [patients, setPatients] = useState(initial);
  const [pending, startTransition] = useTransition();
  const latest = useRef(0);

  useEffect(() => {
    const term = query.trim();
    const request = ++latest.current;
    const timer = setTimeout(
      () => {
        startTransition(async () => {
          const result = term
            ? await searchPatients({ locale, query: term, archived })
            : initial;
          // Ignore answers to searches the user has already typed past.
          if (request === latest.current) setPatients(result);
        });
      },
      term ? 250 : 0,
    );
    return () => clearTimeout(timer);
  }, [query, archived, initial, locale]);

  return (
    <div className="flex flex-col gap-4">
      <div role="search" className="relative sm:max-w-sm">
        <label htmlFor="patient-search" className="sr-only">
          {t.searchLabel}
        </label>
        <Search
          aria-hidden
          className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          id="patient-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t.searchPlaceholder}
          className="ps-8"
          autoComplete="off"
          aria-busy={pending}
        />
      </div>

      {patients.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          {query.trim() || archived ? t.noResults : t.empty}
        </p>
      ) : (
        <ul
          className="divide-y rounded-lg border"
          aria-live="polite"
          aria-busy={pending}
        >
          {patients.map((patient) => (
            <li key={patient.id}>
              <Link
                href={`/${locale}/patients/${patient.id}`}
                className="flex flex-col gap-1 px-4 py-3 hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none sm:flex-row sm:items-center sm:gap-4"
              >
                <span className="font-medium sm:w-1/3">
                  {patient.fullName}
                  {patient.archived ? (
                    <Badge variant="outline" className="ms-2">
                      {t.archivedBadge}
                    </Badge>
                  ) : null}
                </span>
                <span
                  dir="ltr"
                  className="text-sm text-muted-foreground sm:w-36 rtl:text-right"
                >
                  {formatPhone(patient.phone)}
                </span>
                <span className="flex flex-1 flex-wrap gap-1">
                  {patient.treatmentTypes.map((name) => (
                    <Badge key={name} variant="secondary">
                      {name}
                    </Badge>
                  ))}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {patients.length >= LIST_LIMIT ? (
        <p className="text-sm text-muted-foreground">{t.limitNote}</p>
      ) : null}
    </div>
  );
}
