"use client";

import { Plus, X } from "lucide-react";
import { useActionState, useState } from "react";
import { FormMessage } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { WorkingHours } from "@/lib/validation/scheduling";
import { saveWorkingHours, type WorkingHoursState } from "./actions";

/** Israel's working week starts on Sunday. */
const WEEK_ORDER = [0, 1, 2, 3, 4, 5, 6];

export function WorkingHoursForm({
  locale,
  t,
  weekdayNames,
  initial,
}: {
  locale: Locale;
  t: Dictionary["workingHours"];
  weekdayNames: string[];
  initial: WorkingHours;
}) {
  const [hours, setHours] = useState<WorkingHours>(initial);
  const [state, formAction, pending] = useActionState<
    WorkingHoursState,
    FormData
  >(saveWorkingHours, {});

  function update(
    day: number,
    change: (ranges: WorkingHours[number]) => WorkingHours[number],
  ) {
    setHours((current) =>
      current.map((ranges, i) => (i === day ? change(ranges) : ranges)),
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="hours" value={JSON.stringify(hours)} />

      <ul className="divide-y rounded-md border">
        {WEEK_ORDER.map((day) => {
          const ranges = hours[day];
          return (
            <li
              key={day}
              className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-start"
            >
              <span className="w-24 shrink-0 pt-1.5 font-medium">
                {weekdayNames[day]}
              </span>
              <div className="flex flex-1 flex-col gap-2">
                {ranges.length === 0 ? (
                  <span className="pt-1.5 text-sm text-muted-foreground">
                    {t.closed}
                  </span>
                ) : (
                  ranges.map((range, index) => (
                    <div
                      key={index}
                      className="flex flex-wrap items-center gap-2"
                    >
                      <label
                        className="sr-only"
                        htmlFor={`wh-${day}-${index}-start`}
                      >
                        {`${weekdayNames[day]} ${t.from}`}
                      </label>
                      <Input
                        id={`wh-${day}-${index}-start`}
                        type="time"
                        step={300}
                        required
                        value={range.start}
                        onChange={(event) =>
                          update(day, (r) =>
                            r.map((x, i) =>
                              i === index
                                ? { ...x, start: event.target.value }
                                : x,
                            ),
                          )
                        }
                        className="w-32"
                      />
                      <span aria-hidden>–</span>
                      <label
                        className="sr-only"
                        htmlFor={`wh-${day}-${index}-end`}
                      >
                        {`${weekdayNames[day]} ${t.to}`}
                      </label>
                      <Input
                        id={`wh-${day}-${index}-end`}
                        type="time"
                        step={300}
                        required
                        value={range.end}
                        onChange={(event) =>
                          update(day, (r) =>
                            r.map((x, i) =>
                              i === index
                                ? { ...x, end: event.target.value }
                                : x,
                            ),
                          )
                        }
                        className="w-32"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`${t.removeRange} ${weekdayNames[day]} ${range.start}–${range.end}`}
                        onClick={() =>
                          update(day, (r) => r.filter((_, i) => i !== index))
                        }
                      >
                        <X aria-hidden />
                      </Button>
                    </div>
                  ))
                )}
              </div>
              {ranges.length < 4 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="self-start"
                  aria-label={`${t.addRange} ${weekdayNames[day]}`}
                  onClick={() =>
                    update(day, (r) => [
                      ...r,
                      r.length === 0
                        ? { start: "09:00", end: "17:00" }
                        : { start: r[r.length - 1].end, end: "20:00" },
                    ])
                  }
                >
                  <Plus aria-hidden />
                  {t.addRange}
                </Button>
              ) : null}
            </li>
          );
        })}
      </ul>

      <FormMessage message={state.error ? t.errors[state.error] : null} />
      {state.savedAt && !state.error ? (
        <FormMessage tone="success" message={t.saved} />
      ) : null}

      <div>
        <Button type="submit" disabled={pending}>
          {t.save}
        </Button>
      </div>
    </form>
  );
}
