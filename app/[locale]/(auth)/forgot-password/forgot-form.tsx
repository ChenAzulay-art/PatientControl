"use client";

import { useState, useTransition, type FormEvent } from "react";
import { FormMessage } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { authClient, authErrorKind } from "@/lib/auth-client";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";

export function ForgotPasswordForm({
  locale,
  t,
}: {
  locale: Locale;
  t: Dictionary["auth"];
}) {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(
      new FormData(event.currentTarget).get("email") ?? "",
    ).trim();
    setError(null);

    startTransition(async () => {
      const { error } = await authClient.requestPasswordReset({
        email,
        redirectTo: `/${locale}/reset-password`,
      });
      if (error && authErrorKind(error) === "tooManyRequests") {
        setError(t.errors.tooManyRequests);
        return;
      }
      // Same message whether or not the account exists, so emails can't be probed.
      setSent(true);
    });
  }

  if (sent) return <FormMessage tone="success" message={t.forgot.sent} />;

  return (
    <form onSubmit={onSubmit}>
      <FieldGroup>
        <FormMessage message={error} />
        <Field>
          <FieldLabel htmlFor="email">{t.email}</FieldLabel>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            dir="ltr"
            required
          />
        </Field>
        <Button type="submit" disabled={pending}>
          {t.forgot.submit}
        </Button>
      </FieldGroup>
    </form>
  );
}
