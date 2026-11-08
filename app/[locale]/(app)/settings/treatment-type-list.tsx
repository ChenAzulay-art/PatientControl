"use client";

import { Pencil } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { format } from "@/lib/i18n/format";
import { colorOf } from "@/lib/scheduling/colors";
import { toggleTreatmentType } from "./actions";
import {
  TreatmentTypeForm,
  type TreatmentTypeValues,
} from "./treatment-type-form";

type Item = TreatmentTypeValues & { id: string; active: boolean };

export function TreatmentTypeList({
  locale,
  t,
  minutesLabel,
  items,
}: {
  locale: Locale;
  t: Dictionary["treatmentTypes"];
  minutesLabel: string;
  items: Item[];
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const currency = new Intl.NumberFormat(locale === "he" ? "he-IL" : "en-IL", {
    style: "currency",
    currency: "ILS",
    maximumFractionDigits: 2,
  });

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{t.empty}</p>;
  }

  return (
    <ul className="divide-y rounded-md border">
      {items.map((item) =>
        editing === item.id ? (
          <li key={item.id} className="p-3">
            <TreatmentTypeForm
              locale={locale}
              t={t}
              initial={item}
              onDone={() => setEditing(null)}
            />
          </li>
        ) : (
          <li
            key={item.id}
            className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
          >
            <span
              className={`flex items-center gap-2 ${item.active ? "" : "text-muted-foreground"}`}
            >
              <span
                aria-hidden
                className="size-3 shrink-0 rounded-full border"
                style={{
                  background: colorOf(item.color).background,
                  borderColor: colorOf(item.color).border,
                }}
              />
              <span className="font-medium">{item.name}</span>
              <span className="text-sm text-muted-foreground">
                {format(minutesLabel, { n: String(item.durationMinutes) })}
                {item.priceAgorot != null
                  ? ` · ${currency.format(item.priceAgorot / 100)}`
                  : ""}
              </span>
              {item.active ? null : (
                <Badge variant="outline">{t.inactive}</Badge>
              )}
            </span>
            <span className="flex gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setEditing(item.id)}
              >
                <Pencil aria-hidden />
                {t.edit}
              </Button>
              <form action={toggleTreatmentType}>
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="id" value={item.id} />
                <input
                  type="hidden"
                  name="active"
                  value={item.active ? "false" : "true"}
                />
                <Button type="submit" variant="ghost" size="sm">
                  {item.active ? t.hide : t.show}
                </Button>
              </form>
            </span>
          </li>
        ),
      )}
    </ul>
  );
}
