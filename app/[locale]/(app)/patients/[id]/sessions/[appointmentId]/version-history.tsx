"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { SessionNoteVersion } from "@/lib/dal/session-notes";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { format } from "@/lib/i18n/format";
import { getVersionAction } from "./actions";

/** Earlier versions are loaded only when opened, and each opening is audited. */
export function VersionHistory({
  locale,
  t,
  timezone,
  versions,
}: {
  locale: Locale;
  t: Dictionary["summary"];
  timezone: string;
  versions: SessionNoteVersion[];
}) {
  const [open, setOpen] = useState<Record<string, string>>({});
  const [, startTransition] = useTransition();
  const when = new Intl.DateTimeFormat(locale === "he" ? "he-IL" : "en-IL", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timezone,
  });

  return (
    <ol className="divide-y rounded-md border">
      {versions.map((version, index) => {
        const body = open[version.id];
        return (
          <li key={version.id} className="flex flex-col gap-2 px-3 py-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm">
                {format(t.versionBy, {
                  date: when.format(new Date(version.savedAt)),
                  name: version.savedBy ?? "—",
                })}
                {index === 0 ? (
                  <Badge variant="secondary" className="ms-2">
                    {t.current}
                  </Badge>
                ) : null}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-expanded={body !== undefined}
                onClick={() => {
                  if (body !== undefined) {
                    setOpen((current) => {
                      const next = { ...current };
                      delete next[version.id];
                      return next;
                    });
                    return;
                  }
                  startTransition(async () => {
                    const text = await getVersionAction({
                      locale,
                      versionId: version.id,
                    });
                    setOpen((current) => ({
                      ...current,
                      [version.id]: text ?? "",
                    }));
                  });
                }}
              >
                {body !== undefined ? t.hide : t.view}
              </Button>
            </div>
            {body !== undefined ? (
              <p
                dir="auto"
                className="rounded-md bg-muted px-3 py-2 text-sm whitespace-pre-wrap"
              >
                {body}
              </p>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
