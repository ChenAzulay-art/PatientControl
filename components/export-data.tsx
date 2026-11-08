"use client";

import { Download, LoaderCircle } from "lucide-react";
import { useState, useTransition, type FormEvent } from "react";
import { FormMessage } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Dictionary } from "@/lib/i18n/dictionaries";

type Props = {
  t: Dictionary["dataExport"];
} & ({ scope: "clinic" } | { scope: "patient"; patientId: string });

function filenameFrom(response: Response, fallback: string) {
  const match = response.headers
    .get("content-disposition")
    ?.match(/filename="([^"]+)"/);
  return match?.[1] ?? fallback;
}

/**
 * Downloads a JSON export from /api/export. The whole clinic asks for the
 * password again; one patient downloads straight away.
 */
export function ExportData(props: Props) {
  const { t } = props;
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const password = String(new FormData(form).get("password") ?? "");
    setError(null);
    setDone(false);
    startTransition(async () => {
      const response = await fetch("/api/export", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          props.scope === "clinic"
            ? { scope: "clinic", password }
            : { scope: "patient", patientId: props.patientId },
        ),
      }).catch(() => null);

      if (!response?.ok) {
        const code = response
          ? ((await response.json().catch(() => ({}))) as { error?: string })
              .error
          : undefined;
        setError(
          code === "wrongPassword"
            ? t.wrongPassword
            : code === "tooMany"
              ? t.tooMany
              : t.failed,
        );
        return;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filenameFrom(response, "export.json");
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      form.reset();
      setDone(true);
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      {props.scope === "clinic" ? (
        <label className="flex flex-col gap-1.5 text-sm sm:max-w-xs">
          <span className="font-medium">{t.password}</span>
          <Input
            name="password"
            type="password"
            autoComplete="current-password"
            dir="ltr"
            required
            maxLength={128}
          />
        </label>
      ) : null}
      <FormMessage message={error} />
      {done ? <FormMessage tone="success" message={t.done} /> : null}
      <div>
        <Button
          type="submit"
          variant={props.scope === "clinic" ? "default" : "ghost"}
          disabled={pending}
        >
          {pending ? (
            <LoaderCircle className="animate-spin" aria-hidden />
          ) : (
            <Download aria-hidden />
          )}
          {props.scope === "clinic" ? t.downloadClinic : t.downloadPatient}
        </Button>
      </div>
    </form>
  );
}
